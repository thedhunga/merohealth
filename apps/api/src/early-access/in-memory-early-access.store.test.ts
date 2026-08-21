import { describe, expect, it } from 'vitest';
import { InMemoryEarlyAccessStore } from './in-memory-early-access.store.js';

describe('InMemoryEarlyAccessStore', () => {
  describe('register', () => {
    it('creates a row and reports "created" when the contact has not registered before', async () => {
      const store = new InMemoryEarlyAccessStore();

      const result = await store.register({
        contact: 'sabina@example.com',
        source: 'pricing',
        registeredAt: new Date('2026-08-21T00:00:00.000Z'),
        userId: null,
      });

      expect(result).toEqual({ outcome: 'created' });
      expect(store.rows).toHaveLength(1);
      expect(store.rows[0]?.contact).toBe('sabina@example.com');
    });

    it('creates an independent row for every contact-less registration, since there is no dedupe key', async () => {
      const store = new InMemoryEarlyAccessStore();
      const input = { contact: null, source: 'get-care' as const, registeredAt: new Date('2026-08-21T00:00:00.000Z'), userId: null };

      const first = await store.register(input);
      const second = await store.register(input);

      expect(first).toEqual({ outcome: 'created' });
      expect(second).toEqual({ outcome: 'created' });
      expect(store.rows).toHaveLength(2);
    });

    it('links an existing anonymous row to the account when the same contact registers with a userId', async () => {
      const store = new InMemoryEarlyAccessStore();
      await store.register({ contact: 'sabina@example.com', source: 'pricing', registeredAt: new Date('2026-08-21T00:00:00.000Z'), userId: null });

      const result = await store.register({
        contact: 'sabina@example.com',
        source: 'pricing',
        registeredAt: new Date('2026-08-21T00:05:00.000Z'),
        userId: 'user-1',
      });

      expect(result).toEqual({ outcome: 'linked' });
      expect(store.rows).toHaveLength(1);
      expect(store.rows[0]?.userId).toBe('user-1');
    });

    it('reports "alreadyRegistered" for a retry of the same anonymous contact, without creating a second row', async () => {
      const store = new InMemoryEarlyAccessStore();
      await store.register({ contact: 'sabina@example.com', source: 'pricing', registeredAt: new Date('2026-08-21T00:00:00.000Z'), userId: null });

      const result = await store.register({
        contact: 'sabina@example.com',
        source: 'pricing',
        registeredAt: new Date('2026-08-21T00:05:00.000Z'),
        userId: null,
      });

      expect(result).toEqual({ outcome: 'alreadyRegistered' });
      expect(store.rows).toHaveLength(1);
    });

    it('reports "alreadyRegistered", not "linked", when the contact is already linked to a different account', async () => {
      const store = new InMemoryEarlyAccessStore();
      await store.register({ contact: 'sabina@example.com', source: 'pricing', registeredAt: new Date('2026-08-21T00:00:00.000Z'), userId: 'user-1' });

      const result = await store.register({
        contact: 'sabina@example.com',
        source: 'pricing',
        registeredAt: new Date('2026-08-21T00:05:00.000Z'),
        userId: 'user-2',
      });

      expect(result).toEqual({ outcome: 'alreadyRegistered' });
      expect(store.rows[0]?.userId).toBe('user-1');
    });
  });

  describe('list', () => {
    it('returns rows oldest registration first, regardless of insertion order', async () => {
      const store = new InMemoryEarlyAccessStore();
      await store.register({ contact: 'later@example.com', source: 'other', registeredAt: new Date('2026-08-21T12:00:00.000Z'), userId: null });
      await store.register({ contact: 'earlier@example.com', source: 'pricing', registeredAt: new Date('2026-08-21T00:00:00.000Z'), userId: null });

      const result = await store.list();

      expect(result.map((row) => row.contact)).toEqual(['earlier@example.com', 'later@example.com']);
    });

    it('exposes only the EarlyAccessRow fields, dropping the internal id-assignment detail', async () => {
      const store = new InMemoryEarlyAccessStore();
      await store.register({ contact: 'sabina@example.com', source: 'pricing', registeredAt: new Date('2026-08-21T00:00:00.000Z'), userId: 'user-1' });

      const [row] = await store.list();

      expect(row).toEqual({
        id: 'early-1',
        contact: 'sabina@example.com',
        source: 'pricing',
        registeredAt: new Date('2026-08-21T00:00:00.000Z'),
        userId: 'user-1',
      });
    });
  });
});
