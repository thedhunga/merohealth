import { describe, expect, it } from 'vitest';
import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';

import { clinicalTermMap, expandQuery, retrieveForSubject } from './index';

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

describe('clinicalTermMap', () => {
  it('gives every concept at least one Nepali and one English surface form', () => {
    for (const term of clinicalTermMap) {
      expect(term.ne.length, term.concept).toBeGreaterThan(0);
      expect(term.en.length, term.concept).toBeGreaterThan(0);
    }
  });

  it('has no duplicate concept ids', () => {
    const concepts = clinicalTermMap.map((term) => term.concept);
    expect(new Set(concepts).size).toBe(concepts.length);
  });
});

describe('expandQuery', () => {
  it('expands a colloquial Nepali term to the formal Nepali, romanized, and English forms', () => {
    const expansion = expandQuery('चिनी बढी छ?');

    expect(expansion.matchedConcepts).toContain('glucose');
    expect(expansion.terms).toContain('glucose');
    expect(expansion.terms).toContain('blood sugar');
    expect(expansion.terms).toContain('रक्त शर्करा');
  });

  it('expands from romanized Nepali the same way as from Devanagari', () => {
    const expansion = expandQuery('mero chini kati cha');

    expect(expansion.matchedConcepts).toContain('glucose');
    expect(expansion.terms).toContain('चिनी');
  });

  it('expands from English to the Nepali term the design doc names as the worked example', () => {
    const expansion = expandQuery('how is my kidney doing');

    expect(expansion.matchedConcepts).toContain('kidney');
    expect(expansion.terms).toContain('मिर्गौला');
    expect(expansion.terms).toContain('renal');
  });

  it('does not fire a short term inside an unrelated word', () => {
    const expansion = expandQuery('I need a database backup plan');

    expect(expansion.matchedConcepts).not.toContain('bloodPressure');
  });

  it('still matches the raw query when nothing in the term map applies', () => {
    const expansion = expandQuery('when is my next appointment');

    expect(expansion.matchedConcepts).toEqual([]);
    expect(expansion.terms).toEqual(['when is my next appointment']);
  });

  it('produces no terms for an empty query', () => {
    expect(expandQuery('   ').terms).toEqual([]);
  });
});

describe('retrieveForSubject', () => {
  it('retrieves an observation labelled in English when the query is colloquial Nepali', () => {
    const result = retrieveForSubject(
      'subject-1',
      { observations: [makeObservation()], documents: [] },
      'चिनी बढी छ कि छैन?',
    );

    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]?.observation.id).toBe('obs-1');
    expect(result.observations[0]?.citation).toEqual({
      sourceType: 'OBSERVATION',
      sourceId: 'obs-1',
      documentId: 'doc-1',
      labelNe: 'उपवास रक्त शर्करा',
      labelEn: 'Fasting Glucose',
      effectiveAt: '2026-03-01',
    });
  });

  it('matches a document by title in the query language', () => {
    const result = retrieveForSubject(
      'subject-1',
      { observations: [], documents: [makeDocument()] },
      'मिर्गौला रिपोर्ट हेर्नुपर्यो',
    );

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]?.document.id).toBe('doc-1');
  });

  it('never returns another subject observation, even when it is sitting in the same corpus', () => {
    const result = retrieveForSubject(
      'subject-1',
      {
        observations: [
          makeObservation({ id: 'obs-mine', ownerId: 'subject-1' }),
          makeObservation({ id: 'obs-not-mine', ownerId: 'subject-2' }),
        ],
        documents: [],
      },
      'चिनी',
    );

    expect(result.observations.map((r) => r.observation.id)).toEqual(['obs-mine']);
  });

  it('never returns another subject document, even when it is sitting in the same corpus', () => {
    const result = retrieveForSubject(
      'subject-1',
      {
        observations: [],
        documents: [
          makeDocument({ id: 'doc-mine', ownerId: 'subject-1' }),
          makeDocument({ id: 'doc-not-mine', ownerId: 'subject-2' }),
        ],
      },
      'kidney',
    );

    expect(result.documents.map((r) => r.document.id)).toEqual(['doc-mine']);
  });

  it('never returns a DRAFT or REJECTED observation, matching label or not', () => {
    const result = retrieveForSubject(
      'subject-1',
      {
        observations: [
          makeObservation({ id: 'obs-draft', status: 'DRAFT' }),
          makeObservation({ id: 'obs-rejected', status: 'REJECTED' }),
          makeObservation({ id: 'obs-confirmed', status: 'CONFIRMED' }),
        ],
        documents: [],
      },
      'glucose',
    );

    expect(result.observations.map((r) => r.observation.id)).toEqual(['obs-confirmed']);
  });

  it('excludes a deleted document', () => {
    const result = retrieveForSubject(
      'subject-1',
      { observations: [], documents: [makeDocument({ status: 'DELETED' })] },
      'kidney',
    );

    expect(result.documents).toEqual([]);
  });

  it('returns nothing for a subject with no relevant record, as a refusal signal upstream can act on', () => {
    const result = retrieveForSubject(
      'subject-1',
      { observations: [makeObservation()], documents: [] },
      'thyroid',
    );

    expect(result.observations).toEqual([]);
  });

  it('orders matches most-recent-first, undated last', () => {
    const result = retrieveForSubject(
      'subject-1',
      {
        observations: [
          makeObservation({ id: 'obs-old', effectiveAt: '2025-01-01' }),
          makeObservation({ id: 'obs-new', effectiveAt: '2026-06-01' }),
          makeObservation({ id: 'obs-undated', effectiveAt: null }),
        ],
        documents: [],
      },
      'glucose',
    );

    expect(result.observations.map((r) => r.observation.id)).toEqual(['obs-new', 'obs-old', 'obs-undated']);
  });
});
