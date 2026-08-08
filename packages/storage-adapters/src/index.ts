import type { PlanTier, StorageBackend, StoredRef } from '@swasthya/shared-types';
import { hasModule } from '@swasthya/entitlements';

/**
 * Storage port.
 *
 * Everything upstream of this interface is storage-agnostic: `health-records`
 * never knows whether a document sits in our object store or in the person's
 * own Google Drive. That is the seam which makes "your data, your storage"
 * possible without forking the record pipeline.
 */

export interface DocumentBlob {
  bytes: Uint8Array;
  /** Null when the payload is a client-encrypted blob we cannot introspect. */
  contentType: string | null;
  clientEncrypted: boolean;
}

export interface PutRequest {
  ownerId: string;
  /** Caller-chosen logical name; adapters may not preserve it verbatim. */
  filename: string;
  blob: DocumentBlob;
}

export interface StoreCapabilities {
  backend: StorageBackend;
  /** Can the server read plaintext bytes, i.e. run OCR and extraction? */
  serverSideProcessing: boolean;
  /** Must the caller encrypt before handing bytes over? */
  requiresClientEncryption: boolean;
  /** Can the store issue a shareable, revocable, time-limited URL? */
  supportsShareLinks: boolean;
  /** Does the store keep prior versions of a replaced document? */
  supportsVersioning: boolean;
}

export interface HealthDocumentStore {
  capabilities(): StoreCapabilities;
  put(request: PutRequest): Promise<StoredRef>;
  get(ref: StoredRef): Promise<DocumentBlob>;
  list(ownerId: string): Promise<readonly StoredRef[]>;
  delete(ref: StoredRef): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * Backend capability descriptors
 * ------------------------------------------------------------------ */

/**
 * Consumer Google Drive carries no business-associate agreement, and in the
 * person's own Drive folder they — not Mero Health — are the controller of the
 * data. So the Drive adapter treats every document as an opaque encrypted
 * blob: we can store and retrieve it, but we cannot read it, which means no
 * server-side OCR or extraction. Extraction for this backend has to happen
 * on-device before upload.
 */
export const backendCapabilities: Readonly<Record<StorageBackend, StoreCapabilities>> = {
  HOSTED: {
    backend: 'HOSTED',
    serverSideProcessing: true,
    requiresClientEncryption: false,
    supportsShareLinks: true,
    supportsVersioning: true,
  },
  GOOGLE_DRIVE: {
    backend: 'GOOGLE_DRIVE',
    serverSideProcessing: false,
    requiresClientEncryption: true,
    supportsShareLinks: false,
    supportsVersioning: false,
  },
};

/* ------------------------------------------------------------------ *
 * Placement policy
 * ------------------------------------------------------------------ */

export interface StoragePlacement {
  backend: StorageBackend;
  capabilities: StoreCapabilities;
  /** True when extraction must run on the device rather than the server. */
  extractionMustRunOnDevice: boolean;
  /** Set when the preferred backend was not available on this tier. */
  fellBackFrom: StorageBackend | null;
}

const backendModule = {
  HOSTED: 'HOSTED_STORAGE',
  GOOGLE_DRIVE: 'BRING_YOUR_OWN_STORAGE',
} as const;

/**
 * Resolves which backend a document should go to.
 *
 * Falls back rather than failing: someone on the free tier who asks for hosted
 * storage gets their own Drive with `fellBackFrom` set, so the UI can explain
 * the substitution and offer an upgrade.
 */
export function resolveStoragePlacement(
  tier: PlanTier,
  preferred: StorageBackend,
): StoragePlacement {
  const allowed = hasModule(tier, backendModule[preferred]);
  // Bring-your-own storage is on every tier, so it is always a safe landing
  // place when the preferred backend is not entitled.
  const backend: StorageBackend = allowed ? preferred : 'GOOGLE_DRIVE';
  const capabilities = backendCapabilities[backend];

  return {
    backend,
    capabilities,
    extractionMustRunOnDevice: !capabilities.serverSideProcessing,
    fellBackFrom: allowed ? null : preferred,
  };
}

export class StoragePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoragePolicyError';
  }
}

/**
 * Guards the invariant that makes the Drive adapter defensible: a backend we
 * do not control must never receive readable health data.
 */
export function assertPlacementAllowed(backend: StorageBackend, blob: DocumentBlob): void {
  const capabilities = backendCapabilities[backend];

  if (capabilities.requiresClientEncryption && !blob.clientEncrypted) {
    throw new StoragePolicyError(
      `Backend ${backend} requires client-side encryption; refusing to store readable health data.`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * In-memory adapter
 * ------------------------------------------------------------------ */

/**
 * Reference implementation of the port. Used by tests and local development;
 * the hosted (S3/MinIO) and Google Drive adapters implement the same
 * interface and are wired in `apps/api`.
 */
export class InMemoryDocumentStore implements HealthDocumentStore {
  readonly #backend: StorageBackend;
  readonly #objects = new Map<string, { ownerId: string; blob: DocumentBlob; ref: StoredRef }>();
  #counter = 0;

  constructor(backend: StorageBackend = 'HOSTED') {
    this.#backend = backend;
  }

  capabilities(): StoreCapabilities {
    return backendCapabilities[this.#backend];
  }

  // Async so a policy violation surfaces as a rejected promise rather than a
  // synchronous throw, which callers of the port would not expect.
  async put(request: PutRequest): Promise<StoredRef> {
    assertPlacementAllowed(this.#backend, request.blob);

    this.#counter += 1;
    const externalId = `${this.#backend.toLowerCase()}-${this.#counter}`;

    const ref: StoredRef = {
      backend: this.#backend,
      externalId,
      byteSize: request.blob.bytes.byteLength,
      contentType: request.blob.contentType,
      checksumSha256: checksum(request.blob.bytes),
    };

    this.#objects.set(externalId, { ownerId: request.ownerId, blob: request.blob, ref });
    return ref;
  }

  get(ref: StoredRef): Promise<DocumentBlob> {
    const found = this.#objects.get(ref.externalId);
    if (!found) return Promise.reject(new Error(`No object for ref ${ref.externalId}`));
    return Promise.resolve(found.blob);
  }

  list(ownerId: string): Promise<readonly StoredRef[]> {
    const refs = [...this.#objects.values()]
      .filter((entry) => entry.ownerId === ownerId)
      .map((entry) => entry.ref);
    return Promise.resolve(refs);
  }

  delete(ref: StoredRef): Promise<void> {
    this.#objects.delete(ref.externalId);
    return Promise.resolve();
  }
}

/**
 * Deterministic non-cryptographic digest, sufficient for de-duplicating an
 * upload in memory. The hosted adapter records a real SHA-256 from the object
 * store instead.
 */
function checksum(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
