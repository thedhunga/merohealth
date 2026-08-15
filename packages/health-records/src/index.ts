import type {
  DocumentStatus,
  HealthDocument,
  HealthObservation,
  ObservationStatus,
} from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Document lifecycle
 * ------------------------------------------------------------------ */

/**
 * Allowed status transitions for a captured document.
 *
 * `STORED → CONFIRMED` exists for the case where extraction never runs: on the
 * free tier, or when the file went to the person's own Drive as an encrypted
 * blob the server cannot read. The document is still a first-class part of the
 * record, it simply has no machine-extracted observations attached.
 */
const transitions: Readonly<Record<DocumentStatus, readonly DocumentStatus[]>> = {
  CAPTURED: ['UPLOADING', 'DELETED'],
  UPLOADING: ['STORED', 'DELETED'],
  STORED: ['EXTRACTING', 'CONFIRMED', 'DELETED'],
  EXTRACTING: ['AWAITING_CONFIRMATION', 'EXTRACTION_FAILED', 'DELETED'],
  AWAITING_CONFIRMATION: ['CONFIRMED', 'EXTRACTING', 'DELETED'],
  CONFIRMED: ['EXTRACTING', 'DELETED'],
  EXTRACTION_FAILED: ['EXTRACTING', 'CONFIRMED', 'DELETED'],
  DELETED: [],
};

export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  return (transitions[from] ?? []).includes(to);
}

export class DocumentTransitionError extends Error {
  constructor(from: DocumentStatus, to: DocumentStatus) {
    super(`Illegal document transition: ${from} → ${to}`);
    this.name = 'DocumentTransitionError';
  }
}

export function transitionDocument(
  document: HealthDocument,
  to: DocumentStatus,
): HealthDocument {
  if (!canTransition(document.status, to)) {
    throw new DocumentTransitionError(document.status, to);
  }
  return { ...document, status: to };
}

/* ------------------------------------------------------------------ *
 * Extraction and confirmation
 * ------------------------------------------------------------------ */

/**
 * Extractions below this confidence are always shown to the person for
 * confirmation with the low-confidence flag set. Handwritten Nepali
 * prescriptions sit near the worst case for OCR, so the confirmation step is a
 * permanent part of the design rather than a temporary crutch.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.75;

export function isLowConfidence(observation: HealthObservation): boolean {
  return observation.confidence !== null && observation.confidence < LOW_CONFIDENCE_THRESHOLD;
}

/**
 * Observations that are safe to reason over.
 *
 * Anything still in DRAFT has not been seen by the person, and a REJECTED
 * value was explicitly wrong. Neither may reach the assistant, a share link or
 * a provider export.
 */
const trustedStatuses: readonly ObservationStatus[] = ['CONFIRMED', 'CORRECTED'];

export function isTrusted(observation: HealthObservation): boolean {
  return trustedStatuses.includes(observation.status);
}

export function selectTrusted(
  observations: readonly HealthObservation[],
): readonly HealthObservation[] {
  return observations.filter(isTrusted);
}

export function confirmObservation(observation: HealthObservation): HealthObservation {
  return { ...observation, status: 'CONFIRMED' };
}

/**
 * A correction replaces the extracted value with the person's own. Provenance
 * flips to patient-reported and confidence is cleared, because the number no
 * longer came from the extractor.
 */
export function correctObservation(
  observation: HealthObservation,
  value: string,
  unit: string | null = observation.unit,
): HealthObservation {
  return {
    ...observation,
    value,
    unit,
    status: 'CORRECTED',
    provenance: 'PATIENT_REPORTED',
    confidence: null,
  };
}

export function rejectObservation(observation: HealthObservation): HealthObservation {
  return { ...observation, status: 'REJECTED' };
}

/** Draft observations still awaiting the person's confirmation, worst first. */
export function pendingConfirmations(
  observations: readonly HealthObservation[],
): readonly HealthObservation[] {
  return observations
    .filter((observation) => observation.status === 'DRAFT')
    .toSorted((a, b) => (a.confidence ?? 1) - (b.confidence ?? 1));
}

/* ------------------------------------------------------------------ *
 * Trends — what grounds the assistant
 * ------------------------------------------------------------------ */

/**
 * `Number.parseFloat` only parses a leading numeric prefix — `"70-99"` (a
 * reference-range string, the exact shape `HealthObservation.referenceRange`
 * uses, which someone could paste into `value` by mistake) parses to `70`
 * instead of being rejected. A trend point must come from a value that is
 * numeric in full, not one that merely starts that way.
 */
export function parseStrictNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface AnalytePoint {
  value: number;
  unit: string | null;
  effectiveAt: string;
  documentId: string;
  abnormalFlag: HealthObservation['abnormalFlag'];
}

export interface AnalyteTrend {
  code: string;
  labelNe: string;
  labelEn: string;
  points: readonly AnalytePoint[];
  /** Null when fewer than two comparable points exist. */
  direction: 'RISING' | 'FALLING' | 'STABLE' | null;
  /** Units seen across the series; more than one means do not compare blindly. */
  units: readonly string[];
}

/**
 * Builds a chronological series for one analyte — the query that makes the
 * assistant useful ("what has my creatinine done over the last three tests?").
 *
 * Only trusted observations are included, and points whose value is not
 * numeric are dropped rather than coerced. If the series mixes units, the
 * direction is withheld: comparing mg/dL against µmol/L would produce a
 * confident and wrong answer.
 */
export function buildAnalyteTrend(
  observations: readonly HealthObservation[],
  code: string,
): AnalyteTrend | null {
  const matching = selectTrusted(observations).filter(
    (observation) => observation.code === code && observation.effectiveAt !== null,
  );

  const first = matching[0];
  if (!first) return null;

  const points: AnalytePoint[] = [];
  for (const observation of matching) {
    const value = parseStrictNumber(observation.value);
    if (value === null || observation.effectiveAt === null) continue;

    points.push({
      value,
      unit: observation.unit,
      effectiveAt: observation.effectiveAt,
      documentId: observation.documentId,
      abnormalFlag: observation.abnormalFlag,
    });
  }

  if (points.length === 0) return null;

  points.sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt));

  const units = [...new Set(points.map((point) => point.unit).filter((u): u is string => u !== null))];

  return {
    code,
    labelNe: first.labelNe,
    labelEn: first.labelEn,
    points,
    direction: units.length > 1 ? null : deriveDirection(points),
    units,
  };
}

/**
 * Direction across the series, using a 5% band so ordinary assay noise does
 * not read as a trend.
 */
function deriveDirection(points: readonly AnalytePoint[]): AnalyteTrend['direction'] {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return null;
  if (first.value === 0) return last.value === 0 ? 'STABLE' : null;

  const change = (last.value - first.value) / Math.abs(first.value);
  if (change > 0.05) return 'RISING';
  if (change < -0.05) return 'FALLING';
  return 'STABLE';
}

/* ------------------------------------------------------------------ *
 * Timeline
 * ------------------------------------------------------------------ */

export interface TimelineEntry {
  documentId: string;
  title: string;
  kind: HealthDocument['kind'];
  /** Care-event date where known, otherwise capture date. */
  occurredAt: string;
  observationCount: number;
  pendingCount: number;
  hasAbnormal: boolean;
}

/** Reverse-chronological record view. Deleted documents are excluded. */
export function buildTimeline(
  documents: readonly HealthDocument[],
  observations: readonly HealthObservation[],
): readonly TimelineEntry[] {
  const byDocument = new Map<string, HealthObservation[]>();
  for (const observation of observations) {
    const bucket = byDocument.get(observation.documentId);
    if (bucket) bucket.push(observation);
    else byDocument.set(observation.documentId, [observation]);
  }

  return documents
    .filter((document) => document.status !== 'DELETED')
    .map((document) => {
      const own = byDocument.get(document.id) ?? [];
      const trusted = own.filter(isTrusted);

      return {
        documentId: document.id,
        title: document.title,
        kind: document.kind,
        occurredAt: document.documentDate ?? document.capturedAt,
        observationCount: trusted.length,
        pendingCount: own.filter((observation) => observation.status === 'DRAFT').length,
        hasAbnormal: trusted.some(
          (observation) =>
            observation.abnormalFlag === 'HIGH' ||
            observation.abnormalFlag === 'LOW' ||
            observation.abnormalFlag === 'CRITICAL',
        ),
      };
    })
    .toSorted((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
