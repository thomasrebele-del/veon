import { fighter, hb, sweet } from "./kit.js";
import { MORE } from "./roster.js";

export const MODES = [
  { id: "cpu", name: "CPU Battle", desc: "You against the machine" },
  { id: "ffa", name: "Free-for-All", desc: "Four fighters, last one standing" },
  { id: "teams", name: "Team Battle", desc: "2 vs 2, red against blue" },
  { id: "training", name: "Training", desc: "Infinite stocks vs a dummy" },
];

export const SCHEMES = [
  { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", light: "KeyC", heavy: "KeyV", special: "KeyB", shield: "ShiftLeft", grab: "KeyG" },
  { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", light: "KeyK", heavy: "KeyL", special: "Semicolon", shield: "KeyO", grab: "KeyP" },
];

export const CONTROLLERS = [
  { type: "human", scheme: 0 },
  { type: "cpu", level: 1 },
  { type: "cpu", level: 2 },
  { type: "cpu", level: 3 },
  { type: "cpu", level: 0 },
];

export const CHARACTERS = [
  fighter({
    id: "rook", name: "ROOK", archetype: "Brawler",
    blurb: "Street-forged all-rounder. Honest punches, honest results.",
    strengths: "Tilts that combo, a fireball, and a collar throw",
    weaknesses: "No single overwhelming tool",
    color: "#e8562a", accent: "#ffd23f", shape: "brawler",
    w: 44, h: 78, speed: 6, airSpeed: 5.8, jump: 14, jumps: 3, weight: 1, fall: 1,
  }, {
    jab: "Jab Rush", ftilt: "Straight", btilt: "Spinning Elbow", utilt: "Rising Hook", dtilt: "Ankle Chop",
    nair: "Chest Bump", fair: "Knee", bair: "Turning Heel", uair: "Uppercut", dair: "Drop Kick",
    smash: "Haymaker", usmash: "Arc Fist", dsmash: "Ground Sweep",
    neutral: "Ember Shot", side: "Rush Hook", down: "Anchor Brace", up: "Rising Uppercut",
    dash: "Shoulder Bash", getup: "Iron Rise", grab: "Collar Toss",
  }, {
    overlay: {
      light: { startup: 3, active: 4, recovery: 8, dmg: 4, base: 3, scale: 0.35, angle: 30, hb: hb(36, -46, 42, 26) },
      heavy: { startup: 14, active: 5, recovery: 22, dmg: 15, base: 7, scale: 1.05, angle: 38, hb: hb(44, -44, 58, 36), shake: 8, breaks: 1, sweet: sweet(hb(68, -42, 28, 24), 19, 9.2, 1.22, 42) },
      special: { startup: 12, active: 2, recovery: 18, dmg: 7, base: 4, scale: 0.45, angle: 25, hb: hb(30, -46, 20, 20), projectile: { vx: 11, vy: 0, r: 13, life: 70 } },
      up: { startup: 4, active: 14, recovery: 10, dmg: 10, base: 6, scale: 0.75, angle: 85, hb: hb(14, -70, 50, 60), lunge: { vx: 2, vy: -17 } },
      dash: { startup: 6, active: 5, recovery: 16, dmg: 9, base: 5.4, scale: 0.62, angle: 24, hb: hb(42, -40, 52, 34), lunge: { vx: 12, vy: 0 }, shake: 5 },
      getup: { startup: 3, active: 6, recovery: 16, dmg: 8, base: 4.6, scale: 0.5, angle: 58, hb: hb(30, -40, 72, 52), shake: 3 },
    },
  }),
  fighter({
    id: "gorvan", name: "GORVAN", archetype: "Heavyweight",
    blurb: "Mountain-born titan. Every swing reshapes the arena.",
    strengths: "Kill power, a meteor stomp, a command grab",
    weaknesses: "Slow, big target",
    color: "#6f8cff", accent: "#d5e4ff", shape: "heavy",
    w: 64, h: 92, speed: 4.2, airSpeed: 4.4, jump: 12.5, jumps: 3, weight: 1.4, fall: 1.15,
  }, {
    jab: "Boulder Jab", ftilt: "Ram", btilt: "Backhand", utilt: "Uprising", dtilt: "Foot Sweep",
    nair: "Crush", fair: "Club Fist", bair: "Back Club", uair: "Rising Maul", dair: "Meteor Stomp",
    smash: "Titan Hammer", usmash: "Peak Breaker", dsmash: "Quake Split",
    neutral: "Quake Slam", side: "Bear Clamp", down: "Fault Line", up: "Geyser Leap",
    dash: "Avalanche", getup: "Stone Rise", grab: "Mountain Toss",
  }, {
    reach: 1.15, power: 1.15,
    overlay: {
      light: { startup: 6, active: 4, recovery: 12, dmg: 7, base: 4, scale: 0.45, angle: 30, hb: hb(46, -52, 48, 34) },
      heavy: { startup: 22, active: 6, recovery: 30, dmg: 22, base: 9, scale: 1.25, angle: 40, hb: hb(56, -50, 72, 54), shake: 14, breaks: 2, sweet: sweet(hb(88, -48, 34, 30), 28, 11.5, 1.4, 44) },
      dair: { startup: 9, active: 7, recovery: 18, dmg: 13, base: 6, scale: 0.85, angle: -60, hb: hb(6, -8, 74, 44), meteor: true, breaks: 1, shake: 6 },
      special: { startup: 18, active: 6, recovery: 26, dmg: 16, base: 8, scale: 0.9, angle: 70, hb: hb(0, -14, 190, 36), breaks: 3, shake: 16 },
      side: { name: "Bear Clamp", grab: true, startup: 14, active: 4, recovery: 28, dmg: 14, base: 8.2, scale: 1.05, angle: 84, hb: hb(50, -50, 54, 48), lunge: { vx: 7, vy: 0 }, shake: 6 },
      up: { startup: 6, active: 12, recovery: 14, dmg: 12, base: 7, scale: 0.8, angle: 88, hb: hb(0, -90, 70, 60), lunge: { vx: 1, vy: -16 } },
      dash: { startup: 10, active: 6, recovery: 22, dmg: 14, base: 7, scale: 0.8, angle: 20, hb: hb(54, -46, 70, 46), lunge: { vx: 9, vy: 0 }, shake: 8, breaks: 1 },
      getup: { startup: 5, active: 6, recovery: 20, dmg: 12, base: 6, scale: 0.6, angle: 62, hb: hb(24, -36, 96, 64), shake: 6 },
      downb: { startup: 16, active: 6, recovery: 24, dmg: 15, base: 7, scale: 0.8, angle: 75, hb: hb(0, -12, 170, 34), breaks: 2, shake: 10 },
    },
  }),
  fighter({
    id: "zip", name: "ZIP", archetype: "Speedster",
    blurb: "Voltage courier. Gone before the bruise shows up.",
    strengths: "Speed, four jumps, a counter, a light meteor",
    weaknesses: "Light — launches early",
    color: "#3ee0b0", accent: "#e9ff9a", shape: "speed",
    w: 38, h: 70, speed: 8.6, airSpeed: 7.5, jump: 15, jumps: 4, weight: 0.75, fall: 1.1,
  }, {
    jab: "Flicker Jab", ftilt: "Spark Kick", btilt: "Reverse Heel", utilt: "Needle Upper", dtilt: "Slide Kick",
    nair: "Volt Flip", fair: "Flying Knee", bair: "Back Burst", uair: "Arc Kick", dair: "Volt Spike",
    smash: "Thunder Heel", usmash: "Storm Wheel", dsmash: "Ground Arc",
    neutral: "Spark Shot", side: "Bolt Dash", down: "Static Guard", up: "Skybolt",
    dash: "Needle Rush", getup: "Spark Up", grab: "Collar Snap",
  }, {
    reach: 0.92, power: 0.86, counter: true,
    overlay: {
      light: { startup: 2, active: 3, recovery: 6, dmg: 3, base: 2.5, scale: 0.3, angle: 35, hb: hb(32, -40, 38, 22) },
      heavy: { startup: 11, active: 4, recovery: 18, dmg: 12, base: 6, scale: 0.95, angle: 42, hb: hb(40, -36, 52, 30), shake: 6, sweet: sweet(hb(62, -30, 24, 20), 16, 8, 1.15, 50) },
      dair: { meteor: true, angle: -68, dmg: 8, base: 4.6, scale: 0.62, name: "Volt Spike" },
      special: { startup: 10, active: 2, recovery: 16, dmg: 5, base: 3, scale: 0.35, angle: 20, hb: hb(28, -40, 16, 16), projectile: { vx: 13, vy: 0, r: 10, life: 50 } },
      side: { startup: 6, active: 12, recovery: 16, dmg: 8, base: 5, scale: 0.55, angle: 30, hb: hb(24, -38, 50, 40), lunge: { vx: 18, vy: -1 } },
      up: { startup: 3, active: 12, recovery: 10, dmg: 7, base: 5, scale: 0.6, angle: 80, hb: hb(0, -60, 46, 56), lunge: { vx: 4, vy: -19 } },
      dash: { startup: 4, active: 5, recovery: 12, dmg: 6, base: 4.2, scale: 0.48, angle: 22, hb: hb(40, -36, 48, 28), lunge: { vx: 16, vy: 0 }, shake: 3 },
      downb: { name: "Static Guard", counter: { dmg: 9, base: 5.5, scale: 0.7, angle: 50 } },
    },
  }),
  fighter({
    id: "mirage", name: "MIRAGE", archetype: "Trickster",
    blurb: "Stage magician of the void. Now you see her — now you're flying.",
    strengths: "Blink mixups, a mirror counter, deceptive range",
    weaknesses: "Moves punishable if read",
    color: "#ff4f9a", accent: "#ffe38a", shape: "trick",
    w: 42, h: 76, speed: 5.6, airSpeed: 6.2, jump: 14, jumps: 3, weight: 0.9, fall: 0.85,
  }, {
    jab: "Card Flick", ftilt: "Fan Slash", btilt: "Reverse Fan", utilt: "Hat Tip", dtilt: "Low Card",
    nair: "Ribbon Twirl", fair: "Palm", bair: "Cape Snap", uair: "Lift", dair: "Curtain Drop",
    smash: "Void Palm", usmash: "Halo", dsmash: "Ring Sweep",
    neutral: "Card Throw", side: "Blink Strike", down: "Mirror", up: "Phase Rise",
    dash: "Veil Step", getup: "Card Rise", grab: "Sleeve Snare",
  }, {
    counter: true,
    overlay: {
      light: { startup: 4, active: 4, recovery: 9, dmg: 4, base: 3, scale: 0.35, angle: 28, hb: hb(52, -46, 64, 18) },
      heavy: { startup: 15, active: 5, recovery: 22, dmg: 14, base: 7.5, scale: 1.05, angle: 135, hb: hb(42, -44, 56, 44), shake: 8, sweet: sweet(hb(64, -44, 26, 26), 17, 8.6, 1.16, 128) },
      dair: { meteor: true, angle: -74, name: "Curtain Drop", dmg: 9, base: 5, scale: 0.7 },
      special: { startup: 11, active: 2, recovery: 16, dmg: 5, base: 3.2, scale: 0.36, angle: 18, hb: hb(40, -46, 18, 16), projectile: { vx: 10, vy: -0.4, r: 11, life: 64 } },
      side: { name: "Blink Strike", startup: 10, active: 5, recovery: 20, dmg: 11, base: 6, scale: 0.8, angle: 35, hb: hb(30, -44, 60, 50), teleport: 170, shake: 5, lunge: null },
      up: { startup: 8, active: 6, recovery: 14, dmg: 6, base: 5, scale: 0.5, angle: 90, hb: hb(0, -40, 80, 80), lunge: { vx: 0, vy: -20 } },
      dash: { startup: 7, active: 4, recovery: 16, dmg: 8, base: 5, scale: 0.58, angle: 32, hb: hb(36, -42, 54, 36), lunge: { vx: 13, vy: -1 }, shake: 4 },
      downb: { name: "Mirror", counter: { dmg: 13, base: 7.4, scale: 0.95, angle: 125 } },
    },
  }),
  fighter({
    id: "vesper", name: "VESPER", archetype: "Aerialist",
    blurb: "A dusk duelist who treats the blast zone like a dance floor.",
    strengths: "Meteor smash, a wing counter, three graceful jumps",
    weaknesses: "Thin hurtbox rewards, light weight",
    color: "#7ec8ff", accent: "#fff1c9", shape: "dancer",
    w: 40, h: 76, speed: 7.1, airSpeed: 7.2, jump: 14.6, jumps: 3, weight: 0.82, fall: 0.95,
  }, {
    jab: "Pinch", ftilt: "Crescent", btilt: "Turn Step", utilt: "Lift Kick", dtilt: "Sweep",
    nair: "Pirouette", fair: "Toe Point", bair: "Back Crescent", uair: "High Kick", dair: "Crescent Fall",
    smash: "Grand Jeté", usmash: "Crown Kick", dsmash: "Floor Spin",
    neutral: "Feather", side: "Wing Dash", down: "Wing Parry", up: "Ascend",
    dash: "Glide Kick", getup: "Rise", grab: "Wrist Lead",
  }, {
    reach: 1.05, power: 0.95, counter: true,
    overlay: {
      dair: { meteor: true, angle: -80, dmg: 12, base: 6.4, scale: 0.9, shake: 5, name: "Crescent Fall", hb: hb(14, 4, 46, 52) },
      fair: { angle: 32, dmg: 9, base: 5.2, scale: 0.72 },
      special: { startup: 10, active: 2, recovery: 14, dmg: 5, base: 3, scale: 0.34, hb: hb(30, -50, 16, 16), projectile: { vx: 10, vy: -1.1, r: 9, life: 55 } },
      side: { lunge: { vx: 15, vy: -3 }, dmg: 8, angle: 40 },
      downb: { name: "Wing Parry", counter: { dmg: 11, base: 6.6, scale: 0.88, angle: 70 } },
      up: { lunge: { vx: 3, vy: -18 }, dmg: 7 },
    },
  }),
  fighter({
    id: "bram", name: "BRAM", archetype: "Grappler",
    blurb: "Pit champion. If he gets a hand on you, the stock is a suggestion.",
    strengths: "Command grabs, a counter throw, heavy tosses",
    weaknesses: "Two jumps, stubby without a grab",
    color: "#c4553a", accent: "#f0d0b0", shape: "grappler",
    w: 58, h: 88, speed: 4.6, airSpeed: 4.5, jump: 13, jumps: 2, weight: 1.28, fall: 1.12,
  }, {
    jab: "Palm", ftilt: "Shove", btilt: "Back Breaker", utilt: "Scoop", dtilt: "Low Kick",
    nair: "Bear Hug Air", fair: "Lariat", bair: "Back Lariat", uair: "Press", dair: "Piledriver",
    smash: "Lariat Smash", usmash: "Scoop Slam", dsmash: "Leg Sweep",
    neutral: "Iron Clinch", side: "Running Hug", down: "Reversal", up: "Powerbomb Rise",
    dash: "Shoulder", getup: "Stand Throw", grab: "Clinch",
  }, {
    reach: 1.08, power: 1.12, counter: true,
    overlay: {
      grab: { startup: 6, active: 4, recovery: 22, dmg: 10, base: 7.2, scale: 0.95, angle: 86, hb: hb(40, -46, 44, 46) },
      special: { name: "Iron Clinch", grab: true, startup: 16, active: 4, recovery: 30, dmg: 16, base: 9, scale: 1.15, angle: 88, hb: hb(46, -48, 52, 50), shake: 8 },
      side: { name: "Running Hug", grab: true, startup: 12, active: 5, recovery: 28, dmg: 13, base: 7.6, scale: 1, angle: 78, hb: hb(48, -46, 50, 48), lunge: { vx: 10, vy: 0 } },
      dair: { meteor: true, angle: -85, grab: true, name: "Piledriver", dmg: 14, base: 6.5, scale: 0.8, hb: hb(0, 6, 58, 48) },
      downb: { name: "Reversal", counter: { dmg: 14, base: 8, scale: 1.05, angle: 90 } },
      up: { lunge: { vx: 1, vy: -15 }, dmg: 11, base: 6.5, scale: 0.8 },
    },
  }),
  fighter({
    id: "sable", name: "SABLE", archetype: "Fencer",
    blurb: "One line, perfectly drawn. The tip is the whole argument.",
    strengths: "Disjoint, tipper smash, a riposte counter, a meteor thrust",
    weaknesses: "Whiffs are long, hurtbox is narrow",
    color: "#d7c4a3", accent: "#f4f7ff", shape: "fencer",
    w: 40, h: 82, speed: 6.3, airSpeed: 6, jump: 14.2, jumps: 3, weight: 0.96, fall: 1,
  }, {
    jab: "Prick", ftilt: "Extension", btilt: "Retreat Cut", utilt: "High Line", dtilt: "Ankle Line",
    nair: "Flourish", fair: "Lunge Cut", bair: "Passing Cut", uair: "Rising Point", dair: "Falling Thrust",
    smash: "Fleche", usmash: "High Riposte", dsmash: "Low Line",
    neutral: "Advance", side: "Flèche Dash", down: "Riposte", up: "Recovering Leap",
    dash: "Pass", getup: "Rise Cut", grab: "Bind",
  }, {
    reach: 1.38, power: 1, counter: true,
    overlay: {
      heavy: { hb: hb(70, -48, 78, 22), sweet: sweet(hb(108, -48, 26, 20), 20, 9.4, 1.25, 38), dmg: 14, base: 7.2, scale: 1.08, shake: 6 },
      ftilt: { hb: hb(64, -46, 86, 18), dmg: 8, angle: 22 },
      dair: { meteor: true, angle: -76, name: "Falling Thrust", hb: hb(18, 8, 36, 70), dmg: 11, base: 5.8, scale: 0.8 },
      fair: { hb: hb(62, -42, 80, 20), angle: 30 },
      downb: { name: "Riposte", startup: 3, active: 22, recovery: 20, counter: { dmg: 16, base: 8.4, scale: 1.12, angle: 40 }, hb: hb(36, -46, 70, 28) },
      side: { lunge: { vx: 16, vy: 0 }, hb: hb(60, -46, 84, 18), dmg: 10, angle: 25 },
      special: { lunge: { vx: 8, vy: 0 }, hb: hb(54, -46, 70, 18), dmg: 8 },
    },
  }),
  fighter({
    id: "quill", name: "QUILL", archetype: "Marksman",
    blurb: "Keeps the fight at the length of an arrow, then steps in to finish.",
    strengths: "Two projectiles, a pin meteor, a draw counter",
    weaknesses: "Close range is nervous",
    color: "#8fd16a", accent: "#f6ffe0", shape: "archer",
    w: 40, h: 76, speed: 5.5, airSpeed: 5.6, jump: 14, jumps: 3, weight: 0.88, fall: 0.98,
  }, {
    jab: "Dagger", ftilt: "Kick", btilt: "Turning Kick", utilt: "Rising Shot", dtilt: "Low Kick",
    nair: "Spin", fair: "Front Kick", bair: "Back Kick", uair: "Up Kick", dair: "Pin",
    smash: "Point Blank", usmash: "Sky Draw", dsmash: "Sweep Kick",
    neutral: "Arrow", side: "Piercer", down: "Draw Guard", up: "Vault",
    dash: "Slide Shot", getup: "Kick Up", grab: "Seize",
  }, {
    reach: 1.05, power: 0.92, counter: true,
    overlay: {
      special: { startup: 13, active: 2, recovery: 18, dmg: 6, base: 3.6, scale: 0.4, angle: 18, hb: hb(34, -48, 16, 16), projectile: { vx: 14, vy: 0, r: 8, life: 80 } },
      side: { startup: 16, active: 2, recovery: 22, dmg: 10, base: 5.5, scale: 0.62, angle: 16, hb: hb(40, -46, 18, 16), projectile: { vx: 18, vy: 0, r: 7, life: 48 }, lunge: null },
      dair: { meteor: true, angle: -70, name: "Pin", dmg: 9, base: 5, scale: 0.7, hb: hb(8, 2, 36, 54) },
      downb: { name: "Draw Guard", counter: { dmg: 12, base: 6.8, scale: 0.9, angle: 35 } },
      up: { lunge: { vx: 2, vy: -17 } },
    },
  }),
  fighter({
    id: "pike", name: "PIKE", archetype: "Lancer",
    blurb: "A knight who fights from the far end of a spear.",
    strengths: "Enormous disjoint, a plunge meteor, a haft counter",
    weaknesses: "The spear is slow to bring home",
    color: "#e7e2d1", accent: "#c84b3a", shape: "lancer",
    w: 46, h: 86, speed: 5.2, airSpeed: 5, jump: 13.6, jumps: 3, weight: 1.08, fall: 1.05,
  }, {
    jab: "Jab", ftilt: "Thrust", btilt: "Butt Stroke", utilt: "Rising Haft", dtilt: "Low Thrust",
    nair: "Spin Haft", fair: "Stab", bair: "Rear Thrust", uair: "Sky Thrust", dair: "Plunge",
    smash: "Couched Lance", usmash: "Vertical", dsmash: "Sweep",
    neutral: "Javelin", side: "Charge", down: "Haft Block", up: "Pole Vault",
    dash: "Rush", getup: "Rise", grab: "Hook",
  }, {
    reach: 1.48, power: 1.05, counter: true,
    overlay: {
      heavy: { startup: 16, active: 5, recovery: 24, hb: hb(78, -48, 100, 22), sweet: sweet(hb(124, -48, 28, 18), 21, 9.6, 1.22, 36), dmg: 16, base: 7.4, scale: 1.1, shake: 7 },
      ftilt: { hb: hb(72, -46, 110, 18) },
      fair: { hb: hb(68, -42, 100, 20) },
      dair: { meteor: true, angle: -82, name: "Plunge", hb: hb(16, 10, 34, 78), dmg: 13, base: 6.2, scale: 0.86, shake: 6 },
      side: { lunge: { vx: 15, vy: 0 }, hb: hb(70, -46, 108, 20), dmg: 12, base: 6, scale: 0.75, angle: 22, shake: 5 },
      special: { startup: 14, active: 2, recovery: 20, dmg: 8, base: 4.4, scale: 0.5, angle: 20, hb: hb(50, -50, 18, 16), projectile: { vx: 13, vy: 0.2, r: 9, life: 70 } },
      downb: { name: "Haft Block", counter: { dmg: 13, base: 7.2, scale: 0.92, angle: 48 } },
      up: { lunge: { vx: 1, vy: -17 }, hb: hb(8, -80, 40, 70) },
    },
  }),
  fighter({
    id: "nyx", name: "NYX", archetype: "Hexer",
    blurb: "Floats like a bad promise. The grave pulls harder than she does.",
    strengths: "Floaty drift, a hex counter, a grave meteor, a seeking orb",
    weaknesses: "Dies early once the combo starts",
    color: "#9b7bff", accent: "#f0c8ff", shape: "witch",
    w: 42, h: 80, speed: 5.3, airSpeed: 6.4, jump: 13.4, jumps: 3, weight: 0.8, fall: 0.72,
  }, {
    jab: "Spark", ftilt: "Hex Slap", btilt: "Back Hex", utilt: "Lift", dtilt: "Ankle Hex",
    nair: "Orbit", fair: "Staff", bair: "Back Orb", uair: "Rise", dair: "Grave Pull",
    smash: "Staff Smash", usmash: "Crown", dsmash: "Circle",
    neutral: "Will-o", side: "Phase Step", down: "Hex", up: "Night Rise",
    dash: "Glide", getup: "Wake", grab: "Snare",
  }, {
    reach: 1.02, power: 0.94, counter: true,
    overlay: {
      dair: { meteor: true, angle: -78, name: "Grave Pull", dmg: 11, base: 6, scale: 0.86, hb: hb(4, 6, 64, 50), shake: 4 },
      special: { startup: 12, active: 2, recovery: 16, dmg: 6, base: 3.4, scale: 0.4, angle: 24, hb: hb(28, -56, 18, 18), projectile: { vx: 8, vy: -1.4, r: 14, life: 75 } },
      side: { name: "Phase Step", startup: 9, active: 4, recovery: 18, dmg: 8, base: 4.8, scale: 0.6, angle: 40, hb: hb(24, -44, 48, 44), teleport: 130, lunge: null, shake: 3 },
      downb: { name: "Hex", counter: { dmg: 14, base: 7.6, scale: 1, angle: 95 } },
      up: { lunge: { vx: 0, vy: -21 }, dmg: 6, hb: hb(0, -50, 70, 70) },
      nair: { hb: hb(0, -42, 92, 76), angle: 55 },
    },
  }),
  ...MORE,
];

export const STAGES = [
  {
    id: "citadel",
    name: "Sky Citadel",
    blurb: "A floating keep over a dead sunset. Two ledges crumble.",
    sky: ["#07060f", "#3a1d24", "#c46a45"],
    void: "#1a0d12",
    stageColor: "#241c33",
    stageEdge: "#ffb86b",
    ember: "#ffb15a",
    platforms: [
      { x: -460, y: 0, w: 920, h: 60, solid: true },
      { x: -330, y: -150, w: 200, h: 14, breakable: 3 },
      { x: 130, y: -150, w: 200, h: 14, breakable: 3 },
      { x: -100, y: -290, w: 200, h: 14 },
    ],
    hazards: [],
    blast: { l: -1150, r: 1150, t: -950, b: 520 },
  },
  {
    id: "forge",
    name: "Magma Forge",
    blurb: "Moving lifts and erupting vents. Watch the glow.",
    sky: ["#120806", "#4a120c", "#c2410c"],
    void: "#2a0c08",
    stageColor: "#2b1a14",
    stageEdge: "#ff5a1f",
    ember: "#ffd23f",
    platforms: [
      { x: -520, y: 0, w: 380, h: 60, solid: true },
      { x: 140, y: 0, w: 380, h: 60, solid: true },
      { x: -90, y: -120, w: 180, h: 14, move: { ax: 0, ay: 110, speed: 0.018 } },
      { x: -420, y: -230, w: 170, h: 14, breakable: 2 },
      { x: 250, y: -230, w: 170, h: 14, breakable: 2 },
    ],
    hazards: [
      { x: -380, w: 110, period: 520, offset: 0 },
      { x: 270, w: 110, period: 520, offset: 260 },
    ],
    blast: { l: -1200, r: 1200, t: -950, b: 520 },
  },
  {
    id: "drift",
    name: "Neon Drift",
    blurb: "A tiny core and drifting rafts. Pure aerial chaos.",
    sky: ["#02060c", "#062033", "#123c4a"],
    void: "#031018",
    stageColor: "#0d2533",
    stageEdge: "#3ef0ff",
    ember: "#ff4f9a",
    platforms: [
      { x: -280, y: 0, w: 560, h: 50, solid: true },
      { x: -520, y: -140, w: 160, h: 14, move: { ax: 120, ay: 0, speed: 0.012 } },
      { x: 360, y: -140, w: 160, h: 14, move: { ax: -120, ay: 0, speed: 0.012 } },
      { x: -80, y: -260, w: 160, h: 14, breakable: 2 },
    ],
    hazards: [],
    blast: { l: -1100, r: 1100, t: -900, b: 500 },
  },
  {
    id: "keel",
    name: "Sealed Keel",
    blurb: "A closed hull. Nothing passes under it, and the only lip is the top edge.",
    sky: ["#071018", "#1b3a52", "#d9c7a2"],
    void: "#0c141c",
    stageColor: "#3e4e5c",
    stageEdge: "#e4d2a6",
    ember: "#f0e2c4",
    platforms: [
      { x: -530, y: 0, w: 1060, h: 440, solid: true, sealed: true },
      { x: -170, y: -168, w: 150, h: 14 },
      { x: 40, y: -248, w: 140, h: 14 },
    ],
    hazards: [],
    blast: { l: -1200, r: 1200, t: -980, b: 520 },
  },
  {
    id: "maw",
    name: "Cannon Maw",
    blurb: "A mouth on the rim fires a beast across the deck. Jump it or meet it.",
    sky: ["#14080c", "#4a1820", "#c45a38"],
    void: "#1a0a0c",
    stageColor: "#4a3028",
    stageEdge: "#e25b3a",
    ember: "#ffb088",
    platforms: [
      { x: -470, y: 0, w: 940, h: 50, solid: true },
      { x: -140, y: -198, w: 280, h: 14 },
    ],
    hazards: [
      {
        kind: "cannon",
        period: 300,
        delay: 240,
        windup: 50,
        travel: 96,
        laneY: -68,
        mouthL: -450,
        mouthR: 450,
        exit: 1280,
      },
    ],
    blast: { l: -1180, r: 1180, t: -960, b: 520 },
  },
  {
    id: "gale",
    name: "Gale Span",
    blurb: "A high lane of wind shoves anyone who leaves the deck.",
    sky: ["#102028", "#3e6a58", "#d7efc8"],
    void: "#0c1814",
    stageColor: "#2f4a3c",
    stageEdge: "#d6f2c2",
    ember: "#cfe8ff",
    platforms: [
      { x: -500, y: 0, w: 1000, h: 46, solid: true },
      { x: -250, y: -186, w: 160, h: 14 },
      { x: 100, y: -186, w: 160, h: 14 },
    ],
    hazards: [
      { kind: "wind", x: -860, y: -250, w: 1720, h: 150, push: 2.7, period: 400 },
    ],
    blast: { l: -1180, r: 1180, t: -960, b: 500 },
  },
  {
    id: "crust",
    name: "Lava Crust",
    blurb: "Two plates trade places over the melt. Sink, and the crust bites.",
    sky: ["#1a0806", "#6a1c0c", "#e07030"],
    void: "#240c08",
    stageColor: "#3a241c",
    stageEdge: "#ff7a1a",
    ember: "#ffd23f",
    platforms: [
      { x: -520, y: -28, w: 480, h: 28, solid: true, move: { ax: 0, ay: 70, speed: 0.005, phase: -0.4 } },
      { x: 40, y: -28, w: 480, h: 28, solid: true, move: { ax: 0, ay: 70, speed: 0.005, phase: Math.PI - 0.4 } },
    ],
    hazards: [
      { kind: "lava", x: -560, y: 18, w: 1120, every: 32 },
    ],
    blast: { l: -1120, r: 1120, t: -920, b: 480 },
  },
];

function wrap(n, m) {
  const v = n % m;
  return v < 0 ? v + m : v;
}

export function hazardClock(frame, hz) {
  const kind = hz.kind || "vent";
  if (kind === "vent") {
    const t = wrap(frame + (hz.offset || 0), hz.period);
    return { kind, t, warn: t > 70 && t <= 160, hot: t > 160 && t < 200 };
  }
  if (kind === "cannon") {
    const delay = hz.delay || 0;
    const age = frame - delay;
    const period = hz.period;
    const windup = hz.windup;
    const travel = hz.travel;
    if (age < 0) {
      return {
        kind, phase: "idle", t: 0, cycle: -1, dir: 1,
        x: hz.mouthL, y: hz.laneY, from: hz.mouthL, to: hz.exit,
      };
    }
    const t = wrap(age, period);
    const cycle = Math.floor(age / period);
    const dir = cycle % 2 === 0 ? 1 : -1;
    const from = dir > 0 ? hz.mouthL : hz.mouthR;
    const to = dir > 0 ? hz.exit : -hz.exit;
    let phase = "idle";
    let x = from;
    if (t < windup) phase = "telegraph";
    else if (t < windup + travel) {
      phase = "fly";
      x = from + (to - from) * ((t - windup) / travel);
    }
    return { kind, phase, t, cycle, dir, x, y: hz.laneY, from, to };
  }
  if (kind === "wind") {
    const period = hz.period || 400;
    const span = period * 2;
    const t = wrap(frame, span);
    const dir = t < period ? 1 : -1;
    const local = t % period;
    const ease = 42;
    let strength = 1;
    if (local < ease) strength = local / ease;
    else if (local > period - ease) strength = (period - local) / ease;
    return { kind, dir, strength, push: (hz.push || 0) * dir * strength };
  }
  if (kind === "lava") {
    const every = hz.every || 32;
    return { kind, y: hz.y, tick: wrap(frame, every) === 0 };
  }
  return { kind };
}

export function character(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

export function stage(id) {
  return STAGES.find((s) => s.id === id) || STAGES[0];
}

export function preset(mode) {
  const cpu = (level) => ({ type: "cpu", level });
  const p1 = { type: "human", scheme: 0 };
  switch (mode) {
    case "cpu":
      return [
        { charId: "rook", controller: p1, team: 0 },
        { charId: "zip", controller: cpu(2), team: 1 },
      ];
    case "ffa":
      return [
        { charId: "rook", controller: p1, team: 0 },
        { charId: "gorvan", controller: cpu(2), team: 1 },
        { charId: "zip", controller: cpu(2), team: 2 },
        { charId: "mirage", controller: cpu(2), team: 3 },
      ];
    case "teams":
      return [
        { charId: "rook", controller: p1, team: 0 },
        { charId: "mirage", controller: cpu(2), team: 0 },
        { charId: "gorvan", controller: cpu(2), team: 1 },
        { charId: "zip", controller: cpu(2), team: 1 },
      ];
    default:
      return [
        { charId: "rook", controller: p1, team: 0 },
        { charId: "gorvan", controller: cpu(0), team: 1 },
      ];
  }
}

export function controlLabel(controller) {
  if (controller.type === "human") return `Player ${controller.scheme + 1}`;
  if (controller.level === 0) return "Dummy";
  return `CPU Lv ${controller.level}`;
}
