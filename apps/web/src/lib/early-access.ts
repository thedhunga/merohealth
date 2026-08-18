/**
 * Early access to premium — "be the first to try".
 *
 * Owner decision 2026-08-18: premium stays visible but is not for sale yet.
 * People can register interest. There is no server to hold that list until
 * `apps/api` is deployed, so interest is kept on the device (same pattern as
 * anonymous history) and flushed to the API when a base URL is configured;
 * the anon→account migration carries it too. Nothing here promises a message
 * we cannot send: the UI says "we'll open it to you here first", which the
 * device-side flag alone can honour.
 *
 * Contact (phone or email) is optional and stored only on the device until a
 * server exists to receive it. It never goes into a URL.
 */

export const EARLY_ACCESS_STORAGE_KEY = 'mero-health:early-access';

export interface EarlyAccessRecord {
  interested: true;
  contact: string | null;
  source: 'pricing' | 'get-care' | 'other';
  registeredAt: string;
  /** True until a server has acknowledged this record. */
  pending: boolean;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getEarlyAccess(): EarlyAccessRecord | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(EARLY_ACCESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EarlyAccessRecord>;
    if (parsed.interested !== true || typeof parsed.registeredAt !== 'string') return null;
    return {
      interested: true,
      contact: typeof parsed.contact === 'string' && parsed.contact ? parsed.contact : null,
      source: parsed.source === 'pricing' || parsed.source === 'get-care' ? parsed.source : 'other',
      registeredAt: parsed.registeredAt,
      pending: parsed.pending !== false,
    };
  } catch {
    return null;
  }
}

export function isEarlyAccessRegistered(): boolean {
  return getEarlyAccess() !== null;
}

/** Loose validation: a Nepali mobile (10 digits, starts 9) or an email. Empty is allowed. */
export function normaliseContact(input: string): { ok: true; value: string | null } | { ok: false } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: null };
  const digits = trimmed.replace(/[\s\-()]/g, '').replace(/^\+977/, '');
  if (/^9\d{9}$/.test(digits)) return { ok: true, value: digits };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) && trimmed.length <= 254) return { ok: true, value: trimmed.toLowerCase() };
  return { ok: false };
}

export function registerEarlyAccess(input: {
  contact?: string | null;
  source: EarlyAccessRecord['source'];
  now?: Date;
}): EarlyAccessRecord | null {
  const s = storage();
  if (!s) return null;
  const record: EarlyAccessRecord = {
    interested: true,
    contact: input.contact ?? null,
    source: input.source,
    registeredAt: (input.now ?? new Date()).toISOString(),
    pending: true,
  };
  try {
    s.setItem(EARLY_ACCESS_STORAGE_KEY, JSON.stringify(record));
    return record;
  } catch {
    return null;
  }
}

/**
 * Best-effort hand-off to the API once one exists. Silent on every failure:
 * the record stays `pending` and is retried next time. Never throws.
 */
export async function flushEarlyAccess(
  apiBaseUrl: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const record = getEarlyAccess();
  if (!record || !record.pending || !apiBaseUrl) return false;
  try {
    const res = await fetchImpl(`${apiBaseUrl.replace(/\/$/, '')}/v1/early-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ contact: record.contact, source: record.source, registeredAt: record.registeredAt }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return false;
    storage()?.setItem(EARLY_ACCESS_STORAGE_KEY, JSON.stringify({ ...record, pending: false }));
    return true;
  } catch {
    return false;
  }
}
