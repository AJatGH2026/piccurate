'use client';

import { create } from 'zustand';
import type { ClientPhoto, AIAnalysis } from '@/types/photo';
import type { CriteriaConfig, Person } from '@/types/criteria';
import { DEFAULT_CRITERIA, MAX_PERSONS } from '@/types/criteria';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessedPhoto {
  id: string;
  filename: string;
  originalFile: File | null; // original full-resolution file for ZIP download
  thumbnailUrl: string;
  thumbnailBlob: Blob | null;
  phash: string | null; // 16-hex perceptual hash for near-duplicate / series detection
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
  selected: boolean;
  saved: boolean; // user-locked keeper: stays selected, excluded from re-selection pool
  reasonTag: string | null;
  selectionScore: number;
  analyzed: boolean;
}

interface PhotoStore {
  photos: ProcessedPhoto[];
  /** Custom terms present at the last analysis (to detect when re-analysis is needed). */
  analyzedCustomTerms: string[];
  /**
   * Reference persons (feature 5b). Session-only — never persisted. Blob + name
   * roundtrip to the LLM; slider weight drives selection bias/filter.
   */
  persons: Person[];
  /** Person names present at the last analysis (lowercased, for the diff check). */
  analyzedPersons: string[];
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
  addPerson: (name: string, blob: Blob) => boolean;
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
 *  2. VISUAL (time-independent): ANY two photos with pHash distance ≤ Dv, no
 *     matter how far apart in time or sequence. Catches "looks almost identical"
 *     re-shots taken minutes apart, or with other photos interleaved — the case
 *     a consecutive-only, time-gated detector misses. Dv is kept tight so two
 *     genuinely different but similar scenes aren't merged.
 *
 * All three thresholds scale with the Duplicates slider (1 = lenient … 10 = strict):
 *   Slider 1  → GAP_S =  0s, D =  7, Dv = 0  (near-exact duplicates only)
 *   Slider 8  → GAP_S = 47s, D = 14, Dv = 6  (default)
 *   Slider 10 → GAP_S = 60s, D = 16, Dv = 8  (aggressive collapsing)
 */
function detectSeries(photos: ProcessedPhoto[], criteria: CriteriaConfig): ProcessedPhoto[][] {
  const s = Math.max(1, Math.min(10, criteria.dedupSensitivity || 8));
  const GAP_S = Math.round(((s - 1) * 60) / 9);
  const D = 6 + s;
  const Dv = Math.round(((s - 1) * 8) / 9);

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

  // Rule 2 — visual: any pair below the tight threshold, time-independent.
  if (Dv > 0 && n <= VISUAL_DEDUP_MAX) {
    for (let i = 0; i < n; i++) {
      if (!sorted[i].phash) continue;
      for (let j = i + 1; j < n; j++) {
        if (!sorted[j].phash || find(i) === find(j)) continue;
        if (hamming(sorted[i].phash, sorted[j].phash) <= Dv) union(i, j);
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
function runSelection(photos: ProcessedPhoto[], criteria: CriteriaConfig, persons: Person[]): ProcessedPhoto[] {
  // Split custom criteria into positive (bias/filter) and negative (hard
  // exclusion). Negatives are applied to the pool FIRST — they always win
  // over any positive slider, regardless of its value.
  const customs = criteria.customCriteria || [];
  const negativeCustoms = customs.filter((c) => isNegativeCustom(c.term));
  const positiveCustoms = customs.filter((c) => !isNegativeCustom(c.term));
  // Persons split identically: exclude-mode acts as hard filter, include-mode
  // drives bias/exclusive selection downstream.
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
  analyzedCustomTerms: [],
  persons: [],
  analyzedPersons: [],

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
      selected: false,
      saved: false,
      reasonTag: null,
      selectionScore: 0,
      analyzed: false,
    }));

    set({ photos: processed });
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
          persons: r.persons || [],
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
        photos: runSelection(photos, criteria, state.persons),
        analyzedCustomTerms,
        analyzedPersons,
      };
    });
  },

  rerunSelection: (criteria: CriteriaConfig) => {
    set((state) => ({
      photos: runSelection(state.photos, criteria, state.persons),
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

  addPerson: (name, blob) => {
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
    };
    set({ persons: [...state.persons, person] });
    return true;
  },

  removePerson: (id) => {
    set((state) => {
      const target = state.persons.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.thumbnailUrl);
      return { persons: state.persons.filter((p) => p.id !== id) };
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
    set((state) => ({
      persons: state.persons.map((p) => (p.id === id ? { ...p, mode } : p)),
    }));
  },

  clear: () => {
    // Revoke any outstanding blob URLs for reference photos to release memory.
    const { persons } = get();
    for (const p of persons) URL.revokeObjectURL(p.thumbnailUrl);
    set({ photos: [], persons: [], analyzedCustomTerms: [], analyzedPersons: [] });
  },
}));
