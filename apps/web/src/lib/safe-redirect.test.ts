import { describe, expect, it } from 'vitest';

import { sanitizeNextPath, switchLinkHref } from './safe-redirect';

describe('sanitizeNextPath', () => {
  it('accepts a same-origin absolute path', () => {
    expect(sanitizeNextPath('/clinicians/register')).toBe('/clinicians/register');
  });

  it('accepts a same-origin path with its own query string', () => {
    expect(sanitizeNextPath('/en/clinicians/register?step=evidence')).toBe(
      '/en/clinicians/register?step=evidence',
    );
  });

  it('rejects null', () => {
    expect(sanitizeNextPath(null)).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(sanitizeNextPath('')).toBeNull();
  });

  it('rejects a path with no leading slash', () => {
    expect(sanitizeNextPath('account')).toBeNull();
  });

  it('rejects a protocol-relative URL', () => {
    expect(sanitizeNextPath('//evil.example/phish')).toBeNull();
  });

  it('rejects a backslash-prefixed URL', () => {
    expect(sanitizeNextPath('/\\evil.example')).toBeNull();
  });

  it('rejects an absolute URL with a scheme', () => {
    expect(sanitizeNextPath('https://evil.example')).toBeNull();
  });

  it('rejects a same-origin path that embeds a scheme later in the string', () => {
    expect(sanitizeNextPath('/redirect?to=https://evil.example')).toBeNull();
  });
});

describe('switchLinkHref', () => {
  it('returns the bare path when there is nothing to carry across', () => {
    expect(switchLinkHref('/signin', null)).toBe('/signin');
  });

  it('threads next onto the switch target as a query param', () => {
    expect(switchLinkHref('/signin', '/clinicians/register')).toEqual({
      pathname: '/signin',
      query: { next: '/clinicians/register' },
    });
  });

  it('carries a next value with its own query string intact', () => {
    expect(switchLinkHref('/register', '/en/clinicians/register?step=evidence')).toEqual({
      pathname: '/register',
      query: { next: '/en/clinicians/register?step=evidence' },
    });
  });
});
