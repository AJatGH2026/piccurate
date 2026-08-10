import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { ANALYSIS_SYSTEM_PROMPT } from '@/lib/anthropic/prompts';
import { parseAnalysisResponse } from '@/lib/anthropic/parser';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { trackAnalyze, getTodayPhotos, reserveIpDailyPhotos } from '@/lib/stats';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  betaOpenAccess,
  ACCESS_ERRORS,
  BETA_MAX_PHOTOS_PER_REQUEST,
  BETA_DAILY_PHOTO_CAP,
  BETA_IP_DAILY_PHOTO_CAP,
} from '@/lib/access';

// Strip control characters and cap length on any user-supplied string that
// flows into the model prompt (person names, custom terms, EXIF camera model).
// Defence against prompt-injection / token-waste via crafted values. Done via
// char codes (no unicode-escape regex) to keep the source plain ASCII.
function sanitizePromptField(s: unknown, max = 80): string {
  const out = Array.from(String(s ?? ''))
    .map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch))
    .join('');
  return out.replace(/\s+/g, ' ').trim().slice(0, max);
}

// A GPS value we are willing to forward to the model: finite, in range, and
// rounded to place-level precision. Mirrors GEO_SEND_PRECISION in utils/geo.ts
// — kept as a literal so this server guard does not depend on a client module.
function clampCoord(v: unknown, limit: number): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return Number(n.toFixed(2));
}

// Per-IP guard against a client hammering this (paid) endpoint. Generous
// enough for a real demo job sent in batches, but caps runaway loops. Backed
// by Upstash so it holds globally across Vercel instances (falls back to an
// in-memory limiter when Upstash isn't configured). See §4.2.1 / §10.
const RL_LIMIT = 120; // requests
const RL_WINDOW_MS = 60_000; // per minute

// Beta cost/abuse guards (see product-pipeline.md §10). Cost scales with photos
// (image tokens dominate), so all caps are photo-based.
// - Per-request cap: ALWAYS on (works without Upstash) — matches the 250-photo
//   free tier advertised on the site.
// - Daily + per-IP caps: Upstash-backed budget backstops, now ON by default.
//   They only bite when Upstash is configured; the provider-side Gemini billing
//   spend limit remains the hard backstop. All three are tunable via env.
// Defined in lib/access so /api/jobs can pre-flight the same numbers and refuse
// a run before it starts, instead of letting it die half way through.

/**
 * POST /api/analyze-demo
 *
 * Demo-mode analysis endpoint — no auth or database required.
 * Backed by Google Gemini 2.5 Flash (chosen after a 381-photo eval:
 * 42% album-score match vs. Sonnet 4.6's 34%, at 1/6 the cost). Prompt,
 * parser, and taxonomy are the same as when it ran on Anthropic; only the
 * SDK and request shape changed. See docs/product-pipeline.md §9.
 *
 * Form fields:
 * - thumbnails: JPEG files
 * - metadata: JSON string with [{filename, dateTaken, cameraModel}]
 * - consent: "1" — required; attests the user accepted terms and is 18+
 * - customTerms: (optional) JSON array of user-defined terms to tag
 * - personRefs: (optional) reference JPEGs for named-person detection (feature 5b)
 * - personNames: (optional) JSON array of names — parallel to personRefs
 * - personsConsent: "1" — required when personRefs are present (GDPR Art. 9)
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = await checkRateLimit(`analyze-demo:${ip}`, RL_LIMIT, RL_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('thumbnails') as File[];
    const metaStr = formData.get('metadata') as string;

    if (!files.length || !metaStr) {
      return NextResponse.json({ error: 'Missing thumbnails or metadata' }, { status: 400 });
    }

    // Consent attestation — server-side enforcement of the client-side 18+/terms
    // gate (defence-in-depth). A direct API caller bypassing the UI must also
    // assert consent before any analysis runs.
    if (formData.get('consent') !== '1') {
      return NextResponse.json(
        { error: 'Missing consent. You must accept the terms and confirm you are at least 18.' },
        { status: 403 }
      );
    }

    // Every analysis runs against a real job owned by the caller. One code path:
    // `BETA_OPEN_ACCESS` relaxes who the owner may be and whether a paid tier is
    // already settled, but never removes the job itself. Without this the free
    // tier and the paid tiers guard nothing — the flow used to call this
    // endpoint directly, so the limits existed only on paper.
    const jobId = String(formData.get('jobId') || '');
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!jobId || !user) {
      return NextResponse.json({ error: ACCESS_ERRORS.jobRequired }, { status: 401 });
    }
    if (user.is_anonymous && !betaOpenAccess()) {
      return NextResponse.json({ error: ACCESS_ERRORS.accountRequired }, { status: 401 });
    }

    const { data: job } = await supabase
      .from('jobs')
      .select('id, user_id, tier, photo_count, photo_limit, payment_status, expires_at, beta_grant')
      .eq('id', jobId)
      .single();

    // RLS already restricts this to the caller's own jobs; the explicit check
    // keeps the failure legible if a policy is ever loosened.
    if (!job || job.user_id !== user.id) {
      return NextResponse.json({ error: ACCESS_ERRORS.jobRequired }, { status: 404 });
    }
    if (job.expires_at && new Date(job.expires_at) < new Date()) {
      return NextResponse.json({ error: ACCESS_ERRORS.jobRequired }, { status: 410 });
    }
    // A beta grant settles a paid tier without a payment — it is the offer the
    // tester accepted instead of buying. It has to survive BETA_OPEN_ACCESS=0,
    // otherwise switching the beta off at sales launch would silently revoke
    // allowances we already handed out.
    if (
      job.tier !== 'free' &&
      job.payment_status !== 'paid' &&
      !job.beta_grant &&
      !betaOpenAccess()
    ) {
      return NextResponse.json({ error: ACCESS_ERRORS.paymentRequired }, { status: 402 });
    }
    // The tier's photo limit, enforced across the whole job rather than per
    // request — the client sends batches, so a per-request check would be
    // trivially bypassed by splitting. Read-then-write races between concurrent
    // batches can overshoot slightly; this is a budget guard, not a security
    // boundary, and the per-IP/day caps below bound the damage.
    if (job.photo_count + files.length > job.photo_limit) {
      return NextResponse.json(
        { error: ACCESS_ERRORS.jobExhausted, limit: job.photo_limit },
        { status: 402 }
      );
    }
    await supabase
      .from('jobs')
      .update({ photo_count: job.photo_count + files.length, status: 'analyzing' })
      .eq('id', job.id);

    // Beta cost/abuse guards (§10). Per-request cap first (cheap, always on).
    if (files.length > BETA_MAX_PHOTOS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many photos in one request (max ${BETA_MAX_PHOTOS_PER_REQUEST}).` },
        { status: 413 }
      );
    }
    // Global daily photo cap — protects the free-beta budget from runaway/bot
    // traffic. No-op until Upstash is configured (getTodayPhotos returns null).
    if (BETA_DAILY_PHOTO_CAP > 0) {
      const todayPhotos = await getTodayPhotos();
      if (todayPhotos != null && todayPhotos >= BETA_DAILY_PHOTO_CAP) {
        return NextResponse.json(
          { error: 'Daily beta capacity reached. Please try again tomorrow.' },
          { status: 503, headers: { 'Retry-After': '3600' } }
        );
      }
    }
    // Per-IP daily photo cap — stops a single client draining the budget.
    // reserve-then-check: we allow the request that crosses the line, block the
    // next (best-effort; exact fairness isn't worth a lock here).
    //
    // A granted job raises its own ceiling to the allowance it was promised.
    // The default cap is 750/day and the smallest grant is 1,000, so leaving it
    // alone would refuse the offer we just made — the tester would be stopped
    // three quarters of the way through the run they were invited to make.
    // The grant is one per account and an account needs a confirmed address, so
    // the ceiling cannot simply be reached again tomorrow by the same person.
    const ipCap = job.beta_grant
      ? Math.max(BETA_IP_DAILY_PHOTO_CAP, job.photo_limit)
      : BETA_IP_DAILY_PHOTO_CAP;
    if (ipCap > 0) {
      const ipTotal = await reserveIpDailyPhotos(ip, files.length);
      if (ipTotal != null && ipTotal - files.length >= ipCap) {
        return NextResponse.json(
          { error: 'Daily limit reached for this connection. Please try again tomorrow.' },
          { status: 429, headers: { 'Retry-After': '3600' } }
        );
      }
    }

    const metadata: {
      filename: string;
      dateTaken: string | null;
      cameraModel: string | null;
      lat?: number | null;
      lon?: number | null;
    }[] = JSON.parse(metaStr);

    // Optional user-defined terms to additionally tag (feature 5a).
    let customTerms: string[] = [];
    const customStr = formData.get('customTerms') as string | null;
    if (customStr) {
      try {
        const arr = JSON.parse(customStr);
        if (Array.isArray(arr)) customTerms = arr.map((t) => sanitizePromptField(t, 60)).filter(Boolean);
      } catch {
        /* ignore */
      }
    }

    // Optional reference photos of named persons (feature 5b). Names come as
    // a parallel JSON array. We enforce a small hard cap here as a backstop
    // — the UI already caps at 4.
    const personRefs = formData.getAll('personRefs') as File[];

    // Biometric data (GDPR Art. 9) — person recognition requires its own
    // explicit, server-verified consent, over and above the general consent.
    if (personRefs.length > 0 && formData.get('personsConsent') !== '1') {
      return NextResponse.json(
        { error: 'Missing consent for person recognition (biometric data).' },
        { status: 403 }
      );
    }

    let personNames: string[] = [];
    const personNamesStr = formData.get('personNames') as string | null;
    if (personNamesStr) {
      try {
        const arr = JSON.parse(personNamesStr);
        if (Array.isArray(arr)) personNames = arr.map((t) => sanitizePromptField(t, 60)).filter(Boolean);
      } catch {
        /* ignore */
      }
    }
    // If arrays got out of sync (shouldn't happen from our client, but be
    // defensive), drop reference photos to avoid confusing the model.
    const nPersons = Math.min(personRefs.length, personNames.length, 4);
    const usePersons = nPersons > 0;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'placeholder') {
      // Neutral log — no key length / environment details (data minimisation).
      console.error('[Demo Analyze] GEMINI_API_KEY not configured on the server.');
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server. Check Vercel → Settings → Environment Variables (Production).' },
        { status: 500 }
      );
    }

    const client = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    // Build user content — INTERLEAVED text+image. Every image is preceded
    // by a text label ("Reference 1: Peter" / "Photo 3, taken 2024-05-15")
    // so the model can never mix up references with analysis targets. This
    // is a lot more reliable for Gemini than a plain image stack: without
    // per-image labels, face matching was inconsistent (sometimes empty
    // persons[] even for clear matches).
    const parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = [];

    // Intro
    if (usePersons) {
      parts.push({
        text:
          `You will see ${nPersons} REFERENCE photo${nPersons === 1 ? '' : 's'} of named person${nPersons === 1 ? '' : 's'} first, then ${files.length} travel photo${files.length === 1 ? '' : 's'} to analyze. ` +
          `The reference photos are ONLY for face matching — do not include them in the output. ` +
          `Return one JSON object per travel photo, in the order shown, wrapped in a JSON array.`,
      });
      for (let i = 0; i < nPersons; i++) {
        parts.push({ text: `--- Reference ${i + 1}: ${personNames[i]} ---` });
        const buffer = Buffer.from(await personRefs[i].arrayBuffer());
        parts.push({
          inlineData: { mimeType: 'image/jpeg', data: buffer.toString('base64') },
        });
      }
      parts.push({
        text: `--- End of reference photos. The following ${files.length} photo${files.length === 1 ? ' is' : 's are'} the travel photo${files.length === 1 ? '' : 's'} to analyze (Photo 0 through Photo ${files.length - 1}): ---`,
      });
    } else {
      parts.push({
        text: `Analyze these ${files.length} travel photo${files.length === 1 ? '' : 's'} (numbered 0 through ${files.length - 1}). Return one JSON object per photo in the order shown, wrapped in a JSON array.`,
      });
    }

    // Each analysis photo is labelled with its index + per-photo context, then
    // the image itself follows. Gemini sees the label immediately before the
    // pixels — no ambiguity about which JSON entry belongs to which image.
    let anyCoords = false;
    for (let i = 0; i < files.length; i++) {
      const m = metadata[i] || {};
      const bits = [`Photo ${i}`];
      if (m.dateTaken) bits.push(`taken ${m.dateTaken.split('T')[0]}`);
      if (m.cameraModel) bits.push(sanitizePromptField(m.cameraModel, 60));
      // Coordinates arrive already coarsened by the client (~1.1 km, see
      // utils/geo.ts). Re-clamp here anyway: the client is not a trust
      // boundary, and a full-precision pair must not reach the model just
      // because someone crafted the request by hand.
      const lat = clampCoord(m.lat, 90);
      const lon = clampCoord(m.lon, 180);
      if (lat != null && lon != null) {
        bits.push(`GPS ${lat},${lon}`);
        anyCoords = true;
      }
      parts.push({ text: `[${bits.join(', ')}]` });
      const buffer = Buffer.from(await files[i].arrayBuffer());
      parts.push({
        inlineData: { mimeType: 'image/jpeg', data: buffer.toString('base64') },
      });
    }

    // Trailing instructions: reinforce output schema for the extras
    // (custom + persons). Keep this compact — the SYSTEM prompt already
    // defines the full per-photo schema.
    let closing = `\nRespond with a JSON array of ${files.length} objects — one per travel photo above, in the same order.`;
    if (customTerms.length) {
      closing +=
        `\n\nFor each photo, also determine which of these user-defined terms are clearly visible: ` +
        customTerms.map((t) => `"${t}"`).join(', ') +
        `. Add a "custom" field to each object — an array of the matching terms (verbatim; empty array if none). Judge by what is visibly present, regardless of the term's language.`;
    }
    if (usePersons) {
      const names = personNames.slice(0, nPersons);
      closing +=
        `\n\nFACE MATCHING — for each travel photo, compare the visible faces (face structure, hair, apparent age, glasses, distinguishing features) against each reference photo. Add a "persons" field to every object — an array of names from the reference list (${names
          .map((n) => `"${n}"`)
          .join(', ')}) whose face clearly appears in that photo. ` +
        `Use empty array [] when no reference person is recognisable. NEVER invent names outside the reference list. Be conservative but not timid: if two facial features clearly match (e.g. same face shape AND same glasses), include the name.` +
        `\n\nExample output shape for a batch of 2 photos, references "${names[0]}"${names[1] ? ` and "${names[1]}"` : ''}: ` +
        `[{...other fields..., "persons": ["${names[0]}"]}, {...other fields..., "persons": []}]`;
    }
    // Place names are shown to the user, so they follow the UI language.
    const placeLang = formData.get('locale') === 'de' ? 'German' : 'English';
    if (anyCoords) {
      // Place naming from the coordinates in the per-photo labels. The label is
      // the authority, not the pixels: a beach looks like any beach, so guessing
      // from the image is how you end up with confident nonsense.
      closing +=
        `\n\nPLACE — some photos carry a "GPS lat,lon" value in their label. For each such photo, add a "place" field: the place those coordinates fall in, as "City, Country" (or "Region, Country" where no town applies), in ${placeLang}. ` +
        `Derive it from the coordinates only — do NOT guess a place from what the image shows. The coordinates are rounded to about one kilometre, so name the town or region, never a street or building. ` +
        `Use the same spelling for the same location across the batch. For photos with no GPS value in the label, set "place" to "".`;
    }
    parts.push({ text: closing });

    console.log(
      `[Demo Analyze] Sending ${files.length} photos to ${model}` +
        (usePersons ? ` + ${nPersons} person reference${nPersons === 1 ? '' : 's'}` : '') +
        '...'
    );

    const response = await client.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: ANALYSIS_SYSTEM_PROMPT,
        // Gemini 2.5 Flash has "thinking" enabled by default — thinking tokens
        // count against maxOutputTokens and can starve the actual JSON output,
        // causing "Unterminated string in JSON …" errors. We want plain
        // structured output, no chain-of-thought needed → disable thinking.
        thinkingConfig: { thinkingBudget: 0 },
        // Comfortable ceiling for a 20-photo batch: ~150-200 tokens per photo
        // × 20 ≈ 4k, plus headroom for edge cases.
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No text response from AI');
    }

    // Gemini exposes usageMetadata (promptTokenCount / candidatesTokenCount).
    const u = response.usageMetadata || {};
    const inputTokens = u.promptTokenCount ?? 0;
    const outputTokens = u.candidatesTokenCount ?? 0;

    console.log(`[Demo Analyze] Tokens — input: ${inputTokens}, output: ${outputTokens}`);
    console.log(
      `[STAT] photos=${files.length} input_tokens=${inputTokens} output_tokens=${outputTokens} model=${model}`
    );

    // Persistent usage tracking — no-op if Upstash isn't configured.
    void trackAnalyze({ photos: files.length, inputTokens, outputTokens, model });

    const results = parseAnalysisResponse(text, files.length);

    // Diagnostic: if references were sent but no photo came back with a
    // "persons" hit, log a snippet of the raw response so we can inspect
    // Gemini's actual reply and adjust the prompt if needed. (Names are only
    // neutral labels "Person A/B…" here — real names never reach the server.)
    if (usePersons) {
      const totalHits = results.reduce((n, r) => n + (r.persons?.length || 0), 0);
      if (totalHits === 0) {
        console.warn(
          `[Demo Analyze] Face matching returned NO hits across ${files.length} photos ` +
            `with ${nPersons} reference(s).`
        );
      } else {
        console.log(`[Demo Analyze] Face matching: ${totalHits} name-hit(s) across ${files.length} photos.`);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error('[Demo Analyze] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
