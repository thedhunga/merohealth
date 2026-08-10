import { describe, expect, it } from 'vitest';
import { MedicationSafetyRepository } from './medication-safety.repository.js';

describe('MedicationSafetyRepository.listInteractionRules', () => {
  it('starts empty — no licensed interaction dataset exists in this repository yet', () => {
    expect(new MedicationSafetyRepository().listInteractionRules()).toEqual([]);
  });
});
