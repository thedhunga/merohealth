import { View } from 'react-native';

/**
 * `react-native-reanimated` ships its own `mock.js`/`src/mock.ts`, the
 * standard Jest-ecosystem alias target — but both re-export from the
 * package's real `./index`, which pulls in `react-native-worklets`'
 * native codegen and fails to parse under vitest with the same
 * `SyntaxError: Unexpected token 'typeof'` `lucide-react-native` /
 * `react-native-svg` hit (Round seven GGGG's log entry). There is no
 * working stock mock for this package under vitest today, so this is a
 * hand-rolled one scoped to exactly the API `SathiOrb.tsx` calls:
 * synchronous, motionless equivalents good enough to render and assert
 * on, not a faithful animation reimplementation. Extend it if a future
 * component needs a hook not listed here.
 */
export const Easing = {
  inOut: (fn: (t: number) => number) => fn,
  sin: (t: number) => t,
};

export function useSharedValue<T>(initial: T) {
  return { value: initial };
}

export function useReducedMotion() {
  return false;
}

export function useAnimatedStyle<T>(factory: () => T) {
  return factory();
}

export function withTiming<T>(toValue: T) {
  return toValue;
}

export function withRepeat<T>(animation: T) {
  return animation;
}

const Animated = { View };

export default Animated;
