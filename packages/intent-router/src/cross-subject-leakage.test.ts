import { retrieveForSubject } from '@swasthya/retrieval';
import { describe, expect, it } from 'vitest';
import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';

import { composeAnswer, route } from './index';

/**
 * grounded-answers.md §3: "Cross-subject leakage is the highest-severity
 * failure this system can have. It gets an explicit test, not a code
 * review." This file is that test — one dedicated place proving the
 * property end to end, rather than trusting it to survive as a side effect
 * of function-level unit tests scattered across `packages/retrieval` and
 * this package's own `index.test.ts`.
 *
 * Every corpus below is adversarial on purpose: subject-2's record is built
 * to be the more attractive match — a higher value, a more recent date, an
 * identical analyte code — so that if scoping ever regressed to "most
 * relevant" instead of "owned by this subject," these tests would catch it
 * by the wrong number appearing, not just an extra one.
 *
 * Scope, decided explicitly rather than narrowed silently: `packages/family`
 * (round two, section C) does not exist yet, so "even under an active
 * delegation" — the second half of the queue's own description — has no
 * delegation state machine to test against today. The `it.todo` at the
 * bottom of this file stands in for that half so it stays visible in every
 * test run until `packages/family` ships, instead of quietly vanishing from
 * the suite's description.
 */

function makeObservation(overrides: Partial<HealthObservation> = {}): HealthObservation {
  return {
    id: 'obs-1',
    documentId: 'doc-1',
    ownerId: 'subject-1',
    code: '1558-6',
    codeSystem: 'LOINC',
    labelNe: 'उपवास रक्त शर्करा',
    labelEn: 'Fasting Glucose',
    value: '95',
    unit: 'mg/dL',
    referenceRange: '70-100',
    abnormalFlag: 'NORMAL',
    effectiveAt: '2026-03-01',
    status: 'CONFIRMED',
    provenance: 'DOCUMENT_EXTRACTED',
    confidence: 0.95,
    extractionRunId: 'run-1',
    ...overrides,
  };
}

function makeDocument(overrides: Partial<HealthDocument> = {}): HealthDocument {
  return {
    id: 'doc-1',
    ownerId: 'subject-1',
    kind: 'LAB_REPORT',
    status: 'CONFIRMED',
    ref: {
      backend: 'HOSTED',
      externalId: 'hosted-1',
      byteSize: 1024,
      contentType: 'image/jpeg',
      checksumSha256: 'abc123',
    },
    title: 'Kidney panel — Om Hospital',
    documentDate: '2026-03-01',
    capturedAt: '2026-03-02T10:00:00.000Z',
    sensitivity: 'STANDARD',
    clientEncrypted: false,
    pageCount: 1,
    ...overrides,
  };
}

// Two subjects, same analyte code, deliberately colliding on everything an
// accidental "most relevant" or "most recent across the corpus" bug would
// reach for instead of ownerId: subject-2's reading is newer, more
// abnormal, and would flip the trend's direction if it leaked in.
const sharedCorpus = {
  observations: [
    makeObservation({ id: 'obs-1-a', ownerId: 'subject-1', effectiveAt: '2026-01-01', value: '95' }),
    makeObservation({ id: 'obs-1-b', ownerId: 'subject-1', effectiveAt: '2026-02-01', value: '98' }),
    makeObservation({
      id: 'obs-2-a',
      ownerId: 'subject-2',
      effectiveAt: '2026-03-15',
      value: '210',
      abnormalFlag: 'HIGH',
    }),
  ],
  documents: [
    makeDocument({ id: 'doc-1-a', ownerId: 'subject-1', title: 'Fasting glucose — subject 1' }),
    makeDocument({ id: 'doc-2-a', ownerId: 'subject-2', title: 'Fasting glucose — subject 2' }),
  ],
};

describe('cross-subject leakage — retrieveForSubject', () => {
  it('never lets a more recent, more abnormal reading from another subject into the trend', () => {
    const result = retrieveForSubject('subject-1', sharedCorpus, 'चिनी');

    expect(result.observations.map((r) => r.observation.id)).toEqual(['obs-1-b', 'obs-1-a']);
    expect(result.observations.every((r) => r.observation.ownerId === 'subject-1')).toBe(true);
  });

  it('never lets the other subject\'s document surface, even with a matching title', () => {
    const result = retrieveForSubject('subject-1', sharedCorpus, 'glucose');

    expect(result.documents.map((r) => r.document.id)).toEqual(['doc-1-a']);
  });

  it('is symmetric: subject-2 querying the identical shared corpus never sees subject-1\'s rows either', () => {
    const result = retrieveForSubject('subject-2', sharedCorpus, 'चिनी');

    expect(result.observations.map((r) => r.observation.id)).toEqual(['obs-2-a']);
    expect(result.documents.map((r) => r.document.id)).toEqual(['doc-2-a']);
  });

  it('reports no unconfirmed matches for subject-1 when only subject-2 has a matching DRAFT', () => {
    const corpusWithOtherDraft = {
      observations: [makeObservation({ id: 'obs-2-draft', ownerId: 'subject-2', status: 'DRAFT' as const })],
      documents: [],
    };

    const result = retrieveForSubject('subject-1', corpusWithOtherDraft, 'चिनी');

    expect(result.observations).toEqual([]);
    expect(result.hasUnconfirmedMatches).toBe(false);
  });
});

describe('cross-subject leakage — route and composeAnswer, end to end', () => {
  it('computes subject-1\'s trend from subject-1\'s own two readings only, never subject-2\'s third', () => {
    const routed = route('subject-1', sharedCorpus, 'मेरो चिनी कस्तो छ?');

    expect(routed.path).toBe('COMPUTED');
    if (routed.path !== 'COMPUTED') throw new Error('unreachable');
    expect(routed.trends).toHaveLength(1);
    expect(routed.trends[0]?.trend.points.map((p) => p.value)).toEqual([95, 98]);
    expect(routed.trends[0]?.citations.map((c) => c.sourceId)).toEqual(['obs-1-a', 'obs-1-b']);

    const answer = composeAnswer(routed);
    if (answer.path !== 'ANSWERED') throw new Error('unreachable');
    for (const claim of answer.claims) {
      for (const citation of claim.citations) {
        expect(citation.documentId).not.toBe('doc-2-a');
      }
      for (const target of claim.targets) {
        expect(target.documentId).not.toBe('doc-2-a');
      }
    }
  });

  it('refuses with NO_MATCHING_RECORD, not a leaked answer, when only another subject has any matching record at all', () => {
    const onlyOtherSubjectHasData = {
      observations: [makeObservation({ id: 'obs-2-only', ownerId: 'subject-2', value: '210' })],
      documents: [],
    };

    const routed = route('subject-1', onlyOtherSubjectHasData, 'मेरो चिनी कस्तो छ?');
    const answer = composeAnswer(routed);

    expect(answer).toEqual({
      path: 'REFUSAL',
      intent: 'TREND',
      matchedConcepts: ['glucose'],
      reason: 'NO_MATCHING_RECORD',
      concepts: [{ concept: 'glucose', labelNe: 'चिनी', labelEn: 'glucose' }],
    });
  });

  it('refuses with NO_MATCHING_RECORD rather than UNCONFIRMED_DRAFTS_ONLY when the only matching draft belongs to another subject', () => {
    const onlyOtherSubjectHasDraft = {
      observations: [makeObservation({ id: 'obs-2-draft', ownerId: 'subject-2', status: 'DRAFT' as const })],
      documents: [],
    };

    const routed = route('subject-1', onlyOtherSubjectHasDraft, 'मेरो चिनी कस्तो छ?');
    const answer = composeAnswer(routed);

    // The whole point of this case: a subject-2-only draft must read as "no
    // record," never as "you have something pending confirmation" — that
    // pointer would itself leak the fact that subject-2's record exists.
    expect(answer).toEqual({
      path: 'REFUSAL',
      intent: 'TREND',
      matchedConcepts: ['glucose'],
      reason: 'NO_MATCHING_RECORD',
      concepts: [{ concept: 'glucose', labelNe: 'चिनी', labelEn: 'glucose' }],
    });
  });

  it('is symmetric: subject-2 routed and composed from the identical shared corpus never surfaces subject-1\'s reading', () => {
    const routed = route('subject-2', sharedCorpus, 'मेरो चिनी कस्तो छ?');

    expect(routed.path).toBe('COMPUTED');
    if (routed.path !== 'COMPUTED') throw new Error('unreachable');
    expect(routed.trends[0]?.trend.points.map((p) => p.value)).toEqual([210]);

    const answer = composeAnswer(routed);
    if (answer.path !== 'ANSWERED') throw new Error('unreachable');
    for (const claim of answer.claims) {
      for (const citation of claim.citations) {
        expect(citation.documentId).not.toBe('doc-1-a');
      }
    }
  });
});

// grounded-answers.md §3's own wording: "even under an active delegation."
// `packages/family` (round two §C) isn't built yet — no `DelegationGrant`,
// no scoped-permission state machine — so there is nothing here for a test
// to exercise that a hand-rolled stand-in wouldn't be fiction dressed as
// coverage, which "invent no facts" rules out just as much for test fixtures
// as for product copy. Left as an explicit `todo` so it stays visible in
// every run's test output rather than being a line in this file's own
// comments that nobody re-reads: this test must be written for real once
// `packages/family` lands, exercising retrieval under a delegate acting for
// someone else, not narrowed further or quietly dropped.
describe.todo('cross-subject leakage — under an active delegation (blocked on packages/family)');
