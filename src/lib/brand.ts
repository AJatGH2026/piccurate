// Locale-aware brand name. The product is marketed per language:
//   German  → "AuswahlBuddy"  (auswahlbuddy.de)
//   English → "ShortlistBuddy" (shortlistbuddy.com)
// Use this everywhere the brand is shown so a page renders the right name for
// its locale, independent of which domain served it.

export function brandName(locale: string): string {
  return locale === 'en' ? 'ShortlistBuddy' : 'AuswahlBuddy';
}

/** Brand contact/domain per locale (for legal pages, emails, links). */
export function brandDomain(locale: string): string {
  return locale === 'en' ? 'shortlistbuddy.com' : 'auswahlbuddy.de';
}
