import { describe, expect, it } from 'vitest';
import type { HealthObservation } from '@swasthya/shared-types';

import { classifyIntent, route } from './index';

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

    expect(result).toEqual({ path: 'NOT_COMPUTABLE', intent: 'ADVICE', matchedConcepts: [] });
  });

  it('is NOT_COMPUTABLE for a computable intent when the record has nothing trusted matching it', () => {
    const result = route(
      'subject-1',
      { observations: [makeObservation({ code: '3016-3', labelNe: 'थाइरोइड', labelEn: 'thyroid' })], documents: [] },
      'मेरो मुटु कस्तो छ?',
    );

    expect(result).toEqual({ path: 'NOT_COMPUTABLE', intent: 'TREND', matchedConcepts: ['heart'] });
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

  it('never computes a trend from a DRAFT observation', () => {
    const result = route(
      'subject-1',
      {
        observations: [makeObservation({ id: 'obs-draft', status: 'DRAFT' })],
        documents: [],
      },
      'मेरो चिनी कस्तो छ?',
    );

    expect(result).toEqual({ path: 'NOT_COMPUTABLE', intent: 'TREND', matchedConcepts: ['glucose'] });
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
