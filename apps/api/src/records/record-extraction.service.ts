import type { HealthObservation } from '@swasthya/shared-types';

/**
 * One value the extractor found in an image, before it becomes a real
 * `HealthObservation` — `RecordsService` fills in `id`, `documentId`,
 * `ownerId`, `effectiveAt` and `extractionRunId`, none of which the extractor
 * itself can know.
 */
export interface ExtractedObservationDraft {
  code: string;
  codeSystem: HealthObservation['codeSystem'];
  labelNe: string;
  labelEn: string;
  value: string;
  unit: string | null;
  /** 0–1. Below `LOW_CONFIDENCE_THRESHOLD` (`@swasthya/health-records`) the
   * confirmation UI must flag it, never silently trust it. */
  confidence: number;
}

export interface ExtractionResult {
  /**
   * `setup-required` (no provider configured — the same distinction
   * `PerplexityHealthService`/`researchWithGemini` already make between "not
   * set up" and "attempted and failed") means the document simply stays
   * `STORED`: extraction was never attempted, so there is nothing to retry.
   * `unavailable` means the provider was attempted and failed — the document
   * moves to `EXTRACTION_FAILED`, the outage state a person can be told
   * "extraction will follow" about, because the document itself is safe.
   */
  status: 'complete' | 'setup-required' | 'unavailable';
  observations: readonly ExtractedObservationDraft[];
}

export interface ExtractionInput {
  contentType: string;
  bytes: Uint8Array;
}

/**
 * Port for turning a captured image into draft observations. One
 * implementation today (`GeminiRecordExtractionService`, scoped to blood
 * pressure only — the one analyte this round wires end to end), but kept as
 * an interface because the next analyte gets its own prompt, not its own
 * copy of `RecordsService`'s orchestration.
 */
export interface RecordExtractionService {
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}

export const RECORD_EXTRACTION_SERVICE = 'RECORD_EXTRACTION_SERVICE';
