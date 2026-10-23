// Bounded particle system: impact splatter, coin sparkles, screen shake and flash.
// Particle positions use screen-x and height-above-ground, like the rest of the world.

const MAX_PARTICLES = 260;
const MAX_DECALS = 36;
const TAU = Math.PI * 2;
const BLOOD = ['#ff2d3d', '#d1121f', '#ff4a55', '#9b0b16'];
const SPARK = ['#ffffff', '#dfe6ee', '#c6ff3d'];
const GLASS = ['#ffffff', '#d9f2ff', '#a8dcff'];
const pick = (list) => list[(Math.random() * list.length) | 0];
const rand = (a, b) => a + Math.random() * (b - a);

export class Effects {
  constructor() {
    this.reset();
  }

  reset() {
    this.particles = [];
    this.decals = [];
    this.shake = 0;
    this.shakeAmp = 0;
    this.flash = 0;
    this.flashColor = '255, 45, 61';
  }

  get idle() {
    return this.particles.length === 0 && this.shake <= 0 && this.flash <= 0;
  }

  add(p) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    p.max = p.life;
    this.particles.push(p);
  }

  impact(x, h, { blood, reduced }) {
    const n = reduced ? 26 : 84;
    for (let i = 0; i < n; i++) {
      const a = rand(0.15 * Math.PI, 1.05 * Math.PI); // up and back, away from the obstacle
      const v = rand(120, 620);
      this.add({
        x,
        h: h + rand(-8, 8),
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rand(0.5, 1.2),
        size: rand(1.4, 4.2),
        color: blood ? pick(BLOOD) : pick(SPARK),
        kind: blood ? (Math.random() < 0.35 ? 'streak' : 'drop') : 'spark',
        blood,
      });
    }
    if (blood && !reduced) {
      for (let i = 0; i < 6; i++) {
        this.add({ x, h, vx: rand(-90, 40), vy: rand(-30, 90), life: 0.28, size: rand(8, 14), color: '#ff2d3d', kind: 'mist' });
      }
    }
    this.flashColor = blood ? '255, 45, 61' : '255, 255, 255';
    this.flash = reduced ? 0.14 : 0.32;
    if (!reduced) {
      this.shake = 0.35;
      this.shakeAmp = 9;
    }
  }

  /** Glass shards bursting forward from a pane the runner smashed through. */
  shatter(x, height, reduced) {
    const n = reduced ? 14 : 40;
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + rand(0, 12),
        h: rand(4, height),
        vx: rand(60, 460),
        vy: rand(-60, 360),
        life: rand(0.6, 1.1),
        size: rand(2.5, 6),
        color: pick(GLASS),
        kind: 'shard',
        rot: rand(0, TAU),
        spin: rand(-14, 14),
      });
    }
    this.flashColor = '220, 240, 255';
    this.flash = Math.max(this.flash, reduced ? 0.05 : 0.12);
  }

  /** A single falling blood drop (trail from a flying body part). */
  drip(x, h) {
    this.add({ x, h, vx: rand(-40, 40), vy: rand(-20, 60), life: 0.8, size: rand(1.4, 2.6), color: pick(BLOOD), kind: 'drop', blood: true });
  }

  sparkle(x, h, color = '#ffd56e', n = 8) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.add({ x, h, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, life: 0.35, size: 2.2, color, kind: 'spark', light: true });
    }
  }

  update(dt, dx) {
    let write = 0;
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt - dx;
      p.h += p.vy * dt;
      p.vy -= (p.light ? 300 : p.kind === 'mist' ? 0 : 1500) * dt;
      p.vx *= Math.max(0, 1 - 0.8 * dt);
      if (p.spin) p.rot += p.spin * dt;
      if (p.h <= 0 && p.kind !== 'mist') {
        if (p.blood) {
          if (Math.random() < 0.5) this.addDecal(p.x, p.size);
          p.life = 0;
        } else {
          p.h = 0;
          p.vy = -p.vy * 0.35;
        }
      }
      if (p.life > 0) this.particles[write++] = p;
    }
    this.particles.length = write;

    if (dx) {
      for (const d of this.decals) d.x -= dx;
      this.decals = this.decals.filter((d) => d.x > -60);
    }
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt * 1.8);
  }

  addDecal(x, size) {
    if (this.decals.length >= MAX_DECALS) this.decals.shift();
    this.decals.push({ x, rx: size * rand(1.8, 3), ry: size * 0.5, color: pick(BLOOD) });
  }

  offset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    const a = this.shakeAmp * (this.shake / 0.35);
    return { x: rand(-a, a), y: rand(-a, a) };
  }

  drawDecals(ctx, gy) {
    ctx.globalAlpha = 0.8;
    for (const d of this.decals) {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.ellipse(d.x, gy + 1, d.rx, d.ry, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx, gy) {
    for (const p of this.particles) {
      const y = gy - p.h;
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6) * (p.kind === 'mist' ? 0.35 : 1);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.kind === 'streak') {
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, y);
        ctx.lineTo(p.x - p.vx * 0.03, y + p.vy * 0.03);
        ctx.stroke();
      } else if (p.kind === 'shard') {
        ctx.save();
        ctx.translate(p.x, y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(-p.size, p.size * 0.5);
        ctx.lineTo(p.size * 0.3, -p.size);
        ctx.lineTo(p.size, p.size * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'spark') {
        ctx.fillRect(p.x - p.size / 2, y - p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawFlash(ctx, w, h) {
    if (this.flash <= 0) return;
    ctx.fillStyle = `rgba(${this.flashColor}, ${this.flash * 0.6})`;
    ctx.fillRect(0, 0, w, h);
  }
}
