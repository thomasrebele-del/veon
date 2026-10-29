// Fighter space: feet at the origin, +x facing, +y down.
// Bones come from body.js so these three match the rest of the cast.
import { INK, anchors, disk, drawRig, limb, poly } from "../body.js";

function shade(hex, amt) {
  const raw = String(hex || "#888").replace("#", "");
  const n = parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const ch = (shift) => Math.round(((n >> shift) & 255) + (t - ((n >> shift) & 255)) * p);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function eye(ctx, x, y, r) {
  ctx.fillStyle = "#fffaf2";
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.38, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + r * 0.1, y, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function outward(joint, from, dist) {
  const dx = joint[0] - from[0];
  const dy = joint[1] - from[1];
  const mag = Math.hypot(dx, dy) || 1;
  return [joint[0] + (dx / mag) * dist, joint[1] + (dy / mag) * dist];
}

function mix(from, to, t) {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

function onHead(ctx, rig, draw) {
  ctx.save();
  ctx.translate(rig.head[0], rig.head[1]);
  ctx.rotate(rig.lean || 0);
  draw(ctx, rig.headR);
  ctx.restore();
}

function sleeve(ctx, shoulder, elbow, frac, width, cloth, accent) {
  const end = mix(shoulder, elbow, frac);
  const ang = Math.atan2(elbow[1] - shoulder[1], elbow[0] - shoulder[0]);
  const nx = Math.cos(ang + Math.PI / 2);
  const ny = Math.sin(ang + Math.PI / 2);
  poly(ctx, [
    [shoulder[0] + nx * width, shoulder[1] + ny * width],
    [shoulder[0] - nx * width, shoulder[1] - ny * width],
    [end[0] - nx * width, end[1] - ny * width],
    [end[0] + nx * width, end[1] + ny * width],
  ], cloth, 2);
  const cuff = mix(end, elbow, 0.16);
  poly(ctx, [
    [end[0] + nx * width, end[1] + ny * width],
    [end[0] - nx * width, end[1] - ny * width],
    [cuff[0] - nx * width, cuff[1] - ny * width],
    [cuff[0] + nx * width, cuff[1] + ny * width],
  ], accent, 2);
}

function band(ctx, rig, halfW, y, thick, color) {
  poly(ctx, [
    rig.spin(-halfW, y - thick),
    rig.spin(halfW, y - thick),
    rig.spin(halfW, y + thick),
    rig.spin(-halfW, y + thick),
  ], color, 2);
}

function plate(ctx, a, b, width, color) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const inset = Math.min(width * 0.35, len * 0.18);
  const ax = a[0] + ux * inset;
  const ay = a[1] + uy * inset;
  const bx = b[0] - ux * inset;
  const by = b[1] - uy * inset;
  const w = width * 0.62;
  poly(ctx, [
    [ax + nx * w, ay + ny * w],
    [ax - nx * w, ay - ny * w],
    [bx - nx * w, by - ny * w],
    [bx + nx * w, by + ny * w],
  ], color, 2);
}

function strap(ctx, a, b, width, color) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * width;
  const ny = (dx / len) * width;
  poly(ctx, [
    [a[0] + nx, a[1] + ny],
    [a[0] - nx, a[1] - ny],
    [b[0] - nx, b[1] - ny],
    [b[0] + nx, b[1] + ny],
  ], color, 2);
}

function paintOf(fighter) {
  return (hex, amt = 0) => (fighter.flash ? "#fffaf2" : amt ? shade(hex, amt) : hex);
}

function withPose(fighter) {
  if (fighter.pose && typeof fighter.pose === "object") return fighter;
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const arm = num(fighter.arm);
  const armY = num(fighter.armY);
  const lean = num(fighter.lean);
  const leg = num(fighter.leg);
  if (arm == null && armY == null && lean == null && leg == null && !fighter.aim) return fighter;
  return {
    ...fighter,
    pose: {
      arm: arm ?? 0.16,
      armY: armY ?? 0,
      lean: lean ?? 0,
      leg: leg ?? 0,
      duck: num(fighter.duck) ?? 0,
      aim: !!fighter.aim,
      aimX: num(fighter.aimX) ?? 1,
      aimY: num(fighter.aimY) ?? -0.12,
      extend: num(fighter.extend) ?? 0.75,
    },
  };
}

function wear(ctx, fighter, frame, costume) {
  const posed = withPose(fighter);
  const a = anchors(posed.def);
  drawRig(ctx, posed, frame || 0, (g, rig) => costume(g, posed, a, rig, frame || 0));
}

function armBone(ctx, shoulder, elbow, hand, width, color) {
  limb(ctx, shoulder[0], shoulder[1], elbow[0], elbow[1], width, color);
  limb(ctx, elbow[0], elbow[1], hand[0], hand[1], width, color);
}

function wrappedFist(ctx, hand, elbow, r, wrap) {
  const ang = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  ctx.save();
  ctx.translate(hand[0], hand[1]);
  ctx.rotate(ang);
  disk(ctx, 0, 0, r, wrap, 1.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.58, 0.45, 2.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0.7, 2.4);
  ctx.stroke();
  ctx.restore();
}

function gauntlet(ctx, hand, elbow, r, metal, plateColor) {
  const ang = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  ctx.save();
  ctx.translate(hand[0], hand[1]);
  ctx.rotate(ang);
  disk(ctx, 0, 0, r, metal, 2);
  poly(ctx, [
    [r * 0.05, -r * 0.48],
    [r * 0.9, -r * 0.22],
    [r * 0.72, r * 0.28],
    [r * 0.02, r * 0.4],
  ], plateColor, 1.5);
  ctx.restore();
}

function bigPalm(ctx, hand, elbow, r, skin, tape) {
  const ang = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  ctx.save();
  ctx.translate(hand[0], hand[1]);
  ctx.rotate(ang);
  disk(ctx, 0, 0, r, skin, 2);
  poly(ctx, [
    [r * 0.05, -r * 0.42],
    [r * 0.42, -r * 1.05],
    [r * 0.78, -r * 0.48],
    [r * 0.22, -r * 0.12],
  ], skin, 2);
  ctx.strokeStyle = tape;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.08, -r * 0.72);
  ctx.lineTo(-r * 0.08, r * 0.72);
  ctx.stroke();
  ctx.restore();
}

function pauldron(ctx, shoulder, dir, h, color, accent) {
  const x = shoulder[0];
  const y = shoulder[1];
  const s = h * 0.09;
  poly(ctx, [
    [x - dir * s * 0.1, y + s * 0.28],
    [x + dir * s * 1.25, y + s * 0.02],
    [x + dir * s * 0.72, y - s * 0.62],
    [x - dir * s * 0.05, y - s * 0.18],
  ], color, 2);
  poly(ctx, [
    [x + dir * s * 0.15, y + s * 0.02],
    [x + dir * s * 0.7, y - s * 0.38],
    [x + dir * s * 0.42, y + s * 0.12],
  ], accent, 1.5);
}

function kneePad(ctx, hip, knee, color, h) {
  const ang = Math.atan2(knee[1] - hip[1], knee[0] - hip[0]);
  const s = h * 0.04;
  ctx.save();
  ctx.translate(knee[0], knee[1]);
  ctx.rotate(ang);
  poly(ctx, [
    [-s * 0.7, -s * 0.85],
    [s * 0.7, -s * 0.85],
    [s * 0.55, s * 0.45],
    [-s * 0.55, s * 0.45],
  ], color, 2);
  ctx.restore();
}

function hammer(ctx, elbow, hand, len, handle, head, accent, h) {
  const dx = hand[0] - elbow[0];
  const dy = hand[1] - elbow[1];
  const mag = Math.hypot(dx, dy) || 1;
  const ux = dx / mag;
  const uy = dy / mag;
  const tip = [hand[0] + ux * len, hand[1] + uy * len];
  limb(ctx, hand[0], hand[1], tip[0], tip[1], Math.max(4, h * 0.045), handle);
  const px = -uy;
  const py = ux;
  const hw = h * 0.07;
  const hh = h * 0.15;
  poly(ctx, [
    [tip[0] + px * hh - ux * hw * 0.2, tip[1] + py * hh - uy * hw * 0.2],
    [tip[0] + px * hh + ux * hw * 1.5, tip[1] + py * hh + uy * hw * 1.5],
    [tip[0] - px * hh + ux * hw * 1.5, tip[1] - py * hh + uy * hw * 1.5],
    [tip[0] - px * hh - ux * hw * 0.2, tip[1] - py * hh - uy * hw * 0.2],
  ], head, 2);
  poly(ctx, [
    [tip[0] + px * hh * 0.28, tip[1] + py * hh * 0.28],
    [tip[0] + px * hh * 0.28 + ux * hw * 1.55, tip[1] + py * hh * 0.28 + uy * hw * 1.55],
    [tip[0] - px * hh * 0.12 + ux * hw * 1.55, tip[1] - py * hh * 0.12 + uy * hw * 1.55],
    [tip[0] - px * hh * 0.12, tip[1] - py * hh * 0.12],
  ], accent, 1.5);
}

function faceLine(ctx, r) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(r * 0.08, r * 0.46);
  ctx.lineTo(r * 0.42, r * 0.5);
  ctx.stroke();
}

function rookCostume(ctx, fighter, a, rig, frame) {
  const paint = paintOf(fighter);
  const cloth = rig.colors.cloth;
  const accent = rig.colors.accent;
  const dark = paint(fighter.def.color, -0.55);
  const hair = paint("#2c140f");
  const sL = rig.rearShoulder;
  const sR = rig.leadShoulder;
  const flare = a.w * 0.16;
  const hL = outward(rig.rearHip, rig.hip, flare);
  const hR = outward(rig.leadHip, rig.hip, flare + a.w * 0.03);
  const hem = a.h * 0.02;

  poly(ctx, [sL, sR, hR, hL], cloth, 2);
  poly(ctx, [
    [hL[0], rig.hip[1] - hem],
    [hR[0], rig.hip[1] - hem],
    [hR[0] + a.w * 0.01, rig.hip[1] + hem],
    [hL[0] - a.w * 0.01, rig.hip[1] + hem],
  ], accent, 2);
  poly(ctx, [
    [rig.chest[0] - a.w * 0.045, rig.chest[1] - a.h * 0.02],
    [rig.chest[0] + a.w * 0.08, rig.chest[1] - a.h * 0.012],
    [rig.hip[0] + a.w * 0.05, rig.hip[1] - hem],
    [rig.hip[0] - a.w * 0.02, rig.hip[1] - hem],
  ], dark, 2);
  const n = rig.midShoulder;
  poly(ctx, [
    [sL[0] + (n[0] - sL[0]) * 0.4, sL[1] + a.h * 0.005],
    [n[0] - a.w * 0.02, n[1] - a.h * 0.028],
    [n[0] + a.w * 0.1, n[1] - a.h * 0.022],
    [sR[0] - (sR[0] - n[0]) * 0.15, sR[1] + a.h * 0.008],
  ], accent, 2);
  disk(ctx, rig.chest[0] + a.w * 0.02, rig.chest[1] + a.h * 0.02, Math.max(2.2, a.h * 0.028), accent, 1.5);

  const sw = Math.max(3.2, rig.armW * 0.46);
  sleeve(ctx, sL, rig.rearElbow, 0.3, sw, cloth, accent);
  sleeve(ctx, sR, rig.leadElbow, 0.3, sw, cloth, accent);

  const fist = Math.max(rig.handR * 1.85, a.h * 0.075);
  wrappedFist(ctx, rig.rearHand, rig.rearElbow, fist, accent);
  wrappedFist(ctx, rig.leadHand, rig.leadElbow, fist, accent);

  const wave = Math.sin(frame * 0.22) * a.headR * 0.12;
  onHead(ctx, rig, (g, r) => {
    poly(g, [
      [-0.5 * r, -0.15 * r],
      [-0.78 * r, -1.05 * r],
      [-0.08 * r, -0.5 * r],
      [0.18 * r, -1.22 * r],
      [0.5 * r, -0.42 * r],
      [0.82 * r, -0.98 * r],
      [0.48 * r, -0.02 * r],
    ], hair, 2);
    poly(g, [
      [-1.02 * r, -0.5 * r],
      [1.12 * r, -0.58 * r],
      [1.02 * r, -0.16 * r],
      [-0.95 * r, -0.1 * r],
    ], accent, 2);
    poly(g, [
      [-0.72 * r, -0.34 * r],
      [-1.7 * r, -0.02 * r + wave],
      [-1.28 * r, 0.22 * r + wave * 0.4],
      [-0.5 * r, -0.12 * r],
    ], accent, 2);
    eye(g, r * 0.32, r * 0.16, r);
    faceLine(g, r);
  });
}

function gorvanCostume(ctx, fighter, a, rig) {
  const paint = paintOf(fighter);
  const cloth = rig.colors.cloth;
  const accent = rig.colors.accent;
  const skin = rig.colors.skin;
  const metal = paint(fighter.def.color, -0.22);
  const helm = paint(fighter.def.color, -0.38);
  const handle = paint("#6a432c");
  const plateW = rig.legW * 0.55;
  const armPlate = rig.armW * 0.5;

  plate(ctx, rig.rearHip, rig.rearKnee, plateW, metal);
  plate(ctx, rig.rearKnee, rig.rearFoot, plateW * 0.9, metal);
  armBone(ctx, rig.rearShoulder, rig.rearElbow, rig.rearHand, rig.armW, metal);

  const mid = rig.midShoulder;
  const hip = rig.hip;
  poly(ctx, [
    outward(rig.rearShoulder, mid, a.w * 0.16),
    outward(rig.leadShoulder, mid, a.w * 0.16),
    outward(rig.leadHip, hip, a.w * 0.22),
    outward(rig.rearHip, hip, a.w * 0.2),
  ], cloth, 2);
  band(ctx, rig, a.w * 0.34, a.hipY, a.h * 0.02, accent);
  poly(ctx, [
    [rig.chest[0] - a.w * 0.03, rig.chest[1] - a.h * 0.04],
    [rig.chest[0] + a.w * 0.05, rig.chest[1] - a.h * 0.05],
    [rig.chest[0] + a.w * 0.04, rig.hip[1] - a.h * 0.03],
    [rig.chest[0] - a.w * 0.02, rig.hip[1] - a.h * 0.025],
  ], accent, 1.5);
  disk(ctx, rig.chest[0] - a.w * 0.1, rig.chest[1] - a.h * 0.02, Math.max(1.6, a.h * 0.018), accent, 1.5);
  disk(ctx, rig.chest[0] + a.w * 0.12, rig.chest[1], Math.max(1.6, a.h * 0.018), accent, 1.5);
  disk(ctx, rig.hip[0], rig.hip[1], Math.max(2, a.h * 0.026), paint(fighter.def.color, -0.45), 1.5);

  plate(ctx, rig.leadHip, rig.leadKnee, plateW, metal);
  plate(ctx, rig.leadKnee, rig.leadFoot, plateW * 0.9, metal);
  armBone(ctx, rig.leadShoulder, rig.leadElbow, rig.leadHand, rig.armW, metal);
  const brass = paint(fighter.def.color, 0.2);
  plate(ctx, rig.rearShoulder, rig.rearElbow, armPlate, brass);
  plate(ctx, rig.leadShoulder, rig.leadElbow, armPlate, brass);

  pauldron(ctx, rig.rearShoulder, -1, a.h, helm, accent);
  pauldron(ctx, rig.leadShoulder, 1, a.h, helm, accent);

  onHead(ctx, rig, (g, r) => {
    disk(g, 0, 0, r, skin, 2);
    poly(g, [
      [-0.1 * r, -0.02 * r],
      [-1.08 * r, 0.28 * r],
      [-1.15 * r, -0.42 * r],
      [-0.42 * r, -1.08 * r],
      [0.62 * r, -1.06 * r],
      [1.1 * r, -0.22 * r],
      [0.42 * r, -0.05 * r],
    ], helm, 2);
    poly(g, [
      [-0.38 * r, -0.72 * r],
      [-1.2 * r, -1.7 * r],
      [-0.02 * r, -0.78 * r],
    ], accent, 2);
    poly(g, [
      [0.12 * r, -0.8 * r],
      [0.7 * r, -1.9 * r],
      [0.62 * r, -0.55 * r],
    ], accent, 2);
    eye(g, r * 0.38, r * 0.22, r * 0.85);
    faceLine(g, r);
  });

  const grip = Math.max(rig.handR * 1.2, a.h * 0.055);
  gauntlet(ctx, rig.rearHand, rig.rearElbow, grip, metal, accent);
  hammer(ctx, rig.leadElbow, rig.leadHand, a.h * 0.32, handle, metal, accent, a.h);
  gauntlet(ctx, rig.leadHand, rig.leadElbow, grip, metal, accent);
}

function bramCostume(ctx, fighter, a, rig) {
  const paint = paintOf(fighter);
  const cloth = rig.colors.cloth;
  const accent = rig.colors.accent;
  const skin = rig.colors.skin;
  const leather = paint(fighter.def.color, -0.35);
  const hair = paint("#2a140f");

  poly(ctx, [
    rig.rearShoulder,
    rig.leadShoulder,
    rig.spin(a.w * 0.3, a.hipY),
    rig.spin(-a.w * 0.28, a.hipY),
  ], skin, 2);
  strap(ctx, rig.rearShoulder, rig.leadHip, Math.max(2.6, a.h * 0.022), leather);
  strap(ctx, rig.leadShoulder, rig.rearHip, Math.max(2.6, a.h * 0.022), cloth);
  disk(ctx, rig.chest[0], rig.chest[1], Math.max(3, a.h * 0.04), accent, 2);
  poly(ctx, [
    rig.spin(-a.w * 0.24, a.hipY - a.h * 0.012),
    rig.spin(a.w * 0.26, a.hipY - a.h * 0.012),
    rig.spin(a.w * 0.18, a.hipY + a.h * 0.07),
    rig.spin(-a.w * 0.16, a.hipY + a.h * 0.065),
  ], cloth, 2);
  band(ctx, rig, a.w * 0.3, a.hipY, a.h * 0.016, accent);
  disk(ctx, rig.hip[0] + a.w * 0.04, rig.hip[1], Math.max(2.4, a.h * 0.032), paint(fighter.def.color, -0.25), 1.5);

  kneePad(ctx, rig.rearHip, rig.rearKnee, accent, a.h);
  kneePad(ctx, rig.leadHip, rig.leadKnee, accent, a.h);

  onHead(ctx, rig, (g, r) => {
    poly(g, [
      [-0.95 * r, 0.02 * r],
      [-0.72 * r, -1.02 * r],
      [0.28 * r, -1.12 * r],
      [0.95 * r, -0.12 * r],
      [0.35 * r, 0.08 * r],
      [-0.15 * r, 0.1 * r],
    ], hair, 2);
    g.strokeStyle = INK;
    g.lineWidth = 1.5;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(r * 0.02, -r * 0.08);
    g.lineTo(r * 0.62, -r * 0.28);
    g.stroke();
    eye(g, r * 0.34, r * 0.16, r);
    faceLine(g, r);
  });

  const palm = Math.max(rig.handR * 1.28, a.h * 0.08);
  bigPalm(ctx, rig.rearHand, rig.rearElbow, palm, skin, accent);
  bigPalm(ctx, rig.leadHand, rig.leadElbow, palm, skin, accent);
}

export function drawBrawler(ctx, fighter, frame) {
  wear(ctx, fighter, frame, rookCostume);
}

export function drawHeavy(ctx, fighter, frame) {
  wear(ctx, fighter, frame, gorvanCostume);
}

export function drawGrappler(ctx, fighter, frame) {
  wear(ctx, fighter, frame, bramCostume);
}
