// The § 312f BGB confirmation of the contract, as text.
//
// Split out of lib/email.ts on 2026-08-27 so the SAME text can reach the user
// on more than one durable medium. Email was never the only way to meet the
// obligation — § 126b asks for something the recipient can store and reproduce
// unchanged, and a saved file satisfies that — and since the account gate moved
// to the ZIP download, most free contracts are concluded by a visitor we have
// no address for. Those get this text on screen, with a save button, at the
// moment the contract is formed; anyone who later gives us an address gets the
// same text mailed as well.
//
// Deliberately free of any server-only import: this module is bundled into the
// browser. It reads NEXT_PUBLIC_APP_URL through clientConfig, which is inlined
// at build time and safe on both sides.

import { clientConfig } from './config';

interface ContractConfirmationBase {
  tierLabel: string;
  photoLimit: number;
  orderRef: string;
  placedAt: Date;
  locale: string;
}

/**
 * Paid and free contracts both owe the § 312f confirmation, but only one of
 * them has a price. Modelled as a union so a paid confirmation cannot be built
 * without an amount, and a free one cannot claim one.
 */
export type ContractConfirmation = ContractConfirmationBase &
  ({ free: true } | { free?: false; amountGrossCents: number; currency: string });

/**
 * Language-universal short label for a paid tier ('small'/'medium'/'large' →
 * 'S'/'M'/'L'). Deliberately not translated per locale — a size letter needs no
 * German/English distinction, unlike the raw tier key it replaces (which
 * rendered literally as "Tarif small" in a German mail).
 */
export function paidTierLabel(tier: string): string {
  switch (tier) {
    case 'small':
      return 'S';
    case 'medium':
      return 'M';
    case 'large':
      return 'L';
    default:
      return tier;
  }
}

/** The label for the free tier, in the language the contract is concluded in. */
export function freeTierLabel(locale: string): string {
  return locale === 'de' ? 'Gratis' : 'Free';
}

/**
 * Subject and body of the confirmation.
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
export function buildContractConfirmation(o: ContractConfirmation): {
  subject: string;
  text: string;
} {
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
  const site = clientConfig.appUrl;

  // The free tier's opening carries the reassurance, and it comes first on
  // purpose. "Vertragsbestätigung" landing in someone's inbox after they clicked
  // something free reads like a subscription trap — the word cannot be avoided
  // entirely (§ 312f asks for a confirmation of the contract, and the statutory
  // withdrawal notice below says "Vertrag" too), so it is framed as a legal
  // formality and paired with what the reader actually wants to know: nothing is
  // owed and nothing has to be cancelled.
  // Previously two disconnected blocks: "you have 14 days" first, then —
  // several lines later, under an unrelated heading — "it already expired".
  // Read top to bottom that reads as a bait, not a disclosure. Rewritten as one
  // narrative: the right, why it ends early, what to do right now, where the
  // full statutory text lives.
  const withdrawal = de
    ? o.free
      ? [
          'Widerrufsrecht',
          'Du hast grundsätzlich das Recht, diesen Vertrag binnen vierzehn Tagen',
          'ohne Angabe von Gründen zu widerrufen — auch bei einem kostenlosen',
          'Angebot, und in jedem Fall ohne Kosten für dich.',
          '',
          'Weil du der sofortigen Analyse ausdrücklich zugestimmt und bestätigt',
          'hast, dass dein Widerrufsrecht mit deren vollständigem Abschluss endet,',
          'erlischt es in der Praxis meist schon nach wenigen Minuten — sobald der',
          'Analysevorgang fertig ist, nicht erst nach vierzehn Tagen.',
          '',
          'Möchtest du vorher widerrufen, geht das jederzeit formlos, auch online:',
          `${site}/de/withdrawal`,
          '',
          'Die vollständige Widerrufsbelehrung und das Muster-Widerrufsformular',
          'findest du in den Nutzungsbedingungen:',
          `${site}/de/terms`,
        ]
      : [
          'Widerrufsrecht',
          'Du hast das Recht, diesen Vertrag binnen vierzehn Tagen ohne Angabe',
          'von Gründen zu widerrufen.',
          '',
          'Weil du beim Kauf ausdrücklich zugestimmt und bestätigt hast, dass dein',
          'Widerrufsrecht mit vollständiger Erbringung der Leistung endet, erlischt',
          'es in der Praxis meist schon nach wenigen Minuten — sobald der',
          'Analysevorgang fertig ist, nicht erst nach vierzehn Tagen. Widerrufst du',
          'vorher, ist der Widerruf wirksam; für den bereits erbrachten Teil',
          'schuldest du dann anteiligen Wertersatz.',
          '',
          'Widerrufen kannst du jederzeit formlos, auch online:',
          `${site}/de/withdrawal`,
          '',
          'Die vollständige Widerrufsbelehrung und das Muster-Widerrufsformular',
          'findest du in den Nutzungsbedingungen:',
          `${site}/de/terms`,
        ]
    : o.free
      ? [
          'Right of withdrawal',
          'You have the right, in principle, to withdraw from this contract',
          'within fourteen days without giving any reason — this applies to a',
          'free offer too, and it never results in any cost to you.',
          '',
          'Because you expressly consented to the analysis starting immediately',
          'and confirmed that your right of withdrawal ends once it is fully',
          'complete, it typically lapses within a few minutes in practice — once',
          'the analysis job is done, not after fourteen days.',
          '',
          'To withdraw before that, you can do so at any time, informally, online:',
          `${site}/en/withdrawal`,
          '',
          'The full withdrawal notice and the model withdrawal form are in the',
          'Terms of Service:',
          `${site}/en/terms`,
        ]
      : [
          'Right of withdrawal',
          'You have the right to withdraw from this contract within fourteen',
          'days without giving any reason.',
          '',
          'Because you expressly consented at checkout to us beginning',
          'performance immediately and confirmed that your right of withdrawal',
          'ends once it is fully complete, it typically lapses within a few',
          'minutes in practice — once the analysis job is done, not after',
          'fourteen days. If you withdraw before that, the withdrawal is',
          'effective; you then owe proportionate compensation for the part',
          'already performed.',
          '',
          'You can withdraw at any time, informally, online:',
          `${site}/en/withdrawal`,
          '',
          'The full withdrawal notice and the model withdrawal form are in the',
          'Terms of Service:',
          `${site}/en/terms`,
        ];

  const greeting = de ? ['Hallo,', ''] : ['Hello,', ''];
  const opening = o.free
    ? de
      ? [
          ...greeting,
          'du hast die kostenlose Fotoauswahl gestartet. Dieser Text ist die',
          'Bestätigung, die das Gesetz für Geschäfte im Internet vorschreibt',
          '(§ 312f BGB).',
          '',
          'Es ist kein kostenpflichtiger Vertrag entstanden: Es fällt kein Entgelt',
          'an, es gibt kein Abonnement, und du musst nichts kündigen.',
        ]
      : [
          ...greeting,
          'you have started the free photo selection. This text is the',
          'confirmation that the law requires for online transactions',
          '(section 312f of the German Civil Code).',
          '',
          'No paid contract has been entered into: nothing is charged, there is no',
          'subscription, and there is nothing to cancel.',
        ]
    : de
      ? [...greeting, 'vielen Dank für deine Bestellung. Hiermit bestätigen wir den Vertrag.']
      : [...greeting, 'thank you for your order. We hereby confirm the contract.'];

  const text = (
    de
      ? [
          ...opening,
          '',
          // padEnd keeps the columns aligned whichever labels the branch picks —
          // hand-counted spaces drifted the moment "Bestellnummer" became
          // "Vorgangsnummer" for the free tier.
          `${'Leistung:'.padEnd(16)}Fotoauswahl, Tarif ${o.tierLabel}`,
          `${'Umfang:'.padEnd(16)}bis zu ${o.photoLimit.toLocaleString('de-DE')} Fotos, einmaliger Vorgang`,
          `${'Preis:'.padEnd(16)}${amount}`,
          `${(o.free ? 'Vorgangsnummer:' : 'Bestellnummer:').padEnd(16)}${o.orderRef}`,
          `${(o.free ? 'Zeitpunkt:' : 'Bestellt am:').padEnd(16)}${when} (Zeitzone Europe/Berlin)`,
          '',
          ...withdrawal,
          '',
          '—',
          'AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Deutschland',
          'Amtsgericht Wiesbaden HRB 33249 · USt-IdNr. DE433664608',
        ]
      : [
          ...opening,
          '',
          `${'Service:'.padEnd(12)}Photo selection, plan ${o.tierLabel}`,
          `${'Scope:'.padEnd(12)}up to ${o.photoLimit.toLocaleString('en-GB')} photos, one-off job`,
          `${'Price:'.padEnd(12)}${amount}`,
          `${(o.free ? 'Job ref:' : 'Order ref:').padEnd(12)}${o.orderRef}`,
          `${(o.free ? 'Time:' : 'Placed:').padEnd(12)}${when} (time zone Europe/Berlin)`,
          '',
          ...withdrawal,
          '',
          '—',
          'AJ GmbH, Danziger Str. 80, 65191 Wiesbaden, Germany',
          'Amtsgericht Wiesbaden HRB 33249 · VAT ID DE433664608',
        ]
  ).join('\n');

  // No job id in the subject: it is a UUID, it means nothing to the reader and
  // it makes a routine mail look like a ticket from a debt collector. The
  // reference stays in the body, where support can find it.
  const subject = o.free
    ? de
      ? 'Bestätigung Gratis-Angebot'
      : 'Confirmation of your free plan'
    : de
      ? 'Bestellbestätigung'
      : 'Order confirmation';

  return { subject, text };
}

/** Filename for the saved copy, e.g. `vertragsbestaetigung-1a2b3c4d.txt`. */
export function confirmationFilename(orderRef: string, locale: string): string {
  const stem = locale === 'de' ? 'vertragsbestaetigung' : 'contract-confirmation';
  return `${stem}-${orderRef.slice(0, 8)}.txt`;
}
