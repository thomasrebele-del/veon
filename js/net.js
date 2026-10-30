// Lockstep link. A room code uses a private id. Quick match uses one shared
// lobby that pairs whoever is waiting, then the two fighters talk directly.
export const NET_DELAY = 8;

const INPUT_KEYS = [
  "left", "right", "up", "down", "shield", "shieldPressed", "jump",
  "light", "heavy", "heavyHeld", "special", "grab", "grabHeld",
];

export function packInput(input) {
  let bits = 0;
  for (let i = 0; i < INPUT_KEYS.length; i++) if (input?.[INPUT_KEYS[i]]) bits |= 1 << i;
  return bits;
}

export function unpackInput(bits) {
  const n = bits | 0;
  const input = {};
  for (let i = 0; i < INPUT_KEYS.length; i++) input[INPUT_KEYS[i]] = !!(n & (1 << i));
  return input;
}

const LOBBY_ID = "veon-open-lobby";

const PEER_URLS = [
  "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js",
  "https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js",
];

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
};

export function readElo() {
  try {
    const n = Number(localStorage.getItem("veon-elo"));
    if (Number.isFinite(n) && n >= 100 && n <= 4000) return Math.round(n);
  } catch { /* private mode */ }
  return 1000;
}

export const RANK_ONE = 1100;
const RANK_KEY = "veon-rank1";

export function writeElo(n) {
  const v = Math.max(100, Math.min(4000, Math.round(n)));
  try {
    localStorage.setItem("veon-elo", String(v));
    if (v >= RANK_ONE) localStorage.setItem(RANK_KEY, "1");
  } catch { /* ignore */ }
  return v;
}

export function rankOne() {
  try {
    if (localStorage.getItem(RANK_KEY) === "1") return true;
  } catch { /* ignore */ }
  if (readElo() >= RANK_ONE) {
    try { localStorage.setItem(RANK_KEY, "1"); } catch { /* ignore */ }
    return true;
  }
  return false;
}

// Standard Elo. A win against a higher rating moves you more than a win against a lower one.
export function eloDelta(mine, theirs, win) {
  const expected = 1 / (1 + 10 ** ((theirs - mine) / 400));
  return Math.round(32 * ((win ? 1 : 0) - expected));
}

function peerOpts() {
  return { debug: 0, config: ICE };
}

function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (window.__veonPeer) return window.__veonPeer;
  window.__veonPeer = new Promise((resolve, reject) => {
    let i = 0;
    const next = () => {
      if (i >= PEER_URLS.length) {
        reject(new Error("Could not load the online library."));
        return;
      }
      const s = document.createElement("script");
      s.src = PEER_URLS[i++];
      s.onload = () => (window.Peer ? resolve(window.Peer) : next());
      s.onerror = () => next();
      document.head.appendChild(s);
    };
    next();
  });
  return window.__veonPeer;
}

function once(target, ok, bad, ms, label) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, v) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      fn(v);
    };
    const t = setTimeout(() => finish(reject, new Error(label)), ms);
    target.on(ok, (v) => finish(resolve, v));
    target.on(bad, (err) => finish(reject, err));
  });
}

function parse(msg) {
  if (typeof msg === "string") {
    try { return JSON.parse(msg); } catch { return null; }
  }
  return msg;
}

export class OnlineRoom {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.code = "";
    this.role = "";
    this.ranked = false;
    this.elo = readElo();
    this.theirElo = 1000;
    this.charId = "rook";
    this.broker = false;
    this.inMatch = false;
    this.queue = [];
    this.alive = true;
    this.onMessage = () => {};
    this.onStatus = () => {};
    this.onLeave = () => {};
  }

  watch(peer) {
    peer.on("disconnected", () => {
      if (!peer.destroyed && this.alive) {
        try { peer.reconnect(); } catch { /* broker will time out */ }
      }
    });
    peer.on("error", (err) => {
      if (err?.type === "unavailable-id" || err?.type === "peer-unavailable") return;
      if (!this.conn && this.alive) this.onStatus("error", err?.message || "The link dropped.");
    });
  }

  keepalive(conn) {
    const id = setInterval(() => {
      if (!conn.open) { clearInterval(id); return; }
      try { conn.send({ t: "ping" }); } catch { /* ignore */ }
    }, 4000);
    conn.on("close", () => clearInterval(id));
  }

  bind(conn) {
    this.conn = conn;
    this.keepalive(conn);
    conn.on("data", (msg) => {
      const data = parse(msg);
      if (!data || data.t === "ping" || data.t === "seek" || data.t === "play" || data.t === "pair") return;
      this.onMessage(data);
    });
    conn.on("close", () => { if (this.conn === conn) this.onLeave(); });
    conn.on("error", () => { if (this.conn === conn) this.onLeave(); });
  }

  send(msg) {
    if (this.conn?.open) this.conn.send(msg);
  }

  async host(code) {
    const Peer = await loadPeer();
    this.role = "host";
    this.ranked = false;
    this.code = String(code || randomCode()).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
    let last = null;
    for (let n = 0; n < 4 && !this.peer; n++) {
      const id = `veon-${this.code}`;
      const peer = new Peer(id, peerOpts());
      try {
        await once(peer, "open", "error", 14000, "The room could not open. Try again.");
        this.peer = peer;
      } catch (err) {
        last = err;
        try { peer.destroy(); } catch { /* already closed */ }
        if (err?.type !== "unavailable-id") break;
        this.code = randomCode();
      }
    }
    if (!this.peer) throw last || new Error("The room could not open.");
    this.watch(this.peer);
    this.peer.on("connection", (conn) => {
      if (this.conn) { conn.on("open", () => { try { conn.close(); } catch { /* full */ } }); return; }
      conn.on("open", () => {
        this.bind(conn);
        this.onStatus("connected");
      });
    });
    this.onStatus("waiting");
    return this.code;
  }

  async join(code) {
    const Peer = await loadPeer();
    this.role = "guest";
    this.ranked = false;
    this.code = String(code || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
    if (this.code.length < 5) throw new Error("Enter the five-letter code.");
    const peer = new Peer(undefined, peerOpts());
    this.peer = peer;
    try {
      await once(peer, "open", "error", 14000, "Could not reach the online service.");
    } catch (err) {
      this.destroy();
      throw err;
    }
    this.watch(peer);
    const conn = peer.connect(`veon-${this.code}`, { reliable: true, serialization: "json" });
    this.bind(conn);
    try {
      await once(conn, "open", "error", 18000, "No match is using that code. Ask your friend to host first.");
    } catch (err) {
      this.destroy();
      throw err?.type === "peer-unavailable"
        ? new Error("No match is using that code. Ask your friend to host first.")
        : err;
    }
    this.onStatus("connected");
  }

  // Claim the shared lobby if it is free. Otherwise wait in that lobby's queue.
  async find(charId) {
    const Peer = await loadPeer();
    this.ranked = true;
    this.elo = readElo();
    this.charId = charId || "rook";
    this.onStatus("searching");
    const peer = new Peer(LOBBY_ID, peerOpts());
    try {
      await once(peer, "open", "error", 8000, "Could not reach matchmaking.");
      this.becomeBroker(peer);
      return;
    } catch (err) {
      try { peer.destroy(); } catch { /* not ours */ }
      if (err?.type !== "unavailable-id" && !/unavailable/i.test(err?.message || "")) {
        // The lobby may still be up. Try to join it before giving up.
      }
    }
    if (!this.alive) return;
    await this.enqueue(Peer);
  }

  becomeBroker(peer) {
    this.peer = peer;
    this.broker = true;
    this.role = "host";
    this.watch(peer);
    this.queue = [{ self: true }];
    peer.on("connection", (conn) => {
      conn.on("data", (msg) => this.onSeek(conn, parse(msg)));
      conn.on("close", () => {
        this.queue = this.queue.filter((q) => q.conn !== conn);
      });
    });
    this.onStatus("searching");
  }

  onSeek(conn, msg) {
    if (!msg || msg.t !== "seek" || this.queue.some((q) => q.conn === conn)) return;
    this.queue.push({
      conn,
      peerId: conn.peer,
      elo: Number(msg.elo) || 1000,
      charId: msg.charId || "rook",
    });
    this.pairQueue();
  }

  pairQueue() {
    const remotes = this.queue.filter((q) => !q.self);
    const self = this.queue.find((q) => q.self);
    this.queue = [];
    if (self && !this.inMatch && remotes.length) {
      this.startBrokerMatch(remotes.shift());
    } else if (self && !this.inMatch) this.queue.push(self);
    while (remotes.length >= 2) {
      this.directPair(remotes.shift(), remotes.shift());
    }
    this.queue.push(...remotes);
  }

  startBrokerMatch(other) {
    this.inMatch = true;
    this.theirElo = other.elo || 1000;
    this.role = "host";
    try { other.conn.send({ t: "play", elo: this.elo, charId: this.charId }); } catch { /* they will retry */ }
    this.bind(other.conn);
    this.onStatus("connected");
  }

  directPair(a, b) {
    const send = (q, peer, youHost, opp) => {
      try {
        q.conn.send({ t: "pair", peer, youHost, elo: opp.elo, charId: opp.charId });
        setTimeout(() => { try { q.conn.close(); } catch { /* already gone */ } }, 500);
      } catch { /* seeker will search again */ }
    };
    send(a, b.peerId, true, b);
    send(b, a.peerId, false, a);
  }

  async enqueue(Peer) {
    const peer = new Peer(undefined, peerOpts());
    this.peer = peer;
    this.role = "guest";
    try {
      await once(peer, "open", "error", 14000, "Could not reach matchmaking.");
    } catch (err) {
      this.destroy();
      throw err;
    }
    if (!this.alive) return;
    this.watch(peer);
    peer.on("connection", (conn) => {
      if (this.inMatch || this.conn) return;
      conn.on("open", () => {
        this.role = "guest";
        this.inMatch = true;
        this.bind(conn);
        this.onStatus("connected");
      });
    });
    const lobby = peer.connect(LOBBY_ID, { reliable: true, serialization: "json" });
    this.lobby = lobby;
    try {
      await once(lobby, "open", "error", 14000, "The open lobby did not answer. Try again.");
    } catch (err) {
      this.destroy();
      throw err;
    }
    if (!this.alive) return;
    lobby.send({ t: "seek", elo: this.elo, charId: this.charId });
    lobby.on("data", (msg) => this.onLobby(parse(msg)));
    lobby.on("close", () => {
      if (!this.inMatch && this.alive) this.onStatus("error", "The lobby closed. Search again.");
    });
    this.onStatus("searching");
  }

  async onLobby(msg) {
    if (!msg || this.inMatch) return;
    if (msg.t === "play") {
      this.theirElo = Number(msg.elo) || 1000;
      this.role = "guest";
      this.inMatch = true;
      if (this.lobby) this.bind(this.lobby);
      this.onStatus("connected");
      return;
    }
    if (msg.t !== "pair" || !msg.peer) return;
    this.theirElo = Number(msg.elo) || 1000;
    this.inMatch = true;
    if (msg.youHost) {
      this.role = "host";
      const conn = this.peer.connect(msg.peer, { reliable: true, serialization: "json" });
      this.bind(conn);
      try {
        await once(conn, "open", "error", 16000, "The opponent dropped before the match opened.");
        this.onStatus("connected");
      } catch (err) {
        this.onStatus("error", err?.message || "The opponent dropped.");
      }
    } else {
      this.role = "guest";
      this.onStatus("searching");
    }
  }

  destroy() {
    this.alive = false;
    this.queue = [];
    try { this.conn?.close(); } catch { /* already gone */ }
    try { this.lobby?.close(); } catch { /* already gone */ }
    try { this.peer?.destroy(); } catch { /* already gone */ }
    this.conn = null;
    this.lobby = null;
    this.peer = null;
  }
}

export function randomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 5; i++) s += letters[(Math.random() * letters.length) | 0];
  return s;
}
