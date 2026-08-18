import { describe, expect, it } from 'vitest';
import { revealClassName } from './Reveal';

describe('revealClassName', () => {
  it('carries no hidden state when not hidden', () => {
    const className = revealClassName(false);
    expect(className).not.toContain('opacity-0');
    expect(className).not.toContain('translate-y-3');
    expect(className).toContain('duration-[280ms]');
  });

  it('starts faded and translated 12px down when hidden', () => {
    const className = revealClassName(true);
    expect(className).toContain('opacity-0');
    expect(className).toContain('translate-y-3');
  });

  it('passes the caller className through unchanged', () => {
    expect(revealClassName(false, 'mt-12')).toContain('mt-12');
  });
});
