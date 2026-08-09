import { describe, expect, it } from 'vitest';

import { generateLocalId } from '@/lib/local-id';

describe('generateLocalId', () => {
  it('prefixes the id with the given prefix', () => {
    expect(generateLocalId('application')).toMatch(/^application-/);
  });

  it('produces a different id on every call', () => {
    expect(generateLocalId('application')).not.toBe(generateLocalId('application'));
  });
});
