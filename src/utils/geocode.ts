// Client-side reverse geocoding (GPS → place name) for the results overview.
// Uses BigDataCloud's free, key-less, CORS-enabled reverse-geocode-client
// endpoint — designed for browser use. Only coarse coordinates are sent
// (one representative point per day, not photos). Results are cached in memory.
//
// Privacy note: this sends photo GPS coordinates to a third party. For a
// privacy-stricter setup, self-host a geocoder or make it opt-in.

const cache = new Map<string, string | null>();

/** Reverse-geocode to a short "City, Country" label (localized), or null. */
export async function reverseGeocode(
  lat: number,
  lon: number,
  lang = 'en'
): Promise<string | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${lang}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${encodeURIComponent(lang)}`
    );
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const j = await res.json();
    const place = j.city || j.locality || j.principalSubdivision || '';
    const country = j.countryName || '';
    const label = [place, country].filter(Boolean).join(', ') || null;
    cache.set(key, label);
    return label;
  } catch {
    cache.set(key, null);
    return null;
  }
}
