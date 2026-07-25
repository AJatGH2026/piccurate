// Google tag (GA4 + Google Ads) with Consent Mode v2. DORMANT by default:
// everything is a no-op unless NEXT_PUBLIC_GA4_ID or NEXT_PUBLIC_GOOGLE_ADS_ID
// is set at build time, so the current gated-tester phase is unaffected.
//
// Compliance: default consent is DENIED for all storage (set in GoogleTag);
// the ConsentBanner grants/denies on the user's choice. Only these helpers and
// the two components touch gtag.

export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || '';
export const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';
export const ADS_CONVERSION_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL || '';

/** True when at least one Google tag id is configured — gates everything. */
export function googleTagEnabled(): boolean {
  return Boolean(GA4_ID || ADS_ID);
}

const CONSENT_KEY = 'piccurate-consent';
export type Consent = 'granted' | 'denied';

export function getStoredConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

type Gtag = (...args: unknown[]) => void;
function gtag(): Gtag | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { gtag?: Gtag }).gtag ?? null;
}

/** Push a Consent Mode v2 update for all four storage types. */
export function applyConsent(granted: boolean): void {
  const g = gtag();
  if (!g) return;
  const v: Consent = granted ? 'granted' : 'denied';
  g('consent', 'update', {
    ad_storage: v,
    ad_user_data: v,
    ad_personalization: v,
    analytics_storage: v,
  });
}

export function setConsent(consent: Consent): void {
  if (typeof window !== 'undefined') localStorage.setItem(CONSENT_KEY, consent);
  applyConsent(consent === 'granted');
}

/** Fire a GA4 event. No-op until the tag is live. */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  const g = gtag();
  if (g) g('event', name, params || {});
}

/** Fire the Google Ads conversion (needs both an Ads id and a conversion label). */
export function trackAdsConversion(): void {
  const g = gtag();
  if (g && ADS_ID && ADS_CONVERSION_LABEL) {
    g('event', 'conversion', { send_to: `${ADS_ID}/${ADS_CONVERSION_LABEL}` });
  }
}
