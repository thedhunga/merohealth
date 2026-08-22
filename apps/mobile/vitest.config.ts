import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirrors apps/web/vitest.config.ts: the `@/*` -> `./src/*` alias from
// tsconfig.json isn't seen by vitest on its own, and the default oxc
// transformer refuses to touch JSX at all, so any `.tsx` source (like
// `state/app-state.tsx`) needs both fixed here to be importable under a test.
//
// `react-native` itself is aliased to `react-native-web` (already a real
// dependency here — it is how this same app ships to web, see the Round
// seven UU log entry) because react-native's own package entry is written
// in Flow, which neither oxc nor esbuild strips; importing it directly
// fails with "Flow is not supported" before a single test can run.
// react-native-web is plain, modern JS/TS with the same primitive exports
// (`View`, `Text`, `Pressable`, `StyleSheet`, ...), so a component that only
// uses those renders under `react-test-renderer` without pulling in a
// native bridge or a new dependency.
//
// `react-native-reanimated` is aliased to a hand-rolled mock
// (`src/test/reanimated-mock.ts`) rather than the package's own `mock.js`:
// that stock mock still re-exports from the package's real `./index`, which
// pulls in `react-native-worklets`' native codegen and fails to parse under
// vitest the same way `lucide-react-native`/`react-native-svg` do (see the
// Round seven GGGG log entry) — there is no working off-the-shelf mock for
// this package under vitest today.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'react-native': 'react-native-web',
      'react-native-reanimated': fileURLToPath(
        new URL('./src/test/reanimated-mock.ts', import.meta.url),
      ),
    },
  },
  oxc: false,
  esbuild: { jsx: 'automatic' },
});
