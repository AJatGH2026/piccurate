/**
 * Client-side perceptual hash (DCT-based pHash) for near-duplicate / burst-series
 * detection. Produces a 16-hex (64-bit) string; compare with the Hamming distance.
 * Mirrors scripts/eval-phash.mjs so the product matches the calibrated eval thresholds.
 */

function dct1d(vec: number[]): number[] {
  const N = vec.length;
  const out = new Array(N);
  for (let u = 0; u < N; u++) {
    let s = 0;
    for (let x = 0; x < N; x++) s += vec[x] * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
    out[u] = s * (u === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N));
  }
  return out;
}

/** Compute a 64-bit pHash (16 hex chars) from an image blob. Returns null on failure. */
export async function computePHash(blob: Blob): Promise<string | null> {
  try {
    const SZ = 32;
    const bmp = await createImageBitmap(blob);
    const canvas: OffscreenCanvas | HTMLCanvasElement =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(SZ, SZ)
        : Object.assign(document.createElement('canvas'), { width: SZ, height: SZ });
    const ctx = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, SZ, SZ);
    bmp.close?.();
    const { data } = ctx.getImageData(0, 0, SZ, SZ);

    // grayscale matrix
    const m: number[][] = [];
    for (let y = 0; y < SZ; y++) {
      const row: number[] = [];
      for (let x = 0; x < SZ; x++) {
        const i = (y * SZ + x) * 4;
        row.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }
      m.push(row);
    }
    // 2D DCT: rows then columns
    const rows = m.map(dct1d);
    const cols: number[][] = [];
    for (let x = 0; x < SZ; x++) cols.push(dct1d(rows.map((r) => r[x])));
    // top-left 8x8 low frequencies
    const coefs: number[] = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) coefs.push(cols[x][y]);
    const sorted = coefs.slice(1).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    let hex = '';
    for (let i = 0; i < 64; i += 4) {
      let nib = 0;
      for (let b = 0; b < 4; b++) if (coefs[i + b] > median) nib |= 1 << (3 - b);
      hex += nib.toString(16);
    }
    return hex;
  } catch {
    return null;
  }
}
