import type { VoiceContributionTaskKind } from '@swasthya/language-corpus';

export interface VoiceContributionTask {
  id: string;
  kind: VoiceContributionTaskKind;
}

/**
 * `/contribute` (Round six §M's third box) — Voice Contribution, §4 stream A
 * of `docs/product/freemium-and-voice-corpus.md`. Only ids and kind live
 * here; the actual prompt text each `id` renders is
 * `voiceContribution.tasks.<id>.prompt` in `messages/ne.json`/`en.json`,
 * matching this codebase's "content declares ids and order, messages hold
 * the copy" split (`content/pricing.ts`'s own module/quota order lists are
 * the same shape).
 *
 * The three `FREE_SPEECH` tasks are the doc's own three named examples
 * verbatim ("describe how you make dal", "tell me about your village",
 * "explain what a fever feels like") — not invented here. The two
 * `READ_PROMPT` tasks are plain, neutral, non-health sentences written for
 * this box: the doc asks for "read prompts" but names no example sentences,
 * and a read-aloud prompt carries no factual claim to get wrong, unlike a
 * statistic or a clinical claim "invent no facts" actually guards against.
 */
export const VOICE_CONTRIBUTION_TASKS: readonly VoiceContributionTask[] = [
  { id: 'read-clear-sky', kind: 'READ_PROMPT' },
  { id: 'read-morning-walk', kind: 'READ_PROMPT' },
  { id: 'free-speech-dal', kind: 'FREE_SPEECH' },
  { id: 'free-speech-village', kind: 'FREE_SPEECH' },
  { id: 'free-speech-fever', kind: 'FREE_SPEECH' },
];
