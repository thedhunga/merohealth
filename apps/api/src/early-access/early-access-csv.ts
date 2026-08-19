import type { EarlyAccessRow } from './early-access-store.js';

const COLUMNS = ['contact', 'source', 'registeredAt', 'signedIn'] as const;

/**
 * The launch-day contact list, as CSV — deliberately narrow: `contact` and
 * `source` are what an outreach send needs, `registeredAt` is when interest
 * was expressed, `signedIn` (derived from `userId`, not the id itself) is
 * whether the row is still an anonymous lead or already has an account.
 * `id`/`userId` are internal identifiers with nothing an owner reading a
 * contact list would act on, so they stay out of the export.
 *
 * Every field is user-supplied (`contact` most directly), so each cell is
 * defused against CSV injection — a `contact` of `=cmd|'/c calc'!A1` opened
 * in Excel/Sheets must render as inert text, not execute. A leading
 * `'` also blocks Excel's own leading-quote-strips-formula convention from
 * un-defusing a value that already looks like a formula after quoting.
 */
export function earlyAccessToCsv(rows: readonly EarlyAccessRow[]): string {
  const lines = [COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(
      [row.contact ?? '', row.source, row.registeredAt.toISOString(), row.userId ? 'yes' : 'no'].map(csvCell).join(','),
    );
  }
  // CSV lines end CRLF per RFC 4180 — Excel is the primary consumer of a launch-day contact list.
  return lines.join('\r\n') + '\r\n';
}

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function csvCell(value: string): string {
  const defused = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  const escaped = defused.replace(/"/g, '""');
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}
