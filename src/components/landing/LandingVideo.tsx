'use client';

import { useRef } from 'react';
import { trackEv } from '@/lib/events-client';

/**
 * The explainer video on the landing page (Umsetzungsplan Null-Aufwand-Demo § 6).
 *
 * Self-hosted from /public/video on purpose — a YouTube/Vimeo embed would set
 * cookies and add a recipient the privacy policy does not name. preload="none"
 * so the ~5 MB are only fetched when someone presses play; no autoplay.
 * Fires `video_play` once per page view.
 */
export function LandingVideo({
  locale,
  src,
  poster,
  label,
}: {
  locale: string;
  src: string;
  poster: string;
  label: string;
}) {
  const played = useRef(false);
  return (
    <video
      className="w-full rounded-2xl shadow-xl ring-1 ring-black/5 bg-zinc-100 dark:bg-zinc-900"
      controls
      playsInline
      preload="none"
      poster={poster}
      aria-label={label}
      onPlay={() => {
        if (played.current) return;
        played.current = true;
        trackEv('video_play', locale);
      }}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
