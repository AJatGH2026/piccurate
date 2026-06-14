import ExifReader from 'exifreader';
import type { EXIFData } from '@/types/photo';

/**
 * Extract EXIF metadata from an image file.
 * Runs client-side in the browser.
 */
export async function extractEXIF(file: File): Promise<EXIFData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const tags = ExifReader.load(arrayBuffer, { expanded: true });

    return {
      dateTaken: parseExifDate(tags.exif?.DateTimeOriginal?.description),
      latitude: parseGPS(
        tags.gps?.Latitude,
        (tags.gps as Record<string, unknown>)?.['Latitude Reference'] as { value?: string[] | string; description?: string } | undefined
      ),
      longitude: parseGPS(
        tags.gps?.Longitude,
        (tags.gps as Record<string, unknown>)?.['Longitude Reference'] as { value?: string[] | string; description?: string } | undefined
      ),
      cameraMake: tags.exif?.Make?.description ?? null,
      cameraModel: tags.exif?.Model?.description ?? null,
      orientation: parseOrientation(tags.exif?.Orientation),
      originalWidth:
        tags.file?.['Image Width']?.value ??
        tags.exif?.PixelXDimension?.value ??
        null,
      originalHeight:
        tags.file?.['Image Height']?.value ??
        tags.exif?.PixelYDimension?.value ??
        null,
      fileSizeBytes: file.size,
    };
  } catch {
    // If EXIF extraction fails, return minimal data
    return {
      dateTaken: null,
      latitude: null,
      longitude: null,
      cameraMake: null,
      cameraModel: null,
      orientation: null,
      originalWidth: null,
      originalHeight: null,
      fileSizeBytes: file.size,
    };
  }
}

/**
 * Parse EXIF date string (e.g. "2024:07:15 18:32:05") to ISO 8601.
 */
function parseExifDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;

  // EXIF dates use "YYYY:MM:DD HH:MM:SS" format
  const cleaned = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const date = new Date(cleaned);

  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Parse GPS coordinate from EXIF tags.
 * GPS coordinates in EXIF are stored as degrees, minutes, seconds.
 */
function parseGPS(
  coord: number | number[] | undefined,
  ref: { value?: string[] | string; description?: string } | undefined
): number | null {
  if (coord == null) return null;

  let decimal: number;

  if (typeof coord === 'number') {
    decimal = coord;
  } else if (Array.isArray(coord) && coord.length === 3) {
    // [degrees, minutes, seconds]
    decimal = coord[0] + coord[1] / 60 + coord[2] / 3600;
  } else {
    return null;
  }

  // Check reference direction (S or W means negative)
  const refValue =
    typeof ref?.value === 'string'
      ? ref.value
      : Array.isArray(ref?.value)
        ? ref.value[0]
        : ref?.description;

  if (refValue === 'S' || refValue === 'W' || refValue === 'South' || refValue === 'West') {
    decimal = -decimal;
  }

  return Math.round(decimal * 1000000) / 1000000; // 6 decimal places
}

/**
 * Parse orientation value from EXIF.
 */
function parseOrientation(
  orientation: { value?: number; description?: string } | undefined
): number | null {
  if (!orientation) return null;
  return orientation.value ?? null;
}
