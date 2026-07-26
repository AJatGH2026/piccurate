# AuswahlBuddy — Deployment-Anleitung (Prototyp)

Schritt-für-Schritt, um den Prototyp für externe Tester verfügbar zu machen.
Zielplattform: **Vercel** (kostenlos, ideal für Next.js).

---

## Brauche ich eine Domain?

**Nein.** Vercel vergibt automatisch eine kostenlose Adresse wie
`https://piccurate-xxxx.vercel.app`. Das reicht zum Teilen. Eine eigene Domain
ist optional (nur fürs Branding) und kann jederzeit später ergänzt werden.

---

## Voraussetzungen (einmalig, beides kostenlos)

1. Ein **GitHub-Konto** — https://github.com/signup
2. Ein **Vercel-Konto** — https://vercel.com/signup (am einfachsten „Continue with GitHub")

---

## Schritt 1 — Code zu GitHub bringen

Der Code liegt lokal als Git-Repository (Branch `master`), hat aber noch kein
GitHub-Ziel. Geheimnisse (`.env.local`) und `node_modules` sind ignoriert und
werden **nicht** hochgeladen.

1. Auf GitHub ein **neues, leeres Repository** anlegen (z. B. `piccurate`),
   **ohne** README/Lizenz/gitignore (Repo muss leer sein).
2. Im Projektordner (`C:\CLAUDE\MyProjects\tpai`) im Terminal:

   ```bash
   git remote add origin https://github.com/<DEIN-NAME>/piccurate.git
   git push -u origin master
   ```

   (Optional, falls du den Branch lieber `main` nennst:
   `git branch -M main && git push -u origin main`.)

> Alternative ohne GitHub: `npm i -g vercel` und im Projektordner `vercel`
> ausführen — deployt direkt vom Rechner. Der GitHub-Weg ist aber komfortabler,
> weil jeder spätere `git push` automatisch neu deployt.

---

## Schritt 2 — Projekt in Vercel importieren

1. Auf https://vercel.com/new das GitHub-Repo auswählen → **Import**.
2. Vercel erkennt **Next.js** automatisch. Build-Einstellungen **nicht ändern**.
3. **Noch nicht** auf „Deploy" klicken — erst die Environment-Variablen setzen
   (Schritt 3). Falls schon deployt: nach Schritt 3 einmal neu deployen.

---

## Schritt 3 — Environment-Variablen setzen

In Vercel: **Project → Settings → Environment Variables**. Diese eintragen
(für „Production" und gern auch „Preview"):

| Name | Wert | Pflicht? | Geheim? |
|------|------|----------|---------|
| `GEMINI_API_KEY` | dein Google-AI-Studio-Key (aistudio.google.com/app/apikey) | **ja** | **geheim** |
| `GEMINI_MODEL` | `gemini-2.5-flash` | optional (Default vorhanden) | nein |
| `NEXT_PUBLIC_APP_URL` | die Vercel-URL (nach 1. Deploy bekannt — siehe Schritt 5) | **ja** | nein |
| `NEXT_PUBLIC_DROPBOX_APP_KEY` | dein Dropbox-App-Key | nur für Cloud-Import/-Export | nein (öffentlich) |
| `SITE_USER` | z. B. `demo` | für das Zugangs-Gate | nein |
| `SITE_PASSWORD` | ein selbst gewähltes Passwort | **für das Gate** | **geheim** |
| `ANTHROPIC_API_KEY` | — | **nicht mehr nötig** (nur für Eval-Skripte) | — |

**Nicht setzen / weglassen:**
- `VIPSTHUMBNAIL_PATH` — der Windows-Pfad existiert auf dem Linux-Host nicht;
  HEIC läuft automatisch über den WASM-Fallback.
- Supabase-/Stripe-Variablen — für den Demo-Flow nicht nötig (Auth/Bezahlung
  sind späteres Thema).

> **Wichtig zum Gate:** `SITE_PASSWORD` muss als echte Vercel-Variable gesetzt
> sein (nicht in `.env.local`). Nur dann schützt das Passwort-Gate die Seite.
> Solange `SITE_PASSWORD` leer/ungesetzt ist, ist die Seite **offen**.

---

## Schritt 4 — Kostendeckel bei Google setzen (wichtig!)

Der Analyse-Endpoint kostet pro Nutzung Google-Cloud-Guthaben (Gemini 2.5
Flash: ~$0.30 Input / $2.50 Output pro 1M Tokens — für AuswahlBuddy ca. $0.0005
pro Foto). Auch mit Passwort-Gate gilt: **Budget-Alarm setzen** als harte
Obergrenze.

- Google Cloud Console → **Billing → Budgets & alerts** → neues Budget mit
  Alarm bei 50 %/90 %/100 % des Monatsbetrages.

---

## Schritt 5 — Deployen und URL holen

1. In Vercel **Deploy** klicken (bzw. Deployment läuft nach dem Import).
2. Nach ~1–2 Minuten zeigt Vercel die Live-URL, z. B.
   `https://piccurate-xxxx.vercel.app`. **Diese URL kopieren.**

---

## Schritt 6 — URL-abhängige Einstellungen nachziehen

Jetzt, wo die URL bekannt ist:

1. **`NEXT_PUBLIC_APP_URL`** in Vercel auf genau diese URL setzen
   (Settings → Environment Variables) → steuert Sitemap, robots, llms.txt,
   Canonical-Links **und** die Cloud-OAuth-Weiterleitungen.
2. **Dropbox** (falls Cloud-Import/-Export genutzt wird): in der Dropbox-App
   (dropbox.com/developers/apps) unter „Redirect URIs" die Produktions-URL
   ergänzen: `https://<deine-url>/en/cloud/callback`.
3. In Vercel **neu deployen** (Deployments → … → Redeploy), damit
   `NEXT_PUBLIC_APP_URL` greift.

---

## Schritt 7 — Testen

1. Die Live-URL öffnen → der Browser fragt nach **Benutzer/Passwort**
   (= `SITE_USER` / `SITE_PASSWORD`). Eingeben → Seite lädt.
2. Kompletten Ablauf testen: Fotos hochladen → analysieren → prüfen →
   ZIP herunterladen. (HEIC-Upload ist auf dem Server etwas langsamer.)
3. Falls Cloud genutzt: Dropbox-Import/-Export einmal durchspielen.

---

## Schritt 7b (optional, empfohlen) — Admin-Dashboard für Nutzungsstatistiken

Damit du jederzeit nachvollziehen kannst, wie viele Fotos analysiert wurden
(und was sie ungefähr gekostet haben), gibt es ein einfaches Dashboard unter
**`https://<deine-url>/admin/stats`** — geschützt durch dasselbe Passwort wie
der Rest der Seite.

Das Dashboard braucht eine kleine Datenbank. Setup in **5 Minuten**:

1. Vercel-Dashboard → dein Projekt → **Storage** → **Create Database**.
2. **Upstash Redis** auswählen → gratis-Tier („Free") reicht locker
   (~10 000 Operationen/Tag — wir brauchen ~10 pro Analyse).
3. Beim Erstellen die Frage „mit Projekt verbinden?" mit **Ja** beantworten.
   Vercel setzt automatisch die Env-Variablen `UPSTASH_REDIS_REST_URL` und
   `UPSTASH_REDIS_REST_TOKEN` für dich.
4. Einmal neu deployen (Deployments → ⋯ → Redeploy).

Danach wird **jede** Analyse automatisch gezählt. Das Dashboard zeigt:
Lifetime-Total + heute + letzte 7 Tage, plus eine grobe Kostenschätzung
(Sonnet-4.6-Preise). Wenn du das Setup nicht machst, funktioniert die App
ganz normal — nur das Dashboard meldet „noch nicht konfiguriert".

## Schritt 8 — Mit Testern teilen

URL **und** Zugangsdaten (`SITE_USER` / `SITE_PASSWORD`) an die eingeladenen
Tester geben. Mehr ist nicht nötig — kein Konto, keine Installation.

---

## Später: eigene Domain (optional)

Vercel → Project → Settings → **Domains** → Domain hinzufügen und den DNS-
Anweisungen folgen. Danach `NEXT_PUBLIC_APP_URL` auf die neue Domain setzen und
die Dropbox-Redirect-URI ergänzen.

## Später: Updates ausspielen

Einfach lokal committen und pushen:

```bash
git add -A && git commit -m "..." && git push
```

Vercel deployt jeden Push automatisch neu.

---

## Stolpersteine / Bekannte Punkte

- **Gate schützt nicht?** `SITE_PASSWORD` muss eine echte Vercel-Env-Variable
  sein (nicht `.env.local`); nach dem Setzen neu deployen.
- **Falsche Links in Sitemap/Cloud-Redirect?** `NEXT_PUBLIC_APP_URL` stimmt
  nicht mit der echten URL überein → korrigieren + neu deployen.
- **Rate-Limit** auf `/api/analyze-demo` ist In-Memory (pro Server-Instanz,
  best-effort) — der echte Kostendeckel ist das Google-Cloud-Budget.
- **Kosten-/Missbrauchsschutz** insgesamt: siehe `docs/product-pipeline.md`
  §4.2.1 (Free-Tier-Blocker, noch nicht durchgesetzt).
