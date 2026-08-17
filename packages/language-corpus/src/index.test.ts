import { describe, expect, it } from 'vitest';

import {
  ClipAlreadyResolvedError,
  CorpusConsentError,
  CURRENT_POLICY_VERSION,
  DuplicateClipValidationError,
  MAX_VOICE_CLIP_DURATION_MS,
  MIN_VOICE_CLIP_DURATION_MS,
  OwnClipValidationError,
  REWARD_VERIFIED_CLIPS_PER_MONTH,
  UtteranceNotAwaitingReviewError,
  VOICE_CONTRIBUTION_CONSENT_VERSION,
  VOICE_CORPUS_KNOWN_GAPS,
  ageBandOptions,
  buildSnapshot,
  buildVoiceCorpusDatasheet,
  buildVoiceCorpusRelease,
  clearForTraining,
  corpusReviewQueue,
  deidentify,
  deriveClipVerificationStatus,
  discardUtterance,
  earnsRewardMonth,
  eraseFromSnapshot,
  eraseFromVoiceCorpusRelease,
  genderOptions,
  grantConsent,
  grantCorpusConsent,
  hasCorpusConsent,
  hasPurpose,
  isCorpusConsentLive,
  isDuplicateVoiceClip,
  isLive,
  motherTongueOptions,
  nextClipToValidate,
  optionalPurposes,
  purposeForUtteranceKind,
  recordClipValidation,
  retainUtterance,
  revokeConsent,
  revokeCorpusConsent,
  utteranceIdsForOwner,
  validateVoiceClipDuration,
  versionForCorpusConsentKind,
  voiceClipIdsForContributor,
  type ClipValidation,
  type ClipValidationVerdict,
  type ConsentGrant,
  type CorpusConsentGrant,
  type CorpusUtterance,
  type VoiceClip,
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
    discardedAt: null,
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

function corpusGrant(overrides: Partial<CorpusConsentGrant> = {}): CorpusConsentGrant {
  return {
    id: 'cc-1',
    userId: 'user-1',
    kind: 'HEALTH_CONVERSATION_AUDIO',
    version: CURRENT_POLICY_VERSION,
    grantedAt: '2026-01-01T00:00:00.000Z',
    revokedAt: null,
    ...overrides,
  };
}

describe('versionForCorpusConsentKind', () => {
  it('stamps VOICE_CONTRIBUTION with its own copy version, never the health-conversation one', () => {
    expect(versionForCorpusConsentKind('VOICE_CONTRIBUTION')).toBe(VOICE_CONTRIBUTION_CONSENT_VERSION);
  });

  it('stamps HEALTH_CONVERSATION_AUDIO with the shared policy version', () => {
    expect(versionForCorpusConsentKind('HEALTH_CONVERSATION_AUDIO')).toBe(CURRENT_POLICY_VERSION);
  });
});

describe('grantCorpusConsent and revokeCorpusConsent', () => {
  const at = '2026-02-01T00:00:00.000Z';

  it('grants a kind, live as of now, stamped with the version for that kind', () => {
    const g = grantCorpusConsent('cc-1', 'user-1', 'VOICE_CONTRIBUTION', at);

    expect(g).toEqual({
      id: 'cc-1',
      userId: 'user-1',
      kind: 'VOICE_CONTRIBUTION',
      version: VOICE_CONTRIBUTION_CONSENT_VERSION,
      grantedAt: at,
      revokedAt: null,
    });
    expect(isCorpusConsentLive(g, at)).toBe(true);
  });

  it('revokes the live grant for a kind without touching other kinds', () => {
    const grants = [
      corpusGrant({ id: 'cc-1', kind: 'VOICE_CONTRIBUTION' }),
      corpusGrant({ id: 'cc-2', kind: 'HEALTH_CONVERSATION_AUDIO' }),
    ];

    const revoked = revokeCorpusConsent(grants, 'VOICE_CONTRIBUTION', at);

    expect(hasCorpusConsent(revoked, 'VOICE_CONTRIBUTION', at)).toBe(false);
    expect(hasCorpusConsent(revoked, 'HEALTH_CONVERSATION_AUDIO', at)).toBe(true);
  });

  it('sets revokedAt rather than deleting the row', () => {
    const revoked = revokeCorpusConsent([corpusGrant()], 'HEALTH_CONVERSATION_AUDIO', at);
    expect(revoked).toHaveLength(1);
    expect(revoked[0]?.revokedAt).toBe(at);
  });

  it('is a no-op when nothing is currently live for that kind', () => {
    const alreadyRevoked = [corpusGrant({ revokedAt: '2026-01-15T00:00:00.000Z' })];
    expect(revokeCorpusConsent(alreadyRevoked, 'HEALTH_CONVERSATION_AUDIO', at)).toEqual(alreadyRevoked);
  });

  it('round-trips through hasCorpusConsent: grant then revoke then grant again', () => {
    let grants: CorpusConsentGrant[] = [];
    grants = [...grants, grantCorpusConsent('cc-1', 'user-1', 'HEALTH_CONVERSATION_AUDIO', '2026-01-01T00:00:00.000Z')];
    expect(hasCorpusConsent(grants, 'HEALTH_CONVERSATION_AUDIO', '2026-01-02T00:00:00.000Z')).toBe(true);

    grants = revokeCorpusConsent(grants, 'HEALTH_CONVERSATION_AUDIO', '2026-01-10T00:00:00.000Z');
    expect(hasCorpusConsent(grants, 'HEALTH_CONVERSATION_AUDIO', '2026-01-11T00:00:00.000Z')).toBe(false);

    grants = [...grants, grantCorpusConsent('cc-2', 'user-1', 'HEALTH_CONVERSATION_AUDIO', '2026-01-20T00:00:00.000Z')];
    expect(hasCorpusConsent(grants, 'HEALTH_CONVERSATION_AUDIO', '2026-01-21T00:00:00.000Z')).toBe(true);
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

describe('purposeForUtteranceKind', () => {
  it('routes voice transcripts to the voice purpose and everything else to text', () => {
    expect(purposeForUtteranceKind('VOICE_TRANSCRIPT')).toBe('MODEL_TRAINING_VOICE');
    expect(purposeForUtteranceKind('USER_MESSAGE')).toBe('MODEL_TRAINING_TEXT');
    expect(purposeForUtteranceKind('CORRECTION')).toBe('MODEL_TRAINING_TEXT');
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

  it('excludes a discarded utterance even though consent is live and review is no longer pending', () => {
    const grants = new Map([['user-1', [grant()]]]);
    const snapshot = buildSnapshot(
      [utterance({ discardedAt: '2026-05-01T00:00:00.000Z' })],
      grants,
      takenAt,
    );

    expect(snapshot.utterances).toHaveLength(0);
    expect(snapshot.excluded.discarded).toBe(1);
  });

  it('excludes an owner with no grants at all', () => {
    expect(buildSnapshot([utterance()], new Map(), takenAt).utterances).toHaveLength(0);
  });

  it('starts the erased count at zero — nothing has been erased from a freshly built snapshot', () => {
    const grants = new Map([['user-1', [grant()]]]);
    expect(buildSnapshot([utterance()], grants, takenAt).excluded.erased).toBe(0);
  });
});

describe('eraseFromSnapshot', () => {
  const takenAt = '2026-06-01T00:00:00.000Z';
  const grants = new Map([
    ['user-1', [grant({ ownerId: 'user-1' })]],
    ['user-2', [grant({ ownerId: 'user-2' })]],
  ]);

  it('removes only the named owner, keeping the rest and counting the removal', () => {
    const snapshot = buildSnapshot(
      [utterance({ id: 'a', ownerId: 'user-1' }), utterance({ id: 'b', ownerId: 'user-2' })],
      grants,
      takenAt,
    );

    const erased = eraseFromSnapshot(snapshot, 'user-1');

    expect(erased.utterances.map((u) => u.id)).toEqual(['b']);
    expect(erased.excluded.erased).toBe(1);
  });

  it('is a no-op, returning the same snapshot, when the owner has nothing in it', () => {
    const snapshot = buildSnapshot([utterance({ id: 'a', ownerId: 'user-1' })], grants, takenAt);
    expect(eraseFromSnapshot(snapshot, 'someone-else')).toBe(snapshot);
  });
});

describe('corpusReviewQueue', () => {
  it('lists only utterances awaiting review, oldest capture first', () => {
    const queue = corpusReviewQueue([
      utterance({ id: 'a', awaitingHumanReview: true, capturedAt: '2026-02-02T00:00:00.000Z' }),
      utterance({ id: 'b', awaitingHumanReview: false }),
      utterance({ id: 'c', awaitingHumanReview: true, capturedAt: '2026-02-01T00:00:00.000Z' }),
    ]);

    expect(queue.map((u) => u.id)).toEqual(['c', 'a']);
  });

  it('is empty when nothing is awaiting review', () => {
    expect(corpusReviewQueue([utterance({ awaitingHumanReview: false })])).toHaveLength(0);
  });
});

describe('clearForTraining and discardUtterance', () => {
  it('clears an awaiting utterance, leaving discardedAt null', () => {
    const cleared = clearForTraining(utterance({ awaitingHumanReview: true }));
    expect(cleared.awaitingHumanReview).toBe(false);
    expect(cleared.discardedAt).toBeNull();
  });

  it('discards an awaiting utterance, stamping when', () => {
    const at = '2026-05-01T00:00:00.000Z';
    const discarded = discardUtterance(utterance({ awaitingHumanReview: true }), at);

    expect(discarded.awaitingHumanReview).toBe(false);
    expect(discarded.discardedAt).toBe(at);
  });

  it('refuses to decide an utterance that was never awaiting review', () => {
    expect(() => clearForTraining(utterance({ awaitingHumanReview: false }))).toThrow(
      UtteranceNotAwaitingReviewError,
    );
    expect(() => discardUtterance(utterance({ awaitingHumanReview: false }), '2026-05-01T00:00:00.000Z')).toThrow(
      UtteranceNotAwaitingReviewError,
    );
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

describe('validateVoiceClipDuration', () => {
  it('rejects a clip shorter than the minimum', () => {
    expect(validateVoiceClipDuration(MIN_VOICE_CLIP_DURATION_MS - 1)).toBe('TOO_SHORT');
  });

  it('rejects a clip longer than the maximum', () => {
    expect(validateVoiceClipDuration(MAX_VOICE_CLIP_DURATION_MS + 1)).toBe('TOO_LONG');
  });

  it('accepts a clip at either boundary, inclusive', () => {
    expect(validateVoiceClipDuration(MIN_VOICE_CLIP_DURATION_MS)).toBeNull();
    expect(validateVoiceClipDuration(MAX_VOICE_CLIP_DURATION_MS)).toBeNull();
  });

  it('accepts a clip comfortably inside the range', () => {
    expect(validateVoiceClipDuration(5_000)).toBeNull();
  });
});

describe('isDuplicateVoiceClip', () => {
  it('flags a checksum already among the contributor\'s existing clips', () => {
    expect(isDuplicateVoiceClip(['abc', 'def'], 'abc')).toBe(true);
  });

  it('passes a checksum that has not been seen before', () => {
    expect(isDuplicateVoiceClip(['abc', 'def'], 'ghi')).toBe(false);
  });

  it('passes on an empty history', () => {
    expect(isDuplicateVoiceClip([], 'abc')).toBe(false);
  });
});

describe('Voice Contribution self-report option lists', () => {
  it('names every first language docs/product/freemium-and-voice-corpus.md §4 calls out, plus OTHER', () => {
    expect(motherTongueOptions).toEqual([
      'NEPALI', 'MAITHILI', 'BHOJPURI', 'THARU', 'TAMANG', 'NEWAR', 'GURUNG', 'MAGAR', 'OTHER',
    ]);
  });

  it('covers a contiguous set of age bands with no gap', () => {
    expect(ageBandOptions).toEqual(['13_17', '18_24', '25_34', '35_44', '45_59', '60_PLUS']);
  });

  it('offers a self-describe and a decline option alongside WOMAN/MAN', () => {
    expect(genderOptions).toEqual(['WOMAN', 'MAN', 'OTHER', 'PREFER_NOT_TO_SAY']);
  });
});

function voiceClip(overrides: Partial<VoiceClip> = {}): VoiceClip {
  return {
    id: 'clip-1',
    contributorId: 'contributor-1',
    consentVersion: VOICE_CONTRIBUTION_CONSENT_VERSION,
    taskId: 'free-speech-village',
    taskKind: 'FREE_SPEECH',
    selfReport: { district: 'Kathmandu', motherTongue: 'NEPALI', ageBand: '25_34', gender: null },
    device: 'test-agent',
    durationMs: 4_000,
    capturedAt: '2026-08-01T00:00:00.000Z',
    ref: { backend: 'HOSTED', externalId: 'obj-1', byteSize: 100, contentType: 'audio/webm', checksumSha256: 'abc' },
    ...overrides,
  };
}

function validation(overrides: Partial<ClipValidation> = {}): ClipValidation {
  return {
    id: 'validation-1',
    clipId: 'clip-1',
    validatorId: 'validator-1',
    verdict: 'RIGHT',
    validatedAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('deriveClipVerificationStatus', () => {
  it('is PENDING with no validations yet', () => {
    expect(deriveClipVerificationStatus([])).toBe('PENDING');
  });

  it('is PENDING with a single RIGHT or WRONG vote — one vote is never decisive', () => {
    expect(deriveClipVerificationStatus([validation({ verdict: 'RIGHT' })])).toBe('PENDING');
    expect(deriveClipVerificationStatus([validation({ verdict: 'WRONG' })])).toBe('PENDING');
  });

  it('is VERIFIED once two validators agree RIGHT', () => {
    const status = deriveClipVerificationStatus([
      validation({ id: 'v1', validatorId: 'a', verdict: 'RIGHT' }),
      validation({ id: 'v2', validatorId: 'b', verdict: 'RIGHT' }),
    ]);
    expect(status).toBe('VERIFIED');
  });

  it('is REJECTED once two validators agree WRONG', () => {
    const status = deriveClipVerificationStatus([
      validation({ id: 'v1', validatorId: 'a', verdict: 'WRONG' }),
      validation({ id: 'v2', validatorId: 'b', verdict: 'WRONG' }),
    ]);
    expect(status).toBe('REJECTED');
  });

  it('stays PENDING on two agreeing UNCLEAR votes — needs a third listener, not a decision', () => {
    const status = deriveClipVerificationStatus([
      validation({ id: 'v1', validatorId: 'a', verdict: 'UNCLEAR' }),
      validation({ id: 'v2', validatorId: 'b', verdict: 'UNCLEAR' }),
    ]);
    expect(status).toBe('PENDING');
  });

  it('stays PENDING when validators disagree, RIGHT vs WRONG', () => {
    const status = deriveClipVerificationStatus([
      validation({ id: 'v1', validatorId: 'a', verdict: 'RIGHT' }),
      validation({ id: 'v2', validatorId: 'b', verdict: 'WRONG' }),
    ]);
    expect(status).toBe('PENDING');
  });
});

describe('earnsRewardMonth', () => {
  it('does not earn a reward at zero verified clips', () => {
    expect(earnsRewardMonth(0)).toBe(false);
  });

  it('does not earn a reward below the threshold', () => {
    expect(earnsRewardMonth(REWARD_VERIFIED_CLIPS_PER_MONTH - 1)).toBe(false);
  });

  it('earns a reward exactly at the threshold', () => {
    expect(earnsRewardMonth(REWARD_VERIFIED_CLIPS_PER_MONTH)).toBe(true);
  });

  it('does not earn a reward again until the next multiple', () => {
    expect(earnsRewardMonth(REWARD_VERIFIED_CLIPS_PER_MONTH + 1)).toBe(false);
  });

  it('earns a second reward at the second multiple', () => {
    expect(earnsRewardMonth(REWARD_VERIFIED_CLIPS_PER_MONTH * 2)).toBe(true);
  });
});

describe('recordClipValidation', () => {
  it('records a validation from someone other than the clip owner', () => {
    const clip = voiceClip({ contributorId: 'contributor-1' });
    const result = recordClipValidation(clip, [], {
      id: 'v1',
      clipId: clip.id,
      validatorId: 'validator-1',
      verdict: 'RIGHT',
      validatedAt: '2026-08-02T00:00:00.000Z',
    });
    expect(result).toMatchObject({ clipId: 'clip-1', validatorId: 'validator-1', verdict: 'RIGHT' });
  });

  it('refuses a contributor validating their own clip', () => {
    const clip = voiceClip({ contributorId: 'same-person' });
    expect(() =>
      recordClipValidation(clip, [], {
        id: 'v1',
        clipId: clip.id,
        validatorId: 'same-person',
        verdict: 'RIGHT',
        validatedAt: '2026-08-02T00:00:00.000Z',
      }),
    ).toThrow(OwnClipValidationError);
  });

  it('refuses the same validator voting on a clip twice', () => {
    const clip = voiceClip();
    const existing = [validation({ id: 'v1', validatorId: 'validator-1', verdict: 'RIGHT' })];
    expect(() =>
      recordClipValidation(clip, existing, {
        id: 'v2',
        clipId: clip.id,
        validatorId: 'validator-1',
        verdict: 'WRONG',
        validatedAt: '2026-08-03T00:00:00.000Z',
      }),
    ).toThrow(DuplicateClipValidationError);
  });

  it('refuses a vote on a clip already resolved', () => {
    const clip = voiceClip();
    const existing = [
      validation({ id: 'v1', validatorId: 'a', verdict: 'RIGHT' }),
      validation({ id: 'v2', validatorId: 'b', verdict: 'RIGHT' }),
    ];
    expect(() =>
      recordClipValidation(clip, existing, {
        id: 'v3',
        clipId: clip.id,
        validatorId: 'c',
        verdict: 'RIGHT',
        validatedAt: '2026-08-04T00:00:00.000Z',
      }),
    ).toThrow(ClipAlreadyResolvedError);
  });
});

describe('nextClipToValidate', () => {
  it('offers the oldest still-pending clip that is not the validator\'s own', () => {
    const clips = [
      voiceClip({ id: 'newer', contributorId: 'someone-else', capturedAt: '2026-08-05T00:00:00.000Z' }),
      voiceClip({ id: 'older', contributorId: 'someone-else', capturedAt: '2026-08-01T00:00:00.000Z' }),
    ];
    const next = nextClipToValidate(clips, new Map(), 'validator-1');
    expect(next?.id).toBe('older');
  });

  it('never offers the validator their own clip', () => {
    const clips = [voiceClip({ id: 'mine', contributorId: 'validator-1' })];
    expect(nextClipToValidate(clips, new Map(), 'validator-1')).toBeNull();
  });

  it('skips a clip already resolved', () => {
    const clips = [voiceClip({ id: 'resolved', contributorId: 'someone-else' })];
    const validationsByClip = new Map([
      ['resolved', [validation({ id: 'v1', validatorId: 'a', verdict: 'RIGHT' }), validation({ id: 'v2', validatorId: 'b', verdict: 'RIGHT' })]],
    ]);
    expect(nextClipToValidate(clips, validationsByClip, 'validator-1')).toBeNull();
  });

  it('skips a clip the validator has already voted on', () => {
    const clips = [voiceClip({ id: 'seen', contributorId: 'someone-else' })];
    const validationsByClip = new Map([['seen', [validation({ id: 'v1', validatorId: 'validator-1', verdict: 'RIGHT' })]]]);
    expect(nextClipToValidate(clips, validationsByClip, 'validator-1')).toBeNull();
  });

  it('returns null when nothing is eligible', () => {
    expect(nextClipToValidate([], new Map(), 'validator-1')).toBeNull();
  });
});

describe('voiceClipIdsForContributor', () => {
  it('names only the given contributor\'s clip ids', () => {
    const clips = [
      voiceClip({ id: 'a', contributorId: 'contributor-1' }),
      voiceClip({ id: 'b', contributorId: 'contributor-2' }),
      voiceClip({ id: 'c', contributorId: 'contributor-1' }),
    ];
    expect(voiceClipIdsForContributor(clips, 'contributor-1')).toEqual(['a', 'c']);
  });

  it('returns an empty list for a contributor with no clips', () => {
    expect(voiceClipIdsForContributor([], 'contributor-1')).toEqual([]);
  });
});

function twoAgreeingValidations(clipId: string, verdict: ClipValidationVerdict = 'RIGHT'): ClipValidation[] {
  return [
    validation({ id: `${clipId}-v1`, clipId, validatorId: 'validator-a', verdict }),
    validation({ id: `${clipId}-v2`, clipId, validatorId: 'validator-b', verdict }),
  ];
}

describe('buildVoiceCorpusRelease', () => {
  it('ships only VERIFIED clips, excluding PENDING and REJECTED', () => {
    const clips = [voiceClip({ id: 'verified' }), voiceClip({ id: 'pending' }), voiceClip({ id: 'rejected' })];
    const validationsByClip = new Map([
      ['verified', twoAgreeingValidations('verified', 'RIGHT')],
      ['pending', [validation({ id: 'p1', clipId: 'pending', validatorId: 'validator-a', verdict: 'RIGHT' })]],
      ['rejected', twoAgreeingValidations('rejected', 'WRONG')],
    ]);

    const release = buildVoiceCorpusRelease(clips, validationsByClip, 'nepali-speech-v0.1', '2026-08-17T00:00:00.000Z');

    expect(release.clips.map((c) => c.clipId)).toEqual(['verified']);
    expect(release.excluded).toEqual({ notVerified: 2, erased: 0 });
  });

  it('flattens selfReport into the release row, alongside version and release timing', () => {
    const clips = [
      voiceClip({ id: 'verified', selfReport: { district: 'Ilam', motherTongue: 'THARU', ageBand: '35_44', gender: 'WOMAN' } }),
    ];
    const validationsByClip = new Map([['verified', twoAgreeingValidations('verified')]]);

    const release = buildVoiceCorpusRelease(clips, validationsByClip, 'nepali-speech-v0.1', '2026-08-17T00:00:00.000Z');

    expect(release.clips[0]).toMatchObject({
      clipId: 'verified',
      district: 'Ilam',
      motherTongue: 'THARU',
      ageBand: '35_44',
      gender: 'WOMAN',
      consentVersion: VOICE_CONTRIBUTION_CONSENT_VERSION,
    });
    expect(release.version).toBe('nepali-speech-v0.1');
    expect(release.releasedAt).toBe('2026-08-17T00:00:00.000Z');
  });

  it('is empty, with nothing marked erased, when no clip has any validation yet', () => {
    const release = buildVoiceCorpusRelease([voiceClip()], new Map(), 'nepali-speech-v0.1', '2026-08-17T00:00:00.000Z');
    expect(release.clips).toEqual([]);
    expect(release.excluded).toEqual({ notVerified: 1, erased: 0 });
  });
});

function releaseClip(clipId: string, contributorId: string) {
  return {
    clipId,
    contributorId,
    consentVersion: VOICE_CONTRIBUTION_CONSENT_VERSION,
    taskId: 'task-1',
    taskKind: 'FREE_SPEECH' as const,
    district: 'Kathmandu',
    motherTongue: 'NEPALI' as const,
    ageBand: '25_34' as const,
    gender: null,
    device: 'test-agent',
    durationMs: 4_000,
    capturedAt: '2026-08-01T00:00:00.000Z',
    ref: { backend: 'HOSTED' as const, externalId: clipId, byteSize: 1, contentType: 'audio/webm', checksumSha256: clipId },
  };
}

describe('eraseFromVoiceCorpusRelease', () => {
  it('removes every clip belonging to the given contributor, leaving others', () => {
    const release = {
      version: 'nepali-speech-v0.1',
      releasedAt: '2026-08-17T00:00:00.000Z',
      clips: [releaseClip('a', 'contributor-1'), releaseClip('b', 'contributor-2')],
      excluded: { notVerified: 0, erased: 0 },
    };

    const erased = eraseFromVoiceCorpusRelease(release, 'contributor-1');

    expect(erased.clips.map((c) => c.clipId)).toEqual(['b']);
    expect(erased.excluded.erased).toBe(1);
  });

  it('is a no-op, returning the identical object, for a contributor with nothing in the release', () => {
    const release = {
      version: 'nepali-speech-v0.1',
      releasedAt: '2026-08-17T00:00:00.000Z',
      clips: [releaseClip('a', 'contributor-1')],
      excluded: { notVerified: 0, erased: 0 },
    };
    expect(eraseFromVoiceCorpusRelease(release, 'nobody-here')).toBe(release);
  });
});

describe('buildVoiceCorpusDatasheet', () => {
  it('summarises who, where, how consented and known gaps from the release', () => {
    const clips = [
      voiceClip({ id: 'a', selfReport: { district: 'Kathmandu', motherTongue: 'NEPALI', ageBand: '25_34', gender: 'WOMAN' }, durationMs: 3_000 }),
      voiceClip({ id: 'b', selfReport: { district: 'Kathmandu', motherTongue: 'THARU', ageBand: '25_34', gender: null }, durationMs: 5_000 }),
    ];
    const validationsByClip = new Map([
      ['a', twoAgreeingValidations('a')],
      ['b', twoAgreeingValidations('b')],
    ]);
    const release = buildVoiceCorpusRelease(clips, validationsByClip, 'nepali-speech-v0.1', '2026-08-17T00:00:00.000Z');

    const datasheet = buildVoiceCorpusDatasheet(release);

    expect(datasheet.clipCount).toBe(2);
    expect(datasheet.totalDurationMs).toBe(8_000);
    expect(datasheet.consentVersions).toEqual([VOICE_CONTRIBUTION_CONSENT_VERSION]);
    expect(datasheet.byMotherTongue).toEqual({ NEPALI: 1, THARU: 1 });
    expect(datasheet.byDistrict).toEqual({ Kathmandu: 2 });
    expect(datasheet.byGender).toEqual({ WOMAN: 1, UNSPECIFIED: 1 });
    expect(datasheet.knownGaps).toBe(VOICE_CORPUS_KNOWN_GAPS);
  });

  it('reflects an erasure already applied to the release', () => {
    const clips = [voiceClip({ id: 'a', contributorId: 'contributor-1' }), voiceClip({ id: 'b', contributorId: 'contributor-2' })];
    const validationsByClip = new Map([
      ['a', twoAgreeingValidations('a')],
      ['b', twoAgreeingValidations('b')],
    ]);
    const release = buildVoiceCorpusRelease(clips, validationsByClip, 'nepali-speech-v0.1', '2026-08-17T00:00:00.000Z');

    const datasheet = buildVoiceCorpusDatasheet(eraseFromVoiceCorpusRelease(release, 'contributor-1'));

    expect(datasheet.clipCount).toBe(1);
  });
});
