// DOM side of the game: screens, HUD, countdown, modals and toasts.
// Nothing here runs per frame except the throttled HUD text updates.

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en-US');

export class UI {
  constructor() {
    this.el = {
      app: $('app'),
      menu: $('screen-menu'),
      hud: $('hud'),
      touch: $('touch'),
      countdown: $('countdown'),
      countdownText: $('countdown-text'),
      pause: $('screen-pause'),
      over: $('screen-over'),
      toast: $('toast'),
      score: $('hud-score'),
      best: $('hud-best'),
      dist: $('hud-dist'),
      coins: $('hud-coins'),
      record: $('hud-record'),
      menuBest: $('menu-best'),
      menuCoins: $('menu-coins'),
    };
    this.modal = null;
    this.modalReturn = null;
    this.touchEnabled = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this.state = 'menu';
    this.toastTimer = 0;
    this.countTimer = 0;

    // A real touch anywhere reveals the touch controls (hybrid laptops, emulators).
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && !this.touchEnabled) {
        this.touchEnabled = true;
        this.showState(this.state);
      }
    }, { passive: true });

    document.addEventListener('keydown', (e) => this.trapFocus(e));
  }

  showState(state) {
    this.state = state;
    const { menu, hud, touch, pause, over } = this.el;
    const playing = state === 'playing';
    menu.hidden = state !== 'menu';
    hud.hidden = !(playing || state === 'paused');
    touch.hidden = !(playing && this.touchEnabled);
    pause.hidden = state !== 'paused';
    over.hidden = state !== 'gameover';
    if (state !== 'playing') this.el.record.hidden = true;
    if (state === 'paused') this.focusFirst(pause);
  }

  focusFirst(root) {
    const target = root.querySelector('.btn--primary:not([disabled]), button:not([disabled])');
    if (target) target.focus({ preventScroll: true });
  }

  hud({ score, best, meters, coins }, pulse = false) {
    const e = this.el;
    e.score.textContent = fmt(score);
    e.best.textContent = fmt(best);
    e.dist.textContent = fmt(meters);
    e.coins.textContent = fmt(coins);
    if (pulse) {
      e.score.classList.remove('is-pulse');
      void e.score.offsetWidth; // restart the CSS animation
      e.score.classList.add('is-pulse');
    }
  }

  showRecord() {
    this.el.record.hidden = false;
  }

  countdown(label) {
    const { countdown, countdownText } = this.el;
    clearTimeout(this.countTimer);
    if (!label) {
      countdown.hidden = true;
      return;
    }
    countdown.hidden = false;
    countdownText.textContent = label;
    countdownText.className = 'countdown__text';
    void countdownText.offsetWidth;
    countdownText.classList.add(label === 'GO!' ? 'is-go' : 'is-tick');
    if (label === 'GO!') this.countTimer = setTimeout(() => (countdown.hidden = true), 600);
  }

  gameOver({ score, meters, best, coins, record }) {
    $('over-score').textContent = fmt(score);
    $('over-dist').textContent = fmt(meters);
    $('over-best').textContent = fmt(best);
    $('over-coins').textContent = fmt(coins);
    $('over-record').hidden = !record;
    this.showState('gameover');
    this.focusFirst(this.el.over);
  }

  syncTotals(settings) {
    this.el.menuBest.textContent = fmt(settings.best);
    this.el.menuCoins.textContent = fmt(settings.coins);
    const skinCoins = $('skin-coins');
    if (skinCoins) skinCoins.textContent = fmt(settings.coins);
  }

  /* ------------------------------------------------------------ modals -- */

  get modalOpen() {
    return !!this.modal;
  }

  openModal(id, onClose) {
    if (this.modal) this.closeModal();
    const el = $(id);
    this.modal = { el, onClose };
    this.modalReturn = document.activeElement;
    el.hidden = false;
    this.el.menu.inert = true;
    this.focusFirst(el);
  }

  closeModal() {
    if (!this.modal) return;
    const { el, onClose } = this.modal;
    el.hidden = true;
    this.modal = null;
    this.el.menu.inert = false;
    if (onClose) onClose();
    if (this.modalReturn && this.modalReturn.focus) this.modalReturn.focus({ preventScroll: true });
  }

  /** Keeps Tab focus inside the open dialog (or pause/game-over overlay). */
  trapFocus(e) {
    if (e.key !== 'Tab') return;
    const root = this.modal ? this.modal.el : !this.el.pause.hidden ? this.el.pause : !this.el.over.hidden ? this.el.over : null;
    if (!root) return;
    const items = [...root.querySelectorAll('button:not([disabled]):not([hidden])')].filter((b) => b.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (!root.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }

  toast(message, ms = 2400) {
    const t = this.el.toast;
    clearTimeout(this.toastTimer);
    t.textContent = message;
    t.hidden = false;
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
    this.toastTimer = setTimeout(() => (t.hidden = true), ms);
  }
}
