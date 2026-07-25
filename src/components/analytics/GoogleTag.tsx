'use client';

import Script from 'next/script';
import { GA4_ID, ADS_ID, googleTagEnabled } from '@/lib/analytics';

/**
 * Loads gtag.js (GA4 + Google Ads) with Consent Mode v2. Renders nothing unless
 * a tag id is configured, so it's fully dormant during the gated-tester phase.
 *
 * Consent defaults to DENIED for all four storage types before gtag.js runs;
 * the ConsentBanner flips it to granted only on the user's explicit choice.
 */
export function GoogleTag() {
  if (!googleTagEnabled()) return null;
  const primaryId = GA4_ID || ADS_ID; // gtag.js needs one id in the URL

  return (
    <>
      <Script id="gtag-consent-default" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
        `}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${primaryId}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          gtag('js', new Date());
          ${GA4_ID ? `gtag('config','${GA4_ID}');` : ''}
          ${ADS_ID ? `gtag('config','${ADS_ID}');` : ''}
        `}
      </Script>
    </>
  );
}
