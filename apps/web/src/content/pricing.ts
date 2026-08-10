import { getPlan } from '@swasthya/entitlements';
import type { QuotaDimension } from '@swasthya/shared-types';

/**
 * Canonical module display order for the pricing comparison grid.
 *
 * Derived from the PRO plan's own module list rather than a second,
 * hand-maintained array: `packages/entitlements` already guarantees (and
 * tests) that a higher tier never drops a module a lower tier has, so PRO is
 * always the superset. Reading the order from the catalogue itself means a
 * module added to a plan shows up here without a second list to remember.
 */
export const PRICING_MODULE_ORDER = getPlan('PRO').modules;

/**
 * `QuotaDimension` is a union, not an array, so it has no natural order.
 * This is the one list on this page that isn't read out of the catalogue —
 * it only fixes a display order, never a limit value.
 */
export const PRICING_QUOTA_ORDER: readonly QuotaDimension[] = [
  'DOCUMENTS_STORED',
  'EXTRACTION_PAGES_PER_MONTH',
  'ASSISTANT_MESSAGES_PER_MONTH',
  'ACTIVE_SHARE_LINKS',
  'CONNECTED_DEVICES',
];

/** Mirrors `formatPrice`'s locale mapping in `@swasthya/entitlements`. */
export function formatQuotaValue(
  value: number | null,
  locale: 'ne' | 'en',
  unlimitedLabel: string,
): string {
  if (value === null) return unlimitedLabel;
  return value.toLocaleString(locale === 'ne' ? 'ne-NP' : 'en-NP');
}
