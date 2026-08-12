import { describe, expect, it } from 'vitest';
import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';

import {
  InMemoryShareLinkStore,
  MAX_SHARE_LINK_TTL_SECONDS,
  ShareLinkError,
  ShareLinkNotActiveError,
  UntrustedObservationError,
  buildFhirExportBundle,
  isShareLinkActive,
  issueShareLink,
  resolveSharedBundle,
  revokeShareLink,
  toFhirDocumentReference,
  toFhirObservation,
  type FhirObservation,
} from './index';

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

describe('toFhirDocumentReference', () => {
  it('maps a document without asserting a document-type code', () => {
    const resource = toFhirDocumentReference(makeDocument());
    expect(resource).toEqual({
      resourceType: 'DocumentReference',
      id: 'doc-1',
      status: 'current',
      type: { text: 'LAB_REPORT' },
      subject: { reference: 'Patient/user-1' },
      date: '2026-03-01',
      content: [{ attachment: { contentType: 'image/jpeg', title: 'Creatinine panel', size: 1024 } }],
    });
  });

  it('falls back to capture date when the care-event date is unknown', () => {
    const resource = toFhirDocumentReference(makeDocument({ documentDate: null }));
    expect(resource.date).toBe('2026-03-02T10:00:00.000Z');
  });
});

describe('toFhirObservation', () => {
  it('refuses to map a DRAFT observation', () => {
    expect(() => toFhirObservation(makeObservation({ status: 'DRAFT' }))).toThrow(UntrustedObservationError);
  });

  it('refuses to map a REJECTED observation', () => {
    expect(() => toFhirObservation(makeObservation({ status: 'REJECTED' }))).toThrow(UntrustedObservationError);
  });

  it('maps a numeric CONFIRMED observation to a Quantity value', () => {
    const resource = toFhirObservation(makeObservation());
    expect(resource.status).toBe('final');
    expect(resource.valueQuantity).toEqual({ value: 1.1, unit: 'mg/dL' });
    expect(resource.valueString).toBeUndefined();
    expect(resource.code.coding).toEqual([{ system: 'http://loinc.org', code: '2160-0', display: 'Creatinine' }]);
    expect(resource.derivedFrom).toEqual([{ reference: 'DocumentReference/doc-1' }]);
  });

  it('marks CORRECTED status distinctly from CONFIRMED', () => {
    const resource = toFhirObservation(makeObservation({ status: 'CORRECTED', provenance: 'PATIENT_REPORTED' }));
    expect(resource.status).toBe('corrected');
  });

  it('falls back to a string value for non-numeric results', () => {
    const resource = toFhirObservation(makeObservation({ value: 'Trace', unit: null, referenceRange: null }));
    expect(resource.valueQuantity).toBeUndefined();
    expect(resource.valueString).toBe('Trace');
  });

  it('maps a local code system to a URN, never a borrowed real one', () => {
    const resource = toFhirObservation(makeObservation({ codeSystem: 'LOCAL', code: 'haemoglobin' }));
    expect(resource.code.coding?.[0]?.system).toBe('urn:mero-health:local-code');
  });

  it('omits interpretation when no abnormal flag is present', () => {
    const resource = toFhirObservation(makeObservation({ abnormalFlag: null }));
    expect(resource.interpretation).toBeUndefined();
  });

  it('maps CRITICAL to the direction-agnostic "critical abnormal" code, not a guessed high/low', () => {
    const resource = toFhirObservation(makeObservation({ abnormalFlag: 'CRITICAL' }));
    expect(resource.interpretation).toEqual([
      {
        coding: [
          { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'AA', display: 'CRITICAL' },
        ],
      },
    ]);
  });

  it('omits effectiveDateTime when the source document gives no date', () => {
    const resource = toFhirObservation(makeObservation({ effectiveAt: null }));
    expect(resource.effectiveDateTime).toBeUndefined();
  });
});

describe('buildFhirExportBundle', () => {
  it('includes every non-deleted document but only trusted observations', () => {
    const documents = [makeDocument(), makeDocument({ id: 'doc-2', status: 'DELETED' })];
    const observations = [
      makeObservation({ id: 'obs-draft', status: 'DRAFT' }),
      makeObservation({ id: 'obs-confirmed', status: 'CONFIRMED' }),
      makeObservation({ id: 'obs-rejected', status: 'REJECTED' }),
    ];

    const bundle = buildFhirExportBundle(documents, observations, '2026-04-01T00:00:00.000Z');

    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.timestamp).toBe('2026-04-01T00:00:00.000Z');
    const documentEntries = bundle.entry.filter((entry) => entry.resource.resourceType === 'DocumentReference');
    expect(documentEntries).toHaveLength(1);
    expect(documentEntries[0]?.resource.id).toBe('doc-1');

    const observationEntries = bundle.entry.filter((entry) => entry.resource.resourceType === 'Observation');
    expect(observationEntries).toHaveLength(1);
    expect((observationEntries[0]?.resource as FhirObservation).id).toBe('obs-confirmed');
  });

  it('drops a trusted observation whose document was deleted', () => {
    const documents = [makeDocument({ status: 'DELETED' })];
    const observations = [makeObservation({ status: 'CONFIRMED' })];

    const bundle = buildFhirExportBundle(documents, observations, '2026-04-01T00:00:00.000Z');
    expect(bundle.entry).toHaveLength(0);
  });
});

describe('issueShareLink', () => {
  it('sets expiresAt to createdAt + ttlSeconds', () => {
    const link = issueShareLink({
      id: 'link-1',
      token: 'tok-1',
      ownerId: 'user-1',
      documentIds: ['doc-1'],
      createdAt: '2026-04-01T00:00:00.000Z',
      ttlSeconds: 3600,
    });
    expect(link.expiresAt).toBe('2026-04-01T01:00:00.000Z');
    expect(link.revokedAt).toBeNull();
  });

  it('refuses an empty scope', () => {
    expect(() =>
      issueShareLink({
        id: 'link-1',
        token: 'tok-1',
        ownerId: 'user-1',
        documentIds: [],
        createdAt: '2026-04-01T00:00:00.000Z',
        ttlSeconds: 3600,
      }),
    ).toThrow(ShareLinkError);
  });

  it('refuses a non-positive time limit', () => {
    expect(() =>
      issueShareLink({
        id: 'link-1',
        token: 'tok-1',
        ownerId: 'user-1',
        documentIds: ['doc-1'],
        createdAt: '2026-04-01T00:00:00.000Z',
        ttlSeconds: 0,
      }),
    ).toThrow(ShareLinkError);
  });

  it('refuses a time limit past the 30-day ceiling, so a "time-limited" link cannot become permanent', () => {
    expect(() =>
      issueShareLink({
        id: 'link-1',
        token: 'tok-1',
        ownerId: 'user-1',
        documentIds: ['doc-1'],
        createdAt: '2026-04-01T00:00:00.000Z',
        ttlSeconds: MAX_SHARE_LINK_TTL_SECONDS + 1,
      }),
    ).toThrow(ShareLinkError);
  });

  it('accepts a time limit exactly at the ceiling', () => {
    const link = issueShareLink({
      id: 'link-1',
      token: 'tok-1',
      ownerId: 'user-1',
      documentIds: ['doc-1'],
      createdAt: '2026-04-01T00:00:00.000Z',
      ttlSeconds: MAX_SHARE_LINK_TTL_SECONDS,
    });
    expect(link.expiresAt).toBe('2026-05-01T00:00:00.000Z');
  });
});

describe('isShareLinkActive / revokeShareLink', () => {
  const link = issueShareLink({
    id: 'link-1',
    token: 'tok-1',
    ownerId: 'user-1',
    documentIds: ['doc-1'],
    createdAt: '2026-04-01T00:00:00.000Z',
    ttlSeconds: 3600,
  });

  it('is active before expiry and not revoked', () => {
    expect(isShareLinkActive(link, '2026-04-01T00:30:00.000Z')).toBe(true);
  });

  it('is inactive after expiry', () => {
    expect(isShareLinkActive(link, '2026-04-01T02:00:00.000Z')).toBe(false);
  });

  it('is inactive once revoked, even before the original expiry', () => {
    const revoked = revokeShareLink(link, '2026-04-01T00:10:00.000Z');
    expect(isShareLinkActive(revoked, '2026-04-01T00:20:00.000Z')).toBe(false);
  });

  it('revocation is idempotent — a second revoke keeps the first timestamp', () => {
    const once = revokeShareLink(link, '2026-04-01T00:10:00.000Z');
    const twice = revokeShareLink(once, '2026-04-01T00:20:00.000Z');
    expect(twice.revokedAt).toBe('2026-04-01T00:10:00.000Z');
  });
});

describe('resolveSharedBundle', () => {
  const documents = [makeDocument({ id: 'doc-1' }), makeDocument({ id: 'doc-2', title: 'Unrelated scan' })];
  const observations = [
    makeObservation({ id: 'obs-1', documentId: 'doc-1' }),
    makeObservation({ id: 'obs-2', documentId: 'doc-2' }),
  ];
  const link = issueShareLink({
    id: 'link-1',
    token: 'tok-1',
    ownerId: 'user-1',
    documentIds: ['doc-1'],
    createdAt: '2026-04-01T00:00:00.000Z',
    ttlSeconds: 3600,
  });

  it('scopes the bundle to only the linked documents, not the owner\'s whole record', () => {
    const bundle = resolveSharedBundle(link, '2026-04-01T00:10:00.000Z', documents, observations);
    const ids = bundle.entry.map((entry) => entry.resource.id);
    expect(ids).toContain('doc-1');
    expect(ids).toContain('obs-1');
    expect(ids).not.toContain('doc-2');
    expect(ids).not.toContain('obs-2');
  });

  it('refuses to resolve an expired link', () => {
    expect(() => resolveSharedBundle(link, '2026-04-01T02:00:00.000Z', documents, observations)).toThrow(
      ShareLinkNotActiveError,
    );
  });

  it('refuses to resolve a revoked link', () => {
    const revoked = revokeShareLink(link, '2026-04-01T00:05:00.000Z');
    expect(() => resolveSharedBundle(revoked, '2026-04-01T00:10:00.000Z', documents, observations)).toThrow(
      ShareLinkNotActiveError,
    );
  });

  it('never leaks another owner\'s document even if it were mistakenly passed in', () => {
    const otherOwnerDoc = makeDocument({ id: 'doc-1', ownerId: 'someone-else' });
    const bundle = resolveSharedBundle(link, '2026-04-01T00:10:00.000Z', [otherOwnerDoc], observations);
    expect(bundle.entry).toHaveLength(0);
  });
});

describe('InMemoryShareLinkStore', () => {
  it('saves and finds a link by token', async () => {
    const store = new InMemoryShareLinkStore();
    const link = issueShareLink({
      id: 'link-1',
      token: 'tok-1',
      ownerId: 'user-1',
      documentIds: ['doc-1'],
      createdAt: '2026-04-01T00:00:00.000Z',
      ttlSeconds: 3600,
    });
    await store.save(link);
    await expect(store.findByToken('tok-1')).resolves.toEqual(link);
    await expect(store.findByToken('unknown')).resolves.toBeNull();
  });

  it('lists only active links for an owner', async () => {
    const store = new InMemoryShareLinkStore();
    const active = issueShareLink({
      id: 'link-1',
      token: 'tok-1',
      ownerId: 'user-1',
      documentIds: ['doc-1'],
      createdAt: '2026-04-01T00:00:00.000Z',
      ttlSeconds: 3600,
    });
    const expired = issueShareLink({
      id: 'link-2',
      token: 'tok-2',
      ownerId: 'user-1',
      documentIds: ['doc-1'],
      createdAt: '2026-01-01T00:00:00.000Z',
      ttlSeconds: 1,
    });
    const otherOwner = issueShareLink({
      id: 'link-3',
      token: 'tok-3',
      ownerId: 'user-2',
      documentIds: ['doc-9'],
      createdAt: '2026-04-01T00:00:00.000Z',
      ttlSeconds: 3600,
    });
    await store.save(active);
    await store.save(expired);
    await store.save(otherOwner);

    const listed = await store.listActive('user-1', '2026-04-01T00:10:00.000Z');
    expect(listed.map((link) => link.id)).toEqual(['link-1']);
  });
});
