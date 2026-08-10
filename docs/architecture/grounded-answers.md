# Grounded answers — retrieval over the person's own record

> Status: proposed. How the assistant answers from a person's actual history
> instead of inventing something plausible.

## 1. The point

An answer about someone's health must be traceable to something in their
record, or it must say it does not know. "Plausible" is the failure mode: a
model that confidently reports a creatinine trend it inferred rather than read
is worse than one that says "I don't have that."

Grounding is also what makes Nepali tractable. A general Nepali health model
is a hard research problem; retrieval over four of *your* lab reports is an
engineering problem.

## 2. Structured first, narrative second

**The single most important rule:** anything computable is computed, not
generated.

"मेरो creatinine कस्तो छ?" is answered by `buildAnalyteTrend` in
`packages/health-records` — a deterministic function over confirmed
observations that already refuses to compare across mixed units. The model
does not produce the numbers. It phrases, in Nepali, a result that was
calculated.

Route by intent:

| Intent | Answered by |
|---|---|
| Value, trend, comparison, date | `health-records` functions, deterministic |
| "What does this word mean" | Health library, cited |
| "What should I do" | `clinical-safety` first, then narrative with citations |
| Anything not in the record | Refusal, explicitly |

A number that reaches a person must have been read or computed, never
predicted. Where the model is involved at all, it is translating a computed
result into language — and the computed value is passed through verbatim.

## 3. Retrieval scope is a security boundary

The retrievable set for a turn is exactly:

- confirmed observations (`CONFIRMED` / `CORRECTED` only — `health-records`
  already enforces this, and a `DRAFT` OCR reading must never be answered
  from)
- documents belonging to the current subject
- device samples for the current subject
- family history assertions **on the current subject's own record**
- approved health-library content

Everything else is out of scope, and two exclusions are absolute:

1. **Never another subject's record**, even under an active delegation. When
   the grandson asks a question while acting for his grandmother, the subject
   is *her* and the retrieval set is *hers* — never a union of both. A
   question asked in her context must not be answerable from his record, and
   vice versa.
2. **Never another user's data**, obviously — but this needs a test, not an
   assumption. The agent already found and fixed one cross-owner gap on the
   records routes; retrieval is the same class of bug with a worse blast
   radius.

Cross-subject leakage is the highest-severity failure this system can have.
It gets an explicit test, not a code review.

## 4. Cross-lingual retrieval

Nepali users ask in Nepali. Their lab reports are almost always in English.
Retrieval that only matches within a language will find nothing.

- Index the bilingual labels already on `HealthObservation`
  (`labelNe` / `labelEn`) rather than the raw document text.
- Maintain a Nepali ↔ English clinical term map: मिर्गौला ↔ kidney ↔ renal,
  चिनी/सुगर ↔ glucose ↔ blood sugar. Romanized Nepali too — `sugar`, `chini`.
- Expand the query across all three registers before retrieving.

This term map is a genuine asset and worth curating by hand. It is also the
part a general model does worst.

## 5. Citations

Every claim carries a reference to the observation or document it came from,
and the interface shows it — "तपाईंको २०८२ चैत ५ को रिपोर्टबाट" with a tap
through to the source. Two reasons: the person can check, and an
uncited claim becomes visibly anomalous rather than blending in.

An answer that cannot cite is a refusal.

## 6. Refusal is a feature

The assistant says it does not know when:

- the record contains nothing relevant;
- the only relevant observations are unconfirmed drafts (and it says so,
  pointing at the confirmation queue);
- units are mixed such that no comparison is valid;
- the question needs an examination, an image, or a test it does not have.

Refusals are specific — "your record has no thyroid results" — not generic.
A vague refusal reads as a broken feature; a specific one reads as honesty and
tells the person what to do next.

## 7. Order of operations

```
message
  → clinical-safety interception          (deterministic, always first)
  → intent routing
  → structured answer if computable       (no model in the numeric path)
  → retrieval, scoped to the subject
  → generation, cited, refusing when unsupported
  → corpus capture if consented           (language-corpus)
```

`clinical-safety` runs before retrieval, not after. Someone describing chest
pain gets the emergency interception whether or not their record has anything
relevant, and no retrieval or generation happens first.

## 8. Evaluation before improvement

Build the evaluation set before tuning anything: real Nepali questions paired
with the record state they should be answered from, including cases whose
correct answer is a refusal. Without it there is no way to tell a change that
helped from one that merely sounds better — and "sounds better" is precisely
the failure this whole document exists to prevent.

## 9. Module shape

```
packages/retrieval
  Query expansion (ne / ne-Latn / en), the clinical term map, scoped
  retrieval over a subject, citation assembly, refusal construction.
```

No embeddings to begin with. The corpus per person is small — tens of
documents, hundreds of observations — and lexical matching over bilingual
labels plus the term map will outperform a vector index at this size while
staying inspectable. Revisit when a real corpus says otherwise.
