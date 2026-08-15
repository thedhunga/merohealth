import { describe, expect, it } from 'vitest';
import { NoQuotaUsageReader } from './no-quota-usage.reader.js';

describe('NoQuotaUsageReader', () => {
  it('throws rather than reporting zero usage for any dimension', () => {
    const reader = new NoQuotaUsageReader();
    expect(() => reader.read('owner-1', 'ASSISTANT_MESSAGES_PER_MONTH')).toThrow(/No quota is metered/);
  });
});
