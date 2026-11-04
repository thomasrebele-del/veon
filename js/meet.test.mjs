import { OnlineRoom } from "./net.js";

function hub() {
  const topics = new Map();
  let n = 0;
  return function openLink(topic) {
    const id = `c${++n}`;
    const listeners = new Set();
    if (!topics.has(topic)) topics.set(topic, new Set());
    const room = topics.get(topic);
    const api = {
      id,
      send(obj) {
        for (const other of [...room]) if (other !== api) other.deliver(obj);
      },
      deliver(obj) {
        for (const fn of listeners) fn(obj);
      },
      on(fn) { listeners.add(fn); },
      close() { room.delete(api); },
    };
    room.add(api);
    return Promise.resolve(api);
  };
}

function room() {
  const r = new OnlineRoom();
  r.elo = 1000;
  r.seen = [];
  r.onMessage = (msg) => r.seen.push(msg);
  r.onStatus = () => {};
  return r;
}

const open = hub();
let passed = 0;

for (let server = 1; server <= 10; server++) {
  const a = room();
  const b = room();
  const started = Date.now();
  await a.meet(server, open);
  await b.meet(String(server), open);
  if (Date.now() - started > 2500) throw new Error(`server ${server} took too long`);
  a.send({ t: "pick", charId: "rook" });
  b.send({ t: "pick", charId: "zip" });
  const host = a.role === "host" ? a : b;
  const guest = host === a ? b : a;
  host.send({ t: "start", chars: ["rook", "zip"] });
  if (!guest.seen.some((m) => m.t === "start" && m.chars[0] === "rook")) throw new Error(`server ${server} missed the start`);
  const roles = [a.role, b.role].sort().join(",");
  if (roles === "guest,host" && a.conn?.open && b.conn?.open && a.seen.some((m) => m.charId === "zip") && b.seen.some((m) => m.charId === "rook")) passed += 1;
  else throw new Error(`server ${server} did not pair`);
  a.destroy();
  b.destroy();
}

const a = room();
const b = room();
await a.meet(1, open);
await b.meet(2, open);
if (a.conn || b.conn) throw new Error("different servers paired");
a.destroy();
b.destroy();
passed += 1;

for (const bad of [0, 11, "abc", ""]) {
  const r = room();
  let threw = false;
  try { await r.meet(bad, open); } catch { threw = true; }
  if (!threw) throw new Error(`accepted ${bad}`);
  passed += 1;
  r.destroy();
}

console.log(`${passed} server tests passed`);
