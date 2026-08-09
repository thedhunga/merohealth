import { describe, expect, it } from 'vitest';

import {
  CorpusConsentError,
  CURRENT_POLICY_VERSION,
  buildSnapshot,
  deidentify,
  grantConsent,
  hasPurpose,
  isLive,
  optionalPurposes,
  retainUtterance,
  revokeConsent,
  utteranceIdsForOwner,
  type ConsentGrant,
  type CorpusUtterance,
} from './index';

function grant(overrides: Partial<ConsentGrant> = {}): ConsentGrant {
  return {
    purpose: 'MODEL_TRAINING_TEXT',
    ownerId: 'user-1',
    grantedAt: '2026-01-01T00:00:00.000Z',
    revokedAt: null,
    policyVersion: 'v1',
    ...overrides,
  };
}

function utterance(overrides: Partial<CorpusUtterance> = {}): CorpusUtterance {
  return {
    id: 'u1',
    ownerId: 'user-1',
    kind: 'USER_MESSAGE',
    text: 'मलाई टाउको दुख्यो',
    locale: 'ne',
    capturedAt: '2026-02-01T00:00:00.000Z',
    precedingAssistantText: null,
    redactionCount: 0,
    awaitingHumanReview: false,
    ...overrides,
  };
}

describe('consent purposes', () => {
  it('keeps every secondary use optional', () => {
    expect(optionalPurposes).not.toContain('SERVICE_DELIVERY');
    expect(optionalPurposes).toContain('MODEL_TRAINING_TEXT');
    expect(optionalPurposes).toContain('MODEL_TRAINING_VOICE');
  });

  it('treats text and voice as separate grants', () => {
    const textOnly = [grant({ purpose: 'MODEL_TRAINING_TEXT' })];
    const at = '2026-02-01T00:00:00.000Z';

    expect(hasPurpose(textOnly, 'MODEL_TRAINING_TEXT', at)).toBe(true);
    expect(hasPurpose(textOnly, 'MODEL_TRAINING_VOICE', at)).toBe(false);
  });
});

describe('isLive', () => {
  it('is false before the grant was made', () => {
    expect(isLive(grant(), '2025-06-01T00:00:00.000Z')).toBe(false);
  });

  it('is true between grant and revocation', () => {
    const g = grant({ revokedAt: '2026-03-01T00:00:00.000Z' });
    expect(isLive(g, '2026-02-01T00:00:00.000Z')).toBe(true);
  });

  it('is false after revocation', () => {
    const g = grant({ revokedAt: '2026-03-01T00:00:00.000Z' });
    expect(isLive(g, '2026-04-01T00:00:00.000Z')).toBe(false);
  });
});

describe('grantConsent and revokeConsent', () => {
  const at = '2026-02-01T00:00:00.000Z';

  it('grants a purpose, live as of now, stamped with the current policy version', () => {
    const g = grantConsent('MODEL_TRAINING_TEXT', 'user-1', at);

    expect(g).toEqual({
      purpose: 'MODEL_TRAINING_TEXT',
      ownerId: 'user-1',
      grantedAt: at,
      revokedAt: null,
      policyVersion: CURRENT_POLICY_VERSION,
    });
    expect(isLive(g, at)).toBe(true);
  });

  it('revokes the live grant for a purpose without touching other purposes', () => {
    const grants = [
      grant({ purpose: 'MODEL_TRAINING_TEXT' }),
      grant({ purpose: 'MODEL_TRAINING_VOICE' }),
    ];

    const revoked = revokeConsent(grants, 'MODEL_TRAINING_TEXT', at);

    expect(hasPurpose(revoked, 'MODEL_TRAINING_TEXT', at)).toBe(false);
    expect(hasPurpose(revoked, 'MODEL_TRAINING_VOICE', at)).toBe(true);
  });

  it('sets revokedAt rather than deleting the row', () => {
    const revoked = revokeConsent([grant()], 'MODEL_TRAINING_TEXT', at);
    expect(revoked).toHaveLength(1);
    expect(revoked[0]?.revokedAt).toBe(at);
  });

  it('is a no-op when nothing is currently live for that purpose', () => {
    const alreadyRevoked = [grant({ revokedAt: '2026-01-15T00:00:00.000Z' })];
    expect(revokeConsent(alreadyRevoked, 'MODEL_TRAINING_TEXT', at)).toEqual(alreadyRevoked);
  });

  it('round-trips through hasPurpose: grant then revoke then grant again', () => {
    let grants: ConsentGrant[] = [];
    grants = [...grants, grantConsent('MODEL_TRAINING_TEXT', 'user-1', '2026-01-01T00:00:00.000Z')];
    expect(hasPurpose(grants, 'MODEL_TRAINING_TEXT', '2026-01-02T00:00:00.000Z')).toBe(true);

    grants = revokeConsent(grants, 'MODEL_TRAINING_TEXT', '2026-01-10T00:00:00.000Z');
    expect(hasPurpose(grants, 'MODEL_TRAINING_TEXT', '2026-01-11T00:00:00.000Z')).toBe(false);

    grants = [...grants, grantConsent('MODEL_TRAINING_TEXT', 'user-1', '2026-01-20T00:00:00.000Z')];
    expect(hasPurpose(grants, 'MODEL_TRAINING_TEXT', '2026-01-21T00:00:00.000Z')).toBe(true);
    expect(grants).toHaveLength(2);
  });
});

describe('deidentify', () => {
  it('removes a Nepali mobile number', () => {
    const out = deidentify('मलाई 9841234567 मा फोन गर्नुहोस्');
    expect(out.text).not.toContain('9841234567');
    expect(out.redactions[0]?.kind).toBe('PHONE');
  });

  it('removes a +977 prefixed number', () => {
    expect(deidentify('+977-9812345678').text).not.toContain('9812345678');
  });

  it('removes an email and a URL', () => {
    const out = deidentify('ram@example.com https://example.com/x');
    expect(out.text).not.toContain('ram@example.com');
    expect(out.text).not.toContain('https://example.com/x');
  });

  it('removes a citizenship number without letting the digit rule split it', () => {
    const out = deidentify('नागरिकता 12-34-56-78901 हो');
    expect(out.text).not.toContain('12-34-56-78901');
    expect(out.redactions).toHaveLength(1);
    expect(out.redactions[0]?.kind).toBe('CITIZENSHIP');
  });

  it('leaves ordinary clinical text alone', () => {
    const out = deidentify('तीन दिनदेखि ज्वरो छ, ३८ डिग्री');
    expect(out.clean).toBe(true);
    expect(out.text).toBe('तीन दिनदेखि ज्वरो छ, ३८ डिग्री');
  });

  it('does not mangle a short lab value', () => {
    expect(deidentify('creatinine 1.4 mg/dL').clean).toBe(true);
  });

  it('is stable across repeated calls, despite module-level /g regexes', () => {
    const input = 'call 9841234567';
    expect(deidentify(input).text).toBe(deidentify(input).text);
  });
});

describe('retainUtterance', () => {
  const at = '2026-02-01T00:00:00.000Z';

  it('refuses without a live grant rather than dropping silently', () => {
    expect(() =>
      retainUtterance(
        { id: 'u1', ownerId: 'user-1', kind: 'USER_MESSAGE', rawText: 'x', locale: 'ne', capturedAt: at },
        [],
      ),
    ).toThrow(CorpusConsentError);
  });

  it('refuses voice under a text-only grant', () => {
    expect(() =>
      retainUtterance(
        { id: 'u1', ownerId: 'user-1', kind: 'VOICE_TRANSCRIPT', rawText: 'x', locale: 'ne', capturedAt: at },
        [grant({ purpose: 'MODEL_TRAINING_TEXT' })],
      ),
    ).toThrow(CorpusConsentError);
  });

  it('stores de-identified text, never the raw string', () => {
    const kept = retainUtterance(
      { id: 'u1', ownerId: 'user-1', kind: 'USER_MESSAGE', rawText: 'फोन 9841234567', locale: 'ne', capturedAt: at },
      [grant()],
    );

    expect(kept.text).not.toContain('9841234567');
    expect(kept.redactionCount).toBe(1);
  });

  it('flags anything that carried an identifier for human review', () => {
    const kept = retainUtterance(
      { id: 'u1', ownerId: 'user-1', kind: 'USER_MESSAGE', rawText: 'फोन 9841234567', locale: 'ne', capturedAt: at },
      [grant()],
    );
    expect(kept.awaitingHumanReview).toBe(true);
  });

  it('always flags voice transcripts, even when nothing matched', () => {
    const kept = retainUtterance(
      { id: 'u1', ownerId: 'user-1', kind: 'VOICE_TRANSCRIPT', rawText: 'टाउको दुख्यो', locale: 'ne', capturedAt: at },
      [grant({ purpose: 'MODEL_TRAINING_VOICE' })],
    );
    expect(kept.awaitingHumanReview).toBe(true);
  });

  it('refuses when the grant post-dates the utterance', () => {
    expect(() =>
      retainUtterance(
        { id: 'u1', ownerId: 'user-1', kind: 'USER_MESSAGE', rawText: 'x', locale: 'ne', capturedAt: '2025-01-01T00:00:00.000Z' },
        [grant()],
      ),
    ).toThrow(CorpusConsentError);
  });
});

describe('buildSnapshot', () => {
  const takenAt = '2026-06-01T00:00:00.000Z';

  it('drops utterances whose consent was withdrawn after capture', () => {
    const grants = new Map([
      ['user-1', [grant({ revokedAt: '2026-03-01T00:00:00.000Z' })]],
    ]);

    const snapshot = buildSnapshot([utterance()], grants, takenAt);
    expect(snapshot.utterances).toHaveLength(0);
    expect(snapshot.excluded.consentRevoked).toBe(1);
  });

  it('keeps utterances whose consent is still live', () => {
    const grants = new Map([['user-1', [grant()]]]);
    expect(buildSnapshot([utterance()], grants, takenAt).utterances).toHaveLength(1);
  });

  it('holds back anything still awaiting review', () => {
    const grants = new Map([['user-1', [grant()]]]);
    const snapshot = buildSnapshot([utterance({ awaitingHumanReview: true })], grants, takenAt);

    expect(snapshot.utterances).toHaveLength(0);
    expect(snapshot.excluded.awaitingReview).toBe(1);
  });

  it('excludes an owner with no grants at all', () => {
    expect(buildSnapshot([utterance()], new Map(), takenAt).utterances).toHaveLength(0);
  });
});

describe('utteranceIdsForOwner', () => {
  it('collects every id belonging to one person for erasure', () => {
    const all = [
      utterance({ id: 'a', ownerId: 'user-1' }),
      utterance({ id: 'b', ownerId: 'user-2' }),
      utterance({ id: 'c', ownerId: 'user-1' }),
    ];

    expect(utteranceIdsForOwner(all, 'user-1')).toEqual(['a', 'c']);
  });
});
