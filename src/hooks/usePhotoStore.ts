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
  selected: boolean;
  saved: boolean; // user-locked keeper: stays selected, excluded from re-selection pool
  reasonTag: string | null;
  selectionScore: number;
  analyzed: boolean;
}

interface PhotoStore {
  photos: ProcessedPhoto[];
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

const LANDSCAPE_SCENES = ['landscape', 'beach', 'mountain'];
const ARCH_SCENES = ['building', 'interior', 'architecture', 'city'];

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
  const scene = mergeScene(photo.sceneType);
  let score = photo.albumScore * 2; // dominant keep-worthiness base

  if (criteria.preferSharpness.enabled) {
    score += photo.sharpnessScore * criteria.preferSharpness.weight * 0.15;
  }
  if (criteria.preferFaces.enabled && photo.faceCount > 0 && (scene === 'people' || scene === 'street')) {
    let f = 1;
    if (photo.facesEyesOpen) f += 1;
    if (photo.facesFacingCamera) f += 1;
    if (photo.facesExpression === 'friendly') f += 1;
    score += f * criteria.preferFaces.weight * 0.8;
  }
  if (criteria.preferAnimals.enabled && photo.hasAnimal && scene === 'animal') {
    score += 3 * criteria.preferAnimals.weight * 0.8;
  }
  if (criteria.preferLandscapes.enabled && LANDSCAPE_SCENES.includes(scene)) {
    score += 3 * criteria.preferLandscapes.weight * 0.8;
  }
  if (criteria.preferArchitecture.enabled && ARCH_SCENES.includes(scene)) {
    score += 3 * criteria.preferArchitecture.weight * 0.8;
  }
  if (criteria.preferFood.enabled && scene === 'food') {
    score += 3 * criteria.preferFood.weight * 0.8;
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
 * Run selection: collapse each series to its best representative, then select
 * the top N% by preference score. Each series contributes at most one photo.
 */
function runSelection(photos: ProcessedPhoto[], criteria: CriteriaConfig): ProcessedPhoto[] {
  // Saved photos are locked keepers: always selected, excluded from the pool.
  const pool = photos.filter((p) => !p.saved);

  const scored: Record<string, number> = {};
  for (const p of pool) scored[p.id] = computeScore(p, criteria);

  // One representative per series (best in-series quality), within the pool
  const clusters = detectSeries(pool, criteria);
  const repIds = new Set<string>();
  for (const cl of clusters) {
    const rep = cl.slice().sort((a, b) => inSeriesScore(b) - inSeriesScore(a))[0];
    repIds.add(rep.id);
  }

  // Rank representatives by preference score, take top N% of the (shrunken) pool
  const reps = pool.filter((p) => repIds.has(p.id));
  reps.sort((a, b) => scored[b.id] - scored[a.id]);
  const percentage = criteria.selectionPercentage || 8;
  const selectCount = Math.max(1, Math.round(pool.length * (percentage / 100)));
  const selectedIds = new Set(reps.slice(0, selectCount).map((p) => p.id));

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

      return { photos: runSelection(photos, criteria) };
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
