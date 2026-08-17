/**
 * Message shapes for Gemini Live's `BidiGenerateContent` WebSocket protocol
 * (Round six K′). Kept as plain functions over plain objects — no
 * `WebSocket`, no `AudioContext` — so the message building and server-frame
 * parsing can be unit tested the same way `voice-token.ts` tests its own
 * request/response shapes with a mocked `fetch`, rather than needing a
 * browser to test at all. `useGeminiLiveSession.ts` is the thin, untestable
 * wiring on top of this, matching how `useSpeechDictation.ts` wraps the Web
 * Speech API without a colocated test of its own.
 *
 * These shapes are this run's best reading of Google's documented preview
 * surface, not something verified against a live session — the flag
 * (`GEMINI_LIVE_ENABLED`) is off in every environment this run has access
 * to, same caveat the token-mint route's own log entry recorded. The K′
 * "findings" box (docs/product/freemium-and-voice-corpus.md §3) is where the
 * owner confirms these against a real phone.
 */

export type LiveSpeaker = 'user' | 'model';

export interface LiveSetupOptions {
  model: string;
  systemInstruction: string;
  /** BCP-47, e.g. `ne-NP` — matches `useSpeechDictation.ts`'s `recognitionLang` map. */
  languageCode: string;
}

/**
 * The first message every session must send. `inputAudioTranscription` and
 * `outputAudioTranscription` are both requested with no options (empty
 * objects turn them on) — this is what makes "live transcript of both
 * sides" possible without running our own speech-to-text, and it is also
 * what the emergency watcher reads: it never has access to raw audio, only
 * to this text.
 */
export function buildSetupMessage(options: LiveSetupOptions): object {
  return {
    setup: {
      model: options.model.startsWith('models/') ? options.model : `models/${options.model}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { languageCode: options.languageCode },
      },
      systemInstruction: { parts: [{ text: options.systemInstruction }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };
}

/** One realtime audio chunk — 16-bit PCM, little-endian, mono, 16 kHz (see `pcm-audio.ts`). */
export function buildAudioChunkMessage(base64Pcm16: string): object {
  return { realtimeInput: { audio: { data: base64Pcm16, mimeType: 'audio/pcm;rate=16000' } } };
}

export type LiveServerEvent =
  | { type: 'setupComplete' }
  | { type: 'transcript'; speaker: LiveSpeaker; textDelta: string }
  | { type: 'audio'; base64: string; mimeType: string }
  | { type: 'turnComplete' }
  | { type: 'interrupted' }
  | { type: 'unknown' };

interface RawPart {
  inlineData?: { mimeType?: string; data?: string };
}

/**
 * Normalises one server frame into zero or more events. A single frame can
 * legitimately carry more than one event (e.g. an output-transcription delta
 * and an audio chunk together), so this always returns an array rather than
 * picking one — the caller processes every event, in order.
 *
 * Defensive throughout: an unrecognised or malformed frame becomes
 * `[{ type: 'unknown' }]` rather than a thrown error, the same "degrade, do
 * not crash the session" stance `voice-token.ts` takes on Google's response
 * shape.
 */
export function parseLiveServerMessages(raw: unknown): LiveServerEvent[] {
  if (!raw || typeof raw !== 'object') return [{ type: 'unknown' }];
  const message = raw as Record<string, unknown>;
  const events: LiveServerEvent[] = [];

  if ('setupComplete' in message) events.push({ type: 'setupComplete' });

  const serverContent = message['serverContent'];
  if (serverContent && typeof serverContent === 'object') {
    const content = serverContent as Record<string, unknown>;

    const inputTranscription = content['inputTranscription'];
    const inputText =
      inputTranscription && typeof inputTranscription === 'object'
        ? (inputTranscription as { text?: unknown }).text
        : undefined;
    if (typeof inputText === 'string' && inputText.length > 0) {
      events.push({ type: 'transcript', speaker: 'user', textDelta: inputText });
    }

    const outputTranscription = content['outputTranscription'];
    const outputText =
      outputTranscription && typeof outputTranscription === 'object'
        ? (outputTranscription as { text?: unknown }).text
        : undefined;
    if (typeof outputText === 'string' && outputText.length > 0) {
      events.push({ type: 'transcript', speaker: 'model', textDelta: outputText });
    }

    const modelTurn = content['modelTurn'];
    const parts =
      modelTurn && typeof modelTurn === 'object' ? (modelTurn as { parts?: unknown }).parts : undefined;
    if (Array.isArray(parts)) {
      for (const part of parts as RawPart[]) {
        const data = part.inlineData?.data;
        const mimeType = part.inlineData?.mimeType;
        if (typeof data === 'string' && typeof mimeType === 'string' && mimeType.startsWith('audio/')) {
          events.push({ type: 'audio', base64: data, mimeType });
        }
      }
    }

    if (content['interrupted'] === true) events.push({ type: 'interrupted' });
    if (content['turnComplete'] === true) events.push({ type: 'turnComplete' });
  }

  return events.length > 0 ? events : [{ type: 'unknown' }];
}
