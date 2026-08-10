import { describe, expect, it } from 'vitest';

import { submitNewClinicianApplication } from '@/lib/clinician-application';

describe('submitNewClinicianApplication', () => {
  const application = submitNewClinicianApplication({
    council: 'NMC',
    registrationNumber: '12345',
    certificateFileName: 'certificate.jpg',
    identityFileName: 'citizenship.jpg',
    submittedAt: '2026-08-09T00:00:00.000Z',
  });

  it('produces an EVIDENCE_SUBMITTED application, never an auto-approved one', () => {
    expect(application.status).toBe('EVIDENCE_SUBMITTED');
    expect(application.reviewerId).toBeNull();
    expect(application.decidedAt).toBeNull();
  });

  it('carries the submitted council and registration number', () => {
    expect(application.council).toBe('NMC');
    expect(application.registrationNumber).toBe('12345');
    expect(application.submittedAt).toBe('2026-08-09T00:00:00.000Z');
  });

  it('marks both evidence refs as local, not real storage pointers', () => {
    expect(application.certificateImageRef).toBe('local-file:certificate.jpg');
    expect(application.identityImageRef).toBe('local-file:citizenship.jpg');
  });

  it('assigns distinct ids to the application and the applicant', () => {
    const other = submitNewClinicianApplication({
      council: 'NNC',
      registrationNumber: '999',
      certificateFileName: 'a.jpg',
      identityFileName: 'b.jpg',
      submittedAt: '2026-08-09T00:00:00.000Z',
    });
    expect(application.id).not.toBe(other.id);
    expect(application.id).not.toBe(application.applicantId);
  });
});
