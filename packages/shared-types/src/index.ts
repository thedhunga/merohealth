export type LanguageCode = 'ne' | 'en' | 'ne-Latn';
export type RiskLevel =
  | 'EMERGENCY_NOW' | 'URGENT_SAME_DAY' | 'CLINICIAN_RECOMMENDED'
  | 'ROUTINE_SELF_CARE' | 'PREVENTIVE_EDUCATION' | 'MEDICATION_INFORMATION'
  | 'MENTAL_HEALTH_CONCERN' | 'MATERNAL_CONCERN' | 'PEDIATRIC_CONCERN';
export interface SafetyAssessment {
  riskLevel: RiskLevel;
  matchedRuleIds: string[];
  interruptConversation: boolean;
  templateId?: string;
}
export type TwinFactKind =
  | 'BLOOD_GROUP' | 'ALLERGY' | 'MEDICATION' | 'CONDITION'
  | 'EMERGENCY_CONTACT' | 'PREGNANCY_STATUS' | 'ACCESSIBILITY' | 'HEALTH_GOAL';
export interface TwinFact {
  id: string;
  kind: TwinFactKind;
  label: string;
  value: string;
  provenance: 'PATIENT_REPORTED' | 'CLINICIAN_AUTHORED' | 'DOCUMENT_EXTRACTED' | 'DEVICE';
  verification: 'UNVERIFIED' | 'PATIENT_CONFIRMED' | 'CLINICIAN_VERIFIED';
  sensitivity: 'STANDARD' | 'SENSITIVE' | 'RESTRICTED';
  recordedAt: string;
  version: number;
}
export type DirectoryEntityType =
  | 'HOSPITAL' | 'CLINIC' | 'PHARMACY' | 'LABORATORY'
  | 'DOCTOR' | 'SPECIALIST' | 'HOME_NURSE' | 'HOME_SAMPLE_COLLECTION';
export interface DirectoryEntity {
  id: string;
  type: DirectoryEntityType;
  name: string;
  nameNe: string;
  district: string;
  municipality: string;
  specialties: string[];
  languages: LanguageCode[];
  verification: 'CLAIMED' | 'IMPORTED' | 'REVIEWED' | 'VERIFIED' | 'SUSPENDED' | 'RETIRED';
  verifiedAt?: string;
  dataAsOf: string;
  sourceLabel: string;
  isFictionalDemo: boolean;
  supportsHomeService: boolean;
  phone?: string;
}
export interface TrainingLesson {
  id: string;
  titleNe: string;
  titleEn: string;
  durationSeconds: number;
  posterKey: string;
  streamUrl?: string;
  transcriptNe: string;
  transcriptEn: string;
  reviewStatus: 'DRAFT' | 'CLINICAL_REVIEW' | 'LEGAL_REVIEW' | 'APPROVED';
  version: number;
}

/* ------------------------------------------------------------------ *
 * Personal health record
 * ------------------------------------------------------------------ */

export type HealthDocumentKind =
  | 'LAB_REPORT' | 'PRESCRIPTION' | 'IMAGING_REPORT' | 'DISCHARGE_SUMMARY'
  | 'VACCINATION_RECORD' | 'CLINICAL_NOTE' | 'BILL' | 'OTHER';

/** Where the person chose to keep the underlying file. */
export type StorageBackend = 'HOSTED' | 'GOOGLE_DRIVE';

/**
 * Lifecycle of a captured document. Extraction never writes straight into the
 * record: it produces a draft the person confirms, matching the confirmation
 * semantics `digital-twin` already uses for patient-visible facts.
 */
export type DocumentStatus =
  | 'CAPTURED' | 'UPLOADING' | 'STORED' | 'EXTRACTING'
  | 'AWAITING_CONFIRMATION' | 'CONFIRMED' | 'EXTRACTION_FAILED' | 'DELETED';

export interface StoredRef {
  backend: StorageBackend;
  /** Opaque to callers: object key for hosted, file id for Drive. */
  externalId: string;
  /** Bytes as stored (post-encryption for bring-your-own backends). */
  byteSize: number;
  /** Null when the backend holds a client-encrypted blob we cannot read. */
  contentType: string | null;
  checksumSha256: string;
}

export interface HealthDocument {
  id: string;
  ownerId: string;
  kind: HealthDocumentKind;
  status: DocumentStatus;
  ref: StoredRef;
  /** Person-supplied label; falls back to a generated one. */
  title: string;
  /** Date the care event happened, not the upload date. */
  documentDate: string | null;
  capturedAt: string;
  sensitivity: 'STANDARD' | 'SENSITIVE' | 'RESTRICTED';
  /** True when the file is encrypted client-side and unreadable server-side. */
  clientEncrypted: boolean;
  pageCount: number;
}

export type ObservationStatus = 'DRAFT' | 'CONFIRMED' | 'CORRECTED' | 'REJECTED';

/**
 * A single structured fact pulled out of a document — one lab analyte, one
 * prescribed medicine, one vital sign. Provenance is mandatory: every value
 * traces back to the document and extraction run that produced it.
 */
export interface HealthObservation {
  id: string;
  documentId: string;
  ownerId: string;
  /** LOINC where known, otherwise a local code. */
  code: string;
  codeSystem: 'LOINC' | 'SNOMED' | 'ATC' | 'LOCAL';
  labelNe: string;
  labelEn: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  /** Set only when the source document states it. Never inferred. */
  abnormalFlag: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' | null;
  effectiveAt: string | null;
  status: ObservationStatus;
  provenance: 'DOCUMENT_EXTRACTED' | 'PATIENT_REPORTED' | 'CLINICIAN_AUTHORED' | 'DEVICE';
  /** Extraction confidence 0-1. Null for non-extracted provenance. */
  confidence: number | null;
  extractionRunId: string | null;
}

/* ------------------------------------------------------------------ *
 * Devices and wearables
 * ------------------------------------------------------------------ */

/**
 * `BLOOD_PRESSURE_SYSTOLIC`/`BLOOD_PRESSURE_DIASTOLIC` are two kinds, not one,
 * because `DeviceSample` carries a single numeric `value` — the same shape
 * both source platforms actually use internally (Health Connect's
 * `BloodPressureRecord` has two fields; HealthKit represents a reading as two
 * correlated `HKQuantitySample`s, one per identifier). A systolic/diastolic
 * pair shares `recordedAt` and is meant to be re-paired by a reader, not
 * merged into one row here.
 */
export type DeviceMetricKind =
  | 'STEPS' | 'HEART_RATE' | 'RESTING_HEART_RATE' | 'SLEEP_DURATION'
  | 'BLOOD_OXYGEN' | 'BLOOD_GLUCOSE'
  | 'BLOOD_PRESSURE_SYSTOLIC' | 'BLOOD_PRESSURE_DIASTOLIC'
  | 'BODY_WEIGHT' | 'BODY_TEMPERATURE' | 'RESPIRATORY_RATE';

export type DeviceSource = 'HEALTH_CONNECT' | 'HEALTH_KIT' | 'MANUAL' | 'PARTNER_API';

export interface DeviceSample {
  id: string;
  ownerId: string;
  kind: DeviceMetricKind;
  source: DeviceSource;
  /** Device-reported model string, for provenance rather than display. */
  deviceLabel: string | null;
  value: number;
  unit: string;
  recordedAt: string;
  /** End of the window for aggregate metrics such as steps or sleep. */
  recordedUntil: string | null;
}

/* ------------------------------------------------------------------ *
 * Plans and entitlements
 * ------------------------------------------------------------------ */

export type PlanTier = 'FREE' | 'PLUS' | 'PRO';

export type ModuleKey =
  | 'ASSISTANT' | 'HEALTH_RECORD' | 'DOCUMENT_EXTRACTION' | 'HOSTED_STORAGE'
  | 'BRING_YOUR_OWN_STORAGE' | 'DEVICE_SYNC' | 'RECORD_SHARING'
  | 'PROVIDER_EXPORT' | 'CARE_DIRECTORY' | 'TELECONSULTATION';

export type QuotaDimension =
  | 'DOCUMENTS_STORED' | 'EXTRACTION_PAGES_PER_MONTH'
  | 'ASSISTANT_MESSAGES_PER_MONTH' | 'ACTIVE_SHARE_LINKS' | 'CONNECTED_DEVICES';

/** `null` means unlimited for that tier. */
export type QuotaLimits = Readonly<Record<QuotaDimension, number | null>>;

export interface PlanDefinition {
  tier: PlanTier;
  nameNe: string;
  nameEn: string;
  descriptionNe: string;
  descriptionEn: string;
  modules: readonly ModuleKey[];
  limits: QuotaLimits;
  /** Monthly price in paisa (NPR × 100). Zero for the free tier. */
  monthlyPricePaisa: number;
}

export interface QuotaVerdict {
  dimension: QuotaDimension;
  allowed: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  /** Set when denied, so callers can prompt an upgrade rather than fail flat. */
  upgradeTo: PlanTier | null;
}

/* ------------------------------------------------------------------ *
 * Identity and verification
 *
 * Three levels, not the four in docs/architecture/identity-and-credentialing.md
 * §2: `PROFESSIONAL_VERIFIED` is a clinician's credentialing badge, owned by
 * `packages/credentialing` against its own state machine (council, licence
 * number, manual review), not a rung on this person-level ladder. A clinician
 * still separately holds one of these three as themself.
 * ------------------------------------------------------------------ */

/**
 * `REGISTERED` is the level the product is designed around — most people
 * should never need to go past it. `IDENTITY_VERIFIED` is deliberately hard
 * to reach by accident: it requires a government document and a human or
 * liveness-checked decision, never an inferred upgrade.
 */
export type AssuranceLevel = 'ANONYMOUS' | 'REGISTERED' | 'IDENTITY_VERIFIED';

/** राष्ट्रिय परिचयपत्र, नागरिकता, or the non-Nepali passport fallback. */
export type IdentityDocumentType =
  | 'NATIONAL_ID' | 'CITIZENSHIP' | 'PASSPORT' | 'DRIVING_LICENCE';

/**
 * A request to move one person from `REGISTERED` to `IDENTITY_VERIFIED`.
 * `evidenceImageRef` is opaque storage pointer, never the bytes — and per
 * identity-and-credentialing.md §4 it is set to `null` the moment a decision
 * is recorded, whichever way it goes. What persists is the decision, not the
 * document.
 */
export type VerificationStatus =
  | 'NOT_STARTED' | 'EVIDENCE_SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface VerificationRequest {
  id: string;
  ownerId: string;
  status: VerificationStatus;
  documentType: IdentityDocumentType | null;
  evidenceImageRef: string | null;
  /** Set only on `REJECTED`, so the person knows what to fix before resubmitting. */
  rejectionReason: string | null;
  submittedAt: string | null;
  /** Set once `APPROVED` or `REJECTED`. */
  decidedAt: string | null;
}
