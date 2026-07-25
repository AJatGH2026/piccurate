# PicCurate — Project Work Log

**Scope:** The PicCurate project only (the AI travel-photo-curation web app).
Other engagements that happen to share this workspace folder are deliberately
excluded.
**Period covered:** 2026-06-04 (first chat) → 2026-07-18.
**Compiled:** 2026-07-21.

### Method & sourcing note

This is a **structured work log**, not a verbatim transcript. The full
message-by-message chat is spread across ~10 session transcripts (>30 MB) and
older sessions survive only as compacted summaries, so a faithful word-for-word
reproduction is not possible. This document is reconstructed from the
authoritative records that *are* complete and reliable:

- Git history of the repo (`AJatGH2026/piccurate`) — 60 commits, 2026-06-14 → 2026-07-18.
- The project changelog in [product-pipeline.md](product-pipeline.md).
- Session summaries and the current session's chat.

Where a detail could not be verified it is omitted rather than invented.

---

## Documents you uploaded

**Core concept document**
- **`Travel_Photos-Idea.pdf`** — uploaded 2026-06-04, 14:20 (from
  `OneDrive - Accenture\Documents\06_Travel\999_Travel_Photos\`). The founding
  brief. Your instruction: *"analyze the attached document and follow the
  instructions."* This single PDF seeded the entire project — concept, analysis,
  and build all flow from it. Referenced again later as the build reference
  (`C:\CLAUDE\MyProjects\999_Travel_Photos\Travel_Photos-Idea.pdf`).

**Screenshots shared during testing** (pasted into chat to diagnose issues; not
files on disk). Across the sessions these included:
- HEIC upload error states (HTTP 413, `ERR_LIBHEIF format not supported`).
- Selection-result screens used to report quality issues (too few animals,
  near-duplicate people shots, rotated photos).
- The **Persons** configuration box and review screens (AK / AJ / CJ / PJ) used
  to debug face-matching and the selection-count bug.
- The **Vercel "Fast Origin Transfer" usage chart** (12.7 GB / 10 GB) used to
  diagnose the free-tier quota exhaustion.

> Note: no other documents were uploaded *for PicCurate*. (Other files present
> in the workspace folder belong to separate, confidential client engagements
> and are intentionally not part of this log.)

---

## Timeline

### Phase 0 — Concept & analysis (from 2026-06-04)

- **2026-06-04** — First chat ("Analyze travel photos document"). You uploaded
  `Travel_Photos-Idea.pdf` and asked me to follow its instructions.
- The idea: turn hundreds/thousands of holiday photos into a small, curated
  keeper set using AI, with user review and easy download / photo-book export.
- This led to a full analysis pass (competitive research, business model,
  technology concept, roll-out plan, financial projections) and an approved MVP
  implementation plan (Next.js 15 + TypeScript + Tailwind + AI Vision + client-
  side EXIF/thumbnailing, GDPR-first, DE/EN).

### Phase 1 — Prototype live (2026-06-14)

- **`a410922`** PicCurate prototype — initial public snapshot.
- **`b2308d1`** Live deployment milestone recorded; deployed to
  **https://piccurate.vercel.app** behind an HTTP Basic Auth gate for invited
  testers.
- **`ecc028e`** Dropbox: force explicit sign-in so each user links their own account.
- **Security:** an Anthropic key accidentally committed in a local `dev.cmd` was
  purged from git history and rotated; `dev.cmd` gitignored.

### Phase 2 — Core engine & UX build-out (2026-06-14 → 2026-06-26)

Selection engine and criteria UI:
- **`4ec597e`** Slider semantics: no slider = balanced, 1–9 = bias, **10 =
  exclusive filter**, multiple 10s = OR.
- **`32e1d6a`** Percentage cap applies at "10"; tightened landscape/architecture.
- **`8bd80c8`** User-defined **custom criteria** (feature 5a) — free-text terms
  the AI tags language-independently.
- **`3f2f5df`** Food includes drinks; criteria UI reordered and recoloured.
- **`1d72333`** Review **lightbox** for closer inspection (feature 5c).
- **`3c1680b`** Results **trip overview** with place names (reverse geocoding).

Upload / import robustness:
- **`b95c9d8`** Retry failed HEIC conversions + show excluded count.
- **`4043d49` / `f36d204` / `8dccc76`** Dropbox import: parallel downloads tried,
  reverted to sequential (parallel caused CORS `TypeError`); added per-file
  timeout + retry + tolerance.

Ops & docs:
- **`a6a842f`** Admin **usage dashboard** with persistent counters (Upstash Redis).
- **`94a51cd`** Vercel Web Analytics.
- **`c33dc13`** §9 cost & tier control added to the pipeline doc.
- **`559c434`** Custom terms locked after analysis (changing them forces re-analysis).
- **`18136fc`** Guard against empty photo store ("no photos to review" symptom).
- **`66405a4`** UX: top continue button on upload; back link on results.

### Phase 3 — Model evaluation & engine switch (2026-07-05)

The single biggest day of change.

- **`1596f72` / `4ce476f`** Multi-provider eval harness (Anthropic + OpenAI +
  Google) against a 381-photo hand-labelled reference.
- **`145abbd`** **Switched the live engine from Claude Sonnet 4.6 → Google
  Gemini 2.5 Flash.** Gemini won 4/5 Layer-A metrics and Layer-B album-score
  matching (42% vs 34%), at **~1/6 the cost** ($0.30/$2.50 vs $3.00/$15.00 per
  1M tokens) — making all pricing tiers profitable.
- **`3fac3a8`** Fixed truncated JSON: disabled Gemini "thinking", raised output
  ceiling, forced JSON MIME type.
- HEIC pipeline fixes:
  - **`96f251e`** Browser-side fallback for files above Vercel's 4.5 MB body cap.
  - **`b9e69a8`** Swapped `heic2any` → `heic-to` for iOS-2025 HEIC compatibility.
  - **`395b55d`** Series gap scales with the duplicates slider; HEIC orientation
    baked into pixels (fixed sideways iPhone photos).
- Selection quality:
  - **`e52c875`** Match motifs by scene, not just detector flags (fixed "no
    animals selected").
  - **`0a12b79` → `62f8cf0`** Negative custom terms reworked: exclude a photo
    only when the attribute is **positively confirmed** (so "no sunglasses"
    stops dropping unrelated tiger photos).
- **`50db7a0`** Selection range widened to 1–30%; UI reordered.

### Phase 4 — Named-person recognition, feature 5b (2026-07-05 → 2026-07-06)

- **`53e965b`** **Persons feature:** upload up to 4 reference photos, name them,
  filter the selection by who appears. No separate face model — reference photos
  ride along in the same Gemini Vision call; session-only (never persisted);
  GDPR Art. 9 consent text + privacy §4a added.
- **`2b96ffe`** Localised the privacy page — full German copy for `/de/privacy`.
- **`790d2c9`** Stronger face-matching prompt (interleaved text+image labels +
  JSON example), **exclude mode** ("Ohne" per person), and purple person-name
  chips on every review card.
- The selection-count bug saga:
  - **`7322caf`** removed the % cap in exclusive mode → **`25b8da7`** reverted
    (wrong reason) → **`a1d9b43`** added a temporary diagnostic →
    **`cffebc5`** real fix: the cap is computed on the *post-exclusion* pool, so
    heavy "Ohne" filtering shrank the pool and collapsed the cap to 1; exclusive
    mode now takes **all** matching photos.
  - **`7a8ae17`** removed the diagnostic; documented the open "solo person"
    product question in §1.6.
- UI copy: person toggle renamed to **"Mit" / "Ohne"** ("With" / "Without").

### Phase 5 — Vercel free-tier quota management (2026-07-07 → 2026-07-18)

- **`48a6875`** (Jul 7) Routed **all** HEIC decoding to the browser to cut
  Vercel "Fast Origin Transfer", which had hit the 10 GB free-tier cap. Made the
  threshold configurable via `NEXT_PUBLIC_HEIC_SERVER_MAX_MB`.
- **`e461cc2`** (Jul 18) Restored the fast server path (default 4 MB), believing
  the quota had reset on the stated "Jul 14".
- **`6478076`** (Jul 18) Added **[HANDOVER.md](../HANDOVER.md)** — a resume/backup
  guide (what to save, how to resume from a clean clone, how to continue in the
  cloud / GitHub Codespaces, operational notes).
- **`b44e4b3`** (Jul 18) Reverted back to browser-only after the usage dashboard
  showed **12.7 GB / 10 GB, 99% incoming**, dominated by a single ~10.8 GB test
  day (~Jul 5). Root cause understood: the Hobby quota is a **rolling 30-day
  window**, not a calendar reset — the Jul 5 spike won't age out until **~early
  August**. Lesson: **do heavy iteration on localhost**, not against the live app.

---

## What the app does today

1. **Upload** — drag-drop or cloud import (Dropbox). EXIF + 512px thumbnails
   generated client-side; HEIC decoded in the browser (currently) or server.
2. **Configure** — balanced by default (holistic `album_score`). Opt-in sliders
   for motifs (people/animals/landscape/architecture/food), sharpness,
   duplicate sensitivity, and max selection size (1–30%). Custom text terms
   (positive + "no X" exclusions). Up to 4 named **persons** (With / Without).
3. **Analyse** — Google Gemini 2.5 Flash, batched, ~$0.30/$2.50 per 1M tokens.
4. **Review** — selection grouped by day/location; scene + person chips; toggle
   photos, save keepers, re-run with changed criteria (free, no re-analysis).
5. **Download / export** — ZIP (one folder or per-day) or save to cloud.

---

## Key technical decisions

- **Base ranking = holistic `album_score`**, not criteria weights (best predictor
  of what people keep, ~50% agreement vs ~23% random). Sliders are pure opt-in bias.
- **Gemini 2.5 Flash** as the live engine (eval-proven, 1/6 the cost of Sonnet).
- **Client-side EXIF/thumbnailing**; originals never leave the device until the
  final ZIP step. GDPR-first, EU data residency intended, provider-neutral wording.
- **Reference photos are biometric data (GDPR Art. 9)** → session-only, never
  persisted, explicit consent text.
- **Next.js 16 `proxy.ts`** Basic Auth gate protects the shared prototype
  (pages + API), read from host env only.

---

## Open items & follow-ups

- **Free/paid gating** for custom criteria and persons — waits on auth (Phase 3
  of the plan); currently open to all demo users.
- **"Solo person" selection** — optionally select only photos where a named
  person is the *sole* person (via `faceCount == 1`); documented, not built.
- **Vercel quota** — clears ~early August (rolling window); HEIC stays
  browser-only until then.
- **Free-tier blocker** (250 free photos once per user) — not enforceable until
  auth/DB land.

---

## Operational notes

- **Deploy:** push to `master` → Vercel auto-deploys. See
  [DEPLOY.md](../DEPLOY.md).
- **Quota lever:** `NEXT_PUBLIC_HEIC_SERVER_MAX_MB` — `0` = all HEIC in browser
  (quota-safe), `4` = fast server path for small HEICs.
- **Scheduled reminders set:** (1) 2026-08-05 — restore the HEIC server path once
  the Vercel counter clears; (2) a standing preference to run heavy iteration on
  localhost. Note: scheduled tasks only fire while the app is open.
- **Full project history & rationale:** [product-pipeline.md](product-pipeline.md)
  (German, dated changelog). **Resume/backup:** [HANDOVER.md](../HANDOVER.md).
