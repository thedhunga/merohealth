# Developer handoff

Status date: 2026-08-15.

## Locations and access

| Surface         | Location                                                | Access notes                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local workspace | `C:\Users\thedh\OneDrive\Documents\Mero Health`         | Windows/PowerShell. Use `pnpm.cmd` if PowerShell blocks the pnpm shim.                                                                                                                        |
| Git repository  | `https://github.com/thedhunga/merohealth.git`           | Current branch is `main`. Baseline before the present uncommitted work was `1dcbaa8`. Confirm `git status` before editing.                                                                    |
| Vercel          | Connected owner/team ID `team_2aYXjG4Jav1T0ulsNRyYmseX` | No Vercel project was visible at the start of the 2026-08-15 audit. Import the GitHub repository with the repository root selected.                                                           |
| Domain          | `merohealth.online` and `www.merohealth.online`         | As of 2026-08-15, apex resolves to `104.207.79.85`, not Vercel and not the future dedicated server. Registrar credentials are not stored here.                                                |
| Future server   | `root@94.130.110.253`                                   | Use an owner-held SSH private key. No password or private key belongs in Git, documentation, chat, or `.env` files. Create a non-root `mero-deploy` user before routine production operation. |

No access token, password, private key, or Perplexity key is committed. A new developer needs explicit invitations to GitHub/Vercel/Namecheap and either a public-key installation or the approved local path to an existing SSH private key.

## Repository map

| Path                               | Responsibility                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                         | Next.js public site, bilingual routes, auth UI, and the server-side Perplexity research route.                                |
| `apps/mobile`                      | Expo Router product for Android, iOS, and the web export mounted at `/app`.                                                   |
| `apps/api`                         | NestJS REST API and OpenAPI/Swagger surface, normally on port 4000.                                                           |
| `packages/*`                       | Domain packages: safety, auth, records, family, retrieval, scheduling, prescribing, credentialing, configuration, and others. |
| `packages/database`                | Prisma 7 schema, migrations, PostgreSQL adapter, and fictional seed data.                                                     |
| `scripts/vercel-build.sh`          | Combined Vercel build: Expo export → `apps/web/public/app` → Next.js build.                                                   |
| `deploy` and `compose.server.yaml` | Dedicated-server preparation. See the warning below before using it.                                                          |
| `docs/product/agent-progress.md`   | Historical build ledger and current continuity notes.                                                                         |

## Technology stack

- Node.js 22 or newer; project guidance uses Node 24 LTS.
- pnpm 10.10.0 workspaces and Turborepo 2.10.8.
- Next.js 16.3.0, React 19.2.3, Tailwind CSS 4.3.3, next-intl 4.13.5, Motion 12.43.0.
- Expo 57.0.11, React Native 0.86.2, Expo Router 57, Reanimated 4.5.1.
- NestJS 11.1.28, RxJS 7.8.2, Zod 4.4.3.
- Prisma 7.9.1 with PostgreSQL; local support services also include Redis and MinIO.
- TypeScript 6.0.3, Vitest 4.1.10, ESLint 9.32.0, Prettier 3.6.2.

## Current implemented web flow

The homepage symptom entry routes to localized `/get-care` without putting the question in the URL. A tab-scoped value pre-fills the care page and is removed once consumed. Submission calls `/api/companion/research`, which validates the input, runs `@swasthya/clinical-safety`, and stops before any provider call when emergency language is detected. Safe questions use Perplexity Sonar and display general information, citations, related questions, and a non-diagnostic disclaimer. Missing or failed provider configuration produces an explicit safe fallback.

The homepage received a complete visual upgrade on 2026-08-15. Its first screen is now a full-bleed photographic hero containing the live symptom form, followed by an editorial record story, asymmetric service grid, focused organization panels, and a prominent story film. The three new original illustrative files are `apps/web/public/imagery/mero-family-report.webp`, `mero-private-care.webp`, and `mero-community-care.webp`. They are not photographs of real patients or clinicians. Do not pair generated people with real names, testimonials, or outcome claims. The old generated portrait files were removed (recoverable from Git history), and the demo-partner marquee is intentionally omitted until real partners are approved.

The shared `SectionIntro` inner-page hero now accepts an optional original photograph and layers the route's existing branded SVG as a product cue. It is enabled for 24/7 care, primary care, mental health, about, and organization approach. Keep the image eager-loaded because it is the Largest Contentful Paint element. Other routes intentionally retain SVG-only heroes until an approved, route-specific photograph exists.

The Perplexity integration uses the documented `POST https://api.perplexity.ai/v1/sonar` endpoint with `sonar-pro` by default. Provider citation URLs are normalized to HTTP/HTTPS before rendering. Do not move this call into a client component or Expo bundle; that would expose the key.

## Local setup

```text
pnpm install --frozen-lockfile
copy apps\web\.env.example apps\web\.env.local
pnpm --filter @swasthya/web dev
```

For API and data work, copy the root `.env.example` to `.env`, start PostgreSQL/Redis/MinIO with the development Compose file, then run Prisma generation, migration, and seeding. Docker was not installed on the audited authoring machine, so verify the Compose path on a Docker-capable workstation.

Quality gates from the repository root:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

The final web gate passed 14 test files / 53 tests and generated 101 Next.js pages. The complete monorepo gate passed 31 lint tasks, 31 typecheck tasks, 55 test tasks, and 31 builds.

The 2026-08-15 production smoke test returned HTTP 200 for `/`, `/en`, `/en/get-care`, `/app`, `/app/capture`, `/app/care`, all three new image assets, and the story film. Browser verification found no broken loaded images, framework error overlay, or horizontal overflow. English and Nepali were inspected at desktop and 390px phone widths. With `prefers-reduced-motion: reduce` emulated, no infinite animations remained.

Repository-wide `pnpm format:check` is **not a green gate yet**: the current baseline reports 342 pre-existing files outside the active Prettier configuration. Do not reformat the entire repository incidentally. The homepage source, message files, and visual-upgrade documentation changed in this pass were checked directly and pass Prettier.

## Secrets and configuration

### Local Next.js

Put `PERPLEXITY_API_KEY` in `apps/web/.env.local`; this file is ignored by Git. Optional `PERPLEXITY_MODEL` defaults to `sonar-pro`.

### Vercel

Put secrets in **Project → Settings → Environment Variables**, never in `vercel.json`. Required for cited research: `PERPLEXITY_API_KEY`. Also set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, and `EXPO_PUBLIC_API_URL` to the correct environment URLs. Browser-visible prefixes are public by design and must never contain credentials.

### Dedicated server

Copy `.env.server.example` to `/opt/mero-health/.env.server`, fill server-only values, then set mode 600. Never expose `PERPLEXITY_API_KEY`, `AUTH_SECRET`, database passwords, SMS credentials, or signing keys in Apache config, container arguments, Git, or client-prefixed variables.

## Vercel deployment

Use repository root, `main`, and the root `vercel.json`. A healthy deployment must serve the Next.js site, `/api/companion/research`, `/app`, and every clean Expo deep link listed in `apps/web/expo-static-routes.ts`. A missing Perplexity key is an intentional setup state, not a crash. Do not attach the production domain until a preview passes the full smoke test.

## Dedicated-server capacity and warning

The read-only audit of `94.130.110.253` on 2026-08-15 found Ubuntu 24.04 ARM64, 4 CPU cores, 7.5 GiB RAM, roughly 38 GB disk free, no swap, Apache on ports 80/443, loopback MySQL, no Docker, and no listener on 8090 or 4000. Capacity is adequate for the demonstration web/API workload, but add 2–4 GB swap for on-host image builds or build ARM64 images in CI.

Important: the current `deploy/Dockerfile.web` and nginx container serve the Expo export as a standalone static root. They do **not** yet serve the combined Next.js marketing site or its `/api/companion/research` route. Do not cut DNS to this Compose stack as if it were equivalent to Vercel. After the Vercel deployment is proven, update the server image to run the combined Next.js application, bind it to `127.0.0.1:8090`, proxy through the existing Apache, and validate all current virtual hosts before reload.

Do not run the Caddy `standalone` profile on this machine; it conflicts with Apache. Keep 8090, 4000, database, Redis, and object-storage ports private. Public inbound ports should be 22, 80, and 443 only.

## Next developer priorities

1. Run the full monorepo regression gate and combined Vercel build.
2. Create/verify the Vercel preview and test `/get-care`, emergency interruption, `/app`, deep links, headers, and both locales.
3. Add the Perplexity key in Vercel and retest the cited success state using synthetic questions.
4. Connect the domain only after preview approval.
5. Modernize and test the dedicated-server web image before any server cutover.
6. Continue the authenticated web product only after deciding what the protected landing experience should contain; do not build an empty dashboard solely to hold navigation.
