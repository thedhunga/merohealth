import { isTrusted, selectTrusted } from '@swasthya/health-records';
import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * FHIR R4 — minimal resource shapes
 *
 * Only the fields this platform actually populates. Not a general-purpose
 * FHIR client: the goal named in platform-vision.md §3.3 is that modelling to
 * FHIR internally "costs little and makes step 4 [real hospital-system
 * interop] mechanical" once a partner exists, not to implement the spec.
 * ------------------------------------------------------------------ */

export interface FhirCoding {
  system: string;
  code: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: readonly FhirCoding[];
  text?: string;
}

export interface FhirReference {
  reference: string;
}

export interface FhirAttachment {
  contentType: string | null;
  title: string;
  size: number;
}

export interface FhirDocumentReference {
  resourceType: 'DocumentReference';
  id: string;
  status: 'current';
  /**
   * Text only, deliberately no `coding`: LOINC has document-type codes (e.g.
   * discharge summaries), but this run could not verify a correct code for
   * every `HealthDocumentKind` with certainty, and the standing "invent no
   * facts" constraint applies to a wrong clinical code exactly as much as to
   * a wrong statistic.
   */
  type: FhirCodeableConcept;
  subject: FhirReference;
  date: string;
  content: readonly { attachment: FhirAttachment }[];
}

export interface FhirQuantity {
  value: number;
  unit: string;
}

export interface FhirObservation {
  resourceType: 'Observation';
  id: string;
  /** DRAFT/REJECTED never reach here — see `toFhirObservation`. */
  status: 'final' | 'corrected';
  code: FhirCodeableConcept;
  subject: FhirReference;
  effectiveDateTime?: string;
  valueQuantity?: FhirQuantity;
  /** Set instead of `valueQuantity` when the source value is not numeric. */
  valueString?: string;
  referenceRange?: readonly { text: string }[];
  interpretation?: readonly FhirCodeableConcept[];
  derivedFrom?: readonly FhirReference[];
}

export type FhirResource = FhirDocumentReference | FhirObservation;

export interface FhirBundle {
  resourceType: 'Bundle';
  type: 'collection';
  timestamp: string;
  entry: readonly { resource: FhirResource }[];
}

/**
 * `codeSystem` → canonical FHIR system URI. `LOCAL` is not a real registered
 * system, so it gets an URN scoped to this product rather than borrowing a
 * URI that would imply a standards body backs it.
 */
const codeSystemUri: Readonly<Record<HealthObservation['codeSystem'], string>> = {
  LOINC: 'http://loinc.org',
  SNOMED: 'http://snomed.info/sct',
  ATC: 'http://www.whocc.no/atc',
  LOCAL: 'urn:mero-health:local-code',
};

/**
 * HL7 v3 ObservationInterpretation codes. `CRITICAL` maps to `AA` ("critical
 * abnormal") rather than `HH`/`LL`, because `HealthObservation.abnormalFlag`
 * does not record which direction a critical value went — asserting high or
 * low here would be inventing a fact the source document didn't necessarily
 * give us.
 */
const interpretationCode: Readonly<Record<'LOW' | 'HIGH' | 'NORMAL' | 'CRITICAL', string>> = {
  NORMAL: 'N',
  LOW: 'L',
  HIGH: 'H',
  CRITICAL: 'AA',
};

const INTERPRETATION_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';

export function toFhirDocumentReference(document: HealthDocument): FhirDocumentReference {
  return {
    resourceType: 'DocumentReference',
    id: document.id,
    status: 'current',
    type: { text: document.kind },
    subject: { reference: `Patient/${document.ownerId}` },
    date: document.documentDate ?? document.capturedAt,
    content: [
      {
        attachment: {
          contentType: document.ref.contentType,
          title: document.title,
          size: document.ref.byteSize,
        },
      },
    ],
  };
}

export class UntrustedObservationError extends Error {
  constructor(observationId: string, status: HealthObservation['status']) {
    super(
      `Observation ${observationId} is ${status}, not CONFIRMED/CORRECTED — refusing to map it to FHIR. ` +
        'A DRAFT or REJECTED observation must never reach an export or share link.',
    );
    this.name = 'UntrustedObservationError';
  }
}

/**
 * Maps one observation to FHIR. Throws for anything not CONFIRMED/CORRECTED
 * rather than trusting every caller to pre-filter — the same defence-in-depth
 * `assertPlacementAllowed` uses in `storage-adapters`, so the "only trusted
 * observations are ever exported" invariant holds even if a future caller
 * forgets to call `selectTrusted` first.
 */
export function toFhirObservation(observation: HealthObservation): FhirObservation {
  if (!isTrusted(observation)) {
    throw new UntrustedObservationError(observation.id, observation.status);
  }

  const numericValue = Number.parseFloat(observation.value);
  const isNumeric = Number.isFinite(numericValue) && observation.value.trim() !== '';

  const resource: FhirObservation = {
    resourceType: 'Observation',
    id: observation.id,
    status: observation.status === 'CORRECTED' ? 'corrected' : 'final',
    code: {
      coding: [
        { system: codeSystemUri[observation.codeSystem], code: observation.code, display: observation.labelEn },
      ],
      text: observation.labelEn,
    },
    subject: { reference: `Patient/${observation.ownerId}` },
    derivedFrom: [{ reference: `DocumentReference/${observation.documentId}` }],
  };

  if (observation.effectiveAt !== null) resource.effectiveDateTime = observation.effectiveAt;

  if (isNumeric && observation.unit !== null) {
    resource.valueQuantity = { value: numericValue, unit: observation.unit };
  } else {
    resource.valueString = observation.unit !== null ? `${observation.value} ${observation.unit}` : observation.value;
  }

  if (observation.referenceRange !== null) resource.referenceRange = [{ text: observation.referenceRange }];

  if (observation.abnormalFlag !== null) {
    resource.interpretation = [
      {
        coding: [
          {
            system: INTERPRETATION_SYSTEM,
            code: interpretationCode[observation.abnormalFlag],
            display: observation.abnormalFlag,
          },
        ],
      },
    ];
  }

  return resource;
}

/**
 * Builds the export/share bundle. Filters both inputs itself — deleted
 * documents and every non-trusted observation are dropped here, so a caller
 * that hands over an owner's full, unfiltered record set still cannot leak a
 * DRAFT extraction through this path.
 */
export function buildFhirExportBundle(
  documents: readonly HealthDocument[],
  observations: readonly HealthObservation[],
  generatedAt: string,
): FhirBundle {
  const includedDocuments = documents.filter((document) => document.status !== 'DELETED');
  const includedDocumentIds = new Set(includedDocuments.map((document) => document.id));

  const trustedObservations = selectTrusted(observations).filter((observation) =>
    includedDocumentIds.has(observation.documentId),
  );

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: generatedAt,
    entry: [
      ...includedDocuments.map((document) => ({ resource: toFhirDocumentReference(document) })),
      ...trustedObservations.map((observation) => ({ resource: toFhirObservation(observation) })),
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Share links — revocable, time-limited access to a scoped subset
 * ------------------------------------------------------------------ */

export interface ShareLink {
  id: string;
  /** Opaque bearer token carried in the share URL. Never logged verbatim. */
  token: string;
  ownerId: string;
  /** The records this link exposes. Empty is rejected by `issueShareLink`. */
  documentIds: readonly string[];
  createdAt: string;
  expiresAt: string;
  /** Null while active. Revocation is permanent — no "un-revoke". */
  revokedAt: string | null;
}

export class ShareLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShareLinkError';
  }
}

/**
 * `platform-vision.md` §3.3 specs a "time-limited" share link, not an
 * indefinite one — 30 days, matching `packages/auth`'s own `SESSION_TTL_MS`,
 * the longest lifetime already trusted elsewhere in this system. Without a
 * ceiling, `issueShareLink` only rejected `ttlSeconds <= 0`, so an owner
 * could request e.g. `Number.MAX_SAFE_INTEGER` and get a link that a
 * clinician-facing, unauthenticated `GET /interop/share/:token` route would
 * then honour effectively forever.
 */
export const MAX_SHARE_LINK_TTL_SECONDS = 30 * 24 * 60 * 60;

export class ShareLinkNotActiveError extends Error {
  constructor(token: string) {
    super(`Share link is expired or revoked.`);
    this.name = 'ShareLinkNotActiveError';
    // Deliberately excludes the token from the message: this error is the
    // kind that can end up in a log line, and the token is a bearer credential.
    void token;
  }
}

export interface IssueShareLinkRequest {
  /** Caller-supplied: id generation is an infrastructure concern, not this package's. */
  id: string;
  /** Caller-supplied unguessable token, e.g. `randomUUID()` or a CSPRNG string. */
  token: string;
  ownerId: string;
  documentIds: readonly string[];
  createdAt: string;
  ttlSeconds: number;
}

/**
 * Creates a share link, expiring `ttlSeconds` after `createdAt`. Pure: no
 * clock, no randomness — the caller supplies both, same convention
 * `health-records`' own lifecycle functions use, so this stays trivially
 * testable and safe to import into `apps/mobile` for an on-device share flow
 * later.
 */
export function issueShareLink(request: IssueShareLinkRequest): ShareLink {
  if (request.documentIds.length === 0) {
    throw new ShareLinkError('A share link must scope to at least one record.');
  }
  if (request.ttlSeconds <= 0) {
    throw new ShareLinkError('A share link must have a positive time limit.');
  }
  if (request.ttlSeconds > MAX_SHARE_LINK_TTL_SECONDS) {
    throw new ShareLinkError(`A share link cannot exceed ${MAX_SHARE_LINK_TTL_SECONDS} seconds (30 days).`);
  }

  const expiresAt = new Date(Date.parse(request.createdAt) + request.ttlSeconds * 1000).toISOString();

  return {
    id: request.id,
    token: request.token,
    ownerId: request.ownerId,
    documentIds: request.documentIds,
    createdAt: request.createdAt,
    expiresAt,
    revokedAt: null,
  };
}

export function revokeShareLink(link: ShareLink, revokedAt: string): ShareLink {
  return link.revokedAt !== null ? link : { ...link, revokedAt };
}

export function isShareLinkActive(link: ShareLink, now: string): boolean {
  return link.revokedAt === null && Date.parse(now) < Date.parse(link.expiresAt);
}

/**
 * Resolves a share link into the bundle it grants access to. Re-derives the
 * scope from `documents`/`observations` on every call rather than caching a
 * bundle at issue time, so a document deleted or an observation corrected
 * after the link was issued is reflected the next time it's opened — the
 * link grants access to the current trusted record, not a frozen snapshot.
 */
export function resolveSharedBundle(
  link: ShareLink,
  now: string,
  documents: readonly HealthDocument[],
  observations: readonly HealthObservation[],
): FhirBundle {
  if (!isShareLinkActive(link, now)) {
    throw new ShareLinkNotActiveError(link.token);
  }

  const scopedDocumentIds = new Set(link.documentIds);
  const scopedDocuments = documents.filter(
    (document) => document.ownerId === link.ownerId && scopedDocumentIds.has(document.id),
  );
  const scopedObservations = observations.filter((observation) => observation.ownerId === link.ownerId);

  return buildFhirExportBundle(scopedDocuments, scopedObservations, now);
}

/**
 * Persistence port for share links. One reference implementation
 * (`InMemoryShareLinkStore`) below, mirroring `HealthDocumentStore` in
 * `storage-adapters`: a real, database-backed implementation is out of scope
 * for this task the same way a real `HealthDocumentStore` adapter was out of
 * scope for `health-records` — this package defines the contract the next
 * run's `apps/api` wiring plugs into.
 */
export interface ShareLinkStore {
  save(link: ShareLink): Promise<ShareLink>;
  findByToken(token: string): Promise<ShareLink | null>;
  listActive(ownerId: string, now: string): Promise<readonly ShareLink[]>;
}

export class InMemoryShareLinkStore implements ShareLinkStore {
  readonly #byToken = new Map<string, ShareLink>();

  save(link: ShareLink): Promise<ShareLink> {
    this.#byToken.set(link.token, link);
    return Promise.resolve(link);
  }

  findByToken(token: string): Promise<ShareLink | null> {
    return Promise.resolve(this.#byToken.get(token) ?? null);
  }

  listActive(ownerId: string, now: string): Promise<readonly ShareLink[]> {
    const active = [...this.#byToken.values()].filter(
      (link) => link.ownerId === ownerId && isShareLinkActive(link, now),
    );
    return Promise.resolve(active);
  }
}
