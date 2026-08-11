import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';
import type {
  DeviceMetricKind,
  DeviceSource,
  DirectoryEntityType,
  DocumentStatus,
  HealthDocumentKind,
  ObservationStatus,
  PlanTier,
  QuotaDimension,
  StorageBackend,
} from '@swasthya/shared-types';

// Prisma-only types: shared-types' own `VerificationStatus` is a different
// concept (the identity assurance workflow in packages/identity —
// NOT_STARTED/EVIDENCE_SUBMITTED/...), not the org/directory claim-and-review
// lifecycle (CLAIMED/IMPORTED/.../VERIFIED) the Prisma schema enum tracks.
// `UserRole` has no shared-types equivalent at all yet (no domain package has
// needed account roles — see agent-progress.md Round two A3/A4).
import type { GuardianshipGrounds, UserRole, VerificationStatus } from '../generated/enums.ts';

/** Flat JSON object — enough for this seed's `rules`/`serviceData` blobs and a valid Prisma `Json` input without pulling in Prisma's own JSON input types. */
type SeedJsonObject = Record<string, string | number | boolean | null>;

/**
 * The realistic Nepali demonstration dataset Round two A2 asks for — every
 * later task (retrieval, family/proxy, the launch gate) tests against this
 * rather than hand-rolling its own fixture. Pure data, no `Date.now()` and no
 * database access, so `seed-data.test.ts` can assert its shape without a live
 * Postgres; `prisma/seed.ts` is the thin script that actually applies it.
 *
 * Every id follows `prisma/seed.sql`'s original numeric-prefix convention (one
 * prefix per table) so ids stay traceable to their table at a glance:
 * organizations 1, directory 2, feature flags 3, plans 4, documents 5,
 * observations 6, device samples 7, subscriptions 8, usage counters 9,
 * users a, patient profiles b, guardianship grants c, conditions d.
 */

export interface SeedOrganization {
  id: string;
  type: string;
  name: string;
  nameNe: string;
  verification: VerificationStatus;
  isFictionalDemo: boolean;
}

export interface SeedDirectoryEntity {
  id: string;
  type: DirectoryEntityType;
  name: string;
  nameNe: string;
  verification: VerificationStatus;
  district: string;
  municipality: string;
  serviceData: SeedJsonObject;
  sourceLabel: string;
  dataAsOf: string;
  isFictionalDemo: boolean;
}

export interface SeedFeatureFlag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  rules: SeedJsonObject;
}

export interface SeedPlan {
  id: string;
  code: string;
  name: string;
  audience: string;
  pricing: { currency: string; amount: number };
  active: boolean;
}

/** One row per subject. `id` doubles as the `ownerId`/`patientId` every other table below points at — there is no separate identity layer yet (Round two A3), so this is the closest thing to a real subject id until that lands. */
export interface SeedUser {
  id: string;
  role: UserRole;
  locale: string;
}

export interface SeedPatientProfile {
  id: string;
  userId: string;
  displayName: string;
  demographics: { ageYears: number; sex: 'FEMALE' | 'MALE'; district: string };
}

/**
 * Guardianship over the one minor in the family (Roshani), via
 * `packages/family`'s real `GuardianshipGrant`. This replaces the old
 * `CaregiverRelationship` row (removed in the
 * `drop_caregiver_relationship` migration): that model predated
 * `packages/family` (Round two C) and stored an untyped `relationship`
 * string and `permissions` blob neither the domain package nor anything
 * downstream of it ever reads. `grounds`/`expiresAt` here are what
 * `GuardianshipGrant` actually requires — see
 * `docs/architecture/family-and-proxy.md` §2 on the mandatory expiry.
 *
 * `expiresAt` is Roshani's 18th birthday computed by hand rather than via
 * `packages/family`'s own `guardianshipExpiryForMinor` (this file stays a
 * pure data module with no domain-package import, so `wardBirthYear`
 * exists only as the derivation note below, not as an input this module
 * runs code on) — `wardBirthYear` 2014 is chosen to match
 * `patientProfiles`' own `ageYears: 12` for Roshani against the rest of
 * this seed's `2026` document dates, the same demonstration-persona
 * invention every other field on her profile already makes; deliberately
 * does **not** also link the two competent adults (Janaki and Sunita) via a
 * `DelegationGrant` — that is a real, separate demonstration to build
 * deliberately, not a byproduct of retiring this table.
 */
export interface SeedGuardianshipGrant {
  id: string;
  wardId: string;
  guardianId: string;
  grounds: GuardianshipGrounds;
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface SeedHealthDocument {
  id: string;
  ownerId: string;
  kind: HealthDocumentKind;
  status: DocumentStatus;
  storageBackend: StorageBackend;
  externalRef: string;
  byteSize: bigint;
  contentType: string;
  checksumSha256: string;
  title: string;
  documentDate: string;
  sensitivity: HealthDocument['sensitivity'];
  clientEncrypted: boolean;
  pageCount: number;
}

export interface SeedHealthObservation {
  id: string;
  documentId: string;
  ownerId: string;
  code: string;
  codeSystem: HealthObservation['codeSystem'];
  labelNe: string;
  labelEn: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  abnormalFlag: HealthObservation['abnormalFlag'];
  effectiveAt: string;
  status: ObservationStatus;
  provenance: HealthObservation['provenance'];
  confidence: number | null;
  extractionRunId: string | null;
}

export interface SeedDeviceSample {
  id: string;
  ownerId: string;
  kind: DeviceMetricKind;
  source: DeviceSource;
  deviceLabel: string | null;
  value: number;
  unit: string;
  recordedAt: string;
  recordedUntil: string | null;
}

/**
 * `code` follows the same `{ system, code, display }` shape
 * `packages/interop`'s FHIR `CodeableConcept` mapping already uses for
 * observations, plus `geneticRelevance` — a marker this seed introduces
 * since nothing in the repo has needed one before. Nothing reads it yet;
 * it exists so the Round two B/C retrieval and family tasks have a real
 * hereditary condition to test against instead of inventing their own.
 */
export interface SeedCondition {
  id: string;
  patientId: string;
  code: { system: string; code: string; display: string; geneticRelevance: boolean };
  status: string;
  recordedById: string;
}

export interface SeedSubscription {
  id: string;
  ownerId: string;
  tier: PlanTier;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
}

export interface SeedUsageCounter {
  id: string;
  ownerId: string;
  dimension: QuotaDimension;
  period: string;
  count: number;
}

export const organizations: readonly SeedOrganization[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    type: 'HOSPITAL',
    name: 'Sajilo Community Hospital — Demo',
    nameNe: 'सजिलो सामुदायिक अस्पताल — नमुना',
    verification: 'VERIFIED',
    isFictionalDemo: true,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    type: 'PHARMACY',
    name: 'Nawa Jeevan Pharmacy — Demo',
    nameNe: 'नव जीवन फार्मेसी — नमुना',
    verification: 'VERIFIED',
    isFictionalDemo: true,
  },
];

export const directoryEntities: readonly SeedDirectoryEntity[] = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    type: 'HOSPITAL',
    name: 'Sajilo Community Hospital — Demo',
    nameNe: 'सजिलो सामुदायिक अस्पताल — नमुना',
    verification: 'VERIFIED',
    district: 'Kathmandu',
    municipality: 'Kathmandu Metropolitan',
    serviceData: { realTimeAvailability: false },
    sourceLabel: 'Fictional demonstration registry',
    dataAsOf: '2026-07-15T00:00:00Z',
    isFictionalDemo: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    type: 'PHARMACY',
    name: 'Nawa Jeevan Pharmacy — Demo',
    nameNe: 'नव जीवन फार्मेसी — नमुना',
    verification: 'VERIFIED',
    district: 'Lalitpur',
    municipality: 'Lalitpur Metropolitan',
    serviceData: { homeService: true, realTimeInventory: false },
    sourceLabel: 'Fictional demonstration registry',
    dataAsOf: '2026-07-10T00:00:00Z',
    isFictionalDemo: true,
  },
];

export const featureFlags: readonly SeedFeatureFlag[] = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    key: 'real_payments',
    description: 'Production payment provider',
    enabled: false,
    rules: {},
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    key: 'authoritative_directory',
    description: 'Authoritative national directory ingestion',
    enabled: false,
    rules: {},
  },
];

export const plans: readonly SeedPlan[] = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    code: 'patient-free-demo',
    name: 'Patient Free — Demo',
    audience: 'PATIENT',
    pricing: { currency: 'NPR', amount: 0 },
    active: true,
  },
];

/**
 * Three generations of one fictional family (थापा, Thapa) plus one unrelated
 * adult — "a few subjects", each their own subject per
 * family-and-proxy.md §1, never a profile nested inside another's account.
 * The unrelated fourth subject exists so the Round two B cross-subject
 * leakage test has two genuinely separate people to prove isolation between,
 * not just three people who already share a household.
 */
const janakiId = 'a0000000-0000-4000-8000-000000000001';
const sunitaId = 'a0000000-0000-4000-8000-000000000002';
const roshaniId = 'a0000000-0000-4000-8000-000000000003';
const arjunId = 'a0000000-0000-4000-8000-000000000004';

export const users: readonly SeedUser[] = [
  { id: janakiId, role: 'PATIENT', locale: 'ne' },
  { id: sunitaId, role: 'PATIENT', locale: 'ne' },
  { id: roshaniId, role: 'PATIENT', locale: 'ne' },
  { id: arjunId, role: 'PATIENT', locale: 'ne' },
];

const janakiProfileId = 'b0000000-0000-4000-8000-000000000001';
const sunitaProfileId = 'b0000000-0000-4000-8000-000000000002';
const roshaniProfileId = 'b0000000-0000-4000-8000-000000000003';
const arjunProfileId = 'b0000000-0000-4000-8000-000000000004';

export const patientProfiles: readonly SeedPatientProfile[] = [
  {
    id: janakiProfileId,
    userId: janakiId,
    displayName: 'जानकी थापा — Demo (Janaki Thapa)',
    demographics: { ageYears: 68, sex: 'FEMALE', district: 'Kathmandu' },
  },
  {
    id: sunitaProfileId,
    userId: sunitaId,
    displayName: 'सुनीता थापा गुरुङ — Demo (Sunita Thapa Gurung)',
    demographics: { ageYears: 41, sex: 'FEMALE', district: 'Kathmandu' },
  },
  {
    id: roshaniProfileId,
    userId: roshaniId,
    displayName: 'रोशनी थापा गुरुङ — Demo (Roshani Thapa Gurung)',
    demographics: { ageYears: 12, sex: 'FEMALE', district: 'Kathmandu' },
  },
  {
    id: arjunProfileId,
    userId: arjunId,
    displayName: 'अर्जुन गुरुङ — Demo (Arjun Gurung)',
    demographics: { ageYears: 35, sex: 'MALE', district: 'Lalitpur' },
  },
];

export const guardianshipGrants: readonly SeedGuardianshipGrant[] = [
  {
    id: 'c0000000-0000-4000-8000-000000000001',
    wardId: roshaniId,
    guardianId: sunitaId,
    grounds: 'MINOR',
    // wardBirthYear 2014 (see the type's doc comment) — granted at birth,
    // same as the CaregiverRelationship row this replaces.
    grantedAt: '2014-03-10T00:00:00Z',
    // Roshani's 18th birthday: 2014-03-10 + 18 years. `GuardianshipGrant`
    // has no narrower access to grant than full — see packages/family's own
    // doc comment on why guardianship carries no `scopes` field, unlike
    // `DelegationGrant`.
    expiresAt: '2032-03-10T00:00:00Z',
    revokedAt: null,
  },
];

const janakiDocumentId = '50000000-0000-4000-8000-000000000001';
const sunitaDocumentId = '50000000-0000-4000-8000-000000000002';
const roshaniDocumentId = '50000000-0000-4000-8000-000000000003';
const arjunDocumentId = '50000000-0000-4000-8000-000000000004';

// Illustrative placeholder only (SHA-256 of the empty string) — not a real
// file digest, same convention the original seed.sql used.
const PLACEHOLDER_CHECKSUM = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85';
const EXTRACTION_RUN_ID = 'demo-extraction-run-001';

export const healthDocuments: readonly SeedHealthDocument[] = [
  {
    id: janakiDocumentId,
    ownerId: janakiId,
    kind: 'LAB_REPORT',
    status: 'CONFIRMED',
    storageBackend: 'HOSTED',
    externalRef: `demo/health-documents/${janakiDocumentId}.pdf`,
    byteSize: 391204n,
    contentType: 'application/pdf',
    checksumSha256: PLACEHOLDER_CHECKSUM,
    title: 'रगत जाँच रिपोर्ट — Demo (Blood Test Report)',
    documentDate: '2026-05-18T00:00:00Z',
    sensitivity: 'STANDARD',
    clientEncrypted: false,
    pageCount: 1,
  },
  {
    id: sunitaDocumentId,
    ownerId: sunitaId,
    kind: 'LAB_REPORT',
    status: 'CONFIRMED',
    storageBackend: 'HOSTED',
    externalRef: `demo/health-documents/${sunitaDocumentId}.pdf`,
    byteSize: 276511n,
    contentType: 'application/pdf',
    checksumSha256: PLACEHOLDER_CHECKSUM,
    title: 'थाइरोइड प्रोफाइल — Demo (Thyroid Panel)',
    documentDate: '2026-06-02T00:00:00Z',
    sensitivity: 'STANDARD',
    clientEncrypted: false,
    pageCount: 1,
  },
  {
    id: roshaniDocumentId,
    ownerId: roshaniId,
    kind: 'LAB_REPORT',
    status: 'CONFIRMED',
    storageBackend: 'HOSTED',
    externalRef: `demo/health-documents/${roshaniDocumentId}.pdf`,
    byteSize: 198340n,
    contentType: 'application/pdf',
    checksumSha256: PLACEHOLDER_CHECKSUM,
    title: 'सामान्य रक्त जाँच — Demo (General Blood Panel)',
    documentDate: '2026-04-20T00:00:00Z',
    sensitivity: 'STANDARD',
    clientEncrypted: false,
    pageCount: 1,
  },
  {
    id: arjunDocumentId,
    ownerId: arjunId,
    kind: 'LAB_REPORT',
    status: 'CONFIRMED',
    storageBackend: 'HOSTED',
    externalRef: `demo/health-documents/${arjunDocumentId}.pdf`,
    byteSize: 305882n,
    contentType: 'application/pdf',
    checksumSha256: PLACEHOLDER_CHECKSUM,
    title: 'लिपिड प्रोफाइल — Demo (Lipid Panel)',
    documentDate: '2026-06-10T00:00:00Z',
    sensitivity: 'STANDARD',
    clientEncrypted: false,
    pageCount: 1,
  },
];

// Real LOINC codes throughout (same convention as packages/interop's and
// packages/health-records's test fixtures, e.g. 2160-0 for creatinine) —
// lexical retrieval (Round two B) needs recognisable codes to match against,
// not the placeholder LOCAL: prefix the original single-owner fixture used.
export const healthObservations: readonly SeedHealthObservation[] = [
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
    extractionRunId: EXTRACTION_RUN_ID,
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
    extractionRunId: EXTRACTION_RUN_ID,
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
    extractionRunId: EXTRACTION_RUN_ID,
  },
  // Deliberately left DRAFT, and below health-records's LOW_CONFIDENCE_THRESHOLD
  // (0.75) — exercises pendingConfirmations() and isLowConfidence() with a
  // real row instead of a hand-built test fixture, and is the concrete case
  // the "only CONFIRMED/CORRECTED reach the assistant" constraint exists for:
  // this value must never surface in an answer or export until Sunita confirms it.
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
    extractionRunId: EXTRACTION_RUN_ID,
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
    extractionRunId: EXTRACTION_RUN_ID,
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
    extractionRunId: EXTRACTION_RUN_ID,
  },
];

export const deviceSamples: readonly SeedDeviceSample[] = [
  {
    id: '70000000-0000-4000-8000-000000000001',
    ownerId: arjunId,
    kind: 'STEPS',
    source: 'MANUAL',
    deviceLabel: null,
    value: 6400,
    unit: 'steps',
    recordedAt: '2026-06-10T00:00:00Z',
    recordedUntil: '2026-06-10T23:59:59Z',
  },
];

/**
 * The genetic-relevance requirement: Janaki's own condition, on her own
 * record. Deliberately does *not* also write anything onto Sunita's or
 * Roshani's records — family-and-proxy.md §5 is explicit that a diagnosis
 * never propagates between records automatically, only a `FamilyHistoryAssertion`
 * the descendant states herself would, and that model doesn't exist until
 * `packages/family` is built (Round two C). `recordedById` is Janaki's own
 * id: nothing in this seed models a clinician, so this is patient-reported.
 */
export const conditions: readonly SeedCondition[] = [
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    patientId: janakiProfileId,
    code: {
      system: 'http://snomed.info/sct',
      code: '44054006',
      display: 'Type 2 diabetes mellitus',
      geneticRelevance: true,
    },
    status: 'ACTIVE',
    recordedById: janakiId,
  },
];

export const subscriptions: readonly SeedSubscription[] = [janakiId, sunitaId, roshaniId, arjunId].map(
  (ownerId, index) => ({
    id: `80000000-0000-4000-8000-00000000000${index + 1}`,
    ownerId,
    tier: 'FREE' as const,
    status: 'ACTIVE',
    currentPeriodStart: '2026-01-01T00:00:00Z',
    currentPeriodEnd: null,
  }),
);

export const usageCounters: readonly SeedUsageCounter[] = [janakiId, sunitaId, roshaniId, arjunId].map(
  (ownerId, index) => ({
    id: `90000000-0000-4000-8000-00000000000${index + 1}`,
    ownerId,
    dimension: 'DOCUMENTS_STORED' as const,
    period: 'ALL_TIME',
    count: 1,
  }),
);
