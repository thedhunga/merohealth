import 'reflect-metadata';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { DatabaseUnavailableFilter } from './prisma/database-unavailable.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.setGlobalPrefix('v1');
  // Exactly one reverse proxy sits in front of this API in every documented
  // deployment — Apache terminating TLS for `api.<domain>` and forwarding to
  // a loopback-bound container (`docs/deployment/dedicated-server.md`). Left
  // unset, Express reports that proxy as the client address on every single
  // request, which silently turns each per-IP rate limiter into one shared
  // global allowance: an abuser is never isolated, and real visitors lock
  // each other out. Trusting exactly one hop means the rightmost
  // `X-Forwarded-For` entry the proxy itself appended wins, so a caller
  // cannot pick its own bucket by sending that header. Raise this only
  // alongside a real second proxy — a number larger than the true hop count
  // is what makes the header spoofable.
  app.set('trust proxy', 1);
  // A dead database must read as a 503 outage on every data route, never as a
  // bare 500 that looks like a bug in the route. See the filter for the
  // fault-isolation reasoning.
  app.useGlobalFilters(new DatabaseUnavailableFilter(app.get(HttpAdapterHost).httpAdapter));
  const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: process.env['NODE_ENV'] === 'production' ? allowedOrigins : true,
    credentials: true,
  });
  const config = new DocumentBuilder()
    .setTitle('Swasthya Sathi API')
    .setDescription(
      'MVP API. All directory records and external providers are demonstration mocks.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(Number(process.env['API_PORT'] ?? 4000));
}

void bootstrap();
