import { WORLD, COUNTDOWN_STEP, skinById } from './config.js';
import { Player, drawFigure, drawShadow, drawPreview } from './player.js';
import { ObstacleField } from './obstacles.js';
import { Effects } from './effects.js';
import { Background } from './background.js';

const MAX_DPR = 2;
const DEATH_TIME = 1.05;

/**
 * Game state machine and loop.
 * States: menu → countdown → playing → (paused ↔ countdown) → dying → gameover.
 */
export class Game {
  constructor({ canvas, ui, audio, settings, persist }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ui = ui;
    this.audio = audio;
    this.settings = settings;
    this.persist = persist;

    this.player = new Player();
    this.field = new ObstacleField();
    this.fx = new Effects();
    this.bg = new Background();
    this.face = null; // applied face photo (canvas)
    this.previewFace = undefined; // pending photo shown only in previews
    this.previews = [];

    this.state = 'menu';
    this.rafId = 0;
    this.time = 0;
    this.scroll = 0;
    this.loop = this.loop.bind(this);
    this.resetRun();
    this.resize();
  }

  get skin() {
    return skinById(this.settings.skin);
  }

  resetRun() {
    this.player.reset();
    this.field.reset();
    this.fx.reset();
    this.distance = 0;
    this.speed = WORLD.baseSpeed;
    this.run = { score: 0, coins: 0, record: false, committed: false, nextPulse: 250 };
    this.countdownT = 0;
    this.countLabel = '';
    this.freezeT = 0;
    this.dyingT = 0;
  }

  /* ------------------------------------------------------------ layout -- */

  resize() {
    const cssW = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const cssH = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const minW = cssH > cssW ? WORLD.minViewWPortrait : WORLD.minViewW;
    this.scale = Math.min(cssW / minW, cssH / WORLD.minViewH);
    this.viewW = cssW / this.scale;
    this.viewH = cssH / this.scale;
    // Portrait screens get a lower "underground" band that holds the touch controls.
    this.groundY = Math.min(this.viewH - 92, this.viewH * 0.5 + 200);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    for (const c of this.previews) {
      c.width = Math.round(c.clientWidth * this.dpr);
      c.height = Math.round(c.clientHeight * this.dpr);
    }
    this.render();
  }

  addPreview(canvas) {
    this.previews.push(canvas);
  }

  /* ------------------------------------------------------- transitions -- */

  start() {
    this.commitRun();
    this.resetRun();
    this.beginCountdown();
    this.ui.showState('playing');
    this.ui.hud(this.hudData());
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  restart() {
    this.start();
  }

  beginCountdown() {
    this.state = 'countdown';
    this.countdownT = COUNTDOWN_STEP * 3;
    this.countLabel = '';
    this.player.setSlide(false);
    this.startLoop();
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'countdown') return;
    this.state = 'paused';
    this.player.setSlide(false);
    this.audio.stopMusic();
    this.ui.countdown(null);
    this.ui.showState('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.ui.showState('playing');
    this.beginCountdown();
  }

  home() {
    this.commitRun();
    this.audio.stopMusic();
    this.resetRun();
    this.state = 'menu';
    this.ui.countdown(null);
    this.ui.showState('menu');
    this.startLoop();
  }

  jump() {
    if (this.state === 'playing') this.player.requestJump();
  }

  slide(held) {
    if (!held) {
      this.player.setSlide(false);
      return;
    }
    if (this.state === 'playing' && this.player.setSlide(true)) this.audio.play('slide');
  }

  onVisibility(hidden) {
    if (hidden) {
      this.pause();
      this.stopLoop();
    } else if (this.state !== 'paused') {
      this.startLoop();
    }
  }

  /* -------------------------------------------------------------- loop -- */

  startLoop() {
    if (this.rafId) return;
    this.last = performance.now();
    this.acc = 0;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stopLoop() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  loop(now) {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= WORLD.step && steps < 12) {
      this.update(WORLD.step);
      this.acc -= WORLD.step;
      steps++;
    }
    if (steps === 12) this.acc = 0;
    this.render();

    // Sleep when nothing moves: paused, or the game-over splatter has settled.
    if (this.state === 'paused' || (this.state === 'gameover' && this.fx.idle)) this.stopLoop();
  }

  update(dt) {
    this.time += dt;
    switch (this.state) {
      case 'menu':
        this.scroll += 90 * dt;
        break;
      case 'countdown':
        this.updateCountdown(dt);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'dying':
        this.updateDying(dt);
        break;
      case 'gameover':
        this.fx.update(dt, 0);
        break;
    }
  }

  updateCountdown(dt) {
    this.countdownT -= dt;
    const label = this.countdownT > 0 ? String(Math.ceil(this.countdownT / COUNTDOWN_STEP)) : 'GO!';
    if (label !== this.countLabel) {
      this.countLabel = label;
      this.ui.countdown(label);
      this.audio.play(label === 'GO!' ? 'go' : 'tick');
    }
    if (this.countdownT <= 0) {
      this.state = 'playing';
      this.audio.startMusic();
    }
  }

  updatePlaying(dt) {
    const s = this.settings;
    const ramp = 1 - Math.exp(-this.distance / WORLD.speedRamp);
    this.speed = WORLD.baseSpeed + (WORLD.maxSpeed - WORLD.baseSpeed) * ramp;
    const dx = this.speed * dt;
    this.distance += dx;
    this.scroll += dx;

    const p = this.player;
    const blocked = this.field.overheadAbove(p.box(this.distance, true));
    const floor = this.field.floorUnder(p.box(this.distance), p.h);
    for (const e of p.update(dt, this.speed, blocked, floor)) this.audio.play(e);
    this.field.update(this.distance, this.speed, this.viewW);

    const box = this.player.box(this.distance);
    const coins = this.field.collect(box);
    if (coins.length) {
      this.run.coins += coins.length;
      this.audio.play('coin');
      for (const c of coins) this.fx.sparkle(c.x - this.distance + WORLD.playerX, c.h, '#ffd56e', s.reducedFx ? 4 : 8);
    }

    this.fx.update(dt, dx);
    const hit = this.field.collide(box);
    if (hit) {
      this.die(hit, box);
      return;
    }

    const score = Math.floor(this.distance / WORLD.unitsPerPoint);
    if (score !== this.run.score || coins.length) {
      this.run.score = score;
      if (!this.run.record && s.best > 0 && score > s.best) {
        this.run.record = true;
        this.ui.showRecord();
        this.audio.play('record');
      }
      const pulse = score >= this.run.nextPulse;
      if (pulse) this.run.nextPulse += 250;
      this.ui.hud(this.hudData(), pulse);
    }
  }

  die(hit, box) {
    if (this.state !== 'playing') return; // collision is handled exactly once per run
    const s = this.settings;
    this.state = 'dying';
    this.audio.stopMusic();
    this.audio.play('hit');
    this.player.kill();
    this.freezeT = s.reducedFx ? 0 : 0.09;
    this.dyingT = 0;
    const impactH = Math.max(box.bottom + 10, Math.min(box.top - 10, (Math.max(box.bottom, hit.bottom) + Math.min(box.top, hit.top)) / 2));
    this.fx.impact(WORLD.playerX + 8, impactH, { blood: s.blood, reduced: s.reducedFx });
  }

  updateDying(dt) {
    if (this.freezeT > 0) {
      this.freezeT -= dt; // short hit-stop for impact
      return;
    }
    this.dyingT += dt;
    this.speed = Math.max(0, this.speed - WORLD.baseSpeed * 3 * dt);
    const dx = this.speed * dt;
    this.distance += dx;
    this.scroll += dx;
    this.player.update(dt, 0, false, this.field.floorUnder(this.player.box(this.distance), this.player.h));
    this.fx.update(dt, dx);
    if (this.dyingT >= DEATH_TIME) this.gameOver();
  }

  gameOver() {
    this.state = 'gameover';
    const prevBest = this.settings.best;
    this.commitRun();
    this.audio.play('over');
    this.ui.gameOver({
      score: this.run.score,
      meters: Math.floor(this.distance / WORLD.unitsPerMeter),
      best: this.settings.best,
      coins: this.run.coins,
      record: this.run.score > prevBest && this.run.score > 0,
    });
  }

  /** Saves best score and collected coins once per run, however the run ends. */
  commitRun() {
    if (this.run.committed || (this.distance === 0 && this.run.coins === 0)) return;
    this.run.committed = true;
    const s = this.settings;
    s.best = Math.max(s.best, this.run.score);
    s.coins += this.run.coins;
    this.persist();
    this.ui.syncTotals(s);
  }

  hudData() {
    return {
      score: this.run.score,
      best: Math.max(this.settings.best, this.run.score),
      meters: Math.floor(this.distance / WORLD.unitsPerMeter),
      coins: this.run.coins,
    };
  }

  /* ------------------------------------------------------------ render -- */

  render() {
    const ctx = this.ctx;
    const k = this.scale * this.dpr;
    const t = this.settings.reducedFx ? this.time * 0.25 : this.time;
    const shake = this.fx.offset();
    ctx.setTransform(k, 0, 0, k, shake.x * k, shake.y * k);
    ctx.fillStyle = '#07080a';
    ctx.fillRect(-20, -20, this.viewW + 40, this.viewH + 40);

    const gy = this.groundY;
    this.bg.draw(ctx, this.viewW, this.viewH, gy, this.scroll, t);
    if (this.state !== 'menu') {
      this.field.draw(ctx, this.distance, gy, this.viewW, this.time);
      this.fx.drawDecals(ctx, gy);
      const p = this.player;
      const x = WORLD.playerX + p.deathX;
      drawShadow(ctx, x, gy, p.h);
      drawFigure(ctx, x, gy - p.h, p.pose(), this.skin, this.face, p.angle());
      this.fx.draw(ctx, gy);
    }
    ctx.setTransform(k, 0, 0, k, 0, 0);
    this.fx.drawFlash(ctx, this.viewW, this.viewH);

    if (this.state === 'menu') {
      const face = this.previewFace === undefined ? this.face : this.previewFace;
      for (const c of this.previews) {
        if (c.offsetParent !== null) drawPreview(c, this.time, this.skin, face);
      }
    }
  }
}
