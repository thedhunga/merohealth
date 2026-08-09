import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PatientRegistryController } from './patient-registry.controller.js';
import { PatientRegistryRepository } from './patient-registry.repository.js';
import { PatientRegistryService } from './patient-registry.service.js';

function buildController() {
  return new PatientRegistryController(new PatientRegistryService(new PatientRegistryRepository()));
}

const validDemographics = {
  displayName: 'Sita Rai',
  dateOfBirth: '1990-04-12',
  sex: 'FEMALE',
  phone: '9800000000',
  preferredLocale: 'ne',
};

describe('PatientRegistryController registration', () => {
  it('registers a patient from a valid body', () => {
    const controller = buildController();
    const record = controller.register(validDemographics);

    expect(record.demographics.displayName).toBe('Sita Rai');
  });

  it('accepts an optional address', () => {
    const controller = buildController();
    const record = controller.register({
      ...validDemographics,
      address: { district: 'Kathmandu', municipality: 'Kathmandu Metropolitan', ward: '10' },
    });

    expect(record.demographics.address).toEqual({
      district: 'Kathmandu',
      municipality: 'Kathmandu Metropolitan',
      ward: '10',
    });
  });

  it('rejects a request missing a required field', () => {
    const controller = buildController();
    expect(() => controller.register({ ...validDemographics, displayName: undefined })).toThrow(BadRequestException);
  });

  it('rejects a malformed date of birth', () => {
    const controller = buildController();
    expect(() => controller.register({ ...validDemographics, dateOfBirth: '12-04-1990' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects an unknown sex value rather than silently accepting it', () => {
    const controller = buildController();
    expect(() => controller.register({ ...validDemographics, sex: 'UNKNOWN' })).toThrow(BadRequestException);
  });
});

describe('PatientRegistryController read and update', () => {
  it('reads back a registered patient', () => {
    const controller = buildController();
    const record = controller.register(validDemographics);

    expect(controller.get(record.id).id).toBe(record.id);
  });

  it('404s a read for an unknown patient', () => {
    const controller = buildController();
    expect(() => controller.get('missing')).toThrow(NotFoundException);
  });

  it('updates demographics with a partial patch', () => {
    const controller = buildController();
    const record = controller.register(validDemographics);

    const updated = controller.updateDemographics(record.id, { phone: '9811111111' });

    expect(updated.demographics.phone).toBe('9811111111');
    expect(updated.demographics.displayName).toBe('Sita Rai');
  });

  it('rejects an update patch with an invalid field', () => {
    const controller = buildController();
    const record = controller.register(validDemographics);

    expect(() => controller.updateDemographics(record.id, { sex: 'UNKNOWN' })).toThrow(BadRequestException);
  });
});

describe('PatientRegistryController health', () => {
  it('reports UP', async () => {
    const controller = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});
