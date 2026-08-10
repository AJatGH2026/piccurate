// GPS handling for the place-name feature.
//
// The AI derives a place name ("Lissabon, Portugal") from the coordinates that
// travel with the photo. That replaces the old third-party reverse geocoder
// (BigDataCloud, Australia) — one less recipient, one less third-country
// transfer, and it reuses the Gemini DPA we already have.
//
// Coordinates are COARSENED before they leave the browser. Place sorting needs
// city/region granularity, not metres: two decimal places is about 1.1 km of
// latitude, plenty to name a town and far too coarse to pin down a home, a
// hotel room or a child's school. Full-precision coordinates stay on the
// device and still go into the ZIP summary, which never leaves it.

/** Decimal places kept when a coordinate is sent for place naming (~1.1 km). */
export const GEO_SEND_PRECISION = 2;

/** Round a coordinate to place-level precision. Null passes through. */
export function coarseCoord(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Number(n.toFixed(GEO_SEND_PRECISION));
}

/**
 * The place label to show for a set of photos: the most frequent non-empty
 * one. The model can disagree between photos of the same spot (a village name
 * here, the region there); the majority is the stable choice.
 */
export function dominantPlace(places: (string | null | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const p of places) {
    const v = (p || '').trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best = '';
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

/** Make a place name safe as a ZIP folder segment. */
export function placeFolder(place: string): string {
  const cleaned = place
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return cleaned || 'ohne-Ort';
}
