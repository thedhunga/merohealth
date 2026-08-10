import { describe, expect, it } from 'vitest';

import {
  InMemoryDocumentStore,
  StoragePolicyError,
  assertPlacementAllowed,
  backendCapabilities,
  resolveStoragePlacement,
  type DocumentBlob,
} from './index';

const plaintext: DocumentBlob = {
  bytes: new Uint8Array([1, 2, 3, 4]),
  contentType: 'image/jpeg',
  clientEncrypted: false,
};

const encrypted: DocumentBlob = {
  bytes: new Uint8Array([9, 8, 7, 6]),
  contentType: null,
  clientEncrypted: true,
};

describe('backend capabilities', () => {
  it('allows server-side processing only where we control the store', () => {
    expect(backendCapabilities.HOSTED.serverSideProcessing).toBe(true);
    expect(backendCapabilities.GOOGLE_DRIVE.serverSideProcessing).toBe(false);
  });

  it('requires client encryption for bring-your-own storage', () => {
    expect(backendCapabilities.GOOGLE_DRIVE.requiresClientEncryption).toBe(true);
    expect(backendCapabilities.HOSTED.requiresClientEncryption).toBe(false);
  });
});

describe('resolveStoragePlacement', () => {
  it('honours hosted storage on a tier that includes it', () => {
    const placement = resolveStoragePlacement('PLUS', 'HOSTED');
    expect(placement.backend).toBe('HOSTED');
    expect(placement.fellBackFrom).toBeNull();
    expect(placement.extractionMustRunOnDevice).toBe(false);
  });

  it('falls back to the user drive when hosted storage is not entitled', () => {
    const placement = resolveStoragePlacement('FREE', 'HOSTED');
    expect(placement.backend).toBe('GOOGLE_DRIVE');
    expect(placement.fellBackFrom).toBe('HOSTED');
    expect(placement.extractionMustRunOnDevice).toBe(true);
  });

  it('allows bring-your-own storage on the free tier without falling back', () => {
    const placement = resolveStoragePlacement('FREE', 'GOOGLE_DRIVE');
    expect(placement.backend).toBe('GOOGLE_DRIVE');
    expect(placement.fellBackFrom).toBeNull();
  });
});

describe('assertPlacementAllowed', () => {
  it('refuses readable health data on a backend we do not control', () => {
    expect(() => {
      assertPlacementAllowed('GOOGLE_DRIVE', plaintext);
    }).toThrow(StoragePolicyError);
  });

  it('accepts an encrypted blob on a bring-your-own backend', () => {
    expect(() => {
      assertPlacementAllowed('GOOGLE_DRIVE', encrypted);
    }).not.toThrow();
  });

  it('accepts plaintext on hosted storage', () => {
    expect(() => {
      assertPlacementAllowed('HOSTED', plaintext);
    }).not.toThrow();
  });
});

describe('InMemoryDocumentStore', () => {
  it('round-trips a document and reports its size', async () => {
    const store = new InMemoryDocumentStore('HOSTED');
    const ref = await store.put({ ownerId: 'user-1', filename: 'lab.jpg', blob: plaintext });

    expect(ref.backend).toBe('HOSTED');
    expect(ref.byteSize).toBe(4);
    await expect(store.get(ref)).resolves.toEqual(plaintext);
  });

  it('scopes listing to the owner', async () => {
    const store = new InMemoryDocumentStore('HOSTED');
    await store.put({ ownerId: 'user-1', filename: 'a.jpg', blob: plaintext });
    await store.put({ ownerId: 'user-2', filename: 'b.jpg', blob: plaintext });

    await expect(store.list('user-1')).resolves.toHaveLength(1);
  });

  it('enforces the encryption policy on put', async () => {
    const store = new InMemoryDocumentStore('GOOGLE_DRIVE');
    await expect(
      store.put({ ownerId: 'user-1', filename: 'lab.jpg', blob: plaintext }),
    ).rejects.toThrow(StoragePolicyError);
  });

  it('removes a deleted document from the listing', async () => {
    const store = new InMemoryDocumentStore('HOSTED');
    const ref = await store.put({ ownerId: 'user-1', filename: 'a.jpg', blob: plaintext });

    await store.delete(ref);
    await expect(store.list('user-1')).resolves.toHaveLength(0);
  });
});
