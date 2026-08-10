# @swasthya/web

The public marketing site — Next.js 16 App Router, Tailwind 4, next-intl.
Nepali is served from the bare path (`/individuals`); English is prefixed
(`/en/individuals`).

## Local

From the repository root:

```bash
pnpm turbo build --filter=@swasthya/web...
pnpm --filter @swasthya/web dev
```

The trailing `...` on the filter matters — it builds the workspace packages
this app depends on. A bare `--filter=@swasthya/web` builds only the app and
then fails on their missing `dist` output.

## Deployment

Vercel, from `main`.

Two settings live in the dashboard and cannot be committed:

- **Root Directory** must be `apps/web`. `next` is a dependency of this
  package, not of the repository root, so Vercel's framework detection finds
  nothing if the root is left at the default.
- **Production Branch** should be `main`.

Because the Root Directory is a subdirectory, Vercel skips builds for commits
that do not touch `apps/web` — they report as *"Skipped — Not affected"*
rather than failing. A commit elsewhere in the monorepo will not redeploy the
site, which is usually what you want and occasionally very confusing.

`vercel.json` in this directory carries only security headers. Install and
build are left to Vercel's own pnpm-workspace detection; an explicit
`cd ../..` build command only works when *Include files outside the Root
Directory* happens to be enabled.

## Not yet wired

`/app` — the footer's app-store links point there, intending to serve the Expo
build from `apps/mobile`. Nothing serves that path yet, so those links 404.
Queued in the build ledger.
