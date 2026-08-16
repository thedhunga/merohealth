import type { AnonymousProfile } from './anonymous-history';

/**
 * Profile-building as a reaction, never as a form.
 *
 * The person is never asked to fill anything in. After an answer, if there
 * is one fact that would make the *next* answer better and it has not been
 * asked before, one skippable question appears — phrased around the thing
 * they just asked about, so it reads as attentiveness rather than data
 * collection. One at a time. Skipping is permanent for that prompt.
 *
 * Triggers are keyword-based on purpose. This decides only *which single
 * question to ask*; it never diagnoses, and a false positive costs one
 * ignorable prompt.
 */

export type ProfilePromptKey = 'ageBand' | 'askingFor' | 'chronicCondition';

export interface ProfilePrompt {
  key: ProfilePromptKey;
  /** Which profile field the answer writes to. */
  field: 'ageBand' | 'askingFor' | 'conditions';
  /** Chip option keys; copy lives under `getCare.profilePrompts.<key>.options`. */
  options: readonly string[];
}

const prompts: Record<ProfilePromptKey, ProfilePrompt> = {
  ageBand: {
    key: 'ageBand',
    field: 'ageBand',
    options: ['under18', '18to40', '40to60', 'over60'],
  },
  askingFor: {
    key: 'askingFor',
    field: 'askingFor',
    options: ['self', 'child', 'parent', 'other'],
  },
  chronicCondition: {
    key: 'chronicCondition',
    field: 'conditions',
    options: ['diabetes', 'bloodPressure', 'thyroid', 'none'],
  },
};

/**
 * Words that make a given fact worth knowing right now. Nepali, romanised
 * Nepali and English are all matched because the person types however they
 * type. The `u` flag makes Devanagari behave inside character classes.
 */
const conditionWords =
  /(sugar|chini|diabet|मधुमेह|चिनी|सुगर|pressure|रक्तचाप|\bbp\b|thyroid|थाइरोइड)/iu;

/** "my mother", "mero buwa", "बच्चा", "hajur aama" — asking on behalf of someone. */
const behalfWords =
  /\b(my|mero|meri|hamro)\s+(mother|father|son|daughter|wife|husband|baby|child|aama|buwa|chora|chori|shreeman|shreemati|hajur)|(आमा|बुबा|छोरा|छोरी|श्रीमान|श्रीमती|हजुरआमा|हजुरबुबा|बच्चा)/iu;

/**
 * At most one prompt, or null. Order encodes priority: if the question is
 * about someone else, knowing *who* matters more than the asker's own age.
 */
export function nextProfilePrompt(
  question: string,
  answeredCount: number,
  profile: AnonymousProfile,
): ProfilePrompt | null {
  // Never on the very first answer — she came for an answer, not a form.
  if (answeredCount < 1) return null;

  const asked = new Set(profile.askedPrompts);

  if (!asked.has('askingFor') && !profile.askingFor && behalfWords.test(question)) {
    return prompts.askingFor;
  }
  if (
    !asked.has('chronicCondition') &&
    !profile.conditions?.length &&
    conditionWords.test(question)
  ) {
    return prompts.chronicCondition;
  }
  // Age is worth having in general, but only once there is a small
  // relationship — the second real answer, not the first.
  if (!asked.has('ageBand') && !profile.ageBand && answeredCount >= 2) {
    return prompts.ageBand;
  }
  return null;
}
