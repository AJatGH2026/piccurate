'use client';

import { useEffect } from 'react';
import { referrerDomain, trackEv } from '@/lib/events-client';

/**
 * Fires `landing_view` (Event-Spezifikation §3) on mount. A separate client
 * component because page.tsx is a server component (generateMetadata,
 * structured-data fetch) and this is the one piece of it that needs the
 * browser (document.referrer, the session's first-contact UTM capture).
 */
export function TrackLandingView({ locale }: { locale: string }) {
  useEffect(() => {
    trackEv('landing_view', locale, { referrer_domain: referrerDomain() });
  }, [locale]);

  return null;
}
