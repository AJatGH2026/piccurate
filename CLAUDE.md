@AGENTS.md

# AuswahlBuddy (tpai) — Project Instructions

Workspace-specific context for the AuswahlBuddy app. Global identity, Accenture
context, and universal behaviours live in `~/.claude/CLAUDE.md`.

> **This is a personal product / tool, NOT a CGRT client engagement.** Keep it
> in its own workspace, separate from the CGRT account-planning workspace, so
> history and memory stay separate. Working copy: `C:\Dev\piccurate` (the older
> `C:\CLAUDE\MyProjects\tpai` path is gone). Keep the clone **outside**
> `Documents` — Windows Controlled Folder Access blocks writes there and reports
> the failure misleadingly as `No such file or directory`.

## What this is

AuswahlBuddy — an AI-powered travel-photo curation web app. Users upload holiday
photos; the app scores them, collapses near-duplicate series, and proposes a
small curated keeper set to review and download / export to a photo book.

- **Live:** https://shortlistbuddy.com (leading/canonical domain; auswahlbuddy.de redirects here). German at /de, English at /en. The Basic Auth gate (`SITE_PASSWORD`) is **currently off** — the landing page is public for the beta. Vercel deployment URL: piccurate.vercel.app.
- **Repo:** `AJatGH2026/piccurate` (branch `master`, **public**) — Vercel auto-deploys on push
- **Deploy target:** Vercel **Pro**, held by **AJ GmbH** (HRB 33249). Not Hobby — the free-tier limits described in older doc sections no longer apply.
- **⚠️ AJ GmbH is the interim vehicle for the beta only.** A dedicated company is planned once the beta succeeds; every entity-bound detail (imprint, privacy, terms, persons-info, supervisory authority, and the account holders at Vercel/Stripe/domains/Google/Supabase/Resend) is provisional. Never treat it as final — see [docs/product-pipeline.md](docs/product-pipeline.md) §10.1.

## Stack

- Next.js 15/16 App Router, TypeScript, Tailwind CSS
- next-intl (DE/EN); German UI uses "du" form and real umlauts/ß
- Zustand store (`usePhotoStore`)
- **Analysis engine: Google Gemini 2.5 Flash** via `/api/analyze-demo`
  (`@google/genai`, `GEMINI_API_KEY`) — won a 381-photo eval vs. Sonnet 4.6 at ~1/6 cost
- Client-side EXIF + 512px thumbnailing; HEIC via `heic-to` (browser) / vips/sharp (server)

## Working conventions

- **Default flow is push → Vercel Preview → promote to Production.** That is how
  the product owner works, and on Pro there is no quota reason to avoid it. (The
  old "never iterate against the live app" rule came from the Hobby-tier Fast
  Origin Transfer cap in the July 2026 incident — obsolete since the move to Pro.)
- Use `localhost` (`npm run dev`) for fast UI iteration and for the pre-push
  check below. Anything needing real infrastructure — Supabase auth callbacks,
  Resend mail, domain redirects — is only meaningfully testable on a Preview.
- Verify before pushing: `npx tsc --noEmit && npm run build`.
- Commit style: Conventional Commits; end messages with the `Co-Authored-By`
  trailer. Push only when asked.
- **Secrets never in git.** `.env.local` is gitignored; production values live in
  Vercel env vars. See `.env.example` for the full list of variable names.

## HEIC routing lever

`NEXT_PUBLIC_HEIC_SERVER_MAX_MB` controls where HEIC is decoded:
`0` = all in the browser (slower uploads, near-zero origin transfer);
`4` = small HEICs take the fast server path (`/api/convert`).
Code default is `4` (see [src/utils/image.ts](src/utils/image.ts)).

It was overridden to `0` in the Vercel env vars during the July 2026 Hobby-tier
quota crunch. **On Pro that constraint is gone** — the override can be dropped so
uploads take the faster path again. Check the current value in the Vercel
dashboard; `NEXT_PUBLIC_*` is inlined at build time, so changing it needs a
redeploy without build cache.

## Key documents

- [HANDOVER.md](HANDOVER.md) — resume/backup guide (what to save, how to resume, cloud options)
- [docs/auth-plan.md](docs/auth-plan.md) — Supabase auth (login/register/confirm): status DONE, design, Resend SMTP + corporate-scanner learnings
- [docs/domain-setup.md](docs/domain-setup.md) — live domains, DNS (web + email/Resend), Vercel/code redirect split + learnings (read before touching domains)
- [docs/product-pipeline.md](docs/product-pipeline.md) — full project history & rationale (German, dated changelog)
- [docs/PicCurate-WorkLog.md](docs/PicCurate-WorkLog.md) — chronological work log (Jun 4 → Jul 18 2026)
- [.env.example](.env.example) — all environment variables

## Onboarding

[x] Onboarded 2026-07-21 — andreas.jahnke@accenture.com (project split out from CGRT workspace)
