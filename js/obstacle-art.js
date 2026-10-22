// Procedural drawing for hazards and coins. Positions are screen-space logical units.
const TAU = Math.PI * 2;

function crate(ctx, x, y, w, h) {
  ctx.fillStyle = '#2a2f37';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(x + 2, y + 2, w - 4, 3);
  ctx.strokeStyle = '#5c6571';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 7, y + 7);
  ctx.lineTo(x + w - 7, y + h - 7);
  ctx.moveTo(x + w - 7, y + 7);
  ctx.lineTo(x + 7, y + h - 7);
  ctx.stroke();
  ctx.strokeRect(x + 7, y + 7, w - 14, h - 14);
  ctx.strokeStyle = '#b4bcc8';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = '#c6ff3d';
  ctx.fillRect(x + 4, y + h - 7, 7, 3);
}

function barrier(ctx, x, gy, w, h) {
  const top = gy - h;
  ctx.fillStyle = '#8b939f';
  ctx.fillRect(x + 6, top + 10, 5, h - 10);
  ctx.fillRect(x + w - 11, top + 10, 5, h - 10);
  ctx.fillRect(x + 2, gy - 3, 13, 3);
  ctx.fillRect(x + w - 15, gy - 3, 13, 3);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, top, w, 16);
  ctx.clip();
  ctx.fillStyle = '#f2f4f7';
  ctx.fillRect(x, top, w, 16);
  ctx.fillStyle = '#ff2d3d';
  for (let sx = x - 16; sx < x + w + 16; sx += 16) {
    ctx.beginPath();
    ctx.moveTo(sx, top + 16);
    ctx.lineTo(sx + 8, top + 16);
    ctx.lineTo(sx + 16, top);
    ctx.lineTo(sx + 8, top);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, top + 0.5, w - 1, 15);
  ctx.fillStyle = '#ff2d3d';
  ctx.beginPath();
  ctx.arc(x + w / 2, top - 2, 3, 0, TAU);
  ctx.fill();
}

function spikes(ctx, x, gy, w, h) {
  const n = Math.max(3, Math.round(w / 11));
  const sw = w / n;
  ctx.fillStyle = 'rgba(255, 45, 61, 0.18)';
  ctx.fillRect(x - 4, gy - 3, w + 8, 3);
  for (let i = 0; i < n; i++) {
    const sx = x + i * sw;
    ctx.fillStyle = '#c3c9d2';
    ctx.beginPath();
    ctx.moveTo(sx, gy - 4);
    ctx.lineTo(sx + sw / 2, gy - h);
    ctx.lineTo(sx + sw, gy - 4);
    ctx.fill();
    ctx.fillStyle = '#ff2d3d';
    ctx.beginPath();
    ctx.moveTo(sx + sw * 0.32, gy - h * 0.64);
    ctx.lineTo(sx + sw / 2, gy - h);
    ctx.lineTo(sx + sw * 0.68, gy - h * 0.64);
    ctx.fill();
  }
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(x, gy - 5, w, 5);
}

function crusher(ctx, x, gy, o, t) {
  const bottom = gy - o.bottom;
  const top = gy - o.top;
  const w = o.w;
  // Cables up to the top of the screen.
  ctx.strokeStyle = '#4a515b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 14, top);
  ctx.lineTo(x + 14, -40);
  ctx.moveTo(x + w - 14, top);
  ctx.lineTo(x + w - 14, -40);
  ctx.stroke();

  // Body.
  ctx.fillStyle = '#23272e';
  ctx.fillRect(x, top, w, o.top - o.bottom);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(x + 3, top + 3, w - 6, 3);
  ctx.strokeStyle = '#9aa3af';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, top + 1, w - 2, o.top - o.bottom - 2);
  ctx.fillStyle = '#5c6571';
  for (let ry = top + 14; ry < bottom - 20; ry += 18) {
    ctx.fillRect(x + 7, ry, 3, 3);
    ctx.fillRect(x + w - 10, ry, 3, 3);
  }

  // Hazard stripes along the underside.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, bottom - 12, w, 12);
  ctx.clip();
  ctx.fillStyle = '#ff2d3d';
  ctx.fillRect(x, bottom - 12, w, 12);
  ctx.fillStyle = '#111';
  for (let sx = x - 12; sx < x + w + 12; sx += 14) {
    ctx.beginPath();
    ctx.moveTo(sx, bottom);
    ctx.lineTo(sx + 7, bottom);
    ctx.lineTo(sx + 19, bottom - 12);
    ctx.lineTo(sx + 12, bottom - 12);
    ctx.fill();
  }
  ctx.restore();

  // Pulsing warning glow underneath telegraphs "slide".
  const pulse = 0.5 + 0.5 * Math.sin(t * 8);
  const g = ctx.createLinearGradient(0, bottom, 0, bottom + 26);
  g.addColorStop(0, `rgba(255, 45, 61, ${0.28 + pulse * 0.2})`);
  g.addColorStop(1, 'rgba(255, 45, 61, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, bottom, w, 26);
}

export function drawObstacle(ctx, o, x, gy, t) {
  const h = o.top - o.bottom;
  switch (o.type) {
    case 'crate':
      crate(ctx, x, gy - h, o.w, h);
      break;
    case 'stack':
      crate(ctx, x, gy - h / 2, o.w, h / 2);
      crate(ctx, x + 2, gy - h, o.w - 4, h / 2);
      break;
    case 'barrier':
      barrier(ctx, x, gy, o.w, h);
      break;
    case 'spikes':
      spikes(ctx, x, gy, o.w, h);
      break;
    case 'beam':
      crusher(ctx, x, gy, o, t);
      break;
  }
}

export function drawCoin(ctx, x, y, t, seed) {
  const spin = Math.abs(Math.cos(t * 4 + seed));
  const rx = 9 * Math.max(0.16, spin);
  const cy = y + Math.sin(t * 3 + seed) * 2;
  ctx.fillStyle = 'rgba(255, 182, 39, 0.16)';
  ctx.beginPath();
  ctx.arc(x, cy, 14, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffb627';
  ctx.beginPath();
  ctx.ellipse(x, cy, rx, 9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffd56e';
  ctx.beginPath();
  ctx.ellipse(x, cy, rx * 0.6, 5.6, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#8a5a00';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(x, cy, rx, 9, 0, 0, TAU);
  ctx.stroke();
  if (spin > 0.85) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(x - rx * 0.45, cy - 5, 2, 4);
  }
}
