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

interface OrderConfirmationBase {
  to: string;
  tierLabel: string;
  photoLimit: number;
  orderRef: string;
  placedAt: Date;
  locale: string;
}

/**
 * Paid and free contracts both owe the § 312f confirmation, but only one of
 * them has a price. Modelled as a union so a paid confirmation cannot be sent
 * without an amount, and a free one cannot claim one.
 */
export type OrderConfirmation = OrderConfirmationBase &
  ({ free: true } | { free?: false; amountGrossCents: number; currency: string });

/**
 * § 312f BGB: confirmation of the contract on a durable medium, within a
 * reasonable time and before performance begins.
 *
 * Owed in its own right, and a failure to send it is worth surfacing rather
 * than swallowing.
 *
 * On the withdrawal wording below: this is a digital *service* (§ 327 Abs. 2
 * BGB), so § 356 Abs. 5 BGB applies and the right expires on **complete**
 * performance — never at its start, which is § 356 Abs. 6 and covers digital
 * content instead. The June 2026 renumbering moved services from Abs. 4 to
 * Abs. 5 and digital content from Abs. 5 to Abs. 6; an earlier draft here took
 * the new number with the old meaning and told customers the right lapsed the
 * moment analysis began. It does not, and a mid-run withdrawal stays effective
 * against pro-rata Wertersatz.
 *
 * Deliberately not an invoice. A VAT invoice needs the tax rate, and that
 * follows from the Stripe Tax / OSS setup, which is not decided yet. Stripe
 * Invoicing should issue those once it is; hand-rolling one here would mean
 * guessing a rate.
 */
export async function sendOrderConfirmation(o: OrderConfirmation): Promise<boolean> {
  const de = o.locale === 'de';
  const amount = o.free
    ? de
      ? 'kostenlos — es fällt kein Entgelt an'
      : 'free of charge — no fee is payable'
    : new Intl.NumberFormat(de ? 'de-DE' : 'en-IE', {
        style: 'currency',
        currency: o.currency.toUpperCase(),
      }).format(o.amountGrossCents / 100) + (de ? ' inkl. gesetzlicher Umsatzsteuer' : ' including statutory VAT');
  const when = o.placedAt.toLocaleString(de ? 'de-DE' : 'en-GB', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const site = process.env.NEXT_PUBLIC_APP_URL || 'https://shortlistbuddy.com';

  const body = de
    ? [
        o.free
          ? 'Hiermit bestätigen wir den Vertrag über deine kostenlose Fotoauswahl.'
          : 'Vielen Dank für deine Bestellung. Hiermit bestätigen wir den Vertrag.',
        '',
        // padEnd keeps the columns aligned whichever labels the branch picks —
        // hand-counted spaces drifted the moment "Bestellnummer" became
        // "Vorgangsnummer" for the free tier.
        `${'Leistung:'.padEnd(16)}Fotoauswahl, Tarif ${o.tierLabel}`,
        `${'Umfang:'.padEnd(16)}bis zu ${o.photoLimit.toLocaleString('de-DE')} Fotos, einmaliger Vorgang`,
        `${'Preis:'.padEnd(16)}${amount}`,
        `${(o.free ? 'Vorgangsnummer:' : 'Bestellnummer:').padEnd(16)}${o.orderRef}`,
        `${(o.free ? 'Geschlossen am:' : 'Bestellt am:').padEnd(16)}${when} (Zeitzone Europe/Berlin)`,
        '',
        'Widerrufsrecht',
        'Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen zu',
        'widerrufen. Die vollständige Widerrufsbelehrung und das',
        'Muster-Widerrufsformular findest du in den Nutzungsbedingungen:',
        `${site}/de/terms`,
        '',
        'Widerrufen kannst du auch direkt online:',
        `${site}/de/withdrawal`,
        '',
        `Hinweis zum vorzeitigen Erlöschen: Du hast ${o.free ? 'vor der Analyse' : 'beim Kauf'} ausdrücklich`,
        'zugestimmt, dass wir vor Ablauf der Widerrufsfrist mit der Ausführung',
        'beginnen, und bestätigt, dass du dein Widerrufsrecht mit der',
        'vollständigen Erbringung der Leistung verlierst. Es erlischt daher,',
        'sobald der Analysevorgang vollständig durchgeführt ist — nicht schon',
        'mit seinem Beginn. Widerrufst du vorher, ist der Widerruf wirksam;',
        o.free
          ? 'da kein Entgelt anfällt, entstehen dabei weder Erstattungen noch Wertersatz.'
          : 'für den bereits erbrachten Teil schuldest du dann anteiligen Wertersatz.',
        '',
        '—',
        'AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Deutschland',
        'Amtsgericht Wiesbaden HRB 33249 · USt-IdNr. DE433664608',
      ]
    : [
        o.free
          ? 'We hereby confirm the contract for your free photo selection.'
          : 'Thank you for your order. We hereby confirm the contract.',
        '',
        `${'Service:'.padEnd(12)}Photo selection, ${o.tierLabel} plan`,
        `${'Scope:'.padEnd(12)}up to ${o.photoLimit.toLocaleString('en-GB')} photos, one-off job`,
        `${'Price:'.padEnd(12)}${amount}`,
        `${(o.free ? 'Job ref:' : 'Order ref:').padEnd(12)}${o.orderRef}`,
        `${(o.free ? 'Concluded:' : 'Placed:').padEnd(12)}${when} (time zone Europe/Berlin)`,
        '',
        'Right of withdrawal',
        'You have the right to withdraw within fourteen days without giving any',
        'reason. The full withdrawal notice and the model withdrawal form are in',
        'the Terms of Service:',
        `${site}/en/terms`,
        '',
        'You can also withdraw online:',
        `${site}/en/withdrawal`,
        '',
        `Note on early expiry: ${o.free ? 'before the analysis' : 'at checkout'} you expressly consented to us`,
        'beginning performance before the withdrawal period expires and confirmed',
        'that you lose your right of withdrawal upon complete performance. It',
        'therefore expires once the analysis job has been carried out in full —',
        'not when it begins. If you withdraw before that, the withdrawal is',
        'effective;',
        o.free
          ? 'as no fee is payable, this involves neither refunds nor compensation for value.'
          : 'you then owe proportionate compensation for the part already performed.',
        '',
        '—',
        'AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Germany',
        'Amtsgericht Wiesbaden HRB 33249 · VAT ID DE433664608',
      ];

  return sendMail({
    to: o.to,
    replyTo: feedbackAddress(o.locale),
    subject: o.free
      ? de
        ? `Vertragsbestätigung ${o.orderRef}`
        : `Contract confirmation ${o.orderRef}`
      : de
        ? `Bestellbestätigung ${o.orderRef}`
        : `Order confirmation ${o.orderRef}`,
    text: body.join('\n'),
    locale: o.locale,
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
