import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EncounterAlreadyClosedError,
  EncounterNotOpenError,
  attachDocument,
  closeEncounter,
  createChartingTemplate,
  openEncounter,
  recordSoapNote,
  reviseSoapNote,
} from '@swasthya/clinical-charting';
import type {
  ChartingTemplate,
  ClinicalModuleHealth,
  CreateChartingTemplateInput,
  Encounter,
  OpenEncounterInput,
  SoapNote,
  SoapNoteInput,
} from '@swasthya/shared-types';
import { RecordsService } from '../records/records.service.js';
import { ClinicalChartingRepository } from './clinical-charting.repository.js';

/**
 * clinical-suite.md capability map row 3: "Core EHR surface. Consumes
 * health-records." `documents` is injected as `RecordsService` — its public
 * port, per §2 rule 3 ("a module may import another's types; never its
 * repository, its client, or its tables") — not `RecordsRepository`. Only
 * `attachDocument` actually calls into it; opening an encounter, closing it
 * and writing or revising a SOAP note never touch health-records at all, so
 * the core charting surface keeps working even if health-records never
 * resolves.
 */
@Injectable()
export class ClinicalChartingService {
  constructor(
    private readonly repository: ClinicalChartingRepository,
    private readonly documents: RecordsService,
  ) {}

  openEncounter(input: OpenEncounterInput): Encounter {
    return this.repository.saveEncounter(openEncounter(randomUUID(), input, new Date().toISOString()));
  }

  getEncounter(id: string): Encounter {
    const encounter = this.repository.findEncounter(id);
    if (!encounter) throw new NotFoundException(`No encounter ${id}`);
    return encounter;
  }

  listEncounters(patientId?: string): Encounter[] {
    return this.repository.listEncounters(patientId);
  }

  closeEncounter(id: string): Encounter {
    return this.repository.saveEncounter(
      this.runTransition(() => closeEncounter(this.getEncounter(id), new Date().toISOString())),
    );
  }

  recordNote(encounterId: string, input: SoapNoteInput): SoapNote {
    const encounter = this.getEncounter(encounterId);
    return this.repository.saveNote(
      this.runTransition(() => recordSoapNote(encounter, randomUUID(), input, new Date().toISOString())),
    );
  }

  getNote(id: string): SoapNote {
    const note = this.repository.findNote(id);
    if (!note) throw new NotFoundException(`No note ${id}`);
    return note;
  }

  reviseNote(noteId: string, content: Omit<SoapNoteInput, 'authorId'>): SoapNote {
    const note = this.getNote(noteId);
    const encounter = this.getEncounter(note.encounterId);
    return this.repository.saveNote(
      this.runTransition(() => reviseSoapNote(encounter, note, content, new Date().toISOString())),
    );
  }

  listNotes(encounterId: string): SoapNote[] {
    this.getEncounter(encounterId);
    return this.repository.listNotesForEncounter(encounterId);
  }

  /**
   * The one action gated on health-records. §2's `HIDE` mode ("remove the
   * surface entirely; nothing else notices") has no literal surface to hide
   * yet — no apps/web/apps/mobile page renders this attach action — so the
   * honest API-boundary equivalent is refusing the call outright rather than
   * silently accepting a document reference this module cannot verify.
   * Encounter existence is checked first: it is this module's own data, not a
   * cross-module read, so an unknown encounter id should 404 even while
   * health-records is down.
   */
  async attachDocument(encounterId: string, documentId: string): Promise<Encounter> {
    const encounter = this.getEncounter(encounterId);
    await this.assertHealthRecordsAvailable();
    // Resolves the opaque documentId through health-records' own port (§2
    // rule 1) — throws NotFoundException for an id that was never recorded
    // there, the same 404 shape every other lookup in this API already uses.
    this.documents.getDocument(documentId);
    return this.repository.saveEncounter(
      this.runTransition(() => attachDocument(encounter, documentId, new Date().toISOString())),
    );
  }

  private async assertHealthRecordsAvailable(): Promise<void> {
    const health = await this.documents.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Document attachment unavailable: health-records is down (clinical-suite.md capability map row 3)',
      );
    }
  }

  /**
   * Wraps every `@swasthya/clinical-charting` transition: a wrong-state call
   * (a note or attachment against a closed encounter, closing an
   * already-closed one) previously reached the client as a bare, codeless
   * 500. Mapped to `BadRequestException({ code, message })`, the same
   * convention `BillingService.runTransition`/`PrescribingService.runTransition`
   * already established.
   */
  private runTransition<T>(transition: () => T): T {
    try {
      return transition();
    } catch (error) {
      if (error instanceof EncounterAlreadyClosedError || error instanceof EncounterNotOpenError) {
        throw new BadRequestException({ code: error.name, message: error.message });
      }
      throw error;
    }
  }

  createTemplate(input: CreateChartingTemplateInput): ChartingTemplate {
    return this.repository.saveTemplate(createChartingTemplate(randomUUID(), input, new Date().toISOString()));
  }

  listTemplates(): ChartingTemplate[] {
    return this.repository.listTemplates();
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. Reports this
   * module's own condition only — whether CLINICAL_CHARTING is degraded by
   * health-records being down is computed separately, by
   * `resolveAvailability` cross-referencing both modules' health, not by
   * this module reporting itself unhealthy on a dependency's behalf.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
