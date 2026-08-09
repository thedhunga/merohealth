/**
 * Locale-aware date formatting, spelled out (`August 9, 2026` /
 * `२०२६ अगस्ट ९`) rather than a raw ISO string — the one place a
 * `CredentialingBadge`'s `lastCheckedAt` needs to become copy a person reads.
 * This is the Gregorian calendar in Devanagari script/numerals, not the
 * Bikram Sambat calendar in common Nepali use — `Intl.DateTimeFormat` has no
 * BS support, and this codebase has no BS-conversion utility to reach for.
 * Node ships full ICU data, so no extra dependency is needed for the
 * Devanagari rendering itself.
 */
export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}
