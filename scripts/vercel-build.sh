#!/usr/bin/env bash
set -uo pipefail

# Vercel's buildCommand only ever builds @swasthya/web and its package
# dependencies (see vercel.json) — apps/mobile is otherwise untouched, so the
# footer's "download the app" links point at a /app that has never existed on
# the deployed site. This step builds the Expo web export and publishes it at
# apps/web/public/app so that link resolves to the real product surface.
#
# This is deliberately not chained onto the web build with `&&`: a broken
# Expo build must never take the marketing site down with it. Deliberately no
# `set -e` either, for the same reason — every failure path below falls
# through to the real build instead of aborting the script.

echo "==> Building the Expo web export (apps/mobile)"
if pnpm turbo build --filter=@swasthya/mobile...; then
  rm -rf apps/web/public/app
  if mkdir -p apps/web/public/app && cp -r apps/mobile/dist/. apps/web/public/app/; then
    echo "==> Published the Expo web export to apps/web/public/app"
  else
    echo "==> Copying apps/mobile/dist into apps/web/public/app failed — /app will 404 until this is fixed" >&2
    rm -rf apps/web/public/app
  fi
else
  echo "==> Expo web export failed to build — /app will 404 until this is fixed" >&2
fi

echo "==> Building @swasthya/web"
pnpm turbo build --filter=@swasthya/web...
