import { describe, expect, it } from 'vitest';

import { buildAudioChunkMessage, buildSetupMessage, parseLiveServerMessages } from './gemini-live-protocol';

describe('buildSetupMessage', () => {
  it('prefixes a bare model id with models/, and enables both transcription streams', () => {
    const message = buildSetupMessage({
      model: 'gemini-live-2.5-flash-preview',
      systemInstruction: 'Be careful.',
      languageCode: 'ne-NP',
    }) as { setup: Record<string, unknown> };

    expect(message.setup['model']).toBe('models/gemini-live-2.5-flash-preview');
    expect(message.setup['inputAudioTranscription']).toEqual({});
    expect(message.setup['outputAudioTranscription']).toEqual({});
    expect(message.setup['systemInstruction']).toEqual({ parts: [{ text: 'Be careful.' }] });
    expect((message.setup['generationConfig'] as Record<string, unknown>)['responseModalities']).toEqual(['AUDIO']);
  });

  it('leaves an already-prefixed model id alone', () => {
    const message = buildSetupMessage({
      model: 'models/gemini-live-2.5-flash-preview',
      systemInstruction: 'x',
      languageCode: 'en-US',
    }) as { setup: Record<string, unknown> };
    expect(message.setup['model']).toBe('models/gemini-live-2.5-flash-preview');
  });
});

describe('buildAudioChunkMessage', () => {
  it('wraps base64 PCM as a 16 kHz realtime audio chunk', () => {
    expect(buildAudioChunkMessage('AAA=')).toEqual({
      realtimeInput: { audio: { data: 'AAA=', mimeType: 'audio/pcm;rate=16000' } },
    });
  });
});

describe('parseLiveServerMessages', () => {
  it('reports setupComplete', () => {
    expect(parseLiveServerMessages({ setupComplete: {} })).toEqual([{ type: 'setupComplete' }]);
  });

  it('extracts an input transcription delta as a user transcript event', () => {
    expect(parseLiveServerMessages({ serverContent: { inputTranscription: { text: 'namaste' } } })).toEqual([
      { type: 'transcript', speaker: 'user', textDelta: 'namaste' },
    ]);
  });

  it('extracts an output transcription delta as a model transcript event', () => {
    expect(parseLiveServerMessages({ serverContent: { outputTranscription: { text: 'k cha?' } } })).toEqual([
      { type: 'transcript', speaker: 'model', textDelta: 'k cha?' },
    ]);
  });

  it('extracts audio parts from a model turn, skipping non-audio parts', () => {
    const events = parseLiveServerMessages({
      serverContent: {
        modelTurn: {
          parts: [{ text: 'ignored' }, { inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'ZGF0YQ==' } }],
        },
      },
    });
    expect(events).toEqual([{ type: 'audio', base64: 'ZGF0YQ==', mimeType: 'audio/pcm;rate=24000' }]);
  });

  it('reports interrupted and turnComplete flags', () => {
    expect(parseLiveServerMessages({ serverContent: { interrupted: true } })).toEqual([{ type: 'interrupted' }]);
    expect(parseLiveServerMessages({ serverContent: { turnComplete: true } })).toEqual([{ type: 'turnComplete' }]);
  });

  it('can return multiple events from one frame, in order', () => {
    const events = parseLiveServerMessages({
      serverContent: { outputTranscription: { text: 'hello' }, turnComplete: true },
    });
    expect(events).toEqual([
      { type: 'transcript', speaker: 'model', textDelta: 'hello' },
      { type: 'turnComplete' },
    ]);
  });

  it('degrades to unknown rather than throwing on a malformed or empty frame', () => {
    expect(parseLiveServerMessages(null)).toEqual([{ type: 'unknown' }]);
    expect(parseLiveServerMessages('a string, not an object')).toEqual([{ type: 'unknown' }]);
    expect(parseLiveServerMessages({})).toEqual([{ type: 'unknown' }]);
    expect(parseLiveServerMessages({ serverContent: { modelTurn: { parts: [{ text: 'only text' }] } } })).toEqual([
      { type: 'unknown' },
    ]);
    expect(parseLiveServerMessages({ serverContent: null })).toEqual([{ type: 'unknown' }]);
  });
});
