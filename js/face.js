// Local-only face photo processing: validate, decode, centre-crop to a square, downscale.

export const FACE_MAX_BYTES = 10 * 1024 * 1024;
const FACE_SIZE = 256;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXTENSIONS = /\.(jpe?g|png|webp)$/i;

/** Returns an error message, or null when the file is acceptable. */
export function validateFaceFile(file) {
  if (!file) return 'No file selected.';
  const typeOk = file.type ? TYPES.includes(file.type) : EXTENSIONS.test(file.name || '');
  if (!typeOk) return 'Please choose a JPG, PNG or WebP image.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > FACE_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `That image is ${mb} MB — the limit is 10 MB.`;
  }
  return null;
}

async function decode(blob) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Crops a square around the likely face position and returns { canvas, blob }. */
export async function processFace(blob) {
  const img = await decode(blob);
  const w = img.width || img.naturalWidth;
  const h = img.height || img.naturalHeight;
  if (!w || !h) throw new Error('Image has no size.');
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  // Portrait photos usually frame the face in the upper part of the picture.
  const sy = h > w ? (h - side) * 0.3 : 0;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = FACE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, FACE_SIZE, FACE_SIZE);
  if (img.close) img.close();

  const out = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!out) throw new Error('Could not encode the image.');
  return { canvas, blob: out };
}

/** Rebuilds the drawable face canvas from a stored blob. */
export async function faceFromBlob(blob) {
  const img = await decode(blob);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = FACE_SIZE;
  canvas.getContext('2d').drawImage(img, 0, 0, FACE_SIZE, FACE_SIZE);
  if (img.close) img.close();
  return canvas;
}
