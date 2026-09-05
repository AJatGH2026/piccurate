import { ImageResponse } from 'next/og';
import { brandName, brandDomain } from '@/lib/brand';

// Shared renderer for the Open Graph / Twitter share image. Both
// `opengraph-image.tsx` and `twitter-image.tsx` in this segment re-export from
// here, so the card is defined once and stays identical across the two.
//
// 1200x630 is the frame every major platform (WhatsApp, iMessage, Slack,
// LinkedIn, X, Facebook) crops its preview from; `og:image:width/height` are
// emitted automatically from `size`.
//
// The tagline mirrors messages/*.json `hero.titleHighlight` but is kept as a
// literal here rather than pulled through next-intl: this route runs at build
// time and a missing-message / request-context edge case must not be able to
// fail the build for a picture. If the hero value line changes materially,
// update these two strings too.

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'ShortlistBuddy — pick your best travel photos in minutes';

// Prerender one card per locale at build time instead of rendering on first
// share (the parent [locale] segment's generateStaticParams doesn't reach
// these metadata routes).
export function ogCardStaticParams() {
  return [{ locale: 'en' }, { locale: 'de' }];
}

const KICKER: Record<'en' | 'de', string> = {
  en: 'AI travel photo curation',
  de: 'KI-Reisefoto-Auswahl',
};

const TAGLINE: Record<'en' | 'de', string> = {
  en: 'Pick your best travel photos — in minutes',
  de: 'Wähle deine schönsten Urlaubsfotos — in Minuten',
};

export function renderOgCard(locale: string) {
  const loc: 'en' | 'de' = locale === 'de' ? 'de' : 'en';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '96px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', fontSize: 38, fontWeight: 600, letterSpacing: 1, opacity: 0.85 }}>
          {KICKER[loc]}
        </div>
        <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, marginTop: 20 }}>
          {brandName(loc)}
        </div>
        <div style={{ display: 'flex', fontSize: 46, fontWeight: 500, marginTop: 24, maxWidth: 940, opacity: 0.96 }}>
          {TAGLINE[loc]}
        </div>
        <div style={{ display: 'flex', fontSize: 30, marginTop: 56, opacity: 0.8 }}>
          {brandDomain(loc)}
        </div>
      </div>
    ),
    { ...size }
  );
}
