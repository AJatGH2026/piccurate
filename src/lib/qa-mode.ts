// QA/internal-traffic marker.
//
// Point 2 of docs/review-notes.md: /admin/stats cannot tell the operator's own
// test runs apart from real visitors — a week's worth of numbers
// (results_shown 20 → download_completed 19, 95%) turned out to be entirely
// Andreas testing, not evidence about real users. This is the mechanism to
// stop that: a long-lived, httpOnly cookie the operator sets deliberately on
// their own device before a test run, which every event-writing route reads
// and uses to keep that traffic out of the funnel numbers that judge real
// campaigns.
//
// Deliberately NOT a privacy-policy concern: § 9 of the privacy policy makes
// promises about the VISITOR's device (no cookie needed for the session id,
// because nothing is written to it). This cookie is never set on a visitor's
// device — only on the operator's own, and only after they authenticate with
// ADMIN_TOKEN via /api/qa-mode. An ordinary visitor can never trigger it.
//
// Skipped on purpose: attaching this to a specific browser via the cookie
// means a different device/network still counts as real traffic until QA
// mode is turned on there too — there is no way to retroactively mark past
// events. That's a deliberate trade for not fingerprinting or IP-matching
// visitors; see docs/review-notes.md before changing this to a broader
// heuristic.

import { NextRequest, NextResponse } from 'next/server';

export const QA_COOKIE = 'qa_mode';
const MAX_AGE_S = 180 * 24 * 3600; // long-lived: re-triggering per test run defeats the point

/** True when this request carries the operator's QA-mode cookie. */
export function isQaRequest(request: NextRequest): boolean {
  return request.cookies.get(QA_COOKIE)?.value === '1';
}

/** Set or clear the QA-mode cookie on a response. */
export function setQaCookie(response: NextResponse, on: boolean): void {
  if (on) {
    response.cookies.set(QA_COOKIE, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE_S,
    });
  } else {
    response.cookies.set(QA_COOKIE, '', { path: '/', maxAge: 0 });
  }
}
