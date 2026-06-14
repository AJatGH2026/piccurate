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

/**
 * Convert a HEIC/HEIF file to JPEG thumbnail via the server-side /api/convert endpoint.
 * With ?thumbnail=1 (default), the server returns a 512×512 JPEG directly —
 * no further client-side resize needed. This avoids sending a multi-MB
 * full-resolution JPEG over the wire.
 */
export async function convertHEICtoJPEG(file: File, thumbnail = true): Promise<Blob> {
  const url = thumbnail ? '/api/convert?thumbnail=1' : '/api/convert?thumbnail=0';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'image/heic' },
    body: file,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`HEIC conversion failed: ${err.error || response.statusText}`);
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error('HEIC conversion produced empty result');
  }
  return blob;
}
