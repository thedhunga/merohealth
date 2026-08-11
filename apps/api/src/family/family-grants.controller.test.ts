import { grantDelegation } from '@swasthya/family';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { FamilyGrantsController } from './family-grants.controller.js';
import { FamilyGrantsService } from './family-grants.service.js';
import { InMemoryFamilyGrantsStore } from './in-memory-family-grants.store.js';

function currentUser(subjectId: string): CurrentUserResult {
  return {
    subjectId,
    user: { id: subjectId, phone: null, role: 'PATIENT', locale: 'ne' },
    patientProfileId: null,
    assuranceLevel: 'REGISTERED',
  };
}

describe('FamilyGrantsController', () => {
  it('reads the subject id from @CurrentUser(), never from a request parameter', async () => {
    const delegation = grantDelegation('d-1', 'janaki', 'sunita', ['VIEW_RECORD'], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z');
    const controller = new FamilyGrantsController(new FamilyGrantsService(new InMemoryFamilyGrantsStore([], [delegation])));

    // The same account id asked as someone else must never see `janaki`'s
    // grant to `sunita` — this is the cross-owner failure the records
    // module's own guard exists to rule out, exercised here for the first
    // caller of this endpoint.
    expect(await controller.grantsForCurrentUser(currentUser('sunita'))).toEqual({
      guardianships: [],
      delegations: [delegation],
    });
    expect(await controller.grantsForCurrentUser(currentUser('someone-else'))).toEqual({
      guardianships: [],
      delegations: [],
    });
  });
});
