// Blade deaths: the stickman is cut into its limb segments, which fly apart,
// tumble, bounce and settle. Pieces use screen-x and height-above-ground.
import { HEAD_R, INK, drawHead } from './player.js';

const GRAVITY = 1700;
const LEFT_WALL = 14; // pieces bounce off the screen edge so the head (and face) stays visible
const DRIP_EVERY = 0.045;
const rand = (a, b) => a + Math.random() * (b - a);

export class Gibs {
  constructor() {
    this.reset();
  }

  reset() {
    this.pieces = [];
    this.onDrip = null;
  }

  get idle() {
    return this.pieces.every((p) => p.rest);
  }

  /** Splits a pose (feet at screen-x `x`, height `h`) into flying pieces. */
  burst(pose, x, h, { onDrip = null } = {}) {
    this.onDrip = onDrip;
    const at = (p) => ({ x: x + p.x, h: h - p.y });
    const segment = (a, b) => {
      const p = at(a);
      const q = at(b);
      return { x: (p.x + q.x) / 2, h: (p.h + q.h) / 2, len: Math.hypot(q.x - p.x, q.h - p.h), angle: Math.atan2(p.h - q.h, q.x - p.x) };
    };
    const parts = [segment(pose.hip, pose.neck)];
    for (const [a, b, c] of [...pose.legs, ...pose.arms]) parts.push(segment(a, b), segment(b, c));
    parts.push({ ...at(pose.head), len: HEAD_R * 2, angle: pose.headRot, head: true });

    this.pieces = parts.map((p) => ({
      ...p,
      vx: p.head ? rand(-110, 90) : rand(-260, 160), // mostly thrown back, away from the blade
      vy: rand(260, 720) * (p.head ? 1.15 : 1),
      spin: rand(-16, 16),
      drip: rand(0, DRIP_EVERY),
      rest: false,
    }));
  }

  update(dt, dx) {
    for (const p of this.pieces) {
      p.x -= dx;
      if (p.rest) continue;
      p.vy -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.h += p.vy * dt;
      p.angle += p.spin * dt;
      if (p.x < LEFT_WALL) {
        p.x = LEFT_WALL;
        p.vx = Math.abs(p.vx) * 0.4;
      }

      // Lowest point of a spinning stick (or the head's radius) touches the floor.
      const reach = p.head ? HEAD_R : Math.abs(Math.sin(p.angle)) * (p.len / 2) + 2.5;
      if (p.h < reach) {
        p.h = reach;
        p.vy = Math.abs(p.vy) > 120 ? -p.vy * 0.32 : 0;
        p.vx *= 0.6;
        p.spin *= 0.55;
        if (p.vy === 0 && Math.abs(p.vx) < 20) p.rest = true;
      }

      if (this.onDrip && p.h > reach + 2) {
        p.drip -= dt;
        if (p.drip <= 0) {
          p.drip = DRIP_EVERY;
          this.onDrip(p.x, p.h);
        }
      }
    }
  }

  draw(ctx, gy, skin, face) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5.5;
    for (const p of this.pieces) {
      const y = gy - p.h;
      if (p.head) {
        ctx.save();
        ctx.translate(p.x, y);
        drawHead(ctx, { head: { x: 0, y: 0 }, headRot: p.angle }, skin, face);
        ctx.restore();
        continue;
      }
      const ux = (Math.cos(p.angle) * p.len) / 2;
      const uy = (Math.sin(p.angle) * p.len) / 2;
      ctx.beginPath();
      ctx.moveTo(p.x - ux, y + uy);
      ctx.lineTo(p.x + ux, y - uy);
      ctx.stroke();
    }
  }
}
