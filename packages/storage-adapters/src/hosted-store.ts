import { createHash, randomUUID } from 'node:crypto';
import { Client as MinioClient, type BucketItem, type ItemBucketMetadata } from 'minio';
import type { StoredRef } from '@swasthya/shared-types';
import {
  assertPlacementAllowed,
  backendCapabilities,
  type DocumentBlob,
  type HealthDocumentStore,
  type PutRequest,
  type StoreCapabilities,
} from './index.js';

/**
 * Node-only entry point, deliberately exported as `@swasthya/storage-adapters/hosted`
 * rather than from the package root: the `minio` client pulls in `node:http`/`node:net`,
 * which Metro cannot bundle for `apps/mobile`. Keeping it off the root `.` export means
 * that entry point stays safe for React Native even after this file starts depending on
 * Node built-ins the root never has.
 */

export interface MinioStoreConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  /** MinIO ignores the value but the S3 signing algorithm requires one. */
  region?: string;
}

/**
 * Reads the `OBJECT_STORAGE_*` variables `.env.example` already declares for the
 * MinIO service in `compose.yaml`, so this adapter introduces no new environment
 * contract for `apps/api` to wire up.
 */
export function minioConfigFromEnv(env: NodeJS.ProcessEnv = process.env): MinioStoreConfig {
  const endpoint = new URL(requireEnv(env, 'OBJECT_STORAGE_ENDPOINT'));
  return {
    endPoint: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : endpoint.protocol === 'https:' ? 443 : 80,
    useSSL: endpoint.protocol === 'https:',
    accessKey: requireEnv(env, 'OBJECT_STORAGE_ACCESS_KEY'),
    secretKey: requireEnv(env, 'OBJECT_STORAGE_SECRET_KEY'),
    bucket: requireEnv(env, 'OBJECT_STORAGE_BUCKET'),
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable ${key}`);
  return value;
}

/** Object-storage user-metadata key holding the checksum recorded on `StoredRef`. */
const CHECKSUM_META_KEY = 'checksum-sha256';

/**
 * S3-compatible adapter for the MinIO service already defined in `compose.yaml`.
 *
 * Objects are keyed `${ownerId}/${uuid}-${filename}` so `list` can scope to an
 * owner with a plain prefix query — the bucket stays the single source of truth
 * for what exists, with no side index of our own to fall out of sync with it.
 * `byteSize`/`contentType`/`checksumSha256` all come back from the object's own
 * stored metadata on `list`/`get`, not a database row, for the same reason.
 */
export class MinioDocumentStore implements HealthDocumentStore {
  readonly #client: MinioClient;
  readonly #bucket: string;
  #bucketReady: Promise<void> | null = null;

  constructor(config: MinioStoreConfig) {
    this.#client = new MinioClient({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region ?? 'us-east-1',
    });
    this.#bucket = config.bucket;
  }

  capabilities(): StoreCapabilities {
    return backendCapabilities.HOSTED;
  }

  async put(request: PutRequest): Promise<StoredRef> {
    // Same defense-in-depth `RecordsService`'s own doc comment calls for: the
    // caller already checks this, but the adapter re-checks rather than trusting
    // every future caller to remember to, matching `InMemoryDocumentStore`.
    assertPlacementAllowed('HOSTED', request.blob);
    await this.#ensureBucket();

    const objectName = `${request.ownerId}/${randomUUID()}-${sanitizeFilename(request.filename)}`;
    const checksumSha256 = sha256Hex(request.blob.bytes);
    const metaData: Record<string, string> = { [CHECKSUM_META_KEY]: checksumSha256 };
    if (request.blob.contentType) metaData['content-type'] = request.blob.contentType;

    await this.#client.putObject(
      this.#bucket,
      objectName,
      Buffer.from(request.blob.bytes),
      request.blob.bytes.byteLength,
      metaData,
    );

    return {
      backend: 'HOSTED',
      externalId: objectName,
      byteSize: request.blob.bytes.byteLength,
      contentType: request.blob.contentType,
      checksumSha256,
    };
  }

  async get(ref: StoredRef): Promise<DocumentBlob> {
    requireHostedRef(ref);
    const stream = await this.#client.getObject(this.#bucket, ref.externalId);
    return {
      bytes: await readAll(stream),
      contentType: ref.contentType,
      clientEncrypted: false,
    };
  }

  async list(ownerId: string): Promise<readonly StoredRef[]> {
    await this.#ensureBucket();
    const names = await this.#listObjectNames(ownerId);
    return Promise.all(names.map((name) => this.#statToRef(name)));
  }

  async delete(ref: StoredRef): Promise<void> {
    requireHostedRef(ref);
    await this.#client.removeObject(this.#bucket, ref.externalId);
  }

  /**
   * `BucketStream`'s own declared type only carries `T` through its event-based
   * `.on('data', ...)` API, not through async iteration (that falls back to the
   * DOM `ReadableStream`'s untyped default) — using `on` here, rather than
   * `for await`, is what keeps `item` typed as `BucketItem` instead of `any`.
   */
  #listObjectNames(ownerId: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const names: string[] = [];
      const stream = this.#client.listObjectsV2(this.#bucket, `${ownerId}/`, true);
      stream.on('data', (item: BucketItem) => {
        if (item.name) names.push(item.name);
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(names));
    });
  }

  async #statToRef(objectName: string): Promise<StoredRef> {
    const stat = await this.#client.statObject(this.#bucket, objectName);
    return {
      backend: 'HOSTED',
      externalId: objectName,
      byteSize: stat.size,
      contentType: readMetaString(stat.metaData, 'content-type'),
      checksumSha256: readMetaString(stat.metaData, CHECKSUM_META_KEY) ?? '',
    };
  }

  /** Memoised so concurrent `put`s racing on first use don't call `makeBucket` twice. */
  #ensureBucket(): Promise<void> {
    this.#bucketReady ??= this.#client.bucketExists(this.#bucket).then((exists) => {
      if (!exists) return this.#client.makeBucket(this.#bucket);
    });
    return this.#bucketReady;
  }
}

function requireHostedRef(ref: StoredRef): void {
  if (ref.backend !== 'HOSTED') {
    throw new Error(`MinioDocumentStore cannot resolve a ${ref.backend} ref`);
  }
}

/** S3 object keys allow most characters, but keeps generated keys predictable and URL-safe. */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * `ItemBucketMetadata`'s index signature is `any` (minio's own typings, not ours),
 * so this narrows through `unknown` rather than trusting the library's type —
 * a stat response is one place an object we didn't write ourselves reaches this
 * adapter, and it should degrade to `null` rather than propagate a wrong type.
 */
function readMetaString(metaData: ItemBucketMetadata, key: string): string | null {
  const value: unknown = metaData[key];
  return typeof value === 'string' ? value : null;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readAll(stream: NodeJS.ReadableStream): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return new Uint8Array(Buffer.concat(chunks));
}
