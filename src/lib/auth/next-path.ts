/**
 * The "come back here afterwards" path carried through sign-up and sign-in.
 *
 * Never trust it as a URL. `?next=https://evil.example/login` would turn our
 * own login into a credible phishing hop — the user starts on our domain, hands
 * over a password, and is forwarded somewhere else. So only a same-site
 * absolute path is ever returned, and anything else falls back to the home page.
 *
 * `//evil.example` is the case people miss: the browser reads it as a
 * protocol-relative URL, so a leading-slash check alone is not enough.
 */
export function safeNextPath(raw: string | null | undefined, locale: string): string {
  const fallback = `/${locale}`;
  if (!raw) return fallback;

  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return fallback;
  }

  if (!value.startsWith('/')) return fallback; // absolute URL or relative junk
  if (value.startsWith('//')) return fallback; // protocol-relative
  if (value.includes('\\')) return fallback; // backslash tricks some parsers
  if (/[\r\n]/.test(value)) return fallback; // header/URL splitting

  return value;
}

/** Read `next` from the current browser URL, already validated. */
export function readNextParam(locale: string): string {
  if (typeof window === 'undefined') return `/${locale}`;
  return safeNextPath(new URLSearchParams(window.location.search).get('next'), locale);
}
