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
 * module that plugs into this fault-isolation system). Modules 1-7, 9, 10,
 * 12-14 are built; 11 and 15-20 are sequenced but deliberately parked — see
 * agent-progress.md's "stop after prescribing and reassess" note, extended
 * first to "stop after diagnostics-orders" once row 7 shipped, then to "stop
 * after teleconsultation" once row 9 shipped, then to "stop after billing"
 * once row 10 shipped, then to "stop after referrals" once row 12 shipped,
 * then to "stop after population-health" once row 13 shipped, then to "stop
 * after analytics" once row 14 shipped — row 11
 * (`coverage`) was skipped in table order, the same way row 8 was, because
 * the capability map's own note calls it "blocked on Nepali insurer
 * interfaces that do not yet exist," with no compliance-register row naming
 * an interim control the way row 10's "mock provider" one did. All 19 keys
 * are declared up front so
 * `requires`/`degradesWith` references compile-check against the full
 * eventual map, not just whichever module happens to exist today.
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

/* ------------------------------------------------------------------ *
 * Diagnostics orders (clinical-suite.md capability map row 7)
 *
 * "Lab and imaging orders + results ... HL7 v2 where partners speak it;
 * manual entry where they do not." No HL7 v2 interface exists anywhere in
 * this repository yet, so `resultSource` is a caller-supplied field
 * recording how a result actually arrived: `'HL7'` is a real value the type
 * accepts for when that interface is built, but nothing in this codebase
 * ever sets it today — every result recorded here is honestly `'MANUAL'`.
 *
 * docs/compliance/compliance-gap-register.md's "Lab results" row names its
 * own interim engineering control before laboratory governance exists:
 * "non-diagnostic flags; configurable hold." Both are load-bearing types
 * below, the same way row 6's controlled-substance flag is load-bearing
 * rather than aspirational: `nonDiagnostic` is always `true` — there is no
 * code path that constructs a `DiagnosticResult` without it — and a
 * recorded result always starts `HELD`, never `RELEASED` directly; a
 * separate release step is the only way past that. "Configurable" hold
 * policy (who may release, which test kinds skip the hold) is left for when
 * that governance actually exists; the unconditional hold is the honest
 * interim control today, mirroring `packages/prescribing`'s own
 * unconditional `ControlledSubstanceDisabledError` for the identical
 * "refuse until the launch gate passes" reasoning.
 *
 * Every order is placed against a `clinical-charting` encounter, the same
 * precedent row 6 set for prescriptions — there is no patient-reported
 * diagnostic order.
 * ------------------------------------------------------------------ */
export type DiagnosticOrderKind = 'LAB' | 'IMAGING';

export type DiagnosticOrderStatus = 'ORDERED' | 'RESULTED' | 'CANCELLED';

export type DiagnosticResultSource = 'HL7' | 'MANUAL';

export type DiagnosticResultReleaseStatus = 'HELD' | 'RELEASED';

export interface DiagnosticResult {
  resultSource: DiagnosticResultSource;
  /** Free-text finding, e.g. "5.4 mmol/L" or a radiologist's narrative — never a computed interpretation. */
  value: string;
  /** Always true — see this section's own comment on the compliance register's interim control. */
  nonDiagnostic: true;
  releaseStatus: DiagnosticResultReleaseStatus;
  recordedAt: string;
  recordedBy: string;
  /** Set together, only once released. Both stay null while HELD. */
  releasedAt: string | null;
  releasedBy: string | null;
}

export interface DiagnosticOrder {
  id: string;
  patientId: string;
  clinicianId: string;
  encounterId: string;
  kind: DiagnosticOrderKind;
  /** Free text, e.g. "Fasting blood glucose" or "Chest X-ray, PA view" — no formulary-style code list exists in this repo. */
  testName: string;
  status: DiagnosticOrderStatus;
  result: DiagnosticResult | null;
  /** Set together, only once cancelled; both stay null on an ORDERED or RESULTED order. */
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * `patientId` is deliberately absent, the same precedent
 * `OpenPrescriptionInput` set immediately above: the API boundary derives it
 * from the `clinical-charting` encounter the order is placed against.
 */
export interface OrderDiagnosticInput {
  clinicianId: string;
  kind: DiagnosticOrderKind;
  testName: string;
}

export interface RecordDiagnosticResultInput {
  resultSource: DiagnosticResultSource;
  value: string;
  recordedBy: string;
}

/* ------------------------------------------------------------------ *
 * Teleconsultation (clinical-suite.md capability map row 9)
 *
 * "Telehealth ... WebRTC. Already stubbed in apps/mobile." That stub —
 * `apps/mobile/app/consultation.tsx` — is real camera-permission UI with no
 * networking of any kind behind it; its own on-screen copy says so
 * outright: "No clinician, recording, signaling server, or WebRTC provider
 * is connected." README.md's explicit exclusion list agrees: "real
 * clinician-to-patient WebRTC ... planned modules — not operational
 * integrations." So `connectionMode` is a caller-supplied field the same
 * way row 7's `resultSource` is: `'WEBRTC'` is a real value the type
 * accepts for when that infrastructure exists, but nothing in this
 * codebase ever sets it today — every session scheduled here is honestly
 * `'MOCK'`.
 *
 * A session is scheduled against an existing `scheduling` appointment, the
 * same precedent row 6/7 set for placing a clinical action against a
 * `clinical-charting` encounter — there is no patient-reported session with
 * no appointment behind it. `patientId`/`clinicianId` are therefore derived
 * from the appointment rather than caller-supplied (see
 * `apps/api/src/teleconsultation/teleconsultation.service.ts`), so
 * `scheduleTeleconsultation` below takes them as plain parameters rather
 * than an `Input` object with nothing left to put in it.
 *
 * The lifecycle is SCHEDULED -> ACTIVE -> COMPLETED, with SCHEDULED also
 * reachable to CANCELLED or NO_SHOW. Unlike row 7's ORDERED -> RESULTED |
 * CANCELLED shape, a session that has gone ACTIVE can no longer be
 * cancelled or marked no-show — once two people are in the room, the only
 * honest forward transition is completing it.
 * ------------------------------------------------------------------ */
export type TeleconsultationSessionStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type TeleconsultationConnectionMode = 'MOCK' | 'WEBRTC';

export interface TeleconsultationSession {
  id: string;
  patientId: string;
  clinicianId: string;
  appointmentId: string;
  status: TeleconsultationSessionStatus;
  /** Always `'MOCK'` — see this section's own comment. */
  connectionMode: TeleconsultationConnectionMode;
  startedAt: string | null;
  endedAt: string | null;
  /** Set together, only once cancelled; both stay null otherwise. */
  cancelledAt: string | null;
  cancelReason: string | null;
  /** Set only by `markTeleconsultationNoShow`; stays null otherwise. */
  noShowAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/* ------------------------------------------------------------------ *
 * Billing (clinical-suite.md capability map row 10)
 *
 * "Billing, claims, revenue cycle ... Nepal: cash, insurance boards, NHIF.
 * Not X12." clinical-suite.md §1 is explicit that this module carries the
 * same financial-liability weight prescribing does and that
 * `docs/compliance/` must lead it, not trail it. The compliance gap
 * register's "Payments/refunds" row names its own interim engineering
 * control before finance/legal sign-off exists: "configurable ledger; mock
 * provider." Both are load-bearing in the types below, not aspirational
 * comments:
 *
 * - The ledger is `Invoice.lineItems`, each entry independently carrying
 *   one of the three payer channels the capability map note itself names —
 *   `'CASH' | 'INSURANCE' | 'NHIF'` — so one invoice can honestly split a
 *   bill across channels (a co-pay, say) rather than forcing one payer per
 *   invoice.
 * - `PaymentRecord.provider` is a single-literal `'MOCK'` type, unlike row
 *   7's `resultSource` and row 9's `connectionMode`, which are each a union
 *   with a second "real" value the rest of this codebase never constructs.
 *   Those two had textual grounding for what the real value would be ("HL7
 *   v2 where partners speak it", "WebRTC. Already stubbed in
 *   apps/mobile") — nothing in this repository names what a real Nepali
 *   payment settlement integration would be, and guessing one would invent
 *   a partner this repo has never mentioned, which the standing constraints
 *   forbid. `recordPayment` in `packages/billing` is the only way to mark
 *   an invoice PAID, and it always records `'MOCK'` — no money moves.
 *
 * Every invoice is opened against a `clinical-charting` encounter, the same
 * precedent rows 6/7 set for prescriptions and diagnostic orders.
 *
 * The lifecycle is DRAFT -> ISSUED -> PAID, with DRAFT and ISSUED both also
 * reachable to VOID. Once PAID, an invoice cannot be voided: reversing a
 * paid invoice is a refund, and the compliance register's own "taxes,
 * settlement, consumer protection" unresolved decision on that row means no
 * refund path exists here to reverse honestly. Line items may only be added
 * while DRAFT; issuing locks them, the same "sign and lock" property
 * `Prescription`'s SIGNED state and `Encounter`'s CLOSED state already
 * established.
 * ------------------------------------------------------------------ */
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID';

export type BillingPayerType = 'CASH' | 'INSURANCE' | 'NHIF';

export interface BillingLineItem {
  id: string;
  description: string;
  amountPaisa: number;
  payerType: BillingPayerType;
}

export interface BillingLineItemInput {
  description: string;
  amountPaisa: number;
  payerType: BillingPayerType;
}

/** Always `'MOCK'` — see this section's own comment on why no second value is declared. */
export type PaymentProvider = 'MOCK';

export interface PaymentRecord {
  provider: PaymentProvider;
  reference: string;
  paidAt: string;
  recordedBy: string;
}

export interface Invoice {
  id: string;
  patientId: string;
  clinicianId: string;
  encounterId: string;
  status: InvoiceStatus;
  lineItems: readonly BillingLineItem[];
  /** Set only once issued; stays null on a DRAFT. */
  issuedAt: string | null;
  /** Set only once paid; stays null otherwise. */
  payment: PaymentRecord | null;
  /** Set together, only once voided; both stay null otherwise. */
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * `patientId` is deliberately absent, the same precedent
 * `OpenPrescriptionInput`/`OrderDiagnosticInput` set: the API boundary
 * derives it from the `clinical-charting` encounter the invoice is opened
 * against.
 */
export interface OpenInvoiceInput {
  clinicianId: string;
}

export interface RecordPaymentInput {
  reference: string;
  recordedBy: string;
}

/* ------------------------------------------------------------------ *
 * Referrals (clinical-suite.md capability map row 12)
 *
 * "Referral management ... Pairs with care-directory." `care-directory` is
 * a static, in-memory fictional demonstration registry (see
 * `packages/care-directory`) with no live counterpart on the other end to
 * accept or decline anything over a network — every referral outcome
 * recorded here is entered by the referring clinic's own staff, the same
 * "the system records an outcome reached through an unspecified real-world
 * channel" honesty row 10's `recordPayment` already established for a phone
 * call or a bank transfer it cannot see. `referredToEntityId` is a
 * `DirectoryEntity.id`, resolved through care-directory's own
 * `findDirectoryEntity` port (§2 rule 1) rather than trusted as an opaque
 * string nobody checked — see
 * `apps/api/src/referrals/referrals.service.ts`.
 *
 * Every referral is requested against an existing `clinical-charting`
 * encounter, the same precedent rows 6/7/9/10 set for placing a clinical
 * action against one; `patientId` is therefore derived rather than
 * caller-supplied.
 *
 * The lifecycle is REQUESTED -> ACCEPTED -> COMPLETED, with REQUESTED also
 * reachable to DECLINED or CANCELLED. Once ACCEPTED, the only forward
 * transition is COMPLETED — cancelling an agreement the target provider has
 * already accepted outside this system would misrepresent it, the same
 * reasoning row 9's ACTIVE session being uncancellable already established.
 * ------------------------------------------------------------------ */
export type ReferralStatus = 'REQUESTED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';

export interface Referral {
  id: string;
  patientId: string;
  clinicianId: string;
  encounterId: string;
  referredToEntityId: string;
  reason: string;
  status: ReferralStatus;
  /** Set only once accepted; stays null otherwise. */
  acceptedAt: string | null;
  /** Set together, only once declined; both stay null otherwise. */
  declinedAt: string | null;
  declineReason: string | null;
  /** Set together, only once cancelled; both stay null otherwise. */
  cancelledAt: string | null;
  cancelReason: string | null;
  /** Set only once completed; stays null otherwise. */
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * `patientId` is deliberately absent, the same precedent
 * `OpenPrescriptionInput`/`OpenInvoiceInput` set: the API boundary derives
 * it from the `clinical-charting` encounter the referral is requested
 * against.
 */
export interface RequestReferralInput {
  clinicianId: string;
  referredToEntityId: string;
  reason: string;
}

/* ------------------------------------------------------------------ *
 * Population health (clinical-suite.md capability map row 13)
 *
 * "Population health, registries, recall ... Reads from other modules;
 * never writes to them." Unlike every module built so far, this one owns no
 * schema namespace and no repository — §2 rule 1 ("a module owns its data")
 * has nothing to assign here, because there is no data to own. Every field
 * below is derived, at request time, from `clinical-summary` (row 4, the
 * problem/allergy/medication list) and `scheduling` (row 2, appointments).
 *
 * No recall interval, condition list or clinical guideline is hardcoded
 * anywhere in this package or `packages/population-health` — "diabetics
 * should be recalled every 90 days" is exactly the kind of clinical claim
 * agent-progress.md's "invent no facts" constraint forbids fabricating, the
 * same way a fake statistic would be. `kind`/`label` (which condition,
 * allergy or medication defines the registry) and `asOf` (the recall cutoff
 * instant) are therefore always caller-supplied, never defaulted to a
 * guessed clinical value.
 * ------------------------------------------------------------------ */
export interface PopulationHealthRegistryEntry {
  patientId: string;
  /** The ClinicalSummaryItem that qualified this patient for the registry. */
  matchedItemId: string;
  /** The matched item's own label, exact as recorded — not the normalised match key. */
  label: string;
}

export interface PopulationHealthRecallEntry extends PopulationHealthRegistryEntry {
  /** The soonest SCHEDULED appointment at or after `asOf`, or null if none exists. */
  nextScheduledAppointmentAt: string | null;
  /** True exactly when `nextScheduledAppointmentAt` is null — named for what a caller actually asks. */
  dueForRecall: boolean;
}

/* ------------------------------------------------------------------ *
 * Analytics (clinical-suite.md capability map row 14)
 *
 * "Analytics and dashboards ... Read-only replica. Must never slow the
 * clinical path." Owns no schema namespace, the same reasoning as
 * population-health (row 13): every count below is computed at request time
 * from another module's already-persisted list, never duplicated into a
 * store this module maintains itself. Unlike population-health, each
 * summary here depends on exactly one source module, so one source being
 * unavailable only hides the section derived from it, never the others —
 * see apps/api/src/analytics/analytics.service.ts.
 *
 * No target, benchmark or "normal" range is defined anywhere in this
 * package or `packages/analytics`. A count is a fact already in the
 * record; a figure to compare it against is not, and inventing one would be
 * exactly the kind of fabricated statistic the standing constraints forbid.
 * ------------------------------------------------------------------ */
export interface PatientRegistrySummary {
  totalPatients: number;
  bySex: Record<PatientSex, number>;
}

export interface SchedulingSummary {
  totalAppointments: number;
  byStatus: Record<AppointmentStatus, number>;
}

/**
 * Deliberately a count of invoices by status, not a revenue figure. Summing
 * `amountPaisa` across line items would report money moved, which is a
 * different, higher-stakes claim than "this many invoices exist" and this
 * module has no reconciliation step to stand behind it — a future run can
 * add a revenue summary once one does.
 */
export interface BillingSummary {
  totalInvoices: number;
  byStatus: Record<InvoiceStatus, number>;
}

export interface ReferralsSummary {
  totalReferrals: number;
  byStatus: Record<ReferralStatus, number>;
}

/**
 * Defined here rather than beside `EngagementMessage` below because it
 * belongs to row 14 (analytics), not row 15 (engagement) — `EngagementMessage`
 * happens to be declared later in this file, but a type's row of origin, not
 * its declaration order, decides which section it lives in.
 */
export interface EngagementSummary {
  totalMessages: number;
  byStatus: Record<EngagementMessageStatus, number>;
}

/* ------------------------------------------------------------------ *
 * Engagement (clinical-suite.md capability map row 15)
 *
 * "Patient messaging, reminders ... SMS/WhatsApp. QUEUE_AND_RETRY by
 * nature." Unlike row 10's `PaymentProvider` ('MOCK' only — see that
 * section's own comment on why no real provider is named there), the
 * capability map names its two real channels directly, so `channel` is a
 * real union the same way row 7's `resultSource` and row 9's
 * `connectionMode` are: `apps/api/src/engagement/delivery-provider.ts`'s
 * `MockEngagementDeliveryProvider` is the only adapter this repo ships
 * today (mirroring `apps/api/src/auth/sms-provider.ts`, already built for
 * OTP delivery), not a claim that a real gateway is connected.
 *
 * Every message is queued against an existing `patient-registry` record —
 * sending needs a phone number, resolved through that module's own port,
 * the same "opening a clinical action against an existing foundation"
 * shape rows 6/7/10/12 already established for `clinical-charting`.
 * `patientId` is caller-supplied (unlike those rows' encounter-derived id)
 * because `patient-registry`, not `clinical-charting`, is the foundation
 * being opened against here. `phone` is captured from that record at queue
 * time and carried on the message itself, rather than re-resolved on every
 * retry — a queued message has a fixed destination, and re-deriving it
 * would make `retryMessage` depend on `patient-registry` staying up too,
 * the same "terminal transitions do not touch the dependency that opened
 * the record" precedent row 12's `acceptReferral`/`completeReferral`
 * already set for `clinical-charting`.
 *
 * "QUEUE_AND_RETRY by nature" is read literally: queuing a message always
 * succeeds — `queueMessage` never throws because a delivery attempt
 * failed — and a delivery attempt is made immediately, recording SENT or
 * FAILED rather than leaving the caller to guess. A FAILED message can be
 * retried, which re-attempts delivery. There is no DELIVERED status:
 * no adapter here, mock or real, has a delivery receipt to report, so SENT
 * (this system handed the message to a channel) is the honest limit of
 * what can be confirmed — the same restraint row 10's "count of invoices,
 * not a revenue figure" comment applies to a different unverifiable claim.
 * ------------------------------------------------------------------ */
export type EngagementChannel = 'SMS' | 'WHATSAPP';

/** "Patient messaging" and "reminders" are the two things row 15 names — nothing more specific is invented. */
export type EngagementMessageKind = 'REMINDER' | 'GENERAL';

export type EngagementMessageStatus = 'QUEUED' | 'SENT' | 'FAILED';

export interface EngagementMessage {
  id: string;
  patientId: string;
  /** The destination captured from patient-registry at queue time — see this section's header comment on why. */
  phone: string;
  channel: EngagementChannel;
  kind: EngagementMessageKind;
  body: string;
  status: EngagementMessageStatus;
  /** Delivery attempts made so far, including the queue-time attempt and every retry. */
  attemptCount: number;
  /** Set once a delivery attempt succeeds; stays null otherwise. Terminal — a SENT message is never retried. */
  sentAt: string | null;
  /** Set by the most recent failed attempt; cleared by `retryMessage` back to null while the retry is pending. */
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface QueueEngagementMessageInput {
  channel: EngagementChannel;
  kind: EngagementMessageKind;
  body: string;
}

/* ------------------------------------------------------------------ *
 * Immunization (clinical-suite.md capability map row 18)
 *
 * "Immunization records ... Nepal EPI schedule, not US registries." No
 * real Nepal EPI schedule dataset — vaccine names, dose intervals, due-date
 * rules — exists anywhere in this repo. Row 6's own section comment names
 * the identical gap for the Nepali formulary and, per that precedent
 * (`apps/api/src/prescribing/` builds the prescribing workflow with no
 * drug data loaded), this module records what a patient or clinician
 * actually enters rather than validating or auto-scheduling against a
 * catalogue this codebase has no honest source for. `vaccineName` is
 * therefore free text, not an enum.
 *
 * The provenance/verification split mirrors row 4's `ClinicalSummaryItem`
 * exactly — a patient's own report of a past immunization is
 * `PATIENT_REPORTED`/`UNVERIFIED`, one a clinician enters during an open
 * `clinical-charting` encounter is `CLINICIAN_ADMINISTERED`/
 * `CLINICIAN_VERIFIED` — applied to a single kind rather than three, so
 * there is no `kind` field here the way `ClinicalSummaryItem` has one.
 * `administeredOn` (the date the dose was actually given) is kept separate
 * from `recordedAt` (when this system learned about it) because the two
 * regularly differ for a patient-reported entry describing a childhood
 * vaccination.
 * ------------------------------------------------------------------ */
export type ImmunizationProvenance = 'PATIENT_REPORTED' | 'CLINICIAN_ADMINISTERED';

export type ImmunizationVerification = 'UNVERIFIED' | 'CLINICIAN_VERIFIED';

/**
 * A record stands until it is `VOIDED` — there is no "resolved" state the
 * way a problem or an allergy has one; an administered dose is a fact about
 * the past, not an ongoing condition. `VOIDED` exists for the mundane
 * real-world case of a mis-entered record (wrong patient, wrong vaccine),
 * carrying a reason the same way `Referral`'s decline/cancel do.
 */
export type ImmunizationStatus = 'ACTIVE' | 'VOIDED';

export interface ImmunizationRecord {
  id: string;
  patientId: string;
  vaccineName: string;
  /** 1-indexed dose in whatever series the caller is tracking (e.g. 1st, 2nd booster) — this module does not validate it against a schedule. */
  doseNumber: number;
  /** ISO date the dose was actually given, distinct from `recordedAt`. */
  administeredOn: string;
  provenance: ImmunizationProvenance;
  verification: ImmunizationVerification;
  /** Set together, only for a clinician-administered record; both null for a patient-reported one. */
  administeredByEncounterId: string | null;
  administeredByClinicianId: string | null;
  status: ImmunizationStatus;
  voidReason: string | null;
  recordedAt: string;
  updatedAt: string;
  version: number;
}

export interface RecordPatientReportedImmunizationInput {
  patientId: string;
  vaccineName: string;
  doseNumber: number;
  administeredOn: string;
}

/**
 * `patientId` and `encounterId` are deliberately absent here, mirroring
 * `RecordClinicianSummaryItemInput`: the API boundary derives both from the
 * `clinical-charting` encounter the record is authored against, rather than
 * trusting a client-supplied `patientId` that could disagree with it.
 */
export interface RecordClinicianAdministeredImmunizationInput {
  clinicianId: string;
  vaccineName: string;
  doseNumber: number;
  administeredOn: string;
}
