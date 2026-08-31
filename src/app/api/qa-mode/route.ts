import { NextRequest, NextResponse } from 'next/server';
import { adminTokenOk } from '@/lib/admin-auth';
import { setQaCookie } from '@/lib/qa-mode';

/**
 * GET /api/qa-mode?token=<ADMIN_TOKEN>[&off=1]
 *
 * Visited directly (bookmark it on the phone before a test run) to mark this
 * browser's future events as internal — see lib/qa-mode.ts and
 * docs/review-notes.md point 2. Same secret as /admin/stats on purpose: one
 * fewer credential to hand out, and anyone who can already read the funnel
 * can already tell whether marking works.
 *
 * GET, not POST: this needs to be triggerable by typing/pasting a URL on a
 * phone mid-test, same reasoning as the existing /admin/stats gate.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? undefined;
  if (!adminTokenOk(token)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const off = request.nextUrl.searchParams.get('off') === '1';
  const response = NextResponse.json({
    ok: true,
    qa_mode: !off,
    note: off
      ? 'QA-Modus aus — dieses Gerät zählt ab jetzt wieder als normaler Besuch.'
      : 'QA-Modus an — Events von diesem Gerät/Browser fließen ab jetzt nicht mehr in die Kampagnen-/Trichterzahlen ein. Zum Ausschalten: &off=1 anhängen.',
  });
  setQaCookie(response, !off);
  return response;
}
