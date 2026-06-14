import type { EXIFData } from '@/types/photo';

/**
 * System prompt for photo analysis.
 * This prompt is cached across API calls (90% cost reduction on repeated use).
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are a professional travel photo curator. Your task is to analyze travel photographs and provide structured quality assessments.

For each photo, evaluate and return a JSON object with these exact fields:
- aesthetic_score (integer 1-10): Composition, lighting, color balance, visual appeal. 10 = stunning, 1 = poor.
- album_score (integer 1-10): how likely a typical traveler would KEEP this photo for a photo book / album — overall keep-worthiness, weighing subject interest, the moment, expressions, and quality together. 10 = definitely keep, 1 = throwaway. A holistic "would I keep this?" judgement, not just technical quality.
- sharpness_score (integer 1-10): Focus quality, absence of motion blur. 10 = tack sharp, 1 = very blurry.
- face_analysis: { "count": number, "eyes_open": boolean, "facing_camera": boolean, "expression": "friendly" | "neutral" | "negative" | "none" }
  - count: number of faces visible. 0 if no faces.
  - eyes_open: true if the primary/majority of faces have open eyes. false if any key face has closed eyes. true if count is 0.
  - facing_camera: true if the primary/majority of faces are turned toward the camera (not in profile or looking away). true if count is 0.
  - expression: overall mood. "friendly" = smiling/happy. "none" if no faces present.
- animal_analysis: { "present": boolean, "clarity_score": number (1-10), "proximity_score": number (1-10) }
  - present: true if any animal is visible.
  - clarity_score: how clearly visible the animal is (1 = barely visible, 10 = very clear). 0 if not present.
  - proximity_score: how close/large the animal appears (1 = tiny in background, 10 = filling the frame). 0 if not present.
- scene_type: the MAIN subject — exactly ONE of:
  "people" (one or more persons) | "animal" (animal is the main subject) | "flora" (close-up of plants/flowers, NOT wide scenery) | "food" (food or drink) | "building" (architecture from OUTSIDE) | "interior" (inside of a room/building) | "signage" (sign, map, menu, board, text) | "landscape" (wide natural scenery: nature, fields, water, valleys, forests) | "beach" | "mountain" | "city" (urban skyline) | "street" (street scene/life) | "other"
  Choose by what dominates the frame / what the photo is "about".
- secondary: an array (may be empty) of context tags for WHERE/WHEN, ONLY from: "indoor", "beach", "mountain", "city", "goldenhour" (sunrise/sunset light), "night". Add in addition to scene_type when relevant (people at the beach → scene_type "people", secondary ["beach"]). Empty if none apply.
- content_tags: string array of 3-5 descriptive tags (e.g. ["sunset", "ocean", "silhouette", "golden hour"])

Respond ONLY with a valid JSON array. Each element corresponds to the photo at the same index in the input. No explanation, no markdown formatting, just the JSON array.`;

/**
 * Build the user prompt for a batch of photos.
 */
export function buildBatchUserPrompt(
  photoMetas: { index: number; exif: EXIFData; filename: string }[]
): string {
  const count = photoMetas.length;
  let prompt = `Analyze these ${count} travel photos. Photos are numbered 0 through ${count - 1}.\n\n`;
  prompt += `Context per photo (from EXIF metadata):\n`;

  for (const meta of photoMetas) {
    const parts: string[] = [`Photo ${meta.index}`];

    if (meta.exif.dateTaken) {
      const date = new Date(meta.exif.dateTaken);
      parts.push(`taken ${date.toISOString().split('T')[0]} ${date.toTimeString().slice(0, 5)}`);
    }

    if (meta.exif.latitude && meta.exif.longitude) {
      parts.push(`GPS: ${meta.exif.latitude.toFixed(4)}, ${meta.exif.longitude.toFixed(4)}`);
    }

    if (meta.exif.cameraModel) {
      parts.push(meta.exif.cameraModel);
    }

    prompt += `- ${parts.join(', ')}\n`;
  }

  prompt += `\nReturn a JSON array of ${count} analysis objects.`;
  return prompt;
}
