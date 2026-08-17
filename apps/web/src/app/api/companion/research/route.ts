import { assessSafety, getSafetyTemplate } from '@swasthya/clinical-safety';

import { computeAdvisory } from '@/lib/advisory';
import type { ResearchLanguage } from '@/lib/companion-research';
import { researchHealthQuestion } from '@/server/research-provider';

export const runtime = 'nodejs';
// Three fast grounded refusals plus one ungrounded answer from a thinking
// model can exceed a minute's default budget on some plans; be explicit.
export const maxDuration = 60;

function parseRequest(value: unknown): { message: string; language: ResearchLanguage } | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as { message?: unknown; language?: unknown };
  if (typeof input.message !== 'string') return null;

  const message = input.message.normalize('NFKC').trim();
  if (message.length < 3 || message.length > 4000) return null;

  return {
    message,
    language: input.language === 'en' ? 'en' : 'ne',
  };
}

export async function POST(request: Request) {
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
    return Response.json(
      { assessment, template, research: null, advisory: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const research = await researchHealthQuestion(input.message, input.language);
  const advisory =
    research.status === 'complete' && research.answer
      ? computeAdvisory(research.answer, input.language)
      : null;

  return Response.json(
    { assessment, template: null, research, advisory },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
