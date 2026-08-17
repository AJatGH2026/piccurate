'use client';

import { useEffect } from 'react';
import { trackEv } from '@/lib/events-client';

/**
 * Fires `landing_view` (Event-Spezifikation §3) on mount. A separate client
 * component because page.tsx is a server component (generateMetadata,
 * structured-data fetch) and this is the one piece of it that needs the
 * browser (document.referrer, the session's first-contact UTM capture).
 */
export function TrackLandingView({ locale }: { locale: string }) {
  useEffect(() => {
    let referrer_domain = '';
    try {
      referrer_domain = document.referrer ? new URL(document.referrer).hostname : '';
    } catch {
      /* ignore */
    }
    trackEv('landing_view', locale, { referrer_domain });
  }, [locale]);

  return null;
}
