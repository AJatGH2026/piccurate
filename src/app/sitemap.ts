import type { MetadataRoute } from 'next';
import { clientConfig } from '@/lib/config';
import { routing } from '../../i18n/routing';
import { GUIDES } from '@/content/guides';

// Served at /sitemap.xml. See docs/product-pipeline.md §8.1.
// Lists the public, indexable pages for every locale and declares the
// DE/EN equivalents as hreflang alternates (incl. x-default → en).

const base = clientConfig.appUrl;

// Public marketing/content pages (path suffix after the locale), with a
// rough priority. The in-app flow is intentionally excluded (see robots.ts).
const PAGES: { path: string; priority: number }[] = [
  { path: '', priority: 1.0 }, // landing
  { path: '/guides', priority: 0.6 }, // guides index (shared slug)
  { path: '/demo', priority: 0.7 },
  { path: '/privacy', priority: 0.3 },
  { path: '/terms', priority: 0.3 },
  { path: '/imprint', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Shared-slug pages: same path suffix in every locale.
  const pages = PAGES.flatMap(({ path, priority }) => {
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
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      alternates: { languages },
    }));
  });

  return [...pages, ...guides];
}
