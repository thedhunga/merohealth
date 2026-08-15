import { Injectable } from '@nestjs/common';

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

export interface HealthResearchResult {
  provider: 'perplexity-sonar';
  status: 'complete' | 'setup-required' | 'unavailable';
  answer: string | null;
  citations: Array<{ title: string; url: string; snippet?: string; date?: string }>;
  relatedQuestions: string[];
  disclaimer: string;
  externalHealthHubUrl: string;
}

@Injectable()
export class PerplexityHealthService {
  async research(
    question: string,
    language: 'ne' | 'en' | 'ne-Latn',
  ): Promise<HealthResearchResult> {
    const disclaimer =
      language === 'en'
        ? 'General health information only. This is not a diagnosis or a treatment recommendation.'
        : language === 'ne-Latn'
          ? 'Yo samanya swasthya jankari matra ho. Yo nidan wa upachar sifaris hoina.'
          : 'यो सामान्य स्वास्थ्य जानकारी मात्र हो। यो निदान वा उपचार सिफारिस होइन।';
    const apiKey = process.env['PERPLEXITY_API_KEY'];

    if (!apiKey) {
      return {
        provider: 'perplexity-sonar',
        status: 'setup-required',
        answer: null,
        citations: [],
        relatedQuestions: [],
        disclaimer,
        externalHealthHubUrl: 'https://www.perplexity.ai/health',
      };
    }

    const languageInstruction =
      language === 'en'
        ? 'Respond in clear English.'
        : language === 'ne-Latn'
          ? 'Respond in simple Romanized Nepali, keeping medical terms in English when clearer.'
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
      const response = await fetch('https://api.perplexity.ai/v1/sonar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env['PERPLEXITY_MODEL'] ?? 'sonar-pro',
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

      if (!response.ok) throw new Error(`Perplexity request failed with ${response.status}`);
      const data = (await response.json()) as SonarResponse;
      const answer = data.choices?.[0]?.message?.content?.trim() ?? null;
      const resultByUrl = new Map(
        (data.search_results ?? [])
          .filter((item): item is SonarSearchResult & { url: string } => Boolean(item.url))
          .map((item) => [item.url, item]),
      );
      const citationUrls = [...new Set([...(data.citations ?? []), ...resultByUrl.keys()])].slice(
        0,
        8,
      );
      const citations = citationUrls.map((url) => {
        const result = resultByUrl.get(url);
        return {
          title: result?.title?.trim() || new URL(url).hostname.replace(/^www\./, ''),
          url,
          ...(result?.snippet ? { snippet: result.snippet } : {}),
          ...(result?.date ? { date: result.date } : {}),
        };
      });

      return {
        provider: 'perplexity-sonar',
        status: answer ? 'complete' : 'unavailable',
        answer,
        citations,
        relatedQuestions: (data.related_questions ?? []).slice(0, 4),
        disclaimer,
        externalHealthHubUrl: 'https://www.perplexity.ai/health',
      };
    } catch {
      return {
        provider: 'perplexity-sonar',
        status: 'unavailable',
        answer: null,
        citations: [],
        relatedQuestions: [],
        disclaimer,
        externalHealthHubUrl: 'https://www.perplexity.ai/health',
      };
    }
  }
}
