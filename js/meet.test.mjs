import { OnlineRoom, normalizeCode, roomIdFor } from "./net.js";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function codeAt(n) {
  let s = "";
  let x = n;
  for (let i = 0; i < 5; i++) {
    s += LETTERS[x % LETTERS.length];
    x = Math.floor(x / LETTERS.length);
  }
  return s;
}

function brokerPeer() {
  let seq = 0;
  const hosts = new Map();
  function link() {
    const listeners = {};
    const conn = {
      open: false,
      other: null,
      on(ev, fn) {
        (listeners[ev] ||= []).push(fn);
        if (ev === "open" && conn.open) queueMicrotask(fn);
      },
      emit(ev, data) {
        for (const fn of listeners[ev] || []) fn(data);
      },
      send(msg) {
        conn.other?.emit("data", msg);
      },
      close() {
        conn.open = false;
        conn.emit("close");
      },
      markOpen() {
        conn.open = true;
        conn.emit("open");
      },
    };
    return conn;
  }
  function Peer(id) {
    const listeners = {};
    const peer = {
      destroyed: false,
      id: id || `anon-${++seq}`,
      on(ev, fn) { (listeners[ev] ||= []).push(fn); },
      emit(ev, ...args) {
        for (const fn of listeners[ev] || []) fn(...args);
      },
      connect(target) {
        const local = link();
        const remote = link();
        local.other = remote;
        remote.other = local;
        const host = hosts.get(target);
        queueMicrotask(() => {
          if (!host || host.destroyed) {
            peer.emit("error", { type: "peer-unavailable" });
            return;
          }
          host.emit("connection", remote);
          local.markOpen();
          remote.markOpen();
        });
        return local;
      },
      destroy() {
        this.destroyed = true;
        if (hosts.get(this.id) === peer) hosts.delete(this.id);
      },
      reconnect() {},
    };
    if (id) {
      if (hosts.has(id)) queueMicrotask(() => peer.emit("error", { type: "unavailable-id" }));
      else {
        hosts.set(id, peer);
        queueMicrotask(() => peer.emit("open", peer.id));
      }
    } else {
      queueMicrotask(() => peer.emit("open", peer.id));
    }
    return peer;
  }
  return Peer;
}

function room() {
  const r = new OnlineRoom();
  r.elo = 1000;
  const seen = [];
  r.onMessage = (msg) => seen.push(msg);
  r.onStatus = () => {};
  r.seen = seen;
  return r;
}

async function pair(codeA, codeB) {
  const Peer = brokerPeer();
  const a = room();
  const b = room();
  await Promise.all([a.meet(codeA, Peer), b.meet(codeB, Peer)]);
  a.send({ t: "pick", charId: "rook", n: 1 });
  b.send({ t: "pick", charId: "zip", n: 2 });
  await Promise.resolve();
  return { a, b };
}

const failures = [];
let passed = 0;

function check(name, ok) {
  if (ok) passed += 1;
  else failures.push(name);
}

async function sameCode(i, mutate) {
  const code = codeAt(i);
  const typed = mutate ? mutate(code) : code;
  const { a, b } = await pair(code, typed);
  const roles = [a.role, b.role].sort().join(",");
  const linked = roles === "guest,host"
    && a.conn?.open && b.conn?.open
    && roomIdFor(code) === roomIdFor(typed)
    && a.seen.some((m) => m.charId === "zip")
    && b.seen.some((m) => m.charId === "rook");
  check(`same ${i} ${code} vs ${typed}`, linked);
  a.destroy();
  b.destroy();
}

async function race(i) {
  const code = codeAt(10000 + i);
  const Peer = brokerPeer();
  const a = room();
  const b = room();
  await Promise.all([a.meet(code, Peer), b.meet(code.toLowerCase(), Peer)]);
  a.send({ t: "pick", charId: "a" });
  b.send({ t: "pick", charId: "b" });
  await Promise.resolve();
  const roles = [a.role, b.role].sort().join(",");
  check(`race ${i}`, roles === "guest,host" && a.seen.some((m) => m.charId === "b") && b.seen.some((m) => m.charId === "a"));
  a.destroy();
  b.destroy();
}

async function different(i) {
  const Peer = brokerPeer();
  const a = room();
  const b = room();
  await Promise.all([a.meet(codeAt(i), Peer), b.meet(codeAt(i + 40000), Peer)]);
  check(`apart ${i}`, a.role === "host" && b.role === "host" && !a.conn && !b.conn && a.code !== b.code);
  a.destroy();
  b.destroy();
}

async function invalid(i) {
  const r = room();
  const bad = ["", "ab", "12", "!!!!", "abc", "a", "    "];
  const sample = i % 2 === 0 ? bad[i % bad.length] : String(i).slice(0, 3);
  let threw = false;
  try {
    await r.meet(sample === "" ? "no" : sample, brokerPeer());
  } catch {
    threw = true;
  }
  check(`invalid ${i} ${sample}`, threw && normalizeCode(sample).length < 5);
  r.destroy();
}

async function reclaim(i) {
  const code = codeAt(50000 + i);
  const Peer = brokerPeer();
  const ghost = room();
  await ghost.meet(code, Peer);
  ghost.destroy();
  const { a, b } = await (async () => {
    const host = room();
    const guest = room();
    await host.meet(` ${code.toLowerCase()} `, Peer);
    await guest.meet(code, Peer);
    host.send({ t: "pick", charId: "rook" });
    guest.send({ t: "pick", charId: "zip" });
    await Promise.resolve();
    return { a: host, b: guest };
  })();
  check(`reclaim ${i}`, a.role === "host" && b.role === "guest" && b.seen.some((m) => m.charId === "rook") && a.seen.some((m) => m.charId === "zip"));
  a.destroy();
  b.destroy();
}

const jobs = [];
for (let i = 0; i < 600; i++) jobs.push(sameCode(i));
for (let i = 0; i < 300; i++) {
  jobs.push(sameCode(600 + i, (code) => ` ${code.toLowerCase()} `));
}
for (let i = 0; i < 400; i++) jobs.push(race(i));
for (let i = 0; i < 200; i++) jobs.push(different(i));
for (let i = 0; i < 100; i++) jobs.push(invalid(i));
for (let i = 0; i < 100; i++) jobs.push(reclaim(i));

if (jobs.length !== 1700) {
  console.error(`planned ${jobs.length}, expected 1700`);
  process.exit(1);
}

await Promise.all(jobs);
console.log(`${passed}/1700 passed`);
if (failures.length) {
  console.error(failures.slice(0, 20).join("\n"));
  process.exit(1);
}
