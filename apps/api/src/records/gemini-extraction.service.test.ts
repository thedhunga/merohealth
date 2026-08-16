import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiRecordExtractionService } from './gemini-extraction.service.js';

const INPUT = { contentType: 'image/jpeg', bytes: new Uint8Array([1, 2, 3]) };

function jsonResponse(text: string, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text }] } }] }),
  } as Response);
}

describe('GeminiRecordExtractionService', () => {
  const originalKey = process.env['GEMINI_API_KEY'];
  const originalModel = process.env['GEMINI_MODEL'];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env['GEMINI_API_KEY'];
    else process.env['GEMINI_API_KEY'] = originalKey;
    if (originalModel === undefined) delete process.env['GEMINI_MODEL'];
    else process.env['GEMINI_MODEL'] = originalModel;
  });

  it('reports setup-required and never calls fetch when no key is configured', async () => {
    delete process.env['GEMINI_API_KEY'];
    const service = new GeminiRecordExtractionService();

    const result = await service.extract(INPUT);

    expect(result).toEqual({ status: 'setup-required', observations: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('extracts systolic and diastolic observations from a legible reading', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key';
    vi.mocked(fetch).mockReturnValue(
      jsonResponse(JSON.stringify({ readings: [{ systolicMmHg: 132, diastolicMmHg: 84, confidence: 0.91 }] })),
    );
    const service = new GeminiRecordExtractionService();

    const result = await service.extract(INPUT);

    expect(result.status).toBe('complete');
    expect(result.observations).toEqual([
      expect.objectContaining({ code: '8480-6', value: '132', unit: 'mmHg', confidence: 0.91 }),
      expect.objectContaining({ code: '8462-4', value: '84', unit: 'mmHg', confidence: 0.91 }),
    ]);
  });

  it('sends the image as inline base64 data with the declared content type', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key';
    vi.mocked(fetch).mockReturnValue(jsonResponse(JSON.stringify({ readings: [] })));
    const service = new GeminiRecordExtractionService();

    await service.extract(INPUT);

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string) as {
      contents: Array<{ parts: Array<{ inlineData?: { mimeType: string; data: string } }> }>;
    };
    const inlineData = body.contents[0]!.parts.find((part) => part.inlineData)!.inlineData!;
    expect(inlineData.mimeType).toBe('image/jpeg');
    expect(Buffer.from(inlineData.data, 'base64')).toEqual(Buffer.from(INPUT.bytes));
  });

  it('returns complete with no observations when nothing legible is found', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key';
    vi.mocked(fetch).mockReturnValue(jsonResponse(JSON.stringify({ readings: [] })));
    const service = new GeminiRecordExtractionService();

    const result = await service.extract(INPUT);

    expect(result).toEqual({ status: 'complete', observations: [] });
  });

  it('drops a hallucinated out-of-range reading rather than trusting it', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key';
    vi.mocked(fetch).mockReturnValue(
      jsonResponse(JSON.stringify({ readings: [{ systolicMmHg: 999, diastolicMmHg: 84, confidence: 0.9 }] })),
    );
    const service = new GeminiRecordExtractionService();

    const result = await service.extract(INPUT);

    expect(result).toEqual({ status: 'complete', observations: [] });
  });

  it('reports unavailable on a non-2xx response', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key';
    vi.mocked(fetch).mockReturnValue(jsonResponse('', false));
    const service = new GeminiRecordExtractionService();

    expect(await service.extract(INPUT)).toEqual({ status: 'unavailable', observations: [] });
  });

  it('reports unavailable when the model does not return text', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key';
    vi.mocked(fetch).mockReturnValue(Promise.resolve({ ok: true, json: () => Promise.resolve({ candidates: [] }) } as Response));
    const service = new GeminiRecordExtractionService();

    expect(await service.extract(INPUT)).toEqual({ status: 'unavailable', observations: [] });
  });

  it('treats malformed JSON from the model as no legible reading, not an outage', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key';
    vi.mocked(fetch).mockReturnValue(jsonResponse('not json'));
    const service = new GeminiRecordExtractionService();

    expect(await service.extract(INPUT)).toEqual({ status: 'complete', observations: [] });
  });

  it('reports unavailable on a network failure', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key';
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    const service = new GeminiRecordExtractionService();

    expect(await service.extract(INPUT)).toEqual({ status: 'unavailable', observations: [] });
  });
});
