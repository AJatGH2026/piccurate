// Shared bot heuristics for the public, unauthenticated forms.
//
// Added after a spam bot found the § 356a withdrawal form within a day of it
// going live (10 August 2026) and started posting random strings every few
// minutes. The same filters guard the beta signals, which are unauthenticated
// for the same reason and reachable by the same crawler.
//
// Two rules hold everywhere they are used:
//
// - A field that is *absent* is never evidence. A tab opened before the
//   deployment that introduced these signals posts neither of them, and its
//   sender must not be turned away for something they could not have sent.
// - A rejection is never disguised as success. The caller records the
//   submission and reports the failure, so a false positive costs a retry
//   rather than the message itself.
//
// See docs/legal/widerruf-botschutz.md (local) for the reasoning behind the
// withdrawal function, where a false positive is most expensive.

/** A human needs longer than this to read a form and fill it in. */
export const MIN_DWELL_MS = 2500;

export type BotVerdict = 'honeypot' | 'too_fast' | null;

/**
 * Judge a submission by the two signals the client sends alongside it:
 * `website` (the honeypot — invisible, so anything in it came from a script)
 * and `elapsedMs` (time on the form). Returns the reason it looks automated,
 * or null when nothing is against it.
 */
export function detectBot(body: Record<string, unknown>): BotVerdict {
  if (String(body.website ?? '').trim()) return 'honeypot';

  const dwellMs = Number(body.elapsedMs);
  if (Number.isFinite(dwellMs) && dwellMs >= 0 && dwellMs < MIN_DWELL_MS) return 'too_fast';

  return null;
}
