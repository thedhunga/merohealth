import { submitApplication } from '@swasthya/credentialing';
import type { CouncilKey, CredentialingApplication } from '@swasthya/shared-types';

import { generateLocalId } from '@/lib/local-id';

/**
 * Builds a brand-new council application and immediately submits it, purely
 * client-side. `apps/web` has no backend and no credentialing-evidence
 * storage adapter yet (both named as open gaps in `agent-progress.md`), so
 * this stands in for the service layer that would normally assign an id,
 * upload the photographs, and persist the record — it goes exactly as far as
 * `packages/credentialing` allows and no further: the returned application is
 * a real `EVIDENCE_SUBMITTED` record built with the same `submitApplication`
 * a future API would call, it just has nowhere to send it yet.
 */
export function submitNewClinicianApplication({
  council,
  registrationNumber,
  certificateFileName,
  identityFileName,
  submittedAt,
}: {
  council: CouncilKey;
  registrationNumber: string;
  certificateFileName: string;
  identityFileName: string;
  submittedAt: string;
}): CredentialingApplication {
  const notStarted: CredentialingApplication = {
    id: generateLocalId('application'),
    applicantId: generateLocalId('applicant'),
    council,
    registrationNumber,
    status: 'NOT_STARTED',
    certificateImageRef: null,
    identityImageRef: null,
    submittedAt: null,
    rejectionReason: null,
    reviewerId: null,
    decidedAt: null,
  };

  return submitApplication(
    notStarted,
    council,
    registrationNumber,
    // `local-file:` marks this as a reference to a file that only ever lived
    // in this browser tab, not a real uploaded object — so nothing
    // downstream mistakes it for one once a real storage adapter exists.
    `local-file:${certificateFileName}`,
    `local-file:${identityFileName}`,
    submittedAt,
  );
}
