// Layered industrial skyline drawn with plain canvas shapes (no image assets).

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

const LAYERS = [
  { seed: 11, factor: 0.05, period: 1700, color: '#a4adb6', h: [150, 380], w: [60, 130], gap: [0, 24], lit: 0.6, beacons: true },
  { seed: 23, factor: 0.14, period: 1500, color: '#8a949f', h: [70, 220], w: [70, 170], gap: [10, 60], lit: 0.35, chimneys: true },
  { seed: 37, factor: 0.32, period: 1300, color: '#6f7984', h: [26, 100], w: [40, 120], gap: [40, 170], lit: 0.12, tanks: true },
];

function buildLayer(cfg) {
  const r = seeded(cfg.seed);
  const range = ([a, b]) => a + r() * (b - a);
  const items = [];
  let x = 0;
  while (x < cfg.period - cfg.w[0]) {
    const w = Math.min(range(cfg.w), cfg.period - x);
    const h = range(cfg.h);
    const b = { x, w, h, windows: [] };
    const count = Math.min(12, Math.floor((cfg.lit * w * h) / 900));
    for (let i = 0; i < count; i++) {
      b.windows.push({
        x: 5 + Math.floor(r() * Math.max(1, (w - 12) / 9)) * 9,
        y: 8 + Math.floor(r() * Math.max(1, (h - 20) / 12)) * 12,
        c: r() < 0.7 ? 'rgba(255, 236, 190, 0.7)' : 'rgba(225, 255, 160, 0.6)',
      });
    }
    if (cfg.chimneys && r() < 0.45) b.chimney = { x: range([6, Math.max(8, w - 18)]), w: 9, h: range([24, 70]) };
    if (cfg.beacons && h > 260) b.beacon = r() * 6;
    if (cfg.tanks && r() < 0.35) b.tank = true;
    items.push(b);
    x += w + range(cfg.gap);
  }
  return { ...cfg, items };
}

export class Background {
  constructor() {
    this.layers = LAYERS.map(buildLayer);
    this.cacheKey = '';
  }

  gradients(ctx, h, gy) {
    const key = `${h}|${gy}`;
    if (key === this.cacheKey) return;
    this.cacheKey = key;
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#56616e');
    sky.addColorStop(0.55, '#9aa4ad');
    sky.addColorStop(1, '#d3d8db');
    this.sky = sky;
    const fog = ctx.createLinearGradient(0, gy - 150, 0, gy);
    fog.addColorStop(0, 'rgba(214, 219, 222, 0)');
    fog.addColorStop(1, 'rgba(214, 219, 222, 0.6)');
    this.fog = fog;
    const glow = ctx.createLinearGradient(0, gy - 14, 0, gy);
    glow.addColorStop(0, 'rgba(198, 255, 61, 0)');
    glow.addColorStop(1, 'rgba(198, 255, 61, 0.16)');
    this.glow = glow;
    const ground = ctx.createLinearGradient(0, gy, 0, h);
    ground.addColorStop(0, '#30363d');
    ground.addColorStop(1, '#1b1f24');
    this.ground = ground;
  }

  drawLayer(ctx, layer, w, gy, scroll, t) {
    const off = (scroll * layer.factor) % layer.period;
    for (let rep = 0; rep * layer.period - off < w; rep++) {
      const base = rep * layer.period - off;
      for (const b of layer.items) {
        const x = base + b.x;
        if (x > w || x + b.w < 0) continue;
        const top = gy - b.h;
        ctx.fillStyle = layer.color;
        if (b.tank) {
          ctx.beginPath();
          ctx.ellipse(x + b.w / 2, gy - b.h * 0.6, b.w / 2, b.h * 0.6, 0, Math.PI, 0);
          ctx.fill();
          ctx.fillRect(x, gy - b.h * 0.6, b.w, b.h * 0.6);
        } else {
          ctx.fillRect(x, top, b.w, b.h);
        }
        if (b.chimney) ctx.fillRect(x + b.chimney.x, top - b.chimney.h, b.chimney.w, b.chimney.h);
        for (const win of b.windows) {
          ctx.fillStyle = win.c;
          ctx.fillRect(x + win.x, top + win.y, 3, 4);
        }
        if (b.beacon !== undefined) {
          const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.2 + b.beacon));
          ctx.fillStyle = `rgba(255, 45, 61, ${a})`;
          ctx.fillRect(x + b.w / 2 - 1.5, top - 6, 3, 3);
          ctx.fillStyle = layer.color;
          ctx.fillRect(x + b.w / 2 - 0.5, top - 4, 1, 4);
        }
      }
    }
  }

  draw(ctx, w, h, gy, scroll, t) {
    this.gradients(ctx, h, gy);
    ctx.fillStyle = this.sky;
    ctx.fillRect(0, 0, w, gy);

    // Hazy low sun.
    const mx = w * 0.78;
    const my = Math.max(56, gy - 380); // keeps clear of the menu logo in portrait
    ctx.fillStyle = 'rgba(255, 246, 220, 0.25)';
    ctx.beginPath();
    ctx.arc(mx, my, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 250, 235, 0.9)';
    ctx.beginPath();
    ctx.arc(mx, my, 24, 0, Math.PI * 2);
    ctx.fill();

    this.drawLayer(ctx, this.layers[0], w, gy, scroll, t);
    this.drawLayer(ctx, this.layers[1], w, gy, scroll, t);
    ctx.fillStyle = this.fog;
    ctx.fillRect(0, gy - 150, w, 150);
    this.drawLayer(ctx, this.layers[2], w, gy, scroll, t);

    // Ground.
    ctx.fillStyle = this.ground;
    ctx.fillRect(0, gy, w, h - gy);
    ctx.fillStyle = this.glow;
    ctx.fillRect(0, gy - 14, w, 14);
    ctx.fillStyle = '#c6ff3d';
    ctx.fillRect(0, gy - 1, w, 2);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const off = scroll % 56;
    for (let x = -off; x < w + 20; x += 56) {
      ctx.moveTo(x, gy + 3);
      ctx.lineTo(x - 14, gy + 24);
    }
    ctx.moveTo(0, gy + 26);
    ctx.lineTo(w, gy + 26);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    const off2 = scroll % 28;
    for (let x = -off2; x < w; x += 28) ctx.fillRect(x, gy + 36, 10, 2);
  }
}
