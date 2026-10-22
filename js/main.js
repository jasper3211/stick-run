// Entry point: wires storage, audio, UI, input and the game together.
import { loadSettings, saveSettings } from './storage.js';
import { AudioManager } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { bindInput } from './input.js';
import { Customizer } from './customize.js';

const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const ui = new UI();
const audio = new AudioManager(settings);

let saveWarned = false;
function persist() {
  if (!saveSettings(settings) && !saveWarned) {
    saveWarned = true;
    ui.toast('Progress cannot be saved in this browser (storage is blocked).', 3600);
  }
}

const game = new Game({ canvas: $('game'), ui, audio, settings, persist });
game.addPreview($('menu-preview'));
game.addPreview($('custom-preview'));
const customizer = new Customizer({ game, ui, settings, persist, audio });

bindInput(game, ui);
ui.syncTotals(settings);
ui.showState('menu');

/* -------------------------------------------------------------- buttons -- */

const on = (id, fn) => $(id).addEventListener('click', fn);

on('btn-play', () => game.start());
on('btn-pause', () => game.pause());
on('btn-resume', () => game.resume());
on('btn-restart', () => game.restart());
on('btn-pause-home', () => game.home());
on('btn-retry', () => game.restart());
on('btn-over-home', () => game.home());
on('btn-customize', () => customizer.open());
on('btn-settings', () => {
  syncSwitches();
  ui.openModal('screen-settings');
});

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => ui.closeModal()));
// Clicking the dimmed backdrop closes a dialog.
for (const id of ['screen-settings', 'screen-customize']) {
  $(id).addEventListener('click', (e) => {
    if (e.target === e.currentTarget) ui.closeModal();
  });
}

// Unlock audio on the first gesture and give every UI button a click sound.
document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
document.addEventListener('keydown', () => audio.unlock(), { capture: true });
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn, .icon-btn, .switch, .skin')) audio.play('ui');
});

/* ------------------------------------------------------------- settings -- */

function syncSwitches() {
  document.querySelectorAll('[data-setting]').forEach((sw) => {
    sw.setAttribute('aria-checked', String(!!settings[sw.dataset.setting]));
  });
}

document.querySelectorAll('[data-setting]').forEach((sw) => {
  sw.addEventListener('click', () => {
    const key = sw.dataset.setting;
    settings[key] = !settings[key];
    if (key === 'sound') audio.setSound(settings.sound);
    if (key === 'music') audio.setMusic(settings.music);
    persist();
    syncSwitches();
  });
});

/* ------------------------------------------------- lifecycle & viewport -- */

document.addEventListener('visibilitychange', () => game.onVisibility(document.hidden));

let resizeQueued = false;
function queueResize() {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    game.resize();
  });
}
window.addEventListener('resize', queueResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', queueResize);

// Rotating a phone mid-run pauses instead of restarting; the player resumes when ready.
const orientation = window.screen && window.screen.orientation;
const onRotate = () => {
  game.pause();
  queueResize();
};
if (orientation && orientation.addEventListener) orientation.addEventListener('change', onRotate);
else window.addEventListener('orientationchange', onRotate);

customizer.restore();
game.startLoop();

// Exposed for debugging and automated checks.
window.stickRun = { game, settings };
