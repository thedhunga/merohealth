# Mero Health · मेरो स्वास्थ्य

Production-oriented foundation for a Nepali-first digital-health companion on Android, iOS, and the web. The public front door is a bilingual Next.js application; the shared Expo product is published below it at `/app`; and a NestJS API plus extraction-ready domain packages provide the platform foundation. The repository also contains Prisma/PostgreSQL data models, fictional seed content, deterministic clinical-safety rules, tests, and architecture/security/compliance documentation.

> **Demonstration only.** This is not a medical device, emergency service, diagnostic system, or prescribing system. Current providers, facilities, sources, and external integrations are fictional or mocks. Medical/legal translations and policies require qualified Nepal review before production.

## Prerequisites

- Node.js 24 LTS
- pnpm 10.10.0
- Android Studio/device or compatible Expo development client
- macOS with Xcode or EAS for native iOS compilation
- Docker Desktop for PostgreSQL, Redis, and object storage

On Windows where PowerShell blocks the pnpm script shim, use pnpm.cmd.

## Run

Run the public site:

    pnpm --filter @swasthya/web dev

Open http://localhost:3000. Copy `apps/web/.env.example` to `apps/web/.env.local` to enable optional local configuration. The `/get-care` route always runs the deterministic safety screen; cited Perplexity research additionally requires `PERPLEXITY_API_KEY`.

Run the Expo product separately during development:

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

Open the responsive landing experience, try the private local voice-note control, enter the dashboard, submit “मलाई सास फेर्न गाह्रो छ” to see the hard safety interruption, preview the camera room, build a health-twin fact one step at a time, search the fictional care directory, and play the narrated learning walkthrough. Do not enter real patient data.

## Staging and promotion

Vercel builds the repository-root project defined by `vercel.json`: the bilingual Next.js site is the primary deployment and the Expo web export is copied into it at `/app`. Signed Android/iOS store builds remain a separate EAS release process.

See `docs/deployment/developer-handoff.md` for the exact locations, access model, stack, commands, current deployment state, and secret placement. See `docs/deployment/staging-and-domain.md` for Vercel and Namecheap setup and `docs/product/promotion-readiness.md` for the evidence gates that separate a public fictional-data demonstration from a system allowed to process real patient data.

## Current limitations

The codebase contains OTP/authentication and clinical-domain foundations, but a complete authenticated web product, real clinician-to-patient WebRTC, pharmacy/lab fulfillment, payments, authoritative nationwide directory ingestion, and production clinical/provider operations are not launch-ready integrations. Perplexity-backed cited research is implemented but remains in a transparent setup state until its server-side key is configured. Do not enter real patient data. See `docs/product/implementation-backlog.md`.
