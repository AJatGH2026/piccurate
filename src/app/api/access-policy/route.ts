import { NextResponse } from 'next/server';
import { betaOpenAccess } from '@/lib/access';

// Tells the browser whether a permanent account is required before a job may be
// created. `BETA_OPEN_ACCESS` is deliberately server-side only so the browser
// cannot *change* the rule (see lib/access.ts); reading the resulting policy is
// harmless, because it is observable anyway the moment /api/jobs answers 401.
//
// Why it exists at all: without it the flow only learns "account required" when
// the user presses Analyse — after uploading up to 250 photos, which takes
// minutes. The gate has to appear before the work, not after it.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { accountRequired: !betaOpenAccess() },
    // No caching: flipping BETA_OPEN_ACCESS at sales launch must take effect for
    // the next visitor, not after a CDN TTL expires.
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
