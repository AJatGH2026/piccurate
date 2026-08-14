import { setRequestLocale } from 'next-intl/server';
import { brandName } from '@/lib/brand';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Rewritten 2026-08-14 for the cutover to a fully local person search (see
// docs/legal/personensuche-umsetzungsplan.md). The previous version described
// a cloud architecture — reference photo transmitted to Google, AJ storing a
// confirmation record — that no longer exists. Everything the shown person
// needs to know now collapses to one point: nothing about them ever reaches
// AJ GmbH or any third party, which is why this page is much shorter than
// before. Do not restore the old wording — see the plan's GATE-2 decision
// (docs/legal/personensuche-rollenfrage-entscheidungsvorlage.md § 8) for why.
function GermanBody() {
  return (
    <>
      <h1>Hinweise zur Personensuche</h1>
      <p>Diese Information kann der Nutzer der abgebildeten Person vor der Verwendung zeigen oder zusenden. Eine Unterschrift, ein Formular oder die Übermittlung eines Nachweises an AuswahlBuddy ist nicht erforderlich.</p>
      <h2>Wer bietet die technische Verarbeitung an?</h2>
      <p>AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Deutschland. Datenschutzkontakt: privacy@auswahlbuddy.de. AJ GmbH stellt für die Personensuche ausschließlich die technische Software bereit (siehe unten) und ist an der konkreten Verarbeitung deiner Daten nicht beteiligt.</p>
      <h2>Wie funktioniert die Personensuche?</h2>
      <p>Ein volljähriger Nutzer verwendet ein privates Foto von dir als Referenz, um dich in seinen eigenen privaten Fotos wiederzufinden. Die gesamte Verarbeitung — das Erkennen deines Gesichts auf dem Referenzfoto, der Abgleich mit den durchsuchten Fotos und das Ergebnis — läuft ausschließlich auf dem Gerät des Nutzers, in dessen Browser. Dein Referenzfoto, davon abgeleitete Gesichtsmerkmale und das Ergebnis werden zu keinem Zeitpunkt an AJ GmbH, Google oder einen anderen Anbieter übermittelt.</p>
      <h2>Welche Daten werden verarbeitet, und von wem?</h2>
      <p>Verarbeitet werden ein Referenzfoto von dir und daraus technisch abgeleitete Gesichtsmerkmale (biometrische Daten im Sinne von Art. 9 Abs. 1 DSGVO), um dich in den vom Nutzer ausgewählten Fotos wiederzufinden. Diese Verarbeitung führt ausschließlich der Nutzer auf seinem eigenen Gerät durch — nicht AJ GmbH. Wir erhalten und speichern nichts davon: weder das Referenzfoto noch die daraus abgeleiteten Merkmale noch das Ergebnis.</p>
      <h2>Wer ist dafür verantwortlich?</h2>
      <p>Verarbeitet der Nutzer deine Daten im Rahmen persönlicher oder familiärer Tätigkeiten — etwa um dich in privaten Urlaubs- oder Familienfotos wiederzufinden —, ist regelmäßig allein der Nutzer selbst verantwortlich; seine Verarbeitung fällt unter die sogenannte Haushaltsausnahme (Art. 2 Abs. 2 Buchst. c DSGVO), für die die DSGVO nicht unmittelbar gilt. AJ GmbH ist an der konkreten Verarbeitung nicht beteiligt und geht davon aus, hierfür selbst nicht Verantwortliche im Sinne der DSGVO zu sein. Zu dieser konkreten technischen Konstellation gibt es bislang keine höchstrichterliche Entscheidung; wir halten diese Einordnung für gut vertretbar, nicht für abschließend geklärt.</p>
      <h2>Wofür darf die Personensuche verwendet werden?</h2>
      <p>Ausschließlich im privaten, persönlichen oder familiären Bereich — etwa um dich in Urlaubs- oder Familienfotos wiederzufinden. Unzulässig sind insbesondere: berufliche, gewerbliche oder institutionelle Nutzung, Überwachung, Sicherheits- oder Strafverfolgungszwecke, der Aufbau von Personen- oder Gesichtsdatenbanken und die Erstellung kommerzieller Personenprofile. AuswahlBuddy verlangt vom Nutzer vor der Verwendung eines Referenzfotos eine Bestätigung, dass er es in diesem Rahmen verwendet — das ist eine vertragliche Zusicherung des Nutzers uns gegenüber, keine Einwilligung nach Art. 9 DSGVO.</p>
      <h2>Wie lange werden die Daten gespeichert?</h2>
      <p>AJ GmbH speichert nichts, weil AJ GmbH nichts erhält. Wie lange dein Referenzfoto auf dem Gerät des Nutzers besteht, entscheidet allein der Nutzer.</p>
      <h2>Was kannst du tun, wenn du mit der Verwendung nicht einverstanden bist?</h2>
      <p>Sag dem Nutzer, dass er dein Foto künftig nicht mehr für die Personensuche verwenden soll; er muss das beachten. Weil AJ GmbH an der Verarbeitung nicht beteiligt ist und keine Daten dazu besitzt, können wir technisch nicht auf einen einzelnen Vorgang einwirken oder etwas für dich löschen — es gibt bei uns nichts zu löschen. Bei allgemeinen Fragen zur Funktionsweise erreichst du uns unter privacy@auswahlbuddy.de.</p>
      <h2>Praktische Information</h2>
      <p>„Ich möchte dieses Foto von dir als Referenz verwenden, damit AuswahlBuddy dich in meinen privaten Fotos wiederfindet. Das läuft komplett auf meinem Gerät ab — dein Foto wird an niemanden übermittelt oder gespeichert. Ist das für dich in Ordnung?“ Eine klare mündliche oder elektronische Zustimmung genügt; eine Unterschrift oder ein Formular ist nicht nötig.</p>
      <p>Bei Minderjährigen oder anderen Personen, die Tragweite und Folgen selbst nicht ausreichend beurteilen können, soll die Zustimmung durch eine hierzu berechtigte Person erfolgen.</p>
    </>
  );
}

function EnglishBody() {
  return (
    <>
      <h1>Information on the person search</h1>
      <p>The user may show or send this information to the person shown before use. No signature, form or submission of evidence to ShortlistBuddy is required.</p>
      <h2>Who provides the technical processing?</h2>
      <p>AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Germany. Privacy contact: privacy@shortlistbuddy.com. AJ GmbH provides only the technical software for the person search (see below) and is not involved in the specific processing of your data.</p>
      <h2>How does the person search work?</h2>
      <p>An adult user uses a private photo of you as a reference in order to find you in their own private photos. The entire process — recognising your face in the reference photo, comparing it with the photos being searched, and the result — runs exclusively on the user’s device, in their browser. Your reference photo, facial features derived from it, and the result are never transmitted to AJ GmbH, Google or any other provider.</p>
      <h2>Which data are processed, and by whom?</h2>
      <p>A reference photo of you and facial features technically derived from it (biometric data within the meaning of Article 9(1) GDPR) are processed in order to find you in the photos selected by the user. This processing is carried out exclusively by the user, on their own device — not by AJ GmbH. We do not receive or store any of it: not the reference photo, not the derived features, not the result.</p>
      <h2>Who is responsible for this?</h2>
      <p>Where the user processes your data in the course of personal or household activities — for example to find you in private holiday or family photos — that processing is regularly the user’s own responsibility alone; it falls within the so-called household exemption (Article 2(2)(c) GDPR), to which the GDPR does not directly apply. AJ GmbH is not involved in the specific processing and takes the view that it is not itself a controller under the GDPR for it. There is no supreme-court decision yet on this specific technical configuration; we consider this classification well-founded, though not conclusively settled.</p>
      <h2>What may the person search be used for?</h2>
      <p>Exclusively in a private, personal or family context — for example to find you in holiday or family photos. In particular, the following are prohibited: professional, commercial or institutional use, surveillance, security or law-enforcement purposes, building person or facial databases, and creating commercial person profiles. Before using a reference photo, ShortlistBuddy requires the user to confirm that they are using it within this scope — that is a contractual representation to us, not consent under Article 9 GDPR.</p>
      <h2>How long is the data retained?</h2>
      <p>AJ GmbH stores nothing, because AJ GmbH receives nothing. How long your reference photo exists on the user’s device is for the user alone to decide.</p>
      <h2>What can you do if you disagree with this use?</h2>
      <p>Tell the user that their photo of you must no longer be used for the person search; they must respect that. Because AJ GmbH is not involved in the processing and holds no data about it, we cannot technically act on a specific instance or delete anything for you — there is nothing on our side to delete. For general questions about how the feature works, reach us at privacy@shortlistbuddy.com.</p>
      <h2>Practical information</h2>
      <p>“I would like to use this photo of you as a reference so ShortlistBuddy can find you in my private photos. This runs entirely on my device — your photo is never transmitted to or stored by anyone. Is that okay with you?” A clear oral or electronic agreement is sufficient; no signature or form is needed.</p>
      <p>For minors or other persons who cannot adequately understand the nature and consequences of this themselves, agreement should be given by a person authorised to act for them.</p>
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
