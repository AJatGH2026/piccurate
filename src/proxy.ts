import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '../i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Optional HTTP Basic Auth gate for the prototype. Active only when
// SITE_PASSWORD is set (so local dev stays open). Protects every matched
// route — pages AND API — so the unauthenticated, uncapped /api/analyze-demo
// endpoint isn't publicly reachable while the prototype is shared with
// invited testers. See product-pipeline.md §4.2.1 and DEPLOY notes.
//
// NOTE: Next.js 16 renamed the "middleware" file convention to "proxy"
// (src/proxy.ts). With a src/ directory the file must live under src/.
//
// IMPORTANT: the Edge runtime does NOT read SITE_PASSWORD from .env.local —
// set it as a real host environment variable (e.g. Vercel project settings),
// otherwise the gate stays disabled. Verified: real process env → gate active.
function isAuthorized(req: NextRequest): boolean {
  const password = process.env.SITE_PASSWORD;
  if (!password) return true; // gate disabled

  const header = req.headers.get('authorization');
  if (!header?.startsWith('Basic ')) return false;

  let decoded: string;
  try {
    decoded = atob(header.slice(6)); // "user:pass"
  } catch {
    return false;
  }
  const sep = decoded.indexOf(':');
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  const expectedUser = process.env.SITE_USER || 'demo';
  return user === expectedUser && pass === password;
}

export default function proxy(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="AuswahlBuddy"' },
    });
  }

  // Only the next-intl middleware handles locale routing — and only for page
  // routes (root or /en|/de…). API routes and the metadata files (robots.txt,
  // sitemap.xml, llms.txt) must pass through untouched, otherwise next-intl
  // would try to redirect them under a locale prefix.
  const { pathname } = req.nextUrl;
  if (pathname === '/' || /^\/(en|de)(\/|$)/.test(pathname)) {
    return intlMiddleware(req);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets, so the auth
  // gate also covers /api, /robots.txt, /sitemap.xml and /llms.txt.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
