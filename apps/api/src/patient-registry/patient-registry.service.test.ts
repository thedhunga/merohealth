import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PatientDemographics } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import { PatientRegistryRepository } from './patient-registry.repository.js';
import { PatientRegistryService } from './patient-registry.service.js';

const demographics: PatientDemographics = {
  displayName: 'Sita Rai',
  dateOfBirth: '1990-04-12',
  sex: 'FEMALE',
  phone: '9800000000',
  preferredLocale: 'ne',
};

function buildService() {
  return new PatientRegistryService(new PatientRegistryRepository());
}

describe('PatientRegistryService', () => {
  it('registers a patient with a fresh opaque id', () => {
    const service = buildService();
    const record = service.register(demographics);

    expect(record.id).toBeTruthy();
    expect(record.version).toBe(1);
    expect(record.demographics).toEqual(demographics);
  });

  it('two registrations receive distinct ids', () => {
    const service = buildService();
    const first = service.register(demographics);
    const second = service.register(demographics);

    expect(first.id).not.toBe(second.id);
  });

  it('reads back a registered patient by id', () => {
    const service = buildService();
    const record = service.register(demographics);

    expect(service.get(record.id)).toEqual(record);
  });

  it('404s reading an unknown patient', () => {
    const service = buildService();
    expect(() => service.get('missing')).toThrow(NotFoundException);
  });

  it('applies a partial demographics patch and bumps version', () => {
    const service = buildService();
    const record = service.register(demographics);

    const updated = service.updateDemographics(record.id, { phone: '9811111111' });

    expect(updated.demographics.phone).toBe('9811111111');
    expect(updated.demographics.displayName).toBe('Sita Rai');
    expect(updated.version).toBe(2);
  });

  it('404s updating an unknown patient', () => {
    const service = buildService();
    expect(() => service.updateDemographics('missing', { phone: '9811111111' })).toThrow(NotFoundException);
  });

  it('rejects registering a future birth date, as a 400 with a code', () => {
    const service = buildService();

    try {
      service.register({ ...demographics, dateOfBirth: '2099-01-01' });
      expect.unreachable('expected register to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'FutureDateOfBirthError' });
    }
  });

  it('rejects a demographics patch that moves the birth date into the future, as a 400 with a code', () => {
    const service = buildService();
    const record = service.register(demographics);

    try {
      service.updateDemographics(record.id, { dateOfBirth: '2099-01-01' });
      expect.unreachable('expected updateDemographics to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'FutureDateOfBirthError' });
    }
  });

  it('reports UP with no failure mode of its own', async () => {
    const service = buildService();
    await expect(service.health()).resolves.toEqual({ status: 'UP' });
  });
});
