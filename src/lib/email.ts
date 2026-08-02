// Minimal transactional email via the Resend REST API — no SDK dependency.
// Used to forward beta feedback to our feedback inbox instead of storing it.
// A no-op (returns false) when RESEND_API_KEY is unset, so the caller can fall
// back to storage and nothing is lost before Resend is configured.

const FEEDBACK_TO: Record<string, string> = {
  de: 'feedback@auswahlbuddy.de',
  en: 'feedback@shortlistbuddy.com',
};

/**
 * The locale-appropriate feedback inbox address (also shown in the UI).
 * `FEEDBACK_TO_OVERRIDE` sends every locale to one inbox — useful while
 * shortlistbuddy.com has no mail reception (see docs/domain-setup.md §2b).
 */
export function feedbackAddress(locale: string): string {
  return process.env.FEEDBACK_TO_OVERRIDE || FEEDBACK_TO[locale] || FEEDBACK_TO.en;
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
  // "from" must be on the Resend-verified SENDING domain — the subdomain
  // feedback.shortlistbuddy.com. Delivery still goes to the locale inbox (`to`),
  // e.g. feedback@auswahlbuddy.de for German feedback. Reply-To points at the
  // real inbox so replies thread there rather than to the no-reply sender.
  // `FEEDBACK_FROM` overrides the address without a code change — needed while
  // feedback.shortlistbuddy.com is unverified in Resend, where the verified
  // noreply@auth.shortlistbuddy.com works today.
  const fromAddress = process.env.FEEDBACK_FROM || 'noreply@feedback.shortlistbuddy.com';
  const from = `${brand} Feedback <${fromAddress}>`;
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
        reply_to: to,
        subject: `Beta feedback (${opts.locale || '?'})`,
        text,
      }),
    });
    if (!res.ok) {
      // Log Resend's reason, not just the status: an unverified sending domain
      // and a bad API key both come back as 4xx and are otherwise
      // indistinguishable in the logs. That cost weeks of silently lost
      // feedback once already.
      const detail = await res.text().catch(() => '');
      console.warn(`[email] Resend send failed (${res.status}) from=${fromAddress} to=${to}:`, detail.slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[email] Resend send error:', err instanceof Error ? err.message : err);
    return false;
  }
}
