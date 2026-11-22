/**
 * Phone or tablet, judged in the browser. Used where phones need different
 * behaviour or wording (memory limits, the OS freezing hidden pages) — not for
 * analytics, which classify devices server-side.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch points give it away.
  return /iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
