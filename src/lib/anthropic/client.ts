import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

/**
 * Get the Anthropic client singleton.
 * Lazily initialized to avoid errors when API key is not set.
 */
export function getAnthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _client;
}

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
