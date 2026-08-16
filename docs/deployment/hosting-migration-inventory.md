# Hosting migration inventory — leaving Vercel

> Everything that must be changed, checked or replaced when the site moves off
> Vercel to a proper host. Kept separate from the build ledger on purpose: it
> is a checklist for one future event, not a stream of work. **Add to it the
> moment you notice a Vercel-specific dependency; do not wait for the move.**

Legend: **MUST** — site breaks without it · **CHECK** — verify behaviour is
equivalent · **CAN DROP** — Vercel-only, delete on the way out.

## 1. Build and deploy pipeline

| Item | Where | Status | Notes |
|---|---|---|---|
| Vercel Git integration builds `main` on push | Vercel dashboard | **MUST replace** | Needs CI (GitHub Actions) that runs `pnpm install --frozen-lockfile && pnpm turbo build --filter=@swasthya/web...` and deploys the output. |
| Root Directory = `apps/web` (dashboard setting, not in repo) | Vercel dashboard | **MUST replicate** | Undocumented outside this file and `apps/web/README.md`. New host must build from `apps/web` with the workspace root available for `pnpm`. |
| `apps/web/vercel.json` — `installCommand`, `buildCommand`, headers | repo | **CAN DROP** the file; **MUST port** its headers | Headers below. Build commands move to CI. |
| Root `vercel.json` + `scripts/vercel-build.sh` (Expo copy to `/app`) | repo | **CHECK** | Never runs on Vercel today because Root Directory is `apps/web`. On a new host it *could* run — decide whether `/app` should ship the Expo build, then either wire it into CI or delete both. |
| "Skipped — Not affected" build behaviour | Vercel | **CHECK** | Vercel skips builds for commits outside `apps/web`. A naive CI will build on every push; either path-filter or accept the cost. |
| Preview deployments per branch | Vercel | **CHECK** | The scheduled agent's branch pushes get preview URLs today. If previews matter, CI must produce them; otherwise accept main-only. |
| Deployment Protection (Vercel Authentication) | Vercel dashboard | **CAN DROP** | Currently disabled anyway. If previews return, gate them at the host or reverse proxy. |

## 2. Runtime — Next.js on the host

| Item | Where | Status | Notes |
|---|---|---|---|
| Next.js 16 App Router, `output` not set to `export` | `apps/web/next.config.ts` | **MUST decide** | Two routes are dynamic (below), so pure static export is not enough. Options: Node server (`next start`), a Docker image, or `@opennextjs/*` for another CDN. `deploy/Dockerfile.web` exists but targets the old Expo build — rewrite it. |
| `/api/companion/research` route handler | `apps/web/src/app/api/companion/research/route.ts` | **MUST** run server-side | This is the only route that reads `PERPLEXITY_API_KEY`. It needs a Node runtime, not an edge/CDN-only host. |
| `proxy.ts` (next-intl locale routing, formerly middleware) | `apps/web/src/proxy.ts` | **MUST** run at the edge or on every request | Locale detection is off; it only rewrites `/en/*`. Verify the host runs Next middleware/proxy. |
| `next/image` optimisation | everywhere | **CHECK** | Vercel optimises on its edge. Self-hosted `next start` optimises in-process (needs `sharp`); a static host needs `images.unoptimized: true` or a loader. The 1–2 MB source PNGs saved as `.webp` rely on this re-encoding — see §5. |
| Static prerender (`X-Vercel-Cache: PRERENDER`) | build output | **CHECK** | Pages are prerendered HTML. On a Node host they are served from `.next`; ensure a CDN or cache in front, or every request hits Node. |
| Fluid Compute / Function region `all` | Vercel dashboard | **CAN DROP** | Vercel-only concepts. |
| Node.js version 24.x | Vercel dashboard + `engines` | **CHECK** | `package.json` engines is `>=22`. Pin the host to 22 or 24 to match what was tested. |

## 3. Environment variables and secrets

| Variable | Scope | Status | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | server only, **never** `NEXT_PUBLIC_` | **MUST set** on new host | The preferred research provider (free tier). Answers return `setup-required` without it. Set in Production; keep it out of build logs. |
| `PERPLEXITY_API_KEY` | server only | optional | Fallback provider, paid. Only used when `GEMINI_API_KEY` is absent or `RESEARCH_PROVIDER=perplexity`. |
| `RESEARCH_PROVIDER`, `GEMINI_MODEL` | server only | optional | Force a provider / pick a model. See `apps/web/.env.example`. |
| `NEXT_PUBLIC_SITE_URL` (or equivalent used by `lib/seo.ts`) | build-time | **MUST update** | Sitemap, canonical and OG URLs are derived from the site URL. Change to the new domain. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | build-time, exposed to the browser | **MUST update** on domain change | Baked into the `apps/web` bundle at build time (`GoogleSignInButton.tsx`). Google Identity Services checks the calling page's origin against the OAuth client's Authorised JavaScript origins (Google Cloud Console → Credentials) — see §6. If the client id is absent, the button renders nothing rather than breaking; see `apps/web/.env.example`. |
| `GOOGLE_CLIENT_ID` (`apps/api`) | server only | **MUST update** on domain change | Same client id as `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — `apps/api/src/auth/auth.service.ts` uses it as the expected `aud` claim when verifying the Google ID token (`packages/auth`'s `verifyGoogleIdToken`). Absent → `POST /auth/google/verify` returns `setup-required`, matching the button's own degradation. No `GOOGLE_CLIENT_SECRET` is used: this is the Google Identity Services credential flow (a signed ID token verified against Google's JWKS), not the server-side OAuth code flow. |
| Any Vercel-injected vars (`VERCEL_URL`, `VERCEL_ENV`) | runtime | **CHECK** | `grep -rn "VERCEL_" apps/web/src` — currently none used, keep it that way. |
| `apps/web/.env.example` | repo | **CHECK** | Source of truth for what the app expects. Keep updated. |

## 4. HTTP headers (currently from `apps/web/vercel.json`)

Move these to the host, reverse proxy, or `next.config.ts` `headers()`:

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(self), microphone=(self), geolocation=(), payment=()
```

`Permissions-Policy` **MUST** keep `microphone=(self)` and `camera=(self)`, or
voice dictation and document capture stop working. `next.config.ts` already
sets a Permissions-Policy too — after the move, one source of truth only.

**Missing today, add on the new host:** `Strict-Transport-Security` (Vercel
adds it automatically; a self-host will not), and a `Content-Security-Policy`
once the inline-script surface is understood.

## 5. Static assets

| Item | Status | Notes |
|---|---|---|
| `apps/web/public/imagery/*.webp` — several are PNG bytes with a `.webp` name | **CHECK** | Works today only because `next/image` sniffs content and re-encodes. If the new host serves `public/` raw or disables optimisation, these will be served as PNG with a WebP extension — some browsers cope, some do not. Run the `cwebp` step in `docs/product/asset-brief-veo.md` before moving. |
| `apps/web/public/video/*.mp4` (~2 MB each) | **CHECK** | Served straight from `public/`. Vercel's CDN caches them; on a Node host put a CDN or long `Cache-Control` in front. |
| `Cache-Control` for `_next/static` | **CHECK** | Vercel sets immutable caching on hashed assets. Replicate: `_next/static/*` → `public, max-age=31536000, immutable`. |
| Portrait fallback (`EditorialImage` → SVG when file missing) | fine | Build-time `existsSync` in `lib/assets.ts` — host-agnostic, no change. |

## 6. Domains and DNS

| Item | Status | Notes |
|---|---|---|
| `merohealth-beta.vercel.app` | **CAN DROP** | Vercel-owned name; cannot move. Communicate the new URL. |
| Custom domain (none yet) | **MUST set up** | Buy/point the real domain at the new host. Update `NEXT_PUBLIC_SITE_URL`, `robots.ts`, `sitemap.ts`, OG image URLs. |
| Google OAuth client's Authorised JavaScript origins | Google Cloud Console → APIs & Services → Credentials | **MUST update** | Add the new domain (`https://<domain>`) to the same OAuth client behind `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` before removing the old Vercel origin — Google Identity Services rejects a credential request from an origin the client doesn't list, so add-then-remove, never swap in one step. No redirect URI to update: the credential flow only checks the calling origin. |
| `robots` is `noindex` while demonstration | **CHECK** | Governed by `isDemonstrationBuild` in `lib/seo.ts`; not host-specific, but confirm the flag on the new host before flipping to index. |
| TLS certificate | **MUST** | Vercel provisions automatically. Self-host needs Let's Encrypt / Caddy (`deploy/Caddyfile` exists) or the platform's TLS. |

## 7. Things that are *not* Vercel-dependent (no action)

- All `packages/*` domain code — pure TypeScript, tested with in-memory fakes.
- `apps/api` (NestJS) — has never been deployed anywhere; will need its own
  host, database and secrets, but that is a separate migration, not a
  Vercel one. `compose.server.yaml` and `deploy/Dockerfile.api` are the start.
- Anonymous history (`lib/anonymous-history.ts`) — localStorage on the device.
- Speech dictation and playback — browser APIs, no server.
- The scheduled cloud agent — clones from GitHub, deploys nothing itself.

## 8. Order of operations for the move

1. Set `PERPLEXITY_API_KEY` and `NEXT_PUBLIC_SITE_URL` on the new host.
2. Port headers (§4) and asset caching (§5).
3. Run `cwebp` over the mis-named `.webp` files.
4. Build via CI, deploy to a staging URL on the new host.
5. Verify: `/`, `/en`, `/get-care` (POST to `/api/companion/research` returns
   `status: complete`), voice permission prompt appears, `/sitemap.xml`,
   `/robots.txt`, one condition page with a photograph, one with SVG fallback.
6. Point the domain. Keep Vercel live until the new host has served real
   traffic for a day, then delete the Vercel project so the two never diverge.

## Log

- 2026-08-16 — Created during the seamless-assistant work. Vercel state at
  time of writing: Root Directory `apps/web`, protection disabled, no custom
  domain, `PERPLEXITY_API_KEY` **not set** in Production.
- 2026-08-16 — Added `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to §3
  as **MUST update**, and the Google OAuth client's Authorised JavaScript
  origins to §6 (Round three §D's last open item). Confirmed by reading
  `auth.service.ts` and `GoogleSignInButton.tsx` that there is no
  `GOOGLE_CLIENT_SECRET` or redirect URI in this flow — Google Identity
  Services verifies a signed ID token client-side, so only the origin
  allowlist matters on a domain move.
