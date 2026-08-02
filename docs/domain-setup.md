# Domain, DNS & Redirect Setup

Reference for how the live domains are wired, and the **learnings** so we don't
repeat the debugging round-trip. Set up and verified 2026-07-28/29.

> **TL;DR:** `shortlistbuddy.com` is the single leading/canonical host and
> serves the app. Everything else redirects to it. `www.*` → apex is handled by
> **Vercel**; the German marketing domain → `/de` is handled by **code**
> (`src/proxy.ts`). Never let both layers redirect the *same* host pair in
> *opposite* directions — that's an infinite loop.

---

## 1. Final state (what "clean" looks like)

| Host | Behaviour | Where it's configured |
|---|---|---|
| `shortlistbuddy.com` | **Serves the app** — leading/canonical, `Production` | Vercel (assigned) |
| `www.shortlistbuddy.com` | **308 → `shortlistbuddy.com`** (path + locale preserved) | Vercel domain redirect |
| `auswahlbuddy.de` | **308 → `https://shortlistbuddy.com/de`** | code — `src/proxy.ts` |
| `www.auswahlbuddy.de` | **308 → `https://shortlistbuddy.com/de`** | code — `src/proxy.ts` |

Locale on the canonical host:
- `shortlistbuddy.com/` → next-intl locale detection: German browser → `/de`,
  otherwise → `/en` (`defaultLocale: 'en'`, detection on — see `i18n/routing.ts`).
- `auswahlbuddy.de` (German marketing domain) → **always `/de`**, regardless of
  browser language (user can still switch to EN via the locale switcher).

Canonical / hreflang / sitemap / OpenGraph all resolve against
`clientConfig.appUrl` → `https://shortlistbuddy.com` (see §3).

---

## 2. DNS records (registrar: Checkdomain, for BOTH domains)

Vercel shows the exact values under **Settings → Domains** after adding a domain.
Use those; the values below are what we set.

| Type | Name | Value |
|---|---|---|
| `A` | `@` (apex) | `216.150.1.1` (Vercel; legacy `76.76.21.21` also works) |
| `CNAME` | `www` | the `<hash>.vercel-dns-0XX.com.` value Vercel shows **for that specific domain** (each domain gets its own) |

Notes:
- The old Checkdomain **parking** A-record (`46.243.95.171`) and the old
  Checkdomain **forwarding** (`88.99.101.251`, HTTP-only) were removed — they are
  what caused the "parking page" and the "auswahlbuddy hängt / not secure"
  (no valid HTTPS) symptoms.
- Once DNS points at Vercel and the domain is added in the project, Vercel
  issues the SSL certificate automatically (Let's Encrypt). No cert needed at
  the registrar.

### 2b. Email sending domains (Resend) — separate from the web records above

Transactional email goes through **Resend** (which sends over AWS SES infra).
Each sending subdomain is verified independently in Resend and gets its own DNS
records at Checkdomain. Verified 2026-07-31.

| Subdomain | Used for | Records (all present + verified) |
|---|---|---|
| `auth.shortlistbuddy.com` | **Supabase auth mails** (signup confirmation) | DKIM `resend._domainkey.auth…`, SPF `send.auth…` = `v=spf1 include:amazonses.com ~all`, MX `send.auth…` → `feedback-smtp.eu-west-1.amazonses.com` (EU) |
| `feedback.shortlistbuddy.com` | feedback feature mails | ⚠️ **NOT SET UP** — see below |
| `_dmarc.shortlistbuddy.com` (org-level) | DMARC for all subdomains | `v=DMARC1; p=none;` (inherited by subdomains) |

**⚠️ Feedback mail is broken at both ends (verified by DNS query 2026-08-02).**
This table previously claimed `feedback.shortlistbuddy.com` had "the same record
shape" — it describes the intent, not reality. Neither end works:

- **Sending:** `resend._domainkey.feedback…` and `send.feedback…` return
  NXDOMAIN — not one record exists, so the subdomain cannot be verified in
  Resend and every send from `noreply@feedback.shortlistbuddy.com` is rejected.
  The records are gone because `feedback.` **was** the verified domain and got
  replaced by `auth.` (see auth-plan.md) — the Resend **Free plan has exactly
  one domain slot**, so the two never coexisted.
  Fix without paying for Pro: a verified domain covers **every local part**, so
  send feedback from the domain that is already verified —
  `FEEDBACK_FROM=noreply@auth.shortlistbuddy.com`. A second sending subdomain
  only buys reputation isolation, which is worth its price at volume, not in
  beta.
- **Receiving:** `shortlistbuddy.com` has **no MX at all**. Checkdomain's mail
  reception is switched off for the domain ("Individuelle Konfiguration via
  MX-Records"), and the only MX under it is `send.auth…` — a *sending*
  return-path for SES, not reception. So `feedback@shortlistbuddy.com` cannot
  receive mail; `feedback@auswahlbuddy.de` can (MX `mx1/mx2.auswahlbuddy.de`).
  Fix: re-enable mail reception for the apex, or add a forwarding provider's MX.

Since 2026-08-02 the code no longer depends on any of this: feedback is written
to Supabase (`public.feedback`, migration 003) first and the mail is only a
notification on top. Fix the DNS to get notified; nothing is lost meanwhile.

Learnings:
- **The SMTP *Sender email* must match a verified subdomain exactly**, else Resend
  rejects with `550 "This API key is not authorized to send emails from <domain>"`.
  Supabase auth sender = `noreply@auth.shortlistbuddy.com`.
- A wrong/missing Resend API key → SMTP `535 Authentication credentials invalid`.
- A brand-new sending subdomain has **no reputation** → strict corporate gateways
  may spam-filter early mail even with SPF/DKIM/DMARC correct. Builds with volume;
  not a misconfiguration. Later: tighten org DMARC to `p=quarantine` + add `rua=`.
- Full auth-email context: [auth-plan.md](auth-plan.md).

---

## 3. Code responsibilities (do NOT move these to Vercel)

- **`src/lib/config.ts` — `DEFAULT_APP_URL`**: `appUrl` falls back to
  `https://shortlistbuddy.com` when `NODE_ENV=production` (localhost in dev).
  This makes canonical/hreflang/sitemap correct **even if the Vercel
  `NEXT_PUBLIC_APP_URL` env var is missing** (a set env var still overrides).
- **`src/proxy.ts` — German marketing redirect**: `auswahlbuddy.de` /
  `www.auswahlbuddy.de` → `308 https://shortlistbuddy.com/de` (existing `/en`
  or `/de` paths preserved). This lives in code because a Vercel domain redirect
  can only preserve the path — it **cannot inject the `/de` prefix**.
  Requires these domains to be **assigned** in Vercel (not "Redirect to"), so the
  request actually reaches the middleware.

`www.shortlistbuddy.com → apex` is intentionally **NOT** in code — it lives in
Vercel (see §4, learning #2/#3).

---

## 4. Learnings — read before touching domains again

1. **`NEXT_PUBLIC_*` are inlined at BUILD time**, not read at runtime. Changing
   the Vercel env var needs a **redeploy without build cache** to take effect.
   We sidestepped this entirely by hardcoding the production default in
   `config.ts` — don't reintroduce a hard dependency on that env var for the
   canonical URL. (The env var value also *appears* blank when you re-open
   Vercel's edit dialog because Vercel masks stored values — that is not "the
   value got deleted".)

2. **Split of responsibility is deliberate:**
   - `www ↔ apex` → **Vercel domain redirect** (edge-level, fires before the
     function, no cold start). This is the better place for it.
   - Cross-domain redirect that needs a **path prefix** (`auswahlbuddy.de → /de`)
     → **code** (`proxy.ts`), because Vercel domain redirects can't add a path.

3. **Never redirect the same host pair in both layers in opposite directions.**
   Code did `www → apex` while Vercel still did `apex → www` → **infinite loop**
   (`ERR_TOO_MANY_REDIRECTS`). One direction, one source of truth. If Vercel
   owns `www → apex`, do **not** also put `www → apex` in code.

4. **To use a code-level redirect for a domain, the domain must be *assigned*
   (serving) in Vercel — not a "Redirect to" domain.** A Vercel redirect fires
   at the edge *before* the request reaches the app, so middleware never runs
   for it.

5. **Vercel's "Redirect to" target dropdown only lists domains that themselves
   serve** (are not redirects). If the apex is itself redirecting, it won't
   appear as a target — set the apex to **"No Redirect"** first, then point
   `www` at it.

6. **308 (permanent) redirects are cached hard by browsers**, even within an
   InPrivate session until all InPrivate windows are closed. After changing any
   redirect, test in a **fresh** InPrivate window / cleared cache — otherwise
   you'll see stale behaviour and chase ghosts.

7. **Verification blind spots from this dev environment** (why the dashboard is
   the source of truth, not local tooling):
   - PowerShell / `Invoke-WebRequest` to the live domains and `*.vercel.app`
     fails with **SSL errors behind the corporate proxy**.
   - The in-app Browser pane **blocks these domains "by policy"**.
   - `WebFetch` reduces pages to markdown (**can't read `<head>`** →
     canonical/hreflang not visible) **and silently follows
     same-registered-domain redirects** (`www ↔ apex`), so it will **not**
     reveal a `www → apex` hop. It *does* flag cross-registered-domain hops
     (`auswahlbuddy.de → shortlistbuddy.com`).
   - → For redirect **direction**, trust the **Vercel Domains dashboard** +
     a fresh-browser test. Don't conclude "www serves, no redirect" from a
     WebFetch 200 — that was a tooling artifact, not reality.

---

## 5. Still open (for the beta go-live, not domains)

- Set Google tag IDs (`NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID`,
  `..._CONVERSION_LABEL`) → activates GA4 + Ads + Consent Mode v2 + banner.
- Turn on cost caps (`BETA_DAILY_PHOTO_CAP`, `BETA_IP_DAILY_PHOTO_CAP`).
- The prototype Basic-Auth gate (`SITE_PASSWORD`) is currently **off** (opened
  for the beta). Re-set it only if you want to close the site again.
