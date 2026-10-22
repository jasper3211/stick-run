// Web Audio synthesised sound effects and a light background loop — no audio files.
// The context is created on the first user gesture to respect autoplay policies.

const BPM = 118;
const STEP = 60 / BPM / 4; // sixteenth note
const BASS = [55, 43.65, 65.41, 49]; // A1 F1 C2 G1, one per bar
const LEAD = [440, 523.25, 659.25, 587.33, 523.25, 440, 392, 440];

export class AudioManager {
  constructor({ sound, music }) {
    this.soundOn = sound;
    this.musicOn = music;
    this.ctx = null;
    this.timer = 0;
    this.wantMusic = false;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        const c = new AC();
        this.ctx = c;
        this.master = c.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(c.destination);
        this.sfx = c.createGain();
        this.sfx.gain.value = 0.9;
        this.sfx.connect(this.master);
        this.bus = c.createGain();
        this.bus.gain.value = 0.28;
        this.bus.connect(this.master);
        const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      } catch {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  setSound(on) {
    this.soundOn = on;
  }

  setMusic(on) {
    this.musicOn = on;
    if (!on) this.halt();
    else if (this.wantMusic) this.startMusic();
  }

  play(name) {
    if (!this.soundOn || !this.ready) return;
    const fn = SFX[name];
    if (!fn) return;
    try {
      fn(this, this.ctx.currentTime);
    } catch {
      /* a failed sound must never break gameplay */
    }
  }

  tone(t, f0, f1, dur, type, vol, dest = this.sfx) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noise(t, dur, vol, type, freq, freqEnd = freq, dest = this.sfx) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd !== freq) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5, dur + 0.03);
  }

  startMusic() {
    this.wantMusic = true;
    if (!this.musicOn || !this.ctx || this.timer) return;
    this.step = 0;
    this.next = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  stopMusic() {
    this.wantMusic = false;
    this.halt();
  }

  halt() {
    clearInterval(this.timer);
    this.timer = 0;
  }

  schedule() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (this.next < now) this.next = now + 0.02; // recover after a stall
    while (this.next < now + 0.14) {
      this.beat(this.step, this.next);
      this.next += STEP;
      this.step = (this.step + 1) % 64;
    }
  }

  beat(step, t) {
    const s = step % 16;
    const bar = (step / 16) | 0;
    if (s % 4 === 0) this.tone(t, 120, 40, 0.16, 'sine', 0.55, this.bus);
    if (s % 4 === 2) this.noise(t, 0.04, 0.14, 'highpass', 7000, 7000, this.bus);
    if (s % 2 === 0 && s !== 6) this.tone(t, BASS[bar], BASS[bar], 0.16, 'sawtooth', 0.18, this.bus);
    if (s % 4 === 3 && bar % 2 === 1) this.tone(t, LEAD[(step / 2) % 8 | 0], LEAD[(step / 2) % 8 | 0], 0.1, 'square', 0.04, this.bus);
  }
}

const SFX = {
  jump: (a, t) => a.tone(t, 300, 640, 0.13, 'square', 0.08),
  jump2: (a, t) => a.tone(t, 520, 1040, 0.12, 'square', 0.07),
  land: (a, t) => {
    a.noise(t, 0.07, 0.22, 'lowpass', 500);
    a.tone(t, 140, 70, 0.08, 'sine', 0.18);
  },
  slide: (a, t) => a.noise(t, 0.22, 0.16, 'bandpass', 2200, 600),
  coin: (a, t) => {
    a.tone(t, 988, 988, 0.06, 'square', 0.06);
    a.tone(t + 0.06, 1319, 1319, 0.14, 'square', 0.06);
  },
  hit: (a, t) => {
    a.noise(t, 0.32, 0.5, 'lowpass', 1200, 200);
    a.tone(t, 190, 38, 0.38, 'sawtooth', 0.22);
  },
  over: (a, t) => [440, 349.23, 261.63].forEach((f, i) => a.tone(t + 0.12 + i * 0.15, f, f * 0.98, 0.2, 'triangle', 0.16)),
  ui: (a, t) => a.tone(t, 660, 720, 0.05, 'sine', 0.07),
  tick: (a, t) => a.tone(t, 520, 520, 0.09, 'sine', 0.12),
  go: (a, t) => a.tone(t, 1040, 1040, 0.2, 'square', 0.07),
  record: (a, t) => [660, 880, 1320].forEach((f, i) => a.tone(t + i * 0.07, f, f, 0.09, 'square', 0.06)),
};
