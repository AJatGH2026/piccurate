// Google tag (GA4 + Google Ads) with Consent Mode v2. DORMANT by default:
// everything is a no-op unless NEXT_PUBLIC_GA4_ID or NEXT_PUBLIC_GOOGLE_ADS_ID
// is set at build time, so the current gated-tester phase is unaffected.
//
// Compliance: default consent is DENIED for all storage (set in GoogleTag);
// the ConsentBanner grants/denies on the user's choice. Only these helpers and
// the two components touch gtag.

export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || '';
export const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';
/** Label for the ZIP download — the deep conversion, behind the account gate. */
export const ADS_CONVERSION_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL || '';
/**
 * Label for "analysis started" — the shallow conversion, and the one Smart
 * Bidding can actually learn from.
 *
 * Added 2026-08-29 after the first campaign week: 87 clicks, €99, and zero
 * recorded conversions. The download was the only conversion, and it sits at
 * the end of upload → configure → analyse → review → results → create an
 * account → download. Optimising a campaign on a step that far in, that few
 * visitors reach, gives the bidding nothing to work with.
 *
 * `analysis_started` is the right shallower step, and not an arbitrary one:
 * lib/events-client.ts already treats it as "the conversion we want to count"
 * and as the last event that may carry campaign attribution, because it is the
 * click that concludes the free contract. Counting it here keeps Ads on the
 * same side of that line.
 */
export const ADS_ANALYSIS_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_ANALYSIS_LABEL || '';

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

/**
 * Fire one Google Ads conversion. Needs an Ads id AND that step's own label —
 * each conversion action in Ads has its own, so a missing label silently means
 * "this step is not counted" rather than counting it as the other one.
 */
function fireAdsConversion(label: string): void {
  const g = gtag();
  if (g && ADS_ID && label) {
    g('event', 'conversion', { send_to: `${ADS_ID}/${label}` });
  }
}

/** The ZIP download completed — the deep conversion. */
export function trackAdsConversion(): void {
  fireAdsConversion(ADS_CONVERSION_LABEL);
}

/** The analysis was started — see ADS_ANALYSIS_LABEL for why this one exists. */
export function trackAdsAnalysisStarted(): void {
  fireAdsConversion(ADS_ANALYSIS_LABEL);
}
