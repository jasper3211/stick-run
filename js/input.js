// Keyboard and touch input. Each control maps to one action, with no overlapping
// mouse/touch/pointer handlers, so a single press can never fire twice.

const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const SLIDE_KEYS = new Set(['ArrowDown', 'KeyS']);
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

export function bindInput(game, ui) {
  window.addEventListener('keydown', (e) => {
    if (ui.modalOpen) {
      if (e.code === 'Escape') {
        e.preventDefault();
        ui.closeModal();
      }
      return;
    }
    const inRun = game.state === 'playing' || game.state === 'countdown';

    if (JUMP_KEYS.has(e.code) || SLIDE_KEYS.has(e.code)) {
      if (!inRun) return; // let Space/arrows work normally on menus
      e.preventDefault();
      if (e.repeat) return;
      if (JUMP_KEYS.has(e.code)) game.jump();
      else game.slide(true);
      return;
    }

    if (PAUSE_KEYS.has(e.code) && !e.repeat) {
      if (inRun) {
        e.preventDefault();
        game.pause();
      } else if (game.state === 'paused') {
        e.preventDefault();
        game.resume();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (SLIDE_KEYS.has(e.code)) game.slide(false);
  });

  // Losing focus can swallow the keyup: never leave the runner stuck sliding.
  window.addEventListener('blur', () => game.slide(false));

  bindHold(document.getElementById('touch-jump'), () => game.jump(), () => {});
  bindHold(document.getElementById('touch-slide'), () => game.slide(true), () => game.slide(false));
}

/** Press-and-hold button driven only by Pointer Events, tracking a single pointer. */
function bindHold(button, onDown, onUp) {
  let activeId = null;

  const release = (e) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    button.classList.remove('is-pressed');
    onUp();
  };

  button.addEventListener('pointerdown', (e) => {
    if (activeId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    activeId = e.pointerId;
    try {
      button.setPointerCapture(activeId);
    } catch {
      /* capture is best-effort */
    }
    button.classList.add('is-pressed');
    onDown();
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
  // Keyboard activation of a focused touch button must not double up with Space handling.
  button.addEventListener('click', (e) => e.preventDefault());
}
