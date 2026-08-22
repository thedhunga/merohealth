import { describe, expect, it } from 'vitest';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { Screen } from './Screen';

// Same one-time flag app-state.test.tsx and Pill.test.tsx set — react's
// `act` warns without it and there is no DOM/RN test environment here to set
// it implicitly.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Screen', () => {
  it('renders its children', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Screen>
          <Text>content</Text>
        </Screen>,
      );
    });
    expect(tree.root.findByProps({ children: 'content' })).toBeTruthy();
  });

  it('merges a caller-supplied contentContainerStyle rather than replacing the base layout', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Screen contentContainerStyle={{ paddingBottom: 0 }}>
          <Text>content</Text>
        </Screen>,
      );
    });
    const scrollView = tree.root.findByProps({ showsVerticalScrollIndicator: false });
    const containerStyle = scrollView.props.contentContainerStyle as unknown[];
    expect(containerStyle).toContainEqual({ paddingBottom: 0 });
  });
});
