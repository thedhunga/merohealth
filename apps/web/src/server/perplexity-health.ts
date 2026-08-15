import type { HealthResearch, ResearchLanguage } from '@/lib/companion-research';

interface SonarSearchResult {
  title?: string;
  url?: string;
  snippet?: string;
  date?: string;
}

interface SonarResponse {
  choices?: Array<{ message?: { content?: string } }>;
  citations?: string[];
  search_results?: SonarSearchResult[];
  related_questions?: string[];
}

interface ResearchDependencies {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
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
): HealthResearch {
  return {
    provider: 'perplexity-sonar',
    status,
    answer: null,
    citations: [],
    relatedQuestions: [],
    disclaimer: disclaimerFor(language),
    externalHealthHubUrl: 'https://www.perplexity.ai/health',
  };
}

export async function researchHealthQuestion(
  question: string,
  language: ResearchLanguage,
  dependencies: ResearchDependencies = {},
): Promise<HealthResearch> {
  const apiKey = dependencies.apiKey ?? process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return emptyResearch(language, 'setup-required');

  const languageInstruction =
    language === 'en'
      ? 'Respond in clear English.'
      : 'Respond in clear, simple Nepali (Devanagari), keeping medical terms in English when clearer.';

  const systemPrompt = [
    'You are the evidence-research layer for Mero Health, a patient-controlled health navigation product.',
    'Provide concise, general educational information grounded in reliable current sources.',
    'Do not diagnose, prescribe, recommend a specific treatment, calculate medication doses, or claim to replace a clinician.',
    'State important uncertainty. Encourage an appropriate qualified clinician when the question depends on personal examination, history, or testing.',
    'Do not provide emergency instructions; Mero Health performs deterministic emergency interception before this request.',
    'Prefer public-health agencies, medical societies, peer-reviewed research, and major academic health systems.',
    languageInstruction,
  ].join(' ');

  try {
    const response = await (dependencies.fetchImpl ?? fetch)('https://api.perplexity.ai/v1/sonar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: dependencies.model ?? process.env.PERPLEXITY_MODEL ?? 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        temperature: 0.1,
        max_tokens: 900,
        return_related_questions: true,
        web_search_options: { search_context_size: 'high' },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) return emptyResearch(language, 'unavailable');

    const data = (await response.json()) as SonarResponse;
    const answer = data.choices?.[0]?.message?.content?.trim() ?? null;
    if (!answer) return emptyResearch(language, 'unavailable');

    const resultsByUrl = new Map(
      (data.search_results ?? [])
        .map((item) => ({ item, url: item.url ? safeHttpUrl(item.url) : null }))
        .filter((entry): entry is { item: SonarSearchResult; url: string } => Boolean(entry.url))
        .map(({ item, url }) => [url, item]),
    );
    const citationUrls = [
      ...new Set([
        ...(data.citations ?? []).map(safeHttpUrl).filter((url): url is string => Boolean(url)),
        ...resultsByUrl.keys(),
      ]),
    ].slice(0, 8);

    return {
      provider: 'perplexity-sonar',
      status: 'complete',
      answer,
      citations: citationUrls.map((url) => {
        const result = resultsByUrl.get(url);
        return {
          title: result?.title?.trim() || new URL(url).hostname.replace(/^www\./, ''),
          url,
          ...(result?.snippet ? { snippet: result.snippet } : {}),
          ...(result?.date ? { date: result.date } : {}),
        };
      }),
      relatedQuestions: (data.related_questions ?? []).slice(0, 4),
      disclaimer: disclaimerFor(language),
      externalHealthHubUrl: 'https://www.perplexity.ai/health',
    };
  } catch {
    return emptyResearch(language, 'unavailable');
  }
}
