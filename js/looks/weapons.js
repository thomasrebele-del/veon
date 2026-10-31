import { INK, disk, drawRig, inkFill, layout, lightDir, limb, poly } from "../body.js?v=brawl";

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
  ctx.ellipse(x, y, r * 0.42, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + r * 0.1, y, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

function crest(ctx, x, y, r, accent) {
  poly(ctx, [
    [x, y - r],
    [x + r * 0.72, y + r * 0.15],
    [x, y + r * 0.45],
    [x - r * 0.72, y + r * 0.15],
  ], accent, 2);
}

function inkPath(ctx, color, weight = 2, span = 36) {
  inkFill(ctx, color, weight, span);
}

function unit(dx, dy) {
  const mag = Math.hypot(dx, dy) || 1;
  return [dx / mag, dy / mag];
}

function forearm(rig) {
  return unit(rig.leadHand[0] - rig.leadElbow[0], rig.leadHand[1] - rig.leadElbow[1]);
}

function aimVector(rig) {
  const pose = rig.pose || {};
  if (pose.aim) {
    let x = pose.aimX == null ? 1 : pose.aimX;
    let y = pose.aimY == null ? 0 : pose.aimY;
    if (Math.hypot(x, y) < 1e-4) {
      x = 1;
      y = -0.12;
    }
    return unit(x, y);
  }
  return forearm(rig);
}

function localPoint(hx, hy, ux, uy, x, y) {
  return [hx + ux * x - uy * y, hy + uy * x + ux * y];
}

function strokeLine(ctx, x1, y1, x2, y2, color, weight = 2) {
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = weight;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, weight * 0.5);
  ctx.stroke();
}

function onHead(ctx, rig, draw) {
  ctx.save();
  ctx.translate(rig.head[0], rig.head[1]);
  ctx.rotate(rig.lean || 0);
  draw(ctx, rig.headR);
  ctx.restore();
}

function redrawEye(ctx, rig) {
  ctx.save();
  ctx.translate(rig.head[0], rig.head[1]);
  ctx.rotate(rig.lean || 0);
  eye(ctx, rig.headR * 0.32, rig.headR * 0.12, rig.headR);
  ctx.restore();
}

function leadArm(ctx, rig) {
  limb(ctx, rig.leadShoulder[0], rig.leadShoulder[1], rig.leadElbow[0], rig.leadElbow[1], rig.armW, rig.colors.armLead);
  limb(ctx, rig.leadElbow[0], rig.leadElbow[1], rig.leadHand[0], rig.leadHand[1], rig.armW, rig.colors.armLead);
}

function leadHand(ctx, rig) {
  disk(ctx, rig.leadHand[0], rig.leadHand[1], rig.handR, rig.colors.handLead, 1.5);
}

function foil(ctx, rig, accent) {
  const [ux, uy] = forearm(rig);
  const hx = rig.leadHand[0];
  const hy = rig.leadHand[1];
  const h = rig.h;
  const guard = h * 0.072;
  const blade = h * 0.98;
  const grip = Math.hypot(rig.forearm, 0) * 0.32;
  strokeLine(ctx, hx - ux * grip, hy - uy * grip, hx, hy, accent, 2);
  poly(ctx, [
    [hx + ux * guard * 0.28, hy + uy * guard * 0.28],
    [hx - uy * guard, hy + ux * guard],
    [hx - ux * guard * 0.62, hy - uy * guard * 0.62],
    [hx + uy * guard, hy - ux * guard],
  ], accent, 2);
  const x0 = hx + ux * guard * 0.22;
  const y0 = hy + uy * guard * 0.22;
  const x1 = hx + ux * blade;
  const y1 = hy + uy * blade;
  strokeLine(ctx, x0, y0, x1, y1, accent, 2);
  poly(ctx, [
    [x1, y1],
    [x1 - ux * h * 0.055 - uy * h * 0.028, y1 - uy * h * 0.055 + ux * h * 0.028],
    [x1 - ux * h * 0.055 + uy * h * 0.028, y1 - uy * h * 0.055 - ux * h * 0.028],
  ], accent, 2);
}

function drawBow(ctx, rig, accent, dark) {
  const pose = rig.pose || {};
  const loose = !!(pose.aim && !pose.wind && (pose.extend || 0) > 0.58);
  const [ux, uy] = aimVector(rig);
  const hx = rig.leadHand[0];
  const hy = rig.leadHand[1];
  const h = rig.h;
  const r = h * 0.34;
  const pull = loose ? h * 0.045 : pose.wind || (pose.aim && (pose.extend || 0) < 0.4) ? h * 0.2 : h * 0.11;
  const a0 = -1.18;
  const a1 = 1.18;
  ctx.beginPath();
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    const [x, y] = localPoint(hx, hy, ux, uy, Math.cos(a) * r, Math.sin(a) * r);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 4;
  ctx.stroke();
  const [litX, litY] = lightDir(ctx);
  ctx.save();
  ctx.translate(litX * 0.8, litY * 0.8);
  ctx.strokeStyle = "rgba(255,250,242,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  const [x1, y1] = localPoint(hx, hy, ux, uy, Math.cos(a0) * r, Math.sin(a0) * r);
  const [x2, y2] = localPoint(hx, hy, ux, uy, Math.cos(a1) * r, Math.sin(a1) * r);
  const [nx, ny] = localPoint(hx, hy, ux, uy, -pull, 0);
  strokeLine(ctx, x1, y1, nx, ny, accent, 2);
  strokeLine(ctx, nx, ny, x2, y2, accent, 2);
  if (!loose) {
    const reach = h * 0.5;
    const [tx, ty] = localPoint(hx, hy, ux, uy, reach, 0);
    strokeLine(ctx, nx, ny, tx, ty, accent, 2);
    const head = h * 0.08;
    const [px, py] = localPoint(hx, hy, ux, uy, reach + head, 0);
    const [lx, ly] = localPoint(hx, hy, ux, uy, reach - head * 0.15, head * 0.42);
    const [rx, ry] = localPoint(hx, hy, ux, uy, reach - head * 0.15, -head * 0.42);
    poly(ctx, [[px, py], [lx, ly], [rx, ry]], accent, 2);
    const [f1, g1] = localPoint(hx, hy, ux, uy, -pull, 0);
    const [f2, g2] = localPoint(hx, hy, ux, uy, -pull + head * 0.2, head * 0.4);
    const [f3, g3] = localPoint(hx, hy, ux, uy, -pull - head * 0.55, head * 0.16);
    poly(ctx, [[f1, g1], [f2, g2], [f3, g3]], accent, 2);
    const [b2, c2] = localPoint(hx, hy, ux, uy, -pull + head * 0.2, -head * 0.4);
    const [b3, c3] = localPoint(hx, hy, ux, uy, -pull - head * 0.55, -head * 0.16);
    poly(ctx, [[f1, g1], [b2, c2], [b3, c3]], accent, 2);
  }
}

function spear(ctx, rig, shaft, accent) {
  const [ux, uy] = forearm(rig);
  const hx = rig.leadHand[0];
  const hy = rig.leadHand[1];
  const h = rig.h;
  const len = h * 1.15;
  const head = h * 0.2;
  const tipX = hx + ux * len;
  const tipY = hy + uy * len;
  const neckX = hx + ux * (len - head);
  const neckY = hy + uy * (len - head);
  limb(ctx, hx, hy, neckX, neckY, 4, shaft);
  const gx = h * 0.055;
  limb(ctx, hx - uy * gx, hy + ux * gx, hx + uy * gx, hy - ux * gx, 3.2, accent);
  poly(ctx, [
    [tipX, tipY],
    [neckX - uy * h * 0.058, neckY + ux * h * 0.058],
    [neckX + uy * h * 0.058, neckY - ux * h * 0.058],
  ], accent, 2);
  poly(ctx, [
    [neckX - ux * h * 0.02, neckY - uy * h * 0.02],
    [neckX + ux * h * 0.015 - uy * h * 0.03, neckY + uy * h * 0.015 + ux * h * 0.03],
    [neckX + ux * h * 0.015 + uy * h * 0.03, neckY + uy * h * 0.015 - ux * h * 0.03],
  ], accent, 2);
}

function staff(ctx, rig, dark, accent, frame) {
  const [ux, uy] = forearm(rig);
  const hx = rig.leadHand[0];
  const hy = rig.leadHand[1];
  const h = rig.h;
  const len = h * 0.7;
  const butt = h * 0.045;
  const tipX = hx + ux * len;
  const tipY = hy + uy * len;
  limb(ctx, hx - ux * butt, hy - uy * butt, tipX, tipY, 4, dark);
  const wrap = h * 0.04;
  limb(ctx, hx - ux * wrap, hy - uy * wrap, hx + ux * wrap * 0.35, hy + uy * wrap * 0.35, 5, accent);
  const orb = h * 0.078 + Math.sin((frame || 0) * 0.3) * 1.1;
  disk(ctx, tipX, tipY, orb, accent, 2);
  ctx.beginPath();
  ctx.arc(tipX, tipY, orb + h * 0.045, 0.55, 5.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  disk(ctx, tipX - ux * orb * 0.28 + uy * orb * 0.22, tipY - uy * orb * 0.28 - ux * orb * 0.22, orb * 0.28, "#fffaf2", 0);
}

function tailCoat(ctx, rig, frame) {
  const s = rig.rearShoulder;
  const wag = Math.sin((frame || 0) * 0.18) * 4;
  ctx.beginPath();
  ctx.moveTo(s[0] + 2, s[1] + 4);
  ctx.lineTo(s[0] - rig.w * 0.55, rig.hipY + 8 + wag);
  ctx.lineTo(rig.hip[0] - rig.w * 0.02, rig.hipY + 2);
  ctx.closePath();
  inkPath(ctx, rig.colors.dark, 2, rig.h * 0.48);
}

function cloak(ctx, rig, frame) {
  const s = rig.rearShoulder;
  const wag = Math.sin((frame || 0) * 0.16) * 5;
  ctx.beginPath();
  ctx.moveTo(s[0] + 2, s[1] + 2);
  ctx.quadraticCurveTo(s[0] - rig.w * 0.9, rig.hipY + wag, s[0] - rig.w * 0.08, rig.hipY + rig.thigh * 0.85);
  ctx.lineTo(s[0] + 8, s[1] + 10);
  ctx.closePath();
  inkPath(ctx, rig.colors.dark, 2, rig.h * 0.48);
}

function cape(ctx, rig, frame) {
  const s = rig.rearShoulder;
  const wag = Math.sin((frame || 0) * 0.14) * 4;
  ctx.beginPath();
  ctx.moveTo(s[0] + 1, s[1] + 3);
  ctx.quadraticCurveTo(s[0] - rig.w * 0.7, rig.hipY + 6, s[0] - rig.w * 0.16, rig.hipY + rig.h * 0.16 + wag);
  ctx.lineTo(s[0] + 6, s[1] + 8);
  ctx.closePath();
  inkPath(ctx, rig.colors.accent, 2, rig.h * 0.42);
}

export function drawFencer(ctx, fighter, frame) {
  frame = frame || 0;
  const rig0 = layout(fighter, frame);
  tailCoat(ctx, rig0, frame);
  drawRig(ctx, fighter, frame, (ctx, rig) => {
    const { accent } = rig.colors;
    const hair = fighter.flash ? "#fffaf2" : "#6a4a32";
    poly(ctx, [
      rig.spin(-rig.w * 0.05, rig.hipY - 2),
      rig.spin(rig.w * 0.07, rig.hipY - 4),
      rig.spin(rig.w * 0.035, rig.shoulderY + rig.h * 0.07),
      rig.spin(-rig.w * 0.04, rig.shoulderY + rig.h * 0.065),
    ], accent, 2);
    ctx.beginPath();
    ctx.moveTo(rig.head[0] - rig.headR * 0.2, rig.head[1] - rig.headR * 0.05);
    ctx.quadraticCurveTo(
      rig.head[0] - rig.w * 0.85,
      rig.head[1] + 6,
      rig.rearShoulder[0] - 4,
      rig.rearShoulder[1] + rig.h * 0.16 + Math.sin(frame * 0.2) * 3,
    );
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.strokeStyle = hair;
    ctx.lineWidth = 2;
    ctx.stroke();
    const [litX, litY] = lightDir(ctx);
    ctx.save();
    ctx.translate(litX * 0.45, litY * 0.45);
    ctx.strokeStyle = "rgba(255,250,242,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    onHead(ctx, rig, (ctx, r) => {
      poly(ctx, [
        [-r * 0.15, -r * 0.55],
        [r * 1.2, -r * 0.7],
        [r * 1.05, r * 0.42],
        [-r * 0.05, r * 0.36],
      ], accent, 2);
      ctx.beginPath();
      ctx.moveTo(-r * 0.05, -r * 0.08);
      ctx.lineTo(r * 0.95, -r * 0.16);
      ctx.moveTo(0, r * 0.16);
      ctx.lineTo(r * 0.9, r * 0.08);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    leadArm(ctx, rig);
    foil(ctx, rig, accent);
    leadHand(ctx, rig);
  });
}

export function drawArcher(ctx, fighter, frame) {
  frame = frame || 0;
  const rig0 = layout(fighter, frame);
  cloak(ctx, rig0, frame);
  drawRig(ctx, fighter, frame, (ctx, rig) => {
    const { accent, cloth, dark } = rig.colors;
    const strap = rig.spin(-rig.w * 0.1, rig.hipY + 4);
    ctx.beginPath();
    ctx.moveTo(rig.rearShoulder[0] + 1, rig.rearShoulder[1] + 4);
    ctx.lineTo(strap[0], strap[1]);
    ctx.moveTo(rig.midShoulder[0], rig.midShoulder[1] + 3);
    ctx.lineTo(rig.chest[0] - 2, rig.chest[1] + 6);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    const quiver = rig.rearShoulder;
    poly(ctx, [
      [quiver[0] - rig.w * 0.02, quiver[1] + 4],
      [quiver[0] - rig.w * 0.16, quiver[1] + rig.h * 0.16],
      [quiver[0] + rig.w * 0.08, quiver[1] + rig.h * 0.15],
      [quiver[0] + rig.w * 0.1, quiver[1] + 2],
    ], dark, 2);
    ctx.beginPath();
    ctx.moveTo(quiver[0] + 1, quiver[1] + 2);
    ctx.lineTo(quiver[0] - 1, quiver[1] - rig.h * 0.07);
    ctx.moveTo(quiver[0] + 5, quiver[1] + 1);
    ctx.lineTo(quiver[0] + 4, quiver[1] - rig.h * 0.09);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    onHead(ctx, rig, (ctx, r) => {
      poly(ctx, [
        [-r * 0.05, r * 0.45],
        [-r * 1.35, r * 0.2],
        [-r * 1.15, -r * 1.2],
        [r * 0.25, -r * 1.28],
        [r * 0.85, -r * 0.2],
        [r * 0.1, r * 0.02],
      ], dark, 2);
    });
    redrawEye(ctx, rig);
    leadArm(ctx, rig);
    drawBow(ctx, rig, accent, fighter.flash ? "#fffaf2" : shade(cloth, -0.48));
    leadHand(ctx, rig);
  });
}

export function drawLancer(ctx, fighter, frame) {
  frame = frame || 0;
  const rig0 = layout(fighter, frame);
  cape(ctx, rig0, frame);
  drawRig(ctx, fighter, frame, (ctx, rig) => {
    const { accent, cloth } = rig.colors;
    poly(ctx, [
      rig.spin(-rig.w * 0.045, rig.hipY + 1),
      rig.spin(rig.w * 0.07, rig.hipY - 1),
      rig.spin(rig.w * 0.04, rig.shoulderY + rig.h * 0.05),
      rig.spin(-rig.w * 0.03, rig.shoulderY + rig.h * 0.055),
    ], accent, 2);
    disk(ctx, rig.leadShoulder[0], rig.leadShoulder[1], rig.h * 0.04, accent, 1.5);
    disk(ctx, rig.rearShoulder[0], rig.rearShoulder[1], rig.h * 0.034, shade(cloth, -0.2), 1.5);
    onHead(ctx, rig, (ctx, r) => {
      crest(ctx, r * 0.05, -r * 0.72, r * 0.78, accent);
      ctx.fillStyle = accent;
      ctx.fillRect(-r * 0.55, -r * 0.02, r * 1.25, Math.max(3, r * 0.28));
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeRect(-r * 0.55, -r * 0.02, r * 1.25, Math.max(3, r * 0.28));
    });
    redrawEye(ctx, rig);
    leadArm(ctx, rig);
    spear(ctx, rig, fighter.flash ? "#fffaf2" : shade(cloth, -0.55), accent);
    leadHand(ctx, rig);
  });
}

export function drawWitch(ctx, fighter, frame) {
  frame = frame || 0;
  const hover = Math.sin(frame * 0.12) * 3;
  ctx.save();
  ctx.translate(0, hover);
  drawRig(ctx, fighter, frame, (ctx, rig) => {
    const { accent, dark } = rig.colors;
    const hair = fighter.flash ? "#fffaf2" : "#241433";
    poly(ctx, [
      rig.spin(-rig.w * 0.2, rig.hipY - 1),
      rig.spin(rig.w * 0.18, rig.hipY - 2),
      rig.spin(rig.w * 0.34, rig.hipY + rig.h * 0.075),
      rig.spin(-rig.w * 0.36, rig.hipY + rig.h * 0.08),
    ], dark, 2);
    crest(ctx, rig.chest[0], rig.chest[1], rig.h * 0.045, accent);
    ctx.beginPath();
    ctx.moveTo(rig.head[0] - rig.headR * 0.35, rig.head[1] + rig.headR * 0.1);
    ctx.quadraticCurveTo(
      rig.head[0] - rig.w * 0.55,
      rig.head[1] + rig.h * 0.12,
      rig.rearShoulder[0],
      rig.rearShoulder[1] + 4,
    );
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.strokeStyle = hair;
    ctx.lineWidth = 2;
    ctx.stroke();
    const [litX, litY] = lightDir(ctx);
    ctx.save();
    ctx.translate(litX * 0.45, litY * 0.45);
    ctx.strokeStyle = "rgba(255,250,242,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    onHead(ctx, rig, (ctx, r) => {
      const brim = -r * 0.42;
      ctx.beginPath();
      ctx.ellipse(0, brim, r * 2.15, r * 0.34, -0.05, 0, Math.PI * 2);
      inkFill(ctx, dark, 2, r * 2.6);
      poly(ctx, [
        [-r * 0.72, brim + r * 0.02],
        [r * 0.62, brim - r * 0.02],
        [r * 0.08, brim - r * 2.15],
      ], dark, 2);
      ctx.fillStyle = accent;
      ctx.fillRect(-r * 0.7, brim - r * 0.16, r * 1.35, Math.max(3, r * 0.22));
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeRect(-r * 0.7, brim - r * 0.16, r * 1.35, Math.max(3, r * 0.22));
      disk(ctx, r * 0.05, brim - r * 2.15, r * 0.16, accent, 1.5);
    });
    redrawEye(ctx, rig);
    leadArm(ctx, rig);
    staff(ctx, rig, fighter.flash ? "#fffaf2" : shade(fighter.def.color, -0.62), accent, frame);
    leadHand(ctx, rig);
  });
  ctx.restore();
}
