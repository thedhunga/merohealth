import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FaqList } from './FaqList';

const items = [{ key: 'q1', question: 'छोटो प्रश्न?', answer: 'छोटो जवाफ।' }] as const;

describe('FaqList', () => {
  const html = renderToStaticMarkup(<FaqList items={items} />);
  const summary = html.slice(html.indexOf('<summary'), html.indexOf('</summary>'));

  // A native <summary> only toggles when the tap lands on itself, so its own
  // box — not the parent card's padding — is the real hit area on a phone. The
  // 44px floor and the interior padding must live on the summary, or a one-line
  // question is a sub-44px tap target. Regression guard for the fix that moved
  // `p-6` off the `<details>`.
  it('floors the disclosure toggle at the 44px tap-target minimum', () => {
    expect(summary).toContain('min-h-11');
  });

  it('carries its own interior padding so the whole question row is tappable', () => {
    expect(summary).toContain('px-6');
    expect(summary).toContain('py-4');
  });

  it('does not restore padding on the details wrapper that would shrink the toggle', () => {
    const details = html.slice(0, html.indexOf('<summary'));
    expect(details).not.toMatch(/class="[^"]*\bp-6\b/);
  });

  it('renders one FAQPage JSON-LD entry per item from the same source array', () => {
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('छोटो प्रश्न?');
    expect(html).toContain('छोटो जवाफ।');
  });
});
