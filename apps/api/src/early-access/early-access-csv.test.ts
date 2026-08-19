import { describe, expect, it } from 'vitest';
import { earlyAccessToCsv } from './early-access-csv.js';
import type { EarlyAccessRow } from './early-access-store.js';

function row(overrides: Partial<EarlyAccessRow> = {}): EarlyAccessRow {
  return {
    id: 'early-1',
    contact: '9812345678',
    source: 'pricing',
    registeredAt: new Date('2026-08-19T10:00:00.000Z'),
    userId: null,
    ...overrides,
  };
}

describe('earlyAccessToCsv', () => {
  it('writes the header and one CRLF-terminated line per row', () => {
    const csv = earlyAccessToCsv([row()]);

    expect(csv).toBe('contact,source,registeredAt,signedIn\r\n9812345678,pricing,2026-08-19T10:00:00.000Z,no\r\n');
  });

  it('reports signedIn once a userId is linked', () => {
    const csv = earlyAccessToCsv([row({ userId: 'user-1' })]);

    expect(csv).toContain(',yes\r\n');
  });

  it('renders a contact-less row with an empty first cell', () => {
    const csv = earlyAccessToCsv([row({ contact: null })]);

    expect(csv.split('\r\n')[1]).toBe(',pricing,2026-08-19T10:00:00.000Z,no');
  });

  it('quotes a value containing a comma', () => {
    const csv = earlyAccessToCsv([row({ contact: 'a,b@example.com' })]);

    expect(csv).toContain('"a,b@example.com"');
  });

  it('escapes an embedded quote by doubling it', () => {
    const csv = earlyAccessToCsv([row({ contact: 'weird"quote' })]);

    expect(csv).toContain('"weird""quote"');
  });

  it('defuses a formula-triggering leading character so Excel never executes it', () => {
    const csv = earlyAccessToCsv([row({ contact: '=cmd|\'/c calc\'!A1' })]);

    const firstCell = csv.split('\r\n')[1]?.split(',')[0];
    expect(firstCell?.startsWith("'=")).toBe(true);
  });

  it('produces just the header for an empty list', () => {
    expect(earlyAccessToCsv([])).toBe('contact,source,registeredAt,signedIn\r\n');
  });
});
