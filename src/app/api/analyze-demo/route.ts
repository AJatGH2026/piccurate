import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { ANALYSIS_SYSTEM_PROMPT } from '@/lib/anthropic/prompts';
import { parseAnalysisResponse } from '@/lib/anthropic/parser';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { trackAnalyze, getTodayPhotos, reserveIpDailyPhotos } from '@/lib/stats';

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
const BETA_MAX_PHOTOS_PER_REQUEST = Number(process.env.BETA_MAX_PHOTOS_PER_REQUEST ?? '250');
const BETA_DAILY_PHOTO_CAP = Number(process.env.BETA_DAILY_PHOTO_CAP ?? '20000');
const BETA_IP_DAILY_PHOTO_CAP = Number(process.env.BETA_IP_DAILY_PHOTO_CAP ?? '2000');

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
    if (BETA_IP_DAILY_PHOTO_CAP > 0) {
      const ipTotal = await reserveIpDailyPhotos(ip, files.length);
      if (ipTotal != null && ipTotal - files.length >= BETA_IP_DAILY_PHOTO_CAP) {
        return NextResponse.json(
          { error: 'Daily limit reached for this connection. Please try again tomorrow.' },
          { status: 429, headers: { 'Retry-After': '3600' } }
        );
      }
    }

    const metadata: { filename: string; dateTaken: string | null; cameraModel: string | null }[] =
      JSON.parse(metaStr);

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
    // Diagnostic: never log the key itself, but expose enough to distinguish
    // "not set at all" from "set but on the wrong environment" in Vercel logs.
    console.log(
      `[Demo Analyze] GEMINI_API_KEY set: ${!!apiKey} length: ${apiKey?.length ?? 0} — NODE_ENV: ${process.env.NODE_ENV} VERCEL_ENV: ${process.env.VERCEL_ENV ?? '(local)'}`
    );
    if (!apiKey || apiKey === 'placeholder') {
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
    for (let i = 0; i < files.length; i++) {
      const m = metadata[i] || {};
      const bits = [`Photo ${i}`];
      if (m.dateTaken) bits.push(`taken ${m.dateTaken.split('T')[0]}`);
      if (m.cameraModel) bits.push(sanitizePromptField(m.cameraModel, 60));
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
