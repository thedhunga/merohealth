import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { createClinicalChartingModuleDescriptor } from '../clinical-charting/clinical-charting.module-descriptor.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { createHealthRecordsModuleDescriptor } from '../records/records.module-descriptor.js';
import { RecordsService } from '../records/records.service.js';
import { createBillingModuleDescriptor } from './billing.module-descriptor.js';
import { BillingRepository } from './billing.repository.js';
import { BillingService } from './billing.service.js';

function buildStack() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  return { documents, charting };
}

const lineItemInput = { description: 'Outpatient consultation', amountPaisa: 150000, payerType: 'CASH' as const };

/**
 * §2 rule 5, "the shell renders around holes," demonstrated against a real
 * thrown error, same shape `DiagnosticsOrdersRepository`'s own
 * `BrokenDiagnosticsOrdersRepository` already used.
 */
class BrokenBillingRepository extends BillingRepository {
  override save(): never {
    throw new Error('simulated store outage');
  }
}

describe('billing fault isolation', () => {
  it('a broken billing repository does not take clinical-charting down with it', async () => {
    const { charting } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const broken = new BillingService(new BrokenBillingRepository(), charting);
    await expect(broken.openInvoice(encounter.id, { clinicianId: 'clinician-1' })).rejects.toThrow(
      'simulated store outage',
    );

    // clinical-charting keeps working — the outage is confined to
    // billing's own storage.
    expect(charting.getEncounter(encounter.id).status).toBe('OPEN');
  });

  it('resolveAvailability marks BILLING available but HIDE-degraded when CLINICAL_CHARTING is DOWN', async () => {
    const { documents, charting } = buildStack();
    const billing = new BillingService(new BillingRepository(), charting);

    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const forcedDownChartingDescriptor = {
      ...createClinicalChartingModuleDescriptor(charting),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const billingDescriptor = createBillingModuleDescriptor(billing);

    const registry = buildModuleRegistry([recordsDescriptor, forcedDownChartingDescriptor, billingDescriptor]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('CLINICAL_CHARTING')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('BILLING')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
  });

  it('behaviourally: refuses to open an invoice while clinical-charting is down, and resumes once it recovers', async () => {
    const { charting } = buildStack();
    const billing = new BillingService(new BillingRepository(), charting);
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(billing.openInvoice(encounter.id, { clinicianId: 'clinician-1' })).rejects.toThrow(
      'clinical-charting is down',
    );

    charting.health = () => Promise.resolve({ status: 'UP' });
    const invoice = await billing.openInvoice(encounter.id, { clinicianId: 'clinician-1' });
    expect(invoice.status).toBe('DRAFT');
  });

  it('behaviourally: adding a line item, issuing and recording payment stay available while clinical-charting is down', async () => {
    const { charting } = buildStack();
    const billing = new BillingService(new BillingRepository(), charting);
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await billing.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    const withItem = billing.addLineItem(invoice.id, lineItemInput);
    expect(withItem.lineItems).toHaveLength(1);

    const issued = billing.issueInvoice(invoice.id);
    expect(issued.status).toBe('ISSUED');

    const paid = billing.recordPayment(invoice.id, { reference: 'receipt-001', recordedBy: 'clinician-1' });
    expect(paid.status).toBe('PAID');
  });
});
