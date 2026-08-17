import type { ConversationTurn, HealthResearch, ResearchLanguage } from '@/lib/companion-research';

import { researchWithGemini } from './gemini-health';
import { researchHealthQuestion as researchWithPerplexity } from './perplexity-health';

/**
 * Picks the research provider from what is actually configured.
 *
 * Order matters and is deliberate. Gemini first: it is the free tier, so it
 * is what a fresh deployment will have. Perplexity second: paid, and only
 * used if its key is present and Gemini's is not. `RESEARCH_PROVIDER` forces
 * one when both keys exist and you want to compare them.
 *
 * Neither the route handler nor the UI knows or cares which one answered —
 * that is the whole reason both return the same `HealthResearch` shape and
 * every provider name was scrubbed from user-facing copy.
 */
export type ResearchProviderName = 'gemini' | 'perplexity';

export function selectProvider(env: Readonly<Record<string, string | undefined>> = process.env): ResearchProviderName | null {
  const forced = env.RESEARCH_PROVIDER;
  if (forced === 'gemini' || forced === 'perplexity') return forced;
  if (env.GEMINI_API_KEY) return 'gemini';
  if (env.PERPLEXITY_API_KEY) return 'perplexity';
  return null;
}

export async function researchHealthQuestion(
  question: string,
  language: ResearchLanguage,
  turns: readonly ConversationTurn[] = [],
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<HealthResearch> {
  switch (selectProvider(env)) {
    case 'gemini':
      return researchWithGemini(question, language, {}, turns);
    case 'perplexity':
      return researchWithPerplexity(question, language, {}, turns);
    default:
      // No key anywhere: report setup-required through the Gemini shape so
      // the caller sees one consistent "not configured" state.
      return researchWithGemini(question, language, { apiKey: undefined }, turns);
  }
}
