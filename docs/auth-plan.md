# Auth (Supabase) — Build Plan / Handoff

Picked up in a fresh session (the thread that scoped this got too long). This is
the next work item: wire real login/registration so the beta can collect users.

## STATUS: DONE — live in production (2026-07-31)

All 8 build tasks shipped to `master` (commit `5380665`) and verified on
shortlistbuddy.com. Full flow works: register → confirmation email (Resend SMTP)
→ callback → logged in; login; header shows email + logout; `profiles` row has
`locale` + `gdpr_consent_at` populated (trigger verified end-to-end).

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
