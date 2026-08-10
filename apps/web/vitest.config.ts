import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirrors the `@/*` -> `./src/*` path in tsconfig.json. Next's own bundler
// resolves that alias for the app itself, but vitest doesn't see tsconfig
// paths on its own, so anything importing `@/...` (like `lib/seo.ts`) needs
// this to run under `pnpm test`.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // tsconfig.json sets `jsx: "preserve"` for Next's own compiler to handle;
  // Vite's default oxc transformer takes that literally and refuses to
  // transform JSX at all, which breaks any test that imports a `.tsx` file.
  // Falling back to the esbuild transformer with an explicit jsx setting
  // fixes it for the test run only — the app build is untouched.
  oxc: false,
  esbuild: { jsx: 'automatic' },
});
