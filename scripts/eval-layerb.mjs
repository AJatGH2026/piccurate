// Layer B — evaluates the SELECTION ENGINE (not the model's perception).
// Reimplements the app's selection logic (usePhotoStore.runSelection) faithfully,
// runs it on each model's cached analysis, and scores the result against the human
// reference: keep-agreement, series-collapse (dedup), blurry leakage, and whether
// the criteria sliders/presets actually change the output.
//
//   node scripts/eval-layerb.mjs

import { readFile } from 'fs/promises';
import { join } from 'path';

const EVAL_DIR = join(process.cwd(), '.eval');
const MANIFEST = join(process.cwd(), 'public', 'eval', 'manifest.json');
const MODELS = [
  { key: 'haiku', label: 'Haiku 4.5' },
  { key: 'sonnet', label: 'Sonnet 4.6' },
  { key: 'opus', label: 'Opus 4.8' },
];

// nature → landscape merge (per user decision)
const mergeScene = (s) => (s === 'nature' ? 'landscape' : s);

// --- Faithful reimplementation of DEFAULT_CRITERIA + runSelection ---
const DEFAULT_CRITERIA = {
  preferFaces: { enabled: true, weight: 0.8 },
  preferAnimals: { enabled: true, weight: 0.7 },
  preferLandscapes: { enabled: true, weight: 0.6 },
  preferArchitecture: { enabled: true, weight: 0.5 },
  preferFood: { enabled: true, weight: 0.4 },
  preferSharpness: { enabled: true, weight: 0.9 },
  preferDiversity: { enabled: true, weight: 0.7 },
  selectionPercentage: 8,
  dedupSensitivity: 5,
};

function computeScore(p, c) {
  let score = 0;
  score += p.aestheticScore * 0.2;
  if (c.preferSharpness.enabled) score += p.sharpnessScore * c.preferSharpness.weight * 0.15;
  if (c.preferFaces.enabled && p.faceCount > 0) {
    const isPeople = p.sceneType === 'people' || p.sceneType === 'street';
    let f = p.faceCount * 1.5;
    if (p.facesEyesOpen) f += 2;
    if (p.facesExpression === 'friendly') f += 2;
    if (!isPeople) f *= 0.3;
    score += f * c.preferFaces.weight * 0.15;
  }
  if (c.preferAnimals.enabled && p.hasAnimal) {
    const isAnimal = p.sceneType === 'animal';
    let a = p.animalClarity * 0.5 + p.animalProximity * 0.5;
    if (!isAnimal) a *= 0.4;
    score += a * c.preferAnimals.weight * 0.15;
  }
  if (c.preferLandscapes.enabled && ['landscape', 'sunset', 'beach', 'mountain', 'nature'].includes(p.sceneType)) {
    score += p.aestheticScore * c.preferLandscapes.weight * 0.15;
  }
  if (c.preferArchitecture.enabled && (p.sceneType === 'architecture' || p.sceneType === 'city')) {
    score += p.aestheticScore * c.preferArchitecture.weight * 0.12;
  }
  if (c.preferFood.enabled && p.sceneType === 'food') {
    score += p.aestheticScore * c.preferFood.weight * 0.12;
  }
  return score;
}

/** Returns a Set of selected indices. If forceCount is given, selects exactly that many. */
function runSelection(photos, c, forceCount) {
  const scored = photos.map((p, idx) => ({ idx, score: computeScore(p, c), scene: p.sceneType }));
  scored.sort((a, b) => b.score - a.score);
  const selectCount = forceCount ?? Math.max(1, Math.round(photos.length * ((c.selectionPercentage || 8) / 100)));
  const selected = new Set();
  const sceneCounts = {};
  const maxPerScene = c.preferDiversity.enabled ? Math.max(2, Math.ceil(selectCount * 0.4)) : selectCount;
  for (const { idx, scene } of scored) {
    if (selected.size >= selectCount) break;
    if ((sceneCounts[scene] || 0) >= maxPerScene) continue;
    selected.add(idx);
    sceneCounts[scene] = (sceneCounts[scene] || 0) + 1;
  }
  if (selected.size < selectCount) {
    for (const { idx } of scored) {
      if (selected.size >= selectCount) break;
      selected.add(idx);
    }
  }
  return selected;
}

async function loadJson(p, fb) {
  try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; }
}

async function main() {
  const reference = await loadJson(join(EVAL_DIR, 'reference.json'), {});
  const manifest = await loadJson(MANIFEST, []);
  const order = manifest.map((m) => m.id).filter((id) => reference[id]?.sceneType && reference[id]?.keep);

  // Reference truth
  const keepYes = new Set(order.filter((id) => reference[id].keep === 'yes'));
  const keepYesMaybe = new Set(order.filter((id) => reference[id].keep === 'yes' || reference[id].keep === 'maybe'));
  const N = order.length;

  // Series groups (chain seriesWithPrev in chronological/manifest order)
  let g = -1;
  const group = {};
  for (const id of order) {
    if (!reference[id].seriesWithPrev) g++;
    group[id] = g;
  }
  const groupMembers = {};
  for (const id of order) (groupMembers[group[id]] ||= []).push(id);
  const multiGroups = Object.values(groupMembers).filter((m) => m.length >= 2);
  const totalSeriesPhotos = multiGroups.reduce((s, m) => s + m.length, 0);

  console.log(`Layer B — Auswahl-Engine gegen ${N} gelabelte Fotos`);
  console.log(`Referenz: ${keepYes.size}× Behalten=Ja, ${keepYesMaybe.size}× Ja+Vielleicht`);
  console.log(`Serien: ${multiGroups.length} Mehrbild-Serien (${totalSeriesPhotos} Fotos), Rest Einzelbilder\n`);

  for (const m of MODELS) {
    const data = await loadJson(join(EVAL_DIR, `results-${m.key}.json`), null);
    if (!data) { console.log(`${m.label}: keine Ergebnisse`); continue; }

    // Build photo array in `order`, applying nature→landscape merge
    const photos = order.map((id) => {
      const r = data.results[id] || {};
      return {
        id,
        aestheticScore: r.aestheticScore ?? 5,
        sharpnessScore: r.sharpnessScore ?? 5,
        sceneType: mergeScene(r.sceneType ?? 'other'),
        faceCount: r.faceCount ?? 0,
        facesEyesOpen: r.facesEyesOpen ?? true,
        facesExpression: r.facesExpression ?? 'none',
        hasAnimal: r.hasAnimal ?? false,
        animalClarity: r.animalClarity ?? 0,
        animalProximity: r.animalProximity ?? 0,
      };
    });

    // Select exactly as many as the human kept (Ja) → precision==recall = overlap
    const sel = runSelection(photos, DEFAULT_CRITERIA, keepYes.size);
    const selIds = new Set([...sel].map((i) => photos[i].id));

    const hitYes = [...selIds].filter((id) => keepYes.has(id)).length;
    const hitYesMaybe = [...selIds].filter((id) => keepYesMaybe.has(id)).length;
    const blurrySelected = [...selIds].filter((id) => reference[id].sharp === false).length;

    // Series-collapse
    let leakySeries = 0, extraDupes = 0, keeperMatch = 0, keeperGroups = 0;
    for (const mem of multiGroups) {
      const selInGroup = mem.filter((id) => selIds.has(id));
      if (selInGroup.length > 1) { leakySeries++; extraDupes += selInGroup.length - 1; }
      const groupKeeper = mem.find((id) => reference[id].keep === 'yes');
      if (groupKeeper) {
        keeperGroups++;
        if (selInGroup.includes(groupKeeper)) keeperMatch++;
      }
    }

    console.log(`── ${m.label} ──`);
    console.log(`  Auswahl-Treffer: ${hitYes}/${keepYes.size} deiner "Ja" (${Math.round(100 * hitYes / keepYes.size)}%), inkl. Vielleicht ${hitYesMaybe}/${keepYesMaybe.size}`);
    console.log(`  Unscharf in Auswahl: ${blurrySelected}`);
    console.log(`  Serien-Kollaps: ${leakySeries}/${multiGroups.length} Serien mit >1 Auswahl → ${extraDupes} überflüssige Beinahe-Dubletten`);
    console.log(`  Lieblingsbild getroffen: ${keeperMatch}/${keeperGroups} Serien\n`);
  }

  // --- Criteria responsiveness (on Sonnet) ---
  const sonnet = await loadJson(join(EVAL_DIR, 'results-sonnet.json'), null);
  if (sonnet) {
    const photos = order.map((id) => {
      const r = sonnet.results[id] || {};
      return { id, aestheticScore: r.aestheticScore ?? 5, sharpnessScore: r.sharpnessScore ?? 5, sceneType: mergeScene(r.sceneType ?? 'other'), faceCount: r.faceCount ?? 0, facesEyesOpen: r.facesEyesOpen ?? true, facesExpression: r.facesExpression ?? 'none', hasAnimal: r.hasAnimal ?? false, animalClarity: r.animalClarity ?? 0, animalProximity: r.animalProximity ?? 0 };
    });
    const countScene = (sel, pred) => [...sel].filter((i) => pred(photos[i])).length;
    const isPeople = (p) => p.sceneType === 'people' || p.sceneType === 'street';
    const isLand = (p) => ['landscape', 'sunset', 'beach', 'mountain'].includes(p.sceneType);

    console.log('=== Reagieren die Regler? (Sonnet, 37 ausgewählt) ===');
    for (const w of [0, 0.5, 1.0]) {
      const c = { ...DEFAULT_CRITERIA, preferFaces: { enabled: true, weight: w } };
      const sel = runSelection(photos, c, keepYes.size);
      console.log(`  preferFaces=${w.toFixed(1)} → People/Street in Auswahl: ${countScene(sel, isPeople)}`);
    }
    console.log('  --- Presets ---');
    const presets = {
      balanced: DEFAULT_CRITERIA,
      people: { ...DEFAULT_CRITERIA, preferFaces: { enabled: true, weight: 1.0 }, preferAnimals: { enabled: false, weight: 0.3 }, preferLandscapes: { enabled: true, weight: 0.4 } },
      landscape: { ...DEFAULT_CRITERIA, preferFaces: { enabled: true, weight: 0.3 }, preferLandscapes: { enabled: true, weight: 1.0 }, preferArchitecture: { enabled: true, weight: 0.8 } },
    };
    for (const [name, c] of Object.entries(presets)) {
      const sel = runSelection(photos, c, keepYes.size);
      console.log(`  ${name.padEnd(10)} → People/Street: ${countScene(sel, isPeople)}, Landscape: ${countScene(sel, isLand)}, Animal: ${countScene(sel, (p) => p.sceneType === 'animal')}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
