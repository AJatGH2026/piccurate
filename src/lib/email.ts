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

/** One recipient, one plain-text mail. Shared by the withdrawal receipt. */
async function sendMail(opts: {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  locale: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const brand = opts.locale === 'de' ? 'AuswahlBuddy' : 'ShortlistBuddy';
  const fromAddress = process.env.FEEDBACK_FROM || 'noreply@feedback.shortlistbuddy.com';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${brand} <${fromAddress}>`,
        to: [opts.to],
        reply_to: opts.replyTo,
        subject: opts.subject,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn(`[email] Resend send failed (${res.status}) to=${opts.to}:`, detail.slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[email] Resend send error:', err instanceof Error ? err.message : err);
    return false;
  }
}

export interface WithdrawalDeclaration {
  name: string;
  contractRef: string;
  email: string;
  note?: string;
  /** Server-side moment of receipt — this is the legally relevant timestamp. */
  receivedAt: Date;
  locale: string;
}

/**
 * § 356a Abs. 4 BGB: on activation of the confirmation function we must send a
 * receipt on a durable medium "immediately", containing at minimum the content
 * of the withdrawal declaration and the date and time it was received.
 *
 * Deliberately worded as a receipt, not an acceptance: confirming that a
 * declaration arrived is not the same as conceding that the withdrawal is
 * effective, and the two must not be blurred.
 */
export async function sendWithdrawalReceipt(d: WithdrawalDeclaration): Promise<boolean> {
  const de = d.locale === 'de';
  // Berlin time is what a German consumer reads off their own clock; the UTC
  // value goes alongside so the record is unambiguous across DST.
  const local = d.receivedAt.toLocaleString(de ? 'de-DE' : 'en-GB', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'full',
    timeStyle: 'medium',
  });
  const body = de
    ? [
        'Wir bestätigen den Eingang deiner Widerrufserklärung.',
        '',
        'Inhalt deiner Erklärung:',
        `  Name: ${d.name}`,
        `  Vertrag / Bestellung: ${d.contractRef}`,
        `  E-Mail für die Bestätigung: ${d.email}`,
        ...(d.note ? [`  Ergänzende Angaben: ${d.note}`] : []),
        '  Erklärung: Hiermit widerrufe ich den oben bezeichneten Vertrag.',
        '',
        `Eingegangen am: ${local} (Zeitzone Europe/Berlin)`,
        `Eingegangen am (UTC): ${d.receivedAt.toISOString()}`,
        '',
        'Diese E-Mail bestätigt ausschließlich den Zeitpunkt und den Inhalt des',
        'Eingangs. Eine inhaltliche Prüfung deines Widerrufs ist damit noch nicht',
        'verbunden. Wir melden uns, sobald wir den Vorgang bearbeitet haben.',
        '',
        'Bitte bewahre diese E-Mail als Nachweis auf.',
        '',
        '—',
        'AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Deutschland',
      ]
    : [
        'We confirm receipt of your withdrawal declaration.',
        '',
        'Content of your declaration:',
        `  Name: ${d.name}`,
        `  Contract / order: ${d.contractRef}`,
        `  Email for the confirmation: ${d.email}`,
        ...(d.note ? [`  Additional details: ${d.note}`] : []),
        '  Declaration: I hereby withdraw from the contract identified above.',
        '',
        `Received on: ${local} (time zone Europe/Berlin)`,
        `Received on (UTC): ${d.receivedAt.toISOString()}`,
        '',
        'This email confirms only the time and content of receipt. It does not',
        'yet involve any assessment of the substance of your withdrawal. We will',
        'be in touch once we have processed it.',
        '',
        'Please keep this email as your record.',
        '',
        '—',
        'AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Germany',
      ];
  const inbox = feedbackAddress(d.locale);
  return sendMail({
    to: d.email,
    replyTo: inbox,
    subject: de ? 'Eingangsbestätigung: Widerruf' : 'Receipt of your withdrawal',
    text: body.join('\n'),
    locale: d.locale,
  });
}

/** Copy to our own inbox — the operator side of the same record. */
export async function sendWithdrawalNotice(d: WithdrawalDeclaration): Promise<boolean> {
  const inbox = feedbackAddress(d.locale);
  return sendMail({
    to: inbox,
    replyTo: d.email,
    subject: `WIDERRUF eingegangen — ${d.contractRef}`,
    text: [
      'Eine Widerrufserklärung ist über die Widerrufsfunktion (§ 356a BGB) eingegangen.',
      '',
      `Name:      ${d.name}`,
      `Vertrag:   ${d.contractRef}`,
      `E-Mail:    ${d.email}`,
      `Hinweis:   ${d.note || '-'}`,
      `Eingang:   ${d.receivedAt.toISOString()} (UTC)`,
      `Sprache:   ${d.locale}`,
      '',
      'Die Eingangsbestätigung an den Verbraucher wurde automatisch versendet.',
    ].join('\n'),
    locale: d.locale,
  });
}
