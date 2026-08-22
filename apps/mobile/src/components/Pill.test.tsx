import { describe, expect, it, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { Pill } from './Pill';

// Same one-time flag app-state.test.tsx sets — react's `act` warns without it
// and there is no DOM/RN test environment here to set it implicitly.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Pill', () => {
  it('renders the label', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Pill label="नेपाली" />);
    });
    const text = tree.root.findByProps({ children: 'नेपाली' });
    expect(text).toBeTruthy();
  });

  it('exposes selected state to assistive tech via accessibilityState, not just styling', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Pill label="English" selected />);
    });
    const pressable = tree.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.accessibilityState).toEqual({ selected: true });
  });

  it('omits selected from accessibilityState when unset, rather than asserting false', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Pill label="English" />);
    });
    const pressable = tree.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.accessibilityState).toEqual({ selected: undefined });
  });

  it('calls onPress exactly once per tap', () => {
    const onPress = vi.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Pill label="ne-Latn" onPress={onPress} />);
    });
    const pressed = tree.root.findByProps({ accessibilityRole: 'button' })
      .props as { onPress: () => void };
    act(() => {
      pressed.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
