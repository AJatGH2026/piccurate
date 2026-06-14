import { getAnthropicClient, DEFAULT_MODEL } from '@/lib/anthropic/client';
import { ANALYSIS_SYSTEM_PROMPT, buildBatchUserPrompt } from '@/lib/anthropic/prompts';
import { parseAnalysisResponse } from '@/lib/anthropic/parser';
import { getStorage } from '@/lib/storage/interface';
import type { AIAnalysis, EXIFData } from '@/types/photo';
import type Anthropic from '@anthropic-ai/sdk';

const BATCH_SIZE = 20; // Photos per API call
const MAX_RETRIES = 1;

interface PhotoForAnalysis {
  id: string;
  thumbnailKey: string;
  filename: string;
  exif: EXIFData;
}

interface AnalysisResult {
  photoId: string;
  analysis: AIAnalysis;
}

/**
 * Analyze a batch of photos using Claude Vision API.
 * Groups photos into batches of BATCH_SIZE and processes them sequentially.
 * Uses prompt caching for the system prompt.
 */
export async function analyzePhotos(
  photos: PhotoForAnalysis[]
): Promise<AnalysisResult[]> {
  const client = getAnthropicClient();
  const storage = await getStorage();
  const results: AnalysisResult[] = [];

  // Split into batches
  const batches: PhotoForAnalysis[][] = [];
  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    batches.push(photos.slice(i, i + BATCH_SIZE));
  }

  console.log(
    `[AI Analyzer] Processing ${photos.length} photos in ${batches.length} batch(es)`
  );

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    console.log(
      `[AI Analyzer] Batch ${batchIdx + 1}/${batches.length}: ${batch.length} photos`
    );

    let batchResults: AIAnalysis[] | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        batchResults = await analyzeBatch(client, storage, batch);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[AI Analyzer] Batch ${batchIdx + 1} attempt ${attempt + 1} failed:`,
          lastError.message
        );
      }
    }

    if (!batchResults) {
      throw new Error(
        `Failed to analyze batch ${batchIdx + 1} after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
      );
    }

    // Map results to photo IDs
    for (let i = 0; i < batch.length; i++) {
      results.push({
        photoId: batch[i].id,
        analysis: batchResults[i],
      });
    }
  }

  return results;
}

/**
 * Analyze a single batch of photos.
 */
async function analyzeBatch(
  client: Anthropic,
  storage: Awaited<ReturnType<typeof getStorage>>,
  photos: PhotoForAnalysis[]
): Promise<AIAnalysis[]> {
  // Load thumbnails from storage and encode as base64
  const imageContents: Anthropic.ImageBlockParam[] = [];
  const photoMetas: { index: number; exif: EXIFData; filename: string }[] = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const buffer = await storage.get(photo.thumbnailKey);

    if (!buffer) {
      throw new Error(`Thumbnail not found: ${photo.thumbnailKey}`);
    }

    const base64 = buffer.toString('base64');
    imageContents.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: base64,
      },
    });

    photoMetas.push({
      index: i,
      exif: photo.exif,
      filename: photo.filename,
    });
  }

  // Build the user message with interleaved images and text
  const userContent: Anthropic.ContentBlockParam[] = [];

  // Add all images first
  for (const img of imageContents) {
    userContent.push(img);
  }

  // Add the text prompt with EXIF context
  userContent.push({
    type: 'text',
    text: buildBatchUserPrompt(photoMetas),
  });

  // Call Claude API with prompt caching
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: ANALYSIS_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  });

  // Extract text response
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from AI');
  }

  // Log usage for cost tracking
  console.log(
    `[AI Analyzer] Tokens — input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens}` +
    (response.usage.cache_read_input_tokens
      ? `, cache_read: ${response.usage.cache_read_input_tokens}`
      : '') +
    (response.usage.cache_creation_input_tokens
      ? `, cache_create: ${response.usage.cache_creation_input_tokens}`
      : '')
  );

  // Parse and validate the response
  return parseAnalysisResponse(textBlock.text, photos.length);
}
