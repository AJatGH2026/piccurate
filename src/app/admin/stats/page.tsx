/* eslint-disable @next/next/no-img-element */
import crypto from 'crypto';
import { notFound } from 'next/navigation';
import { readStats } from '@/lib/stats';
import { readBetaSignals } from '@/lib/beta';
import { readFeedbackFromDb } from '@/lib/feedback';

// Admin usage dashboard at /admin/stats (locale-free). Protected by its OWN
// token (ADMIN_TOKEN), INDEPENDENT of the site-wide Basic Auth gate — the gate
// is off during the public beta, so relying on it (or on robots.txt) would
// leave cost figures and user feedback public. Access via ?key=<ADMIN_TOKEN>.
// If ADMIN_TOKEN is unset, the page 404s (dashboard disabled).

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Admin — Usage',
  robots: { index: false, follow: false },
};

/** Constant-time token check over SHA-256 digests (avoids length leaks). */
function adminTokenOk(provided: string | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !provided) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function fmt(n: number): string {
  return n.toLocaleString('de-DE');
}

function fmtEur(n: number): string {
  return `€${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!adminTokenOk(key)) {
    notFound();
  }

  const [stats, beta, db] = await Promise.all([
    readStats(7),
    readBetaSignals(),
    readFeedbackFromDb(20),
  ]);

  // Feedback lives in Supabase since migration 003. The Upstash list is only
  // the fallback store, and still holds everything submitted before that — show
  // whichever source is available, so no era of feedback becomes invisible.
  const feedback = db
    ? db.entries.map((f) => ({
        ts: f.created_at,
        text: f.message,
        locale: f.locale || '',
        path: f.path || '',
        emailed: f.emailed as boolean | null,
      }))
    : beta.recentFeedback.map((f) => ({ ...f, emailed: null as boolean | null }));
  const feedbackCount = db ? db.count : beta.feedbackCount;
  const feedbackSource = db ? 'Supabase' : 'Upstash';

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Analysierte Fotos und API-Tokens. Kostenschätzung auf Gemini-2.5-Flash-Preisen (Input $0,30 / Output $2,50 pro 1 M).
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

        {/* Beta signals — funnel, selection corrections, feedback, emails */}
        <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-semibold">Beta-Signale</h2>
          {!beta.configured ? (
            <p className="mt-2 text-sm text-zinc-500">Erscheint, sobald Upstash Redis konfiguriert ist.</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {beta.funnel.map((f) => (
                  <div key={f.step} className="rounded-lg border border-zinc-100 dark:border-zinc-800 px-3 py-2">
                    <div className="text-zinc-500 capitalize">{f.step}</div>
                    <div className="font-semibold tabular-nums">{fmt(f.total)}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-zinc-500">
                Manuelle Korrekturen: <span className="font-medium text-zinc-700 dark:text-zinc-300">+{fmt(beta.selection.added)}</span> hinzugefügt,{' '}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">−{fmt(beta.selection.removed)}</span> entfernt · E-Mails:{' '}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(beta.emailCount)}</span>
              </p>
            </>
          )}
        </div>

        {/* Feedback — own card, independent of Upstash: it is stored in
            Supabase and must stay visible even when Redis is unconfigured. */}
        <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-semibold">
            Feedback <span className="font-normal text-zinc-400 text-sm">({fmt(feedbackCount)} · {feedbackSource})</span>
          </h2>
          {feedback.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Noch kein Feedback eingegangen.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {feedback.map((f, i) => (
                <li key={i} className="rounded-lg border border-zinc-100 dark:border-zinc-800 px-3 py-2 text-sm">
                  <div className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">{f.text}</div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {f.ts?.slice(0, 16).replace('T', ' ')} · {f.locale || '—'} · {f.path || '—'}
                    {f.emailed === false && <span className="text-amber-600 dark:text-amber-500"> · Mail nicht versandt</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
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
