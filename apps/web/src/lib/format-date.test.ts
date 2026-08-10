import { describe, expect, it } from 'vitest';

import { formatDate } from '@/lib/format-date';

describe('formatDate', () => {
  it('formats an ISO date for the en locale', () => {
    expect(formatDate('2026-08-09T00:00:00.000Z', 'en')).toBe('August 9, 2026');
  });

  it('formats the same date for the ne locale in Devanagari script and numerals', () => {
    expect(formatDate('2026-08-09T00:00:00.000Z', 'ne')).toBe('२०२६ अगस्ट ९');
  });
});
