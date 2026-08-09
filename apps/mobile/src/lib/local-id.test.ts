import { describe, expect, it } from 'vitest';
import { generateLocalOwnerId } from './local-id';

describe('generateLocalOwnerId', () => {
  it('produces a local-prefixed id', () => {
    expect(generateLocalOwnerId()).toMatch(/^local-[0-9a-z]+-[0-9a-z]{4,8}$/);
  });

  it('does not repeat across calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateLocalOwnerId()));
    expect(ids.size).toBe(20);
  });
});
