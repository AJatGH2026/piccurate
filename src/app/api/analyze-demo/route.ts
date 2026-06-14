import { NextRequest, NextResponse } from 'next/server';
import AnthropicSDK from '@anthropic-ai/sdk';
import { ANALYSIS_SYSTEM_PROMPT } from '@/lib/anthropic/prompts';
import { parseAnalysisResponse } from '@/lib/anthropic/parser';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// Per-IP guard against a client hammering this (paid) endpoint. Generous
// enough for a real demo job sent in batches, but caps runaway loops. The
// hard cost backstop remains the Anthropic spend limit. See §4.2.1.
const RL_LIMIT = 120; // requests
const RL_WINDOW_MS = 60_000; // per minute

/**
 * POST /api/analyze-demo
 *
 * Demo-mode analysis endpoint — no auth or database required.
 * Accepts a batch of thumbnails as multipart/form-data and returns
 * AI analysis results directly.
 *
 * Form fields:
 * - thumbnails: JPEG files
 * - metadata: JSON string with [{filename, dateTaken, cameraModel}]
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('[Demo Analyze] API key present:', !!apiKey, 'length:', apiKey?.length);

    if (!apiKey || apiKey === 'placeholder') {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env.local' },
        { status: 500 }
      );
    }

    const client = new AnthropicSDK({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

    // Build message content: images + text prompt
    const userContent: AnthropicSDK.ContentBlockParam[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: buffer.toString('base64'),
        },
      });
    }

    // Text prompt with metadata context
    let prompt = `Analyze these ${files.length} travel photos. Photos are numbered 0 through ${files.length - 1}.\n\nContext per photo:\n`;
    for (let i = 0; i < metadata.length; i++) {
      const m = metadata[i];
      const parts = [`Photo ${i}`];
      if (m.dateTaken) parts.push(`taken ${m.dateTaken.split('T')[0]}`);
      if (m.cameraModel) parts.push(m.cameraModel);
      prompt += `- ${parts.join(', ')}\n`;
    }
    prompt += `\nReturn a JSON array of ${files.length} analysis objects.`;

    userContent.push({ type: 'text', text: prompt });

    console.log(`[Demo Analyze] Sending ${files.length} photos to Claude...`);

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: ANALYSIS_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from AI');
    }

    console.log(
      `[Demo Analyze] Tokens — input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens}`
    );

    const results = parseAnalysisResponse(textBlock.text, files.length);

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error('[Demo Analyze] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
