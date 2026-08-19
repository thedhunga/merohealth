import { InvalidPhoneError, normalizeNepaliPhone } from '@swasthya/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Server-side mirror of `normaliseContact` in
 * `apps/web/src/lib/early-access.ts` — the client already validates before
 * ever calling this route, but a request can reach `POST /early-access`
 * without going through that client, so the trust boundary is re-checked
 * here. Canonicalises to the same bare-10-digit / lowercase-email form the
 * client sends, so a contact typed two ways (with or without `+977`, mixed
 * case email) still dedupes to one `EarlyAccess` row.
 */
export function normaliseContact(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return normalizeNepaliPhone(trimmed);
  } catch (error) {
    if (!(error instanceof InvalidPhoneError)) throw error;
  }
  if (EMAIL_PATTERN.test(trimmed) && trimmed.length <= 254) return trimmed.toLowerCase();
  return null;
}
