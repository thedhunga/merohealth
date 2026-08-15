import { describe, expect, it } from 'vitest';

import { SAME_ORIGIN_MEDIA_POLICY } from '../../security-policy';

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
