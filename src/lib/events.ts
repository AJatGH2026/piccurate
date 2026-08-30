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
// Retention: 30 days raw, enforced via a Redis TTL on each day's key.
//
// Was 90 (Event-Spezifikation §1.3). Shortened on 2026-08-27 because the raw
// log is session-level: one row per event, carrying session_id plus the
// campaign it came from, so a visitor's path through the funnel is
// reconstructible for as long as the rows exist. The beta campaign runs three
// weeks and every question we ask of this data is answered inside a 7-day
// window, so months of reconstructible sessions bought nothing operationally
// and were the weakest point in the argument that we do not treat personal
// data as an economic asset (§ 312 Abs. 1a BGB, still to be settled).
//
// Note what §1.3 promises but the code does not do: there is no aggregation
// job. When these keys expire the campaign-level history is gone, not rolled
// up — only `ev:count:{name}:total` survives, and it has no campaign
// dimension. Anything worth keeping longer has to be written as its own
// counter at event time.

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
  // Fires where an account is actually demanded. Until 2026-08-27 that was
  // the upload page, in front of the drop zone; since the gate moved it is
  // the ZIP download on the results page. Same question either way — what
  // does the account requirement cost — but now asked of people who have
  // already seen what they would be signing up for.
  'account_gate_shown',
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
const DAY_TTL_S = 30 * 24 * 3600;
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
    // Share of demo_starts that got all the way to the ZIP download and were
    // asked for an account there. Before 2026-08-27 this measured the wall in
    // front of the upload instead; the number is not comparable across that
    // date.
    accountGatePerDemoStart: number | null;
    // The conversion, since 2026-08-27: `analysis_started` is the last event
    // that may carry campaign attribution, because it is the click that
    // concludes the free contract. Everything below it in the funnel is
    // counted but no longer attributable, so this is the deepest point at
    // which a channel can still be judged.
    analysisStartedPerDemoStart: number | null;
  };
  byDeviceClass: Record<string, { demo_start: number; files_selected: number }>;
  // Keyed by `traffic_source > campaign` (e.g. "google > beta26_su_kern"),
  // "(none)" when a UTM param was absent — the only way to answer "is any
  // recorded session actually attributed to a paid campaign" without a raw
  // Redis read, which the campaign owner's own tooling can't do directly.
  byCampaign: Record<string, { landing_view: number; demo_start: number; analysis_started: number }>;
  // One level deeper than byCampaign: `campaign > ad_group > keyword`, i.e.
  // utm_campaign/utm_content/utm_term. On Meta that separates one creative
  // from another (utm_term=motiv_verwandlung vs motiv_texthook); on Google it
  // separates keywords. Added 2026-08-25 because a creative test was about to
  // run that our own funnel could not have told apart — leaving Meta's own
  // numbers as the only verdict, which is exactly what this dashboard exists
  // not to rely on.
  byCreative: Record<string, { landing_view: number; demo_start: number; analysis_started: number }>;
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
    ratios: {
      filesSelectedPerDemoStart: null,
      downloadCompletedPerResultsShown: null,
      accountGatePerDemoStart: null,
      analysisStartedPerDemoStart: null,
    },
    byDeviceClass: {},
    byCampaign: {},
    byCreative: {},
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
    type Attributed = { landing_view: number; demo_start: number; analysis_started: number };
    const blank = (): Attributed => ({ landing_view: 0, demo_start: 0, analysis_started: 0 });
    const byCampaign: Record<string, Attributed> = {};
    const byCreative: Record<string, Attributed> = {};
    for (const e of events) {
      counts.set(e.name, (counts.get(e.name) || 0) + 1);
      if (e.name === 'demo_start' || e.name === 'files_selected') {
        const dc = e.device_class || 'other';
        byDevice[dc] ??= { demo_start: 0, files_selected: 0 };
        byDevice[dc][e.name]++;
      }
      if (e.name === 'landing_view' || e.name === 'demo_start' || e.name === 'analysis_started') {
        const key = e.traffic_source ? `${e.traffic_source} > ${e.campaign || '(kein campaign-Wert)'}` : '(none)';
        byCampaign[key] ??= blank();
        byCampaign[key][e.name]++;
        // Only tagged traffic: an untagged visit has nothing to break down,
        // and lumping them together would put organic noise next to the
        // creative being judged.
        if (e.ad_group || e.keyword) {
          const deep = `${e.campaign || '(kein campaign-Wert)'} > ${e.ad_group || '—'} > ${e.keyword || '—'}`;
          byCreative[deep] ??= blank();
          byCreative[deep][e.name]++;
        }
      }
    }

    const totals = Array.from(ALLOWED_EVENTS).map((name) => ({ name, total: counts.get(name) || 0 }));
    const demoStart = counts.get('demo_start') || 0;
    const filesSelected = counts.get('files_selected') || 0;
    const resultsShown = counts.get('results_shown') || 0;
    const downloadCompleted = counts.get('download_completed') || 0;
    const accountGate = counts.get('account_gate_shown') || 0;
    const analysisStarted = counts.get('analysis_started') || 0;

    return {
      configured: true,
      totals,
      ratios: {
        filesSelectedPerDemoStart: demoStart > 0 ? filesSelected / demoStart : null,
        downloadCompletedPerResultsShown: resultsShown > 0 ? downloadCompleted / resultsShown : null,
        accountGatePerDemoStart: demoStart > 0 ? accountGate / demoStart : null,
        analysisStartedPerDemoStart: demoStart > 0 ? analysisStarted / demoStart : null,
      },
      byDeviceClass: byDevice,
      byCampaign,
      byCreative,
      daysRead: days,
    };
  } catch (err) {
    console.warn('[events] readEventSignals failed:', err instanceof Error ? err.message : err);
    return { ...empty, configured: true };
  }
}

/** One measured upload run, newest first. */
export interface UploadTimingRun {
  ts: string;
  deviceClass: string;
  photoCount: number;
  faceSearch: boolean;
  /** True when the run was abandoned — the numbers cover only what it got through. */
  partial: boolean;
  totalMs: number | null;
  /** Phase name → { n, avgMs, maxMs }, from utils/upload-timing.ts. */
  phases: Record<string, { n: number; avgMs: number; maxMs: number }>;
}

/**
 * The most recent measured upload runs, for the /admin/stats panel.
 *
 * The phase timings ride on `file_transfer_ready` props, which
 * readEventSignals aggregates away — it answers funnel questions, not "where
 * did this run's time go". Added 2026-08-29, when person search turned out to
 * cost ~2.8x per photo (measured: 22 photos in 24 s without a reference photo,
 * 1:07 with one) and the numbers that would explain it were being written to
 * the console of the slow machine and nowhere else.
 */
export async function readUploadTimings(limit = 12, days = 3): Promise<UploadTimingRun[]> {
  const r = getClient();
  if (!r) return [];
  try {
    const dayKeys = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      return `ev:log:${d.toISOString().slice(0, 10)}`;
    });
    const lists = await Promise.all(dayKeys.map((k) => r.lrange(k, 0, -1) as Promise<unknown[]>));
    const runs: UploadTimingRun[] = [];
    for (const raw of lists.flat()) {
      let e: EventRecord;
      try {
        e = typeof raw === 'string' ? (JSON.parse(raw) as EventRecord) : (raw as EventRecord);
      } catch {
        continue;
      }
      if (e?.name !== 'file_transfer_ready') continue;
      const props = e.props || {};
      // Reassemble the flat <phase>_{n,avg_ms,max_ms} triples the client sends.
      const phases: UploadTimingRun['phases'] = {};
      for (const [k, v] of Object.entries(props)) {
        const m = /^(.+)_avg_ms$/.exec(k);
        if (!m || typeof v !== 'number') continue;
        phases[m[1]] = {
          n: Number(props[`${m[1]}_n`] ?? 0),
          avgMs: v,
          maxMs: Number(props[`${m[1]}_max_ms`] ?? 0),
        };
      }
      // Only runs that actually carry timings — events from before the
      // instrumentation shipped would otherwise show as empty rows.
      if (Object.keys(phases).length === 0) continue;
      runs.push({
        ts: e.ts,
        deviceClass: e.device_class,
        photoCount: Number(props.photo_count ?? 0),
        faceSearch: props.face_search === true,
        partial: props.partial === true,
        totalMs:
          typeof props.duration_since_files_selected_ms === 'number'
            ? props.duration_since_files_selected_ms
            : null,
        phases,
      });
    }
    runs.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return runs.slice(0, limit);
  } catch (err) {
    console.warn('[events] readUploadTimings failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** One day's aggregate counts, keyed by event name. */
export interface DailyEventCounts {
  date: string;
  counts: Record<string, number>;
}

/**
 * Per-day totals per event name, for the archive export.
 *
 * Reads the `ev:count:<name>:<day>` counters rather than the raw log: those are
 * plain integers with no session id, user hash, campaign or device attached.
 * That distinction is the whole point — privacy policy § 11 allows the raw,
 * individual-level events to be kept for 90 days and requires anything beyond
 * that to be aggregated with no session or account reference. An export meant
 * to outlive the retention window therefore has to be built from counters, not
 * from the log; exporting the log would move the same individual-level data
 * into a file where the 90-day limit no longer reaches it.
 *
 * Note the counters carry their own 30-day TTL, so days beyond that come back
 * as zeros rather than as history — which is the reason to export regularly.
 */
export async function readDailyEventCounts(days = 30): Promise<DailyEventCounts[]> {
  const r = getClient();
  if (!r) return [];
  const names = [...ALLOWED_EVENTS];
  const dayKeys = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });
  try {
    const out: DailyEventCounts[] = [];
    // Chunked: names × days is a few thousand keys, more than one mget should
    // carry in a single REST request.
    for (const date of dayKeys) {
      const keys = names.map((n) => `ev:count:${n}:${date}`);
      const values = (await r.mget(...keys)) as (string | number | null)[];
      const counts: Record<string, number> = {};
      names.forEach((n, i) => {
        const v = values[i];
        if (v != null && Number(v) > 0) counts[n] = Number(v);
      });
      if (Object.keys(counts).length) out.push({ date, counts });
    }
    return out;
  } catch (err) {
    console.warn('[events] readDailyEventCounts failed:', err instanceof Error ? err.message : err);
    return [];
  }
}
