import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaTwinProfileStore } from './prisma-twin-profile.store.js';
import { TWIN_PROFILE_STORE } from './twin-profile-store.js';
import { TwinProfileController } from './twin-profile.controller.js';
import { TwinProfileService } from './twin-profile.service.js';

// `AuthModule` for `SessionAuthGuard` — the same "import the module, get the
// guard" wiring `HistoryModule` already uses. `PrismaModule` is `@Global()`
// already; imported explicitly anyway for the same self-sufficiency reason
// `HistoryModule`'s own doc comment gives.
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [TwinProfileController],
  providers: [TwinProfileService, { provide: TWIN_PROFILE_STORE, useClass: PrismaTwinProfileStore }],
})
export class TwinProfileModule {}
