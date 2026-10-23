# Stick Run

**Run. Jump. Survive.** A neon-industrial endless runner built with HTML5 Canvas and vanilla JavaScript — no frameworks, no game engine, no backend, no external assets.

## Play locally

ES modules and IndexedDB do not work reliably from `file://`, so serve the folder over HTTP:

```bash
python3 serve.py                 # or: npm start  (no-cache dev server)
# then open http://localhost:8080
```

VS Code **Live Server** or any other static server works too. Once the files are on your machine the game runs fully offline.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Jump (press again in mid-air for a flipping double jump) | `Space`, `↑`, `W` | **JUMP** button |
| Slide (hold) | `↓`, `S` | hold **SLIDE** |
| Pause / resume | `Esc`, `P` | pause button (top right) |

Touch controls appear automatically on touch devices.

## Gameplay

- The runner moves automatically; speed ramps up smoothly with distance.
- **Crates** (single and stacked) are solid: you can land and run on top of them — only hitting their side ends the run.
- **Barriers** and **spikes** must be jumped. **Crushers** reach up off-screen, so the only way past is to slide underneath.
- **Saw blades** spin on a short post, and **bladed crates** have a saw on top — jump both; you can't stand on a bladed crate. Touching a blade tears the runner apart.
- **Glass panes** are harmless: run straight through and they shatter.
- Sliding in mid-air slams the runner down; releasing the slide under a crusher keeps you down until it is safe to stand.
- Hazards are spawned with a minimum gap based on the current speed and the action they require, so every course is clearable.
- Score is distance-based (fixed simulation step, independent of frame rate). Best score and total coins are saved locally.
- Coins unlock visor colours in **Character**.

## Character photo

Open **Character → Upload photo**, pick a JPG/PNG/WebP (≤ 10 MB), check the preview, then **Apply**. The photo is centre-cropped, downscaled to 256 px and stored only in this browser's IndexedDB — it is never uploaded anywhere. **Reset to default** deletes it.

## Settings

Sound effects, music, blood effects (off = neutral white sparks) and reduced effects (fewer particles, no screen shake; defaults to on when the OS asks for reduced motion). Stored in `localStorage` under `stickrun:v1`.

## Project layout

```text
index.html            screens and controls markup
css/style.css         design tokens, responsive layout, touch controls
js/main.js            wiring: storage, audio, UI, input, game
js/game.js            state machine, fixed-step loop, rendering
js/config.js          gameplay tuning constants and skins
js/player.js          physics, hitboxes, procedural stickman poses and drawing
js/obstacles.js       fair spawner, collisions, platforms, glass, coins
js/obstacle-art.js    hazard, saw, glass and coin drawing
js/background.js      parallax industrial skyline
js/effects.js         bounded particles, splatter, shards, shake, flash
js/gibs.js            blade deaths: body pieces that fly apart and settle
js/audio.js           Web Audio synthesised sound effects and music
js/storage.js         localStorage settings, IndexedDB photo storage
js/face.js            photo validation and cropping
js/customize.js       character panel
js/input.js           keyboard and pointer input
js/ui.js              DOM screens, HUD, dialogs
tests/                headless gameplay tests (node:test)
```

## Tests

```bash
npm test
```

This runs headless checks for the jump arc, double jump and flip, standing on crates, saw blades, glass, slide hitboxes, spawn-gap fairness, and an autopilot that must survive 25 generated courses.

The browser behaviour (screens at 360×640, 390×844, 430×932, 844×390, 768×1024, 1366×768 and 1920×1080; pause/resume/restart/home; touch and keyboard input; photo upload, persistence and reset; blood toggle; particle limits; hidden-tab pause; rotation mid-run) was checked with headless Chromium through Playwright (115 automated checks plus screenshot review). It was **not** tested on physical phones or in Safari/Firefox.

## Known limitations

- Not yet verified in Safari (desktop or iOS) or Firefox; only Chromium was tested.
- The photo crop is a fixed centre/upper crop; there is no manual crop or zoom.
- Music is a short procedural loop.
