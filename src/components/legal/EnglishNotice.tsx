/**
 * Banner at the head of every English legal page: the German text is the
 * binding one, the English is a convenience translation.
 *
 * A clause buried at the end of the terms is easy to argue away — what counts
 * is whether the reader could take notice of it, so it sits above the text.
 *
 * `contractual` picks the wording. Terms of Service are a contract, so the
 * German version can be *agreed* to prevail. A privacy policy and an imprint
 * are statutory information, not agreements — there the notice may only state
 * which version is authoritative, not stipulate it.
 */
export function EnglishNotice({ contractual = false }: { contractual?: boolean }) {
  return (
    <aside
      className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
      role="note"
    >
      {contractual ? (
        <>
          <strong>Language of the contract.</strong> The contract language is German. This English
          version is a translation provided for convenience. In the event of any inconsistency, the
          German version prevails, to the extent legally permissible in relation to you and subject
          to mandatory consumer-protection law.
        </>
      ) : (
        <>
          <strong>Please note.</strong> This is a translation of the German original, provided for
          convenience. Only the German version is authoritative.
        </>
      )}
    </aside>
  );
}
