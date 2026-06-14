// Runs the v2-taxonomy analysis prompt over the cached thumbnails with three models
// (Haiku 4.5, Sonnet 4.6, Opus 4.8), holding everything else constant. Results are
// cached to .eval/results-<model>.json.
//
//   $env:ANTHROPIC_API_KEY="..."; node scripts/eval-run-models.mjs

import { createRequire } from 'module';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const require = createRequire(import.meta.url);
const Anthropic = require('@anthropic-ai/sdk');

const MANIFEST = join(process.cwd(), 'public', 'eval', 'manifest.json');
const THUMB_FS = join(process.cwd(), 'public');
const EVAL_DIR = join(process.cwd(), '.eval');
const BATCH = 20;
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY || 5); // parallel batches in flight
const LIMIT = process.env.EVAL_LIMIT ? Number(process.env.EVAL_LIMIT) : null; // cap photos (testing)

const MODELS = [
  { key: 'haiku', id: 'claude-haiku-4-5', inUsd: 1, outUsd: 5 },
  { key: 'sonnet', id: 'claude-sonnet-4-6', inUsd: 3, outUsd: 15 },
  { key: 'opus', id: 'claude-opus-4-8', inUsd: 5, outUsd: 25 },
];

// --- v2 taxonomy prompt ---
const SYSTEM_PROMPT = `You are a professional travel photo curator. Analyze each travel photograph and return a JSON object with these exact fields:

- aesthetic_score (integer 1-10): composition, lighting, color, visual appeal.
- album_score (integer 1-10): how likely a typical traveler would KEEP this photo for a photo book / album — overall keep-worthiness, weighing subject interest, the moment, expressions, and quality together. 10 = definitely keep, 1 = throwaway. This is a holistic "would I keep this?" judgement, not just technical quality.
- sharpness_score (integer 1-10): focus quality, absence of motion blur. 10 = tack sharp, 1 = very blurry.
- face_analysis: { "count": int, "eyes_open": bool, "facing_camera": bool, "expression": "friendly"|"neutral"|"negative"|"none" }
  - count: number of faces. 0 if none.
  - eyes_open: true if the primary/majority of faces have open eyes. true if count is 0.
  - facing_camera: true if the primary/majority of faces are turned toward the camera (not profile/looking away). true if count is 0.
  - expression: "friendly" = smiling/happy. "none" if no faces.
- animal_analysis: { "present": bool, "clarity_score": number 0-10, "proximity_score": number 0-10 }
- primary: the MAIN subject — exactly ONE of:
  "people"    — primarily about one or more persons
  "animal"    — an animal is the main subject
  "flora"     — close-up of plants or flowers (NOT wide scenery)
  "food"      — food or drink is the main subject
  "building"  — a building / architecture seen from OUTSIDE (facade, structure)
  "interior"  — the INSIDE of a room or building
  "signage"   — a sign, map, menu, board, or text/infographic
  "landscape" — wide natural scenery (nature, fields, water, valleys, forests)
  "beach"     — a beach is the main scene
  "mountain"  — mountains are the main scene
  "city"      — urban cityscape / skyline
  "street"    — street scene / street life
  "other"     — none of the above
  Choose by what dominates the frame / what the photo is "about".
- secondary: an array (may be empty) of context tags for WHERE/WHEN, drawn ONLY from:
  "indoor", "beach", "mountain", "city", "goldenhour" (sunrise/sunset light), "night"
  Add in addition to primary when relevant (people at the beach → primary "people", secondary ["beach"]). Empty if none apply.
- content_tags: array of 3-5 short descriptive tags.

Respond ONLY with a valid JSON array, one object per photo at the same index. No markdown, no explanation.`;

const VALID_PRIMARY = ['people', 'animal', 'flora', 'food', 'building', 'interior', 'signage', 'landscape', 'beach', 'mountain', 'city', 'street', 'other'];
const PRIMARY_ALIASES = {
  nature: 'landscape', sunset: 'landscape', sunrise: 'landscape', scenic: 'landscape', valley: 'landscape', field: 'landscape', forest: 'landscape', water: 'landscape', lake: 'landscape', river: 'landscape', desert: 'landscape',
  plant: 'flora', flower: 'flora', garden: 'flora',
  architecture: 'building', house: 'building', church: 'building', temple: 'building', monument: 'building', castle: 'building', palace: 'building', bridge: 'building', ruins: 'building', mosque: 'building',
  room: 'interior', indoor: 'interior', museum: 'interior',
  sign: 'signage', map: 'signage', menu: 'signage', text: 'signage',
  wildlife: 'animal', bird: 'animal', pet: 'animal',
  portrait: 'people', group: 'people', selfie: 'people', crowd: 'people',
  restaurant: 'food', drink: 'food',
  urban: 'city', skyline: 'city',
};
const normPrimary = (s) => { const x = String(s || '').toLowerCase().trim(); return VALID_PRIMARY.includes(x) ? x : (PRIMARY_ALIASES[x] || 'other'); };

const VALID_SECONDARY = ['indoor', 'beach', 'mountain', 'city', 'goldenhour', 'night'];
const SECONDARY_ALIASES = { sunset: 'goldenhour', sunrise: 'goldenhour', dusk: 'goldenhour', dawn: 'goldenhour', 'golden hour': 'goldenhour', stars: 'night', starry: 'night', ocean: 'beach', sea: 'beach', water: 'beach', urban: 'city', interior: 'indoor', inside: 'indoor' };
const normSecondary = (arr) => {
  if (!Array.isArray(arr)) return [];
  const out = new Set();
  for (const s of arr) { const x = String(s || '').toLowerCase().trim(); const v = VALID_SECONDARY.includes(x) ? x : SECONDARY_ALIASES[x]; if (v) out.add(v); }
  return [...out];
};

function buildUserPrompt(batch) {
  const n = batch.length;
  let p = `Analyze these ${n} travel photos. Photos are numbered 0 through ${n - 1}.\n\nContext per photo:\n`;
  batch.forEach((e, i) => {
    const parts = [`Photo ${i}`];
    if (e.dateTaken) { const d = new Date(e.dateTaken); parts.push(`taken ${d.toISOString().split('T')[0]} ${d.toTimeString().slice(0, 5)}`); }
    p += `- ${parts.join(', ')}\n`;
  });
  p += `\nReturn a JSON array of ${n} analysis objects.`;
  return p;
}

// Extract the first balanced JSON array, ignoring any prose before/after it.
function extractArray(s) {
  const start = s.indexOf('[');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; }
    else if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return null;
}

function parseResults(text, expected) {
  let j = text.trim();
  if (j.startsWith('```')) j = j.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  let arr = null;
  try { arr = JSON.parse(j); } catch { /* fall through */ }
  if (!Array.isArray(arr)) {
    const sub = extractArray(j);
    if (sub) { try { arr = JSON.parse(sub); } catch { /* fall through */ } }
  }
  if (!Array.isArray(arr)) { console.warn('  [parse] konnte Batch-JSON nicht lesen — mit Defaults gefüllt'); arr = []; }
  const def = { aesthetic_score: 5, sharpness_score: 5, face_analysis: {}, animal_analysis: {}, primary: 'other', secondary: [], content_tags: ['unanalyzed'] };
  while (arr.length < expected) arr.push(def);
  arr.length = expected;
  return arr.map((it) => ({
    aestheticScore: it.aesthetic_score ?? 5,
    albumScore: it.album_score ?? 5,
    sharpnessScore: it.sharpness_score ?? 5,
    faceCount: it.face_analysis?.count ?? 0,
    facesEyesOpen: it.face_analysis?.eyes_open ?? true,
    facesFacingCamera: it.face_analysis?.facing_camera ?? true,
    facesExpression: it.face_analysis?.expression ?? 'none',
    hasAnimal: it.animal_analysis?.present ?? false,
    animalClarity: it.animal_analysis?.clarity_score ?? 0,
    animalProximity: it.animal_analysis?.proximity_score ?? 0,
    sceneType: normPrimary(it.primary ?? it.scene_type),
    secondary: normSecondary(it.secondary),
    contentTags: Array.isArray(it.content_tags) ? it.content_tags : [],
  }));
}

async function imageBlock(thumbPath) {
  const data = await readFile(join(THUMB_FS, thumbPath));
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: data.toString('base64') } };
}

// Run async tasks with a bounded concurrency pool.
async function runPool(count, concurrency, worker) {
  let next = 0;
  async function loop() { while (next < count) { const i = next++; await worker(i); } }
  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, loop));
}

async function runModel(client, model, manifest) {
  console.log(`\n=== ${model.id} (Parallelität ${CONCURRENCY}) ===`);
  const results = {};
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const t0 = Date.now();
  const nBatches = Math.ceil(manifest.length / BATCH);
  let doneCount = 0;

  await runPool(nBatches, CONCURRENCY, async (b) => {
    const batch = manifest.slice(b * BATCH, (b + 1) * BATCH);
    const blocks = [];
    for (const e of batch) blocks.push(await imageBlock(e.thumb));
    blocks.push({ type: 'text', text: buildUserPrompt(batch) });
    let resp;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        resp = await client.messages.create({ model: model.id, max_tokens: 8192, system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: blocks }] });
        break;
      } catch (err) { console.warn(`  batch ${b + 1} attempt ${attempt + 1} failed: ${err.message}`); if (attempt === 1) throw err; await new Promise((r) => setTimeout(r, 2000)); }
    }
    usage.input += resp.usage.input_tokens || 0; usage.output += resp.usage.output_tokens || 0;
    usage.cacheRead += resp.usage.cache_read_input_tokens || 0; usage.cacheWrite += resp.usage.cache_creation_input_tokens || 0;
    const text = resp.content.find((c) => c.type === 'text')?.text || '';
    const parsed = parseResults(text, batch.length);
    batch.forEach((e, i) => { results[e.id] = parsed[i]; });
    console.log(`  batch ${b + 1}/${nBatches} ok (${++doneCount}/${nBatches} fertig)`);
  });
  const costUsd = (usage.input + usage.cacheWrite * 1.25 + usage.cacheRead * 0.1) / 1e6 * model.inUsd + usage.output / 1e6 * model.outUsd;
  const suffix = LIMIT ? '-test' : ''; // never clobber the full results during a limited test run
  const outName = `results-${model.key}${suffix}.json`;
  await writeFile(join(EVAL_DIR, outName), JSON.stringify({ model: model.id, generatedAt: new Date().toISOString(), usage: { ...usage, costUsd: Number(costUsd.toFixed(4)), ms: Date.now() - t0 }, results }, null, 2), 'utf-8');
  console.log(`  → ${outName}  ($${costUsd.toFixed(3)}, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  return costUsd;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not set.'); process.exit(1); }
  await mkdir(EVAL_DIR, { recursive: true });
  let manifest = JSON.parse(await readFile(MANIFEST, 'utf-8'));
  if (LIMIT) manifest = manifest.slice(0, LIMIT);
  console.log(`Loaded ${manifest.length} photos${LIMIT ? ` (limited to ${LIMIT})` : ''}.`);
  const client = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const models = process.env.EVAL_ONLY ? MODELS.filter((m) => m.key === process.env.EVAL_ONLY) : MODELS;
  let total = 0;
  for (const model of models) total += await runModel(client, model, manifest);
  console.log(`\nDone (${models.map((m) => m.key).join(', ')}). Cost ≈ $${total.toFixed(2)}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
