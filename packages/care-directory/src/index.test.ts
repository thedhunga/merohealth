import { describe, expect, it } from 'vitest';
import { fictionalDirectory, findDirectoryEntity, searchDirectory } from './index';
describe('care directory', () => {
  it('labels every seed as fictional', () => expect(fictionalDirectory.every((item) => item.isFictionalDemo)).toBe(true));
  it('finds home nursing separately', () => expect(searchDirectory({ type: 'HOME_NURSE', homeService: true })).toHaveLength(1));
  it('supports Nepali search', () => expect(searchDirectory({ text: 'फार्मेसी' })[0]?.type).toBe('PHARMACY'));
  it('matches on municipality, not only district', () => expect(searchDirectory({ text: 'Dhangadhi' })[0]?.type).toBe('CLINIC'));
  it('finds one entity by id and returns undefined for an unknown one', () => {
    expect(findDirectoryEntity('demo-hospital-1')?.type).toBe('HOSPITAL');
    expect(findDirectoryEntity('missing')).toBeUndefined();
  });
});
