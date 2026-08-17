import type { HealthResearch, ResearchLanguage } from '@/lib/companion-research';

/**
 * Gemini with Google Search grounding, as a second research provider.
 *
 * Same contract as the Perplexity provider — an answer, its citations, a
 * disclaimer — so the route handler and the UI never know which one ran.
 * The reason to have it: Gemini's free tier is real (no card, generous
 * daily allowance) and grounding still returns citations, which is the
 * property the safety design depends on. A model without live sources
 * would be cheaper still, but it would be answering health questions from
 * memory, and that is the thing this product must not do.
 *
 * Built against the current `interactions` API rather than the older
 * `generateContent` + `groundingMetadata` shape, which the grounding docs no
 * longer describe. Citations arrive as `url_citation` annotations on the
 * model's text block.
 */

interface UrlCitation {
  type?: string;
  url?: string;
  title?: string;
  start_index?: number;
  end_index?: number;
}

interface TextContent {
  type?: string;
  text?: string;
  annotations?: UrlCitation[];
}

interface Step {
  type?: string;
  content?: TextContent[];
}

interface InteractionResponse {
  steps?: Step[];
}

interface GeminiDependencies {
  apiKey?: string | undefined;
  model?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/**
 * Flash is the free-tier workhorse and the sensible default. Pro is better
 * at Nepali register but is not free at volume; it can be selected by env
 * without a code change.
 *
 * A list, newest first, because Google retires model IDs for new accounts
 * with a 404 ("no longer available to new users") and a single hard-coded
 * name turned the whole assistant off the day that happened. On such a 404
 * the next candidate is tried; any other failure is returned as-is. An
 * explicit GEMINI_MODEL goes first and is still subject to the same walk.
 */
const MODEL_CANDIDATES = ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'] as const;

/** Google's wording when a model ID has been withdrawn or never existed. */
function isModelGone(status: number, body: string): boolean {
  return status === 404 && /model|not found|no longer available/i.test(body);
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function disclaimerFor(language: ResearchLanguage) {
  return language === 'en'
    ? 'General health information only. This is not a diagnosis or a treatment recommendation.'
    : 'यो सामान्य स्वास्थ्य जानकारी मात्र हो। यो निदान वा उपचार सिफारिस होइन।';
}

function emptyResearch(
  language: ResearchLanguage,
  status: 'setup-required' | 'unavailable',
  diagnostic?: string,
): HealthResearch {
  return {
    provider: 'gemini-grounded',
    status,
    answer: null,
    citations: [],
    relatedQuestions: [],
    disclaimer: disclaimerFor(language),
    externalHealthHubUrl: null,
    ...(diagnostic ? { diagnostic } : {}),
  };
}

/**
 * Reduce an upstream error body to something safe to return: Google's
 * `status` word and `reason` code, and a short slice of the message. Keys
 * never appear in these bodies, but the slice is capped regardless.
 */
interface GoogleErrorDetail {
  reason?: string;
  violations?: { quotaId?: string; quotaValue?: string; quotaMetric?: string }[];
  retryDelay?: string;
}
interface GoogleError {
  status?: string;
  message?: string;
  details?: GoogleErrorDetail[];
}

function parseGoogleError(text: string): GoogleError | undefined {
  try {
    const parsed = JSON.parse(text) as { error?: GoogleError } | { error?: GoogleError }[];
    return Array.isArray(parsed) ? parsed[0]?.error : parsed.error;
  } catch {
    return undefined;
  }
}

/** Quota violations Google attached to a 429, as `quotaId=value` pairs. */
function quotaViolations(e: GoogleError | undefined): { quotaId: string; quotaValue: string }[] {
  return (e?.details ?? [])
    .flatMap((d) => d.violations ?? [])
    .map((v) => ({ quotaId: v.quotaId ?? v.quotaMetric ?? '?', quotaValue: v.quotaValue ?? '?' }));
}

/**
 * A 429 whose limit is literally zero means this model has no allowance on
 * this key at all (typically: not in the free tier). That is a per-model
 * fact, so the next candidate is worth trying. A non-zero limit means the
 * allowance is used up and every model will likely say the same — stop.
 */
function isModelNotAllowed(status: number, e: GoogleError | undefined): boolean {
  return status === 429 && quotaViolations(e).some((v) => v.quotaValue === '0');
}

async function describeFailure(response: Response): Promise<string> {
  let detail = '';
  try {
    const e = parseGoogleError(await response.text());
    const reason = e?.details?.find((d) => d.reason)?.reason;
    const quotas = quotaViolations(e).map((v) => `${v.quotaId}=${v.quotaValue}`).join(',');
    const retry = e?.details?.find((d) => d.retryDelay)?.retryDelay;
    detail = [e?.status, reason, quotas && `quota[${quotas}]`, retry && `retry ${retry}`, e?.message?.slice(0, 160)]
      .filter(Boolean)
      .join(' · ');
  } catch {
    detail = '';
  }
  return `HTTP ${response.status}${detail ? ` · ${detail}` : ''}`;
}

/**
 * The prompt mirrors the Perplexity provider's on purpose: the two must
 * behave the same way about diagnosis, dosing and emergencies, or swapping
 * providers would silently change the product's safety posture.
 */
function instructionsFor(language: ResearchLanguage): string {
  const languageInstruction =
    language === 'en'
      ? 'Respond in clear English.'
      : 'Respond in clear, simple Nepali (Devanagari), keeping medical terms in English when clearer.';

  return [
    'You are the evidence-research layer for Mero Health, a patient-controlled health navigation product.',
    'Provide concise, general educational information grounded in reliable current sources found via search.',
    'Do not diagnose, prescribe, recommend a specific treatment, calculate medication doses, or claim to replace a clinician.',
    'State important uncertainty. Encourage an appropriate qualified clinician when the question depends on personal examination, history, or testing.',
    'Do not provide emergency instructions; Mero Health performs deterministic emergency interception before this request.',
    'Prefer public-health agencies, medical societies, peer-reviewed research, and major academic health systems.',
    'Keep the answer under 250 words.',
    languageInstruction,
  ].join(' ');
}

export async function researchWithGemini(
  question: string,
  language: ResearchLanguage,
  dependencies: GeminiDependencies = {},
): Promise<HealthResearch> {
  const apiKey = dependencies.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return emptyResearch(language, 'setup-required');

  const preferred = dependencies.model ?? process.env.GEMINI_MODEL;
  const candidates = [...new Set([...(preferred ? [preferred] : []), ...MODEL_CANDIDATES])];
  const fetchImpl = dependencies.fetchImpl ?? fetch;

  try {
    let response: Response | undefined;
    const gone: string[] = [];
    for (const model of candidates) {
      response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          // The interactions API takes the system framing as part of the
          // input rather than a separate system role; keep the boundary
          // between instructions and the person's words explicit.
          input: `${instructionsFor(language)}\n\nQuestion: ${question}`,
          tools: [{ type: 'google_search' }],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) break;
      // Only a withdrawn model ID justifies trying the next name. A bad key,
      // a quota hit or an outage will fail the same way for every candidate
      // and must not be retried four times.
      const bodyText = await response.clone().text();
      if (!isModelGone(response.status, bodyText) && !isModelNotAllowed(response.status, parseGoogleError(bodyText))) break;
      gone.push(model);
    }

    if (!response) return emptyResearch(language, 'unavailable', 'no model candidates');
    if (!response.ok) {
      const detail = await describeFailure(response);
      return emptyResearch(language, 'unavailable', gone.length ? `${detail} · tried=[${gone.join(',')}]` : detail);
    }

    const data = (await response.json()) as InteractionResponse;

    // The answer is the text block of the model_output step; there may be
    // search steps before it that carry no prose.
    const textBlocks = (data.steps ?? [])
      .filter((step) => step.type === 'model_output')
      .flatMap((step) => step.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string');

    const answer = textBlocks
      .map((block) => block.text ?? '')
      .join('\n')
      .trim();
    if (!answer) {
      // Say what shape came back, so a schema drift is recognisable.
      const stepTypes = (data.steps ?? []).map((s) => s.type ?? '?').join(',');
      const topKeys = Object.keys(data as object).slice(0, 8).join(',');
      return emptyResearch(language, 'unavailable', `HTTP 200 · empty answer · steps=[${stepTypes}] keys=[${topKeys}]`);
    }

    // Dedupe citations by URL, keep the first title seen, cap the list.
    const seen = new Map<string, string>();
    for (const block of textBlocks) {
      for (const note of block.annotations ?? []) {
        if (note.type !== 'url_citation' || !note.url) continue;
        const url = safeHttpUrl(note.url);
        if (!url || seen.has(url)) continue;
        seen.set(url, note.title?.trim() || new URL(url).hostname.replace(/^www\./, ''));
      }
    }

    return {
      provider: 'gemini-grounded',
      status: 'complete',
      answer,
      citations: [...seen.entries()].slice(0, 8).map(([url, title]) => ({ title, url })),
      // The interactions API does not return related questions.
      relatedQuestions: [],
      disclaimer: disclaimerFor(language),
      externalHealthHubUrl: null,
    };
  } catch (error) {
    // Timeouts and network failures. Name only — messages can carry hosts.
    const name = error instanceof Error ? error.name : 'unknown';
    return emptyResearch(language, 'unavailable', `fetch failed · ${name}`);
  }
}
