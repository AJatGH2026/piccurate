// Intent-driven guide content (product-pipeline.md §8.3). Long-form content
// lives here rather than in the next-intl message files — it's article copy,
// not UI chrome. Each guide carries its own localized slug so the URL reads
// naturally in each language (slugs are ASCII-transliterated; the visible
// copy uses real umlauts). The UI chrome (labels, breadcrumb) is translated
// via the `guides` namespace in messages/*.json.

export interface GuideStep {
  title: string;
  body: string;
}

export interface GuideFaq {
  q: string;
  a: string;
}

export interface GuideContent {
  slug: string; // localized, ASCII
  title: string; // H1 + <title>
  description: string; // meta description + lead
  intro: string[]; // opening paragraphs
  stepsHeading: string;
  steps: GuideStep[]; // → HowTo JSON-LD
  faqHeading: string;
  faqs: GuideFaq[]; // → FAQPage JSON-LD
}

export interface Guide {
  id: string; // stable across locales
  updated: string; // ISO date (YYYY-MM-DD) of the last real content change → sitemap <lastmod>
  en: GuideContent;
  de: GuideContent;
}

export const GUIDES: Guide[] = [
  {
    id: 'choose-best-travel-photos',
    updated: '2026-07-26',
    en: {
      slug: 'choose-best-travel-photos',
      title: 'How to choose the best photos from your holiday',
      description:
        'A practical method for turning hundreds of holiday snaps into a tight, memorable selection — without spending an evening second-guessing every shot.',
      intro: [
        'You come back from two weeks away with 1,500 photos and the genuine intention of doing something with them. Then the folder sits untouched for months, because going through it one picture at a time is exhausting and you keep changing your mind.',
        'The fix is not more willpower — it is a repeatable method. Below is the approach professional photo editors use, adapted for an ordinary holiday archive, plus how to do the same thing in minutes with AI.',
      ],
      stepsHeading: 'A 5-step method',
      steps: [
        {
          title: 'Cull the obvious rejects first',
          body: 'Make one fast pass and remove only the clearly broken shots: out of focus, eyes closed, accidental, badly exposed. Do not judge quality yet — just delete the unusable. This alone often removes a third of the set.',
        },
        {
          title: 'Group near-duplicates and keep one',
          body: 'Holidays produce bursts: five almost-identical shots of the same viewpoint. Look at each cluster and keep the single strongest frame — sharpest, best expression, best moment. Discard the rest.',
        },
        {
          title: 'Judge by the memory, not the pixels',
          body: 'For what remains, ask "does this picture bring the moment back?" A slightly imperfect photo of a real moment beats a technically perfect photo of nothing. This is the step software struggles with — your judgement matters most here.',
        },
        {
          title: 'Balance the story',
          body: 'A good selection covers the trip: places, people, food, details, the quiet in-between moments. If you have forty sunsets and no people, trim the sunsets. Aim for variety, not just your ten best individual frames.',
        },
        {
          title: 'Set a target number and stop',
          body: 'Decide up front how many you want — 50 for a photo book, 20 for a slideshow — and hold to it. A finished selection of 50 beats an unfinished pile of 500. When you hit the number, you are done.',
        },
      ],
      faqHeading: 'Frequently asked questions',
      faqs: [
        {
          q: 'How many photos should I keep from one holiday?',
          a: 'For a photo book, 40–80 images usually works well; for sharing, 15–30. The exact number matters less than picking a target and stopping there — an open-ended selection never gets finished.',
        },
        {
          q: 'Should I delete the rejected photos?',
          a: 'You do not have to. Keep the originals in an archive and work from a copy. Deleting is optional; the goal is a clean, small selection you actually use, not freeing up disk space.',
        },
        {
          q: 'Can AI choose the best holiday photos for me?',
          a: 'AI is very good at the mechanical steps — removing blurry shots, collapsing near-duplicate bursts, and ranking by general quality. It is weaker at "does this bring the memory back", so the best workflow is AI for the first pass, you for the final call.',
        },
        {
          q: 'How does ShortlistBuddy help?',
          a: 'ShortlistBuddy runs steps 1, 2 and 4 automatically: it scores each photo, detects series and keeps the best of each, and balances the selection, then hands you a shortlist to approve or adjust. A 1,500-photo trip becomes a reviewable shortlist in a few minutes.',
        },
      ],
    },
    de: {
      slug: 'beste-urlaubsfotos-auswaehlen',
      title: 'Die besten Urlaubsfotos auswählen — so geht es',
      description:
        'Eine praxiserprobte Methode, um aus Hunderten Urlaubsfotos eine kleine, starke Auswahl zu machen — ohne einen ganzen Abend an jedem Bild zu zweifeln.',
      intro: [
        'Du kommst mit 1.500 Fotos aus zwei Wochen Urlaub zurück und nimmst dir fest vor, etwas daraus zu machen. Dann liegt der Ordner monatelang unberührt, weil das Durchgehen Bild für Bild ermüdend ist und du ständig die Meinung änderst.',
        'Die Lösung ist nicht mehr Disziplin, sondern eine wiederholbare Methode. Hier ist das Vorgehen, das professionelle Bildredakteure nutzen — übertragen auf ein normales Urlaubsarchiv — und wie du dasselbe in wenigen Minuten mit KI erledigst.',
      ],
      stepsHeading: 'Eine Methode in 5 Schritten',
      steps: [
        {
          title: 'Zuerst die klaren Ausschüsse aussortieren',
          body: 'Geh einmal schnell durch und entferne nur die offensichtlich misslungenen Aufnahmen: unscharf, Augen zu, versehentlich ausgelöst, stark über- oder unterbelichtet. Bewerte die Qualität noch nicht — lösche nur das Unbrauchbare. Allein das entfernt oft ein Drittel.',
        },
        {
          title: 'Beinahe-Dubletten gruppieren und eine behalten',
          body: 'Im Urlaub entstehen Serien: fünf fast identische Aufnahmen desselben Motivs. Sieh dir jede Gruppe an und behalte das eine stärkste Bild — am schärfsten, bester Gesichtsausdruck, bester Moment. Den Rest verwerfen.',
        },
        {
          title: 'Nach der Erinnerung urteilen, nicht nach den Pixeln',
          body: 'Frag dich beim Rest: „Holt mich dieses Bild in den Moment zurück?" Ein leicht unvollkommenes Foto eines echten Moments schlägt ein technisch perfektes Foto von nichts. Genau hier tut sich Software schwer — dein Urteil zählt am meisten.',
        },
        {
          title: 'Die Geschichte ausbalancieren',
          body: 'Eine gute Auswahl deckt die Reise ab: Orte, Menschen, Essen, Details, die ruhigen Zwischenmomente. Wenn du vierzig Sonnenuntergänge und keine Menschen hast, kürze die Sonnenuntergänge. Ziel ist Abwechslung, nicht nur deine zehn besten Einzelbilder.',
        },
        {
          title: 'Eine Zielzahl festlegen und aufhören',
          body: 'Leg vorab fest, wie viele du möchtest — 50 fürs Fotobuch, 20 für eine Diashow — und halte dich daran. Eine fertige Auswahl von 50 schlägt einen unfertigen Stapel von 500. Ist die Zahl erreicht, bist du fertig.',
        },
      ],
      faqHeading: 'Häufige Fragen',
      faqs: [
        {
          q: 'Wie viele Fotos sollte ich aus einem Urlaub behalten?',
          a: 'Fürs Fotobuch funktionieren meist 40–80 Bilder gut, zum Teilen 15–30. Die genaue Zahl ist weniger wichtig als das Festlegen eines Ziels und das Aufhören dort — eine offene Auswahl wird nie fertig.',
        },
        {
          q: 'Soll ich die aussortierten Fotos löschen?',
          a: 'Musst du nicht. Bewahre die Originale in einem Archiv auf und arbeite mit einer Kopie. Löschen ist optional; Ziel ist eine saubere, kleine Auswahl, die du tatsächlich nutzt — nicht das Freiräumen von Speicher.',
        },
        {
          q: 'Kann KI die besten Urlaubsfotos für mich auswählen?',
          a: 'KI ist sehr gut bei den mechanischen Schritten — unscharfe Bilder entfernen, Beinahe-Dubletten zusammenfassen, nach allgemeiner Qualität sortieren. Schwächer ist sie bei „holt mich das in die Erinnerung zurück". Am besten erledigt die KI den ersten Durchgang, die finale Entscheidung triffst du.',
        },
        {
          q: 'Wie hilft AuswahlBuddy dabei?',
          a: 'AuswahlBuddy übernimmt die Schritte 1, 2 und 4 automatisch: Es bewertet jedes Foto, erkennt Serien und behält das jeweils beste, und gleicht die Auswahl aus. Danach erhältst du eine Vorauswahl zum Bestätigen oder Anpassen. Aus einer 1.500-Foto-Reise wird in wenigen Minuten eine prüfbare Auswahl.',
        },
      ],
    },
  },
  {
    id: 'prepare-photos-for-photo-book',
    updated: '2026-07-26',
    en: {
      slug: 'prepare-photos-for-photo-book',
      title: 'How to prepare your photos for a photo book',
      description:
        'Get your holiday photos ready for a photo book the easy way: how many to use, how to order them, and the cleanest way to hand them to CEWE, Mixbook or Shutterfly.',
      intro: [
        'Photo book services like CEWE, Mixbook and Shutterfly do not want you to place 1,000 photos one by one. They import a set — a folder or a cloud album — and auto-fill the pages. The work you actually need to do happens before the book editor: choosing and ordering the right set.',
        'Here is how to prepare a set that drops cleanly into any photo book tool and auto-fills into a story that makes sense.',
      ],
      stepsHeading: 'Preparing the set',
      steps: [
        {
          title: 'Pick the right number for the page count',
          body: 'Roughly 2–4 photos per page works well. A 26-page book wants about 60–90 images. Choosing too many means the auto-fill crams pages; too few leaves them empty. Decide the book size first, then the count.',
        },
        {
          title: 'Order chronologically',
          body: 'A holiday book reads best as the trip unfolded. Make sure your files are sorted by capture date, not by filename — phone and camera names rarely match the order things happened, especially across two devices.',
        },
        {
          title: 'Keep the filenames in date order',
          body: 'Most auto-fill tools place photos in filename order. If you rename files with a date prefix (e.g. 2026-06-13_001.jpg), the book fills itself in the right sequence with no manual dragging.',
        },
        {
          title: 'Put everything in one flat folder',
          body: 'Auto-fill works best from a single folder of full-resolution JPEGs — not nested subfolders, not thumbnails. Export the originals of your chosen photos into one place.',
        },
        {
          title: 'Hand it over via folder or cloud',
          body: 'Upload the folder directly in the book editor, or point it at a cloud album (CEWE, for example, imports straight from Dropbox or OneDrive). Then let auto-fill do the layout and fine-tune a few spreads.',
        },
      ],
      faqHeading: 'Frequently asked questions',
      faqs: [
        {
          q: 'How many photos do I need for a photo book?',
          a: 'Plan for about 2–4 photos per page. A typical 26-page book uses 60–90 images, a larger 50-page book 120–180. Start from the page count rather than guessing.',
        },
        {
          q: 'What resolution should the photos be?',
          a: 'Use the full-resolution originals, not thumbnails or social-media downloads. Most printers want at least ~200 dpi at print size, which a normal phone or camera photo easily meets — but a downscaled copy may print soft.',
        },
        {
          q: 'Do I have to place every photo manually?',
          a: 'No. CEWE, Mixbook and Shutterfly all offer auto-fill: you give them the set and they lay out the pages in order, which you then adjust. The selection and ordering is the real work; the placement is automatic.',
        },
        {
          q: 'How does ShortlistBuddy fit in?',
          a: 'ShortlistBuddy produces exactly this kind of set: it selects the strongest photos, sorts them by capture date, and exports either a flat ZIP of full-resolution originals or a cloud "Selection" folder that a photo book service can import directly.',
        },
      ],
    },
    de: {
      slug: 'fotos-fuers-fotobuch-vorbereiten',
      title: 'Fotos fürs Fotobuch vorbereiten — Schritt für Schritt',
      description:
        'Urlaubsfotos einfach fürs Fotobuch fertig machen: wie viele du brauchst, wie du sie ordnest und wie du sie sauber an CEWE, Mixbook oder Shutterfly übergibst.',
      intro: [
        'Fotobuch-Anbieter wie CEWE, Mixbook und Shutterfly möchten nicht, dass du 1.000 Fotos einzeln platzierst. Sie importieren ein Set — einen Ordner oder ein Cloud-Album — und befüllen die Seiten automatisch. Die eigentliche Arbeit passiert vor dem Buch-Editor: das richtige Set auswählen und ordnen.',
        'So bereitest du ein Set vor, das sich sauber in jedes Fotobuch-Tool einfügt und sich von selbst zu einer stimmigen Geschichte füllt.',
      ],
      stepsHeading: 'Das Set vorbereiten',
      steps: [
        {
          title: 'Die richtige Anzahl für die Seitenzahl wählen',
          body: 'Etwa 2–4 Fotos pro Seite funktionieren gut. Ein Buch mit 26 Seiten braucht rund 60–90 Bilder. Zu viele Fotos überfüllen beim Auto-Fill die Seiten, zu wenige lassen sie leer. Leg zuerst die Buchgröße fest, dann die Anzahl.',
        },
        {
          title: 'Chronologisch ordnen',
          body: 'Ein Urlaubsbuch liest sich am besten so, wie die Reise verlief. Achte darauf, dass die Dateien nach Aufnahmedatum sortiert sind, nicht nach Dateiname — Handy- und Kameranamen entsprechen selten der Reihenfolge der Ereignisse, besonders bei zwei Geräten.',
        },
        {
          title: 'Dateinamen in Datumsreihenfolge halten',
          body: 'Die meisten Auto-Fill-Tools platzieren Fotos in Dateinamen-Reihenfolge. Wenn du die Dateien mit einem Datums-Präfix benennst (z. B. 2026-06-13_001.jpg), füllt sich das Buch in der richtigen Reihenfolge — ganz ohne manuelles Ziehen.',
        },
        {
          title: 'Alles in einen flachen Ordner legen',
          body: 'Auto-Fill funktioniert am besten aus einem einzigen Ordner mit JPEGs in voller Auflösung — keine verschachtelten Unterordner, keine Thumbnails. Exportiere die Originale deiner gewählten Fotos an einen Ort.',
        },
        {
          title: 'Per Ordner oder Cloud übergeben',
          body: 'Lad den Ordner direkt im Buch-Editor hoch oder verweise auf ein Cloud-Album (CEWE etwa importiert direkt aus Dropbox oder OneDrive). Dann erledigt Auto-Fill das Layout, und du verfeinerst ein paar Doppelseiten.',
        },
      ],
      faqHeading: 'Häufige Fragen',
      faqs: [
        {
          q: 'Wie viele Fotos brauche ich für ein Fotobuch?',
          a: 'Rechne mit etwa 2–4 Fotos pro Seite. Ein typisches Buch mit 26 Seiten nutzt 60–90 Bilder, ein größeres mit 50 Seiten 120–180. Geh von der Seitenzahl aus, statt zu schätzen.',
        },
        {
          q: 'Welche Auflösung sollten die Fotos haben?',
          a: 'Verwende die Originale in voller Auflösung, keine Thumbnails oder Social-Media-Downloads. Die meisten Druckereien wollen mindestens ~200 dpi in Druckgröße — das erreicht ein normales Handy- oder Kamerafoto leicht, eine verkleinerte Kopie druckt dagegen unscharf.',
        },
        {
          q: 'Muss ich jedes Foto manuell platzieren?',
          a: 'Nein. CEWE, Mixbook und Shutterfly bieten alle Auto-Fill: Du gibst das Set, sie legen die Seiten der Reihe nach an, und du passt sie an. Die Auswahl und Reihenfolge ist die eigentliche Arbeit; die Platzierung läuft automatisch.',
        },
        {
          q: 'Wie passt AuswahlBuddy dazu?',
          a: 'AuswahlBuddy erzeugt genau ein solches Set: Es wählt die stärksten Fotos, sortiert sie nach Aufnahmedatum und exportiert wahlweise ein flaches ZIP mit Originalen in voller Auflösung oder einen Cloud-Ordner „Auswahl", den ein Fotobuch-Dienst direkt importieren kann.',
        },
      ],
    },
  },
  {
    id: 'ai-photo-culling',
    updated: '2026-07-26',
    en: {
      slug: 'ai-photo-culling',
      title: 'AI photo culling: what it is and how it works',
      description:
        'A plain explanation of AI photo culling — how software decides which photos to keep, what it does well, where it falls short, and how to use it without losing control.',
      intro: [
        'Photo culling means reducing a large set of photos to the keepers. "AI photo culling" is doing that with software that scores and ranks images for you, instead of judging each one by hand.',
        'It is increasingly built into photo tools because the problem is universal: phones make it trivial to take 1,000 photos and painful to choose between them. Here is what the technology actually does.',
      ],
      stepsHeading: 'How AI culling works',
      steps: [
        {
          title: 'Technical quality scoring',
          body: 'The software measures sharpness, exposure and noise, and flags shots that are out of focus or badly lit. This is the most reliable part — it is a well-defined visual measurement.',
        },
        {
          title: 'Duplicate and series detection',
          body: 'It finds near-identical frames (burst shots, repeated viewpoints) by comparing images, then keeps the best of each cluster instead of all of them. This removes the bulk of the redundancy.',
        },
        {
          title: 'Content and face analysis',
          body: 'Modern models recognise what is in the frame — people, landscapes, food — and check faces for open eyes and natural expressions, so a group shot where everyone is smiling ranks above one where someone blinked.',
        },
        {
          title: 'Holistic ranking',
          body: 'The best tools combine these signals into a single "would you keep this?" score and surface the top images, rather than just filtering on one rule. You then review the shortlist.',
        },
      ],
      faqHeading: 'Frequently asked questions',
      faqs: [
        {
          q: 'What does "culling" mean?',
          a: 'Culling is the editing step where you reduce a large shoot to the selects — the photos worth keeping, editing or printing. The term comes from professional photography, where a wedding or event can produce thousands of frames.',
        },
        {
          q: 'Is AI photo culling accurate?',
          a: 'For technical quality and duplicates, very. For subjective "best" it is good but not perfect — taste and personal meaning are hard to model. Treat it as a strong first pass that gets you to a shortlist, not a final verdict.',
        },
        {
          q: 'Will AI delete my photos?',
          a: 'Good tools never delete anything. They rank and pre-select; you keep full control and the originals are untouched. ShortlistBuddy, for example, only ever proposes a selection for you to approve or change.',
        },
        {
          q: 'Does AI culling work on my own device or in the cloud?',
          a: 'It varies by tool. Some run entirely on-device for privacy; others send images to a server for analysis. If privacy matters, check where the analysis happens before uploading a personal archive.',
        },
      ],
    },
    de: {
      slug: 'ki-fotoauswahl-erklaert',
      title: 'KI-Fotoauswahl: was das ist und wie es funktioniert',
      description:
        'Verständlich erklärt: Wie KI-gestützte Fotoauswahl entscheidet, welche Bilder bleiben — was sie gut kann, wo sie an Grenzen stößt und wie du sie nutzt, ohne die Kontrolle abzugeben.',
      intro: [
        'Fotoauswahl bedeutet, eine große Menge Bilder auf die Behalter zu reduzieren. „KI-Fotoauswahl" erledigt das mit Software, die Bilder für dich bewertet und sortiert, statt jedes einzelne von Hand zu beurteilen.',
        'Die Technik steckt zunehmend in Foto-Tools, weil das Problem alle betrifft: Mit dem Handy sind 1.000 Fotos schnell gemacht und mühsam zu sortieren. Hier ist, was sie tatsächlich leistet.',
      ],
      stepsHeading: 'Wie KI-Auswahl funktioniert',
      steps: [
        {
          title: 'Bewertung der technischen Qualität',
          body: 'Die Software misst Schärfe, Belichtung und Rauschen und markiert unscharfe oder schlecht belichtete Aufnahmen. Das ist der zuverlässigste Teil — eine klar definierte visuelle Messung.',
        },
        {
          title: 'Dubletten- und Serienerkennung',
          body: 'Die Software findet nahezu identische Aufnahmen (Serienbilder, wiederholte Motive) durch Bildvergleich und behält dann das jeweils beste statt aller. Das entfernt den Großteil der Redundanz.',
        },
        {
          title: 'Inhalts- und Gesichtsanalyse',
          body: 'Moderne Modelle erkennen den Bildinhalt — Menschen, Landschaften, Essen — und prüfen Gesichter auf offene Augen und natürliche Ausdrücke. So steht ein Gruppenfoto, auf dem alle lächeln, über einem, bei dem jemand geblinzelt hat.',
        },
        {
          title: 'Ganzheitliche Bewertung',
          body: 'Die besten Tools fassen diese Signale zu einem einzigen „Würde man das behalten?"-Wert zusammen und zeigen die Top-Bilder, statt nur nach einer Regel zu filtern. Anschließend prüfst du die Vorauswahl.',
        },
      ],
      faqHeading: 'Häufige Fragen',
      faqs: [
        {
          q: 'Was bedeutet „Fotoauswahl" oder „Culling"?',
          a: 'Damit ist der Schritt gemeint, eine große Aufnahme-Menge auf die Selects zu reduzieren — die Bilder, die es wert sind, behalten, bearbeitet oder gedruckt zu werden. Der Begriff stammt aus der professionellen Fotografie, wo eine Hochzeit Tausende Aufnahmen ergeben kann.',
        },
        {
          q: 'Ist KI-Fotoauswahl genau?',
          a: 'Bei technischer Qualität und Dubletten sehr. Beim subjektiv „besten" Bild ist sie gut, aber nicht perfekt — Geschmack und persönliche Bedeutung lassen sich schwer modellieren. Betrachte sie als starken ersten Durchgang zur Vorauswahl, nicht als endgültiges Urteil.',
        },
        {
          q: 'Löscht die KI meine Fotos?',
          a: 'Gute Tools löschen nie etwas. Sie sortieren und treffen eine Vorauswahl; du behältst die volle Kontrolle, und die Originale bleiben unangetastet. AuswahlBuddy etwa schlägt immer nur eine Auswahl vor, die du bestätigst oder änderst.',
        },
        {
          q: 'Läuft KI-Auswahl auf meinem Gerät oder in der Cloud?',
          a: 'Das hängt vom Tool ab. Manche laufen aus Datenschutzgründen vollständig auf dem Gerät, andere senden Bilder zur Analyse an einen Server. Wenn dir Datenschutz wichtig ist, prüfe vor dem Hochladen eines persönlichen Archivs, wo die Analyse stattfindet.',
        },
      ],
    },
  },
];

/** All { locale, slug } pairs for generateStaticParams. */
export function guideParams(): { locale: string; slug: string }[] {
  return GUIDES.flatMap((g) => [
    { locale: 'en', slug: g.en.slug },
    { locale: 'de', slug: g.de.slug },
  ]);
}

/** Find a guide's content by locale + localized slug. */
export function getGuide(locale: string, slug: string): { guide: Guide; content: GuideContent } | null {
  const loc = locale === 'de' ? 'de' : 'en';
  const guide = GUIDES.find((g) => g[loc].slug === slug);
  return guide ? { guide, content: guide[loc] } : null;
}
