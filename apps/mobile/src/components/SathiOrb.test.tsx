import { describe, expect, it } from 'vitest';
import { act, create } from 'react-test-renderer';
import { SathiOrb } from './SathiOrb';

// Same one-time flag Pill.test.tsx sets — react's `act` warns without it and
// there is no DOM/RN test environment here to set it implicitly.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SathiOrb', () => {
  it('exposes an English accessibility label to assistive tech', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<SathiOrb language="en" />);
    });
    const orb = tree.root.findByProps({ accessible: true });
    expect(orb.props.accessibilityLabel).toBe('Swasthya Sathi companion');
  });

  it('exposes a Nepali accessibility label to assistive tech', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<SathiOrb language="ne" />);
    });
    const orb = tree.root.findByProps({ accessible: true });
    expect(orb.props.accessibilityLabel).toBe('स्वास्थ्य साथी');
  });

  it('sizes itself from the size prop, not just the default', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<SathiOrb language="en" size={96} />);
    });
    const orb = tree.root.findByProps({ accessible: true });
    const dimensions = (orb.props.style as Array<{ height?: number; width?: number }>).find(
      (style) => style && 'height' in style && 'width' in style,
    );
    expect(dimensions).toEqual({ height: 96, width: 96 });
  });

  it('defaults to size 68 when the caller passes none', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<SathiOrb language="en" />);
    });
    const orb = tree.root.findByProps({ accessible: true });
    const dimensions = (orb.props.style as Array<{ height?: number; width?: number }>).find(
      (style) => style && 'height' in style && 'width' in style,
    );
    expect(dimensions).toEqual({ height: 68, width: 68 });
  });
});
