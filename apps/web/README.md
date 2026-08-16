# @swasthya/web

The public Mero Health front door: Next.js 16 App Router, React 19, Tailwind CSS 4, next-intl, and Motion. Nepali is the default locale on bare paths; English uses `/en`.

## Local development

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @swasthya/web dev
```

Open `http://localhost:3000`. Copy `.env.example` in this directory to `.env.local` for local configuration. `PERPLEXITY_API_KEY` is private and must never use a `NEXT_PUBLIC_` prefix.

To build this app and all workspace dependencies:

```bash
pnpm build --filter=@swasthya/web...
```

The trailing `...` matters: it includes the workspace packages on which the app depends.

## Routes and runtime behavior

- Marketing and utility routes are generated in Nepali and English.
- `/get-care` performs deterministic emergency interception before any Perplexity request. The question is passed from the homepage through tab-scoped session storage, not a query string.
- `/api/companion/research` is a Node.js route handler. Only this server-side route reads `PERPLEXITY_API_KEY`.
- `/app` is the Expo web product. It is generated and copied into `public/app` by `scripts/vercel-build.sh`; that generated directory is intentionally ignored by Git.

## Vercel

Import `https://github.com/thedhunga/merohealth`. Root Directory at the repository root is the canonical setup: the root `vercel.json` runs `scripts/vercel-build.sh` directly, which builds Expo, copies it to `/app`, and then builds Next.js. If the project's Root Directory is instead set to `apps/web`, this directory's own `vercel.json` now calls the same `scripts/vercel-build.sh` (via `cd ../..`) rather than building `@swasthya/web` alone, so `/app` resolves under either setting — no live dashboard change is required.

Set environment variables in **Project Settings → Environment Variables**, scoped separately to Preview and Production. See `docs/deployment/staging-and-domain.md` and `docs/deployment/developer-handoff.md`.
