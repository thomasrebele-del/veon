// One room per code. The first player to type it waits. The next player
// with that same code connects to them. PeerJS keeps its own relay.
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

const PEER_URLS = [
  "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js",
  "https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js",
];

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

export function eloDelta(mine, theirs, win) {
  const expected = 1 / (1 + 10 ** ((theirs - mine) / 400));
  return Math.round(32 * ((win ? 1 : 0) - expected));
}

export function randomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 5; i++) s += letters[(Math.random() * letters.length) | 0];
  return s;
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roomId(code) {
  return `veon${String(code).toLowerCase()}`;
}

export class OnlineRoom {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.code = "";
    this.role = "";
    this.ranked = true;
    this.elo = readElo();
    this.theirElo = 1000;
    this.alive = true;
    this.onMessage = () => {};
    this.onStatus = () => {};
    this.onLeave = () => {};
  }

  send(msg) {
    if (this.conn?.open) this.conn.send(msg);
  }

  take(conn) {
    if (this.conn && this.conn !== conn) {
      try { conn.close(); } catch { /* already full */ }
      return;
    }
    this.conn = conn;
    const ping = setInterval(() => {
      if (!conn.open) { clearInterval(ping); return; }
      try { conn.send({ t: "ping" }); } catch { /* ignore */ }
    }, 4000);
    conn.on("data", (msg) => {
      let data = msg;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { data = null; }
      }
      if (!data || data.t === "ping") return;
      this.onMessage(data);
    });
    conn.on("close", () => {
      clearInterval(ping);
      if (this.conn === conn) this.onStatus("closed");
    });
    conn.on("error", () => {
      if (this.conn === conn) this.onStatus("closed");
    });
    this.onStatus("connected");
  }

  // First person with this code waits. The next person with the same code joins them.
  async meet(raw) {
    const Peer = await loadPeer();
    const code = String(raw || randomCode()).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
    if (code.length < 5) throw new Error("Use five letters.");
    this.code = code;
    this.elo = readElo();
    const id = roomId(code);
    let last = null;
    for (let attempt = 0; attempt < 4 && this.alive; attempt++) {
      const claimed = await this.claim(Peer, id);
      if (claimed === "host") return;
      if (!this.alive) return;
      try {
        await this.joinId(Peer, id);
        return;
      } catch (err) {
        last = err;
        await wait(700);
      }
    }
    this.destroy();
    throw last || new Error("Nobody on that code answered. Try again.");
  }

  claim(Peer, id) {
    return new Promise((resolve) => {
      if (!this.alive) { resolve("stop"); return; }
      const peer = new Peer(id);
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        try { peer.destroy(); } catch { /* timed out */ }
        finish("retry");
      }, 12000);
      peer.on("open", () => {
        this.peer = peer;
        this.role = "host";
        peer.on("connection", (conn) => {
          conn.on("open", () => this.take(conn));
        });
        peer.on("disconnected", () => {
          if (!peer.destroyed && this.alive) {
            try { peer.reconnect(); } catch { /* guest will retry */ }
          }
        });
        this.onStatus("waiting", this.code);
        finish("host");
      });
      peer.on("error", (err) => {
        if (done) return;
        try { peer.destroy(); } catch { /* already closed */ }
        finish(err?.type === "unavailable-id" ? "taken" : "retry");
      });
    });
  }

  joinId(Peer, id) {
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      this.peer = peer;
      this.role = "guest";
      let done = false;
      const fail = (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { peer.destroy(); } catch { /* already closed */ }
        this.peer = null;
        reject(err instanceof Error ? err : new Error("That code did not answer."));
      };
      const timer = setTimeout(() => fail(new Error("That code did not answer. Ask them to stay on the code.")), 16000);
      peer.on("open", () => {
        const conn = peer.connect(id, { reliable: true });
        conn.on("open", () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          this.take(conn);
          resolve();
        });
        conn.on("error", () => fail(new Error("That code did not answer.")));
      });
      peer.on("error", (err) => {
        if (err?.type === "peer-unavailable") fail(new Error("Nobody is on that code yet."));
        else fail(err);
      });
    });
  }

  destroy() {
    this.alive = false;
    try { this.conn?.close(); } catch { /* already gone */ }
    try { this.peer?.destroy(); } catch { /* already gone */ }
    this.conn = null;
    this.peer = null;
  }
}
