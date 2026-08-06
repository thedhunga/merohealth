# Local deployment

Docker Compose provides PostgreSQL, Redis, and MinIO for development only. Copy `.env.example` to `.env`, replace all sample secrets, run `docker compose up -d`, then `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:seed`. Production requires managed secrets, TLS, encrypted storage/backups, private networking, monitored queues, signed object access, malware scanning, audited administration, tested restore and incident-response procedures, and a deployment region approved through the compliance process.
