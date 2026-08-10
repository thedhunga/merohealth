import type { HealthDocumentKind, LanguageCode } from '@swasthya/shared-types';

// Keyed by every `HealthDocumentKind` so a kind added upstream without a
// label here is a compile error, not a silently missing picker option.
const labels: Record<HealthDocumentKind, { ne: string; en: string }> = {
  LAB_REPORT: { ne: 'प्रयोगशाला रिपोर्ट', en: 'Lab report' },
  PRESCRIPTION: { ne: 'प्रेस्क्रिप्सन', en: 'Prescription' },
  IMAGING_REPORT: { ne: 'इमेजिङ रिपोर्ट', en: 'Imaging report' },
  DISCHARGE_SUMMARY: { ne: 'डिस्चार्ज सारांश', en: 'Discharge summary' },
  VACCINATION_RECORD: { ne: 'खोप रेकर्ड', en: 'Vaccination record' },
  CLINICAL_NOTE: { ne: 'क्लिनिकल नोट', en: 'Clinical note' },
  BILL: { ne: 'बिल', en: 'Bill' },
  OTHER: { ne: 'अन्य', en: 'Other' },
};

export interface DocumentKindOption {
  kind: HealthDocumentKind;
  label: string;
}

/** ne-Latn falls back to the Devanagari label, matching every other screen's `language === 'en' ? … : …` convention. */
export function documentKindLabel(kind: HealthDocumentKind, language: LanguageCode): string {
  return language === 'en' ? labels[kind].en : labels[kind].ne;
}

export function documentKindOptions(language: LanguageCode): readonly DocumentKindOption[] {
  return (Object.keys(labels) as HealthDocumentKind[]).map((kind) => ({
    kind,
    label: documentKindLabel(kind, language),
  }));
}
