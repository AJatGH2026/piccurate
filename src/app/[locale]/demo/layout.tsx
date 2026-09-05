import type { Metadata } from 'next';

// /demo only flips a localStorage flag and client-redirects into the in-app
// upload flow (which robots.txt already disallows). It has no standalone
// content and its own <title>/description would be empty, so keep it out of
// the index explicitly. It is also excluded from sitemap.ts.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
