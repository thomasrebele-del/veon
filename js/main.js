import { CHARACTERS, CONTROLLERS, MODES, STAGES, controlLabel, preset } from "./data.js?v=solo";
import { drawMenuScene, drawPortrait } from "./render.js?v=fx";
import { Game } from "./game.js?v=solo";
import { sfx, unlock } from "./audio.js";
import { NET_DELAY, OnlineRoom } from "./net.js";

const canvas = document.getElementById("view");
const ui = document.getElementById("ui");

const state = {
  screen: "title",
  mode: "cpu",
  slots: preset("cpu"),
  arenaId: "citadel",
  stocks: 3,
  result: null,
  lobby: null,
  net: null,
};

let game = null;
let room = null;
let view = "menu";
let frame = 0;
let boostOn = false;
let seqAt = 0;

function typedDigit(e) {
  const fromCode = { Digit2: "2", Numpad2: "2", Digit7: "7", Numpad7: "7", Digit8: "8", Numpad8: "8" }[e.code];
  if (fromCode) return fromCode;
  return e.key === "2" || e.key === "7" || e.key === "8" ? e.key : "";
}

function showBoostNote() {
  let el = document.getElementById("boost-note");
  if (!el) {
    el = document.createElement("div");
    el.id = "boost-note";
    el.textContent = "12× DAMAGE";
    Object.assign(el.style, {
      position: "fixed",
      left: "50%",
      top: "18%",
      transform: "translateX(-50%)",
      zIndex: "40",
      pointerEvents: "none",
      fontFamily: "Cinzel, Georgia, serif",
      fontWeight: "900",
      fontSize: "58px",
      letterSpacing: "0.08em",
      color: "#ffe08a",
      background: "rgba(12,8,6,0.9)",
      border: "3px solid #ffd23f",
      padding: "18px 36px",
      textShadow: "0 3px 0 #140c09",
    });
    document.body.appendChild(el);
  }
  el.hidden = false;
  el.style.display = "block";
  clearTimeout(showBoostNote.timer);
  showBoostNote.timer = setTimeout(() => { el.hidden = true; }, 3000);
}

function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}

function sameCtrl(a, b) {
  return a.type === b.type && a.level === b.level && a.scheme === b.scheme;
}

function bars(def) {
  const rows = [
    ["Speed", def.speed / 8.6],
    ["Weight", def.weight / 1.45],
    ["Jumps", def.jumps / 4],
    ["Power", def.moves.heavy.dmg / 28],
  ];
  return `<div class="bars">${rows.map(([name, n]) => `<div>${name}<i><b style="--n:${n}"></b></i></div>`).join("")}</div>`;
}

function moveList(def) {
  const kind = {
    light: "tilt",
    heavy: "smash · hold",
    aerial: "air",
    special: "special",
    up: "up special",
    dash: "dash",
    getup: "ledge",
    grab: "grab",
  };
  const rows = Object.values(def.moves).filter((m, i, all) => all.findIndex((o) => o.name === m.name) === i);
  return `<ul class="moves">${rows.map((m) => {
    const tags = [kind[m.kind] || m.kind, m.meteor ? "meteor" : "", m.counter ? "counter" : "", m.grab ? "throw" : ""].filter(Boolean).join(" · ");
    return `<li><strong>${m.name}</strong> · ${tags}</li>`;
  }).join("")}</ul>`;
}

function help() {
  return `<div class="help">
    <div class="panel"><p><b>YOU</b><br>Move A D or the arrow keys · Jump W or Up · Drop S or Down<br>Light C · Heavy V · Special B · Block Shift · Grab G</p></div>
    <div class="panel"><p><b>DIRECTIONS</b><br>Hold a direction with light for tilts, or in the air for aerials. Up and down with heavy are smashes — hold to charge. Side, up, and down change the special. Up+special still recovers.</p></div>
    <div class="panel"><p><b>BLOCK, GRAB, COUNTER</b><br>Block catches hits. Hold grab to keep a hold. You can walk and jump while you have them, then release to throw — aim the throw with a direction. A swinging attack beats a grab. Down+heavy is a meteor smash. Down specials marked counter clap back during the flash.</p></div>
    <div class="panel"><p><b>STOCKS</b><br>The final-blow cinematic plays only when the last stock cannot be saved by DI, a tech, or a ledge. M mutes. In training, R resets the dummy.</p></div>
  </div>`;
}

function titleHtml() {
  return `<div class="screen"><div class="hero">
      <p class="eyebrow">Arena Fighter</p>
      <h1 class="logo">VEON</h1>
      <p class="tag">Last stock. Last light.</p>
      <a class="reel" href="slideshow.html">Watch the slideshow</a>
    </div>
    <div class="modes">
      ${MODES.map((m) => `<button data-act="mode" data-id="${m.id}"><strong>${m.name}</strong><span>${m.desc}</span></button>`).join("")}
      <button class="wide" data-act="online"><strong>Online</strong><span>Play someone who has the game open</span></button>
    </div>
    ${help()}
  </div>`;
}

const TOKEN = ["#ffd23f", "#7eb6ff", "#ff6b6b", "#3ee0b0"];
const CSS_COLS = 5;

function ensureHands() {
  if (!state.hands || state.hands.length !== state.slots.length) {
    state.hands = state.slots.map((slot) => ({
      index: Math.max(0, CHARACTERS.findIndex((c) => c.id === slot.charId)),
      ready: slot.controller.type !== "human",
    }));
  }
}

function handLabel(slot) {
  if (slot.controller.type === "human") return `P${(slot.controller.scheme || 0) + 1}`;
  if (!slot.controller.level) return "CPU";
  return `CPU${slot.controller.level}`;
}

function humansReady() {
  ensureHands();
  return state.hands.every((hand, i) => hand.ready || state.slots[i].controller.type !== "human");
}

function handCard(i) {
  const slot = state.slots[i];
  const hand = state.hands[i];
  const def = CHARACTERS[hand.index];
  const team = state.mode === "teams"
    ? `<button class="chip ${slot.team ? "blue" : "red"}" data-act="team" data-slot="${i}">${slot.team ? "BLUE" : "RED"}</button>`
    : "";
  return `<aside class="css-card ${hand.ready ? "is-ready" : ""}" style="--fighter:${def.color};--token:${TOKEN[i % TOKEN.length]}">
      <canvas class="bust hero-bust" width="480" height="320" data-id="${def.id}"></canvas>
      <p class="css-tag">${handLabel(slot)}</p>
      <h3>${def.name}</h3>
      <p class="arch">${def.archetype}</p>
      <p class="css-ready">${hand.ready ? "READY" : "CHOOSING"}</p>
      ${team}
    </aside>`;
}

function setupHtml() {
  ensureHands();
  const mode = MODES.find((m) => m.id === state.mode);
  const ready = humansReady();
  const tokensAt = CHARACTERS.map(() => []);
  state.hands.forEach((hand, i) => {
    tokensAt[hand.index].push({ i, label: handLabel(state.slots[i]), ready: hand.ready });
  });
  const icons = CHARACTERS.map((c, index) => {
    const tokens = tokensAt[index].map((t) => `<span class="css-token ${t.ready ? "locked" : ""}" style="--token:${TOKEN[t.i % TOKEN.length]}">${t.label}</span>`).join("");
    const hot = state.hands.some((h) => h.index === index);
    return `<button class="css-icon ${hot ? "hot" : ""}" style="--fighter:${c.color}" data-act="css" data-i="${index}" title="${c.name}">
        <canvas class="icon-bust" width="160" height="120" data-id="${c.id}"></canvas>
        <span class="css-tokens">${tokens}</span>
      </button>`;
  }).join("");
  const extras = state.slots.slice(2).map((_, k) => handCard(k + 2)).join("");
  const arenas = STAGES.map((s) => `<button class="arena ${s.id === state.arenaId ? "on" : ""}" style="background:linear-gradient(${s.sky[0]}, ${s.sky[2] || s.sky[1]})" data-act="arena" data-id="${s.id}"><b>${s.name}</b></button>`).join("");
  const stocks = state.mode === "training" ? "" : `<div class="stocks">${[1, 2, 3, 5].map((n) => `<button class="chip ${n === state.stocks ? "on" : ""}" data-act="stock" data-n="${n}">${n}</button>`).join("")}</div>`;
  return `<div class="screen css-screen"><div class="css">
    <div class="row">
      <button class="ghost" data-act="back">← Back</button>
      <div class="css-title"><p class="eyebrow">${mode.name}</p><h2>Choose your fighter</h2></div>
      <button class="fight" data-act="fight" ${ready ? "" : "disabled"}>Start</button>
    </div>
    <div class="css-stage">
      ${handCard(0)}
      <div class="css-mid">
        <div class="css-roster">${icons}</div>
        ${extras ? `<div class="css-extras">${extras}</div>` : ""}
      </div>
      ${state.slots[1] ? handCard(1) : "<div></div>"}
    </div>
    <div class="css-bar">
      <div class="arenas css-arenas">${arenas}</div>
      ${stocks}
      <p class="css-hint">WASD or arrows move · C ready · V back</p>
    </div>
  </div></div>`;
}

function moveHand(i, dc, dr) {
  ensureHands();
  const hand = state.hands[i];
  if (!hand || hand.ready) return;
  const cols = CSS_COLS;
  const rows = Math.ceil(CHARACTERS.length / cols);
  const x = hand.index % cols;
  const y = Math.floor(hand.index / cols);
  const nx = (x + dc + cols) % cols;
  const ny = (y + dr + rows) % rows;
  let index = ny * cols + nx;
  if (index >= CHARACTERS.length) index = nx;
  hand.index = index;
  state.slots[i].charId = CHARACTERS[index].id;
  sfx("ui");
  render();
}

function confirmHand(i) {
  ensureHands();
  const hand = state.hands[i];
  if (!hand || hand.ready) return;
  hand.ready = true;
  state.slots[i].charId = CHARACTERS[hand.index].id;
  sfx("impact");
  render();
}

function cancelHand(i) {
  ensureHands();
  const hand = state.hands[i];
  if (!hand || !hand.ready) return;
  hand.ready = false;
  sfx("ui");
  render();
}

function resultsHtml() {
  const r = state.result;
  const names = r.winnerSlots.map((i) => r.stats[i].name).join("  &  ") || "NO CONTEST";
  return `<div class="screen"><div class="results">
      <p class="eyebrow">Winner</p>
      <h2 class="winner">${names}</h2>
      ${r.finisher ? `<p class="tag">Finished with ${r.finisher}</p>` : `<p class="tag">The void keeps the rest.</p>`}
      <div class="stats n${r.stats.length}">
        ${r.stats.map((s) => `<div class="panel stat" style="--fighter:${s.color}"><b>${s.name}</b><p>${s.label}</p><p>KOs ${s.kos}</p><p>Falls ${s.falls}</p><p>Damage ${s.dealt}%</p></div>`).join("")}
      </div>
      <div class="actions">
        <button class="fight" data-act="rematch">Rematch</button>
        <button class="ghost" data-act="setup">Change fighters</button>
        <button class="ghost" data-act="title">Main menu</button>
      </div>
    </div></div>`;
}

function fightHtml() {
  const training = state.mode === "training";
  const hint = training ? "ESC EXIT · R RESET · M MUTE" : state.net ? "PLAYER 1 KEYS · ESC PAUSE · M MUTE" : "ESC PAUSE · M MUTE";
  return `<p class="hint">${hint}</p>
    <div class="veil" hidden>
      <div class="panel">
        <h3>Paused</h3>
        <p>The blast zone can wait.</p>
        <div class="actions">
          <button class="fight" data-act="resume">Resume</button>
          <button class="ghost" data-act="forfeit">Forfeit</button>
        </div>
      </div>
    </div>`;
}

function onlineHtml() {
  const lobby = state.lobby || { phase: "choose", status: "", code: "", myChar: "rook", theirChar: "", note: "" };
  const mine = CHARACTERS.find((c) => c.id === lobby.myChar) || CHARACTERS[0];
  const theirs = CHARACTERS.find((c) => c.id === lobby.theirChar);
  if (lobby.phase === "choose" || lobby.phase === "connecting" || lobby.phase === "error") {
    return `<div class="screen"><div class="sheet">
      <div class="row">
        <button class="ghost" data-act="back">← Back</button>
        <h2>Online</h2>
        <span></span>
      </div>
      <div class="modes">
        <button data-act="host"><strong>Host match</strong><span>You get a code. Send it to the other player.</span></button>
        <button data-act="join"><strong>Join match</strong><span>Enter the host's code.</span></button>
      </div>
      <div class="panel" style="margin-top:16px">
        <p><b>ROOM CODE</b></p>
        <input id="room-code" class="code" maxlength="5" placeholder="CODE" autocomplete="off">
        <p class="lobby-note">${lobby.note || lobby.status || "Both of you need this game open. Each player uses the Player 1 keys."}</p>
      </div>
    </div></div>`;
  }
  if (lobby.phase === "waiting") {
    return `<div class="screen"><div class="sheet">
      <div class="row">
        <button class="ghost" data-act="back">← Back</button>
        <h2>Online</h2>
        <span></span>
      </div>
      <div class="panel">
        <p><b>SHARE THIS CODE</b></p>
        <p class="lobby-code">${lobby.code}</p>
        <button class="ghost" data-act="copy">Copy code</button>
        <p class="lobby-note">${lobby.status || "Waiting for the other player."}</p>
      </div>
    </div></div>`;
  }
  const arenaName = STAGES.find((s) => s.id === state.arenaId)?.name || state.arenaId;
  const arenas = lobby.role === "host"
    ? `<div class="arenas">${STAGES.map((s) => `<button class="arena ${s.id === state.arenaId ? "on" : ""}" style="background:linear-gradient(${s.sky[0]}, ${s.sky[2] || s.sky[1]})" data-act="arena" data-id="${s.id}"><b>${s.name}</b><span>${s.blurb}</span></button>`).join("")}</div>`
    : `<p class="lobby-note">${arenaName} · ${state.stocks} stocks</p>`;
  const stocks = lobby.role === "host"
    ? `<div class="stocks" style="margin-top:8px">${[1, 2, 3, 5].map((n) => `<button class="chip ${n === state.stocks ? "on" : ""}" data-act="stock" data-n="${n}">${n}</button>`).join("")}</div>`
    : "";
  const start = lobby.role === "host"
    ? `<button class="fight" data-act="netfight" ${lobby.theirChar ? "" : "disabled"}>Fight</button>`
    : `<p class="lobby-note">Waiting for the host to start.</p>`;
  return `<div class="screen"><div class="sheet">
    <div class="row">
      <button class="ghost" data-act="back">← Back</button>
      <h2>Online ${lobby.code}</h2>
      ${start}
    </div>
    <div class="cards n2">
      <article class="card" style="--fighter:${mine.color}">
        <canvas class="bust" width="480" height="280" data-id="${mine.id}"></canvas>
        <p class="arch">You</p>
        <h3>${mine.name}</h3>
        <div class="css-roster css-roster-online">
          ${CHARACTERS.map((c) => `<button class="css-icon ${c.id === mine.id ? "hot" : ""}" style="--fighter:${c.color}" data-act="mychar" data-id="${c.id}" title="${c.name}"><canvas class="icon-bust" width="160" height="120" data-id="${c.id}"></canvas></button>`).join("")}
        </div>
      </article>
      <article class="card" style="--fighter:${theirs?.color || "#888"}">
        <p class="arch">Opponent</p>
        <h3>${theirs?.name || "Choosing…"}</h3>
        <p class="blurb">${theirs?.blurb || "Their pick shows up when they choose."}</p>
      </article>
    </div>
    <div class="setup-bottom">
      <div class="panel"><p><b>ARENA</b></p>${arenas}</div>
      <div class="panel"><p><b>STOCKS</b></p>${stocks}</div>
    </div>
    <p class="lobby-note">${lobby.note || "Both players use the Player 1 keys: A D move, W jump, S drop, C light, V heavy, B special, Shift block, G grab."}</p>
  </div></div>`;
}

function closeRoom() {
  room?.destroy();
  room = null;
  state.lobby = null;
  state.net = null;
}

function openLobby(note) {
  if (!state.lobby) state.lobby = { phase: "lobby", role: "guest", code: "", myChar: "rook", theirChar: "", note: "" };
  state.lobby.phase = "lobby";
  if (note) state.lobby.note = note;
  view = "menu";
  state.screen = "online";
  render();
}

function wireRoom() {
  room.onStatus = (status, extra) => {
    if (!state.lobby) return;
    if (status === "waiting") {
      state.lobby.phase = "waiting";
      state.lobby.code = extra || room.code;
      state.lobby.status = "Share this code. The other player presses Online, then Join.";
      render();
    } else if (status === "connected") {
      state.lobby.phase = "lobby";
      state.lobby.status = "";
      state.lobby.note = "Connected. Pick a fighter. You both use the Player 1 keys.";
      room.send({ t: "pick", charId: state.lobby.myChar });
      if (state.lobby.role === "host") room.send({ t: "rules", arenaId: state.arenaId, stocks: state.stocks });
      render();
    } else if (status === "closed") {
      state.lobby.note = "The other player left.";
      if (game) {
        game.onEnd = () => {
          game = null;
          view = "menu";
          openLobby("The other player left.");
        };
        game.quit();
      } else if (state.screen !== "online") openLobby("The other player left.");
      else render();
    } else if (status === "error") {
      state.lobby.phase = state.lobby.phase === "lobby" ? "lobby" : "error";
      state.lobby.note = extra?.message || "The link dropped.";
      render();
    }
  };
  room.onMessage = (msg) => {
    if (!msg || !state.lobby) return;
    if (msg.t === "pick") {
      state.lobby.theirChar = msg.charId;
      if (state.screen === "online") render();
    } else if (msg.t === "rules" && state.lobby.role !== "host") {
      state.arenaId = msg.arenaId;
      state.stocks = msg.stocks;
      if (state.screen === "online") render();
    } else if (msg.t === "start") beginNet(msg);
    else if (msg.t === "in" && state.net) state.net.remoteBox.set(msg.f, msg.b);
    else if (msg.t === "sum" && game) game.noteSum(msg.f, msg.s);
    else if (msg.t === "pause" && game) game.applyNetPause(msg.v);
    else if (msg.t === "lobby") openLobby();
    else if (msg.t === "leave") {
      if (game) {
        game.onEnd = () => {
          game = null;
          view = "menu";
          openLobby("The other player left.");
        };
        game.quit();
      } else openLobby("The other player left.");
    }
  };
}

function beginNet(msg) {
  const localSlot = state.lobby.role === "host" ? 0 : 1;
  state.mode = "online";
  state.arenaId = msg.arenaId;
  state.stocks = msg.stocks;
  state.slots = [
    { charId: msg.chars[0], controller: { type: "human", scheme: 0 }, team: 0 },
    { charId: msg.chars[1], controller: { type: "human", scheme: 1 }, team: 1 },
  ];
  const localBox = new Map();
  const remoteBox = new Map();
  state.net = {
    localSlot,
    delay: NET_DELAY,
    localBox,
    remoteBox,
    send: (f, b) => room?.send({ t: "in", f, b }),
    sendSum: (f, s) => room?.send({ t: "sum", f, s }),
    sendPause: (v) => room?.send({ t: "pause", v }),
  };
  startFight();
}

function paint() {
  if (state.screen !== "setup" && state.screen !== "online") return;
  const nodes = [...ui.querySelectorAll("canvas.hero-bust, canvas.bust")];
  if (frame % 2 === 0) nodes.push(...ui.querySelectorAll("canvas.icon-bust"));
  for (const c of nodes) {
    const def = CHARACTERS.find((x) => x.id === c.dataset.id);
    if (def) drawPortrait(c.getContext("2d"), def, frame);
  }
}

function render() {
  if (state.screen === "title") ui.innerHTML = titleHtml();
  else if (state.screen === "setup") ui.innerHTML = setupHtml();
  else if (state.screen === "online") ui.innerHTML = onlineHtml();
  else if (state.screen === "results") ui.innerHTML = resultsHtml();
  else ui.innerHTML = fightHtml();
  paint();
}

function startFight() {
  unlock();
  if (game) game.destroy();
  view = "fight";
  state.screen = "fight";
  render();
  const cfg = {
    slots: state.slots.map((s) => ({ ...s, controller: { ...s.controller } })),
    arenaId: state.arenaId,
    stocks: state.stocks,
    teams: state.mode === "teams",
    training: state.mode === "training",
    online: state.net,
    boost: boostOn,
  };
  game = new Game(canvas, cfg, (result) => {
    game = null;
    view = "menu";
    if (result.training) {
      state.screen = "setup";
    } else {
      state.result = result;
      state.screen = "results";
    }
    render();
  }, (paused) => {
    const veil = ui.querySelector(".veil");
    if (veil) veil.hidden = !paused;
  });
}

ui.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  unlock();
  sfx("ui");
  const act = b.dataset.act;
  if (act === "mode") {
    state.mode = b.dataset.id;
    state.slots = preset(state.mode);
    state.hands = null;
    state.screen = "setup";
    render();
  } else if (act === "online") {
    closeRoom();
    state.lobby = { phase: "choose", role: "", code: "", myChar: "rook", theirChar: "", status: "", note: "" };
    state.screen = "online";
    render();
  } else if (act === "host") {
    state.lobby = { phase: "connecting", role: "host", code: "", myChar: state.lobby?.myChar || "rook", theirChar: "", status: "Opening a room…", note: "" };
    render();
    room?.destroy();
    room = new OnlineRoom();
    wireRoom();
    room.host().catch((err) => {
      state.lobby.phase = "error";
      state.lobby.note = err.message || "Could not open a room.";
      render();
    });
  } else if (act === "join") {
    const code = ui.querySelector("#room-code")?.value || "";
    state.lobby = { phase: "connecting", role: "guest", code, myChar: state.lobby?.myChar || "rook", theirChar: "", status: "Looking for that match…", note: "Looking for that match…" };
    render();
    room?.destroy();
    room = new OnlineRoom();
    wireRoom();
    room.join(code).catch((err) => {
      state.lobby.phase = "error";
      state.lobby.note = err.message || "No match with that code.";
      render();
    });
  } else if (act === "copy" && state.lobby?.code) {
    navigator.clipboard?.writeText(state.lobby.code).catch(() => {});
  } else if (act === "mychar") {
    state.lobby.myChar = b.dataset.id;
    room?.send({ t: "pick", charId: state.lobby.myChar });
    render();
  } else if (act === "netfight") {
    if (state.lobby?.role === "host" && state.lobby.theirChar) {
      const msg = { t: "start", arenaId: state.arenaId, stocks: state.stocks, chars: [state.lobby.myChar, state.lobby.theirChar] };
      room?.send(msg);
      beginNet(msg);
    }
  } else if (act === "back" || act === "title") {
    closeRoom();
    state.screen = "title";
    render();
  } else if (act === "setup") {
    state.hands = null;
    state.screen = "setup";
    render();
  } else if (act === "css") {
    ensureHands();
    const index = Number(b.dataset.i);
    let slot = state.hands.findIndex((hand, i) => state.slots[i].controller.type === "human" && !hand.ready);
    if (slot < 0) slot = state.hands.findIndex((hand) => !hand.ready);
    if (slot < 0) slot = 0;
    if (state.hands[slot].ready) return;
    if (state.hands[slot].index === index) confirmHand(slot);
    else {
      state.hands[slot].index = index;
      state.slots[slot].charId = CHARACTERS[index].id;
      render();
    }
  } else if (act === "fight" || act === "rematch") {
    if (act === "fight" && state.screen === "setup" && !humansReady()) return;
    if (act === "rematch" && state.net && room) {
      room.send({ t: "lobby" });
      openLobby();
    } else startFight();
  }
  else if (act === "cycle") {
    const i = Number(b.dataset.slot);
    const cur = state.slots[i].controller;
    const at = Math.max(0, CONTROLLERS.findIndex((c) => sameCtrl(c, cur)));
    state.slots[i].controller = { ...CONTROLLERS[(at + 1) % CONTROLLERS.length] };
    render();
  } else if (act === "team") {
    const i = Number(b.dataset.slot);
    state.slots[i].team = state.slots[i].team ? 0 : 1;
    render();
  } else if (act === "char") {
    state.slots[Number(b.dataset.slot)].charId = b.dataset.id;
    render();
  } else if (act === "arena") {
    state.arenaId = b.dataset.id;
    if (state.lobby?.role === "host" && room) room.send({ t: "rules", arenaId: state.arenaId, stocks: state.stocks });
    render();
  } else if (act === "stock") {
    state.stocks = Number(b.dataset.n);
    if (state.lobby?.role === "host" && room) room.send({ t: "rules", arenaId: state.arenaId, stocks: state.stocks });
    render();
  } else if (act === "resume") {
    if (game && state.net) {
      game.applyNetPause(0);
      state.net.sendPause(0);
    } else if (game) {
      game.paused = false;
      game.onPause(false);
    }
  } else if (act === "forfeit") {
    if (state.net && room) room.send({ t: "leave" });
    game?.quit();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  const ch = typedDigit(e);
  if (ch) {
    const seq = "2782";
    seqAt = ch === seq[seqAt] ? seqAt + 1 : ch === seq[0] ? 1 : 0;
    if (seqAt === seq.length) {
      seqAt = 0;
      boostOn = true;
      if (game) game.armBoost();
      else showBoostNote();
      sfx("ui");
    }
  }
}, true);

window.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  if (state.screen !== "setup") return;
  ensureHands();
  const human = state.slots.findIndex((s) => s.controller.type === "human");
  const move = {
    KeyA: [human, -1, 0], KeyD: [human, 1, 0], KeyW: [human, 0, -1], KeyS: [human, 0, 1],
    ArrowLeft: [human, -1, 0], ArrowRight: [human, 1, 0], ArrowUp: [human, 0, -1], ArrowDown: [human, 0, 1],
  }[e.code];
  if (move && move[0] >= 0) {
    e.preventDefault();
    moveHand(move[0], move[1], move[2]);
    return;
  }
  if (e.repeat) return;
  if (e.code === "KeyC" && human >= 0) confirmHand(human);
  else if (e.code === "KeyV" && human >= 0) cancelHand(human);
  else if (e.code === "Enter" && humansReady()) startFight();
});

window.addEventListener("resize", fit);
fit();
render();

function loop() {
  frame++;
  if (view === "menu") {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    drawMenuScene(canvas.getContext("2d"), canvas.width / dpr, canvas.height / dpr, frame);
    paint();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
