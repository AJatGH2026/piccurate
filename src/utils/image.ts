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

// HEIC routing threshold: files LARGER than this decode in the browser; smaller
// ones use the faster server endpoint (/api/convert). Two reasons the server
// path exists at all: it's faster per file, and Vercel's serverless body cap is
// 4.5 MB (so >4 MB must go to the browser anyway, else HTTP 413).
//
// Configurable (MB) via NEXT_PUBLIC_HEIC_SERVER_MAX_MB. 4 = small HEICs use the
// fast server path, big ones fall back to the browser. 0 = route EVERYTHING to
// the browser — a quota lever that drives /api/convert "Fast Origin Transfer" to
// ~0 at the cost of slower client-side uploads.
//
// ⚠️ Currently 0 (browser-only). The Vercel free-tier Fast Origin Transfer quota
// (10 GB, rolling 30-day) is exhausted — a single heavy test day (~5 Jul, ~10.8 GB
// incoming) dominates the window and won't age out until ~early August. Keep at 0
// until the counter clears, then revert to 4 (or set the env var) to restore the
// fast server path. Heavy iteration should happen on localhost, which doesn't
// touch Vercel origin transfer at all.
const HEIC_SERVER_MAX_MB = Number(process.env.NEXT_PUBLIC_HEIC_SERVER_MAX_MB ?? '0');
const VERCEL_BODY_LIMIT = Math.max(0, HEIC_SERVER_MAX_MB) * 1024 * 1024;

/**
 * Convert a HEIC/HEIF file to a JPEG (thumbnail by default).
 *
 * Small files → server-side (fast, uses native libvips / WASM depending on
 * host). Large files → in-browser fallback (slower but works around Vercel's
 * body-size cap that returns HTTP 413).
 *
 * `orientation` is the EXIF orientation of the source HEIC (from extractEXIF).
 * Needed for the browser fallback: heic-to strips EXIF without baking the
 * rotation into the pixels, so photos come out sideways otherwise.
 */
export async function convertHEICtoJPEG(
  file: File,
  thumbnail = true,
  orientation: number | null = null
): Promise<Blob> {
  // Big HEICs go straight to the browser fallback — no wasted server round trip.
  if (file.size > VERCEL_BODY_LIMIT) {
    return convertHEICInBrowser(file, thumbnail, orientation);
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
    if (response.status === 413) return convertHEICInBrowser(file, thumbnail, orientation);
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`HEIC conversion failed: ${err.error || response.statusText}`);
  }

  const blob = await response.blob();
  if (blob.size === 0) throw new Error('HEIC conversion produced empty result');
  return blob;
}

/**
 * Decode a HEIC file entirely in the browser using libheif-js via heic-to.
 * The lib bundles an up-to-date libheif WASM (~400 KB gzipped), lazy-loaded
 * — only downloaded when a large HEIC actually needs it. We picked heic-to
 * over heic2any because the latter is unmaintained since 2021 and chokes on
 * newer iOS HEIC encoding variants ("ERR_LIBHEIF format not supported").
 *
 * Orientation: heic-to strips the EXIF orientation but doesn't bake the
 * rotation into the pixels, so we do that manually here if the source HEIC
 * had a non-trivial orientation. The result is an upright JPEG without EXIF
 * — generateThumbnail's "from-image" auto-rotate is then a no-op.
 */
async function convertHEICInBrowser(
  file: File,
  thumbnail: boolean,
  orientation: number | null
): Promise<Blob> {
  const { heicTo } = await import('heic-to');
  const decoded = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.85 });
  let jpegBlob: Blob = decoded instanceof Blob ? decoded : new Blob([decoded]);
  if (!jpegBlob || jpegBlob.size === 0) throw new Error('HEIC conversion produced empty result');

  if (orientation && orientation > 1) {
    jpegBlob = await rotateBlobByExif(jpegBlob, orientation);
  }

  // Thumbnail? Resize via the existing pipeline. Since we've already baked the
  // rotation into the pixels, from-image finds no EXIF and stays a no-op.
  if (thumbnail) return generateThumbnail(jpegBlob);
  return jpegBlob;
}

/**
 * Rotate an image blob according to an EXIF orientation value (2–8) and
 * return a new JPEG blob with the rotation baked into pixels. Uses
 * OffscreenCanvas when available, falls back to a document canvas.
 */
async function rotateBlobByExif(blob: Blob, orientation: number): Promise<Blob> {
  // `none` = decode as-is, don't let the browser apply any EXIF (heic-to's
  // output usually has none anyway, but be defensive).
  const bmp = await createImageBitmap(blob, { imageOrientation: 'none' });
  const swap = orientation >= 5 && orientation <= 8;
  const w = bmp.width;
  const h = bmp.height;
  const cw = swap ? h : w;
  const ch = swap ? w : h;

  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(cw, ch)
      : Object.assign(document.createElement('canvas'), { width: cw, height: ch });
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Failed to get canvas context for rotation');

  // Standard EXIF orientation → affine transform.
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;                   // horizontal flip
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;                  // rotate 180
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;                   // vertical flip
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;                    // transpose
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break;                   // rotate 90 CW
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;                  // transverse
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break;                   // rotate 90 CCW
    default: break;
  }
  ctx.drawImage(bmp, 0, 0);
  bmp.close();

  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  }
  return await new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob returned null'))),
      'image/jpeg',
      0.85
    );
  });
}
