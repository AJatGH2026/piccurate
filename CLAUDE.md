@AGENTS.md

# AuswahlBuddy (tpai) — Project Instructions

Workspace-specific context for the AuswahlBuddy app. Global identity, Accenture
context, and universal behaviours live in `~/.claude/CLAUDE.md`.

> **This is a personal product / tool, NOT a CGRT client engagement.** Keep it
> in its own workspace — launch Claude from `C:\CLAUDE\MyProjects\tpai`, not from
> the CGRT account-planning workspace, so history and memory stay separate.

## What this is

AuswahlBuddy — an AI-powered travel-photo curation web app. Users upload holiday
photos; the app scores them, collapses near-duplicate series, and proposes a
small curated keeper set to review and download / export to a photo book.

- **Live:** https://shortlistbuddy.com (leading/canonical domain; auswahlbuddy.de redirects here). German at /de, English at /en. Basic Auth gate until public launch. Vercel deployment URL: piccurate.vercel.app.
- **Repo:** `AJatGH2026/piccurate` (branch `master`) — Vercel auto-deploys on push
- **Deploy target:** Vercel (Hobby / free tier)

## Stack

- Next.js 15/16 App Router, TypeScript, Tailwind CSS
- next-intl (DE/EN); German UI uses "du" form and real umlauts/ß
- Zustand store (`usePhotoStore`)
- **Analysis engine: Google Gemini 2.5 Flash** via `/api/analyze-demo`
  (`@google/genai`, `GEMINI_API_KEY`) — won a 381-photo eval vs. Sonnet 4.6 at ~1/6 cost
- Client-side EXIF + 512px thumbnailing; HEIC via `heic-to` (browser) / vips/sharp (server)

## Working conventions

- **Do heavy, test-repetitive iteration on `localhost` (`npm run dev`), NOT
  against the live Vercel app** — inbound image uploads to functions burn
  "Fast Origin Transfer" free-tier quota fast (see the July 2026 incident).
- Verify before pushing: `npx tsc --noEmit && npm run build`.
- Commit style: Conventional Commits; end messages with the `Co-Authored-By`
  trailer. Push only when asked.
- **Secrets never in git.** `.env.local` is gitignored; production values live in
  Vercel env vars. See `.env.example` for the full list of variable names.

## Quota lever

`NEXT_PUBLIC_HEIC_SERVER_MAX_MB` controls HEIC routing:
`0` = all HEIC decoded in the browser (quota-safe, slower uploads);
`4` = small HEICs use the fast server path (`/api/convert`).
Currently `0` while the Vercel Fast Origin Transfer quota recovers (~early August 2026).

## Key documents

- [HANDOVER.md](HANDOVER.md) — resume/backup guide (what to save, how to resume, cloud options)
- [docs/auth-plan.md](docs/auth-plan.md) — Supabase auth (login/register/confirm): status DONE, design, Resend SMTP + corporate-scanner learnings
- [docs/domain-setup.md](docs/domain-setup.md) — live domains, DNS (web + email/Resend), Vercel/code redirect split + learnings (read before touching domains)
- [docs/product-pipeline.md](docs/product-pipeline.md) — full project history & rationale (German, dated changelog)
- [docs/PicCurate-WorkLog.md](docs/PicCurate-WorkLog.md) — chronological work log (Jun 4 → Jul 18 2026)
- [.env.example](.env.example) — all environment variables

## Onboarding

[x] Onboarded 2026-07-21 — andreas.jahnke@accenture.com (project split out from CGRT workspace)
