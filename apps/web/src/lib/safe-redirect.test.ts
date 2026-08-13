import { describe, expect, it } from 'vitest';

import { sanitizeNextPath } from './safe-redirect';

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
