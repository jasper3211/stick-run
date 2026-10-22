// Gameplay tuning. Every distance is in logical world units; the renderer scales
// those to the screen, so physics never changes with the viewport size.
export const WORLD = {
  minViewW: 640, // the narrowest slice of world a landscape screen shows (reaction distance)
  minViewWPortrait: 560, // portrait trades a little look-ahead for a bigger runner
  minViewH: 380,
  playerX: 130, // fixed horizontal screen position of the runner
  gravity: 2600,
  jumpVelocity: 860, // apex ≈ 142 units, airtime ≈ 0.66 s
  doubleJumpVelocity: 760, // one extra mid-air jump, refilled on landing
  fastFallVelocity: 1300, // sliding in mid-air slams the runner down
  baseSpeed: 390,
  maxSpeed: 820,
  speedRamp: 42000, // distance constant of the exponential speed curve
  slideMinTime: 0.3,
  jumpBufferTime: 0.12,
  coyoteTime: 0.08,
  unitsPerMeter: 40,
  unitsPerPoint: 20,
  step: 1 / 120, // fixed simulation step
};

export const COUNTDOWN_STEP = 0.7; // seconds per "3", "2", "1"

// The runner is always solid black; a skin only changes the visor colour.
export const SKINS = [
  { id: 'neon', name: 'Neon', price: 0, accent: '#c6ff3d' },
  { id: 'chrome', name: 'Chrome', price: 75, accent: '#e8edf3' },
  { id: 'ember', name: 'Ember', price: 150, accent: '#ff6a3d' },
  { id: 'gold', name: 'Gold', price: 300, accent: '#ffc43d' },
  { id: 'ice', name: 'Ice', price: 500, accent: '#59e1ff' },
];

export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
