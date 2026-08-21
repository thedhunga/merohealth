#!/usr/bin/env bash
set -uo pipefail

# Builds the Expo web export (apps/mobile) and publishes it to
# apps/web/public/app — the real `/app` product surface, not a marketing page.
# Shared by scripts/vercel-build.sh (production) and
# apps/web/playwright.config.ts (local e2e), so both build `/app` the exact
# same way and never drift.
#
# Deliberately no `set -e`: callers decide what a failure means. Production
# (vercel-build.sh) must fall through to the real site build regardless — a
# broken Expo export must never take the marketing site down with it. The
# local e2e webServer, by contrast, wants this failure to surface (exit 1
# propagates and playwright's webServer start fails loudly) because /app
# coverage is the point of running it there.
#
# cd's to the repo root itself so it works the same whether invoked from the
# repo root (CI, vercel-build.sh) or from apps/web (playwright.config.ts).
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Metro's experimental tree shaking, web export only (native builds don't run
# this script). Without it, importing even one icon from lucide-react-native
# or one animation preset from react-native-reanimated pulls their entire
# barrel file into __common — see docs/product/agent-progress.md task MMM.
export EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1
export EXPO_UNSTABLE_TREE_SHAKING=1

echo "==> Building the Expo web export (apps/mobile)"
if ! pnpm turbo build --filter=@swasthya/mobile...; then
  echo "==> Expo web export failed to build — /app will 404 until this is fixed" >&2
  exit 1
fi

rm -rf apps/web/public/app
if ! { mkdir -p apps/web/public/app && cp -r apps/mobile/dist/. apps/web/public/app/; }; then
  echo "==> Copying apps/mobile/dist into apps/web/public/app failed — /app will 404 until this is fixed" >&2
  rm -rf apps/web/public/app
  exit 1
fi

echo "==> Published the Expo web export to apps/web/public/app"
