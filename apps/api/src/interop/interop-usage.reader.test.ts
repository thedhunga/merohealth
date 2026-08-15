import type { ShareLink } from '@swasthya/interop';
import { describe, expect, it } from 'vitest';
import { InteropRepository } from './interop.repository.js';
import { InteropUsageReader } from './interop-usage.reader.js';

function activeLink(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    id: 'link-1',
    token: 'token-1',
    ownerId: 'owner-1',
    documentIds: ['doc-1'],
    createdAt: '2026-08-01T00:00:00.000Z',
    expiresAt: '2999-01-01T00:00:00.000Z',
    revokedAt: null,
    ...overrides,
  };
}

describe('InteropUsageReader', () => {
  it('counts only the requested owner’s active links for ACTIVE_SHARE_LINKS', () => {
    const repository = new InteropRepository();
    repository.save(activeLink({ id: 'link-1', token: 'token-1', ownerId: 'owner-1' }));
    repository.save(activeLink({ id: 'link-2', token: 'token-2', ownerId: 'owner-1' }));
    repository.save(activeLink({ id: 'link-3', token: 'token-3', ownerId: 'owner-2' }));

    const reader = new InteropUsageReader(repository);
    expect(reader.read('owner-1', 'ACTIVE_SHARE_LINKS')).toBe(2);
    expect(reader.read('owner-2', 'ACTIVE_SHARE_LINKS')).toBe(1);
    expect(reader.read('owner-3', 'ACTIVE_SHARE_LINKS')).toBe(0);
  });

  it('excludes a revoked link — revoking frees the tier’s ceiling', () => {
    const repository = new InteropRepository();
    repository.save(activeLink({ id: 'link-1', token: 'token-1', ownerId: 'owner-1', revokedAt: '2026-08-02T00:00:00.000Z' }));

    const reader = new InteropUsageReader(repository);
    expect(reader.read('owner-1', 'ACTIVE_SHARE_LINKS')).toBe(0);
  });

  it('excludes an expired link', () => {
    const repository = new InteropRepository();
    repository.save(activeLink({ id: 'link-1', token: 'token-1', ownerId: 'owner-1', expiresAt: '2000-01-01T00:00:00.000Z' }));

    const reader = new InteropUsageReader(repository);
    expect(reader.read('owner-1', 'ACTIVE_SHARE_LINKS')).toBe(0);
  });

  it('fails loudly for a dimension it has no meter for, instead of reporting zero', () => {
    const reader = new InteropUsageReader(new InteropRepository());
    expect(() => reader.read('owner-1', 'DOCUMENTS_STORED')).toThrow('InteropUsageReader has no meter');
  });
});
