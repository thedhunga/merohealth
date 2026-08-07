# Swasthya Sathi · स्वास्थ्य साथी

Production-oriented MVP foundation for a Nepali-first digital-health companion on Android and iOS. It contains an Expo mobile vertical slice, NestJS API, extraction-ready domain packages, Prisma/PostgreSQL schema, fictional seed content, safety tests, and architecture/security/compliance documentation.

> **Demonstration only.** This is not a medical device, emergency service, diagnostic system, or prescribing system. Current providers, facilities, sources, and external integrations are fictional or mocks. Medical/legal translations and policies require qualified Nepal review before production.

## Prerequisites

- Node.js 24 LTS
- pnpm 10.10.0
- Android Studio/device or compatible Expo development client
- macOS with Xcode or EAS for native iOS compilation
- Docker Desktop for PostgreSQL, Redis, and object storage

On Windows where PowerShell blocks the pnpm script shim, use pnpm.cmd.

## Run

    pnpm install --frozen-lockfile
    pnpm dev:mobile

Press a for Android or run pnpm --filter @swasthya/mobile web for a browser smoke test. Native iOS compilation requires macOS; Windows can type-check and export the shared application but cannot validate an App Store binary.

    copy .env.example .env
    pnpm dev:api

Open http://localhost:4000/docs. The initial health, safety, and fictional directory API routes do not need a database.

## Database

    docker compose up -d
    pnpm db:generate
    pnpm db:migrate
    pnpm db:seed

Docker is not installed in this authoring environment, so Compose is provided but was not executed here.

## Verify

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

## Demo path

Choose a language, submit “मलाई सास फेर्न गाह्रो छ” to see the hard safety interruption, add a health-twin fact one step at a time, search the fictional care directory, and inspect lesson transcripts. Do not enter real patient data.

## Staging and promotion

The Expo web export is configured as a Vercel testing ground through `vercel.json`. It represents the shared Android/iOS product experience; signed store builds remain a separate EAS release process.

See `docs/deployment/staging-and-domain.md` for Vercel and Namecheap setup. See `docs/product/promotion-readiness.md` for the evidence gates that separate a public fictional-data demonstration from a system allowed to process real patient data.

## Current limitations

Authentication, provider/admin web, real telehealth, prescriptions, pharmacy/lab fulfillment, payments, authoritative nationwide directory ingestion, production videos, and real AI generation are planned modules—not operational integrations. See docs/product/implementation-backlog.md.
