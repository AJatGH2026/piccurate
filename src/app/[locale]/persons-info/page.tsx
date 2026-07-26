import { setRequestLocale } from 'next-intl/server';
import { brandName } from '@/lib/brand';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Generated from the reviewed legal source (§3.5 / §4.5) — short information
// for persons shown in a reference photo. Linked from the reference-photo
// collective confirmation.
function GermanBody() {
  return (
    <>
      <h1>Hinweise zur Personenfunktion</h1>
      <p>Diese Information kann der Nutzer der abgebildeten Person vor der Verwendung zeigen oder zusenden. Eine Unterschrift, ein Formular oder die Übermittlung eines Einwilligungsnachweises an AuswahlBuddy ist nicht erforderlich. AuswahlBuddy verlangt nur die aktive Sammelbestätigung des volljährigen Nutzers für alle Referenzfotos des aktuellen Upload-Vorgangs.</p>
      <h2>Wer bietet die technische Verarbeitung an?</h2>
      <p>AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Deutschland. Datenschutzkontakt: privacy@auswahlbuddy.de. Für die vom Nutzer ausgewählten Foto- und Referenzinhalte verarbeitet AJ GmbH ausschließlich im Auftrag des privaten Nutzers; für eigene technische Sicherheits- und Kontaktdaten ist AJ GmbH Verantwortlicher.</p>
      <h2>Wie kommt dein Foto zu AuswahlBuddy?</h2>
      <p>Ein volljähriger Nutzer verwendet ein privates Foto von dir als Referenz, um dich in seinen eigenen ausgewählten Familien- oder Freundesfotos wiederzufinden. Der Nutzer soll dich vorher verständlich über diesen Zweck und die technische Verarbeitung informieren. Eine schriftliche Erklärung ist nicht erforderlich.</p>
      <h2>Welche Daten werden verarbeitet?</h2>
      <p>ein verkleinertes Referenzfoto und daraus technisch abgeleitete Gesichtsmerkmale;</p>
      <p>verkleinerte Vorschaubilder der vom Nutzer ausgewählten privaten Fotos;</p>
      <p>eine neutrale Kennzeichnung wie „Person A“; dein Klarname soll nicht an Google übermittelt werden;</p>
      <p>technische Vorgangsdaten, insbesondere Zeitpunkt, Vorgangskennung und die Bestätigung des Nutzers, dass die erforderliche Zustimmung zur Nutzung des Referenzfotos vorliegt;</p>
      <p>das sitzungsbezogene Ergebnis, in welchen ausgewählten Fotos eine hinreichende Ähnlichkeit erkannt wurde.</p>
      <h2>Wozu werden die Daten verarbeitet?</h2>
      <p>Die Daten werden ausschließlich verarbeitet, um dich anhand des Referenzfotos in den vom Nutzer ausgewählten privaten Fotos wiederzufinden. AuswahlBuddy identifiziert keine unbekannten Personen, durchsucht keine öffentlichen oder fremden Bildbestände, betreibt keine Überwachung, erstellt keine dauerhafte Gesichts- oder Personendatenbank und leitet keine sensiblen Eigenschaften oder Emotionen ab.</p>
      <p>Der private Nutzer muss zur Verwendung des Referenzfotos berechtigt sein. AuswahlBuddy verlässt sich auf seine aktive Sammelbestätigung, dass du selbst oder – soweit erforderlich – eine hierzu berechtigte Person der vorübergehenden Wiedererkennung und der erforderlichen Übermittlung zugestimmt hat. Art. 8 DSGVO mit seiner Altersgrenze für Online-Dienste gilt nicht allein deshalb, weil eine minderjährige Person auf einem Foto abgebildet ist; AuswahlBuddy selbst wird nur volljährigen Nutzern angeboten.</p>
      <h2>Wer erhält die Daten und wo werden sie verarbeitet?</h2>
      <p>Die verkleinerten Referenz- und Nutzerfotos werden zur Durchführung des Gesichtsabgleichs an Google Cloud EMEA Limited und deren Unterauftragsverarbeiter übermittelt. AuswahlBuddy verwendet hierzu die bezahlte Gemini Developer API. Hosting- und Sicherheitsdienstleister, insbesondere Vercel, können im technisch erforderlichen Umfang Verbindungs- und Sicherheitsdaten verarbeiten. Einzelheiten zu Empfängern, Drittlandübermittlungen und Schutzmechanismen enthält die allgemeine Datenschutzerklärung von AuswahlBuddy.</p>
      <p>Google oder Unterauftragsverarbeiter können Daten auch außerhalb des Europäischen Wirtschaftsraums verarbeiten. Soweit erforderlich, stützen wir die Übermittlung auf einen Angemessenheitsbeschluss, EU-Standardvertragsklauseln und ergänzende Schutzmaßnahmen. Ein verbleibendes Risiko behördlicher Zugriffe im Empfängerland kann nicht vollständig ausgeschlossen werden.</p>
      <h2>Wie lange werden die Daten gespeichert?</h2>
      <p>AJ GmbH verarbeitet das Referenzfoto, temporäre Gesichtsmerkmale und das Zuordnungsergebnis nur für den laufenden Analysevorgang und löscht sie anschließend aus der Anwendungsumgebung. Es werden keine dauerhaften Gesichts-Templates oder wiederverwendbaren Personenprofile angelegt.</p>
      <p>Google kann die übermittelten Bilder, Eingaben und Antworten nach der derzeitigen Dokumentation insbesondere zur Sicherheits- und Missbrauchskontrolle bis zu 55 Tage aufbewahren, solange für das konkrete Projekt keine verbindliche kürzere Zero-Data-Retention-Konfiguration genehmigt und aktiviert ist.</p>
      <p>AJ GmbH speichert lediglich einen minimierten technischen Nachweis der Sammelbestätigung ohne Referenzfoto, Namen oder Kontaktdaten für 30 Tage, sofern kein konkreter Sicherheits-, Missbrauchs- oder Rechtsfall eine längere Aufbewahrung erfordert.</p>
      <h2>Rücknahme und Kontakt</h2>
      <p>Du kannst dem Nutzer jederzeit mitteilen, dass dein Referenzfoto künftig nicht mehr verwendet werden darf. Der Nutzer muss dies beachten. Du kannst dich außerdem an privacy@auswahlbuddy.de wenden. Bereits abgeschlossene Verarbeitungsvorgänge werden dadurch nicht rückwirkend unzulässig; Google-Sicherheitsprotokolle können entsprechend der beschriebenen Frist fortbestehen.</p>
      <p>Rücknahme-, Widerspruchs- und Datenschutzanfragen an: privacy@auswahlbuddy.de. Hilfreich sind Zeitpunkt und Vorgangskennung, sofern bekannt.</p>
      <h2>Deine Rechte</h2>
      <p>Dir stehen nach Maßgabe der DSGVO insbesondere Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Beschwerde bei einer Datenschutzaufsichtsbehörde zu. Es findet keine ausschließlich automatisierte Entscheidung mit rechtlicher oder vergleichbar erheblicher Wirkung im Sinne von Art. 22 DSGVO statt.</p>
      <h2>Praktische Information</h2>
      <p>„Ich möchte dieses Foto von dir als Referenz verwenden, damit AuswahlBuddy dich in meinen privaten Fotos wiederfindet. Dafür werden verkleinerte Bilder vorübergehend mit KI verarbeitet und an Google übermittelt; Google kann sie zur Missbrauchskontrolle bis zu 55 Tage aufbewahren. Ist das für dich in Ordnung?“ Eine klare mündliche oder elektronische Zustimmung genügt; AuswahlBuddy verlangt keine Schriftform.</p>
      <p>Eine Unterschrift, ein Formular oder die Übersendung eines Einwilligungsnachweises an AuswahlBuddy ist nicht erforderlich. Es genügt eine klare Zustimmung nach verständlicher Information, beispielsweise im persönlichen Gespräch oder per Nachricht. AuswahlBuddy verlangt vom Nutzer nur die einmalige Sammelbestätigung für den aktuellen Upload-Vorgang.</p>
      <p>Bei Minderjährigen oder anderen Personen, die Tragweite und Folgen der Verarbeitung nicht selbst ausreichend beurteilen können, soll die Zustimmung durch eine hierzu berechtigte Person erfolgen. Eine separate Minderjährigen-Checkbox oder Altersangabe verlangt AuswahlBuddy nicht.</p>
    </>
  );
}

function EnglishBody() {
  return (
    <>
      <h1>Information on the Persons feature</h1>
      <p>The user may show or send this information to the person shown before use. No signature, form or submission of consent evidence to ShortlistBuddy is required. ShortlistBuddy requires only the adult user’s active collective confirmation for all reference photos in the current upload job.</p>
      <h2>Who provides the technical processing?</h2>
      <p>AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Germany. Privacy contact: privacy@shortlistbuddy.com. For photo and reference content selected by the user, AJ GmbH processes solely on behalf of the private user; AJ GmbH is the controller for its own technical security and contact data.</p>
      <h2>How does your photo reach ShortlistBuddy?</h2>
      <p>An adult user uses a private photo of you as a reference in order to find you in the user’s selected family or friends’ photos. The user should first explain the purpose and technical processing to you in understandable terms. A written declaration is not required.</p>
      <h2>Which data are processed?</h2>
      <p>a reduced reference photo and facial features technically derived from it;</p>
      <p>reduced previews of the private photos selected by the user;</p>
      <p>a neutral label such as “Person A”; your real name should not be sent to Google;</p>
      <p>technical job data, particularly time, job identifier and the user’s confirmation that the required agreement to use the reference photo exists;</p>
      <p>the session-only result indicating in which selected photos sufficient similarity was detected.</p>
      <h2>What is the purpose?</h2>
      <p>The data are processed solely to find you, using the reference photo, within the private photos selected by the user. ShortlistBuddy does not identify unknown persons, search public or third-party image collections, conduct surveillance, create a persistent face or person database, or infer sensitive characteristics or emotions.</p>
      <p>The private user must be authorised to use the reference photo. ShortlistBuddy relies on the user’s active collective confirmation that you—or, where necessary, a person authorised to act for you—agreed to the temporary recognition and necessary transfer. The age rule in Article 8 GDPR for online services does not apply merely because a minor appears in a photo; ShortlistBuddy itself is offered only to adult users.</p>
      <h2>Recipients and processing locations</h2>
      <p>The reduced reference and user photos are transmitted to Google Cloud EMEA Limited and its subprocessors to perform facial matching. ShortlistBuddy uses the paid Gemini Developer API. Hosting and security providers, particularly Vercel, may process connection and security data to the technically required extent. The general ShortlistBuddy Privacy Policy provides further information about recipients, international transfers and safeguards.</p>
      <p>Google or its subprocessors may process data outside the European Economic Area. Where required, transfers are based on an adequacy decision, EU Standard Contractual Clauses and supplementary safeguards. A residual risk of access by public authorities in the recipient country cannot be entirely excluded.</p>
      <h2>Retention</h2>
      <p>AJ GmbH processes the reference photo, temporary facial features and matching result only for the active analysis job and then deletes them from the application environment. No permanent face templates or reusable person profiles are created.</p>
      <p>Under Google’s current documentation, Google may retain transmitted images, inputs and responses for security and abuse monitoring for up to 55 days unless a binding shorter zero-data-retention configuration has been approved and enabled for the specific project.</p>
      <p>AJ GmbH retains only a minimised technical record of the collective confirmation, without the reference photo, name or contact details, for 30 days, unless a specific security, misuse or legal case requires longer retention.</p>
      <h2>Withdrawal and contact</h2>
      <p>You may tell the user at any time that your reference photo must not be used in future, and the user must respect that decision. You may also contact privacy@shortlistbuddy.com. This does not retrospectively invalidate completed processing; Google security logs may remain for the stated period.</p>
      <p>Send withdrawal, objection and privacy requests to: privacy@shortlistbuddy.com. The approximate time and job identifier, if known, will help us locate the relevant processing.</p>
      <h2>Your rights</h2>
      <p>Subject to the GDPR, you may have rights of access, rectification, erasure, restriction, portability and complaint to a data-protection supervisory authority. No solely automated decision producing legal or similarly significant effects within Article 22 GDPR is made.</p>
      <h2>Practical information</h2>
      <p>“I would like to use this photo of you as a reference so ShortlistBuddy can find you in my private photos. Reduced images will be temporarily processed using AI and sent to Google; Google may retain them for abuse monitoring for up to 55 days. Is that okay with you?” A clear oral or electronic agreement is sufficient; ShortlistBuddy does not require written form.</p>
      <p>No signature, form or submission of consent evidence to ShortlistBuddy is required. A clear agreement after understandable information is sufficient, for example in a personal conversation or message. ShortlistBuddy requires only the user’s single collective confirmation for the current upload job.</p>
      <p>For minors or other persons who cannot adequately understand the nature and consequences of the processing themselves, agreement should be given by a person authorised to act for them. ShortlistBuddy does not require a separate minors checkbox or age declaration.</p>
    </>
  );
}

export default async function PersonsInfoPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 flex items-center h-14">
          <Link href={`/${locale}`} className="text-lg font-bold text-indigo-600">{brandName(locale)}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 prose dark:prose-invert prose-zinc">
        {locale === 'de' ? <GermanBody /> : <EnglishBody />}
      </main>
    </div>
  );
}
