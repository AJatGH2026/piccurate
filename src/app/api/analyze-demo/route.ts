import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { ANALYSIS_SYSTEM_PROMPT } from '@/lib/anthropic/prompts';
import { parseAnalysisResponse } from '@/lib/anthropic/parser';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { trackAnalyze } from '@/lib/stats';

// Per-IP guard against a client hammering this (paid) endpoint. Generous
// enough for a real demo job sent in batches, but caps runaway loops. The
// hard cost backstop remains the provider's spend limit. See §4.2.1.
const RL_LIMIT = 120; // requests
const RL_WINDOW_MS = 60_000; // per minute

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
 * - customTerms: (optional) JSON array of user-defined terms to tag
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit(`analyze-demo:${ip}`, RL_LIMIT, RL_WINDOW_MS);
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

    const metadata: { filename: string; dateTaken: string | null; cameraModel: string | null }[] =
      JSON.parse(metaStr);

    // Optional user-defined terms to additionally tag (feature 5a).
    let customTerms: string[] = [];
    const customStr = formData.get('customTerms') as string | null;
    if (customStr) {
      try {
        const arr = JSON.parse(customStr);
        if (Array.isArray(arr)) customTerms = arr.map((t) => String(t).trim()).filter(Boolean);
      } catch {
        /* ignore */
      }
    }

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

    // Build user content: images + trailing text prompt with per-photo metadata.
    const parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      parts.push({
        inlineData: { mimeType: 'image/jpeg', data: buffer.toString('base64') },
      });
    }

    let prompt = `Analyze these ${files.length} travel photos. Photos are numbered 0 through ${files.length - 1}.\n\nContext per photo:\n`;
    for (let i = 0; i < metadata.length; i++) {
      const m = metadata[i];
      const bits = [`Photo ${i}`];
      if (m.dateTaken) bits.push(`taken ${m.dateTaken.split('T')[0]}`);
      if (m.cameraModel) bits.push(m.cameraModel);
      prompt += `- ${bits.join(', ')}\n`;
    }
    if (customTerms.length) {
      prompt += `\n\nFor each photo, also determine which of these user-defined terms are clearly visible: ${customTerms
        .map((t) => `"${t}"`)
        .join(', ')}. Add a field "custom" to each object — an array of exactly the matching terms (verbatim term text; empty array if none). Judge by what is visibly present, regardless of the term's language.`;
    }
    prompt += `\nReturn a JSON array of ${files.length} analysis objects.`;
    parts.push({ text: prompt });

    console.log(`[Demo Analyze] Sending ${files.length} photos to ${model}...`);

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

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error('[Demo Analyze] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
