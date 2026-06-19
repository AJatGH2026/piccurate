import type { MetadataRoute } from 'next';
import { clientConfig } from '@/lib/config';

// Served at /robots.txt. See docs/product-pipeline.md §8.5.
//
// Strategy: the public marketing pages are crawlable; the in-app flow,
// auth, eval and cloud callback routes carry no SEO value (and are
// client-rendered), so they're disallowed for everyone. AI crawlers are
// *explicitly* welcomed — for a product that lives off recommendations,
// being citable in ChatGPT/Claude/Perplexity/AI Overviews outweighs
// guarding marketing copy.

const base = clientConfig.appUrl;

// Non-content paths, for both locales.
const DISALLOW = [
  '/api/',
  '/admin/',
  '/en/app/',
  '/de/app/',
  '/en/auth/',
  '/de/auth/',
  '/en/eval/',
  '/de/eval/',
  '/en/cloud/',
  '/de/cloud/',
];

// Generative-engine / AI crawlers we deliberately allow (§8.5).
const AI_BOTS = [
  'GPTBot', // OpenAI training/crawl
  'OAI-SearchBot', // ChatGPT search index
  'ChatGPT-User', // ChatGPT live browsing
  'ClaudeBot', // Anthropic crawl
  'Claude-Web', // Anthropic live browsing
  'anthropic-ai',
  'PerplexityBot', // Perplexity
  'Google-Extended', // Gemini / AI Overviews opt-in
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      { userAgent: AI_BOTS, allow: '/', disallow: DISALLOW },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
