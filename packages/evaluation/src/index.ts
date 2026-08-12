import { route, composeAnswer } from '@swasthya/intent-router';
import type { GroundedAnswer, Intent, RefusalReason } from '@swasthya/intent-router';
import type { RetrievalCorpus } from '@swasthya/retrieval';
import type { HealthObservation } from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Demonstration corpus
 *
 * grounded-answers.md §8: "real Nepali questions paired with the record
 * state they should be answered from." The record state is
 * `packages/database/src/seed-data.ts` — the one demonstration dataset the
 * whole product tests against — mirrored here rather than imported: that
 * package's only export is a Prisma-generated client (`createPrismaClient`,
 * `PrismaClient`) requiring `prisma generate` before anything could resolve,
 * and `seed-data.ts` itself isn't in its `exports` map for another package to
 * reach. Same ids, same values, same labels as the seed — this is not a
 * second invented dataset, it is a typed, dependency-free copy of the first
 * one, following the precedent `packages/retrieval` and
 * `packages/intent-router`'s own test files already set of each keeping its
 * own fixture rather than sharing one across packages.
 * ------------------------------------------------------------------ */

const janakiId = 'a0000000-0000-4000-8000-000000000001';
const sunitaId = 'a0000000-0000-4000-8000-000000000002';
const roshaniId = 'a0000000-0000-4000-8000-000000000003';
const arjunId = 'a0000000-0000-4000-8000-000000000004';

export const demonstrationSubjects = {
  janaki: janakiId,
  sunita: sunitaId,
  roshani: roshaniId,
  arjun: arjunId,
} as const;

const janakiDocumentId = '50000000-0000-4000-8000-000000000001';
const sunitaDocumentId = '50000000-0000-4000-8000-000000000002';
const roshaniDocumentId = '50000000-0000-4000-8000-000000000003';
const arjunDocumentId = '50000000-0000-4000-8000-000000000004';

const demonstrationObservations: readonly HealthObservation[] = [
  {
    id: '60000000-0000-4000-8000-000000000001',
    documentId: janakiDocumentId,
    ownerId: janakiId,
    code: '4548-4',
    codeSystem: 'LOINC',
    labelNe: 'एचबीए१सी (औसत रक्त शर्करा)',
    labelEn: 'Hemoglobin A1c',
    value: '8.2',
    unit: '%',
    referenceRange: '4.0-5.6',
    abnormalFlag: 'HIGH',
    effectiveAt: '2026-05-18T00:00:00Z',
    status: 'CONFIRMED',
    provenance: 'DOCUMENT_EXTRACTED',
    confidence: 0.91,
    extractionRunId: 'demo-extraction-run-001',
  },
  {
    id: '60000000-0000-4000-8000-000000000002',
    documentId: janakiDocumentId,
    ownerId: janakiId,
    code: '1558-6',
    codeSystem: 'LOINC',
    labelNe: 'उपवास रक्त शर्करा',
    labelEn: 'Fasting Glucose',
    value: '162',
    unit: 'mg/dL',
    referenceRange: '70-99',
    abnormalFlag: 'HIGH',
    effectiveAt: '2026-05-18T00:00:00Z',
    status: 'CONFIRMED',
    provenance: 'DOCUMENT_EXTRACTED',
    confidence: 0.88,
    extractionRunId: 'demo-extraction-run-001',
  },
  {
    id: '60000000-0000-4000-8000-000000000003',
    documentId: sunitaDocumentId,
    ownerId: sunitaId,
    code: '3016-3',
    codeSystem: 'LOINC',
    labelNe: 'थाइरोइड उत्तेजक हर्मोन (टीएसएच)',
    labelEn: 'Thyroid Stimulating Hormone (TSH)',
    value: '2.1',
    unit: 'mIU/L',
    referenceRange: '0.4-4.0',
    abnormalFlag: 'NORMAL',
    effectiveAt: '2026-06-02T00:00:00Z',
    status: 'CONFIRMED',
    provenance: 'DOCUMENT_EXTRACTED',
    confidence: 0.93,
    extractionRunId: 'demo-extraction-run-001',
  },
  // Deliberately DRAFT, same as the seed — the concrete case
  // "only CONFIRMED and CORRECTED observations may be reasoned over" exists
  // for. Case 6 below asserts this must refuse, pointing at the
  // confirmation queue, not report Sunita's record as empty.
  {
    id: '60000000-0000-4000-8000-000000000004',
    documentId: sunitaDocumentId,
    ownerId: sunitaId,
    code: '1989-3',
    codeSystem: 'LOINC',
    labelNe: 'भिटामिन डी',
    labelEn: 'Vitamin D, 25-Hydroxy',
    value: '18',
    unit: 'ng/mL',
    referenceRange: '30-100',
    abnormalFlag: 'LOW',
    effectiveAt: '2026-06-02T00:00:00Z',
    status: 'DRAFT',
    provenance: 'DOCUMENT_EXTRACTED',
    confidence: 0.61,
    extractionRunId: 'demo-extraction-run-001',
  },
  {
    id: '60000000-0000-4000-8000-000000000005',
    documentId: roshaniDocumentId,
    ownerId: roshaniId,
    code: '718-7',
    codeSystem: 'LOINC',
    labelNe: 'हेमोग्लोबिन',
    labelEn: 'Hemoglobin',
    value: '12.8',
    unit: 'g/dL',
    referenceRange: '11.5-15.5',
    abnormalFlag: 'NORMAL',
    effectiveAt: '2026-04-20T00:00:00Z',
    status: 'CONFIRMED',
    provenance: 'DOCUMENT_EXTRACTED',
    confidence: 0.95,
    extractionRunId: 'demo-extraction-run-001',
  },
  {
    id: '60000000-0000-4000-8000-000000000006',
    documentId: arjunDocumentId,
    ownerId: arjunId,
    code: '2093-3',
    codeSystem: 'LOINC',
    labelNe: 'कुल कोलेस्ट्रोल',
    labelEn: 'Total Cholesterol',
    value: '215',
    unit: 'mg/dL',
    referenceRange: '<200',
    abnormalFlag: 'HIGH',
    effectiveAt: '2026-06-10T00:00:00Z',
    status: 'CONFIRMED',
    provenance: 'DOCUMENT_EXTRACTED',
    confidence: 0.9,
    extractionRunId: 'demo-extraction-run-001',
  },
];

/**
 * `route`/`composeAnswer` never read `RetrievalCorpus.documents` — only
 * `retrieveForSubject`'s `observations` branch feeds `buildAnalyteTrend` —
 * so an empty array here is not a shortcut, it is what the pipeline this
 * evaluation set exercises actually consumes.
 */
export const demonstrationCorpus: RetrievalCorpus = {
  observations: demonstrationObservations,
  documents: [],
};

/* ------------------------------------------------------------------ *
 * Evaluation cases
 *
 * grounded-answers.md §8: build this before tuning anything, so a later
 * change to `packages/retrieval` or `packages/intent-router` can be judged
 * against real questions and real record state instead of vibes. Every
 * `expected` below is today's actual, verified pipeline output, not a wish —
 * this is a golden-master regression suite, not a spec. Two cases carry
 * `idealNote`: a real gap between what the pipeline does today and what it
 * should eventually do, found *while building this set* by running real
 * Nepali/romanized/English questions against it. Recording the gap here
 * rather than quietly fixing it keeps this run to the one task it was
 * assigned, and gives whoever tunes next a concrete, reproducible target
 * instead of a vague "improve intent classification."
 * ------------------------------------------------------------------ */

export type EvaluationOutcome =
  | {
      kind: 'ANSWERED';
      intent: 'TREND' | 'LATEST_VALUE' | 'COMPARISON';
      /** Analyte codes expected among the answer's claims, order-independent. */
      codes: readonly string[];
    }
  | {
      kind: 'REFUSAL';
      intent: Intent;
      reason: RefusalReason;
      /** Matched concept ids expected on the refusal, order-independent. */
      concepts: readonly string[];
    };

export interface EvaluationCase {
  id: string;
  /** What this case is checking, for a human reading a failure report. */
  description: string;
  subjectId: string;
  script: 'ne' | 'ne-Latn' | 'en';
  query: string;
  expected: EvaluationOutcome;
  /** Set only when `expected` documents a known limitation rather than the
   *  ideal answer — see the section comment above. */
  idealNote?: string;
}

const glucoseCodes = ['4548-4', '1558-6'] as const;

export const evaluationCases: readonly EvaluationCase[] = [
  {
    id: 'janaki-glucose-trend-ne',
    description: 'Trend question in Devanagari, colloquial term (सुगर), matches both glucose analytes on record.',
    subjectId: janakiId,
    script: 'ne',
    query: 'मेरो सुगर कस्तो छ?',
    expected: { kind: 'ANSWERED', intent: 'TREND', codes: glucoseCodes },
  },
  {
    id: 'janaki-glucose-trend-romanized',
    description: 'Same question, romanized Nepali, no explicit question-form marker — falls to the TREND default.',
    subjectId: janakiId,
    script: 'ne-Latn',
    query: 'mero chini report',
    expected: { kind: 'ANSWERED', intent: 'TREND', codes: glucoseCodes },
  },
  {
    id: 'janaki-glucose-latest-ne',
    description: 'अहिले correctly selects LATEST_VALUE over the TREND default.',
    subjectId: janakiId,
    script: 'ne',
    query: 'मेरो सुगर अहिले कति छ?',
    expected: { kind: 'ANSWERED', intent: 'LATEST_VALUE', codes: glucoseCodes },
  },
  {
    id: 'janaki-glucose-comparison-ne',
    description: 'भन्दा/फरक select COMPARISON over the TREND default.',
    subjectId: janakiId,
    script: 'ne',
    query: 'मेरो सुगर अघिल्लो भन्दा फरक छ?',
    expected: { kind: 'ANSWERED', intent: 'COMPARISON', codes: glucoseCodes },
  },
  {
    id: 'sunita-thyroid-trend-ne',
    description: 'Single-analyte trend, a normal (not abnormal) result.',
    subjectId: sunitaId,
    script: 'ne',
    query: 'मेरो थाइरोइड कस्तो छ?',
    expected: { kind: 'ANSWERED', intent: 'TREND', codes: ['3016-3'] },
  },
  {
    id: 'sunita-vitaminD-unconfirmed-ne',
    description:
      "grounded-answers.md §6's confirmation-queue case: Sunita's only vitamin D reading is DRAFT, so this must " +
      'refuse with UNCONFIRMED_DRAFTS_ONLY, not report an empty record.',
    subjectId: sunitaId,
    script: 'ne',
    query: 'मेरो भिटामिन डी अहिले कति छ?',
    expected: { kind: 'REFUSAL', intent: 'LATEST_VALUE', reason: 'UNCONFIRMED_DRAFTS_ONLY', concepts: ['vitaminD'] },
  },
  {
    id: 'roshani-hemoglobin-trend-ne',
    description: "The minor subject's own record, asked in her own context.",
    subjectId: roshaniId,
    script: 'ne',
    query: 'मेरो हेमोग्लोबिन कस्तो छ?',
    expected: { kind: 'ANSWERED', intent: 'TREND', codes: ['718-7'] },
  },
  {
    id: 'roshani-thyroid-no-leak-ne',
    description:
      'Cross-subject scoping at the product-question level: Sunita has a thyroid result, Roshani does not — this ' +
      "must refuse, never answer from Sunita's record. Complements, does not duplicate, " +
      'cross-subject-leakage.test.ts in packages/intent-router, which exercises the same property against an ' +
      'adversarial corpus built to fail loudly on a wrong value rather than a real one.',
    subjectId: roshaniId,
    script: 'ne',
    query: 'मेरो थाइरोइड कस्तो छ?',
    expected: { kind: 'REFUSAL', intent: 'TREND', reason: 'NO_MATCHING_RECORD', concepts: ['thyroid'] },
  },
  {
    id: 'arjun-cholesterol-trend-ne',
    description: 'Single-analyte trend for the fourth, unrelated subject.',
    subjectId: arjunId,
    script: 'ne',
    query: 'मेरो कोलेस्ट्रोल कस्तो छ?',
    expected: { kind: 'ANSWERED', intent: 'TREND', codes: ['2093-3'] },
  },
  {
    id: 'arjun-kidney-no-data-ne',
    description: 'A recognised concept nobody in the demonstration dataset has a record for.',
    subjectId: arjunId,
    script: 'ne',
    query: 'मेरो मिर्गौला कस्तो छ?',
    expected: { kind: 'REFUSAL', intent: 'TREND', reason: 'NO_MATCHING_RECORD', concepts: ['kidney'] },
  },
  {
    id: 'janaki-unsupported-weather-ne',
    description: 'No clinical concept recognised at all — the one case a generic refusal is honestly the best available.',
    subjectId: janakiId,
    script: 'ne',
    query: 'आज मौसम कस्तो छ?',
    expected: { kind: 'REFUSAL', intent: 'UNSUPPORTED', reason: 'NOT_UNDERSTOOD', concepts: [] },
  },
  {
    id: 'janaki-advice-suffix-gap',
    description: "A clearly sugar-related 'what should I do' question refuses as fully unrecognised.",
    subjectId: janakiId,
    script: 'ne',
    query: 'मेरो सुगरको लागि के गर्ने?',
    expected: { kind: 'REFUSAL', intent: 'ADVICE', reason: 'NOT_UNDERSTOOD', concepts: [] },
    idealNote:
      "Ideally this recognises glucose and refuses ADVICE with matchedConcepts ['glucose'], the same as any other " +
      'ADVICE question about a concept on record — a person asking "के गर्ने" about their sugar has said something ' +
      'specific, not nothing. It comes back fully unrecognised because `expandQuery` requires a clinical term to ' +
      'match a *whole token* (packages/retrieval/src/index.ts `termAppears`), and Nepali glues the possessive suffix ' +
      'को directly onto the noun with no space — सुगरको tokenizes as one token, not सुगर + को — so सुगर never matches. ' +
      'Fixing this needs either a small suffix-stripping step in `tokenize`/`termAppears` or listing common ' +
      'inflected forms per term; either is real work belonging to a dedicated task, not a fix hidden inside the ' +
      'run that only built the evaluation set that found it.',
  },
  {
    id: 'janaki-definition-marker-collision',
    description: 'An English "what is my current X" value question answers LATEST_VALUE, not DEFINITION.',
    subjectId: janakiId,
    script: 'en',
    query: 'What is my current blood sugar?',
    expected: { kind: 'ANSWERED', intent: 'LATEST_VALUE', codes: glucoseCodes },
  },
];

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

export interface EvaluationCaseResult {
  evalCase: EvaluationCase;
  actual: GroundedAnswer;
  passed: boolean;
  /** Human-readable diff, or null when `passed`. */
  mismatch: string | null;
}

function sortedCodes(codes: readonly string[]): readonly string[] {
  return [...codes].toSorted();
}

function codesEqual(a: readonly string[], b: readonly string[]): boolean {
  const left = sortedCodes(a);
  const right = sortedCodes(b);
  return left.length === right.length && left.every((code, index) => code === right[index]);
}

function describeMismatch(expected: EvaluationOutcome, actual: GroundedAnswer): string | null {
  if (expected.kind === 'ANSWERED') {
    if (actual.path !== 'ANSWERED') {
      return `expected ANSWERED (${expected.intent}), got REFUSAL (${actual.reason})`;
    }
    const actualIntent = actual.claims[0]?.intent;
    if (actualIntent !== expected.intent) {
      return `expected intent ${expected.intent}, got ${actualIntent ?? '<no claims>'}`;
    }
    const actualCodes = actual.claims.map((claim) => claim.trend.code);
    if (!codesEqual(actualCodes, expected.codes)) {
      return `expected codes [${sortedCodes(expected.codes).join(', ')}], got [${sortedCodes(actualCodes).join(', ')}]`;
    }
    return null;
  }

  if (actual.path !== 'REFUSAL') {
    return `expected REFUSAL (${expected.reason}), got ANSWERED`;
  }
  if (actual.intent !== expected.intent) {
    return `expected intent ${expected.intent}, got ${actual.intent}`;
  }
  if (actual.reason !== expected.reason) {
    return `expected reason ${expected.reason}, got ${actual.reason}`;
  }
  const actualConcepts = actual.matchedConcepts;
  if (!codesEqual(actualConcepts, expected.concepts)) {
    return `expected concepts [${sortedCodes(expected.concepts).join(', ')}], got [${sortedCodes(actualConcepts).join(', ')}]`;
  }
  return null;
}

/** Runs one case through the real pipeline — `route` then `composeAnswer`, the same two calls a caller wiring the assistant would make — and compares the result to what the case expects. */
export function runEvaluationCase(corpus: RetrievalCorpus, evalCase: EvaluationCase): EvaluationCaseResult {
  const routed = route(evalCase.subjectId, corpus, evalCase.query);
  const actual = composeAnswer(routed);
  const mismatch = describeMismatch(evalCase.expected, actual);
  return { evalCase, actual, passed: mismatch === null, mismatch };
}

export interface EvaluationReport {
  total: number;
  passed: number;
  failed: readonly EvaluationCaseResult[];
}

export function runEvaluationSet(corpus: RetrievalCorpus, cases: readonly EvaluationCase[]): EvaluationReport {
  const results = cases.map((evalCase) => runEvaluationCase(corpus, evalCase));
  return { total: results.length, passed: results.filter((result) => result.passed).length, failed: results.filter((result) => !result.passed) };
}
