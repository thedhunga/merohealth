import type { PatientDemographics, PatientDemographicsPatch, PatientRecord } from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Patient registry
 *
 * clinical-suite.md capability map row 1: "Patient registration,
 * demographics ... Foundation. Owns identity; others reference by id
 * only." This package's entire job is constructing and updating that one
 * identity record — it declares no `requires`/`degradesWith` of its own
 * (see `apps/api/src/patient-registry/patient-registry.module-descriptor.ts`)
 * because everything else in the capability map depends on this module,
 * never the other way around.
 * ------------------------------------------------------------------ */

export class FutureDateOfBirthError extends Error {
  constructor(dateOfBirth: string) {
    super(`Date of birth ${dateOfBirth} is in the future`);
    this.name = 'FutureDateOfBirthError';
  }
}

/**
 * The one demographic fact worth validating in this domain layer rather than
 * leaving entirely to the API boundary's shape checks: a birth date in the
 * future is never merely malformed input, it is impossible. `now` is a
 * required argument rather than read from `Date.now()` here, matching every
 * other domain package in this repo — clock reads happen at the boundary.
 */
function assertPlausibleDateOfBirth(dateOfBirth: string, now: string): void {
  if (dateOfBirth > now.slice(0, 10)) throw new FutureDateOfBirthError(dateOfBirth);
}

export function registerPatient(id: string, demographics: PatientDemographics, now: string): PatientRecord {
  assertPlausibleDateOfBirth(demographics.dateOfBirth, now);
  return { id, demographics, createdAt: now, updatedAt: now, version: 1 };
}

/**
 * `updates` is a partial patch, not a full replacement — an omitted (or
 * explicitly `undefined`) field keeps its existing value. Merged field by
 * field with `??` rather than an object spread: `PatientDemographicsPatch`
 * types every field as possibly `undefined` even when present (to match
 * zod's own `.partial()` output under `exactOptionalPropertyTypes`), and a
 * spread would let a present-but-undefined key silently blank out a field a
 * caller never meant to touch.
 */
export function updateDemographics(
  record: PatientRecord,
  updates: PatientDemographicsPatch,
  now: string,
): PatientRecord {
  const current = record.demographics;
  const demographics: PatientDemographics = {
    displayName: updates.displayName ?? current.displayName,
    dateOfBirth: updates.dateOfBirth ?? current.dateOfBirth,
    sex: updates.sex ?? current.sex,
    phone: updates.phone ?? current.phone,
    preferredLocale: updates.preferredLocale ?? current.preferredLocale,
    address: updates.address ?? current.address,
  };
  assertPlausibleDateOfBirth(demographics.dateOfBirth, now);
  return { ...record, demographics, updatedAt: now, version: record.version + 1 };
}
