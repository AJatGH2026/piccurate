'use client';

import { useEffect } from 'react';
import { referrerDomain, trackEv } from '@/lib/events-client';

/**
 * Fires `content_view` on mount — the guides and the press page, i.e. the
 * pages a search engine or an AI assistant is most likely to link to instead
 * of the home page. Added 2026-11-08 for GEO measurement (product-pipeline
 * §8.9): until then only the home page carried the referrer host, so a visit
 * sent by ChatGPT or Perplexity straight to a guide was invisible.
 *
 * `page` is a fixed, non-personal label ('guides', 'guide:<slug>', 'press').
 */
export function TrackContentView({ locale, page }: { locale: string; page: string }) {
  useEffect(() => {
    trackEv('content_view', locale, { page, referrer_domain: referrerDomain() });
  }, [locale, page]);

  return null;
}
