# Staging and domain runbook

This runbook separates a public fictional-data demonstration from a healthcare production system. Preview and staging environments must use synthetic data until every required promotion gate is signed off.

## Deployment shape

- **Vercel:** the bilingual Next.js public site, its server-side `/api/companion/research` route, preview deployments, and the Expo web export served at `/app`.
- **EAS Build:** signed Android and iOS builds from `apps/mobile`; this is independent of the Vercel web export.
- **Application host:** the NestJS API, workers, and scheduled jobs. A production region requires a data-residency and compliance decision.
- **Data services:** PostgreSQL, Redis, and object storage must be private, encrypted, backed up, monitored, and hosted in an approved region before patient data is allowed.

## Vercel project setup

1. Import `https://github.com/thedhunga/merohealth` from the `main` branch.
2. Leave **Root Directory** at the repository root. Do not select `apps/web`.
3. The root `vercel.json` supplies the Next.js framework, locked install, build command, output directory, and security headers.
4. The build command runs `scripts/vercel-build.sh`. It exports Expo first, copies `apps/mobile/dist` into `apps/web/public/app`, then builds `@swasthya/web` and its workspace dependencies.
5. Verify `/`, `/en`, `/get-care`, `/en/get-care`, `/app`, and at least one `/app/...` deep link on phone and desktop widths.
6. Keep preview inputs synthetic and require GitHub checks plus a healthy Vercel preview before promotion.

The Expo copy step is deliberately non-fatal so a mobile-export failure cannot take down the public marketing site. A deployment with that warning is usable for marketing but `/app` must be treated as failed and investigated before promotion.

## Environment variables

Add these in **Vercel → Project → Settings → Environment Variables** and redeploy after a change:

| Variable               | Visibility      | Purpose                                                                                                             |
| ---------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------- |
| `PERPLEXITY_API_KEY`   | Server only     | Enables cited Sonar research from `/api/companion/research`. Never prefix it with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`. |
| `PERPLEXITY_MODEL`     | Server only     | Optional; defaults to `sonar-pro`.                                                                                  |
| `NEXT_PUBLIC_SITE_URL` | Browser-safe    | Canonical public origin used by metadata and sitemap generation.                                                    |
| `NEXT_PUBLIC_API_URL`  | Browser-safe    | NestJS API origin used by Next.js auth/client calls.                                                                |
| `EXPO_PUBLIC_API_URL`  | Browser-visible | NestJS API origin compiled into the Expo web export.                                                                |

Use separate values for Preview and Production. Do not add production secrets to Preview unless that environment has equivalent access controls and a specific need.

## Namecheap to Vercel

Do this only after the Vercel deployment is healthy:

1. In Vercel **Settings → Domains**, add `merohealth.online` and `www.merohealth.online`.
2. Choose one canonical hostname and redirect the other; use the apex unless marketing decides otherwise.
3. In Namecheap **Domain List → Manage → Advanced DNS**, remove only conflicting parking records for `@` and `www`.
4. Enter the exact records shown by Vercel's domain inspection. Do not copy addresses from a tutorial.
5. Wait for **Valid Configuration** and issued TLS certificates, then test HTTPS, redirects, `/get-care`, `/app`, social previews, and cellular access.
6. Preserve all email-related MX, SPF, DKIM, and DMARC records.

As of 2026-08-15, the apex A record resolves to `104.207.79.85`; it does not point to Vercel or the future dedicated server `94.130.110.253`. Treat DNS as unchanged until Vercel displays the healthy project-specific records.

## Production promotion gate

Before accepting real users or health information, complete every item marked **Required for patient data** in `docs/product/promotion-readiness.md`. This includes clinical/legal review, verified emergency routing, production identity and data services, monitoring, backups and restore testing, incident response, and removal of fictional claims or placeholders.
