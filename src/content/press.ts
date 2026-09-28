// Press page content (/[locale]/press). Kept as data, like content/guides.ts,
// because it is long-form text rather than UI strings.
//
// Every product claim here is checked against the code or the privacy policy
// (fact sheet in the private sibling repo: 20-output/marketing/
// 2026-09-27_Presseansprache_Entwurf.md § 5). Privacy wording follows the list
// in Umsetzungsplan Null-Aufwand-Demo § 7 — do not strengthen it (e.g. "nothing
// is uploaded" is false: the 512 px previews go to the AI provider).
// Deliberately NOT claimed: reliable closed-eyes detection (measured unreliable
// 2026-09-27), prices of the paid tiers (not on sale), anything about the
// founder (his name was taken out of the release too — decision AJ 2026-09-28).

export const PRESS_REVISED = '2026-09-28';

export const PRESS_SCREENSHOTS = [
  { file: '1-startseite', de: 'Startseite', en: 'Home page' },
  { file: '2-demo-alle-fotos', de: 'Demo, Schritt 1: alle Beispielfotos', en: 'Demo, step 1: all sample photos' },
  { file: '3-demo-auswahl', de: 'Demo, Schritt 2: die Auswahl mit Reglern', en: 'Demo, step 2: the selection with sliders' },
  { file: '4-demo-nur-tiere', de: 'Regler „Tiere“ auf „Nur“: aus 12 Capybara-Fotos wird eins', en: '"Animals" set to "only": 12 capybara photos become one' },
  { file: '5-demo-grossansicht', de: 'Jedes Foto prüfbar', en: 'Every photo can be checked' },
  { file: '6-handy-auswahl', de: 'Auf dem Handy', en: 'On a phone' },
] as const;

type PressText = {
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  title: string;
  lead: string;
  body: string[];
  demoCta: string;
  factsTitle: string;
  facts: [string, string][];
  mediaTitle: string;
  videoTitle: string;
  videoLinks: string;
  screenshotsTitle: string;
  screenshotsNote: string;
  logo: string;
  contactTitle: string;
  contactText: string;
  revised: string;
  source: string;
};

export const PRESS: Record<'de' | 'en', PressText> = {
  de: {
    metaTitle: 'Presse',
    metaDescription:
      'Pressemitteilung, Fakten, Video und Bilder zu AuswahlBuddy – der Web-Anwendung, die aus Tausenden Urlaubsfotos die besten auswählt.',
    kicker: 'Presseinformation',
    title: 'Zwei Wochen Urlaub, vier Handys, 5.000 Fotos: AuswahlBuddy sucht die besten heraus',
    lead:
      'Smartphones machen das Fotografieren mühelos – das Aussortieren nicht. 44 Prozent schauen sich ihre Fotos und Videos später kaum noch an, nur 9 Prozent löschen regelmäßig. Nach einem Familienurlaub kommen schnell Tausende Aufnahmen zusammen, oft dieselbe Szene, fotografiert von mehreren Handys.',
    body: [
      'Die Web-Anwendung AuswahlBuddy nimmt diesen ersten Durchgang ab. Nutzer wählen ihre Fotos im Browser aus – auch nacheinander aus mehreren Ordnern oder aus Dropbox. Die Anwendung fasst Serien und ähnliche Aufnahmen zusammen, auch wenn sie von verschiedenen Kameras stammen, bewertet Schärfe und Bildwirkung und schlägt eine Auswahl vor. Wie groß sie wird und worauf es ankommt – Menschen, Tiere, Landschaft, Essen –, steuern Nutzer per Regler. Jedes Foto bleibt prüfbar; gelöscht wird nichts.',
      'Die Originale verlassen dabei das eigene Gerät nicht. Zur KI-Analyse gehen nur verkleinerte Vorschaubilder (höchstens 512 × 512 Pixel), die nicht dauerhaft gespeichert werden. Eine optionale Personensuche läuft vollständig auf dem eigenen Gerät. Für Analyse und Ergebnis ist kein Konto nötig, erst für den Download der Auswahl.',
      'Wer das Prinzip ohne eigene Fotos sehen möchte, findet auf der Website eine Demo mit 101 Beispielfotos. AuswahlBuddy befindet sich in einer öffentlichen Beta und ist bis 250 Fotos kostenlos.',
    ],
    demoCta: 'Demo ansehen',
    factsTitle: 'Fakten',
    facts: [
      ['Was', 'Web-Anwendung, die aus vielen Urlaubs- und Familienfotos eine prüfbare Auswahl vorschlägt'],
      ['Wo', 'im Browser, ohne Installation; auf Deutsch (auswahlbuddy.de) und Englisch (shortlistbuddy.com)'],
      ['Fotos', 'JPEG, PNG, HEIC (iPhone) und WebP; mehrere Ordner nacheinander oder Dropbox in einem Auftrag'],
      ['Auswahl', 'fasst Serien und ähnliche Aufnahmen zusammen, auch von verschiedenen Kameras; Regler für Menge, Ähnlichkeit, Schärfe und Motive'],
      ['Datenschutz', 'Originale bleiben auf dem Gerät; zur Analyse nur Vorschaubilder bis 512 × 512 Pixel, nicht dauerhaft gespeichert; Personensuche lokal'],
      ['KI', 'Bildanalyse mit Google Gemini (bezahlter Tarif – Eingaben werden laut Anbieterbedingungen nicht zum Training verwendet)'],
      ['Preis', 'öffentliche Beta, kostenlos bis 250 Fotos'],
      ['Studie', 'Bitkom Research, Presseinformation vom 13. Mai 2022, über 1.000 Befragte ab 16 Jahren'],
    ],
    mediaTitle: 'Video und Bilder',
    videoTitle: 'Erklärvideo (unter einer Minute, ohne Ton)',
    videoLinks: 'MP4 herunterladen',
    screenshotsTitle: 'Screenshots',
    screenshotsNote:
      'Frei zur redaktionellen Verwendung im Zusammenhang mit AuswahlBuddy. Die Beispielfotos sind teils KI-generiert (fiktive Personen und Orte); die Japanfotos sind echt.',
    logo: 'App-Symbol (PNG)',
    contactTitle: 'Kontakt',
    contactText: 'Für Fragen, Gespräche oder einen Testzugang schreiben Sie uns:',
    revised: 'Stand: 28. September 2026',
    source: 'Quelle der Zahlen: Bitkom Research, 13.05.2022',
  },
  en: {
    metaTitle: 'Press',
    metaDescription:
      'Press release, facts, video and images about ShortlistBuddy – the web app that picks the best out of thousands of holiday photos.',
    kicker: 'Press information',
    title: 'Two weeks of holiday, four phones, 5,000 photos: ShortlistBuddy picks the best',
    lead:
      'Smartphones have made taking photos effortless – sorting them has not. In a German survey, 44 percent said they hardly ever look at their photos and videos again; only 9 percent delete regularly. After a family holiday, thousands of shots pile up, often the same scene taken on several phones.',
    body: [
      'The web app ShortlistBuddy takes on that first pass. Users pick their photos in the browser – from several folders one after another, or from Dropbox. The app collapses bursts and near-duplicates, even across different cameras, rates sharpness and visual appeal, and proposes a selection. How big it gets and what matters – people, animals, landscapes, food – is up to the user, via sliders. Every photo stays checkable; nothing is deleted.',
      'The originals never leave the device. Only downscaled previews (at most 512 × 512 pixels) are sent for the AI analysis, and they are not stored permanently. An optional person search runs entirely on the device. No account is needed to analyse and see the result – only to download the selection.',
      'A demo with 101 sample photos shows the principle without uploading anything. ShortlistBuddy is in public beta and free for up to 250 photos.',
    ],
    demoCta: 'See the demo',
    factsTitle: 'Facts',
    facts: [
      ['What', 'a web app that proposes a checkable selection from large sets of holiday and family photos'],
      ['Where', 'in the browser, no install; in English (shortlistbuddy.com) and German (auswahlbuddy.de)'],
      ['Photos', 'JPEG, PNG, HEIC (iPhone) and WebP; several folders one after another or Dropbox in one job'],
      ['Selection', 'collapses bursts and near-duplicates, also across cameras; sliders for amount, similarity, sharpness and motifs'],
      ['Privacy', 'originals stay on the device; only previews up to 512 × 512 px are analysed, not stored permanently; person search on the device'],
      ['AI', 'image analysis with Google Gemini (paid tier – per the provider’s terms, inputs are not used for training)'],
      ['Price', 'public beta, free for up to 250 photos'],
      ['Survey', 'Bitkom Research (Germany), press release of 13 May 2022, over 1,000 respondents aged 16+'],
    ],
    mediaTitle: 'Video and images',
    videoTitle: 'Explainer video (under a minute, no sound)',
    videoLinks: 'Download MP4',
    screenshotsTitle: 'Screenshots',
    screenshotsNote:
      'Free for editorial use in connection with ShortlistBuddy. The sample photos are partly AI-generated (fictional people and places); the Japan photos are real.',
    logo: 'App icon (PNG)',
    contactTitle: 'Contact',
    contactText: 'For questions, interviews or test access, write to us:',
    revised: 'As of 28 September 2026',
    source: 'Source of the figures: Bitkom Research, 13 May 2022',
  },
};
