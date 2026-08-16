import 'reflect-metadata';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { DatabaseUnavailableFilter } from './prisma/database-unavailable.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.setGlobalPrefix('v1');
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
