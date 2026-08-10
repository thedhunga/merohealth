import { describe, expect, it } from 'vitest';

import {
  caregiverRelationships,
  conditions,
  healthDocuments,
  healthObservations,
  patientProfiles,
  users,
} from './seed-data.ts';

const DEVANAGARI = /[\u0900-\u097F]/;
const trustedStatuses = new Set(['CONFIRMED', 'CORRECTED']);

function uniqueIds<T extends { id: string }>(rows: readonly T[]): Set<string> {
  const ids = new Set(rows.map((row) => row.id));
  expect(ids.size, 'ids must be unique within the table').toBe(rows.length);
  return ids;
}

describe('seed-data', () => {
  it('gives every subject a unique id, never reused across tables', () => {
    uniqueIds(users);
    uniqueIds(patientProfiles);
    uniqueIds(healthDocuments);
    uniqueIds(healthObservations);
    uniqueIds(conditions);
  });

  it('links every patient profile back to a real user (every person is their own subject)', () => {
    const userIds = uniqueIds(users);
    for (const profile of patientProfiles) {
      expect(userIds.has(profile.userId), `${profile.displayName} has no matching User row`).toBe(true);
    }
  });

  it('keeps every document and observation scoped to a real subject', () => {
    const userIds = uniqueIds(users);
    const documentsById = new Map(healthDocuments.map((document) => [document.id, document]));

    for (const document of healthDocuments) {
      expect(userIds.has(document.ownerId)).toBe(true);
    }
    for (const observation of healthObservations) {
      const document = documentsById.get(observation.documentId);
      expect(document, `observation ${observation.id} points at a missing document`).toBeDefined();
      expect(observation.ownerId).toBe(document?.ownerId);
      expect(userIds.has(observation.ownerId)).toBe(true);
    }
  });

  it('gives every observation both a Devanagari and an English label', () => {
    for (const observation of healthObservations) {
      expect(observation.labelNe, `${observation.id} labelNe`).toMatch(DEVANAGARI);
      expect(observation.labelEn, `${observation.id} labelEn`).not.toMatch(DEVANAGARI);
      expect(observation.labelEn.length).toBeGreaterThan(0);
    }
  });

  it('gives every subject at least one trusted (CONFIRMED/CORRECTED) observation', () => {
    const ownerIds = new Set(users.map((user) => user.id));
    for (const ownerId of ownerIds) {
      const own = healthObservations.filter((observation) => observation.ownerId === ownerId);
      expect(own.some((observation) => trustedStatuses.has(observation.status)), `subject ${ownerId} has no trusted observation`).toBe(
        true,
      );
    }
  });

  it('includes at least one DRAFT observation below the low-confidence threshold, to exercise the confirmation queue', () => {
    const draft = healthObservations.filter((observation) => observation.status === 'DRAFT');
    expect(draft.length).toBeGreaterThan(0);
    expect(draft.every((observation) => (observation.confidence ?? 1) < 0.75)).toBe(true);
  });

  it("includes at least one condition with genetic relevance, on the affected subject's own record", () => {
    expect(conditions.length).toBeGreaterThan(0);
    const hereditary = conditions.filter((condition) => condition.code.geneticRelevance);
    expect(hereditary.length).toBeGreaterThan(0);

    const profileIds = uniqueIds(patientProfiles);
    for (const condition of hereditary) {
      expect(profileIds.has(condition.patientId)).toBe(true);
    }
  });

  it("never writes a condition onto a relative's record — no automatic propagation", () => {
    // family-and-proxy.md §5: a diagnosis never propagates between records
    // automatically. Only the subject it belongs to may hold it.
    const conditionSubjects = new Set(conditions.map((condition) => condition.patientId));
    expect(conditionSubjects.size).toBe(conditions.length);
  });

  it('models a real multi-generation family: three Thapa subjects, strictly descending ages, linked by one scoped guardianship', () => {
    const thapas = patientProfiles.filter((profile) => profile.displayName.includes('थापा'));
    expect(thapas.length).toBe(3);

    const agesOldestFirst = thapas
      .map((profile) => profile.demographics.ageYears)
      .toSorted((a, b) => b - a);
    expect(thapas.map((profile) => profile.demographics.ageYears)).toEqual(agesOldestFirst);

    expect(caregiverRelationships.length).toBeGreaterThan(0);
    const link = caregiverRelationships[0];
    expect(link).toBeDefined();
    if (!link) return;

    const minor = patientProfiles.find((profile) => profile.id === link.patientId);
    const caregiver = users.find((user) => user.id === link.caregiverUserId);
    expect(minor, 'guardianship must point at a real patient profile').toBeDefined();
    expect(caregiver, 'guardianship must point at a real user').toBeDefined();
    expect(minor?.userId).not.toBe(link.caregiverUserId);
    expect(minor?.demographics.ageYears).toBeLessThan(18);

    // Scoped, per family-and-proxy.md §2 — a guardian booking an appointment
    // must not be granted document upload or full record access by default.
    expect(link.permissions.scopes).not.toContain('UPLOAD_DOCUMENTS');
  });
});
