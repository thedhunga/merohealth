import type { TwinFact } from '@swasthya/shared-types';

export const TWIN_PROFILE_STORE = 'TWIN_PROFILE_STORE';

export interface ConfirmTwinProfileInput {
  userId: string;
  facts: readonly TwinFact[];
}

/**
 * Port behind `POST /twin/confirm-profile` — same "port here, `Prisma*`
 * adapter plus an in-memory test fake" shape as `HistoryStore`/
 * `FamilyGrantsStore`. One method: every fact in a confirmation is a plain
 * insert (`TwinProfileService` already built the fully-formed, already
 * `PATIENT_CONFIRMED` `TwinFact`s — see `confirmPatientReportedFact` in
 * `@swasthya/digital-twin`), so there is no lookup-then-decide step for this
 * port to expose.
 */
export interface TwinProfileStore {
  confirmFacts(input: ConfirmTwinProfileInput): Promise<{ created: number }>;
}
