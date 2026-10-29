export const NET_DELAY = 8;

const INPUT_KEYS = [
  "left", "right", "up", "down", "shield", "shieldPressed", "jump",
  "light", "heavy", "heavyHeld", "special", "grab", "grabHeld",
];

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

function makeCode() {
  let code = "";
  for (let i = 0; i < 5; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

function loadPeer() {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  if (loadPeer.pending) return loadPeer.pending;
  loadPeer.pending = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
    script.onload = () => (globalThis.Peer ? resolve(globalThis.Peer) : reject(new Error("PeerJS did not start")));
    script.onerror = () => reject(new Error("Could not reach the matchmaking service. Check your connection."));
    document.head.appendChild(script);
  });
  return loadPeer.pending;
}

function once(target, okName, badName, ms, badMessage) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error(badMessage)), ms);
    target.on(okName, () => finish(resolve));
    target.on(badName, (err) => finish(reject, err instanceof Error ? err : new Error(err?.message || badMessage)));
  });
}

export class OnlineRoom {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.role = "";
    this.code = "";
    this.onMessage = () => {};
    this.onStatus = () => {};
  }

  async host() {
    const Peer = await loadPeer();
    this.role = "host";
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = makeCode();
      const peer = new Peer(`veon-${code}`);
      try {
        await once(peer, "open", "error", 8000, "The room timed out before it opened.");
      } catch (err) {
        lastError = err;
        try { peer.destroy(); } catch { /* already closed */ }
        if (err?.type === "unavailable-id" && attempt < 3) continue;
        throw new Error(err?.type === "unavailable-id" ? "Could not open a free room. Try again." : (err?.message || "Could not open a room."));
      }
      this.peer = peer;
      this.code = code;
      peer.on("connection", (conn) => {
        if (this.conn?.open) {
          conn.close();
          return;
        }
        this.bind(conn);
      });
      peer.on("error", (err) => {
        if (err?.type === "unavailable-id") return;
        this.onStatus("error", err);
      });
      this.onStatus("waiting", code);
      return code;
    }
    throw new Error(lastError?.message || "Could not open a room.");
  }

  async join(raw) {
    const Peer = await loadPeer();
    this.role = "guest";
    this.code = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    if (this.code.length < 5) throw new Error("Enter the 5-character code.");
    const peer = new Peer();
    try {
      await once(peer, "open", "error", 12000, "Could not reach matchmaking.");
    } catch (err) {
      try { peer.destroy(); } catch { /* already closed */ }
      throw new Error(err?.message || "Could not reach matchmaking.");
    }
    this.peer = peer;
    peer.on("error", (err) => this.onStatus("error", err));
    const conn = peer.connect(`veon-${this.code}`, { reliable: true });
    this.bind(conn);
    try {
      if (!conn.open) {
        await once(conn, "open", "error", 12000, "No match with that code. Check it and try again.");
      }
    } catch (err) {
      this.destroy();
      const missing = err?.type === "peer-unavailable";
      throw new Error(missing ? "No match with that code. Check it and try again." : (err?.message || "No match with that code."));
    }
    this.onStatus("connected");
  }

  bind(conn) {
    this.conn = conn;
    conn.on("data", (msg) => this.onMessage(msg));
    conn.on("open", () => this.onStatus("connected"));
    conn.on("close", () => this.onStatus("closed"));
    conn.on("error", () => this.onStatus("error", new Error("The link dropped.")));
  }

  send(msg) {
    if (this.conn?.open) this.conn.send(msg);
  }

  destroy() {
    try { this.conn?.close(); } catch { /* already closed */ }
    try { this.peer?.destroy(); } catch { /* already closed */ }
    this.conn = null;
    this.peer = null;
  }
}
