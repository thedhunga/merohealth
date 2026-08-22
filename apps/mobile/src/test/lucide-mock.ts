import { createElement } from 'react';
import { View } from 'react-native';

/**
 * `lucide-react-native` deep-imports `react-native-svg`'s fabric codegen
 * components, which themselves deep-import
 * `react-native/Libraries/Utilities/codegenNativeComponent` — a path React
 * Native's own package-exports map hides outside Metro's special-cased
 * resolver, so it fails to parse under vitest the same way
 * `react-native-reanimated` does (Round seven GGGG's log entry). There is
 * no working stock mock for this package under vitest today, so this is a
 * hand-rolled one scoped to exactly the icons `ActionCard.tsx` and its own
 * test render: a plain `View` standing in for each icon's SVG, motionless
 * and colourless but enough to assert a component rendered its icon slot.
 * Extend it if a future test needs another icon name.
 */
function makeIcon(name: string) {
  function LucideIconMock() {
    return createElement(View, { accessibilityElementsHidden: true });
  }
  LucideIconMock.displayName = name;
  return LucideIconMock;
}

export const ChevronRight = makeIcon('ChevronRight');
export const Stethoscope = makeIcon('Stethoscope');
