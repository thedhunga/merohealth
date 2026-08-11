import type { ShareLink } from '@swasthya/interop';
import { describe, expect, it } from 'vitest';
import { InteropRepository } from './interop.repository.js';

function makeLink(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    id: 'link-1',
    token: 'token-1',
    ownerId: 'owner-1',
    documentIds: ['doc-1'],
    createdAt: '2026-08-01T00:00:00.000Z',
    expiresAt: '2026-08-08T00:00:00.000Z',
    revokedAt: null,
    ...overrides,
  };
}

describe('InteropRepository', () => {
  it('saves and finds a link by id', () => {
    const repository = new InteropRepository();
    repository.save(makeLink());

    expect(repository.find('link-1')?.token).toBe('token-1');
    expect(repository.find('missing')).toBeNull();
  });

  it('finds a link by its bearer token', () => {
    const repository = new InteropRepository();
    repository.save(makeLink());

    expect(repository.findByToken('token-1')?.id).toBe('link-1');
    expect(repository.findByToken('no-such-token')).toBeNull();
  });

  it('lists only the requested owner’s links', () => {
    const repository = new InteropRepository();
    repository.save(makeLink({ id: 'link-1', ownerId: 'owner-1' }));
    repository.save(makeLink({ id: 'link-2', ownerId: 'owner-2', token: 'token-2' }));

    const links = repository.listForOwner('owner-1');
    expect(links.map((link) => link.id)).toEqual(['link-1']);
  });
});
