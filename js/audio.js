let actx = null;
let muted = false;

function ctx() {
  if (!actx) actx = new AudioContext();
  return actx;
}

export function unlock() {
  const a = ctx();
  if (a.state === "suspended") a.resume();
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function live() {
  const a = ctx();
  if (a.state !== "running") {
    if (a.state === "suspended") a.resume().catch(() => {});
    return null;
  }
  return a;
}

function tone(freq, dur, type, gain, ramp = 0) {
  if (muted) return;
  const a = live();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (ramp) o.frequency.exponentialRampToValueAtTime(Math.max(36, freq * ramp), a.currentTime + dur);
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

function noise(dur, gain, hp = 400) {
  if (muted) return;
  const a = live();
  if (!a) return;
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const g = a.createGain();
  filter.type = "highpass";
  filter.frequency.value = hp;
  g.gain.value = gain;
  src.buffer = buffer;
  src.connect(filter).connect(g).connect(a.destination);
  src.start();
}

export function sfx(name) {
  switch (name) {
    case "ui":
      return tone(660, 0.05, "triangle", 0.03, 1.4);
    case "jump":
      return tone(420, 0.12, "square", 0.035, 1.8);
    case "swing":
      tone(150, 0.04, "square", 0.04, 0.45);
      return noise(0.05, 0.09, 1800);
    case "blade":
      tone(1680, 0.045, "sawtooth", 0.022, 0.32);
      tone(840, 0.06, "triangle", 0.018, 0.48);
      return noise(0.04, 0.04, 5600);
    case "bladeH":
      tone(620, 0.1, "sawtooth", 0.03, 0.3);
      tone(110, 0.12, "square", 0.04, 0.5);
      return noise(0.09, 0.07, 1600);
    case "cut":
      tone(2100, 0.04, "triangle", 0.02, 0.28);
      return noise(0.05, 0.045, 6400);
    case "aerial":
      tone(520, 0.08, "sine", 0.03, 1.7);
      return noise(0.09, 0.06, 3400);
    case "dash":
      tone(130, 0.07, "square", 0.045, 0.55);
      return noise(0.12, 0.09, 480);
    case "heavy":
      tone(96, 0.13, "square", 0.06, 0.42);
      return noise(0.12, 0.1, 260);
    case "upsmash":
      tone(160, 0.11, "square", 0.05, 2.6);
      tone(80, 0.13, "sine", 0.04, 1.9);
      return noise(0.1, 0.08, 360);
    case "swingH":
      return noise(0.16, 0.11, 800);
    case "special":
      noise(0.08, 0.045, 1200);
      tone(320, 0.11, "triangle", 0.04, 1.95);
      return tone(480, 0.09, "sine", 0.022, 1.45);
    case "hex":
      noise(0.06, 0.04, 2200);
      tone(490, 0.09, "sine", 0.032, 1.7);
      return tone(740, 0.11, "triangle", 0.022, 1.25);
    case "shot":
      noise(0.05, 0.07, 1600);
      return tone(620, 0.15, "sawtooth", 0.04, 0.32);
    case "rise":
      tone(230, 0.2, "sine", 0.038, 3.1);
      return noise(0.16, 0.05, 980);
    case "grab":
      tone(90, 0.11, "triangle", 0.05, 0.5);
      return noise(0.1, 0.08, 220);
    case "clinch":
      tone(58, 0.09, "sine", 0.08, 0.4);
      return noise(0.08, 0.11, 140);
    case "counter":
      noise(0.035, 0.06, 2800);
      tone(640, 0.05, "square", 0.04, 1.85);
      return tone(1480, 0.09, "triangle", 0.028, 0.6);
    case "meteor":
      tone(260, 0.16, "sawtooth", 0.05, 0.16);
      tone(64, 0.14, "sine", 0.07, 0.35);
      return noise(0.14, 0.11, 150);
    case "getup":
      tone(240, 0.06, "triangle", 0.035, 1.85);
      return noise(0.05, 0.05, 1400);
    case "hit":
      tone(220, 0.08, "square", 0.07, 0.5);
      return noise(0.06, 0.14, 1000);
    case "hitH":
      tone(140, 0.16, "square", 0.09, 0.4);
      return noise(0.12, 0.22, 500);
    case "smash":
      tone(90, 0.38, "sawtooth", 0.12, 0.28);
      return noise(0.28, 0.3, 180);
    case "block":
      return tone(920, 0.06, "triangle", 0.07, 0.8);
    case "parry":
      tone(880, 0.12, "square", 0.06, 1.8);
      return tone(1320, 0.16, "triangle", 0.05, 1.4);
    case "break":
      return tone(280, 0.45, "sawtooth", 0.09, 0.2);
    case "dodge":
      return noise(0.09, 0.05, 3800);
    case "blink":
      return tone(1200, 0.16, "sine", 0.06, 0.28);
    case "crumble":
      return noise(0.45, 0.28, 140);
    case "vent":
      return noise(0.55, 0.18, 90);
    case "ko":
      tone(520, 0.55, "sawtooth", 0.08, 0.12);
      return noise(0.45, 0.26, 240);
    case "impact":
      tone(58, 0.8, "sine", 0.28, 0.45);
      return noise(0.4, 0.36, 80);
    case "tech":
      tone(540, 0.08, "triangle", 0.05, 1.6);
      return noise(0.06, 0.08, 1800);
    case "final":
      tone(196, 1.05, "square", 0.06, 1.8);
      tone(294, 1.05, "square", 0.045, 1.7);
      return tone(392, 1.2, "triangle", 0.04, 1.4);
    default:
      return undefined;
  }
}
