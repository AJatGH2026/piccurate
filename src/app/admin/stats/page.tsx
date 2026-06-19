/* eslint-disable @next/next/no-img-element */
import { readStats } from '@/lib/stats';

// Admin usage dashboard. Sits at /admin/stats (locale-free), protected by the
// site-wide Basic Auth gate (src/proxy.ts) — so the same SITE_PASSWORD that
// guards the prototype gates the dashboard. robots.txt already disallows
// /admin/* via the catch-all rule, but we belt-and-brace with metadata.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Admin — Usage',
  robots: { index: false, follow: false },
};

function fmt(n: number): string {
  return n.toLocaleString('de-DE');
}

function fmtEur(n: number): string {
  return `€${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminStatsPage() {
  const stats = await readStats(7);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Analysierte Fotos und API-Tokens. Kostenschätzung auf Sonnet-4.6-Preisen (Input $3 / Output $15 pro 1 M).
        </p>

        {!stats.configured && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">Persistenter Speicher noch nicht konfiguriert.</p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              Richte in Vercel <strong>Storage → Upstash Redis</strong> (gratis-Tier reicht) ein und verbinde es mit
              dem Projekt. Die Env-Variablen <code>UPSTASH_REDIS_REST_URL</code> und
              {' '}<code>UPSTASH_REDIS_REST_TOKEN</code> setzt Vercel automatisch. Danach einmal neu deployen — und das
              Tracking läuft automatisch ab dem nächsten Analyse-Aufruf.
            </p>
          </div>
        )}

        {/* Lifetime + today */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card title="Lifetime" stats={stats.lifetime} />
          <Card title="Heute" stats={stats.today} />
        </div>

        {/* Per-day breakdown */}
        <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-semibold">Letzte 7 Tage</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-zinc-500">
              <tr className="text-left border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-1.5 font-medium">Datum</th>
                <th className="py-1.5 font-medium text-right">Jobs</th>
                <th className="py-1.5 font-medium text-right">Fotos</th>
                <th className="py-1.5 font-medium text-right">Kosten (geschätzt)</th>
              </tr>
            </thead>
            <tbody>
              {stats.byDay.map((d) => (
                <tr key={d.date} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <td className="py-1.5 tabular-nums">{d.date}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(d.jobs)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(d.photos)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtEur(d.estCostEur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Card({
  title,
  stats,
}: {
  title: string;
  stats: { photos: number; jobs: number; inputTokens: number; outputTokens: number; estCostEur: number };
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
      <h2 className="font-semibold">{title}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
        <dt className="text-zinc-500">Fotos analysiert</dt>
        <dd className="text-right tabular-nums font-medium">{fmt(stats.photos)}</dd>

        <dt className="text-zinc-500">Analyse-Aufrufe (Jobs)</dt>
        <dd className="text-right tabular-nums">{fmt(stats.jobs)}</dd>

        <dt className="text-zinc-500">Input-Tokens</dt>
        <dd className="text-right tabular-nums">{fmt(stats.inputTokens)}</dd>

        <dt className="text-zinc-500">Output-Tokens</dt>
        <dd className="text-right tabular-nums">{fmt(stats.outputTokens)}</dd>

        <dt className="text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">Geschätzte Kosten</dt>
        <dd className="text-right tabular-nums font-semibold pt-2 border-t border-zinc-100 dark:border-zinc-800">
          {fmtEur(stats.estCostEur)}
        </dd>
      </dl>
    </div>
  );
}
