import { NextRequest, NextResponse } from 'next/server';
import {
  buildContractConfirmation,
  confirmationFilename,
  freeTierLabel,
  paidTierLabel,
} from '@/lib/contract-confirmation';

/**
 * GET /api/contract-confirmation?job=…&tier=…&limit=…&at=…&locale=…
 *
 * The § 312f BGB confirmation as a downloadable text file.
 *
 * **Why a route at all, when the text is built in the browser anyway.**
 * Reported over three rounds on 2026-09-10 from an iPhone: every blob-based
 * variant of this download failed on iOS.
 *
 *   1. Blob created in the opener, link clicked in a popup → Safari navigated
 *      to the blob URL and could not resolve it ("WebKitBlobResource-Fehler 1").
 *   2. Blob created in the popup's own realm, `application/octet-stream` →
 *      the popup showed iOS's document-preview page ("In Pages öffnen / Mehr…")
 *      instead of saving, and a reload of that page brought the error back.
 *   3. Same-tab `<a download>` → same preview page, same error on reload.
 *
 * The common thread is that iOS does not treat `<a download>` on a blob URL as
 * a save. It navigates a context to the URL, and a blob URL is a lifetime-bound
 * handle into one document's registry — it dies on revoke, on reload, and
 * across contexts, which is why the failure kept moving instead of going away.
 *
 * A same-origin URL with `Content-Disposition: attachment` has none of those
 * properties. It is the path iOS's own download manager is built for: the file
 * lands in Files under its real name, a reload re-fetches it instead of hitting
 * a dead handle, and no realm, revoke timer or popup is involved anywhere.
 *
 * **No new data reaches the server.** Every parameter is something the client
 * already got FROM the server when the job was created; the route is a pure
 * template render with no database access and no session lookup. It is
 * deliberately not authenticated: the contract this documents is concluded
 * anonymously (the account gate sits on the ZIP download), so there is nobody
 * to authenticate, and there is nothing to leak — the caller supplies the
 * values and gets them back formatted. For the same reason there is no rate
 * limit: the handler does no I/O, so a check backed by a network round trip
 * would cost more than the abuse it prevents.
 */

// The tiers that may appear in the text. A closed set on purpose: `tier` is
// rendered into the body, and accepting arbitrary text would let anyone build
// a file that looks like our confirmation but says something we never wrote.
const TIERS = new Set(['free', 'small', 'medium', 'large']);

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const job = sp.get('job') || '';
  // Also what keeps the Content-Disposition header below injection-free —
  // the job id is the only caller-supplied value that reaches it.
  if (!/^[0-9a-fA-F-]{8,64}$/.test(job)) {
    return NextResponse.json({ error: 'Invalid job reference' }, { status: 400 });
  }

  const tier = sp.get('tier') || 'free';
  if (!TIERS.has(tier)) {
    return NextResponse.json({ error: 'Unknown tier' }, { status: 400 });
  }

  const photoLimit = Number(sp.get('limit'));
  if (!Number.isInteger(photoLimit) || photoLimit <= 0 || photoLimit > 1_000_000) {
    return NextResponse.json({ error: 'Invalid photo limit' }, { status: 400 });
  }

  const placedAt = new Date(sp.get('at') || '');
  if (Number.isNaN(placedAt.getTime())) {
    return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 });
  }

  const locale = sp.get('locale') === 'de' ? 'de' : 'en';

  // `free: true` because this is the only kind of contract the in-flow
  // confirmation covers today. A paid one owes an amount (see the union in
  // lib/contract-confirmation.ts) and would need it passed and validated here.
  const { text } = buildContractConfirmation({
    free: true,
    tierLabel: tier === 'free' ? freeTierLabel(locale) : paidTierLabel(tier),
    photoLimit,
    orderRef: job,
    placedAt,
    locale,
  });

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // The header, not the <a download> attribute, is what actually decides
      // this on iOS — and it is what makes the response a file rather than a
      // page, so a reload cannot turn it into one.
      'Content-Disposition': `attachment; filename="${confirmationFilename(job, locale)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
