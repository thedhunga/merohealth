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

  // Blocked on packages/family (round two §C): every case above asks from
  // the subject's own context. A delegate asking on someone else's behalf —
  // "मेरो हजुरआमाको सुगर कस्तो छ?" while acting for a grandmother — needs a
  // DelegationGrant to resolve which record "मेरो" even means, and nothing
  // in the repo has that state machine yet. See
  // packages/intent-router/src/cross-subject-leakage.test.ts's own
  // describe.todo for the same gap at the retrieval-internals layer.
  describe.todo("evaluation cases asked by a delegate on another subject's behalf (blocked on packages/family)");
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
