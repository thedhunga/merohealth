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
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    // Format in UTC, not the viewer's zone. These are calendar dates — the day
    // a sample was taken, a certificate was checked — not instants. Rendering
    // them locally shifts them by a day for anyone west of UTC: midnight-UTC
    // on the 9th displays as the 8th in Kathmandu's opposite direction, and a
    // lab result dated a day wrong is a real problem, not a cosmetic one.
    // This bug only shows up outside UTC, which is why CI never caught it.
    timeZone: 'UTC',
  }).format(new Date(iso));
}
