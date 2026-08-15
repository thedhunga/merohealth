import { grantDelegation, hasScope, revokeDelegation } from '@swasthya/family';
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
 * The delegation half below (§3's "even under an active delegation") was
 * left as an `it.todo` until `packages/family` shipped (round two §C) — it
 * now has. `@swasthya/family` is a devDependency of this package, not a
 * runtime one: `route`/`retrieveForSubject` take a plain `subjectId` and
 * know nothing about delegation, by design (grounded-answers.md's own
 * subject-id-agnostic scoping). §3's property is a *composition* one — "the
 * subject is her and the retrieval set is hers, never a union of both" —
 * so the tests below exercise that composition directly: `hasScope` is the
 * pre-check a real call site must make before ever choosing which
 * `subjectId` to hand to `route`, and once that id is chosen, this
 * package's own scoping must hold exactly as it does for any other caller.
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

// grounded-answers.md §3: "When the grandson asks a question while acting
// for his grandmother, the subject is her and the retrieval set is hers —
// never a union of both. A question asked in her context must not be
// answerable from his record, and vice versa." subject-1 plays the
// grandmother (granter), subject-3 the grandson (delegate); subject-2 stays
// the unrelated third party from `sharedCorpus` above, present in every
// case below to prove the delegation doesn't widen access to *anyone*
// beyond the one relationship it actually grants.
const delegateOwnObservation = makeObservation({
  id: 'obs-3-a',
  ownerId: 'subject-3',
  effectiveAt: '2026-02-15',
  value: '150',
});
const delegateOwnDocument = makeDocument({
  id: 'doc-3-a',
  ownerId: 'subject-3',
  title: 'Fasting glucose — subject 3',
});
const corpusWithDelegate = {
  observations: [...sharedCorpus.observations, delegateOwnObservation],
  documents: [...sharedCorpus.documents, delegateOwnDocument],
};

const activeDelegation = grantDelegation(
  'grant-1',
  'subject-1',
  'subject-3',
  ['VIEW_RECORD', 'ASK_ASSISTANT'],
  '2026-01-01T00:00:00.000Z',
  '2027-01-01T00:00:00.000Z',
);

describe('cross-subject leakage — under an active delegation', () => {
  it('hasScope is the gate a call site must pass before choosing which subjectId to query as', () => {
    expect(hasScope(activeDelegation, 'ASK_ASSISTANT', '2026-06-01T00:00:00.000Z')).toBe(true);
  });

  it("a revoked grant fails the gate even though the DelegationGrant object itself still exists", () => {
    const revoked = revokeDelegation(activeDelegation, '2026-02-01T00:00:00.000Z');
    expect(hasScope(revoked, 'ASK_ASSISTANT', '2026-06-01T00:00:00.000Z')).toBe(false);
  });

  it('a scope never granted fails the gate even while the rest of the grant is active', () => {
    const bookingOnly = grantDelegation(
      'grant-2',
      'subject-1',
      'subject-3',
      ['MANAGE_APPOINTMENTS'],
      '2026-01-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z',
    );
    expect(hasScope(bookingOnly, 'ASK_ASSISTANT', '2026-06-01T00:00:00.000Z')).toBe(false);
  });

  it("a delegate acting for the granter — the effective subjectId resolved from the grant, per §3 — sees only her record, never his own and never subject-2's", () => {
    const routed = route(activeDelegation.granterId, corpusWithDelegate, 'मेरो चिनी कस्तो छ?');

    expect(routed.path).toBe('COMPUTED');
    if (routed.path !== 'COMPUTED') throw new Error('unreachable');
    expect(routed.trends[0]?.trend.points.map((p) => p.value)).toEqual([95, 98]);
    expect(routed.trends[0]?.citations.map((c) => c.sourceId)).toEqual(['obs-1-a', 'obs-1-b']);

    const answer = composeAnswer(routed);
    if (answer.path !== 'ANSWERED') throw new Error('unreachable');
    for (const claim of answer.claims) {
      for (const citation of claim.citations) {
        expect(citation.documentId).not.toBe('doc-3-a');
        expect(citation.documentId).not.toBe('doc-2-a');
      }
      for (const target of claim.targets) {
        expect(target.documentId).not.toBe('doc-3-a');
        expect(target.documentId).not.toBe('doc-2-a');
      }
    }
  });

  it('the same delegate asking in his own context sees only his own record — an active delegation for someone else never leaks into it', () => {
    const routed = route(activeDelegation.delegateId, corpusWithDelegate, 'मेरो चिनी कस्तो छ?');

    expect(routed.path).toBe('COMPUTED');
    if (routed.path !== 'COMPUTED') throw new Error('unreachable');
    expect(routed.trends[0]?.trend.points.map((p) => p.value)).toEqual([150]);
    expect(routed.trends[0]?.citations.map((c) => c.sourceId)).toEqual(['obs-3-a']);

    const answer = composeAnswer(routed);
    if (answer.path !== 'ANSWERED') throw new Error('unreachable');
    for (const claim of answer.claims) {
      for (const citation of claim.citations) {
        expect(citation.documentId).not.toBe('doc-1-a');
        expect(citation.documentId).not.toBe('doc-2-a');
      }
    }
  });
});
