// Headless gameplay checks: physics, hitboxes and spawn fairness.
// Run with `node --test tests/` (Node 18+). No browser or dependencies needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../js/config.js';
import { Player } from '../js/player.js';
import { ObstacleField, TYPES, reactionTime } from '../js/obstacles.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const speedAt = (d) => WORLD.baseSpeed + (WORLD.maxSpeed - WORLD.baseSpeed) * (1 - Math.exp(-d / WORLD.speedRamp));

test('jump reaches ~142 units and lands after ~0.66 s', () => {
  const p = new Player();
  p.requestJump();
  let apex = 0;
  let t = 0;
  do {
    p.update(WORLD.step, WORLD.baseSpeed, false);
    apex = Math.max(apex, p.h);
    t += WORLD.step;
  } while (!p.grounded && t < 2);
  assert.ok(apex > 135 && apex < 150, `apex ${apex}`);
  assert.ok(t > 0.6 && t < 0.72, `airtime ${t}`);
});

test('one extra jump in mid-air, never a third; refilled on landing', () => {
  const p = new Player();
  const step = () => p.update(WORLD.step, WORLD.baseSpeed, false, 0);
  p.requestJump();
  step();
  for (let i = 0; i < 30; i++) step();
  const before = p.vy;
  p.requestJump();
  step();
  assert.ok(p.vy > before + 300, 'double jump must kick upward');
  for (let i = 0; i < 30; i++) step();
  const v2 = p.vy;
  p.requestJump();
  step();
  assert.ok(p.vy < v2, 'third jump must not fire');
  while (!p.grounded) step();
  for (let i = 0; i < 20; i++) step();
  p.requestJump();
  step();
  assert.equal(p.grounded, false, 'can jump again after landing');
  for (let i = 0; i < 30; i++) step();
  const v3 = p.vy;
  p.requestJump();
  step();
  assert.ok(p.vy > v3 + 300, 'air jump is refilled after landing');
});

test('double jump performs one forward flip and ends upright', () => {
  const p = new Player();
  const step = () => p.update(WORLD.step, WORLD.baseSpeed, false, 0);
  p.requestJump();
  for (let i = 0; i < 20; i++) step();
  assert.equal(p.angle(), 0, 'first jump does not flip');
  p.requestJump();
  step();
  for (let i = 0; i < 20; i++) step();
  const mid = p.angle();
  assert.ok(mid > 0.5 && mid < Math.PI * 2, `mid-flip angle ${mid}`);
  while (!p.grounded) step();
  assert.equal(p.angle(), 0, 'upright after landing');
});

test('runner lands on top of a crate and stands there safely', () => {
  const field = new ObstacleField(seeded(2));
  field.items = [field.make('crate', 100)];
  const p = new Player();
  p.h = 120;
  p.grounded = false;
  const d = 120; // over the crate
  for (let i = 0; i < 120; i++) {
    const floor = field.floorUnder(p.box(d), p.h);
    p.update(WORLD.step, 0, false, floor);
    assert.equal(field.collide(p.box(d)), null, `no hit while landing (h=${p.h})`);
  }
  assert.equal(p.grounded, true);
  assert.equal(p.h, 46);
});

test('walking off the edge of a crate drops back to the ground', () => {
  const field = new ObstacleField(seeded(2));
  field.items = [field.make('crate', 100)];
  const p = new Player();
  p.h = 46;
  let d = 120;
  for (let i = 0; i < 120; i++) {
    d += WORLD.baseSpeed * WORLD.step;
    p.update(WORLD.step, WORLD.baseSpeed, false, field.floorUnder(p.box(d), p.h));
    assert.equal(field.collide(p.box(d)), null);
  }
  assert.equal(p.h, 0);
  assert.equal(p.grounded, true);
});

test('running into the side of a crate is still a crash; spikes are never a platform', () => {
  const field = new ObstacleField(seeded(2));
  field.items = [field.make('crate', 100)];
  const p = new Player();
  assert.ok(field.collide(p.box(100)));
  field.items = [field.make('spikes', 100)];
  assert.equal(field.floorUnder(p.box(120), 30), 0);
  p.h = 10; // feet inside the spikes (the top 7 units are forgiving)
  assert.ok(field.collide(p.box(120)));
});

test('overhead crusher cannot be cleared with a double jump', () => {
  const field = new ObstacleField(seeded(2));
  field.items = [field.make('beam', 100)];
  const p = new Player();
  p.h = 260; // above any double-jump apex
  assert.ok(field.collide(p.box(130)));
});

test('slide box fits under an overhead hazard, standing box does not', () => {
  const field = new ObstacleField(seeded(1));
  const beam = field.make('beam', 100);
  field.items = [beam];
  const p = new Player();
  const distance = 110; // runner directly under the beam
  assert.ok(field.collide(p.box(distance)), 'standing runner must hit the beam');
  p.setSlide(true);
  assert.equal(field.collide(p.box(distance)), null, 'sliding runner must pass under');
  assert.ok(field.overheadAbove(p.box(distance, true)));
});

test('slide ends after release + minimum time, but never under a hazard', () => {
  const p = new Player();
  p.setSlide(true);
  p.setSlide(false);
  p.update(0.1, WORLD.baseSpeed, false);
  assert.equal(p.sliding, true, 'minimum slide time applies');
  p.update(0.3, WORLD.baseSpeed, true);
  assert.equal(p.sliding, true, 'stays down while blocked above');
  p.update(WORLD.step, WORLD.baseSpeed, false);
  assert.equal(p.sliding, false);
});

test('spawned hazards keep the minimum reaction gap at their spawn speed', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const field = new ObstacleField(seeded(seed));
    let prev = null;
    for (let d = 0; d < 150000; d += 50) {
      const before = field.items.length;
      field.update(d, speedAt(d), 900);
      const added = field.items.slice(before);
      // pairs are spawned edge-to-edge as one wide hazard
      const groups = [];
      for (const o of added) {
        const g = groups[groups.length - 1];
        if (g && Math.abs(g.end - o.x) < 1e-6) g.end = o.x + o.w;
        else groups.push({ start: o.x, end: o.x + o.w, spec: TYPES[o.type] });
      }
      for (const g of groups) {
        if (prev) {
          const need = speedAt(d) * reactionTime(prev.spec, g.spec);
          assert.ok(g.start - prev.end >= need - 1e-6, `seed ${seed}: gap ${g.start - prev.end} < ${need}`);
        }
        prev = g;
      }
      field.items = field.items.filter((o) => o.x + o.w > d - 400);
    }
  }
});

// A bot with perfect information must be able to survive every generated course.
function autopilot(seed, until) {
  const field = new ObstacleField(seeded(seed));
  const p = new Player();
  let d = 0;
  let t = 0;
  while (d < until) {
    const speed = speedAt(d);
    const dt = WORLD.step;
    d += speed * dt;
    t += dt;
    field.update(d, speed, 900);
    const stand = p.box(d, true);
    const next = field.items.find((o) => o.x + o.w > stand.left - 2);
    if (next) {
      // Treat edge-to-edge pairs as one hazard.
      let end = next.x + next.w;
      for (const o of field.items) if (o !== next && Math.abs(o.x - end) < 1e-6) end = o.x + o.w;
      const ahead = next.x - stand.right;
      if (next.overhead) {
        if (ahead < speed * 0.12) p.setSlide(true);
      } else {
        if (p.slideHeld) p.setSlide(false);
        const center = (next.x + end) / 2 - (stand.left + stand.right) / 2;
        if (p.grounded && center / speed <= 0.33) p.requestJump();
      }
      if (!next.overhead || stand.left > end) {
        if (p.slideHeld && !next.overhead) p.setSlide(false);
      }
    }
    p.update(dt, speed, field.overheadAbove(p.box(d, true)), field.floorUnder(p.box(d), p.h));
    const hit = field.collide(p.box(d));
    if (hit) return { died: true, d, t, hit };
  }
  return { died: false, d, t };
}

test('autopilot survives 25 generated courses to 120 km of world units', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const r = autopilot(seed, 120000);
    assert.equal(r.died, false, `seed ${seed} died at d=${r.d?.toFixed(0)} on ${r.hit?.type}`);
  }
});

test('a runner that never reacts dies early (the course is not empty)', () => {
  const field = new ObstacleField(seeded(7));
  const p = new Player();
  let d = 0;
  let died = false;
  while (d < 20000 && !died) {
    d += speedAt(d) * WORLD.step;
    field.update(d, speedAt(d), 900);
    died = !!field.collide(p.box(d));
  }
  assert.ok(died && d < 2500, `idle runner survived to ${d}`);
});

test('a ground saw blade kills on contact but can be jumped', () => {
  const field = new ObstacleField(seeded(4));
  field.items = [field.make('saw', 200)];
  const p = new Player();
  assert.ok(field.collide(p.box(215)), 'running into the blade is a crash');
  p.h = 34; // just above the 27-unit blade
  assert.equal(field.collide(p.box(227)), null);
  p.h = 0;
  assert.equal(field.collide(p.box(181)), null, 'empty corner beside the round blade is safe');
});

test('a crate with a blade on top cannot be stood on', () => {
  const field = new ObstacleField(seeded(4));
  field.items = [field.make('sawbox', 200)];
  const p = new Player();
  assert.equal(field.floorUnder(p.box(223), 50), 0, 'not a platform');
  p.h = 48; // standing on the crate top = inside the blade
  assert.ok(field.collide(p.box(223)));
  p.h = 80;
  assert.equal(field.collide(p.box(223)), null, 'clear above the blade');
});

test('glass panes never kill and shatter exactly once', () => {
  const field = new ObstacleField(seeded(4));
  field.items = [];
  field.glass = [{ x: 200, w: 12, h: 120, broken: false }];
  const p = new Player();
  assert.equal(field.collide(p.box(200)), null);
  assert.equal(field.smash(p.box(200)).length, 1);
  assert.equal(field.smash(p.box(200)).length, 0);
});

test('glass panes are spawned in the gaps between hazards', () => {
  const field = new ObstacleField(seeded(9));
  for (let d = 0; d < 60000; d += 50) field.update(d, speedAt(d), 900);
  assert.ok(field.spawnedGlass > 5, `only ${field.spawnedGlass} panes`);
});

test('collision is detected against a crate on the ground', () => {
  const field = new ObstacleField(seeded(3));
  field.items = [field.make('crate', 200)];
  const p = new Player();
  assert.equal(field.collide(p.box(150)), null);
  assert.ok(field.collide(p.box(205)));
  p.h = 60; // above the 46-unit crate
  assert.equal(field.collide(p.box(205)), null);
});
