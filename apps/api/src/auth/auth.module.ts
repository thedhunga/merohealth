import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AUTH_STORE } from './auth-store.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaAuthStore } from './prisma-auth.store.js';
import { createSmsProvider, SMS_PROVIDER } from './sms-provider.js';
import { SessionAuthGuard } from './session-auth.guard.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionAuthGuard,
    { provide: AUTH_STORE, useClass: PrismaAuthStore },
    { provide: SMS_PROVIDER, useFactory: createSmsProvider },
  ],
  // `SessionAuthGuard` is exported so a future module (A4 onward) can
  // `@UseGuards(SessionAuthGuard)` on its own routes by importing
  // `AuthModule`, the same "import the module, get the guard" wiring
  // `RecordsModule` already gives `EntitlementsGuard` to its own controller.
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
