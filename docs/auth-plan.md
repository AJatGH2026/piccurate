# Auth (Supabase) — Build Plan / Handoff

Picked up in a fresh session (the thread that scoped this got too long). This is
the next work item: wire real login/registration so the beta can collect users.

## STATUS: DONE — live in production (2026-07-31)

All 8 build tasks shipped to `master` (2026-07-31, *"feat: wire Supabase Auth —
login, register, callback, session refresh"*) and verified on
shortlistbuddy.com. Full flow works: register → confirmation email (Resend SMTP)
→ callback → logged in; login; header shows email + logout; `profiles` row has
`locale` + `gdpr_consent_at` populated (trigger verified end-to-end).

**Later addition:** password reset (2026-08-10) — see [Password reset](#password-reset--added-2026-08-10)
below. Read that section before touching `/auth/callback` or the reset pages;
the two flows differ on purpose.

### Learnings (email delivery — this ate most of the debugging time)
- **Resend requires the SMTP *Sender email* to match a verified domain exactly.**
  Initially the only verified domain was `feedback.shortlistbuddy.com` (the
  subdomain for the feedback feature), so signup first went out from
  `noreply@feedback.shortlistbuddy.com`. A mismatched sender → Resend `550 "This
  API key is not authorized to send emails from <domain>"`. **Now** a dedicated
  `auth.shortlistbuddy.com` is verified and the sender is
  `noreply@auth.shortlistbuddy.com`.
- **API key must be authorized for the sender domain** (not scoped to a different
  domain). Wrong/missing key → SMTP `535 Authentication credentials invalid`;
  right key but wrong domain scope → the `550` above.
- Resend SMTP: host `smtp.resend.com`, port `465` (or 587/2465/2587 TLS), user is
  the literal string `resend`, password = the API key. The Resend Settings→SMTP
  page is read-only reference (`YOUR_API_KEY` is a placeholder, not an input).
- Supabase saves settings instantly — no "commit". Real SMTP error text lives in
  **Logs → Auth source** (the API-gateway logs only show `500`).
- Supabase free-tier built-in mailer is rate-limited to ~3/hour and min-interval
  60s/user (left at 60s — fine for beta). Custom SMTP removes the 3/hour cap.
- PKCE gotcha: confirmation link domain must match the browser that started
  signup, else `otp_expired / access_denied`. Added `http://localhost:3000/**`
  to Supabase Redirect URLs for local testing; production uses the app-URL
  fallback in `config.ts` (`https://shortlistbuddy.com`).
- **Corporate link-scanners pre-click confirmation links.** Microsoft Safe
  Links / Proofpoint URL Defense / Mimecast fetch every URL in an inbound mail
  to scan it — which consumes the one-time confirmation token and flips the
  account to confirmed *without the user clicking*, then often quarantines the
  mail so the user never sees it. Observed live: a corporate signup's
  `email_confirmed_at` was set with no user action. This is NOT an app bug —
  confirmation happens at Supabase's `/auth/v1/verify` endpoint server-side,
  before the redirect to `/auth/callback`. Enforcement is intact (`signIn`
  blocks unconfirmed accounts).
- **Callback design (revised 2026-07-31): confirm → login page, no auto-login.**
  `/auth/callback` no longer calls `exchangeCodeForSession`; it just redirects to
  `/[locale]/auth/login?confirmed=1` (or `?confirm_error=1`). Rationale: the mail
  is already confirmed at the verify step, and NOT exchanging avoids a session
  being established by whoever/whatever clicked the link (real user OR scanner).
  Everyone lands on login and authenticates explicitly. Login shows a green/amber
  banner from the query flag (read via `window.location`, no Suspense needed).
- **Email deliverability to corporate inboxes.** DNS for `auth.shortlistbuddy.com`
  is correct — DKIM (`resend._domainkey`), SPF (`send.` → `include:amazonses.com`),
  MX return-path (`feedback-smtp.eu-west-1.amazonses.com`, EU), DMARC inherited
  from org domain (`p=none`). Spam-filtering of corporate mail is reputation/
  newness of the fresh subdomain, not misconfiguration — builds with volume over
  time. Optional later: org DMARC → `p=quarantine` once reputation is established,
  add a `rua=` reporting address.

### Follow-ups before public launch (not blockers)
1. ~~**Auth sender domain**~~ ✅ **DONE (2026-07-31)** — verified
   `auth.shortlistbuddy.com` in Resend; Supabase SMTP sender switched to
   `noreply@auth.shortlistbuddy.com`. (Was `feedback.shortlistbuddy.com`, which
   is semantically off for confirmation mails.)
2. ~~**Dependabot**~~ 🟡 **partly done (2026-07-31)** — patched to 6 high (from
   8): bumped `sharp` → 0.35 (libvips CVEs on the `/api/convert` HEIC path) and
   `npm audit fix` for brace-expansion + js-yaml. Remaining 6 are transitive
   inside `next` / `@huggingface/transformers` (bundled postcss + sharp, adm-zip
   via onnxruntime) — no fix without a Next downgrade; low real risk (build-time
   or trusted-CDN model unpacking). Re-check when Next ships a patch release.
3. Move off Basic-Auth site gate (`SITE_PASSWORD`) when going public.

---

## Password reset — added 2026-08-10

Shipped *"feat(auth): add the password reset that the neutral signup text now
points at"*. Fully verified on shortlistbuddy.com: link clicked and password
changed, **and** the three counter-cases — link reused, link opened in a
different browser, request for an address with no account. All three refuse
correctly. The rejection path is therefore proven in production, not inferred;
treat it as load-bearing before loosening the browser binding.

Why it became urgent: the register confirmation text was made
enumeration-neutral earlier the same day (*"fix(auth): stop promising a
confirmation mail we may never have sent"*), so anyone whose address already has
an account is now told to log in instead. Without a reset that is a dead end for
exactly the people who cannot remember their password — and a startblocker for a
paid product.

- `/[locale]/auth/forgot-password` — `resetPasswordForEmail`, `redirectTo` =
  `<appUrl>/<locale>/auth/reset-password`.
- `/[locale]/auth/reset-password` — completes the PKCE exchange, `updateUser`,
  then a **global** `signOut()` → `/auth/login?password_reset=1`. The global
  scope revokes every other session on the account, which is the point of a
  reset if somebody else had got in.
- Links from the login page and from the register "check your mail" screen.

**Deliberately NOT routed through `/auth/callback`** — the thing not to
"simplify" later. That route refuses to turn a mail link into a session (see the
callback-design bullet above); setting a password genuinely needs one, so the
two flows cannot share a landing.

**What makes a session safe here is PKCE.** `resetPasswordForEmail` leaves the
code verifier in the requesting browser and sends Supabase only the challenge,
so the `?code=` that comes back is worthless to a link-scanner that merely
fetched the URL — a scanner cannot obtain a session. Price of the same property:
the link works only in the browser that asked for it. Said out loud in the "this
link no longer works" branch, which also covers expired and already-spent links
(the latter being what a scanner leaves behind).

**Enumeration line unchanged.** Supabase answers `/recover` with a success for
an address it has never seen, so we neither learn nor leak whether an account
exists, and the confirmation text stays conditional. An error there is therefore
a real fault (rate limit, malformed address, network), never "no such user", so
it is shown to the user.

**Test on production or localhost, NOT on a Preview.** `NEXT_PUBLIC_APP_URL` is
set for Production only (verified 2026-08-10 via the Vercel CLI), so on a Preview
`clientConfig.appUrl` falls back to `https://shortlistbuddy.com`: the mail link
points at production while the PKCE verifier sits in the preview origin's cookie
jar → guaranteed failure. The preview wildcards in the Redirect-URL allow-list do
not help, because the code never targets them. Same root cause as the PKCE gotcha
bullet above.

**Supabase side.** Redirect URLs already carried `https://shortlistbuddy.com/**`,
so the new paths needed no change (confirmed 2026-08-10). The **Reset Password**
email template is separate from Confirm-signup and was filled with a bilingual
DE/EN version — one template serves both locales and cannot switch on language.
`{{ .Data.locale }}` (from the signUp metadata) would allow a conditional and is
deliberately unused: users without that metadata can break the Go template at
render time, and you would only notice by the mail never arriving.

**Operational consequence of the neutral wording.** If a reset mail fails to
send, the user cannot tell — the page says "if there is an account, a link is on
its way" either way, which is exactly what we want against enumeration. So a mail
outage on this path is silent, and the reset is how paying customers get back
into their account. Keep an eye on the sending quota for that reason — it is no
longer the constraint it was in the first beta weeks, but it stays the thing that
fails invisibly.

---

## Download gate now waits for confirmation — 2026-08-27

`DownloadAccountGate` (the ZIP-download dialog on the results page, added
2026-08-27 when the account requirement moved off the upload page) originally
unlocked the download the moment `updateUser({ email, password })` returned
without error. That call only validates that the address is syntactically
well-formed and not already claimed — it is not proof anyone can receive mail
there, so any fake-but-valid address (`asdf@asdf.com`) unlocked the download
with nobody ever having to open an inbox.

Fixed same day: the dialog now shows a "check your mail" screen after
`updateUser` succeeds and polls `supabase.auth.getUser()` for `is_anonymous`
to flip to `false`. That flag is GoTrue's own, and it only flips once the
confirmation link has actually been opened at Supabase's `/auth/v1/verify` —
the same server-side event `/auth/callback` relies on. The poll picks up the
flip within a few seconds of the click, in this tab, and starts the download
automatically — still no redirect away from the result. A manual "already
confirmed — check now" button and a resend button (30s client-side cooldown)
cover a slow poll or a mail that didn't arrive. See
`src/components/results/DownloadAccountGate.tsx` for the implementation and
its file doc comment for the full rationale.

## The download gate uses the EMAIL CHANGE flow, not signup — 2026-08-27

Non-obvious and it cost a test round: converting the anonymous user with
`updateUser({ email, password })` is, to GoTrue, an **email change** on an
account that already exists — not a signup. Consequences, all of them
observable:

- The mail is rendered from the **Change Email Address** template, *not*
  Confirm signup. That template was never localised, which is why the
  confirmation link arrived in English for a German user while the reset-password
  mail (bilingual, see above) did not. Fix is the same as for reset: one
  bilingual DE/EN template, since a template cannot switch on language.
  **Watch for `{{ .Email }}`/`{{ .NewEmail }}` in Supabase's default wording**
  ("confirm the update of your email from `{{ .Email }}` to …") — for this
  flow `.Email` is empty (the anonymous user had no prior address), so the
  default text renders as "from to you@example.com". Use only
  `{{ .ConfirmationURL }}` in the custom template and drop that sentence.
- Resending must be `resend({ type: 'email_change' })`. `type: 'signup'` asks
  GoTrue to repeat a registration that never happened. `DownloadAccountGate`
  tries `email_change` first and falls back to `signup`.
- **Secure email change** (Auth → Providers → Email) sends a confirmation to the
  OLD address as well. An anonymous user has none, so leave it off for this flow
  — with it on, a conversion can require a click that nobody can ever make.
- The per-user min-interval (60s) and the hourly cap apply here too, and a
  throttled mail is silent on both sides. Repeated testing with the same address
  is the first thing to rule out when "the mail did not arrive".

---

## Original plan (below) — for reference

## Current state — scaffolding exists, it's a WIRING job (not from scratch)
- `src/lib/supabase/client.ts` — browser client (`createBrowserClient`, anon key). ✅
- `src/lib/supabase/server.ts` — server client (cookies) + `createAdminClient` (service role). ✅
- `supabase/migrations/001_initial_schema.sql` — `profiles` (id→auth.users, email,
  display_name, locale, free_tier_used, gdpr_consent_at) **+ RLS + auto-create
  trigger `handle_new_user`**, plus future `jobs`/`photos` tables. ✅
- `src/app/[locale]/auth/login/page.tsx` & `.../register/page.tsx` — full forms,
  GDPR-consent checkbox, i18n (`auth` namespace) — but **stubbed** (`alert()`
  instead of Supabase calls). ⛔ wire these.
- `src/app/[locale]/page.tsx` — login/register buttons shown but non-functional.
- `src/lib/config.ts` — supabase env accessors already defined.
- Deps present: `@supabase/ssr`, `@supabase/supabase-js`.

## Prerequisites (USER — before/while wiring)
1. Create Supabase project at supabase.com — **Region: EU (Frankfurt)** (GDPR).
2. Settings → API → set three env vars in **Vercel (Production + Preview)** and in
   local `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public)
   - `SUPABASE_SERVICE_ROLE_KEY` (service_role — secret, never NEXT_PUBLIC)
3. SQL Editor → run `supabase/migrations/001_initial_schema.sql`.
4. Authentication → URL Configuration → Site URL `https://shortlistbuddy.com`,
   Redirect URLs `https://shortlistbuddy.com/**`.

## Decisions (recommended defaults — confirm in new session)
- **Email confirmation: ON** (Supabase default). Real addresses + consent proof.
  Uses Supabase's built-in mailer for now (free-tier rate-limited; move to Resend
  SMTP later). Confirmation link → `/auth/callback`.
- **Beta account scope: minimal** — register/login works, profile stored
  (email, locale, gdpr_consent_at). **No feature gating / paywall yet** (that's the
  paid phase). After login: show account state (email + logout) instead of
  login/register.

## Build tasks (new session)
1. **Wire login** — `supabase.auth.signInWithPassword`; on success redirect to
   app/home; typed error handling.
2. **Wire register** — `supabase.auth.signUp` with `options.data = { locale,
   gdpr_consent_at }` and `emailRedirectTo` = `<appUrl>/<locale>/auth/callback`.
   With confirmation ON, show "check your email" state.
3. **Consent → profile** — the trigger writes (id,email,locale) only; also persist
   `gdpr_consent_at` (extend the trigger to read it from metadata, or update the
   profile post-confirmation).
4. **`/auth/callback` route** — `exchangeCodeForSession` (PKCE) → redirect to app.
5. **Session refresh in middleware** — add Supabase `getUser()` cookie refresh to
   `src/proxy.ts` (careful: it also does the Basic-Auth gate, host redirects for
   auswahlbuddy.de→/de and www→apex handled at Vercel, and next-intl routing —
   don't break those; refresh must run for matched routes without disturbing them).
6. **Header/logged-in state** — show email + Logout when a session exists; else
   Login/Register.
7. **Legal** — add a "Konto / Registrierung" section to the privacy policy
   (`src/app/[locale]/privacy/page.tsx`, both GermanBody + EnglishBody):
   account data (email), legal basis Art. 6(1)(b), Supabase as processor (EU
   region), retention, deletion right.
8. **Test on a branch → Vercel preview** (env must be set for Preview too), then
   merge to master.

## Context pointers
- Overall project state: [HANDOVER.md](../HANDOVER.md), `docs/product-pipeline.md` (local only),
  [docs/domain-setup.md](domain-setup.md).
- Recently done (not auth): domains live, security hardening + Next 16.2.12 upgrade,
  feedback-via-Resend (pending RESEND domain verify — falls back to Upstash),
  results UI tweaks, legal-modal on configure.
