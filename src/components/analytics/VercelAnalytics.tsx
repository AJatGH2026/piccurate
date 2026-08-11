'use client';

import { Analytics } from '@vercel/analytics/next';

/**
 * Vercel Web Analytics with the query string stripped before it leaves the page.
 *
 * Vercel records the URL *including* query parameters (documented under
 * "Data point information"). Ours are not all harmless:
 *
 *   /app/upload?session_id=cs_live_…&job=…   Stripe checkout session + job id
 *   /admin/stats?key=…                       the admin token, in the clear
 *   /auth/login?next=…                       where the visitor was headed
 *
 * Sending any of those to a third party would be a leak we chose, not one that
 * happened to us — and the admin token would be a real one. So the allowlist is
 * inverted: everything is dropped except the campaign parameters the
 * measurement concept actually needs.
 *
 * Belt and braces: `/admin` is dropped entirely. It is an operator surface, its
 * page views tell us nothing, and it is the one path where a mistake in the
 * filter would cost a credential.
 */
const KEEP = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']);

export function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const url = new URL(event.url);
          if (url.pathname.includes('/admin')) return null;

          const kept = new URLSearchParams();
          url.searchParams.forEach((value, key) => {
            if (KEEP.has(key.toLowerCase())) kept.append(key, value);
          });
          url.search = kept.toString();
          return { ...event, url: url.toString() };
        } catch {
          // If the URL cannot be parsed we do not know what is in it — drop it.
          return null;
        }
      }}
    />
  );
}
