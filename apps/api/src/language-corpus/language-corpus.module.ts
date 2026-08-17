import { Module } from '@nestjs/common';
import { InMemoryDocumentStore, type HealthDocumentStore } from '@swasthya/storage-adapters';
import { MinioDocumentStore, minioConfigFromEnv } from '@swasthya/storage-adapters/hosted';
import { AuthModule } from '../auth/auth.module.js';
import { SUBSCRIPTION_GRANT_STORE } from '../entitlements/subscription-grant.store.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaSubscriptionGrantStore } from '../entitlements/prisma-subscription-grant.store.js';
import { CorpusReviewerGuard } from './corpus-reviewer.guard.js';
import { LanguageCorpusController } from './language-corpus.controller.js';
import { LanguageCorpusRepository } from './language-corpus.repository.js';
import { LanguageCorpusService, VOICE_CLIP_AUDIO_STORE } from './language-corpus.service.js';

/**
 * Same `OBJECT_STORAGE_ENDPOINT`-gated choice `RecordsModule.createDocumentStore`
 * already makes, for the same reason: a bare checkout with no MinIO running
 * still boots and this module's own tests never need one. Deliberately reuses
 * the health-document bucket rather than opting into a bucket of its own —
 * both are the same self-hosted object store `compose.yaml` already declares,
 * and adding a second `OBJECT_STORAGE_*_CORPUS`-style env contract for one
 * more bucket would be new deployment surface for no real isolation, since
 * `MinioDocumentStore` already scopes every object under `${ownerId}/...`
 * and `LanguageCorpusService.submitVoiceClip` further prefixes the filename
 * with `voice-contribution-` so these objects stay visually distinct from
 * health documents in the same owner's prefix. The real separation that
 * matters — a voice clip never appearing in someone's health-record list —
 * is enforced by `LanguageCorpusRepository`'s own separate `#voiceClips` map,
 * not by bucket choice.
 */
function createVoiceClipAudioStore(): HealthDocumentStore {
  return process.env['OBJECT_STORAGE_ENDPOINT']
    ? new MinioDocumentStore(minioConfigFromEnv())
    : new InMemoryDocumentStore('HOSTED');
}

/**
 * Imports `AuthModule` for `SessionAuthGuard` — the same "import the module,
 * get the guard" wiring `CredentialingModule` already uses. `CorpusReviewerGuard`
 * now reads `request.authUser`, which only `SessionAuthGuard` populates, so
 * every reviewer route runs `@UseGuards(SessionAuthGuard, CorpusReviewerGuard)`
 * in that order.
 *
 * `PrismaModule` is `@Global()` already; imported explicitly anyway so this
 * module stays self-sufficient if it is ever tested or reused on its own,
 * the same redundant-import reasoning `FamilyModule` gives for its own copy.
 * `SUBSCRIPTION_GRANT_STORE` bound here (not a shared `EntitlementsModule`)
 * because this is the only module that grants a corpus-contribution reward
 * today — the same "own its own port binding" shape `RecordsModule` uses for
 * `SUBSCRIPTION_RESOLVER`/`USAGE_READER`.
 */
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [LanguageCorpusController],
  providers: [
    LanguageCorpusRepository,
    LanguageCorpusService,
    CorpusReviewerGuard,
    { provide: VOICE_CLIP_AUDIO_STORE, useFactory: createVoiceClipAudioStore },
    { provide: SUBSCRIPTION_GRANT_STORE, useClass: PrismaSubscriptionGrantStore },
  ],
})
export class LanguageCorpusModule {}
