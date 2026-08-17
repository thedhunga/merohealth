import type { ConversationTurn, HealthResearch, ResearchLanguage } from '@/lib/companion-research';
import { CONTAINMENT_INSTRUCTION } from '@/lib/containment-instruction';
import { CONVERSATION_INSTRUCTION, formatConversationTurns } from '@/lib/conversation-instruction';

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
  /**
   * Answer without live search when grounding is refused on this key.
   * Owner decision 2026-08-17: ON unless RESEARCH_ALLOW_UNGROUNDED='false'.
   * Grounding is not in Gemini's free tier, and the owner chose a labelled,
   * citation-free answer with a stronger disclaimer over silence. Set the
   * variable to 'false' to fail closed again once billing is enabled.
   */
  allowUngrounded?: boolean | undefined;
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
const MODEL_CANDIDATES = ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'] as const;

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

/** Appended to the disclaimer when the answer had no live sources. */
function ungroundedDisclaimer(language: ResearchLanguage) {
  return language === 'en'
    ? 'This answer was written without live source lookup; treat it as a starting point and confirm with a health worker or pharmacist before acting on it.'
    : 'यो उत्तर प्रत्यक्ष स्रोत खोजी बिना लेखिएको हो; यसलाई सुरुवाती जानकारी मात्र मान्नुहोस् र कुनै पनि कदम चाल्नुअघि स्वास्थ्यकर्मी वा फार्मासिस्टसँग पुष्टि गर्नुहोस्।';
}

/** Extra instruction for the ungrounded path: no invented references. */
function ungroundedInstruction(language: ResearchLanguage) {
  return language === 'en'
    ? 'You have no web search in this call. Do not cite URLs, studies or statistics you cannot be certain of; if unsure, say so plainly and recommend a health worker.'
    : 'यस कलमा तपाईंसँग वेब खोज छैन। निश्चित नभएको URL, अध्ययन वा तथ्याङ्क उल्लेख नगर्नुहोस्; अनिश्चित भए स्पष्ट भन्नुहोस् र स्वास्थ्यकर्मीलाई भेट्न सिफारिस गर्नुहोस्।';
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
  if (status !== 429) return false;
  const violations = quotaViolations(e);
  // The interactions endpoint returns 429 with no violation details at all,
  // so "zero allowance" and "used up" cannot be told apart. Trying the next
  // name costs one rejected request; giving up costs the answer.
  return violations.length === 0 || violations.some((v) => v.quotaValue === '0');
}

/**
 * When every candidate is refused on quota, find out *what* is refused so the
 * fix is a decision rather than a guess: is it grounding, or the interactions
 * endpoint itself? Two minimal calls, statuses only, appended to the
 * diagnostic. Runs only on total failure, so it costs nothing on the happy
 * path and never affects the answer.
 */
async function probeQuotaShape(fetchImpl: typeof fetch, apiKey: string, model: string): Promise<string> {
  const headers = { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' };
  const status = async (url: string, body: unknown): Promise<string> => {
    try {
      const r = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
      return String(r.status);
    } catch {
      return 'ERR';
    }
  };
  const ungrounded = await status(ENDPOINT, { model, input: 'Reply with the single word OK.' });
  const legacyGrounded = await status(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { contents: [{ parts: [{ text: 'Reply with the single word OK.' }] }], tools: [{ google_search: {} }] },
  );
  return `probe[interactions-ungrounded=${ungrounded} generateContent-grounded=${legacyGrounded}]`;
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
function instructionsFor(language: ResearchLanguage, hasConversation: boolean): string {
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
    CONTAINMENT_INSTRUCTION,
    ...(hasConversation ? [CONVERSATION_INSTRUCTION] : []),
    'Prefer public-health agencies, medical societies, peer-reviewed research, and major academic health systems.',
    'Keep the answer under 250 words.',
    languageInstruction,
  ].join(' ');
}

const GROUNDED_TIMEOUT_MS = 20_000;
const UNGROUNDED_TIMEOUT_MS = 50_000;

/**
 * One request shape for both paths, so they cannot drift.
 *
 * - `system_instruction` carries our framing; `input` is only the person's
 *   words. The boundary between the two is a safety property.
 * - `store: false`. The API persists interactions by default; these are
 *   people's health questions and Google has no business keeping them.
 * - `thinking_level: 'low'`. This is a phrasing task over sources (or, on
 *   the ungrounded path, over general knowledge with instructions not to
 *   invent). Deep reasoning buys latency, not safety, and a Nepali answer
 *   from a thinking model was overrunning 20 s.
 */
function requestBody(
  model: string,
  language: ResearchLanguage,
  question: string,
  opts: { grounded: boolean; turns: readonly ConversationTurn[] },
): Record<string, unknown> {
  const hasConversation = opts.turns.length > 0;
  const instruction = opts.grounded
    ? instructionsFor(language, hasConversation)
    : `${instructionsFor(language, hasConversation)} ${ungroundedInstruction(language)}`;
  // Preserves the plain-string `input` shape when there is no prior turn —
  // the transcript prefix only exists once there is something to continue.
  const input = hasConversation
    ? `Earlier in this conversation:\n${formatConversationTurns(opts.turns)}\n\nNew message: ${question}`
    : question;
  return {
    model,
    system_instruction: instruction,
    input,
    store: false,
    generation_config: { thinking_level: 'low' },
    ...(opts.grounded ? { tools: [{ type: 'google_search' }] } : {}),
  };
}

export async function researchWithGemini(
  question: string,
  language: ResearchLanguage,
  dependencies: GeminiDependencies = {},
  turns: readonly ConversationTurn[] = [],
): Promise<HealthResearch> {
  const apiKey = dependencies.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return emptyResearch(language, 'setup-required');

  const preferred = dependencies.model ?? process.env.GEMINI_MODEL;
  const candidates = [...new Set([...(preferred ? [preferred] : []), ...MODEL_CANDIDATES])];
  const fetchImpl = dependencies.fetchImpl ?? fetch;

  try {
    let response: Response | undefined;
    const gone: string[] = [];
    let refusedOnQuota = false;
    for (const model of candidates) {
      response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody(model, language, question, { grounded: true, turns })),
        signal: AbortSignal.timeout(GROUNDED_TIMEOUT_MS),
      });
      if (response.ok) break;
      // Only a withdrawn model ID, or a model with no allowance on this key,
      // justifies trying the next name. A bad key or an outage will fail the
      // same way for every candidate and must not be retried.
      const bodyText = await response.clone().text();
      const notAllowed = isModelNotAllowed(response.status, parseGoogleError(bodyText));
      if (!isModelGone(response.status, bodyText) && !notAllowed) break;
      if (notAllowed) refusedOnQuota = true;
      gone.push(model);
    }

    if (!response) return emptyResearch(language, 'unavailable', 'no model candidates');

    let grounded = true;
    const allGroundedRefused = refusedOnQuota && gone.length === candidates.length && candidates[0] !== undefined;
    const allowUngrounded = dependencies.allowUngrounded ?? process.env.RESEARCH_ALLOW_UNGROUNDED !== 'false';

    if (!response.ok && allGroundedRefused && allowUngrounded && candidates[0]) {
      // Grounding is refused on this key; the owner has chosen an answer
      // without live sources over no answer. Same instructions, one model,
      // no search tool, and told plainly not to invent references.
      grounded = false;
      response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody(candidates[0], language, question, { grounded: false, turns })),
        // A full Nepali answer from a thinking model runs past 20 s; the
        // route's maxDuration is set to cover this.
        signal: AbortSignal.timeout(UNGROUNDED_TIMEOUT_MS),
      });
    }

    if (!response.ok) {
      let detail = await describeFailure(response);
      if (gone.length) detail += ` · tried=[${gone.join(',')}]`;
      if (allGroundedRefused && candidates[0]) {
        detail += ` · ${await probeQuotaShape(fetchImpl, apiKey, candidates[0])}`;
      }
      return emptyResearch(language, 'unavailable', detail);
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

    if (!grounded) {
      return {
        provider: 'gemini-ungrounded',
        status: 'complete',
        answer,
        // Never surface a URL from an ungrounded answer, even if the model
        // wrote one: it was not retrieved, so it cannot be vouched for.
        citations: [],
        relatedQuestions: [],
        disclaimer: `${disclaimerFor(language)} ${ungroundedDisclaimer(language)}`,
        externalHealthHubUrl: null,
        diagnostic: `ungrounded fallback · search grounding refused on this key · tried=[${gone.join(',')}]`,
      };
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
