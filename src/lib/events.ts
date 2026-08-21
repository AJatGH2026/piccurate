// Raw funnel events for the marketing measurement concept
// (Shortlistbuddy-Docs/Marketing/AuswahlBuddy_Event-Spezifikation.md).
//
// Deliberately separate from lib/beta.ts: that file keeps aggregate,
// property-free counters (product-pipeline.md §2.1 "signal-only" stance) and
// stays untouched by this. This store adds per-event records with campaign
// and device attribution — the raw layer the Event-Spezifikation's
// Kernquotienten and Abbruchkriterien (§9) are computed from. Both systems
// keep running side by side; the old one still feeds the existing admin
// dashboard section.
//
// Retention: 90 days raw (§1.3), enforced via a Redis TTL on each day's key.

import { Redis } from '@upstash/redis';

let client: Redis | null | undefined;
function getClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    client = null;
    return null;
  }
  client = new Redis({ url, token });
  return client;
}

// Umsetzungsreihenfolge §10, Stufe 1/2/3/4/6 (Stufe 5 — Personensuche —
// deliberately not implemented, see the NOTE in lib/beta.ts on why a
// person-correlated event is a legal NO-GO). An unlisted name is dropped
// silently in the API route, so a client typo or a stray call never fills
// the log with garbage.
export const ALLOWED_EVENTS = new Set([
  // Stufe 1
  'landing_view',
  'demo_start',
  'files_selected',
  'file_transfer_ready',
  'cloud_intent_click',
  // Stufe 2
  'analysis_started',
  'analysis_progress',
  'analysis_completed',
  'analysis_failed',
  'analysis_abandoned',
  'results_shown',
  'results_idle_exit',
  'download_started',
  'download_completed',
  'download_failed',
  // Stufe 3 — Bildselektion (§5)
  'photo_removed',
  'photo_added',
  'slider_changed',
  'reselect_run',
  'photo_zoomed',
  // Stufe 4 — Mikrofrage + Preisstruktur (§6/§7)
  'micro_survey_shown',
  'micro_survey_answered',
  'pricing_tier_click',
  // Stufe 6 — Kosten (§8)
  'ai_cost_estimate',
]);

export interface EventRecord {
  name: string;
  ts: string;
  session_id: string;
  user_hash: string | null;
  device_class: string;
  os_family: string;
  browser_family: string;
  locale: string;
  traffic_source: string | null;
  campaign: string | null;
  ad_group: string | null;
  keyword: string | null;
  photo_count_bucket: string | null;
  // §2: global property on every event, not just `pricing_tier_click` — fixed
  // per session (50/50) in lib/events-client.ts. Both variants currently
  // render the SAME pricing UI (see pricing/page.tsx) — this only collects
  // the assignment so a real pricing_b experience can be built later without
  // a second measurement rollout.
  ab_variant: 'pricing_a' | 'pricing_b' | null;
  props: Record<string, unknown>;
}

const todayKey = () => new Date().toISOString().slice(0, 10);
const DAY_TTL_S = 90 * 24 * 3600;
// A 700€/3-week beta campaign will not come close to this per day — the cap
// only exists so a runaway client loop cannot grow one key without bound.
const MAX_PER_DAY = 20_000;

/** Append one event to today's raw log. Never throws — best-effort only. */
export async function logEvent(e: EventRecord): Promise<void> {
  const r = getClient();
  if (!r || !ALLOWED_EVENTS.has(e.name)) return;
  const day = todayKey();
  try {
    const logKey = `ev:log:${day}`;
    const p = r.pipeline();
    p.lpush(logKey, JSON.stringify(e));
    p.ltrim(logKey, 0, MAX_PER_DAY - 1);
    p.expire(logKey, DAY_TTL_S);
    p.incrby(`ev:count:${e.name}:total`, 1);
    p.incrby(`ev:count:${e.name}:${day}`, 1);
    p.expire(`ev:count:${e.name}:${day}`, DAY_TTL_S);
    await p.exec();
  } catch (err) {
    console.warn('[events] logEvent failed:', err instanceof Error ? err.message : err);
  }
}

export interface EventSignals {
  configured: boolean;
  totals: { name: string; total: number }[];
  ratios: {
    filesSelectedPerDemoStart: number | null;
    downloadCompletedPerResultsShown: number | null;
  };
  byDeviceClass: Record<string, { demo_start: number; files_selected: number }>;
  // Keyed by `traffic_source > campaign` (e.g. "google > beta26_su_kern"),
  // "(none)" when a UTM param was absent — the only way to answer "is any
  // recorded session actually attributed to a paid campaign" without a raw
  // Redis read, which the campaign owner's own tooling can't do directly.
  byCampaign: Record<string, { landing_view: number; demo_start: number }>;
  daysRead: number;
}

/**
 * Read + aggregate the last `days` days of raw events for the admin
 * dashboard. Scans the raw log rather than maintaining a counter per
 * dimension: at beta volume (a few hundred sessions across a 3-week
 * campaign) that is cheap, and it avoids a combinatorial explosion of Redis
 * keys for every property combination the marketing docs might eventually
 * ask for.
 */
export async function readEventSignals(days = 7): Promise<EventSignals> {
  const r = getClient();
  const empty: EventSignals = {
    configured: false,
    totals: [],
    ratios: { filesSelectedPerDemoStart: null, downloadCompletedPerResultsShown: null },
    byDeviceClass: {},
    byCampaign: {},
    daysRead: 0,
  };
  if (!r) return empty;

  try {
    const dayKeys = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      return `ev:log:${d.toISOString().slice(0, 10)}`;
    });
    const lists = await Promise.all(dayKeys.map((k) => r.lrange(k, 0, -1) as Promise<unknown[]>));
    const events: EventRecord[] = lists
      .flat()
      .map((x) => {
        try {
          return typeof x === 'string' ? (JSON.parse(x) as EventRecord) : (x as EventRecord);
        } catch {
          return null;
        }
      })
      .filter((x): x is EventRecord => !!x && typeof x.name === 'string');

    const counts = new Map<string, number>();
    const byDevice: Record<string, { demo_start: number; files_selected: number }> = {};
    const byCampaign: Record<string, { landing_view: number; demo_start: number }> = {};
    for (const e of events) {
      counts.set(e.name, (counts.get(e.name) || 0) + 1);
      if (e.name === 'demo_start' || e.name === 'files_selected') {
        const dc = e.device_class || 'other';
        byDevice[dc] ??= { demo_start: 0, files_selected: 0 };
        byDevice[dc][e.name]++;
      }
      if (e.name === 'landing_view' || e.name === 'demo_start') {
        const key = e.traffic_source ? `${e.traffic_source} > ${e.campaign || '(kein campaign-Wert)'}` : '(none)';
        byCampaign[key] ??= { landing_view: 0, demo_start: 0 };
        byCampaign[key][e.name]++;
      }
    }

    const totals = Array.from(ALLOWED_EVENTS).map((name) => ({ name, total: counts.get(name) || 0 }));
    const demoStart = counts.get('demo_start') || 0;
    const filesSelected = counts.get('files_selected') || 0;
    const resultsShown = counts.get('results_shown') || 0;
    const downloadCompleted = counts.get('download_completed') || 0;

    return {
      configured: true,
      totals,
      ratios: {
        filesSelectedPerDemoStart: demoStart > 0 ? filesSelected / demoStart : null,
        downloadCompletedPerResultsShown: resultsShown > 0 ? downloadCompleted / resultsShown : null,
      },
      byDeviceClass: byDevice,
      byCampaign,
      daysRead: days,
    };
  } catch (err) {
    console.warn('[events] readEventSignals failed:', err instanceof Error ? err.message : err);
    return { ...empty, configured: true };
  }
}
