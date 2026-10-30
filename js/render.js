import { CHARACTERS, STAGES, hazardClock } from "./data.js?v=sol";
import { INK, disk, limb, poly } from "./body.js?v=cast40";
import { drawBrawler, drawHeavy, drawGrappler } from "./looks/brawlers.js";
import { drawSpeed, drawTrick, drawDancer } from "./looks/agile.js";
import { drawFencer, drawArcher, drawLancer, drawWitch } from "./looks/weapons.js";
import { drawCast } from "./looks/cast.js";

const lookDraw = {
  brawler: drawBrawler,
  heavy: drawHeavy,
  speed: drawSpeed,
  trick: drawTrick,
  dancer: drawDancer,
  grappler: drawGrappler,
  fencer: drawFencer,
  archer: drawArcher,
  lancer: drawLancer,
  witch: drawWitch,
};

function shade(hex, amt) {
  const raw = hex.replace("#", "");
  const n = parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const ch = (shift) => Math.round(((n >> shift) & 255) + (t - ((n >> shift) & 255)) * p);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function previewMove(f) {
  const moves = f.def && f.def.moves;
  if (!moves) return null;
  const input = f._in || {};
  const face = f.facing || 1;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const forward = !!(dir && dir === face);
  const back = !!(dir && dir === -face);
  const running = f.state === "run" || Math.abs(f.vx || 0) > (f.def.speed || 1) * 0.72;
  let key = "light";
  if (!f.grounded) key = input.up ? "uair" : input.down ? "dair" : forward ? "fair" : back ? "bair" : "nair";
  else if (running && !input.up && !input.down && !back && moves.dash) key = "dash";
  else if (input.up && moves.utilt) key = "utilt";
  else if (input.down && moves.dtilt) key = "dtilt";
  else if (back && moves.btilt) key = "btilt";
  else if (forward && moves.ftilt) key = "ftilt";
  return moves[key] || moves.light || moves.nair || null;
}

function aimAt(pose, f, hb, extend) {
  const box = hb || { x: 36, y: -44, w: 40, h: 28 };
  const sy = -f.def.h * 0.6;
  const tx = box.x + box.w * (box.x < 0 ? 0.18 : 0.8);
  const ty = box.y + box.h * (box.y < -f.def.h * 0.7 ? 0.12 : box.y > -22 ? 0.82 : 0.4);
  const dx = tx - 8;
  const dy = ty - sy;
  const mag = Math.hypot(dx, dy) || 1;
  pose.aim = true;
  pose.aimX = dx / mag;
  pose.aimY = dy / mag;
  pose.extend = extend;
}

function softAim(f, pose, k) {
  const mag = Math.hypot(pose.aimX, pose.aimY) || 1;
  const tx = pose.aimX / mag;
  const ty = pose.aimY / mag;
  if (f._ax == null) {
    f._ax = tx;
    f._ay = ty;
    f._ae = pose.extend;
  } else {
    f._ax += (tx - f._ax) * k;
    f._ay += (ty - f._ay) * k;
    f._ae += (pose.extend - f._ae) * k;
  }
  const m = Math.hypot(f._ax, f._ay) || 1;
  pose.aimX = f._ax / m;
  pose.aimY = f._ay / m;
  pose.extend = f._ae;
  pose.aim = true;
}

function wrap01(u) {
  const x = u % 1;
  return x < 0 ? x + 1 : x;
}

function supportRise(phase) {
  const lead = wrap01(phase / (Math.PI * 2));
  const u = lead < 0.5 ? lead : lead - 0.5;
  return Math.sin((u / 0.5) * Math.PI);
}

function phaseOf(f, frame, rate) {
  if (f.slot == null) return frame * rate;
  if (f._gpN !== frame) {
    if (f._gpN == null) f._gp = frame * 0.05 + (f.slot || 0) * 1.3;
    else f._gp = (f._gp || 0) + rate * Math.max(0, Math.min(2, frame - f._gpN));
    f._gpN = frame;
  }
  return f._gp || 0;
}

function noteAir(f, frame) {
  if (!f.grounded) f._airT = 10;
  else if (f._airN !== frame) {
    if (f._airT > 0) f._airT -= 1;
    f._airN = frame;
  }
}

function locomotion(f, frame, pose) {
  const def = f.def || {};
  const h = def.h || 78;
  const cap = Math.max(1, def.speed || 6);
  const speed = Math.abs(f.vx || 0);
  const k = Math.max(0, Math.min(1.15, speed / cap));
  const run = f.state === "run" || (f.grounded && k > 0.72);
  let mode = "idle";
  let rate = 0.05;
  if (!f.grounded) {
    mode = (f.vy || 0) > 0 ? "fall" : "rise";
    rate = 0.12;
  } else if ((f._airT || 0) > 0 && !run && k < 0.45) {
    mode = "land";
    rate = 0.16;
  } else if (run) {
    mode = "run";
    rate = 0.32 + Math.min(1, k) * 0.08;
  } else if (k > 0.14 || speed > 0.8) {
    mode = "walk";
    rate = 0.18 + k * 0.1;
  }
  const phase = phaseOf(f, frame, rate);
  const s = Math.sin(phase);
  const breath = Math.sin(frame * 0.08 + (f.slot || 0) * 1.7);
  pose.phase = phase;
  pose.gait = mode;
  pose.bob = 0;
  pose.plant = mode !== "rise" && mode !== "fall";
  if (mode === "run" || mode === "walk") {
    const rise = supportRise(phase);
    const up = mode === "run" ? h * 0.028 : h * 0.02;
    const sink = mode === "run" ? h * 0.015 : h * 0.011;
    pose.stride = mode === "run" ? 1 : 0.62 + Math.min(1, k) * 0.22;
    pose.lift = mode === "run" ? 1 : 0.55 + Math.min(1, k) * 0.2;
    pose.dip = (1 - rise) * sink - rise * up;
    pose.sway = s * h * (mode === "run" ? 0.03 : 0.02);
    pose.roll = s * h * (mode === "run" ? 0.034 : 0.022);
    pose.lean = (mode === "run" ? 0.22 : 0.1) + s * (mode === "run" ? 0.05 : 0.032);
    pose.arm = Math.cos(phase) * (mode === "run" ? 0.72 : 0.48);
    pose.armY = -Math.max(0, -Math.cos(phase)) * (mode === "run" ? 0.18 : 0.1);
    pose.breath = breath * h * 0.006;
    pose.extend = (mode === "run" ? 0.7 : 0.64) + breath * 0.02;
  } else if (mode === "idle") {
    pose.dip = h * (0.015 + Math.abs(s) * 0.02) + breath * h * 0.005;
    pose.sway = s * h * 0.05;
    pose.roll = s * h * 0.014;
    pose.lean = 0.04 + s * 0.022;
    pose.arm = s * 0.22;
    pose.armY = -0.1 + breath * 0.06;
    pose.breath = -breath * h * 0.022;
    pose.extend = 0.58 + breath * 0.03;
    pose.leg = 0.08;
  } else if (mode === "rise") {
    const up = Math.max(0, Math.min(1, -(f.vy || 0) / Math.max(8, def.jump || 14)));
    pose.lift = 0.42 + up * 0.58;
    pose.lean = -0.1 - up * 0.06;
    pose.arm = -0.22;
    pose.armY = -1.3 - up * 0.2;
    pose.dip = -h * 0.008;
    pose.extend = 0.66;
  } else if (mode === "fall") {
    const drop = Math.max(0, Math.min(1, (f.vy || 0) / 12));
    pose.lift = drop;
    pose.lean = 0.05 + drop * 0.09;
    pose.arm = 0.12 + drop * 0.62;
    pose.armY = 0.02 + drop * 0.22;
    pose.roll = Math.sin(frame * 0.18 + (f.slot || 0)) * h * 0.012;
    pose.extend = 0.64;
  } else if (mode === "land") {
    const t = Math.max(0, Math.min(1, (f._airT || 0) / 10));
    pose.dip = h * (0.014 + t * 0.042);
    pose.lean = 0.07 + t * 0.08;
    pose.arm = 0.24 * t;
    pose.armY = 0.14 * t;
    pose.extend = 0.6;
    pose.leg = 0.1;
  }
}

function poseOf(f, frame) {
  noteAir(f, frame);
  const busy = ["attack", "ledge", "hitstun", "hold", "grabbed", "dodge", "charge", "shield"].includes(f.state);
  const h = (f.def && f.def.h) || 78;
  const pose = {
    arm: 0.16,
    armY: -0.06,
    lean: 0.04,
    leg: 0.18,
    duck: 0,
    wind: false,
    k: 0,
    aim: false,
    aimX: 1,
    aimY: -0.08,
    extend: 0.62,
    plant: !!f.grounded,
    bob: 0,
    dip: 0,
    roll: 0,
    breath: 0,
    sway: 0,
    gait: null,
    phase: 0,
    stride: 0.7,
    lift: 0.6,
  };
  if (!busy) {
    locomotion(f, frame, pose);
    const move = previewMove(f);
    if (move) aimAt(pose, f, move.hb, pose.extend);
    pose.lean += (pose.aimY || 0) * 0.12;
    softAim(f, pose, 0.32);
  }
  if (f.state === "charge") {
    pose.arm = -1.15;
    pose.lean = -0.28;
    pose.duck = 0.07;
    pose.bob = 0;
    pose.gait = null;
  }
  if (f.state === "shield") {
    pose.duck = 0.07;
    pose.lean = 0.04;
    pose.arm = 0.22;
    pose.armY = -0.32;
    pose.leg = 0.14;
    pose.plant = true;
    pose.bob = 0;
    pose.dip = h * 0.01;
    pose.gait = null;
  }
  if (f.state === "dodge") {
    pose.bob = 0;
    pose.lean = 0.24;
    pose.arm = 0.35;
    pose.armY = -0.4;
    if (f.grounded) {
      pose.gait = "land";
      pose.duck = 0.1;
      pose.dip = h * 0.02;
    } else {
      pose.gait = "rise";
      pose.lift = 0.9;
    }
  }
  if (f.state === "hitstun") {
    pose.arm = 0.5;
    pose.armY = -0.4;
    pose.leg = f.grounded ? 0.42 : 0.3;
    pose.lean = 0.24;
    pose.bob = 0;
    pose.plant = !!f.grounded;
    pose.dip = h * 0.014;
    pose.gait = null;
  }
  if (f.state === "hold") {
    pose.aim = true;
    pose.aimX = 1;
    pose.aimY = -0.06;
    pose.extend = 1.05;
    pose.lean = 0.22;
    pose.arm = 1.2;
    pose.gait = null;
  }
  if (f.state === "grabbed") {
    pose.arm = 0.95;
    pose.armY = 0.45;
    pose.lean = -0.36;
    pose.leg = 0.4;
    pose.gait = null;
  }
  if (f.state === "ledge") {
    pose.arm = -1.15;
    pose.armY = -0.85;
    pose.leg = 0.35;
    pose.lean = 0.1;
    pose.gait = null;
    pose.plant = false;
  }
  if (f.state === "attack" && f.move) {
    const m = f.move;
    const wind = f.mf < m.startup;
    const fired = f.mf >= m.startup + m.active;
    const k = wind
      ? f.mf / Math.max(1, m.startup)
      : Math.min(1, (f.mf - m.startup) / Math.max(1, m.active));
    pose.wind = wind;
    pose.k = fired ? 1 : k;
    pose.gait = null;
    if (wind) pose.extend = -0.32 + k * 0.22;
    else if (!fired) pose.extend = 0.48 + k * 0.7;
    else pose.extend = 1.05 * (1 - Math.min(1, (f.mf - m.startup - m.active) / Math.max(1, m.recovery)) * 0.85);
    aimAt(pose, f, m.hb, pose.extend);
    pose.arm = wind ? -0.55 : pose.extend * 0.75;
    pose.lean = wind ? -0.2 : 0.06 + (pose.k || 0) * 0.16;
    pose.plant = !!f.grounded;
    pose.bob = 0;
    if (m.kind === "heavy") pose.lean = wind ? -0.32 : 0.22;
    else if (m.kind === "dash") {
      pose.lean = 0.5;
      pose.duck = 0.1;
      pose.leg = 0.55;
    } else if (m.kind === "aerial") pose.leg = wind ? -0.45 : 0.1;
    else if (m.kind === "up") {
      pose.armY = wind ? 0.1 : -1.15;
      pose.leg = -0.25;
      pose.lean = -0.04;
    } else if (m.kind === "getup") pose.duck = wind ? 0.16 : 0;
    if (m.grab) pose.lean = pose.extend < 0.3 ? -0.16 : 0.38;
    if (m.counter) {
      pose.lean = -0.4;
      pose.duck = 0.05;
      pose.extend = 0.12;
      pose.aimX = 0.3;
      pose.aimY = -0.18;
    }
    if (m.meteor) {
      pose.aimX = 0.12;
      pose.aimY = 1;
      pose.lean = pose.extend < 0.25 ? -0.08 : 0.46;
      pose.leg = pose.extend < 0.25 ? -0.65 : 0.35;
      pose.armY = 0.4;
    } else if (m.hb && m.hb.y < -f.def.h * 0.7) pose.armY = wind ? 0.05 : -1.05;
    if (!f.grounded) {
      const falling = (f.vy || 0) > 0;
      const tuck = m.meteor ? pose.extend < 0.25 : !falling;
      pose.gait = tuck ? "rise" : "fall";
      pose.lift = tuck ? 0.82 : Math.max(0.28, Math.min(1, Math.abs(f.vy || 0) / 11));
      pose.plant = false;
      pose.bob = 0;
    }
    f._ax = pose.aimX;
    f._ay = pose.aimY;
    f._ae = pose.extend;
  }
  return pose;
}


function weaponStyle(shape) {
  if (shape === "fencer" || shape === "lancer") return "cut";
  if (shape === "archer") return "line";
  if (shape === "witch" || shape === "trick") return "hex";
  if (shape === "heavy") return "shock";
  if (shape === "brawler" || shape === "grappler") return "fist";
  return "slash";
}

function aimOf(f, hb) {
  const ox = 8;
  const oy = -f.def.h * 0.58;
  const tx = hb.x + hb.w * (hb.x < 0 ? 0.28 : 0.72);
  const ty = hb.y + hb.h * 0.4;
  return {
    ox, oy, tx, ty,
    ang: Math.atan2(ty - oy, tx - ox),
    dist: Math.max(22, Math.hypot(tx - ox, ty - oy)),
  };
}

function markPoint(hb, k) {
  return {
    x: hb.x * (0.42 + k * 0.38) + (hb.x < 0 ? -hb.w * 0.12 : hb.w * 0.12),
    y: hb.y + hb.h * 0.42,
  };
}

function strokeArc(ctx, x, y, r, a0, a1, color, width, alpha) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a1);
  ctx.stroke();
}

function layeredArc(ctx, x, y, r, a0, a1, color, accent, wide) {
  ctx.lineCap = "round";
  strokeArc(ctx, x, y, r * 0.86, a0, a1, color, wide ? 18 : 10, 0.16);
  strokeArc(ctx, x, y, r, a0, a1, color, wide ? 11 : 6, 0.28);
  strokeArc(ctx, x, y, r * 1.04, a0 + 0.04, a1 - 0.02, accent, wide ? 5 : 2.8, 0.82);
  strokeArc(ctx, x, y, r, a0, a1, "#fffaf2", wide ? 1.8 : 1.15, 0.95);
}

function tipGem(ctx, x, y, r, accent) {
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#fffaf2";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawSlash(ctx, f, hb, k, wide) {
  const aim = aimOf(f, hb);
  const sweep = wide ? 1.15 : 0.62;
  const a1 = aim.ang - sweep * 0.28 + k * sweep;
  const a0 = a1 - (wide ? 0.62 : 0.4);
  const r = aim.dist * (0.58 + k * 0.3);
  layeredArc(ctx, aim.ox, aim.oy, r, a0, a1, f.def.color, f.def.accent, wide);
  layeredArc(ctx, aim.ox, aim.oy, r * 0.72, a0 + 0.08, a1 - 0.06, f.def.accent, "#fffaf2", false);
  const tx = aim.ox + Math.cos(a1) * r;
  const ty = aim.oy + Math.sin(a1) * r;
  tipGem(ctx, tx, ty, wide ? 3.2 : 2.1, f.def.accent);
  ctx.globalAlpha = 0.55 * (1 - k);
  ctx.strokeStyle = "#fffaf2";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < (wide ? 4 : 3); i++) {
    const a = a0 + ((i + 0.5) / (wide ? 4 : 3)) * (a1 - a0);
    ctx.beginPath();
    ctx.moveTo(aim.ox + Math.cos(a) * r * 0.78, aim.oy + Math.sin(a) * r * 0.78);
    ctx.lineTo(aim.ox + Math.cos(a) * (r + (wide ? 12 : 7)), aim.oy + Math.sin(a) * (r + (wide ? 12 : 7)));
    ctx.stroke();
  }
}

function drawCut(ctx, f, hb, k, wide) {
  const aim = aimOf(f, hb);
  const sweep = wide ? 0.95 : 0.48;
  const a1 = aim.ang - sweep * 0.2 + k * sweep;
  const a0 = a1 - (wide ? 0.34 : 0.18);
  const r = aim.dist * (0.8 + k * 0.2);
  ctx.lineCap = "round";
  strokeArc(ctx, aim.ox, aim.oy, r, a0, a1, f.def.color, wide ? 7 : 4, 0.22);
  strokeArc(ctx, aim.ox, aim.oy, r * 1.06, a0, a1, f.def.accent, wide ? 2.4 : 1.5, 0.9);
  strokeArc(ctx, aim.ox, aim.oy, r, a0, a1, "#fffaf2", 1, 0.95);
  const tx = aim.ox + Math.cos(a1) * r;
  const ty = aim.oy + Math.sin(a1) * r;
  tipGem(ctx, tx, ty, wide ? 2.4 : 1.6, f.def.accent);
  ctx.globalAlpha = 0.7 * (1 - k * 0.5);
  ctx.strokeStyle = "#fffaf2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(aim.ox + Math.cos(aim.ang) * r * 0.35, aim.oy + Math.sin(aim.ang) * r * 0.35);
  ctx.lineTo(tx, ty);
  ctx.stroke();
}

function drawShotLine(ctx, f, hb, k, wide) {
  const aim = aimOf(f, hb);
  const along = 0.45 + k * 0.55;
  const x2 = aim.ox + (aim.tx - aim.ox) * along;
  const y2 = aim.oy + (aim.ty - aim.oy) * along;
  const ang = Math.atan2(y2 - aim.oy, x2 - aim.ox);
  const nx = Math.cos(ang + Math.PI / 2);
  const ny = Math.sin(ang + Math.PI / 2);
  ctx.lineCap = "round";
  const band = (ox, oy, width, color, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(aim.ox + ox, aim.oy + oy);
    ctx.lineTo(x2 + ox, y2 + oy);
    ctx.stroke();
  };
  band(0, 0, wide ? 10 : 6, f.def.color, 0.2);
  band(nx * 3, ny * 3, 1.2, f.def.accent, 0.45);
  band(-nx * 3, -ny * 3, 1.2, f.def.accent, 0.45);
  band(0, 0, wide ? 3 : 1.8, f.def.accent, 0.9);
  band(0, 0, 1, "#fffaf2", 0.95);
  tipGem(ctx, x2, y2, wide ? 3 : 2, f.def.accent);
}

function hexPath(ctx, x, y, r, turn) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = turn + (i / 6) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawHex(ctx, f, x, y, r) {
  ctx.lineJoin = "round";
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = f.def.color;
  hexPath(ctx, x, y, r * 1.35, -Math.PI / 2);
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = f.def.accent;
  ctx.lineWidth = 2.4;
  hexPath(ctx, x, y, r, -Math.PI / 2);
  ctx.stroke();
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#fffaf2";
  hexPath(ctx, x, y, r * 0.62, Math.PI / 6);
  ctx.stroke();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = f.def.color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(2, r * 0.28), 0, Math.PI * 2);
  ctx.fill();
  tipGem(ctx, x, y, Math.max(1.4, r * 0.16), f.def.accent);
  ctx.strokeStyle = f.def.accent;
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
    ctx.globalAlpha = i % 2 ? 0.85 : 0.4;
    ctx.lineWidth = i % 2 ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
    ctx.lineTo(x + Math.cos(a) * (r + (i % 2 ? 8 : 4)), y + Math.sin(a) * (r + (i % 2 ? 8 : 4)));
    ctx.stroke();
  }
}

function drawFist(ctx, f, x, y, r) {
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = f.def.color;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = f.def.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = f.def.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0.4, Math.PI * 1.7);
  ctx.stroke();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = f.def.accent;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  tipGem(ctx, x - r * 0.08, y - r * 0.08, r * 0.16, "#fffaf2");
  ctx.lineCap = "round";
  const n = r > 10 ? 8 : 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const long = i % 2 === 0;
    ctx.globalAlpha = long ? 0.85 : 0.45;
    ctx.strokeStyle = long ? f.def.accent : f.def.color;
    ctx.lineWidth = long ? 2.2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
    ctx.lineTo(x + Math.cos(a) * (r + (long ? 9 : 5)), y + Math.sin(a) * (r + (long ? 9 : 5)));
    ctx.stroke();
  }
}

function drawShockArc(ctx, f, hb, k, wide) {
  const aim = aimOf(f, hb);
  const sweep = wide ? 1.35 : 0.82;
  const a1 = aim.ang - sweep * 0.2 + k * sweep * 0.65;
  const a0 = a1 - sweep * 0.78;
  const r = aim.dist * (wide ? 0.78 : 0.52) + k * 6;
  layeredArc(ctx, aim.ox, aim.oy, r, a0, a1, f.def.color, f.def.accent, wide);
  strokeArc(ctx, aim.ox, aim.oy, r * 0.7, a0 + 0.1, a1 - 0.08, f.def.accent, wide ? 2 : 1.3, 0.45);
  const steps = wide ? 6 : 4;
  const extra = wide ? 14 : 8;
  for (let i = 0; i < steps; i++) {
    const a = a0 + ((i + 0.5) / steps) * (a1 - a0);
    const long = i % 2 === 0;
    ctx.globalAlpha = (long ? 0.8 : 0.4) * (1 - k * 0.4);
    ctx.strokeStyle = long ? "#fffaf2" : f.def.accent;
    ctx.lineWidth = long ? 1.6 : 2.4;
    ctx.beginPath();
    ctx.moveTo(aim.ox + Math.cos(a) * r * 0.82, aim.oy + Math.sin(a) * r * 0.82);
    ctx.lineTo(aim.ox + Math.cos(a) * (r + (long ? extra : extra * 0.55)), aim.oy + Math.sin(a) * (r + (long ? extra : extra * 0.55)));
    ctx.stroke();
  }
}

function drawShapeMark(ctx, f, hb, k, wide) {
  const style = weaponStyle(f.def.shape);
  const p = markPoint(hb, k);
  const fade = 1 - k * 0.25;
  if (style === "cut") drawCut(ctx, f, hb, k, wide);
  else if (style === "line") drawShotLine(ctx, f, hb, k, wide);
  else if (style === "hex") drawHex(ctx, f, p.x, p.y, (wide ? 16 : 8) * fade);
  else if (style === "shock") drawShockArc(ctx, f, hb, k, wide);
  else if (style === "fist") drawFist(ctx, f, p.x, p.y, (wide ? 14 : 7) * (0.85 + k * 0.2));
  else drawSlash(ctx, f, hb, k, wide);
}

function drawTipSparks(ctx, f, hb, k, n) {
  const p = markPoint(hb, k);
  ctx.fillStyle = f.def.accent;
  for (let i = 0; i < n; i++) {
    const a = -0.9 + (i / Math.max(1, n - 1)) * 1.8;
    ctx.globalAlpha = 0.8 - k;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(a) * (5 + i * 3.5), p.y + Math.sin(a) * (5 + i * 3.5), i === 1 ? 2.2 : 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawKindLight(ctx, f, hb, k) {
  drawShapeMark(ctx, f, hb, k, false);
  const style = weaponStyle(f.def.shape);
  if (k < 0.55 && (style === "slash" || style === "cut" || style === "line")) drawTipSparks(ctx, f, hb, k, 3);
}

function drawDashStreaks(ctx, f, hb, k) {
  const style = weaponStyle(f.def.shape);
  const y = hb.y + hb.h * 0.45;
  const thin = style === "cut" || style === "line";
  const blunt = style === "shock" || style === "fist";
  const n = style === "line" ? 4 : 5;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const len = (thin ? 28 : 18) + i * 9 + k * 20;
    const yy = y - 12 + i * 6;
    const x0 = -8 - k * 14;
    ctx.globalAlpha = 0.2 - i * 0.02;
    ctx.strokeStyle = f.def.color;
    ctx.lineWidth = thin ? 5 : blunt ? 8 : 6;
    ctx.beginPath();
    ctx.moveTo(x0, yy);
    ctx.lineTo(x0 + len, yy);
    ctx.stroke();
    ctx.globalAlpha = 0.75 - k * 0.3;
    ctx.strokeStyle = i % 2 ? f.def.accent : f.def.color;
    ctx.lineWidth = thin ? 1.6 : blunt ? 3.2 : 2.2;
    ctx.stroke();
    ctx.globalAlpha = 0.85 - k * 0.4;
    ctx.strokeStyle = "#fffaf2";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + len * 0.45, yy);
    ctx.lineTo(x0 + len, yy);
    ctx.stroke();
  }
  const p = markPoint(hb, k);
  if (style === "hex") drawHex(ctx, f, p.x, p.y, 8);
  else if (style === "fist") drawFist(ctx, f, p.x, p.y, 7);
  else tipGem(ctx, p.x, p.y, 2.2, f.def.accent);
}

function drawMeteor(ctx, f, hb, k) {
  const style = weaponStyle(f.def.shape);
  const thin = style === "cut" || style === "line";
  const blunt = style === "shock" || style === "fist";
  const x = hb.x * 0.35 + (hb.x < 0 ? -4 : 4);
  const y0 = hb.y + hb.h * 0.15;
  const drop = 30 + k * 24;
  ctx.lineCap = "round";
  const column = (ox, width, color, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x + ox, y0 - 8);
    ctx.lineTo(x + ox, y0 + drop);
    ctx.stroke();
  };
  column(0, thin ? 8 : blunt ? 16 : 12, f.def.color, 0.18);
  column(-5, 1.4, f.def.accent, 0.4);
  column(5, 1.4, f.def.accent, 0.4);
  column(0, thin ? 2.2 : 3.4, f.def.accent, 0.9);
  column(0, 1.1, "#fffaf2", 0.95);
  ctx.strokeStyle = f.def.accent;
  for (let i = 0; i < 3; i++) {
    const yy = y0 + 6 + i * (drop / 3);
    ctx.globalAlpha = 0.55 * (1 - k * 0.3);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 8 - i * 2, yy);
    ctx.lineTo(x - 2, yy + 5);
    ctx.moveTo(x + 8 + i * 2, yy);
    ctx.lineTo(x + 2, yy + 5);
    ctx.stroke();
  }
  tipGem(ctx, x, y0 + drop, thin ? 2.4 : 3.4, f.def.accent);
  if (style === "hex") drawHex(ctx, f, x, y0 + drop, 8);
  else if (style === "fist") drawFist(ctx, f, x, y0 + drop * 0.65, 7);
}

function drawCounterFlash(ctx, f, k) {
  const fade = 1 - k / 0.34;
  const r = 18 + k * 22;
  const cx = 16;
  const cy = -f.def.h * 0.55;
  ctx.lineCap = "round";
  strokeArc(ctx, cx, cy, r * 1.15, -1.3, 1.3, f.def.color, 10, 0.16 * fade);
  strokeArc(ctx, cx, cy, r, -1.15, 1.15, f.def.accent, 3.5, 0.9 * fade);
  strokeArc(ctx, cx, cy, r * 0.72, -0.9, 0.9, "#fffaf2", 1.3, 0.85 * fade);
  ctx.strokeStyle = f.def.accent;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const a = -1.05 + i * 0.52;
    ctx.globalAlpha = 0.7 * fade;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
    ctx.lineTo(cx + Math.cos(a) * (r + 8), cy + Math.sin(a) * (r + 8));
    ctx.stroke();
  }
  tipGem(ctx, cx + r * 0.15, cy, 2.2, f.def.accent);
}

function drawRiseTrail(ctx, f, k) {
  const style = weaponStyle(f.def.shape);
  const thin = style === "cut" || style === "line";
  const blunt = style === "shock" || style === "fist";
  const top = -f.def.h * (0.62 + k * 0.55);
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * (thin ? 5 : 7);
    const y1 = top + i * 6;
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = f.def.color;
    ctx.lineWidth = thin ? 6 : blunt ? 9 : 7;
    ctx.beginPath();
    ctx.moveTo(x * 1.4, 0);
    ctx.lineTo(x * 0.25, y1);
    ctx.stroke();
    ctx.globalAlpha = 0.75 - k * 0.3;
    ctx.strokeStyle = i === 1 || i === 2 ? f.def.accent : f.def.color;
    ctx.lineWidth = thin ? 1.5 : blunt ? 3 : 2.2;
    ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = "#fffaf2";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x * 0.7, y1 * 0.45);
    ctx.lineTo(x * 0.25, y1);
    ctx.stroke();
  }
  tipGem(ctx, 0, top, 2.4, f.def.accent);
  if (style === "hex") drawHex(ctx, f, 0, top, 9);
  else if (style === "fist") drawFist(ctx, f, 0, top + 8, 7);
}

function drawGroundDust(ctx, k) {
  for (let i = 0; i < 5; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (6 + i * 7 + k * 16);
    ctx.globalAlpha = 0.22 * (1 - k);
    ctx.fillStyle = "#c4b6a4";
    ctx.beginPath();
    ctx.ellipse(x, 4, 8 + k * 10, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55 * (1 - k);
    ctx.fillStyle = "#f3ecdf";
    ctx.beginPath();
    ctx.ellipse(x, 2, 4 + k * 5, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMuzzle(ctx, hb, t, color) {
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.22 - t * 0.05;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(hb.x, hb.y, 12 + t * 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.85 - t * 0.2;
  ctx.beginPath();
  ctx.arc(hb.x, hb.y, 5 + t * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hb.x - 4, hb.y);
  ctx.lineTo(hb.x + 16 + t * 8, hb.y);
  ctx.stroke();
  ctx.globalAlpha = 0.9 - t * 0.2;
  ctx.strokeStyle = "#fffaf2";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hb.x - 2, hb.y);
  ctx.lineTo(hb.x + 14 + t * 6, hb.y);
  ctx.moveTo(hb.x + 4, hb.y - 4);
  ctx.lineTo(hb.x + 12 + t * 4, hb.y - 1);
  ctx.moveTo(hb.x + 4, hb.y + 4);
  ctx.lineTo(hb.x + 12 + t * 4, hb.y + 1);
  ctx.stroke();
  tipGem(ctx, hb.x + 2, hb.y, 2, color);
  ctx.globalAlpha = 1;
}

function drawBlink(ctx, f, hb, k) {
  const x = hb.x * 0.3;
  const y = hb.y + hb.h * 0.35;
  const r = 14 + k * 14;
  strokeArc(ctx, x, y, r * 1.25, 0, Math.PI * 2, f.def.color, 6, 0.16 * (1 - k));
  strokeArc(ctx, x, y, r, 0, Math.PI * 2, f.def.accent, 2, 0.75 * (1 - k));
  strokeArc(ctx, x, y, r * 0.55, 0.4, Math.PI * 1.8, "#fffaf2", 1.2, 0.8 * (1 - k));
  ctx.globalAlpha = 0.6 * (1 - k);
  ctx.strokeStyle = f.def.accent;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r * 0.7);
  ctx.lineTo(x, y + r * 0.7);
  ctx.stroke();
}

function clawPass(ctx, f, tx, ty, width, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, -f.def.h * 0.58);
  ctx.quadraticCurveTo((10 + tx) * 0.5, ty - 16, tx, ty - 8);
  ctx.moveTo(12, -f.def.h * 0.48);
  ctx.quadraticCurveTo((12 + tx) * 0.5, ty + 12, tx, ty + 8);
  ctx.stroke();
}

function reachClaw(ctx, f, hb, k) {
  const tx = (hb.x + hb.w * 0.7) * (0.42 + k * 0.58);
  const ty = hb.y + hb.h * 0.45;
  clawPass(ctx, f, tx, ty, 9, f.def.color, 0.2);
  clawPass(ctx, f, tx, ty, 4, f.def.accent, 0.9);
  clawPass(ctx, f, tx, ty, 1.3, "#fffaf2", 0.85);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = f.def.accent;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(tx, ty - 8);
  ctx.lineTo(tx + 12, ty - 18);
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + 14, ty);
  ctx.moveTo(tx, ty + 8);
  ctx.lineTo(tx + 12, ty + 18);
  ctx.stroke();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = "#fffaf2";
  ctx.lineWidth = 1;
  ctx.stroke();
  tipGem(ctx, tx, ty, 2.2, f.def.accent);
}

function strike(ctx, f, frame) {
  if (f.state !== "attack" || !f.move) return;
  const m = f.move;
  const hb = m.hb;
  if (!hb) return;
  if (m.projectile) {
    if (f.mf >= m.startup && f.mf < m.startup + 3) drawMuzzle(ctx, hb, f.mf - m.startup, f.def.accent);
    return;
  }
  if (f.mf < m.startup) {
    const charge = f.mf / Math.max(1, m.startup);
    const cx = hb.x * 0.25;
    const cy = hb.y + hb.h * 0.3;
    const rad = 8 + f.mf * 0.6;
    strokeArc(ctx, cx, cy, rad + 4, frame * 0.2, frame * 0.2 + 1.4, f.def.color, 5, 0.16 + charge * 0.12);
    strokeArc(ctx, cx, cy, rad, frame * 0.2, frame * 0.2 + 1.15, f.def.accent, 2.2, 0.35 + charge * 0.4);
    strokeArc(ctx, cx, cy, rad * 0.7, frame * 0.35, frame * 0.35 + 0.8, "#fffaf2", 1, 0.4 + charge * 0.3);
    ctx.globalAlpha = 1;
    return;
  }
  if (f.mf >= m.startup + m.active) return;
  const k = (f.mf - m.startup) / Math.max(1, m.active);
  ctx.save();
  if (m.meteor) drawMeteor(ctx, f, hb, k);
  else if (m.counter) {
    if (k < 0.34) drawCounterFlash(ctx, f, k);
  } else if (m.grab) reachClaw(ctx, f, hb, k);
  else if (m.kind === "dash") drawDashStreaks(ctx, f, hb, k);
  else if (m.kind === "up") drawRiseTrail(ctx, f, k);
  else if (m.kind === "heavy") drawShapeMark(ctx, f, hb, k, true);
  else drawKindLight(ctx, f, hb, k);
  if (m.grab && m.meteor) reachClaw(ctx, f, hb, k);
  if (m.teleport && !m.grab && !m.meteor) drawBlink(ctx, f, hb, k);
  if (f.grounded && !m.counter && (m.kind === "heavy" || m.meteor)) drawGroundDust(ctx, k);
  ctx.restore();
}

function drawCharacter(ctx, f, frame) {
  const draw = f.def.look === "cast" ? drawCast : (lookDraw[f.def.shape] || drawBrawler);
  draw(ctx, f, frame);
}

export function drawFighter(ctx, f, frame) {
  if (!f || f.state === "dead") return;
  const d = f.def;
  ctx.save();
  if (f.inv > 100 && !f.grounded) {
    const g = ctx.createLinearGradient(f.x, f.y, f.x, f.y - 420);
    g.addColorStop(0, d.accent);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = g;
    ctx.fillRect(f.x - 16, f.y - 460, 32, 460);
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < f.trail.length; i++) {
    const p = f.trail[i];
    ctx.globalAlpha = (i / f.trail.length) * 0.45;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, d.w * 0.28 * (i / f.trail.length + 0.2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (f.grounded || f.state === "ledge") {
    const gy = f.state === "ledge" ? f.ledgePlat.y : f.y + 2;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(f.x, gy + 2, d.w * 0.72, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath();
    ctx.ellipse(f.x, gy + 1, d.w * 0.36, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (f.dmg > 80) {
    ctx.globalAlpha = Math.min(0.7, (f.dmg - 80) / 160);
    ctx.strokeStyle = f.dmg > 140 ? "#ff5a3c" : d.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(f.x, f.y - d.h * 0.55, d.h * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = f.inv > 0 && Math.floor(frame / 4) % 2 ? 0.55 : 1;
  ctx.save();
  ctx.translate(f.x, f.y);
  if (f.state === "hitstun") ctx.rotate(Math.atan2(f.vy, Math.abs(f.vx) + 0.01) * 0.25 * Math.sign(f.vx || f.facing));
  else if (f.state === "dodge") ctx.rotate(f.dodgeT * 0.18 * -f.facing);
  ctx.scale(f.facing || 1, 1);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  f.pose = poseOf(f, frame);
  if (f.pose.bob) ctx.translate(0, f.pose.bob);
  drawCharacter(ctx, f, frame);
  strike(ctx, f, frame);
  if (f.state === "charge") {
    const k = Math.min(1, f.charge / 40);
    ctx.strokeStyle = d.accent;
    ctx.globalAlpha = 0.35 + k * 0.5;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(d.w * 0.2, -d.h * 0.55, 18 + k * 40, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  if (f.state === "shield") {
    const k = Math.max(0.15, f.shieldHp / 70);
    const rad = d.h * 0.46 * (0.62 + 0.38 * k);
    const cx = f.x;
    const cy = f.y - d.h * 0.5;
    const tint = f.parry > 0 ? "#f2d48a" : "#9ad7ff";
    ctx.globalAlpha = 0.16 + k * 0.12;
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = tint;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,250,242,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.82, -2.4, -0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintLayer(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(w));
  canvas.height = Math.max(2, Math.round(h));
  draw(canvas.getContext("2d"), canvas.width, canvas.height);
  return canvas;
}

const CREAM = "#fffaf2";

const LOOK = {
  citadel: { top: "#6e5346", face: "#3a2836", under: "#21141e", edge: "#ffb86b", accent: "#c46a45" },
  forge: { top: "#5c3428", face: "#3a1e16", under: "#1a0c08", edge: "#ff5a1f", accent: "#ffd23f" },
  drift: { top: "#1c5c72", face: "#0e3a4c", under: "#071820", edge: "#3ef0ff", accent: "#ff4f9a" },
  keel: { top: "#7d8c98", face: "#465664", under: "#1c2830", edge: "#e4d2a6", accent: "#9ec4d4" },
  maw: { top: "#6a4636", face: "#3d2822", under: "#1a100e", edge: "#e25b3a", accent: "#ffb088" },
  gale: { top: "#6d9074", face: "#345444", under: "#15261c", edge: "#d6f2c2", accent: "#b9ddff" },
  crust: { top: "#5a4036", face: "#3a241c", under: "#1a100c", edge: "#ff7a1a", accent: "#ffd23f" },
};

function skyMood(id) {
  switch (id) {
    case "forge":
      return { neb: "255,96,24", haze: "rgba(90,16,0,0.55)", far: "rgba(28,8,6,0.66)", orb: "rgba(255,140,60,0.7)", core: "#ffd23f", r: 26, ridge: "stack" };
    case "drift":
      return { neb: "62,240,255", neb2: "255,79,154", haze: "rgba(0,8,16,0.5)", far: "rgba(8,18,36,0.62)", orb: "rgba(80,220,255,0.55)", core: "#d8fbff", r: 34, ridge: "slab" };
    case "keel":
      return { neb: "186,204,214", haze: "rgba(8,16,24,0.5)", far: "rgba(10,16,22,0.62)", orb: "rgba(230,220,190,0.5)", core: "#fff6df", r: 28, ridge: "swell" };
    case "maw":
      return { neb: "190,64,48", haze: "rgba(30,6,8,0.55)", far: "rgba(16,6,8,0.66)", orb: "rgba(255,90,60,0.55)", core: "#ffb088", r: 22, ridge: "fang" };
    case "gale":
      return { neb: "150,200,170", haze: "rgba(8,20,16,0.4)", far: "rgba(10,22,16,0.55)", orb: "rgba(210,240,255,0.62)", core: "#f4fbff", r: 32, ridge: "lean" };
    case "crust":
      return { neb: "255,110,30", haze: "rgba(70,16,0,0.58)", far: "rgba(24,6,4,0.68)", orb: "rgba(255,80,20,0.6)", core: "#ffd08a", r: 30, ridge: "stack" };
    default:
      return { neb: "255,186,120", haze: "rgba(0,0,0,0.42)", far: "rgba(14,8,16,0.62)", orb: "rgba(255,196,120,0.72)", core: "#fff1d0", r: 34, ridge: "spire" };
  }
}

function farRidge(ctx, kind, x, base, tall) {
  ctx.beginPath();
  if (kind === "slab") ctx.rect(x, base - tall * 0.55, 16, tall);
  else if (kind === "stack") {
    ctx.rect(x, base - tall, 22, tall);
    ctx.rect(x + 4, base - tall - 14, 8, 16);
  } else if (kind === "swell") {
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + 28, base - tall, x + 64, base);
  } else if (kind === "fang") {
    ctx.moveTo(x, base);
    ctx.lineTo(x + 8, base - tall * 0.35);
    ctx.lineTo(x + 18, base - tall);
    ctx.lineTo(x + 30, base - tall * 0.28);
    ctx.lineTo(x + 44, base);
  } else if (kind === "lean") {
    ctx.moveTo(x, base);
    ctx.lineTo(x + tall * 0.2, base - tall);
    ctx.lineTo(x + tall * 0.62, base - tall * 0.15);
    ctx.lineTo(x + 50, base);
  } else {
    ctx.moveTo(x, base);
    ctx.lineTo(x + 18, base - tall);
    ctx.lineTo(x + 42, base);
  }
}

const skyCache = { key: "", base: null, far: null, grade: null };

function ensureSky(arena, w, h) {
  const W = Math.max(2, Math.round(w));
  const H = Math.max(2, Math.round(h));
  const key = `${arena.id}:${W}:${H}`;
  if (skyCache.key === key && skyCache.base) return skyCache;
  const rnd = mulberry(arena.id.length * 997 + W * 13 + H);
  const mood = skyMood(arena.id);
  skyCache.key = key;
  skyCache.base = paintLayer(W, H, (ctx, bw, bh) => {
    const g = ctx.createLinearGradient(0, 0, 0, bh);
    const top = arena.sky[0];
    const mid = arena.sky[1];
    const bot = arena.sky[2] || arena.sky[1];
    g.addColorStop(0, top);
    g.addColorStop(0.22, shade(mid, -0.2));
    g.addColorStop(0.52, mid);
    g.addColorStop(0.78, bot);
    g.addColorStop(1, shade(bot, -0.28));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, bw, bh);
    for (let i = 0; i < 5; i++) {
      const x = rnd() * bw;
      const y = rnd() * bh * 0.5;
      const r = 90 + rnd() * 240;
      const neb = ctx.createRadialGradient(x, y, 0, x, y, r);
      const col = mood.neb2 && i % 2 ? mood.neb2 : mood.neb;
      neb.addColorStop(0, `rgba(${col},${0.16 + rnd() * 0.14})`);
      neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 180; i++) {
      const x = rnd() * bw;
      const y = rnd() * bh * 0.7;
      const s = rnd() < 0.08 ? 2.4 : 0.6 + rnd() * 1.3;
      ctx.globalAlpha = 0.35 + rnd() * 0.65;
      ctx.fillStyle = rnd() < 0.15 ? "#ffe6bf" : "#fffaf2";
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
    const haze = ctx.createLinearGradient(0, bh * 0.58, 0, bh);
    haze.addColorStop(0, "rgba(0,0,0,0)");
    haze.addColorStop(1, mood.haze);
    ctx.fillStyle = haze;
    ctx.fillRect(0, bh * 0.58, bw, bh * 0.42);
    const band = ctx.createLinearGradient(0, bh * 0.18, bw, bh * 0.42);
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(0.45, "rgba(255,236,210,0.07)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.ellipse(bw * 0.5, bh * 0.28, bw * 0.62, bh * 0.08, -0.12, 0, Math.PI * 2);
    ctx.fill();
  });
  const farW = Math.round(W * 1.35);
  skyCache.far = paintLayer(farW, H, (ctx, bw, bh) => {
    ctx.clearRect(0, 0, bw, bh);
    ctx.beginPath();
    ctx.moveTo(0, bh * 0.86);
    for (let x = 0; x <= bw; x += 24) {
      const n = Math.sin(x * 0.008) * 22 + Math.sin(x * 0.021 + 1.4) * 34;
      ctx.lineTo(x, bh * 0.58 + n);
    }
    ctx.lineTo(bw, bh);
    ctx.lineTo(0, bh);
    ctx.closePath();
    ctx.fillStyle = mood.far;
    ctx.fill();
    const count = 18;
    for (let i = 0; i < count; i++) {
      const x = (i + 0.15) * (bw / count);
      const tall = 50 + rnd() * 140;
      ctx.fillStyle = `rgba(6,4,10,${0.38 + rnd() * 0.4})`;
      farRidge(ctx, mood.ridge, x, bh * 0.84, tall);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.ellipse(rnd() * bw, bh * 0.16 + rnd() * bh * 0.22, 60 + rnd() * 90, 12 + rnd() * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  skyCache.grade = paintLayer(W, H, (ctx, bw, bh) => {
    const vig = ctx.createRadialGradient(bw / 2, bh * 0.46, Math.min(bw, bh) * 0.2, bw / 2, bh * 0.5, Math.max(bw, bh) * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(0.72, "rgba(0,0,0,0.08)");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, bw, bh);
    const lift = ctx.createLinearGradient(0, 0, 0, bh * 0.28);
    lift.addColorStop(0, "rgba(255,214,160,0.09)");
    lift.addColorStop(1, "rgba(255,214,160,0)");
    ctx.fillStyle = lift;
    ctx.fillRect(0, 0, bw, bh * 0.28);
    const key = ctx.createRadialGradient(bw * 0.78, bh * 0.12, 20, bw * 0.72, bh * 0.2, Math.max(bw, bh) * 0.7);
    key.addColorStop(0, "rgba(255,214,160,0.16)");
    key.addColorStop(1, "rgba(255,214,160,0)");
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, bw, bh);
    ctx.fillStyle = "rgba(18, 36, 58, 0.14)";
    ctx.fillRect(0, bh * 0.62, bw, bh * 0.38);
  });
  return skyCache;
}

function drawSky(ctx, arena, w, h, cam, frame, menu) {
  const cache = ensureSky(arena, w, h);
  ctx.drawImage(cache.base, 0, 0, w, h);
  const maxShift = Math.max(0, cache.far.width - w);
  const shift = menu ? maxShift * 0.45 : Math.max(0, Math.min(maxShift, maxShift * 0.5 + cam.x * 0.12));
  ctx.drawImage(cache.far, -shift, 0, cache.far.width, h);
  const narrowMenu = menu && w < 820;
  const orbX = menu ? (narrowMenu ? w * 0.5 : w * 0.93) : w * 0.72 - cam.x * 0.08;
  const orbY = menu ? (narrowMenu ? h * 0.62 : h * 0.07) : h * 0.22 - cam.y * 0.02;
  const mood = skyMood(arena.id);
  const glow = ctx.createRadialGradient(orbX, orbY, 8, orbX, orbY, 180);
  glow.addColorStop(0, mood.orb);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(orbX, orbY, 180, 0, Math.PI * 2);
  ctx.fill();
  const orbR = menu ? 18 : mood.r;
  ctx.save();
  ctx.beginPath();
  ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = mood.core;
  ctx.fillRect(orbX - orbR, orbY - orbR, orbR * 2, orbR * 2);
  ctx.fillStyle = "rgba(40, 18, 12, 0.42)";
  ctx.beginPath();
  ctx.arc(orbX + orbR * 0.55, orbY + orbR * 0.42, orbR * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,250,242,0.7)";
  ctx.beginPath();
  ctx.ellipse(orbX - orbR * 0.28, orbY - orbR * 0.32, orbR * 0.28, orbR * 0.14, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (arena.id === "drift") {
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x = (i * 160 + frame * 1.2) % (w + 40) - 20;
      ctx.strokeStyle = i % 2 ? "rgba(255,79,154,0.45)" : "rgba(62,240,255,0.4)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 24, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawBrackets(ctx, b) {
  ctx.strokeStyle = "rgba(255, 90, 80, 0.28)";
  ctx.lineWidth = 3;
  const s = 46;
  const corners = [
    [b.l, b.t, 1, 1],
    [b.r, b.t, -1, 1],
    [b.l, b.b, 1, -1],
    [b.r, b.b, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * s);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * s, y);
    ctx.stroke();
  }
}

function stageShape(id, p) {
  if (p.sealed || (id === "keel" && p.solid && p.h > 200)) return "hull";
  if (id === "crust" && p.move) return "crust";
  if (id === "forge" && p.move) return "lift";
  if (p.move) return "raft";
  if (p.maxHp || !p.solid) return "shelf";
  if (id === "forge") return "anvil";
  if (id === "drift") return "core";
  if (id === "gale") return "deck";
  if (id === "maw") return "jaw";
  return "wedge";
}

function topLip(ctx, x, y, w, edge) {
  if (w < 8) return;
  poly(ctx, [[x, y - 3], [x + w, y - 3], [x + w, y + 5], [x, y + 5]], edge, 2);
  const hw = Math.min(140, w * 0.32);
  poly(ctx, [[x + 12, y - 1], [x + 12 + hw, y - 1], [x + 8 + hw * 0.82, y + 2], [x + 16, y + 2]], CREAM, 0);
}

function courses(ctx, x, y, w, h, n) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 6, y + 2, Math.max(2, w - 12), Math.max(2, h - 4));
  ctx.clip();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 1; i <= n; i++) {
    const yy = y + (h * i) / (n + 1);
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
  }
  ctx.stroke();
  ctx.restore();
}

function rivet(ctx, x, y, color) {
  disk(ctx, x, y, 4.2, color, 1.5);
  poly(ctx, [[x - 1.6, y - 2], [x + 1.2, y - 2.2], [x + 0.3, y - 0.3]], CREAM, 0);
}

function drawWedge(ctx, x, y, w, look) {
  poly(ctx, [[x + 16, y + 32], [x + w - 16, y + 32], [x + w - 86, y + 158], [x + 86, y + 158]], look.under, 2);
  poly(ctx, [[x, y + 12], [x + w, y + 12], [x + w - 8, y + 36], [x + 8, y + 36]], look.face, 2);
  courses(ctx, x + 12, y + 14, w - 24, 20, 2);
  poly(ctx, [[x + 4, y], [x + w - 4, y], [x + w - 2, y + 14], [x + 2, y + 14]], look.top, 2);
  topLip(ctx, x, y, w, look.edge);
}

function drawHull(ctx, x, y, w, h, look) {
  const keel = y + h + 78;
  poly(ctx, [[x + 8, y + 34], [x + w - 8, y + 34], [x + w - 22, keel], [x + 22, keel]], look.under, 2);
  poly(ctx, [[x + 22, keel - 26], [x + w - 22, keel - 26], [x + w - 34, keel], [x + 34, keel]], look.face, 2);
  poly(ctx, [
    [x + w * 0.5 - 18, keel - 26],
    [x + w * 0.5 + 18, keel - 26],
    [x + w * 0.5 + 8, keel - 4],
    [x + w * 0.5 - 8, keel - 4],
  ], look.edge, 1.5);
  poly(ctx, [[x, y + 12], [x + w, y + 12], [x + w - 6, y + 36], [x + 6, y + 36]], look.face, 2);
  courses(ctx, x + 20, y + 16, w - 40, 18, 2);
  for (let i = 0; i < 5; i++) {
    const px = x + w * (0.18 + 0.16 * i);
    disk(ctx, px, y + 24, 11, INK, 2);
    disk(ctx, px, y + 24, 7, look.accent, 1.5);
    poly(ctx, [[px - 3, y + 20], [px + 1, y + 19], [px + 2, y + 22], [px - 2, y + 23]], CREAM, 0);
  }
  for (let i = 0; i < 8; i++) rivet(ctx, x + 48 + i * ((w - 96) / 7), y + 36, look.edge);
  poly(ctx, [[x + 2, y], [x + w - 2, y], [x + w - 1, y + 14], [x + 1, y + 14]], look.top, 2);
  topLip(ctx, x, y, w, look.edge);
  poly(ctx, [[x + 34, y - 2], [x + 98, y - 2], [x + 68, y - 36]], look.edge, 2);
  poly(ctx, [[x + w - 34, y - 2], [x + w - 98, y - 2], [x + w - 68, y - 36]], look.edge, 2);
}

function drawAnvil(ctx, x, y, w, look) {
  poly(ctx, [[x + 10, y + 30], [x + w - 10, y + 30], [x + w - 26, y + 108], [x + 26, y + 108]], look.under, 2);
  poly(ctx, [[x + 26, y + 90], [x + w - 26, y + 90], [x + w - 36, y + 108], [x + 36, y + 108]], shade(look.under, -0.25), 2);
  poly(ctx, [[x, y + 10], [x + w, y + 10], [x + w - 4, y + 32], [x + 4, y + 32]], look.face, 2);
  courses(ctx, x + 10, y + 12, w - 20, 18, 2);
  poly(ctx, [[x + 2, y], [x + w - 2, y], [x + w, y + 12], [x, y + 12]], look.top, 2);
  topLip(ctx, x, y, w, look.edge);
}

function drawCore(ctx, x, y, w, look) {
  poly(ctx, [[x + 28, y + 18], [x + w - 28, y + 18], [x + w - 10, y + 40], [x + w * 0.5, y + 82], [x + 10, y + 40]], look.under, 2);
  poly(ctx, [[x, y + 6], [x + w, y + 6], [x + w - 12, y + 30], [x + 12, y + 30]], look.face, 2);
  poly(ctx, [[x + 16, y], [x + w - 16, y], [x + w - 6, y + 12], [x + 6, y + 12]], look.top, 2);
  poly(ctx, [[x + w * 0.5 - 30, y + 16], [x + w * 0.5, y + 6], [x + w * 0.5 + 30, y + 16], [x + w * 0.5, y + 22]], look.edge, 1.5);
  disk(ctx, x + 26, y + 16, 5, look.accent, 1.5);
  disk(ctx, x + w - 26, y + 16, 5, look.accent, 1.5);
  topLip(ctx, x + 18, y, w - 36, look.edge);
}

function drawDeck(ctx, x, y, w, look) {
  poly(ctx, [[x + 40, y + 26], [x + w - 40, y + 26], [x + w - 96, y + 64], [x + 96, y + 64]], look.under, 2);
  poly(ctx, [[x + 16, y + 10], [x + w - 16, y + 10], [x + w - 8, y + 28], [x + 8, y + 28]], look.face, 2);
  poly(ctx, [[x + 24, y], [x + w - 24, y], [x + w, y + 12], [x, y + 12]], look.top, 2);
  poly(ctx, [[x, y + 12], [x + 24, y], [x + 24, y + 12]], look.edge, 1.5);
  poly(ctx, [[x + w, y + 12], [x + w - 24, y], [x + w - 24, y + 12]], look.edge, 1.5);
  topLip(ctx, x + 26, y, w - 52, look.edge);
}

function drawJaw(ctx, x, y, w, look) {
  poly(ctx, [[x + 14, y + 28], [x + w - 14, y + 28], [x + w - 42, y + 98], [x + 42, y + 98]], look.under, 2);
  poly(ctx, [[x, y + 10], [x + w, y + 10], [x + w - 4, y + 32], [x + 4, y + 32]], look.face, 2);
  const n = Math.max(6, Math.round(w / 78));
  const step = (w - 28) / n;
  for (let i = 0; i < n; i++) {
    const a = x + 14 + i * step;
    poly(ctx, [[a + 4, y + 30], [a + step * 0.5, y + 50], [a + step - 4, y + 30]], look.edge, 1.5);
  }
  poly(ctx, [[x + 2, y], [x + w - 2, y], [x + w, y + 12], [x, y + 12]], look.top, 2);
  topLip(ctx, x, y, w, look.edge);
}

function drawShelf(ctx, x, y, w, h, look) {
  const face = Math.max(10, h);
  poly(ctx, [[x + 4, y + face], [x + w - 4, y + face], [x + w - 12, y + face + 12], [x + 12, y + face + 12]], look.under, 2);
  poly(ctx, [[x, y + 5], [x + w, y + 5], [x + w - 2, y + face], [x + 2, y + face]], look.face, 2);
  poly(ctx, [[x + 2, y], [x + w - 2, y], [x + w - 1, y + 6], [x + 1, y + 6]], look.top, 2);
  topLip(ctx, x, y, w, look.edge);
}

function drawLift(ctx, p, look) {
  drawShelf(ctx, p.x, p.y, p.w, 14, look);
  limb(ctx, p.x + 18, -250, p.x + 14, p.y, 4, look.edge);
  limb(ctx, p.x + p.w - 18, -250, p.x + p.w - 14, p.y, 4, look.edge);
  disk(ctx, p.x + 18, -250, 5, look.top, 1.5);
  disk(ctx, p.x + p.w - 18, -250, 5, look.top, 1.5);
}

function drawRaft(ctx, x, y, w, look) {
  drawShelf(ctx, x, y, w, 14, look);
  disk(ctx, x + 18, y + 20, 8, look.accent, 1.5);
  disk(ctx, x + w - 18, y + 20, 8, look.accent, 1.5);
}

function drawCrust(ctx, x, y, w, h, look) {
  poly(ctx, [[x + 8, y + h], [x + w - 8, y + h], [x + w - 18, y + h + 16], [x + 18, y + h + 16]], "#ff5a1f", 2);
  poly(ctx, [[x, y + 8], [x + w, y + 8], [x + w - 4, y + h], [x + 4, y + h]], look.face, 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.28, y + 8);
  ctx.lineTo(x + w * 0.36, y + h);
  ctx.moveTo(x + w * 0.64, y + 6);
  ctx.lineTo(x + w * 0.56, y + h - 2);
  ctx.stroke();
  poly(ctx, [[x + 2, y], [x + w - 2, y], [x + w, y + 10], [x, y + 10]], look.top, 2);
  poly(ctx, [[x + 22, y], [x + 52, y - 7], [x + 58, y + 2], [x + 18, y + 4]], look.edge, 1.5);
  poly(ctx, [[x + w - 72, y], [x + w - 38, y - 8], [x + w - 30, y + 2], [x + w - 76, y + 3]], "#ffd23f", 1.5);
  topLip(ctx, x, y, w, look.edge);
  for (let i = 0; i < 3; i++) {
    const dx = x + 40 + i * ((w - 80) / 2);
    poly(ctx, [[dx, y + h + 12], [dx + 8, y + h + 12], [dx + 6, y + h + 28], [dx + 2, y + h + 28]], "#ff7a1a", 1.5);
  }
}

function drawForm(ctx, p, look, shape) {
  const x = p.x;
  const y = p.y;
  const w = p.w;
  const h = p.h || 14;
  if (shape === "hull") drawHull(ctx, x, y, w, h, look);
  else if (shape === "anvil") drawAnvil(ctx, x, y, w, look);
  else if (shape === "core") drawCore(ctx, x, y, w, look);
  else if (shape === "deck") drawDeck(ctx, x, y, w, look);
  else if (shape === "jaw") drawJaw(ctx, x, y, w, look);
  else if (shape === "crust") drawCrust(ctx, x, y, w, h, look);
  else if (shape === "lift") drawLift(ctx, p, look);
  else if (shape === "raft") drawRaft(ctx, x, y, w, look);
  else if (shape === "wedge") drawWedge(ctx, x, y, w, look);
  else drawShelf(ctx, x, y, w, h, look);
}

function tower(ctx, x, base, look) {
  poly(ctx, [[x, base], [x + 58, base], [x + 52, base - 86], [x + 6, base - 86]], look.face, 2);
  poly(ctx, [[x + 4, base - 86], [x + 54, base - 86], [x + 50, base - 100], [x + 8, base - 100]], look.top, 2);
  for (let i = 0; i < 3; i++) {
    poly(ctx, [
      [x + 8 + i * 15, base - 100],
      [x + 18 + i * 15, base - 100],
      [x + 18 + i * 15, base - 114],
      [x + 8 + i * 15, base - 114],
    ], look.edge, 1.5);
  }
  disk(ctx, x + 29, base - 46, 7, INK, 1.5);
  poly(ctx, [[x + 24, base - 50], [x + 30, base - 52], [x + 29, base - 46]], CREAM, 0);
  limb(ctx, x + 58, base - 96, x + 58, base - 22, 3, look.under);
  poly(ctx, [[x + 58, base - 96], [x + 66, base - 96], [x + 80, base - 34], [x + 58, base - 26]], look.accent, 2);
}

function chimney(ctx, x, base, look) {
  poly(ctx, [[x, base], [x + 34, base], [x + 30, base - 68], [x + 4, base - 68]], look.face, 2);
  poly(ctx, [[x - 4, base - 68], [x + 38, base - 68], [x + 34, base - 80], [x, base - 80]], look.edge, 2);
  disk(ctx, x + 17, base - 74, 7, INK, 1.5);
}

function horn(ctx, x, y, dir, look) {
  poly(ctx, [[x, y + 6], [x + dir * 42, y + 16], [x + dir * 30, y + 34], [x, y + 28]], look.edge, 2);
}

function grate(ctx, x, w, look) {
  poly(ctx, [[x, -6], [x + w, -6], [x + w - 4, 10], [x + 4, 10]], INK, 2);
  for (let i = 0; i < 4; i++) limb(ctx, x + 10 + i * ((w - 16) / 3), -4, x + 14 + i * ((w - 16) / 3), 8, 3, look.edge);
}

function vanePost(ctx, x, look) {
  poly(ctx, [[x - 7, 6], [x + 7, 6], [x + 5, -228], [x - 5, -228]], look.face, 2);
  poly(ctx, [[x - 16, -4], [x + 16, -4], [x + 12, 10], [x - 12, 10]], look.under, 1.5);
  disk(ctx, x, -228, 8, look.top, 2);
}

function forgePit(ctx) {
  poly(ctx, [[-250, 64], [250, 64], [160, 280], [-160, 280]], "#4a1208", 2);
  poly(ctx, [[-170, 108], [170, 108], [96, 248], [-96, 248]], "#ff5a1f", 2);
  poly(ctx, [[-78, 150], [78, 150], [36, 214], [-36, 214]], "#ffd23f", 1.5);
}

function basin(ctx, look) {
  poly(ctx, [[-660, 16], [660, 16], [560, 250], [-560, 250]], look.under, 2);
  poly(ctx, [[-620, 28], [620, 28], [530, 230], [-530, 230]], "#7a2410", 2);
  poly(ctx, [[-660, 8], [660, 8], [640, 30], [-640, 30]], look.face, 2);
  topLip(ctx, -640, 8, 1280, look.edge);
}

function paintStatic(ctx, arena) {
  const look = LOOK[arena.id] || LOOK.citadel;
  const main = arena.platforms.find((p) => p.solid);
  if (main) {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(main.x + main.w * 0.5, main.y + 22, main.w * 0.58, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (arena.id === "forge") forgePit(ctx);
  if (arena.id === "crust") basin(ctx, look);
  if (arena.id === "gale") {
    vanePost(ctx, -360, look);
    vanePost(ctx, 0, look);
    vanePost(ctx, 360, look);
  }
  for (const p of arena.platforms) {
    if (p.move || p.breakable) continue;
    drawForm(ctx, p, look, stageShape(arena.id, p));
  }
  if (arena.id === "citadel" && main) {
    tower(ctx, main.x - 64, main.y, look);
    tower(ctx, main.x + main.w + 6, main.y, look);
  }
  if (arena.id === "forge") {
    chimney(ctx, -508, 0, look);
    chimney(ctx, 474, 0, look);
    const solids = arena.platforms.filter((p) => p.solid);
    if (solids[0]) horn(ctx, solids[0].x + solids[0].w, solids[0].y, 1, look);
    if (solids[1]) horn(ctx, solids[1].x, solids[1].y, -1, look);
    for (const hz of arena.hazards || []) {
      if ((hz.kind || "vent") === "vent") grate(ctx, hz.x, hz.w, look);
    }
  }
  if (arena.id === "drift") {
    const core = arena.platforms.find((p) => p.solid);
    if (core) {
      const ax = core.x + core.w * 0.5;
      limb(ctx, ax, core.y, ax - 12, core.y - 52, 4, look.edge);
      disk(ctx, ax - 12, core.y - 52, 7, look.accent, 1.5);
    }
  }
}

function stageExtents(arena) {
  let minX = -40;
  let minY = -40;
  let maxX = 40;
  let maxY = 40;
  const add = (x0, y0, x1, y1) => {
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  };
  for (const p of arena.platforms) {
    if (p.move || p.breakable) continue;
    const deep = p.sealed || p.h > 200;
    add(p.x - 100, p.y - 160, p.x + p.w + 100, p.y + (deep ? p.h + 150 : p.solid ? 210 : p.h + 48));
  }
  if (arena.id === "citadel") add(-580, -170, 580, 220);
  if (arena.id === "forge") add(-640, -150, 640, 320);
  if (arena.id === "gale") add(-430, -280, 430, 90);
  if (arena.id === "crust") add(-700, -30, 700, 280);
  if (arena.id === "maw") add(-640, -150, 640, 180);
  return { minX: minX - 16, minY: minY - 16, maxX: maxX + 16, maxY: maxY + 16 };
}

let stageArt = { key: "", canvas: null, x: 0, y: 0 };

function ensureStageArt(arena) {
  if (stageArt.key === arena.id && stageArt.canvas) return stageArt;
  const ext = stageExtents(arena);
  const w = Math.max(2, Math.ceil(ext.maxX - ext.minX));
  const h = Math.max(2, Math.ceil(ext.maxY - ext.minY));
  const canvas = paintLayer(w, h, (ctx) => {
    ctx.setTransform(1, 0, 0, 1, -ext.minX, -ext.minY);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    paintStatic(ctx, arena);
  });
  stageArt = { key: arena.id, canvas, x: ext.minX, y: ext.minY };
  return stageArt;
}

function crackLines(ctx, p) {
  const n = Math.max(1, Math.ceil((1 - p.hp / p.maxHp) * 4));
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = p.x + ((i * 47 + 14) % Math.max(8, p.w - 8));
    ctx.moveTo(x, p.y + 2);
    ctx.lineTo(x + 10, p.y + p.h + 8);
  }
  ctx.stroke();
}

function drawFlames(ctx, hz, frame, hot) {
  const n = hot ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const cx = hz.x + 8 + ((hz.w - 16) * i) / Math.max(1, n - 1);
    const h = (hot ? 300 : 72) + Math.sin(frame * 0.35 + i * 1.2) * (hot ? 36 : 10);
    poly(ctx, [
      [cx - 12, -2],
      [cx + 12, -2],
      [cx + 5, -h * 0.55],
      [cx, -h],
      [cx - 5, -h * 0.48],
    ], i % 2 ? "#ffd23f" : "#ff5a1f", 1.5);
  }
}

function drawCannon(ctx, mouthX, y, dir, look, open) {
  ctx.save();
  ctx.translate(mouthX - 58 * dir, y);
  ctx.scale(dir, 1);
  const drop = -y;
  poly(ctx, [[-16, 22], [14, 22], [6, drop], [-18, drop]], look.face, 2);
  poly(ctx, [[-18, -28], [8, -28], [12, 28], [-18, 28]], look.under, 2);
  poly(ctx, [[-4, -18], [50, -13], [54, 13], [-4, 18]], look.face, 2);
  poly(ctx, [[2, -12], [34, -9], [30, -4], [4, -7]], CREAM, 0);
  disk(ctx, 54, 0, open ? 15 : 11, INK, 2);
  if (open) disk(ctx, 54, 0, 7, look.edge, 0);
  disk(ctx, 4, 22, 9, look.top, 1.5);
  ctx.restore();
}

function drawBeast(ctx, x, y, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  poly(ctx, [[-8, -4], [-46, -18], [-64, -2], [-44, 14], [-6, 10]], "#3d5a28", 2);
  poly(ctx, [[-30, -6], [-8, -28], [26, -22], [48, -4], [36, 18], [4, 24], [-26, 14]], "#7d9a3c", 2);
  poly(ctx, [[-4, 2], [22, 0], [18, 16], [-2, 16]], "#d5e2a4", 1.5);
  poly(ctx, [[16, -2], [50, 2], [46, 16], [14, 12]], "#c4553a", 2);
  poly(ctx, [[22, 6], [30, 4], [28, 9]], CREAM, 0);
  poly(ctx, [[-6, -22], [2, -42], [14, -18]], "#e6d2a8", 2);
  disk(ctx, 12, -12, 6.5, CREAM, 1.5);
  disk(ctx, 14, -12, 2.5, INK, 0);
  poly(ctx, [[-8, -18], [12, -20], [8, -14], [-6, -13]], CREAM, 0);
  ctx.restore();
}

function chevrons(ctx, from, far, y, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const step = 96;
  for (let i = 1; i <= 8; i++) {
    const x = from + dir * i * step;
    if (dir > 0 && x > far - 40) break;
    if (dir < 0 && x < far + 40) break;
    poly(ctx, [[x, y - 14], [x + dir * 20, y], [x, y + 14], [x + dir * 7, y]], "#ffb088", 1.5);
  }
  ctx.restore();
}

function vaneBlades(ctx, x, angle, look) {
  ctx.save();
  ctx.translate(x, -228);
  ctx.rotate(angle);
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    poly(ctx, [[8, -4], [48, -2], [48, 3], [8, 5]], look.edge, 2);
  }
  disk(ctx, 0, 0, 5, CREAM, 1.5);
  ctx.restore();
}

function windStreaks(ctx, hz, st, frame, look) {
  const dir = st.dir || 1;
  const speed = dir * (6 + 10 * (st.strength || 0));
  ctx.save();
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < 6; i++) {
    const span = hz.w;
    const base = i * 240 + frame * speed;
    const x = hz.x + ((base % span) + span) % span;
    const y = hz.y + 18 + ((i * 37) % Math.max(20, hz.h - 30));
    const len = 34 + (i % 3) * 18;
    poly(ctx, [[x, y], [x + dir * len, y - 2], [x + dir * len, y + 3], [x, y + 5]], i % 2 ? look.edge : look.accent, 1.5);
  }
  ctx.restore();
}

function lavaSkin(ctx, frame) {
  const wob = Math.sin(frame * 0.05) * 4;
  poly(ctx, [[-590, 24 + wob], [590, 24 - wob], [500, 220], [-500, 220]], "#ff5a1f", 2);
  poly(ctx, [[-400, 56], [400, 46], [280, 150], [-280, 160]], "#ffd23f", 0);
  for (let i = 0; i < 5; i++) {
    const x = -460 + i * 200 + Math.sin(frame * 0.04 + i) * 12;
    const cy = 40 + (i % 2) * 12;
    poly(ctx, [[x, cy], [x + 34, cy - 5], [x + 26, cy + 8], [x - 4, cy + 6]], "#4a3028", 1.5);
  }
}

function drawStageHazards(ctx, game, look) {
  const arena = game.arena;
  for (const hz of arena.hazards || []) {
    const kind = hz.kind || "vent";
    const st = hazardClock(game.frame, hz);
    if (kind === "vent") {
      if (st.warn || st.hot) drawFlames(ctx, hz, game.frame, st.hot);
    } else if (kind === "cannon") {
      const charging = st.phase === "telegraph" || (st.phase === "fly" && st.t < hz.windup + 12);
      const openL = charging && st.dir > 0;
      const openR = charging && st.dir < 0;
      drawCannon(ctx, hz.mouthL, hz.laneY, 1, look, openL);
      drawCannon(ctx, hz.mouthR, hz.laneY, -1, look, openR);
      if (st.phase === "telegraph") {
        const far = st.dir > 0 ? hz.mouthR : hz.mouthL;
        chevrons(ctx, st.from, far, st.y, st.dir, 0.28 + 0.4 * (st.t / hz.windup));
      } else if (st.phase === "fly") {
        drawBeast(ctx, st.x, st.y + Math.sin(game.frame * 0.25) * 3, st.dir);
      }
    } else if (kind === "wind") {
      const spin = st.dir * game.frame * 0.09 * Math.max(0.15, st.strength || 0);
      vaneBlades(ctx, -360, spin, look);
      vaneBlades(ctx, 0, spin + 0.7, look);
      vaneBlades(ctx, 360, spin + 1.3, look);
      windStreaks(ctx, hz, st, game.frame, look);
    }
  }
}

function drawPlatforms(ctx, game) {
  const arena = game.arena;
  const look = LOOK[arena.id] || LOOK.citadel;
  const art = ensureStageArt(arena);
  ctx.drawImage(art.canvas, art.x, art.y);
  if (arena.id === "crust") lavaSkin(ctx, game.frame);
  for (const p of game.plats) {
    if (!(p.move || p.maxHp)) continue;
    if (p.maxHp && p.hp <= 0) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 7]);
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.restore();
      continue;
    }
    const jiggle = p.crack ? Math.sin(game.frame * 1.7 + p.x) * 1.6 : 0;
    drawForm(ctx, jiggle ? { ...p, x: p.x + jiggle } : p, look, stageShape(arena.id, p));
    if (p.maxHp && p.hp < p.maxHp) crackLines(ctx, p);
  }
  drawStageHazards(ctx, game, look);
}

function drawParts(ctx, parts) {
  for (const p of parts) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = p.type === "ember" ? a * 0.65 : a;
    if (p.type === "ring") {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === "spark") {
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 1.7, p.y - p.vy * 1.7);
      ctx.globalAlpha = a * 0.22;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.globalAlpha = a * 0.7;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.strokeStyle = "#fffaf2";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.8, p.y - p.vy * 0.8);
      ctx.stroke();
    } else if (p.type === "ember") {
      ctx.globalAlpha = a * 0.28;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.size || 2) * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size || 4, p.size || 4);
    }
  }
  ctx.globalAlpha = 1;
}

function bigText(ctx, text, x, y, size, fill) {
  ctx.font = `900 ${size}px Cinzel, Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, size / 12);
  ctx.strokeStyle = "rgba(0,0,0,0.78)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.textBaseline = "alphabetic";
}

function drawHud(ctx, game, w, h) {
  const list = game.fighters;
  const gap = 10;
  const plateW = Math.min(240, (w - 36 - gap * (list.length - 1)) / list.length);
  const total = list.length * plateW + (list.length - 1) * gap;
  let x = (w - total) / 2;
  const y = h - 102;
  list.forEach((f) => {
    ctx.fillStyle = "rgba(6,4,3,0.78)";
    ctx.beginPath();
    ctx.rect(x, y, plateW, 84);
    ctx.fill();
    ctx.fillStyle = f.def.color;
    ctx.fillRect(x, y, 7, 84);
    ctx.fillStyle = "#fff8ee";
    ctx.font = "600 13px Outfit, sans-serif";
    ctx.textAlign = "left";
    const who = f.ctrl?.type === "human" ? `P${f.ctrl.scheme + 1}` : f.ctrl?.level === 0 ? "DUMMY" : `CPU ${f.ctrl.level}`;
    ctx.fillText(`${who}  ${f.def.name}`, x + 16, y + 22);
    const heat = Math.min(1, f.dmg / (150 * f.def.weight));
    const jitter = heat > 0.75 ? (Math.random() - 0.5) * 3 : 0;
    ctx.font = "700 34px Cinzel, Georgia, serif";
    ctx.fillStyle = f.state === "dead" ? "#6d645c" : `hsl(${46 - heat * 46} 95% ${92 - heat * 38}%)`;
    ctx.fillText(`${Math.floor(f.dmg)}%`, x + 16 + jitter, y + 62);
    if (!game.cfg.training) {
      const stocks = Math.min(f.stocks, 6);
      for (let i = 0; i < stocks; i++) {
        ctx.fillStyle = f.def.accent;
        ctx.beginPath();
        ctx.moveTo(x + plateW - 18 - i * 14, y + 18);
        ctx.lineTo(x + plateW - 12 - i * 14, y + 24);
        ctx.lineTo(x + plateW - 18 - i * 14, y + 30);
        ctx.lineTo(x + plateW - 24 - i * 14, y + 24);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = f.def.accent;
      ctx.font = "600 16px Outfit, sans-serif";
      ctx.fillText("∞", x + plateW - 28, y + 28);
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x + 16, y + 70, plateW - 32, 4);
    ctx.fillStyle = "#9ad7ff";
    ctx.fillRect(x + 16, y + 70, (plateW - 32) * Math.max(0, f.shieldHp / 70), 4);
    if (game.cfg.teams) {
      ctx.fillStyle = f.team === 0 ? "#ff6b6b" : "#6aa7ff";
      ctx.fillRect(x + plateW - 36, y + 58, 18, 6);
    }
    x += plateW + gap;
  });
}

function drawOverlay(ctx, game, w, h) {
  if (game.arena) {
    const grade = ensureSky(game.arena, w, h).grade;
    ctx.drawImage(grade, 0, 0, w, h);
    if (game.cine) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, 0, w, h);
    }
  }
  const bar = (game.bars || 0) * h * 0.11;
  if (bar > 1) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);
  }
  if (game.flashWhite > 0.02) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, game.flashWhite)})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (game.note > 0 && game.hud !== false) {
    const label = "12× DAMAGE";
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.note / 14);
    ctx.font = "900 58px Cinzel, Georgia, serif";
    const tw = ctx.measureText(label).width;
    const bw = Math.min(w - 48, tw + 80);
    const bh = 96;
    const bx = (w - bw) / 2;
    const by = h * 0.2;
    ctx.fillStyle = "rgba(12,8,6,0.9)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, bw, bh);
    bigText(ctx, label, w / 2, by + bh / 2, 58, "#ffe08a");
    ctx.restore();
  }
  if (game.banner && game.hud !== false && !game.cine && game.intro > 60) {
    ctx.globalAlpha = Math.min(1, game.banner.life / 12);
    bigText(ctx, game.banner.text, w / 2, h * 0.4, game.banner.text.length > 8 ? 72 : 110, game.banner.color || "#f2d48a");
    if (game.banner.sub) {
      ctx.font = "600 18px Outfit, sans-serif";
      ctx.fillStyle = "#fff6df";
      ctx.textAlign = "center";
      ctx.fillText(game.banner.sub.toUpperCase(), w / 2, h * 0.4 + 64);
    }
    ctx.globalAlpha = 1;
  }
  if (game.cine && game.hud !== false) {
    const c = game.cine;
    if (c.koT >= 0 && c.t >= c.koT + 8) {
      const pop = 1 + Math.max(0, (c.koT + 24 - c.t) / 16);
      const title = c.kind === "sd" ? "SELF DESTRUCT" : c.kind === "env" ? "FINAL ELIMINATION" : "FINAL K.O.";
      ctx.globalAlpha = 0.9;
      bigText(ctx, title, w / 2, h / 2, Math.min(92, w / 14) * pop, "#f4d78a");
      ctx.globalAlpha = 1;
    }
  }
  if (game.hud !== false) {
    const alive = game.fighters.filter((f) => f.state !== "dead");
    for (const f of alive) {
      const sx = (f.x - game.cam.x) * game.cam.z + w / 2;
      const sy = (f.y - f.def.h * 0.5 - game.cam.y) * game.cam.z + h / 2;
      if (sx > 16 && sx < w - 16 && sy > 16 && sy < h - 120) continue;
      const x = Math.max(26, Math.min(w - 26, sx));
      const y = Math.max(26, Math.min(h - 130, sy));
      ctx.fillStyle = f.def.color;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#140c09";
      ctx.font = "700 12px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.def.name[0], x, y + 4);
    }
  }
  if (game.paused && game.hud !== false) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, w, h);
  }
  if (game.error) {
    ctx.fillStyle = "#ffb4a8";
    ctx.font = "14px Outfit, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(game.error).slice(0, 180), 16, 24);
  }
}

export function drawWorld(ctx, game, cssW, cssH, dpr) {
  const w = cssW;
  const h = cssH;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  drawSky(ctx, game.arena, w, h, game.cam, game.frame, game.menu);
  const z = game.cam.z;
  const shake = game.paused ? 0 : game.reduced ? game.shake * 0.2 : game.shake;
  const sx = (Math.random() - 0.5) * shake;
  const sy = (Math.random() - 0.5) * shake;
  ctx.setTransform(z * dpr, 0, 0, z * dpr, w / 2 * dpr - game.cam.x * z * dpr + sx * dpr, h / 2 * dpr - game.cam.y * z * dpr + sy * dpr);
  drawBrackets(ctx, game.arena.blast);
  drawPlatforms(ctx, game);
  for (const shot of game.projs) {
    const owner = game.fighters[shot.owner];
    if (!owner) continue;
    const spd = Math.hypot(shot.vx, shot.vy) || 1;
    const tail = shot.r * 2.8;
    const tx = shot.x - (shot.vx / spd) * tail;
    const ty = shot.y - (shot.vy / spd) * tail;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = owner.def.color;
    ctx.lineWidth = Math.max(6, shot.r * 1.1);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(shot.x, shot.y);
    ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = owner.def.accent;
    ctx.lineWidth = Math.max(2, shot.r * 0.42);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "#fffaf2";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(shot.x - (shot.vx / spd) * tail * 0.45, shot.y - (shot.vy / spd) * tail * 0.45);
    ctx.lineTo(shot.x, shot.y);
    ctx.stroke();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = owner.def.color;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r * 3.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = owner.def.accent;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = owner.def.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r * 1.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = owner.def.accent;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffaf2";
    ctx.beginPath();
    ctx.arc(shot.x - shot.vx / spd * shot.r * 0.15, shot.y - shot.vy / spd * shot.r * 0.15, Math.max(2, shot.r * 0.38), 0, Math.PI * 2);
    ctx.fill();
  }
  const order = [...game.fighters].sort((a, b) => a.y - b.y);
  for (const f of order) drawFighter(ctx, f, game.frame);
  drawParts(ctx, game.parts);
  ctx.globalAlpha = 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawOverlay(ctx, game, w, h);
  if (game.hud !== false) drawHud(ctx, game, w, h);
}

const menuParts = [];

export function drawMenuScene(ctx, cssW, cssH, frame) {
  const arena = STAGES[0];
  const plats = arena.platforms.map((p) => ({
    ...p,
    solid: !!p.solid,
    hp: p.breakable || 0,
    maxHp: p.breakable || 0,
    dx: 0,
    dy: 0,
    crack: 0,
  }));
  if (frame % 4 === 0) {
    menuParts.push({
      type: "ember",
      x: (Math.random() - 0.5) * 1200,
      y: 80 + Math.random() * 200,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -0.35 - Math.random() * 0.4,
      life: 90,
      max: 90,
      color: arena.ember,
      size: 2,
      g: 0,
    });
  }
  for (const p of menuParts) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
  }
  while (menuParts.length > 80) menuParts.shift();
  const mocks = [0, 1].map((i) => {
    const def = CHARACTERS[i];
    const attacking = frame % 520 > 470;
    return {
      def,
      x: i === 0 ? -70 + Math.sin(frame * 0.01) * 30 : 90,
      y: 0,
      vx: 0,
      vy: 0,
      facing: i === 0 ? 1 : -1,
      state: attacking ? "attack" : "idle",
      move: attacking ? def.moves.heavy : null,
      mf: attacking ? (frame % 520) - 470 : 0,
      flash: 0,
      inv: 0,
      dmg: i === 1 ? 86 : 12,
      shieldHp: 70,
      grounded: true,
      trail: [],
      quiet: true,
      charge: 0,
      combo: 0,
      comboAt: -999,
      ctrl: { type: "cpu", level: 2 },
    };
  });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  drawWorld(ctx, {
    arena,
    plats,
    fighters: mocks,
    projs: [],
    parts: menuParts.filter((p) => p.life > 0),
    pops: [],
    cam: { x: Math.sin(frame * 0.004) * 70, y: -150, z: 0.62 },
    shake: 0,
    frame,
    banner: null,
    cine: null,
    flashWhite: 0,
    bars: 0,
    hitCard: null,
    cfg: {},
    hud: false,
    menu: true,
    paused: false,
    reduced: false,
  }, cssW, cssH, dpr);
}

export function drawPortrait(ctx, def, frame) {
  const c = ctx.canvas;
  const rect = c.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = Math.max(2, rect.width || c.clientWidth || 480);
  const cssH = Math.max(2, rect.height || c.clientHeight || 280);
  const bw = Math.floor(cssW * dpr);
  const bh = Math.floor(cssH * dpr);
  if (c.width !== bw || c.height !== bh) {
    c.width = bw;
    c.height = bh;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  const long = ["spear", "scythe", "whip", "bow", "greatsword", "staff", "chain"];
  const fit = def.look === "cast"
    ? (long.includes(def.vis?.weapon) ? [2.9, 1.45] : [1.85, 1.28])
    : ({
      brawler: [1.7, 1.2],
      heavy: [2.15, 1.42],
      speed: [1.85, 1.22],
      trick: [1.75, 1.46],
      dancer: [2.2, 1.28],
      grappler: [1.9, 1.16],
      fencer: [2.85, 1.26],
      archer: [2.05, 1.3],
      lancer: [3.25, 1.58],
      witch: [1.85, 1.48],
    }[def.shape] || [1.6, 1.18]);
  const scale = Math.min((cssW * 0.9) / (def.w * fit[0]), (cssH * 0.9) / (def.h * fit[1]));
  ctx.save();
  ctx.translate(cssW * 0.46, cssH * 0.94);
  ctx.scale(scale, scale);
  drawFighter(ctx, {
    def,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    state: "idle",
    move: null,
    mf: 0,
    flash: 0,
    inv: 0,
    dmg: 0,
    shieldHp: 70,
    grounded: true,
    trail: [],
    quiet: true,
    charge: 0,
    combo: 0,
    comboAt: -999,
    ctrl: { type: "cpu", level: 1 },
  }, frame);
  ctx.restore();
}
