import { assessSafety, getSafetyTemplate } from '@swasthya/clinical-safety';

import { computeAdvisory } from '@/lib/advisory';
import type { CompanionResearchResponse, ConversationTurn, ResearchLanguage } from '@/lib/companion-research';
import { classifyMessageDomain } from '@/lib/domain-classification';
import { requestIp, SlidingWindowRateLimiter } from '@/lib/rate-limiter';
import { researchHealthQuestion } from '@/server/research-provider';

export const runtime = 'nodejs';
// Three fast grounded refusals plus one ungrounded answer from a thinking
// model can exceed a minute's default budget on some plans; be explicit.
export const maxDuration = 60;

/**
 * This is the only unauthenticated route in the app that spends real money
 * on every accepted call — `researchHealthQuestion` reaches a paid Gemini or
 * Perplexity key with no per-caller cost limit anywhere upstream of it.
 * Thirty in ten minutes is deliberately generous for a *conversation*
 * (unlike the once-or-twice OTP route): a real exchange is several turns,
 * and Nepali mobile networks put many subscribers behind one shared address
 * (carrier-grade NAT), so a tight per-IP ceiling would throttle real
 * neighbours together. It still bounds a scripted loop that would otherwise
 * run unmetered.
 */
const researchRateLimiter = new SlidingWindowRateLimiter(30, 10 * 60 * 1000);

/** Prior turns are capped so a runaway conversation can't blow the prompt budget: last 6, 2000 characters each. */
const MAX_TURNS = 6;
const MAX_TURN_CHARS = 2000;

function parseTurns(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: ConversationTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as { role?: unknown; text?: unknown };
    if (candidate.role !== 'user' && candidate.role !== 'assistant') continue;
    if (typeof candidate.text !== 'string') continue;
    const text = candidate.text.normalize('NFKC').trim().slice(0, MAX_TURN_CHARS);
    if (!text) continue;
    turns.push({ role: candidate.role, text });
  }
  return turns.slice(-MAX_TURNS);
}

function parseRequest(
  value: unknown,
): { message: string; language: ResearchLanguage; turns: ConversationTurn[] } | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as { message?: unknown; language?: unknown; turns?: unknown };
  if (typeof input.message !== 'string') return null;

  const message = input.message.normalize('NFKC').trim();
  if (message.length < 3 || message.length > 4000) return null;

  return {
    message,
    language: input.language === 'en' ? 'en' : 'ne',
    turns: parseTurns(input.turns),
  };
}

export async function POST(request: Request) {
  if (!researchRateLimiter.allow(requestIp(request))) {
    return Response.json(
      {
        code: 'RATE_LIMITED',
        message: 'Too many questions from this connection — wait a few minutes and try again.',
      },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const input = parseRequest(body);
  if (!input) {
    return Response.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'Enter a health question between 3 and 4000 characters.',
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const assessment = assessSafety(input.message);
  const template = assessment.templateId
    ? getSafetyTemplate(assessment.templateId, input.language)
    : null;

  if (assessment.interruptConversation) {
    // Ordering rule from the ledger: emergency interception runs before
    // domain classification, not after. `domain` is reported as `HEALTH`
    // here — an emergency utterance is by definition inside the health
    // domain, and the field is otherwise unused once the emergency panel
    // takes over.
    return Response.json(
      { assessment, template, research: null, advisory: null, domain: 'HEALTH' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const questionDomain = classifyMessageDomain(input.message, input.language);
  if (questionDomain === 'OFF_TOPIC') {
    // A clearly off-topic question never reaches the model — cheaper, and
    // the model has nothing safety-relevant to add to a fixed reply.
    return Response.json(
      { assessment, template: null, research: null, advisory: null, domain: questionDomain },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const research = await researchHealthQuestion(input.message, input.language, input.turns);
  // Post-check: the model was told to stay inside health (see
  // `instructionsFor` in both providers), but the containment instruction is
  // advisory to the model, not enforced by it. Re-running the same
  // deterministic classifier on the *answer* catches an answer that drifted
  // off-topic despite the instruction, and the drifted text is discarded
  // rather than shown — the UI falls back to the same fixed reply a
  // pre-call `OFF_TOPIC` gets.
  const answerDomain =
    research.status === 'complete' && research.answer
      ? classifyMessageDomain(research.answer, input.language)
      : questionDomain;
  const domain = answerDomain === 'OFF_TOPIC' ? 'OFF_TOPIC' : questionDomain;
  const finalResearch = domain === 'OFF_TOPIC' ? null : research;
  const advisory =
    finalResearch?.status === 'complete' && finalResearch.answer
      ? computeAdvisory(finalResearch.answer, input.language)
      : null;

  const responseBody: CompanionResearchResponse = {
    assessment,
    template: null,
    research: finalResearch,
    advisory,
    domain,
  };
  return Response.json(responseBody, { headers: { 'Cache-Control': 'no-store' } });
}
