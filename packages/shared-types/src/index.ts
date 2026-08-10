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

/* ------------------------------------------------------------------ *
 * Professional credentialing
 *
 * A clinician's `PROFESSIONAL_VERIFIED` badge (identity-and-credentialing.md
 * §2's fourth table row) is not a rung on `AssuranceLevel` above — see that
 * type's own comment for why. It is this separate application → manual
 * review → badge pipeline, owned by `packages/credentialing`.
 * ------------------------------------------------------------------ */

/** Nepal's five statutory professional registers (§3). */
export type CouncilKey =
  | 'NMC' | 'NNC' | 'NHPC' | 'PHARMACY_COUNCIL' | 'AYURVEDIC_COUNCIL';

export type CredentialingApplicationStatus =
  | 'NOT_STARTED' | 'EVIDENCE_SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

/**
 * A clinician's application to be listed as council-verified. `reviewerId`
 * and `decidedAt` are set together, only once a human has read the register
 * — §3's "no automatic approval, ever." `certificateImageRef` /
 * `identityImageRef` are opaque storage pointers, nulled the moment a
 * decision is recorded (§4's "store the decision, not the document"), the
 * same evidence-deletion invariant `packages/identity`'s `VerificationRequest`
 * already established for its own evidence.
 */
export interface CredentialingApplication {
  id: string;
  applicantId: string;
  council: CouncilKey;
  registrationNumber: string;
  status: CredentialingApplicationStatus;
  certificateImageRef: string | null;
  identityImageRef: string | null;
  submittedAt: string | null;
  /** Set only on `REJECTED`, so the applicant knows what to fix before resubmitting. */
  rejectionReason: string | null;
  /** Who decided, for the accountability trail §3 requires. Set only alongside `decidedAt`. */
  reviewerId: string | null;
  decidedAt: string | null;
}

/**
 * What a clinician's verified badge actually states — "which council, which
 * number, and when it was last checked" (§3 step 5), never "trusted doctor"
 * (§3, "never claim more than was checked"). Constructible only from an
 * `APPROVED` application; see `packages/credentialing`'s `issueBadge`.
 */
export interface CredentialingBadge {
  council: CouncilKey;
  registrationNumber: string;
  reviewerId: string;
  verifiedAt: string;
  lastCheckedAt: string;
  /** Registration lapses (§3); past this date the badge must degrade to unverified. */
  recheckDueAt: string;
}

/* ------------------------------------------------------------------ *
 * Clinical suite module registry
 *
 * docs/architecture/clinical-suite.md §3's capability map, minus row 8
 * ("Patient portal" — that is `apps/web` + `apps/mobile` themselves, not a
 * module that plugs into this fault-isolation system). Modules 1-7 are the
 * next unchecked ledger tasks; 9-20 are sequenced but not yet started. All
 * 19 keys are declared up front so `requires`/`degradesWith` references
 * compile-check against the full eventual map, not just whichever module
 * happens to exist today.
 * ------------------------------------------------------------------ */
export type ClinicalModuleKey =
  | 'PATIENT_REGISTRY' | 'SCHEDULING' | 'CLINICAL_CHARTING' | 'CLINICAL_SUMMARY'
  | 'MEDICATION_SAFETY' | 'PRESCRIBING' | 'DIAGNOSTICS_ORDERS' | 'TELECONSULTATION'
  | 'BILLING' | 'COVERAGE' | 'REFERRALS' | 'POPULATION_HEALTH' | 'ANALYTICS'
  | 'ENGAGEMENT' | 'HEALTH_RECORDS' | 'INTEROP' | 'IMMUNIZATION'
  | 'QUALITY_REPORTING' | 'TENANCY';

/** A module's own self-reported condition, per §2's `ModuleDescriptor.health()`. */
export type ClinicalHealthStatus = 'UP' | 'DEGRADED' | 'DOWN';

export interface ClinicalModuleHealth {
  status: ClinicalHealthStatus;
  detail?: string;
}

/**
 * How a module behaves when a `degradesWith` dependency is unavailable. §2's
 * own four modes, verbatim — this package invents no fifth mode and no
 * severity ordering between them; that judgement stays with whichever module
 * declares which mode it degrades to.
 */
export type ClinicalDegradation = 'HIDE' | 'READ_ONLY' | 'QUEUE_AND_RETRY' | 'MANUAL';

/**
 * §2's contract, transcribed directly. `requires` is a hard dependency — the
 * module cannot run at all without it, so this list should stay near-empty
 * per the doc's own warning. `degradesWith` is the far more common shape: the
 * module still runs, in the stated degraded mode, when that dependency is
 * down. `health()` is a method, not a stored value, because it must always
 * reflect the module's current condition, never a stale snapshot.
 */
export interface ClinicalModuleDescriptor {
  key: ClinicalModuleKey;
  requires: readonly ClinicalModuleKey[];
  degradesWith: readonly { key: ClinicalModuleKey; mode: ClinicalDegradation }[];
  health(): Promise<ClinicalModuleHealth>;
}

/* ------------------------------------------------------------------ *
 * Patient registry (clinical-suite.md capability map row 1)
 *
 * "Foundation. Owns identity; others reference by id only." — every field
 * here is administrative registration data, not a clinical fact, and
 * `PatientRecord.id` is the opaque id every later clinical-suite module
 * (`scheduling`, `clinical-charting`, ...) will hold instead of a foreign
 * key, per §2 rule 1. `district`/`municipality` reuse `DirectoryEntity`'s
 * own field names for the same two Nepali administrative levels, not a new
 * naming convention.
 * ------------------------------------------------------------------ */
export type PatientSex = 'FEMALE' | 'MALE' | 'OTHER' | 'UNDISCLOSED';

export interface PatientAddress {
  district: string;
  municipality: string;
  ward?: string | undefined;
}

export interface PatientDemographics {
  displayName: string;
  /** ISO date (YYYY-MM-DD) — a birth date has no time-of-day component. */
  dateOfBirth: string;
  sex: PatientSex;
  phone: string;
  preferredLocale: LanguageCode;
  address?: PatientAddress | undefined;
}

export interface PatientRecord {
  id: string;
  demographics: PatientDemographics;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * A demographics update: every field individually omittable. Spelled out
 * field by field with an explicit `| undefined`, rather than the built-in
 * `Partial<PatientDemographics>`, because this project's
 * `exactOptionalPropertyTypes` treats "key absent" and "key present but
 * `undefined`" as different types — and zod's own `.partial()` schema
 * infers the latter for every optional key, so a parsed request body
 * type-checks against this shape without a cast.
 */
export interface PatientDemographicsPatch {
  displayName?: string | undefined;
  dateOfBirth?: string | undefined;
  sex?: PatientSex | undefined;
  phone?: string | undefined;
  preferredLocale?: LanguageCode | undefined;
  address?: PatientAddress | undefined;
}

/* ------------------------------------------------------------------ *
 * Scheduling (clinical-suite.md capability map row 2)
 *
 * "Degrades to READ_ONLY without the registry" — `patientId` and
 * `clinicianId` are opaque ids, never a foreign key into patient-registry or
 * a future clinician-registry, per §2 rule 1. Only `SCHEDULED`/`CANCELLED`
 * are modelled: nothing in this module marks a visit `COMPLETED`, so that
 * status would be an unreachable, invented state rather than a real one.
 * ------------------------------------------------------------------ */
export type AppointmentStatus = 'SCHEDULED' | 'CANCELLED';

export interface Appointment {
  id: string;
  patientId: string;
  clinicianId: string;
  /** ISO 8601 UTC instant, e.g. `2026-08-09T09:30:00.000Z`. */
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ScheduleAppointmentInput {
  patientId: string;
  clinicianId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

/* ------------------------------------------------------------------ *
 * Clinical charting (clinical-suite.md capability map row 3)
 *
 * "Core EHR surface. Consumes health-records." — an encounter may reference
 * an existing `HealthDocument` by id (a lab report reviewed during the
 * visit, say); the reference is an opaque id resolved through health-records'
 * own port, per §2 rule 1, the same convention `scheduling` already
 * established for `patientId`/`clinicianId`. This package makes no claim
 * that a `HealthDocument.ownerId` and an `Encounter.patientId` are the same
 * identity — patient-registry (clinical patients) and health-records
 * (personal-platform document owners) are different bounded contexts with
 * their own id spaces, and asserting they line up would be inventing a
 * linkage this codebase has never established.
 * ------------------------------------------------------------------ */
export type EncounterStatus = 'OPEN' | 'CLOSED';

export interface Encounter {
  id: string;
  patientId: string;
  clinicianId: string;
  status: EncounterStatus;
  startedAt: string;
  /** Set only once, when the encounter closes. */
  closedAt: string | null;
  attachedDocumentIds: readonly string[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface OpenEncounterInput {
  patientId: string;
  clinicianId: string;
}

/**
 * Subjective, Objective, Assessment, Plan — the standard clinical note shape
 * eCW itself uses (capability map row 3). One encounter may carry more than
 * one note (an addendum, say), so a note is its own entity referencing its
 * encounter rather than an inline field on it.
 */
export interface SoapNote {
  id: string;
  encounterId: string;
  authorId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SoapNoteInput {
  authorId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

/**
 * A reusable note skeleton a clinician defines for themself — structural
 * section prompts only, never pre-filled clinical content. This codebase
 * ships no canned medical wording, per "invent no facts": every template is
 * authored by a real clinician through the API, none seeded.
 */
export interface ChartingTemplate {
  id: string;
  name: string;
  subjectivePrompt: string;
  objectivePrompt: string;
  assessmentPrompt: string;
  planPrompt: string;
  createdAt: string;
}

export interface CreateChartingTemplateInput {
  name: string;
  subjectivePrompt: string;
  objectivePrompt: string;
  assessmentPrompt: string;
  planPrompt: string;
}

/* ------------------------------------------------------------------ *
 * Clinical summary (clinical-suite.md capability map row 4)
 *
 * "Problem list, allergies, medications ... Extends digital-twin with
 * clinician-authored provenance." `TwinFact` already models a
 * `CLINICIAN_AUTHORED` provenance and a `CLINICIAN_VERIFIED` verification
 * (see that type's own comment) but has no field for which patient,
 * clinician or encounter recorded one — the mobile companion infers "whose
 * fact this is" from the device's own signed-in owner, which has no meaning
 * once a clinician is charting a different person's visit. A
 * `ClinicalSummaryItem` is that missing wrapper around the same
 * provenance/verification vocabulary (reused via indexed access below,
 * not retyped), scoped to a patient-registry `patientId` and, when
 * clinician-authored, the `clinical-charting` encounter that recorded it.
 * Restricted to the three kinds this capability row names — `TwinFactKind`
 * also carries `BLOOD_GROUP`, `EMERGENCY_CONTACT`, `PREGNANCY_STATUS`,
 * `ACCESSIBILITY` and `HEALTH_GOAL`, none of which is a problem, an allergy
 * or a medication. As with `Encounter.patientId` against
 * `HealthDocument.ownerId` (clinical-charting's own comment), this asserts
 * no linkage between a `ClinicalSummaryItem.patientId` and a `TwinFact`'s
 * own id space beyond both being opaque strings — patient-registry and
 * digital-twin stay separate bounded contexts.
 * ------------------------------------------------------------------ */
export type ClinicalSummaryKind = Extract<TwinFactKind, 'CONDITION' | 'ALLERGY' | 'MEDICATION'>;

/**
 * Mirrors the real problem-list lifecycle: a condition resolves, an
 * allergy is marked no longer relevant, a medication is discontinued. One
 * status covers all three kinds rather than three bespoke enums — nothing
 * in this codebase needs to distinguish "resolved" from "discontinued"
 * today, and inventing that split ahead of a caller that needs it would be
 * designing for a hypothetical requirement.
 */
export type ClinicalSummaryStatus = 'ACTIVE' | 'RESOLVED';

export interface ClinicalSummaryItem {
  id: string;
  patientId: string;
  kind: ClinicalSummaryKind;
  label: string;
  value: string;
  status: ClinicalSummaryStatus;
  provenance: TwinFact['provenance'];
  verification: TwinFact['verification'];
  /** Set together, only for a clinician-authored item; both null for a patient-reported one. */
  authoredByEncounterId: string | null;
  authoredByClinicianId: string | null;
  recordedAt: string;
  updatedAt: string;
  version: number;
}

export interface RecordPatientReportedSummaryItemInput {
  patientId: string;
  kind: ClinicalSummaryKind;
  label: string;
  value: string;
}

/**
 * `patientId` and `encounterId` are deliberately absent here: the API
 * boundary derives both from the `clinical-charting` encounter the item is
 * authored against, rather than trusting a client-supplied `patientId` that
 * could disagree with the encounter it is nested under.
 */
export interface RecordClinicianSummaryItemInput {
  clinicianId: string;
  kind: ClinicalSummaryKind;
  label: string;
  value: string;
}

/* ------------------------------------------------------------------ *
 * Medication safety (clinical-suite.md capability map row 5)
 *
 * "Drug interaction / allergy checking ... Built before prescribing, so
 * prescribing can degrade against it." Unlike every other clinical-suite
 * module built so far, this one owns no patient data of its own — it reads
 * a patient's ACTIVE `ClinicalSummaryItem` allergies and medications
 * through `clinical-summary`'s port (row 4) and checks a proposed
 * medication label against them.
 *
 * `DrugInteractionRule` is a shape for a future licensed drug-interaction
 * dataset, deliberately unpopulated in this codebase today. Fabricating
 * even one real interaction pair (e.g. "warfarin raises bleeding risk with
 * aspirin") would violate agent-progress.md's "invent no facts" constraint
 * exactly as a fake statistic would — it is a clinical claim this repository
 * holds no source for. `MedicationSafetyCheckResult.interactionRulesConsulted`
 * exists so a caller can tell "checked against a ruleset of size zero" apart
 * from "not checked at all," rather than the empty ruleset silently reading
 * as "verified safe."
 * ------------------------------------------------------------------ */
export type MedicationSafetyFindingKind = 'ALLERGY_CONFLICT' | 'DUPLICATE_THERAPY' | 'DRUG_INTERACTION';

export interface MedicationSafetyFinding {
  kind: MedicationSafetyFindingKind;
  /** The existing ClinicalSummaryItem (allergy or medication) this finding was raised against. */
  conflictsWithItemId: string;
  /** Built only from the two recorded labels being compared — never a fabricated clinical explanation. */
  detail: string;
}

/**
 * One row of a drug-drug interaction dataset. `medicationA`/`medicationB`
 * are unordered — "A interacts with B" is symmetric, and the checker
 * matches either direction.
 */
export interface DrugInteractionRule {
  id: string;
  medicationA: string;
  medicationB: string;
  detail: string;
}

export interface MedicationSafetyCheckResult {
  proposedLabel: string;
  findings: readonly MedicationSafetyFinding[];
  /** Ruleset size at check time — 0 today, honestly, per this section's own comment. */
  interactionRulesConsulted: number;
  /**
   * False under the MANUAL degradation clinical-suite.md §2 uses as its own
   * worked example, applied one hop earlier than the doc's own
   * prescribing-vs-medication-safety framing: clinical-summary (the owner of
   * the patient's allergy and medication list) was unavailable, so no
   * automated check ran at all. `findings` is always `[]` when this is
   * false — an empty array here must never be read as "checked, nothing
   * found."
   */
  checked: boolean;
}

/* ------------------------------------------------------------------ *
 * Prescribing (clinical-suite.md capability map row 6)
 *
 * "Nepali formulary, not US EPCS. Safety-critical." §1 is explicit that
 * `docs/compliance/` must lead this module, not trail it — the compliance
 * gap register's "E-prescribing" row names the interim engineering control
 * before any legal sign-off exists: "signed state machine; controlled items
 * disabled." Both are load-bearing in the types below, not aspirational
 * comments:
 *
 * - The state machine (`DRAFT` → `SIGNED` → `VOIDED`) makes a signed
 *   prescription immutable, the same "sign and lock" property
 *   `clinical-charting`'s `Encounter` already established for a closed
 *   encounter.
 * - `PrescriptionLineInput.isControlledSubstance` exists so the domain layer
 *   can refuse it unconditionally (see `packages/prescribing`'s
 *   `ControlledSubstanceDisabledError`) — a structural refusal that holds
 *   regardless of what a future formulary dataset contains, since no
 *   pharmacy/counsel approval for controlled items exists in this repo
 *   today (register launch gate: "counsel/pharmacy approval").
 *
 * Every prescription is written against a `clinical-charting` encounter —
 * unlike `ClinicalSummaryItem`, there is no patient-reported prescribing, so
 * `encounterId` is never null. `signedAttestation` is a typed confirmation
 * of intent, not a cryptographic signature: this repository has no PKI, and
 * inventing one to satisfy "signed" would be exactly the kind of unearned
 * assurance the standing constraints warn against.
 * ------------------------------------------------------------------ */
export type PrescriptionStatus = 'DRAFT' | 'SIGNED' | 'VOIDED';

export interface PrescriptionLine {
  id: string;
  label: string;
  dosageInstructions: string;
  quantity: string;
  isControlledSubstance: boolean;
}

export interface PrescriptionLineInput {
  label: string;
  dosageInstructions: string;
  quantity: string;
  isControlledSubstance: boolean;
}

/**
 * clinical-suite.md §2's own worked example, transcribed almost verbatim:
 * "the prescription records that it was written without automated
 * checking." `UNAVAILABLE` is what signing while `medication-safety`
 * reports `checked: false` produces; it is not an error state, just an
 * honest record of what could and could not be verified at sign time.
 */
export type PrescriptionSafetyCheckStatus = 'CHECKED' | 'UNAVAILABLE';

export interface Prescription {
  id: string;
  patientId: string;
  clinicianId: string;
  encounterId: string;
  status: PrescriptionStatus;
  lines: readonly PrescriptionLine[];
  /** Set together, only once signing runs a safety check pass. Both stay null/[] on a DRAFT. */
  safetyCheckStatus: PrescriptionSafetyCheckStatus | null;
  safetyFindings: readonly MedicationSafetyFinding[];
  /** Set together, only once signed. */
  signedAttestation: string | null;
  signedAt: string | null;
  /** Set together, only once voided; both stay null on a DRAFT or a SIGNED-but-not-voided prescription. */
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * `patientId` is deliberately absent, the same precedent
 * `RecordClinicianSummaryItemInput` set: the API boundary derives it from
 * the `clinical-charting` encounter the prescription is opened against,
 * rather than trusting a client-supplied `patientId` that could disagree
 * with the encounter it is nested under.
 */
export interface OpenPrescriptionInput {
  clinicianId: string;
}
