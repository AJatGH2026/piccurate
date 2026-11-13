// Maps a Supabase auth error to a message key in the `auth` namespace.
//
// Added 2026-11-13: the login, password-reset and download-gate forms showed
// `error.message` verbatim — GoTrue's English text ("Invalid login
// credentials") on the German site too. The auth logs of 08.–12.11. show a
// visitor failing the password login five times and asking for a reset each
// time; whatever they saw, it was raw English.
//
// Keyed on `error.code` (auth-js ≥ 2.6x sets it for HTTP errors), with the
// HTTP status as the fallback for rate limits. Anything unrecognised gets a
// neutral sentence rather than the raw text — the raw text is still in the
// browser console via the callers' own logging if it is ever needed.
//
// Deliberately no key that would reveal whether an account exists: GoTrue
// already answers `invalid_credentials` for both "no such user" and "wrong
// password", and the message keeps it that way.

export type AuthErrorKey =
  | 'errInvalidCredentials'
  | 'errEmailNotConfirmed'
  | 'errEmailTaken'
  | 'errWeakPassword'
  | 'errSamePassword'
  | 'errRateLimit'
  | 'errGeneric';

export function authErrorKey(err: unknown): AuthErrorKey {
  const e = (err ?? {}) as { code?: unknown; status?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  switch (code) {
    case 'invalid_credentials':
      return 'errInvalidCredentials';
    case 'email_not_confirmed':
      return 'errEmailNotConfirmed';
    case 'user_already_exists':
    case 'email_exists':
    case 'identity_already_exists':
      return 'errEmailTaken';
    case 'weak_password':
      return 'errWeakPassword';
    case 'same_password':
      return 'errSamePassword';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
      return 'errRateLimit';
  }
  if (e.status === 429) return 'errRateLimit';
  return 'errGeneric';
}
