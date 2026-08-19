/**
 * Client-side image utilities for thumbnail generation.
 * Uses Canvas API for resizing images to 512x512 JPEG thumbnails.
 */

const THUMBNAIL_SIZE = 512;
const THUMBNAIL_QUALITY = 0.6;

export interface DecodedPhoto {
  /** 512×512 centre-cropped JPEG — unchanged from before. */
  thumbnail: Blob;
  /**
   * The decoded bitmap at full resolution, present only when `keepBitmap` was
   * requested (local person search).
   *
   * ⚠️ The caller owns it and MUST call `.close()`. An ImageBitmap lives off the
   * JS heap and is not reclaimed promptly by GC; with MAX_CONCURRENT uploads a
   * handful of 12-MP bitmaps is a few hundred MB, and § 5.3 of the person-search
   * plan caps RAM at 2 GB for 1 500 photos.
   */
  bitmap: ImageBitmap | null;
}

/**
 * Decode an image ONCE and derive everything from that single decode.
 *
 * Decoding is the expensive step — § 2.5 of
 * docs/legal/personensuche-umsetzungsplan.md measured 1.2–4 s per photo, far
 * above detection or embedding. Doing it twice (once for the thumbnail, once for
 * face detection) would roughly double upload time, which is why the plan (§ 9.1)
 * asks for "einmal dekodieren, zwei Ausgaben".
 *
 * Note the face pass deliberately uses the FULL-resolution bitmap, not the
 * 512 thumbnail: that thumbnail is centre-cropped, so anybody standing at the
 * edge of the frame is simply gone, and background faces are 15–40 px (§ 2.6).
 *
 * EXIF orientation is applied by the browser via `imageOrientation: 'from-image'`
 * — the decoded bitmap is already upright and its width/height are the display
 * dimensions, so the crop math is correct for every orientation. HEIC inputs
 * arrive already oriented from heic-to, so this is a no-op for them. We must NOT
 * rotate again ourselves (that double-applies — the exact bug that left
 * orientation-6/3/8 photos sideways).
 */
export async function decodePhoto(
  file: File | Blob,
  opts?: { keepBitmap?: boolean }
): Promise<DecodedPhoto> {
  const imageBitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  // Determine crop dimensions (center crop to square)
  const size = Math.min(imageBitmap.width, imageBitmap.height);
  const sx = (imageBitmap.width - size) / 2;
  const sy = (imageBitmap.height - size) / 2;

  try {
    const thumbnail =
      typeof OffscreenCanvas !== 'undefined'
        ? await generateWithOffscreenCanvas(imageBitmap, sx, sy, size)
        : await generateWithCanvas(imageBitmap, sx, sy, size);
    return { thumbnail, bitmap: opts?.keepBitmap ? imageBitmap : null };
  } finally {
    // Only we close it when the caller did not ask to keep it — otherwise the
    // bitmap is handed over and closing is the caller's job.
    if (!opts?.keepBitmap) imageBitmap.close();
  }
}

/**
 * Generate a 512x512 JPEG thumbnail from an image file.
 * Uses center-crop to maintain aspect ratio.
 *
 * Thin wrapper around {@link decodePhoto} for callers that only need the
 * thumbnail and never the bitmap.
 *
 * @returns Blob of the JPEG thumbnail
 */
export async function generateThumbnail(file: File | Blob): Promise<Blob> {
  return (await decodePhoto(file)).thumbnail;
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

  // NOTE: does not close the bitmap — decodePhoto owns its lifetime, because it
  // may hand the bitmap on to the face pass.
  ctx.drawImage(bitmap, sx, sy, sourceSize, sourceSize, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

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

  // NOTE: does not close the bitmap — see generateWithOffscreenCanvas.
  ctx.drawImage(bitmap, sx, sy, sourceSize, sourceSize, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

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
// Configurable (MB) via NEXT_PUBLIC_HEIC_SERVER_MAX_MB. 4 (default) = small
// HEICs use the fast server path, big ones fall back to the browser. 0 = route
// EVERYTHING to the browser — a quota lever that drives /api/convert "Fast
// Origin Transfer" to ~0 at the cost of slower client-side uploads (used
// 2026-07-06→18 while the Vercel free-tier transfer quota was exhausted; no
// longer needed on Pro, which includes 1 TB transfer).
const HEIC_SERVER_MAX_MB = Number(process.env.NEXT_PUBLIC_HEIC_SERVER_MAX_MB ?? '4');
const VERCEL_BODY_LIMIT = Math.max(0, HEIC_SERVER_MAX_MB) * 1024 * 1024;

/**
 * Convert a HEIC/HEIF file to a JPEG (thumbnail by default).
 *
 * Small files → server-side (fast, uses native libvips / WASM depending on
 * host). Large files → in-browser fallback (slower but works around Vercel's
 * body-size cap that returns HTTP 413).
 *
 * Orientation is handled entirely by the decoder: the server (sharp `.rotate()`)
 * and the browser (heic-to / libheif) both output already-upright pixels, so no
 * caller needs to pass or apply an EXIF orientation.
 */
export async function convertHEICtoJPEG(
  file: File,
  thumbnail = true,
  opts?: { face?: boolean }
): Promise<Blob> {
  // Big HEICs go straight to the browser fallback — no wasted server round trip.
  if (file.size > VERCEL_BODY_LIMIT) {
    return convertHEICInBrowser(file, thumbnail, opts);
  }

  const url = opts?.face
    ? '/api/convert?face=1'
    : thumbnail
      ? '/api/convert?thumbnail=1'
      : '/api/convert?thumbnail=0';
  // The server hop is an optimisation, never a requirement: the browser decoder
  // below handles any HEIC on its own, in pure WASM with no native dependency.
  // So every server failure falls back instead of failing the photo — a broken
  // or missing libvips/sharp binary, a cold start, a network blip, a 413 from
  // the body cap. Only 413 used to fall back, which is why a server that could
  // not load sharp turned into dead photos carrying a raw module error.
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'image/heic' },
      body: file,
    });
  } catch {
    return convertHEICInBrowser(file, thumbnail, opts);
  }

  if (!response.ok) {
    console.warn(
      `[HEIC] server conversion failed (${response.status}) — decoding in the browser instead.`
    );
    return convertHEICInBrowser(file, thumbnail, opts);
  }

  const blob = await response.blob();
  // An empty body is a failed conversion too, and just as recoverable.
  if (blob.size === 0) return convertHEICInBrowser(file, thumbnail, opts);
  return blob;
}

/**
 * Decode a HEIC file entirely in the browser using libheif-js via heic-to.
 * The lib bundles an up-to-date libheif WASM (~400 KB gzipped), lazy-loaded
 * — only downloaded when a large HEIC actually needs it. We picked heic-to
 * over heic2any because the latter is unmaintained since 2021 and chokes on
 * newer iOS HEIC encoding variants ("ERR_LIBHEIF format not supported").
 *
 * Orientation: heic-to / libheif output already-upright pixels (verified — for
 * an orientation-6 photo the output is portrait, i.e. already rotated). So we
 * do NOT rotate again; doing so double-applied the rotation and left photos
 * sideways. The subsequent generateThumbnail decode is a no-op for orientation.
 */
async function convertHEICInBrowser(
  file: File,
  thumbnail: boolean,
  opts?: { face?: boolean }
): Promise<Blob> {
  const { heicTo } = await import('heic-to');
  const decoded = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.85 });
  const jpegBlob: Blob = decoded instanceof Blob ? decoded : new Blob([decoded]);
  if (!jpegBlob || jpegBlob.size === 0) throw new Error('HEIC conversion produced empty result');

  // Face mode wants the full decoded frame: uncropped and as large as it comes.
  // The caller derives both the thumbnail and the detection bitmap from it.
  if (opts?.face) return jpegBlob;
  if (thumbnail) return generateThumbnail(jpegBlob);
  return jpegBlob;
}

/**
 * Decode a HEIC **reference photo** — always in the browser, never via the
 * server.
 *
 * This is a hard rule from § 2.4 of the person-search plan, not an optimisation:
 * a reference photo is the one image that unambiguously depicts the person being
 * searched for, and § 3 rule 3 says it must never leave the device. Today that
 * happens to hold because the file picker's `accept` list excludes HEIC — but
 * that is an accident of a UI filter, not a guarantee, and the obvious way to
 * "add HEIC support for reference photos" would be to call convertHEICtoJPEG(),
 * which would quietly upload the face to /api/convert.
 *
 * So: HEIC support for reference photos is provided here, and routed so that it
 * cannot regress into the server path. The cost is one slow decode (~4 s) for a
 * single photo, which nobody will notice.
 */
export async function convertReferenceHEIC(file: File): Promise<Blob> {
  const { heicTo } = await import('heic-to');
  const decoded = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
  const blob: Blob = decoded instanceof Blob ? decoded : new Blob([decoded]);
  if (!blob || blob.size === 0) throw new Error('HEIC conversion produced empty result');
  return blob;
}
