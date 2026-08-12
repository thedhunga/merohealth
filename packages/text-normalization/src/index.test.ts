import { describe, expect, it } from 'vitest';
import { normalizeLabel } from './index.js';

describe('normalizeLabel', () => {
  it('folds case so differently-cased labels match', () => {
    expect(normalizeLabel('Paracetamol')).toBe(normalizeLabel('paracetamol'));
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeLabel('  Ibuprofen  ')).toBe(normalizeLabel('Ibuprofen'));
  });

  it('treats NFKC-equivalent compatibility characters as the same label', () => {
    // U+FB01 LATIN SMALL LIGATURE FI decomposes to "fi" under NFKC.
    expect(normalizeLabel('ﬁsh oil')).toBe(normalizeLabel('fish oil'));
  });

  it('treats a precomposed accent and its decomposed combining-mark form as the same label', () => {
    const precomposed = 'é'; // é as a single codepoint
    const decomposed = 'é'; // "e" followed by a combining acute accent
    expect(precomposed).not.toBe(decomposed); // the raw strings really do differ
    expect(normalizeLabel(`caf${precomposed}`)).toBe(normalizeLabel(`caf${decomposed}`));
  });

  it('does not treat genuinely different labels as equal', () => {
    expect(normalizeLabel('Amoxicillin')).not.toBe(normalizeLabel('Amoxiclav'));
  });
});
