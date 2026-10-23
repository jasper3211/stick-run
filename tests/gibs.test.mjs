// Blade deaths tear the stickman into pieces that fly apart and come to rest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Gibs } from '../js/gibs.js';
import { runPose } from '../js/player.js';
import { ObstacleField } from '../js/obstacles.js';

test('a blade death splits the runner into 10 pieces that settle on the ground', () => {
  const gibs = new Gibs();
  const drops = [];
  gibs.burst(runPose(1.2), 130, 0, { onDrip: (x, h) => drops.push([x, h]) });
  assert.equal(gibs.pieces.length, 10);
  assert.equal(gibs.pieces.filter((p) => p.head).length, 1);
  const start = gibs.pieces.map((p) => p.x);
  for (let i = 0; i < 600; i++) gibs.update(1 / 120, 0);
  assert.ok(gibs.pieces.some((p, i) => Math.abs(p.x - start[i]) > 20), 'pieces fly apart');
  for (const p of gibs.pieces) assert.ok(p.h >= 0, 'never sinks below the ground');
  for (const p of gibs.pieces) assert.ok(p.x >= 0, `piece left the screen (x=${p.x.toFixed(0)})`);
  assert.ok(gibs.idle, 'all pieces at rest after 5 s');
  assert.ok(drops.length > 0, 'pieces drip while flying');
});

test('only blades rip the runner apart', () => {
  const field = new ObstacleField(() => 0.5);
  assert.ok(field.make('saw', 0).blade);
  assert.ok(field.make('sawbox', 0).blade);
  for (const t of ['crate', 'barrier', 'spikes', 'beam', 'stack']) assert.equal(field.make(t, 0).blade, null, t);
});
