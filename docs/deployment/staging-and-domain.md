# Staging and domain runbook

This runbook deliberately separates a public, fictional-data demonstration from a healthcare production system. The web deployment is a testing and promotion surface for the shared Android/iOS experience. It must not collect real patient data until the production gates below are complete.

## Deployment shape

- **Vercel:** static Expo web demonstration, preview deployments, and later `merohealth.online`.
- **EAS Build:** signed Android and iOS application builds from the same Expo codebase.
- **Managed application host:** the NestJS API, workers, and scheduled jobs. Select a region only after the data-residency and compliance review.
- **Managed PostgreSQL, Redis, and object storage:** encrypted, private, backed up, monitored, and located in the approved region.
- **External services:** identity, notifications, video, maps, payments, pharmacy/lab partners, and AI providers must connect through versioned ports so each can be changed without rewriting the product.

## Vercel testing ground

1. Push the repository's `main` branch to GitHub.
2. In Vercel, create a project by importing `thedhunga/merohealth`.
3. Keep the repository root as the project root. `vercel.json` supplies the install, build, and output settings.
4. Deploy. Vercel runs `pnpm install --frozen-lockfile`, exports the Expo web app, and serves `apps/mobile/dist`.
5. Test `/`, `/companion`, `/twin`, `/care`, and `/learn` on phone and desktop widths.
6. Keep demonstration data fictional. Do not add production secrets to preview environments.
7. Require successful GitHub checks and Vercel previews before merging future work to `main`.

## Namecheap to Vercel

Do this only after the Vercel deployment is healthy:

1. Purchase `merohealth.online` in the intended legal owner account. Enable registrar lock, auto-renew, domain privacy, and account MFA. Store recovery codes outside email.
2. In the Vercel project, open **Settings > Domains** and add both `merohealth.online` and `www.merohealth.online`.
3. Choose one canonical hostname and redirect the other. Use the apex domain as canonical unless marketing has a reason not to.
4. In Namecheap **Domain List > Manage > Advanced DNS**, remove only conflicting parking records for `@` and `www`.
5. Enter the exact A/AAAA/CNAME records shown by Vercel's domain inspection screen. Do not copy stale DNS values from a tutorial; Vercel may assign project-specific records.
6. Return to Vercel and wait for both domains to show **Valid Configuration** and for TLS certificates to be issued.
7. Verify HTTPS, the canonical redirect, all five routes, social link previews, and behavior on cellular data.
8. Add DNS monitoring and calendar reminders for domain renewal and ownership review.

DNS changes can take time to propagate. Do not move email-related MX, SPF, DKIM, or DMARC records while connecting the website.

## API and data environments

Use physically separate credentials and data stores for `development`, `staging`, and `production`. Staging may contain synthetic data only. Production access uses least privilege, short-lived credentials where available, immutable audit events, encrypted backups, and a tested restore procedure.

The public web client receives only public configuration such as an API origin. Secrets, clinical rules, partner credentials, model keys, signing keys, and service tokens remain server-side.

## Production promotion gate

Before accepting real users or health information, all items in `docs/product/promotion-readiness.md` marked **Required for patient data** must be completed and signed off by the named accountable owner.
