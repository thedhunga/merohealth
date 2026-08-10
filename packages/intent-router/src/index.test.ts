import { describe, expect, it } from 'vitest';
import type { HealthObservation } from '@swasthya/shared-types';
import type { Citation } from '@swasthya/retrieval';

import { citationTarget, classifyIntent, composeAnswer, route } from './index';
import type { RoutedAnswer } from './index';

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

describe('classifyIntent', () => {
  it('routes an advice question to ADVICE even with no clinical concept in it', () => {
    expect(classifyIntent('मलाई के गर्ने?')).toEqual({ intent: 'ADVICE', matchedConcepts: [] });
  });

  it('routes a query with no recognised concept to UNSUPPORTED', () => {
    expect(classifyIntent('when is my next appointment')).toEqual({ intent: 'UNSUPPORTED', matchedConcepts: [] });
  });

  it('routes a "what is X" question to DEFINITION', () => {
    const result = classifyIntent('थाइरोइड के हो?');
    expect(result.intent).toBe('DEFINITION');
    expect(result.matchedConcepts).toContain('thyroid');
  });

  it('routes a comparative question to COMPARISON', () => {
    const result = classifyIntent('मेरो चिनी अघिल्लो पटक भन्दा बढ्यो कि घट्यो?');
    expect(result.intent).toBe('COMPARISON');
    expect(result.matchedConcepts).toContain('glucose');
  });

  it('routes a "what is it right now" question to LATEST_VALUE', () => {
    const result = classifyIntent('मेरो चिनी अहिले कति छ?');
    expect(result.intent).toBe('LATEST_VALUE');
    expect(result.matchedConcepts).toContain('glucose');
  });

  it('prefers TREND over LATEST_VALUE when both markers are present', () => {
    // "अहिले" (latest) and "कस्तो" (trend) together — the design doc's own
    // worked example ("मेरो creatinine कस्तो छ?") is a trend question, so a
    // trend marker should win the ambiguity rather than latest-value.
    const result = classifyIntent('मेरो चिनी अहिले कस्तो छ?');
    expect(result.intent).toBe('TREND');
  });

  it('defaults a recognised concept with no other question-form marker to TREND', () => {
    const result = classifyIntent('मेरो चिनी कस्तो छ?');
    expect(result.intent).toBe('TREND');
    expect(result.matchedConcepts).toContain('glucose');
  });
});

describe('route', () => {
  it('computes a TREND answer from buildAnalyteTrend rather than generating one', () => {
    const result = route(
      'subject-1',
      {
        observations: [
          makeObservation({ id: 'obs-old', effectiveAt: '2026-01-01', value: '150' }),
          makeObservation({ id: 'obs-new', effectiveAt: '2026-03-01', value: '95' }),
        ],
        documents: [],
      },
      'मेरो चिनी कस्तो छ?',
    );

    expect(result.path).toBe('COMPUTED');
    if (result.path !== 'COMPUTED') throw new Error('unreachable');
    expect(result.intent).toBe('TREND');
    expect(result.trends).toHaveLength(1);
    expect(result.trends[0]?.trend.code).toBe('1558-6');
    expect(result.trends[0]?.trend.direction).toBe('FALLING');
    expect(result.trends[0]?.trend.points.map((p) => p.value)).toEqual([150, 95]);
  });

  it('orders citations oldest-first to match trend.points', () => {
    const result = route(
      'subject-1',
      {
        observations: [
          makeObservation({ id: 'obs-old', effectiveAt: '2026-01-01' }),
          makeObservation({ id: 'obs-new', effectiveAt: '2026-03-01' }),
        ],
        documents: [],
      },
      'चिनी',
    );

    if (result.path !== 'COMPUTED') throw new Error('unreachable');
    expect(result.trends[0]?.citations.map((c) => c.sourceId)).toEqual(['obs-old', 'obs-new']);
  });

  it('tags the same computed trend as LATEST_VALUE when the question asks for the current reading', () => {
    const result = route('subject-1', { observations: [makeObservation()], documents: [] }, 'मेरो चिनी अहिले कति छ?');

    expect(result.path).toBe('COMPUTED');
    if (result.path !== 'COMPUTED') throw new Error('unreachable');
    expect(result.intent).toBe('LATEST_VALUE');
  });

  it('never lets an advice question reach buildAnalyteTrend', () => {
    const result = route('subject-1', { observations: [makeObservation()], documents: [] }, 'मलाई के गर्ने?');

    expect(result).toEqual({
      path: 'NOT_COMPUTABLE',
      intent: 'ADVICE',
      matchedConcepts: [],
      unconfirmedDraftsOnly: false,
    });
  });

  it('is NOT_COMPUTABLE for a computable intent when the record has nothing trusted matching it', () => {
    const result = route(
      'subject-1',
      { observations: [makeObservation({ code: '3016-3', labelNe: 'थाइरोइड', labelEn: 'thyroid' })], documents: [] },
      'मेरो मुटु कस्तो छ?',
    );

    expect(result).toEqual({
      path: 'NOT_COMPUTABLE',
      intent: 'TREND',
      matchedConcepts: ['heart'],
      unconfirmedDraftsOnly: false,
    });
  });

  it('never computes a trend from another subject observation, even one matching the same code and query', () => {
    const result = route(
      'subject-1',
      {
        observations: [
          makeObservation({ id: 'obs-mine', ownerId: 'subject-1', effectiveAt: '2026-01-01' }),
          makeObservation({ id: 'obs-not-mine', ownerId: 'subject-2', effectiveAt: '2026-03-01', value: '999' }),
        ],
        documents: [],
      },
      'चिनी',
    );

    if (result.path !== 'COMPUTED') throw new Error('unreachable');
    expect(result.trends[0]?.trend.points).toHaveLength(1);
    expect(result.trends[0]?.citations.map((c) => c.sourceId)).toEqual(['obs-mine']);
  });

  it('never computes a trend from a DRAFT observation, and flags it as the unconfirmed-drafts-only case', () => {
    const result = route(
      'subject-1',
      {
        observations: [makeObservation({ id: 'obs-draft', status: 'DRAFT' })],
        documents: [],
      },
      'मेरो चिनी कस्तो छ?',
    );

    expect(result).toEqual({
      path: 'NOT_COMPUTABLE',
      intent: 'TREND',
      matchedConcepts: ['glucose'],
      unconfirmedDraftsOnly: true,
    });
  });

  it('returns one trend per distinct analyte code when a broad concept matches more than one', () => {
    const result = route(
      'subject-1',
      {
        observations: [
          makeObservation({ id: 'obs-fasting', code: '1558-6', labelNe: 'उपवास रक्त शर्करा', labelEn: 'Fasting Glucose' }),
          makeObservation({
            id: 'obs-a1c',
            code: '4548-4',
            labelNe: 'एचबीए१सी (औसत रक्त शर्करा)',
            labelEn: 'Hemoglobin A1c',
          }),
        ],
        documents: [],
      },
      'चिनी',
    );

    if (result.path !== 'COMPUTED') throw new Error('unreachable');
    expect(result.trends.map((t) => t.trend.code).sort()).toEqual(['1558-6', '4548-4']);
  });
});

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    sourceType: 'OBSERVATION',
    sourceId: 'obs-1',
    documentId: 'doc-1',
    labelNe: 'उपवास रक्त शर्करा',
    labelEn: 'Fasting Glucose',
    effectiveAt: '2026-03-01',
    ...overrides,
  };
}

describe('citationTarget', () => {
  it('resolves an observation citation to its document, with the observation set to scroll to', () => {
    const citation = makeCitation({ sourceType: 'OBSERVATION', sourceId: 'obs-1', documentId: 'doc-1' });
    expect(citationTarget(citation)).toEqual({ kind: 'OBSERVATION', documentId: 'doc-1', observationId: 'obs-1' });
  });

  it('resolves a document citation to just the document, with no observation to highlight', () => {
    const citation = makeCitation({ sourceType: 'DOCUMENT', sourceId: 'doc-1', documentId: 'doc-1' });
    expect(citationTarget(citation)).toEqual({ kind: 'DOCUMENT', documentId: 'doc-1', observationId: null });
  });
});

describe('composeAnswer', () => {
  it('turns a NOT_COMPUTABLE routed answer into a refusal, passing the intent and matched concepts through', () => {
    const routed: RoutedAnswer = {
      path: 'NOT_COMPUTABLE',
      intent: 'ADVICE',
      matchedConcepts: [],
      unconfirmedDraftsOnly: false,
    };
    expect(composeAnswer(routed)).toEqual({
      path: 'REFUSAL',
      intent: 'ADVICE',
      matchedConcepts: [],
      reason: 'NOT_UNDERSTOOD',
      concepts: [],
    });
  });

  it('names the reason NO_MATCHING_RECORD, with a resolved concept label, when a concept was recognised but nothing in the record matches', () => {
    const routed: RoutedAnswer = {
      path: 'NOT_COMPUTABLE',
      intent: 'TREND',
      matchedConcepts: ['thyroid'],
      unconfirmedDraftsOnly: false,
    };
    expect(composeAnswer(routed)).toEqual({
      path: 'REFUSAL',
      intent: 'TREND',
      matchedConcepts: ['thyroid'],
      reason: 'NO_MATCHING_RECORD',
      concepts: [{ concept: 'thyroid', labelNe: 'थाइरोइड', labelEn: 'thyroid' }],
    });
  });

  it('names the reason UNCONFIRMED_DRAFTS_ONLY, pointing at the confirmation queue, when only a draft observation matched', () => {
    const routed: RoutedAnswer = {
      path: 'NOT_COMPUTABLE',
      intent: 'LATEST_VALUE',
      matchedConcepts: ['glucose'],
      unconfirmedDraftsOnly: true,
    };
    const answer = composeAnswer(routed);
    expect(answer).toEqual({
      path: 'REFUSAL',
      intent: 'LATEST_VALUE',
      matchedConcepts: ['glucose'],
      reason: 'UNCONFIRMED_DRAFTS_ONLY',
      concepts: [{ concept: 'glucose', labelNe: 'चिनी', labelEn: 'glucose' }],
    });
  });

  it('end-to-end: a DRAFT-only match through route() composes to the unconfirmed-drafts refusal', () => {
    const routed = route(
      'subject-1',
      { observations: [makeObservation({ id: 'obs-draft', status: 'DRAFT' })], documents: [] },
      'मेरो चिनी कस्तो छ?',
    );
    expect(composeAnswer(routed)).toEqual({
      path: 'REFUSAL',
      intent: 'TREND',
      matchedConcepts: ['glucose'],
      reason: 'UNCONFIRMED_DRAFTS_ONLY',
      concepts: [{ concept: 'glucose', labelNe: 'चिनी', labelEn: 'glucose' }],
    });
  });

  it('turns a real COMPUTED answer into cited claims with a tap-through target per citation', () => {
    const routed = route(
      'subject-1',
      {
        observations: [
          makeObservation({ id: 'obs-old', effectiveAt: '2026-01-01', value: '150' }),
          makeObservation({ id: 'obs-new', effectiveAt: '2026-03-01', value: '95' }),
        ],
        documents: [],
      },
      'मेरो चिनी कस्तो छ?',
    );

    const answer = composeAnswer(routed);
    if (answer.path !== 'ANSWERED') throw new Error('unreachable');
    expect(answer.claims).toHaveLength(1);
    const claim = answer.claims[0];
    expect(claim?.citations).toHaveLength(2);
    expect(claim?.targets).toEqual([
      { kind: 'OBSERVATION', documentId: 'doc-1', observationId: 'obs-old' },
      { kind: 'OBSERVATION', documentId: 'doc-1', observationId: 'obs-new' },
    ]);
  });

  it('refuses rather than emit a claim with no citation, even if a future route() regression produced one', () => {
    // Hand-built rather than routed through `route()` on purpose — this
    // proves the invariant holds at `composeAnswer`'s own boundary, not
    // only for whatever `route()` happens to produce today.
    const routed: RoutedAnswer = {
      path: 'COMPUTED',
      intent: 'TREND',
      trends: [
        {
          trend: {
            code: '1558-6',
            labelNe: 'उपवास रक्त शर्करा',
            labelEn: 'Fasting Glucose',
            points: [],
            direction: null,
            units: [],
          },
          citations: [],
        },
      ],
    };

    expect(composeAnswer(routed)).toEqual({
      path: 'REFUSAL',
      intent: 'TREND',
      matchedConcepts: [],
      reason: 'NOTHING_CITABLE',
      concepts: [],
    });
  });

  it('drops only the uncited trend when a broad concept mixes a citable and an uncited analyte', () => {
    const routed: RoutedAnswer = {
      path: 'COMPUTED',
      intent: 'TREND',
      trends: [
        {
          trend: {
            code: '1558-6',
            labelNe: 'उपवास रक्त शर्करा',
            labelEn: 'Fasting Glucose',
            points: [],
            direction: null,
            units: [],
          },
          citations: [],
        },
        {
          trend: {
            code: '4548-4',
            labelNe: 'एचबीए१सी',
            labelEn: 'Hemoglobin A1c',
            points: [],
            direction: null,
            units: [],
          },
          citations: [makeCitation({ sourceId: 'obs-a1c' })],
        },
      ],
    };

    const answer = composeAnswer(routed);
    if (answer.path !== 'ANSWERED') throw new Error('unreachable');
    expect(answer.claims).toHaveLength(1);
    expect(answer.claims[0]?.trend.code).toBe('4548-4');
  });
});
