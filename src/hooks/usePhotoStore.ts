'use client';

import { create } from 'zustand';
import type { ClientPhoto, AIAnalysis } from '@/types/photo';
import type { CriteriaConfig } from '@/types/criteria';
import { DEFAULT_CRITERIA } from '@/types/criteria';

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
  setPhotosFromUpload: (clientPhotos: ClientPhoto[]) => void;
  /** Apply AI results. If analyzedIds is given, results map to those photos (by id, in order); otherwise to all photos by index. */
  applyAnalysisResults: (results: AIAnalysis[], criteria: CriteriaConfig, analyzedIds?: string[]) => void;
  rerunSelection: (criteria: CriteriaConfig) => void;
  toggleSelection: (id: string) => void;
  /** Lock all currently selected photos as saved keepers (persist across re-runs). */
  saveSelection: () => void;
  /** Unlock a saved photo (and deselect it). */
  unlock: (id: string) => void;
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
      return p.faceCount > 0;
    case 'preferAnimals':
      return p.hasAnimal;
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

/** Does a photo match a user-defined custom term (AI-tagged during analysis)? */
function matchesCustom(p: ProcessedPhoto, term: string): boolean {
  const t = term.toLowerCase().trim();
  return !!t && (p.customMatches || []).includes(t);
}

/**
 * A custom term is treated as a NEGATIVE (exclusion) criterion if it begins
 * with a linguistic "no/not/without" marker. The AI already tags such terms
 * correctly (a photo matches "no snow" when no snow is visible), but the
 * user's intent is stronger than "prefer": it's "never show me photos with
 * snow". So we filter the pool on these BEFORE any other criterion runs.
 */
export function isNegativeCustom(term: string): boolean {
  return /^\s*(no|not|kein|keine|ohne)\s+/i.test(term);
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
function computeScore(photo: ProcessedPhoto, criteria: CriteriaConfig): number {
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

/**
 * Cluster photos into series: time-sorted, consecutive photos that are close in
 * time AND visually similar (pHash) belong to the same burst. Returns an array
 * of clusters (each an array of photos). Falls back to singletons if no pHash.
 */
function detectSeries(photos: ProcessedPhoto[], criteria: CriteriaConfig): ProcessedPhoto[][] {
  const GAP_S = 10;
  const D = 6 + (criteria.dedupSensitivity || 8); // dedupSensitivity 1-10 → distance 7-16
  const sorted = [...photos].sort((a, b) => (a.dateTaken || '').localeCompare(b.dateTaken || ''));
  const clusters: ProcessedPhoto[][] = [];
  let cur: ProcessedPhoto[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { cur = [sorted[i]]; continue; }
    const prev = sorted[i - 1], p = sorted[i];
    const gap = prev.dateTaken && p.dateTaken
      ? (new Date(p.dateTaken).getTime() - new Date(prev.dateTaken).getTime()) / 1000
      : Infinity;
    const dist = hamming(prev.phash, p.phash);
    if (gap <= GAP_S && dist <= D) cur.push(p);
    else { clusters.push(cur); cur = [p]; }
  }
  if (cur.length) clusters.push(cur);
  return clusters;
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
function runSelection(photos: ProcessedPhoto[], criteria: CriteriaConfig): ProcessedPhoto[] {
  // Split custom criteria into positive (bias/filter) and negative (hard
  // exclusion). Negatives are applied to the pool FIRST — they always win
  // over any positive slider, regardless of its value.
  const customs = criteria.customCriteria || [];
  const negativeCustoms = customs.filter((c) => isNegativeCustom(c.term));
  const positiveCustoms = customs.filter((c) => !isNegativeCustom(c.term));

  // Saved photos are locked keepers: always selected, excluded from the pool.
  // Negative-criterion filter: a photo is kept in the pool only if every
  // negative term matches it (i.e. the AI confirmed the excluded content is
  // NOT visible). "no snow" + snow visible → out, unconditionally.
  const pool = photos.filter((p) => {
    if (p.saved) return false;
    for (const nc of negativeCustoms) if (!matchesCustom(p, nc.term)) return false;
    return true;
  });

  const scored: Record<string, number> = {};
  for (const p of pool) scored[p.id] = computeScore(p, criteria);

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
  let selectedIds: Set<string>;
  if (exclusive.length > 0 || exclusiveCustom.length > 0) {
    // Filter: only reps matching ANY maxed motif OR maxed positive custom term,
    // then keep the best up to the cap (so "10" = only this motif, but still
    // bounded by the maximum selection size — fewer if fewer match).
    const eligible = reps.filter(
      (p) =>
        exclusive.some((k) => matchesMotif(p, k)) ||
        exclusiveCustom.some((c) => matchesCustom(p, c.term))
    );
    selectedIds = new Set(eligible.slice(0, cap).map((p) => p.id));
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

      const analyzedCustomTerms = (criteria.customCriteria || [])
        .map((c) => c.term.toLowerCase().trim())
        .filter(Boolean);
      return { photos: runSelection(photos, criteria), analyzedCustomTerms };
    });
  },

  rerunSelection: (criteria: CriteriaConfig) => {
    set((state) => ({
      photos: runSelection(state.photos, criteria),
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

  clear: () => set({ photos: [] }),
}));
