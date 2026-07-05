/**
 * Client-side image utilities for thumbnail generation.
 * Uses Canvas API for resizing images to 512x512 JPEG thumbnails.
 */

const THUMBNAIL_SIZE = 512;
const THUMBNAIL_QUALITY = 0.6;

/**
 * Generate a 512x512 JPEG thumbnail from an image file.
 * Uses center-crop to maintain aspect ratio.
 *
 * EXIF orientation is applied exactly once, by the browser, via
 * createImageBitmap's `imageOrientation: 'from-image'`. The decoded bitmap is
 * therefore already upright and its width/height reflect the corrected (visual)
 * dimensions, so the center-crop math below is correct for every orientation.
 * We must NOT also rotate the canvas manually — doing both double-applies the
 * rotation (e.g. an orientation-3 photo ends up upside down).
 *
 * @returns Blob of the JPEG thumbnail
 */
export async function generateThumbnail(file: File | Blob): Promise<Blob> {
  const imageBitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  // Determine crop dimensions (center crop to square)
  const size = Math.min(imageBitmap.width, imageBitmap.height);
  const sx = (imageBitmap.width - size) / 2;
  const sy = (imageBitmap.height - size) / 2;

  // Try OffscreenCanvas first (better performance, runs in workers)
  if (typeof OffscreenCanvas !== 'undefined') {
    return generateWithOffscreenCanvas(imageBitmap, sx, sy, size);
  }

  // Fallback to regular canvas
  return generateWithCanvas(imageBitmap, sx, sy, size);
}

async function generateWithOffscreenCanvas(
  bitmap: ImageBitmap,
  sx: number,
  sy: number,
  sourceSize: number
): Promise<Blob> {
  const canvas = new OffscreenCanvas(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get OffscreenCanvas context');

  ctx.drawImage(bitmap, sx, sy, sourceSize, sourceSize, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  bitmap.close();

  const blob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: THUMBNAIL_QUALITY,
  });

  return blob;
}

async function generateWithCanvas(
  bitmap: ImageBitmap,
  sx: number,
  sy: number,
  sourceSize: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(bitmap, sx, sy, sourceSize, sourceSize, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob from canvas'));
      },
      'image/jpeg',
      THUMBNAIL_QUALITY
    );
  });
}

/**
 * Check if a file is a HEIC/HEIF image that needs conversion.
 */
export function isHEIC(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

// Vercel's serverless functions cap the request body at 4.5 MB across all
// plans. Modern iPhone HEICs regularly exceed that (5–15 MB is common), so
// larger files bypass the server and are decoded entirely in the browser
// via heic2any (libheif WASM). Slower per file but no size limit and no
// server timeout risk.
const VERCEL_BODY_LIMIT = 4 * 1024 * 1024; // 4 MB — leaves a small margin under Vercel's 4.5 MB

/**
 * Convert a HEIC/HEIF file to a JPEG (thumbnail by default).
 *
 * Small files → server-side (fast, uses native libvips / WASM depending on
 * host). Large files → in-browser fallback (slower but works around Vercel's
 * body-size cap that returns HTTP 413).
 */
export async function convertHEICtoJPEG(file: File, thumbnail = true): Promise<Blob> {
  // Big HEICs go straight to the browser fallback — no wasted server round trip.
  if (file.size > VERCEL_BODY_LIMIT) {
    return convertHEICInBrowser(file, thumbnail);
  }

  const url = thumbnail ? '/api/convert?thumbnail=1' : '/api/convert?thumbnail=0';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'image/heic' },
    body: file,
  });

  if (!response.ok) {
    // 413 = Vercel's body limit hit us anyway (unlikely at this point since
    // we pre-checked, but small margin errors happen). Fall back to browser.
    if (response.status === 413) return convertHEICInBrowser(file, thumbnail);
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`HEIC conversion failed: ${err.error || response.statusText}`);
  }

  const blob = await response.blob();
  if (blob.size === 0) throw new Error('HEIC conversion produced empty result');
  return blob;
}

/**
 * Decode a HEIC file entirely in the browser using libheif (WASM). The lib is
 * ~300 KB gzipped, so we lazy-load it — only downloaded when a large HEIC
 * actually needs it. Result is optionally resized to the standard thumbnail
 * size via generateThumbnail (which shares the orientation-safe pipeline).
 */
async function convertHEICInBrowser(file: File, thumbnail: boolean): Promise<Blob> {
  // heic2any is UMD; the default export is the async decoder function.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heic2any = (await import('heic2any')).default as (opts: {
    blob: Blob;
    toType?: string;
    quality?: number;
  }) => Promise<Blob | Blob[]>;

  const decoded = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  // Some heic2any versions return an array (multi-frame HEICs) — take the first.
  const jpegBlob = Array.isArray(decoded) ? decoded[0] : decoded;
  if (!jpegBlob || jpegBlob.size === 0) throw new Error('HEIC conversion produced empty result');

  // Thumbnail? Resize + orientation-normalize via the existing pipeline.
  if (thumbnail) return generateThumbnail(jpegBlob);
  return jpegBlob;
}
