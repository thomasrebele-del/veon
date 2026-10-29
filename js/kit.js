export const sweet = (box, dmg, base, scale, angle) => ({ hb: box, dmg, base, scale, angle });
export const hb = (x, y, w, h) => ({ x, y, w, h });

function mv(p) {
  return {
    startup: 5, active: 4, recovery: 14,
    dmg: 6, base: 4, scale: 0.5, angle: 36,
    hb: hb(40, -44, 48, 30),
    kind: "light",
    ...p,
  };
}

export function fillKit(base) {
  const n = base.names;
  const r = base.reach ?? 1;
  const p = base.power ?? 1;
  const s = (x, y, w, h) => hb(Math.round(x * r), y, Math.round(w * r), h);
  const moves = {
    light: mv({ name: n.jab, kind: "light", startup: 3, active: 3, recovery: 8, dmg: +(4 * p).toFixed(1), base: 3, scale: 0.35, angle: 32, hb: s(34, -46, 40, 24) }),
    ftilt: mv({ name: n.ftilt, kind: "light", startup: 7, active: 4, recovery: 14, dmg: +(8 * p).toFixed(1), base: 5, scale: 0.7, angle: 28, hb: s(48, -44, 58, 28) }),
    btilt: mv({ name: n.btilt, kind: "light", startup: 8, active: 4, recovery: 16, dmg: +(9 * p).toFixed(1), base: 5.4, scale: 0.78, angle: 128, hb: s(-46, -42, 54, 30) }),
    utilt: mv({ name: n.utilt, kind: "light", startup: 6, active: 5, recovery: 12, dmg: +(7 * p).toFixed(1), base: 4.6, scale: 0.62, angle: 88, hb: s(8, -78, 56, 48) }),
    dtilt: mv({ name: n.dtilt, kind: "light", startup: 5, active: 4, recovery: 12, dmg: +(6 * p).toFixed(1), base: 3.2, scale: 0.38, angle: 10, hb: s(42, -16, 64, 22) }),
    nair: mv({ name: n.nair, kind: "aerial", startup: 4, active: 8, recovery: 12, dmg: +(7 * p).toFixed(1), base: 4, scale: 0.5, angle: 48, hb: s(0, -40, 80, 64) }),
    fair: mv({ name: n.fair, kind: "aerial", startup: 6, active: 5, recovery: 14, dmg: +(9 * p).toFixed(1), base: 5, scale: 0.68, angle: 36, hb: s(40, -40, 62, 36) }),
    bair: mv({ name: n.bair, kind: "aerial", startup: 8, active: 4, recovery: 16, dmg: +(11 * p).toFixed(1), base: 6, scale: 0.84, angle: 42, hb: s(-46, -38, 56, 32) }),
    uair: mv({ name: n.uair, kind: "aerial", startup: 5, active: 6, recovery: 13, dmg: +(8 * p).toFixed(1), base: 5, scale: 0.7, angle: 86, hb: s(6, -88, 52, 46) }),
    dair: mv({ name: n.dair, kind: "aerial", startup: 8, active: 5, recovery: 16, dmg: +(10 * p).toFixed(1), base: 5, scale: 0.66, angle: 52, hb: s(10, -8, 50, 40) }),
    heavy: mv({ name: n.smash, kind: "heavy", startup: 14, active: 5, recovery: 22, dmg: +(15 * p).toFixed(1), base: 7, scale: 1.05, angle: 40, hb: s(50, -44, 64, 36), shake: 8 }),
    usmash: mv({ name: n.usmash, kind: "heavy", startup: 12, active: 6, recovery: 24, dmg: +(14 * p).toFixed(1), base: 7.2, scale: 1.08, angle: 88, hb: s(0, -92, 70, 58), shake: 8 }),
    dsmash: mv({ name: n.dsmash, kind: "heavy", startup: 12, active: 6, recovery: 24, dmg: +(14 * p).toFixed(1), base: 6.6, scale: 0.95, angle: -78, meteor: true, hb: s(34, -4, 84, 80), shake: 9 }),
    special: mv({ name: n.neutral, kind: "special", startup: 12, active: 4, recovery: 18, dmg: +(8 * p).toFixed(1), base: 4.5, scale: 0.5, angle: 30, hb: s(36, -46, 40, 28) }),
    side: mv({ name: n.side, kind: "special", startup: 10, active: 8, recovery: 18, dmg: +(9 * p).toFixed(1), base: 5.2, scale: 0.6, angle: 26, hb: s(42, -40, 58, 36), lunge: { vx: 12, vy: 0 } }),
    downb: mv({ name: n.down, kind: "special", startup: 4, active: 18, recovery: 18, dmg: +(7 * p).toFixed(1), base: 4.4, scale: 0.5, angle: 55, hb: s(24, -42, 50, 50) }),
    up: mv({ name: n.up, kind: "up", startup: 5, active: 12, recovery: 12, dmg: +(8 * p).toFixed(1), base: 5.5, scale: 0.65, angle: 86, hb: s(8, -72, 48, 56), lunge: { vx: 2, vy: -17 } }),
    dash: mv({ name: n.dash, kind: "dash", startup: 6, active: 5, recovery: 16, dmg: +(8 * p).toFixed(1), base: 5, scale: 0.58, angle: 22, hb: s(44, -40, 52, 32), lunge: { vx: 11, vy: 0 } }),
    getup: mv({ name: n.getup, kind: "getup", startup: 3, active: 6, recovery: 16, dmg: +(7 * p).toFixed(1), base: 4.4, scale: 0.48, angle: 58, hb: s(28, -38, 74, 50) }),
    grab: mv({ name: n.grab, kind: "grab", startup: 7, active: 3, recovery: 24, dmg: +(7 * p).toFixed(1), base: 5.6, scale: 0.78, angle: 82, hb: s(34, -42, 36, 38), grab: true }),
  };
  moves.aerial = { ...moves.nair };
  if (base.counter) {
    moves.downb.counter = { dmg: +(12 * p).toFixed(1), base: 7, scale: 0.95, angle: 58 };
    moves.downb.hb = s(20, -44, 56, 56);
  }
  if (base.overlay) {
    for (const [key, patch] of Object.entries(base.overlay)) {
      moves[key] = { ...moves[key], ...patch };
      if (patch.counter === null) delete moves[key].counter;
    }
  }
  return moves;
}

export function fighter(stats, names, opts = {}) {
  const { overlay, ...kit } = opts;
  return { ...stats, moves: fillKit({ names, overlay, ...kit }) };
}
