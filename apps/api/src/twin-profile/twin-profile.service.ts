import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { confirmPatientReportedFact } from '@swasthya/digital-twin';
import type { TwinFact } from '@swasthya/shared-types';
import { TWIN_PROFILE_STORE, type TwinProfileStore } from './twin-profile-store.js';

export interface ConfirmProfileInput {
  ageBand?: string | undefined;
  askingFor?: string | undefined;
  conditions?: string[] | undefined;
}

/**
 * Server-side, not translated: these labels are never rendered as UI copy
 * today (no route reads `SubjectTwinFact` back yet), so they are a stable
 * internal field name for the record, the same role a raw `kind` string
 * already plays untranslated in every other `TwinFact`-shaped table in this
 * schema. The Nepali-first rule in the ledger's standing constraints governs
 * strings a person actually reads; this isn't one, and inventing a
 * translation table for a label nothing displays would be exactly the
 * un-asked-for abstraction the working agreement warns against. The day a
 * route does render these, that route's own translation keys are the right
 * place to add copy — not a language flag baked into the write path.
 */
const LABELS: Record<'AGE_BAND' | 'CARE_FOCUS' | 'CONDITION', string> = {
  AGE_BAND: 'Age range',
  CARE_FOCUS: 'Usually asks about',
  CONDITION: 'Chronic condition',
};

@Injectable()
export class TwinProfileService {
  constructor(@Inject(TWIN_PROFILE_STORE) private readonly store: TwinProfileStore) {}

  /**
   * Builds one `TwinFact` per field the person just confirmed and persists
   * them together. Nothing here decides *whether* to confirm — the
   * controller only reaches this once a signed-in person has explicitly
   * chosen "save to my profile" over "not now" on `apps/web`'s
   * `ProfileConfirmationCard`, which is the whole point of Round four F2:
   * the anonymous chip tap that produced these values was a hint, and this
   * method is the one place a hint becomes a `PATIENT_REPORTED`/
   * `PATIENT_CONFIRMED` fact.
   */
  async confirmProfile(userId: string, input: ConfirmProfileInput): Promise<{ created: number }> {
    const now = new Date().toISOString();
    const facts: TwinFact[] = [];

    if (input.ageBand) facts.push(buildFact('AGE_BAND', input.ageBand, 'STANDARD', now));
    if (input.askingFor) facts.push(buildFact('CARE_FOCUS', input.askingFor, 'STANDARD', now));
    for (const condition of input.conditions ?? []) {
      facts.push(buildFact('CONDITION', condition, 'SENSITIVE', now));
    }

    return this.store.confirmFacts({ userId, facts });
  }
}

function buildFact(kind: keyof typeof LABELS, value: string, sensitivity: TwinFact['sensitivity'], now: string): TwinFact {
  return confirmPatientReportedFact(randomUUID(), { kind, label: LABELS[kind], value, sensitivity }, now);
}
