import { clientConfig } from '@/lib/config';
import { GUIDES } from '@/content/guides';

// Served at /llms-full.txt — the extended companion to /llms.txt
// (llmstxt.org convention). Same product map as llms.txt, plus the full text
// of every guide inlined, so an AI agent can answer from this single file
// without following links. English is the canonical copy (the format targets
// LLMs); each guide notes its German URL.

export const dynamic = 'force-static';

export function GET() {
  const base = clientConfig.appUrl;

  const guideSections = GUIDES.map((g) => {
    const c = g.en;
    const steps = c.steps.map((s, i) => `${i + 1}. ${s.title}\n   ${s.body}`).join('\n');
    const faqs = c.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');
    return [
      `## ${c.title}`,
      `URL: ${base}/en/guides/${c.slug}  (DE: ${base}/de/guides/${g.de.slug})`,
      `Last updated: ${g.updated}`,
      '',
      c.intro.join('\n\n'),
      '',
      `### ${c.stepsHeading}`,
      steps,
      '',
      `### ${c.faqHeading}`,
      faqs,
    ].join('\n');
  }).join('\n\n---\n\n');

  const body = `# AuswahlBuddy / ShortlistBuddy — full content

> ShortlistBuddy (German: AuswahlBuddy) is an AI-powered web app that curates large sets of travel and holiday photos down to a small, high-quality selection. Upload up to a few thousand photos; it scores each photo, detects near-duplicate series and keeps the best of each, checks faces for open eyes and natural expressions, and balances the selection across places, people and subjects. It then hands you a reviewable shortlist to approve, adjust, download as a ZIP, or export to a cloud folder for photo-book services. Analysis runs on Google's Gemini vision models against downscaled previews; originals are never stored permanently. Nothing is deleted — the tool only proposes a selection, and the user keeps full control. Interface languages: English (/en) and German (/de).

## Product
- Home: ${base}/en  (DE: ${base}/de)
- Demo — runs in the browser, no account needed: ${base}/en/demo
- Pricing is shown on the home page. A free tier covers 250 photos during the beta; paid tiers for larger libraries are planned.

## Guides (full text)

${guideSections}

## Legal
- Privacy Policy: ${base}/en/privacy
- Terms of Service: ${base}/en/terms
- Imprint: ${base}/en/imprint
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
