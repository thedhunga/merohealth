import { grantDelegationByAssistedEnrolment, hasScope, revokeDelegation } from '@swasthya/family';
import { describe, expect, it } from 'vitest';

import {
  demonstrationCorpus,
  demonstrationSubjects,
  evaluationCases,
  runEvaluationCase,
  runEvaluationSet,
} from './index';

describe('evaluationCases', () => {
  it('every case names a subject that actually exists in the demonstration corpus', () => {
    const knownSubjects: ReadonlySet<string> = new Set(Object.values(demonstrationSubjects));
    for (const evalCase of evaluationCases) {
      expect(knownSubjects.has(evalCase.subjectId), evalCase.id).toBe(true);
    }
  });

  it('has no duplicate case ids', () => {
    const ids = evaluationCases.map((evalCase) => evalCase.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every script this product must retrieve across (ne / ne-Latn / en)', () => {
    const scripts = new Set(evaluationCases.map((evalCase) => evalCase.script));
    expect(scripts).toEqual(new Set(['ne', 'ne-Latn', 'en']));
  });

  it('covers every RefusalReason a real question against real record state can produce', () => {
    const reasons = new Set(
      evaluationCases
        .map((evalCase) => evalCase.expected)
        .filter((outcome) => outcome.kind === 'REFUSAL')
        .map((outcome) => outcome.reason),
    );
    // NOTHING_CITABLE is the fail-safe branch composeAnswer's own tests cover
    // directly (packages/intent-router/src/index.test.ts) — it cannot fire
    // from a real corpus today, since `route` only ever builds a
    // `ComputedTrend` from observations `retrieveForSubject` already cited.
    expect(reasons).toEqual(new Set(['NOT_UNDERSTOOD', 'NO_MATCHING_RECORD', 'UNCONFIRMED_DRAFTS_ONLY']));
  });

  it('covers every computable intent (TREND, LATEST_VALUE, COMPARISON)', () => {
    const answeredIntents = new Set(
      evaluationCases
        .map((evalCase) => evalCase.expected)
        .filter((outcome) => outcome.kind === 'ANSWERED')
        .map((outcome) => outcome.intent),
    );
    expect(answeredIntents).toEqual(new Set(['TREND', 'LATEST_VALUE', 'COMPARISON']));
  });

  // packages/family (round two §C) has since shipped, unblocking this.
  // `@swasthya/family` is a devDependency of this package only, mirroring
  // packages/intent-router/src/cross-subject-leakage.test.ts's own
  // boundary: `runEvaluationCase`/`route` still take a plain `subjectId` and
  // know nothing about delegation — "a delegate asking on someone else's
  // behalf" is the call site resolving *which* subjectId to hand in, after
  // `hasScope` passes. The grant below is not invented: it reproduces the
  // real Janaki→Sunita `DelegationGrant` `packages/database/src/seed-data.ts`
  // actually seeds — same ids, scopes and dates, assisted enrolment recorded
  // by Sunita — for the same reason `demonstrationCorpus` above is a typed
  // copy of the seed rather than a second invented dataset.
  describe("evaluation cases asked by a delegate on another subject's behalf", () => {
    const janakiGrantsSunitaAccess = grantDelegationByAssistedEnrolment(
      'e0000000-0000-4000-8000-000000000001',
      demonstrationSubjects.janaki,
      demonstrationSubjects.sunita,
      ['VIEW_RECORD', 'ASK_ASSISTANT'],
      '2026-06-15T00:00:00Z',
      '2027-06-15T00:00:00Z',
      'IN_PERSON_VERBAL',
      demonstrationSubjects.sunita,
    );

    it("hasScope is the gate a real call site checks before resolving Sunita's question to Janaki's subjectId", () => {
      expect(hasScope(janakiGrantsSunitaAccess, 'ASK_ASSISTANT', '2026-07-01T00:00:00.000Z')).toBe(true);
    });

    it('a revoked grant fails the gate even though neither record changed', () => {
      const revoked = revokeDelegation(janakiGrantsSunitaAccess, '2026-08-01T00:00:00.000Z');
      expect(hasScope(revoked, 'ASK_ASSISTANT', '2026-09-01T00:00:00.000Z')).toBe(false);
    });

    it("Sunita asking on Janaki's behalf — the effective subjectId resolved from the grant — gets exactly the janaki-glucose-trend-ne case's answer, never her own record blended in", () => {
      const onJanakisBehalf = evaluationCases.find((c) => c.id === 'janaki-glucose-trend-ne');
      if (!onJanakisBehalf) throw new Error('fixture case missing');
      const sunitaOwnDocumentIds = new Set(
        demonstrationCorpus.observations
          .filter((o) => o.ownerId === demonstrationSubjects.sunita)
          .map((o) => o.documentId),
      );

      const result = runEvaluationCase(demonstrationCorpus, onJanakisBehalf);

      expect(result.passed).toBe(true);
      if (result.actual.path !== 'ANSWERED') throw new Error('unreachable');
      for (const claim of result.actual.claims) {
        for (const citation of claim.citations) {
          expect(sunitaOwnDocumentIds.has(citation.documentId)).toBe(false);
        }
      }
    });

    it('the same delegation never leaks into Sunita asking in her own context — she still gets only her own thyroid result', () => {
      const sunitaAskingForHerself = evaluationCases.find((c) => c.id === 'sunita-thyroid-trend-ne');
      if (!sunitaAskingForHerself) throw new Error('fixture case missing');
      const janakiOwnDocumentIds = new Set(
        demonstrationCorpus.observations
          .filter((o) => o.ownerId === demonstrationSubjects.janaki)
          .map((o) => o.documentId),
      );

      const result = runEvaluationCase(demonstrationCorpus, sunitaAskingForHerself);

      expect(result.passed).toBe(true);
      if (result.actual.path !== 'ANSWERED') throw new Error('unreachable');
      for (const claim of result.actual.claims) {
        for (const citation of claim.citations) {
          expect(janakiOwnDocumentIds.has(citation.documentId)).toBe(false);
        }
      }
    });
  });
});

describe('runEvaluationCase', () => {
  it('reports a passing case with no mismatch', () => {
    const evalCase = evaluationCases.find((c) => c.id === 'janaki-glucose-trend-ne');
    if (!evalCase) throw new Error('fixture case missing');
    const result = runEvaluationCase(demonstrationCorpus, evalCase);
    expect(result.passed).toBe(true);
    expect(result.mismatch).toBeNull();
  });

  it('reports a specific mismatch when the actual answer disagrees with what was expected', () => {
    const evalCase = evaluationCases.find((c) => c.id === 'janaki-glucose-trend-ne');
    if (!evalCase) throw new Error('fixture case missing');
    const wrongExpectation = { ...evalCase, expected: { kind: 'ANSWERED' as const, intent: 'TREND' as const, codes: ['not-a-real-code'] } };
    const result = runEvaluationCase(demonstrationCorpus, wrongExpectation);
    expect(result.passed).toBe(false);
    expect(result.mismatch).toContain('expected codes');
  });
});

describe('runEvaluationSet', () => {
  it('passes every case whose expected outcome is the ideal answer, not just today\'s behavior', () => {
    // The two `idealNote` cases are excluded here on purpose — asserting
    // them 100% clean would make this test lie about the classifier's real
    // accuracy the moment someone reads a green run. They get their own
    // check below instead.
    const idealCases = evaluationCases.filter((evalCase) => evalCase.idealNote === undefined);
    const report = runEvaluationSet(demonstrationCorpus, idealCases);
    const failures = report.failed.map((result) => `${result.evalCase.id}: ${result.mismatch}`).join('\n');
    expect(report.failed, failures).toHaveLength(0);
    expect(report.passed).toBe(report.total);
  });

  it('known-gap cases still match their documented, verified current behavior', () => {
    // These assert today's actual (imperfect) output, per each case's
    // `idealNote`. If this ever fails, `packages/intent-router` changed in a
    // way that resolved (or altered) the gap — that is good news, and the
    // fix is to move the case out of this list and drop its `idealNote`, not
    // to weaken this assertion.
    const knownGapCases = evaluationCases.filter((evalCase) => evalCase.idealNote !== undefined);
    expect(knownGapCases.length).toBeGreaterThan(0);
    const report = runEvaluationSet(demonstrationCorpus, knownGapCases);
    const failures = report.failed.map((result) => `${result.evalCase.id}: ${result.mismatch}`).join('\n');
    expect(report.failed, failures).toHaveLength(0);
  });
});
