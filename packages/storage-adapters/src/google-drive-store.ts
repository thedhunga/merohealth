import { randomUUID } from 'node:crypto';
import type { StoredRef } from '@swasthya/shared-types';
import { sanitizeFilename, sha256Hex } from './filename.js';
import {
  assertPlacementAllowed,
  backendCapabilities,
  type DocumentBlob,
  type HealthDocumentStore,
  type PutRequest,
  type StoreCapabilities,
} from './index.js';

/**
 * Node-only entry point, deliberately exported as `@swasthya/storage-adapters/google-drive`
 * rather than from the package root — same reasoning `hosted-store.ts` already documents:
 * `Buffer` and `node:crypto` are not something Metro can bundle for `apps/mobile`, so the
 * root `.` export stays React-Native safe even after this file starts depending on them.
 */

const DRIVE_API_ROOT = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_ROOT = 'https://www.googleapis.com/upload/drive/v3';
const OAUTH_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * The one folder this adapter ever creates. `drive.file` OAuth scope (see
 * `GoogleOAuthTokenProvider`) means our app can only ever see files and folders
 * IT created — never the person's whole Drive — but within that scope we still
 * choose a normal, visible, named folder rather than Google's special hidden
 * `appDataFolder`. Health documents are the person's own records: they must be
 * able to find, rename or manually delete them in the ordinary Drive UI, which
 * `appDataFolder` (invisible outside our app) would rule out.
 */
export const APP_FOLDER_NAME = 'Mero Health Records';

/** Refreshes and caches a Drive access token. Injected so tests never need a real Google account. */
export interface GoogleDriveTokenProvider {
  getAccessToken(): Promise<string>;
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  /**
   * Issued once, out-of-band, when the person connects their Drive through a
   * consent screen. This adapter only ever refreshes it — there is still no
   * identity/auth layer anywhere in this repo to hang a "connected accounts"
   * concept off of, so obtaining and persisting the first refresh token is a
   * separate, later, user-facing flow, not something this adapter does.
   */
  refreshToken: string;
  tokenEndpoint?: string;
}

/**
 * Reads the app's own OAuth client credentials — shared across every person who
 * connects their Drive, unlike `refreshToken`, which is per-person and has no
 * source in this codebase yet (see `GoogleOAuthConfig.refreshToken`).
 */
export function googleOAuthClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Pick<GoogleOAuthConfig, 'clientId' | 'clientSecret'> {
  return {
    clientId: requireEnv(env, 'GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: requireEnv(env, 'GOOGLE_OAUTH_CLIENT_SECRET'),
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable ${key}`);
  return value;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

function isTokenResponse(value: unknown): value is TokenResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.access_token === 'string' && typeof record.expires_in === 'number';
}

/**
 * Real OAuth2 refresh-token grant against Google's token endpoint — the
 * mechanics of staying authenticated once connected. Caches the access token
 * and refreshes a minute ahead of expiry rather than on every call, so a
 * `list()` immediately followed by several `get()`s costs one round trip to
 * Google's token endpoint, not one per call.
 */
export class GoogleOAuthTokenProvider implements GoogleDriveTokenProvider {
  readonly #config: Required<GoogleOAuthConfig>;
  #cached: { token: string; expiresAtMs: number } | null = null;

  constructor(config: GoogleOAuthConfig) {
    this.#config = { tokenEndpoint: OAUTH_TOKEN_ENDPOINT, ...config };
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.#cached && this.#cached.expiresAtMs - 60_000 > now) {
      return this.#cached.token;
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.#config.clientId,
      client_secret: this.#config.clientSecret,
      refresh_token: this.#config.refreshToken,
    });

    const response = await fetch(this.#config.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new Error(`Google OAuth token refresh failed: HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    if (!isTokenResponse(payload)) {
      throw new Error('Google OAuth token refresh returned an unexpected payload shape');
    }

    this.#cached = { token: payload.access_token, expiresAtMs: now + payload.expires_in * 1000 };
    return payload.access_token;
  }
}

/** Object-metadata keys this adapter writes into Drive's `appProperties` (visible only to our app). */
const CHECKSUM_PROPERTY = 'checksumSha256';
const OWNER_PROPERTY = 'ownerId';

export interface GoogleDriveStoreConfig {
  /** One Drive connection is one person's own account — never a shared pool, unlike hosted storage. */
  ownerId: string;
  tokenProvider: GoogleDriveTokenProvider;
  apiRoot?: string;
  uploadRoot?: string;
}

interface DriveFile {
  id: string;
  size?: string;
  appProperties?: Record<string, string>;
}

interface FileListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

interface IdResponse {
  id: string;
}

function isDriveFile(value: unknown): value is DriveFile {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Record<string, unknown>).id === 'string';
}

function isFileListResponse(value: unknown): value is FileListResponse {
  if (typeof value !== 'object' || value === null) return false;
  const files = (value as Record<string, unknown>).files;
  return Array.isArray(files) && files.every(isDriveFile);
}

function isIdResponse(value: unknown): value is IdResponse {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).id === 'string';
}

/**
 * `GoogleDriveStore` from `docs/architecture/platform-vision.md` §3.1: user-owned,
 * OAuth, app-scoped folder. Every document handed to `put` must already be
 * client-encrypted (`assertPlacementAllowed` re-checks this at the boundary,
 * matching `MinioDocumentStore`'s own defense-in-depth) — Drive never sees a
 * readable content type or bytes, only opaque ciphertext, because consumer
 * Google Drive carries no business-associate agreement and Mero Health is not
 * the controller of that folder.
 */
export class GoogleDriveDocumentStore implements HealthDocumentStore {
  readonly #ownerId: string;
  readonly #tokenProvider: GoogleDriveTokenProvider;
  readonly #apiRoot: string;
  readonly #uploadRoot: string;
  #folderId: Promise<string> | null = null;

  constructor(config: GoogleDriveStoreConfig) {
    this.#ownerId = config.ownerId;
    this.#tokenProvider = config.tokenProvider;
    this.#apiRoot = config.apiRoot ?? DRIVE_API_ROOT;
    this.#uploadRoot = config.uploadRoot ?? DRIVE_UPLOAD_ROOT;
  }

  capabilities(): StoreCapabilities {
    return backendCapabilities.GOOGLE_DRIVE;
  }

  async put(request: PutRequest): Promise<StoredRef> {
    assertPlacementAllowed('GOOGLE_DRIVE', request.blob);
    this.#requireOwner(request.ownerId);

    const folderId = await this.#ensureFolder();
    const checksumSha256 = sha256Hex(request.blob.bytes);
    const fileId = await this.#uploadMultipart(
      {
        name: sanitizeFilename(request.filename),
        parents: [folderId],
        appProperties: { [CHECKSUM_PROPERTY]: checksumSha256, [OWNER_PROPERTY]: request.ownerId },
      },
      request.blob.bytes,
    );

    return {
      backend: 'GOOGLE_DRIVE',
      externalId: fileId,
      byteSize: request.blob.bytes.byteLength,
      // Never the caller's real content type: what reaches Drive is opaque ciphertext.
      contentType: null,
      checksumSha256,
    };
  }

  async get(ref: StoredRef): Promise<DocumentBlob> {
    this.#requireDriveRef(ref);
    const token = await this.#tokenProvider.getAccessToken();
    const response = await fetch(`${this.#apiRoot}/files/${ref.externalId}?alt=media`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Google Drive get failed: HTTP ${response.status}`);
    }
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: null,
      clientEncrypted: true,
    };
  }

  async list(ownerId: string): Promise<readonly StoredRef[]> {
    this.#requireOwner(ownerId);
    const folderId = await this.#ensureFolder();
    const token = await this.#tokenProvider.getAccessToken();

    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(`${this.#apiRoot}/files`);
      url.searchParams.set('q', `'${folderId}' in parents and trashed=false`);
      url.searchParams.set('fields', 'nextPageToken,files(id,size,appProperties)');
      url.searchParams.set('pageSize', '100');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const payload = await this.#getJson(url, token, isFileListResponse, 'Google Drive list');
      files.push(...payload.files);
      pageToken = payload.nextPageToken;
    } while (pageToken);

    return files.map(driveFileToRef);
  }

  async delete(ref: StoredRef): Promise<void> {
    this.#requireDriveRef(ref);
    const token = await this.#tokenProvider.getAccessToken();
    const response = await fetch(`${this.#apiRoot}/files/${ref.externalId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    // Deleting an already-gone file is not an error for this port's contract.
    if (!response.ok && response.status !== 404) {
      throw new Error(`Google Drive delete failed: HTTP ${response.status}`);
    }
  }

  /** Memoised so concurrent `put`s racing on first use don't create the folder twice. */
  #ensureFolder(): Promise<string> {
    this.#folderId ??= this.#findOrCreateFolder();
    return this.#folderId;
  }

  async #findOrCreateFolder(): Promise<string> {
    const token = await this.#tokenProvider.getAccessToken();

    const searchUrl = new URL(`${this.#apiRoot}/files`);
    searchUrl.searchParams.set(
      'q',
      `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    searchUrl.searchParams.set('fields', 'files(id)');
    searchUrl.searchParams.set('pageSize', '1');
    const found = await this.#getJson(searchUrl, token, isFileListResponse, 'Google Drive folder lookup');
    const existing = found.files[0];
    if (existing) return existing.id;

    const response = await fetch(`${this.#apiRoot}/files?fields=id`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: APP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    if (!response.ok) {
      throw new Error(`Google Drive folder creation failed: HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    if (!isIdResponse(payload)) {
      throw new Error('Google Drive folder creation returned an unexpected payload shape');
    }
    return payload.id;
  }

  async #uploadMultipart(
    metadata: { name: string; parents: string[]; appProperties: Record<string, string> },
    bytes: Uint8Array,
  ): Promise<string> {
    const token = await this.#tokenProvider.getAccessToken();
    const boundary = `mero-health-${randomUUID()}`;

    const response = await fetch(`${this.#uploadRoot}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` },
      // `fetch`'s DOM typings don't structurally accept a Node `Buffer` as `BodyInit`
      // even though it is one at runtime (Buffer extends Uint8Array); copy to a plain
      // Uint8Array so the type checker sees what the runtime already knows.
      body: new Uint8Array(buildMultipartRelatedBody(boundary, metadata, bytes)),
    });
    if (!response.ok) {
      throw new Error(`Google Drive upload failed: HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    if (!isIdResponse(payload)) {
      throw new Error('Google Drive upload returned an unexpected payload shape');
    }
    return payload.id;
  }

  async #getJson<T>(url: URL, token: string, guard: (value: unknown) => value is T, what: string): Promise<T> {
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) {
      throw new Error(`${what} failed: HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    if (!guard(payload)) {
      throw new Error(`${what} returned an unexpected payload shape`);
    }
    return payload;
  }

  #requireOwner(ownerId: string): void {
    if (ownerId !== this.#ownerId) {
      throw new Error(
        `GoogleDriveDocumentStore is scoped to owner ${this.#ownerId}, not ${ownerId} — one Drive ` +
          'connection is one person’s own account, never a shared pool.',
      );
    }
  }

  #requireDriveRef(ref: StoredRef): void {
    if (ref.backend !== 'GOOGLE_DRIVE') {
      throw new Error(`GoogleDriveDocumentStore cannot resolve a ${ref.backend} ref`);
    }
  }
}

function driveFileToRef(file: DriveFile): StoredRef {
  return {
    backend: 'GOOGLE_DRIVE',
    externalId: file.id,
    byteSize: file.size ? Number(file.size) : 0,
    contentType: null,
    checksumSha256: file.appProperties?.[CHECKSUM_PROPERTY] ?? '',
  };
}

/**
 * Hand-built `multipart/related` body per Google's upload API — this is not
 * `multipart/form-data`, so `FormData`/`Blob` (which only build the latter)
 * do not apply here.
 */
function buildMultipartRelatedBody(
  boundary: string,
  metadata: { name: string; parents: string[]; appProperties: Record<string, string> },
  bytes: Uint8Array,
): Buffer {
  const metadataPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    'utf-8',
  );
  const mediaHeader = Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`, 'utf-8');
  const closing = Buffer.from(`\r\n--${boundary}--`, 'utf-8');
  return Buffer.concat([metadataPart, mediaHeader, Buffer.from(bytes), closing]);
}

