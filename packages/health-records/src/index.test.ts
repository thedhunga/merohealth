import { describe, expect, it } from 'vitest';
import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';

import {
  DocumentTransitionError,
  LOW_CONFIDENCE_THRESHOLD,
  buildAnalyteTrend,
  buildTimeline,
  canTransition,
  confirmObservation,
  correctObservation,
  isLowConfidence,
  isTrusted,
  pendingConfirmations,
  rejectObservation,
  transitionDocument,
} from './index';

function makeDocument(overrides: Partial<HealthDocument> = {}): HealthDocument {
  return {
    id: 'doc-1',
    ownerId: 'user-1',
    kind: 'LAB_REPORT',
    status: 'STORED',
    ref: {
      backend: 'HOSTED',
      externalId: 'hosted-1',
      byteSize: 1024,
      contentType: 'image/jpeg',
      checksumSha256: 'abc123',
    },
    title: 'Creatinine panel',
    documentDate: '2026-03-01',
    capturedAt: '2026-03-02T10:00:00.000Z',
    sensitivity: 'STANDARD',
    clientEncrypted: false,
    pageCount: 1,
    ...overrides,
  };
}

function makeObservation(overrides: Partial<HealthObservation> = {}): HealthObservation {
  return {
    id: 'obs-1',
    documentId: 'doc-1',
    ownerId: 'user-1',
    code: '2160-0',
    codeSystem: 'LOINC',
    labelNe: 'क्रिएटिनिन',
    labelEn: 'Creatinine',
    value: '1.1',
    unit: 'mg/dL',
    referenceRange: '0.7-1.3',
    abnormalFlag: 'NORMAL',
    effectiveAt: '2026-01-01',
    status: 'CONFIRMED',
    provenance: 'DOCUMENT_EXTRACTED',
    confidence: 0.95,
    extractionRunId: 'run-1',
    ...overrides,
  };
}

describe('document lifecycle', () => {
  it('permits the normal capture-to-confirmed path', () => {
    expect(canTransition('CAPTURED', 'UPLOADING')).toBe(true);
    expect(canTransition('UPLOADING', 'STORED')).toBe(true);
    expect(canTransition('STORED', 'EXTRACTING')).toBe(true);
    expect(canTransition('EXTRACTING', 'AWAITING_CONFIRMATION')).toBe(true);
    expect(canTransition('AWAITING_CONFIRMATION', 'CONFIRMED')).toBe(true);
  });

  it('allows storing without extraction, for encrypted bring-your-own documents', () => {
    expect(canTransition('STORED', 'CONFIRMED')).toBe(true);
  });

  it('treats deletion as terminal', () => {
    expect(canTransition('DELETED', 'STORED')).toBe(false);
    expect(canTransition('DELETED', 'CONFIRMED')).toBe(false);
  });

  it('rejects a skipped step', () => {
    expect(canTransition('CAPTURED', 'CONFIRMED')).toBe(false);
    expect(() => transitionDocument(makeDocument({ status: 'CAPTURED' }), 'CONFIRMED')).toThrow(
      DocumentTransitionError,
    );
  });

  it('returns a new document rather than mutating', () => {
    const document = makeDocument({ status: 'STORED' });
    const next = transitionDocument(document, 'EXTRACTING');

    expect(next.status).toBe('EXTRACTING');
    expect(document.status).toBe('STORED');
  });
});

describe('confirmation semantics', () => {
  it('flags extractions below the confidence threshold', () => {
    expect(isLowConfidence(makeObservation({ confidence: 0.4 }))).toBe(true);
    expect(isLowConfidence(makeObservation({ confidence: 0.99 }))).toBe(false);
    expect(isLowConfidence(makeObservation({ confidence: LOW_CONFIDENCE_THRESHOLD }))).toBe(false);
  });

  it('does not flag values that never came from an extractor', () => {
    expect(isLowConfidence(makeObservation({ confidence: null }))).toBe(false);
  });

  it('trusts only confirmed and corrected observations', () => {
    expect(isTrusted(makeObservation({ status: 'CONFIRMED' }))).toBe(true);
    expect(isTrusted(makeObservation({ status: 'CORRECTED' }))).toBe(true);
    expect(isTrusted(makeObservation({ status: 'DRAFT' }))).toBe(false);
    expect(isTrusted(makeObservation({ status: 'REJECTED' }))).toBe(false);
  });

  it('re-attributes a corrected value to the patient and clears confidence', () => {
    const corrected = correctObservation(makeObservation({ status: 'DRAFT' }), '2.4');

    expect(corrected.value).toBe('2.4');
    expect(corrected.status).toBe('CORRECTED');
    expect(corrected.provenance).toBe('PATIENT_REPORTED');
    expect(corrected.confidence).toBeNull();
  });

  it('keeps confirmation and rejection distinct', () => {
    expect(confirmObservation(makeObservation({ status: 'DRAFT' })).status).toBe('CONFIRMED');
    expect(rejectObservation(makeObservation({ status: 'DRAFT' })).status).toBe('REJECTED');
  });

  it('queues the least confident drafts first', () => {
    const queue = pendingConfirmations([
      makeObservation({ id: 'a', status: 'DRAFT', confidence: 0.9 }),
      makeObservation({ id: 'b', status: 'DRAFT', confidence: 0.3 }),
      makeObservation({ id: 'c', status: 'CONFIRMED', confidence: 0.1 }),
    ]);

    expect(queue.map((observation) => observation.id)).toEqual(['b', 'a']);
  });
});

describe('buildAnalyteTrend', () => {
  const series = [
    makeObservation({ id: 'o1', value: '1.0', effectiveAt: '2026-01-01', documentId: 'd1' }),
    makeObservation({ id: 'o3', value: '1.8', effectiveAt: '2026-03-01', documentId: 'd3' }),
    makeObservation({ id: 'o2', value: '1.4', effectiveAt: '2026-02-01', documentId: 'd2' }),
  ];

  it('orders points chronologically regardless of input order', () => {
    const trend = buildAnalyteTrend(series, '2160-0');
    expect(trend?.points.map((point) => point.value)).toEqual([1.0, 1.4, 1.8]);
  });

  it('detects a rising series', () => {
    expect(buildAnalyteTrend(series, '2160-0')?.direction).toBe('RISING');
  });

  it('treats small movement as stable', () => {
    const flat = [
      makeObservation({ id: 'o1', value: '1.00', effectiveAt: '2026-01-01' }),
      makeObservation({ id: 'o2', value: '1.02', effectiveAt: '2026-02-01' }),
    ];
    expect(buildAnalyteTrend(flat, '2160-0')?.direction).toBe('STABLE');
  });

  it('excludes unconfirmed drafts from the series', () => {
    const withDraft = [
      makeObservation({ id: 'o1', value: '1.0', effectiveAt: '2026-01-01' }),
      makeObservation({ id: 'o2', value: '9.9', effectiveAt: '2026-02-01', status: 'DRAFT' }),
    ];

    const trend = buildAnalyteTrend(withDraft, '2160-0');
    expect(trend?.points).toHaveLength(1);
  });

  it('withholds a direction when units are mixed', () => {
    const mixed = [
      makeObservation({ id: 'o1', value: '1.0', unit: 'mg/dL', effectiveAt: '2026-01-01' }),
      makeObservation({ id: 'o2', value: '88', unit: 'umol/L', effectiveAt: '2026-02-01' }),
    ];

    const trend = buildAnalyteTrend(mixed, '2160-0');
    expect(trend?.units).toHaveLength(2);
    expect(trend?.direction).toBeNull();
  });

  it('drops non-numeric values rather than coercing them', () => {
    const messy = [
      makeObservation({ id: 'o1', value: 'not detected', effectiveAt: '2026-01-01' }),
      makeObservation({ id: 'o2', value: '1.2', effectiveAt: '2026-02-01' }),
    ];

    expect(buildAnalyteTrend(messy, '2160-0')?.points).toHaveLength(1);
  });

  it('drops a value that only starts with digits, e.g. a range accidentally entered as the value', () => {
    // `Number.parseFloat` would read "70-99" as 70 — a leading-prefix parse,
    // not a full-string one — and silently insert a wrong data point.
    const messy = [
      makeObservation({ id: 'o1', value: '70-99', effectiveAt: '2026-01-01' }),
      makeObservation({ id: 'o2', value: '1.2', effectiveAt: '2026-02-01' }),
    ];

    expect(buildAnalyteTrend(messy, '2160-0')?.points).toHaveLength(1);
  });

  it('returns null when the analyte is absent', () => {
    expect(buildAnalyteTrend(series, '9999-9')).toBeNull();
  });
});

describe('buildTimeline', () => {
  it('sorts newest first and prefers the care-event date over capture date', () => {
    const documents = [
      makeDocument({ id: 'old', documentDate: '2026-01-01' }),
      makeDocument({ id: 'new', documentDate: '2026-06-01' }),
    ];

    expect(buildTimeline(documents, []).map((entry) => entry.documentId)).toEqual(['new', 'old']);
  });

  it('omits deleted documents', () => {
    const documents = [
      makeDocument({ id: 'kept' }),
      makeDocument({ id: 'gone', status: 'DELETED' }),
    ];

    expect(buildTimeline(documents, [])).toHaveLength(1);
  });

  it('counts trusted and pending observations separately', () => {
    const documents = [makeDocument({ id: 'doc-1' })];
    const observations = [
      makeObservation({ id: 'a', documentId: 'doc-1', status: 'CONFIRMED' }),
      makeObservation({ id: 'b', documentId: 'doc-1', status: 'DRAFT' }),
    ];

    const [entry] = buildTimeline(documents, observations);
    expect(entry?.observationCount).toBe(1);
    expect(entry?.pendingCount).toBe(1);
  });

  it('flags an abnormal result only from trusted observations', () => {
    const documents = [makeDocument({ id: 'doc-1' })];
    const draftAbnormal = [
      makeObservation({ id: 'a', documentId: 'doc-1', status: 'DRAFT', abnormalFlag: 'HIGH' }),
    ];

    expect(buildTimeline(documents, draftAbnormal)[0]?.hasAbnormal).toBe(false);
  });
});
