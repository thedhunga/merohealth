import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * `@Global()` so every future module (A4's entitlement guard, and whatever
 * lands after it) can inject `PrismaService` without each one re-declaring
 * this import — imported once, from `AppModule`. Still imported explicitly
 * by `AuthModule` too (harmless; Nest dedupes), so `AuthModule` stays
 * self-sufficient if it is ever tested or reused on its own.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
