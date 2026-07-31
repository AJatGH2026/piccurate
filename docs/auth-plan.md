# Auth (Supabase) — Build Plan / Handoff

Picked up in a fresh session (the thread that scoped this got too long). This is
the next work item: wire real login/registration so the beta can collect users.

## STATUS: DONE — live in production (2026-07-31)

All 8 build tasks shipped to `master` (commit `5380665`) and verified on
shortlistbuddy.com. Full flow works: register → confirmation email (Resend SMTP)
→ callback → logged in; login; header shows email + logout; `profiles` row has
`locale` + `gdpr_consent_at` populated (trigger verified end-to-end).

### Learnings (email delivery — this ate most of the debugging time)
- **Resend verified domain is `feedback.shortlistbuddy.com`** (the subdomain set
  up for the feedback feature), NOT the root. Supabase SMTP *Sender email* must
  match the verified domain exactly, so it's currently
  `noreply@feedback.shortlistbuddy.com`. A mismatched sender → Resend `550 "This
  API key is not authorized to send emails from <domain>"`.
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

### Follow-ups before public launch (not blockers)
1. **Auth sender domain** — `noreply@feedback.shortlistbuddy.com` is semantically
   off for confirmation mails. Verify a proper auth domain in Resend (root
   `shortlistbuddy.com` or `auth.shortlistbuddy.com`), then switch the Supabase
   sender. See [domain-setup.md](domain-setup.md).
2. **Dependabot** — the auth push surfaced 9 GitHub vulnerabilities (8 high, 1
   moderate) on `master`. Review before launch.
3. Move off Basic-Auth site gate (`SITE_PASSWORD`) when going public.

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
- Overall project state: [HANDOVER.md](../HANDOVER.md), [docs/product-pipeline.md](product-pipeline.md),
  [docs/domain-setup.md](domain-setup.md).
- Recently done (not auth): domains live, security hardening + Next 16.2.12 upgrade,
  feedback-via-Resend (pending RESEND domain verify — falls back to Upstash),
  results UI tweaks, legal-modal on configure.
