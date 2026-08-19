import { describe, expect, it } from 'vitest';
import { DirectoryController } from './directory.controller.js';

describe('DirectoryController', () => {
  it('filters by a valid type', () => {
    const result = new DirectoryController().search(undefined, 'PHARMACY');
    expect(result.items.every((item) => item.type === 'PHARMACY')).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('ignores an unrecognised type instead of throwing, falling back to no filter', () => {
    const filtered = new DirectoryController().search(undefined, 'PHARMACY');
    const unfiltered = new DirectoryController().search(undefined, 'NOT_A_REAL_TYPE');
    expect(unfiltered.items.length).toBeGreaterThan(filtered.items.length);
  });

  it('combines text and type filters', () => {
    const result = new DirectoryController().search('फार्मेसी', 'PHARMACY');
    expect(result.items.every((item) => item.type === 'PHARMACY')).toBe(true);
  });

  it('reports total as the item count and always labels results fictional', () => {
    const result = new DirectoryController().search();
    expect(result.total).toBe(result.items.length);
    expect(result.dataClassification).toBe('FICTIONAL_DEMONSTRATION');
    expect(result.realTimeAvailability).toBe(false);
  });
});
