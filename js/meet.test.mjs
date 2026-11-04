import { OnlineRoom, hostStarts } from "./net.js";

function hub(dropStart, dropReady, duplicate) {
  const topics = new Map();
  let n = 0;
  const left = { start: dropStart, ready: dropReady };
  return function openLink(topic) {
    const id = `c${++n}`;
    const listeners = new Set();
    if (!topics.has(topic)) topics.set(topic, new Set());
    const room = topics.get(topic);
    const api = {
      id,
      send(obj) {
        if (left[obj.t] > 0) {
          left[obj.t] -= 1;
          return;
        }
        const deliver = () => {
          for (const other of [...room]) if (other !== api) other.deliver(obj);
        };
        deliver();
        if (duplicate && (obj.t === "start" || obj.t === "ready")) deliver();
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

let passed = 0;
for (let i = 0; i < 1400; i++) {
  const open = hub(i % 17, (i * 3) % 11, i % 5 === 0);
  const a = new OnlineRoom();
  const b = new OnlineRoom();
  let aOnce = 0;
  let bOnce = 0;
  let aMsg = null;
  let bMsg = null;
  a.onStart = (msg) => { aOnce += 1; aMsg = aMsg || msg; };
  b.onStart = (msg) => { bOnce += 1; bMsg = bMsg || msg; };
  a.onStatus = () => {};
  b.onStatus = () => {};
  const server = (i % 10) + 1;
  await a.meet(server, open);
  await b.meet(server, open);
  const host = a.role === "host" ? a : b;
  const guest = host === a ? b : a;
  if (a.role === b.role || !hostStarts(host.role) || hostStarts(guest.role)) {
    throw new Error(`trial ${i} both sides could start`);
  }
  if (guest.fight({ chars: ["nope", "nope"] }) !== false) throw new Error(`trial ${i} guest had the button`);
  const payload = { arenaId: "citadel", stocks: 3, chars: ["rook", "zip"] };
  if (host.fight(payload) !== true) throw new Error(`trial ${i} host button did nothing`);
  for (let step = 0; step < 50 && (!host.guestReady || !guest.started); step++) {
    host.pump();
    guest.pump();
  }
  const guestMsg = guest === a ? aMsg : bMsg;
  const hostMsg = host === a ? aMsg : bMsg;
  const guestOnce = guest === a ? aOnce : bOnce;
  if (!host.started || !guest.started || !host.guestReady || guestOnce !== 1) {
    throw new Error(`trial ${i} did not start both`);
  }
  if (hostMsg.chars.join() !== "rook,zip" || guestMsg.chars.join() !== "rook,zip") {
    throw new Error(`trial ${i} mismatched fighters`);
  }
  host.destroy();
  guest.destroy();
  passed += 1;
}

if (passed !== 1400) {
  console.error(`${passed}/1400`);
  process.exit(1);
}
console.log("1400/1400 passed");
