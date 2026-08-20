import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';
import { configureSecurityHeaders } from './security-headers.js';

/**
 * Boots a real Nest HTTP server — not just `Test.createTestingModule().compile()`
 * — because helmet is Express middleware wired in `main.ts`'s `bootstrap()`,
 * outside the module graph `app.module.test.ts` already covers. Only a
 * listening server proves the headers actually land on a response.
 * `HealthController` has no dependencies, so this stays a narrow check of
 * the headers rather than a second full-app boot test.
 */
describe('configureSecurityHeaders', () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  it('sets MIME-sniffing, framing and referrer headers, and leaves CSP off for Swagger', async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    const app = moduleRef.createNestApplication();
    configureSecurityHeaders(app);
    await app.init();
    const server = app.getHttpServer() as Server;
    await new Promise<void>((resolve) => server.listen(0, resolve));
    close = async () => {
      await app.close();
    };
    const { port } = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${port}/health`);

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('content-security-policy')).toBeNull();
  });
});
