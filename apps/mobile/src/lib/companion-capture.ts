import type { UtteranceKind } from '@swasthya/language-corpus';

export interface CompanionCaptureContext {
  message: string;
  /** Set once the person has tapped "this didn't help" on the previous answer. */
  isRephrase: boolean;
  /** What the assistant said last, or null if there is nothing to correct. */
  precedingAssistantText: string | null;
}

export interface CompanionCapture {
  kind: UtteranceKind;
  rawText: string;
  precedingAssistantText: string | null;
}

/**
 * language-corpus.md §2: a `CORRECTION` is a rephrase after a misunderstood
 * answer, not just "a second message". It only counts as one when the person
 * explicitly flagged the previous answer as unhelpful *and* there is an
 * assistant text to pair it with — a rephrase with nothing preceding it is
 * just an ordinary question that happens to follow another one.
 */
export function classifyCompanionCapture(context: CompanionCaptureContext): CompanionCapture {
  const isCorrection = context.isRephrase && context.precedingAssistantText !== null;
  return {
    kind: isCorrection ? 'CORRECTION' : 'USER_MESSAGE',
    rawText: context.message,
    precedingAssistantText: isCorrection ? context.precedingAssistantText : null,
  };
}
