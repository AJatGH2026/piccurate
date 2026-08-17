/* eslint-disable @next/next/no-img-element */
import crypto from 'crypto';
import { notFound } from 'next/navigation';
import { readStats } from '@/lib/stats';
import { readBetaSignals } from '@/lib/beta';
import { readEventSignals } from '@/lib/events';
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

/** Small-print explainer under a KPI: what it measures, what a good value looks like. */
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-snug text-zinc-400">{children}</p>;
}

// Per-funnel-step small print, keyed by the step names in FUNNEL_STEPS (src/lib/beta.ts).
// `photobook_click` is deliberately dead right now: the CTA it would count was pulled
// 2026-08-11 for lack of an affiliate contract (see results/page.tsx) and stays at 0
// until that link comes back.
const FUNNEL_HINTS: Record<string, string> = {
  upload: 'Sessions, die den Upload-Schritt aufrufen. Referenzpunkt (100 %) für alle folgenden Schritte.',
  configure: 'Erreicht die Kriterien-Auswahl. Ideal: nah an „upload“ — sonst Absprung vor der Konfiguration.',
  analysis: 'Analyse tatsächlich gestartet. Ideal: nah an „configure“ — sonst Zögern bei Kriterien/Kosten.',
  review: 'Review-Schritt nach der Analyse erreicht. Ideal: nah an „analysis“, sonst Analyse-Fehler.',
  results: 'Ergebnis-/Download-Schritt erreicht. Ideal: nah an „review“.',
  download: 'ZIP tatsächlich heruntergeladen — der eigentliche Erfolgsschritt. Ideal: möglichst hoch, deutlich über 50 % der „results“.',
  photobook_click: 'Klick auf Fotobuch-Partnerlink. Aktuell strukturell 0 — Link seit 2026-08-11 ohne Partnervertrag entfernt.',
};

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!adminTokenOk(key)) {
    notFound();
  }

  const [stats, beta, events, db] = await Promise.all([
    readStats(7),
    readBetaSignals(),
    readEventSignals(7),
    readFeedbackFromDb(20),
  ]);

  // Feedback lives in Supabase since migration 003; everything submitted before
  // that is in the Upstash list and nowhere else. MERGE both — showing only the
  // configured source hid the entire pre-migration history behind the first new
  // row. The two never overlap: a successful DB insert skips the Upstash write.
  const feedback = [
    ...(db?.entries ?? []).map((f) => ({
      ts: f.created_at,
      text: f.message,
      locale: f.locale || '',
      path: f.path || '',
      emailed: f.emailed as boolean | null,
      src: 'Supabase',
    })),
    ...beta.recentFeedback.map((f) => ({
      ...f,
      emailed: null as boolean | null,
      src: 'Upstash',
    })),
  ]
    .sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
    .slice(0, 20);
  const feedbackCount = (db?.count ?? 0) + beta.feedbackCount;

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
          <Hint>
            Tageswerte der obigen Zähler, um Trends und Ausreißer zu erkennen. Idealerweise eine wachsende oder
            zumindest stabile Kurve; einzelne Tages-Spitzen ohne erkennbaren Anlass sind eher Bot-Traffic als
            organisches Wachstum.
          </Hint>
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
          <h2 className="font-semibold">Beta-Signale — Funnel</h2>
          <Hint>
            Jede Karte zählt Sessions, die diesen Schritt im Ablauf (Upload → Konfiguration → Analyse → Review →
            Ergebnis → Download) erreicht haben. Idealwert: pro Schritt möglichst nah am vorherigen Wert (hohe
            Konversion). Ein großer Sprung zwischen zwei benachbarten Schritten markiert, wo Nutzer aussteigen.
          </Hint>
          {!beta.configured ? (
            <p className="mt-2 text-sm text-zinc-500">Erscheint, sobald Upstash Redis konfiguriert ist.</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {beta.funnel.map((f) => (
                  <div key={f.step} className="rounded-lg border border-zinc-100 dark:border-zinc-800 px-3 py-2">
                    <div className="text-zinc-500 capitalize">{f.step}</div>
                    <div className="font-semibold tabular-nums">{fmt(f.total)}</div>
                    <div className="mt-1 text-[11px] leading-snug text-zinc-400">{FUNNEL_HINTS[f.step]}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <p className="text-sm">
                  Manuelle Korrekturen: <span className="font-medium text-zinc-700 dark:text-zinc-300">+{fmt(beta.selection.added)}</span> hinzugefügt,{' '}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">−{fmt(beta.selection.removed)}</span> entfernt
                </p>
                <Hint>
                  Wie oft Nutzer die KI-Vorauswahl im Review-Schritt per Hand ergänzt oder entfernt haben, aufsummiert
                  über alle Sessions. Idealwert: niedrig im Verhältnis zur Gesamtauswahl — viele Korrekturen zeigen,
                  dass die KI-Auswahl nicht trifft, was Nutzer erwarten.
                </Hint>
              </div>

              <div className="mt-4">
                <p className="text-sm">
                  E-Mails hinterlassen: <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(beta.emailCount)}</span>
                </p>
                <Hint>
                  Freiwillig hinterlassene Adressen (Update-/Launch-Interesse), unabhängig vom Feedback-Text. Idealwert:
                  möglichst hoch im Verhältnis zu „download“ — ein Näherungswert für Rückkehrbereitschaft.
                </Hint>
              </div>

              <div className="mt-4">
                <p className="text-sm">
                  Pflicht-Bestätigungen vor der Analyse: <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(beta.consent.termsAccepted)}</span> AGB/18+
                </p>
                <Hint>
                  Zählt die Checkbox-Bestätigungen unmittelbar vor dem Analyse-Start. Idealwert: nah bei 100 % des
                  „analysis“-Zählers oben — jede gestartete Analyse sollte genau eine AGB-Bestätigung erzeugen. Eine
                  Lücke deutet auf einen UI- oder Tracking-Fehler hin, nicht auf ein Nutzungsziel.
                  <br />
                  Die frühere Personen-Bestätigung wird bewusst nicht mehr gezählt: Seit die Personensuche lokal im
                  Browser läuft, würde dieser Zähler dem Server verraten, dass in einer Sitzung eine Gesichtssuche
                  stattfindet — genau das schließt § 5.4 des Umsetzungsplans als NO-GO aus.
                </Hint>
              </div>

              <div className="mt-4">
                <p className="text-sm">
                  Beta-Freischaltungen nach Tarif:{' '}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(beta.unlocks.small)}</span> Small ·{' '}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(beta.unlocks.medium)}</span> Medium ·{' '}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(beta.unlocks.large)}</span> Large
                </p>
                <Hint>
                  Da die Bezahltarife noch nicht buchbar sind, tritt ein kostenloses Freischalten des gewählten Tarifs an
                  die Stelle eines Kaufs — ein Proxy für Zahlungsbereitschaft pro Stufe. Kein Absolutwert ist „ideal“;
                  aufschlussreich ist die Verteilung — ein Schwerpunkt bei Medium/Large deutet auf mehr Zahlungsbereitschaft
                  hin als bei Small.
                </Hint>
              </div>
            </>
          )}
        </div>

        {/* Event-Funnel — campaign-attributed raw events from the marketing
            measurement concept (Event-Spezifikation.md), Stufe 1+2 only so
            far. Separate Upstash keys from the aggregate beta funnel above
            (lib/events.ts vs lib/beta.ts) — both stay in place. */}
        <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-semibold">Event-Funnel (Marketing-Konzept, Stufe 1+2)</h2>
          <Hint>
            Kampagnen- und geräte-attribuierte Rohereignisse aus der Event-Spezifikation —
            noch ohne Stufe 3+ (Bildselektion, Personensuche). Letzte {events.daysRead || 7} Tage.
          </Hint>
          {!events.configured ? (
            <p className="mt-2 text-sm text-zinc-500">Erscheint, sobald Upstash Redis konfiguriert ist.</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {events.totals.map((e) => (
                  <div key={e.name} className="rounded-lg border border-zinc-100 dark:border-zinc-800 px-3 py-2">
                    <div className="text-zinc-500">{e.name}</div>
                    <div className="font-semibold tabular-nums">{fmt(e.total)}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-3">
                <div>
                  <p className="text-sm">
                    files_selected / demo_start:{' '}
                    <span className="font-medium">
                      {events.ratios.filesSelectedPerDemoStart != null
                        ? `${Math.round(events.ratios.filesSelectedPerDemoStart * 100)}%`
                        : '—'}
                    </span>
                  </p>
                  <Hint>Abbruchkriterium §9: unter 40 % → Einstiegshürde reparieren, bevor irgendetwas anderes messbar wird.</Hint>
                </div>
                <div>
                  <p className="text-sm">
                    download_completed / results_shown:{' '}
                    <span className="font-medium">
                      {events.ratios.downloadCompletedPerResultsShown != null
                        ? `${Math.round(events.ratios.downloadCompletedPerResultsShown * 100)}%`
                        : '—'}
                    </span>
                  </p>
                  <Hint>Abbruchkriterium §9: unter 35 % → Produktproblem, kein Reichweitenproblem — kein weiteres Ad-Budget.</Hint>
                </div>
              </div>

              {Object.keys(events.byDeviceClass).length > 0 && (
                <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                  <p className="text-sm text-zinc-500 mb-2">files_selected / demo_start nach Gerät (§4: zwingend aufzuschlüsseln)</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(events.byDeviceClass).map(([dc, v]) => (
                        <tr key={dc} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                          <td className="py-1 text-zinc-500">{dc}</td>
                          <td className="py-1 text-right tabular-nums">
                            {v.demo_start > 0 ? `${Math.round((v.files_selected / v.demo_start) * 100)}%` : '—'}
                          </td>
                          <td className="py-1 text-right text-xs text-zinc-400">
                            ({fmt(v.files_selected)}/{fmt(v.demo_start)})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Vercel Web Analytics — informational only, no data pulled in: the
            script (VercelAnalytics.tsx) runs entirely in the browser and reports
            straight to Vercel, so there is nothing to read back into this page
            without a separate API token/integration. Link out instead of
            duplicating a system that already exists. */}
        <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-semibold">Vercel Analytics (extern)</h2>
          <Hint>
            Seitenaufrufe, eindeutige Besucher, Verweildauer, Absprungrate, Geräte/Browser und Herkunft (Referrer/UTM)
            laufen bereits über Vercel Web Analytics — direkt aus dem Browser erfasst, nicht über die Upstash-Zähler
            oben. Ideal: wachsende Besucherzahlen bei sinkender Absprungrate; die Herkunfts-Aufschlüsselung zeigt, ob
            Besucher durch Kampagnen kommen oder organisch. Zahlen liegen im Vercel-Dashboard, nicht auf dieser Seite,
            um keine zweite Quelle der Wahrheit zu pflegen.
          </Hint>
          <a
            href="https://vercel.com/aj-gmb-h/piccurate/analytics"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            Zum Vercel-Analytics-Dashboard →
          </a>
        </div>

        {/* Feedback — own card, independent of Upstash: it is stored in
            Supabase and must stay visible even when Redis is unconfigured. */}
        <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-semibold">
            Feedback <span className="font-normal text-zinc-400 text-sm">({fmt(feedbackCount)} gesamt, neueste 20)</span>
          </h2>
          <Hint>
            Freitext-Rückmeldungen aus dem Feedback-Widget und aus dem Beta-Freischalt-Dialog. Kein Zielwert an sich —
            jede einzelne ist inhaltlich wertvoll; die Rücklaufquote im Verhältnis zu „download“ zeigt, wie engagiert
            die Beta-Tester sind.
          </Hint>
          {feedback.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Noch kein Feedback eingegangen.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {feedback.map((f, i) => (
                <li key={i} className="rounded-lg border border-zinc-100 dark:border-zinc-800 px-3 py-2 text-sm">
                  <div className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">{f.text}</div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {f.ts?.slice(0, 16).replace('T', ' ')} · {f.locale || '—'} · {f.path || '—'} · {f.src}
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

// One metric row: label + value on one line, small-print explainer below.
function Row({
  label,
  value,
  hint,
  divider,
  strong,
}: {
  label: string;
  value: string;
  hint: string;
  divider?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={divider ? 'pt-2 border-t border-zinc-100 dark:border-zinc-800' : undefined}>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-zinc-500">{label}</span>
        <span className={`text-right tabular-nums ${strong ? 'font-semibold' : 'font-medium'}`}>{value}</span>
      </div>
      <Hint>{hint}</Hint>
    </div>
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
      <div className="mt-3 space-y-3">
        <Row
          label="Fotos analysiert"
          value={fmt(stats.photos)}
          hint="Summe aller von der KI bewerteten Fotos über abgeschlossene Analyse-Aufrufe. Ideal: so hoch wie möglich — der zentrale Nutzungsindikator, ohne Deckel nach oben."
        />
        <Row
          label="Analyse-Aufrufe (Jobs)"
          value={fmt(stats.jobs)}
          hint="Wie oft „Jetzt analysieren“ erfolgreich einen API-Call ausgelöst hat (1 Job = 1 Foto-Batch). Ideal: wächst proportional mit „Fotos analysiert“; ein stark abweichendes Foto/Job-Verhältnis zeigt viele kleine statt großer Batches."
        />
        <Row
          label="Input-Tokens"
          value={fmt(stats.inputTokens)}
          hint="An Gemini gesendete Tokens (Bilder + Prompt), Grundlage der Kostenschätzung. Kein Zielwert an sich — wichtig ist Tokens/Foto stabil zu halten; ein Anstieg zeigt teurere Prompts oder mehr Custom-Kriterien."
        />
        <Row
          label="Output-Tokens"
          value={fmt(stats.outputTokens)}
          hint="Von Gemini zurückgegebene Tokens (Bewertungen/Begründungen). Kein Zielwert an sich — Teil der Kostenformel, sollte proportional zu „Fotos analysiert“ bleiben."
        />
        <Row
          label="Geschätzte Kosten"
          value={fmtEur(stats.estCostEur)}
          hint="Schätzung auf Gemini-2.5-Flash-Listenpreisen, nicht die tatsächliche Rechnung. Solange nur der Gratis-Tarif läuft, ist dies reine Ausgabe ohne Gegenposition — beobachten (pro Foto niedrig halten), kein Zielwert per se."
          divider
          strong
        />
      </div>
    </div>
  );
}
