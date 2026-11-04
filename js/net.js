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

const BROKERS = [
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://broker.emqx.io:8084/mqtt",
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

export function hostStarts(role) {
  return role === "host";
}

export function lineup(hostChar, guestChar) {
  const pick = (id) => (id ? String(id) : "rook");
  return [pick(hostChar), pick(guestChar)];
}

export function randomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 5; i++) s += letters[(Math.random() * letters.length) | 0];
  return s;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clientId() {
  return `v${Math.random().toString(36).slice(2, 10)}`;
}

function mqttLen(n) {
  const out = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) b |= 0x80;
    out.push(b);
  } while (n > 0);
  return out;
}

function mqttStr(text) {
  const bytes = new TextEncoder().encode(text);
  return [bytes.length >> 8, bytes.length & 0xff, ...bytes];
}

function mqttPacket(type, body) {
  return Uint8Array.from([type, ...mqttLen(body.length), ...body]);
}

function readMqtt(buf, onPacket) {
  let rest = buf;
  while (rest.length >= 2) {
    let value = 0;
    let mult = 1;
    let i = 1;
    let complete = false;
    for (; i < rest.length && i < 5; i++) {
      value += (rest[i] & 0x7f) * mult;
      mult *= 128;
      if ((rest[i] & 0x80) === 0) {
        complete = true;
        i += 1;
        break;
      }
    }
    if (!complete || rest.length < i + value) break;
    onPacket(rest[0], rest.slice(i, i + value));
    rest = rest.slice(i + value);
  }
  return rest;
}

function mqttString(body, offset) {
  const n = (body[offset] << 8) | body[offset + 1];
  const text = new TextDecoder().decode(body.slice(offset + 2, offset + 2 + n));
  return [text, offset + 2 + n];
}

function openMqtt(subscribeTopic, publishTopic, id) {
  return new Promise((resolve, reject) => {
    let pending = BROKERS.length;
    let won = false;
    const fail = () => {
      pending -= 1;
      if (!won && pending <= 0) reject(new Error("The server list did not answer."));
    };
    for (const url of BROKERS) {
      let ws;
      let buf = new Uint8Array(0);
      const timer = setTimeout(() => {
        try { ws?.close(); } catch { /* timed out */ }
        fail();
      }, 2500);
      try {
        ws = new WebSocket(url, ["mqtt"]);
      } catch {
        clearTimeout(timer);
        fail();
        continue;
      }
      ws.binaryType = "arraybuffer";
      const queued = [];
      let listener = null;
      const give = (msg) => {
        if (listener) listener(msg);
        else queued.push(msg);
      };
      ws.onopen = () => {
        ws.send(mqttPacket(0x10, [...mqttStr("MQTT"), 4, 0x02, 0x00, 15, ...mqttStr(id)]));
      };
      ws.onerror = () => {
        clearTimeout(timer);
        fail();
      };
      ws.onmessage = (ev) => {
        const chunk = new Uint8Array(ev.data);
        const joined = new Uint8Array(buf.length + chunk.length);
        joined.set(buf);
        joined.set(chunk, buf.length);
        buf = readMqtt(joined, (type, body) => {
          const kind = type >> 4;
          if (kind === 2 && body[1] === 0 && !won) {
            won = true;
            clearTimeout(timer);
            ws.send(mqttPacket(0x82, [0x00, 0x01, ...mqttStr(subscribeTopic), 0x00]));
            resolve({
              id,
              send(obj, retain) {
                if (ws.readyState !== 1) return;
                const payload = [...new TextEncoder().encode(JSON.stringify(obj))];
                ws.send(mqttPacket(retain ? 0x31 : 0x30, [...mqttStr(publishTopic), ...payload]));
              },
              clear() {
                if (ws.readyState !== 1) return;
                ws.send(mqttPacket(0x31, [...mqttStr(publishTopic)]));
              },
              on(fn) {
                listener = fn;
                for (const msg of queued) fn(msg);
                queued.length = 0;
              },
              close() {
                try { ws.close(); } catch { /* already closed */ }
              },
            });
          } else if (kind === 3) {
            let offset = 0;
            [, offset] = mqttString(body, 0);
            if (type & 0x06) offset += 2;
            const json = new TextDecoder().decode(body.slice(offset));
            try { give(JSON.parse(json)); } catch { /* ignore junk */ }
          }
        });
      };
    }
  });
}

export function normalizeCode(raw) {
  return String(raw || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
}

export function roomIdFor(code) {
  return `veon${normalizeCode(code).toLowerCase()}`;
}

function roomId(code) {
  return roomIdFor(code);
}

export class OnlineRoom {
  constructor() {
    this.link = null;
    this.conn = null;
    this.code = "";
    this.role = "";
    this.me = "";
    this.them = "";
    this.ranked = true;
    this.elo = readElo();
    this.theirElo = 1000;
    this.alive = true;
    this.onMessage = () => {};
    this.onStatus = () => {};
    this.onStart = () => {};
    this.onLeave = () => {};
    this.started = false;
    this.guestReady = false;
    this.startMsg = null;
    this.localInputs = new Map();
    this.onInputs = () => {};
    this.readyLeft = 40;
  }

  noteLocal(f, b) {
    const bits = b | 0;
    if (this.localInputs.get(f) === bits) return;
    this.localInputs.set(f, bits);
    this.send({ t: "in", f, b: bits });
  }

  flushInputs() {
    const frames = [...this.localInputs.keys()];
    const last = frames[frames.length - 1];
    if (last == null) return;
    const list = [];
    for (let frame = Math.max(1, last - 1); frame <= last; frame++) {
      if (this.localInputs.has(frame)) list.push([frame, this.localInputs.get(frame)]);
    }
    if (list.length) this.send({ t: "ins", list });
  }

  fight(payload) {
    if (!hostStarts(this.role) || this.started || !this.conn) return false;
    this.started = true;
    this.startMsg = { t: "start", n: `${this.me}-1`, ...payload };
    this.pump();
    this.startTimer = setInterval(() => this.pump(), 200);
    this.onStart(this.startMsg);
    return true;
  }

  pump() {
    if (!this.alive) return;
    if (hostStarts(this.role) && this.startMsg && !this.guestReady) this.send(this.startMsg);
    if (!hostStarts(this.role) && this.seenStart && this.readyLeft > 0) {
      this.readyLeft -= 1;
      this.send({ t: "ready", n: this.seenN });
    }
    this.flushInputs();
  }

  send(msg) {
    if (this.alive && this.link) this.link.send({ ...msg, from: this.me });
  }

  hear(msg) {
    if (!this.alive || !msg || msg.from === this.me) return;
    if (msg.t === "hi") {
      if (this.them && msg.from !== this.them) return;
      const first = !this.conn;
      this.them = msg.from;
      this.role = this.me < msg.from ? "host" : "guest";
      if (first) {
        this.conn = { open: true };
        this.link?.send({ t: "hi", from: this.me });
        this.onStatus("connected");
      }
      return;
    }
    if (msg.t === "bye") {
      if (!this.them || msg.from === this.them) this.onStatus("closed");
      return;
    }
    if (msg.t === "start" && !hostStarts(this.role)) {
      this.seenStart = true;
      this.seenN = msg.n;
      if (msg.inputs) this.onInputs(msg.inputs);
      this.pump();
      if (!this.startTimer) this.startTimer = setInterval(() => this.pump(), 200);
      if (!this.started) {
        this.started = true;
        this.onStart(msg);
      }
      return;
    }
    if (msg.t === "ready" && hostStarts(this.role) && this.startMsg && msg.n === this.startMsg.n) {
      this.guestReady = true;
      if (msg.inputs) this.onInputs(msg.inputs);
      return;
    }
    if (msg.t === "ins") {
      this.onInputs(msg.list);
      return;
    }
    if (this.them && msg.from !== this.them) return;
    this.onMessage(msg);
  }

  // Anyone who types the same server number, 1 through 10, lands in that room.
  async meet(raw, openLink) {
    const server = Math.floor(Number(raw));
    if (!(server >= 1 && server <= 10)) throw new Error("Type a server from 1 to 10.");
    this.code = String(server);
    this.elo = readElo();
    const me = clientId();
    const topic = `veon/s/${server}`;
    const link = await (openLink || openMqtt)(`${topic}/+`, `${topic}/${me}`, me);
    if (!this.alive) {
      link.close();
      return;
    }
    this.link = link;
    this.me = link.id || me;
    link.on((msg) => this.hear(msg));
    this.onStatus("waiting", this.code);
    const hello = () => {
      if (this.alive && !this.conn) link.send({ t: "hi", from: this.me });
    };
    hello();
    this.hiTimer = setInterval(hello, 200);
  }

  destroy() {
    this.alive = false;
    clearInterval(this.hiTimer);
    clearInterval(this.startTimer);
    try { this.link?.send({ t: "bye", from: this.me }); } catch { /* already gone */ }
    try { this.link?.clear?.(); } catch { /* already gone */ }
    try { this.link?.close(); } catch { /* already gone */ }
    this.conn = null;
    this.link = null;
  }
}
