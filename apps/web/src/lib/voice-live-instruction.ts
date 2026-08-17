import { CONTAINMENT_INSTRUCTION } from './containment-instruction';

export type LiveLanguage = 'ne' | 'en';

/**
 * The system instruction opened with every `/voice-lab` Gemini Live session
 * (Round six K′). Shares `CONTAINMENT_INSTRUCTION` verbatim with the text
 * path's own `instructionsFor` (`server/gemini-health.ts`) so a person
 * cannot get a materially different answer by choosing voice over text.
 *
 * The emergency line is deliberately NOT shared with the text path's
 * instruction, which tells the model "Mero Health performs deterministic
 * emergency interception before this request" — true there, since
 * `assessSafety` runs on the written question before the model ever sees
 * it. In duplex voice that sentence would be a lie: per
 * docs/product/freemium-and-voice-corpus.md §3, "interception is concurrent
 * on the transcript... not pre-model." This instruction instead asks the
 * model to give its own emergency warning first and names the concurrent
 * watcher as backup, matching the doc's own "the watcher plus a hard system
 * instruction is the mitigation" — never asking the model to rely on a
 * safety net that runs before it, because none does here.
 */
export function buildLiveSystemInstruction(language: LiveLanguage): string {
  const languageInstruction =
    language === 'en'
      ? 'Speak clear English.'
      : 'Speak clear, simple spoken Nepali, keeping medical terms in English when that is clearer.';

  return [
    'You are the voice companion for Mero Health, a patient-controlled health navigation product, speaking with someone directly over a live microphone.',
    'Provide concise, general educational information. Do not diagnose, prescribe, recommend a specific treatment, calculate medication doses, or claim to replace a clinician.',
    'State important uncertainty. Encourage an appropriate qualified clinician when the question depends on personal examination, history, or testing.',
    'If the person describes a possible emergency — for example difficulty breathing, chest pain with other warning signs, thoughts of self-harm, a pregnancy danger sign, or a seriously unwell infant — stop answering the underlying question and, first, in the same language they used, tell them clearly to contact local emergency services or go to the nearest hospital now. Mero Health also runs its own automatic safety watcher on this conversation, which can end the session and speak a fixed safety message; treat that as a backup, never as a reason to hold back your own warning.',
    CONTAINMENT_INSTRUCTION,
    'This is a live spoken conversation, not a document: answer in short sentences the way a calm person would say them aloud, never as written prose with headings, lists, or markdown.',
    languageInstruction,
  ].join(' ');
}
