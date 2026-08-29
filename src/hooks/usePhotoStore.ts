'use client';

import { create } from 'zustand';
import type { ClientPhoto, AIAnalysis } from '@/types/photo';
import type { CriteriaConfig, Person } from '@/types/criteria';
import { DEFAULT_CRITERIA, MAX_PERSONS } from '@/types/criteria';
import { cosineSim } from '@/utils/embedding';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessedPhoto {
  id: string;
  filename: string;
  originalFile: File | null; // original full-resolution file for ZIP download
  thumbnailUrl: string;
  thumbnailBlob: Blob | null;
  phash: string | null; // 16-hex perceptual hash for near-duplicate / series detection
  embedding: number[] | null; // CLIP image embedding for cross-camera near-duplicate detection
  /**
   * Locally computed face embeddings, one per detected face. Carried over from
   * the upload pass; `null` means the person search never ran for this photo,
   * an empty array means it ran and found no face.
   *
   * Kept instead of a match result so the "streng ↔ großzügig" threshold can be
   * re-applied instantly without re-running the model. Session-only, never
   * persisted, never transmitted.
   */
  faceEmbeddings: number[][] | null;
  dateTaken: string | null;
  latitude: number | null;
  longitude: number | null;
  cameraModel: string | null;
  originalWidth: number | null;
  originalHeight: number | null;
  aestheticScore: number;
  albumScore: number;
  sharpnessScore: number;
  sceneType: string;
  secondary: string[];
  faceCount: number;
  facesEyesOpen: boolean;
  facesFacingCamera: boolean;
  facesExpression: string;
  hasAnimal: boolean;
  animalClarity: number;
  animalProximity: number;
  contentTags: string[];
  customMatches: string[]; // user-defined terms found in this photo (lowercased)
  persons: string[]; // reference-person names recognised in this photo (lowercased)
  place: string; // AI-derived place name from GPS ("City, Country"); '' when no GPS
  selected: boolean;
  saved: boolean; // user-locked keeper: stays selected, excluded from re-selection pool
  reasonTag: string | null;
  selectionScore: number;
  analyzed: boolean;
}

interface PhotoStore {
  photos: ProcessedPhoto[];
  /**
   * CLIP embeddings still being computed by the upload pipeline.
   *
   * Lives HERE rather than in useUpload, because that hook unmounts the moment
   * the user leaves /upload while its embedding queue is still draining — and
   * that queue is exactly what must survive. The embeddings only have to be
   * complete by the time dedup actually runs (applyAnalysisResults below), not
   * when the user leaves the upload page, so the wait belongs on "Analysieren",
   * where the time spent choosing criteria and waiting for Gemini has already
   * paid most of it off.
   */
  embeddingsPending: number;
  /** Called by the upload pipeline when it queues one photo's CLIP embedding. */
  noteEmbeddingStarted: () => void;
  /**
   * Called when one embedding settles. Patches the photo by id, which is what
   * makes a LATE embedding (computed after setPhotosFromUpload already
   * snapshotted the set) still land instead of being silently dropped.
   * A null embedding just decrements — the photo keeps falling back to pHash.
   */
  noteEmbeddingSettled: (photoId: string, embedding: number[] | null) => void;
  /**
   * The analysis job currently in progress for this photo set, if any —
   * reused across a retry (partial batch failure, a later "catch up on the
   * rest" visit to /configure) instead of creating and — once paid tiers are
   * live — paying for a new one just to finish the same run. Reset whenever
   * the photo set itself changes (`setPhotosFromUpload`, `clear`), since a
   * job belongs to the photos it was created for. Server-side, the same job
   * id can already accept multiple analyze-demo calls (photo_count
   * accumulates, the tier limit is re-checked each time) — this only makes
   * the client actually reuse it instead of abandoning it on every retry.
   */
  activeJobId: string | null;
  setActiveJobId: (jobId: string | null) => void;
  /**
   * What the § 312f BGB confirmation needs to state about this contract, kept
   * next to the job it belongs to and cleared with it.
   *
   * Held here rather than on /configure so the confirmation stays reachable
   * after the user moves on to /review and /results — a durable-medium
   * confirmation the visitor can only save during the seconds before they
   * click "Weiter" would not be much of one.
   */
  contract: { jobId: string; tier: string; photoLimit: number; placedAt: string } | null;
  setContract: (c: { jobId: string; tier: string; photoLimit: number; placedAt: string } | null) => void;
  /** Custom terms present at the last analysis (to detect when re-analysis is needed). */
  analyzedCustomTerms: string[];
  /**
   * Reference persons (feature 5b). Session-only — never persisted. Blob + name
   * roundtrip to the LLM; slider weight drives selection bias/filter.
   */
  persons: Person[];
  /** Person names present at the last analysis (lowercased, for the diff check). */
  analyzedPersons: string[];
  /**
   * Similarity threshold for the local person search ("streng ↔ großzügig").
   * Deliberately exposed as a plain number here and as an unlabelled slider in
   * the UI — § 1(5) of the plan forbids showing a cosine value to the user.
   */
  personThreshold: number;
  /** Set the threshold and re-derive every photo's person matches from it. */
  setPersonThreshold: (threshold: number) => void;
  /**
   * Has the user seen and confirmed which photos the exclude mode removes?
   *
   * GATE 1, Entscheidung 6: exclude never removes silently. Until this is true,
   * exclude-mode persons are ignored by the selection, so no photo disappears
   * without the user having looked at it.
   */
  excludeConfirmed: boolean;
  setExcludeConfirmed: (confirmed: boolean, criteria: CriteriaConfig) => void;
  /** Photos that exclude-mode persons WOULD remove — the confirmation list. */
  photosPendingExclusion: () => ProcessedPhoto[];
  setPhotosFromUpload: (clientPhotos: ClientPhoto[]) => void;
  /** Apply AI results. If analyzedIds is given, results map to those photos (by id, in order); otherwise to all photos by index. */
  applyAnalysisResults: (results: AIAnalysis[], criteria: CriteriaConfig, analyzedIds?: string[]) => void;
  rerunSelection: (criteria: CriteriaConfig) => void;
  toggleSelection: (id: string) => void;
  /** Lock all currently selected photos as saved keepers (persist across re-runs). */
  saveSelection: () => void;
  /** Unlock a saved photo (and deselect it). */
  unlock: (id: string) => void;
  /** Add a reference person. Returns false when the max (4) is reached or the name is a duplicate. */
  /**
   * Add a reference person. `embedding` is the locally computed face vector; it
   * is optional so the cloud path keeps working until the cutover release.
   * Returns false when the max (4) is reached or the name is a duplicate.
   */
  addPerson: (name: string, blob: Blob, embedding?: number[] | null) => boolean;
  removePerson: (id: string) => void;
  renamePerson: (id: string, name: string) => void;
  setPersonWeight: (id: string, weight: number) => void;
  setPersonMode: (id: string, mode: 'include' | 'exclude') => void;
  clear: () => void;
}

// nature → landscape merge (taxonomy decision)
const mergeScene = (s: string): string => (s === 'nature' ? 'landscape' : s);

const ARCH_SCENES = ['building', 'interior', 'architecture', 'city'];

// Drink keywords so coffee/cocktails/etc. count as "food & dining" even when
// the AI's primary scene isn't "food" (matched as substrings in content tags).
const DRINK_TAGS = [
  'coffee', 'espresso', 'cappuccino', 'latte', 'tea', 'drink', 'beverage',
  'cocktail', 'wine', 'beer', 'juice', 'cafe', 'café', 'smoothie', 'soda', 'bar',
];

// Motif criteria (sharpness is a quality modifier, not a motif).
const MOTIF_KEYS = [
  'preferFaces',
  'preferAnimals',
  'preferLandscapes',
  'preferArchitecture',
  'preferFood',
] as const;
type MotifKey = (typeof MOTIF_KEYS)[number];

/**
 * Does a photo belong to a criterion's motif? Used both for biasing (1–9) and
 * for exclusive filtering (slider at 10). People is keyed on faceCount (so a
 * person in front of a building or a landscape counts, an isolated animal does
 * not); landscape/architecture also accept relevant secondary tags to lift
 * recall when the AI's primary scene is off.
 */
function matchesMotif(p: ProcessedPhoto, key: MotifKey): boolean {
  const scene = mergeScene(p.sceneType);
  switch (key) {
    case 'preferFaces':
      // Any photo the model marked as people/street counts, even if the face
      // detector didn't flag it (e.g. distant silhouettes, backs of heads).
      return p.faceCount > 0 || scene === 'people' || scene === 'street';
    case 'preferAnimals':
      // Same story for animals: primary=animal is a stronger signal than
      // animal_analysis.present, which Gemini leaves false surprisingly often
      // even on obvious animal shots.
      return p.hasAnimal || scene === 'animal';
    case 'preferLandscapes':
      // Classic scenery only — beach is excluded to keep this clean.
      return scene === 'landscape' || scene === 'mountain';
    case 'preferArchitecture':
      // Primary building scenes only. (The secondary "indoor"/"city" tags
      // pulled in restaurant food and indoor people, so they're not used.)
      return ARCH_SCENES.includes(scene);
    case 'preferFood': {
      if (scene === 'food') return true;
      // Coffee / drinks: catch via content tags (substring) — covers cases the
      // AI labels as a non-food primary scene.
      const tags = (p.contentTags || []).map((t) => t.toLowerCase());
      return tags.some((t) => DRINK_TAGS.some((d) => t.includes(d)));
    }
  }
}

/** Motif criteria the user pushed to the maximum (slider 10 = weight 1.0). */
function exclusiveMotifs(criteria: CriteriaConfig): MotifKey[] {
  return MOTIF_KEYS.filter((k) => criteria[k].enabled && criteria[k].weight >= 1);
}

/**
 * Strip a leading "no/not/kein/keine/ohne " from a term, leaving the bare
 * attribute (e.g. "no snow" → "snow", "kein Schnee" → "Schnee"). Both the
 * server-side Gemini prompt and the client-side matching operate on this
 * positive form — the AI is always asked "is X visible?", never "is X not
 * visible?", which makes its answer well-defined even when the attribute is
 * irrelevant to a photo (e.g. sunglasses on a tiger picture).
 */
export function stripNegativePrefix(term: string): string {
  return term.replace(/^\s*(no|not|kein|keine|ohne)\s+/i, '').trim();
}

/** Does a photo carry the (positive) attribute for a custom term? */
function matchesCustom(p: ProcessedPhoto, term: string): boolean {
  const t = stripNegativePrefix(term).toLowerCase().trim();
  return !!t && (p.customMatches || []).includes(t);
}

/**
 * A custom term is treated as a NEGATIVE (exclusion) criterion if it begins
 * with a linguistic "no/not/without" marker. Interpretation: exclude photos
 * where the AI *positively* confirmed the attribute is visible. If the AI
 * left the tag off (unclear or irrelevant), the photo is kept.
 */
export function isNegativeCustom(term: string): boolean {
  return /^\s*(no|not|kein|keine|ohne)\s+/i.test(term);
}

/** Does a photo contain a specific reference person? Matched by lowercased name. */
function matchesPerson(p: ProcessedPhoto, name: string): boolean {
  const n = name.toLowerCase().trim();
  return !!n && (p.persons || []).includes(n);
}

// ---------------------------------------------------------------------------
// Local person matching
// ---------------------------------------------------------------------------

/**
 * Default similarity threshold for include mode.
 *
 * 0.48 is the operating point measured on the 309-photo test set for the
 * shipped configuration (one reference photo per person): it is the loosest
 * threshold that still holds precision ≥ 0.95, the § 5.2 gate. Recall there is
 * 0.611 — knowingly below the 0.80 target, see GATE 1 Entscheidung 5.
 */
export const DEFAULT_PERSON_THRESHOLD = 0.48;

/**
 * Exclude mode never matches looser than this, whatever the slider says.
 *
 * Exclude REMOVES photos, so its failure mode is destructive in a way include's
 * is not. § 5.2 demands precision ≥ 0.98 for it; 0.58 is the measured point
 * where that holds. Letting the "großzügig" end of the slider drag exclude below
 * it would quietly start deleting other people's photos.
 */
export const EXCLUDE_MIN_THRESHOLD = 0.58;

/** Cosine similarity of two unit-normalised face embeddings. */
function faceSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return -1;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Recompute `photo.persons` from locally computed face embeddings.
 *
 * Runs entirely on the device: it compares the stored per-face vectors against
 * each reference person's vector. Nothing here talks to a server — that is the
 * whole point of the feature (§ 3 rules 3 and 10).
 *
 * Photos whose `faceEmbeddings` is null never had a face pass (the person search
 * was not active when they were uploaded); they are left with no matches rather
 * than guessed at.
 */
function applyLocalPersonMatches(
  photos: ProcessedPhoto[],
  persons: Person[],
  threshold: number
): ProcessedPhoto[] {
  const refs = persons
    .filter((p) => p.embedding && p.name.trim())
    .map((p) => ({
      name: p.name.toLowerCase().trim(),
      embedding: p.embedding as number[],
      // Exclude gets the stricter of the two thresholds — see EXCLUDE_MIN_THRESHOLD.
      threshold: p.mode === 'exclude' ? Math.max(threshold, EXCLUDE_MIN_THRESHOLD) : threshold,
    }));

  if (refs.length === 0) return photos.map((p) => (p.persons.length ? { ...p, persons: [] } : p));

  return photos.map((photo) => {
    if (!photo.faceEmbeddings || photo.faceEmbeddings.length === 0) {
      return photo.persons.length ? { ...photo, persons: [] } : photo;
    }
    const hits: string[] = [];
    for (const ref of refs) {
      // A photo matches a person if ANY face in it is similar enough — group
      // photos are the normal case, not the exception.
      let best = -1;
      for (const face of photo.faceEmbeddings) {
        const s = faceSim(ref.embedding, face);
        if (s > best) best = s;
      }
      if (best >= ref.threshold) hits.push(ref.name);
    }
    const same =
      hits.length === photo.persons.length && hits.every((h) => photo.persons.includes(h));
    return same ? photo : { ...photo, persons: hits };
  });
}

/** Hamming distance between two 16-hex (64-bit) perceptual hashes. */
function hamming(a: string | null, b: string | null): number {
  if (!a || !b || a.length !== b.length) return 99;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

/**
 * Global ranking score. Validated against the human reference (381 photos):
 *  - Base = album_score (holistic keep-worthiness) — the single best predictor
 *    of which photos a person keeps (≈50% agreement vs ≈36% for the old
 *    criteria-weighted formula).
 *  - Sliders are OPT-IN personalization on top: at weight 0 (default) they have
 *    no effect, so the default selection is pure album-quality; raising a slider
 *    biases the ranking toward that category. Strong, monotonic effect.
 */
function computeScore(photo: ProcessedPhoto, criteria: CriteriaConfig, persons: Person[]): number {
  // Base = holistic keep-worthiness (album_score, ~0–10).
  let score = photo.albumScore;

  // Sharpness is a frame parameter (no toggle in the UI, like size + dedup):
  // always applied; strength controlled by the slider weight.
  score += photo.sharpnessScore * criteria.preferSharpness.weight * 0.5;

  // Motif bias: a matching photo gets a STRONG, weight-scaled bonus
  // (weight 0.1–1.0 → +1…+10 on a 0–10 base), so the sliders move the
  // selection meaningfully. Non-matching photos get nothing.
  for (const key of MOTIF_KEYS) {
    const c = criteria[key];
    if (c.enabled && matchesMotif(photo, key)) {
      score += c.weight * 10;
    }
  }
  // User-defined POSITIVE custom criteria behave like motifs. Negative
  // criteria (e.g. "no snow") are handled as a hard pool filter in
  // runSelection — the scoring step never sees photos that carry the
  // excluded content, so we can safely ignore negatives here.
  for (const cc of criteria.customCriteria || []) {
    if (isNegativeCustom(cc.term)) continue;
    if (matchesCustom(photo, cc.term)) {
      score += cc.weight * 10;
    }
  }
  // Reference persons (feature 5b): identical bias mechanic — matching photos
  // get a slider-scaled bonus, non-matches get nothing. Exclude-mode persons
  // never contribute a bonus (they filter the pool upstream instead).
  for (const person of persons) {
    if (person.mode === 'exclude') continue;
    if (matchesPerson(photo, person.name)) {
      score += person.weight * 10;
    }
  }
  return score;
}

/**
 * Quality of a photo WITHIN its series — what makes the best of a burst.
 * Face quality first (facing camera, eyes open, smiling), then sharpness, then aesthetic.
 */
function inSeriesScore(p: ProcessedPhoto): number {
  let faceQ = 0;
  if (p.faceCount > 0) {
    if (p.facesFacingCamera) faceQ += 3;
    if (p.facesEyesOpen) faceQ += 2;
    if (p.facesExpression === 'friendly') faceQ += 2;
  }
  return faceQ * 2 + p.sharpnessScore * 1.0 + p.aestheticScore * 0.5;
}

/**
 * Generate a reason tag based on the AI's scene detection.
 */
function generateReasonTag(photo: ProcessedPhoto): string {
  const scene = mergeScene(photo.sceneType);
  const tags = photo.contentTags.join(', ');
  switch (scene) {
    case 'people':
    case 'street':
      if (photo.faceCount > 1) return `Group photo — ${photo.faceCount} people, ${tags}`;
      if (photo.faceCount === 1) return `Portrait — ${tags}`;
      return `Street scene — ${tags}`;
    case 'animal': return `Animal photo — ${tags}`;
    case 'flora': return `Plants / flowers — ${tags}`;
    case 'landscape': return `Landscape — ${tags}`;
    case 'beach': return `Beach scene — ${tags}`;
    case 'mountain': return `Mountain view — ${tags}`;
    case 'building': return `Architecture — ${tags}`;
    case 'interior': return `Interior — ${tags}`;
    case 'signage': return `Sign / map — ${tags}`;
    case 'city': return `City view — ${tags}`;
    case 'food': return `Food — ${tags}`;
    default: return tags || scene;
  }
}

// Cap for the O(N²) time-independent visual pass. Above this the pool falls back
// to burst-only clustering (rare — only very large jobs).
const VISUAL_DEDUP_MAX = 5000;

/**
 * Cluster photos into series via union-find. Two photos join the same series if
 * EITHER rule fires — so the result is strictly at least as aggressive as a pure
 * burst detector:
 *
 *  1. BURST (time-gated): time-sorted neighbours within GAP_S seconds AND pHash
 *     distance ≤ D. Catches rapid-fire bursts even when the frame changes a bit.
 *  2. VISUAL / pHash (time-independent): ANY two photos with pHash distance ≤ Dv.
 *     Catches pixel-level "looks almost identical" re-shots minutes apart or with
 *     other photos interleaved. Dv kept tight so different-but-similar scenes
 *     aren't merged.
 *  3. SEMANTIC / embedding (time-independent): ANY two photos whose CLIP
 *     embeddings have cosine ≥ SIM. Catches the same scene shot by DIFFERENT
 *     cameras/people — different viewpoint, framing, colour — which pHash cannot
 *     recognise. No-op for photos whose embedding hasn't been computed (falls
 *     back to pHash).
 *
 * All thresholds scale with the Duplicates slider (1 = lenient … 10 = strict):
 *   Slider 1  → GAP_S =  0s, D =  7, Dv = 0, SIM = 0.97  (near-exact only)
 *   Slider 8  → GAP_S = 47s, D = 14, Dv = 6, SIM ≈ 0.90  (default)
 *   Slider 10 → GAP_S = 60s, D = 16, Dv = 8, SIM = 0.88  (aggressive)
 */
function detectSeries(photos: ProcessedPhoto[], criteria: CriteriaConfig): ProcessedPhoto[][] {
  const s = Math.max(1, Math.min(10, criteria.dedupSensitivity || 8));
  const GAP_S = Math.round(((s - 1) * 60) / 9);
  const D = 6 + s;
  const Dv = Math.round(((s - 1) * 8) / 9);
  // Cosine threshold for cross-camera semantic dedup. Empirical — tune on real
  // sets if it over- or under-merges.
  const SIM = 0.97 - ((s - 1) * (0.97 - 0.88)) / 9;

  const sorted = [...photos].sort((a, b) => (a.dateTaken || '').localeCompare(b.dateTaken || ''));
  const n = sorted.length;

  // Union-find.
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // Rule 1 — burst: consecutive time-sorted neighbours.
  for (let i = 1; i < n; i++) {
    const prev = sorted[i - 1], p = sorted[i];
    const gap = prev.dateTaken && p.dateTaken
      ? (new Date(p.dateTaken).getTime() - new Date(prev.dateTaken).getTime()) / 1000
      : Infinity;
    if (gap <= GAP_S && hamming(prev.phash, p.phash) <= D) union(i - 1, i);
  }

  // Rules 2 & 3 — time-independent, all pairs (capped): pHash for pixel-level
  // near-dups, embedding cosine for same-scene-different-camera.
  if (n <= VISUAL_DEDUP_MAX) {
    for (let i = 0; i < n; i++) {
      const a = sorted[i];
      for (let j = i + 1; j < n; j++) {
        if (find(i) === find(j)) continue;
        const b = sorted[j];
        const pHashHit = Dv > 0 && !!a.phash && !!b.phash && hamming(a.phash, b.phash) <= Dv;
        // cosineSim returns 0 when either embedding is missing, so this is a
        // no-op until the background embedding lands.
        const embHit = pHashHit || cosineSim(a.embedding, b.embedding) >= SIM;
        if (embHit) union(i, j);
      }
    }
  }

  // Group by root, preserving time order within each cluster.
  const groups = new Map<number, ProcessedPhoto[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(sorted[i]);
    else groups.set(r, [sorted[i]]);
  }
  return [...groups.values()];
}

/**
 * Run selection. Always collapses each series to one best representative.
 * Then, depending on the sliders:
 *  - One or more motif sliders at MAX (10) → exclusive FILTER: keep only reps
 *    matching ANY of those motifs (OR), and select (nearly) ALL of them —
 *    the selectionPercentage cap is ignored ("≈100% of that motif").
 *  - Otherwise → balanced/biased: rank reps by score and take the top N% as a
 *    MAXIMUM (selectionPercentage). Sliders 1–9 bias the ranking toward a motif.
 */
function runSelection(
  photos: ProcessedPhoto[],
  criteria: CriteriaConfig,
  persons: Person[],
  excludeConfirmed: boolean
): ProcessedPhoto[] {
  // Split custom criteria into positive (bias/filter) and negative (hard
  // exclusion). Negatives are applied to the pool FIRST — they always win
  // over any positive slider, regardless of its value.
  const customs = criteria.customCriteria || [];
  const negativeCustoms = customs.filter((c) => isNegativeCustom(c.term));
  const positiveCustoms = customs.filter((c) => !isNegativeCustom(c.term));
  // Persons split identically: exclude-mode acts as hard filter, include-mode
  // drives bias/exclusive selection downstream.
  //
  // TEMPORARILY disabled 2026-08-14 at the product owner's request: the
  // mandatory preview+confirm step (components/persons/ExcludeConfirm.tsx,
  // no longer rendered on the review page) duplicated the review page's own
  // "show rejected" toggle, which already lets any photo — excluded or not —
  // be viewed and reselected at any time. Re-enable by restoring the
  // `excludeConfirmed ?` check below and re-rendering <ExcludeConfirm> in
  // review/page.tsx. A permanent keep-or-delete decision is owed before
  // commercial launch — see docs/legal/personensuche-umsetzungsplan.md § 7d.
  //
  // ⚠️ The gate existed for a real reason, not just ceremony (GATE 1,
  // Entscheidung 6, 13.08.2026): exclude-mode recall measures 0.49
  // (personensuche-spike-messbericht.md), so roughly HALF of an excluded
  // person's photos can silently remain selected. The reject-toggle only
  // protects a user who thinks to go looking for them — the permanent
  // decision should be made with that number in view, not without it.
  const excludePersons = persons.filter((p) => p.mode === 'exclude');
  const includePersons = persons.filter((p) => p.mode !== 'exclude');

  // Saved photos are locked keepers: always selected, excluded from the pool.
  // Negative-criterion filter: exclude a photo only if the AI POSITIVELY
  // confirmed the excluded attribute is visible. If the AI didn't tag it
  // (unclear or irrelevant — e.g. "no sunglasses" on a tiger photo), the
  // photo is kept. matchesCustom already strips the "no/kein/…" prefix, so
  // it asks "is snow visible?" against the AI's positive answer.
  // Same semantics for exclude-mode persons: a photo is dropped only when
  // the AI positively identified the named face.
  const pool = photos.filter((p) => {
    if (p.saved) return false;
    for (const nc of negativeCustoms) if (matchesCustom(p, nc.term)) return false;
    for (const ep of excludePersons) if (matchesPerson(p, ep.name)) return false;
    return true;
  });

  const scored: Record<string, number> = {};
  for (const p of pool) scored[p.id] = computeScore(p, criteria, persons);

  // One representative per series (best in-series quality), within the pool.
  const clusters = detectSeries(pool, criteria);
  const repIds = new Set<string>();
  for (const cl of clusters) {
    const rep = cl.slice().sort((a, b) => inSeriesScore(b) - inSeriesScore(a))[0];
    repIds.add(rep.id);
  }
  const reps = pool.filter((p) => repIds.has(p.id));
  reps.sort((a, b) => scored[b.id] - scored[a.id]);

  // Upper bound applies in BOTH modes: at most N% of the pool.
  const percentage = criteria.selectionPercentage || 8;
  const cap = Math.max(1, Math.round(pool.length * (percentage / 100)));

  const exclusive = exclusiveMotifs(criteria);
  // Only positive customs can act as an exclusive filter — negatives already
  // filtered the pool above.
  const exclusiveCustom = positiveCustoms.filter((c) => c.weight >= 1);
  // Include-mode persons at max slider (weight ≥ 1.0) act as an exclusive
  // OR-filter, same semantics as motifs / positive customs. Exclude-mode
  // persons already left the pool above and are irrelevant here.
  const exclusivePersons = includePersons.filter((p) => p.weight >= 1);
  let selectedIds: Set<string>;
  if (exclusive.length > 0 || exclusiveCustom.length > 0 || exclusivePersons.length > 0) {
    // Filter mode ("only these"): take EVERY rep matching ANY maxed motif OR
    // maxed positive custom term OR maxed reference person.
    //
    // The N%-cap deliberately does NOT apply here. Crucial subtlety: `cap` is
    // computed on the post-exclusion pool, not the total photo count. When
    // exclude-mode persons (or negative custom terms) remove most photos, the
    // pool can shrink to a handful, so `round(pool * 30%)` collapses to 1 — and
    // that silently truncated obviously-eligible matches (e.g. "only AK"
    // returning 1 of 3 solo-AK photos on a trip full of the excluded people).
    // An exclusive slider is an explicit "give me every photo with this" ask,
    // so we honour all matches. Series-collapse still ran upstream, so bursts
    // don't flood the result.
    const eligible = reps.filter(
      (p) =>
        exclusive.some((k) => matchesMotif(p, k)) ||
        exclusiveCustom.some((c) => matchesCustom(p, c.term)) ||
        exclusivePersons.some((person) => matchesPerson(p, person.name))
    );
    selectedIds = new Set(eligible.map((p) => p.id));
  } else {
    // Balanced/biased: top N% of the pool.
    selectedIds = new Set(reps.slice(0, cap).map((p) => p.id));
  }

  return photos.map((p) => {
    if (p.saved) return { ...p, selected: true }; // locked keeper stays in
    return {
      ...p,
      selectionScore: scored[p.id] ?? 0,
      selected: selectedIds.has(p.id),
      reasonTag: selectedIds.has(p.id) ? generateReasonTag(p) : null,
    };
  });
}

export const usePhotoStore = create<PhotoStore>((set, get) => ({
  photos: [],
  embeddingsPending: 0,
  noteEmbeddingStarted: () => set((state) => ({ embeddingsPending: state.embeddingsPending + 1 })),
  noteEmbeddingSettled: (photoId, embedding) =>
    set((state) => ({
      // max(0) because clear() resets the counter while embeddings for the
      // discarded photos are still in flight and will settle afterwards.
      embeddingsPending: Math.max(0, state.embeddingsPending - 1),
      photos: embedding
        ? state.photos.map((p) => (p.id === photoId ? { ...p, embedding } : p))
        : state.photos,
    })),
  activeJobId: null,
  setActiveJobId: (jobId) => set({ activeJobId: jobId }),
  contract: null,
  setContract: (c) => set({ contract: c }),
  analyzedCustomTerms: [],
  persons: [],
  analyzedPersons: [],
  personThreshold: DEFAULT_PERSON_THRESHOLD,

  setPersonThreshold: (threshold) => {
    set((state) => ({
      personThreshold: threshold,
      photos: applyLocalPersonMatches(state.photos, state.persons, threshold),
      // Moving the threshold changes WHICH photos exclude would remove, so an
      // earlier confirmation no longer covers the new set. Ask again.
      excludeConfirmed: false,
    }));
  },

  excludeConfirmed: false,

  setExcludeConfirmed: (confirmed, criteria) => {
    set((state) => ({
      excludeConfirmed: confirmed,
      photos: runSelection(state.photos, criteria, state.persons, confirmed),
    }));
  },

  photosPendingExclusion: () => {
    const { photos, persons } = get();
    const excludeNames = persons.filter((p) => p.mode === 'exclude').map((p) => p.name);
    if (excludeNames.length === 0) return [];
    return photos.filter((p) => !p.saved && excludeNames.some((n) => matchesPerson(p, n)));
  },

  setPhotosFromUpload: (clientPhotos: ClientPhoto[]) => {
    const readyPhotos = clientPhotos.filter((p) => p.status === 'ready' && p.thumbnailUrl);

    readyPhotos.sort((a, b) => {
      const dateA = a.exif?.dateTaken || '';
      const dateB = b.exif?.dateTaken || '';
      return dateA.localeCompare(dateB);
    });

    const processed: ProcessedPhoto[] = readyPhotos.map((p) => ({
      id: p.id,
      filename: p.filename,
      originalFile: p.file, // keep the original File for ZIP download
      thumbnailUrl: p.thumbnailUrl!,
      thumbnailBlob: p.thumbnailBlob,
      phash: p.phash || null,
      embedding: p.embedding || null,
      faceEmbeddings: p.faceEmbeddings ?? null,
      dateTaken: p.exif?.dateTaken || null,
      latitude: p.exif?.latitude || null,
      longitude: p.exif?.longitude || null,
      cameraModel: p.exif?.cameraModel || null,
      originalWidth: p.exif?.originalWidth || null,
      originalHeight: p.exif?.originalHeight || null,
      aestheticScore: 5,
      albumScore: 5,
      sharpnessScore: 5,
      sceneType: 'other',
      secondary: [],
      faceCount: 0,
      facesEyesOpen: false,
      facesFacingCamera: false,
      facesExpression: 'none',
      hasAnimal: false,
      animalClarity: 0,
      animalProximity: 0,
      contentTags: [],
      customMatches: [],
      persons: [],
      place: '',
      selected: false,
      saved: false,
      reasonTag: null,
      selectionScore: 0,
      analyzed: false,
    }));

    // Derive person matches immediately: the face embeddings arrived with the
    // upload, so the answer is already computable — no need to wait for the
    // (network-bound) AI analysis. That independence is the point of § 2.3.
    set((state) => ({
      photos: applyLocalPersonMatches(processed, state.persons, state.personThreshold),
      // A new photo set needs its own job — the previous one (if any) was
      // sized and, once paid tiers are live, paid for a different set of
      // photos, so it must not be reused for this one.
      activeJobId: null,
      contract: null,
    }));
  },

  applyAnalysisResults: (results: AIAnalysis[], criteria: CriteriaConfig, analyzedIds?: string[]) => {
    set((state) => {
      const photos = [...state.photos];
      const apply = (idx: number, r: AIAnalysis) => {
        photos[idx] = {
          ...photos[idx],
          aestheticScore: r.aestheticScore,
          albumScore: r.albumScore,
          sharpnessScore: r.sharpnessScore,
          sceneType: r.sceneType,
          secondary: r.secondary,
          faceCount: r.faceAnalysis.count,
          facesEyesOpen: r.faceAnalysis.eyesOpen,
          facesFacingCamera: r.faceAnalysis.facingCamera,
          facesExpression: r.faceAnalysis.expression,
          hasAnimal: r.animalAnalysis.present,
          animalClarity: r.animalAnalysis.clarityScore,
          animalProximity: r.animalAnalysis.proximityScore,
          contentTags: r.contentTags,
          customMatches: r.customMatches || [],
          // `persons` is NOT taken from the AI response any more — it is derived
          // locally from face embeddings (applyLocalPersonMatches). Keeping the
          // existing value means an analysis run cannot overwrite the local
          // match with a cloud one.
          persons: photos[idx].persons,
          // Keep a place already resolved for this photo if a later batch
          // comes back empty — re-analysis must not blank the overview.
          place: r.place || photos[idx].place || '',
          analyzed: true,
        };
      };

      if (analyzedIds && analyzedIds.length) {
        // Map results to the specific photos that were analysed (by id, in order)
        const indexById = new Map(photos.map((p, i) => [p.id, i]));
        for (let i = 0; i < Math.min(results.length, analyzedIds.length); i++) {
          const idx = indexById.get(analyzedIds[i]);
          if (idx != null) apply(idx, results[i]);
        }
      } else {
        for (let i = 0; i < Math.min(results.length, photos.length); i++) apply(i, results[i]);
      }

      // Store the POSITIVE form of each term — that's what Gemini sees and
      // what shows up in customMatches. Diff check compares like with like.
      const analyzedCustomTerms = (criteria.customCriteria || [])
        .map((c) => stripNegativePrefix(c.term).toLowerCase().trim())
        .filter(Boolean);
      // Same story for reference persons: track which names were sent to
      // the model so a later add/remove/rename triggers a re-analysis.
      const analyzedPersons = state.persons.map((p) => p.name.toLowerCase().trim()).filter(Boolean);
      return {
        photos: runSelection(photos, criteria, state.persons, state.excludeConfirmed),
        analyzedCustomTerms,
        analyzedPersons,
      };
    });
  },

  rerunSelection: (criteria: CriteriaConfig) => {
    set((state) => ({
      photos: runSelection(state.photos, criteria, state.persons, state.excludeConfirmed),
    }));
  },

  toggleSelection: (id: string) => {
    set((state) => ({
      photos: state.photos.map((p) => {
        if (p.id !== id) return p;
        // Clicking a saved keeper removes it (unlock + deselect)
        if (p.saved) return { ...p, saved: false, selected: false, reasonTag: null };
        const nowSelected = !p.selected;
        return {
          ...p,
          selected: nowSelected,
          reasonTag: nowSelected ? generateReasonTag(p) : null,
        };
      }),
    }));
  },

  saveSelection: () => {
    set((state) => ({
      photos: state.photos.map((p) => (p.selected ? { ...p, saved: true } : p)),
    }));
  },

  unlock: (id: string) => {
    set((state) => ({
      photos: state.photos.map((p) => (p.id === id ? { ...p, saved: false } : p)),
    }));
  },

  addPerson: (name, blob, embedding = null) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const state = get();
    if (state.persons.length >= MAX_PERSONS) return false;
    if (state.persons.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return false;
    const thumbnailUrl = URL.createObjectURL(blob);
    const person: Person = {
      id: uuidv4(),
      name: trimmed,
      weight: 0.5,
      mode: 'include',
      thumbnailUrl,
      blob,
      embedding,
    };
    const persons = [...state.persons, person];
    set({ persons, photos: applyLocalPersonMatches(state.photos, persons, state.personThreshold) });
    return true;
  },

  removePerson: (id) => {
    set((state) => {
      const target = state.persons.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.thumbnailUrl);
      const persons = state.persons.filter((p) => p.id !== id);
      return {
        persons,
        photos: applyLocalPersonMatches(state.photos, persons, state.personThreshold),
      };
    });
  },

  renamePerson: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => {
      // Reject duplicate names (case-insensitive), other than the current one.
      const lower = trimmed.toLowerCase();
      if (state.persons.some((p) => p.id !== id && p.name.toLowerCase() === lower)) return state;
      return { persons: state.persons.map((p) => (p.id === id ? { ...p, name: trimmed } : p)) };
    });
  },

  setPersonWeight: (id, weight) => {
    set((state) => ({
      persons: state.persons.map((p) =>
        p.id === id ? { ...p, weight: Math.max(0.1, Math.min(1, weight)) } : p
      ),
    }));
  },

  setPersonMode: (id, mode) => {
    set((state) => {
      // Recompute matches: exclude mode uses a stricter threshold than include
      // (EXCLUDE_MIN_THRESHOLD), so flipping the mode genuinely changes which
      // photos match — it is not just a downstream filter switch.
      const persons = state.persons.map((p) => (p.id === id ? { ...p, mode } : p));
      return {
        persons,
        photos: applyLocalPersonMatches(state.photos, persons, state.personThreshold),
      };
    });
  },

  clear: () => {
    // Revoke any outstanding blob URLs for reference photos to release memory.
    const { persons } = get();
    for (const p of persons) URL.revokeObjectURL(p.thumbnailUrl);
    set({
      photos: [],
      embeddingsPending: 0,
      activeJobId: null,
      contract: null,
      persons: [],
      analyzedCustomTerms: [],
      analyzedPersons: [],
      personThreshold: DEFAULT_PERSON_THRESHOLD,
    });
  },
}));
