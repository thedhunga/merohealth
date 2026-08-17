/**
 * Round five, task I: "keep the conversation inside health — before the
 * model, and after." A deterministic classifier (`classifyMessageDomain`)
 * already keeps a clearly off-topic question from reaching the model at
 * all, and re-checks the model's answer afterwards — this instruction is
 * the model's own layer of the same containment, for the `UNSURE`
 * questions that do reach it. A single shared constant rather than the
 * repo's usual "duplicate with a comment" convention for the two research
 * providers' near-identical prompts (see `gemini-health.ts`'s own note on
 * this): the ledger specifies "identical text," and an import guarantees
 * that rather than relying on the next edit to keep two copies in sync.
 *
 * Deliberately does not quote the exact `getCare.offTopic.reply` copy: this
 * instruction is defense-in-depth, not the enforcement mechanism — the
 * pre-call classifier is what guarantees the vetted fixed template actually
 * reaches the person, by never calling the model at all for a clearly
 * off-topic question. Asking the model to echo the fixed sentence verbatim
 * would only tempt it to hallucinate a close-but-wrong paraphrase and have
 * that shown as if it were the real template.
 */
export const CONTAINMENT_INSTRUCTION =
  'Only answer health and wellbeing questions. If the question is not about health or wellbeing at all, do not attempt to answer it — reply with one brief sentence, in the same language as the question, redirecting back to health, and say nothing else.';
