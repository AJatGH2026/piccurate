// Album-worthiness experiment: does the model's album_score predict the human
// "keep" decision better than aesthetic_score or the current engine score?
//   node scripts/eval-album.mjs

import { readFile } from 'fs/promises';
import { join } from 'path';

const EVAL = join(process.cwd(), '.eval');
const MANIFEST = join(process.cwd(), 'public', 'eval', 'manifest.json');
const mergeScene = (s) => (s === 'nature' ? 'landscape' : s);
const CRIT = { preferFaces: { enabled: true, weight: 0.8 }, preferAnimals: { enabled: true, weight: 0.7 }, preferLandscapes: { enabled: true, weight: 0.6 }, preferArchitecture: { enabled: true, weight: 0.5 }, preferFood: { enabled: true, weight: 0.4 }, preferSharpness: { enabled: true, weight: 0.9 }, dedupSensitivity: 8 };

function hamming(a, b) { if (!a || !b) return 99; let d = 0; for (let i = 0; i < a.length; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { d += x & 1; x >>= 1; } } return d; }

function prefScore(p, c) {
  let s = p.aestheticScore * 0.2;
  if (c.preferSharpness.enabled) s += p.sharpnessScore * c.preferSharpness.weight * 0.5;
  if (c.preferFaces.enabled && p.faceCount > 0 && (p.sceneType === 'people' || p.sceneType === 'street')) { let f = 4 + p.faceCount; if (p.facesEyesOpen) f += 2; if (p.facesFacingCamera) f += 2; if (p.facesExpression === 'friendly') f += 2; s += f * c.preferFaces.weight; }
  if (c.preferAnimals.enabled && p.hasAnimal && p.sceneType === 'animal') s += (4 + p.animalClarity * 0.5 + p.animalProximity * 0.5) * c.preferAnimals.weight;
  if (c.preferLandscapes.enabled && ['landscape', 'beach', 'mountain'].includes(p.sceneType)) s += (4 + p.aestheticScore * 0.6) * c.preferLandscapes.weight;
  if (c.preferArchitecture.enabled && ['building', 'interior', 'architecture', 'city'].includes(p.sceneType)) s += (4 + p.aestheticScore * 0.6) * c.preferArchitecture.weight;
  if (c.preferFood.enabled && p.sceneType === 'food') s += (4 + p.aestheticScore * 0.6) * c.preferFood.weight;
  return s;
}

function detectSeries(photos, phash, D) {
  const sorted = [...photos].sort((a, b) => (a.dateTaken || '').localeCompare(b.dateTaken || ''));
  const clusters = []; let cur = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { cur = [sorted[i]]; continue; }
    const prev = sorted[i - 1], p = sorted[i];
    const gap = prev.dateTaken && p.dateTaken ? (new Date(p.dateTaken) - new Date(prev.dateTaken)) / 1000 : Infinity;
    if (gap <= 10 && hamming(phash[prev.id], phash[p.id]) <= D) cur.push(p); else { clusters.push(cur); cur = [p]; }
  }
  if (cur.length) clusters.push(cur);
  return clusters;
}

async function main() {
  const ref = JSON.parse(await readFile(join(EVAL, 'reference.json'), 'utf-8'));
  const man = JSON.parse(await readFile(MANIFEST, 'utf-8'));
  const phash = JSON.parse(await readFile(join(EVAL, 'phash.json'), 'utf-8'));
  const sonnet = JSON.parse(await readFile(join(EVAL, 'results-sonnet.json'), 'utf-8')).results;
  const byId = Object.fromEntries(man.map((m) => [m.id, m]));
  const order = man.filter((m) => { const r = ref[m.id]; return (r?.primary || r?.sceneType) && r?.keep; });
  const keepYes = new Set(order.filter((m) => ref[m.id].keep === 'yes').map((m) => m.id));
  const N = keepYes.size;

  const photos = order.map((m) => { const r = sonnet[m.id] || {}; return { id: m.id, dateTaken: byId[m.id].dateTaken, aestheticScore: r.aestheticScore ?? 5, albumScore: r.albumScore ?? 5, sharpnessScore: r.sharpnessScore ?? 5, sceneType: mergeScene(r.sceneType ?? 'other'), faceCount: r.faceCount ?? 0, facesEyesOpen: r.facesEyesOpen ?? true, facesFacingCamera: r.facesFacingCamera ?? false, facesExpression: r.facesExpression ?? 'none', hasAnimal: r.hasAnimal ?? false, animalClarity: r.animalClarity ?? 0, animalProximity: r.animalProximity ?? 0 }; });

  const hasAlbum = photos.some((p) => p.albumScore !== 5 && p.albumScore != null);
  console.log(`Album-Werte vorhanden: ${hasAlbum ? 'ja' : 'NEIN (Sonnet-Lauf mit album_score noch nicht fertig?)'}`);

  // Discrimination: mean score for keep=yes vs keep=no
  const mean = (arr, f) => (arr.reduce((s, p) => s + f(p), 0) / arr.length).toFixed(2);
  const yes = photos.filter((p) => keepYes.has(p.id));
  const no = photos.filter((p) => ref[p.id].keep === 'no');
  console.log(`\nMittelwert bei "Ja" vs "Nein":`);
  console.log(`  album_score:     Ja ${mean(yes, (p) => p.albumScore)}  vs  Nein ${mean(no, (p) => p.albumScore)}`);
  console.log(`  aesthetic_score: Ja ${mean(yes, (p) => p.aestheticScore)}  vs  Nein ${mean(no, (p) => p.aestheticScore)}`);

  // Series-collapse → representatives, then rank by each feature, take top N
  const clusters = detectSeries(photos, phash, 6 + CRIT.dedupSensitivity);
  const reps = clusters.map((cl) => cl.slice().sort((a, b) => (b.albumScore + b.aestheticScore) - (a.albumScore + a.aestheticScore))[0]);
  const overlap = (rankFn) => { const top = [...reps].sort((a, b) => rankFn(b) - rankFn(a)).slice(0, N); return top.filter((p) => keepYes.has(p.id)).length; };

  console.log(`\nAuswahl-Treffer (Top-${N} Repräsentanten gegen deine ${N} "Ja"):`);
  console.log(`  nach album_score:      ${overlap((p) => p.albumScore)}/${N} (${Math.round(100 * overlap((p) => p.albumScore) / N)}%)`);
  console.log(`  nach aesthetic_score:  ${overlap((p) => p.aestheticScore)}/${N} (${Math.round(100 * overlap((p) => p.aestheticScore) / N)}%)`);
  console.log(`  aktuelle Engine-Score: ${overlap((p) => prefScore(p, CRIT))}/${N} (${Math.round(100 * overlap((p) => prefScore(p, CRIT)) / N)}%)`);
  console.log(`  Engine + album (Mix):  ${overlap((p) => prefScore(p, CRIT) + p.albumScore * 1.5)}/${N} (${Math.round(100 * overlap((p) => prefScore(p, CRIT) + p.albumScore * 1.5) / N)}%)`);

  // Proposed product formula: album base + MODEST per-slider personalization
  const prod = (p, w) => {
    let s = p.albumScore * 2; // dominant keepability base
    if (w.sharp) s += p.sharpnessScore * w.sharp * 0.15;
    if (w.faces && p.faceCount > 0 && (p.sceneType === 'people' || p.sceneType === 'street')) { let f = 1; if (p.facesEyesOpen) f++; if (p.facesFacingCamera) f++; if (p.facesExpression === 'friendly') f++; s += f * w.faces * 0.8; }
    if (w.animals && p.hasAnimal && p.sceneType === 'animal') s += 3 * w.animals * 0.8;
    if (w.land && ['landscape', 'beach', 'mountain'].includes(p.sceneType)) s += 3 * w.land * 0.8;
    if (w.arch && ['building', 'interior', 'city'].includes(p.sceneType)) s += 3 * w.arch * 0.8;
    if (w.food && p.sceneType === 'food') s += 3 * w.food * 0.8;
    return s;
  };
  const neutral = { sharp: 0, faces: 0, animals: 0, land: 0, arch: 0, food: 0 };
  console.log(`\nVorgeschlagene Produkt-Formel (Album-Basis + moderate Regler):`);
  console.log(`  Default-Treffer: ${overlap((p) => prod(p, neutral))}/${N} (${Math.round(100 * overlap((p) => prod(p, neutral)) / N)}%)`);
  const isPeople = (id) => { const p = photos.find((x) => x.id === id); return p.sceneType === 'people' || p.sceneType === 'street'; };
  console.log('  Regler-Effekt preferFaces → People/Street in Top-86:');
  for (const fw of [0, 0.5, 1.0]) {
    const top = [...reps].sort((a, b) => prod(b, { ...neutral, faces: fw }) - prod(a, { ...neutral, faces: fw })).slice(0, N);
    console.log(`    faces=${fw} → ${top.filter((p) => isPeople(p.id)).length} People/Street`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
