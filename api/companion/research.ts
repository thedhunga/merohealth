interface RequestLike {
  method?: string;
  body?: unknown;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  json(payload: unknown): void;
  setHeader(name: string, value: string): void;
}

interface SonarResult {
  choices?: Array<{ message?: { content?: string } }>;
  citations?: string[];
  search_results?: Array<{ title?: string; url?: string; snippet?: string; date?: string }>;
  related_questions?: string[];
}

const emergencyPatterns = [
  /can'?t breathe/i,
  /cannot breathe/i,
  /difficulty breathing/i,
  /सास फेर्न (गाह्रो|सक्दिन)/u,
  /saas ferna (garo|sakdina)/i,
  /chest (pain|pressure).*(severe|sweat|faint|arm|jaw)/i,
  /छाती.*(कडा|दुखाइ|पसिना|बेहोस)/u,
  /kill myself|suicide|end my life/i,
  /आत्महत्या|मर्न मन लाग/u,
  /aatmahatya/i,
];

function parseBody(body: unknown): { message: string; language: 'ne' | 'en' | 'ne-Latn' } | null {
  const value =
    typeof body === 'string'
      ? (() => {
          try {
            return JSON.parse(body) as unknown;
          } catch {
            return null;
          }
        })()
      : body;
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { message?: unknown; language?: unknown };
  if (typeof candidate.message !== 'string') return null;
  const message = candidate.message.trim();
  if (message.length < 3 || message.length > 4000) return null;
  const language =
    candidate.language === 'en' || candidate.language === 'ne-Latn' ? candidate.language : 'ne';
  return { message, language };
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (request.method === 'OPTIONS') {
    response.status(204).json({});
    return;
  }
  if (request.method !== 'POST') {
    response.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' });
    return;
  }

  const input = parseBody(request.body);
  if (!input) {
    response.status(400).json({ code: 'VALIDATION_ERROR', message: 'Enter a health question.' });
    return;
  }

  const emergency = emergencyPatterns.some((pattern) =>
    pattern.test(input.message.normalize('NFKC')),
  );
  if (emergency) {
    response.status(200).json({
      assessment: { riskLevel: 'EMERGENCY_NOW', interruptConversation: true },
      template:
        input.language === 'en'
          ? 'This may be an emergency. Contact a locally verified emergency service now or go to the nearest appropriate hospital.'
          : 'यो आपतकालीन अवस्था हुन सक्छ। अहिले नै नजिकको उपयुक्त आपतकालीन सेवामा सम्पर्क गर्नुहोस् वा नजिकको अस्पताल जानुहोस्।',
      research: null,
    });
    return;
  }

  const disclaimer =
    input.language === 'en'
      ? 'General health information only. This is not a diagnosis or a treatment recommendation.'
      : 'यो सामान्य स्वास्थ्य जानकारी मात्र हो। यो निदान वा उपचार सिफारिस होइन।';
  const apiKey = process.env['PERPLEXITY_API_KEY'];

  if (!apiKey) {
    response.status(200).json({
      assessment: { riskLevel: 'CLINICIAN_RECOMMENDED', interruptConversation: false },
      template: null,
      research: {
        provider: 'perplexity-sonar',
        status: 'setup-required',
        answer: null,
        citations: [],
        relatedQuestions: [],
        disclaimer,
        externalHealthHubUrl: 'https://www.perplexity.ai/health',
      },
    });
    return;
  }

  const languageInstruction =
    input.language === 'en'
      ? 'Respond in clear English.'
      : input.language === 'ne-Latn'
        ? 'Respond in simple Romanized Nepali, keeping medical terms in English when clearer.'
        : 'Respond in clear, simple Nepali (Devanagari), keeping medical terms in English when clearer.';

  try {
    const sonarResponse = await fetch('https://api.perplexity.ai/v1/sonar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env['PERPLEXITY_MODEL'] ?? 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: [
              'You are the evidence-research layer for Mero Health.',
              'Give concise general education grounded in reliable current sources.',
              'Do not diagnose, prescribe, recommend a specific treatment, calculate doses, or replace a clinician.',
              'State uncertainty and suggest a qualified clinician when personal examination, history, or testing matters.',
              'Do not give emergency instructions because Mero Health screens emergencies before this request.',
              'Prefer public-health agencies, medical societies, peer-reviewed research, and academic health systems.',
              languageInstruction,
            ].join(' '),
          },
          { role: 'user', content: input.message },
        ],
        temperature: 0.1,
        max_tokens: 900,
        return_related_questions: true,
        web_search_options: { search_context_size: 'high' },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!sonarResponse.ok) throw new Error('Sonar unavailable');
    const data = (await sonarResponse.json()) as SonarResult;
    const answer = data.choices?.[0]?.message?.content?.trim() ?? null;
    const resultByUrl = new Map(
      (data.search_results ?? [])
        .filter((item): item is { title?: string; url: string; snippet?: string; date?: string } =>
          Boolean(item.url),
        )
        .map((item) => [item.url, item]),
    );
    const urls = [...new Set([...(data.citations ?? []), ...resultByUrl.keys()])].slice(0, 8);
    const citations = urls.map((url) => {
      const item = resultByUrl.get(url);
      return {
        title: item?.title?.trim() || new URL(url).hostname.replace(/^www\./, ''),
        url,
        ...(item?.snippet ? { snippet: item.snippet } : {}),
        ...(item?.date ? { date: item.date } : {}),
      };
    });

    response.status(200).json({
      assessment: { riskLevel: 'CLINICIAN_RECOMMENDED', interruptConversation: false },
      template: null,
      research: {
        provider: 'perplexity-sonar',
        status: answer ? 'complete' : 'unavailable',
        answer,
        citations,
        relatedQuestions: (data.related_questions ?? []).slice(0, 4),
        disclaimer,
        externalHealthHubUrl: 'https://www.perplexity.ai/health',
      },
    });
  } catch {
    response.status(503).json({
      code: 'RESEARCH_UNAVAILABLE',
      message: 'Cited research is temporarily unavailable.',
    });
  }
}
