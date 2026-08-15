# Dedicated server deployment

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
