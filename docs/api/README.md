# API documentation

Run `pnpm dev:api`, then open `http://localhost:4000/docs` for OpenAPI. All routes use the `/v1` prefix. The first slice exposes service health, deterministic companion safety assessment, and fictional directory search. Transactional endpoints added later must require an `Idempotency-Key`, emit a correlation ID, use consistent `{code,message,details,correlationId}` errors, and enforce role, relationship, consent, purpose, organization, and record-state checks.

No authentication provider is operational in this slice. Any route that handles patient data is forbidden from release until the authentication and authorization guards are implemented and tested.
