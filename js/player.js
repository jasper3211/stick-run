import { WORLD, clamp, lerp } from './config.js';

// Collision boxes relative to the runner's feet (x right, height up).
const STAND = { x: -11, w: 22, h: 72 };
const SLIDE = { x: -22, w: 44, h: 30 };

const THIGH = 17;
const SHIN = 17;
const UPPER = 13;
const FORE = 12;
export const HEAD_R = 14;
const TAU = Math.PI * 2;
const LAND_TIME = 0.16;
const FLIP_TIME = 0.42; // one full forward flip on the double jump

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.h = 0;
    this.vy = 0;
    this.grounded = true;
    this.sliding = false;
    this.slideHeld = false;
    this.slideTime = 0;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.airJumps = 1;
    this.flip = 0; // 0 = upright, 0..1 = progress through a flip
    this.phase = 0;
    this.landTimer = 0;
    this.dead = false;
    this.deathX = 0;
    this.deathVx = 0;
    this.rot = 0;
    this.spin = 0;
  }

  requestJump() {
    if (!this.dead) this.jumpBuffer = WORLD.jumpBufferTime;
  }

  /** Returns true when a new slide actually started (for the sound effect). */
  setSlide(held) {
    this.slideHeld = held;
    if (!held || this.sliding || this.dead) return false;
    this.sliding = true;
    this.slideTime = 0;
    if (!this.grounded) this.vy = Math.min(this.vy, -WORLD.fastFallVelocity);
    return true;
  }

  kill() {
    this.dead = true;
    this.flip = 0;
    this.sliding = false;
    this.grounded = false;
    this.vy = 560;
    this.deathVx = -170;
    this.spin = -4;
  }

  /** World-space hitbox; `standing` forces the upright box (used for "can I stand up?"). */
  box(distance, standing = false) {
    const b = this.sliding && !standing ? SLIDE : STAND;
    const left = distance + b.x;
    return { left, right: left + b.w, bottom: this.h, top: this.h + b.h };
  }

  /**
   * Advances one fixed step. `floor` is the height of whatever is under the feet:
   * 0 for the ground, or the top of a crate the runner can stand on.
   * Returns sound events ("jump", "jump2", "land").
   */
  update(dt, speed, blockedAbove, floor = 0) {
    const events = [];
    if (this.dead) {
      this.updateDeath(dt, floor);
      return events;
    }

    this.phase += dt * (speed / 26);
    this.jumpBuffer -= dt;
    if (this.grounded && this.h > floor + 0.5) {
      this.grounded = false; // ran off the edge of a crate
      this.vy = 0;
    }
    this.coyote = this.grounded ? WORLD.coyoteTime : this.coyote - dt;

    if (this.jumpBuffer > 0 && !(this.sliding && blockedAbove)) {
      if (this.coyote > 0) {
        this.launch(WORLD.jumpVelocity);
        events.push('jump');
      } else if (this.airJumps > 0) {
        this.airJumps--;
        this.launch(WORLD.doubleJumpVelocity);
        this.flip = 0.001;
        events.push('jump2');
      }
    }

    if (this.flip > 0) this.flip = this.flip + dt / FLIP_TIME >= 1 ? 0 : this.flip + dt / FLIP_TIME;

    if (!this.grounded) {
      this.vy -= WORLD.gravity * dt;
      this.h += this.vy * dt;
      if (this.vy <= 0 && this.h <= floor) {
        this.h = floor;
        this.vy = 0;
        this.grounded = true;
        this.airJumps = 1;
        this.flip = 0; // always land upright
        this.landTimer = LAND_TIME;
        events.push('land');
      }
    }

    if (this.sliding) {
      this.slideTime += dt;
      // Never stand up underneath an overhead hazard: that collision would feel unfair.
      if (!this.slideHeld && this.slideTime >= WORLD.slideMinTime && !blockedAbove) this.sliding = false;
    }

    this.landTimer = Math.max(0, this.landTimer - dt);
    return events;
  }

  launch(velocity) {
    this.sliding = false;
    this.vy = velocity;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
  }

  updateDeath(dt, floor) {
    this.vy -= WORLD.gravity * dt;
    this.h += this.vy * dt;
    this.deathX += this.deathVx * dt;
    this.deathVx *= Math.max(0, 1 - 2.5 * dt);
    if (this.h <= floor) {
      this.h = floor;
      this.vy = this.vy < -220 ? -this.vy * 0.25 : 0;
      this.spin = 0;
      this.rot = lerp(this.rot, -1.45, Math.min(1, dt * 10));
      this.deathVx *= 0.9;
    } else {
      this.rot += this.spin * dt;
    }
  }

  /** Body rotation for drawing: the death tumble, or the double-jump flip (eased out). */
  angle() {
    if (this.dead) return this.rot;
    if (this.flip <= 0) return 0;
    return (1 - (1 - this.flip) ** 2) * TAU;
  }

  pose() {
    if (this.dead) return deadPose();
    if (this.flip > 0) return jumpPose(WORLD.jumpVelocity); // tucked while flipping
    if (this.sliding) return slidePose(this.phase);
    if (!this.grounded) return jumpPose(this.vy);
    return runPose(this.phase, this.landTimer / LAND_TIME);
  }
}

/* ---------------------------------------------------------------- poses -- */
// Local coordinates: origin at the feet, +x forward, +y down (canvas space).
// Limb angles are measured from straight down; positive swings forward.

const pt = (x, y) => ({ x, y });
const limb = (from, angle, len) => pt(from.x + Math.sin(angle) * len, from.y + Math.cos(angle) * len);

function leg(hip, thigh, bend) {
  const knee = limb(hip, thigh, THIGH);
  return [hip, knee, limb(knee, thigh - bend, SHIN)];
}

function arm(shoulder, upper, bend) {
  const elbow = limb(shoulder, upper, UPPER);
  return [shoulder, elbow, limb(elbow, upper + bend, FORE)];
}

function torso(hip, neck, headRot) {
  const dx = neck.x - hip.x;
  const dy = neck.y - hip.y;
  const len = Math.hypot(dx, dy);
  const head = pt(neck.x + (dx / len) * (HEAD_R + 1), neck.y + (dy / len) * (HEAD_R + 1));
  const shoulder = pt(hip.x + dx * 0.86, hip.y + dy * 0.86);
  return { hip, neck, head, shoulder, headRot };
}

export function runPose(phase, crouch = 0) {
  const hip = pt(0, -34 + 3 * Math.abs(Math.sin(phase)) + crouch * 8);
  const t = torso(hip, pt(hip.x + 6, hip.y - 23), Math.sin(phase * 2) * 0.05);
  const legs = [0, Math.PI].map((o) => {
    const a = phase + o;
    return leg(hip, Math.sin(a) * 0.65 + crouch * 0.3, 0.15 + 1.25 * Math.max(0, Math.cos(a)) + crouch * 0.9);
  });
  const arms = [Math.PI, 0].map((o) => {
    const a = phase + o;
    return arm(t.shoulder, Math.sin(a) * 0.9, 1.3 + Math.max(0, Math.sin(a)) * 0.4);
  });
  return { ...t, legs, arms };
}

function jumpPose(vy) {
  const k = (clamp(vy / WORLD.jumpVelocity, -1, 1) + 1) / 2; // 1 = takeoff, 0 = falling fast
  const hip = pt(0, -36);
  const t = torso(hip, pt(5, -59), -0.12);
  return {
    ...t,
    legs: [leg(hip, 1.1, 1.9), leg(hip, -0.4, 1.1)],
    arms: [arm(t.shoulder, lerp(1.4, 2.7, k), 0.4), arm(t.shoulder, lerp(-1.2, 2.3, k), 0.4)],
  };
}

function slidePose(phase) {
  const f = Math.sin(phase * 2) * 1.5;
  const hip = pt(-2, -11);
  const t = torso(hip, pt(-21, -21), -0.35);
  return {
    ...t,
    legs: [
      [hip, pt(12, -8), pt(27, -3)],
      [hip, pt(9, -19), pt(21, -11)],
    ],
    arms: [
      [t.shoulder, pt(-8, -27), pt(3, -31 + f)],
      [t.shoulder, pt(-27, -10), pt(-33, -1)],
    ],
  };
}

function deadPose() {
  const hip = pt(0, -36);
  const t = torso(hip, pt(3, -59), 0.3);
  return {
    ...t,
    legs: [leg(hip, 0.7, 0.4), leg(hip, -0.5, 0.3)],
    arms: [arm(t.shoulder, 2.2, 0.2), arm(t.shoulder, -2.0, 0.2)],
  };
}

/* -------------------------------------------------------------- drawing -- */

const INK = '#0a0a0c';
const INK_BACK = '#34383f'; // far-side limbs, for a hint of depth

function strokeParts(ctx, parts, color) {
  const path = new Path2D();
  for (const pts of parts) {
    path.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 5.5;
  ctx.stroke(path);
}

function drawHead(ctx, pose, skin, face) {
  const r = HEAD_R;
  ctx.save();
  ctx.translate(pose.head.x, pose.head.y);
  ctx.rotate(pose.headRot);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = INK;
  ctx.fill();
  if (face) {
    ctx.save();
    ctx.clip();
    ctx.drawImage(face, -r, -r, r * 2, r * 2);
    ctx.restore();
  } else {
    // Default head: a visor stripe facing the running direction.
    ctx.strokeStyle = skin.accent;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(1, -3);
    ctx.lineTo(r - 4, -3);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

/** Draws the stickman with its feet at (x, y). */
export function drawFigure(ctx, x, y, pose, skin, face, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) {
    ctx.translate(pose.hip.x, pose.hip.y);
    ctx.rotate(rot);
    ctx.translate(-pose.hip.x, -pose.hip.y);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  strokeParts(ctx, [pose.legs[1], pose.arms[1]], INK_BACK);
  strokeParts(ctx, [[pose.hip, pose.neck], pose.legs[0]], INK);
  drawHead(ctx, pose, skin, face);
  strokeParts(ctx, [pose.arms[0]], INK);
  ctx.restore();
}

export function drawShadow(ctx, x, groundY, h) {
  const s = Math.max(0.25, 1 - h / 220);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x, groundY + 2, 20 * s, 4 * s, 0, 0, TAU);
  ctx.fill();
}

/** Idle-running character on a small platform for the menu and customise panel. */
export function drawPreview(canvas, t, skin, face) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!w || !h) return;
  const s = h / 125;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  const lw = w / s;
  const gy = 108;
  const cx = lw / 2;

  ctx.fillStyle = '#c6ff3d';
  ctx.fillRect(cx - 70, gy, 140, 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  const off = (t * 140) % 22;
  for (let x = cx - 70 - off + 22; x < cx + 70; x += 22) ctx.fillRect(x, gy + 5, 9, 1.5);

  drawShadow(ctx, cx, gy, 0);
  drawFigure(ctx, cx, gy, runPose(t * 10), skin, face);
}
