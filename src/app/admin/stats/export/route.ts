import { NextRequest, NextResponse } from 'next/server';
import { adminTokenOk, parseDays } from '@/lib/admin-auth';
import { readStats } from '@/lib/stats';
import { readDailyEventCounts } from '@/lib/events';

/**
 * GET /admin/stats/export?key=<ADMIN_TOKEN>&days=90
 *
 * Daily figures as CSV, for archiving beyond the stores' own retention.
 *
 * AGGREGATE ONLY, and that is a requirement rather than a simplification.
 * Privacy policy § 11 allows the § 9.1 events to be kept in individual form
 * for 90 days and requires anything after that to be aggregated with no
 * session or account reference. A file is not covered by a TTL, so exporting
 * raw events would quietly convert a 90-day limit into an unlimited archive —
 * the retention promise would still be in the text and no longer in reality.
 * Hence: per-day counters only. No session id, no user hash, no campaign or
 * device attribution, no IP, and no feedback text (which can carry third
 * parties' personal data and has no place in a metrics archive at all).
 *
 * Long format (date,metric,value) rather than one column per metric, so that
 * appending successive exports into one archive never needs a header migration
 * when an event is added.
 */
export const dynamic = 'force-dynamic';

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!adminTokenOk(params.get('key') ?? undefined)) {
    // 404, not 401: the admin surfaces do not advertise their own existence.
    return new NextResponse('Not found', { status: 404 });
  }

  const days = parseDays(params.get('days') ?? undefined, 90);

  const [stats, daily] = await Promise.all([
    readStats(days),
    readDailyEventCounts(days),
  ]);

  const rows: string[] = ['date,metric,value'];

  // Photos, jobs and estimated cost per day. These are plain counters with no
  // personal reference of any kind.
  for (const d of stats.byDay) {
    rows.push(`${d.date},photos,${d.photos}`);
    rows.push(`${d.date},jobs,${d.jobs}`);
    rows.push(`${d.date},est_cost_eur,${d.estCostEur}`);
  }

  // Funnel events per day, one row per event name that actually occurred.
  for (const day of daily) {
    for (const [name, value] of Object.entries(day.counts)) {
      rows.push(`${day.date},${csvEscape(`event_${name}`)},${value}`);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(rows.join('\n') + '\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="shortlistbuddy-stats-${today}.csv"`,
      // Never cached, and never indexed: it is behind a token, but a stray
      // intermediary copy of a metrics file is still a copy nobody asked for.
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
