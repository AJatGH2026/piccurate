// Computes a 64-bit perceptual hash (DCT-based pHash) for every cached thumbnail,
// writes .eval/phash.json (id → hex), then calibrates the time+similarity thresholds
// for series detection against the human series labels.
//
//   node scripts/eval-phash.mjs

import { createRequire } from 'module';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const MANIFEST = join(process.cwd(), 'public', 'eval', 'manifest.json');
const PUBLIC = join(process.cwd(), 'public');
const PHASH_OUT = join(process.cwd(), '.eval', 'phash.json');
const REFERENCE = join(process.cwd(), '.eval', 'reference.json');

function dct1d(vec) {
  const N = vec.length;
  const out = new Array(N);
  for (let u = 0; u < N; u++) {
    let s = 0;
    for (let x = 0; x < N; x++) s += vec[x] * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
    out[u] = s * (u === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N));
  }
  return out;
}

async function phash(path) {
  const SZ = 32;
  const data = await sharp(path).greyscale().resize(SZ, SZ, { fit: 'fill' }).raw().toBuffer();
  // build matrix
  const m = [];
  for (let y = 0; y < SZ; y++) {
    const row = [];
    for (let x = 0; x < SZ; x++) row.push(data[y * SZ + x]);
    m.push(row);
  }
  // 2D DCT: rows then columns
  const rows = m.map(dct1d);
  const cols = [];
  for (let x = 0; x < SZ; x++) {
    const col = rows.map((r) => r[x]);
    cols.push(dct1d(col));
  }
  // top-left 8x8 low frequencies
  const coefs = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) coefs.push(cols[x][y]);
  // median of all but DC term
  const sorted = coefs.slice(1).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  // 64 bits → hex
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    let nib = 0;
    for (let b = 0; b < 4; b++) if (coefs[i + b] > median) nib |= 1 << (3 - b);
    hex += nib.toString(16);
  }
  return hex;
}

function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf-8'));
  console.log(`Computing pHash for ${manifest.length} thumbnails…`);
  const hashes = {};
  for (const e of manifest) hashes[e.id] = await phash(join(PUBLIC, e.thumb));
  await writeFile(PHASH_OUT, JSON.stringify(hashes, null, 2), 'utf-8');
  console.log(`→ .eval/phash.json`);

  // Calibrate against labeled series
  let ref = {};
  try { ref = JSON.parse(await readFile(REFERENCE, 'utf-8')); } catch { /* none */ }
  const within = [], boundary = [];
  for (let i = 1; i < manifest.length; i++) {
    const cur = manifest[i], prev = manifest[i - 1];
    const r = ref[cur.id];
    if (!r) continue;
    if (!cur.dateTaken || !prev.dateTaken) continue;
    const gap = (new Date(cur.dateTaken) - new Date(prev.dateTaken)) / 1000;
    const dist = hamming(hashes[cur.id], hashes[prev.id]);
    (r.seriesWithPrev ? within : boundary).push({ gap, dist });
  }
  const stat = (arr, key) => {
    const a = arr.map((x) => x[key]).sort((x, y) => x - y);
    const q = (p) => a[Math.floor(p * (a.length - 1))];
    return `p50=${q(0.5)} p90=${q(0.9)}`;
  };
  console.log('\npHash-Distanz INNERHALB Serie:', stat(within, 'dist'));
  console.log('pHash-Distanz an GRENZE:      ', stat(boundary, 'dist'));

  console.log('\n=== Kombinierte Regel: gap≤T UND pHash-Distanz≤D ===');
  for (const T of [10, 20]) {
    for (const D of [8, 10, 12, 14]) {
      const tp = within.filter((x) => x.gap <= T && x.dist <= D).length;
      const fn = within.length - tp;
      const fp = boundary.filter((x) => x.gap <= T && x.dist <= D).length;
      console.log(`T=${T}s D=${D}: echte Serien-Paare erkannt ${tp}/${within.length}, falsch verbunden ${fp}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
