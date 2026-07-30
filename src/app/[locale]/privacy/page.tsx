import { setRequestLocale } from 'next-intl/server';
import { brandName } from '@/lib/brand';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';
import { BackButton } from '@/components/legal/BackButton';

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
      <p>Stand: 26. Juli 2026</p>
      <h2>1. Verantwortlicher</h2>
      <p>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
      <p>AJ GmbH</p>
      <p>Danziger Str. 80</p>
      <p>65191 Wiesbaden</p>
      <p>Deutschland</p>
      <p>Vertreten durch: Dr. Andreas Jahnke</p>
      <p>Datenschutzkontakt: privacy@auswahlbuddy.de</p>
      <h2>2. Geltungsbereich und Mindestalter</h2>
      <p>Diese Datenschutzerklärung gilt für die Website und den Fotoauswahldienst AuswahlBuddy. Der Dienst richtet sich ausschließlich an volljährige Nutzer ab 18 Jahren und ist für deren persönliche, private oder familiäre Fotoverwaltung bestimmt. Personen unter 18 Jahren dürfen AuswahlBuddy nicht selbst als Nutzer verwenden. Sie dürfen jedoch auf privaten Fotos und Referenzfotos abgebildet sein.</p>
      <p>Der Nutzer entscheidet selbst, welche privaten Fotos und welche ihm bekannten Personen analysiert werden. AuswahlBuddy darf nicht für berufliche oder gewerbliche Zwecke, zur öffentlichen Personensuche, zur Überwachung oder zur Identifizierung unbekannter Personen verwendet werden. Für Referenzfotos bestätigt der Nutzer einmal je Analysevorgang, dass die jeweils abgebildete Person oder – soweit erforderlich – eine hierzu berechtigte Person der beschriebenen Verwendung zugestimmt hat.</p>
      <h2>3. Aufruf der Website und technische Protokolldaten</h2>
      <p>Beim Aufruf der Website werden technisch erforderliche Daten verarbeitet, insbesondere IP-Adresse, Zeitpunkt, aufgerufene Adresse, HTTP-Status, übertragene Datenmenge, Referrer-Informationen, Browser-/Geräteinformationen und technische Fehlerdaten. Die Verarbeitung ist erforderlich, um die Website auszuliefern, Angriffe und Missbrauch abzuwehren und die Stabilität zu gewährleisten.</p>
      <p>Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO. Unser berechtigtes Interesse besteht im sicheren und zuverlässigen Betrieb des Dienstes. Empfänger ist insbesondere unser Hostinganbieter Vercel Inc. einschließlich seiner Unterauftragsverarbeiter.</p>
      <p>Reguläre Speicherdauer der von uns zugänglichen Hosting-/Sicherheitsprotokolle: 30 Tage. Bei Sicherheitsvorfällen können relevante Daten bis zur Aufklärung und Durchsetzung oder Abwehr von Ansprüchen länger gespeichert werden.</p>
      <h2>4. KI-gestützte Fotoauswahl</h2>
      <h3>4.1 Verarbeitete Daten und Ablauf</h3>
      <p>Wenn du eine Fotoauswahl startest, wählst du Fotos auf deinem Endgerät aus. AuswahlBuddy erzeugt im Browser verkleinerte JPEG-Vorschaubilder mit maximal 512 × 512 Pixeln. Hochauflösende Originaldateien werden nicht an unseren KI-Anbieter übertragen und verbleiben auf deinem Endgerät. Die spätere Download-/ZIP-Datei wird lokal im Browser erzeugt, soweit die jeweilige Funktion so umgesetzt ist.</p>
      <p>Für die Analyse verarbeiten wir die Vorschaubilder, eine technische Vorgangskennung und – soweit für die Sortierung erforderlich – ausgewählte Metadaten wie Aufnahmedatum und Kameramodell. Wenn die optionale Personenfunktion verwendet wird, verarbeiten wir zusätzlich je gesuchter Person ein Referenzfoto und eine neutrale, möglichst nicht namensbezogene Kennzeichnung wie „Person A“. Klarnamen sollen nicht an Google übermittelt werden. GPS-Koordinaten werden nicht an den KI-Anbieter übermittelt, sofern dies technisch entsprechend umgesetzt ist. Eine optionale Ortsnamensfunktion ist in Abschnitt 6 beschrieben.</p>
      <p>Die Vorschaubilder werden über unsere technische Infrastruktur an die bezahlte Gemini Developer API von Google übermittelt. Die KI bewertet Bilder anhand der vom Nutzer gewählten Kriterien und erstellt einen unverbindlichen Auswahlvorschlag. Der Nutzer kann das Ergebnis prüfen, ändern oder verwerfen.</p>
      <h3>4.2 Rollenverteilung, Zwecke und rechtlicher Rahmen</h3>
      <p>Für den Betrieb der Website, Sicherheits- und Missbrauchsprotokolle, Support, Produkt-Updates und eigene Vertragsdaten ist AJ GmbH datenschutzrechtlich Verantwortlicher. Die jeweiligen Zwecke und Rechtsgrundlagen werden in den betreffenden Abschnitten dieser Datenschutzerklärung beschrieben.</p>
      <p>Für die vom Nutzer ausgewählten Foto- und Referenzinhalte, Metadaten und Analyseergebnisse verarbeitet AJ GmbH die Daten ausschließlich nach der durch den Nutzer ausgelösten Weisung und nur zur Durchführung des konkreten privaten Analysevorgangs. AJ GmbH verfolgt mit diesen Inhalten keine eigenen Zwecke, nutzt sie nicht für Werbung oder Modelltraining und ist insoweit als Auftragsverarbeiter ausgestaltet. Der Nutzer bestimmt die Fotos, die gesuchten Personen, die Auswahlkriterien und den privaten Zweck. Die ergänzenden Auftragsverarbeitungsbedingungen sind Bestandteil der Nutzungsbedingungen.</p>
      <p>Soweit der Nutzer Fotos ausschließlich im Rahmen persönlicher oder familiärer Tätigkeiten verarbeitet, fällt seine eigene Verarbeitung unter die Haushaltsausnahme des Art. 2 Abs. 2 Buchst. c DSGVO. Diese Ausnahme gilt nicht für AJ GmbH und die von uns eingesetzten technischen Dienstleister; wir bleiben insbesondere an die für Auftragsverarbeiter geltenden Datenschutz- und Sicherheitsanforderungen gebunden. AuswahlBuddy trifft keine ausschließlich automatisierte Entscheidung mit rechtlicher oder vergleichbar erheblicher Wirkung im Sinne von Art. 22 DSGVO.</p>
      <h3>4.3 Referenzfotos und biometrischer Personenabgleich</h3>
      <p>Wenn die optionale Personenfunktion aktiviert wird, wird das Gesicht auf einem Referenzfoto mit Gesichtern in den ausgewählten privaten Fotos verglichen, um eine zuvor bestimmte und dem Nutzer bekannte Person wiederzufinden. Bei diesem technischen Vergleich können biometrische Daten zum Zweck der eindeutigen Wiedererkennung entstehen.</p>
      <p>AJ GmbH verarbeitet die Foto- und biometrischen Inhalte dabei ausschließlich im Auftrag des Nutzers und nach dessen dokumentierter Weisung. AuswahlBuddy holt keine eigenständige Einwilligung der abgebildeten Person ein. Der Nutzer darf die Funktion nur im privaten oder familiären Umfeld einsetzen und muss zur Verwendung jedes Referenzfotos berechtigt sein. Er muss insbesondere sicherstellen, dass die betroffene Person selbst oder – soweit sie nicht selbst wirksam zustimmen kann – eine hierzu berechtigte Person der vorübergehenden KI-gestützten Wiedererkennung und der dafür erforderlichen technischen Übermittlung zugestimmt hat.</p>
      <p>Für alle Referenzfotos, die innerhalb eines Analysevorgangs über das gemeinsame Upload-Feld bereitgestellt werden, genügt eine einzige aktive Sammelbestätigung. Eine separate Bestätigung je Foto oder Person, eine Altersangabe zur abgebildeten Person sowie ein schriftlicher oder hochzuladender Einwilligungsnachweis werden nicht verlangt. Die Bestätigung darf nicht vorausgewählt sein und muss vor der Übermittlung der Referenzfotos erfolgen.</p>
      <p>Die Sammelbestätigung ist eine vertragliche Zusicherung des Nutzers. Wir protokollieren lediglich Zeitpunkt, Fassung des Bestätigungstextes und eine technische Vorgangskennung; Namen, Kontaktdaten, Verwandtschaftsverhältnisse oder Einwilligungsnachrichten der abgebildeten Personen werden nicht verlangt. Der technische Bestätigungsnachweis wird für 30 Tage gespeichert und nur bei einem konkreten Sicherheits-, Missbrauchs- oder Rechtsfall länger aufbewahrt.</p>
      <p>Referenzfotos, vorübergehende Merkmalsdarstellungen und Zuordnungsergebnisse werden bei AJ GmbH nur für den laufenden Analysevorgang verarbeitet und danach aus der Anwendungsumgebung gelöscht. Wir erstellen keine dauerhaften Gesichts-Templates, Embeddings, Personendatenbanken oder wiederverwendbaren Personentags. Eine technisch mögliche Aufbewahrung bei Google ist in Abschnitt 5 beschrieben und kann die Dauer des Analysevorgangs überschreiten.</p>
      <p>Die Funktion darf nur zum Wiederfinden einer zuvor bestimmten, einwilligenden Person in den vom Nutzer selbst ausgewählten privaten Fotos verwendet werden. Unzulässig sind insbesondere die Identifizierung unbekannter Personen, Abgleiche mit öffentlichen oder fremden Bildbeständen, Überwachung, Strafverfolgungs- oder Sicherheitszwecke sowie die Ableitung ethnischer Herkunft, Religion, Gesundheit, politischer Ansichten, sexueller Orientierung, Emotionen oder anderer sensibler Eigenschaften.</p>
      <h3>4.4 Widerspruch, Rücknahme der Zustimmung und Anfragen abgebildeter Personen</h3>
      <p>Eine abgebildete Person kann dem Nutzer mitteilen, dass ihr Referenzfoto künftig nicht mehr verwendet werden darf. Der Nutzer muss diese Entscheidung beachten und darf das Foto nicht erneut hochladen. Betroffene Personen können sich außerdem an unseren Datenschutzkontakt wenden. Da wir weder Namen noch dauerhafte Gesichtsprofile speichern, ist eine nachträgliche Zuordnung regelmäßig nur anhand von Zeitpunkt und technischer Vorgangskennung möglich. Bereits an Google übermittelte Sicherheits- oder Missbrauchsprotokolle können nach den in Abschnitt 5 beschriebenen Regeln bis zum Ablauf der dortigen Frist fortbestehen.</p>
      <p>Bitte lade keine Ausweisdokumente, medizinischen Aufnahmen, intimen Inhalte oder sonstigen hochsensiblen Bilder hoch. Werden solche Inhalte dennoch hochgeladen, werden sie technisch wie andere Vorschaubilder verarbeitet; eine gesonderte fachliche oder inhaltliche Auswertung ist nicht vorgesehen.</p>
      <h2>5. Google Gemini Developer API</h2>
      <p>Für die KI-Analyse setzen wir einen kostenpflichtigen Zugang zur Gemini Developer API ein. Vertragspartner für Kunden mit deutscher Rechnungsadresse ist nach den aktuellen Google-Vertragsinformationen grundsätzlich Google Cloud EMEA Limited, 70 Sir John Rogerson’s Quay, Dublin 2, Irland, sofern im konkreten Cloud-Vertrag nichts anderes vereinbart wurde.</p>
      <p>Nach den Bedingungen für Paid Services verwendet Google die übermittelten Eingaben, Dateien und Antworten nicht zur Verbesserung oder zum Training seiner Modelle. Wir aktivieren keine freiwillige Freigabe von Logs oder Datasets an Google und verwenden die Daten nicht zum Modelltraining.</p>
      <p>Google kann Eingaben und Ausgaben für Sicherheits-, Missbrauchserkennungs- und gesetzliche Zwecke für einen begrenzten Zeitraum aufbewahren. Nach der derzeitigen Google-Dokumentation kann diese Aufbewahrung bis zu 55 Tage betragen. Je nach eingesetzter API-Funktion können zusätzliche Speicherungen entstehen. Deshalb verwenden wir keine File API, keine dauerhaft gespeicherten Datasets und kein dauerhaftes Context Caching; bei zustandsbehafteten API-Funktionen deaktivieren wir die Speicherung, soweit dies technisch möglich ist.</p>
      <p>Google kann Daten in Ländern verarbeiten, in denen Google oder seine Unterauftragsverarbeiter Einrichtungen betreiben. Grundlage sind der einschlägige Auftragsverarbeitungsvertrag, die Standardvertragsklauseln der Europäischen Kommission und/oder ein anwendbarer Angemessenheitsbeschluss. Trotz dieser Schutzmechanismen können bei Verarbeitungen außerhalb des Europäischen Wirtschaftsraums Restrisiken bestehen, insbesondere behördliche Zugriffsrechte nach dem Recht des Empfängerstaats.</p>
      <h2>6. Optionale Ortsnamensfunktion / Reverse Geocoding</h2>
      <p>Die Übermittlung präziser GPS-Koordinaten an BigDataCloud sollte erst nach Abschluss eines DPA einschließlich geeigneter Drittlandgarantien aktiviert werden. Andernfalls diesen gesamten Abschnitt entfernen und die Funktion deaktivieren.</p>
      <p>Wenn du die Anzeige eines Ortsnamens ausdrücklich aktivierst, können in der Bilddatei enthaltene GPS-Koordinaten an BigDataCloud Pty Ltd, Australien, übermittelt werden, um daraus einen Ortsnamen abzuleiten. Dabei können auch technische Verbindungsdaten wie die IP-Adresse anfallen. Rechtsgrundlage ist deine Einwilligung nach Art. 6 Abs. 1 Buchst. a DSGVO. Du kannst die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen oder die Funktion nicht verwenden.</p>
      <p>Australien verfügt nicht generell über einen Angemessenheitsbeschluss der Europäischen Kommission. Die Übermittlung darf daher nur auf Grundlage geeigneter Garantien, insbesondere EU-Standardvertragsklauseln und einer dokumentierten Transferprüfung, erfolgen. Die GPS-Koordinaten werden von AJ GmbH nicht dauerhaft gespeichert.</p>
      <h2>7. Optionaler Cloud-Import und -Export</h2>
      <p>Provider, OAuth-Berechtigungen, Token-Speicherung und Datenfluss müssen technisch geprüft und in der finalen Fassung konkret benannt werden.</p>
      <p>Wenn du einen unterstützten Cloud-Speicher wie Dropbox oder Microsoft OneDrive verbindest, erfolgt die Autorisierung über OAuth. AuswahlBuddy fordert nur die für den von dir gewählten Import oder Export erforderlichen Berechtigungen an. OAuth-Tokens werden nur für die Dauer des Vorgangs bzw. der Browser-Sitzung verwendet und nicht dauerhaft gespeichert, sofern dies technisch entsprechend umgesetzt ist.</p>
      <p>Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. b DSGVO. Für die Verarbeitung in deinem Cloud-Konto gelten ergänzend die Datenschutzbedingungen des jeweiligen Cloud-Anbieters. Bitte prüfe die angezeigten Zugriffsrechte vor der Freigabe.</p>
      <h2>8. Feedback, Support und Produkt-Updates</h2>
      <p>Wenn du uns Feedback oder eine Supportanfrage sendest, verarbeiten wir deine Kontaktdaten, den Nachrichtentext und erforderliche technische Informationen, um die Anfrage zu bearbeiten und den Dienst zu verbessern. Rechtsgrundlage ist je nach Inhalt Art. 6 Abs. 1 Buchst. b oder f DSGVO. Unser berechtigtes Interesse liegt in der Bearbeitung von Anfragen und der Fehlerbehebung.</p>
      <p>Reguläre Speicherdauer für Feedback-/Supportdaten: 12 Monate nach Abschluss, sofern keine gesetzlichen Aufbewahrungspflichten oder Rechtsansprüche eine längere Speicherung erfordern.</p>
      <p>Wenn du Produkt-Updates abonnierst, verarbeiten wir deine E-Mail-Adresse auf Grundlage deiner Einwilligung nach Art. 6 Abs. 1 Buchst. a DSGVO und § 7 Abs. 2 UWG. Soweit eingesetzt, verwenden wir ein Double-Opt-in-Verfahren. Du kannst deine Einwilligung jederzeit über den Abmeldelink oder durch Nachricht an uns widerrufen. Den Nachweis der Einwilligung können wir für die Dauer gesetzlicher Verjährungsfristen speichern.</p>
      <p>Für die Speicherung von Feedback, E-Mail-Adressen und Missbrauchszählern setzen wir Upstash, Inc. ein. Die Datenbank muss auf eine geeignete EU-Region beschränkt sein. Für den tatsächlichen E-Mail-Versand ist zusätzlich folgender Anbieter einzutragen:</p>
      <p>derzeit kein automatisierter Versand</p>
      <h2>9. Cookies, lokale Speicherung und Reichweitenmessung</h2>
      <p>Wir verwenden technisch erforderliche Cookies oder ähnliche Speicherzugriffe nur, soweit sie für die von dir ausdrücklich gewünschte Funktion erforderlich sind. Rechtsgrundlage für den Zugriff auf dein Endgerät ist § 25 Abs. 2 TDDDG; die anschließende Verarbeitung personenbezogener Daten stützen wir auf Art. 6 Abs. 1 Buchst. b oder f DSGVO.</p>
      <p>Für eine aggregierte Reichweitenmessung kann Vercel Web Analytics in einer cookielosen Konfiguration eingesetzt werden. Nach unserer Konfiguration werden keine geräteübergreifenden oder websiteübergreifenden Nutzerprofile erstellt. Die uns bereitgestellten Auswertungen sind aggregiert. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO; unser berechtigtes Interesse besteht darin, Nutzung und technische Qualität des Dienstes in datensparsamer Form zu verstehen.</p>
      <p>Google Analytics, Google Ads und andere nicht erforderliche Statistik- oder Marketingdienste sind in dieser Basisversion nicht aktiv. Sollten wir solche Dienste später einsetzen, werden sie erst nach deiner freiwilligen Einwilligung aktiviert und diese Datenschutzerklärung wird vorab aktualisiert.</p>
      <h2>10. Empfänger und Auftragsverarbeiter</h2>
      <p>Je nach Nutzung können insbesondere folgende Empfänger Daten verarbeiten:</p>
      <p>Google Cloud EMEA Limited und Google-Unterauftragsverarbeiter – KI-Analyse über die bezahlte Gemini Developer API;</p>
      <p>Vercel Inc. und Unterauftragsverarbeiter – Hosting, Auslieferung, Sicherheitsprotokolle und gegebenenfalls cookielose Reichweitenmessung;</p>
      <p>Upstash, Inc. und Unterauftragsverarbeiter – Feedback, Update-Anmeldungen und Missbrauchszähler in der gewählten Region;</p>
      <p>BigDataCloud Pty Ltd – nur bei aktivierter Ortsnamensfunktion;</p>
      <p>Dropbox, Microsoft oder andere vom Nutzer verbundene Cloud-Anbieter – nur bei aktivem Import/Export;</p>
      <p>IT-, Sicherheits-, Rechts- oder Behördenstellen, soweit dies zur Erfüllung gesetzlicher Pflichten oder zur Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen erforderlich ist.</p>
      <p>Mit Auftragsverarbeitern schließen wir Verträge nach Art. 28 DSGVO. Bei Drittlandtransfers verwenden wir, soweit erforderlich, Angemessenheitsbeschlüsse, EU-Standardvertragsklauseln und ergänzende Schutzmaßnahmen.</p>
      <h2>11. Speicherdauer</h2>
      <p>Hochauflösende Originalfotos: keine Übermittlung an Google und keine Speicherung durch AJ GmbH;</p>
      <p>Vorschaubilder bei AJ GmbH: keine dauerhafte Speicherung in einer Anwendungsdatenbank; Verarbeitung nur für die Dauer des Vorgangs und technisch unvermeidbare Kurzzeitspeicherung;</p>
      <p>Vorschaubilder und Antworten bei Google: nach aktueller Dokumentation für Sicherheits-/Missbrauchszwecke bis zu 55 Tage, sofern keine kürzere Zero-Data-Retention-Konfiguration verbindlich greift;</p>
      <p>Hosting-/Sicherheitslogs: gemäß der in Abschnitt 3 einzutragenden tatsächlichen Frist;</p>
      <p>Feedback/Support und Update-Anmeldungen: gemäß Abschnitt 8;</p>
      <p>Technische Bestätigung der Referenzfoto-Berechtigung: ohne Referenzfoto, Namen oder Kontaktdaten für 30 Tage; längere Speicherung nur bei einem konkreten Sicherheits-, Missbrauchs- oder Rechtsfall.</p>
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
      <h2>15. Änderungen dieser Datenschutzerklärung</h2>
      <p>Wir aktualisieren diese Datenschutzerklärung, wenn sich Funktionen, Dienstleister oder Rechtslage ändern. Maßgeblich ist die jeweils auf der Website veröffentlichte Fassung. Wesentliche Änderungen, die eine neue Einwilligung erfordern, setzen wir nicht ohne diese Einwilligung um.</p>
    </>
  );
}

function EnglishBody() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Last updated: 26 July 2026</p>
      <h2>1. Controller</h2>
      <p>The controller within the meaning of the General Data Protection Regulation (GDPR) is:</p>
      <p>AJ GmbH</p>
      <p>Danziger Str. 80</p>
      <p>65191 Wiesbaden</p>
      <p>Germany</p>
      <p>Represented by: Dr Andreas Jahnke</p>
      <p>Privacy contact: privacy@shortlistbuddy.com</p>
      <h2>2. Scope and minimum age</h2>
      <p>This Privacy Policy applies to the website and the ShortlistBuddy photo-selection service. The service is intended exclusively for adult users aged 18 or over and for their personal, private or family photo management. Persons under 18 must not use ShortlistBuddy as users themselves, but they may appear in private photos and reference photos.</p>
      <p>The user decides which private photos and which known persons are analysed. ShortlistBuddy must not be used for professional or commercial purposes, public person searches, surveillance or identification of unknown persons. For reference photos, the user gives one confirmation per analysis job that each person shown—or, where necessary, a person authorised to act for them—has agreed to the described use.</p>
      <h2>3. Website access and technical log data</h2>
      <p>When the website is accessed, technically necessary data is processed, in particular the IP address, time, requested URL, HTTP status, data volume, referrer information, browser/device information and technical error data. This processing is necessary to deliver the website, prevent attacks and misuse, and maintain stability.</p>
      <p>The legal basis is Article 6(1)(f) GDPR. Our legitimate interest is the secure and reliable operation of the service. Recipients include our hosting provider Vercel Inc. and its subprocessors.</p>
      <p>Regular retention period for hosting/security logs accessible to us: 30 days. Relevant data may be retained for longer where necessary to investigate security incidents or establish, exercise or defend legal claims.</p>
      <h2>4. AI-assisted photo selection</h2>
      <h3>4.1 Data processed and workflow</h3>
      <p>When you start a photo-selection job, you select photos on your device. ShortlistBuddy creates reduced JPEG previews in your browser with a maximum size of 512 × 512 pixels. High-resolution originals are not sent to our AI provider and remain on your device. The later download/ZIP file is created locally in the browser, provided the relevant function is implemented as described.</p>
      <p>For the analysis, we process the previews, a technical job identifier and, where required for sorting, selected metadata such as capture date and camera model. If the optional Persons feature is used, we additionally process one reference photo for each person sought and a neutral label such as “Person A”, preferably without a real name. Real names should not be sent to Google. GPS coordinates are not sent to the AI provider if the system is implemented accordingly. An optional place-name feature is described in section 6.</p>
      <p>The previews are transmitted through our technical infrastructure to Google’s paid Gemini Developer API. The AI evaluates the images against criteria selected by the user and creates a non-binding proposed selection. The user can review, modify or reject the result.</p>
      <h3>4.2 Roles, purposes and legal framework</h3>
      <p>AJ GmbH is the controller for website operation, security and abuse logs, support, product updates and its own contractual data. The relevant purposes and legal bases are described in the respective sections of this Privacy Policy.</p>
      <p>For photo and reference content selected by the user, metadata and analysis results, AJ GmbH processes the data solely on the instruction triggered by the user and only to perform the specific private analysis job. AJ GmbH does not pursue its own purposes with this content, does not use it for advertising or model training and is structured as a processor in this respect. The user determines the photos, persons sought, selection criteria and private purpose. The supplementary processing terms form part of the Terms of Use.</p>
      <p>Where the user processes photos solely in the course of personal or household activities, the user’s own processing falls within the household exemption in Article 2(2)(c) GDPR. This exemption does not apply to AJ GmbH or the technical providers we use; we remain subject in particular to the data-protection and security obligations applicable to processors. ShortlistBuddy does not make solely automated decisions producing legal or similarly significant effects within Article 22 GDPR.</p>
      <h3>4.3 Reference photos and biometric person matching</h3>
      <p>If the optional Persons feature is activated, the face in a reference photo is compared with faces in the selected private photos in order to find a previously specified person known to the user. This technical comparison may generate biometric data for the purpose of unique recognition.</p>
      <p>AJ GmbH processes the photo and biometric content solely on the user’s behalf and documented instructions. ShortlistBuddy does not independently collect consent from the person shown. The user may use the feature only in a private or family setting and must be authorised to use each reference photo. In particular, the user must ensure that the person shown—or, where that person cannot validly agree themselves, a person authorised to act for them—has agreed to the temporary AI-assisted recognition and the necessary technical transfer.</p>
      <p>One active collective confirmation is sufficient for all reference photos provided through the common upload field in an analysis job. ShortlistBuddy does not require a separate confirmation for each photo or person, an age declaration for the person shown, or written/uploaded evidence of agreement. The confirmation must not be preselected and must be given before the reference photos are transferred.</p>
      <p>The collective confirmation is a contractual representation by the user. We record only the timestamp, version of the confirmation text and a technical job identifier; we do not request names, contact details, relationships or consent messages relating to the persons shown. The technical confirmation record is retained for 30 days and longer only in a specific security, misuse or legal case.</p>
      <p>Reference photos, temporary feature representations and matching results are processed by AJ GmbH only for the current analysis job and are then deleted from the application environment. We do not create persistent facial templates, embeddings, person databases or reusable person tags. Technically possible retention by Google is described in section 5 and may extend beyond the analysis job.</p>
      <p>The feature may be used only to find a previously specified consenting person in private photos selected by the user. It must not be used to identify unknown individuals, search public or third-party image collections, conduct surveillance, support law-enforcement or security purposes, or infer ethnic origin, religion, health, political opinions, sexual orientation, emotions or other sensitive characteristics.</p>
      <h3>4.4 Objection, withdrawal of permission and requests from persons shown</h3>
      <p>A person shown may tell the user that their reference photo must not be used in future. The user must respect that decision and must not upload the photo again. Persons shown may also contact our privacy contact. Because we do not store names or persistent facial profiles, retrospective identification will normally require the approximate time and technical job identifier. Security or abuse logs already transmitted to Google may remain until the period described in section 5 expires.</p>
      <p>Do not upload identity documents, medical images, intimate content or other highly sensitive images. If such content is nevertheless uploaded, it is technically processed like any other preview; no separate professional or substantive analysis is intended.</p>
      <h2>5. Google Gemini Developer API</h2>
      <p>We use a paid Gemini Developer API account for AI analysis. According to Google’s current contracting-entity information, the contracting entity for customers with a German billing address is generally Google Cloud EMEA Limited, 70 Sir John Rogerson’s Quay, Dublin 2, Ireland, unless the specific cloud agreement states otherwise.</p>
      <p>Under the Paid Services terms, Google does not use submitted inputs, files or responses to improve or train its models. We do not enable voluntary sharing of logs or datasets with Google and do not use the data for model training.</p>
      <p>Google may retain inputs and outputs for security, abuse-detection and legal purposes for a limited period. Google’s current documentation states that this may be up to 55 days. Additional retention may arise depending on the API features used. We therefore do not use the File API, permanently stored datasets or persistent context caching, and disable storage for stateful API features where technically possible.</p>
      <p>Google may process data in countries where Google or its subprocessors maintain facilities. The relevant data processing agreement, European Commission Standard Contractual Clauses and/or an applicable adequacy decision provide the transfer basis. Residual risks may remain for processing outside the European Economic Area, particularly statutory access powers in the recipient country.</p>
      <h2>6. Optional place-name feature / reverse geocoding</h2>
      <p>Precise GPS coordinates must not be sent to BigDataCloud until a DPA and appropriate third-country safeguards have been completed. Otherwise remove this section and disable the feature.</p>
      <p>If you expressly enable place-name display, GPS coordinates contained in the image file may be sent to BigDataCloud Pty Ltd in Australia to derive a place name. Technical connection data such as the IP address may also be processed. The legal basis is your consent under Article 6(1)(a) GDPR. You may withdraw consent with future effect or choose not to use the feature.</p>
      <p>Australia is not generally covered by an EU adequacy decision. The transfer must therefore be based on appropriate safeguards, in particular EU Standard Contractual Clauses and a documented transfer assessment. AJ GmbH does not permanently store the GPS coordinates.</p>
      <h2>7. Optional cloud import and export</h2>
      <p>Providers, OAuth scopes, token storage and actual data flows must be technically verified and specifically named in the final version.</p>
      <p>If you connect supported cloud storage such as Dropbox or Microsoft OneDrive, authorisation is performed via OAuth. ShortlistBuddy requests only the permissions required for the import or export selected by you. OAuth tokens are used only for the duration of the transaction or browser session and are not stored permanently, provided the system is implemented accordingly.</p>
      <p>The legal basis is Article 6(1)(b) GDPR. The privacy terms of the relevant cloud provider also apply to processing within your cloud account. Review the displayed permissions before granting access.</p>
      <h2>8. Feedback, support and product updates</h2>
      <p>If you send feedback or a support request, we process your contact details, message and necessary technical information to handle the request and improve the service. Depending on the content, the legal basis is Article 6(1)(b) or (f) GDPR. Our legitimate interest is handling requests and correcting errors.</p>
      <p>Regular retention period for feedback/support data: 12 months after closure, unless statutory retention duties or legal claims require longer storage.</p>
      <p>If you subscribe to product updates, we process your email address based on your consent under Article 6(1)(a) GDPR and section 7(2) of the German Unfair Competition Act. Where used, we apply a double-opt-in procedure. You may withdraw consent at any time through the unsubscribe link or by contacting us. Evidence of consent may be retained for statutory limitation periods.</p>
      <p>We use Upstash, Inc. to store feedback, email addresses and abuse-prevention counters. The database must be restricted to a suitable EU region. The actual email-delivery provider must be added here:</p>
      <p>no automated delivery at present</p>
      <h2>9. Cookies, local storage and audience measurement</h2>
      <p>We use technically necessary cookies or similar storage access only where required for a function expressly requested by you. The legal basis for access to your terminal equipment is section 25(2) TDDDG; subsequent processing of personal data is based on Article 6(1)(b) or (f) GDPR.</p>
      <p>Vercel Web Analytics may be used for aggregated audience measurement in a cookieless configuration. Under our configuration, it does not create cross-device or cross-site user profiles. Reports made available to us are aggregated. The legal basis is Article 6(1)(f) GDPR; our legitimate interest is understanding usage and technical quality in a data-minimising way.</p>
      <p>Google Analytics, Google Ads and other non-essential analytics or marketing services are not active in this baseline version. If such services are introduced later, they will be activated only after voluntary consent and this Privacy Policy will be updated in advance.</p>
      <h2>10. Recipients and processors</h2>
      <p>Depending on the functions used, the following recipients may process data:</p>
      <p>Google Cloud EMEA Limited and Google subprocessors – AI analysis through the paid Gemini Developer API;</p>
      <p>Vercel Inc. and subprocessors – hosting, delivery, security logs and, where applicable, cookieless audience measurement;</p>
      <p>Upstash, Inc. and subprocessors – feedback, update subscriptions and abuse-prevention counters in the selected region;</p>
      <p>BigDataCloud Pty Ltd – only when the place-name feature is enabled;</p>
      <p>Dropbox, Microsoft or other cloud providers connected by the user – only during active import/export;</p>
      <p>IT, security, legal or public authorities where required to comply with legal obligations or establish, exercise or defend legal claims.</p>
      <p>We enter into Article 28 GDPR processing agreements with processors. Where required for third-country transfers, we rely on adequacy decisions, EU Standard Contractual Clauses and supplementary safeguards.</p>
      <h2>11. Retention periods</h2>
      <p>High-resolution originals: not sent to Google and not stored by AJ GmbH;</p>
      <p>Previews at AJ GmbH: no permanent application-database storage; processed only for the job and technically unavoidable short-term storage;</p>
      <p>Reference photos, temporary biometric feature representations and matching results at AJ GmbH: only for the active analysis job, then deleted from the application environment;</p>
      <p>Technical record of the reference-photo authority confirmation: without the reference photo, name or contact details for 30 days; longer only in a specific security, misuse or legal case;</p>
      <p>Previews and responses at Google: under current documentation, up to 55 days for security/abuse purposes unless a shorter binding zero-data-retention configuration applies;</p>
      <p>Hosting/security logs: the actual period inserted in section 3;</p>
      <p>Feedback/support and update subscriptions: as stated in section 8;</p>
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
      <h2>15. Changes to this Privacy Policy</h2>
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
