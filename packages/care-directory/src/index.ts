import type { DirectoryEntity, DirectoryEntityType } from '@swasthya/shared-types';
export const fictionalDirectory: readonly DirectoryEntity[] = [
  { id: 'demo-hospital-1', type: 'HOSPITAL', name: 'Sajilo Community Hospital — Demo', nameNe: 'सजिलो सामुदायिक अस्पताल — नमुना', district: 'Kathmandu', municipality: 'Kathmandu Metropolitan', specialties: ['Emergency medicine', 'General medicine', 'Pediatrics'], languages: ['ne', 'en'], verification: 'VERIFIED', verifiedAt: '2026-07-15T00:00:00Z', dataAsOf: '2026-07-15T00:00:00Z', sourceLabel: 'Fictional demonstration registry', isFictionalDemo: true, supportsHomeService: false },
  { id: 'demo-doctor-1', type: 'SPECIALIST', name: 'Dr. Asha Karki — Demo', nameNe: 'डा. आशा कार्की — नमुना', district: 'Kathmandu', municipality: 'Kathmandu Metropolitan', specialties: ['Internal medicine'], languages: ['ne', 'en', 'ne-Latn'], verification: 'VERIFIED', verifiedAt: '2026-07-15T00:00:00Z', dataAsOf: '2026-07-15T00:00:00Z', sourceLabel: 'Fictional demonstration registry', isFictionalDemo: true, supportsHomeService: false },
  { id: 'demo-pharmacy-1', type: 'PHARMACY', name: 'Nawa Jeevan Pharmacy — Demo', nameNe: 'नव जीवन फार्मेसी — नमुना', district: 'Lalitpur', municipality: 'Lalitpur Metropolitan', specialties: ['Prescription fulfillment'], languages: ['ne', 'en'], verification: 'VERIFIED', verifiedAt: '2026-07-10T00:00:00Z', dataAsOf: '2026-07-10T00:00:00Z', sourceLabel: 'Fictional demonstration registry', isFictionalDemo: true, supportsHomeService: true },
  { id: 'demo-clinic-1', type: 'CLINIC', name: 'Seti Family Clinic — Demo', nameNe: 'सेती परिवार क्लिनिक — नमुना', district: 'Kailali', municipality: 'Dhangadhi Sub-Metropolitan', specialties: ['Family medicine', 'Maternal health'], languages: ['ne'], verification: 'REVIEWED', dataAsOf: '2026-06-30T00:00:00Z', sourceLabel: 'Fictional demonstration registry', isFictionalDemo: true, supportsHomeService: false },
  { id: 'demo-nurse-1', type: 'HOME_NURSE', name: 'Maya Home Nursing — Demo', nameNe: 'माया घर नर्सिङ — नमुना', district: 'Bhaktapur', municipality: 'Madhyapur Thimi', specialties: ['Wound care', 'Elder care'], languages: ['ne', 'en'], verification: 'VERIFIED', verifiedAt: '2026-07-20T00:00:00Z', dataAsOf: '2026-07-20T00:00:00Z', sourceLabel: 'Fictional demonstration registry', isFictionalDemo: true, supportsHomeService: true },
  { id: 'demo-lab-1', type: 'LABORATORY', name: 'Himal Diagnostics — Demo', nameNe: 'हिमाल डायग्नोस्टिक्स — नमुना', district: 'Kaski', municipality: 'Pokhara Metropolitan', specialties: ['Pathology', 'Home sample collection'], languages: ['ne', 'en'], verification: 'VERIFIED', verifiedAt: '2026-07-18T00:00:00Z', dataAsOf: '2026-07-18T00:00:00Z', sourceLabel: 'Fictional demonstration registry', isFictionalDemo: true, supportsHomeService: true },
];
export interface DirectoryQuery { text?: string; type?: DirectoryEntityType; district?: string; homeService?: boolean }
export function searchDirectory(query: DirectoryQuery): DirectoryEntity[] {
  const term = query.text?.trim().toLocaleLowerCase();
  return fictionalDirectory.filter((entity) => {
    if (query.type && entity.type !== query.type) return false;
    if (query.district && entity.district !== query.district) return false;
    if (query.homeService !== undefined && entity.supportsHomeService !== query.homeService) return false;
    return !term || [entity.name, entity.nameNe, entity.district, entity.municipality, ...entity.specialties].some((value) => value.toLocaleLowerCase().includes(term));
  });
}
/** care-directory's own port for resolving one entity by id — clinical-suite.md §2 rule 1, so `referrals` (row 12) does not reach into `fictionalDirectory` directly. */
export function findDirectoryEntity(id: string): DirectoryEntity | undefined {
  return fictionalDirectory.find((entity) => entity.id === id);
}
