import helmet from 'helmet';
import type { INestApplication } from '@nestjs/common';

/**
 * `docs/deployment/hosting-migration-inventory.md` §4 documents that
 * `apps/web` gets `X-Content-Type-Options`, `Referrer-Policy` and
 * `X-Frame-Options` from `vercel.json`/`next.config.ts` — but `apps/api`
 * (behind its own Apache reverse proxy, `docs/deployment/dedicated-server.md`)
 * had never set a single response header of its own. Every JSON response —
 * including the ones carrying a person's own health data — left MIME
 * sniffing, framing and referrer leakage entirely up to the browser's
 * defaults.
 *
 * Content-Security-Policy is left off on purpose: this is a JSON API, not an
 * HTML app, and the one HTML surface it does serve — Swagger UI at `/docs`
 * — bootstraps itself with an inline script helmet's default CSP would
 * block. A CSP scoped just to `/docs` is more machinery than a
 * developer-only docs page justifies; the headers below apply to every
 * route including `/docs` and cover the risk that actually applies to a
 * pure API (a browser sniffing a response as something other than JSON,
 * this origin being framed, referrer leakage), so this is the same
 * NestJS+Swagger+helmet trade-off the framework's own docs recommend.
 *
 * `Referrer-Policy` matches the value `apps/web` already ships (see the
 * inventory doc above) so the two surfaces agree rather than each picking
 * helmet's own default (`no-referrer`).
 */
export function configureSecurityHeaders(app: INestApplication): void {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
}
