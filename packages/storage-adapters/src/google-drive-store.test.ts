import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { StoragePolicyError } from './index.js';
import {
  GoogleDriveDocumentStore,
  GoogleOAuthTokenProvider,
  type GoogleDriveTokenProvider,
} from './google-drive-store.js';

/**
 * There is no equivalent of `s3rver` for Google Drive's REST API on the npm
 * registry with an established track record (the one hit, `google-drive-mock`,
 * is a single-maintainer package with no history in this codebase or
 * elsewhere — not something to pull into a health product's dependency tree
 * on faith). So this hand-rolls the small slice of the real Drive v3 wire
 * protocol the adapter actually speaks: OAuth token refresh, folder search
 * and creation, multipart file upload, `alt=media` download, listing and
 * deletion — as a real in-process HTTP server, not a mocked client. The
 * adapter under test never learns it isn't talking to google.com; only the
 * URLs it's configured with differ.
 */

interface StoredFile {
  id: string;
  name: string;
  parents: string[];
  appProperties: Record<string, string>;
  bytes: Buffer;
}

function startMockGoogleServer() {
  const folders = new Map<string, string>(); // name -> id
  const files = new Map<string, StoredFile>();
  const issuedTokens = new Set<string>();
  let idCounter = 0;
  let tokenCounter = 0;
  let folderCreations = 0;
  let nextTokenExpiresIn = 3600;

  function isAuthorized(req: Parameters<Parameters<Server['on']>[1]>[0]): boolean {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return false;
    return issuedTokens.has(header.slice('Bearer '.length));
  }

  function readBody(req: Parameters<Parameters<Server['on']>[1]>[0]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  function parseMultipartRelated(body: Buffer, boundary: string): { metadata: unknown; media: Buffer } {
    const marker = Buffer.from(`--${boundary}`);
    const segments: Buffer[] = [];
    let cursor = body.indexOf(marker);
    while (cursor !== -1) {
      const start = cursor + marker.length;
      const next = body.indexOf(marker, start);
      if (next === -1) break;
      segments.push(body.subarray(start, next));
      cursor = next;
    }

    const parts = segments.map((segment) => {
      const headerEnd = segment.indexOf('\r\n\r\n');
      const headers = segment.subarray(0, headerEnd).toString('utf-8');
      const rawContent = segment.subarray(headerEnd + 4);
      const trailingCrlf = rawContent.subarray(rawContent.length - 2).toString('utf-8') === '\r\n';
      return { headers, content: trailingCrlf ? rawContent.subarray(0, rawContent.length - 2) : rawContent };
    });

    const metadataPart = parts.find((part) => part.headers.includes('application/json'));
    const mediaPart = parts.find((part) => part.headers.includes('application/octet-stream'));
    if (!metadataPart || !mediaPart) throw new Error('Malformed multipart/related body in test fixture');
    return { metadata: JSON.parse(metadataPart.content.toString('utf-8')) as unknown, media: mediaPart.content };
  }

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (req.method === 'POST' && url.pathname === '/token') {
        const body = (await readBody(req)).toString('utf-8');
        const params = new URLSearchParams(body);
        if (params.get('grant_type') !== 'refresh_token' || !params.get('refresh_token')) {
          res.writeHead(400).end(JSON.stringify({ error: 'invalid_grant' }));
          return;
        }
        tokenCounter += 1;
        const token = `mock-access-token-${tokenCounter}`;
        issuedTokens.add(token);
        res
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ access_token: token, expires_in: nextTokenExpiresIn, token_type: 'Bearer' }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/token-malformed') {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true }));
        return;
      }

      if (!isAuthorized(req)) {
        res.writeHead(401).end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/drive/v3/files') {
        const q = url.searchParams.get('q') ?? '';
        if (q.includes('application/vnd.google-apps.folder')) {
          const nameMatch = /name='([^']+)'/.exec(q);
          const name = nameMatch?.[1] ?? '';
          const id = folders.get(name);
          res.writeHead(200, { 'content-type': 'application/json' }).end(
            JSON.stringify({ files: id ? [{ id }] : [] }),
          );
          return;
        }
        const parentMatch = /'([^']+)' in parents/.exec(q);
        const parentId = parentMatch?.[1] ?? '';
        const matches = [...files.values()]
          .filter((file) => file.parents.includes(parentId))
          .map((file) => ({ id: file.id, size: String(file.bytes.byteLength), appProperties: file.appProperties }));
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ files: matches }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/drive/v3/files') {
        const payload = JSON.parse((await readBody(req)).toString('utf-8')) as { name: string };
        folderCreations += 1;
        const id = `folder-${idCounter++}`;
        folders.set(payload.name, id);
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/upload/drive/v3/files') {
        const contentType = req.headers['content-type'] ?? '';
        const boundaryMatch = /boundary=(.+)$/.exec(contentType);
        const boundary = boundaryMatch?.[1];
        if (!boundary) {
          res.writeHead(400).end();
          return;
        }
        const body = await readBody(req);
        const { metadata, media } = parseMultipartRelated(body, boundary);
        const parsed = metadata as { name: string; parents: string[]; appProperties: Record<string, string> };
        const id = `file-${idCounter++}`;
        files.set(id, { id, name: parsed.name, parents: parsed.parents, appProperties: parsed.appProperties, bytes: media });
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id }));
        return;
      }

      const fileMatch = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
      if (fileMatch) {
        const id = fileMatch[1] ?? '';
        const file = files.get(id);
        if (req.method === 'GET' && url.searchParams.get('alt') === 'media') {
          if (!file) {
            res.writeHead(404).end();
            return;
          }
          res.writeHead(200, { 'content-type': 'application/octet-stream' }).end(file.bytes);
          return;
        }
        if (req.method === 'DELETE') {
          if (!file) {
            res.writeHead(404).end();
            return;
          }
          files.delete(id);
          res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
          return;
        }
      }

      res.writeHead(404).end();
    })();
  });

  return {
    server,
    files,
    get folderCreationCount() {
      return folderCreations;
    },
    get issuedTokenCount() {
      return tokenCounter;
    },
    setNextTokenExpiresIn(seconds: number) {
      nextTokenExpiresIn = seconds;
    },
  };
}

describe('GoogleDriveDocumentStore', () => {
  let mock: ReturnType<typeof startMockGoogleServer>;
  let baseUrl: string;

  beforeAll(async () => {
    mock = startMockGoogleServer();
    await new Promise<void>((resolve) => mock.server.listen(0, resolve));
    const address = mock.server.address();
    if (address === null || typeof address === 'string') throw new Error('Expected a bound TCP address');
    baseUrl = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => mock.server.close((err) => (err ? reject(err) : resolve())));
  });

  function makeStore(ownerId: string): GoogleDriveDocumentStore {
    const tokenProvider = new GoogleOAuthTokenProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      refreshToken: 'test-refresh-token',
      tokenEndpoint: `${baseUrl}/token`,
    });
    return new GoogleDriveDocumentStore({
      ownerId,
      tokenProvider,
      apiRoot: `${baseUrl}/drive/v3`,
      uploadRoot: `${baseUrl}/upload/drive/v3`,
    });
  }

  const encrypted = { bytes: new TextEncoder().encode('opaque ciphertext'), contentType: null, clientEncrypted: true };
  const plaintext = { bytes: new TextEncoder().encode('readable lab report'), contentType: 'image/jpeg', clientEncrypted: false };

  it('round-trips a client-encrypted document through the app-scoped folder', async () => {
    const store = makeStore('owner-1');
    const ref = await store.put({ ownerId: 'owner-1', filename: 'lab report.jpg', blob: encrypted });

    expect(ref.backend).toBe('GOOGLE_DRIVE');
    expect(ref.byteSize).toBe(encrypted.bytes.byteLength);
    expect(ref.contentType).toBeNull();
    expect(ref.checksumSha256).toHaveLength(64);

    const fetched = await store.get(ref);
    expect(fetched).toEqual({ bytes: encrypted.bytes, contentType: null, clientEncrypted: true });

    const listed = await store.list('owner-1');
    expect(listed).toContainEqual(ref);

    await store.delete(ref);
    expect(await store.list('owner-1')).not.toContainEqual(ref);
  });

  it('creates the app folder at most once across concurrent puts', async () => {
    // A dedicated server, not the describe block's shared one: the shared mock has no
    // per-account namespace (unlike real Drive, where every person's folder is already
    // isolated by owning a separate account), so by this point in the suite an earlier
    // test's folder already exists and would make "exactly one creation" untestable.
    const fresh = startMockGoogleServer();
    await new Promise<void>((resolve) => fresh.server.listen(0, resolve));
    try {
      const address = fresh.server.address();
      if (address === null || typeof address === 'string') throw new Error('Expected a bound TCP address');
      const freshBaseUrl = `http://localhost:${address.port}`;
      const tokenProvider = new GoogleOAuthTokenProvider({
        clientId: 'test-client',
        clientSecret: 'test-secret',
        refreshToken: 'test-refresh-token',
        tokenEndpoint: `${freshBaseUrl}/token`,
      });
      const store = new GoogleDriveDocumentStore({
        ownerId: 'owner-concurrent',
        tokenProvider,
        apiRoot: `${freshBaseUrl}/drive/v3`,
        uploadRoot: `${freshBaseUrl}/upload/drive/v3`,
      });

      await Promise.all([
        store.put({ ownerId: 'owner-concurrent', filename: 'a.jpg', blob: encrypted }),
        store.put({ ownerId: 'owner-concurrent', filename: 'b.jpg', blob: encrypted }),
      ]);
      expect(fresh.folderCreationCount).toBe(1);
    } finally {
      await new Promise<void>((resolve, reject) => fresh.server.close((err) => (err ? reject(err) : resolve())));
    }
  });

  it('refuses to store readable bytes for a bring-your-own backend', async () => {
    const store = makeStore('owner-2');
    await expect(store.put({ ownerId: 'owner-2', filename: 'a.jpg', blob: plaintext })).rejects.toThrow(
      StoragePolicyError,
    );
  });

  it('rejects an ownerId that does not match the connected account', async () => {
    const store = makeStore('owner-3');
    await expect(store.put({ ownerId: 'someone-else', filename: 'a.jpg', blob: encrypted })).rejects.toThrow(
      /scoped to owner/,
    );
    await expect(store.list('someone-else')).rejects.toThrow(/scoped to owner/);
  });

  it('refuses to resolve a ref from a different backend', async () => {
    const store = makeStore('owner-4');
    const hostedRef = {
      backend: 'HOSTED' as const,
      externalId: 'owner-4/some-object',
      byteSize: 4,
      contentType: 'image/jpeg',
      checksumSha256: 'a'.repeat(64),
    };
    await expect(store.get(hostedRef)).rejects.toThrow(/cannot resolve a HOSTED ref/);
    await expect(store.delete(hostedRef)).rejects.toThrow(/cannot resolve a HOSTED ref/);
  });

  it('deleting an already-gone file does not throw', async () => {
    const store = makeStore('owner-5');
    const ref = await store.put({ ownerId: 'owner-5', filename: 'a.jpg', blob: encrypted });
    await store.delete(ref);
    await expect(store.delete(ref)).resolves.toBeUndefined();
  });

  it('surfaces a real Drive API error when the access token is not one the server issued', async () => {
    const forgedTokenProvider: GoogleDriveTokenProvider = { getAccessToken: () => Promise.resolve('forged-token') };
    const store = new GoogleDriveDocumentStore({
      ownerId: 'owner-6',
      tokenProvider: forgedTokenProvider,
      apiRoot: `${baseUrl}/drive/v3`,
      uploadRoot: `${baseUrl}/upload/drive/v3`,
    });
    await expect(store.list('owner-6')).rejects.toThrow(/HTTP 401/);
  });
});

describe('GoogleOAuthTokenProvider', () => {
  let mock: ReturnType<typeof startMockGoogleServer>;
  let baseUrl: string;

  beforeAll(async () => {
    mock = startMockGoogleServer();
    await new Promise<void>((resolve) => mock.server.listen(0, resolve));
    const address = mock.server.address();
    if (address === null || typeof address === 'string') throw new Error('Expected a bound TCP address');
    baseUrl = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => mock.server.close((err) => (err ? reject(err) : resolve())));
  });

  beforeEach(() => {
    mock.setNextTokenExpiresIn(3600);
  });

  function makeProvider(overrides: Partial<{ tokenEndpoint: string }> = {}) {
    return new GoogleOAuthTokenProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      refreshToken: 'test-refresh-token',
      tokenEndpoint: overrides.tokenEndpoint ?? `${baseUrl}/token`,
    });
  }

  it('caches the access token instead of refreshing on every call', async () => {
    const provider = makeProvider();
    const before = mock.issuedTokenCount;
    const first = await provider.getAccessToken();
    const second = await provider.getAccessToken();
    expect(first).toBe(second);
    expect(mock.issuedTokenCount).toBe(before + 1);
  });

  it('refreshes again once the cached token is within a minute of expiry', async () => {
    mock.setNextTokenExpiresIn(1);
    const provider = makeProvider();
    const before = mock.issuedTokenCount;
    const first = await provider.getAccessToken();
    const second = await provider.getAccessToken();
    expect(first).not.toBe(second);
    expect(mock.issuedTokenCount).toBe(before + 2);
  });

  it('rejects a malformed token response instead of returning an unusable token', async () => {
    const provider = makeProvider({ tokenEndpoint: `${baseUrl}/token-malformed` });
    await expect(provider.getAccessToken()).rejects.toThrow(/unexpected payload shape/);
  });

  it('surfaces a non-2xx refresh failure', async () => {
    const provider = new GoogleOAuthTokenProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      refreshToken: '', // the mock server 400s a refresh_token grant with no token
      tokenEndpoint: `${baseUrl}/token`,
    });
    await expect(provider.getAccessToken()).rejects.toThrow(/HTTP 400/);
  });
});
