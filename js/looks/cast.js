import { INK, disk, drawRig, poly } from "../body.js?v=cast40";

function shade(hex, amt) {
  const raw = String(hex || "#888").replace("#", "");
  const n = parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const ch = (shift) => Math.round(((n >> shift) & 255) + (t - ((n >> shift) & 255)) * p);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function unit(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const m = Math.hypot(dx, dy) || 1;
  return [dx / m, dy / m];
}

function eyes(ctx, r, kind, accent) {
  if (kind === "none") return;
  const glow = kind === "glow";
  const wide = kind === "wide";
  const slit = kind === "slit";
  ctx.fillStyle = glow ? accent : "#fffaf2";
  const ry = slit ? r * 0.08 : wide ? r * 0.22 : r * 0.14;
  const rx = wide ? r * 0.28 : r * 0.18;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * r * 0.32, -r * 0.05, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!glow) {
    ctx.fillStyle = INK;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 0.36, -r * 0.02, slit ? r * 0.05 : r * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function headgear(ctx, rig, vis, color, accent) {
  const [x, y] = rig.head;
  const r = rig.headR;
  const head = vis.head || "bald";
  ctx.save();
  ctx.translate(x, y);
  if (head === "helm" || head === "visor") {
    disk(ctx, 0, -r * 0.15, r * 1.05, shade(color, -0.25));
    poly(ctx, [[-r, r * 0.1], [r, r * 0.1], [r * 0.7, r * 0.55], [-r * 0.7, r * 0.55]], shade(color, -0.45), 2);
    if (head === "visor") {
      poly(ctx, [[-r * 0.7, -r * 0.05], [r * 0.75, -r * 0.15], [r * 0.7, r * 0.2], [-r * 0.65, r * 0.15]], accent, 2);
    } else {
      eyes(ctx, r, vis.eyes, accent);
    }
  } else if (head === "hood" || head === "veil") {
    poly(ctx, [[-r * 1.3, r * 0.3], [0, -r * 1.7], [r * 1.15, r * 0.2], [r * 0.4, r * 1.3], [-r * 0.5, r * 1.35]], shade(color, -0.35), 2);
    if (head === "veil") poly(ctx, [[-r * 0.2, r * 0.15], [r * 0.7, r * 0.05], [r * 0.45, r * 1.1], [-r * 0.15, r * 1.05]], shade(accent, 0.2), 2);
    else eyes(ctx, r, vis.eyes, accent);
  } else if (head === "horns" || head === "antlers") {
    eyes(ctx, r, vis.eyes, accent);
    const pairs = head === "antlers" ? 3 : 1;
    for (let i = 0; i < pairs; i++) {
      const s = 0.55 + i * 0.28;
      poly(ctx, [[-r * 0.3, -r * 0.7], [-r * (0.2 + s), -r * (1.5 + i * 0.35)], [-r * 0.05, -r * 0.4]], accent, 2);
      poly(ctx, [[r * 0.3, -r * 0.7], [r * (0.2 + s), -r * (1.5 + i * 0.35)], [r * 0.05, -r * 0.4]], accent, 2);
    }
  } else if (head === "crown") {
    eyes(ctx, r, vis.eyes, accent);
    poly(ctx, [[-r, -r * 0.35], [-r * 0.7, -r * 1.35], [-r * 0.3, -r * 0.55], [0, -r * 1.6], [r * 0.3, -r * 0.55], [r * 0.7, -r * 1.35], [r, -r * 0.35]], accent, 2);
  } else if (head === "halo") {
    eyes(ctx, r, vis.eyes, accent);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.35, r * 0.85, r * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (head === "mohawk") {
    eyes(ctx, r, vis.eyes, accent);
    poly(ctx, [[-r * 0.18, -r * 0.4], [0, -r * 1.9], [r * 0.18, -r * 0.4]], accent, 2);
  } else if (head === "bun" || head === "braid") {
    eyes(ctx, r, vis.eyes, accent);
    disk(ctx, r * 0.15, -r * 1.05, r * 0.42, shade(color, -0.2));
    if (head === "braid") poly(ctx, [[r * 0.2, -r * 0.7], [r * 0.55, r * 0.9], [r * 0.15, r * 0.95]], shade(color, -0.3), 2);
  } else if (head === "beak") {
    eyes(ctx, r, "dot", accent);
    poly(ctx, [[r * 0.2, r * 0.05], [r * 1.15, r * 0.22], [r * 0.15, r * 0.42]], accent, 2);
  } else if (head === "mask" || head === "skull") {
    disk(ctx, 0, 0, r * 1.02, head === "skull" ? "#f4efe6" : shade(color, -0.45));
    eyes(ctx, r, head === "skull" ? "glow" : vis.eyes, accent);
    if (head === "skull") {
      poly(ctx, [[-r * 0.25, r * 0.35], [0, r * 0.7], [r * 0.25, r * 0.35]], shade(color, -0.5), 2);
    }
  } else if (head === "hat") {
    eyes(ctx, r, vis.eyes, accent);
    poly(ctx, [[-r * 1.3, -r * 0.15], [r * 1.3, -r * 0.15], [r * 1.15, r * 0.15], [-r * 1.15, r * 0.15]], shade(color, -0.4), 2);
    poly(ctx, [[-r * 0.55, -r * 0.15], [r * 0.55, -r * 0.15], [r * 0.35, -r * 1.15], [-r * 0.35, -r * 1.15]], shade(color, -0.25), 2);
  } else if (head === "goggles") {
    eyes(ctx, r, "wide", accent);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.05, r * 0.34, r * 0.24, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.32, -r * 0.05, r * 0.34, r * 0.24, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (head === "flames") {
    eyes(ctx, r, "glow", accent);
    poly(ctx, [[-r * 0.4, -r * 0.5], [-r * 0.1, -r * 1.7], [r * 0.15, -r * 0.7], [r * 0.45, -r * 1.45], [r * 0.2, -r * 0.4]], accent, 2);
  } else if (head === "ears") {
    eyes(ctx, r, vis.eyes, accent);
    poly(ctx, [[-r * 0.7, -r * 0.4], [-r * 1.15, -r * 1.2], [-r * 0.2, -r * 0.55]], accent, 2);
    poly(ctx, [[r * 0.7, -r * 0.4], [r * 1.15, -r * 1.2], [r * 0.2, -r * 0.55]], accent, 2);
  } else if (head === "fins") {
    eyes(ctx, r, vis.eyes, accent);
    poly(ctx, [[0, -r * 0.8], [r * 0.15, -r * 1.7], [-r * 0.15, -r * 0.9]], accent, 2);
  } else if (head === "petals") {
    eyes(ctx, r, vis.eyes, accent);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.45;
      disk(ctx, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95 - r * 0.2, r * 0.38, accent);
    }
  } else {
    eyes(ctx, r, vis.eyes, accent);
  }
  ctx.restore();
}

function blade(ctx, hand, ux, uy, len, wide, fill, edge) {
  const px = -uy;
  const py = ux;
  const x = hand[0];
  const y = hand[1];
  poly(ctx, [
    [x + px * wide, y + py * wide],
    [x - px * wide, y - py * wide],
    [x + ux * len - px * wide * 0.3, y + uy * len - py * wide * 0.3],
    [x + ux * len + px * wide * 0.3, y + uy * len + py * wide * 0.3],
  ], fill, 2);
  poly(ctx, [
    [x + ux * len - px * wide * 0.3, y + uy * len - py * wide * 0.3],
    [x + ux * len + px * wide * 0.3, y + uy * len + py * wide * 0.3],
    [x + ux * (len + wide * 2.2), y + uy * (len + wide * 2.2)],
  ], edge, 2);
}

function weapon(ctx, rig, vis, color, accent) {
  const kind = vis.weapon || "none";
  if (kind === "none") return;
  const hand = rig.leadHand;
  const shoulder = rig.leadShoulder;
  const [ux, uy] = unit(shoulder[0], shoulder[1], hand[0], hand[1]);
  const dark = shade(color, -0.35);
  if (kind === "sword" || kind === "dagger" || kind === "greatsword") {
    const len = kind === "dagger" ? 28 : kind === "greatsword" ? 78 : 52;
    const wide = kind === "greatsword" ? 7 : 3.5;
    blade(ctx, hand, ux, uy, len, wide, "#f4f1ea", accent);
  } else if (kind === "spear" || kind === "staff") {
    const len = kind === "spear" ? 92 : 70;
    poly(ctx, [
      [hand[0] - uy * 3, hand[1] + ux * 3],
      [hand[0] + uy * 3, hand[1] - ux * 3],
      [hand[0] + ux * len + uy * 2, hand[1] + uy * len - ux * 2],
      [hand[0] + ux * len - uy * 2, hand[1] + uy * len + ux * 2],
    ], kind === "spear" ? "#e7d7b8" : dark, 2);
    if (kind === "spear") blade(ctx, [hand[0] + ux * len, hand[1] + uy * len], ux, uy, 18, 5, accent, "#fff6df");
    else disk(ctx, hand[0] + ux * (len + 8), hand[1] + uy * (len + 8), 10, accent);
  } else if (kind === "scythe") {
    poly(ctx, [
      [hand[0] - uy * 3, hand[1] + ux * 3],
      [hand[0] + uy * 3, hand[1] - ux * 3],
      [hand[0] + ux * 62 + uy * 2.5, hand[1] + uy * 62 - ux * 2.5],
      [hand[0] + ux * 62 - uy * 2.5, hand[1] + uy * 62 + ux * 2.5],
    ], "#d9d0c4", 2);
    const tip = [hand[0] + ux * 62, hand[1] + uy * 62];
    poly(ctx, [
      tip,
      [tip[0] + ux * 10 - uy * 28, tip[1] + uy * 10 + ux * 28],
      [tip[0] - ux * 16 - uy * 8, tip[1] - uy * 16 + ux * 8],
    ], accent, 2);
  } else if (kind === "bow") {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hand[0] + ux * 10, hand[1] + uy * 10, 26, Math.atan2(uy, ux) - 1.2, Math.atan2(uy, ux) + 1.2);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hand[0] + ux * 10 - uy * 22, hand[1] + uy * 10 + ux * 22);
    ctx.lineTo(hand[0] + ux * 10 + uy * 22, hand[1] + uy * 10 - ux * 22);
    ctx.stroke();
  } else if (kind === "hammer") {
    poly(ctx, [
      [hand[0] - uy * 3, hand[1] + ux * 3],
      [hand[0] + uy * 3, hand[1] - ux * 3],
      [hand[0] + ux * 36 + uy * 3, hand[1] + uy * 36 - ux * 3],
      [hand[0] + ux * 36 - uy * 3, hand[1] + uy * 36 + ux * 3],
    ], "#c4b39a", 2);
    const h = [hand[0] + ux * 40, hand[1] + uy * 40];
    poly(ctx, [
      [h[0] - uy * 16 - ux * 8, h[1] + ux * 16 - uy * 8],
      [h[0] + uy * 16 - ux * 8, h[1] - ux * 16 - uy * 8],
      [h[0] + uy * 16 + ux * 10, h[1] - ux * 16 + uy * 10],
      [h[0] - uy * 16 + ux * 10, h[1] + ux * 16 + uy * 10],
    ], shade(color, -0.2), 2);
  } else if (kind === "claws") {
    for (const s of [-1, 0, 1]) {
      blade(ctx, [hand[0] + -uy * s * 6, hand[1] + ux * s * 6], ux, uy, 22, 2, "#f7f3ea", accent);
    }
  } else if (kind === "gun") {
    poly(ctx, [
      [hand[0] - uy * 4, hand[1] + ux * 4],
      [hand[0] + uy * 4, hand[1] - ux * 4],
      [hand[0] + ux * 34 + uy * 4, hand[1] + uy * 34 - ux * 4],
      [hand[0] + ux * 34 - uy * 4, hand[1] + uy * 34 + ux * 4],
    ], shade(color, -0.45), 2);
    poly(ctx, [
      [hand[0] + ux * 8, hand[1] + uy * 8],
      [hand[0] + ux * 16, hand[1] + uy * 16],
      [hand[0] + ux * 14 + uy * 10, hand[1] + uy * 14 - ux * 10],
    ], dark, 2);
  } else if (kind === "whip") {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hand[0], hand[1]);
    ctx.quadraticCurveTo(hand[0] + ux * 20 - uy * 18, hand[1] + uy * 20 + ux * 18, hand[0] + ux * 58, hand[1] + uy * 18);
    ctx.stroke();
  } else if (kind === "fans") {
    for (const s of [-1, 1]) {
      const o = s === 1 ? hand : rig.rearHand;
      poly(ctx, [
        o,
        [o[0] + ux * 18 - uy * 16 * s, o[1] + uy * 18 + ux * 16 * s],
        [o[0] + ux * 28, o[1] + uy * 28],
        [o[0] + ux * 18 + uy * 16 * s, o[1] + uy * 18 - ux * 16 * s],
      ], accent, 2);
    }
  } else if (kind === "orb") {
    disk(ctx, hand[0] + ux * 16, hand[1] + uy * 16, 11, accent);
    disk(ctx, hand[0] + ux * 16, hand[1] + uy * 16, 5, "#fffaf2");
  } else if (kind === "bell") {
    poly(ctx, [
      [hand[0] + ux * 8 - uy * 10, hand[1] + uy * 8 + ux * 10],
      [hand[0] + ux * 8 + uy * 10, hand[1] + uy * 8 - ux * 10],
      [hand[0] + ux * 28 + uy * 14, hand[1] + uy * 28 - ux * 14],
      [hand[0] + ux * 28 - uy * 14, hand[1] + uy * 28 + ux * 14],
    ], accent, 2);
    disk(ctx, hand[0] + ux * 30, hand[1] + uy * 30, 4, shade(color, -0.4));
  } else if (kind === "chain") {
    ctx.strokeStyle = shade(accent, -0.2);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hand[0], hand[1]);
    ctx.lineTo(hand[0] + ux * 46 - uy * 8, hand[1] + uy * 46 + ux * 8);
    ctx.stroke();
    disk(ctx, hand[0] + ux * 52 - uy * 8, hand[1] + uy * 52 + ux * 8, 8, shade(color, -0.3));
  } else if (kind === "shield") {
    poly(ctx, [
      [rig.rearHand[0], rig.rearHand[1] - 16],
      [rig.rearHand[0] + 18, rig.rearHand[1] - 8],
      [rig.rearHand[0] + 14, rig.rearHand[1] + 16],
      [rig.rearHand[0], rig.rearHand[1] + 22],
      [rig.rearHand[0] - 14, rig.rearHand[1] + 16],
      [rig.rearHand[0] - 18, rig.rearHand[1] - 8],
    ], accent, 2);
  } else if (kind === "axe") {
    poly(ctx, [
      [hand[0] - uy * 3, hand[1] + ux * 3],
      [hand[0] + uy * 3, hand[1] - ux * 3],
      [hand[0] + ux * 40 + uy * 3, hand[1] + uy * 40 - ux * 3],
      [hand[0] + ux * 40 - uy * 3, hand[1] + uy * 40 + ux * 3],
    ], "#cbb892", 2);
    const h = [hand[0] + ux * 40, hand[1] + uy * 40];
    poly(ctx, [h, [h[0] + ux * 8 - uy * 18, h[1] + uy * 8 + ux * 18], [h[0] - ux * 10 - uy * 6, h[1] - uy * 10 + ux * 6]], accent, 2);
  }
}

function extra(ctx, rig, vis, color, accent) {
  const kind = vis.extra || "none";
  if (kind === "none") return;
  const dark = shade(color, -0.35);
  if (kind === "wings") {
    poly(ctx, [rig.rearShoulder, [rig.rearShoulder[0] - 34, rig.rearShoulder[1] - 28], [rig.rearShoulder[0] - 10, rig.rearShoulder[1] + 8]], accent, 2);
    poly(ctx, [rig.leadShoulder, [rig.leadShoulder[0] + 28, rig.leadShoulder[1] - 36], [rig.leadShoulder[0] + 6, rig.leadShoulder[1] + 6]], shade(accent, -0.15), 2);
  } else if (kind === "cape") {
    poly(ctx, [
      rig.leadShoulder,
      rig.rearShoulder,
      [rig.rearShoulder[0] - 8, rig.hip[1] + 18],
      [rig.leadShoulder[0] - 18, rig.hip[1] + 28],
    ], dark, 2);
  } else if (kind === "tail") {
    poly(ctx, [
      rig.hip,
      [rig.hip[0] - 28, rig.hip[1] + 6],
      [rig.hip[0] - 36, rig.hip[1] - 16],
      [rig.hip[0] - 18, rig.hip[1] - 4],
    ], accent, 2);
  } else if (kind === "fins") {
    poly(ctx, [rig.rearShoulder, [rig.rearShoulder[0] - 22, rig.rearShoulder[1] - 8], [rig.rearShoulder[0] - 6, rig.rearShoulder[1] + 14]], accent, 2);
  } else if (kind === "spikes") {
    for (const p of [rig.leadShoulder, rig.rearShoulder, rig.midShoulder]) {
      poly(ctx, [[p[0] - 4, p[1]], [p[0], p[1] - 16], [p[0] + 4, p[1]]], accent, 2);
    }
  } else if (kind === "aura") {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(rig.chest[0], rig.chest[1], rig.headR * 3.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (kind === "petals") {
    disk(ctx, rig.rearShoulder[0] - 10, rig.rearShoulder[1] - 6, 7, accent);
    disk(ctx, rig.hip[0] - 12, rig.hip[1] - 8, 6, shade(accent, -0.15));
  }
}

export function drawCast(ctx, fighter, frame) {
  const vis = fighter.def.vis || {};
  const color = fighter.def.color;
  const accent = fighter.def.accent;
  drawRig(ctx, fighter, frame, (g, rig) => {
    extra(g, rig, vis, color, accent);
    weapon(g, rig, vis, color, accent);
    headgear(g, rig, vis, color, accent);
  });
}
