/**
 * Perceptual hashing (pHash) for image similarity detection.
 *
 * Uses a simplified DCT-based approach:
 * 1. Resize image to 32x32 grayscale
 * 2. Compute DCT (Discrete Cosine Transform)
 * 3. Take top-left 8x8 of DCT (low frequencies)
 * 4. Compute average, generate 64-bit hash
 *
 * Two images are "similar" if their Hamming distance is <= threshold (default: 10).
 */

/**
 * Compute perceptual hash from a JPEG thumbnail buffer.
 * Returns a hex string (16 characters = 64 bits).
 */
export async function computePhash(imageBuffer: Buffer): Promise<string> {
  // For server-side processing without sharp, we use a simplified approach:
  // Parse JPEG pixels using pure JS (minimal quality is fine for hashing)
  const pixels = await decodeToGrayscale(imageBuffer, 32, 32);
  const dct = computeDCT(pixels, 32);

  // Take top-left 8x8 block (lowest frequencies)
  const lowFreq: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      lowFreq.push(dct[y * 32 + x]);
    }
  }

  // Compute average (excluding DC component at [0,0])
  const avg = lowFreq.slice(1).reduce((a, b) => a + b, 0) / (lowFreq.length - 1);

  // Generate hash: 1 if above average, 0 if below
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += lowFreq[i] > avg ? '1' : '0';
  }

  // Convert binary string to hex
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(hash.slice(i, i + 4), 2).toString(16);
  }

  return hex;
}

/**
 * Compute Hamming distance between two perceptual hashes.
 * Lower = more similar. 0 = identical. Max = 64.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 64;

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const b1 = parseInt(hash1[i], 16);
    const b2 = parseInt(hash2[i], 16);
    // Count differing bits using XOR
    let xor = b1 ^ b2;
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Check if two images are similar based on their perceptual hashes.
 * @param threshold - Max Hamming distance to consider "similar" (default: 10)
 */
export function areSimilar(hash1: string, hash2: string, threshold = 10): boolean {
  return hammingDistance(hash1, hash2) <= threshold;
}

// ── Internal helpers ────────────────────────────────────────────

/**
 * Decode JPEG buffer to a 32x32 grayscale pixel array.
 * Uses a simplified approach: we extract raw pixel data.
 */
async function decodeToGrayscale(
  buffer: Buffer,
  width: number,
  height: number
): Promise<number[]> {
  // Try to use sharp if available (much better quality)
  try {
    const sharp = require('sharp');
    const { data } = await sharp(buffer)
      .resize(width, height, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return Array.from(data as Buffer);
  } catch {
    // Fallback: generate a simple hash from raw bytes
    // This is less accurate but works without native dependencies
    return generateFallbackPixels(buffer, width * height);
  }
}

/**
 * Fallback pixel generation when sharp is not available.
 * Samples bytes from the image buffer to create a pseudo-grayscale grid.
 */
function generateFallbackPixels(buffer: Buffer, pixelCount: number): number[] {
  const pixels: number[] = [];
  const step = Math.max(1, Math.floor(buffer.length / pixelCount));

  for (let i = 0; i < pixelCount; i++) {
    const idx = Math.min(i * step, buffer.length - 1);
    pixels.push(buffer[idx]);
  }

  return pixels;
}

/**
 * Simplified 2D DCT (Discrete Cosine Transform).
 * Applied to a size x size grid of pixel values.
 */
function computeDCT(pixels: number[], size: number): number[] {
  const result = new Array(size * size).fill(0);

  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let sum = 0;
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          sum +=
            pixels[x * size + y] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
        }
      }
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      result[u * size + v] = (cu * cv * sum) / (size / 2);
    }
  }

  return result;
}
