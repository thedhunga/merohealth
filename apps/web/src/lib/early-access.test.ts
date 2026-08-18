import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EARLY_ACCESS_STORAGE_KEY,
  flushEarlyAccess,
  getEarlyAccess,
  isEarlyAccessRegistered,
  normaliseContact,
  registerEarlyAccess,
} from './early-access';

/** Same hand-rolled localStorage fake the other web tests use — apps/web has no jsdom. */
function createFakeLocalStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  } as unknown as Storage;
}

describe('early access (device-side)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createFakeLocalStorage() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts unregistered', () => {
    expect(isEarlyAccessRegistered()).toBe(false);
    expect(getEarlyAccess()).toBeNull();
  });

  it('registers interest without a contact and marks it pending', () => {
    const r = registerEarlyAccess({ source: 'pricing', now: new Date('2026-08-18T00:00:00Z') });
    expect(r?.contact).toBeNull();
    expect(r?.pending).toBe(true);
    expect(isEarlyAccessRegistered()).toBe(true);
    expect(getEarlyAccess()?.registeredAt).toBe('2026-08-18T00:00:00.000Z');
  });

  it('accepts a Nepali mobile or an email, rejects junk, allows empty', () => {
    expect(normaliseContact('98 4123 4567')).toEqual({ ok: true, value: '9841234567' });
    expect(normaliseContact('+977-9841234567')).toEqual({ ok: true, value: '9841234567' });
    expect(normaliseContact('Sabina@Example.com')).toEqual({ ok: true, value: 'sabina@example.com' });
    expect(normaliseContact('')).toEqual({ ok: true, value: null });
    expect(normaliseContact('12345')).toEqual({ ok: false });
    expect(normaliseContact('not an email')).toEqual({ ok: false });
  });

  it('survives corrupt storage', () => {
    window.localStorage.setItem(EARLY_ACCESS_STORAGE_KEY, '{not json');
    expect(getEarlyAccess()).toBeNull();
    window.localStorage.setItem(EARLY_ACCESS_STORAGE_KEY, JSON.stringify({ interested: 'yes' }));
    expect(getEarlyAccess()).toBeNull();
  });

  it('flush is a no-op without an API base and never throws', async () => {
    registerEarlyAccess({ source: 'get-care' });
    expect(await flushEarlyAccess(undefined)).toBe(false);
    expect(getEarlyAccess()?.pending).toBe(true);
    const failing = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    expect(await flushEarlyAccess('https://api.example', failing)).toBe(false);
    expect(getEarlyAccess()?.pending).toBe(true);
  });

  it('flush posts once to /v1/early-access and clears pending on 2xx', async () => {
    registerEarlyAccess({ source: 'pricing', contact: '9841234567' });
    let seenUrl = '';
    let seenBody: Record<string, unknown> = {};
    const ok = ((url: string, init?: RequestInit) => {
      seenUrl = url;
      seenBody = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
      return Promise.resolve(new Response('{}', { status: 201 }));
    }) as unknown as typeof fetch;
    expect(await flushEarlyAccess('https://api.example/', ok)).toBe(true);
    expect(seenUrl).toBe('https://api.example/v1/early-access');
    expect(seenBody.contact).toBe('9841234567');
    expect(getEarlyAccess()?.pending).toBe(false);
    // Already acknowledged: does not post again.
    expect(await flushEarlyAccess('https://api.example/', ok)).toBe(false);
  });
});
