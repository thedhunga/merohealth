import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { createClinicalChartingModuleDescriptor } from '../clinical-charting/clinical-charting.module-descriptor.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { createHealthRecordsModuleDescriptor } from '../records/records.module-descriptor.js';
import { RecordsService } from '../records/records.service.js';
import { createDiagnosticsOrdersModuleDescriptor } from './diagnostics-orders.module-descriptor.js';
import { DiagnosticsOrdersRepository } from './diagnostics-orders.repository.js';
import { DiagnosticsOrdersService } from './diagnostics-orders.service.js';

function buildStack() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  return { documents, charting };
}

const orderInput = { clinicianId: 'clinician-1', kind: 'LAB' as const, testName: 'Fasting blood glucose' };

/**
 * §2 rule 5, "the shell renders around holes," demonstrated against a real
 * thrown error, same shape `PrescribingRepository`'s own
 * `BrokenPrescribingRepository` already used.
 */
class BrokenDiagnosticsOrdersRepository extends DiagnosticsOrdersRepository {
  override save(): never {
    throw new Error('simulated store outage');
  }
}

describe('diagnostics-orders fault isolation', () => {
  it('a broken diagnostics-orders repository does not take clinical-charting down with it', async () => {
    const { charting } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const broken = new DiagnosticsOrdersService(new BrokenDiagnosticsOrdersRepository(), charting);
    await expect(broken.orderDiagnostic(encounter.id, orderInput)).rejects.toThrow('simulated store outage');

    // clinical-charting keeps working — the outage is confined to
    // diagnostics-orders' own storage.
    expect(charting.getEncounter(encounter.id).status).toBe('OPEN');
  });

  it('resolveAvailability marks DIAGNOSTICS_ORDERS available but HIDE-degraded when CLINICAL_CHARTING is DOWN', async () => {
    const { documents, charting } = buildStack();
    const diagnosticsOrders = new DiagnosticsOrdersService(new DiagnosticsOrdersRepository(), charting);

    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const forcedDownChartingDescriptor = {
      ...createClinicalChartingModuleDescriptor(charting),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const diagnosticsOrdersDescriptor = createDiagnosticsOrdersModuleDescriptor(diagnosticsOrders);

    const registry = buildModuleRegistry([recordsDescriptor, forcedDownChartingDescriptor, diagnosticsOrdersDescriptor]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('CLINICAL_CHARTING')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('DIAGNOSTICS_ORDERS')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
  });

  it('behaviourally: refuses to place an order while clinical-charting is down, and resumes once it recovers', async () => {
    const { charting } = buildStack();
    const diagnosticsOrders = new DiagnosticsOrdersService(new DiagnosticsOrdersRepository(), charting);
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(diagnosticsOrders.orderDiagnostic(encounter.id, orderInput)).rejects.toThrow('clinical-charting is down');

    charting.health = () => Promise.resolve({ status: 'UP' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);
    expect(order.status).toBe('ORDERED');
  });

  it('behaviourally: recording and releasing a result stay available while clinical-charting is down', async () => {
    const { charting } = buildStack();
    const diagnosticsOrders = new DiagnosticsOrdersService(new DiagnosticsOrdersRepository(), charting);
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);

    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    const resulted = diagnosticsOrders.recordResult(order.id, {
      resultSource: 'MANUAL',
      value: '5.4 mmol/L',
      recordedBy: 'clinician-1',
    });
    expect(resulted.result?.releaseStatus).toBe('HELD');

    const released = diagnosticsOrders.releaseResult(order.id, 'clinician-2');
    expect(released.result?.releaseStatus).toBe('RELEASED');
  });
});
