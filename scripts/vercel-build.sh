#!/usr/bin/env bash
set -uo pipefail

# Vercel's buildCommand only ever builds @swasthya/web and its package
# dependencies (see vercel.json) — apps/mobile is otherwise untouched, so the
# footer's "download the app" links point at a /app that has never existed on
# the deployed site. scripts/build-mobile-web.sh builds the Expo web export
# and publishes it at apps/web/public/app so that link resolves to the real
# product surface (also used by apps/web/playwright.config.ts's local e2e
# webServer, so both build `/app` the same way).
#
# This is deliberately not chained onto the web build with `&&`: a broken
# Expo build must never take the marketing site down with it — the `||` below
# just logs and falls through to the real build instead of aborting.

./scripts/build-mobile-web.sh || echo "==> /app will 404 until this is fixed" >&2

echo "==> Building @swasthya/web"
pnpm turbo build --filter=@swasthya/web...
