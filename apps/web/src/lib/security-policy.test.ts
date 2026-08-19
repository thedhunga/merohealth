import { describe, expect, it } from 'vitest';

import {
  SAME_ORIGIN_MEDIA_POLICY,
  SCOPED_CONTENT_SECURITY_POLICY,
  STRICT_TRANSPORT_SECURITY,
} from '../../security-policy';

describe('same-origin media policy', () => {
  it('allows the embedded companion to request camera and microphone access', () => {
    expect(SAME_ORIGIN_MEDIA_POLICY).toContain('camera=(self)');
    expect(SAME_ORIGIN_MEDIA_POLICY).toContain('microphone=(self)');
  });

  it('keeps unrelated sensitive capabilities disabled', () => {
    expect(SAME_ORIGIN_MEDIA_POLICY).toContain('geolocation=()');
    expect(SAME_ORIGIN_MEDIA_POLICY).toContain('payment=()');
  });
});

describe('scoped content security policy', () => {
  it('restricts exactly the directives the header comment promises, and no others', () => {
    const directives = SCOPED_CONTENT_SECURITY_POLICY.split(';').map((part) => part.trim());
    expect(directives).toEqual([
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ]);
  });

  it('never restricts script-src, style-src, img-src or connect-src', () => {
    // A future edit adding one of these here without also solving the
    // nonce/dynamic-rendering trade-off documented above would silently
    // break Next's own per-page hydration script. This guards the promise,
    // not the mechanism.
    for (const directive of ['script-src', 'style-src', 'img-src', 'connect-src']) {
      expect(SCOPED_CONTENT_SECURITY_POLICY).not.toContain(directive);
    }
  });
});

describe('strict transport security', () => {
  it('sets a two-year max-age covering subdomains, without preload', () => {
    expect(STRICT_TRANSPORT_SECURITY).toBe('max-age=63072000; includeSubDomains');
  });
});
