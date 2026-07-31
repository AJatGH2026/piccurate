# Auth (Supabase) — Build Plan / Handoff

Picked up in a fresh session (the thread that scoped this got too long). This is
the next work item: wire real login/registration so the beta can collect users.

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
