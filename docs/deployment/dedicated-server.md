# Dedicated server deployment

> **Start here: the API-only runbook.** The section below gets `apps/api`
> and Postgres live on `94.130.110.253` so the website on Vercel has something
> to talk to. It deliberately does **not** touch the website — that stays on
> Vercel — and it does not touch Apache's existing sites. Everything after
> this section is the older, broader plan and background.

## API-only runbook — owner steps

Tick these in order. Each is something only a person with the server login
can do; none of it can be automated from CI safely.

- [ ] **Swap.** The host has 7.5 GiB and no swap. Building the ARM64 image on
      it can OOM. Add 4 GB: `fallocate -l 4G /swapfile && chmod 600 /swapfile
      && mkswap /swapfile && swapon /swapfile`, then add it to `/etc/fstab`.
- [ ] **Docker.** Not installed. `curl -fsSL https://get.docker.com | sh`,
      then `usermod -aG docker mero-deploy`. Compose v2 ships with it.
- [ ] **Code.** `git clone https://github.com/thedhunga/merohealth
      /opt/mero-health && cd /opt/mero-health`.
- [ ] **Secrets.** `cp .env.server.example .env.server && chmod 600
      .env.server`, then edit it. Four values matter:
      `POSTGRES_PASSWORD` (long and random — `openssl rand -base64 32`),
      `AUTH_SECRET` (also `openssl rand -base64 32` — this one is easy to
      skip because the API boots and `/v1/health` stays green without it,
      but it hashes every OTP code and session token, so sign-in 500s the
      moment someone actually tries it; there is no default, on purpose),
      `GEMINI_API_KEY` (same key as Vercel), and `ALLOWED_ORIGINS`
      (`https://merohealth-beta.vercel.app`, comma-add the real domain later).
- [ ] **Pull the image, then bring it up.** `deploy-api.yml` builds
      `deploy/Dockerfile.api` for arm64 and pushes it to GHCR on every `ci`
      success on `main`, so the server never has to build it — building on
      the host is the OOM risk the swap step above exists for. Log in once
      (`echo "$GHCR_TOKEN" | docker login ghcr.io -u thedhunga
      --password-stdin`, a classic PAT with `read:packages`; skip this if the
      `merohealth-api` package is public), then
      `docker compose -f compose.server.yaml pull api migrate && docker
      compose -f compose.server.yaml up -d postgres migrate api`. Not the
      whole file — `web` and `caddy` are the old Expo site and are not
      needed. Watch `migrate` finish: `docker compose -f compose.server.yaml
      logs migrate` should end with the migrations applied and exit 0. If it
      fails, **the API will not start**, by design; fix the migration and
      re-run `up`.
- [ ] **Smoke test on the box.** `curl -s http://127.0.0.1:4000/v1/health`
      must return 200. `curl -s http://127.0.0.1:4000/docs` should serve the
      OpenAPI page.
- [ ] **HTTPS via Apache.** The API is bound to loopback only. Add a vhost
      for `api.<your-domain>` that proxies to `http://127.0.0.1:4000` with
      `ProxyPreserveHost On` and `RequestHeader set X-Forwarded-Proto https`,
      then `certbot --apache -d api.<your-domain>`. `deploy/apache-mero-health.conf`
      is a starting point. **HTTPS is not optional**: the session cookie is
      `SameSite=None; Secure` and browsers drop it over plain HTTP, so every
      sign-in would silently fail. **Keep it to exactly one proxy in front of
      the API.** `main.ts` sets Express's `trust proxy` to `1`, which is what
      lets the rate limiters on `POST /auth/otp/request` and
      `POST /early-access` see the real visitor instead of Apache — with a
      second proxy in the chain they would all share one allowance again, and
      with the API exposed directly a caller could pick its own allowance by
      sending its own `X-Forwarded-For`. Change that number in the same
      commit as any change to this hop count.
- [ ] **DNS.** `api.<your-domain>` → `94.130.110.253` (A record). Wait for
      it to resolve before the certbot step.
- [ ] **Smoke test from outside.** `curl -s https://api.<your-domain>/v1/health`
      → 200. `curl -sI -X OPTIONS https://api.<your-domain>/v1/auth/me -H
      "Origin: https://merohealth-beta.vercel.app"` should return
      `Access-Control-Allow-Origin: https://merohealth-beta.vercel.app`.
- [ ] **Point the website at it.** Vercel → merohealth → Settings →
      Environment Variables → `NEXT_PUBLIC_API_URL` =
      `https://api.<your-domain>` (no trailing slash) → Production →
      redeploy. Sign-in, register, account and family light up.

### Updating later

Every push to `main` that passes `ci` publishes a fresh
`ghcr.io/thedhunga/merohealth-api:latest` (see `.github/workflows/deploy-api.yml`).
The server only ever pulls it — it never builds the image itself:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u thedhunga --password-stdin
docker compose -f compose.server.yaml pull api migrate
docker compose -f compose.server.yaml up -d migrate api
```

`git pull` first if `compose.server.yaml` or `.env.server.example` changed;
routine API updates don't need it. `migrate` re-runs and is a no-op when
nothing is pending. If a future release adds a migration that fails, `api`
stays on the previous image until it is fixed — that is the point of keeping
them separate. `docker compose ... build api` still works if you ever need
to build locally instead (e.g. testing an unmerged change), but that is the
slow, OOM-prone path the GHCR image exists to avoid.

### If something is wrong

| Symptom | Look at |
|---|---|
| `api` never becomes healthy | `docker compose logs migrate` first — a failed migration blocks it on purpose |
| Sign-in works on the box but not from the website | `ALLOWED_ORIGINS` missing the Vercel origin, or the API not on HTTPS |
| `/v1/health` 200 but sign-in / OTP verify 500s with `AUTH_SECRET must be set` | `AUTH_SECRET` missing from `.env.server` — the health check never touches it, so this only shows up when someone actually signs in; set it and `docker compose -f compose.server.yaml up -d api` to restart with the new value |
| `/v1/health` 200 but records routes 503 | Postgres unreachable; `docker compose ps postgres` |
| Build OOMs | swap step skipped, or you ran `build` instead of `pull` — the server should never build the arm64 image itself |

---

## Background and broader plan (older notes)

Future target: `94.130.110.253`. Initial administrative login is `root`, but routine deployment should use a separate `mero-deploy` account after key access is proven.

## Credential handling

Do not paste a root password, SSH private key, API token, or `.env` contents into source files, Git, issue trackers, or chat.

1. Keep the private SSH key on an approved operator's computer.
2. Put only its public key in `/root/.ssh/authorized_keys` for initial access.
3. Use mode `700` for `/root/.ssh` and `600` for `authorized_keys`.
4. Create a narrowly privileged `mero-deploy` user and verify it before disabling password-based root login.

Connection shape:

```text
ssh -i <approved-local-private-key-path> root@94.130.110.253
```

## Capacity audit (2026-08-15)

- Ubuntu 24.04 ARM64
- 4 CPU cores
- 7.5 GiB RAM
- about 38 GB free on the root disk
- no swap
- Apache active on ports 80 and 443 with multiple existing virtual hosts
- MySQL restricted to loopback
- Docker/Compose absent
- no listener on 8090 or 4000

This is sufficient for the demonstration Next.js and API workload. Add 2–4 GB swap before building containers on the host, or preferably build ARM64 images in CI and pull them. Monitor memory, disk, load, HTTP latency, container health, certificate renewal, and backups.

## Current deployment readiness

Do not deploy the present `compose.server.yaml` as a Vercel-equivalent website yet. `deploy/Dockerfile.web` currently exports only `apps/mobile` and serves it as a static nginx root. It does not contain the Next.js public site or the server-side `/api/companion/research` route.

Required sequence:

1. Prove the combined repository-root deployment on Vercel.
2. Replace the server web image with a tested ARM64-compatible image running the combined Next.js application, including the generated `/app` assets.
3. Bind the web container to `127.0.0.1:8090`; keep the API and all data services private.
4. Update `deploy/apache-mero-health.conf` with the approved hostname.
5. Validate existing Apache virtual hosts and `apache2ctl configtest` before reload.
6. Run the same bilingual, `/get-care`, emergency, citation, `/app`, deep-link, and header checks used for Vercel.
7. Move DNS only after health checks and rollback are documented.

Do not start the Caddy `standalone` profile on this machine because it would compete with Apache for ports 80 and 443.

## Secrets

Copy `.env.server.example` to `/opt/mero-health/.env.server`, then run:

```text
chmod 600 /opt/mero-health/.env.server
```

At minimum, cited research needs `PERPLEXITY_API_KEY` and optionally `PERPLEXITY_MODEL=sonar-pro`. A production API additionally needs a strong `AUTH_SECRET`, database/Redis/object-storage credentials, allowed origins, and any provider credentials actually enabled. Never use `NEXT_PUBLIC_` or `EXPO_PUBLIC_` for a secret.

## Network shape

Apache should terminate TLS and proxy the approved hostname to `http://127.0.0.1:8090`. Only TCP 22, 80, and 443 should be publicly reachable. Do not publicly expose 8090, 4000, 3306, 5432, 6379, 9000, or 9001.

After the final hostname is chosen and the new container has passed local health checks:

```text
a2enmod proxy proxy_http headers ssl
a2ensite mero-health.conf
apache2ctl configtest
systemctl reload apache2
certbot --apache -d <approved-hostname>
```

These commands change a production multi-site server and require a scheduled operational window, current backups, and a tested rollback. Do not run them as part of a documentation-only handoff.
