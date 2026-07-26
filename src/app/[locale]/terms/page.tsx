import { setRequestLocale } from 'next-intl/server';
import { brandName } from '@/lib/brand';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Generated from the reviewed B2C legal source (2026-07-26). German is the
// authoritative version; English is provided for information.
function GermanBody() {
  return (
    <>
      <h1>Nutzungsbedingungen</h1>
      <p>Stand: 26. Juli 2026</p>
      <h2>1. Anbieter und Geltungsbereich</h2>
      <p>Diese Nutzungsbedingungen gelten für die Nutzung des Fotoauswahldienstes AuswahlBuddy der AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Deutschland („AJ GmbH“, „wir“).</p>
      <p>Die Beta richtet sich ausschließlich an volljährige Nutzer ab 18 Jahren. Der Dienst darf nicht von oder für Personen unter 18 Jahren als Nutzer betrieben werden. Fotos dürfen Minderjährige abbilden, wenn der volljährige Nutzer zu deren Verarbeitung berechtigt ist.</p>
      <p>Abweichende Bedingungen des Nutzers gelten nur, wenn wir ihnen ausdrücklich in Textform zustimmen.</p>
      <h2>2. Vertragsschluss und Beta-Charakter</h2>
      <p>Der Nutzer kann die Nutzungsbedingungen vor Beginn der Analyse abrufen. Der Vertrag über den einzelnen Analysevorgang kommt zustande, wenn der Nutzer den Bedingungen zustimmt und die Analyse startet.</p>
      <p>AuswahlBuddy wird derzeit als kostenlose Beta bereitgestellt. Der Dienst befindet sich in Entwicklung. Funktionen können geändert, eingeschränkt oder vorübergehend eingestellt werden. Ein Anspruch auf dauerhafte Verfügbarkeit, bestimmte Funktionen, bestimmte Verarbeitungsgeschwindigkeiten oder ein bestimmtes Auswahlresultat besteht nicht.</p>
      <p>Zwingende gesetzliche Rechte, insbesondere solche, die auf unentgeltliche digitale Dienstleistungen anwendbar sind, bleiben unberührt.</p>
      <h2>3. Leistungsgegenstand und KI-Hinweis</h2>
      <p>AuswahlBuddy unterstützt den Nutzer dabei, aus einer Menge von Fotos einen Auswahlvorschlag zu erstellen. Der Dienst verwendet künstliche Intelligenz, derzeit insbesondere die bezahlte Gemini Developer API von Google.</p>
      <p>Die KI-Ausgabe ist eine automatisiert erstellte Empfehlung. Sie kann fehlerhaft, unvollständig, subjektiv oder für den vorgesehenen Zweck ungeeignet sein. AuswahlBuddy ersetzt keine menschliche Prüfung. Der Nutzer muss die vorgeschlagene Auswahl vor Verwendung, Weitergabe oder Löschung eigener Dateien kontrollieren.</p>
      <p>Optional kann der Nutzer ihm bekannte Personen anhand von Referenzfotos in den ausgewählten privaten Fotos wiederfinden lassen. Die Funktion ist ausschließlich für persönliche oder familiäre Zwecke bestimmt. Der Nutzer muss zur Verwendung sämtlicher Referenzfotos berechtigt sein und gibt hierzu eine einmalige Sammelbestätigung für den jeweiligen Analysevorgang ab.</p>
      <h2>4. Technische Voraussetzungen und Datensicherung</h2>
      <p>Der Nutzer ist für ein kompatibles Endgerät, einen aktuellen Browser, eine ausreichend stabile Internetverbindung und die sichere Aufbewahrung seiner Originaldateien verantwortlich.</p>
      <p>AuswahlBuddy ist kein Backup- oder Archivierungsdienst. Der Nutzer muss vor der Analyse und vor jeder Löschung eine unabhängige Sicherungskopie seiner Originalfotos aufbewahren. Die Nutzung des Auswahlvorschlags darf nicht als automatische Löschfreigabe verstanden werden.</p>
      <p>Hochauflösende Originaldateien sollen nach der beschriebenen technischen Konzeption auf dem Endgerät verbleiben. Sollte eine zukünftige Funktion hiervon abweichen, wird dies vor der Übermittlung transparent angezeigt und die Datenschutzerklärung angepasst.</p>
      <h2>5. Rechte an Fotos und erforderliche Nutzungsbefugnis</h2>
      <p>Der Nutzer behält seine Rechte an den Fotos. AJ GmbH erwirbt kein Eigentum an ihnen.</p>
      <p>Der Nutzer räumt AJ GmbH für die Dauer und den Zweck des jeweiligen Analysevorgangs ein einfaches, nicht ausschließliches, nicht übertragbares und räumlich auf die technisch erforderliche Verarbeitung beschränktes Recht ein, Vorschaubilder und Metadaten zu vervielfältigen, technisch zu bearbeiten und an beauftragte Dienstleister zu übermitteln, soweit dies zur Bereitstellung des Dienstes erforderlich ist. Das Recht endet, sobald die Verarbeitung und technisch erforderliche Kurzzeitspeicherung abgeschlossen sind.</p>
      <p>Der Nutzer versichert, dass er die Fotos ausschließlich für persönliche oder familiäre Zwecke auswählt und übermittelt und dass die Nutzung keine Urheber-, Persönlichkeits- oder sonstigen Rechte Dritter verletzt. Soweit auf einem Referenzfoto eine andere Person abgebildet ist, muss diese Person oder – soweit erforderlich – eine hierzu berechtigte Person der vorübergehenden KI-gestützten Wiedererkennung und der technisch erforderlichen Übermittlung verkleinerter Bilder an Google zugestimmt haben.</p>
      <p>Für sämtliche Referenzfotos eines Analysevorgangs genügt eine einzige, nicht vorausgewählte Sammelbestätigung im Referenzfoto-Uploadfeld. Der Nutzer muss weder für jede Person ein separates Kästchen markieren noch einen schriftlichen Nachweis beschaffen oder hochladen. AuswahlBuddy darf auf die Richtigkeit dieser Bestätigung vertrauen, soweit keine konkreten Anhaltspunkte für Missbrauch oder eine fehlende Berechtigung bestehen.</p>
      <p>Die Referenzfoto-Funktion darf nicht verwendet werden, wenn der Nutzer weiß oder erkennen muss, dass die betroffene Person widerspricht oder die erforderliche Zustimmung nicht vorliegt. Eine einmal erklärte Ablehnung oder Rücknahme ist bei künftigen Analysevorgängen zu beachten.</p>
      <h2>6. Unzulässige Nutzung</h2>
      <p>Untersagt sind insbesondere: rechtswidrige Inhalte; Schadsoftware; automatisierte Massenabfragen; Umgehung technischer Schutzmaßnahmen; Angriffe auf den Dienst; berufliche, gewerbliche oder institutionelle Nutzung der Personenfunktion; biometrischer Abgleich ohne die erforderliche Zustimmung; Identifizierung unbekannter Personen; Suche in öffentlichen oder fremden Bildbeständen; Überwachung, Nachverfolgung, Strafverfolgungs- oder Sicherheitszwecke; Aufbau von Gesichts- oder Personendatenbanken; biometrische Kategorisierung oder Emotionserkennung; sowie jede Nutzung, die Rechte Dritter oder die Bedingungen unserer technischen Anbieter verletzt.</p>
      <p>Bitte lade keine Ausweisdokumente, medizinischen Aufnahmen, intimen Inhalte oder sonstigen hochsensiblen Bilder hoch.</p>
      <p>Wir dürfen einen Vorgang abbrechen, Datenübertragungen blockieren oder den Zugang beschränken, wenn konkrete Anhaltspunkte für Missbrauch, Sicherheitsrisiken oder Rechtsverstöße bestehen. Soweit möglich, berücksichtigen wir dabei die Interessen des Nutzers und informieren über den Grund.</p>
      <h2>7. Datenschutz</h2>
      <p>Informationen zur Verarbeitung personenbezogener Daten, zu Referenzfotos, Google und der möglichen Google-Aufbewahrung bis zu 55 Tagen enthält die Datenschutzerklärung. Für die ausgewählten Foto- und Referenzinhalte verarbeitet AJ GmbH ausschließlich auf Weisung des Nutzers; für eigene Website-, Sicherheits-, Support- und Vertragsdaten ist AJ GmbH Verantwortlicher.</p>
      <p>Die nachstehenden Auftragsverarbeitungsbedingungen gelten, soweit AJ GmbH Foto- und Referenzinhalte im Auftrag des Nutzers verarbeitet. Optionale Einwilligungen, etwa für Geokodierung oder Marketing, bleiben hiervon getrennt und können verweigert oder widerrufen werden.</p>
      <p>7.1 Ergänzende Bedingungen zur Verarbeitung von Foto- und Referenzinhalten</p>
      <p>Gegenstand und Dauer: Verarbeitet werden die vom Nutzer für einen konkreten Vorgang ausgewählten Vorschaubilder, Referenzfotos, erforderlichen Metadaten und Analyseergebnisse. Die Verarbeitung beginnt mit dem Start des Vorgangs und endet nach Abschluss der Analyse und der technisch unvermeidbaren Kurzzeitspeicherung; abweichende Google-Aufbewahrungen sind in der Datenschutzerklärung beschrieben.</p>
      <p>Art und Zweck: Verkleinerung, Übermittlung, automatisierte Qualitäts- und Motivanalyse sowie – bei Nutzung der Personenfunktion – vorübergehender Gesichtsabgleich zur Wiedererkennung einer vom Nutzer bestimmten Person in den ausgewählten privaten Fotos.</p>
      <p>Daten und betroffene Personen: Bildinhalte, Gesichtsmerkmale, Aufnahmemetadaten und technische Vorgangsdaten von Nutzern sowie von Familienangehörigen, Freunden und sonstigen Personen, die auf den ausgewählten privaten Fotos abgebildet sind.</p>
      <p>Weisungen und Pflichten des Nutzers: Der Nutzer erteilt die dokumentierte Weisung durch Auswahl der Fotos, Festlegung der Kriterien, Abgabe der Sammelbestätigung und Start der Analyse. Er darf keine rechtswidrigen Weisungen erteilen und informiert AJ GmbH, wenn eine frühere Berechtigung oder Zustimmung für künftige Vorgänge entfällt.</p>
      <p>Pflichten von AJ GmbH: Wir verarbeiten Inhalte nur auf dokumentierte Weisung, verpflichten zugriffsberechtigte Personen zur Vertraulichkeit, treffen angemessene technische und organisatorische Sicherheitsmaßnahmen, unterstützen im technisch möglichen Umfang bei Datenschutzanfragen und Sicherheitsvorfällen und löschen die Inhalte nach Maßgabe dieser Bedingungen und der Datenschutzerklärung.</p>
      <p>Unterauftragsverarbeiter: Der Nutzer erteilt eine allgemeine Genehmigung zum Einsatz der in der Datenschutzerklärung und einer dauerhaft abrufbaren Unterauftragsverarbeiterliste genannten Anbieter, insbesondere Google für die KI-Analyse sowie Vercel für Hosting- und Sicherheitsfunktionen. Wesentliche Änderungen werden für zukünftige Vorgänge veröffentlicht. Wer einer Änderung nicht zustimmt, darf danach keine neuen Analysevorgänge starten.</p>
      <p>Nachweise und Kontrolle: AJ GmbH stellt die gesetzlich erforderlichen Informationen zu den getroffenen Schutzmaßnahmen und eingesetzten Unterauftragsverarbeitern bereit. Individuelle Vor-Ort-Prüfungen sind nur zulässig, soweit sie gesetzlich erforderlich und nicht durch geeignete Zertifikate, Prüfberichte oder Dokumentationen ersetzbar sind.</p>
      <h2>8. Verfügbarkeit, Änderungen und Einstellung der Beta</h2>
      <p>Wir bemühen uns um einen zuverlässigen Betrieb, schulden für die kostenlose Beta aber keine bestimmte Verfügbarkeit. Wartung, Sicherheitsmaßnahmen, Störungen von Internet-, Hosting- oder KI-Diensten sowie höhere Gewalt können zu Unterbrechungen führen.</p>
      <p>Wir dürfen Funktionen ändern, wenn hierfür ein sachlicher Grund besteht, insbesondere Sicherheit, Rechtsänderungen, technische Weiterentwicklung, Anbieterwechsel oder Vermeidung von Missbrauch. Änderungen dürfen den Nutzer nicht unangemessen benachteiligen.</p>
      <p>Wir dürfen die kostenlose Beta jederzeit mit Wirkung für die Zukunft einstellen. Bereits abgeschlossene lokale Downloads bleiben davon unberührt. Da kein dauerhaftes Nutzerkonto und kein Fotoarchiv geschuldet sind, besteht kein Anspruch auf Datenmigration.</p>
      <h2>9. Haftung</h2>
      <p>Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei schuldhafter Verletzung von Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz, bei Arglist, bei ausdrücklich übernommenen Garantien sowie in allen anderen Fällen zwingender gesetzlicher Haftung.</p>
      <p>Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht haften wir nur auf den bei Vertragsschluss vorhersehbaren, vertragstypischen Schaden. Wesentliche Vertragspflichten sind Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Nutzer regelmäßig vertrauen darf.</p>
      <p>Bei leicht fahrlässiger Verletzung nicht wesentlicher Vertragspflichten ist die Haftung ausgeschlossen.</p>
      <p>Soweit gesetzlich zulässig und unter Beachtung der vorstehenden Absätze haften wir nicht für Schäden, die darauf beruhen, dass der Nutzer keine zumutbare Sicherungskopie seiner Originaldateien vorgehalten, den KI-Vorschlag ungeprüft übernommen oder Dateien außerhalb von AuswahlBuddy gelöscht hat. Dies gilt nicht, soweit die fehlende Datensicherung für den Schaden nicht ursächlich war oder eine Sicherung unzumutbar war.</p>
      <p>Die Haftungsbeschränkungen gelten entsprechend zugunsten unserer gesetzlichen Vertreter, Beschäftigten und Erfüllungsgehilfen.</p>
      <h2>10. Freistellung bei rechtswidrigen Nutzerinhalten</h2>
      <p>Verletzt der Nutzer schuldhaft Rechte Dritter oder gesetzliche Vorschriften und werden wir deshalb von einem Dritten in Anspruch genommen, stellt der Nutzer uns von berechtigten Ansprüchen und erforderlichen angemessenen Kosten der Rechtsverteidigung frei. Dies gilt nicht, soweit der Nutzer die Pflichtverletzung nicht zu vertreten hat. Wir informieren den Nutzer unverzüglich und geben ihm, soweit rechtlich und praktisch möglich, Gelegenheit zur Mitwirkung an der Verteidigung.</p>
      <h2>11. Anwendbares Recht und Gerichtsstand</h2>
      <p>Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Ist der Nutzer Verbraucher und hat er seinen gewöhnlichen Aufenthalt in einem anderen Staat, bleiben zwingende Verbraucherschutzvorschriften dieses Staates unberührt.</p>
      <p>Für Verbraucher gelten die gesetzlichen Gerichtsstände. Für Kaufleute, juristische Personen des öffentlichen Rechts und öffentlich-rechtliche Sondervermögen ist – soweit gesetzlich zulässig – Wiesbaden ausschließlicher Gerichtsstand.</p>
      <h2>12. Verbraucherstreitbeilegung</h2>
      <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      <h2>13. Vertragssprache und englische Übersetzung</h2>
      <p>Vertragssprache ist Deutsch. Die englische Fassung dient der Information. Bei Widersprüchen ist die deutsche Fassung maßgeblich, soweit dies gegenüber dem jeweiligen Nutzer rechtlich zulässig ist und zwingende Verbraucherschutzvorschriften nicht entgegenstehen.</p>
      <h2>14. Schlussbestimmungen</h2>
      <p>Sollte eine Bestimmung dieser Nutzungsbedingungen ganz oder teilweise unwirksam sein, bleiben die übrigen Bestimmungen wirksam. An die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften.</p>
      <p>Die jeweils aktuelle Fassung ist auf der Website abrufbar. Änderungen gelten nur für zukünftige Analysevorgänge, sofern nicht zwingendes Recht eine andere Behandlung verlangt.</p>
    </>
  );
}

function EnglishBody() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>Last updated: 26 July 2026</p>
      <h2>1. Provider and scope</h2>
      <p>These Terms govern use of the ShortlistBuddy photo-selection service provided by AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Germany (“AJ GmbH”, “we”).</p>
      <p>The beta is intended exclusively for adult users aged 18 or over. The service must not be operated by or for persons under 18 as users. Photos may depict minors where the adult user is authorised to have them processed.</p>
      <p>Any terms of the user apply only if we expressly agree to them in text form.</p>
      <h2>2. Contract formation and beta status</h2>
      <p>The user can access these Terms before starting an analysis. A contract for the individual analysis job is formed when the user accepts the Terms and starts the analysis.</p>
      <p>ShortlistBuddy is currently provided as a free beta and remains under development. Functions may be changed, restricted or temporarily discontinued. There is no entitlement to continuous availability, specific functions, a particular processing speed or a particular selection result.</p>
      <p>Mandatory statutory rights, including rights applicable to free digital services, remain unaffected.</p>
      <h2>3. Service and AI notice</h2>
      <p>ShortlistBuddy assists the user in creating a proposed selection from a set of photos. The service uses artificial intelligence, currently including Google’s paid Gemini Developer API.</p>
      <p>The AI output is an automated recommendation. It may be incorrect, incomplete, subjective or unsuitable for the intended purpose. ShortlistBuddy does not replace human review. The user must check the proposed selection before using, sharing or deleting any files.</p>
      <p>Optionally, the user may find known persons in selected private photos by using reference photos. The feature is intended exclusively for personal or family purposes. The user must be authorised to use all reference photos and gives one collective confirmation for the relevant analysis job.</p>
      <h2>4. Technical requirements and backups</h2>
      <p>The user is responsible for a compatible device, an up-to-date browser, a sufficiently stable internet connection and safe storage of the original files.</p>
      <p>ShortlistBuddy is not a backup or archiving service. Before analysis and before deleting any file, the user must retain an independent backup of all originals. A proposed selection must never be treated as an automatic deletion approval.</p>
      <p>Under the described architecture, high-resolution originals remain on the device. If a future feature changes this, the transfer will be clearly disclosed in advance and the Privacy Policy will be updated.</p>
      <h2>5. Rights in photos and required authority</h2>
      <p>The user retains all rights in the photos. AJ GmbH does not acquire ownership.</p>
      <p>For the duration and purpose of the relevant analysis job, the user grants AJ GmbH a simple, non-exclusive, non-transferable right, geographically limited to the technically required processing, to reproduce and technically process previews and metadata and transmit them to commissioned service providers where necessary to provide the service. The licence ends when processing and technically required short-term retention have ended.</p>
      <p>The user represents that the photos are selected and transmitted solely for personal or family purposes and that use does not infringe copyright, personality or other third-party rights. Where a reference photo shows another person, that person—or, where necessary, a person authorised to act for them—must have agreed to the temporary AI-assisted recognition and the technically necessary transfer of reduced images to Google.</p>
      <p>One unticked collective confirmation in the reference-photo upload field is sufficient for all reference photos in an analysis job. The user is not required to tick a separate box for each person or obtain or upload written evidence. ShortlistBuddy may rely on the accuracy of the confirmation unless there are specific indications of misuse or lack of authority.</p>
      <p>The reference-photo feature must not be used where the user knows or should know that the person objects or that the required agreement is absent. A stated refusal or withdrawal must be respected in future analysis jobs.</p>
      <h2>6. Prohibited use</h2>
      <p>Prohibited uses include illegal content; malware; automated mass requests; circumvention of technical safeguards; attacks on the service; professional, commercial or institutional use of the Persons feature; biometric matching without the required agreement; identification of unknown individuals; searching public or third-party image collections; surveillance, tracking, law-enforcement or security purposes; creation of face or person databases; biometric categorisation or emotion recognition; and any use that infringes third-party rights or the terms of our technical providers.</p>
      <p>Do not upload identity documents, medical images, intimate content or other highly sensitive images.</p>
      <p>We may stop a job, block a transfer or restrict access where there are concrete indications of misuse, security risks or legal violations. Where possible, we will take the user’s interests into account and explain the reason.</p>
      <h2>7. Data protection</h2>
      <p>The Privacy Policy explains processing of personal data, reference photos, Google and possible Google retention for up to 55 days. AJ GmbH processes selected photo and reference content solely on the user’s instructions; AJ GmbH is the controller for its own website, security, support and contractual data.</p>
      <p>The following data-processing terms apply to the extent that AJ GmbH processes photo and reference content on the user’s behalf. Optional consent, for example for geocoding or marketing, remains separate and may be refused or withdrawn.</p>
      <p>7.1 Supplementary terms for processing photo and reference content</p>
      <p>Subject matter and duration: The selected previews, reference photos, required metadata and analysis results are processed for a specific job. Processing begins when the job starts and ends after analysis and technically unavoidable short-term retention; any different Google retention is described in the Privacy Policy.</p>
      <p>Nature and purpose: Reduction, transmission, automated quality and subject analysis and, where the Persons feature is used, temporary facial matching to recognise a person specified by the user in the selected private photos.</p>
      <p>Data and data subjects: Image content, facial features, capture metadata and technical job data relating to users and to family members, friends and other persons shown in the selected private photos.</p>
      <p>Instructions and user obligations: The user gives documented instructions by selecting the photos, setting criteria, giving the collective confirmation and starting the analysis. The user must not give unlawful instructions and must inform AJ GmbH if previous authority or agreement ceases for future jobs.</p>
      <p>AJ GmbH obligations: We process content only on documented instructions, bind authorised personnel to confidentiality, implement appropriate technical and organisational security measures, provide technically possible assistance with privacy requests and incidents, and delete content in accordance with these terms and the Privacy Policy.</p>
      <p>Subprocessors: The user grants general authorisation for the providers named in the Privacy Policy and a permanently available subprocessor list, in particular Google for AI analysis and Vercel for hosting and security functions. Material changes will be published for future jobs. A user who objects must not start new analysis jobs after the change.</p>
      <p>Evidence and review: AJ GmbH will provide legally required information about safeguards and subprocessors. Individual on-site audits are permitted only where legally required and not reasonably replaceable by suitable certificates, audit reports or documentation.</p>
      <h2>8. Availability, changes and discontinuation</h2>
      <p>We aim to operate the service reliably but do not promise a specific availability level for the free beta. Maintenance, security measures, failures of internet, hosting or AI services, and force majeure may cause interruptions.</p>
      <p>We may modify functions for an objective reason, including security, legal changes, technical development, provider changes or prevention of misuse. Changes must not unreasonably disadvantage the user.</p>
      <p>We may discontinue the free beta at any time for the future. Completed local downloads remain unaffected. As no permanent account or photo archive is owed, there is no right to data migration.</p>
      <h2>9. Liability</h2>
      <p>We have unlimited liability for intent and gross negligence, culpable injury to life, body or health, liability under the German Product Liability Act, fraudulent concealment, expressly assumed guarantees and all other cases of mandatory statutory liability.</p>
      <p>For a slightly negligent breach of an essential contractual duty, liability is limited to the foreseeable loss typical for the contract at the time it was concluded. Essential duties are those whose performance is necessary for proper performance of the contract and on whose fulfilment the user may regularly rely.</p>
      <p>Liability for a slightly negligent breach of non-essential duties is excluded.</p>
      <p>To the extent permitted by law and subject to the paragraphs above, we are not liable for loss caused by the user’s failure to retain a reasonable backup, unreviewed reliance on an AI proposal or deletion of files outside ShortlistBuddy. This does not apply where the missing backup did not cause the loss or a backup was unreasonable.</p>
      <p>The limitations also apply for the benefit of our legal representatives, employees and agents.</p>
      <h2>10. Indemnity for unlawful user content</h2>
      <p>If the user culpably infringes third-party rights or applicable law and a third party asserts a claim against us, the user will indemnify us against justified claims and necessary reasonable defence costs. This does not apply where the user is not responsible for the breach. We will promptly inform the user and, where legally and practically possible, allow participation in the defence.</p>
      <h2>11. Governing law and jurisdiction</h2>
      <p>German law applies, excluding the UN Convention on Contracts for the International Sale of Goods. If the user is a consumer habitually resident in another country, mandatory consumer-protection rules of that country remain unaffected.</p>
      <p>Statutory places of jurisdiction apply to consumers. For merchants, legal entities under public law and special funds under public law, Wiesbaden is the exclusive place of jurisdiction to the extent permitted by law.</p>
      <h2>12. Consumer dispute resolution</h2>
      <p>We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.</p>
      <h2>13. Contract language and English translation</h2>
      <p>The contract language is German. The English version is provided for information. In the event of inconsistency, the German version prevails to the extent legally permissible in relation to the relevant user and subject to mandatory consumer-protection law.</p>
      <h2>14. Final provisions</h2>
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
