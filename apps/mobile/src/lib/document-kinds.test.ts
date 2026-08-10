import { describe, expect, it } from 'vitest';
import { documentKindLabel, documentKindOptions } from './document-kinds';

describe('document-kinds', () => {
  it('covers every document kind exactly once', () => {
    const options = documentKindOptions('ne');
    expect(options).toHaveLength(8);
    expect(new Set(options.map((option) => option.kind)).size).toBe(8);
  });

  it('switches to English labels for the en locale', () => {
    expect(documentKindLabel('LAB_REPORT', 'en')).toBe('Lab report');
    expect(documentKindLabel('LAB_REPORT', 'ne')).toBe('प्रयोगशाला रिपोर्ट');
  });

  it('falls back to Devanagari for ne-Latn, matching every other mobile screen', () => {
    expect(documentKindLabel('PRESCRIPTION', 'ne-Latn')).toBe('प्रेस्क्रिप्सन');
  });
});
