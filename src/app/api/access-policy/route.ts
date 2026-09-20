import { NextRequest, NextResponse } from 'next/server';
import { analysisRequiresAccount, remainingPhotoBudget } from '@/lib/access';
import { clientIp } from '@/lib/rate-limit';

// Tells the browser whether a permanent account is required to run an analysis.
// `ANALYSIS_REQUIRES_ACCOUNT` is deliberately server-side only so the browser
// cannot *change* the rule (see lib/access.ts); reading the resulting policy is
// harmless, because it is observable anyway the moment /api/jobs answers 401.
//
// Since 2026-08-27 this answers `false`: the free analysis and the on-screen
// result need no account (terms § 3). The account is required for the ZIP
// download, which is a different step and enforced there. The endpoint stays
// because the rule is a server-side decision the client must not guess — and
// because turning it back on has to take effect for the next visitor.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // `remainingToday`: how many photos this connection may still analyse today
  // (the beta caps in lib/access.ts), or null when no cap applies. Added
  // 2026-09-21 so the upload page can say so BEFORE the transfer — the cap
  // used to surface only at "Analysieren", after 250 photos had been read,
  // thumbnailed and compared. It is the caller's own allowance; a lookup
  // failure yields null and the page simply shows nothing.
  const remainingToday = await remainingPhotoBudget(clientIp(request)).catch(() => null);
  return NextResponse.json(
    { accountRequired: analysisRequiresAccount(), remainingToday },
    // No caching: flipping BETA_OPEN_ACCESS at sales launch must take effect for
    // the next visitor, not after a CDN TTL expires.
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
