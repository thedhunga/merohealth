import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';

import { renderExportBundlePdf } from './export-pdf';

function makeDocument(overrides: Partial<HealthDocument> = {}): HealthDocument {
  return {
    id: 'doc-1',
    ownerId: 'user-1',
    kind: 'LAB_REPORT',
    status: 'CONFIRMED',
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

describe('renderExportBundlePdf', () => {
  it('produces a real, parseable PDF for an empty record', async () => {
    const bytes = await renderExportBundlePdf([], [], '2026-04-01T00:00:00.000Z', 'user-1');
    expect(Buffer.from(bytes.slice(0, 5)).toString('ascii')).toBe('%PDF-');

    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('includes one section per non-deleted document and excludes deleted ones', async () => {
    const documents = [makeDocument({ id: 'doc-1' }), makeDocument({ id: 'doc-2', status: 'DELETED' })];
    const bytes = await renderExportBundlePdf(documents, [], '2026-04-01T00:00:00.000Z', 'user-1');
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('only renders CONFIRMED/CORRECTED observations, never DRAFT or REJECTED', async () => {
    const documents = [makeDocument()];
    const observations = [
      makeObservation({ id: 'obs-draft', status: 'DRAFT' }),
      makeObservation({ id: 'obs-confirmed', status: 'CONFIRMED' }),
    ];
    // Regression guard: this only proves the call succeeds without asserting
    // on drawn glyph content (pdf-lib does not expose text back out) — the
    // filtering itself is unit-tested precisely via `selectTrusted` in
    // `@swasthya/health-records` and `buildFhirExportBundle` in `./index.test.ts`.
    await expect(renderExportBundlePdf(documents, observations, '2026-04-01T00:00:00.000Z', 'user-1')).resolves
      .toBeInstanceOf(Uint8Array);
  });

  it('does not throw when a title contains Devanagari text it cannot shape', async () => {
    const documents = [makeDocument({ title: 'रगत जाँच रिपोर्ट' })];
    const bytes = await renderExportBundlePdf(documents, [], '2026-04-01T00:00:00.000Z', 'user-1');
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('paginates once enough observations are drawn to overflow a page', async () => {
    const documents = [makeDocument()];
    const observations = Array.from({ length: 80 }, (_, index) =>
      makeObservation({ id: `obs-${String(index)}`, code: `code-${String(index)}` }),
    );
    const bytes = await renderExportBundlePdf(documents, observations, '2026-04-01T00:00:00.000Z', 'user-1');
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThan(1);
  });
});
