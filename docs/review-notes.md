# Review-Notizen & offene Punkte

Befunde, die eine spätere Entscheidung verändern würden — nicht als Tagebuch,
sondern als das, was man vor dem nächsten Eingriff wissen will. Stand: 2026-08-30.

Der Arbeitsverlauf steht in `docs/PicCurate-WorkLog.md` (lokal, gitignored);
hier steht nur, was für Code-Reviews dauerhaft relevant bleibt.

---

## Offene Punkte

### 1. Job-Eigentum geht beim Login am Download-Gate verloren

**Symptom:** `POST /api/jobs/<id>/confirmation` antwortet 404, die § 312f-Bestätigung
wird nie gemailt.

**Ursache:** Die Analyse läuft anonym, der Job gehört dem anonymen Supabase-Nutzer.
`DownloadAccountGate` hat zwei Wege:

- *Registrieren* → `supabase.auth.updateUser({ email })` wandelt den anonymen Nutzer
  um. **Gleiche user id**, alles passt.
- *Anmelden* → `signInWithPassword` ersetzt die Sitzung durch ein **anderes** Konto.
  Die Eigentumsprüfung in `confirmation/route.ts` schlägt fehl.

Der Registrier-Zweig trägt bereits einen Kommentar über genau diese Gefahr
("would orphan the anonymous one this result belongs to") — für den Login-Zweig
wurde sie übersehen.

**Wirkung:** Jeder wiederkehrende Nutzer, der sich anmeldet statt zu registrieren,
bekommt die Bestätigung nicht per Mail. Der Download funktioniert, und der
Bildschirmtext auf `/results` erfüllt die Pflicht laut eigenem Design bereits —
die beabsichtigte Zustellung fällt aber still aus.

**Entwurf (NICHT umgesetzt, bewusst offen):** Zwei-Schritt-Handshake statt
Eigentumsübertragung beim Login. Noch anonym — also solange die Sitzung den Job
nachweislich besitzt — holt der Client ein einmaliges, kurzlebiges Claim-Token;
nach dem Login löst er es ein, der Server überträgt und entwertet es.

> ⚠️ **Vor der Umsetzung klären:** Die Registrierungs-Barriere wurde am 2026-08-27
> bewusst ans Ende verschoben (nutzerfreundlich *und* datensparsam). Jede Regel der
> Form „Anmelden übernimmt einen anonym angelegten Job" muss daraufhin geprüft
> werden, ob sie diese Konstruktion aushöhlt. Das ist keine reine Technikfrage.

### 2. Eigener Verkehr verfälscht die Messung — behoben 2026-08-31

`/admin/stats` konnte Test-Sitzungen der Betreiber nicht von echten Besuchern
trennen. In der Woche bis 2026-08-30 führte das zu Zahlen wie
`results_shown 20 → download_completed 19` (95 %), was für Kaltverkehr über
Suchanzeigen unrealistisch ist und sich mit „keine neuen Nutzer in Supabase"
widerspricht — beides erklärte sich durch eigene Tests.

**Fix:** ein `qa_mode`-Cookie (`src/lib/qa-mode.ts`), gesetzt über
`/api/qa-mode?token=<ADMIN_TOKEN>` (Link dazu jetzt oben auf `/admin/stats`).
Vor einem eigenen Testlauf einmal öffnen — httpOnly, ~180 Tage gültig, kein
erneutes Setzen pro Lauf nötig. Jede event-schreibende Route (`/api/ev`,
`/api/beta`, `analyze-demo`'s `ai_cost_estimate`) liest das Cookie und markiert
den Datensatz als `internal`; `readEventSignals()` schließt ihn aus allen
Trichter-/Kampagnenzahlen aus (Rohereignis bleibt im Log erhalten, nur die
Aggregate sind bereinigt), das ältere `lib/beta.ts`-Zählersystem überspringt
das Inkrementieren ganz. Beide Panels zeigen die ausgeschlossene Anzahl an —
keine stille Filterung.

**Nicht gelöst, bewusst:** rückwirkend nichts — Daten vor Einführung des
Cookies bleiben ungefiltert in den Zahlen. Und ein Gerät zählt nur dann als
intern, wenn dort vorher aktiv der Link geöffnet wurde; ein vergessener Toggle
auf einem neuen Testgerät verfälscht wieder, still, bis es auffällt.

**Nachtrag, selbes Datum:** der erste Durchgang deckte nur `lib/events.ts`
(Kampagnen-Trichter) und `lib/beta.ts` (alter Zähler) ab — die
„Usage"-Karte oben auf der Seite (`lib/stats.ts`, `stats:jobs:*`/
`stats:photos:*`, gespeist aus `trackAnalyze()`) blieb unberührt. Ein eigener
Testlauf mit aktivem QA-Modus erschien dort weiterhin voll mitgezählt — zu
Recht bemerkt, denn „Punkt 2 umgesetzt" hatte implizit die ganze Seite
gemeint. Anders als bei den beiden Trichtern **bewusst nicht ausgeschlossen**:
die Usage-Karte misst tatsächliche Gemini-Kosten, und ein eigener Testlauf
ist echter, angefallener Spend, keine Verzerrung, die verschwinden sollte.
Stattdessen zeigt die Karte jetzt zusätzlich, wie viel vom Gesamtbetrag
eigene Tests waren (`stats:*:internal:*`, addiert zum Gesamtwert, nicht
subtrahiert).

### 3. Google Ads / Cookies — Grundsatzentscheidung offen

Der Code kann Ads-Conversions melden (`lib/analytics.ts`,
`trackAdsAnalysisStarted`), ist aber **inaktiv**: ohne
`NEXT_PUBLIC_GOOGLE_ADS_ID` lädt `GoogleTag.tsx` nichts, und alle Aufrufe sind
No-Ops.

**Das ist Absicht.** Siehe die Prüfregel unten — die Datenschutzerklärung schließt
diese Dienste derzeit ausdrücklich aus. Aktivierung erst nach bewusster
Entscheidung und vorheriger Textänderung.

Fachlicher Hinweis für diese Entscheidung: Smart Bidding braucht Größenordnung
30 Conversions/Monat, um zu lernen. Bei ~87 Klicks/Woche wäre der Nutzen
vorerst ohnehin gering.

---

## Prüfregeln, die aus konkreten Vorfällen stammen

### Rechtstexte prüfen, BEVOR etwas eingeschaltet wird

Vor jedem Fremdskript, Cookie oder Speicherzugriff **zuerst**
`src/app/[locale]/privacy/page.tsx` und `terms/page.tsx` lesen. Die
Datenschutzerklärung enthält ausdrückliche **negative** Zusagen, die Code still
entwerten kann:

| Fundstelle | Zusage |
|---|---|
| § 9 (Ende) | Google Analytics, **Google Ads**, Meta-Pixel „sind nicht aktiv"; bei späterem Einsatz wird die Erklärung **vorab** aktualisiert |
| § 9.1 | Klick-Kennungen wie `gclid`/`fbclid` werden „nicht gespeichert und nicht ausgewertet" |
| § 9.1 | Sitzungskennung nur im Arbeitsspeicher → „weder Einwilligung nach § 25 TDDDG noch Cookie-Banner erforderlich" |
| § 9.2 | Vercel Analytics „ohne Cookies und ohne sonstigen Zugriff auf dein Endgerät" |

Ein Konfigurationsschalter genügt, um jede dieser Aussagen unwahr zu machen —
`GoogleTag.tsx` lädt `googletagmanager.com` für **jeden** Besucher, sobald eine
Tag-ID gesetzt ist, unabhängig von der späteren Einwilligung.

### Aufbewahrungsfristen begrenzen, was ein Export enthalten darf

§ 11 erlaubt die Ereignisse aus § 9.1 **90 Tage in Einzelform**, danach nur noch
aggregiert **ohne Sitzungs- oder Kontobezug**.

Eine Datei kennt keine Ablauffrist. Ein Export von Roh-Ereignissen würde die
90-Tage-Grenze still in ein unbefristetes Archiv verwandeln — die Zusage stünde
weiter im Text, aber nicht mehr in der Wirklichkeit. `/admin/stats/export` liest
deshalb ausschließlich Tageszähler: keine Sitzungs-/Kontokennung, keine
Kampagnen- oder Gerätezuordnung, keine IP, kein Feedback-Text.

Tatsächliche Fristen im Code: Roh-Ereignisse 30 Tage (`lib/events.ts`),
Tageszähler 90 (`lib/stats.ts`, `lib/beta.ts`), IP-Schlüssel 2 Tage.

### Ereigniszähler nicht nebeneinanderstellen ohne Kennzeichnung

`/admin/stats` zeigt rohe Zähler und mischt dabei Ereignisse, die **einmal pro
Sitzung** feuern (`demo_start`, `analysis_started`), mit solchen, die **mehrfach**
feuern:

- `analysis_progress` — bis zu 3× pro Lauf (Schwellen 25/50/75 %)
- `file_transfer_ready` — einmal pro Verarbeitungsstapel

Das sieht nach Widerspruch aus (24 Starts, 64 Progress-Ereignisse), obwohl beide
Zahlen stimmen. Kandidat für eine Kennzeichnung im Dashboard.

### Bei Performance-Fragen messen statt herleiten

Am 2026-08-29 wurden Upload-Zeiten zweimal aus der Architektur erklärt, und beide
Male lag die Erklärung daneben. Die tatsächliche Ursache — `/api/convert` scheiterte
an einer fehlenden `libvips`-Bibliothek, wodurch jedes HEIC über den langsamen
Browser-Pfad ging **und** zuvor einen vergeblichen Voll-Upload kostete — fand erst
die Instrumentierung (`utils/upload-timing.ts`, Panel „Upload-Phasen").

Gemessene Größenordnungen zur Einordnung:

| | pro Foto |
|---|---|
| Upload ohne Personensuche | ~1,1 s — praktisch vollständig Netzwerk + Server, geräteunabhängig |
| Upload mit Personensuche | ~2,2 s (aktuelles Notebook), ~3,0 s (älteres) |
| Übergabe durch iOS nach der Fotoauswahl | ~110 ms, linear, außerhalb unseres Einflusses |

Der Aufschlag der Personensuche ist echte Rechenzeit dreier serialisierter Modelle
(CLIP, YuNet, FaceNet), **nicht** Wartezeit in der Warteschlange — das war die
widerlegte Hypothese.

---

## Abhängigkeiten (Stand 2026-08-30)

Offene Dependabot-PRs, bewertet:

- **`@types/uuid` 10 → 11:** PR schließen. `uuid` v14 bringt eigene Typen mit
  (`types`-Feld in dessen `package.json`); das Paket kann ersatzlos aus den
  devDependencies entfernt werden.
- **`eslint` 9 → 10:** zurückstellen. Major, nur Werkzeug. `eslint-config-next` ist
  an Next 16.2.x gekoppelt und unterstützt ESLint 10 vermutlich noch nicht.
- **`minor-and-patch` (18 Pakete):** nicht als Block mergen. Enthält trotz des
  Namens `next 16.2.12 → 16.3.2` sowie `@google/genai` und `@supabase/supabase-js`.
  `sharp` ist nicht enthalten. Aufteilen: risikoarme Pakete zusammen, `next` und
  `@google/genai` einzeln und mit echtem Foto-Upload gegen eine Preview getestet.

**Warum bei Next besondere Vorsicht:** Der Ausfall vom 2026-08-29 lag in Next'
File-Tracing — behoben über `outputFileTracingIncludes` in `next.config.ts`, das
`@img/sharp-libvips-linux-x64` erzwingt. Ein Next-Sprung kann dieses Verhalten
erneut verändern. Nach jedem Next-Update prüfen, ob `/api/convert` noch 200 liefert.
