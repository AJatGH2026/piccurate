'use client';

import Link from 'next/link';
import { trackEv } from '@/lib/events-client';

/**
 * The landing page's "Mit Beispielfotos ansehen" link. A client component only
 * because it fires `sample_demo_start` on click; the page itself is a server
 * component (same split as TrackLandingView).
 */
export function SampleDemoLink({
  locale,
  className,
  children,
}: {
  locale: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/${locale}/demo/beispiel`}
      onClick={() => trackEv('sample_demo_start', locale)}
      className={className}
    >
      {children}
    </Link>
  );
}
