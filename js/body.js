const INK = "#140c09";
const INK_W = 2;
const INK_DETAIL = 1.5;

const SKIN = {
  brawler: "#f0c3a0",
  heavy: "#d7c2a4",
  speed: "#f2d2b4",
  trick: "#f6d0c0",
  dancer: "#f6d5c0",
  grappler: "#e7b496",
  fencer: "#f3d3ba",
  archer: "#e8c3a2",
  lancer: "#e7cbb0",
  witch: "#f3d4ec",
};

const BULK = {
  heavy: 1.48,
  grappler: 1.42,
  brawler: 1.12,
  lancer: 1.06,
  archer: 0.94,
  witch: 0.9,
  trick: 0.88,
  fencer: 0.86,
  dancer: 0.8,
  speed: 0.78,
};

const HIP_HALF = {
  heavy: 0.32,
  grappler: 0.28,
  brawler: 0.22,
  lancer: 0.2,
  witch: 0.2,
};

const HAND = {
  grappler: 0.07,
  heavy: 0.05,
  brawler: 0.042,
};

function parseColor(hex) {
  const s = String(hex || "#888").trim();
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(s);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  const raw = s.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n) || full.length < 6) return [136, 136, 136];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex, amt) {
  const [r, g, b] = parseColor(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const ch = (v) => Math.round(v + (t - v) * p);
  return `rgb(${ch(r)}, ${ch(g)}, ${ch(b)})`;
}

function flat(color) {
  const s = String(color || "").replace(/\s/g, "").toLowerCase();
  return s === "#fff" || s === "#ffffff" || s === "#fffaf2" || s === "rgb(255,255,255)" || s === "rgb(255,250,242)";
}

function inkOf(weight) {
  if (!(weight > 0)) return 0;
  if (weight <= INK_DETAIL) return weight;
  return INK_W;
}

export function lightDir(ctx) {
  const t = ctx.getTransform();
  const det = t.a * t.d - t.b * t.c;
  const sx = -0.70710678118;
  const sy = -0.70710678118;
  if (!det) return [sx, sy];
  const lx = (t.d * sx - t.c * sy) / det;
  const ly = (-t.b * sx + t.a * sy) / det;
  const m = Math.hypot(lx, ly) || 1;
  return [lx / m, ly / m];
}

function clipHalf(pts, lx, ly, limit, greater) {
  const out = [];
  const proj = (p) => p[0] * lx + p[1] * ly;
  const inside = (p) => (greater ? proj(p) >= limit : proj(p) <= limit);
  const cut = (a, b) => {
    const da = proj(a);
    const db = proj(b);
    const t = (limit - da) / ((db - da) || 1e-8);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  let prev = pts[pts.length - 1];
  let prevIn = inside(prev);
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const curIn = inside(cur);
    if (curIn) {
      if (!prevIn) out.push(cut(prev, cur));
      out.push(cur);
    } else if (prevIn) out.push(cut(prev, cur));
    prev = cur;
    prevIn = curIn;
  }
  return out;
}

function fillHalf(ctx, pts, lx, ly, limit, greater, color) {
  const cut = clipHalf(pts, lx, ly, limit, greater);
  if (cut.length < 3) return;
  trace(ctx, cut);
  ctx.fillStyle = color;
  ctx.fill();
}

function celSides(ctx, pts, fill) {
  if (flat(fill) || !pts || pts.length < 3) return;
  const [lx, ly] = lightDir(ctx);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const t = pts[i][0] * lx + pts[i][1] * ly;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  const span = max - min;
  if (!(span >= 6)) return;
  const mid = (min + max) / 2;
  const gap = span * 0.1;
  fillHalf(ctx, pts, lx, ly, mid - gap, false, shade(fill, -0.5));
  fillHalf(ctx, pts, lx, ly, mid + gap, true, shade(fill, 0.38));
  fillHalf(ctx, pts, lx, ly, max - span * 0.2, true, shade(fill, 0.7));
}

function trace(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

export function poly(ctx, pts, fill, weight = INK_W) {
  if (!pts || pts.length < 3) return;
  const draw = () => trace(ctx, pts);
  draw();
  ctx.fillStyle = fill;
  ctx.fill();
  celSides(ctx, pts, fill);
  const ink = inkOf(weight);
  if (ink > 0) {
    draw();
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

export function disk(ctx, x, y, r, fill, weight = INK_W) {
  const rad = Math.max(0.5, r);
  const draw = () => {
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
  };
  draw();
  ctx.fillStyle = fill;
  ctx.fill();
  if (!flat(fill) && rad >= 3.4) {
    const [lx, ly] = lightDir(ctx);
    const px = -ly;
    const py = lx;
    const gap = rad * 0.16;
    const ext = rad * 2.6;
    const cap = (dir, color) => {
      const ox = x + lx * gap * dir;
      const oy = y + ly * gap * dir;
      const along = ext * dir;
      ctx.beginPath();
      ctx.moveTo(ox + px * ext, oy + py * ext);
      ctx.lineTo(ox - px * ext, oy - py * ext);
      ctx.lineTo(ox + lx * along - px * ext, oy + ly * along - py * ext);
      ctx.lineTo(ox + lx * along + px * ext, oy + ly * along + py * ext);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    ctx.save();
    draw();
    ctx.clip();
    cap(-1, shade(fill, -0.5));
    cap(1, shade(fill, 0.4));
    ctx.fillStyle = "rgba(255,250,242,0.55)";
    ctx.beginPath();
    ctx.ellipse(x + lx * rad * 0.38, y + ly * rad * 0.42, rad * 0.26, rad * 0.13, Math.atan2(ly, lx), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const ink = inkOf(weight);
  if (ink > 0) {
    draw();
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink;
    ctx.stroke();
  }
}

export function inkFill(ctx, fill, weight = INK_W, span = 0) {
  ctx.fillStyle = fill;
  ctx.fill();
  const ink = inkOf(weight);
  if (ink > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
  if (span >= 6 && !flat(fill)) {
    const [lx, ly] = lightDir(ctx);
    const shift = span * 0.58;
    ctx.save();
    ctx.clip();
    ctx.translate(-lx * shift, -ly * shift);
    ctx.fillStyle = shade(fill, -0.46);
    ctx.fill();
    ctx.translate(lx * shift * 2, ly * shift * 2);
    ctx.fillStyle = shade(fill, 0.52);
    ctx.fill();
    ctx.restore();
  }
}

function eye(ctx, x, y, r) {
  ctx.fillStyle = "#fffaf2";
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.42, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + r * 0.1, y, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

function quad(ctx, x1, y1, x2, y2, ox, oy, half, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * half;
  const py = (dx / len) * half;
  ctx.beginPath();
  ctx.moveTo(x1 + ox + px, y1 + oy + py);
  ctx.lineTo(x1 + ox - px, y1 + oy - py);
  ctx.lineTo(x2 + ox - px, y2 + oy - py);
  ctx.lineTo(x2 + ox + px, y2 + oy + py);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function capsule(ctx, x1, y1, x2, y2, r) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.arc(x1, y1, r, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.arc(x2, y2, r, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
}

export function limb(ctx, x1, y1, x2, y2, width, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const r = Math.max(0.8, width * 0.5);
  capsule(ctx, x1, y1, x2, y2, r + 1);
  ctx.fillStyle = INK;
  ctx.fill();
  capsule(ctx, x1, y1, x2, y2, r);
  ctx.fillStyle = color;
  ctx.fill();
  if (flat(color) || width < 2.4 || len < 4) return;
  let px = -dy / len;
  let py = dx / len;
  const [lx, ly] = lightDir(ctx);
  if (px * lx + py * ly < 0) {
    px = -px;
    py = -py;
  }
  const ux = dx / len;
  const uy = dy / len;
  const inset = Math.min(len * 0.18, r);
  if (len - inset * 2 < 1.2) return;
  const ax = x1 + ux * inset;
  const ay = y1 + uy * inset;
  const bx = x2 - ux * inset;
  const by = y2 - uy * inset;
  ctx.save();
  capsule(ctx, x1, y1, x2, y2, r);
  ctx.clip();
  quad(ctx, ax, ay, bx, by, -px * r * 0.32, -py * r * 0.32, r * 0.42, shade(color, -0.55));
  quad(ctx, ax, ay, bx, by, px * r * 0.4, py * r * 0.4, r * 0.24, shade(color, 0.58));
  quad(ctx, ax, ay, bx, by, px * r * 0.62, py * r * 0.62, r * 0.07, "rgba(255,250,242,0.72)");
  ctx.restore();
}

export function anchors(def) {
  const h = def.h;
  const w = def.w;
  const hipY = -0.48 * h;
  const shoulderY = -0.70 * h;
  const shoulderX = 0.22 * w;
  const headY = -0.86 * h;
  const headR = 0.12 * h;
  return {
    h,
    w,
    feetY: 0,
    hipX: 0,
    hipY,
    shoulderY,
    shoulderX,
    headX: 0,
    headY,
    headR,
    upperArm: 0.20 * h,
    forearm: 0.18 * h,
    thigh: 0.27 * h,
    shin: 0.25 * h,
    hip: [0, hipY],
    shoulder: [0, shoulderY],
    leadShoulder: [shoulderX, shoulderY],
    rearShoulder: [-shoulderX, shoulderY],
    head: [0, headY],
    feet: [0, 0],
  };
}

function spin(x, y, lean, hipY) {
  const dy = y - hipY;
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  return [x * c - dy * s, hipY + x * s + dy * c];
}

function ik2(ax, ay, tx, ty, len1, len2, bend, fallback) {
  let dx = tx - ax;
  let dy = ty - ay;
  let dist = Math.hypot(dx, dy);
  if (dist < 0.001) {
    dx = Math.cos(fallback);
    dy = Math.sin(fallback);
    dist = 1;
  }
  const max = len1 + len2 - 0.001;
  const min = Math.abs(len1 - len2) + 0.001;
  if (dist > max) {
    dx *= max / dist;
    dy *= max / dist;
    dist = max;
  } else if (dist < min) {
    dx *= min / dist;
    dy *= min / dist;
    dist = min;
  }
  const endX = ax + dx;
  const endY = ay + dy;
  const ang = Math.atan2(dy, dx);
  const cosA = (len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist);
  const theta = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const jointAng = ang + bend * theta;
  return {
    joint: [ax + Math.cos(jointAng) * len1, ay + Math.sin(jointAng) * len1],
    end: [endX, endY],
  };
}

function readPose(fighter, frame) {
  if (fighter.pose) return fighter.pose;
  const s = Math.sin((frame || 0) * 0.2);
  return {
    arm: s * 0.18,
    armY: 0,
    lean: 0,
    leg: s * 0.35,
    aim: false,
    aimX: 1,
    aimY: -0.12,
    extend: 0.7,
  };
}

function colorsOf(fighter) {
  const shape = fighter.def.shape || "brawler";
  const color = fighter.def.color || "#e8562a";
  const accent = fighter.def.accent || "#ffd23f";
  if (fighter.flash) {
    const white = "#fffaf2";
    return {
      skin: "#fff",
      cloth: white,
      dark: white,
      accent: "#fff",
      shoe: "#fff",
      head: white,
      armLead: white,
      armRear: white,
      handLead: white,
      handRear: white,
      leg: white,
    };
  }
  const skin = fighter.def.skin || SKIN[shape] || "#f0c3a0";
  const dark = shade(color, -0.38);
  const cloth = color;
  const wear = {
    plate: ["cloth", "cloth", "accent", "skin", "dark", "dark"],
    robe: ["dark", "dark", "skin", "skin", "dark", "accent"],
    bare: ["skin", "skin", "skin", "skin", "dark", "skin"],
    suit: ["cloth", "cloth", "accent", "cloth", "dark", "cloth"],
    scale: ["dark", "cloth", "skin", "skin", "dark", "dark"],
    fur: ["cloth", "skin", "skin", "skin", "dark", "cloth"],
    silk: ["accent", "cloth", "skin", "skin", "accent", "skin"],
  };
  const table = (fighter.def.wear && wear[fighter.def.wear]) || {
    brawler: ["skin", "skin", "skin", "skin", "dark", "skin"],
    heavy: ["skin", "skin", "skin", "skin", "dark", "dark"],
    grappler: ["skin", "skin", "skin", "skin", "skin", "skin"],
    dancer: ["skin", "skin", "skin", "skin", "skin", "skin"],
    speed: ["cloth", "cloth", "cloth", "accent", "dark", "cloth"],
    trick: ["cloth", "cloth", "skin", "skin", "dark", "skin"],
    fencer: ["cloth", "cloth", "accent", "skin", "dark", "skin"],
    archer: ["cloth", "skin", "skin", "skin", "dark", "skin"],
    lancer: ["cloth", "cloth", "skin", "skin", "dark", "dark"],
    witch: ["dark", "dark", "skin", "skin", "dark", "skin"],
  }[shape] || ["cloth", "cloth", "skin", "skin", "dark", "skin"];
  const pick = (key) => (key === "skin" ? skin : key === "dark" ? dark : key === "accent" ? accent : cloth);
  const shoe = shape === "dancer" || shape === "trick" || shape === "witch"
    ? accent
    : shape === "brawler"
      ? shade(accent, -0.25)
      : shape === "grappler"
        ? dark
        : shade(color, -0.28);
  return {
    skin,
    cloth,
    dark,
    accent,
    shoe,
    head: pick(table[5]),
    armRear: pick(table[0]),
    armLead: pick(table[1]),
    handRear: pick(table[2]),
    handLead: pick(table[3]),
    leg: pick(table[4]),
  };
}

function soleY(a) {
  return -Math.min(5.5, a.h * 0.045);
}

function bodyDrop(pose, a) {
  return (pose.dip || 0) + (pose.duck || 0) * a.h;
}

function wrap01(u) {
  const x = u % 1;
  return x < 0 ? x + 1 : x;
}

function solveLeg(hip, foot, a) {
  const full = a.thigh + a.shin;
  const max = full - Math.max(a.h * 0.045, 3.2);
  const min = Math.abs(a.thigh - a.shin) + a.h * 0.03;
  let dx = foot[0] - hip[0];
  let dy = foot[1] - hip[1];
  let dist = Math.hypot(dx, dy);
  if (dist < 0.001) {
    dx = 0;
    dy = min;
    dist = min;
  }
  if (dist > max) {
    dx *= max / dist;
    dy *= max / dist;
  } else if (dist < min) {
    dx *= min / dist;
    dy *= min / dist;
  }
  const solved = ik2(hip[0], hip[1], hip[0] + dx, hip[1] + dy, a.thigh, a.shin, -1, Math.PI / 2);
  return { hip, knee: solved.joint, foot: solved.end };
}

function plantFoot(hip, x, sole, a) {
  const full = a.thigh + a.shin;
  const dy = sole - hip[1];
  let slack = Math.max(a.h * 0.04, 2.8);
  if (Math.abs(dy) > full - slack) slack = Math.max(0.8, full - Math.abs(dy) - 0.6);
  const max = full - slack;
  const room = Math.sqrt(Math.max(max * max - dy * dy, 0));
  let dx = x - hip[0];
  if (Math.abs(dx) > room) dx = Math.sign(dx || 1) * room;
  const solved = ik2(hip[0], hip[1], hip[0] + dx, sole, a.thigh, a.shin, -1, Math.PI / 2);
  return { hip, knee: solved.joint, foot: [hip[0] + dx, sole] };
}

function idleLeg(side, pose, a, hip, sole) {
  const shift = Math.sin(pose.phase || 0);
  const weighted = side > 0 ? shift : -shift;
  const light = Math.max(0, -weighted);
  const home = (side > 0 ? 0.05 : -0.042) * a.h;
  if (light > 0.35) {
    const y = sole - light * light * a.h * 0.055;
    return solveLeg(hip, [home, y], a);
  }
  return plantFoot(hip, home, sole, a);
}

function stepLeg(side, pose, a, hip, sole) {
  const phase = pose.phase || 0;
  const u = wrap01((phase + (side > 0 ? 0 : Math.PI)) / (Math.PI * 2));
  const stride = (pose.stride || 0.8) * a.h * 0.15;
  const lift = (pose.lift || 0.8) * a.h * (pose.gait === "run" ? 0.155 : 0.12);
  const support = pose.gait === "run" ? 0.46 : 0.5;
  if (u < support) {
    const t = u / support;
    return plantFoot(hip, hip[0] + Math.cos(t * Math.PI) * stride, sole, a);
  }
  const t = (u - support) / (1 - support);
  const pass = Math.sin(t * Math.PI);
  const early = Math.pow(pass, 0.55);
  const x = hip[0] - Math.cos(t * Math.PI) * stride - early * a.h * 0.1;
  const y = sole - early * lift;
  return solveLeg(hip, [x, y], a);
}

function airLeg(side, pose, a, hip) {
  const full = a.thigh + a.shin;
  const rise = pose.gait === "rise";
  const k = Math.max(0, Math.min(1, pose.lift == null ? 0.7 : pose.lift));
  const spread = side * a.h * 0.022;
  if (rise) {
    const tuck = 0.4 + 0.6 * k;
    return solveLeg(hip, [
      hip[0] - a.h * 0.05 * tuck + spread,
      hip[1] + full * (0.56 - tuck * 0.2),
    ], a);
  }
  return solveLeg(hip, [
    hip[0] - a.h * (0.055 + 0.09 * k) + spread,
    hip[1] + full * (0.64 + 0.08 * k),
  ], a);
}

function landLeg(side, pose, a, hip, sole) {
  return plantFoot(hip, hip[0] + side * a.h * 0.032, sole, a);
}

function armTarget(shoulder, side, pose, a, fighter) {
  const swing = pose.arm || 0;
  const lift = pose.armY || 0;
  const full = a.upperArm + a.forearm;
  const grab = fighter.state === "hold" || !!(fighter.move && fighter.move.grab);
  const gait = pose.gait;
  const free = gait === "idle" || gait === "walk" || gait === "run" || gait === "rise" || gait === "fall" || gait === "land";
  if (pose.aim && (side > 0 || grab)) {
    const ext = pose.extend != null ? pose.extend : swing;
    if (ext < 0.2) {
      const back = side > 0 ? -1 : -0.35;
      return [
        shoulder[0] + back * a.h * 0.12 + Math.min(0, ext) * a.h * 0.06,
        shoulder[1] + full * 0.4 + lift * a.h * 0.12,
      ];
    }
    const striking = fighter.state === "attack" || fighter.state === "charge" || grab;
    const cap = free && !striking ? 0.72 : 0.88;
    const t = Math.max(0.5, Math.min(cap, ext));
    const dist = full * t;
    const ax = pose.aimX != null ? pose.aimX : 1;
    const ay = pose.aimY != null ? pose.aimY : 0;
    const spread = side > 0 ? 0 : -a.h * 0.03;
    return [shoulder[0] + ax * dist + spread, shoulder[1] + ay * dist];
  }
  if (side < 0 && free) {
    let tx = -swing * a.h * 0.2;
    let ty = full * 0.52 + lift * a.h * 0.36;
    const reach = full * 0.75;
    const dist = Math.hypot(tx, ty) || 1;
    if (dist > reach) {
      tx *= reach / dist;
      ty *= reach / dist;
    }
    return [shoulder[0] + tx, shoulder[1] + ty];
  }
  const sign = side > 0 ? 1 : -1;
  let tx = sign * (a.h * 0.04 + swing * a.h * 0.22);
  let ty = full * 0.62 + lift * a.h * 0.28;
  const reach = full * 0.82;
  const dist = Math.hypot(tx, ty) || 1;
  if (dist > reach) {
    tx *= reach / dist;
    ty *= reach / dist;
  }
  return [shoulder[0] + tx, shoulder[1] + ty];
}

function placeLeg(side, pose, a) {
  const drop = bodyDrop(pose, a);
  const hip = [side * a.w * 0.1 + (pose.sway || 0), a.hipY + drop];
  const sole = soleY(a);
  const gait = pose.gait;
  if (gait === "idle") return idleLeg(side, pose, a, hip, sole);
  if (gait === "walk" || gait === "run") return stepLeg(side, pose, a, hip, sole);
  if (gait === "rise" || gait === "fall") return airLeg(side, pose, a, hip);
  if (gait === "land") return landLeg(side, pose, a, hip, sole);
  const stride = Math.max(-1.15, Math.min(1.15, pose.leg || 0)) * a.h * 0.2;
  if (pose.plant) return plantFoot(hip, hip[0] + side * stride, sole, a);
  const full = a.thigh + a.shin;
  return solveLeg(hip, [hip[0] + side * stride * 0.35, hip[1] + full * 0.56], a);
}

export function layout(fighter, frame) {
  const a = anchors(fighter.def);
  const pose = readPose(fighter, frame);
  const lean = pose.lean || 0;
  const shape = fighter.def.shape || "brawler";
  const bulk = fighter.def.bulk || BULK[shape] || 1;
  const drop = bodyDrop(pose, a);
  const sway = pose.sway || 0;
  const breath = pose.breath || 0;
  const roll = pose.roll || 0;
  const around = (x, y) => {
    const p = spin(x, y, lean, a.hipY);
    return [p[0] + sway, p[1] + drop];
  };
  const leadShoulder = around(a.shoulderX, a.shoulderY + breath + roll);
  const rearShoulder = around(-a.shoulderX, a.shoulderY + breath - roll);
  const head = around(0, a.headY + breath * 0.4);
  const leadArm = placeArm(1, leadShoulder, pose, a, fighter);
  const rearArm = placeArm(-1, rearShoulder, pose, a, fighter);
  const leadLeg = placeLeg(1, pose, a);
  const rearLeg = placeLeg(-1, pose, a);
  const hipHalf = a.w * (fighter.def.hip || HIP_HALF[shape] || 0.18);
  const colors = colorsOf(fighter);
  return {
    ...a,
    pose,
    lean,
    shape,
    bulk,
    colors,
    hipHalf,
    hip: [sway, a.hipY + drop],
    head,
    chest: around(0, (a.hipY + a.shoulderY) * 0.5 + breath * 0.45),
    leadShoulder,
    rearShoulder,
    midShoulder: around(0, a.shoulderY + breath),
    leadElbow: leadArm.elbow,
    leadHand: leadArm.hand,
    rearElbow: rearArm.elbow,
    rearHand: rearArm.hand,
    frontHand: leadArm.hand,
    backHand: rearArm.hand,
    leadHip: leadLeg.hip,
    rearHip: rearLeg.hip,
    leadKnee: leadLeg.knee,
    leadFoot: leadLeg.foot,
    rearKnee: rearLeg.knee,
    rearFoot: rearLeg.foot,
    armW: Math.max(3.2, a.w * 0.125 * bulk),
    legW: Math.max(3.6, a.w * 0.145 * bulk),
    handR: a.h * (HAND[shape] || 0.034),
    spin: around,
    torso: [
      around(-hipHalf, a.hipY),
      around(hipHalf, a.hipY),
      leadShoulder,
      rearShoulder,
    ],
  };
}

function placeArm(side, shoulder, pose, a, fighter) {
  const target = armTarget(shoulder, side, pose, a, fighter);
  const solved = ik2(shoulder[0], shoulder[1], target[0], target[1], a.upperArm, a.forearm, 1, Math.PI / 2);
  return { elbow: solved.joint, hand: solved.end };
}

function pointFrom(from, toward, dist) {
  const dx = toward[0] - from[0];
  const dy = toward[1] - from[1];
  const mag = Math.hypot(dx, dy) || 1;
  return [from[0] + (dx / mag) * dist, from[1] + (dy / mag) * dist];
}

function bone(ctx, a, b, width, color) {
  limb(ctx, a[0], a[1], b[0], b[1], width, color);
}

function drawShoe(ctx, knee, foot, color, h) {
  const s = Math.max(5, h * 0.055);
  const ang = Math.atan2(foot[1] - knee[1], foot[0] - knee[0]);
  const tilt = Math.max(-1, Math.min(1, ang - Math.PI / 2));
  const drop = s * 0.9;
  const gap = -foot[1] - drop;
  const sink = gap > 0 && gap < s ? gap : 0;
  ctx.save();
  ctx.translate(foot[0], foot[1] + sink);
  ctx.rotate(tilt * 0.45);
  poly(ctx, [
    [-s * 0.55, -s * 0.2],
    [s * 1.45, -s * 0.32],
    [s * 1.15, drop],
    [-s * 0.6, drop * 0.92],
  ], color, INK_DETAIL);
  ctx.restore();
}

function paintBody(ctx, rig) {
  const { colors } = rig;
  bone(ctx, rig.rearHip, rig.rearKnee, rig.legW, colors.leg);
  bone(ctx, rig.rearKnee, rig.rearFoot, rig.legW, colors.leg);
  drawShoe(ctx, rig.rearKnee, rig.rearFoot, colors.shoe, rig.h);
  bone(ctx, rig.rearShoulder, rig.rearElbow, rig.armW, colors.armRear);
  bone(ctx, rig.rearElbow, rig.rearHand, rig.armW, colors.armRear);
  disk(ctx, rig.rearHand[0], rig.rearHand[1], rig.handR, colors.handRear, INK_DETAIL);
  poly(ctx, rig.torso, colors.cloth, INK_W);
  bone(ctx, rig.leadHip, rig.leadKnee, rig.legW, colors.leg);
  bone(ctx, rig.leadKnee, rig.leadFoot, rig.legW, colors.leg);
  drawShoe(ctx, rig.leadKnee, rig.leadFoot, colors.shoe, rig.h);
  const neckSpan = Math.hypot(rig.head[0] - rig.midShoulder[0], rig.head[1] - rig.midShoulder[1]);
  const neckEnd = pointFrom(rig.midShoulder, rig.head, Math.max(0, neckSpan - rig.headR * 0.9));
  bone(ctx, rig.midShoulder, neckEnd, Math.max(3, rig.armW * 0.62), colors.skin);
  disk(ctx, rig.head[0], rig.head[1], rig.headR, colors.head, INK_W);
  ctx.save();
  ctx.translate(rig.head[0], rig.head[1]);
  ctx.rotate(rig.lean || 0);
  eye(ctx, rig.headR * 0.32, rig.headR * 0.1, rig.headR);
  ctx.restore();
  bone(ctx, rig.leadShoulder, rig.leadElbow, rig.armW, colors.armLead);
  bone(ctx, rig.leadElbow, rig.leadHand, rig.armW, colors.armLead);
  disk(ctx, rig.leadHand[0], rig.leadHand[1], rig.handR, colors.handLead, INK_DETAIL);
}

function gloss(ctx, rig) {
  if (!rig || flat(rig.colors.cloth)) return;
  const [lx, ly] = lightDir(ctx);
  const ang = Math.atan2(ly, lx);
  const r = rig.headR;
  ctx.save();
  ctx.beginPath();
  ctx.arc(rig.head[0], rig.head[1], r * 0.97, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(255, 250, 242, 0.8)";
  ctx.beginPath();
  ctx.ellipse(rig.head[0] + lx * r * 0.4, rig.head[1] + ly * r * 0.48, r * 0.22, r * 0.12, ang, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const sw = Math.max(2.2, rig.armW * 0.46);
  const chest = rig.chest || rig.midShoulder;
  ctx.save();
  if (rig.torso && rig.torso.length > 2) {
    trace(ctx, rig.torso);
    ctx.clip();
  }
  ctx.fillStyle = "rgba(255, 250, 242, 0.78)";
  for (const s of [rig.rearShoulder, rig.leadShoulder]) {
    const gx = s[0] + (chest[0] - s[0]) * 0.34 + lx * sw * 0.28;
    const gy = s[1] + (chest[1] - s[1]) * 0.2 + ly * sw * 0.42;
    ctx.beginPath();
    ctx.ellipse(gx, gy, sw * 0.62, sw * 0.34, ang, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawRig(ctx, fighter, frame, extras) {
  const rig = layout(fighter, frame || 0);
  ctx.save();
  try {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    paintBody(ctx, rig);
    if (typeof extras === "function") extras(ctx, rig);
    gloss(ctx, rig);
  } finally {
    ctx.restore();
  }
  return rig;
}

export { INK, INK_DETAIL, INK_W, gloss };
