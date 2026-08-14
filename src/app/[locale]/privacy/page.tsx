import { setRequestLocale } from 'next-intl/server';
import { brandName } from '@/lib/brand';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';
import { BackButton } from '@/components/legal/BackButton';
import { EnglishNotice } from '@/components/legal/EnglishNotice';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Generated from the reviewed B2C legal source (2026-07-26). German is the
// authoritative version; English is provided for information.
function GermanBody() {
  return (
    <>
      <h1>Datenschutzerklärung</h1>
      <p>Stand: 14. August 2026</p>
      <h2>1. Verantwortlicher</h2>
      <p>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
      <p>AJ GmbH</p>
      <p>Danziger Str. 80</p>
      <p>65191 Wiesbaden</p>
      <p>Deutschland</p>
      <p>Vertreten durch: Dr. Andreas Jahnke</p>
      <p>Datenschutzkontakt: privacy@auswahlbuddy.de</p>
      <h2>2. Geltungsbereich und Mindestalter</h2>
      <p>Diese Datenschutzerklärung gilt für die Website und den Fotoauswahldienst AuswahlBuddy. Der Dienst ist für die persönliche, private oder familiäre Fotoverwaltung bestimmt.</p>
      <p>Die Nutzung setzt ein Mindestalter von 18 Jahren voraus. Der Dienst wird ausschließlich volljährigen Nutzern angeboten — auch dort, wo Art. 8 DSGVO eine eigene Einwilligung schon ab 16 Jahren zuließe: Die Bedingungen des von uns eingesetzten KI-Anbieters untersagen Anwendungen, die sich an Minderjährige richten oder voraussichtlich von ihnen genutzt werden. Dein Alter bestätigst du selbst; wir erheben zur Altersprüfung keine weiteren Daten. Minderjährige dürfen auf privaten Fotos und Referenzfotos abgebildet sein.</p>
      <p>Der Nutzer entscheidet selbst, welche privaten Fotos und welche ihm bekannten Personen analysiert werden. AuswahlBuddy darf nicht für berufliche oder gewerbliche Zwecke, zur öffentlichen Personensuche, zur Überwachung oder zur Identifizierung unbekannter Personen verwendet werden. Für die optionale Personensuche bestätigt der Nutzer vor der Verwendung eines Referenzfotos, dass er es im privaten, persönlichen oder familiären Bereich verwenden darf; Einzelheiten und die dafür geltenden Einsatzgrenzen stehen in Abschnitt 4.3.</p>
      <h2>3. Aufruf der Website und technische Protokolldaten</h2>
      <p>Beim Aufruf der Website werden technisch erforderliche Daten verarbeitet, insbesondere IP-Adresse, Zeitpunkt, aufgerufene Adresse, HTTP-Status, übertragene Datenmenge, Referrer-Informationen, Browser-/Geräteinformationen und technische Fehlerdaten. Die Verarbeitung ist erforderlich, um die Website auszuliefern, Angriffe und Missbrauch abzuwehren und die Stabilität zu gewährleisten.</p>
      <p>Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO. Unser berechtigtes Interesse besteht im sicheren und zuverlässigen Betrieb des Dienstes. Empfänger ist insbesondere unser Hostinganbieter Vercel Inc. einschließlich seiner Unterauftragsverarbeiter.</p>
      <p>Reguläre Speicherdauer der von uns zugänglichen Hosting-/Sicherheitsprotokolle: 30 Tage. Bei Sicherheitsvorfällen können relevante Daten bis zur Aufklärung und Durchsetzung oder Abwehr von Ansprüchen länger gespeichert werden.</p>
      <h2>4. KI-gestützte Fotoauswahl</h2>
      <h3>4.1 Verarbeitete Daten und Ablauf</h3>
      {/* "verbleiben auf deinem Endgerät" was not true for every route: photos
          imported from Dropbox live in the cloud, and the policy says so
          elsewhere. The guarantee that matters is who does *not* get the
          originals — say that, and describe the storage location accurately. */}
      <p>Wenn du eine Fotoauswahl startest, wählst du Fotos auf deinem Endgerät oder in deiner verbundenen Cloud aus. AuswahlBuddy erzeugt im Browser verkleinerte JPEG-Vorschaubilder mit maximal 512 × 512 Pixeln. Hochauflösende Originaldateien werden weder an die AJ GmbH noch an unseren KI-Anbieter übertragen; sie verbleiben an dem von dir gewählten Speicherort — etwa lokal auf deinem Endgerät oder in deiner Dropbox. Die spätere Download-/ZIP-Datei wird lokal in deinem Browser erzeugt.</p>
      <p>Für die Analyse verarbeiten wir die Vorschaubilder, eine technische Vorgangskennung und – soweit für die Sortierung erforderlich – ausgewählte Metadaten wie Aufnahmedatum und Kameramodell. Die optionale Personensuche läuft davon unabhängig vollständig auf deinem Gerät; wir erhalten dabei weder Referenzfoto noch Name noch Ergebnis, und nichts davon wird an Google übermittelt — Einzelheiten in Abschnitt 4.3. Enthält ein Foto GPS-Koordinaten, übermitteln wir diese in <strong>gerundeter Form</strong> mit, damit die KI daraus einen Ortsnamen ableiten kann; Einzelheiten und der Grund für die Rundung stehen in Abschnitt 6.</p>
      <p>Die Vorschaubilder werden über unsere technische Infrastruktur an die bezahlte Gemini Developer API von Google übermittelt. Die KI bewertet Bilder anhand der vom Nutzer gewählten Kriterien und erstellt einen unverbindlichen Auswahlvorschlag. Der Nutzer kann das Ergebnis prüfen, ändern oder verwerfen.</p>
      <h3>4.2 Rollenverteilung, Zwecke und rechtlicher Rahmen</h3>
      <p>Für den Betrieb der Website, Sicherheits- und Missbrauchsprotokolle, Support, Produkt-Updates und eigene Vertragsdaten ist AJ GmbH datenschutzrechtlich Verantwortlicher. Die jeweiligen Zwecke und Rechtsgrundlagen werden in den betreffenden Abschnitten dieser Datenschutzerklärung beschrieben.</p>
      <p>Für die vom Nutzer ausgewählten Fotoinhalte, Metadaten und Analyseergebnisse verarbeitet AJ GmbH die Daten ausschließlich nach der durch den Nutzer ausgelösten Weisung und nur zur Durchführung des konkreten privaten Analysevorgangs. AJ GmbH verfolgt mit diesen Inhalten keine eigenen Zwecke, nutzt sie nicht für Werbung oder Modelltraining und ist insoweit als Auftragsverarbeiter ausgestaltet. Der Nutzer bestimmt die Fotos, die Auswahlkriterien und den privaten Zweck. Die ergänzenden Auftragsverarbeitungsbedingungen sind Bestandteil der Nutzungsbedingungen. Referenzfotos und die daraus abgeleiteten Gesichtsmerkmale für die optionale Personensuche fallen nicht unter diese Auftragsverarbeitung — AJ GmbH erhält sie nicht, siehe Abschnitt 4.3.</p>
      <p>Soweit der Nutzer Fotos ausschließlich im Rahmen persönlicher oder familiärer Tätigkeiten verarbeitet, fällt seine eigene Verarbeitung unter die Haushaltsausnahme des Art. 2 Abs. 2 Buchst. c DSGVO. Diese Ausnahme gilt nicht für AJ GmbH und die von uns eingesetzten technischen Dienstleister; wir bleiben insbesondere an die für Auftragsverarbeiter geltenden Datenschutz- und Sicherheitsanforderungen gebunden. AuswahlBuddy trifft keine ausschließlich automatisierte Entscheidung mit rechtlicher oder vergleichbar erheblicher Wirkung im Sinne von Art. 22 DSGVO.</p>
      <h3>4.3 Referenzfotos und lokale Personensuche</h3>
      <p>Die optionale Personensuche vergleicht das Gesicht auf einem Referenzfoto mit Gesichtern in den vom Nutzer ausgewählten privaten Fotos, um eine zuvor bestimmte, dem Nutzer bekannte Person wiederzufinden. Der Abgleich läuft vollständig im Browser des Nutzers ab; es findet keine Übermittlung an AJ GmbH, Google oder einen anderen Dritten statt.</p>
      <p>Referenzfoto, die daraus abgeleiteten Gesichtsmerkmale (biometrische Daten im Sinne von Art. 9 Abs. 1 DSGVO), die zu durchsuchenden Fotos und das Ergebnis des Abgleichs verlassen das Endgerät des Nutzers zu keinem Zeitpunkt. AJ GmbH erhält weder das Referenzfoto noch die daraus abgeleiteten Merkmale noch das Ergebnis und kann sie deshalb weder speichern noch auswerten noch für eigene Zwecke nutzen. Die dafür verwendete Software wird von unserer eigenen Infrastruktur ausgeliefert; nach dem Laden funktioniert der Abgleich auch ohne bestehende Internetverbindung.</p>
      <p>Weil AJ GmbH an diesem konkreten Verarbeitungsvorgang technisch nicht beteiligt ist, gehen wir davon aus, für die lokale Personensuche selbst nicht Verantwortliche im Sinne von Art. 4 Nr. 7 DSGVO zu sein; wir stellen lediglich das technische Werkzeug bereit. Zu dieser Konstellation — ein Dienst stellt eine Gesichtssuche bereit, die vollständig im Browser des privaten Nutzers abläuft und deren Daten den Anbieter nie erreichen — gibt es bislang keine höchstrichterliche Entscheidung; wir halten diese Einordnung für gut vertretbar, nicht für abschließend geklärt.</p>
      <p>Verarbeitet der Nutzer die Fotos ausschließlich im Rahmen persönlicher oder familiärer Tätigkeiten, fällt seine eigene Verarbeitung regelmäßig unter die Haushaltsausnahme des Art. 2 Abs. 2 Buchst. c DSGVO — etwa das Wiederfinden von Familienmitgliedern oder Freunden in privaten Urlaubs- oder Alltagsfotos.</p>
      <p>Die Personensuche darf ausschließlich im privaten, persönlichen oder familiären Bereich eingesetzt werden. Untersagt sind insbesondere: berufliche, gewerbliche oder institutionelle Nutzung — etwa gegenüber Arbeitgebern, Arbeitnehmern, Kunden oder Veranstaltungsteilnehmern —, Überwachung öffentlicher oder halböffentlicher Räume, Sicherheits- oder Strafverfolgungszwecke, der Aufbau von Personen- oder Gesichtsdatenbanken sowie die Erstellung kommerzieller Personenprofile. Vor der Verwendung eines Referenzfotos bestätigt der Nutzer, dass er es im privaten, persönlichen oder familiären Bereich verwenden darf. Das ist eine vertragliche Zusicherung, keine Einwilligung nach Art. 9 Abs. 2 Buchst. a DSGVO — für die rein lokale Verarbeitung halten wir eine solche nicht für erforderlich.</p>
      <p>Der Nutzer bestimmt selbst, wie streng oder großzügig die Personensuche Treffer meldet. Es können höchstens vier Referenzpersonen gleichzeitig hinterlegt werden.</p>
      <p>Ob und in welchem Umfang die Personensuche verfügbar ist, richtet sich nach den Nutzungsbedingungen. Auf die in diesem Abschnitt beschriebene Verarbeitung hat das keinen Einfluss.</p>
      <h3>4.4 Widerspruch und Anfragen abgebildeter Personen</h3>
      <p>Eine abgebildete Person kann dem Nutzer mitteilen, dass ihr Referenzfoto künftig nicht mehr für die Personensuche verwendet werden darf; der Nutzer muss diese Entscheidung beachten. Da die Verarbeitung ausschließlich lokal auf dem Gerät des Nutzers stattfindet und AJ GmbH keine Daten dazu erhält, kann sich unser Datenschutzkontakt nur allgemein zur Funktionsweise äußern — auf einen konkreten Verarbeitungsvorgang können wir mangels Zugriff nicht einwirken.</p>
      <p>Bitte lade keine Ausweisdokumente, medizinischen Aufnahmen, intimen Inhalte oder sonstigen hochsensiblen Bilder hoch. Werden solche Inhalte dennoch hochgeladen, werden sie technisch wie andere Vorschaubilder verarbeitet; eine gesonderte fachliche oder inhaltliche Auswertung ist nicht vorgesehen.</p>
      <h2>5. Google Gemini Developer API</h2>
      <p>Für die KI-Analyse setzen wir einen kostenpflichtigen Zugang zur Gemini Developer API ein. Vertragspartner für Kunden mit deutscher Rechnungsadresse ist nach den aktuellen Google-Vertragsinformationen grundsätzlich Google Cloud EMEA Limited, 70 Sir John Rogerson’s Quay, Dublin 2, Irland, sofern im konkreten Cloud-Vertrag nichts anderes vereinbart wurde.</p>
      <p>Nach den Bedingungen für Paid Services verwendet Google die übermittelten Eingaben, Dateien und Antworten nicht zur Verbesserung oder zum Training seiner Modelle. Wir aktivieren keine freiwillige Freigabe von Logs oder Datasets an Google und verwenden die Daten nicht zum Modelltraining.</p>
      <p>Maßgeblich ist der mit dem KI-Anbieter geschlossene Auftragsverarbeitungsvertrag in der zum Zeitpunkt der jeweiligen Verarbeitung geltenden Fassung. KI-Anbieter können ihre Bedingungen für die Zukunft ändern. Sollte ein Anbieter seine Bedingungen so ändern, dass die in diesem Abschnitt beschriebenen Zusagen — insbesondere der Ausschluss des Modelltrainings und die begrenzte Aufbewahrung — nicht mehr gelten, beenden wir den Einsatz dieses Anbieters, bevor die Änderung für uns wirksam wird, oder wechseln zu einem anderen Anbieter. Diese Datenschutzerklärung passen wir vorher an. Für bereits abgeschlossene Verarbeitungen bleibt die zum Verarbeitungszeitpunkt beschriebene Fassung maßgeblich.</p>
      <p>Google kann Eingaben und Ausgaben für Sicherheits-, Missbrauchserkennungs- und gesetzliche Zwecke für einen begrenzten Zeitraum aufbewahren. Nach der derzeitigen Google-Dokumentation kann diese Aufbewahrung bis zu 55 Tage betragen. Je nach eingesetzter API-Funktion können zusätzliche Speicherungen entstehen. Deshalb verwenden wir keine File API, keine dauerhaft gespeicherten Datasets und kein dauerhaftes Context Caching; bei zustandsbehafteten API-Funktionen deaktivieren wir die Speicherung, soweit dies technisch möglich ist.</p>
      <p>Google kann Daten in Ländern verarbeiten, in denen Google oder seine Unterauftragsverarbeiter Einrichtungen betreiben. Grundlage sind der einschlägige Auftragsverarbeitungsvertrag, die Standardvertragsklauseln der Europäischen Kommission und/oder ein anwendbarer Angemessenheitsbeschluss. Trotz dieser Schutzmechanismen können bei Verarbeitungen außerhalb des Europäischen Wirtschaftsraums Restrisiken bestehen, insbesondere behördliche Zugriffsrechte nach dem Recht des Empfängerstaats.</p>
      <h2>6. Ortsnamen aus GPS-Daten</h2>
      <p>Viele Kameras und Smartphones schreiben den Aufnahmeort als GPS-Koordinaten in die Bilddatei. Damit du deine Auswahl nach Orten sortieren kannst, leitet die KI aus diesen Koordinaten einen Ortsnamen ab („Lissabon, Portugal“). Der Ortsname wird in der Ergebnisübersicht angezeigt und kann als Ordnerstruktur in die Download-Datei übernommen werden.</p>
      <p>Die Ableitung erfolgt bei demselben KI-Anbieter, der ohnehin die Bildanalyse durchführt (Abschnitt 5). Wir setzen dafür <strong>keinen zusätzlichen Geokodierungsdienst</strong> und keinen weiteren Empfänger ein.</p>
      <p><strong>Die Koordinaten werden vor der Übermittlung gerundet.</strong> Wir übermitteln sie auf zwei Nachkommastellen gekürzt; das entspricht einem Raster von rund einem Kilometer. Das genügt, um einen Ort oder eine Region zu benennen, und erschwert es erheblich, daraus eine einzelne Adresse abzuleiten. Ausschließen können wir das nicht: In dünn besiedelten Gebieten oder zusammen mit dem Bildinhalt kann auch ein solches Raster auf ein bestimmtes Gebäude hindeuten. Die vollständigen Koordinaten verlassen dein Endgerät nicht — sie stehen nur in der lokal erzeugten Download-Datei, die ebenfalls auf deinem Gerät bleibt.</p>
      <p>Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. b DSGVO: die Ortszuordnung ist Teil der von dir beauftragten Auswahlleistung. Enthält ein Foto keine GPS-Daten, wird für dieses Foto nichts übermittelt und kein Ortsname gebildet. Möchtest du generell keine Ortsdaten übermitteln, entferne die GPS-Daten vor dem Hochladen aus deinen Fotos oder schalte die Standortspeicherung in deiner Kamera-App ab.</p>
      <p>Die Koordinaten werden von AJ GmbH nicht dauerhaft gespeichert. Für die Aufbewahrung beim KI-Anbieter gilt Abschnitt 5.</p>
      <h2>7. Optionaler Cloud-Import und -Export</h2>
      <p>Derzeit ist <strong>Dropbox</strong> als Cloud-Anbieter freigeschaltet, sowohl für den Import von Fotos als auch für den Export deiner Auswahl. Weitere Anbieter (etwa Microsoft OneDrive) sind vorbereitet, aber nicht aktiv; bevor wir einen davon freischalten, benennen wir ihn an dieser Stelle.</p>
      <p>Die Autorisierung erfolgt über OAuth. Wir fragen die Berechtigungen getrennt und erst dann ab, wenn du den jeweiligen Vorgang auslöst: für den <strong>Export</strong> ausschließlich das Schreibrecht, für den <strong>Import</strong> das Leserecht auf Datei- und Ordnerinformationen sowie Dateiinhalte. Damit du deine Fotos aus beliebigen Ordnern auswählen kannst, umfasst das Leserecht deinen gesamten Dropbox-Bestand und nicht nur einen App-Ordner. Wir sehen davon nur, was du im Auswahldialog tatsächlich öffnest und auswählst; wir durchsuchen deinen Bestand nicht selbständig und legen kein Verzeichnis davon an.</p>
      <p>Die Dateien fließen direkt zwischen deinem Browser und Dropbox — nicht über unsere Server. OAuth-Tokens werden nur für die Dauer des Vorgangs bzw. der Browser-Sitzung im Arbeitsspeicher verwendet und nicht dauerhaft gespeichert. Du kannst die Verbindung jederzeit in den Sicherheitseinstellungen deines Dropbox-Kontos widerrufen.</p>
      <p>Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. b DSGVO. Für die Verarbeitung in deinem Cloud-Konto gelten ergänzend die Datenschutzbedingungen des jeweiligen Cloud-Anbieters. Bitte prüfe die angezeigten Zugriffsrechte vor der Freigabe.</p>
      <h2>8. Feedback, Support und Produkt-Updates</h2>
      <p>Wenn du uns Feedback oder eine Supportanfrage sendest, verarbeiten wir deine Kontaktdaten, den Nachrichtentext und erforderliche technische Informationen, um die Anfrage zu bearbeiten und den Dienst zu verbessern. Rechtsgrundlage ist je nach Inhalt Art. 6 Abs. 1 Buchst. b oder f DSGVO. Unser berechtigtes Interesse liegt in der Bearbeitung von Anfragen und der Fehlerbehebung.</p>
      <p>Reguläre Speicherdauer für Feedback-/Supportdaten: 12 Monate nach Abschluss, sofern keine gesetzlichen Aufbewahrungspflichten oder Rechtsansprüche eine längere Speicherung erfordern.</p>
      <p>Wenn du Produkt-Updates abonnierst, verarbeiten wir deine E-Mail-Adresse auf Grundlage deiner Einwilligung nach Art. 6 Abs. 1 Buchst. a DSGVO und § 7 Abs. 2 UWG. Soweit eingesetzt, verwenden wir ein Double-Opt-in-Verfahren. Du kannst deine Einwilligung jederzeit über den Abmeldelink oder durch Nachricht an uns widerrufen. Den Nachweis der Einwilligung können wir für die Dauer gesetzlicher Verjährungsfristen speichern.</p>
      <p>Für die Speicherung von Feedback, E-Mail-Adressen und Missbrauchszählern setzen wir Upstash, Inc. ein; die Datenbank ist auf eine EU-Region beschränkt. Für den Versand von E-Mails — insbesondere Bestätigungs- und Anmelde-Mails zum Nutzerkonto sowie die Weiterleitung von Feedback an unser Postfach — setzen wir Resend, Inc. (USA) ein, das seinerseits Amazon Simple Email Service als Unterauftragsverarbeiter nutzt. Mit beiden Anbietern bestehen Auftragsverarbeitungsverträge nach Art. 28 DSGVO; für Übermittlungen in die USA dienen EU-Standardvertragsklauseln als Grundlage.</p>
      <h2>8a. Zahlungsabwicklung</h2>
      <p><strong>Derzeit ist nur der kostenlose Tarif freigeschaltet; es findet keine Zahlungsabwicklung statt.</strong> Sobald du einen kostenpflichtigen Tarif buchst, wickeln wir die Zahlung über Stripe Payments Europe, Ltd. (Irland) ab. Du gibst deine Zahlungsdaten direkt bei Stripe ein; vollständige Karten- oder Kontodaten erreichen uns nicht.</p>
      <p>Wir verarbeiten in diesem Zusammenhang die Kennung des Bezahlvorgangs, den gebuchten Tarif, den Betrag, den Zahlungsstatus und den Zeitpunkt sowie die von Stripe an uns zurückgemeldeten Rechnungsdaten. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. b DSGVO (Vertragserfüllung) und, soweit es um Rechnungs- und Buchungsunterlagen geht, Art. 6 Abs. 1 Buchst. c DSGVO in Verbindung mit den handels- und steuerrechtlichen Aufbewahrungspflichten.</p>
      <p>Stripe ist insoweit eigenständig Verantwortlicher für die Zahlungsabwicklung und die Erfüllung eigener aufsichtsrechtlicher Pflichten; es gilt ergänzend die Datenschutzerklärung von Stripe.</p>
      <h2>8b. Widerruf über die Widerrufsfunktion</h2>
      <p>Auf der Seite „Vertrag widerrufen“ kannst du deinen Widerruf elektronisch erklären. Wir verarbeiten dafür die Angaben, die § 356a Abs. 2 BGB für diese Funktion vorsieht: deinen Namen, die Bezeichnung des Vertrags oder der Bestellung, die E-Mail-Adresse für die Eingangsbestätigung sowie freiwillige Zusatzangaben, wenn du sie machst. Hinzu kommt der Zeitpunkt, zu dem deine Erklärung bei uns eingegangen ist.</p>
      <p>Zweck ist die Bearbeitung deines Widerrufs und der Nachweis, dass und wann er eingegangen ist. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. b DSGVO für die Abwicklung des Vertragsverhältnisses und Art. 6 Abs. 1 Buchst. c DSGVO für die gesetzlichen Pflichten aus §§ 355, 356a BGB — insbesondere die Pflicht, dir den Eingang unverzüglich auf einem dauerhaften Datenträger zu bestätigen.</p>
      <p>Die Eingangsbestätigung versenden wir per E-Mail über unseren Versanddienstleister Resend (siehe Abschnitt 8 und 10). Deine Angaben werden dabei an diesen Dienstleister übermittelt.</p>
      <p>Wir bewahren die Widerrufserklärung samt Eingangszeitpunkt auf, solange Ansprüche aus dem betroffenen Vertrag geltend gemacht oder abgewehrt werden können, und löschen sie danach. Anders als bei den übrigen Beta-Auswertungen kürzen wir diese Angaben nicht automatisch: Sie sind der Nachweis darüber, dass du ein gesetzliches Recht ausgeübt hast, und dieser Nachweis dient auch deinem Interesse.</p>
      <p>Du kannst deinen Widerruf ebenso formlos per E-Mail oder Brief erklären; die Funktion ist ein zusätzlicher Weg und keine Voraussetzung.</p>
      <h2>9. Cookies, lokale Speicherung und Reichweitenmessung</h2>
      <p>Wir verwenden technisch erforderliche Cookies oder ähnliche Speicherzugriffe nur, soweit sie für die von dir ausdrücklich gewünschte Funktion erforderlich sind. Rechtsgrundlage für den Zugriff auf dein Endgerät ist § 25 Abs. 2 TDDDG; die anschließende Verarbeitung personenbezogener Daten stützen wir auf Art. 6 Abs. 1 Buchst. b oder f DSGVO.</p>
      <h3>9.1 Eigene Nutzungs- und Kampagnenmessung</h3>
      <p>Um zu verstehen, an welcher Stelle der Dienst verständlich ist und wo Nutzer abbrechen, erfassen wir eigene Ereignisse — etwa den Aufruf der Startseite, den Beginn einer Fotoauswahl, den Abschluss oder Fehlschlag einer Analyse und den Download des Ergebnisses. Die Ereignisse werden ausschließlich an unseren eigenen Endpunkt auf derselben Domain gesendet und bei unserem Dienstleister Upstash in der EU gespeichert. Wir binden dafür keine Zähl-Pixel, Tags oder Skripte Dritter ein.</p>
      <p>Zu einem Ereignis speichern wir eine zufällige Sitzungskennung, Geräteklasse (Mobil, Tablet, Desktop), Betriebssystem- und Browserfamilie, die Sprachfassung, eine grobe Größenklasse der ausgewählten Fotomenge sowie — wenn du über eine von uns geschaltete Anzeige gekommen bist — die Kampagnenkennzeichen aus der aufgerufenen Adresse (die sogenannten UTM-Parameter). <strong>Nicht</strong> gespeichert werden Dateinamen, Bildinhalte, Standortdaten und E-Mail-Adressen.</p>
      <p>Für diese Messung greifen wir nicht auf dein Endgerät zu. Die Sitzungskennung besteht nur im Arbeitsspeicher deines Browsers und endet, wenn du die Seite schließt; sie wird weder in einem Cookie noch im lokalen Speicher deines Browsers abgelegt. Deshalb ist hierfür weder eine Einwilligung nach § 25 TDDDG noch ein Cookie-Banner erforderlich. Der Preis dieser Zurückhaltung ist, dass wir wiederkehrende Besucher nicht wiedererkennen — das ist beabsichtigt.</p>
      <p>Von Werbenetzwerken vergebene Klick-Kennungen (etwa <span className="font-mono">gclid</span> oder <span className="font-mono">fbclid</span>), die beim Aufruf über eine Anzeige an der Adresse hängen können, speichern wir nicht und werten wir nicht aus.</p>
      <p>Wenn du in deinem Nutzerkonto angemeldet bist, ordnen wir diese Ereignisse zusätzlich einer aus deiner Konto-Kennung abgeleiteten Pseudonymkennung zu. Nur dadurch können wir erkennen, ob der Dienst ein zweites Mal genutzt wird. Diese Zuordnung erfolgt nicht, solange du nicht angemeldet bist.</p>
      <p>Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO. Unser berechtigtes Interesse besteht darin, Verständlichkeit, technische Qualität und Wirtschaftlichkeit des Dienstes in datensparsamer Form beurteilen zu können, ohne dafür Tracking-Dienste Dritter einzusetzen. Du kannst dieser Verarbeitung nach Art. 21 DSGVO widersprechen; wende dich dazu an unseren Datenschutzkontakt. Zu den Speicherfristen siehe Abschnitt 11.</p>
      <h3>9.2 Reichweitenmessung durch Vercel</h3>
      {/* Written for the state after activation, deliberately: the reporting is
          planned and the description should not need rewriting when the switch
          is flipped. Data points taken from Vercel's own "Data point
          information" table (docs/analytics/privacy-policy), not from memory —
          note that geolocation goes down to city level, which is more than the
          earlier "aggregiert" claimed. The query string never reaches Vercel;
          see components/analytics/VercelAnalytics.tsx for why that matters. */}
      <p>Zusätzlich zur eigenen Messung nach Abschnitt 9.1 setzen wir Vercel Web Analytics ein, um Reichweite und technische Qualität der Website zu beurteilen. Der Dienst arbeitet <strong>ohne Cookies und ohne sonstigen Zugriff auf dein Endgerät</strong>; es werden keine geräte- oder websiteübergreifenden Nutzerprofile gebildet.</p>
      <p>Erhoben werden dabei nach Angaben des Anbieters: Zeitpunkt des Aufrufs, aufgerufene Adresse und Seitenmuster, die verweisende Seite, Kampagnenparameter, eine aus der Anfrage abgeleitete ungefähre Ortsangabe (Land, Region, Ort), Betriebssystem, Browser und Gerätetyp jeweils mit Version sowie die Version des Messskripts.</p>
      <p>Zur Unterscheidung von Aufrufen bildet Vercel eine Prüfsumme aus der eingehenden Anfrage — also kein auf deinem Gerät gespeicherter Wiedererkennungswert. Diese Prüfsumme wird nach Angaben des Anbieters spätestens nach 24 Stunden verworfen; danach verbleiben nur aggregierte Auswertungen.</p>
      <p><strong>Adresszusätze übermitteln wir nicht.</strong> Vor dem Versand entfernen wir sämtliche Abfrageparameter mit Ausnahme der Kampagnenkennungen (utm_*), und Aufrufe unseres Verwaltungsbereichs werden gar nicht gemeldet. Damit erreichen weder Zahlungs- oder Auftragskennungen noch Zugangsschlüssel den Dienst.</p>
      <p>Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO. Unser berechtigtes Interesse besteht darin, Nutzung und technische Qualität des Dienstes in datensparsamer Form zu verstehen. Da kein Zugriff auf dein Endgerät stattfindet, ist eine Einwilligung nach § 25 TDDDG nicht erforderlich. Empfänger ist Vercel Inc.; zur Drittlandübermittlung siehe Abschnitt 10. Du kannst dieser Verarbeitung nach Art. 21 DSGVO widersprechen.</p>
      <h3>9.3 Keine Statistik- und Marketingdienste Dritter</h3>
      <p>Google Analytics, Google Ads, Meta-Pixel und andere nicht erforderliche Statistik- oder Marketingdienste sind nicht aktiv. Wir haben uns bewusst dagegen entschieden, sie für die Auswertung unserer Anzeigenkampagnen einzusetzen, und werten diese stattdessen über die in Abschnitt 9.1 beschriebene eigene Messung aus. Sollten wir solche Dienste später einsetzen, werden sie erst nach deiner freiwilligen Einwilligung aktiviert und diese Datenschutzerklärung wird vorab aktualisiert.</p>
      <h2>10. Empfänger und Auftragsverarbeiter</h2>
      <p>Je nach Nutzung können insbesondere folgende Empfänger Daten verarbeiten:</p>
      <p>Google Cloud EMEA Limited und Google-Unterauftragsverarbeiter – KI-Analyse über die bezahlte Gemini Developer API;</p>
      <p>Vercel Inc. und Unterauftragsverarbeiter – Hosting, Auslieferung, Sicherheitsprotokolle und cookielose Reichweitenmessung (Abschnitt 9.2);</p>
      <p>Upstash, Inc. und Unterauftragsverarbeiter – Feedback, Update-Anmeldungen, Missbrauchszähler und die Ereignisse der eigenen Nutzungsmessung nach Abschnitt 9.1, in der EU-Region;</p>
      <p>Supabase, Inc. und Unterauftragsverarbeiter – Konten, Authentifizierung und Vorgangsdaten (siehe Abschnitt 15);</p>
      <p>Resend, Inc. und Amazon Web Services – Versand von Konto- und Feedback-E-Mails;</p>
      <p>Stripe Payments Europe, Ltd. – Zahlungsabwicklung, sobald du einen kostenpflichtigen Tarif buchst (siehe Abschnitt 8a);</p>
      <p>Dropbox – nur wenn du den Cloud-Import oder -Export nutzt; weitere Cloud-Anbieter derzeit nicht aktiv;</p>
      <p>IT-, Sicherheits-, Rechts- oder Behördenstellen, soweit dies zur Erfüllung gesetzlicher Pflichten oder zur Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen erforderlich ist.</p>
      <p>Mit Auftragsverarbeitern schließen wir Verträge nach Art. 28 DSGVO. Bei Drittlandtransfers verwenden wir, soweit erforderlich, Angemessenheitsbeschlüsse, EU-Standardvertragsklauseln und ergänzende Schutzmaßnahmen.</p>
      <h2>11. Speicherdauer</h2>
      <p>Hochauflösende Originalfotos: keine Übermittlung an Google und keine Speicherung durch AJ GmbH;</p>
      <p>Vorschaubilder bei AJ GmbH: keine dauerhafte Speicherung in einer Anwendungsdatenbank; Verarbeitung nur für die Dauer des Vorgangs und technisch unvermeidbare Kurzzeitspeicherung;</p>
      <p>Referenzfotos, daraus abgeleitete Gesichtsmerkmale und Zuordnungsergebnisse der Personensuche (Abschnitt 4.3): verlassen das Endgerät des Nutzers nie; AJ GmbH erhält und speichert sie nicht;</p>
      <p>Vorschaubilder und Antworten bei Google (allgemeine Fotoanalyse, Abschnitt 5): nach aktueller Dokumentation für Sicherheits-/Missbrauchszwecke bis zu 55 Tage, sofern keine kürzere Zero-Data-Retention-Konfiguration verbindlich greift;</p>
      <p>Hosting-/Sicherheitslogs: 30 Tage, siehe Abschnitt 3;</p>
      <p>Feedback/Support und Update-Anmeldungen: gemäß Abschnitt 8;</p>
      <p>Gerundete GPS-Koordinaten zur Ortsbestimmung: keine Speicherung bei AJ GmbH; beim KI-Anbieter gelten dieselben Fristen wie für die Vorschaubilder;</p>
      <p>Ereignisse der eigenen Nutzungsmessung nach Abschnitt 9.1: 90 Tage in der Einzelform, danach ausschließlich in aggregierter Form ohne Sitzungs- oder Kontobezug;</p>
      <p>Zahlungs- und Rechnungsdaten nach Abschnitt 8a: für die Dauer der handels- und steuerrechtlichen Aufbewahrungsfristen, in der Regel bis zu zehn Jahre;</p>
      <p>Bestätigung der Nutzungsbefugnis für Referenzfotos (Abschnitt 4.3): rein clientseitig; wird nicht an AJ GmbH übermittelt und von AJ GmbH nicht gespeichert;</p>
      <p>Einwilligungsnachweis für Produkt-Updates und sonstige rechtlich erhebliche Nachweise: für die Dauer der einschlägigen gesetzlichen Nachweis- und Verjährungsfristen.</p>
      <h2>12. Datensicherheit</h2>
      <p>Wir treffen technische und organisatorische Maßnahmen, die dem Risiko der Verarbeitung angemessen sind. Dazu gehören insbesondere verschlüsselte Übertragung, Zugriffsbeschränkungen, getrennte Schlüssel- und Rechteverwaltung, Datenminimierung, Missbrauchsbegrenzung, Protokollierung sicherheitsrelevanter Ereignisse und regelmäßige Überprüfung der eingesetzten Dienstleister. Ein absoluter Schutz bei der Datenübertragung oder Speicherung kann jedoch nicht garantiert werden.</p>
      <h2>13. Deine Rechte</h2>
      <p>Nach Maßgabe der gesetzlichen Voraussetzungen hast du insbesondere das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Erteilte Einwilligungen kannst du jederzeit mit Wirkung für die Zukunft widerrufen. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt unberührt.</p>
      <p>Bitte richte Anfragen an den unter Abschnitt 1 genannten Datenschutzkontakt. Da wir Fotos nicht dauerhaft speichern und regelmäßig keine Identitätsdaten zu einem einzelnen Analysevorgang vorhalten, können wir zur Zuordnung einer Anfrage zusätzliche Angaben zum Zeitpunkt und Ablauf des Vorgangs benötigen. Wir werden keine zusätzlichen Daten allein zum Zweck der Identifizierung speichern, wenn dies nicht erforderlich ist.</p>
      <p>Du hast außerdem das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren. Für AJ GmbH ist regelmäßig zuständig:</p>
      <p>Der Hessische Beauftragte für Datenschutz und Informationsfreiheit</p>
      <p>Wilhelmstraße 7</p>
      <p>65185 Wiesbaden</p>
      <p>Deutschland</p>
      <h2>14. Widerspruch gegen Verarbeitungen nach Art. 6 Abs. 1 Buchst. f DSGVO</h2>
      <p>Du kannst aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit gegen Verarbeitungen Widerspruch einlegen, die wir auf Art. 6 Abs. 1 Buchst. f DSGVO stützen. Wir verarbeiten die betreffenden Daten dann nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe nachweisen, die deine Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.</p>
      <h2>15. Konto und Nutzerregistrierung</h2>
      {/* Not "Einwilligung in die Datenschutzerklärung": nobody consents to a
          privacy policy — it informs under Art. 13. Terms are accepted, not
          consented to in the data-protection sense, and mixing the two blurs
          the one thing a real Art. 6(1)(a) consent must stay: separate,
          specific and revocable. What we actually record is an acceptance and
          an acknowledgement. */}
      <p>Wenn du ein Nutzerkonto erstellst, verarbeiten wir deine E-Mail-Adresse, dein verschlüsseltes Passwort, die gewählte Sprache (Spracheinstellung) sowie Zeitpunkt und Nachweis der Annahme der Nutzungsbedingungen und der Kenntnisnahme dieser Datenschutzhinweise. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. b DSGVO (Vertragserfüllung).</p>
      <h3>15.1 Konto beim Start einer Analyse</h3>
      <p>Jede Analyse läuft technisch gegen einen benannten Vorgang, damit Fotomengen, Kontingente und Ergebnisse eindeutig zugeordnet werden können. Für eine Analyse ist ein <strong>Konto mit bestätigter E-Mail-Adresse</strong> erforderlich — auch im kostenlosen Tarif. Grund dafür ist die gesetzlich vorgeschriebene Bestätigung des Vertrags in Textform (§ 312f BGB): Ohne eine Adresse könnten wir sie dir nicht zusenden.</p>
      <p>Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. b DSGVO; ohne diese Zuordnung lässt sich der von dir angestoßene Vorgang nicht durchführen. Aus der früheren offenen Beta-Phase können noch <strong>anonyme Konten</strong> ohne Kontaktdaten bestehen; sie erlauben keine Anmeldung von einem anderen Gerät. Diese Konten und die zugehörigen Vorgangsdaten löschen wir turnusmäßig, spätestens 90 Tage nach dem letzten Vorgang.</p>
      <h3>15.2 Konto und Nutzungsmessung</h3>
      <p>Bist du angemeldet, ordnen wir die Ereignisse aus Abschnitt 9.1 einer aus deiner Konto-Kennung abgeleiteten Pseudonymkennung zu. Wir bilden daraus keine Profile über einzelne Nutzer, sondern werten ausschließlich aus, wie häufig der Dienst insgesamt ein zweites Mal genutzt wird.</p>
      <p>Wir setzen Supabase (Supabase Inc., 970 Trestle Glen Rd, Oakland, CA 94610, USA) als Auftragsverarbeiter für Authentifizierung und Profildatenspeicherung ein. Supabase hostet die Daten auf Servern in der EU-Region Frankfurt (AWS eu-central-1). Mit Supabase besteht ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO; für Übermittlungen in die USA dienen EU-Standardvertragsklauseln als Grundlage.</p>
      <p>Deine Kontodaten werden gespeichert, solange das Konto besteht. Du kannst dein Konto jederzeit löschen; nach Löschung werden deine Daten innerhalb von 30 Tagen endgültig entfernt. Dein Auskunfts-, Berichtigungs- und Löschungsrecht kannst du jederzeit über unseren Datenschutzkontakt ausüben.</p>
      <h2>16. Änderungen dieser Datenschutzerklärung</h2>
      <p>Wir aktualisieren diese Datenschutzerklärung, wenn sich Funktionen, Dienstleister oder Rechtslage ändern. Maßgeblich ist die jeweils auf der Website veröffentlichte Fassung. Wesentliche Änderungen, die eine neue Einwilligung erfordern, setzen wir nicht ohne diese Einwilligung um.</p>
    </>
  );
}

function EnglishBody() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <EnglishNotice />
      <p>Last updated: 14 August 2026</p>
      <h2>1. Controller</h2>
      <p>The controller within the meaning of the General Data Protection Regulation (GDPR) is:</p>
      <p>AJ GmbH</p>
      <p>Danziger Str. 80</p>
      <p>65191 Wiesbaden</p>
      <p>Germany</p>
      <p>Represented by: Dr Andreas Jahnke</p>
      <p>Privacy contact: privacy@shortlistbuddy.com</p>
      <h2>2. Scope and minimum age</h2>
      <p>This Privacy Policy applies to the website and the ShortlistBuddy photo-selection service. The service is intended for personal, private or family photo management.</p>
      <p>Use requires a minimum age of 18. The service is offered to adult users only — including where Article 8 GDPR would already allow a person to consent for themselves from the age of 16: the terms of the AI provider we use prohibit applications directed at minors or likely to be used by them. You confirm your age yourself; we collect no further data for age verification. Minors may appear in private photos and reference photos.</p>
      <p>The user decides which private photos and which known persons are analysed. ShortlistBuddy must not be used for professional or commercial purposes, public person searches, surveillance or identification of unknown persons. For the optional Persons feature, before using a reference photo the user confirms that they are authorised to use it in a private, personal or family context; details and the applicable limits are in section 4.3.</p>
      <h2>3. Website access and technical log data</h2>
      <p>When the website is accessed, technically necessary data is processed, in particular the IP address, time, requested URL, HTTP status, data volume, referrer information, browser/device information and technical error data. This processing is necessary to deliver the website, prevent attacks and misuse, and maintain stability.</p>
      <p>The legal basis is Article 6(1)(f) GDPR. Our legitimate interest is the secure and reliable operation of the service. Recipients include our hosting provider Vercel Inc. and its subprocessors.</p>
      <p>Regular retention period for hosting/security logs accessible to us: 30 days. Relevant data may be retained for longer where necessary to investigate security incidents or establish, exercise or defend legal claims.</p>
      <h2>4. AI-assisted photo selection</h2>
      <h3>4.1 Data processed and workflow</h3>
      <p>When you start a photo-selection job, you select photos on your device or in your connected cloud. ShortlistBuddy creates reduced JPEG previews in your browser with a maximum size of 512 × 512 pixels. High-resolution originals are transferred neither to AJ GmbH nor to our AI provider; they stay wherever you keep them — locally on your device or in your Dropbox, for example. The later download/ZIP file is created locally in your browser.</p>
      <p>For the analysis, we process the previews, a technical job identifier and, where required for sorting, selected metadata such as capture date and camera model. The optional Persons feature runs independently of this, entirely on your device; we receive neither the reference photo, nor a name, nor a result from it, and none of it is transmitted to Google — see section 4.3 for details. Where a photo contains GPS coordinates, we send them along in <strong>rounded form</strong> so the AI can derive a place name from them; details and the reason for the rounding are in section 6.</p>
      <p>The previews are transmitted through our technical infrastructure to Google’s paid Gemini Developer API. The AI evaluates the images against criteria selected by the user and creates a non-binding proposed selection. The user can review, modify or reject the result.</p>
      <h3>4.2 Roles, purposes and legal framework</h3>
      <p>AJ GmbH is the controller for website operation, security and abuse logs, support, product updates and its own contractual data. The relevant purposes and legal bases are described in the respective sections of this Privacy Policy.</p>
      <p>For the photo content selected by the user, metadata and analysis results, AJ GmbH processes the data solely on the instruction triggered by the user and only to perform the specific private analysis job. AJ GmbH does not pursue its own purposes with this content, does not use it for advertising or model training and is structured as a processor in this respect. The user determines the photos, selection criteria and private purpose. The supplementary processing terms form part of the Terms of Use. Reference photos and the facial features derived from them for the optional Persons feature are not covered by this processing arrangement — AJ GmbH never receives them, see section 4.3.</p>
      <p>Where the user processes photos solely in the course of personal or household activities, the user’s own processing falls within the household exemption in Article 2(2)(c) GDPR. This exemption does not apply to AJ GmbH or the technical providers we use; we remain subject in particular to the data-protection and security obligations applicable to processors. ShortlistBuddy does not make solely automated decisions producing legal or similarly significant effects within Article 22 GDPR.</p>
      <h3>4.3 Reference photos and local person search</h3>
      <p>The optional Persons feature compares the face in a reference photo with faces in the private photos selected by the user, in order to find a previously specified person known to the user. This matching runs entirely in the user’s browser; no transfer to AJ GmbH, Google or any other third party takes place.</p>
      <p>The reference photo, the facial features derived from it (biometric data within the meaning of Article 9(1) GDPR), the photos being searched and the matching result never leave the user’s device. AJ GmbH receives neither the reference photo nor the derived features nor the result, and can therefore neither store, evaluate nor use them for its own purposes. The software used for this is served from our own infrastructure; once loaded, matching also works without an active internet connection.</p>
      <p>Because AJ GmbH is not technically involved in this specific processing operation, we take the view that we are not a controller within the meaning of Article 4(7) GDPR for the local person search itself; we merely provide the technical tool. There is no supreme-court decision yet on this specific configuration — a service providing a face-search feature that runs entirely in the private user’s browser and whose data never reaches the provider — and we consider this classification well-founded, though not conclusively settled.</p>
      <p>Where the user processes photos solely in the course of personal or household activities, the user’s own processing regularly falls within the household exemption in Article 2(2)(c) GDPR — for example, finding family members or friends in private holiday or everyday photos.</p>
      <p>The Persons feature may be used only in a private, personal or family context. In particular, the following are prohibited: professional, commercial or institutional use — for example towards employers, employees, customers or event attendees —, surveillance of public or semi-public spaces, security or law-enforcement purposes, building person or facial databases, and creating commercial person profiles. Before using a reference photo, the user confirms that they are authorised to use it in a private, personal or family context. This is a contractual representation, not consent under Article 9(2)(a) GDPR — we do not consider such consent necessary for purely local processing.</p>
      <p>The user decides how strict or lenient the person search is in reporting matches. At most four reference persons can be stored at the same time.</p>
      <p>Whether and to what extent the Persons feature is available is governed by the Terms of Use. This has no effect on the processing described in this section.</p>
      <h3>4.4 Objection and requests from persons shown</h3>
      <p>A person shown may tell the user that their reference photo must no longer be used for the person search; the user must respect that decision. Because processing takes place exclusively on the user’s own device and AJ GmbH receives no data about it, our privacy contact can only speak to how the feature works in general — we cannot act on a specific processing operation, as we have no access to it.</p>
      <p>Do not upload identity documents, medical images, intimate content or other highly sensitive images. If such content is nevertheless uploaded, it is technically processed like any other preview; no separate professional or substantive analysis is intended.</p>
      <h2>5. Google Gemini Developer API</h2>
      <p>We use a paid Gemini Developer API account for AI analysis. According to Google’s current contracting-entity information, the contracting entity for customers with a German billing address is generally Google Cloud EMEA Limited, 70 Sir John Rogerson’s Quay, Dublin 2, Ireland, unless the specific cloud agreement states otherwise.</p>
      <p>Under the Paid Services terms, Google does not use submitted inputs, files or responses to improve or train its models. We do not enable voluntary sharing of logs or datasets with Google and do not use the data for model training.</p>
      <p>What governs is the data processing agreement concluded with the AI provider, in the version applicable at the time of the relevant processing. AI providers may change their terms for the future. Should a provider change its terms such that the commitments described in this section — in particular the exclusion of model training and the limited retention — no longer apply, we will discontinue that provider before the change takes effect for us, or switch to another provider. We will update this Privacy Policy beforehand. For processing already completed, the version described at the time of processing remains decisive.</p>
      <p>Google may retain inputs and outputs for security, abuse-detection and legal purposes for a limited period. Google’s current documentation states that this may be up to 55 days. Additional retention may arise depending on the API features used. We therefore do not use the File API, permanently stored datasets or persistent context caching, and disable storage for stateful API features where technically possible.</p>
      <p>Google may process data in countries where Google or its subprocessors maintain facilities. The relevant data processing agreement, European Commission Standard Contractual Clauses and/or an applicable adequacy decision provide the transfer basis. Residual risks may remain for processing outside the European Economic Area, particularly statutory access powers in the recipient country.</p>
      <h2>6. Place names from GPS data</h2>
      <p>Many cameras and smartphones write the location of capture into the image file as GPS coordinates. So that you can sort your selection by place, the AI derives a place name from those coordinates (“Lisbon, Portugal”). The place name is shown in the results overview and can be used as the folder structure in the download file.</p>
      <p>This is done by the same AI provider that performs the image analysis anyway (section 5). We use <strong>no additional geocoding service</strong> and no further recipient for it.</p>
      <p><strong>Coordinates are rounded before transmission.</strong> We send them truncated to two decimal places, which corresponds to a grid of roughly one kilometre. That is enough to name a town or region, and it makes deriving a single address considerably harder. We cannot rule it out: in sparsely populated areas, or combined with the image content, even such a grid may point to a particular building. The full coordinates never leave your device — they appear only in the locally generated download file, which also stays on your device.</p>
      <p>The legal basis is Article 6(1)(b) GDPR: assigning places is part of the selection service you commissioned. If a photo contains no GPS data, nothing is transmitted for that photo and no place name is formed. If you would rather not transmit location data at all, remove the GPS data from your photos before uploading or switch off location recording in your camera app.</p>
      <p>AJ GmbH does not permanently store the coordinates. Retention at the AI provider is governed by section 5.</p>
      <h2>7. Optional cloud import and export</h2>
      <p><strong>Dropbox</strong> is currently enabled as a cloud provider, both for importing photos and for exporting your selection. Other providers (such as Microsoft OneDrive) are prepared but not active; before enabling any of them we will name it at this point.</p>
      <p>Authorisation is performed via OAuth. We request permissions separately and only when you trigger the relevant operation: for <strong>export</strong>, the write permission only; for <strong>import</strong>, read permission for file and folder information and for file content. So that you can pick your photos from any folder, the read permission covers your entire Dropbox rather than just an app folder. We see only what you actually open and select in the picker; we do not search your storage on our own initiative and do not build an index of it.</p>
      <p>Files flow directly between your browser and Dropbox — not through our servers. OAuth tokens are held in memory only for the duration of the transaction or browser session and are not stored permanently. You can revoke the connection at any time in the security settings of your Dropbox account.</p>
      <p>The legal basis is Article 6(1)(b) GDPR. The privacy terms of the relevant cloud provider also apply to processing within your cloud account. Review the displayed permissions before granting access.</p>
      <h2>8. Feedback, support and product updates</h2>
      <p>If you send feedback or a support request, we process your contact details, message and necessary technical information to handle the request and improve the service. Depending on the content, the legal basis is Article 6(1)(b) or (f) GDPR. Our legitimate interest is handling requests and correcting errors.</p>
      <p>Regular retention period for feedback/support data: 12 months after closure, unless statutory retention duties or legal claims require longer storage.</p>
      <p>If you subscribe to product updates, we process your email address based on your consent under Article 6(1)(a) GDPR and section 7(2) of the German Unfair Competition Act. Where used, we apply a double-opt-in procedure. You may withdraw consent at any time through the unsubscribe link or by contacting us. Evidence of consent may be retained for statutory limitation periods.</p>
      <p>We use Upstash, Inc. to store feedback, email addresses and abuse-prevention counters; the database is restricted to an EU region. To send emails — in particular account confirmation and sign-in emails and the forwarding of feedback to our inbox — we use Resend, Inc. (USA), which in turn uses Amazon Simple Email Service as a subprocessor. We have concluded Article 28 GDPR processing agreements with both providers; EU Standard Contractual Clauses provide the basis for transfers to the USA.</p>
      <h2>8a. Payment processing</h2>
      <p><strong>At present only the free plan is enabled; no payment processing takes place.</strong> Once you book a paid plan, we process the payment through Stripe Payments Europe, Ltd. (Ireland). You enter your payment details directly with Stripe; complete card or account details do not reach us.</p>
      <p>In this context we process the payment reference, the plan booked, the amount, the payment status and the time, together with the invoice data Stripe reports back to us. The legal basis is Article 6(1)(b) GDPR (performance of contract) and, as regards invoices and accounting records, Article 6(1)(c) GDPR in conjunction with commercial and tax retention obligations.</p>
      <p>Stripe acts as an independent controller for the payment transaction and for meeting its own regulatory obligations; Stripe’s privacy policy applies in addition.</p>
      <h2>8b. Withdrawal via the withdrawal function</h2>
      <p>On the “Withdraw from contract” page you can declare your withdrawal electronically. For this we process the details section 356a(2) of the German Civil Code provides for that function: your name, the identifier of the contract or order, the email address for the acknowledgement of receipt, and any voluntary additional information you choose to give. We also record the time at which your declaration reached us.</p>
      <p>The purpose is to handle your withdrawal and to evidence that and when it was received. The legal basis is Article 6(1)(b) GDPR for performing the contractual relationship and Article 6(1)(c) GDPR for the statutory duties under sections 355 and 356a of the German Civil Code — in particular the duty to confirm receipt to you without undue delay on a durable medium.</p>
      <p>We send the acknowledgement by email through our delivery provider Resend (see sections 8 and 10). Your details are transmitted to that provider for this purpose.</p>
      <p>We keep the withdrawal declaration together with its time of receipt for as long as claims arising from the contract concerned can be brought or defended, and delete it afterwards. Unlike our other beta records, these entries are not trimmed automatically: they evidence that you exercised a statutory right, and that evidence serves your interest too.</p>
      <p>You may equally declare your withdrawal informally by email or letter; the function is an additional route, not a precondition.</p>
      <h2>9. Cookies, local storage and audience measurement</h2>
      <p>We use technically necessary cookies or similar storage access only where required for a function expressly requested by you. The legal basis for access to your terminal equipment is section 25(2) TDDDG; subsequent processing of personal data is based on Article 6(1)(b) or (f) GDPR.</p>
      <h3>9.1 Our own usage and campaign measurement</h3>
      <p>To understand where the service is intelligible and where users drop out, we record our own events — for example opening the home page, starting a photo selection, completion or failure of an analysis, and downloading the result. The events are sent exclusively to our own endpoint on the same domain and stored with our provider Upstash in the EU. We do not embed any third-party counting pixels, tags or scripts for this.</p>
      <p>With an event we store a random session identifier, the device class (mobile, tablet, desktop), operating-system and browser family, the language version, a coarse size band for the number of photos selected, and — if you arrived through an advertisement we placed — the campaign markers contained in the address you called up (the so-called UTM parameters). We do <strong>not</strong> store file names, image content, location data or email addresses.</p>
      <p>This measurement does not access your terminal equipment. The session identifier exists only in your browser’s memory and ends when you close the page; it is stored neither in a cookie nor in your browser’s local storage. No consent under section 25 TDDDG and no cookie banner is therefore required. The price of this restraint is that we cannot recognise returning visitors — which is intended.</p>
      <p>Click identifiers assigned by advertising networks (such as <span className="font-mono">gclid</span> or <span className="font-mono">fbclid</span>), which may be attached to the address when you arrive through an advertisement, are neither stored nor evaluated by us.</p>
      <p>If you are signed in to your user account, we additionally associate these events with a pseudonymous identifier derived from your account identifier. This is the only way for us to see whether the service is used a second time. No such association is made while you are not signed in.</p>
      <p>The legal basis is Article 6(1)(f) GDPR. Our legitimate interest is being able to assess the intelligibility, technical quality and economics of the service in a data-minimising way without using third-party tracking services. You may object to this processing under Article 21 GDPR; please contact our privacy contact. For retention periods see section 11.</p>
      <h3>9.2 Audience measurement by Vercel</h3>
      <p>In addition to our own measurement under section 9.1, we use Vercel Web Analytics to assess reach and the technical quality of the website. The service works <strong>without cookies and without any other access to your device</strong>; no cross-device or cross-site user profiles are created.</p>
      <p>According to the provider, the following is collected: time of the request, the address and page pattern requested, the referring page, campaign parameters, an approximate location derived from the request (country, region, city), operating system, browser and device type each with version, and the version of the measurement script.</p>
      <p>To distinguish requests, Vercel derives a hash from the incoming request — not a recognition value stored on your device. According to the provider that hash is discarded after 24 hours at the latest; only aggregated reports remain afterwards.</p>
      <p><strong>We do not transmit query strings.</strong> Before sending, we remove all query parameters except the campaign identifiers (utm_*), and requests to our administrative area are not reported at all. Neither payment or job identifiers nor access keys therefore reach the service.</p>
      <p>The legal basis is Article 6(1)(f) GDPR. Our legitimate interest is understanding usage and technical quality in a data-minimising way. As no access to your device takes place, consent under section 25 TDDDG is not required. The recipient is Vercel Inc.; on transfers to third countries see section 10. You may object to this processing under Article 21 GDPR.</p>
      <h3>9.3 No third-party analytics or marketing services</h3>
      <p>Google Analytics, Google Ads, the Meta pixel and other non-essential analytics or marketing services are not active. We have deliberately decided against using them to evaluate our advertising campaigns and instead evaluate those through our own measurement described in section 9.1. If such services are introduced later, they will be activated only after voluntary consent and this Privacy Policy will be updated in advance.</p>
      <h2>10. Recipients and processors</h2>
      <p>Depending on the functions used, the following recipients may process data:</p>
      <p>Google Cloud EMEA Limited and Google subprocessors – AI analysis through the paid Gemini Developer API;</p>
      <p>Vercel Inc. and subprocessors – hosting, delivery, security logs and cookieless audience measurement (section 9.2);</p>
      <p>Upstash, Inc. and subprocessors – feedback, update subscriptions, abuse-prevention counters and the events of our own usage measurement under section 9.1, in the EU region;</p>
      <p>Supabase, Inc. and subprocessors – accounts, authentication and job data (see section 15);</p>
      <p>Resend, Inc. and Amazon Web Services – delivery of account and feedback emails;</p>
      <p>Stripe Payments Europe, Ltd. – payment processing once you book a paid plan (see section 8a);</p>
      <p>Dropbox – only if you use the cloud import or export; other cloud providers currently not active;</p>
      <p>IT, security, legal or public authorities where required to comply with legal obligations or establish, exercise or defend legal claims.</p>
      <p>We enter into Article 28 GDPR processing agreements with processors. Where required for third-country transfers, we rely on adequacy decisions, EU Standard Contractual Clauses and supplementary safeguards.</p>
      <h2>11. Retention periods</h2>
      <p>High-resolution originals: not sent to Google and not stored by AJ GmbH;</p>
      <p>Previews at AJ GmbH: no permanent application-database storage; processed only for the job and technically unavoidable short-term storage;</p>
      <p>Reference photos, facial features derived from them and matching results of the Persons feature (section 4.3): never leave the user’s device; AJ GmbH does not receive or store them;</p>
      <p>Previews and responses at Google (general photo analysis, section 5): under current documentation, up to 55 days for security/abuse purposes unless a shorter binding zero-data-retention configuration applies;</p>
      <p>Hosting/security logs: 30 days, see section 3;</p>
      <p>Feedback/support and update subscriptions: as stated in section 8;</p>
      <p>Rounded GPS coordinates used for place naming: not stored by AJ GmbH; at the AI provider the same periods apply as for the previews;</p>
      <p>Events of our own usage measurement under section 9.1: 90 days in individual form, thereafter only in aggregated form without any session or account reference;</p>
      <p>Payment and invoice data under section 8a: for the duration of commercial and tax retention periods, as a rule up to ten years;</p>
      <p>Confirmation of authorisation to use reference photos (section 4.3): client-side only; not transmitted to or stored by AJ GmbH;</p>
      <p>Consent evidence for product updates and other legally relevant records: for the applicable statutory evidence and limitation periods.</p>
      <h2>12. Data security</h2>
      <p>We implement technical and organisational measures appropriate to the processing risk. These include encrypted transmission, access restrictions, separate key and permission management, data minimisation, abuse controls, logging of security-relevant events and regular provider reviews. Absolute security of transmission or storage cannot be guaranteed.</p>
      <h2>13. Your rights</h2>
      <p>Subject to statutory conditions, you have rights of access, rectification, erasure, restriction, data portability and objection. You may withdraw consent at any time with future effect. Processing carried out before withdrawal remains lawful.</p>
      <p>Send requests to the privacy contact in section 1. As we do not permanently store photos and normally do not retain identity data linked to a job, we may require additional information about the time and circumstances of the job to locate relevant data. We will not retain additional data solely to identify a person where this is not required.</p>
      <p>You also have the right to lodge a complaint with a supervisory authority. The authority normally responsible for AJ GmbH is:</p>
      <p>The Hessian Commissioner for Data Protection and Freedom of Information</p>
      <p>Wilhelmstraße 7</p>
      <p>65185 Wiesbaden</p>
      <p>Germany</p>
      <h2>14. Objection to processing under Article 6(1)(f) GDPR</h2>
      <p>You may object at any time, on grounds relating to your particular situation, to processing based on Article 6(1)(f) GDPR. We will then cease processing unless we demonstrate compelling legitimate grounds that override your interests, rights and freedoms or the processing is required to establish, exercise or defend legal claims.</p>
      <h2>15. User Account and Registration</h2>
      <p>When you create a user account, we process your email address, your encrypted password, the selected language (locale setting), and the timestamp and record of your acceptance of the Terms of Use and your acknowledgement of this Privacy Policy. The legal basis is Article 6(1)(b) GDPR (performance of contract).</p>
      <h3>15.1 Account when starting an analysis</h3>
      <p>Every analysis technically runs against a named job so that photo volumes, allowances and results can be assigned unambiguously. An <strong>account with a confirmed email address</strong> is required to run an analysis — including on the free plan. The reason is the statutory confirmation of the contract in text form (section 312f of the German Civil Code): without an address we could not send it to you.</p>
      <p>The legal basis is Article 6(1)(b) GDPR; without this assignment the job you initiated cannot be carried out. <strong>Anonymous accounts</strong> without contact details may still exist from the earlier open beta phase; they do not allow sign-in from another device. We delete those accounts and the associated job data on a routine basis, at the latest 90 days after the last job.</p>
      <h3>15.2 Account and usage measurement</h3>
      <p>While you are signed in, we associate the events described in section 9.1 with a pseudonymous identifier derived from your account identifier. We do not build profiles of individual users from this; we evaluate only how often the service is used a second time overall.</p>
      <p>We use Supabase (Supabase Inc., 970 Trestle Glen Rd, Oakland, CA 94610, USA) as a processor for authentication and profile data storage. Supabase hosts data on servers in the EU region Frankfurt (AWS eu-central-1). We have concluded a data processing agreement with Supabase under Article 28 GDPR; EU Standard Contractual Clauses provide the basis for transfers to the USA.</p>
      <p>Account data is stored for as long as the account exists. You can delete your account at any time; upon deletion your data will be permanently removed within 30 days. You may exercise your rights of access, rectification and erasure at any time through our privacy contact.</p>
      <h2>16. Changes to this Privacy Policy</h2>
      <p>We update this Privacy Policy when functions, providers or the law change. The version published on the website applies. We will not implement material changes requiring new consent without obtaining that consent.</p>
    </>
  );
}

export default async function PrivacyPage({ params }: Props) {
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
        {locale === 'de' ? <GermanBody /> : <EnglishBody />}
        <div className="mt-10 border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <BackButton locale={locale} />
        </div>
      </main>
    </div>
  );
}
