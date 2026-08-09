import { describe, expect, it } from 'vitest';
import type { PatientDemographics } from '@swasthya/shared-types';
import { FutureDateOfBirthError, registerPatient, updateDemographics } from './index';

const NOW = '2026-08-09T12:00:00.000Z';

function makeDemographics(overrides: Partial<PatientDemographics> = {}): PatientDemographics {
  return {
    displayName: 'Sita Rai',
    dateOfBirth: '1990-04-12',
    sex: 'FEMALE',
    phone: '9800000000',
    preferredLocale: 'ne',
    ...overrides,
  };
}

describe('registerPatient', () => {
  it('constructs a version-1 record stamped with the given id and clock', () => {
    const record = registerPatient('patient-1', makeDemographics(), NOW);

    expect(record).toEqual({
      id: 'patient-1',
      demographics: makeDemographics(),
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
    });
  });

  it('rejects a birth date in the future', () => {
    expect(() => registerPatient('patient-1', makeDemographics({ dateOfBirth: '2099-01-01' }), NOW)).toThrow(
      FutureDateOfBirthError,
    );
  });

  it('accepts a birth date of today', () => {
    expect(() => registerPatient('patient-1', makeDemographics({ dateOfBirth: '2026-08-09' }), NOW)).not.toThrow();
  });
});

describe('updateDemographics', () => {
  it('merges a partial patch, leaving unspecified fields unchanged', () => {
    const record = registerPatient('patient-1', makeDemographics(), NOW);
    const later = '2026-09-01T00:00:00.000Z';

    const updated = updateDemographics(record, { phone: '9811111111' }, later);

    expect(updated.demographics).toEqual(makeDemographics({ phone: '9811111111' }));
    expect(updated.demographics.displayName).toBe('Sita Rai');
  });

  it('bumps version and updatedAt, and leaves createdAt untouched', () => {
    const record = registerPatient('patient-1', makeDemographics(), NOW);
    const later = '2026-09-01T00:00:00.000Z';

    const updated = updateDemographics(record, { displayName: 'Sita Rai Thapa' }, later);

    expect(updated.version).toBe(2);
    expect(updated.updatedAt).toBe(later);
    expect(updated.createdAt).toBe(NOW);
  });

  it('rejects a patch that moves the birth date into the future', () => {
    const record = registerPatient('patient-1', makeDemographics(), NOW);

    expect(() => updateDemographics(record, { dateOfBirth: '2099-01-01' }, '2026-09-01T00:00:00.000Z')).toThrow(
      FutureDateOfBirthError,
    );
  });

  it('does not mutate the original record', () => {
    const record = registerPatient('patient-1', makeDemographics(), NOW);

    updateDemographics(record, { phone: '9811111111' }, '2026-09-01T00:00:00.000Z');

    expect(record.demographics.phone).toBe('9800000000');
    expect(record.version).toBe(1);
  });
});
