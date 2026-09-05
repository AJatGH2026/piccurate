import type { MetadataRoute } from 'next';
import { clientConfig } from '@/lib/config';
import { routing } from '../../i18n/routing';
import { GUIDES } from '@/content/guides';

// Served at /sitemap.xml. See docs/product-pipeline.md §8.1.
// Lists the public, indexable pages for every locale and declares the
// DE/EN equivalents as hreflang alternates (incl. x-default → en).

const base = clientConfig.appUrl;

// Hand-maintained last-change dates per content group. `new Date()` on every
// request (the old value) makes every URL look "just modified" on every crawl,
// which search engines learn to ignore — bump these only on an actual content
// change. Guides carry their own `updated` field (see content/guides.ts).
const REVISED = {
  landing: '2026-09-05',
  guidesIndex: '2026-07-26',
  legal: '2026-08-30',
} as const;

// Public marketing/content pages (path suffix after the locale), with a
// rough priority and a real <lastmod>. The in-app flow is intentionally
// excluded (see robots.ts); /demo is excluded too — it only redirects into
// that flow and carries no content (it is noindex via demo/layout.tsx).
const PAGES: { path: string; priority: number; lastModified: string }[] = [
  { path: '', priority: 1.0, lastModified: REVISED.landing }, // landing
  { path: '/guides', priority: 0.6, lastModified: REVISED.guidesIndex }, // guides index (shared slug)
  { path: '/privacy', priority: 0.3, lastModified: REVISED.legal },
  { path: '/terms', priority: 0.3, lastModified: REVISED.legal },
  { path: '/imprint', priority: 0.3, lastModified: REVISED.legal },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // Shared-slug pages: same path suffix in every locale.
  const pages = PAGES.flatMap(({ path, priority, lastModified }) => {
    const languages = Object.fromEntries(
      routing.locales.map((l) => [l, `${base}/${l}${path}`])
    ) as Record<string, string>;
    languages['x-default'] = `${base}/${routing.defaultLocale}${path}`;

    return routing.locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority,
      alternates: { languages },
    }));
  });

  // Guide pages: the slug differs per locale, so hreflang maps en↔de slugs.
  const guides = GUIDES.flatMap((g) => {
    const languages: Record<string, string> = {
      en: `${base}/en/guides/${g.en.slug}`,
      de: `${base}/de/guides/${g.de.slug}`,
      'x-default': `${base}/${routing.defaultLocale}/guides/${g[routing.defaultLocale].slug}`,
    };
    return routing.locales.map((locale) => ({
      url: `${base}/${locale}/guides/${g[locale].slug}`,
      lastModified: g.updated,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      alternates: { languages },
    }));
  });

  return [...pages, ...guides];
}
