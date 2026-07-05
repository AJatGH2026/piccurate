// Runs the v2-taxonomy analysis prompt over the cached thumbnails, holding
// the prompt and reference photos constant, across multiple providers so we
// can compare Sonnet 4.6 (quality anchor) against cheaper Google/OpenAI
// candidates. Results are cached per-model to .eval/results-<key>.json.
//
// Env for the different providers (set the ones you want to run):
//   ANTHROPIC_API_KEY  — Anthropic Sonnet / Haiku / Opus
//   OPENAI_API_KEY     — OpenAI GPT-4.1 mini
//   GEMINI_API_KEY     — Google Gemini 2.5 Flash / Flash-Lite
//
// Filter which models run:
//   EVAL_ONLY=gemini-flash      # single model
//   EVAL_MODELS=sonnet,gemini-flash,gpt-4.1-mini,gemini-flash-lite
//
// Testing knobs:
//   EVAL_LIMIT=20                # cap photos
//   EVAL_CONCURRENCY=5           # parallel batches in flight

import { createRequire } from 'module';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const require = createRequire(import.meta.url);
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');

const MANIFEST = join(process.cwd(), 'public', 'eval', 'manifest.json');
const THUMB_FS = join(process.cwd(), 'public');
const EVAL_DIR = join(process.cwd(), '.eval');
const BATCH = 20;
const CONCURRENCY_DEFAULT = Number(process.env.EVAL_CONCURRENCY || 5);
// Google Gemini free tier is 5 RPM for gemini-2.5-flash → run serial there.
// Anthropic/OpenAI happily handle 5 in flight.
const CONCURRENCY_BY_PROVIDER = { anthropic: CONCURRENCY_DEFAULT, openai: CONCURRENCY_DEFAULT, google: 1 };
const LIMIT = process.env.EVAL_LIMIT ? Number(process.env.EVAL_LIMIT) : null;

// Provider adapters (below). Prices in USD per 1M tokens; cache rates are
// per-provider conventions (Anthropic: cache_read ~10% of input, cache_write
// ~125%; OpenAI: cached_input ~25%; Google: cached_input ~25%).
const MODELS = [
  { key: 'sonnet',            id: 'claude-sonnet-4-6', provider: 'anthropic', inUsd: 3.00, outUsd: 15.00 },
  { key: 'haiku',             id: 'claude-haiku-4-5',  provider: 'anthropic', inUsd: 1.00, outUsd: 5.00 },
  { key: 'gpt-4.1-mini',      id: 'gpt-4.1-mini',      provider: 'openai',    inUsd: 0.40, outUsd: 1.60 },
  { key: 'gemini-flash',      id: 'gemini-2.5-flash',       provider: 'google', inUsd: 0.30, outUsd: 2.50 },
  { key: 'gemini-flash-lite', id: 'gemini-2.5-flash-lite',  provider: 'google', inUsd: 0.10, outUsd: 0.40 },
];

// --- v2 taxonomy prompt (identical across providers) ---
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

async function loadThumbBase64(thumbPath) {
  const data = await readFile(join(THUMB_FS, thumbPath));
  return data.toString('base64');
}

// ────────────────────────────────────────────────────────────
// Provider adapters. Each returns { text, usage } with usage in tokens.
// ────────────────────────────────────────────────────────────

const providers = {
  anthropic: {
    make() {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
      return new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    },
    async runBatch(client, model, batch, userPrompt) {
      const blocks = [];
      for (const e of batch) {
        const b64 = await loadThumbBase64(e.thumb);
        blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });
      }
      blocks.push({ type: 'text', text: userPrompt });
      const resp = await client.messages.create({
        model: model.id,
        max_tokens: 8192,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: blocks }],
      });
      const text = resp.content.find((c) => c.type === 'text')?.text || '';
      const u = resp.usage || {};
      return {
        text,
        usage: {
          input: u.input_tokens || 0,
          output: u.output_tokens || 0,
          cacheRead: u.cache_read_input_tokens || 0,
          cacheWrite: u.cache_creation_input_tokens || 0,
        },
      };
    },
    costUsd(usage, model) {
      // Anthropic: cache_read ~10% of input rate, cache_write ~125% (approx).
      return (
        (usage.input + usage.cacheWrite * 1.25 + usage.cacheRead * 0.1) / 1e6 * model.inUsd
        + usage.output / 1e6 * model.outUsd
      );
    },
  },

  openai: {
    make() {
      if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
      return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    },
    async runBatch(client, model, batch, userPrompt) {
      // OpenAI Responses / Chat API: images go via image_url with base64 data URI.
      const content = [];
      for (const e of batch) {
        const b64 = await loadThumbBase64(e.thumb);
        content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } });
      }
      content.push({ type: 'text', text: userPrompt });
      const resp = await client.chat.completions.create({
        model: model.id,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
      });
      const text = resp.choices?.[0]?.message?.content || '';
      const u = resp.usage || {};
      return {
        text,
        usage: {
          input: u.prompt_tokens || 0,
          output: u.completion_tokens || 0,
          cacheRead: u.prompt_tokens_details?.cached_tokens || 0,
          cacheWrite: 0,
        },
      };
    },
    costUsd(usage, model) {
      // OpenAI: cached_input is 25% of input; deduct that portion.
      const nonCached = Math.max(0, usage.input - usage.cacheRead);
      return (nonCached + usage.cacheRead * 0.25) / 1e6 * model.inUsd + usage.output / 1e6 * model.outUsd;
    },
  },

  google: {
    make() {
      if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
      return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    },
    async runBatch(client, model, batch, userPrompt) {
      // Google GenAI: parts array with inline base64 data.
      const parts = [];
      for (const e of batch) {
        const b64 = await loadThumbBase64(e.thumb);
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } });
      }
      parts.push({ text: userPrompt });
      const resp = await client.models.generateContent({
        model: model.id,
        contents: [{ role: 'user', parts }],
        config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 8192 },
      });
      const text = resp.text || '';
      const u = resp.usageMetadata || {};
      return {
        text,
        usage: {
          input: u.promptTokenCount || 0,
          output: u.candidatesTokenCount || 0,
          cacheRead: u.cachedContentTokenCount || 0,
          cacheWrite: 0,
        },
      };
    },
    costUsd(usage, model) {
      // Google: cached content is ~25% of input rate.
      const nonCached = Math.max(0, usage.input - usage.cacheRead);
      return (nonCached + usage.cacheRead * 0.25) / 1e6 * model.inUsd + usage.output / 1e6 * model.outUsd;
    },
  },
};

async function runPool(count, concurrency, worker) {
  let next = 0;
  async function loop() { while (next < count) { const i = next++; await worker(i); } }
  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, loop));
}

// Parse a "retry after N seconds" hint from a provider error (Google's 429
// includes retryDelay: "38s"; OpenAI puts Retry-After in a header we don't
// easily reach here — fall back to a fixed delay for those).
function retryDelayMs(err) {
  const msg = err?.message || '';
  const m = msg.match(/retryDelay["':\s]+"?(\d+(?:\.\d+)?)s/i) || msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (m) return Math.ceil(Number(m[1]) * 1000);
  // Any 429 without hint → assume 30s.
  if (/429|rate[_-]?limit|RESOURCE_EXHAUSTED/i.test(msg)) return 30_000;
  return 2_000;
}

async function runModel(model, manifest) {
  const adapter = providers[model.provider];
  const client = adapter.make();
  const concurrency = CONCURRENCY_BY_PROVIDER[model.provider] ?? CONCURRENCY_DEFAULT;
  console.log(`\n=== ${model.key}  (${model.provider}:${model.id}, concurrency ${concurrency}) ===`);
  const results = {};
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const t0 = Date.now();
  const nBatches = Math.ceil(manifest.length / BATCH);
  let doneCount = 0;

  await runPool(nBatches, concurrency, async (b) => {
    const batch = manifest.slice(b * BATCH, (b + 1) * BATCH);
    const userPrompt = buildUserPrompt(batch);
    let out;
    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try { out = await adapter.runBatch(client, model, batch, userPrompt); break; }
      catch (err) {
        const delay = retryDelayMs(err);
        console.warn(`  batch ${b + 1} attempt ${attempt + 1} failed (retry in ${Math.round(delay / 1000)}s): ${err.message.slice(0, 200)}`);
        if (attempt === MAX_ATTEMPTS - 1) throw err;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    usage.input += out.usage.input;
    usage.output += out.usage.output;
    usage.cacheRead += out.usage.cacheRead;
    usage.cacheWrite += out.usage.cacheWrite;
    const parsed = parseResults(out.text, batch.length);
    batch.forEach((e, i) => { results[e.id] = parsed[i]; });
    console.log(`  batch ${b + 1}/${nBatches} ok (${++doneCount}/${nBatches} done)`);
  });

  const costUsd = adapter.costUsd(usage, model);
  const suffix = LIMIT ? '-test' : '';
  const outName = `results-${model.key}${suffix}.json`;
  await writeFile(
    join(EVAL_DIR, outName),
    JSON.stringify(
      {
        model: model.id,
        provider: model.provider,
        generatedAt: new Date().toISOString(),
        usage: { ...usage, costUsd: Number(costUsd.toFixed(4)), ms: Date.now() - t0 },
        results,
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`  → ${outName}  ($${costUsd.toFixed(3)}, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  return costUsd;
}

function selectModels() {
  const only = process.env.EVAL_ONLY;
  const list = process.env.EVAL_MODELS;
  if (only) return MODELS.filter((m) => m.key === only);
  if (list) {
    const keys = list.split(',').map((s) => s.trim()).filter(Boolean);
    return keys.map((k) => MODELS.find((m) => m.key === k)).filter(Boolean);
  }
  // Default: run the four candidates the user asked for.
  const defaultKeys = ['sonnet', 'gemini-flash', 'gpt-4.1-mini', 'gemini-flash-lite'];
  return defaultKeys.map((k) => MODELS.find((m) => m.key === k)).filter(Boolean);
}

async function main() {
  await mkdir(EVAL_DIR, { recursive: true });
  let manifest = JSON.parse(await readFile(MANIFEST, 'utf-8'));
  if (LIMIT) manifest = manifest.slice(0, LIMIT);
  console.log(`Loaded ${manifest.length} photos${LIMIT ? ` (limited to ${LIMIT})` : ''}.`);
  const models = selectModels();
  console.log(`Running: ${models.map((m) => m.key).join(', ')}`);
  let total = 0;
  for (const model of models) {
    try {
      total += await runModel(model, manifest);
    } catch (err) {
      console.error(`  ✗ ${model.key} failed: ${err.message}`);
    }
  }
  console.log(`\nDone. Cost ≈ $${total.toFixed(2)}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
