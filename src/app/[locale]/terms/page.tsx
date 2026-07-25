import { setRequestLocale } from 'next-intl/server';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// DRAFT — beta terms scaffold (pipeline §6 / §10 B2). Reflects the FREE public
// beta: no accounts, no payment. Account/payment/refund terms return with the
// paid launch. Entity-specific fields (governing-law venue) marked TODO. Final
// legal review pending (done by the operator).

function GermanBody() {
  return (
    <>
      <h1>Nutzungsbedingungen</h1>
      <p><em>Stand: Juli 2026 · Kostenlose Beta-Version</em></p>

      <h2>1. Geltungsbereich &amp; Beta-Hinweis</h2>
      <p>PicCurate wird derzeit als <strong>kostenlose Beta-Version</strong> bereitgestellt. Der Dienst befindet sich in der Erprobung, kann sich jederzeit ändern, zeitweise nicht verfügbar sein oder Fehler enthalten. Ein Anspruch auf Verfügbarkeit, bestimmte Funktionen oder Ergebnisse besteht nicht.</p>

      <h2>2. Leistungsbeschreibung</h2>
      <p>PicCurate ist ein KI-gestützter Dienst zur Vorauswahl von Reisefotos. Nutzer laden Fotos hoch (oder importieren aus verbundenen Cloud-Speichern); der Dienst analysiert sie und schlägt anhand konfigurierbarer Kriterien eine Auswahl vor, die im Anschluss geprüft und heruntergeladen werden kann.</p>

      <h2>3. Kein Konto, keine Zahlung (Beta)</h2>
      <p>Für die Beta ist weder eine Registrierung noch eine Zahlung erforderlich. Konten- und Zahlungsbedingungen sowie das Preismodell folgen mit dem späteren kostenpflichtigen Start.</p>

      <h2>4. Deine Fotos</h2>
      <ul>
        <li>Du behältst jederzeit die vollständigen Rechte an deinen Fotos.</li>
        <li>Wir beanspruchen keinerlei Rechte an deinen Fotos.</li>
        <li>Fotos werden ausschließlich zum Zweck der KI-Kuration verarbeitet.</li>
        <li>Es werden nur Vorschaubilder (Thumbnails) an den KI-Anbieter übermittelt; Originale bleiben lokal/transient und werden zeitnah gelöscht. Details in der <Link href="/de/privacy">Datenschutzerklärung</Link>.</li>
      </ul>

      <h2>5. KI-Analyse</h2>
      <p>Die KI-Analyse erfolgt „wie besehen". Trotz hoher Sorgfalt kann die KI Inhalte falsch einordnen, wichtige Fotos übersehen oder unerwartete Auswahlen treffen. Der Prüf-Schritt erlaubt dir, jede Auswahl vor dem Abschluss anzupassen. <strong>Bewahre stets Originalkopien deiner Fotos auf.</strong></p>

      <h2>6. Zulässige Nutzung</h2>
      <p>Du verpflichtest dich, keine rechtswidrigen Inhalte, Schadsoftware oder Inhalte hochzuladen, die Rechte Dritter verletzen. PicCurate ist für persönliche Reisefotos bestimmt. Wir dürfen den Zugang bei missbräuchlicher Nutzung einschränken oder sperren.</p>

      <h2>7. Haftung</h2>
      <p>Für die unentgeltliche Beta haften wir nur für Schäden aus Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit. Im Übrigen ist die Haftung — soweit gesetzlich zulässig — ausgeschlossen, insbesondere für Fotoverlust, Datenverfälschung oder Dienstunterbrechungen. Zwingende gesetzliche Vorschriften (z. B. Produkthaftungsgesetz) bleiben unberührt. [Vor Veröffentlichung juristisch prüfen.]</p>

      <h2>8. Datenschutz</h2>
      <p>Einzelheiten zur Verarbeitung deiner Daten findest du in unserer <Link href="/de/privacy">Datenschutzerklärung</Link>.</p>

      <h2>9. Änderungen</h2>
      <p>Wir können diese Bedingungen und den Funktionsumfang der Beta jederzeit anpassen. Die jeweils aktuelle Fassung ist auf dieser Seite abrufbar.</p>

      <h2>10. Anwendbares Recht</h2>
      <p>Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit zulässig, [Ort — nach Gründung].</p>
    </>
  );
}

function EnglishBody() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p><em>Last updated: July 2026 · Free beta version</em></p>

      <h2>1. Scope &amp; beta notice</h2>
      <p>PicCurate is currently provided as a <strong>free beta</strong>. The service is under test, may change at any time, be temporarily unavailable, or contain errors. There is no entitlement to availability, specific features, or particular results.</p>

      <h2>2. Service description</h2>
      <p>PicCurate is an AI-assisted service for pre-selecting travel photos. Users upload photos (or import from connected cloud storage); the service analyses them and proposes a selection based on configurable criteria, which you can then review and download.</p>

      <h2>3. No account, no payment (beta)</h2>
      <p>The beta requires neither registration nor payment. Account, payment, and pricing terms will follow with the later paid launch.</p>

      <h2>4. Your photos</h2>
      <ul>
        <li>You retain full ownership of your photos at all times.</li>
        <li>We claim no rights to your photos.</li>
        <li>Photos are processed solely for the purpose of AI curation.</li>
        <li>Only thumbnails are sent to the AI provider; originals stay local/transient and are deleted promptly. See the <Link href="/en/privacy">Privacy Policy</Link>.</li>
      </ul>

      <h2>5. AI analysis</h2>
      <p>The AI analysis is provided &quot;as is&quot;. Despite our best efforts, the AI may misidentify content, miss important photos, or produce unexpected selections. The review step lets you adjust every selection before finalising. <strong>Always keep original copies of your photos.</strong></p>

      <h2>6. Acceptable use</h2>
      <p>You agree not to upload illegal content, malware, or content that violates third-party rights. PicCurate is intended for personal travel photos. We may restrict or suspend access in cases of misuse.</p>

      <h2>7. Limitation of liability</h2>
      <p>For the free beta we are liable only for damages caused by intent or gross negligence, and for injury to life, body, or health. Otherwise liability is excluded to the extent permitted by law, in particular for loss of photos, data corruption, or service interruptions. Mandatory statutory provisions remain unaffected. [Have legal counsel review before publishing.]</p>

      <h2>8. Data protection</h2>
      <p>For details on how we process your data, see our <Link href="/en/privacy">Privacy Policy</Link>.</p>

      <h2>9. Changes</h2>
      <p>We may adjust these terms and the scope of the beta at any time. The current version is always available on this page.</p>

      <h2>10. Governing law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Germany. Place of jurisdiction, where permitted, is [city — after founding].</p>
    </>
  );
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 flex items-center h-14">
          <Link href={`/${locale}`} className="text-lg font-bold text-indigo-600">PicCurate</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 prose dark:prose-invert prose-zinc">
        {locale === 'de' ? <GermanBody /> : <EnglishBody />}
      </main>
    </div>
  );
}
