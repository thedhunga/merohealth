# Nepali language corpus

> Status: consent and capture layer built (`packages/language-corpus`).
> Training pipeline deliberately not built.

## 1. Why this exists now and not later

Two halves of "collect Nepali data to train a custom model" have opposite
deadlines.

**The training pipeline can wait.** It needs scale the product does not have,
the tooling changes every few months, and nothing is lost by starting it in a
year.

**The consent basis cannot wait.** An utterance retained without a
training-use consent recorded *at the moment of capture* is not usable for
training afterwards. The options at that point are to discard the corpus or to
re-approach every user for retrospective permission, which most will not
answer. Months of accumulated conversation would be worth nothing.

That asymmetry is the entire argument. Build the cheap, boring part now;
build the interesting part when it is worth building.

## 2. What is collected, and why it is worth collecting

The valuable signal is not "health questions". It is **how Nepali speakers
actually phrase them** — the register people use rather than the clinical
term, Romanized Nepali, and the constant code-mixing with English medical
vocabulary that no general model handles well.

Three kinds are captured:

| Kind | Value |
|---|---|
| `USER_MESSAGE` | Natural phrasing of a symptom or question |
| `CORRECTION` | **The highest-value row**, and the cheapest to get |
| `VOICE_TRANSCRIPT` | Speech-to-text output, for a Nepali ASR model |

A `CORRECTION` is when the assistant misunderstood and the person rephrased.
That pair is a labelled example of precisely the failure the model needs to
learn from, and the moment it happens is a natural, honest place to ask
whether the exchange may be kept — far better than a blanket request at
signup.

## 3. Consent

Purposes are separate and independently revocable:

- `SERVICE_DELIVERY` — not optional; the product does not work without it
- `MODEL_TRAINING_TEXT` — opt-in, default off
- `MODEL_TRAINING_VOICE` — separate from text; voice is more identifying
- `HUMAN_REVIEW` — someone at Mero Health reading it

**None of these may ride along on terms-of-service acceptance.** Bundling
secondary use into a terms checkbox is the pattern that makes a consent record
worthless in the first place, and it is worth less than nothing here: it
produces a corpus that looks consented and is not.

Consent is checked **twice** — once when the utterance is captured, and again
when a training snapshot is built. A person may withdraw in between, and the
withdrawal has to bite before the data is used, not after.

## 4. The unlearning problem

Once weights exist, an utterance cannot be removed from them. Deleting a row
from the corpus does not delete its influence on a model already trained.

So the only honest guarantee is procedural:

1. A snapshot only ever contains utterances whose consent is live at the
   moment the snapshot is taken.
2. Every model version records the snapshot id it trained on.
3. A right-to-erasure request removes the person from the corpus, every
   derived snapshot, and the review queue — and is answered truthfully about
   models already trained, rather than implying an unlearning that did not
   happen.

`utteranceIdsForOwner` returns ids rather than deleting, precisely because
erasure has to reach several stores and the caller owns them.

## 5. De-identification, and its limits

`deidentify` strips identifiers with regular structure: Nepali mobile numbers
(`98…`/`97…`, with or without `+977`), landlines, citizenship certificate
numbers, council registration numbers, emails, URLs, and any long digit run.

**It does not catch names.** A Nepali personal name, a village, or a
relationship (`मेरो बुहारी`) has no reliable surface form to match on, and a
name list would be both incomplete and a privacy problem of its own. This
limitation is documented in the code rather than papered over, because the
dangerous version of this package is the one that implies the text is safe.

The mitigations are structural, not clever regex:

- Retention is opt-in, so the corpus is small and self-selected.
- Anything that matched a pattern is held for **human review** before use.
- Every voice transcript is held for review regardless, since speech-to-text
  can introduce a name the text pipeline never saw.
- `buildSnapshot` excludes unreviewed rows outright.

## 6. Legal footing

Nepal's Individual Privacy Act 2018 and Privacy Rules 2020 cover health data,
and secondary use for model training is a distinct purpose requiring its own
informed consent. Diaspora users bring GDPR, where health data is special
category under Article 9 — explicit consent is required and legitimate
interest is not available as a basis.

The `policyVersion` on every grant records the wording the person actually
agreed to, so an old grant stays auditable after the policy is rewritten.

## 7. Not built, deliberately

No training code, no fine-tuning harness, no evaluation set, no GPU pipeline.
When it is time, the sequence is: annotation guidelines → held-out evaluation
set built from real Nepali clinical language → baseline measurement against
the current model → only then any training. Fine-tuning before there is an
evaluation set is how teams ship a model that feels better and measurably
is not.
