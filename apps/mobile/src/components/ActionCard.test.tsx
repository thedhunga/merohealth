import { describe, expect, it, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { Stethoscope } from 'lucide-react-native';
import { ActionCard } from './ActionCard';

// Same one-time flag Pill.test.tsx sets — react's `act` warns without it and
// there is no DOM/RN test environment here to set it implicitly.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ActionCard', () => {
  it('renders title, subtitle and badge', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ActionCard badge="AVAILABLE" icon={Stethoscope} subtitle="Doctors and hospitals" title="Doctor" />,
      );
    });
    expect(tree.root.findAllByProps({ children: 'Doctor' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ children: 'Doctors and hospitals' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ children: 'AVAILABLE' }).length).toBeGreaterThan(0);
  });

  it('renders no subtitle or badge text when neither is passed', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ActionCard icon={Stethoscope} title="Doctor" />);
    });
    expect(tree.root.findAllByProps({ children: 'Doctors and hospitals' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ children: 'AVAILABLE' })).toHaveLength(0);
  });

  it('exposes a button role for assistive tech', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ActionCard icon={Stethoscope} title="Doctor" />);
    });
    expect(tree.root.findByProps({ accessibilityRole: 'button' })).toBeTruthy();
  });

  it('calls onPress exactly once per tap', () => {
    const onPress = vi.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ActionCard icon={Stethoscope} onPress={onPress} title="Doctor" />);
    });
    const pressed = tree.root.findByProps({ accessibilityRole: 'button' }).props as {
      onPress: () => void;
    };
    act(() => {
      pressed.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the icon the caller passed, not a hardcoded one', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ActionCard icon={Stethoscope} title="Doctor" />);
    });
    expect(tree.root.findByType(Stethoscope)).toBeTruthy();
  });
});
