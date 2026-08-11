import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { createClinicalChartingModuleDescriptor } from '../clinical-charting/clinical-charting.module-descriptor.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { createHealthRecordsModuleDescriptor } from '../records/records.module-descriptor.js';
import { RecordsService } from '../records/records.service.js';
import { createReferralsModuleDescriptor } from './referrals.module-descriptor.js';
import { ReferralsRepository } from './referrals.repository.js';
import { ReferralsService } from './referrals.service.js';

function buildStack() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  return { documents, charting };
}

const requestInput = { clinicianId: 'clinician-1', referredToEntityId: 'demo-doctor-1', reason: 'Suspected renal involvement' };

/**
 * §2 rule 5, "the shell renders around holes," demonstrated against a real
 * thrown error, same shape `BillingRepository`'s own `BrokenBillingRepository`
 * already used.
 */
class BrokenReferralsRepository extends ReferralsRepository {
  override save(): never {
    throw new Error('simulated store outage');
  }
}

describe('referrals fault isolation', () => {
  it('a broken referrals repository does not take clinical-charting down with it', async () => {
    const { charting } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const broken = new ReferralsService(new BrokenReferralsRepository(), charting);
    await expect(broken.requestReferral(encounter.id, requestInput)).rejects.toThrow('simulated store outage');

    // clinical-charting keeps working — the outage is confined to
    // referrals' own storage.
    expect(charting.getEncounter(encounter.id).status).toBe('OPEN');
  });

  it('resolveAvailability marks REFERRALS available but HIDE-degraded when CLINICAL_CHARTING is DOWN', async () => {
    const { documents, charting } = buildStack();
    const referrals = new ReferralsService(new ReferralsRepository(), charting);

    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const forcedDownChartingDescriptor = {
      ...createClinicalChartingModuleDescriptor(charting),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const referralsDescriptor = createReferralsModuleDescriptor(referrals);

    const registry = buildModuleRegistry([recordsDescriptor, forcedDownChartingDescriptor, referralsDescriptor]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('CLINICAL_CHARTING')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('REFERRALS')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
  });

  it('behaviourally: refuses to request a referral while clinical-charting is down, and resumes once it recovers', async () => {
    const { charting } = buildStack();
    const referrals = new ReferralsService(new ReferralsRepository(), charting);
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(referrals.requestReferral(encounter.id, requestInput)).rejects.toThrow('clinical-charting is down');

    charting.health = () => Promise.resolve({ status: 'UP' });
    const referral = await referrals.requestReferral(encounter.id, requestInput);
    expect(referral.status).toBe('REQUESTED');
  });

  it('behaviourally: accepting and completing a referral stay available while clinical-charting is down', async () => {
    const { charting } = buildStack();
    const referrals = new ReferralsService(new ReferralsRepository(), charting);
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await referrals.requestReferral(encounter.id, requestInput);

    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    const accepted = referrals.acceptReferral(referral.id);
    expect(accepted.status).toBe('ACCEPTED');

    const completed = referrals.completeReferral(referral.id);
    expect(completed.status).toBe('COMPLETED');
  });
});
