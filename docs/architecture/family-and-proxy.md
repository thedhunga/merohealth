# Family, proxy access and inherited risk

> Status: proposed. Answers "how does a grandson ask questions for his
> grandmother", and "how does family history work without leaking a
> diagnosis".

## 1. Not multiple profiles under one account

The obvious design — one login, several profiles, like a streaming service —
is wrong here, and wrong in a way that is expensive to undo.

A health record belongs to **the person it describes**, not to whoever created
the account. If the grandson's account owns the grandmother's record then:

- she cannot take it with her if she moves to another clinic, city or country;
- she cannot revoke his access, because he is the owner;
- her consent to anything is really his consent on her behalf, which is not
  consent;
- if the family falls out, her record is held by someone she no longer trusts.

So: **every person is their own subject with their own record.** Sharing is a
relationship between two subjects, never a container one subject sits inside.

The convenience of the streaming-profile model is preserved by the client — a
profile switcher in the app — without the ownership being wrong underneath.

## 2. Two relationships, never conflated

Most apps model "family member" as one thing. It is two, and treating a
competent adult as a dependent is the failure mode.

### Guardianship
For a **minor**, or an adult assessed to lack capacity. The guardian acts *as*
the person: full access, and the guardian's consent stands in for theirs.

- Must carry an expiry. A child's guardianship terminates at 18, and the
  system must transition rather than silently continue — an adult whose
  parent still has full access to their record because nobody wrote the
  expiry is a real harm.
- At transition the young adult takes ownership and re-grants (or does not).

### Delegation
For a **competent adult who wants help**. The grandmother is not a dependent;
she is a person who does not use smartphones. She grants, and she can revoke.

- Scoped: `VIEW_RECORD`, `ASK_ASSISTANT`, `MANAGE_APPOINTMENTS`,
  `UPLOAD_DOCUMENTS` are separate. Helping her book an appointment does not
  require reading her mental-health notes.
- Time-bounded by default, with renewal, so an abandoned grant lapses instead
  of persisting forever.
- Revocable by her at any time, through any channel — including by phone to
  support, because a person who cannot use the app cannot use an in-app
  revoke button either.

## 3. The hard case: enrolling someone who cannot use the app

This is the case the product actually needs to handle, and where a naive
consent flow quietly becomes a fiction. A grandmother who cannot operate a
phone cannot meaningfully tap "I agree" — and if the grandson taps it for her,
the consent record is worth nothing.

**Assisted enrolment** is the honest path:

1. The grandson initiates and enters her details, which creates *her* subject,
   not a profile inside his.
2. Consent is captured **out of band**: in person with a recorded verbal
   acknowledgement in Nepali, or witnessed by a clinician, or on paper.
3. The delegation records **how** consent was obtained
   (`IN_PERSON_VERBAL`, `WITNESSED`, `CLINICIAN_ATTESTED`, `WRITTEN`), not
   merely that it was.
4. Her record shows, in plain Nepali, who has access and what they can do,
   in a form that can be read to her.
5. Delegations require periodic re-affirmation. Silence is not renewal.

**Never** display a delegated relationship as if the person had self-enrolled.
The provenance of the consent is part of the record.

## 4. Visibility belongs to the person, not the helper

Every access to someone else's record is logged, and the log is **visible to
the record's owner** — not only to an administrator. She can see that her
grandson opened her record on a given day, and what he looked at.

This is the check that makes delegation safe in practice. Families are not
uniformly benign, and elder financial and medical abuse is usually committed
by a relative with legitimate-looking access.

## 5. Family history without leaking a diagnosis

This is the genetic-risk case, and the place where a well-meaning design does
real harm.

**The wrong design:** a shared family health graph where the grandmother's
diagnoses automatically appear on her descendants' records. That discloses her
diagnosis to every relative, forever, without her deciding to.

**The right design — two separate things:**

### Family history assertions
A `FamilyHistoryAssertion` lives on the **asking person's own record**:

```
subject: the granddaughter
relation: MATERNAL_GRANDMOTHER
condition: breast cancer
onsetAgeApprox: 60s
provenance: PATIENT_REPORTED
```

It is *her* statement about her family, held on *her* record. It never reads
from the grandmother's record and does not require her to be a Mero Health
user at all. This is exactly how family history is taken in a clinic, and it
is sufficient for the risk conversations that matter.

### Explicit condition sharing
Separately, a person may choose to share **one named condition** with **named
relatives**. Narrow, revocable, and never implied by a delegation:
`ASK_ASSISTANT` access does not entitle anyone to a genetic finding.

### Rules
- A diagnosis never propagates between records automatically.
- Assertions and shared conditions are visually distinct: "reported by you"
  versus "shared by your grandmother" are different claims with different
  weight, and collapsing them would misrepresent evidence.
- Genetic findings are `RESTRICTED` sensitivity and excluded from every
  default share and export scope.
- The assistant may reason over assertions on the current subject's record.
  It may **never** reach across into a relative's record, even where a
  delegation exists — see the retrieval boundary in
  [`grounded-answers.md`](./grounded-answers.md).

## 6. Module shape

```
packages/family
  Subject relationships, guardianship and delegation state machines,
  scope checks, expiry and re-affirmation, family history assertions.
```

`degradesWith` rather than `requires`: if `family` is `DOWN`, everyone keeps
full access to their **own** record and only delegated access pauses. Failing
closed on someone else's record is correct; failing closed on your own is not.
