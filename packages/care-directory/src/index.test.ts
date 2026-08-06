import { describe, expect, it } from 'vitest';
import { fictionalDirectory, searchDirectory } from './index';
describe('care directory', () => {
  it('labels every seed as fictional', () => expect(fictionalDirectory.every((item) => item.isFictionalDemo)).toBe(true));
  it('finds home nursing separately', () => expect(searchDirectory({ type: 'HOME_NURSE', homeService: true })).toHaveLength(1));
  it('supports Nepali search', () => expect(searchDirectory({ text: 'फार्मेसी' })[0]?.type).toBe('PHARMACY'));
});
