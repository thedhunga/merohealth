# Dedicated server deployment

Target noted by the owner: `94.130.110.253` with initial SSH user `root`.

## Access: where credentials go

Do not paste the root password, SSH private key, or Perplexity key into source files, Git, or chat.

Preferred server access:

1. Keep the SSH private key on the owner's computer.
2. Add only its public key to `/root/.ssh/authorized_keys` on the server.
3. Set `/root/.ssh` to mode `700` and `authorized_keys` to mode `600`.
4. For routine operations, create a separate `mero-deploy` user with narrowly scoped sudo access and disable password-based root login after key access is verified.

To let an operator connect, provide the local path to the private key, not the private key contents. The connection target is:

```text
ssh -i <local-private-key-path> root@94.130.110.253
```

## Perplexity secret

On Vercel, add `PERPLEXITY_API_KEY` and optional `PERPLEXITY_MODEL=sonar-pro` in the project's Environment Variables for Production and Preview. Redeploy after adding them.

On the dedicated server:

1. Copy `.env.server.example` to `/opt/mero-health/.env.server`.
2. Put the token after `PERPLEXITY_API_KEY=`.
3. Run `chmod 600 /opt/mero-health/.env.server`.
4. Never expose this key through an `EXPO_PUBLIC_*` variable. The browser calls the Mero Health API; only the server calls Perplexity.

## Capacity audit (2026-08-07)

The server was inspected over the existing SSH key connection:

- Ubuntu 24.04.3 LTS
- 4 ARM64 CPU cores
- 7.5 GiB RAM, about 5.1 GiB available during the check
- 75 GB root disk, 38 GB free
- ARM64 architecture, which is supported by the selected official container images

This is enough for the current Mero Health web app and research API. The app does not yet need PostgreSQL, Redis, or object storage. For on-server container builds, add a 2-4 GB swap file or build multi-architecture images in CI so a temporary memory spike cannot interrupt the existing sites.

## Existing server services

- Apache is active and already owns ports 80 and 443 for four virtual hosts.
- MySQL listens only on loopback ports 3306 and 33060.
- Docker and Docker Compose are not installed.
- UFW is installed but inactive.

Do not start the Caddy `standalone` profile on this server; it would conflict with Apache. The default Compose configuration binds Mero Health only to `127.0.0.1:8090` so Apache can reverse proxy it safely.

## Recommended server layout

1. Install Docker Engine and the Compose plugin for Ubuntu 24.04 ARM64.
2. Add a 2-4 GB swap file if images will be built on this host.
3. Copy the repository to `/opt/mero-health` and create the protected `.env.server` file described above.
4. Set `ALLOWED_ORIGINS` to the final HTTPS domain and keep `MERO_BIND_IP=127.0.0.1`.
5. Run `docker compose -f compose.server.yaml up -d --build` without the `standalone` profile.
6. Copy `deploy/apache-mero-health.conf` to `/etc/apache2/sites-available/mero-health.conf`, replace `health.example.com`, and enable it.
7. Enable the Apache proxy modules, validate the configuration, reload Apache, then use the already-installed Certbot for TLS.

Apache setup commands after the domain is chosen:

```text
a2enmod proxy proxy_http headers ssl
a2ensite mero-health.conf
apache2ctl configtest
systemctl reload apache2
certbot --apache -d health.example.com
```

Open inbound TCP 22, 80, and 443 only. Do not expose ports 8090, 4000, 3306, 5432, 6379, 9000, or 9001 publicly.
