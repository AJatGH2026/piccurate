import { NextRequest, NextResponse } from 'next/server';

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

  const target = hasError
    ? `/${locale}/auth/login?confirm_error=1`
    : `/${locale}/auth/login?confirmed=1`;

  return NextResponse.redirect(new URL(target, request.url));
}
