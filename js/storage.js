// Small preferences and scores live in localStorage; the face photo lives in IndexedDB.

const KEY = 'stickrun:v1';

const DEFAULTS = {
  best: 0,
  coins: 0,
  sound: true,
  music: true,
  blood: true,
  reducedFx: false,
  skin: 'neon',
  ownedSkins: ['neon'],
};

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // storage blocked or corrupted JSON: fall back to defaults
  }
}

export function loadSettings() {
  const saved = readRaw();
  const s = { ...DEFAULTS, ownedSkins: [...DEFAULTS.ownedSkins] };
  if (!saved || typeof saved !== 'object') {
    s.reducedFx = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return s;
  }
  for (const key of ['best', 'coins']) {
    const n = Number(saved[key]);
    if (Number.isFinite(n) && n >= 0) s[key] = Math.floor(n);
  }
  for (const key of ['sound', 'music', 'blood', 'reducedFx']) {
    if (typeof saved[key] === 'boolean') s[key] = saved[key];
  }
  if (Array.isArray(saved.ownedSkins)) {
    s.ownedSkins = [...new Set(['neon', ...saved.ownedSkins.filter((x) => typeof x === 'string')])];
  }
  if (typeof saved.skin === 'string' && s.ownedSkins.includes(saved.skin)) s.skin = saved.skin;
  return s;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ IndexedDB -- */

const DB_NAME = 'stickrun';
const STORE = 'assets';

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB is blocked.'));
  });
}

async function run(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// Stored as { type, buffer } rather than a Blob: older Safari versions cannot store Blobs.
export async function putAsset(key, blob) {
  const buffer = await blob.arrayBuffer();
  return run('readwrite', (store) => store.put({ type: blob.type, buffer }, key));
}

export async function getAsset(key) {
  const rec = await run('readonly', (store) => store.get(key));
  return rec && rec.buffer ? new Blob([rec.buffer], { type: rec.type }) : null;
}

export function deleteAsset(key) {
  return run('readwrite', (store) => store.delete(key));
}
