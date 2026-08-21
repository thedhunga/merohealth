import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';
import { configureSwaggerDocs } from './swagger-docs.js';

/**
 * Boots a real Nest HTTP server, the same reason `security-headers.test.ts`
 * does: `SwaggerModule.setup` wires an Express route directly onto the
 * adapter, outside the module graph `app.module.test.ts` already covers.
 * Only a listening server proves `/docs` actually 404s in production.
 */
describe('configureSwaggerDocs', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await close?.();
    close = undefined;
    if (originalNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = originalNodeEnv;
  });

  async function boot(): Promise<number> {
    const moduleRef = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    const app = moduleRef.createNestApplication();
    configureSwaggerDocs(app);
    await app.init();
    const server = app.getHttpServer() as Server;
    await new Promise<void>((resolve) => server.listen(0, resolve));
    close = async () => {
      await app.close();
    };
    return (server.address() as AddressInfo).port;
  }

  it('serves the schema at /docs outside production', async () => {
    process.env['NODE_ENV'] = 'test';
    const port = await boot();

    const response = await fetch(`http://127.0.0.1:${port}/docs`);

    expect(response.status).toBe(200);
  });

  it('never mounts /docs in production, so it 404s instead of leaking the schema', async () => {
    process.env['NODE_ENV'] = 'production';
    const port = await boot();

    const response = await fetch(`http://127.0.0.1:${port}/docs`);

    expect(response.status).toBe(404);
  });
});
