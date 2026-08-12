import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import S3rver from 's3rver';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MinioDocumentStore, minioConfigFromEnv, type MinioStoreConfig } from './hosted-store.js';

/**
 * `s3rver` is a real, in-process S3-compatible HTTP server. There is no way to run
 * the actual MinIO binary in this environment (no Docker daemon, and the sandbox's
 * network policy blocks `dl.min.io`), so this drives the real `minio` client over a
 * real HTTP round trip against an S3-compatible server instead of mocking the client
 * — the adapter's request shaping, header handling and response parsing are all
 * genuinely exercised, just not against MinIO's own binary specifically.
 */
describe('MinioDocumentStore', () => {
  let server: InstanceType<typeof S3rver>;
  let dataDir: string;
  let config: MinioStoreConfig;

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 's3rver-'));
    server = new S3rver({ port: 0, address: 'localhost', silent: true, directory: dataDir });
    const { port } = await server.run();
    config = {
      endPoint: 'localhost',
      port,
      useSSL: false,
      accessKey: 'S3RVER',
      secretKey: 'S3RVER',
      bucket: 'mero-health-test',
    };
  });

  afterAll(async () => {
    await server.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  const plaintext = { bytes: new TextEncoder().encode('lab report bytes'), contentType: 'image/jpeg', clientEncrypted: false };

  it('round-trips a document with its checksum and content type', async () => {
    const store = new MinioDocumentStore(config);
    const ref = await store.put({ ownerId: 'owner-1', filename: 'lab report.jpg', blob: plaintext });

    expect(ref.backend).toBe('HOSTED');
    expect(ref.byteSize).toBe(plaintext.bytes.byteLength);
    expect(ref.checksumSha256).toHaveLength(64);
    // The object key carries the filename verbatim, scoped under the owner — spaces are
    // not part of the reserved set `sanitizeFilename` strips (see the two tests below).
    expect(ref.externalId).toMatch(/^owner-1\/.+-lab report\.jpg$/);

    const fetched = await store.get(ref);
    expect(fetched).toEqual({ bytes: plaintext.bytes, contentType: 'image/jpeg', clientEncrypted: false });
  });

  it('preserves Devanagari and other non-ASCII characters in the object key', async () => {
    // Regression test: `sanitizeFilename` used to be a `[^a-zA-Z0-9._-]` regex that
    // replaced with `_` — every Devanagari filename (the expected case for a
    // Nepali-first product) came out as a string of underscores.
    const store = new MinioDocumentStore({ ...config, bucket: 'mero-health-devanagari' });
    const ref = await store.put({ ownerId: 'owner-9', filename: 'प्रयोगशाला रिपोर्ट.jpg', blob: plaintext });
    expect(ref.externalId).toMatch(/^owner-9\/.+-प्रयोगशाला रिपोर्ट\.jpg$/);
  });

  it('still replaces control characters and filesystem-reserved characters with underscores', async () => {
    const store = new MinioDocumentStore({ ...config, bucket: 'mero-health-reserved' });
    const ref = await store.put({
      ownerId: 'owner-10',
      filename: 'a/b\\c:d*e?f"g<h>i|j.jpg',
      blob: plaintext,
    });
    expect(ref.externalId).toMatch(/^owner-10\/.+-a_b_c_d_e_f_g_h_i_j\.jpg$/);
  });

  it('creates the bucket lazily on first use', async () => {
    // A fresh bucket name per test proves `#ensureBucket` actually creates it,
    // rather than the suite passing only because an earlier test already did.
    const store = new MinioDocumentStore({ ...config, bucket: 'mero-health-fresh' });
    const ref = await store.put({ ownerId: 'owner-1', filename: 'a.jpg', blob: plaintext });
    await expect(store.get(ref)).resolves.toMatchObject({ contentType: 'image/jpeg' });
  });

  it('scopes listing to the owner prefix and reconstructs refs from object metadata', async () => {
    const store = new MinioDocumentStore({ ...config, bucket: 'mero-health-list' });
    await store.put({ ownerId: 'owner-a', filename: 'a.jpg', blob: plaintext });
    await store.put({ ownerId: 'owner-b', filename: 'b.jpg', blob: plaintext });

    const listed = await store.list('owner-a');
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      backend: 'HOSTED',
      byteSize: plaintext.bytes.byteLength,
      contentType: 'image/jpeg',
    });
    expect(listed[0]?.checksumSha256).toHaveLength(64);
  });

  it('removes a deleted document from the listing', async () => {
    const store = new MinioDocumentStore({ ...config, bucket: 'mero-health-delete' });
    const ref = await store.put({ ownerId: 'owner-1', filename: 'a.jpg', blob: plaintext });

    await store.delete(ref);
    await expect(store.list('owner-1')).resolves.toHaveLength(0);
  });

  it('rejects a ref for a backend it does not speak for', async () => {
    const store = new MinioDocumentStore({ ...config, bucket: 'mero-health-policy' });
    const foreignRef = { backend: 'GOOGLE_DRIVE' as const, externalId: 'x', byteSize: 0, contentType: null, checksumSha256: '' };

    await expect(store.get(foreignRef)).rejects.toThrow('cannot resolve a GOOGLE_DRIVE ref');
    await expect(store.delete(foreignRef)).rejects.toThrow('cannot resolve a GOOGLE_DRIVE ref');
  });

  it('reports HOSTED capabilities, matching the shared descriptor', () => {
    const store = new MinioDocumentStore(config);
    expect(store.capabilities()).toEqual({
      backend: 'HOSTED',
      serverSideProcessing: true,
      requiresClientEncryption: false,
      supportsShareLinks: true,
      supportsVersioning: true,
    });
  });
});

describe('minioConfigFromEnv', () => {
  const baseEnv = {
    OBJECT_STORAGE_ENDPOINT: 'http://localhost:9000',
    OBJECT_STORAGE_BUCKET: 'swasthya-dev',
    OBJECT_STORAGE_ACCESS_KEY: 'minio',
    OBJECT_STORAGE_SECRET_KEY: 'replace-me',
  };

  it('parses the endpoint URL into host, port and TLS flag', () => {
    expect(minioConfigFromEnv(baseEnv)).toEqual({
      endPoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: 'minio',
      secretKey: 'replace-me',
      bucket: 'swasthya-dev',
    });
  });

  it('defaults to port 443 for an https endpoint with no explicit port', () => {
    expect(minioConfigFromEnv({ ...baseEnv, OBJECT_STORAGE_ENDPOINT: 'https://storage.example.invalid' })).toMatchObject({
      port: 443,
      useSSL: true,
    });
  });

  it('throws when a required variable is missing', () => {
    const withoutBucket = {
      OBJECT_STORAGE_ENDPOINT: baseEnv.OBJECT_STORAGE_ENDPOINT,
      OBJECT_STORAGE_ACCESS_KEY: baseEnv.OBJECT_STORAGE_ACCESS_KEY,
      OBJECT_STORAGE_SECRET_KEY: baseEnv.OBJECT_STORAGE_SECRET_KEY,
    };
    expect(() => minioConfigFromEnv(withoutBucket)).toThrow('OBJECT_STORAGE_BUCKET');
  });
});
