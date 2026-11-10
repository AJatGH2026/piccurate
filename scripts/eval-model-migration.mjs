// Model-migration check: gemini-2.5-flash → successor models.
//
// Background: Google redirects gemini-2.5-flash to gemini-3.5-flash-lite from
// 2026-12-01 (aistudio.google.com/docs/deprecations, read 2026-11-10). This
// script sends the 101-photo demo set (public/demo-set/) through each model
// with the SAME system prompt, request shape and thinking config that
// /api/analyze-demo uses in production, and compares the answers against a
// fresh gemini-2.5-flash run (and against the committed fixture, which was
// built with gemini-2.5-flash on 2026-09-27).
//
// It measures what decides the switch: does the request go through at all
// (HTTP 400?), how many batches come back blocked/empty, is the JSON valid,
// how close are the scores/scene types to 2.5, latency and token cost.
//
// Run from the project root (Node ≥ 22.6 for .ts imports):
//   node --env-file=.env.local scripts/eval-model-migration.mjs
// Knobs:
//   EVAL_MODELS=gemini-2.5-flash,gemini-3.5-flash-lite,gemini-3.8-flash
//   EVAL_LIMIT=20      # first N photos only
//   DRY_RUN=1          # build requests, no API call, no cost
//   PROBE=1            # one 1-photo request to gemini-3.5-flash-lite WITH the
//                      # old thinkingBudget:0 — answers "400 or ignored?"
//                      # (that is what the auto-redirect would receive)
// Output: .eval/migration-<model>.json (gitignored) + a table on stdout.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { GoogleGenAI } from '@google/genai';
import { ANALYSIS_SYSTEM_PROMPT } from '../src/lib/anthropic/prompts.ts';
import { geminiThinkingConfig } from '../src/lib/gemini-thinking.ts';

const ROOT = process.cwd();
const EVAL_DIR = join(ROOT, '.eval');
// EVAL_SET=ref: the hand-labelled set instead of the demo set. Expects
// .eval/ref-manifest.json ([{id, filename, dateTaken, cameraModel}]) and
// .eval/ref-thumbs/<filename> (512×512 centre crop, like production), plus
// .eval/reference.json (labels). All of it gitignored, built locally.
const REF_SET = process.env.EVAL_SET === 'ref';
const FIXTURE = REF_SET ? join(EVAL_DIR, 'ref-manifest.json') : join(ROOT, 'public', 'demo-set', 'fixture.json');
const PHOTO_DIR = REF_SET ? join(EVAL_DIR, 'ref-thumbs') : join(ROOT, 'public', 'demo-set', 'photos');
const SET_TAG = REF_SET ? '-ref' : '';
const BATCH = 20; // same as production (configure/page.tsx BATCH_SIZE)
const CONCURRENCY = 3;
const LIMIT = process.env.EVAL_LIMIT ? Number(process.env.EVAL_LIMIT) : null;
const DRY = process.env.DRY_RUN === '1';

// USD per 1M tokens (input / output), aistudio.google.com/docs/latest-model,
// read 2026-11-10. 3.8 Flash is an introductory price valid through 2026-12-31.
const PRICES = {
  'gemini-2.5-flash': [0.30, 2.50],
  'gemini-3.5-flash-lite': [0.30, 2.50],
  'gemini-3.8-flash': [0.75, 3.75],
};
const BASELINE = 'gemini-2.5-flash';

const MODELS = (process.env.EVAL_MODELS || 'gemini-2.5-flash,gemini-3.5-flash-lite,gemini-3.8-flash')
  .split(',').map((s) => s.trim()).filter(Boolean);

function buildParts(batch, photosB64) {
  // Mirrors /api/analyze-demo: intro, then per photo a label + the image,
  // then the closing instruction (no custom terms / persons / GPS here).
  const parts = [{
    text: `Analyze these ${batch.length} travel photo${batch.length === 1 ? '' : 's'} (numbered 0 through ${batch.length - 1}). Return one JSON object per photo in the order shown, wrapped in a JSON array.`,
  }];
  batch.forEach((p, i) => {
    const bits = [`Photo ${i}`];
    if (p.dateTaken) bits.push(`taken ${p.dateTaken.split('T')[0]}`);
    if (p.cameraModel) bits.push(String(p.cameraModel).slice(0, 60));
    parts.push({ text: `[${bits.join(', ')}]` });
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: photosB64[i] } });
  });
  parts.push({ text: `\nRespond with a JSON array of ${batch.length} objects — one per travel photo above, in the same order.` });
  return parts;
}

function parseArray(text) {
  let t = (text || '').trim();
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try { const a = JSON.parse(t); return Array.isArray(a) ? a : null; } catch { return null; }
}

const statusOf = (err) => {
  const m = String(err?.message || err);
  const code = err?.status ?? (m.match(/"code":\s*(\d{3})/)?.[1]) ?? null;
  return { code: code ? Number(code) : null, message: m.slice(0, 300) };
};

async function loadPhotos(list) {
  return Promise.all(list.map(async (p) => (await readFile(join(PHOTO_DIR, p.filename))).toString('base64')));
}

async function probe(client) {
  const fx = JSON.parse(await readFile(FIXTURE, 'utf-8'));
  const one = fx.photos.slice(0, 1);
  const parts = buildParts(one, await loadPhotos(one));
  console.log('PROBE: gemini-3.5-flash-lite with old thinkingBudget:0 …');
  try {
    const r = await client.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [{ role: 'user', parts }],
      config: { systemInstruction: ANALYSIS_SYSTEM_PROMPT, thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 16384, responseMimeType: 'application/json' },
    });
    console.log(`  → accepted. finishReason=${r.candidates?.[0]?.finishReason}, JSON ok=${!!parseArray(r.text)}, thoughtsTokens=${r.usageMetadata?.thoughtsTokenCount ?? 0}`);
  } catch (err) {
    const s = statusOf(err);
    console.log(`  → REJECTED: HTTP ${s.code ?? '?'} — ${s.message}`);
  }
}

async function runModel(client, model, photos) {
  const batches = [];
  for (let i = 0; i < photos.length; i += BATCH) batches.push(photos.slice(i, i + BATCH));
  const out = { model, runAt: new Date().toISOString(), thinkingConfig: geminiThinkingConfig(model), batches: [], results: {} };
  const usage = { input: 0, output: 0, thoughts: 0 };
  let next = 0;
  const t0 = Date.now();
  async function worker() {
    while (next < batches.length) {
      const b = next++;
      const batch = batches[b];
      const parts = buildParts(batch, await loadPhotos(batch));
      const rec = { batch: b, size: batch.length };
      if (DRY) { rec.dry = true; rec.parts = parts.length; out.batches[b] = rec; continue; }
      const ts = Date.now();
      try {
        const r = await client.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: { systemInstruction: ANALYSIS_SYSTEM_PROMPT, thinkingConfig: geminiThinkingConfig(model), maxOutputTokens: 16384, responseMimeType: 'application/json' },
        });
        rec.ms = Date.now() - ts;
        rec.blockReason = r.promptFeedback?.blockReason ?? null;
        rec.finishReason = r.candidates?.[0]?.finishReason ?? null;
        const u = r.usageMetadata || {};
        usage.input += u.promptTokenCount || 0;
        usage.output += (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0); // thoughts are billed as output
        usage.thoughts += u.thoughtsTokenCount || 0;
        const arr = parseArray(r.text);
        rec.jsonOk = !!arr;
        rec.countOk = !!arr && arr.length === batch.length;
        if (arr) batch.forEach((p, i) => { if (arr[i]) out.results[p.id] = arr[i]; });
      } catch (err) {
        rec.ms = Date.now() - ts;
        rec.error = statusOf(err);
      }
      out.batches[b] = rec;
      console.log(`  ${model} batch ${b + 1}/${batches.length}: ${rec.error ? `ERROR ${rec.error.code}` : rec.blockReason ? `BLOCKED ${rec.blockReason}` : `${rec.finishReason}, json=${rec.jsonOk}`} (${rec.ms} ms)`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  const [pin, pout] = PRICES[model] || [NaN, NaN];
  out.usage = { ...usage, costUsd: +((usage.input * pin + usage.output * pout) / 1e6).toFixed(4), wallMs: Date.now() - t0 };
  if (!DRY) await writeFile(join(EVAL_DIR, `migration-${model}${SET_TAG}${LIMIT ? '-test' : ''}.json`), JSON.stringify(out, null, 2));
  return out;
}

// Normalise one answer (raw model JSON or fixture entry) to comparable fields.
function norm(x) {
  if (!x) return null;
  return {
    scene: String(x.scene_type ?? x.primary ?? x.sceneType ?? '').toLowerCase(),
    album: Number(x.album_score ?? x.albumScore),
    aesthetic: Number(x.aesthetic_score ?? x.aestheticScore),
    sharp: Number(x.sharpness_score ?? x.sharpnessScore),
    faces: Number(x.face_analysis?.count ?? x.faceCount ?? 0),
  };
}

function compare(label, photos, a, b) {
  let n = 0, scene = 0, faces = 0, dAlbum = 0, dAesth = 0, dSharp = 0;
  for (const p of photos) {
    const x = norm(a(p)), y = norm(b(p));
    if (!x || !y) continue;
    n++;
    if (x.scene === y.scene) scene++;
    if (x.faces === y.faces) faces++;
    dAlbum += Math.abs(x.album - y.album);
    dAesth += Math.abs(x.aesthetic - y.aesthetic);
    dSharp += Math.abs(x.sharp - y.sharp);
  }
  const pct = (v) => (n ? `${Math.round((100 * v) / n)} %` : '–');
  const avg = (v) => (n ? (v / n).toFixed(2) : '–');
  console.log(`  ${label.padEnd(44)} n=${String(n).padStart(3)}  Motiv gleich ${pct(scene).padStart(5)}  Gesichter gleich ${pct(faces).padStart(5)}  Δalbum ${avg(dAlbum)}  Δästhetik ${avg(dAesth)}  Δschärfe ${avg(dSharp)}`);
}

// Against the hand labels: scene accuracy, faces/animals/blur as yes-no
// detection (precision/recall), and whether album_score separates the photos
// labelled "keep" from those labelled "no" (AUC: 0.5 = chance, 1 = perfect).
function compareRef(label, photos, get, ref) {
  let n = 0, scene = 0;
  const det = { faces: [0, 0, 0], animals: [0, 0, 0], blur: [0, 0, 0] }; // tp, fp, fn
  const keep = [], drop = [];
  const add = (k, r, m) => { if (r && m) det[k][0]++; else if (!r && m) det[k][1]++; else if (r && !m) det[k][2]++; };
  for (const p of photos) {
    const r = ref[p.id], x = norm(get(p));
    if (!r || !x) continue;
    n++;
    if (x.scene === String(r.primary || '').toLowerCase()) scene++;
    add('faces', !!r.faces, x.faces > 0);
    add('animals', !!r.animals, !!(get(p).animal_analysis?.present));
    add('blur', r.sharp === false, x.sharp < 5);
    if (r.keep === 'yes') keep.push(x.album); else if (r.keep === 'no') drop.push(x.album);
  }
  let wins = 0;
  for (const a of keep) for (const b of drop) wins += a > b ? 1 : a === b ? 0.5 : 0;
  const auc = keep.length && drop.length ? wins / (keep.length * drop.length) : NaN;
  const pr = ([tp, fp, fn]) => `P ${tp + fp ? Math.round((100 * tp) / (tp + fp)) : '–'} / R ${tp + fn ? Math.round((100 * tp) / (tp + fn)) : '–'}`;
  const mean = (a) => (a.length ? (a.reduce((s, v) => s + v, 0) / a.length).toFixed(1) : '–');
  console.log(`  ${label.padEnd(24)} n=${n}  Motiv richtig ${n ? Math.round((100 * scene) / n) : '–'} %  Gesichter ${pr(det.faces)}  Tiere ${pr(det.animals)}  Unscharf ${pr(det.blur)}  Behalten-AUC ${auc.toFixed(2)} (Ø album: behalten ${mean(keep)}, nicht ${mean(drop)})`);
}

async function main() {
  await mkdir(EVAL_DIR, { recursive: true });
  if (!DRY && !process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set (run with --env-file=.env.local)');
  const client = DRY ? null : new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  if (process.env.PROBE === '1') { if (DRY) throw new Error('PROBE needs the API'); await probe(client); return; }

  const fx = JSON.parse(await readFile(FIXTURE, 'utf-8'));
  let photos = REF_SET ? fx : fx.photos;
  if (LIMIT) photos = photos.slice(0, LIMIT);
  console.log(`${photos.length} photos, models: ${MODELS.join(', ')}${DRY ? ' (DRY RUN)' : ''}`);

  const runs = {};
  for (const m of MODELS) runs[m] = await runModel(client, m, photos);

  console.log('\nZusammenfassung');
  for (const [m, r] of Object.entries(runs)) {
    const bs = r.batches;
    const err = bs.filter((x) => x.error).length;
    const blocked = bs.filter((x) => x.blockReason || (x.finishReason && x.finishReason !== 'STOP')).length;
    const bad = bs.filter((x) => !x.error && !x.dry && !x.countOk).length;
    const ms = bs.filter((x) => x.ms).map((x) => x.ms);
    console.log(`  ${m.padEnd(24)} Pakete ${bs.length}, Fehler ${err}, blockiert/abgebrochen ${blocked}, JSON unbrauchbar ${bad}, Ø ${ms.length ? Math.round(ms.reduce((s, v) => s + v, 0) / ms.length) : '–'} ms/Paket, Kosten ≈ $${r.usage.costUsd} (thoughts ${r.usage.thoughts} Tok.)`);
    if (err) console.log(`    erste Fehlermeldung: ${bs.find((x) => x.error).error.message}`);
  }
  if (DRY) return;

  if (REF_SET) {
    const ref = JSON.parse(await readFile(join(EVAL_DIR, 'reference.json'), 'utf-8'));
    console.log('\nGegen die Handbewertung (P = Treffsicherheit, R = Vollständigkeit, in %)');
    for (const m of MODELS) compareRef(m, photos, (p) => runs[m].results[p.id], ref);
    if (runs[BASELINE]) {
      console.log('\nÜbereinstimmung mit 2.5 Flash (heute)');
      for (const m of MODELS.filter((x) => x !== BASELINE)) compare(`${m} vs. 2.5 Flash`, photos, (p) => runs[m].results[p.id], (p) => runs[BASELINE].results[p.id]);
    }
    return;
  }

  console.log('\nÜbereinstimmung (Abweichung Δ = mittlere absolute Differenz der 1–10-Werte)');
  const fixtureOf = (p) => p;
  for (const m of MODELS) compare(`${m} vs. Fixture (2.5 Flash, 27.09.)`, photos, (p) => runs[m].results[p.id], fixtureOf);
  if (runs[BASELINE]) {
    for (const m of MODELS.filter((x) => x !== BASELINE)) compare(`${m} vs. 2.5 Flash (heute)`, photos, (p) => runs[m].results[p.id], (p) => runs[BASELINE].results[p.id]);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
