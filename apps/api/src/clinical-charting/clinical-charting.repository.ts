import { Injectable } from '@nestjs/common';
import type { ChartingTemplate, Encounter, SoapNote } from '@swasthya/shared-types';

/**
 * Process-local stand-in for a real store, same convention
 * `SchedulingRepository`/`PatientRegistryRepository` already set: the
 * service/controller code above this does not change once the in-memory maps
 * are swapped for real persistence, only this file does.
 */
@Injectable()
export class ClinicalChartingRepository {
  readonly #encounters = new Map<string, Encounter>();
  readonly #notes = new Map<string, SoapNote>();
  readonly #templates = new Map<string, ChartingTemplate>();

  saveEncounter(encounter: Encounter): Encounter {
    this.#encounters.set(encounter.id, encounter);
    return encounter;
  }

  findEncounter(id: string): Encounter | null {
    return this.#encounters.get(id) ?? null;
  }

  listEncounters(patientId?: string): Encounter[] {
    const all = [...this.#encounters.values()];
    return patientId === undefined ? all : all.filter((encounter) => encounter.patientId === patientId);
  }

  saveNote(note: SoapNote): SoapNote {
    this.#notes.set(note.id, note);
    return note;
  }

  findNote(id: string): SoapNote | null {
    return this.#notes.get(id) ?? null;
  }

  listNotesForEncounter(encounterId: string): SoapNote[] {
    return [...this.#notes.values()].filter((note) => note.encounterId === encounterId);
  }

  saveTemplate(template: ChartingTemplate): ChartingTemplate {
    this.#templates.set(template.id, template);
    return template;
  }

  listTemplates(): ChartingTemplate[] {
    return [...this.#templates.values()];
  }
}
