/**
 * Mints a short-lived Gemini Live ephemeral token so a browser can open a
 * duplex voice session directly, without the client ever holding
 * `GEMINI_API_KEY`. See docs/product/agent-progress.md Round six K′ and
 * docs/product/freemium-and-voice-corpus.md §3.
 *
 * Ephemeral tokens are a Gemini Live surface on `v1alpha`, distinct from the
 * `v1beta` `interactions` endpoint the text research provider
 * (`gemini-health.ts`) calls — the two are not interchangeable.
 */

export interface VoiceTokenDependencies {
  apiKey?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  now?: (() => Date) | undefined;
}

export type VoiceTokenResult =
  | { status: 'ok'; token: string; expiresAt: string }
  | { status: 'setup-required' }
  | { status: 'unavailable'; detail: string };

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1alpha/authTokens:create';

/**
 * The token must be used to start a session almost immediately: a token that
 * leaked into a log or a proxy would still only be able to start something
 * new for this long.
 */
const NEW_SESSION_WINDOW_MS = 60_000;
/** Once a session has started on the token, it may keep running up to this long. */
const SESSION_WINDOW_MS = 30 * 60_000;

function isoAfter(now: Date, ms: number): string {
  return new Date(now.getTime() + ms).toISOString();
}

export async function mintVoiceToken(dependencies: VoiceTokenDependencies = {}): Promise<VoiceTokenResult> {
  const apiKey = dependencies.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return { status: 'setup-required' };

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = (dependencies.now ?? (() => new Date()))();

  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authToken: {
          // One use: a spike page opens one session per mint, never reuses a token.
          uses: 1,
          newSessionExpireTime: isoAfter(now, NEW_SESSION_WINDOW_MS),
          expireTime: isoAfter(now, SESSION_WINDOW_MS),
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { status: 'unavailable', detail: `HTTP ${response.status}` };
    }

    // Google's create response names the resource `authTokens/<token>`; that
    // full name is what a client passes back as its API key when opening the
    // Live session. Read both `name` and `token` so a shape change on this
    // preview surface degrades to "unavailable" rather than throwing.
    const data = (await response.json()) as { name?: string; token?: string };
    const token = data.name ?? data.token;
    if (!token) return { status: 'unavailable', detail: 'no token in mint response' };

    return { status: 'ok', token, expiresAt: isoAfter(now, SESSION_WINDOW_MS) };
  } catch (error) {
    return { status: 'unavailable', detail: error instanceof Error ? error.message : 'fetch failed' };
  }
}
