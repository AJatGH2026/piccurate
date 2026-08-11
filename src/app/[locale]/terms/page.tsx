import { setRequestLocale } from 'next-intl/server';
import { brandName } from '@/lib/brand';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';
import { BackButton } from '@/components/legal/BackButton';
import { EnglishNotice } from '@/components/legal/EnglishNotice';
import { clientConfig } from '@/lib/config';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** Framed block for the statutory withdrawal notice and the model form. */
function Statutory({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
      {children}
    </div>
  );
}

// Based on the reviewed B2C legal source (2026-07-26), restructured 2026-08-10:
// the free-beta regime was replaced by a tariff model that carries both the
// current free-only state and the later paid launch, so no further amendment
// (and no renewed consent) is needed to switch selling on. German is the
// authoritative version; English is provided for information.
//
// Corrected after the 2026-08-10 Abmahn-Test, which produced two findings that
// went to the construction rather than to the wording:
//
//   § 4.2 — the service is a digital *service* (§ 327 Abs. 2 BGB), so the
//   withdrawal right expires on **complete** performance (§ 356 Abs. 5 BGB),
//   never at its start. The old text asserted the opposite, which is the one
//   error that would have survived into a paid launch. The pro-rata Wertersatz
//   passage of Anlage 1 (§ 357a Abs. 2 BGB) belongs in the notice and is now
//   there.
//
//   § 4 / § 11 — the free plan is no longer carved out of §§ 327 ff. A contract
//   without payment is still a consumer digital contract where the consumer
//   provides personal data that is not used solely to deliver the service
//   (§ 312 Abs. 1a BGB), and our own measurement (privacy § 9.1, Art. 6 Abs. 1
//   lit. f) is exactly such a use. Rather than defend the boundary, the terms
//   now apply the same regime to both — the boundary stops mattering.
/**
 * Where the electronic withdrawal function lives, as shown inside the statutory
 * notice. Derived from the canonical base URL rather than hardcoded: the notice
 * has to keep naming a working address across a domain move, and the operating
 * entity is expected to change (see docs/product-pipeline.md §10.1). The host
 * is displayed without the scheme because that is how the Muster reads; the
 * link itself stays relative so it works on whichever host served the page.
 */
function withdrawalDisplayUrl(locale: string): string {
  const host = clientConfig.appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `${host}/${locale}/withdrawal`;
}

function GermanBody({ withdrawalUrl }: { withdrawalUrl: string }) {
  return (
    <>
      <h1>Nutzungsbedingungen</h1>
      <p>Stand: 11. August 2026</p>
      <h2>1. Anbieter und Geltungsbereich</h2>
      <p>Diese Nutzungsbedingungen gelten für die Nutzung des Fotoauswahldienstes AuswahlBuddy der AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Deutschland („AJ GmbH“, „wir“).</p>
      <p>AuswahlBuddy ist ausschließlich für persönliche, private oder familiäre Zwecke bestimmt. Eine berufliche, gewerbliche oder institutionelle Nutzung ist nicht gestattet.</p>
      <p>Die Nutzung setzt ein Mindestalter von 18 Jahren voraus. AuswahlBuddy richtet sich ausschließlich an volljährige Nutzer. Das gilt unabhängig davon, ob der kostenlose oder ein kostenpflichtiger Tarif genutzt wird, und auch dann, wenn ein gesetzlicher Vertreter zustimmen würde: Die Bedingungen des von uns eingesetzten KI-Anbieters untersagen Anwendungen, die sich an Minderjährige richten oder voraussichtlich von ihnen genutzt werden. Dein Alter bestätigst du vor der Analyse selbst; weitere Daten erheben wir dafür nicht. Fotos dürfen Minderjährige abbilden, wenn du zu deren Verarbeitung berechtigt bist.</p>
      <p>Der Dienst wird laufend weiterentwickelt. Einzelne Funktionen können hinzukommen, sich ändern oder entfallen; Abschnitt 10 regelt, in welchem Rahmen das zulässig ist.</p>
      <p>Abweichende Bedingungen des Nutzers gelten nur, wenn wir ihnen ausdrücklich in Textform zustimmen.</p>
      <h2>2. Tarife und Leistungsumfang</h2>
      <p>AuswahlBuddy wird in einem kostenlosen und in kostenpflichtigen Tarifen angeboten. Maßgeblich sind die auf der Preisseite angegebenen Fotogrenzen und Preise in ihrer zum Zeitpunkt der Bestellung geltenden Fassung.</p>
      <p>Der kostenlose Tarif umfasst einen Analysevorgang mit bis zu 250 Fotos, einmalig je Konto.</p>
      <p>Ein kostenpflichtiger Tarif berechtigt zu einem Analysevorgang bis zu der für den Tarif angegebenen Fotomenge. Es handelt sich um eine Einmalzahlung je Vorgang, nicht um ein Abonnement; eine automatische Verlängerung findet nicht statt. Nicht ausgeschöpfte Fotokontingente verfallen mit Abschluss des Vorgangs und werden nicht erstattet.</p>
      <p>Alle Preise sind Endpreise in Euro und enthalten die gesetzliche Umsatzsteuer. Weitere Kosten fallen nicht an; die Kosten deiner eigenen Internetverbindung trägst du selbst.</p>
      <p><strong>Welche Tarife jeweils buchbar sind, ergibt sich aus der Preisseite. Derzeit ist nur der kostenlose Tarif freigeschaltet.</strong></p>
      <h2>3. Vertragsschluss, Zahlung und Rechnung</h2>
      <p>Diese Nutzungsbedingungen kannst du vor jedem Vertragsschluss abrufen und speichern.</p>
      <p>Im kostenlosen Tarif kommt der Vertrag über den einzelnen Analysevorgang zustande, wenn du diesen Bedingungen zustimmst und die Analyse startest.</p>
      <p>In einem kostenpflichtigen Tarif geben wir mit der Darstellung der Tarife noch kein bindendes Angebot ab. Du gibst ein verbindliches Angebot ab, indem du im Bestelldialog die Schaltfläche mit der Beschriftung „zahlungspflichtig bestellen“ betätigst. Vor dieser Schaltfläche zeigen wir dir den gewählten Tarif, die enthaltene Fotomenge und den Gesamtpreis an. Der Vertrag kommt mit unserer Bestätigung in Textform oder mit der Freischaltung des bezahlten Vorgangs zustande, je nachdem, was zuerst eintritt.</p>
      <p>Die Zahlung wickeln wir über Stripe Payments Europe, Ltd. ab. Die Zahlungsdaten gibst du direkt bei Stripe ein; vollständige Karten- oder Kontodaten erreichen uns nicht. Der Betrag ist mit Vertragsschluss sofort fällig.</p>
      <p>Die Bestellbestätigung und die Rechnung senden wir dir in Textform an die im Konto hinterlegte E-Mail-Adresse. Ein kostenpflichtiger Vertrag setzt daher ein Konto mit bestätigter E-Mail-Adresse voraus.</p>
      <h2>4. Widerrufsrecht für Verbraucher</h2>
      <p>Verbrauchern steht das folgende gesetzliche Widerrufsrecht zu. Es gilt für kostenpflichtige Verträge und ebenso für den kostenlosen Tarif: Auch ein Vertrag ohne Geldzahlung ist ein Verbrauchervertrag über digitale Produkte, wenn du dafür personenbezogene Daten bereitstellst (§ 312 Abs. 1a BGB). Im kostenlosen Tarif fällt kein Entgelt an; ein Widerruf hat dort deshalb keine Zahlungsfolgen, und Wertersatz schuldest du ebenfalls nicht. Unabhängig vom Widerruf kannst du die Nutzung jederzeit beenden und dein Konto löschen.</p>
      <h3>4.1 Widerrufsbelehrung</h3>
      <p>Der folgende Text gibt das amtliche Muster der Anlage 1 zu Artikel 246a § 1 Absatz 2 Satz 2 EGBGB wieder. Er ist deshalb — abweichend vom übrigen Text dieser Seite — in der Sie-Form gehalten.</p>
      <Statutory>
        <p><strong>Widerrufsbelehrung</strong></p>
        <p><strong>Widerrufsrecht</strong></p>
        <p>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</p>
        <p>Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.</p>
        <p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Deutschland, Telefon: +49 155 61229658, E-Mail: contact@auswahlbuddy.de) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.</p>
        <p>Sie können Ihr Widerrufsrecht auch online unter <a href="/de/withdrawal" className="text-indigo-600 underline">{withdrawalUrl}</a> ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.</p>
        <p>Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.</p>
        <p><strong>Folgen des Widerrufs</strong></p>
        <p>Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.</p>
        <p>Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.</p>
      </Statutory>
      <h3>4.2 Vorzeitiges Erlöschen des Widerrufsrechts</h3>
      <p>AuswahlBuddy ist eine digitale Dienstleistung: Du stellst Fotos bereit, und wir verarbeiten diese Daten und liefern dir einen Auswahlvorschlag. Für Dienstleistungen erlischt das Widerrufsrecht nicht schon mit dem Beginn der Ausführung, sondern erst dann, wenn wir die Leistung <strong>vollständig erbracht</strong> haben und wir mit der Ausführung erst begonnen haben, nachdem du ausdrücklich zugestimmt hast, dass wir vor Ablauf der Widerrufsfrist beginnen, und du deine Kenntnis davon bestätigt hast, dass du dein Widerrufsrecht mit der vollständigen Vertragserfüllung verlierst (§ 356 Abs. 5 BGB). Zusätzlich stellen wir dir eine Bestätigung des Vertrags in Textform zur Verfügung; sie geht dir zusammen mit der Bestellbestätigung nach Abschnitt 3 zu.</p>
      <p>Praktisch heißt das: Die Analyse soll in aller Regel sofort starten. Deshalb bitten wir dich im Bestelldialog um die beiden genannten Erklärungen. Dein Widerrufsrecht erlischt dann in dem Moment, in dem der beauftragte Analysevorgang vollständig durchgeführt ist — nicht schon, wenn wir mit ihm beginnen.</p>
      <p>Widerrufst du, während die Analyse noch läuft, ist der Widerruf wirksam. Für den bis zum Zugang deines Widerrufs bereits erbrachten Teil der Leistung schuldest du dann anteiligen Wertersatz (§ 357a Abs. 2 BGB); den übrigen Betrag erstatten wir dir. Möchtest du auch das vermeiden, kannst du die Erklärungen weglassen. Wir beginnen die Analyse dann erst nach Ablauf der Widerrufsfrist.</p>
      <p>Im kostenlosen Tarif gibt es kein Entgelt. Dort führt ein Widerruf deshalb weder zu einer Erstattung noch zu Wertersatz, gleichgültig, wann er erklärt wird.</p>
      <h3>4.3 Muster-Widerrufsformular</h3>
      <Statutory>
        <p>(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)</p>
        <p>An AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Deutschland, Telefon: +49 155 61229658, E-Mail: contact@auswahlbuddy.de:</p>
        <p>Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung (*)</p>
        <p>— Bestellt am (*)</p>
        <p>— Name des/der Verbraucher(s)</p>
        <p>— Anschrift des/der Verbraucher(s)</p>
        <p>— Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)</p>
        <p>— Datum</p>
        <p>(*) Unzutreffendes streichen.</p>
      </Statutory>
      <h2>5. Leistungsgegenstand und KI-Hinweis</h2>
      <p>AuswahlBuddy unterstützt dich dabei, aus einer Menge privater Fotos einen Auswahlvorschlag zu erstellen. Der Dienst verwendet künstliche Intelligenz, derzeit insbesondere die bezahlte Gemini Developer API von Google.</p>
      <p>Die KI-Ausgabe ist eine automatisiert erstellte Empfehlung. Sie kann fehlerhaft, unvollständig, subjektiv oder für den vorgesehenen Zweck ungeeignet sein. AuswahlBuddy ersetzt keine menschliche Prüfung. Du musst die vorgeschlagene Auswahl prüfen, bevor du sie verwendest, weitergibst oder eigene Dateien löschst.</p>
      <p>Enthalten deine Fotos GPS-Daten, leitet die KI daraus einen Ortsnamen ab, damit du deine Auswahl nach Orten sortieren kannst. Die Koordinaten werden dafür gerundet übermittelt; Einzelheiten stehen in der Datenschutzerklärung. Ortsnamen sind eine automatisierte Zuordnung und können ungenau sein.</p>
      <p>Optional kannst du dir bekannte Personen anhand von Referenzfotos in den ausgewählten privaten Fotos wiederfinden lassen. Die Funktion ist ausschließlich für persönliche oder familiäre Zwecke bestimmt. Du musst zur Verwendung sämtlicher Referenzfotos berechtigt sein und gibst hierzu eine einmalige Sammelbestätigung für den jeweiligen Analysevorgang ab.</p>
      <p>Die Personenfunktion ist Bestandteil der kostenpflichtigen Tarife. Wir können sie zeitweise — etwa während der Erprobungsphase — oder dauerhaft auch im kostenlosen Tarif anbieten. Ein Anspruch auf künftige kostenlose Bereitstellung entsteht daraus nicht.</p>
      <h2>6. Technische Voraussetzungen und Datensicherung</h2>
      <p>Du bist für ein kompatibles Endgerät, einen aktuellen Browser, eine ausreichend stabile Internetverbindung und die sichere Aufbewahrung deiner Originaldateien verantwortlich.</p>
      <p>AuswahlBuddy ist kein Backup- oder Archivierungsdienst. Du musst vor der Analyse und vor jeder Löschung eine unabhängige Sicherungskopie deiner Originalfotos aufbewahren. Die Nutzung des Auswahlvorschlags darf nicht als automatische Löschfreigabe verstanden werden.</p>
      <p>Während eines laufenden Vorgangs — vom Hochladen über die Analyse bis zum Herunterladen der Auswahl — müssen die ausgewählten Originaldateien an ihrem Speicherort unverändert verfügbar bleiben. Werden sie zwischenzeitlich verschoben, umbenannt, gelöscht oder bearbeitet, kann der Browser sie beim Erstellen des ZIP-Archivs nicht mehr lesen. Betroffene Fotos werden dann nur in verkleinerter Vorschauauflösung oder gar nicht übernommen; AuswahlBuddy weist im Ergebnis darauf hin.</p>
      <p>Hochauflösende Originaldateien verbleiben nach der beschriebenen technischen Konzeption auf dem Endgerät. Sollte eine zukünftige Funktion hiervon abweichen, wird dies vor der Übermittlung transparent angezeigt und die Datenschutzerklärung angepasst.</p>
      <h2>7. Rechte an Fotos und erforderliche Nutzungsbefugnis</h2>
      <p>Du behältst deine Rechte an den Fotos. AJ GmbH erwirbt kein Eigentum an ihnen.</p>
      <p>Du räumst AJ GmbH für die Dauer und den Zweck des jeweiligen Analysevorgangs ein einfaches, nicht ausschließliches, nicht übertragbares und räumlich auf die technisch erforderliche Verarbeitung beschränktes Recht ein, Vorschaubilder und Metadaten zu vervielfältigen, technisch zu bearbeiten und an beauftragte Dienstleister zu übermitteln, soweit dies zur Bereitstellung des Dienstes erforderlich ist. Das Recht endet, sobald die Verarbeitung und technisch erforderliche Kurzzeitspeicherung abgeschlossen sind.</p>
      <p>Du versicherst, dass du die Fotos ausschließlich für persönliche oder familiäre Zwecke auswählst und übermittelst und dass die Nutzung keine Urheber-, Persönlichkeits- oder sonstigen Rechte Dritter verletzt. Soweit auf einem Referenzfoto eine andere Person abgebildet ist, muss diese Person oder – soweit erforderlich – eine hierzu berechtigte Person der vorübergehenden KI-gestützten Wiedererkennung und der technisch erforderlichen Übermittlung verkleinerter Bilder an Google zugestimmt haben.</p>
      <p>Für sämtliche Referenzfotos eines Analysevorgangs genügt eine einzige, nicht vorausgewählte Sammelbestätigung im Referenzfoto-Uploadfeld. Du musst weder für jede Person ein separates Kästchen markieren noch einen schriftlichen Nachweis beschaffen oder hochladen. AuswahlBuddy darf auf die Richtigkeit dieser Bestätigung vertrauen, soweit keine konkreten Anhaltspunkte für Missbrauch oder eine fehlende Berechtigung bestehen.</p>
      <p>Die Referenzfoto-Funktion darf nicht verwendet werden, wenn du weißt oder erkennen musst, dass die betroffene Person widerspricht oder die erforderliche Zustimmung nicht vorliegt. Eine einmal erklärte Ablehnung oder Rücknahme ist bei künftigen Analysevorgängen zu beachten.</p>
      <h2>8. Unzulässige Nutzung</h2>
      <p>Untersagt sind insbesondere: rechtswidrige Inhalte; Schadsoftware; automatisierte Massenabfragen; Umgehung technischer Schutzmaßnahmen; Angriffe auf den Dienst; berufliche, gewerbliche oder institutionelle Nutzung der Personenfunktion; biometrischer Abgleich ohne die erforderliche Zustimmung; Identifizierung unbekannter Personen; Suche in öffentlichen oder fremden Bildbeständen; Überwachung, Nachverfolgung, Strafverfolgungs- oder Sicherheitszwecke; Aufbau von Gesichts- oder Personendatenbanken; biometrische Kategorisierung oder Emotionserkennung; sowie jede Nutzung, die Rechte Dritter oder die Bedingungen unserer technischen Anbieter verletzt.</p>
      <p>Untersagt ist außerdem, den kostenlosen Tarif durch das wiederholte Anlegen weiterer Konten mehrfach in Anspruch zu nehmen.</p>
      <p>Bitte lade keine Ausweisdokumente, medizinischen Aufnahmen, intimen Inhalte oder sonstigen hochsensiblen Bilder hoch.</p>
      <p>Wir dürfen einen Vorgang abbrechen, Datenübertragungen blockieren oder den Zugang beschränken, wenn konkrete Anhaltspunkte für Missbrauch, Sicherheitsrisiken oder Rechtsverstöße bestehen. Soweit möglich, berücksichtigen wir dabei deine Interessen und informieren über den Grund. Brechen wir einen bereits bezahlten Vorgang ohne einen von dir zu vertretenden Grund ab, erstatten wir den gezahlten Betrag.</p>
      <h2>9. Datenschutz</h2>
      <p>Informationen zur Verarbeitung personenbezogener Daten, zu Referenzfotos, Google und der möglichen Google-Aufbewahrung bis zu 55 Tagen enthält die Datenschutzerklärung. Für die ausgewählten Foto- und Referenzinhalte verarbeitet AJ GmbH ausschließlich auf deine Weisung; für eigene Website-, Sicherheits-, Support- und Vertragsdaten ist AJ GmbH Verantwortlicher.</p>
      <p>Die nachstehenden Auftragsverarbeitungsbedingungen gelten, soweit AJ GmbH Foto- und Referenzinhalte in deinem Auftrag verarbeitet.</p>
      <p>Die Ableitung eines Ortsnamens aus GPS-Daten ist Teil des von dir beauftragten Analysevorgangs und beruht nicht auf einer gesonderten Einwilligung. Möchtest du sie nicht, entferne die GPS-Daten vor dem Hochladen aus deinen Fotos oder schalte die Standortspeicherung in deiner Kamera-App ab; Einzelheiten stehen in Abschnitt 6 der Datenschutzerklärung. Wo wir dich an anderer Stelle um eine echte Einwilligung bitten — etwa für Produkt-Updates per E-Mail —, kannst du sie verweigern und jederzeit mit Wirkung für die Zukunft widerrufen.</p>
      <p>9.1 Ergänzende Bedingungen zur Verarbeitung von Foto- und Referenzinhalten</p>
      <p>Gegenstand und Dauer: Verarbeitet werden die von dir für einen konkreten Vorgang ausgewählten Vorschaubilder, Referenzfotos, erforderlichen Metadaten und Analyseergebnisse. Die Verarbeitung beginnt mit dem Start des Vorgangs und endet nach Abschluss der Analyse und der technisch unvermeidbaren Kurzzeitspeicherung; abweichende Google-Aufbewahrungen sind in der Datenschutzerklärung beschrieben.</p>
      <p>Art und Zweck: Verkleinerung, Übermittlung, automatisierte Qualitäts- und Motivanalyse sowie – bei Nutzung der Personenfunktion – vorübergehender Gesichtsabgleich zur Wiedererkennung einer von dir bestimmten Person in den ausgewählten privaten Fotos.</p>
      <p>Daten und betroffene Personen: Bildinhalte, Gesichtsmerkmale, Aufnahmemetadaten und technische Vorgangsdaten von Nutzern sowie von Familienangehörigen, Freunden und sonstigen Personen, die auf den ausgewählten privaten Fotos abgebildet sind.</p>
      <p>Weisungen und Pflichten des Nutzers: Du erteilst die dokumentierte Weisung durch Auswahl der Fotos, Festlegung der Kriterien, Abgabe der Sammelbestätigung und Start der Analyse. Du darfst keine rechtswidrigen Weisungen erteilen und informierst AJ GmbH, wenn eine frühere Berechtigung oder Zustimmung für künftige Vorgänge entfällt.</p>
      <p>Pflichten von AJ GmbH: Wir verarbeiten Inhalte nur auf dokumentierte Weisung, verpflichten zugriffsberechtigte Personen zur Vertraulichkeit, treffen angemessene technische und organisatorische Sicherheitsmaßnahmen, unterstützen im technisch möglichen Umfang bei Datenschutzanfragen und Sicherheitsvorfällen und löschen die Inhalte nach Maßgabe dieser Bedingungen und der Datenschutzerklärung.</p>
      <p>Unterauftragsverarbeiter: Du erteilst eine allgemeine Genehmigung zum Einsatz der in der Datenschutzerklärung und einer dauerhaft abrufbaren Unterauftragsverarbeiterliste genannten Anbieter, insbesondere Google für die KI-Analyse sowie Vercel für Hosting- und Sicherheitsfunktionen. Wesentliche Änderungen werden für zukünftige Vorgänge veröffentlicht. Wer einer Änderung nicht zustimmt, darf danach keine neuen Analysevorgänge starten.</p>
      <p>Nachweise und Kontrolle: AJ GmbH stellt die gesetzlich erforderlichen Informationen zu den getroffenen Schutzmaßnahmen und eingesetzten Unterauftragsverarbeitern bereit. Individuelle Vor-Ort-Prüfungen sind nur zulässig, soweit sie gesetzlich erforderlich und nicht durch geeignete Zertifikate, Prüfberichte oder Dokumentationen ersetzbar sind.</p>
      <h2>10. Verfügbarkeit, Änderungen und Einstellung</h2>
      <p>Für den Betrieb der Website und für den kostenlosen Tarif schulden wir keine bestimmte Verfügbarkeit. Wartung, Sicherheitsmaßnahmen, Störungen von Internet-, Hosting- oder KI-Diensten sowie höhere Gewalt können zu Unterbrechungen führen.</p>
      <p>Für einen kostenpflichtig beauftragten Analysevorgang schulden wir dagegen die Durchführung genau dieses Vorgangs. Können wir ihn aus Gründen, die wir zu vertreten haben, nicht oder nicht vollständig erbringen, entfällt der Zahlungsanspruch; einen bereits gezahlten Betrag erstatten wir. Bei nur teilweiser Erbringung erstatten wir den nicht erbrachten Anteil. Weitergehende gesetzliche Rechte bleiben unberührt.</p>
      <p>Wir dürfen Funktionen ändern, wenn hierfür ein sachlicher Grund besteht, insbesondere Sicherheit, Rechtsänderungen, technische Weiterentwicklung, Anbieterwechsel oder Vermeidung von Missbrauch. Änderungen dürfen dich nicht unangemessen benachteiligen und lassen bereits bezahlte, noch nicht durchgeführte Vorgänge unberührt.</p>
      <p>Wir dürfen den Dienst oder einzelne Tarife jederzeit mit Wirkung für die Zukunft einstellen. Bereits bezahlte, noch nicht durchgeführte Vorgänge erstatten wir in diesem Fall. Bereits abgeschlossene lokale Downloads bleiben unberührt. Da kein dauerhaftes Fotoarchiv geschuldet ist, besteht kein Anspruch auf Datenmigration.</p>
      <h2>11. Vertragsmäßigkeit und Mängelrechte</h2>
      <p>Für Verträge über AuswahlBuddy gelten die gesetzlichen Vorschriften über Verträge mit Verbrauchern über digitale Produkte (§§ 327 ff. BGB). Wir wenden sie auf kostenpflichtige Verträge und auf den kostenlosen Tarif gleichermaßen an. Ob sie für den kostenlosen Tarif kraft Gesetzes gelten, hängt davon ab, wie die von dir bereitgestellten personenbezogenen Daten verwendet werden; auf diese Abgrenzung kommt es hier deshalb nicht an. Im kostenlosen Tarif richten sich deine Rechte naturgemäß auf die erneute Durchführung, nicht auf eine Erstattung.</p>
      <p>Geschuldet ist die technisch einwandfreie Durchführung des beauftragten Analysevorgangs bis zu der für den Tarif angegebenen Fotomenge und die Bereitstellung des Ergebnisses zum Herunterladen. Ein bestimmtes Auswahlergebnis, eine bestimmte Trefferquote oder die Übereinstimmung des Vorschlags mit deinem persönlichen Geschmack ist naturgemäß nicht geschuldet und stellt keine Beschaffenheitsvereinbarung dar; darauf weist Abschnitt 5 hin.</p>
      <p>Ist die Leistung mangelhaft, kannst du Nacherfüllung verlangen. Diese erfolgt in der Regel dadurch, dass wir den Analysevorgang ohne zusätzliche Kosten erneut durchführen. Schlägt die Nacherfüllung fehl, ist sie unmöglich oder verweigern wir sie, stehen dir die gesetzlichen Rechte auf Preisminderung oder Vertragsbeendigung zu.</p>
      <p>Da die Leistung in einem einmaligen Vorgang besteht und nicht dauerhaft bereitgestellt wird, besteht keine Pflicht zur dauerhaften Aktualisierung. Maßgeblich ist die Vertragsmäßigkeit im Zeitpunkt der Bereitstellung. Die gesetzlichen Verjährungsfristen bleiben unberührt.</p>
      <h2>12. Haftung</h2>
      <p>Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei schuldhafter Verletzung von Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz, bei Arglist, bei ausdrücklich übernommenen Garantien sowie in allen anderen Fällen zwingender gesetzlicher Haftung.</p>
      <p>Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht haften wir nur auf den bei Vertragsschluss vorhersehbaren, vertragstypischen Schaden. Wesentliche Vertragspflichten sind Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung du regelmäßig vertrauen darfst.</p>
      <p>Bei leicht fahrlässiger Verletzung nicht wesentlicher Vertragspflichten ist die Haftung ausgeschlossen.</p>
      <p>Soweit gesetzlich zulässig und unter Beachtung der vorstehenden Absätze haften wir nicht für Schäden, die darauf beruhen, dass du keine zumutbare Sicherungskopie deiner Originaldateien vorgehalten, den KI-Vorschlag ungeprüft übernommen oder Dateien außerhalb von AuswahlBuddy gelöscht hast. Dies gilt nicht, soweit die fehlende Datensicherung für den Schaden nicht ursächlich war oder eine Sicherung unzumutbar war.</p>
      <p>Die Haftungsbeschränkungen gelten entsprechend zugunsten unserer gesetzlichen Vertreter, Beschäftigten und Erfüllungsgehilfen.</p>
      <h2>13. Freistellung bei rechtswidrigen Nutzerinhalten</h2>
      <p>Verletzt du schuldhaft Rechte Dritter oder gesetzliche Vorschriften und werden wir deshalb von einem Dritten in Anspruch genommen, stellst du uns von berechtigten Ansprüchen und erforderlichen angemessenen Kosten der Rechtsverteidigung frei. Dies gilt nicht, soweit du die Pflichtverletzung nicht zu vertreten hast. Wir informieren dich unverzüglich und geben dir, soweit rechtlich und praktisch möglich, Gelegenheit zur Mitwirkung an der Verteidigung.</p>
      <h2>14. Anwendbares Recht und Gerichtsstand</h2>
      <p>Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Bist du Verbraucher und hast deinen gewöhnlichen Aufenthalt in einem anderen Staat, bleiben zwingende Verbraucherschutzvorschriften dieses Staates unberührt.</p>
      <p>Für Verbraucher gelten die gesetzlichen Gerichtsstände. Für Kaufleute, juristische Personen des öffentlichen Rechts und öffentlich-rechtliche Sondervermögen ist – soweit gesetzlich zulässig – Wiesbaden ausschließlicher Gerichtsstand.</p>
      <h2>15. Verbraucherstreitbeilegung</h2>
      <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      <h2>16. Vertragssprache und englische Übersetzung</h2>
      <p>Vertragssprache ist Deutsch. Die englische Fassung dient der Information. Bei Widersprüchen ist die deutsche Fassung maßgeblich, soweit dies gegenüber dem jeweiligen Nutzer rechtlich zulässig ist und zwingende Verbraucherschutzvorschriften nicht entgegenstehen.</p>
      <h2>17. Schlussbestimmungen</h2>
      <p>Sollte eine Bestimmung dieser Nutzungsbedingungen ganz oder teilweise unwirksam sein, bleiben die übrigen Bestimmungen wirksam. An die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften.</p>
      <p>Die jeweils aktuelle Fassung ist auf der Website abrufbar. Änderungen gelten nur für zukünftige Analysevorgänge, sofern nicht zwingendes Recht eine andere Behandlung verlangt.</p>
    </>
  );
}

function EnglishBody({ withdrawalUrl }: { withdrawalUrl: string }) {
  return (
    <>
      <h1>Terms of Service</h1>
      <EnglishNotice contractual />
      <p>Last updated: 11 August 2026</p>
      <h2>1. Provider and scope</h2>
      <p>These Terms govern use of the ShortlistBuddy photo-selection service provided by AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Germany (“AJ GmbH”, “we”).</p>
      <p>ShortlistBuddy is intended exclusively for personal, private or family purposes. Professional, commercial or institutional use is not permitted.</p>
      <p>Use requires a minimum age of 18. ShortlistBuddy is offered to adult users only. This applies to the free plan and to paid plans alike, and also where a legal guardian would consent: the terms of the AI provider we use prohibit applications directed at minors or likely to be used by them. You confirm your age yourself before the analysis; we collect no further data for this. Photos may depict minors where you are authorised to have them processed.</p>
      <p>The service is under continuous development. Individual functions may be added, changed or removed; section 10 governs the limits of this.</p>
      <p>Any terms of the user apply only if we expressly agree to them in text form.</p>
      <h2>2. Plans and scope of service</h2>
      <p>ShortlistBuddy is offered in a free plan and in paid plans. The photo limits and prices shown on the pricing page, as applicable at the time of your order, are decisive.</p>
      <p>The free plan covers one analysis job with up to 250 photos, once per account.</p>
      <p>A paid plan entitles you to one analysis job up to the photo limit stated for that plan. It is a one-off payment per job, not a subscription; there is no automatic renewal. Unused photo allowances expire when the job is completed and are not refunded.</p>
      <p>All prices are final prices in euros and include statutory VAT. No further costs arise; you bear the cost of your own internet connection.</p>
      <p><strong>Which plans are currently bookable is shown on the pricing page. At present only the free plan is enabled.</strong></p>
      <h2>3. Contract formation, payment and invoicing</h2>
      <p>You can access and save these Terms before every contract is formed.</p>
      <p>In the free plan, a contract for the individual analysis job is formed when you accept these Terms and start the analysis.</p>
      <p>In a paid plan, displaying the plans does not yet constitute a binding offer by us. You make a binding offer by pressing the button labelled “order with obligation to pay” in the order dialogue. Above that button we show you the selected plan, the included photo allowance and the total price. The contract is formed when we confirm it in text form or when the paid job is unlocked, whichever occurs first.</p>
      <p>Payment is processed by Stripe Payments Europe, Ltd. You enter your payment details directly with Stripe; complete card or account details do not reach us. The amount is due immediately upon formation of the contract.</p>
      <p>We send the order confirmation and the invoice in text form to the email address held in your account. A paid contract therefore requires an account with a confirmed email address.</p>
      <h2>4. Right of withdrawal for consumers</h2>
      <p>Consumers have the following statutory right of withdrawal. It applies to paid contracts and equally to the free plan: a contract without payment of money is also a consumer contract for digital products where you provide personal data in return (section 312(1a) of the German Civil Code). No fee is charged in the free plan, so a withdrawal there has no payment consequences and you owe no compensation for value either. Independently of withdrawal, you can stop using the service and delete your account at any time.</p>
      <h3>4.1 Withdrawal notice</h3>
      <p>The following reproduces the official model notice in Annex 1 to Article 246a § 1(2) sentence 2 of the Introductory Act to the German Civil Code (EGBGB). Only the German wording is legally operative.</p>
      <Statutory>
        <p><strong>Right of withdrawal</strong></p>
        <p>You have the right to withdraw from this contract within fourteen days without giving any reason. The withdrawal period is fourteen days from the day of conclusion of the contract.</p>
        <p>To exercise your right of withdrawal, you must inform us (AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Germany, telephone: +49 155 61229658, email: contact@shortlistbuddy.com) of your decision to withdraw from this contract by an unequivocal statement (for example a letter sent by post or an email). You may use the model withdrawal form below, but it is not obligatory.</p>
        <p>You may also exercise your right of withdrawal online at <a href="/en/withdrawal" className="text-indigo-600 underline">{withdrawalUrl}</a>. If you use this online function, we will send you a receipt on a durable medium (for example by email) without undue delay, containing information on the content of the withdrawal declaration and the date and time it was received.</p>
        <p>To meet the withdrawal deadline, it is sufficient for you to send your communication concerning the exercise of the right of withdrawal before the withdrawal period has expired.</p>
        <p><strong>Effects of withdrawal</strong></p>
        <p>If you withdraw from this contract, we shall reimburse to you all payments received from you without undue delay and in any event not later than fourteen days from the day on which we are informed about your decision to withdraw from this contract. We will carry out such reimbursement using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise; in any event, you will not incur any fees as a result of such reimbursement.</p>
        <p>If you requested that the services begin during the withdrawal period, you shall pay us an amount which is in proportion to what has been provided until you have communicated to us your withdrawal from this contract, in comparison with the full coverage of the contract.</p>
      </Statutory>
      <h3>4.2 Early expiry of the right of withdrawal</h3>
      <p>ShortlistBuddy is a digital service: you provide photos, and we process that data and deliver a proposed selection. For services, the right of withdrawal does not expire when performance begins, but only once we have <strong>fully performed</strong> the service, provided we began performance only after you expressly consented to us beginning before the withdrawal period expires and confirmed your knowledge that you lose your right of withdrawal upon full performance of the contract (section 356(5) of the German Civil Code). We additionally provide you with a confirmation of the contract in text form, sent together with the order confirmation under section 3.</p>
      <p>In practice: analysis is normally meant to start immediately, so we ask you for both of those declarations in the order dialogue. Your right of withdrawal then expires at the moment the commissioned analysis job has been carried out in full — not when we begin it.</p>
      <p>If you withdraw while the analysis is still running, the withdrawal is effective. For the part of the service already performed when your withdrawal reaches us, you owe proportionate compensation for value (section 357a(2) of the German Civil Code); we refund the remainder. If you prefer to avoid that too, you can omit the declarations. We will then start the analysis only after the withdrawal period has expired.</p>
      <p>No fee is charged in the free plan. A withdrawal there therefore leads neither to a refund nor to compensation for value, whenever it is declared.</p>
      <h3>4.3 Model withdrawal form</h3>
      <Statutory>
        <p>(Complete and return this form only if you wish to withdraw from the contract.)</p>
        <p>To AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Germany, telephone: +49 155 61229658, email: contact@shortlistbuddy.com:</p>
        <p>I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract for the supply of the following service (*)</p>
        <p>— Ordered on (*)</p>
        <p>— Name of consumer(s)</p>
        <p>— Address of consumer(s)</p>
        <p>— Signature of consumer(s) (only if this form is notified on paper)</p>
        <p>— Date</p>
        <p>(*) Delete as appropriate.</p>
      </Statutory>
      <h2>5. Service and AI notice</h2>
      <p>ShortlistBuddy assists you in creating a proposed selection from a set of private photos. The service uses artificial intelligence, currently including Google’s paid Gemini Developer API.</p>
      <p>The AI output is an automated recommendation. It may be incorrect, incomplete, subjective or unsuitable for the intended purpose. ShortlistBuddy does not replace human review. You must check the proposed selection before using or sharing it or deleting any files.</p>
      <p>Where your photos contain GPS data, the AI derives a place name from it so that you can sort your selection by place. The coordinates are rounded before transmission; details are in the Privacy Policy. Place names are an automated assignment and may be inaccurate.</p>
      <p>Optionally, you may find persons known to you in your selected private photos by using reference photos. The feature is intended exclusively for personal or family purposes. You must be authorised to use all reference photos and give one collective confirmation for the relevant analysis job.</p>
      <p>The Persons feature is part of the paid plans. We may offer it temporarily — for example during the trial phase — or permanently in the free plan as well. This does not create any entitlement to free provision in future.</p>
      <h2>6. Technical requirements and backups</h2>
      <p>You are responsible for a compatible device, an up-to-date browser, a sufficiently stable internet connection and safe storage of your original files.</p>
      <p>ShortlistBuddy is not a backup or archiving service. Before analysis and before deleting any file, you must retain an independent backup of all originals. A proposed selection must never be treated as an automatic deletion approval.</p>
      <p>While a job is running — from upload through analysis to downloading the selection — the selected original files must remain available and unchanged in their location. If they are moved, renamed, deleted or edited in the meantime, the browser can no longer read them when the ZIP archive is built. The affected photos are then included only as reduced previews, or not at all; ShortlistBuddy points this out in the results.</p>
      <p>Under the described architecture, high-resolution originals remain on the device. If a future feature changes this, the transfer will be clearly disclosed in advance and the Privacy Policy will be updated.</p>
      <h2>7. Rights in photos and required authority</h2>
      <p>You retain all rights in the photos. AJ GmbH does not acquire ownership.</p>
      <p>For the duration and purpose of the relevant analysis job, you grant AJ GmbH a simple, non-exclusive, non-transferable right, geographically limited to the technically required processing, to reproduce and technically process previews and metadata and transmit them to commissioned service providers where necessary to provide the service. The licence ends when processing and technically required short-term retention have ended.</p>
      <p>You represent that the photos are selected and transmitted solely for personal or family purposes and that use does not infringe copyright, personality or other third-party rights. Where a reference photo shows another person, that person—or, where necessary, a person authorised to act for them—must have agreed to the temporary AI-assisted recognition and the technically necessary transfer of reduced images to Google.</p>
      <p>One unticked collective confirmation in the reference-photo upload field is sufficient for all reference photos in an analysis job. You are not required to tick a separate box for each person or obtain or upload written evidence. ShortlistBuddy may rely on the accuracy of the confirmation unless there are specific indications of misuse or lack of authority.</p>
      <p>The reference-photo feature must not be used where you know or should know that the person objects or that the required agreement is absent. A stated refusal or withdrawal must be respected in future analysis jobs.</p>
      <h2>8. Prohibited use</h2>
      <p>Prohibited uses include illegal content; malware; automated mass requests; circumvention of technical safeguards; attacks on the service; professional, commercial or institutional use of the Persons feature; biometric matching without the required agreement; identification of unknown individuals; searching public or third-party image collections; surveillance, tracking, law-enforcement or security purposes; creation of face or person databases; biometric categorisation or emotion recognition; and any use that infringes third-party rights or the terms of our technical providers.</p>
      <p>It is also prohibited to use the free plan repeatedly by creating additional accounts.</p>
      <p>Do not upload identity documents, medical images, intimate content or other highly sensitive images.</p>
      <p>We may stop a job, block a transfer or restrict access where there are concrete indications of misuse, security risks or legal violations. Where possible, we will take your interests into account and explain the reason. If we stop a job you have already paid for without a reason attributable to you, we will refund the amount paid.</p>
      <h2>9. Data protection</h2>
      <p>The Privacy Policy explains processing of personal data, reference photos, Google and possible Google retention for up to 55 days. AJ GmbH processes selected photo and reference content solely on your instructions; AJ GmbH is the controller for its own website, security, support and contractual data.</p>
      <p>The following data-processing terms apply to the extent that AJ GmbH processes photo and reference content on your behalf.</p>
      <p>Deriving a place name from GPS data is part of the analysis job you commission and does not rest on separate consent. If you do not want it, remove the GPS data from your photos before uploading or switch off location recording in your camera app; details are in section 6 of the Privacy Policy. Where we do ask you for genuine consent — for product update emails, for example — you may refuse it and withdraw it at any time with future effect.</p>
      <p>9.1 Supplementary terms for processing photo and reference content</p>
      <p>Subject matter and duration: The selected previews, reference photos, required metadata and analysis results are processed for a specific job. Processing begins when the job starts and ends after analysis and technically unavoidable short-term retention; any different Google retention is described in the Privacy Policy.</p>
      <p>Nature and purpose: Reduction, transmission, automated quality and subject analysis and, where the Persons feature is used, temporary facial matching to recognise a person specified by you in the selected private photos.</p>
      <p>Data and data subjects: Image content, facial features, capture metadata and technical job data relating to users and to family members, friends and other persons shown in the selected private photos.</p>
      <p>Instructions and user obligations: You give documented instructions by selecting the photos, setting criteria, giving the collective confirmation and starting the analysis. You must not give unlawful instructions and must inform AJ GmbH if previous authority or agreement ceases for future jobs.</p>
      <p>AJ GmbH obligations: We process content only on documented instructions, bind authorised personnel to confidentiality, implement appropriate technical and organisational security measures, provide technically possible assistance with privacy requests and incidents, and delete content in accordance with these terms and the Privacy Policy.</p>
      <p>Subprocessors: You grant general authorisation for the providers named in the Privacy Policy and a permanently available subprocessor list, in particular Google for AI analysis and Vercel for hosting and security functions. Material changes will be published for future jobs. A user who objects must not start new analysis jobs after the change.</p>
      <p>Evidence and review: AJ GmbH will provide legally required information about safeguards and subprocessors. Individual on-site audits are permitted only where legally required and not reasonably replaceable by suitable certificates, audit reports or documentation.</p>
      <h2>10. Availability, changes and discontinuation</h2>
      <p>We do not promise a specific availability level for the operation of the website or for the free plan. Maintenance, security measures, failures of internet, hosting or AI services, and force majeure may cause interruptions.</p>
      <p>For an analysis job you have paid for, by contrast, we owe performance of precisely that job. If we cannot perform it, or cannot perform it fully, for reasons attributable to us, the payment claim lapses and we refund any amount already paid. Where performance is only partial, we refund the portion not performed. Further statutory rights remain unaffected.</p>
      <p>We may modify functions for an objective reason, including security, legal changes, technical development, provider changes or prevention of misuse. Changes must not unreasonably disadvantage you and do not affect jobs already paid for but not yet performed.</p>
      <p>We may discontinue the service or individual plans at any time for the future. In that case we refund jobs already paid for but not yet performed. Completed local downloads remain unaffected. As no permanent photo archive is owed, there is no right to data migration.</p>
      <h2>11. Conformity and remedies for defects</h2>
      <p>The statutory provisions on consumer contracts for digital products (sections 327 et seq. of the German Civil Code) apply to contracts for ShortlistBuddy. We apply them to paid contracts and to the free plan alike. Whether they apply to the free plan by operation of law depends on how the personal data you provide is used; that distinction therefore does not matter here. In the free plan your rights are naturally directed at re-running the job rather than at a refund.</p>
      <p>What we owe is the technically correct performance of the commissioned analysis job up to the photo limit stated for the plan, and provision of the result for download. A particular selection result, a particular hit rate, or agreement of the proposal with your personal taste is inherently not owed and does not constitute an agreement on quality; section 5 points this out.</p>
      <p>If the service is defective, you may demand subsequent performance. This will normally consist of us running the analysis job again at no additional cost. If subsequent performance fails, is impossible or is refused by us, you have the statutory rights to a price reduction or to terminate the contract.</p>
      <p>As the service consists of a one-off job and is not supplied on a continuous basis, there is no obligation to provide ongoing updates. Conformity at the time of supply is decisive. Statutory limitation periods remain unaffected.</p>
      <h2>12. Liability</h2>
      <p>We have unlimited liability for intent and gross negligence, culpable injury to life, body or health, liability under the German Product Liability Act, fraudulent concealment, expressly assumed guarantees and all other cases of mandatory statutory liability.</p>
      <p>For a slightly negligent breach of an essential contractual duty, liability is limited to the foreseeable loss typical for the contract at the time it was concluded. Essential duties are those whose performance is necessary for proper performance of the contract and on whose fulfilment you may regularly rely.</p>
      <p>Liability for a slightly negligent breach of non-essential duties is excluded.</p>
      <p>To the extent permitted by law and subject to the paragraphs above, we are not liable for loss caused by your failure to retain a reasonable backup, unreviewed reliance on an AI proposal or deletion of files outside ShortlistBuddy. This does not apply where the missing backup did not cause the loss or a backup was unreasonable.</p>
      <p>The limitations also apply for the benefit of our legal representatives, employees and agents.</p>
      <h2>13. Indemnity for unlawful user content</h2>
      <p>If you culpably infringe third-party rights or applicable law and a third party asserts a claim against us, you will indemnify us against justified claims and necessary reasonable defence costs. This does not apply where you are not responsible for the breach. We will promptly inform you and, where legally and practically possible, allow you to participate in the defence.</p>
      <h2>14. Governing law and jurisdiction</h2>
      <p>German law applies, excluding the UN Convention on Contracts for the International Sale of Goods. If you are a consumer habitually resident in another country, mandatory consumer-protection rules of that country remain unaffected.</p>
      <p>Statutory places of jurisdiction apply to consumers. For merchants, legal entities under public law and special funds under public law, Wiesbaden is the exclusive place of jurisdiction to the extent permitted by law.</p>
      <h2>15. Consumer dispute resolution</h2>
      <p>We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.</p>
      <h2>16. Contract language and English translation</h2>
      <p>The contract language is German. The English version is provided for information. In the event of inconsistency, the German version prevails to the extent legally permissible in relation to the relevant user and subject to mandatory consumer-protection law.</p>
      <h2>17. Final provisions</h2>
      <p>If any provision is wholly or partly invalid, the remaining provisions remain effective. Statutory law applies in place of the invalid provision.</p>
      <p>The current version is available on the website. Amendments apply only to future analysis jobs unless mandatory law requires otherwise.</p>
    </>
  );
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link href={`/${locale}`} className="text-lg font-bold text-indigo-600">{brandName(locale)}</Link>
          <BackButton locale={locale} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 text-zinc-800 dark:text-zinc-200 leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-zinc-900 dark:[&_h2]:text-zinc-100 [&_h3]:mt-6 [&_h3]:mb-1 [&_h3]:font-semibold [&_p]:mb-3 [&_p]:text-sm">
        {locale === 'de' ? (
          <GermanBody withdrawalUrl={withdrawalDisplayUrl('de')} />
        ) : (
          <EnglishBody withdrawalUrl={withdrawalDisplayUrl('en')} />
        )}
        <div className="mt-10 border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <BackButton locale={locale} />
        </div>
      </main>
    </div>
  );
}
