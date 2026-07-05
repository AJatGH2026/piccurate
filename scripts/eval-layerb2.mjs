// Layer B v2 — validates the IMPROVED selection algorithm against the reference,
// before porting it into the product. Changes vs the current engine:
//   1. Real series detection (time ≤10s AND pHash distance ≤ D) — not scene-type caps.
//   2. One representative per series, chosen by FACE QUALITY (eyes open, smiling,
//      facing camera if available), then sharpness, then aesthetic.
//   3. Effective per-slider scoring, NO diversity cap, NO presets.
//   4. Global top-N% over series representatives → each series contributes ≤1 photo.
//
//   node scripts/eval-layerb2.mjs

import { readFile } from 'fs/promises';
import { join } from 'path';

const EVAL = join(process.cwd(), '.eval');
const MANIFEST = join(process.cwd(), 'public', 'eval', 'manifest.json');
const mergeScene = (s) => (s === 'nature' ? 'landscape' : s);

// New criteria — presets & diversity removed; dedupSensitivity drives the pHash threshold.
const CRIT = {
  preferFaces: { enabled: true, weight: 0.8 },
  preferAnimals: { enabled: true, weight: 0.7 },
  preferLandscapes: { enabled: true, weight: 0.6 },
  preferArchitecture: { enabled: true, weight: 0.5 },
  preferFood: { enabled: true, weight: 0.4 },
  preferSharpness: { enabled: true, weight: 0.9 },
  dedupSensitivity: 8, // → D = 6 + 8 = 14
};
const SERIES_GAP_S = 10;
const dThreshold = (c) => 6 + c.dedupSensitivity;

function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { d += x & 1; x >>= 1; } }
  return d;
}

// Quality of a single photo WITHIN its series (what makes the best of a burst).
function inSeriesScore(p) {
  let faceQ = 0;
  if (p.faceCount > 0) {
    if (p.facesFacingCamera) faceQ += 3;       // available after the v2 re-run
    if (p.facesEyesOpen) faceQ += 2;
    if (p.facesExpression === 'friendly') faceQ += 2;
  }
  return faceQ * 2 + p.sharpnessScore * 1.0 + p.aestheticScore * 0.5;
}

// Preference score for global ranking — sliders have a strong, monotonic effect.
function prefScore(p, c) {
  let s = p.aestheticScore * 0.2;
  if (c.preferSharpness.enabled) s += p.sharpnessScore * c.preferSharpness.weight * 0.5;
  if (c.preferFaces.enabled && p.faceCount > 0 && (p.sceneType === 'people' || p.sceneType === 'street')) {
    let f = 4 + p.faceCount; if (p.facesEyesOpen) f += 2; if (p.facesExpression === 'friendly') f += 2; if (p.facesFacingCamera) f += 2;
    s += f * c.preferFaces.weight;
  }
  if (c.preferAnimals.enabled && p.hasAnimal && p.sceneType === 'animal') {
    s += (4 + p.animalClarity * 0.5 + p.animalProximity * 0.5) * c.preferAnimals.weight;
  }
  if (c.preferLandscapes.enabled && ['landscape', 'beach', 'mountain'].includes(p.sceneType)) {
    s += (4 + p.aestheticScore * 0.6) * c.preferLandscapes.weight;
  }
  if (c.preferArchitecture.enabled && ['building', 'interior', 'architecture', 'city'].includes(p.sceneType)) {
    s += (4 + p.aestheticScore * 0.6) * c.preferArchitecture.weight;
  }
  if (c.preferFood.enabled && p.sceneType === 'food') {
    s += (4 + p.aestheticScore * 0.6) * c.preferFood.weight;
  }
  return s;
}

// Cluster time-sorted photos into series; return Map cluster→[photos].
function detectSeries(photos, phash, c) {
  const D = dThreshold(c);
  const sorted = photos.slice().sort((a, b) => (a.dateTaken || '').localeCompare(b.dateTaken || ''));
  const clusters = [];
  let cur = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { cur = [sorted[i]]; continue; }
    const prev = sorted[i - 1], p = sorted[i];
    const gap = prev.dateTaken && p.dateTaken ? (new Date(p.dateTaken) - new Date(prev.dateTaken)) / 1000 : Infinity;
    const dist = (phash[prev.id] && phash[p.id]) ? hamming(phash[prev.id], phash[p.id]) : 99;
    if (gap <= SERIES_GAP_S && dist <= D) cur.push(p);
    else { clusters.push(cur); cur = [p]; }
  }
  if (cur.length) clusters.push(cur);
  return clusters;
}

function select(photos, phash, c, forceCount) {
  const clusters = detectSeries(photos, phash, c);
  // one representative per series (best in-series score)
  const reps = clusters.map((cl) => cl.slice().sort((a, b) => inSeriesScore(b) - inSeriesScore(a))[0]);
  // global ranking over representatives
  reps.sort((a, b) => prefScore(b, c) - prefScore(a, c));
  const n = forceCount ?? Math.max(1, Math.round(photos.length * 0.15));
  return { selected: new Set(reps.slice(0, n).map((p) => p.id)), clusters };
}

// Coordinate-ascent calibration: tune the 6 slider weights to maximize overlap
// with the human "Ja" picks (top-N selection vs keepYes).
function calibrate(photos, phash, keepYes) {
  const keys = ['preferFaces', 'preferAnimals', 'preferLandscapes', 'preferArchitecture', 'preferFood', 'preferSharpness'];
  const grid = [0, 0.25, 0.5, 0.75, 1.0];
  const score = (weights) => {
    const c = { dedupSensitivity: 8 };
    for (const k of keys) c[k] = { enabled: true, weight: weights[k] };
    const { selected } = select(photos, phash, c, keepYes.size);
    return [...selected].filter((id) => keepYes.has(id)).length;
  };
  const weights = Object.fromEntries(keys.map((k) => [k, 0.5]));
  let bestHit = score(weights);
  for (let pass = 0; pass < 2; pass++) {
    for (const k of keys) {
      let bestW = weights[k];
      for (const w of grid) {
        const trial = { ...weights, [k]: w };
        const h = score(trial);
        if (h > bestHit) { bestHit = h; bestW = w; }
      }
      weights[k] = bestW;
    }
  }
  return { hit: bestHit, weights };
}

async function main() {
  const ref = JSON.parse(await readFile(join(EVAL, 'reference.json'), 'utf-8'));
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf-8'));
  const phash = JSON.parse(await readFile(join(EVAL, 'phash.json'), 'utf-8'));
  const order = manifest.filter((m) => { const r = ref[m.id]; return (r?.sceneType || r?.primary) && r?.keep; });
  const byId = Object.fromEntries(manifest.map((m) => [m.id, m]));

  const keepYes = new Set(order.filter((m) => ref[m.id].keep === 'yes').map((m) => m.id));

  // True series groups from labels (for keeper-match + collapse comparison)
  let g = -1; const grp = {};
  for (const m of manifest) { const r = ref[m.id]; if (!r) continue; if (!r.seriesWithPrev) g++; grp[m.id] = g; }
  const groupMembers = {};
  for (const m of order) (groupMembers[grp[m.id]] ||= []).push(m.id);
  const multi = Object.values(groupMembers).filter((x) => x.length >= 2);

  for (const key of ['sonnet', 'gpt-4.1-mini', 'gemini-flash']) {
    const data = JSON.parse(await readFile(join(EVAL, `results-${key}.json`), 'utf-8')).results;
    const photos = order.map((m) => {
      const r = data[m.id] || {};
      return {
        id: m.id, dateTaken: byId[m.id].dateTaken,
        aestheticScore: r.aestheticScore ?? 5, sharpnessScore: r.sharpnessScore ?? 5,
        sceneType: mergeScene(r.sceneType ?? 'other'),
        faceCount: r.faceCount ?? 0, facesEyesOpen: r.facesEyesOpen ?? true,
        facesExpression: r.facesExpression ?? 'none', facesFacingCamera: r.facesFacingCamera ?? false,
        hasAnimal: r.hasAnimal ?? false, animalClarity: r.animalClarity ?? 0, animalProximity: r.animalProximity ?? 0,
      };
    });
    const { selected } = select(photos, phash, CRIT, keepYes.size);
    const hit = (sel) => [...sel].filter((id) => keepYes.has(id)).length;
    const defHit = hit(selected);
    const blurry = [...selected].filter((id) => ref[id].sharp === false).length;
    // series-collapse against TRUE labeled series
    let leaky = 0, extra = 0, keeperHit = 0, keeperGroups = 0;
    for (const mem of multi) {
      const sel = mem.filter((id) => selected.has(id));
      if (sel.length > 1) { leaky++; extra += sel.length - 1; }
      const k = mem.find((id) => ref[id].keep === 'yes');
      if (k) { keeperGroups++; if (sel.includes(k)) keeperHit++; }
    }
    // Calibrate slider weights to maximize agreement with your "Ja" picks
    const best = calibrate(photos, phash, keepYes);
    console.log(`${key.padEnd(7)} | Default ${defHit}/${keepYes.size} (${Math.round(100 * defHit / keepYes.size)}%) → Kalibriert ${best.hit}/${keepYes.size} (${Math.round(100 * best.hit / keepYes.size)}%) | Serien ${leaky}/${multi.length} leck | Favorit ${keeperHit}/${keeperGroups} | unscharf ${blurry}`);
    console.log(`          beste Gewichte: ${Object.entries(best.weights).map(([k, v]) => `${k.replace('prefer', '')}=${v}`).join(' ')}`);
  }

  // Slider effect check (Sonnet)
  const sonnet = JSON.parse(await readFile(join(EVAL, 'results-sonnet.json'), 'utf-8')).results;
  const photos = order.map((m) => { const r = sonnet[m.id] || {}; return { id: m.id, dateTaken: byId[m.id].dateTaken, aestheticScore: r.aestheticScore ?? 5, sharpnessScore: r.sharpnessScore ?? 5, sceneType: mergeScene(r.sceneType ?? 'other'), faceCount: r.faceCount ?? 0, facesEyesOpen: r.facesEyesOpen ?? true, facesExpression: r.facesExpression ?? 'none', facesFacingCamera: false, hasAnimal: r.hasAnimal ?? false, animalClarity: r.animalClarity ?? 0, animalProximity: r.animalProximity ?? 0 }; });
  const isPeople = (id) => { const p = photos.find((x) => x.id === id); return p.sceneType === 'people' || p.sceneType === 'street'; };
  console.log('\nRegler-Effekt (Sonnet, 37 ausgewählt):');
  for (const w of [0, 0.25, 0.5, 0.75, 1.0]) {
    const { selected } = select(photos, phash, { ...CRIT, preferFaces: { enabled: true, weight: w } }, keepYes.size);
    console.log(`  preferFaces=${w.toFixed(2)} → People/Street: ${[...selected].filter(isPeople).length}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
