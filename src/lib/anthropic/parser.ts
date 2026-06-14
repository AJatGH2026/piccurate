import { z } from 'zod';
import type { AIAnalysis } from '@/types/photo';

/**
 * Valid primary scene types (taxonomy v2) for our selection engine.
 */
const VALID_SCENE_TYPES = [
  'people', 'animal', 'flora', 'food', 'building', 'interior', 'signage',
  'landscape', 'beach', 'mountain', 'city', 'street', 'other',
] as const;

type SceneType = typeof VALID_SCENE_TYPES[number];

/** Map common AI-returned primary values to the closest v2 enum value. */
const SCENE_TYPE_ALIASES: Record<string, SceneType> = {
  // landscape family (incl. former "nature"/"sunset" primaries)
  nature: 'landscape', sunset: 'landscape', sunrise: 'landscape', scenic: 'landscape',
  valley: 'landscape', field: 'landscape', forest: 'landscape', water: 'landscape',
  lake: 'landscape', river: 'landscape', desert: 'landscape', aerial: 'landscape', panorama: 'landscape',
  // flora
  plant: 'flora', flower: 'flora', garden: 'flora', flowers: 'flora',
  // building (outside architecture)
  architecture: 'building', house: 'building', church: 'building', temple: 'building',
  monument: 'building', castle: 'building', palace: 'building', bridge: 'building',
  ruin: 'building', ruins: 'building', mosque: 'building',
  // interior (inside)
  room: 'interior', indoor: 'interior', museum: 'interior',
  // signage
  sign: 'signage', map: 'signage', menu: 'signage', text: 'signage', poster: 'signage',
  // animal
  wildlife: 'animal', bird: 'animal', marine: 'animal', insect: 'animal', pet: 'animal',
  // people
  portrait: 'people', group: 'people', selfie: 'people', crowd: 'people',
  // food
  restaurant: 'food', drink: 'food', cafe: 'food',
  // city / street
  urban: 'city', skyline: 'city', nightlife: 'city', market: 'street', transportation: 'street', vehicle: 'street',
  // other
  abstract: 'other', sport: 'other', activity: 'other', event: 'other',
};

function normalizeSceneType(raw: string): SceneType {
  const lower = (raw ?? '').toLowerCase().trim();
  if ((VALID_SCENE_TYPES as readonly string[]).includes(lower)) return lower as SceneType;
  return SCENE_TYPE_ALIASES[lower] || 'other';
}

/** Valid secondary (place/time) context tags. */
const VALID_SECONDARY = ['indoor', 'beach', 'mountain', 'city', 'goldenhour', 'night'] as const;
const SECONDARY_ALIASES: Record<string, string> = {
  sunset: 'goldenhour', sunrise: 'goldenhour', dusk: 'goldenhour', dawn: 'goldenhour',
  'golden hour': 'goldenhour', golden_hour: 'goldenhour', stars: 'night', starry: 'night',
  ocean: 'beach', sea: 'beach', water: 'beach', urban: 'city', interior: 'indoor', inside: 'indoor',
};

function normalizeSecondary(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out = new Set<string>();
  for (const s of arr) {
    const lower = String(s ?? '').toLowerCase().trim();
    const v = (VALID_SECONDARY as readonly string[]).includes(lower) ? lower : SECONDARY_ALIASES[lower];
    if (v) out.add(v);
  }
  return [...out];
}

/**
 * Zod schema for validating AI analysis output per photo.
 * scene_type accepts any string and normalizes it via transform.
 */
const aiAnalysisSchema = z.object({
  aesthetic_score: z.number().int().min(1).max(10),
  album_score: z.number().min(1).max(10).optional().default(5),
  sharpness_score: z.number().int().min(1).max(10),
  face_analysis: z.object({
    count: z.number().int().min(0),
    eyes_open: z.boolean(),
    facing_camera: z.boolean().optional().default(true),
    expression: z.enum(['friendly', 'neutral', 'negative', 'none']),
  }),
  animal_analysis: z.object({
    present: z.boolean(),
    clarity_score: z.number().min(0).max(10),
    proximity_score: z.number().min(0).max(10),
  }),
  scene_type: z.string().transform(normalizeSceneType),
  secondary: z.array(z.string()).optional().default([]).transform(normalizeSecondary),
  content_tags: z.array(z.string()).min(1).max(10),
});

const batchSchema = z.array(aiAnalysisSchema);

/**
 * Parse and validate the AI response JSON.
 * Returns an array of AIAnalysis objects matching the input batch size.
 */
export function parseAnalysisResponse(
  responseText: string,
  expectedCount: number
): AIAnalysis[] {
  // Extract JSON from response (handle markdown code blocks if present)
  let jsonStr = responseText.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse AI response as JSON: ${(e as Error).message}`);
  }

  // Validate with Zod
  const result = batchSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`AI response validation failed: ${issues.join('; ')}`);
  }

  if (result.data.length < expectedCount) {
    // Pad with neutral scores for any missing photos
    const defaultResult = {
      aesthetic_score: 5, album_score: 5, sharpness_score: 5,
      face_analysis: { count: 0, eyes_open: true, facing_camera: true, expression: 'none' as const },
      animal_analysis: { present: false, clarity_score: 0, proximity_score: 0 },
      scene_type: 'other' as const, secondary: [], content_tags: ['unanalyzed'],
    };
    while (result.data.length < expectedCount) {
      result.data.push(defaultResult);
    }
    console.warn(`[AI Parser] Padded ${expectedCount - result.data.length} missing results with defaults`);
  } else if (result.data.length > expectedCount) {
    result.data.length = expectedCount;
  }

  // Map to our AIAnalysis type (camelCase)
  return result.data.map((item) => ({
    aestheticScore: item.aesthetic_score,
    albumScore: item.album_score,
    sharpnessScore: item.sharpness_score,
    faceAnalysis: {
      count: item.face_analysis.count,
      eyesOpen: item.face_analysis.eyes_open,
      facingCamera: item.face_analysis.facing_camera,
      expression: item.face_analysis.expression,
    },
    animalAnalysis: {
      present: item.animal_analysis.present,
      clarityScore: item.animal_analysis.clarity_score,
      proximityScore: item.animal_analysis.proximity_score,
    },
    sceneType: item.scene_type,
    secondary: item.secondary,
    contentTags: item.content_tags,
  }));
}
