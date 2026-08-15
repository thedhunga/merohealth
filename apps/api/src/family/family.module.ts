import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { FAMILY_GRANTS_STORE } from './family-grants.store.js';
import { FamilyGrantsController } from './family-grants.controller.js';
import { FamilyGrantsService } from './family-grants.service.js';
import { PrismaFamilyGrantsStore } from './prisma-family-grants.store.js';

@Module({
  // `AuthModule` for `SessionAuthGuard` — the same "import the module, get
  // the guard" wiring its own doc comment describes. `PrismaModule` is
  // `@Global()` already; imported explicitly anyway so this module stays
  // self-sufficient if it is ever tested or reused on its own, matching
  // `AuthModule`'s own reasoning for the same redundant import.
  imports: [AuthModule, PrismaModule],
  controllers: [FamilyGrantsController],
  providers: [FamilyGrantsService, { provide: FAMILY_GRANTS_STORE, useClass: PrismaFamilyGrantsStore }],
})
export class FamilyModule {}
