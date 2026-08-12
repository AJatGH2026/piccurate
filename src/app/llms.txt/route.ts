import { clientConfig } from '@/lib/config';
import { GUIDES } from '@/content/guides';

// Served at /llms.txt — the emerging convention (llmstxt.org) for giving AI
// agents a concise, link-rich map of the site. See product-pipeline.md §8.6.
// English by default (the format is aimed at LLMs); links point at the
// canonical English pages, with the guides' real slugs.

export const dynamic = 'force-static';

export function GET() {
  const base = clientConfig.appUrl;

  const guideLines = GUIDES.map(
    (g) => `- [${g.en.title}](${base}/en/guides/${g.en.slug}): ${g.en.description}`
  ).join('\n');

  const body = `# AuswahlBuddy

> AuswahlBuddy is an AI-powered web app that curates large sets of travel and holiday photos down to a small, high-quality selection. Upload up to a few thousand photos; it scores, de-duplicates and ranks them, then gives you a reviewable shortlist to approve, adjust, download as a ZIP, or export to a cloud folder for photo-book services.

AuswahlBuddy analyses photos with Google's Gemini vision models. It detects near-duplicate series and keeps the best of each, scores holistic "keep-worthiness" (an album score), checks faces for open eyes and natural expressions, and balances the selection across places, people and subjects. The user keeps full control — nothing is deleted; the tool only proposes a selection. The interface is bilingual (English and German); German pages live under /de.

## Guides
${guideLines}

## Product
- [AuswahlBuddy home](${base}/en): Overview, how it works, and pricing.
- [Try the demo](${base}/en/demo): Runs entirely in the browser, no account needed.

## Optional
- [Privacy Policy](${base}/en/privacy)
- [Terms of Service](${base}/en/terms)
- [Imprint](${base}/en/imprint)
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
