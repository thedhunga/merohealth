import { Injectable } from '@nestjs/common';
import type { ExtractedObservationDraft, ExtractionInput, ExtractionResult, RecordExtractionService } from './record-extraction.service.js';

/**
 * LOINC codes for the two halves of a blood pressure reading. Real,
 * published identifiers — not invented — so a confirmed observation is
 * interoperable with `@swasthya/interop`'s FHIR export the same way every
 * other LOINC-coded observation already is.
 */
const SYSTOLIC_CODE = '8480-6';
const DIASTOLIC_CODE = '8462-4';

interface GeminiReading {
  systolicMmHg?: unknown;
  diastolicMmHg?: unknown;
  confidence?: unknown;
}

interface GenerateContentResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

/**
 * Scoped to one analyte on purpose — Round four F4 wires blood pressure end
 * to end; a second analyte gets its own prompt and its own mapping to
 * `ExtractedObservationDraft`, not a generic "extract everything" pass this
 * early. Never throws: every branch (missing key, HTTP failure, malformed
 * JSON, an out-of-range value) resolves to a status `RecordsService` can act
 * on, the same contract `PerplexityHealthService`/`researchWithGemini` use.
 */
@Injectable()
export class GeminiRecordExtractionService implements RecordExtractionService {
  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) return { status: 'setup-required', observations: [] };

    const model = process.env['GEMINI_MODEL'] || 'gemini-2.5-flash';

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: PROMPT },
                  { inlineData: { mimeType: input.contentType, data: Buffer.from(input.bytes).toString('base64') } },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: RESPONSE_SCHEMA,
            },
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!response.ok) return { status: 'unavailable', observations: [] };

      const data = (await response.json()) as GenerateContentResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { status: 'unavailable', observations: [] };

      return { status: 'complete', observations: parseReadings(text) };
    } catch {
      return { status: 'unavailable', observations: [] };
    }
  }
}

const PROMPT = [
  'You are extracting a single blood pressure reading from a photograph for a Nepali health record app.',
  'The photograph may be a blood pressure monitor/cuff display, a printed or handwritten clinical report, or something unrelated.',
  'If, and only if, you can clearly read both a systolic and a diastolic blood pressure value in mmHg, return them.',
  'Never guess, estimate, or invent a number that is not legibly printed or displayed in the image.',
  'If no blood pressure reading is legible, return an empty readings array.',
  'confidence is your own certainty that the reading was read correctly, from 0 (barely legible) to 1 (perfectly clear) — not a clinical judgement about the value itself.',
].join(' ');

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    readings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          systolicMmHg: { type: 'NUMBER' },
          diastolicMmHg: { type: 'NUMBER' },
          confidence: { type: 'NUMBER' },
        },
        required: ['systolicMmHg', 'diastolicMmHg', 'confidence'],
      },
    },
  },
  required: ['readings'],
} as const;

/**
 * Only the first legible reading becomes observations: a single capture
 * carries one `documentDate`, and a photograph legitimately showing several
 * readings on several different dates would need per-reading dates the model
 * is not asked for here — safer to under-extract than to attach the wrong
 * date to a real number. Values outside a physiologically plausible range are
 * dropped rather than trusted; a hallucinated 999 mmHg must never reach a
 * DRAFT observation.
 */
function parseReadings(text: string): ExtractedObservationDraft[] {
  let parsed: { readings?: GeminiReading[] };
  try {
    parsed = JSON.parse(text) as { readings?: GeminiReading[] };
  } catch {
    return [];
  }

  const reading = parsed.readings?.[0];
  if (!reading) return [];

  const systolic = asPlausible(reading.systolicMmHg, 40, 300);
  const diastolic = asPlausible(reading.diastolicMmHg, 20, 200);
  const confidence = asPlausible(reading.confidence, 0, 1);
  if (systolic === null || diastolic === null || confidence === null) return [];

  return [
    {
      code: SYSTOLIC_CODE,
      codeSystem: 'LOINC',
      labelNe: 'सिस्टोलिक रक्तचाप',
      labelEn: 'Systolic blood pressure',
      value: String(systolic),
      unit: 'mmHg',
      confidence,
    },
    {
      code: DIASTOLIC_CODE,
      codeSystem: 'LOINC',
      labelNe: 'डायस्टोलिक रक्तचाप',
      labelEn: 'Diastolic blood pressure',
      value: String(diastolic),
      unit: 'mmHg',
      confidence,
    },
  ];
}

function asPlausible(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}
