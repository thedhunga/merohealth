import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HISTORY_STORE } from './history-store.js';
import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';
import { PrismaHistoryStore } from './prisma-history.store.js';

// `AuthModule` for `SessionAuthGuard` — the same "import the module, get the
// guard" wiring `FamilyModule` already uses. `PrismaModule` is `@Global()`
// already; imported explicitly anyway for the same self-sufficiency reason
// `FamilyModule`'s own doc comment gives.
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [HistoryController],
  providers: [HistoryService, { provide: HISTORY_STORE, useClass: PrismaHistoryStore }],
})
export class HistoryModule {}
