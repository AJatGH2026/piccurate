import type { CriteriaConfig } from '@/types/criteria';
import type { ReasonTag, ReasonCategory, SelectionGroup, SelectionSummary } from '@/types/selection';
import { areSimilar } from './phash';

/** Database photo row shape */
interface PhotoRow {
  id: string;
  filename: string;
  taken_at: string | null;
  latitude: number | null;
  longitude: number | null;
  original_width: number | null;
  original_height: number | null;
  aesthetic_score: number | null;
  sharpness_score: number | null;
  face_count: number;
  faces_eyes_open: boolean | null;
  faces_expression: string | null;
  has_animal: boolean;
  animal_clarity: number | null;
  animal_proximity: number | null;
  scene_type: string | null;
  content_tags: string[] | null;
  phash: string | null;
}

interface ScoredPhoto extends PhotoRow {
  score: number;
  reasonTag: ReasonTag | null;
}

/**
 * Run the selection engine on analyzed photos.
 *
 * Algorithm:
 * 1. Group photos by date, then sub-group by location
 * 2. Score each photo based on weighted criteria
 * 3. Select top N% per group
 * 4. Dedup similar photos (prefer highest resolution)
 * 5. Enforce diversity across scene types
 * 6. Generate reason tags
 */
export function selectPhotos(
  photos: PhotoRow[],
  criteria: CriteriaConfig
): SelectionSummary {
  // Step 1: Group by date and location
  const groups = groupPhotos(photos);

  const allResults: { photoId: string; selected: boolean; score: number; reasonTag: ReasonTag | null }[] = [];
  const selectionGroups: SelectionGroup[] = [];

  for (const group of groups) {
    // Step 2: Score each photo
    const scored = group.photos.map((photo) => ({
      ...photo,
      score: computeScore(photo, criteria),
      reasonTag: null as ReasonTag | null,
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Step 3: Select top N%
    const targetCount = Math.max(
      1,
      Math.round((criteria.selectionPercentage / 100) * scored.length)
    );
    let selected = scored.slice(0, targetCount);
    let rejected = scored.slice(targetCount);

    // Step 4: Dedup
    const dedupThreshold = Math.max(1, 15 - criteria.dedupSensitivity); // Higher sensitivity = lower threshold
    selected = dedupPhotos(selected, rejected, dedupThreshold);

    // Step 5: Generate reason tags
    for (const photo of selected) {
      photo.reasonTag = generateReasonTag(photo, criteria);
    }

    // Build results
    const selectedIds = new Set(selected.map((p) => p.id));
    for (const photo of scored) {
      allResults.push({
        photoId: photo.id,
        selected: selectedIds.has(photo.id),
        score: photo.score,
        reasonTag: selectedIds.has(photo.id)
          ? selected.find((s) => s.id === photo.id)?.reasonTag ?? null
          : null,
      });
    }

    selectionGroups.push({
      date: group.date,
      location: group.location,
      latitude: group.latitude,
      longitude: group.longitude,
      totalPhotos: scored.length,
      selectedPhotos: selected.length,
      results: scored.map((p) => ({
        photoId: p.id,
        selected: selectedIds.has(p.id),
        score: p.score,
        reasonTag: selectedIds.has(p.id)
          ? selected.find((s) => s.id === p.id)?.reasonTag ?? null
          : null,
      })),
    });
  }

  const totalSelected = allResults.filter((r) => r.selected).length;

  // Scene type breakdown
  const sceneBreakdown: Record<string, number> = {};
  for (const r of allResults.filter((r) => r.selected)) {
    const photo = photos.find((p) => p.id === r.photoId);
    const scene = photo?.scene_type || 'other';
    sceneBreakdown[scene] = (sceneBreakdown[scene] || 0) + 1;
  }

  return {
    totalPhotos: photos.length,
    selectedPhotos: totalSelected,
    selectionPercentage: photos.length > 0
      ? Math.round((totalSelected / photos.length) * 100)
      : 0,
    groups: selectionGroups,
    sceneTypeBreakdown: sceneBreakdown,
  };
}

// ── Grouping ────────────────────────────────────────────────────

interface PhotoGroup {
  date: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: PhotoRow[];
}

function groupPhotos(photos: PhotoRow[]): PhotoGroup[] {
  // Group by date
  const dateMap = new Map<string, PhotoRow[]>();

  for (const photo of photos) {
    const date = photo.taken_at
      ? new Date(photo.taken_at).toISOString().split('T')[0]
      : 'unknown';
    if (!dateMap.has(date)) dateMap.set(date, []);
    dateMap.get(date)!.push(photo);
  }

  const groups: PhotoGroup[] = [];

  for (const [date, datePhotos] of dateMap) {
    // Sub-group by location (cluster GPS coordinates within ~500m)
    const locationGroups = clusterByLocation(datePhotos);
    for (const locGroup of locationGroups) {
      groups.push({
        date,
        location: locGroup.location,
        latitude: locGroup.latitude,
        longitude: locGroup.longitude,
        photos: locGroup.photos,
      });
    }
  }

  // Sort groups chronologically
  groups.sort((a, b) => a.date.localeCompare(b.date));

  return groups;
}

function clusterByLocation(photos: PhotoRow[]): {
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: PhotoRow[];
}[] {
  const withGPS = photos.filter((p) => p.latitude != null && p.longitude != null);
  const withoutGPS = photos.filter((p) => p.latitude == null || p.longitude == null);

  if (withGPS.length === 0) {
    return [{ location: null, latitude: null, longitude: null, photos }];
  }

  // Simple clustering: merge points within ~500m
  const CLUSTER_RADIUS_KM = 0.5;
  const clusters: { lat: number; lng: number; photos: PhotoRow[] }[] = [];

  for (const photo of withGPS) {
    let found = false;
    for (const cluster of clusters) {
      const dist = haversineKm(photo.latitude!, photo.longitude!, cluster.lat, cluster.lng);
      if (dist <= CLUSTER_RADIUS_KM) {
        cluster.photos.push(photo);
        found = true;
        break;
      }
    }
    if (!found) {
      clusters.push({ lat: photo.latitude!, lng: photo.longitude!, photos: [photo] });
    }
  }

  // Add non-GPS photos to the largest cluster or their own group
  if (withoutGPS.length > 0) {
    if (clusters.length > 0) {
      // Add to largest cluster
      clusters.sort((a, b) => b.photos.length - a.photos.length);
      clusters[0].photos.push(...withoutGPS);
    } else {
      clusters.push({ lat: 0, lng: 0, photos: withoutGPS });
    }
  }

  return clusters.map((c) => ({
    location: null, // Reverse geocoding deferred to future phase
    latitude: c.lat || null,
    longitude: c.lng || null,
    photos: c.photos,
  }));
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Scoring ─────────────────────────────────────────────────────

function computeScore(photo: PhotoRow, criteria: CriteriaConfig): number {
  let score = 0;
  let totalWeight = 0;

  // Aesthetic score (always included as base)
  score += (photo.aesthetic_score || 5) * 0.3;
  totalWeight += 0.3;

  // Sharpness
  if (criteria.preferSharpness.enabled) {
    const w = criteria.preferSharpness.weight;
    score += (photo.sharpness_score || 5) * w * 0.2;
    totalWeight += w * 0.2;
  }

  // Faces
  if (criteria.preferFaces.enabled && photo.face_count > 0) {
    const w = criteria.preferFaces.weight;
    let faceScore = 5;
    if (photo.faces_eyes_open) faceScore += 2;
    if (photo.faces_expression === 'friendly') faceScore += 3;
    else if (photo.faces_expression === 'neutral') faceScore += 1;
    score += faceScore * w * 0.15;
    totalWeight += w * 0.15;
  }

  // Animals
  if (criteria.preferAnimals.enabled && photo.has_animal) {
    const w = criteria.preferAnimals.weight;
    const animalScore = ((photo.animal_clarity || 5) + (photo.animal_proximity || 5)) / 2;
    score += animalScore * w * 0.15;
    totalWeight += w * 0.15;
  }

  // Landscapes
  if (criteria.preferLandscapes.enabled) {
    const w = criteria.preferLandscapes.weight;
    const isLandscape = ['landscape', 'sunset', 'beach', 'mountain', 'nature'].includes(photo.scene_type || '');
    if (isLandscape) {
      score += (photo.aesthetic_score || 5) * w * 0.15;
      totalWeight += w * 0.15;
    }
  }

  // Architecture
  if (criteria.preferArchitecture.enabled) {
    const w = criteria.preferArchitecture.weight;
    if (photo.scene_type === 'architecture' || photo.scene_type === 'city') {
      score += (photo.aesthetic_score || 5) * w * 0.1;
      totalWeight += w * 0.1;
    }
  }

  // Food
  if (criteria.preferFood.enabled) {
    const w = criteria.preferFood.weight;
    if (photo.scene_type === 'food') {
      score += (photo.aesthetic_score || 5) * w * 0.1;
      totalWeight += w * 0.1;
    }
  }

  // Normalize
  return totalWeight > 0 ? score / totalWeight : 0;
}

// ── Dedup ───────────────────────────────────────────────────────

function dedupPhotos(
  selected: ScoredPhoto[],
  rejected: ScoredPhoto[],
  threshold: number
): ScoredPhoto[] {
  const result: ScoredPhoto[] = [];

  for (const photo of selected) {
    if (!photo.phash) {
      result.push(photo);
      continue;
    }

    // Check if this photo is similar to any already-selected photo
    const isDuplicate = result.some(
      (existing) => existing.phash && areSimilar(photo.phash!, existing.phash, threshold)
    );

    if (!isDuplicate) {
      result.push(photo);
    }
    // If duplicate, skip (the higher-scored version was already added)
  }

  return result;
}

// ── Reason Tags ─────────────────────────────────────────────────

function generateReasonTag(photo: ScoredPhoto, criteria: CriteriaConfig): ReasonTag {
  // Determine the primary reason this photo was selected
  const reasons: { category: ReasonCategory; score: number; label: string }[] = [];

  if (photo.face_count > 0 && photo.faces_eyes_open && photo.faces_expression === 'friendly') {
    const label = photo.face_count > 1
      ? `Best group shot — ${photo.face_count} faces, all eyes open`
      : 'Great expression — eyes open, friendly';
    reasons.push({ category: 'best_expression', score: 10, label });
  }

  if (photo.has_animal && (photo.animal_clarity || 0) >= 7) {
    reasons.push({ category: 'best_animal', score: 9, label: 'Clear animal photo, close-up' });
  }

  if (['landscape', 'sunset', 'beach', 'mountain', 'nature'].includes(photo.scene_type || '')) {
    if ((photo.aesthetic_score || 0) >= 8) {
      reasons.push({ category: 'best_landscape', score: 8, label: 'Stunning landscape' });
    }
  }

  if (photo.scene_type === 'architecture' && (photo.aesthetic_score || 0) >= 7) {
    reasons.push({ category: 'best_architecture', score: 7, label: 'Notable architecture' });
  }

  if (photo.scene_type === 'food' && (photo.aesthetic_score || 0) >= 7) {
    reasons.push({ category: 'best_food', score: 7, label: 'Appetizing food photo' });
  }

  if ((photo.sharpness_score || 0) >= 9) {
    reasons.push({ category: 'sharpest', score: 6, label: 'Exceptional sharpness' });
  }

  if ((photo.aesthetic_score || 0) >= 9) {
    reasons.push({ category: 'top_aesthetic', score: 8, label: 'Outstanding composition' });
  }

  // Default reason
  if (reasons.length === 0) {
    reasons.push({ category: 'unique_content', score: 5, label: 'Unique content in this group' });
  }

  // Pick the highest-scored reason
  reasons.sort((a, b) => b.score - a.score);
  return { category: reasons[0].category, label: reasons[0].label };
}
