# iPhone-App: Optionen & PWA-Umsetzung

Referenz für die Frage "wie bekommen wir AuswahlBuddy aufs iPhone" — welche
Wege es gibt, warum die PWA gewählt wurde, und was am 2026-09-05 umgesetzt
und live auf einem echten iPhone getestet wurde.

> **TL;DR:** Kein natives Xcode-Projekt. AuswahlBuddy ist jetzt als
> **installierbare PWA** nutzbar — "Zum Home-Bildschirm hinzufügen" in Safari
> liefert ein eigenes App-Icon (Kamera-Buddy-Maskottchen), startet ohne
> Safari-Adressleiste (Standalone-Modus) und landet direkt in der Sprache, aus
> der heraus installiert wurde. Kosten: **0 €**. Auf einem echten iPhone
> getestet — funktioniert.

---

## 1. Die drei Optionen

| Option | Aufwand | Kosten | App Store? |
|---|---|---|---|
| **PWA** (gewählt) | Stunden, kein Rebuild nötig — Next.js liefert die App schon als Website | 0 € | Nein — nur "Zum Home-Bildschirm" |
| **Capacitor-Wrapper** | Tage bis wenige Wochen — bestehendes React/Next.js-Frontend in native Shell verpackt, Xcode + Mac zum Bauen/Signieren nötig | 99 USD/Jahr (Apple Developer Program) | Ja |
| **Nativ (Swift/SwiftUI)** | Wochen bis Monate — praktisch ein Rebuild des Frontends | 99 USD/Jahr + Entwicklerzeit | Ja |

Der Apple-Developer-Program-Beitrag (99 USD/Jahr) fällt **nur** für Weg 2 und 3
an — er ist Pflicht für jede App-Store-Distribution, unabhängig vom Preis der
App. Bei der PWA gibt es keine Store-Gebühr, keine Review-Wartezeit, keine
Commission (die 15–30 % Apple-Anteil gilt nur bei In-App-Käufen).

## 2. Entscheidung

Für den Beta-Status: **PWA**. Kein Zusatzaufwand außerhalb dessen, was hier am
2026-09-05 umgesetzt wurde; App-Store-Sichtbarkeit lässt sich später mit
Capacitor nachrüsten, ohne das Frontend neu zu bauen, falls das je gebraucht
wird.

## 3. Icon-Design-Prozess

Mehrere Konzeptrunden, alle auf den bestehenden Markenfarben aufgebaut
(Indigo `#4f46e5` — bereits die CTA-Farbe der App — plus Amber `#f59e0b` als
Akzent):

1. Sechs nicht-personifizierte Konzepte: Fotostapel mit Häkchen, Trichter,
   Rahmen mit Stern, Raster mit Favorit, Foto mit Herz, Monogramm "A".
2. Vier "Buddy"-Maskottchen-Varianten (Wunsch: das "Buddy/Helfer" aus dem
   Markennamen sichtbar machen): Rahmen-Buddy, Winke-Buddy, Kamera-Buddy,
   Stern-Buddy.
3. Homescreen-Mockup-Vergleich (Rahmen mit Stern vs. Kamera-Buddy) zwischen
   generischen Platzhalter-Apps — Kamera-Buddy stach durch das große
   Objektiv-Auge deutlicher heraus.
4. Verfeinerung: runderer Korpus, größeres Auge mit zweitem Lichtreflex,
   winkender Arm (transportiert "Helfer" aktiv statt nur ein Gesicht zu
   zeigen), kräftigere ovale Füße. Ein zunächst ergänzter Auslöserknopf wurde
   auf Wunsch wieder entfernt.
5. Bei drei Größen (150px / 60px / 28px) gegengeprüft, dass die Silhouette
   auch bei Spotlight-Suchgröße noch trägt.

**Finale Wahl: Kamera-Buddy** — eine Kamera mit großem Objektiv als Auge,
winkendem Arm, auf Indigo-Grund.

## 4. Technische Umsetzung

| Datei | Zweck |
|---|---|
| [`src/app/icon.svg`](../src/app/icon.svg) | Favicon für moderne Browser (Vektor, scharf bei jeder Zoomstufe) |
| [`src/app/apple-icon.png`](../src/app/apple-icon.png) | 180×180 — iOS-Homescreen-Icon (`apple-touch-icon`) |
| [`src/app/favicon.ico`](../src/app/favicon.ico) | 48×48 — Legacy-Fallback (ersetzt den alten Next.js-Default) |
| [`public/icon-192x192.png`](../public/icon-192x192.png) | Manifest/Android |
| [`public/icon-512x512.png`](../public/icon-512x512.png) | Manifest/Android, Splash-Screens |
| [`public/manifest-de.json`](../public/manifest-de.json) | Name "AuswahlBuddy", `start_url: /de` |
| [`public/manifest-en.json`](../public/manifest-en.json) | Name "ShortlistBuddy", `start_url: /en` |

Alle PNGs sind aus einer einzigen SVG-Quelle (in `gen-icons.mjs`, nur
temporär für den Export angelegt und wieder gelöscht) mit dem bereits im
Projekt vorhandenen `sharp` gerendert — keine neue Abhängigkeit nötig.

### Warum zwei Manifeste statt einem

Next.js' `manifest.json`-Dateikonvention (`src/app/manifest.json`) erkennt nur
**eine einzige** Datei am echten App-Root automatisch — keine Locale-Variante.
Deshalb liegen zwei statische Manifeste in `public/`, und
`generateMetadata` in [`[locale]/layout.tsx`](../src/app/[locale]/layout.tsx)
setzt das `manifest`-Feld explizit pro Route:

```ts
manifest: `/manifest-${locale}.json`,
```

Das überschreibt den root-weiten Auto-Eintrag pro Request — Standard-Next.js-
Metadata-Merging (Kind-Segment gewinnt bei singulären Feldern).

### Zwei Bugs unterwegs gefunden und mitgefixt

- **`start_url` zeigte auf `/`.** `/` leitet aber hart auf `/en` weiter
  ([`src/app/page.tsx`](../src/app/page.tsx)) — eine auf Deutsch installierte
  PWA wäre beim Öffnen vom Homescreen auf Englisch gelandet. Jetzt zeigt jedes
  Manifest auf seine eigene Locale.
- **Apple-spezifische Meta-Tags fehlten komplett** (`mobile-web-app-capable`,
  `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style`). Das
  Web-App-Manifest allein steuert bei iOS Safari nicht zuverlässig den
  Standalone-Modus (keine Adressleiste) oder den Namen unter dem Icon —
  historisch braucht iOS dafür zusätzlich das `appleWebApp`-Metadata-Feld.
  Fiel erst beim Vorbereiten des echten Geräte-Tests auf, weil bis dahin nur
  Head-Tags im Browser geprüft wurden, nicht das tatsächliche iOS-Verhalten.

### Theme-Farbe

`viewport`-Export mit `themeColor: '#4f46e5'` in `[locale]/layout.tsx` —
färbt Safari/Chrome-Chrome auf Mobile im Markenton.

## 5. Verifikation

- Head-Tags live auf `shortlistbuddy.com` für `/de` und `/en` geprüft
  (`rel="icon"`, `rel="apple-touch-icon"`, `rel="manifest"`,
  `apple-mobile-web-app-*`, `theme-color`) — jeweils korrekt und
  locale-spezifisch.
- `npx tsc --noEmit` sauber nach jeder Änderung.
- **Auf echtem iPhone getestet (Andreas, 2026-09-05): funktioniert
  einwandfrei** — Icon + Name korrekt in der Safari-"Zum Home-Bildschirm"-
  Vorschau, öffnet danach im Standalone-Modus ohne Adressleiste, landet
  direkt in der installierten Sprache.

Commits (beide auf `master`, 2026-09-05 — referenziert nach Datum + Betreff,
nicht Hash, siehe `CLAUDE.md`):
- *"feat(pwa): add app icon set and per-locale web app manifest"*
- *"fix(pwa): add apple-mobile-web-app meta tags for standalone iOS install"*

## 6. Bewusst nicht gemacht

- **Service Worker / Offline-Support.** Nicht Teil dieser Runde — "Zum
  Home-Bildschirm" funktioniert auch ohne. Nachrüstbar, falls Offline-Nutzung
  je gebraucht wird (z. B. via Serwist, siehe Next.js-PWA-Guide).
- **Maskable-Icon-Variante** für Android Adaptive Icons (eigene Safe-Zone,
  striktere Beschneidung als iOS). Aktuell nur "any"-Icons im Manifest — für
  den iPhone-Fokus dieser Runde nicht nötig.
- **1024×1024-Vektor-Master fürs App-Store-Icon.** Nur bis 512×512 gerendert;
  falls doch mal der Capacitor-/Native-Weg kommt, braucht der App Store Connect
  Upload eine 1024×1024-PNG ohne Alpha-Kanal — aus derselben SVG-Quelle in
  Minuten nachrenderbar.
- **`favicon.ico` ist ein einzelnes 48×48-Bild** in einem minimalen
  ICO-Container (kein Multi-Size-ICO mit 16/32/48px-Varianten). Moderne
  Browser bevorzugen ohnehin `icon.svg`; das `.ico` ist nur der Fallback für
  sehr alte Clients.
