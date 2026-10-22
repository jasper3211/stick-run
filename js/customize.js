// Character panel: face photo upload/apply/replace/reset and coin-unlocked skins.
import { SKINS } from './config.js';
import { validateFaceFile, processFace, faceFromBlob } from './face.js';
import { getAsset, putAsset, deleteAsset } from './storage.js';

const $ = (id) => document.getElementById(id);
const FACE_KEY = 'face';
const DEFAULT_STATUS = 'JPG, PNG or WebP up to 10 MB. Your photo never leaves this device.';

export class Customizer {
  constructor({ game, ui, settings, persist, audio }) {
    Object.assign(this, { game, ui, settings, persist, audio });
    this.pending = null; // processed photo waiting for "Apply"
    this.el = {
      input: $('face-input'),
      preview: $('face-preview'),
      upload: $('btn-upload'),
      replace: $('btn-replace'),
      apply: $('btn-apply'),
      reset: $('btn-reset-face'),
      status: $('face-status'),
      skins: $('skins'),
    };
    const e = this.el;
    e.upload.addEventListener('click', () => e.input.click());
    e.replace.addEventListener('click', () => e.input.click());
    e.input.addEventListener('change', () => this.onFile(e.input.files && e.input.files[0]));
    e.apply.addEventListener('click', () => this.apply());
    e.reset.addEventListener('click', () => this.reset());
    e.skins.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-skin]');
      if (btn) this.chooseSkin(btn.dataset.skin);
    });
  }

  /** Restores a previously saved face from IndexedDB. */
  async restore() {
    try {
      const blob = await getAsset(FACE_KEY);
      if (blob) this.game.face = await faceFromBlob(blob);
    } catch {
      /* no saved face, or storage unavailable: keep the default head */
    }
    this.sync();
  }

  open() {
    this.setStatus(DEFAULT_STATUS);
    this.renderSkins();
    this.sync();
    this.ui.openModal('screen-customize', () => this.close());
    this.game.resize(); // size the preview canvas now that it is visible
  }

  close() {
    this.pending = null; // un-applied photos are discarded
    this.game.previewFace = undefined;
  }

  setStatus(text, kind = '') {
    this.el.status.textContent = text;
    this.el.status.className = `status${kind ? ` is-${kind}` : ''}`;
  }

  async onFile(file) {
    this.el.input.value = ''; // allow choosing the same file again
    if (!file) return;
    const error = validateFaceFile(file);
    if (error) {
      this.setStatus(error, 'error');
      return;
    }
    this.setStatus('Processing photo…');
    try {
      this.pending = await processFace(file);
      this.game.previewFace = this.pending.canvas;
      this.setStatus('Looking good. Press Apply to run with this face.', 'ok');
    } catch {
      this.pending = null;
      this.setStatus('That image could not be read. Try a different photo.', 'error');
    }
    this.sync();
  }

  async apply() {
    if (!this.pending) return;
    const { canvas, blob } = this.pending;
    this.pending = null;
    this.game.face = canvas;
    this.game.previewFace = undefined;
    try {
      await putAsset(FACE_KEY, blob);
      this.setStatus('Face applied and saved on this device.', 'ok');
    } catch {
      this.setStatus('Face applied for this session, but this browser could not save it.', 'error');
    }
    this.audio.play('coin');
    this.sync();
  }

  async reset() {
    this.pending = null;
    this.game.face = null;
    this.game.previewFace = undefined;
    try {
      await deleteAsset(FACE_KEY);
    } catch {
      /* nothing stored, or storage unavailable */
    }
    this.setStatus('Back to the default head.', 'ok');
    this.sync();
  }

  sync() {
    const e = this.el;
    const shown = this.pending ? this.pending.canvas : this.game.face;
    e.apply.disabled = !this.pending;
    e.reset.disabled = !shown;
    e.upload.hidden = !!shown;
    e.replace.hidden = !shown;

    const ctx = e.preview.getContext('2d');
    const s = e.preview.width;
    ctx.clearRect(0, 0, s, s);
    if (shown) {
      ctx.drawImage(shown, 0, 0, s, s);
    } else {
      ctx.fillStyle = '#4a515b';
      ctx.beginPath();
      ctx.arc(s / 2, s * 0.4, s * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(s / 2, s * 0.92, s * 0.32, s * 0.26, 0, Math.PI, 0);
      ctx.fill();
    }
  }

  renderSkins() {
    const { settings } = this;
    this.el.skins.innerHTML = SKINS.map((skin) => {
      const owned = settings.ownedSkins.includes(skin.id);
      const equipped = settings.skin === skin.id;
      const state = equipped
        ? 'Equipped'
        : owned
          ? 'Owned'
          : `<span class="coin-dot" aria-hidden="true"></span>${skin.price}`;
      const label = equipped ? 'equipped' : owned ? 'owned, select to equip' : `costs ${skin.price} coins`;
      return `<button type="button" class="skin${owned ? '' : ' is-locked'}" data-skin="${skin.id}"
        aria-pressed="${equipped}" aria-label="${skin.name} skin, ${label}">
        <span class="skin__swatch" style="border-color:#0a0a0c;background:${skin.accent}"></span>
        <span class="skin__name">${skin.name}</span>
        <span class="skin__state">${state}</span>
      </button>`;
    }).join('');
    this.ui.syncTotals(settings);
  }

  chooseSkin(id) {
    const skin = SKINS.find((s) => s.id === id);
    const s = this.settings;
    if (!skin || s.skin === id) return;
    if (!s.ownedSkins.includes(id)) {
      if (s.coins < skin.price) {
        this.ui.toast(`You need ${skin.price - s.coins} more coins for ${skin.name}.`);
        return;
      }
      s.coins -= skin.price;
      s.ownedSkins.push(id);
      this.ui.toast(`${skin.name} unlocked!`);
      this.audio.play('record');
    }
    s.skin = id;
    this.persist();
    this.renderSkins();
    const btn = this.el.skins.querySelector(`[data-skin="${id}"]`);
    if (btn) btn.focus({ preventScroll: true });
  }
}
