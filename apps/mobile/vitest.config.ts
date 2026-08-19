import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirrors apps/web/vitest.config.ts: the `@/*` -> `./src/*` alias from
// tsconfig.json isn't seen by vitest on its own, and the default oxc
// transformer refuses to touch JSX at all, so any `.tsx` source (like
// `state/app-state.tsx`) needs both fixed here to be importable under a test.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  oxc: false,
  esbuild: { jsx: 'automatic' },
});
