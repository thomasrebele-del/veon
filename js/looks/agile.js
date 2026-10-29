import { INK, disk, gloss, inkFill, lightDir, limb, layout, poly } from "../body.js";

const HAIR = {
  trick: "#3a1028",
  dancer: "#f4e2b0",
};

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

function bone(ctx, a, b, width, color) {
  limb(ctx, a[0], a[1], b[0], b[1], width, color);
}

function posed(fighter, frame) {
  if (fighter && fighter.pose && typeof fighter.pose === "object") return fighter;
  const swing = Math.sin((Number(frame) || 0) * 0.16);
  const num = (key) => (fighter && typeof fighter[key] === "number" ? fighter[key] : null);
  const arm = num("arm");
  const armY = num("armY");
  const lean = num("lean");
  const leg = num("leg");
  if (arm == null && armY == null && lean == null && leg == null) return fighter;
  return {
    def: fighter.def,
    flash: fighter.flash,
    vx: fighter.vx,
    facing: fighter.facing,
    state: fighter.state,
    move: fighter.move,
    pose: {
      arm: arm == null ? swing * 0.22 : arm,
      armY: armY == null ? 0 : armY,
      lean: lean == null ? 0 : lean,
      leg: leg == null ? -swing * 0.3 : leg,
      aim: !!fighter.aim,
      aimX: num("aimX") == null ? 1 : num("aimX"),
      aimY: num("aimY") == null ? -0.12 : num("aimY"),
      extend: num("extend") == null ? 0.75 : num("extend"),
    },
  };
}

function rigOf(fighter, frame) {
  return layout(posed(fighter, frame), frame || 0);
}

function hairColor(fighter, key) {
  return fighter.flash ? "#fff" : HAIR[key];
}

function neckEnd(rig) {
  const a = rig.midShoulder;
  const b = rig.head;
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const dist = Math.max(0, span - rig.headR * 0.82);
  return [a[0] + ((b[0] - a[0]) / span) * dist, a[1] + ((b[1] - a[1]) / span) * dist];
}

function onHead(ctx, rig, draw) {
  ctx.save();
  ctx.translate(rig.head[0], rig.head[1]);
  ctx.rotate(rig.lean || 0);
  draw(ctx, rig.headR);
  ctx.restore();
}

function shoe(ctx, knee, foot, color, h, kind) {
  const s = Math.max(4.5, h * 0.048);
  const ang = Math.atan2(foot[1] - knee[1], foot[0] - knee[0]);
  const tilt = Math.max(-0.9, Math.min(0.9, ang - Math.PI / 2));
  ctx.save();
  ctx.translate(foot[0], foot[1]);
  ctx.rotate(tilt * 0.4);
  if (kind === "point") {
    poly(ctx, [[-s * 0.35, -s * 0.2], [s * 1.35, -s * 0.45], [s * 0.7, s * 0.22], [-s * 0.3, s * 0.35]], color, 2);
  } else if (kind === "slipper") {
    poly(ctx, [[-s * 0.3, -s * 0.12], [s * 1.05, -s * 0.32], [s * 0.5, s * 0.12], [-s * 0.22, s * 0.28]], color, 2);
  } else {
    poly(ctx, [[-s * 0.5, -s * 0.62], [s * 0.7, -s * 0.5], [s * 1.05, s * 0.12], [s * 0.62, s * 0.48], [-s * 0.42, s * 0.4]], color, 2);
  }
  ctx.restore();
}

function jetFins(ctx, knee, foot, h, color, hot) {
  const dx = foot[0] - knee[0];
  const dy = foot[1] - knee[1];
  const mag = Math.hypot(dx, dy) || 1;
  const ox = dx / mag;
  const oy = dy / mag;
  const boost = hot ? 1.15 : 1;
  const fins = [
    [0.42, h * 0.13 * boost],
    [0.66, h * 0.2 * boost],
  ];
  for (const [t, len] of fins) {
    const x = knee[0] + dx * t;
    const y = knee[1] + dy * t;
    poly(ctx, [
      [x + ox * h * 0.02, y + oy * h * 0.02],
      [x - ox * h * 0.028, y - oy * h * 0.028],
      [x - len, y - len * 0.35],
    ], color, 2);
  }
}

function cape(ctx, rig, frame, fighter, outer, lining) {
  const flap = Math.sin((Number(frame) || 0) * 0.16) * rig.h * 0.045;
  const rush = Math.max(0, (fighter.vx || 0) * (fighter.facing || 1));
  const stream = Math.min(rig.h * 0.14, rush);
  const rear = rig.rearShoulder;
  const lead = rig.leadShoulder;
  const tailX = rear[0] - rig.w * 0.62 - flap - stream;
  const tailY = rig.hipY + rig.h * 0.2;
  const midY = (rear[1] + tailY) / 2;
  ctx.beginPath();
  ctx.moveTo(lead[0] - rig.w * 0.02, lead[1] + rig.h * 0.02);
  ctx.lineTo(rear[0], rear[1] + 1);
  ctx.quadraticCurveTo(tailX, midY, tailX + rig.w * 0.22, tailY);
  ctx.quadraticCurveTo(rear[0] + rig.w * 0.15, rig.hipY + rig.h * 0.02, lead[0] - rig.w * 0.08, lead[1] + rig.h * 0.07);
  ctx.closePath();
  inkFill(ctx, outer, 2, rig.h * 0.55);
  ctx.beginPath();
  ctx.moveTo(rear[0] + rig.w * 0.05, rear[1] + rig.h * 0.035);
  ctx.quadraticCurveTo(tailX + rig.w * 0.18, midY + rig.h * 0.02, tailX + rig.w * 0.34, tailY - rig.h * 0.03);
  ctx.quadraticCurveTo(rear[0] + rig.w * 0.12, rig.hipY, rear[0] + rig.w * 0.22, rear[1] + rig.h * 0.08);
  ctx.closePath();
  inkFill(ctx, lining, 2, rig.h * 0.4);
}

function backLock(ctx, rig, color) {
  const head = rig.head;
  const r = rig.headR;
  poly(ctx, [
    [head[0] - r * 0.25, head[1] - r * 0.15],
    [head[0] - r * 1.15, head[1] + r * 0.2],
    [head[0] - r * 0.72, head[1] + r * 1.05],
    [head[0] - r * 0.08, head[1] + r * 0.35],
  ], color, 2);
}

function topHat(ctx, r, dark, accent) {
  const brimY = -r * 0.62;
  const crownTop = brimY - r * 0.98;
  poly(ctx, [
    [-r * 0.5, brimY],
    [r * 0.5, brimY - r * 0.03],
    [r * 0.38, crownTop],
    [-r * 0.38, crownTop + r * 0.04],
  ], dark, 2);
  ctx.beginPath();
  ctx.ellipse(0, brimY, r * 1.68, r * 0.28, -0.05, 0, Math.PI * 2);
  inkFill(ctx, dark, 2, r * 3.2);
  ctx.beginPath();
  ctx.rect(-r * 0.48, brimY - r * 0.2, r * 0.96, r * 0.16);
  inkFill(ctx, accent, 1.5, r);
}

function cardAt(ctx, elbow, hand, accent, tint) {
  const ang = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  ctx.save();
  ctx.translate(hand[0], hand[1]);
  ctx.rotate(ang - 0.4);
  ctx.beginPath();
  ctx.rect(-4, -8, 13, 16);
  inkFill(ctx, "#fff8ea", 2, 16);
  ctx.beginPath();
  ctx.moveTo(2.2, -3.2);
  ctx.lineTo(5.4, 0.2);
  ctx.lineTo(2.2, 3.6);
  ctx.lineTo(-1, 0.2);
  ctx.closePath();
  inkFill(ctx, accent, 1.5, 7);
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.rect(0.6, -1.1, 2.6, 2.2);
  ctx.fill();
  ctx.restore();
}

function ribbon(ctx, x, y, frame, phase, color, h, lift) {
  const wave = Math.sin((Number(frame) || 0) * 0.22 + phase);
  const reach = h * 0.3;
  const c1x = x - reach * 0.65;
  const c1y = y - lift * reach * 0.55 + wave * h * 0.04;
  const ex = x - reach * (0.2 + wave * 0.15);
  const ey = y + reach * 0.72;
  const trail = () => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(c1x, c1y, ex, ey);
  };
  const [lx, ly] = lightDir(ctx);
  trail();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.stroke();
  trail();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.translate(lx * 0.55, ly * 0.55);
  trail();
  ctx.strokeStyle = "rgba(255,250,242,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function wristRibbons(ctx, hand, frame, phase, colorA, colorB, h) {
  ribbon(ctx, hand[0], hand[1], frame, phase, colorA, h, 1);
  ribbon(ctx, hand[0], hand[1], frame, phase + 2.15, colorB, h, -0.7);
}

function spun(ctx, rig, pts, color) {
  poly(ctx, pts.map(([x, y]) => rig.spin(x, y)), color, 2);
}

function limbs(ctx, rig, spec) {
  const kneeR = Math.max(2.4, rig.legW * 0.42);
  const elbowR = Math.max(2.2, rig.armW * 0.45);
  bone(ctx, rig.rearHip, rig.rearKnee, rig.legW, spec.thigh);
  bone(ctx, rig.rearKnee, rig.rearFoot, rig.legW, spec.shin);
  disk(ctx, rig.rearKnee[0], rig.rearKnee[1], kneeR, spec.thigh, 1.5);
  shoe(ctx, rig.rearKnee, rig.rearFoot, spec.shoe, rig.h, spec.shoeKind);
  if (spec.fins) jetFins(ctx, rig.rearKnee, rig.rearFoot, rig.h, spec.fin, spec.hot);

  bone(ctx, rig.rearShoulder, rig.rearElbow, rig.armW, spec.armRear);
  bone(ctx, rig.rearElbow, rig.rearHand, rig.armW, spec.armRear);
  disk(ctx, rig.rearElbow[0], rig.rearElbow[1], elbowR, spec.armRear, 1.5);
  disk(ctx, rig.rearHand[0], rig.rearHand[1], rig.handR, spec.handRear, 1.5);
  if (spec.ribbons) wristRibbons(ctx, rig.rearHand, spec.frame, 0.4, spec.ribbonA, spec.ribbonB, rig.h);

  spec.torso(ctx, rig);

  bone(ctx, rig.leadHip, rig.leadKnee, rig.legW, spec.thigh);
  bone(ctx, rig.leadKnee, rig.leadFoot, rig.legW, spec.shin);
  disk(ctx, rig.leadKnee[0], rig.leadKnee[1], kneeR, spec.thigh, 1.5);
  shoe(ctx, rig.leadKnee, rig.leadFoot, spec.shoe, rig.h, spec.shoeKind);
  if (spec.fins) jetFins(ctx, rig.leadKnee, rig.leadFoot, rig.h, spec.fin, spec.hot);

  bone(ctx, rig.midShoulder, neckEnd(rig), Math.max(3.2, rig.armW * 0.7), spec.neck);
  disk(ctx, rig.head[0], rig.head[1], rig.headR, spec.head);
  spec.face(ctx, rig);

  bone(ctx, rig.leadShoulder, rig.leadElbow, rig.armW, spec.armLead);
  bone(ctx, rig.leadElbow, rig.leadHand, rig.armW, spec.armLead);
  disk(ctx, rig.leadElbow[0], rig.leadElbow[1], elbowR, spec.armLead, 1.5);
  disk(ctx, rig.leadHand[0], rig.leadHand[1], rig.handR, spec.handLead, 1.5);
  if (spec.ribbons) wristRibbons(ctx, rig.leadHand, spec.frame, 1.7, spec.ribbonA, spec.ribbonB, rig.h);
  if (spec.card) cardAt(ctx, rig.leadElbow, rig.leadHand, spec.card, spec.cardTint);
  gloss(ctx, rig);
}

export function drawSpeed(ctx, fighter, frame) {
  const rig = rigOf(fighter, frame);
  const c = rig.colors;
  const hot = Math.abs(fighter.vx || 0) > 2.4 || (fighter.move && (fighter.move.kind === "dash" || fighter.move.kind === "up"));
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  try {
    limbs(ctx, rig, {
      thigh: c.cloth,
      shin: c.dark,
      shoe: c.shoe,
      shoeKind: "boot",
      fins: true,
      fin: c.accent,
      hot,
      armRear: c.cloth,
      armLead: c.cloth,
      handRear: c.accent,
      handLead: c.accent,
      neck: c.cloth,
      head: c.head,
      torso(ctx, rig) {
        poly(ctx, rig.torso, c.cloth, 2);
        spun(ctx, rig, [
          [-rig.w * 0.05, rig.shoulderY + rig.h * 0.055],
          [rig.w * 0.1, rig.shoulderY + rig.h * 0.048],
          [rig.w * 0.02, rig.hipY + rig.h * 0.02],
          [-rig.w * 0.03, rig.hipY + rig.h * 0.028],
        ], c.accent);
        spun(ctx, rig, [
          [-rig.w * 0.16, rig.hipY - rig.h * 0.02],
          [rig.w * 0.15, rig.hipY - rig.h * 0.024],
          [rig.w * 0.14, rig.hipY + rig.h * 0.018],
          [-rig.w * 0.15, rig.hipY + rig.h * 0.02],
        ], c.dark);
      },
      face(ctx, rig) {
        onHead(ctx, rig, (ctx, r) => {
          ctx.beginPath();
          ctx.ellipse(r * 0.18, r * 0.46, r * 0.34, r * 0.18, 0.12, 0, Math.PI * 2);
          ctx.fillStyle = c.skin;
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(r * 0.12, r * 0.02, r * 0.74, r * 0.32, -0.1, 0, Math.PI * 2);
          inkFill(ctx, c.accent, 2, r * 1.35);
          ctx.beginPath();
          ctx.ellipse(r * 0.12, r * 0.02, r * 0.5, r * 0.14, -0.1, 0, Math.PI * 2);
          ctx.fillStyle = INK;
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(r * 0.02, -r * 0.04, r * 0.22, r * 0.06, -0.25, 0, Math.PI * 2);
          ctx.fillStyle = "#fffaf2";
          ctx.fill();
          poly(ctx, [
            [-r * 0.18, -r * 0.7],
            [r * 0.05, -r * 0.76],
            [-r * 0.02, -r * 1.18],
          ], c.accent, 2);
          poly(ctx, [
            [r * 0.02, -r * 0.72],
            [r * 0.28, -r * 0.64],
            [r * 0.12, -r * 1.14],
          ], c.accent, 2);
        });
      },
    });
  } finally {
    ctx.restore();
  }
}

export function drawTrick(ctx, fighter, frame) {
  const rig = rigOf(fighter, frame);
  const c = rig.colors;
  const hair = hairColor(fighter, "trick");
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  try {
    cape(ctx, rig, frame, fighter, c.dark, c.accent);
    backLock(ctx, rig, hair);
    limbs(ctx, rig, {
      thigh: c.leg,
      shin: c.leg,
      shoe: c.shoe,
      shoeKind: "point",
      armRear: c.armRear,
      armLead: c.armLead,
      handRear: c.handRear,
      handLead: c.handLead,
      neck: c.skin,
      head: c.head,
      card: c.accent,
      cardTint: c.cloth,
      torso(ctx, rig) {
        poly(ctx, rig.torso, c.cloth, 2);
        spun(ctx, rig, [
          [-rig.w * 0.02, rig.shoulderY + rig.h * 0.03],
          [rig.w * 0.12, rig.shoulderY + rig.h * 0.02],
          [rig.w * 0.04, rig.hipY - rig.h * 0.01],
          [rig.w * 0.01, rig.shoulderY + rig.h * 0.09],
        ], c.dark);
        const clasp = rig.spin(0, rig.shoulderY + rig.h * 0.045);
        const s = Math.max(2.5, rig.h * 0.016);
        poly(ctx, [
          [clasp[0], clasp[1] - s],
          [clasp[0] + s, clasp[1]],
          [clasp[0], clasp[1] + s],
          [clasp[0] - s, clasp[1]],
        ], c.accent, 2);
      },
      face(ctx, rig) {
        onHead(ctx, rig, (ctx, r) => {
          eye(ctx, r * 0.32, r * 0.18, r);
          topHat(ctx, r, c.dark, c.accent);
        });
      },
    });
  } finally {
    ctx.restore();
  }
}

export function drawDancer(ctx, fighter, frame) {
  const rig = rigOf(fighter, frame);
  const c = rig.colors;
  const hair = hairColor(fighter, "dancer");
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  try {
    backLock(ctx, rig, hair);
    limbs(ctx, rig, {
      thigh: c.leg,
      shin: c.leg,
      shoe: c.shoe,
      shoeKind: "slipper",
      armRear: c.armRear,
      armLead: c.armLead,
      handRear: c.handRear,
      handLead: c.handLead,
      neck: c.skin,
      head: c.head,
      ribbons: true,
      ribbonA: c.accent,
      ribbonB: c.cloth,
      frame,
      torso(ctx, rig) {
        poly(ctx, rig.torso, c.cloth, 2);
        spun(ctx, rig, [
          [-rig.w * 0.18, rig.hipY - rig.h * 0.012],
          [rig.w * 0.17, rig.hipY - rig.h * 0.016],
          [rig.w * 0.16, rig.hipY + rig.h * 0.02],
          [-rig.w * 0.17, rig.hipY + rig.h * 0.018],
        ], c.accent);
        const hem = rig.h * 0.075;
        poly(ctx, [
          rig.spin(-rig.w * 0.42, rig.hipY),
          rig.spin(rig.w * 0.4, rig.hipY),
          rig.spin(rig.w * 0.3, rig.hipY + hem),
          rig.spin(-rig.w * 0.28, rig.hipY + hem),
        ], c.accent, 2);
      },
      face(ctx, rig) {
        onHead(ctx, rig, (ctx, r) => {
          disk(ctx, -r * 0.04, -r * 0.58, r * 0.48, hair);
          poly(ctx, [
            [-r * 0.08, -r * 0.4],
            [r * 0.52, -r * 0.46],
            [r * 0.32, -r * 0.2],
            [0.02 * r, -r * 0.24],
          ], hair, 2);
          disk(ctx, r * 0.1, -r * 0.74, r * 0.14, c.accent, 1.5);
          eye(ctx, r * 0.32, r * 0.2, r);
        });
      },
    });
  } finally {
    ctx.restore();
  }
}
