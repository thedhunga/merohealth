# Identity, verification and professional credentialing

> Status: proposed. Defines who the product is for by default, and how the two
> audiences prove who they are.

## 1. Two audiences, one of which is primary

**Patients and the general public are the primary interface.** The product
opens on them; everything else is a tab away. A person with a health question
should reach an answer without meeting a gate.

**Medical professionals get a distinct, clearly-marked surface** reached from
the top navigation — the `clinicians` segment already exists in
`apps/web/src/content/navigation.ts`. Doctors and nurses register there, prove
their credentials, and offer services.

The asymmetry is deliberate. A patient surface that feels like a clinician
tool fails at the only job that matters: being the thing someone opens at
11pm when they are worried.

## 2. Verify late, not at the door

**A national ID must not be required to sign up.**

That is the important recommendation in this document, and it runs against the
obvious instinct to verify everyone up front. Three reasons:

1. **Adoption.** Demanding a government ID photograph before a person can ask
   what their lab result means will lose most of them at the first screen.
   The people who most need this product are the least likely to hand over
   identity documents to an app they have just met.
2. **Risk.** A store of national ID photographs is a far more attractive
   breach target than a store of health questions, and Nepal's Individual
   Privacy Act 2018 covers both. Collecting it early means holding it longer,
   for more people, for no benefit.
3. **It is not needed for most of the product.** Asking a question, reading
   the library, keeping your own records and syncing a watch require no proof
   of legal identity whatsoever.

So identity is verified **at the point where it is actually needed**, and the
person is told exactly why at that moment.

### Assurance levels

| Level | How it is reached | What it unlocks |
|---|---|---|
| `ANONYMOUS` | nothing | Health library, assistant, care directory |
| `REGISTERED` | phone number + OTP | Personal health record, document capture, devices, everything in the free tier |
| `IDENTITY_VERIFIED` | national ID document + liveness check | Sharing records with a named clinician, teleconsultation, anything a prescription could attach to |
| `PROFESSIONAL_VERIFIED` | council registration + manual review | Practising as a clinician on the platform |

`REGISTERED` is the level the product is designed around. Most people should
never need to go past it.

### Accepted identity documents (Nepal)

राष्ट्रिय परिचयपत्र (National Identity Card), नागरिकता (citizenship
certificate), passport, or driving licence. Non-Nepali users fall back to
passport. The capture flow is the one already built for health documents —
same camera, same review-before-submit step.

## 3. Professional credentialing

Nepal has separate statutory registers, and the right one depends on the
profession:

- **Nepal Medical Council (NMC)** — doctors
- **Nepal Nursing Council (NNC)** — nurses and midwives
- **Nepal Health Professional Council (NHPC)** — allied health professionals
- **Nepal Pharmacy Council** — pharmacists
- **Nepal Ayurvedic Medical Council** — ayurvedic practitioners

### The flow

1. Applicant selects their council and enters their registration number.
2. Applicant photographs their council certificate and a photo ID.
3. The submission enters a **manual review queue**.
4. A trained reviewer checks the number against the council's public register
   and records the decision with their own identity attached.
5. Approved applicants get a verified badge that states **which council,
   which number, and when it was last checked**.

### Rules that are not negotiable

- **No automatic approval, ever.** There is no public NMC API to verify
  against, so verification is a human reading a register. Do not build
  anything that implies otherwise, and do not display "verified" for a
  submission that a person has not actually reviewed.
- **Never claim more than was checked.** The badge says what was verified and
  when. It does not say "trusted doctor".
- **Registration lapses.** Council registration expires and can be suspended.
  Every verification carries a re-check date; a stale verification degrades to
  unverified rather than silently persisting.
- **Rejection is reversible and explained.** A rejected applicant is told
  which evidence failed and can resubmit. Blurred certificate photographs will
  be the most common reason by a wide margin.
- **Reviewer actions are audited.** Who approved which clinician, and when, is
  an accountability record — it is the trail that matters if a clinician later
  turns out not to have been registered.

## 4. Handling the evidence

- **Store the decision, not the document.** Once review completes, the
  identity image is deleted and what persists is the verified attributes:
  document type, last four characters of the number, verifying reviewer,
  timestamp, expiry. Retaining the image after it has served its purpose adds
  breach exposure and no capability.
- Evidence is encrypted at rest with a separate key from health records, in
  its own schema namespace. A compromise of one must not yield the other.
- Evidence never goes to bring-your-own storage. The
  `GOOGLE_DRIVE` backend in `packages/storage-adapters` is for the person's
  own health documents; identity evidence stays in hosted storage under
  Mero Health's control, because we are accountable for the review.
- Access to the review queue is a distinct role, not a general admin power,
  and every read of an evidence image is logged.

## 5. Module boundaries

Per [`clinical-suite.md`](./clinical-suite.md), this is its own module and
declares its degradation.

```
packages/identity
  assurance levels, verification state machine, evidence lifecycle
packages/credentialing
  council registry, application state machine, review queue, badge rules
```

Both `degradesWith` rather than `requires`:

- If `identity` is `DOWN`, the product runs at `REGISTERED` and anything
  needing `IDENTITY_VERIFIED` shows `QUEUE_AND_RETRY` — the person submits and
  is told it will be reviewed shortly. Nobody is blocked from their own
  records.
- If `credentialing` is `DOWN`, already-verified clinicians keep working from
  their persisted badge (`READ_ONLY`); only new applications and re-checks
  pause.

**A clinician's verified badge must never be computed live from a service that
can fail** — an outage that silently unverifies practising clinicians would be
far worse than one that pauses new applications.
