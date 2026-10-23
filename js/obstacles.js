import { WORLD, clamp, lerp } from './config.js';
import { drawObstacle, drawCoin, drawGlass } from './obstacle-art.js';

// h = hazard height for ground obstacles; overhead hazards start `gap` above the ground.
export const TYPES = {
  crate: { w: 46, h: 46, from: 0, weight: 5, platform: true },
  barrier: { w: 76, h: 34, from: 0, weight: 3 },
  // The crusher reaches up off-screen so it can only be passed by sliding, not double-jumped.
  beam: { w: 92, h: 600, gap: 46, from: 1600, weight: 3, overhead: true },
  stack: { w: 46, h: 88, from: 5000, weight: 2, platform: true },
  spikes: { w: 68, h: 22, from: 8000, weight: 2 },
  // Spinning saw half-sunk in the floor: deadly only inside its round blade.
  saw: { w: 54, h: 27, from: 2500, weight: 3, blade: { cy: 0, r: 27 }, bladeOnly: true },
  // A crate with a saw spinning out of its top: solid sides, and no standing on it.
  sawbox: { w: 50, h: 70, body: 46, from: 6000, weight: 2, blade: { cy: 46, r: 24 } },
};

const GLASS = { w: 12, h: 120 }; // breakable pane: harmless, shatters when run through

const FIRST_OBSTACLE_X = 1000;
const COIN_R = 9;
const STEP_UP = 6; // how far below a crate top the feet may be and still count as on top

/** True when the runner's box touches a round blade (with a 3-unit forgiving margin). */
function bladeHit(box, cx, cy, r) {
  const nx = clamp(cx, box.left, box.right);
  const nh = clamp(cy, box.bottom, box.top);
  return (cx - nx) ** 2 + (cy - nh) ** 2 < (r - 3) ** 2;
}

/**
 * Minimum seconds of travel between the end of one hazard and the start of the next,
 * covering the 0.66 s jump arc, the 0.3 s minimum slide and the time to react.
 */
export function reactionTime(prev, next) {
  if (!prev) return 0;
  if (prev.overhead && next.overhead) return 0.35; // keep holding slide
  if (prev.overhead) return 0.55; // stand up (or jump straight out of the slide)
  if (next.overhead) return 0.72; // land, then slide
  return 0.82; // land, then jump again
}

export class ObstacleField {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
  }

  reset() {
    this.items = [];
    this.coins = [];
    this.glass = [];
    this.spawnedGlass = 0;
    this.cursor = FIRST_OBSTACLE_X; // world x where the last hazard ends
    this.prev = null;
    this.overheadStreak = 0;
  }

  /** Spawns ahead of the camera and culls what scrolled off-screen. */
  update(distance, speed, viewW) {
    const horizon = distance + viewW - WORLD.playerX + 200;
    let guard = 0;
    while (this.cursor < horizon && guard++ < 8) this.spawn(distance, speed);

    const behind = distance - WORLD.playerX - 120;
    this.items = this.items.filter((o) => o.x + o.w > behind);
    this.coins = this.coins.filter((c) => !c.taken && c.x > behind);
    this.glass = this.glass.filter((g) => !g.broken && g.x + g.w > behind);
  }

  pickType(at) {
    const r = this.random;
    const pool = Object.entries(TYPES).filter(([name, t]) => {
      if (at < t.from) return false;
      return !(t.overhead && this.overheadStreak >= 2);
    });
    let roll = r() * pool.reduce((sum, [, t]) => sum + t.weight, 0);
    for (const [name, t] of pool) {
      roll -= t.weight;
      if (roll <= 0) return name;
    }
    return pool[0][0];
  }

  spawn(distance, speed) {
    const r = this.random;
    const difficulty = clamp(this.cursor / 60000, 0, 1);
    const type = this.pickType(this.cursor);
    const spec = TYPES[type];

    const minGap = speed * reactionTime(this.prev, spec);
    let extra = speed * (lerp(0.85, 0.3, difficulty) + r() * lerp(0.9, 0.55, difficulty));
    if (r() < 0.1) extra += speed * 1.0; // breather
    const gapStart = this.cursor;
    const x = this.prev ? this.cursor + minGap + extra : this.cursor;

    const group = [this.make(type, x)];
    // Later on, pair two low hazards into one wider jump (still clearable at base speed).
    if (!spec.overhead && spec.h <= 50 && this.cursor > 6000 && r() < 0.22) {
      const second = r() < 0.5 ? 'crate' : 'barrier';
      group.push(this.make(second, x + spec.w));
    }

    this.items.push(...group);
    const last = group[group.length - 1];
    if (this.prev) {
      this.addGapCoins(gapStart, x, speed);
      this.addGlass(gapStart, x, speed);
    }
    this.addHazardCoins(group, speed);

    this.cursor = last.x + last.w;
    this.prev = spec.overhead ? spec : { ...TYPES[last.type] };
    this.overheadStreak = spec.overhead ? this.overheadStreak + 1 : 0;
  }

  make(type, x) {
    const t = TYPES[type];
    const bottom = t.overhead ? t.gap : 0;
    return {
      type,
      x,
      w: t.w,
      bottom,
      top: bottom + t.h,
      rectTop: bottom + (t.body ?? t.h), // solid box part (excludes a blade on top)
      overhead: !!t.overhead,
      platform: !!t.platform,
      blade: t.blade || null,
      bladeOnly: !!t.bladeOnly,
    };
  }

  addGlass(from, to, speed) {
    const gap = to - from;
    if (gap < speed * 0.8 || this.random() > 0.3) return;
    this.glass.push({ x: from + gap * 0.3, w: GLASS.w, h: GLASS.h, broken: false });
    this.spawnedGlass++;
  }

  /** Breaks every glass pane the runner touches and returns the newly broken ones. */
  smash(box) {
    const hit = [];
    for (const g of this.glass) {
      if (g.broken || box.right <= g.x || box.left >= g.x + g.w || box.bottom >= g.h) continue;
      g.broken = true;
      hit.push(g);
    }
    return hit;
  }

  addGapCoins(from, to, speed) {
    const gap = to - from;
    if (gap < speed * 0.9 || this.random() > 0.4) return;
    const n = clamp(Math.floor((gap - speed * 0.5) / 40), 2, 5);
    const mid = (from + to) / 2;
    for (let i = 0; i < n; i++) this.addCoin(mid + (i - (n - 1) / 2) * 36, 22);
  }

  addHazardCoins(group, speed) {
    const first = group[0];
    const last = group[group.length - 1];
    const center = (first.x + last.x + last.w) / 2;
    if (first.overhead) {
      if (this.random() < 0.5) for (let i = -1; i <= 1; i++) this.addCoin(center + i * 30, 16);
      return;
    }
    if (group.length > 1 || first.top > 50 || this.random() > 0.35) return;
    // Three coins along the jump arc, centred on the hazard at the runner's torso height.
    for (let k = -1; k <= 1; k++) {
      const t = k * 0.11;
      const h = WORLD.jumpVelocity ** 2 / (2 * WORLD.gravity) - 0.5 * WORLD.gravity * t * t + 36;
      this.addCoin(center + speed * t, h);
    }
  }

  addCoin(x, h) {
    this.coins.push({ x, h, taken: false, seed: this.random() * 6.28 });
  }

  /** Height of the highest crate top under the runner's feet (0 = the ground). */
  floorUnder(box, h) {
    let floor = 0;
    for (const o of this.items) {
      if (o.x > box.right) break;
      if (!o.platform || box.right - 2 <= o.x || box.left + 2 >= o.x + o.w) continue;
      if (o.top <= h + STEP_UP && o.top > floor) floor = o.top;
    }
    return floor;
  }

  /** First hazard overlapping the runner's box, with a small forgiving inset. */
  collide(box) {
    for (const o of this.items) {
      if (o.x > box.right) break;
      const insetX = 4;
      // Crates are only deadly from the side; their top is something to stand on.
      const insetTop = o.platform ? STEP_UP : o.type === 'spikes' ? 7 : 3;
      if (o.blade && bladeHit(box, o.x + o.w / 2, o.bottom + o.blade.cy, o.blade.r)) return o;
      if (o.bladeOnly) continue;
      if (box.right - insetX <= o.x || box.left + insetX >= o.x + o.w) continue;
      if (box.bottom >= o.rectTop - insetTop || box.top - 3 <= o.bottom) continue;
      return o;
    }
    return null;
  }

  /** True when an overhead hazard would hit the runner if they stood up now. */
  overheadAbove(standingBox) {
    return this.items.some(
      (o) => o.overhead && standingBox.right > o.x - 2 && standingBox.left < o.x + o.w + 2 && standingBox.top > o.bottom,
    );
  }

  /** Marks touched coins as taken and returns them. */
  collect(box) {
    const got = [];
    for (const c of this.coins) {
      if (c.taken) continue;
      const nx = clamp(c.x, box.left, box.right);
      const nh = clamp(c.h, box.bottom, box.top);
      if ((c.x - nx) ** 2 + (c.h - nh) ** 2 < (COIN_R + 6) ** 2) {
        c.taken = true;
        got.push(c);
      }
    }
    return got;
  }

  draw(ctx, distance, groundY, viewW, t) {
    const shift = WORLD.playerX - distance;
    for (const o of this.items) {
      const sx = o.x + shift;
      if (sx > viewW + 20 || sx + o.w < -20) continue;
      drawObstacle(ctx, o, sx, groundY, t);
    }
    for (const g of this.glass) {
      const sx = g.x + shift;
      if (sx > viewW + 20 || sx + g.w < -20) continue;
      drawGlass(ctx, sx, groundY, g);
    }
    for (const c of this.coins) {
      const sx = c.x + shift;
      if (c.taken || sx > viewW + 20 || sx < -20) continue;
      drawCoin(ctx, sx, groundY - c.h, t, c.seed);
    }
  }
}
