// Client-side sender for the first-party funnel events (Marketing/
// AuswahlBuddy_Event-Spezifikation.md). Fire-and-forget; never throws.
//
// Separate from lib/beta-client.ts on purpose: that one posts bare step names
// to /api/beta for the older aggregate counters (still in use, still read by
// the admin dashboard). trackEv() posts richly-attributed events to /api/ev —
// the two run side by side, not as a replacement for one another.

let sessionId: string | null = null;

/**
 * Anonymous session identity. Lives ONLY in this module-level variable —
 * never localStorage or a cookie (§1.2: "nur im Arbeitsspeicher"). A hard
 * reload starts a new session; that is the deliberate trade for not needing
 * a consent banner (§1.1), not an oversight.
 */
/** Exported so non-/api/ev requests (e.g. the analyze-demo FormData) can
 * carry the same session_id for server-side events like `ai_cost_estimate`. */
export function getSessionId(): string {
  if (!sessionId) {
    sessionId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  return sessionId;
}

interface Campaign {
  traffic_source: string | null;
  campaign: string | null;
  ad_group: string | null;
  keyword: string | null;
}
let campaign: Campaign | null = null;

/**
 * Campaign attribution, fixed at the session's first event (§2: "bei
 * Erstkontakt der Sitzung fixieren"). Read lazily rather than on a specific
 * page mount, because ad destinations vary — the landing page for most
 * groups, a guide page for AG_Fotobuch/AG_Beste_Auswaehlen — so whichever
 * event fires first is the session's first contact.
 */
/** Exported so the analyze-demo FormData can carry the same attribution as
 * every /api/ev event, for the server-side `ai_cost_estimate` (Stufe 6). */
export function getCampaign(): Campaign {
  if (!campaign) {
    let params: URLSearchParams | null = null;
    try {
      params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    } catch {
      params = null;
    }
    campaign = {
      traffic_source: params?.get('utm_source') || null,
      campaign: params?.get('utm_campaign') || null,
      ad_group: params?.get('utm_content') || null,
      keyword: params?.get('utm_term') || null,
    };
  }
  return campaign;
}

// Named timestamps for the spec's duration_since_* properties (e.g.
// demo_start → files_selected, files_selected → file_transfer_ready).
const marks = new Map<string, number>();
export function mark(name: string): void {
  marks.set(name, Date.now());
}
export function msSince(name: string): number | null {
  const t = marks.get(name);
  return t == null ? null : Date.now() - t;
}
/**
 * msSince, but consumes the mark — for a one-shot span that must not be read
 * twice. `picker_opened` is one: it is set when the native file picker opens,
 * and a later drop or cloud import (which never opens one) would otherwise
 * measure against the stale mark and report a handoff that never happened.
 */
export function takeMark(name: string): number | null {
  const t = marks.get(name);
  if (t == null) return null;
  marks.delete(name);
  return Date.now() - t;
}

export type PhotoCountBucket = '0-250' | '251-1000' | '1001-2500' | '2500+';
export function photoCountBucket(n: number): PhotoCountBucket {
  if (n <= 250) return '0-250';
  if (n <= 1000) return '251-1000';
  if (n <= 2500) return '1001-2500';
  return '2500+';
}

/** Buckets the model's 1–10 aesthetic score for `photo_removed`/`photo_added`
 * (§5) — coarse on purpose, a per-point bucket would be one bucket per photo. */
export function aiScoreBucket(score: number): '1-4' | '5-7' | '8-10' {
  if (score <= 4) return '1-4';
  if (score <= 7) return '5-7';
  return '8-10';
}

export type AbVariant = 'pricing_a' | 'pricing_b';
let abVariant: AbVariant | null = null;
/**
 * §2/§7: pricing-structure A/B split, fixed 50/50 per session. Global
 * property attached to every event (not just `pricing_tier_click`), so
 * later analysis can slice the whole funnel by variant even before a real
 * pricing_b experience exists.
 */
export function getAbVariant(): AbVariant {
  if (!abVariant) {
    abVariant = Math.random() < 0.5 ? 'pricing_a' : 'pricing_b';
  }
  return abVariant;
}

// §5: `reselect_run.run_index` — counts re-analyses within this session,
// module-level so it survives the configure page unmounting/remounting
// (review → configure → review again).
let runIndex = 0;
export function nextRunIndex(): number {
  runIndex += 1;
  return runIndex;
}

// --- Attribution firewall (2026-08-27) -------------------------------------
//
// § 312 Abs. 1a Satz 2 BGB lifts the consumer-contract rules only where the
// trader processes the data the consumer provided "ausschließlich … um seine
// Leistungspflicht … zu erfüllen, und sie zu keinem anderen Zweck". Campaign
// measurement is another purpose. So attribution has to stop at the moment the
// free analysis contract is concluded — the click on "Analysieren" — or the
// exception cannot be relied on at all (§ 327 Abs. 3 points at the same
// sentence, so both rule sets turn on it).
//
// `analysis_started` is the boundary: it IS the conversion we want to count,
// so it still carries attribution. Everything after it does not.
//
// Two mechanisms, deliberately: the flag is precise (it knows a contract was
// actually concluded in this session), the name list is a backstop that
// survives a hard reload of the results page, where the flag would be gone but
// the events are still post-contract. `pricing_tier_click` is intentionally
// NOT in the list — someone can reach the pricing page without ever analysing,
// and that visit is ordinary pre-contract marketing data; the flag catches the
// case where they got there after a run.
const POST_CONTRACT_EVENTS = new Set([
  'analysis_progress',
  'analysis_completed',
  'analysis_failed',
  'analysis_abandoned',
  'results_shown',
  'results_idle_exit',
  'download_started',
  'download_completed',
  'download_failed',
  'photo_removed',
  'photo_added',
  'photo_zoomed',
  'slider_changed',
  'reselect_run',
  'micro_survey_shown',
  'micro_survey_answered',
]);

let contractSealed = false;

/**
 * Call once, immediately after `analysis_started` — from then on no event in
 * this session carries the session identity, the campaign it came from, or the
 * A/B assignment. There is no way back within the session; a new document
 * starts unsealed, which is correct because that is a new pre-contract visit.
 */
export function sealAttribution(): void {
  contractSealed = true;
}

/**
 * Send one funnel event. `locale` is passed explicitly by the caller (every
 * call site already has it from useParams/params) rather than read from the
 * DOM, so it can't drift from what the page actually shows.
 */
export function trackEv(
  name: string,
  locale: string,
  props?: Record<string, unknown>,
  photoBucket?: PhotoCountBucket
): void {
  try {
    const sealed = contractSealed || POST_CONTRACT_EVENTS.has(name);
    const body = JSON.stringify(
      sealed
        ? {
            // Post-contract: the event still says WHAT happened — that is
            // product data about our own service — but not who it was or
            // which ad paid for them. Nothing here links a run back to a
            // campaign or to another event of the same visit.
            name,
            locale,
            photo_count_bucket: photoBucket ?? null,
            props: props || {},
          }
        : {
            name,
            session_id: getSessionId(),
            locale,
            ...getCampaign(),
            photo_count_bucket: photoBucket ?? null,
            ab_variant: getAbVariant(),
            props: props || {},
          }
    );
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/ev', new Blob([body], { type: 'application/json' }));
    } else {
      void fetch('/api/ev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
