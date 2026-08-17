import type { ConversationTurn } from './companion-research';

/**
 * Round five, task H: "Continue this conversation; refer to what the person
 * already said; ask one clarifying question when the answer genuinely
 * depends on it (duration, age, pregnancy, other medicines)" — the ledger's
 * own wording. Shared between both providers the same way
 * `CONTAINMENT_INSTRUCTION` is: the two must behave identically about
 * multi-turn context or swapping providers would silently change the
 * conversation's behaviour. Only appended when there is prior context —
 * a first question in a fresh conversation has nothing to continue.
 */
export const CONVERSATION_INSTRUCTION =
  'This is a continuing conversation. Refer to what the person already said rather than repeating questions they already answered. Ask exactly one clarifying question, and only when the answer genuinely depends on it (for example: how long, their age, pregnancy, or other medicines they take) — otherwise answer directly.';

/**
 * Renders prior turns as a plain transcript for the model to read as
 * context, prefixed ahead of the new message. Fixed English role labels
 * regardless of the conversation's language — this text is instruction
 * scaffolding for the model, never shown to the person, the same choice
 * `CONTAINMENT_INSTRUCTION` already makes for its own English wording.
 */
export function formatConversationTurns(turns: readonly ConversationTurn[]): string {
  return turns
    .map((turn) => `${turn.role === 'user' ? 'Person' : 'You'}: ${turn.text}`)
    .join('\n');
}
