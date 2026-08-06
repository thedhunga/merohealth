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
