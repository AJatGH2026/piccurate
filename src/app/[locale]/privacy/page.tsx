import { setRequestLocale } from 'next-intl/server';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Legal copy lives inline per locale — trying to route it through
// next-intl JSON would fight the mixed prose/list/table structure and
// make the text harder for a lawyer to review. Two blocks, keyed by
// locale, is the simplest thing that stays correct.
function EnglishBody() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p><em>Last updated: July 2026</em></p>

      <h2>1. Data Controller</h2>
      <p>PicCurate is operated by AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Germany (see the <a href="/en/imprint">imprint</a>). Contact: privacy@piccurate.app.</p>

      <h2>2. What Data We Collect</h2>
      <ul>
        <li><strong>Account data:</strong> Email address and hashed password for authentication.</li>
        <li><strong>Photo thumbnails:</strong> 512x512 pixel JPEG previews of your photos, used solely for AI analysis. Automatically deleted within 24 hours.</li>
        <li><strong>Photo metadata:</strong> Date taken, GPS coordinates, camera model — used for grouping and sorting. Deleted when the job expires (7 days).</li>
        <li><strong>Selection results:</strong> AI scores, selection decisions, and reason tags. Deleted after 30 days.</li>
        <li><strong>Payment data:</strong> Processed by Stripe. We never see or store your card details.</li>
      </ul>

      <h2>3. What Data We Do NOT Collect</h2>
      <ul>
        <li><strong>Full-resolution photos</strong> are only uploaded for selected photos at the download step, stored for max. 24 hours, then deleted.</li>
        <li>We do not use cookies for tracking. Our analytics (Plausible) are cookieless and privacy-first.</li>
        <li>We do not sell, share, or transfer your data to third parties for advertising.</li>
      </ul>

      <h2>4. How We Process Your Photos</h2>
      <p>Your photo thumbnails are sent to a third-party LLM provider (currently Google — the underlying model may change over time; the substance of this section remains unchanged) for quality analysis. The provider&apos;s data processing agreement ensures your images are not used for model training and are deleted after processing.</p>

      <h2>4a. Reference Photos of Named Persons (optional)</h2>
      <p>If you use the optional &quot;Persons&quot; feature to filter your travel photos for specific people, you upload one reference photo per named person. These reference photos are transmitted to the same LLM provider together with the travel photos for face-matching purposes.</p>
      <p>Reference photos <strong>constitute biometric data</strong> under Art. 9 GDPR and are therefore subject to a stricter regime:</p>
      <ul>
        <li>The feature is <strong>opt-in</strong>: reference photos are only processed if you actively upload them, and using the feature is entirely optional.</li>
        <li>Reference photos are <strong>held only in your browser session</strong>. They are never persisted on our servers, never written to your browser&apos;s local storage, and are discarded when you close the tab or start a new job.</li>
        <li>Reference photos are sent to the LLM provider <strong>only for the duration of the analysis</strong>. The provider does not train on this data and deletes it after processing under the applicable data processing agreement.</li>
        <li>You must have the <strong>consent of any person</strong> whose reference photo you upload. You are the data controller for that upload; PicCurate acts as processor only for the technical transmission and result.</li>
        <li>The feature is <strong>currently limited to four persons per job</strong>.</li>
      </ul>

      <h2>5. Data Storage Location</h2>
      <p>All data is stored in the European Union (Frankfurt, Germany) via Cloudflare and Supabase.</p>

      <h2>6. Your Rights (GDPR)</h2>
      <ul>
        <li><strong>Access:</strong> Request a copy of your data.</li>
        <li><strong>Deletion:</strong> Delete your account and all associated data at any time.</li>
        <li><strong>Portability:</strong> Export your data in a machine-readable format.</li>
        <li><strong>Objection:</strong> Object to processing at any time.</li>
      </ul>
      <p>To exercise any of these rights, contact privacy@piccurate.app.</p>

      <h2>7. Data Retention</h2>
      <table>
        <thead><tr><th>Data</th><th>Retention</th></tr></thead>
        <tbody>
          <tr><td>Photo thumbnails</td><td>24 hours</td></tr>
          <tr><td>Photo metadata</td><td>7 days after job completion</td></tr>
          <tr><td>Selection results</td><td>30 days</td></tr>
          <tr><td>Account data</td><td>Until you delete your account</td></tr>
        </tbody>
      </table>

      <h2>8. Sub-Processors</h2>
      <table>
        <thead><tr><th>Service</th><th>Purpose</th><th>Location</th></tr></thead>
        <tbody>
          <tr><td>Supabase</td><td>Database, authentication</td><td>EU (Frankfurt)</td></tr>
          <tr><td>Cloudflare</td><td>Temporary file storage, CDN</td><td>EU</td></tr>
          <tr><td>Third-party LLM provider (currently Google)</td><td>AI photo analysis, including optional reference-photo face matching</td><td>US (with EU DPA)</td></tr>
          <tr><td>Stripe</td><td>Payment processing</td><td>EU/US</td></tr>
          <tr><td>Vercel</td><td>Web hosting</td><td>EU (Frankfurt)</td></tr>
        </tbody>
      </table>
    </>
  );
}

function GermanBody() {
  return (
    <>
      <h1>Datenschutzerklärung</h1>
      <p><em>Letzte Aktualisierung: Juli 2026</em></p>

      <h2>1. Verantwortlicher</h2>
      <p>PicCurate wird betrieben von der AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Deutschland (siehe <a href="/de/imprint">Impressum</a>). Kontakt: privacy@piccurate.app.</p>

      <h2>2. Welche Daten wir erheben</h2>
      <ul>
        <li><strong>Kontodaten:</strong> E-Mail-Adresse und gehashtes Passwort zur Authentifizierung.</li>
        <li><strong>Foto-Vorschaubilder:</strong> 512×512-Pixel-JPEG-Vorschauen deiner Fotos, ausschließlich für die KI-Analyse. Automatische Löschung innerhalb von 24 Stunden.</li>
        <li><strong>Foto-Metadaten:</strong> Aufnahmedatum, GPS-Koordinaten, Kameramodell — genutzt zur Gruppierung und Sortierung. Löschung mit Ablauf des Jobs (nach 7 Tagen).</li>
        <li><strong>Auswahlergebnisse:</strong> KI-Bewertungen, Auswahl­entscheidungen und Begründungs­tags. Löschung nach 30 Tagen.</li>
        <li><strong>Zahlungsdaten:</strong> Werden von Stripe verarbeitet. Wir sehen oder speichern deine Karten­daten nicht.</li>
      </ul>

      <h2>3. Welche Daten wir NICHT erheben</h2>
      <ul>
        <li><strong>Fotos in voller Auflösung</strong> werden nur für die tatsächlich ausgewählten Fotos im Download-Schritt hochgeladen, maximal 24 Stunden gespeichert und danach gelöscht.</li>
        <li>Wir setzen keine Tracking-Cookies ein. Unser Analytics (Plausible) ist cookielos und datenschutz­freundlich.</li>
        <li>Wir verkaufen, teilen oder übertragen deine Daten nicht zu Werbezwecken an Dritte.</li>
      </ul>

      <h2>4. Wie wir deine Fotos verarbeiten</h2>
      <p>Deine Foto-Vorschaubilder werden zur Qualitätsanalyse an einen externen LLM-Anbieter übermittelt (derzeit Google — das eingesetzte Modell kann sich im Zeitverlauf ändern; der Inhalt dieses Abschnitts bleibt davon unberührt). Der Auftrags­verarbeitungs­vertrag mit dem Anbieter stellt sicher, dass deine Bilder nicht zum Training von Modellen verwendet und nach der Verarbeitung gelöscht werden.</p>

      <h2>4a. Referenzfotos benannter Personen (optional)</h2>
      <p>Wenn du die optionale Funktion „Personen" nutzt, um deine Reisefotos gezielt nach bestimmten Personen zu filtern, lädst du ein Referenzfoto je benannter Person hoch. Diese Referenzfotos werden zusammen mit den zu analysierenden Reisefotos an denselben LLM-Anbieter übermittelt, um einen Gesichts­abgleich zu ermöglichen.</p>
      <p>Referenzfotos stellen <strong>biometrische Daten</strong> im Sinne von Art. 9 DSGVO dar und unterliegen daher einem strengeren Regime:</p>
      <ul>
        <li>Die Funktion ist <strong>opt-in</strong>: Referenzfotos werden nur verarbeitet, wenn du sie aktiv hochlädst; die Nutzung ist rein freiwillig.</li>
        <li>Referenzfotos werden <strong>ausschließlich in deiner Browser-Sitzung</strong> gehalten. Sie werden weder auf unseren Servern gespeichert noch in den lokalen Speicher deines Browsers geschrieben und werden verworfen, sobald du den Tab schließt oder einen neuen Job startest.</li>
        <li>Referenzfotos werden dem LLM-Anbieter <strong>nur für die Dauer der Analyse</strong> übermittelt. Der Anbieter trainiert keine Modelle mit diesen Daten und löscht sie gemäß Auftragsverarbeitungs­vertrag nach der Verarbeitung.</li>
        <li>Du musst über die <strong>ausdrückliche Einwilligung jeder Person</strong> verfügen, deren Referenzfoto du hochlädst. Für diesen Upload bist du der Verantwortliche im Sinne der DSGVO; PicCurate handelt lediglich als Auftrags­verarbeiter für die technische Übermittlung und das Analyse­ergebnis.</li>
        <li>Die Funktion ist <strong>derzeit auf vier Personen je Job begrenzt</strong>.</li>
      </ul>

      <h2>5. Speicherort der Daten</h2>
      <p>Alle Daten werden in der Europäischen Union (Frankfurt, Deutschland) über Cloudflare und Supabase gespeichert.</p>

      <h2>6. Deine Rechte (DSGVO)</h2>
      <ul>
        <li><strong>Auskunft:</strong> Anfrage einer Kopie deiner Daten.</li>
        <li><strong>Löschung:</strong> Löschung deines Kontos und aller zugehörigen Daten jederzeit möglich.</li>
        <li><strong>Übertragbarkeit:</strong> Export deiner Daten in einem maschinen­lesbaren Format.</li>
        <li><strong>Widerspruch:</strong> Widerspruch gegen die Verarbeitung jederzeit möglich.</li>
      </ul>
      <p>Zur Ausübung dieser Rechte wende dich bitte an privacy@piccurate.app.</p>

      <h2>7. Speicherfristen</h2>
      <table>
        <thead><tr><th>Daten</th><th>Speicherdauer</th></tr></thead>
        <tbody>
          <tr><td>Foto-Vorschaubilder</td><td>24 Stunden</td></tr>
          <tr><td>Foto-Metadaten</td><td>7 Tage nach Abschluss des Jobs</td></tr>
          <tr><td>Auswahlergebnisse</td><td>30 Tage</td></tr>
          <tr><td>Kontodaten</td><td>Bis zur Löschung deines Kontos</td></tr>
        </tbody>
      </table>

      <h2>8. Unterauftragsverarbeiter</h2>
      <table>
        <thead><tr><th>Dienst</th><th>Zweck</th><th>Standort</th></tr></thead>
        <tbody>
          <tr><td>Supabase</td><td>Datenbank, Authentifizierung</td><td>EU (Frankfurt)</td></tr>
          <tr><td>Cloudflare</td><td>Temporäre Dateispeicherung, CDN</td><td>EU</td></tr>
          <tr><td>Externer LLM-Anbieter (derzeit Google)</td><td>KI-Fotoanalyse einschließlich optionalem Referenzfoto-Gesichts­abgleich</td><td>USA (mit EU-AVV)</td></tr>
          <tr><td>Stripe</td><td>Zahlungs­abwicklung</td><td>EU/USA</td></tr>
          <tr><td>Vercel</td><td>Webhosting</td><td>EU (Frankfurt)</td></tr>
        </tbody>
      </table>
    </>
  );
}

export default async function PrivacyPage({ params }: Props) {
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
