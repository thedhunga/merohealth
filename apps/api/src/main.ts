import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: process.env['NODE_ENV'] === 'production' ? [] : true, credentials: true });
  const config = new DocumentBuilder().setTitle('Swasthya Sathi API').setDescription('MVP API. All directory records and external providers are demonstration mocks.').setVersion('0.1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(Number(process.env['API_PORT'] ?? 4000));
}

void bootstrap();
