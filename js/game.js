import { SCHEMES, character, hazardClock, stage } from "./data.js?v=sol";
import { sfx, toggleMute } from "./audio.js";
import { drawWorld } from "./render.js?v=brawl";
import { NET_DELAY, packInput, unpackInput } from "./net.js?v=meet";

const GRAV = 0.62;
const SHIELD_MAX = 70;

function emptyInput() {
  return {
    left: false, right: false, up: false, down: false,
    shield: false, shieldPressed: false, jump: false,
    light: false, heavy: false, heavyHeld: false, special: false, grab: false, grabHeld: false,
  };
}

function attackVoice(f, m) {
  if (m.projectile) return "shot";
  if (m.meteor || m === f.def.moves.dsmash) return "meteor";
  if (m.counter) return "counter";
  if (m.grab || m.kind === "grab") return "grab";
  const upSmash = m === f.def.moves.usmash || (m.kind === "heavy" && m.angle >= 80);
  if (upSmash) return "upsmash";
  const shape = f.def.shape;
  const blade = shape === "fencer" || shape === "lancer";
  if (m.kind === "heavy") return (f.attackPower || 1) > 1.28 ? "smash" : (blade ? "bladeH" : "heavy");
  if (blade && m.kind === "light") return "blade";
  if (blade && m.kind === "aerial") return "cut";
  if ((shape === "witch" || shape === "trick") && m.kind === "light") return "hex";
  switch (m.kind) {
    case "dash": return "dash";
    case "aerial": return "aerial";
    case "special": return "special";
    case "up": return "rise";
    case "getup": return "getup";
    case "light": return "swing";
    default: return "swing";
  }
}

export class Game {
  constructor(canvas, cfg, onEnd, onPause) {
    this.canvas = canvas;
    this.cfg = cfg;
    this.onEnd = onEnd;
    this.onPause = onPause || (() => {});
    this.ctx = canvas.getContext("2d");
    this.arena = stage(cfg.arenaId);
    this.plats = this.arena.platforms.map((p) => ({
      x: p.x, y: p.y, w: p.w, h: p.h,
      solid: !!p.solid,
      bx: p.x, by: p.y,
      move: p.move || null,
      hp: p.breakable || 0,
      maxHp: p.breakable || 0,
      gone: 0, dx: 0, dy: 0, crack: 0,
    }));
    this.fighters = [];
    this.projs = [];
    this.parts = [];
    this.pops = [];
    this.keys = {};
    this.frame = 0;
    this.hitstop = 0;
    this.shake = 0;
    this.punch = 0;
    this.flashWhite = 0;
    this.chroma = 0;
    this.bars = 0;
    this.cam = { x: 0, y: -180, z: 0.42 };
    this.cine = null;
    this.banner = { text: "VEON", sub: this.arena.name, life: 64, max: 64, color: "#f2d48a" };
    this.hitCard = null;
    this.intro = 210;
    this.endLag = 0;
    this.over = false;
    this.running = true;
    this.paused = false;
    this.error = "";
    this.hud = true;
    this.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
    this.acc = 0;
    this.last = performance.now();
    const n = cfg.slots.length;
    cfg.slots.forEach((slot, i) => {
      const def = character(slot.charId);
      const x = n === 1 ? 0 : -280 + (560 * i) / (n - 1);
      this.fighters.push(this.makeFighter(i, def, slot, x));
    });
    this.kd = (e) => this.onKey(e, true);
    this.ku = (e) => { this.keys[e.code] = false; };
    this.blur = () => { this.keys = {}; };
    window.addEventListener("keydown", this.kd);
    window.addEventListener("keyup", this.ku);
    window.addEventListener("blur", this.blur);
    if (cfg.boost) this._q = 1;
    if (cfg.online) {
      cfg.online.delay = cfg.online.delay || NET_DELAY;
      this.pauseAt = 0;
      this.linkWait = 0;
      this._remoteSums = {};
      for (let f = 1; f <= cfg.online.delay; f++) {
        if (!cfg.online.localBox.has(f)) {
          const bits = this._q ? 0x100000 : 0;
          cfg.online.localBox.set(f, bits);
          cfg.online.send(f, bits);
        }
      }
    } else if (this._q) {
      for (const f of this.fighters) if (f.ctrl?.type === "human") f._q = 1;
    }
    if (this._q) this.note = 180;
    this.raf = requestAnimationFrame(this.loop);
  }

  makeFighter(slot, def, src, x) {
    return {
      slot, def,
      ctrl: src.controller,
      team: this.cfg.teams ? src.team : slot,
      x, y: -12, vx: 0, vy: 0,
      facing: x > 0 ? -1 : 1,
      dmg: 0,
      stocks: this.cfg.training ? 99 : this.cfg.stocks,
      jumps: def.jumps,
      grounded: false,
      platform: null,
      state: "idle",
      move: null,
      mf: 0,
      hitSet: new Set(),
      usedUp: false,
      airDodged: false,
      airStall: false,
      hitstun: 0,
      inv: 0,
      shieldHp: SHIELD_MAX,
      lastHitBy: -1,
      lastHitT: -9999,
      lastMove: "",
      lastKind: "",
      respawn: 0,
      trail: [],
      dodgeT: 0,
      flash: 0,
      kos: 0,
      falls: 0,
      dealt: 0,
      dropT: 0,
      parry: 0,
      techBuf: 0,
      charge: 0,
      chargeKind: "heavy",
      doomed: false,
      holding: -1,
      heldBy: -1,
      holdT: 0,
      chargeHold: 0,
      attackPower: 1,
      landLag: 0,
      mute: 0,
      hop: false,
      hopT: 0,
      ledgeT: 0,
      ledgePlat: null,
      ledgeSide: 0,
      ledgeLock: 0,
      combo: 0,
      comboAt: -999,
      buf: null,
      aiT: 10 + slot * 7,
      prev: {},
      quiet: false,
    };
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.kd);
    window.removeEventListener("keyup", this.ku);
    window.removeEventListener("blur", this.blur);
  }

  onKey(e, down) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    this.keys[e.code] = down;
    if (!down || e.repeat) return;
    if (e.code === "Escape") {
      if (this.cine) { this.finish(); return; }
      if (this.cfg.training) { this.finish(); return; }
      if (this.cfg.online) {
        if (this.paused) {
          this.applyNetPause(0);
          this.cfg.online.sendPause(0);
        } else {
          const at = this.frame + this.cfg.online.delay + 1;
          this.pauseAt = at;
          this.cfg.online.sendPause(at);
        }
        return;
      }
      this.paused = !this.paused;
      this.onPause(this.paused);
    } else if (e.code === "Enter" && this.paused) {
      this.paused = false;
      this.onPause(false);
    } else if (e.code === "KeyM") {
      const off = toggleMute();
      this.banner = { text: off ? "MUTED" : "SOUND ON", sub: "", life: 30, max: 30, color: "#f2d48a" };
    } else if (e.code === "KeyR" && this.cfg.training) {
      this.resetDummy();
    }
  }

  armBoost() {
    this._q = 1;
    this.note = 180;
    if (!this.cfg.online) {
      for (const f of this.fighters) if (f.ctrl?.type === "human") f._q = 1;
    }
  }

  resetDummy() {
    const dummy = this.fighters.find((f) => f.ctrl.type === "cpu" && f.ctrl.level === 0);
    if (!dummy) return;
    dummy.dmg = 0;
    dummy.vx = 0;
    dummy.vy = 0;
    dummy.state = "idle";
    dummy.x = 160;
    dummy.y = -20;
    dummy.hitstun = 0;
  }

  loop = (now) => {
    if (!this.running) return;
    const dt = Math.min(100, now - this.last);
    this.last = now;
    if (!this.paused) {
      this.acc += dt;
      const step = 1000 / 60;
      let guard = 0;
      while (this.acc >= step && guard++ < 5) {
        if (this.cfg.online && !this.readyNet()) {
          this.acc = Math.min(this.acc, step);
          this.linkWait = (this.linkWait || 0) + 1;
          if (this.linkWait === 45) this.banner = { text: "LINK", sub: "Waiting for the other player", life: 40, max: 40, color: "#9ad7ff" };
          break;
        }
        this.linkWait = 0;
        this.acc -= step;
        try { this.tick(); }
        catch (err) {
          console.error(err);
          this.error = err.stack || err.message;
          this.paused = true;
          break;
        }
      }
    }
    if (!this.running) return;
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  tick() {
    if (this.pauseAt && this.frame + 1 >= this.pauseAt) {
      this.paused = true;
      this.pauseAt = 0;
      this.onPause(true);
      return;
    }
    this.frame++;
    if (this.endLag > 0) {
      this.endLag--;
      if (this.endLag <= 0) this.finish();
      return;
    }
    if (this.banner) {
      this.banner.life--;
      if (this.banner.life <= 0) this.banner = null;
    }
    if (this.note > 0) this.note--;
    if (this.hitCard) {
      this.hitCard.life--;
      if (this.hitCard.life <= 0) this.hitCard = null;
    }
    if (this.intro > 0) {
      const marks = { 180: "3", 140: "2", 100: "1", 60: "FIGHT" };
      if (marks[this.intro]) {
        this.banner = {
          text: marks[this.intro],
          sub: marks[this.intro] === "FIGHT" ? this.arena.name : "READY",
          life: 34,
          max: 34,
          color: "#f2d48a",
        };
        if (marks[this.intro] === "FIGHT") sfx("impact");
        else sfx("ui");
      }
      this.intro--;
    }
    const barTarget = this.cine || this.intro > 40 ? 1 : 0;
    this.bars += (barTarget - this.bars) * 0.08;

    this._spawned = 0;
    if (this.cine) return this.tickCine();
    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }
    this.simulate(false);
    const online = this.cfg.online;
    if (online && this.frame % 90 === 0) {
      const sum = this.checksum();
      this._localSums = this._localSums || {};
      this._localSums[this.frame] = sum;
      if (this._remoteSums[this.frame] && this._remoteSums[this.frame] !== sum) {
        this.error = "The match drifted. Rematch to line back up.";
      }
      online.sendSum(this.frame, sum);
      if (this.frame % 180 === 0) {
        for (const box of [online.localBox, online.remoteBox]) {
          for (const key of box.keys()) if (key < this.frame - 40) box.delete(key);
        }
      }
    }
  }

  tickCine() {
    const c = this.cine;
    c.t++;
    const victim = this.fighters[c.victim];
    if (c.koT < 0) {
      if (c.t < 100) {
        if (c.t % 4 === 0) this.simulate(true);
        else this.stepFx();
      } else this.simulate(true);
      if (victim.state === "dead") c.koT = c.t;
      else if (victim.grounded && victim.hitstun <= 0 && c.t > 24) {
        victim.doomed = false;
        this.cine = null;
      } else if (c.t > 300) {
        victim.doomed = false;
        this.cine = null;
      }
    } else {
      this.stepFx();
      if (c.t === c.koT + 10 && !c.announced) {
        c.announced = true;
        sfx("final");
        this.shake = 24;
        this.flashWhite = 0.95;
        this._spawned = 0;
        this.burst(c.x, c.y, "#fff", 50, 12);
        this.ring(c.x, c.y, "#f2d48a", 160);
      }
      if (c.t > c.koT + 168) this.finish();
    }
  }

  simulate(frozen) {
    for (const p of this.plats) {
      if (p.move) {
        const t = Math.sin(this.frame * p.move.speed + (p.move.phase || 0));
        const nx = p.bx + p.move.ax * t;
        const ny = p.by + p.move.ay * t;
        p.dx = nx - p.x;
        p.dy = ny - p.y;
        p.x = nx;
        p.y = ny;
      } else {
        p.dx = 0;
        p.dy = 0;
      }
      if (p.gone > 0) {
        p.gone--;
        if (p.gone === 0) {
          p.hp = p.maxHp;
          p.crack = 0;
          this.burst(p.x + p.w / 2, p.y, "#d8fff8", 16, 4);
        }
      }
      if (p.crack > 0) p.crack--;
    }
    for (const f of this.fighters) this.updateFighter(f, frozen);
    this.hazards();
    for (const shot of this.projs) {
      shot.x += shot.vx;
      shot.y += shot.vy;
      shot.life--;
      if (this.frame % 2 === 0 && this.canSpawn()) {
        const owner = this.fighters[shot.owner];
        this.parts.push({
          type: "ember", x: shot.x, y: shot.y, vx: 0, vy: 0,
          life: 12, max: 12, color: owner?.def.accent || "#fff", size: shot.r * 0.45, g: 0,
        });
      }
      for (const f of this.fighters) {
        if (f.slot === shot.owner || f.state === "dead") continue;
        if (f.team === this.fighters[shot.owner].team) continue;
        if (this.overlap(shot.x - shot.r, shot.y - shot.r, shot.r * 2, shot.r * 2, f)) {
          const countered = f.state === "attack" && f.move?.counter && f.mf >= f.move.startup && f.mf < f.move.startup + f.move.active;
          if (countered) {
            shot.vx *= -1;
            shot.vy *= -0.35;
            shot.owner = f.slot;
            shot.life = Math.max(shot.life, 28);
            this.pop(f, "COUNTER", "#fff6df");
            this.ring(f.x, f.y - f.def.h * 0.5, f.def.accent, 54);
            sfx("parry");
            break;
          }
          this.hit(this.fighters[shot.owner], f, shot.move, Math.sign(shot.vx) || 1, 1, true);
          shot.life = 0;
        }
      }
    }
    this.projs = this.projs.filter((p) => p.life > 0);
    if (this.frame % 4 === 0) {
      const ex = this.cam.x + (Math.random() - 0.5) * 1400;
      const ey = this.cam.y + 200 + Math.random() * 120;
      const evx = (Math.random() - 0.5) * 0.3;
      const evy = -0.25 - Math.random() * 0.45;
      const esize = 1.6 + Math.random() * 1.6;
      if (this.canSpawn()) {
        this.parts.push({
          type: "ember",
          x: ex, y: ey, vx: evx, vy: evy,
          life: 80, max: 80,
          color: this.arena.ember, size: esize, g: 0,
        });
      }
    }
    this.stepFx();
    this.checkEnd();
  }

  stepFx() {
    for (const p of this.parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g || 0;
      p.vx *= 0.98;
      p.life--;
      if (p.type === "ring") p.r += p.grow;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 320) this.parts.splice(0, this.parts.length - 320);
    for (const p of this.pops) {
      p.y -= 0.65;
      p.life--;
    }
    this.pops = this.pops.filter((p) => p.life > 0);
    if (this.hitstop <= 0) {
      this.shake *= 0.86;
      if (this.shake < 0.3) this.shake = 0;
    }
    this.flashWhite *= 0.9;
    this.chroma *= 0.9;
    this.punch *= 0.9;
  }

  hazards() {
    for (const hz of this.arena.hazards || []) {
      const kind = hz.kind || "vent";
      if (kind === "vent") this.ventHazard(hz);
      else if (kind === "cannon") this.cannonHazard(hz);
      else if (kind === "wind") this.windHazard(hz);
      else if (kind === "lava") this.lavaHazard(hz);
    }
  }

  ventHazard(hz) {
    const st = hazardClock(this.frame, hz);
    if (!st.hot) return;
    if (st.t === 161) {
      sfx("vent");
      this.shake = Math.max(this.shake, 6);
    }
        if (this.frame % 2 === 0) {
          const hx = hz.x + Math.random() * hz.w;
          const hvx = (Math.random() - 0.5) * 2;
          const hvy = -8 - Math.random() * 8;
          const hcol = Math.random() < 0.5 ? "#ff7a1a" : "#ffd23f";
          const hsize = 4 + Math.random() * 5;
          if (this.canSpawn()) {
            this.parts.push({
              type: "ember", x: hx, y: 0, vx: hvx, vy: hvy,
              life: 36, max: 36, color: hcol, size: hsize, g: 0.08,
            });
          }
        }
    for (const f of this.fighters) {
      if (f.state === "dead" || f.inv > 0) continue;
      if (f.x > hz.x && f.x < hz.x + hz.w && f.y > -360 && f.y <= 8) {
        this.hit(null, f, {
          name: "Magma Vent", kind: "heavy", startup: 0, active: 0, recovery: 0,
          dmg: 14, base: 8, scale: 0.7, angle: 90, hb: { x: 0, y: 0, w: 0, h: 0 }, shake: 10,
        }, f.facing, 1, false);
      }
    }
  }

  cannonHazard(hz) {
    const st = hazardClock(this.frame, hz);
    const prev = this.cannonPrev;
    this.cannonPrev = st;
    if (st.phase === "fly" && (!prev || prev.phase !== "fly" || prev.cycle !== st.cycle)) {
      sfx("vent");
      this.shake = Math.max(this.shake, 5);
      for (let i = 0; i < 8; i++) {
        const vx = st.dir * (4 + Math.random() * 6);
        const vy = (Math.random() - 0.5) * 5;
        if (!this.canSpawn()) continue;
        this.parts.push({
          type: "spark", x: st.from, y: st.y,
          vx, vy,
          life: 16, max: 16, color: i % 2 ? "#ffd23f" : "#e25b3a", g: 0.04,
        });
      }
    }
    if (st.phase === "fly") {
      const x0 = prev && prev.phase === "fly" && prev.cycle === st.cycle ? prev.x : st.from;
      this.touchCannon(x0, st.x, st.y, st.dir, st.cycle);
    } else if (prev && prev.phase === "fly") {
      this.touchCannon(prev.x, prev.to, prev.y, prev.dir, prev.cycle);
    }
  }

  touchCannon(x0, x1, y, dir, cycle) {
    if (this.mawCycle !== cycle) {
      this.mawCycle = cycle;
      this.mawHit = 0;
    }
    const minX = Math.min(x0, x1) - 46;
    const maxX = Math.max(x0, x1) + 46;
    for (const f of this.fighters) {
      if (f.state === "dead") continue;
      const bit = 1 << f.slot;
      if (this.mawHit & bit) continue;
      if (!this.overlap(minX, y - 32, maxX - minX, 64, f)) continue;
      this.mawHit |= bit;
      this.hit(null, f, {
        name: "Cannon Beast", kind: "heavy", startup: 0, active: 0, recovery: 0,
        dmg: 12, base: 7.2, scale: 0.62, angle: 28, hb: { x: 0, y: 0, w: 0, h: 0 }, shake: 8,
      }, dir || 1, 1, false);
    }
  }

  windHazard(hz) {
    const st = hazardClock(this.frame, hz);
    if (!st.push) return;
    const top = hz.y;
    const bot = hz.y + hz.h;
    const left = hz.x;
    const right = hz.x + hz.w;
    for (const f of this.fighters) {
      if (f.grounded || f.state === "dead" || f.state === "ledge" || f.state === "grabbed") continue;
      const head = f.y - f.def.h;
      if (f.y <= top || head >= bot) continue;
      if (f.x < left || f.x > right) continue;
      f.x += st.push;
    }
  }

  lavaHazard(hz) {
    const st = hazardClock(this.frame, hz);
    if (!st.tick) return;
    for (const f of this.fighters) {
      if (f.state === "dead" || f.inv > 0) continue;
      if (f.y <= hz.y) continue;
      if (f.x < hz.x || f.x > hz.x + hz.w) continue;
      this.hit(null, f, {
        name: "Lava", kind: "heavy", startup: 0, active: 0, recovery: 0,
        dmg: 9, base: 6.2, scale: 0.42, angle: 86, hb: { x: 0, y: 0, w: 0, h: 0 }, shake: 6,
      }, f.x >= 0 ? -1 : 1, 1, false);
    }
  }

  updateFighter(f, frozen) {
    const def = f.def;
    if (f.state === "dead") {
      if (frozen) return;
      f.respawn--;
      if (f.respawn <= 0 && f.stocks > 0) this.respawn(f);
      return;
    }
    const input = frozen || this.intro > 60 ? emptyInput() : this.readInput(f);
    f._in = input;
    f._wasGrounded = f.grounded;
    if (f.inv > 0) f.inv--;
    if (f.flash > 0) f.flash--;
    if (f.dropT > 0) f.dropT--;
    if (f.ledgeLock > 0) f.ledgeLock--;
    if (f.parry > 0) f.parry--;
    if (f.mute > 0) f.mute--;
    if (input.shieldPressed) f.techBuf = 10;
    else if (f.techBuf > 0) f.techBuf--;
    if (f.buf) {
      f.buf.n--;
      if (f.buf.n <= 0) f.buf = null;
    }
    if (f.state === "hitstun") f.buf = null;

    if (f.state === "ledge") {
      this.tickLedge(f, input);
      return;
    }
    if (f.state === "grabbed") {
      this.tickGrabbed(f);
      return;
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (f.state === "hold") this.tickHold(f, input, dir);
    else if (f.state === "hitstun") {
      f.hitstun--;
      if (f.hitstun <= 0) {
        f.state = "idle";
        f.doomed = false;
      }
      f.vx *= 0.985;
      f.vx += dir * 0.08;
      f.vy += ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * 0.06;
      if (Math.hypot(f.vx, f.vy) > 8) this.pushTrail(f);
    } else if (f.state === "attack" && f.move) this.tickAttack(f, input, dir);
    else if (f.state === "charge") this.tickCharge(f, input, dir);
    else if (f.state === "dodge") {
      f.dodgeT--;
      if (f.grounded) f.vx *= 0.9;
      this.pushTrail(f);
      if (f.dodgeT <= 0) f.state = "idle";
    } else if (f.state === "shield") this.tickShield(f, input, dir);
    else this.tickFree(f, input, dir);

    if (f.state === "ledge" || f.state === "grabbed") return;

    if (!f.grounded || f.state === "hitstun") {
      const g = f.state === "hitstun" ? GRAV : GRAV * def.fall;
      const max = f.state === "hitstun" ? 20 : 11 * def.fall + (input.down ? 4 : 0);
      f.vy = Math.min(f.vy + g, max);
    }
    if (f.state === "hitstun") f.vy *= 0.99;

    const prevY = f.y;
    if (f.grounded && f.platform) {
      f.x += f.platform.dx || 0;
      f.y += f.platform.dy || 0;
    }
    f.x += f.vx;
    f.y += f.vy;
    if (f.grounded && f.state !== "hitstun" && f.state !== "dodge" && dir === 0) f.vx *= 0.78;
    this.collide(f, prevY, input);
    if (f.state === "hold") this.snapGrab(f);
    if (!f.grounded && f.ledgeLock <= 0 && ["idle", "run", "helpless", "hitstun", "dodge"].includes(f.state)) {
      this.tryLedge(f);
    }
    if (f.trail.length > 14) f.trail.shift();
    else if (f.trail.length && f.state !== "hitstun" && f.state !== "dodge" && f.state !== "attack") f.trail.shift();
    const b = this.arena.blast;
    const ceiling = f.y < b.t && f.hitUp;
    if (f.x < b.l || f.x > b.r || f.y > b.b || ceiling) this.ko(f);
  }

  pushTrail(f) {
    f.trail.push({ x: f.x, y: f.y - f.def.h * 0.45 });
    if (f.trail.length > 14) f.trail.shift();
  }

  readInput(f) {
    if (f.ctrl.type === "human") return this.humanInput(f, f.ctrl.scheme || 0);
    return this.cpuInput(f, f.ctrl.level || 0);
  }

  humanInput(f, schemeIndex) {
    if (this.cfg.online) {
      const online = this.cfg.online;
      const box = f.slot === online.localSlot ? online.localBox : online.remoteBox;
      const bits = box.get(this.frame) ?? 0;
      if (bits & 0x100000) f._q = 1;
      return unpackInput(bits);
    }
    return this.readPad(f, schemeIndex);
  }

  readPad(f, schemeIndex) {
    const map = SCHEMES[schemeIndex] || SCHEMES[0];
    const arrows = schemeIndex === 0 ? SCHEMES[1] : null;
    const down = (code) => !!this.keys[code];
    const held = (code, also) => down(code) || !!(also && down(also));
    const pressed = (name, code, also) => {
      const v = held(code, also);
      const was = !!f.prev[name];
      f.prev[name] = v;
      return v && !was;
    };
    return {
      left: held(map.left, arrows && arrows.left),
      right: held(map.right, arrows && arrows.right),
      up: held(map.up, arrows && arrows.up),
      down: held(map.down, arrows && arrows.down),
      shield: down(map.shield),
      shieldPressed: pressed("shield", map.shield),
      jump: pressed("jump", map.up, arrows && arrows.up),
      light: pressed("light", map.light),
      heavy: pressed("heavy", map.heavy),
      heavyHeld: down(map.heavy),
      special: pressed("special", map.special),
      grab: pressed("grab", map.grab),
      grabHeld: down(map.grab),
    };
  }

  cpuInput(f, level) {
    const input = emptyInput();
    if (level === 0) return input;
    const skill = [0, 0.28, 0.58, 0.86][level] ?? 0.55;
    if (f.chargeHold > 0) {
      input.heavyHeld = true;
      f.chargeHold--;
    }
    if (f.state === "hitstun") {
      if (f.x < -30) input.right = true;
      else if (f.x > 30) input.left = true;
      if (f.y > -10) input.up = true;
      if (f.vy > 5 && f.y > -90) input.shieldPressed = true;
      return input;
    }
    if (f.state === "hold") {
      input.grabHeld = f.holdT < 34;
      if (f.holdT > 18) {
        const roll = Math.random();
        if (roll < 0.33) input.up = true;
        else if (roll < 0.5) input.down = true;
      }
      return input;
    }
    if (f.state === "ledge") {
      if (f.ledgeT > 12) {
        const roll = Math.random();
        if (roll < 0.34) {
          if (f.facing > 0) input.right = true;
          else input.left = true;
        } else if (roll < 0.62) input.shieldPressed = true;
        else if (roll < 0.84) input.light = true;
        else input.jump = true;
      }
      return input;
    }
    if (f.state === "charge") {
      input.heavyHeld = f.chargeHold > 0 || f.charge < 8;
      return input;
    }
    const solids = this.plats.filter((p) => p.solid && !(p.maxHp && p.hp <= 0));
    if (!solids.length) return input;
    const left = Math.min(...solids.map((p) => p.x));
    const right = Math.max(...solids.map((p) => p.x + p.w));
    const off = f.x < left - 6 || f.x > right + 6 || f.y > 28;
    if (off && f.state !== "attack") {
      const mid = (left + right) / 2;
      if (f.x < mid) input.right = true;
      else input.left = true;
      const falling = f.vy > -1;
      const farBelow = f.y > 70;
      if (!f.usedUp && f.vy > -2 && (f.jumps === 0 || farBelow)) {
        input.up = true;
        input.special = true;
      } else if (falling && f.jumps > 0) input.jump = true;
      return input;
    }
    const foes = this.fighters.filter((o) => o.team !== f.team && o.state !== "dead");
    if (!foes.length) return input;
    let target = foes[0];
    let best = Infinity;
    for (const o of foes) {
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d < best) { best = d; target = o; }
    }
    const dx = target.x - f.x;
    const dy = target.y - f.y;
    const adx = Math.abs(dx);
    const threatening = target.state === "attack" && target.move && adx < 150 && Math.abs(dy) < 110 && f.grounded;
    if (threatening && Math.random() < 0.42 + skill * 0.5) {
      input.shield = true;
      input.shieldPressed = true;
      return input;
    }
    const canStep = (dir) => {
      if (!f.grounded) return true;
      const nx = f.x + dir * 48;
      if (level >= 2 && (target.x < left || target.x > right)) return true;
      return nx > left + 18 && nx < right - 18;
    };
    if (adx > 56) {
      if (dx > 0 && canStep(1)) input.right = true;
      if (dx < 0 && canStep(-1)) input.left = true;
    } else if (dx > 8) input.right = true;
    else if (dx < -8) input.left = true;
    if (dy < -48 && f.jumps > 0 && f.vy > -1 && Math.random() < 0.28 + skill * 0.4) input.jump = true;
    if (dy > 55 && f.platform && !f.platform.solid && Math.random() < 0.05) input.down = true;
    if ((f.state === "idle" || f.state === "run") && f.aiT <= 0) {
      f.aiT = Math.round(6 + Math.random() * 8 - level);
      const counter = f.def.moves.downb?.counter;
      if (counter && target.state === "attack" && adx < 120 && Math.abs(dy) < 80 && f.grounded && Math.random() < skill * 0.55) {
        input.down = true;
        input.special = true;
        input.left = input.right = false;
      } else if (adx < 96 + f.def.w && Math.abs(dy) < 90) {
        const kill = target.dmg > 85 / target.def.weight;
        const roll = Math.random();
        if (!f.grounded && f.def.moves.dair?.meteor && dy > 24 && adx < 70 && Math.random() < 0.45 + skill * 0.4) {
          input.down = true;
          input.light = true;
        } else if (!f.grounded) input.light = true;
        else if (f.grounded && adx < 48 && (target.state === "shield" || roll < 0.16) && Math.random() < 0.55) {
          input.grab = true;
          input.left = input.right = false;
        } else if (kill && dy < -36 && adx < 80 && roll < 0.34) {
          input.up = true;
          input.heavy = true;
          if (level >= 2) f.chargeHold = 10 + Math.floor(skill * 14);
        } else if (kill && adx < 56 && roll < 0.22) {
          input.down = true;
          input.heavy = true;
          if (level >= 2) f.chargeHold = 8 + Math.floor(skill * 12);
        } else if (kill && roll < 0.28 + skill * 0.3) {
          input.heavy = true;
          if (level >= 2) f.chargeHold = 14 + Math.floor(skill * 18);
        } else if (roll < 0.5) input.light = true;
        else if (roll < 0.72) {
          input.special = true;
          if (f.def.moves.special.projectile && Math.random() < 0.65) input.left = input.right = false;
          else if (f.def.moves.downb?.counter && Math.random() < 0.2) {
            input.down = true;
            input.left = input.right = false;
          }
        } else input.heavy = true;
      } else if (adx > 220 && Math.abs(dy) < 70) {
        if (f.def.moves.special.projectile) {
          input.special = true;
          input.left = input.right = false;
        } else if (f.def.moves.side?.projectile) input.special = true;
      } else if (dy < -70 && adx < 90 && Math.random() < skill) input.jump = true;
    } else f.aiT--;
    return input;
  }

  readyNet() {
    const online = this.cfg.online;
    if (!online) return true;
    const next = this.frame + 1;
    const horizon = next + online.delay;
    if (!online.localBox.has(horizon)) {
      let bits = packInput(this.readPad(this.fighters[online.localSlot], 0));
      if (this._q) bits |= 0x100000;
      online.localBox.set(horizon, bits);
      online.send(horizon, bits);
    }
    return online.remoteBox.has(next);
  }

  applyNetPause(at) {
    if (!at) {
      this.paused = false;
      this.pauseAt = 0;
      this.onPause(false);
      return;
    }
    if (this.frame >= at) {
      this.paused = true;
      this.pauseAt = 0;
      this.onPause(true);
    } else this.pauseAt = at;
  }

  noteSum(frame, sum) {
    this._remoteSums[frame] = sum;
    if (this._localSums?.[frame] && this._localSums[frame] !== sum) {
      this.error = "The match drifted. Rematch to line back up.";
    }
  }

  checksum() {
    return this.fighters.map((f) => [Math.round(f.x), Math.round(f.y), Math.round(f.dmg), f.stocks, f.state].join(":")).join("|");
  }

  tickAttack(f, input, dir) {
    const m = f.move;
    const remember = (button) => {
      const kind = this.pick(f, button, input);
      if (kind) f.buf = { k: kind, n: 8 };
    };
    if (input.light) remember("light");
    if (input.heavy) remember("heavy");
    if (input.special) remember("special");
    if (input.grab) remember("grab");
    if (input.jump) f.buf = { k: "jump", n: 8 };
    f.mf++;
    if (f.mf === m.startup) {
      if (m.lunge) {
        f.vx = m.lunge.vx * f.facing;
        if (m.lunge.vy) {
          f.vy = m.lunge.vy * (m.kind === "up" ? 1.25 : 1);
          f.grounded = false;
          f.platform = null;
        }
      }
      if (m.teleport) {
        this.burst(f.x, f.y - f.def.h / 2, f.def.color, 18, 6);
        f.x += m.teleport * f.facing;
        f.facing *= -1;
        this.burst(f.x, f.y - f.def.h / 2, f.def.accent, 18, 6);
        sfx("blink");
      }
      if (m.projectile) {
        this.projs.push({
          x: f.x + m.hb.x * f.facing,
          y: f.y + m.hb.y,
          vx: m.projectile.vx * f.facing,
          vy: m.projectile.vy,
          r: m.projectile.r,
          life: m.projectile.life,
          owner: f.slot,
          move: m,
        });
      }
      this.attackFx(f, m);
      sfx(attackVoice(f, m));
      if (m.lunge && Math.abs(m.lunge.vx) > 8) this.pushTrail(f);
    }
    if (f.mf >= m.startup && f.mf < m.startup + m.active && !m.projectile) this.activeHitbox(f, m);
    if (f.state !== "attack") return;
    if (f.mf > m.startup && f.mf < m.startup + m.active) this.attackTrail(f, m);
    if (m.kind === "special" && m.lunge && f.mf > m.startup) f.vx *= 0.9;
    if (f.mf >= m.startup + m.active + m.recovery) {
      f.state = m.kind === "up" && !f.grounded ? "helpless" : "idle";
      f.move = null;
      f.attackPower = 1;
    }
    if (!f.grounded && m.kind !== "special") {
      const cap = f.def.airSpeed * 1.2;
      f.vx = Math.max(-cap, Math.min(cap, f.vx + dir * (m.kind === "up" ? 0.55 : 0.25)));
    }
  }

  tickCharge(f, input, dir) {
    f.charge++;
    f.vx *= 0.8;
    if (dir) f.facing = dir;
    const max = 42;
    if (!f.grounded) {
      const air = this.pick(f, "light", input);
      this.startMove(f, air && !String(air).startsWith("charge:") ? air : "nair", 1);
      return;
    }
    if (!input.heavyHeld || f.charge >= max) {
      const power = 1 + (Math.min(f.charge, max) / max) * 0.72;
      this.startMove(f, f.chargeKind || "heavy", power);
      if (power > 1.35) this.flashWhite = Math.max(this.flashWhite, 0.18);
    }
  }

  tickShield(f, input, dir) {
    f.shieldHp = Math.max(0, f.shieldHp - 0.18);
    f.vx *= 0.7;
    if (!input.shield || !f.grounded) {
      f.state = "idle";
      return;
    }
    if (dir) {
      this.startDodge(f, dir, true);
      return;
    }
    if (f.shieldHp <= 0) this.breakShield(f);
  }

  tickFree(f, input, dir) {
    const def = f.def;
    const helpless = f.state === "helpless";
    f.shieldHp = Math.min(SHIELD_MAX, f.shieldHp + 0.28);
    const target = dir * (f.grounded ? def.speed : def.airSpeed);
    const accel = f.grounded ? 1.15 : 0.7;
    f.vx += Math.max(-accel, Math.min(accel, target - f.vx));

    const buffered = f.buf?.k;
    const jumpNow = input.jump || buffered === "jump";
    const lightNow = input.light;
    const heavyNow = input.heavy;
    const specialNow = input.special;
    const grabNow = input.grab;

    if (f.landLag > 0) {
      f.landLag--;
    } else if (!helpless && f.mute <= 0) {
      if (jumpNow && (f.grounded || f.jumps > 0) && !specialNow && !(f.grounded && (lightNow || heavyNow || grabNow))) {
        if (!f.grounded) f.jumps--;
        f.vy = -def.jump * (f.grounded ? 1 : 0.92);
        f.hitUp = false;
        f.grounded = false;
        f.platform = null;
        f.hop = true;
        f.hopT = 0;
        this.dust(f.x, f.y, 6);
        sfx("jump");
        if (buffered === "jump") f.buf = null;
      }
      if (input.down && f.grounded && f.platform && !f.platform.solid) {
        f.dropT = 12;
        f.grounded = false;
        f.platform = null;
        f.y += 2;
      }
      if (input.down && !f.grounded && f.vy > -2) f.vy = Math.max(f.vy, 11 * def.fall);
      if (input.shieldPressed || input.shield) {
        if (f.grounded && input.shieldPressed && dir) this.startDodge(f, dir, true);
        else if (f.grounded && (input.shieldPressed || input.shield)) {
          f.state = "shield";
          f.parry = input.shieldPressed ? 8 : f.parry;
          f.vx *= 0.4;
        } else if (!f.grounded && input.shieldPressed && !f.airDodged) {
          f.airDodged = true;
          f.state = "dodge";
          f.dodgeT = 20;
          f.inv = 16;
          f.vx = dir * 8;
          f.vy = input.up ? -8 : input.down ? 8 : -1.4;
          sfx("dodge");
        }
      }
      if (f.state !== "shield" && f.state !== "dodge") {
        const face = f.facing || 1;
        let kind = null;
        let power = 1;
        if (grabNow) kind = this.pick(f, "grab", input, face);
        else if (specialNow) kind = this.pick(f, "special", input, face);
        else if (heavyNow) {
          kind = this.pick(f, "heavy", input, face);
          if (!f.grounded) power = 1.18;
        } else if (lightNow) kind = this.pick(f, "light", input, face);
        else if (buffered && buffered !== "jump") kind = buffered;
        if (kind && kind.startsWith("charge:")) {
          if (!f.grounded) {
            this.startMove(f, this.pick(f, "light", input, face) || "nair", 1.18);
          } else {
            if (dir) f.facing = dir;
            f.state = "charge";
            f.charge = 0;
            f.chargeKind = kind.slice(7);
            f.move = def.moves[f.chargeKind] || def.moves.heavy;
          }
          f.buf = null;
        } else if (kind) {
          const keepFace = kind === "btilt" || kind === "bair";
          if (dir && !keepFace) f.facing = dir;
          this.startMove(f, kind, power);
          f.buf = null;
        } else if (dir) f.facing = dir;
      }
    }
    if (f.hop) {
      f.hopT++;
      if (!input.up && f.hopT <= 7 && f.vy < 0) {
        f.vy *= 0.58;
        f.hop = false;
      }
      if (f.hopT > 7) f.hop = false;
    }
    if (f.state === "idle" || f.state === "run" || f.state === "helpless") {
      if (dir) f.facing = dir;
      if (f.grounded) f.state = !helpless && dir && Math.abs(f.vx) > def.speed * 0.62 ? "run" : "idle";
    }
    if (f.state === "run" && this.frame % 7 === 0) this.dust(f.x, f.y, 1);
  }

  pick(f, button, input, face = f.facing || 1) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const forward = dir && dir === face;
    const back = dir && dir === -face;
    const moves = f.def.moves;
    const has = (key) => !!moves[key];
    if (button === "grab") return f.grounded && has("grab") ? "grab" : null;
    if (button === "special") {
      if (input.up) return !f.usedUp && has("up") ? "up" : null;
      if (input.down && has("downb")) return "downb";
      if ((forward || back) && has("side")) return "side";
      return has("special") ? "special" : null;
    }
    if (!f.grounded) {
      if (button === "heavy" && input.down && has("dsmash")) return "dsmash";
      const air = input.up ? "uair" : input.down ? "dair" : forward ? "fair" : back ? "bair" : "nair";
      if (has(air)) return air;
      return has("nair") ? "nair" : has("aerial") ? "aerial" : null;
    }
    if (button === "heavy") {
      if (input.up && has("usmash")) return "charge:usmash";
      if (input.down && has("dsmash")) return "charge:dsmash";
      return "charge:heavy";
    }
    const running = f.state === "run" || Math.abs(f.vx) > f.def.speed * 0.72;
    if (running && !input.up && !input.down && !back && has("dash")) return "dash";
    if (input.up && has("utilt")) return "utilt";
    if (input.down && has("dtilt")) return "dtilt";
    if (back && has("btilt")) return "btilt";
    if (forward && has("ftilt")) return "ftilt";
    return has("light") ? "light" : null;
  }

  beginHold(attacker, target) {
    attacker.state = "hold";
    attacker.holding = target.slot;
    attacker.holdT = 0;
    attacker.move = null;
    attacker.vx *= 0.25;
    target.state = "grabbed";
    target.heldBy = attacker.slot;
    target.move = null;
    target.hitstun = 0;
    target.vx = 0;
    target.vy = 0;
    target.grounded = attacker.grounded;
    this.snapGrab(attacker);
    this.ring(
      attacker.x + (attacker.facing || 1) * attacker.def.w * 0.62,
      attacker.y - attacker.def.h * 0.46,
      attacker.def.accent,
      32,
    );
    sfx("clinch");
  }

  releaseHold(holder, throwThem, input) {
    if (!holder || holder.holding < 0) return null;
    const victim = this.fighters[holder.holding];
    holder.holding = -1;
    holder.holdT = 0;
    if (holder.state === "hold") holder.state = "idle";
    if (!victim || victim.heldBy !== holder.slot) return null;
    victim.heldBy = -1;
    if (victim.state === "grabbed") victim.state = "idle";
    if (throwThem) this.throwGrab(holder, victim, input || emptyInput());
    return victim;
  }

  throwGrab(attacker, victim, input) {
    const move = { ...attacker.def.moves.grab };
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (input.up) move.angle = 88;
    else if (input.down) {
      move.angle = -78;
      move.meteor = true;
    } else if (dir && dir === -attacker.facing) move.angle = 140;
    else if (dir) move.angle = 36;
    this.hit(attacker, victim, move, attacker.facing || 1, 1, false, { fromThrow: true });
  }

  tickHold(f, input, dir) {
    const victim = this.fighters[f.holding];
    if (!victim || victim.state !== "grabbed" || victim.heldBy !== f.slot) {
      f.holding = -1;
      f.holdT = 0;
      if (f.state === "hold") f.state = "idle";
      return;
    }
    f.holdT++;
    const def = f.def;
    const speed = (f.grounded ? def.speed : def.airSpeed) * 0.78;
    const accel = f.grounded ? 0.95 : 0.55;
    const target = dir * speed;
    f.vx += Math.max(-accel, Math.min(accel, target - f.vx));
    if (dir) f.facing = dir;
    if (input.jump && (f.grounded || f.jumps > 0)) {
      if (!f.grounded) f.jumps--;
      f.vy = -def.jump * (f.grounded ? 0.92 : 0.84);
      f.grounded = false;
      f.platform = null;
      f.hop = true;
      f.hopT = 0;
      this.dust(f.x, f.y, 5);
      sfx("jump");
    }
    if (input.down && f.grounded && f.platform && !f.platform.solid) {
      f.dropT = 12;
      f.grounded = false;
      f.platform = null;
      f.y += 2;
    }
    if (f.hop) {
      f.hopT++;
      if (!input.up && f.hopT <= 7 && f.vy < 0) {
        f.vy *= 0.58;
        f.hop = false;
      }
      if (f.hopT > 7) f.hop = false;
    }
    const keep = f.ctrl.type === "cpu" ? f.holdT < 34 : input.grabHeld;
    if (!keep || f.holdT > 150) this.releaseHold(f, true, input);
  }

  tickGrabbed(f) {
    const holder = this.fighters[f.heldBy];
    if (!holder || holder.state !== "hold" || holder.holding !== f.slot) {
      f.heldBy = -1;
      if (f.state === "grabbed") f.state = "idle";
    }
  }

  snapGrab(f) {
    const victim = this.fighters[f.holding];
    if (!victim || victim.state !== "grabbed") return;
    victim.x = f.x + f.facing * (f.def.w * 0.45 + victim.def.w * 0.42);
    victim.y = f.y;
    victim.vx = 0;
    victim.vy = 0;
    victim.facing = -f.facing;
    victim.grounded = f.grounded;
    victim.platform = f.platform;
  }

  startDodge(f, dir, grounded) {
    f.hitUp = false;
    f.state = "dodge";
    f.dodgeT = grounded ? 16 : 20;
    f.inv = grounded ? 13 : 16;
    f.vx = dir * (grounded ? 10.5 : 8);
    f.facing = dir || f.facing;
    if (!grounded) f.airDodged = true;
    sfx("dodge");
  }

  startMove(f, kind, power) {
    const move = f.def.moves[kind];
    if (!move) return;
    f.hitUp = false;
    if (!f.grounded && kind !== "up" && !f.airStall) {
      f.airStall = true;
      f.vy = Math.min(f.vy, kind === "special" ? -6 : -2);
    }
    f.state = "attack";
    f.move = move;
    f.mf = 0;
    f.hitSet = new Set();
    f.attackPower = power || 1;
    if (kind === "up") f.usedUp = true;
    if (f.grounded && kind !== "up") f.vx *= 0.32;
  }

  collide(f, prevY, input) {
    const def = f.def;
    const wasGrounded = f._wasGrounded;
    let grounded = false;
    let platform = null;
    for (const p of this.plats) {
      if (p.maxHp && p.hp <= 0) continue;
      const withinX = f.x + def.w * 0.28 > p.x && f.x - def.w * 0.28 < p.x + p.w;
      const prev = prevY - (p.dy > 0 ? p.dy : 0);
      if (withinX && f.vy >= 0 && prev <= p.y + 1 + Math.max(0, p.dy) && f.y >= p.y && (p.solid || f.dropT === 0)) {
        if (f.state === "hitstun" && f.techBuf > 0 && f.vy > 3) {
          this.doTech(f, p, input);
          return;
        }
        if (f.state === "hitstun" && f.vy > 8 && f.hitstun > 8) {
          f.vy = -f.vy * 0.46;
          f.y = p.y;
          this.dust(f.x, p.y, 10);
          this.ring(f.x, p.y, "#fff6df", 36);
          continue;
        }
        f.y = p.y;
        f.vy = 0;
        grounded = true;
        platform = p;
      }
      if (p.solid && f.y > p.y + 6 && f.y - def.h < p.y + p.h + 80) {
        const leftPen = f.x + def.w / 2 - p.x;
        const rightPen = p.x + p.w - (f.x - def.w / 2);
        if (leftPen > 0 && rightPen > 0 && f.y > p.y + 8) {
          if (leftPen < rightPen) {
            f.x = p.x - def.w / 2;
            f.vx = Math.min(0, f.vx) * -0.35;
          } else {
            f.x = p.x + p.w + def.w / 2;
            f.vx = Math.max(0, f.vx) * -0.35;
          }
        }
      }
    }
    if (grounded) {
      const landed = !wasGrounded;
      f.grounded = true;
      f.platform = platform;
      if (landed) {
        f.hitUp = false;
        this.dust(f.x, f.y, 4);
        if (f.state === "helpless" || (f.state === "attack" && f.move && (f.move.kind === "aerial" || f.move.kind === "up"))) {
          f.state = "idle";
          f.move = null;
          f.landLag = 4;
        }
        if (f.state === "dodge" || f.state === "hitstun") {
          f.state = "idle";
          f.hitstun = 0;
          f.doomed = false;
        }
      }
      f.jumps = def.jumps;
      f.usedUp = false;
      f.airDodged = false;
      f.airStall = false;
      f.ledgeLock = 0;
      if (f.state === "helpless") f.state = "idle";
    } else {
      f.grounded = false;
      f.platform = null;
      if (wasGrounded && f.jumps === def.jumps) f.jumps = def.jumps - 1;
    }
  }

  doTech(f, p, input) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    f.y = p.y;
    f.vy = 0;
    f.grounded = true;
    f.platform = p;
    f.hitstun = 0;
    f.hitUp = false;
    f.techBuf = 0;
    f.doomed = false;
    f.jumps = f.def.jumps;
    f.usedUp = false;
    f.airDodged = false;
    if (dir) {
      f.state = "dodge";
      f.dodgeT = 12;
      f.inv = 12;
      f.vx = dir * 12;
      f.facing = dir;
    } else {
      f.state = "idle";
      f.inv = 8;
      f.vx *= 0.15;
    }
    this.pop(f, "TECH", "#d7fff8");
    this.dust(f.x, f.y, 8);
    sfx("tech");
  }

  tryLedge(f) {
    if (f.vy < -8 && f.state !== "hitstun") return;
    let best = null;
    let bestD = 80;
    for (const p of this.plats) {
      if (!p.solid || (p.maxHp && p.hp <= 0)) continue;
      if (f.y < p.y || f.y > p.y + f.def.h * 0.95) continue;
      const edges = [[p.x, -1], [p.x + p.w, 1]];
      for (const [edge, side] of edges) {
        const dx = f.x - edge;
        const ok = side < 0 ? dx > -46 && dx < 0 : dx > 0 && dx < 46;
        if (!ok) continue;
        const dist = Math.abs(dx) + Math.abs(f.y - p.y) * 0.35;
        if (dist < bestD) {
          bestD = dist;
          best = { p, side };
        }
      }
    }
    if (!best) return;
    f.state = "ledge";
    f.ledgePlat = best.p;
    f.ledgeSide = best.side;
    f.facing = best.side < 0 ? 1 : -1;
    f.ledgeT = 0;
    f.vx = 0;
    f.vy = 0;
    f.grounded = false;
    f.platform = null;
    f.hitstun = 0;
    f.hitUp = false;
    f.move = null;
    f.doomed = false;
    f.inv = Math.max(f.inv, 26);
    f.jumps = Math.max(f.jumps, 1);
    f.usedUp = false;
    f.airDodged = false;
    f.airStall = false;
    this.snapLedge(f);
    this.pop(f, "LEDGE", "#d7fff8");
  }

  snapLedge(f) {
    const p = f.ledgePlat;
    if (!p) return;
    const edge = f.ledgeSide < 0 ? p.x : p.x + p.w;
    f.x = edge + (f.ledgeSide < 0 ? -f.def.w * 0.32 : f.def.w * 0.32);
    f.y = p.y + f.def.h * 0.62;
    f.vx = 0;
    f.vy = 0;
  }

  tickLedge(f, input) {
    const p = f.ledgePlat;
    if (!p || (p.maxHp && p.hp <= 0)) {
      this.dropLedge(f);
      return;
    }
    this.snapLedge(f);
    f.ledgeT++;
    if (f.ledgeT > 175) {
      this.dropLedge(f);
      return;
    }
    if (f.ledgeT < 5) return;
    if (input.down) this.dropLedge(f);
    else if (input.jump || input.up) this.ledgeJump(f);
    else if (input.light || input.heavy) this.ledgeAttack(f);
    else if (input.shieldPressed) this.ledgeRoll(f);
    else if ((f.facing > 0 && input.right) || (f.facing < 0 && input.left)) {
      if (f.ledgeT > 8) this.ledgeStand(f);
    }
  }

  ledgeJump(f) {
    const p = f.ledgePlat;
    f.state = "idle";
    f.grounded = false;
    f.platform = null;
    f.y = (p?.y || f.y) - 6;
    f.x += f.facing * 16;
    f.vy = -f.def.jump * 0.95;
    f.jumps = Math.max(0, f.jumps - 1);
    f.ledgeLock = 22;
    f.ledgePlat = null;
    sfx("jump");
  }

  dropLedge(f) {
    f.state = "idle";
    f.grounded = false;
    f.platform = null;
    f.y += 24;
    f.vy = 2.2;
    f.ledgeLock = 28;
    f.ledgePlat = null;
  }

  placeFromLedge(f) {
    const p = f.ledgePlat;
    f.x += f.facing * (f.def.w * 0.9 + 6);
    f.y = p ? p.y : f.y;
    f.grounded = true;
    f.platform = p;
    f.vy = 0;
    f.ledgePlat = null;
    f.ledgeLock = 24;
    f.jumps = f.def.jumps;
    f.usedUp = false;
    f.airDodged = false;
    f.airStall = false;
  }

  ledgeStand(f) {
    this.placeFromLedge(f);
    f.state = "idle";
    f.inv = Math.max(f.inv, 8);
  }

  ledgeRoll(f) {
    this.placeFromLedge(f);
    f.state = "dodge";
    f.dodgeT = 14;
    f.inv = 14;
    f.vx = f.facing * 11;
    sfx("dodge");
  }

  ledgeAttack(f) {
    this.placeFromLedge(f);
    this.startMove(f, "getup", 1);
  }

  respawn(f) {
    const mates = this.fighters.filter((o) => o.team === f.team);
    const index = Math.max(0, mates.indexOf(f));
    f.state = "idle";
    f.x = (index - (mates.length - 1) / 2) * 90;
    f.y = -520;
    f.vx = 0;
    f.vy = 1.2;
    f.hitUp = false;
    f.dmg = 0;
    f.inv = 140;
    f.jumps = f.def.jumps;
    f.usedUp = false;
    f.airDodged = false;
    f.airStall = false;
    f.hitstun = 0;
    f.move = null;
    f.doomed = false;
    f.holding = -1;
    f.heldBy = -1;
    f.holdT = 0;
    f.grounded = false;
    f.platform = null;
    f.mute = 12;
    f.trail = [];
    this.burst(f.x, -80, f.def.accent, 12, 3);
  }

  boxOf(f, hb) {
    const cx = f.x + hb.x * f.facing;
    const cy = f.y + hb.y;
    return { x: cx - hb.w / 2, y: cy - hb.h / 2, w: hb.w, h: hb.h };
  }

  activeHitbox(f, move) {
    const box = this.boxOf(f, move.hb);
    const sweet = move.sweet ? this.boxOf(f, move.sweet.hb) : null;
    for (const o of this.fighters) {
      if (o === f || o.state === "dead" || o.state === "ledge" && o.inv > 0) continue;
      if (f.hitSet.has(o.slot) || o.team === f.team) continue;
      if (!this.overlap(box.x, box.y, box.w, box.h, o)) continue;
      if (move.kind === "grab") {
        if (o.inv > 0 || o.state === "dodge" || o.state === "grabbed" || o.state === "hold") continue;
        const swinging = o.state === "attack" && o.move && !o.move.grab && !o.move.projectile
          && o.mf >= o.move.startup && o.mf < o.move.startup + o.move.active;
        if (swinging) continue;
        if (!(o.parry > 0 && o.state === "shield")) {
          f.hitSet.add(o.slot);
          this.beginHold(f, o);
          continue;
        }
      }
      if (o.state === "attack" && o.move && !o.move.projectile && !move.grab) {
        const active = o.mf >= o.move.startup && o.mf < o.move.startup + o.move.active;
        if (active) {
          const mine = move.dmg * (f.attackPower || 1);
          const theirs = o.move.dmg * (o.attackPower || 1);
          if (Math.abs(mine - theirs) < 8) {
            f.hitSet.add(o.slot);
            o.hitSet.add(f.slot);
            f.vx = -f.facing * 3.2;
            o.vx = -o.facing * 3.2;
            this.pop(f, "CLANK", "#fff6df");
            this.burst((f.x + o.x) / 2, (f.y + o.y) / 2 - 30, "#fff", 12, 4);
            sfx("block");
            continue;
          }
          if (theirs > mine + 8) continue;
        }
      }
      const useSweet = sweet && this.overlap(sweet.x, sweet.y, sweet.w, sweet.h, o);
      const stats = useSweet ? { ...move, ...move.sweet, name: `${move.name} Tip`, sweetHit: true } : move;
      f.hitSet.add(o.slot);
      this.hit(f, o, stats, f.facing, f.attackPower || 1, false);
    }
    if (move.breaks && !f.hitSet.has(-1)) {
      for (const p of this.plats) {
        if (!p.maxHp || p.hp <= 0) continue;
        if (box.x < p.x + p.w && box.x + box.w > p.x && box.y < p.y + p.h + 24 && box.y + box.h > p.y - 8) {
          f.hitSet.add(-1);
          p.hp -= move.breaks;
          p.crack = 18;
          this.burst(box.x + box.w / 2, p.y, "#ddd", 10, 4);
          if (p.hp <= 0) {
            p.gone = 480;
            p.hp = 0;
            sfx("crumble");
            this.shake = Math.max(this.shake, 12);
            for (let i = 0; i < 22; i++) {
              const sx = p.x + Math.random() * p.w;
              const svx = (Math.random() - 0.5) * 6;
              const svy = -Math.random() * 5;
              const ssize = 5 + Math.random() * 7;
              if (!this.canSpawn()) continue;
              this.parts.push({
                type: "shard", x: sx, y: p.y, vx: svx, vy: svy,
                life: 50, max: 50, color: this.arena.stageEdge, size: ssize, g: 0.35,
              });
            }
          }
          break;
        }
      }
    }
  }

  overlap(x, y, w, h, f) {
    const l = f.x - f.def.w / 2;
    const t = f.y - f.def.h;
    return x < l + f.def.w && x + w > l && y < t + f.def.h && y + h > t;
  }

  hit(attacker, target, move, facing, power, fromProj, meta) {
    if (target.inv > 0 || target.state === "dodge") {
      if (target.state === "dodge" && target.flash <= 0) {
        target.flash = 16;
        this.pop(target, "DODGE", "#d7fff8");
      }
      return;
    }
    if (target.state === "hold") this.releaseHold(target, false);
    if (target.state === "grabbed" && !meta?.fromThrow) this.releaseHold(this.fighters[target.heldBy], false);
    if (!meta?.fromCounter && target.state === "attack" && target.move?.counter) {
      const stance = target.move;
      const armed = target.mf >= stance.startup && target.mf < stance.startup + stance.active;
      if (armed && attacker && !fromProj) {
        sfx("parry");
        this.pop(target, "COUNTER", "#fff6df");
        this.flashWhite = Math.max(this.flashWhite, 0.4);
        this.hitstop = 10;
        this.ring(target.x, target.y - target.def.h * 0.5, "#fff6df", 78);
        target.mf = stance.startup + stance.active;
        const c = {
          ...stance,
          ...stance.counter,
          name: stance.name,
          sweet: null,
          grab: false,
          meteor: false,
          counter: null,
          projectile: null,
        };
        this.hit(target, attacker, c, target.facing || 1, 1, false, { fromCounter: true });
        return;
      }
    }
    if (target.parry > 0 && target.state === "shield") {
      target.parry = 0;
      sfx("parry");
      this.pop(target, "PARRY", "#f2d48a");
      this.flashWhite = Math.max(this.flashWhite, 0.28);
      this.hitstop = 12;
      this.ring(target.x, target.y - target.def.h * 0.5, "#f2d48a", 70);
      if (attacker && !fromProj) {
        attacker.state = "hitstun";
        attacker.hitstun = 26;
        attacker.vx = -(attacker.facing || 1) * 7;
        attacker.vy = -4.5;
        attacker.grounded = false;
        attacker.platform = null;
        attacker.move = null;
      }
      return;
    }
    const dealt = attacker && attacker._q ? 12 : 1;
    if (target.state === "shield" && !move.grab) {
      target.shieldHp -= move.dmg * power * 1.25 * dealt;
      target.vx = facing * Math.min(8, move.base * 0.6);
      this.hitstop = 4;
      sfx("block");
      this.pop(target, "BLOCK", "#9ad7ff");
      this.burst(target.x, target.y - target.def.h / 2, "#9ad7ff", 8, 3);
      if (attacker && !fromProj) attacker.vx = -facing * 2;
      if (target.shieldHp <= 0) this.breakShield(target);
      return;
    }
    const dmg = move.dmg * power * dealt * (move.meteor ? 1.8 : 1);
    const rage = attacker ? 1 + attacker.dmg / 900 : 1;
    const base = move.base * (1 + (power - 1) * 0.85);
    const shape = attacker && attacker.def ? attacker.def.shape : "";
    const kbOut = shape === "heavy" || shape === "grappler" ? 0.82 : 1;
    let kb = (base + target.dmg * move.scale * 0.12 * (move.dmg / 10 + 0.5)) / target.def.weight * rage * kbOut;
    if (move.meteor) kb *= 2.4;
    const { ix, iy } = this.stick(target);
    let angle = move.angle;
    if (move.meteor && target.grounded) angle = 42;
    const ang = (angle * Math.PI) / 180;
    const ox = target.x;
    const oy = target.y;
    const baseVx = Math.cos(ang) * kb * facing;
    const baseVy = -Math.sin(ang) * kb;
    const stun = Math.round(8 + kb * 2.05);
    target.dmg = Math.min(999, target.dmg + dmg);
    if (attacker) {
      attacker.dealt += dmg;
      target.lastHitBy = attacker.slot;
      if (attacker.comboOn === target.slot && this.frame - attacker.comboAt < 90) attacker.combo++;
      else attacker.combo = 1;
      attacker.comboOn = target.slot;
      attacker.comboAt = this.frame;
    } else target.lastHitBy = -1;
    target.lastHitT = this.frame;
    target.lastMove = move.name;
    target.lastKind = attacker ? move.kind : "env";
    target.vx = baseVx + ix * kb * 0.18;
    target.vy = baseVy + iy * kb * 0.14;
    target.hitUp = !!(attacker && target.vy < 0);
    target.x += ix * 6;
    target.y += iy * 4;
    if (target.grounded && target.vy > 0) target.vy = -Math.abs(target.vy) * 0.65;
    target.grounded = false;
    target.platform = null;
    target.state = "hitstun";
    target.hitstun = stun;
    target.move = null;
    target.flash = 8;
    target.combo = 0;
    this.hitstop = Math.min(16, Math.round(3 + kb * 0.42));
    this.shake = Math.max(this.shake, (move.shake || 0) + kb * 0.28);
    this.punch = Math.max(this.punch, Math.min(0.2, kb / 110));
    const color = kb > 16 ? "#fff" : kb > 10 ? "#ffd23f" : attacker?.def.accent || "#ff7a1a";
    this.burst(target.x, target.y - target.def.h / 2, color, Math.round(8 + kb * 0.4), 3 + kb * 0.2);
    if (kb > 8) this.ring(target.x, target.y - target.def.h / 2, color, 30 + kb * 2);
    if (move.grab && attacker && !meta?.fromThrow) {
      this.ring(
        attacker.x + (attacker.facing || 1) * attacker.def.w * 0.62,
        attacker.y - attacker.def.h * 0.46,
        attacker.def.accent,
        32,
      );
    }
    sfx(kb > 16 ? "smash" : kb > 9 ? "hitH" : "hit");
    target.doomed = this.inescapable(target, baseVx, baseVy, kb, stun, ox, oy);
    if (!this.cine && !this.cfg.training && target.stocks === 1 && this.wouldEnd(target) && target.doomed) {
      const winner = attacker && attacker.stocks > 0 ? attacker : this.fighters.find((o) => o.team !== target.team && o.state !== "dead");
      this.cine = {
        t: 0,
        victim: target.slot,
        winner: winner?.slot ?? -1,
        move: move.name,
        kind: attacker ? move.kind : "env",
        x: target.x,
        y: target.y - target.def.h / 2,
        announced: false,
        koT: -1,
      };
      this.hitstop = 0;
      this.flashWhite = 0.72;
      sfx("impact");
    }
  }

  breakShield(f) {
    f.shieldHp = 0;
    f.state = "hitstun";
    f.hitstun = 100;
    f.vy = -11;
    f.grounded = false;
    f.platform = null;
    f.jumps = Math.max(f.jumps, 1);
    f.usedUp = false;
    f.airDodged = false;
    this.pop(f, "SHIELD BREAK", "#ffd23f");
    this.shake = Math.max(this.shake, 10);
    sfx("break");
  }

  wouldEnd(victim) {
    const teams = new Set();
    for (const f of this.fighters) {
      if (f === victim || f.stocks <= 0) continue;
      teams.add(f.team);
    }
    return !teams.has(victim.team) && teams.size <= 1;
  }

  inescapable(f, baseVx, baseVy, kb, hitstun, ox, oy) {
    const sticks = [[0, 0]];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      sticks.push([Math.cos(a), Math.sin(a)]);
    }
    return sticks.every(([ix, iy]) => !this.canSurvive(
      f,
      baseVx + ix * kb * 0.18,
      baseVy + iy * kb * 0.14,
      ox + ix * 6,
      oy + iy * 4,
      hitstun,
    ));
  }

  canSurvive(f, vx, vy, x, y, hitstun) {
    const b = this.arena.blast;
    const toward = x >= 0 ? -1 : 1;
    for (let i = 0; i < hitstun; i++) {
      vx = vx * 0.985 + (Math.abs(vx) > 0.4 ? -Math.sign(vx) : toward) * 0.08;
      vy += vy < 0 ? 0.06 : -0.06;
      vy = Math.min(vy + GRAV, 20) * 0.99;
      const prevY = y;
      x += vx;
      y += vy;
      if (this.wouldTechOrLedge(f, x, y, prevY, vy)) return true;
      if (x < b.l || x > b.r || y < b.t || y > b.b) return false;
    }
    return true;
  }

  wouldTechOrLedge(f, x, y, prevY, vy) {
    const w = f.def.w;
    const h = f.def.h;
    for (const p of this.plats) {
      if (p.maxHp && p.hp <= 0) continue;
      const withinX = x + w * 0.28 > p.x && x - w * 0.28 < p.x + p.w;
      if (withinX && vy >= 0 && prevY <= p.y + 1 && y >= p.y) return true;
      if (y >= p.y - 28 && y <= p.y + h * 0.95) {
        const edges = [[p.x, -1], [p.x + p.w, 1]];
        for (const [edge, side] of edges) {
          const dx = x - edge;
          const ok = side < 0 ? dx > -46 && dx < 24 : dx < 46 && dx > -24;
          if (ok) return true;
        }
      }
    }
    return false;
  }

  predictKO(f) {
    let x = f.x;
    let y = f.y;
    let vx = f.vx;
    let vy = f.vy;
    const b = this.arena.blast;
    const steps = Math.max(24, f.hitstun + 16);
    for (let i = 0; i < steps; i++) {
      vy = Math.min(vy + GRAV, 20) * 0.992;
      vx *= 0.986;
      x += vx;
      y += vy;
      if (x < b.l || x > b.r || y < b.t || y > b.b) return true;
    }
    return false;
  }

  ko(f) {
    if (f.state === "dead") return;
    if (f.holding >= 0) this.releaseHold(f, false);
    if (f.heldBy >= 0) this.releaseHold(this.fighters[f.heldBy], false);
    f.state = "dead";
    f.stocks--;
    f.falls++;
    f.respawn = 86;
    f.trail = [];
    f.move = null;
    const b = this.arena.blast;
    const x = Math.max(b.l + 50, Math.min(b.r - 50, f.x));
    const y = Math.max(b.t + 50, Math.min(b.b - 50, f.y));
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 12;
      if (!this.canSpawn()) continue;
      this.parts.push({
        type: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 40, max: 40, color: i % 2 ? f.def.color : "#fff", g: 0,
      });
    }
    this.ring(x, y, f.def.accent, 130);
    this.shake = Math.max(this.shake, 16);
    this.flashWhite = Math.max(this.flashWhite, 0.5);
    sfx("ko");
    const credited = f.lastHitBy >= 0 && this.frame - f.lastHitT < 320;
    if (credited) this.fighters[f.lastHitBy].kos++;
    const moveName = credited ? f.lastMove : "Self-Destruct";
    const kind = credited ? f.lastKind : "sd";
    if (this.cine && this.cine.victim === f.slot) {
      this.cine.x = x;
      this.cine.y = y;
      this.cine.koT = this.cine.t;
      this.cine.move = moveName || this.cine.move;
      return;
    }
    if (!this.cine && !this.cfg.training && this.aliveTeams().size <= 1) {
      if (f.doomed) {
        const winner = this.fighters.find((o) => o.stocks > 0);
        this.cine = {
          t: 0, victim: f.slot, winner: winner?.slot ?? -1,
          move: moveName, kind, x, y, announced: false, koT: 0,
        };
        sfx("impact");
      } else {
        f.respawn = 999;
        this.endLag = 54;
      }
    }
  }

  aliveTeams() {
    return new Set(this.fighters.filter((f) => f.stocks > 0).map((f) => f.team));
  }

  checkEnd() {
    if (this.cfg.training || this.over || this.cine || this.intro > 60) return;
    if (this.aliveTeams().size <= 1) this.finish();
  }

  finish() {
    if (this.over) return;
    this.over = true;
    const teams = [...this.aliveTeams()];
    const win = teams[0];
    const winners = this._forfeit != null
      ? this.fighters.filter((f) => f.slot !== this._forfeit).map((f) => f.slot)
      : this.fighters.filter((f) => f.team === win && f.stocks > 0).map((f) => f.slot);
    const payload = {
      winnerSlots: winners,
      stats: this.fighters.map((f) => ({
        slot: f.slot,
        name: f.def.name,
        color: f.def.color,
        accent: f.def.accent,
        kos: f.kos,
        falls: f.falls,
        dealt: Math.round(f.dealt),
        label: f.ctrl.type === "human" ? `P${f.ctrl.scheme + 1}` : f.ctrl.level === 0 ? "DUMMY" : `CPU ${f.ctrl.level}`,
      })),
      finisher: this.cine?.move || "",
      training: !!this.cfg.training,
    };
    this.destroy();
    this.onEnd(payload);
  }

  quit() {
    if (this.cfg.online) this._forfeit = this.cfg.online.localSlot;
    this.finish();
  }

  burst(x, y, color, n, speed) {
    const count = this.reduced ? Math.ceil(n * 0.45) : n;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * speed + 1;
      const life = 16 + Math.random() * 12;
      if (i >= 16 || !this.canSpawn()) continue;
      this.parts.push({
        type: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life, max: 28, color, g: 0.08,
      });
    }
  }

  ring(x, y, color, reach) {
    if (!this.canSpawn()) return;
    this.parts.push({ type: "ring", x, y, r: 8, grow: reach / 16, life: 16, max: 16, color, vx: 0, vy: 0, g: 0 });
  }

  dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      const vx = (Math.random() - 0.5) * 4;
      const vy = -Math.random() * 1.6;
      const size = 3 + Math.random() * 3;
      if (!this.canSpawn()) continue;
      this.parts.push({
        type: "shard", x, y, vx, vy,
        life: 16, max: 16, color: "rgba(255,255,255,0.7)", size, g: 0.05,
      });
    }
  }

  pop() {}

  canSpawn() {
    if (this.parts.length >= 180 || (this._spawned || 0) >= 120) return false;
    this._spawned = (this._spawned || 0) + 1;
    return true;
  }

  fxPush(p) {
    if (!this.canSpawn()) return;
    this.parts.push(p);
  }

  fxStyle(shape) {
    if (shape === "fencer" || shape === "lancer") return "cut";
    if (shape === "archer") return "line";
    if (shape === "witch" || shape === "trick") return "hex";
    if (shape === "heavy") return "shock";
    if (shape === "brawler" || shape === "grappler") return "fist";
    return "slash";
  }

  fxSpark(x, y, vx, vy, life, color) {
    this.fxPush({ type: "spark", x, y, vx, vy, life, max: life, color, g: 0 });
  }

  attackFx(f, m) {
    if (this.parts.length >= 170) return;
    const face = f.facing || 1;
    const accent = f.def.accent;
    const color = f.def.color;
    const hb = m.hb || { x: 20, y: -36, w: 16, h: 16 };
    const hx = f.x + hb.x * face;
    const hy = f.y + hb.y;
    const skip = (i) => this.reduced && i % 2 === 1;
    if (m.projectile) {
      for (let i = 0; i < 4; i++) {
        if (skip(i)) continue;
        const a = -0.55 + i * 0.36;
        this.fxSpark(hx, hy, Math.cos(a) * (2 + i * 0.35) * face, Math.sin(a) * (2 + i * 0.35), 8, i % 2 ? "#fffaf2" : accent);
      }
      return;
    }
    if (m.counter) {
      for (let i = 0; i < 5; i++) {
        if (skip(i)) continue;
        const a = -1.05 + i * 0.52;
        this.fxSpark(
          f.x + Math.cos(a) * 14 * face,
          f.y - f.def.h * 0.55 + Math.sin(a) * 14,
          Math.cos(a) * 1.3 * face,
          Math.sin(a) * 1.3,
          8,
          accent,
        );
      }
      return;
    }
    if (m.meteor) {
      for (let i = 0; i < 4; i++) {
        if (skip(i)) continue;
        this.fxSpark(hx + (i - 1.5) * 4 * face, hy - 6, (i - 1.5) * 0.4 * face, 2.2 + i * 0.3, 10, i % 2 ? accent : color);
      }
      if (f.grounded) this.fxDust(f);
      return;
    }
    if (m.grab) return;
    if (m.kind === "dash") {
      for (let i = 0; i < 5; i++) {
        if (skip(i)) continue;
        this.fxSpark(
          f.x - face * (6 + i * 7),
          f.y - f.def.h * (0.3 + (i % 3) * 0.1),
          -face * (1.5 + i * 0.3),
          (i - 2) * 0.22,
          9,
          i % 2 ? accent : color,
        );
      }
      return;
    }
    if (m.kind === "up") {
      for (let i = 0; i < 5; i++) {
        if (skip(i)) continue;
        this.fxSpark(f.x + (i - 2) * 4, f.y - 4 - i * 6, (i - 2) * 0.22, -1.5 - i * 0.25, 12, i % 2 ? accent : color);
      }
      return;
    }
    if (m.kind === "heavy") {
      this.fxShape(f, hx, hy, face, true);
      if (f.grounded) this.fxDust(f);
      return;
    }
    this.fxShape(f, hx, hy, face, false);
  }

  fxShape(f, hx, hy, face, wide) {
    const style = this.fxStyle(f.def.shape);
    const accent = f.def.accent;
    const color = f.def.color;
    const n = wide ? 6 : 4;
    const speed = wide ? 2.6 : 2;
    if (style === "hex") {
      for (let i = 0; i < 3; i++) {
        if (this.reduced && i === 2) continue;
        const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
        this.fxSpark(hx, hy, Math.cos(a) * speed, Math.sin(a) * speed, 9, accent);
      }
      return;
    }
    if (style === "fist") {
      const count = wide ? 6 : 4;
      for (let i = 0; i < count; i++) {
        if (this.reduced && i % 2) continue;
        const a = (i / count) * Math.PI * 2;
        this.fxSpark(hx, hy, Math.cos(a) * speed, Math.sin(a) * speed, 8, i % 2 ? accent : color);
      }
      return;
    }
    if (style === "line") {
      for (let i = 0; i < 3; i++) {
        this.fxSpark(hx - face * i * 5, hy, face * (1.8 + i * 0.45), (i - 1) * 0.35, 8, i === 1 ? "#fffaf2" : accent);
      }
      return;
    }
    if (style === "shock") {
      for (let i = 0; i < n; i++) {
        if (this.reduced && i % 2) continue;
        const a = -0.5 + (i / (n - 1)) * 1.4;
        this.fxSpark(hx, hy, Math.cos(a) * speed * face, Math.sin(a) * speed, 10, i % 2 ? accent : color);
      }
      return;
    }
    const count = style === "cut" ? 3 : n;
    for (let i = 0; i < count; i++) {
      if (this.reduced && i % 2) continue;
      const a = -0.5 + i * (style === "cut" ? 0.45 : 0.32);
      this.fxSpark(hx, hy, Math.cos(a) * speed * face, Math.sin(a) * speed, 8, i % 2 ? "#fffaf2" : accent);
    }
  }

  fxDust(f) {
    for (let i = 0; i < 4; i++) {
      if (this.reduced && i % 2) continue;
      const side = i < 2 ? -1 : 1;
      this.fxPush({
        type: "shard",
        x: f.x + side * (7 + i * 4),
        y: f.y,
        vx: side * (1.1 + (i % 2) * 0.7),
        vy: -0.4 - (i % 3) * 0.25,
        life: 13,
        max: 13,
        color: "rgba(243,236,223,0.82)",
        size: 3 + (i % 2) * 2,
        g: 0.06,
      });
    }
  }

  attackTrail(f, m) {
    if (this.parts.length >= 180 || (this.frame & 1) !== 0) return;
    if (m.projectile || m.grab || m.counter) return;
    const face = f.facing || 1;
    const color = (this.frame + f.slot) % 2 ? f.def.accent : f.def.color;
    if (m.kind === "dash") this.fxSpark(f.x - face * 10, f.y - f.def.h * 0.4, -face * 2, 0, 7, color);
    else if (m.kind === "up") {
      this.fxPush({
        type: "ember",
        x: f.x + ((this.frame + f.slot) % 3 - 1) * 4,
        y: f.y,
        vx: 0,
        vy: 0.7,
        life: 10,
        max: 10,
        color,
        size: 2.4,
        g: 0,
      });
    } else if (m.meteor && m.hb) {
      this.fxSpark(f.x + m.hb.x * face, f.y + m.hb.y, 0, -1.1, 8, f.def.accent);
    }
  }

  stick(f) {
    if (this.intro > 60) return { ix: 0, iy: 0 };
    if (f._in) {
      return {
        ix: (f._in.right ? 1 : 0) - (f._in.left ? 1 : 0),
        iy: (f._in.down ? 1 : 0) - (f._in.up ? 1 : 0),
      };
    }
    if (f.ctrl.type !== "human") {
      if (!f.ctrl.level) return { ix: 0, iy: 0 };
      return { ix: f.x > 40 ? -1 : f.x < -40 ? 1 : 0, iy: f.y > 20 ? -1 : 0 };
    }
    const arrows = f.ctrl.scheme !== 1;
    const left = this.keys[arrows ? "KeyA" : "ArrowLeft"] || (arrows && this.keys.ArrowLeft);
    const right = this.keys[arrows ? "KeyD" : "ArrowRight"] || (arrows && this.keys.ArrowRight);
    const up = this.keys[arrows ? "KeyW" : "ArrowUp"] || (arrows && this.keys.ArrowUp);
    const down = this.keys[arrows ? "KeyS" : "ArrowDown"] || (arrows && this.keys.ArrowDown);
    return {
      ix: (right ? 1 : 0) - (left ? 1 : 0),
      iy: (down ? 1 : 0) - (up ? 1 : 0),
    };
  }

  updateCam(w, h) {
    let tx = 0;
    let ty = -160;
    let tz = 0.72;
    if (this.cine) {
      const c = this.cine;
      const v = this.fighters[c.victim];
      if (c.koT < 0 && v && v.state !== "dead") {
        tx = v.x;
        ty = v.y - v.def.h * 0.55;
        tz = 1.32;
      } else {
        tx = c.x * 0.45;
        ty = c.y * 0.4;
        tz = 1.02;
      }
    } else {
      const alive = this.fighters.filter((f) => f.state !== "dead");
      if (alive.length) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const f of alive) {
          minX = Math.min(minX, f.x);
          maxX = Math.max(maxX, f.x);
          minY = Math.min(minY, f.y - f.def.h);
          maxY = Math.max(maxY, f.y);
        }
        minX = Math.min(minX, -340);
        maxX = Math.max(maxX, 340);
        maxY = Math.max(maxY, 30);
        minY = Math.min(minY, -260);
        tx = (minX + maxX) / 2;
        ty = (minY + maxY) / 2 - 20;
        tz = Math.max(0.5, Math.min(1.12, Math.min(w / (maxX - minX + 560), h / (maxY - minY + 420))));
      }
    }
    tz += this.punch;
    const n = this.cine ? 0.1 : 0.075;
    this.cam.x += (tx - this.cam.x) * n;
    this.cam.y += (ty - this.cam.y) * n;
    this.cam.z += (tz - this.cam.z) * (this.cine ? 0.08 : 0.06);
  }

  render() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = this.canvas.width / dpr;
    const cssH = this.canvas.height / dpr;
    this.updateCam(cssW, cssH);
    drawWorld(this.ctx, this, cssW, cssH, dpr);
  }
}
