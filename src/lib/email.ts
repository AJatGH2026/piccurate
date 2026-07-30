// Minimal transactional email via the Resend REST API — no SDK dependency.
// Used to forward beta feedback to our feedback inbox instead of storing it.
// A no-op (returns false) when RESEND_API_KEY is unset, so the caller can fall
// back to storage and nothing is lost before Resend is configured.

const FEEDBACK_TO: Record<string, string> = {
  de: 'feedback@auswahlbuddy.de',
  en: 'feedback@shortlistbuddy.com',
};

/** The locale-appropriate feedback inbox address (also shown in the UI). */
export function feedbackAddress(locale: string): string {
  return FEEDBACK_TO[locale] ?? FEEDBACK_TO.en;
}

/** True when a Resend API key is present (server-side only). */
export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Send a feedback message to the locale's feedback inbox. Returns true on a
 * successful send, false when unconfigured or on any error (caller falls back).
 */
export async function sendFeedbackEmail(opts: {
  message: string;
  locale: string;
  path?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const message = String(opts.message || '').trim().slice(0, 5000);
  if (!message) return false;

  const to = feedbackAddress(opts.locale);
  const brand = opts.locale === 'de' ? 'AuswahlBuddy' : 'ShortlistBuddy';
  // "from" must be on a Resend-verified domain. Only shortlistbuddy.com is
  // verified, so ALL mail is sent from there; delivery still goes to the
  // locale inbox (`to`), e.g. feedback@auswahlbuddy.de for German feedback.
  const from = `${brand} Feedback <feedback@shortlistbuddy.com>`;
  const text = [
    message,
    '',
    '—',
    `locale: ${opts.locale || '-'}`,
    `path: ${opts.path || '-'}`,
    `time: ${new Date().toISOString()}`,
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Beta feedback (${opts.locale || '?'})`,
        text,
      }),
    });
    if (!res.ok) {
      console.warn('[email] Resend send failed:', res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[email] Resend send error:', err instanceof Error ? err.message : err);
    return false;
  }
}
