import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Swagger UI at `/docs` walks the full API schema — every controller route
 * and every DTO field name, across all 29 controllers — with zero
 * authentication. Task LL's security-headers pass called it "a
 * developer-only page" when deciding not to scope a CSP to it, but never
 * asked whether the route itself should be reachable in production. It
 * shouldn't: on a clinical API, handing any caller a free, unauthenticated
 * map of the entire attack surface is a real information-disclosure gap, not
 * a developer convenience worth keeping live. Gated the same way `main.ts`'s
 * own CORS config already treats production as the strict case — loosen only
 * outside it.
 */
export function configureSwaggerDocs(app: INestApplication): void {
  if (process.env['NODE_ENV'] === 'production') {
    return;
  }
  const config = new DocumentBuilder()
    .setTitle('Swasthya Sathi API')
    .setDescription(
      'MVP API. All directory records and external providers are demonstration mocks.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
