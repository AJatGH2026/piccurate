import { NextRequest, NextResponse } from 'next/server';
import { safeNextPath } from '@/lib/auth/next-path';

/**
 * Email-confirmation landing.
 *
 * Supabase confirms the email at its own `/auth/v1/verify` endpoint *before*
 * redirecting here — proven in practice: corporate link-scanners (Microsoft
 * Safe Links, Proofpoint URL Defense, …) that merely fetch the link, and never
 * complete the PKCE exchange, still flip the account to confirmed. So we do
 * NOT exchange the code for a session here: that would auto-log-in whoever
 * (or whatever) clicked the link. Instead we send the user to the login page to
 * authenticate explicitly with their password.
 *
 * On failure Supabase appends `?error=…&error_code=…` (e.g. otp_expired) to the
 * redirect — we forward that as a flag so login can show a helpful message.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params;
  const { searchParams } = new URL(request.url);
  const hasError = searchParams.get('error') || searchParams.get('error_code');

  // Hand the return path on to the login page. Only a same-site absolute path
  // is forwarded — this value came back from an email round-trip, so it must be
  // treated as attacker-controlled: an unchecked `next` would turn our login
  // into a redirect that starts on our domain and ends on someone else's.
  const raw = searchParams.get('next');
  const next = safeNextPath(raw, locale);
  const carry = next !== `/${locale}` ? `&next=${encodeURIComponent(next)}` : '';

  const target = hasError
    ? `/${locale}/auth/login?confirm_error=1${carry}`
    : `/${locale}/auth/login?confirmed=1${carry}`;

  return NextResponse.redirect(new URL(target, request.url));
}
