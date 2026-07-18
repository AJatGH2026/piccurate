# PicCurate — Handover & Resume Guide

Everything you need to pause the project and pick it up later — on this
machine, another machine, or a cloud environment. **The code is fully in
GitHub; only the items marked "not in the repo" below can be lost.**

- **Live app:** https://piccurate.vercel.app
- **Repo:** `AJatGH2026/piccurate` (branch `master`, auto-deploys to Vercel on push)
- **Project history & decisions:** [docs/product-pipeline.md](docs/product-pipeline.md) — read the changelog at the bottom to get back up to speed.
- **All required env-var names:** [.env.example](.env.example)

---

## 1. What to back up (NOT in the repo — not recoverable from git)

1. **`.env.local`** (local dev secrets, gitignored). Lives at the project
   root, holds your real `GEMINI_API_KEY` etc. → Copy into a password
   manager. Never commit it, never paste it into chat.
2. **Vercel production env vars** — the live values (`GEMINI_API_KEY`,
   `SITE_PASSWORD`, Upstash tokens, …) live in the Vercel project, not
   locally. Retrievable from the Vercel dashboard while you have account
   access; a backup is still wise.
3. **Access to the external accounts** (the real dependency):
   - GitHub — `AJatGH2026/piccurate`
   - Vercel — project `piccurate`
   - Google AI Studio — Gemini API key (live analysis engine)
   - Upstash Redis — `/admin/stats` counters (optional)
   - Dropbox app / Azure (OneDrive) app registrations — cloud import/export (optional)
   - Stripe (test mode) — payments (not wired into the live demo flow yet)

**Do NOT need to save** (all regenerable): `node_modules/` (`npm install`),
`.next/` / `build/` (build output), `.storage/` and `.eval/` artifacts, the
local libvips binary (`VIPSTHUMBNAIL_PATH` — only speeds up local HEIC dev;
Vercel uses the WASM fallback).

**Minimal to resume:** GitHub repo (done) + `.env.local` values in a
password manager + account access. That's it.

---

## 2. Resume from scratch (any machine)

```bash
git clone https://github.com/AJatGH2026/piccurate.git
cd piccurate
npm install
cp .env.example .env.local   # then fill in the real values (min: GEMINI_API_KEY)
npm run dev                  # http://localhost:3000
```

- Node: use a current LTS (18+). No `engines` pin; package manager is **npm**
  (`package-lock.json`).
- Minimum to run the live analysis flow locally: `GEMINI_API_KEY`
  (+ `GEMINI_MODEL`, default `gemini-2.5-flash`). Everything else is optional
  and its feature simply stays off when its key is absent.
- `SITE_PASSWORD` only matters for the shared-prototype auth gate and is read
  from the **host env** (Edge runtime ignores `.env.local`) — irrelevant for
  local dev.

Build check before pushing: `npx tsc --noEmit && npm run build`.

---

## 3. Editing elsewhere / in the cloud

Because the code is in GitHub, any Claude Code surface with repo access can
continue:

| Option | Where | Notes |
|---|---|---|
| Claude Code CLI | another machine | clone → `npm install` → restore `.env.local` |
| Claude Code web app (claude.ai/code) | cloud | connects to GitHub repos, runs in a cloud sandbox |
| **GitHub Codespaces** | cloud | full browser dev environment from the repo; run Claude Code / VS Code — nothing local. Cleanest pure-cloud route. |
| VS Code / JetBrains extension | local or cloud | Claude Code integrated |

**Two caveats:**
- **Secrets don't travel.** Re-supply env vars in each new environment
  (`.env.local`, or Codespaces secrets). This is why backing them up matters.
- **Vercel is untouched.** It auto-deploys on every push to `master` —
  wherever you edit and push, Vercel rebuilds. Vercel is the deploy target,
  not a code editor.

---

## 4. Operational notes

- **Deploy:** push to `master` → Vercel builds automatically. See
  [DEPLOY.md](DEPLOY.md) for first-time setup steps.
- **Cost/quota lever:** `NEXT_PUBLIC_HEIC_SERVER_MAX_MB` controls HEIC
  routing. Default `4` = small HEICs use the fast server path. Set to `0` to
  route all HEIC decoding to the browser and drive `/api/convert` "Fast Origin
  Transfer" to ~0 (used during a Vercel free-tier quota crunch; trade-off is
  slower client-side uploads). See [src/utils/image.ts](src/utils/image.ts).
- **Usage dashboard:** `/admin/stats` (behind the Basic Auth gate) — shows
  photos / tokens / estimated cost when Upstash Redis is configured.
- **Analysis engine:** Google Gemini 2.5 Flash via `/api/analyze-demo`
  (won a 381-photo eval vs. Sonnet 4.6 / GPT-4.1 mini at ~1/6 the cost).
  The eval harness in `scripts/` still supports multiple providers.
