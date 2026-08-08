# Platform architecture — personal health record, assistant and interoperability

> Status: proposed. Supersedes the narrower "Nepali-first companion" framing in
> `system-architecture.md` by placing that companion inside a larger platform.
> Nothing here is built yet except the marketing surface and the existing
> domain packages.

## 1. What the product actually is

Mero Health is a **personal health platform** with a Nepali-first AI assistant
as its entry point, not a telehealth website. Six pillars:

1. **Personal EHR** — the person captures photographs of lab reports,
   prescriptions, discharge summaries and imaging, and gets back a structured,
   searchable, chronological health record.
2. **Storage choice** — the record lives either in the person's own Google
   Drive (bring-your-own) or in Mero Health hosted storage. Their choice,
   changeable, and a paid tier boundary.
3. **Provider interoperability** — doctors' offices and hospitals can connect,
   or import and export, so the record is portable rather than trapped.
4. **Wearables and sensors** — continuous device data joins the same record.
5. **Modular and metered** — the person pays for the modules they actually use.
6. **Nepali AI assistant** — accurate, grounded, safety-gated, and the reason
   someone opens the app on a day when nothing is wrong.

The Teladoc-equivalent marketing site (`apps/web`) is the **front door** to
this — acquisition, explanation, pricing and module catalogue. It is not the
product.

## 2. Sequencing, and why

The six pillars are not equally risky and must not be built in parallel.

| Tier | What ships | Why this order |
|---|---|---|
| 0 | Marketing site, pricing page, module catalogue | Cheap, needed for acquisition, already under way |
| 1 | **EHR capture + storage adapter** | The actual moat. Useful on day one even if the assistant is mediocre |
| 2 | **Assistant grounded on the person's own records** | Accuracy gets dramatically easier when answers are grounded in the user's real documents |
| 3 | Wearables (Health Connect / HealthKit) | Additive, well-specified vendor APIs, low unknowns |
| 4 | Provider export → shareable bundles → real FHIR interop | Depends on partnerships that take longer than code |

Entitlements and metering are threaded through from Tier 1. They are cheap to
design in now and a rewrite to retrofit.

**The key insight for Tier 2:** a general Nepali health chatbot is a commodity
and hard to make accurate. An assistant that can answer *"what did my creatinine
do over the last three tests?"* from the person's own uploaded reports is both
more valuable and **easier to make accurate**, because the answer is retrieval
over their documents rather than open-ended medical reasoning.

## 3. Bounded contexts

Existing packages stay. New ones follow the same extraction-ready pattern.

```
packages/
  clinical-safety      (exists)  deterministic emergency interception, refusal boundaries
  digital-twin         (exists)  becomes the derived summary over health-records
  care-directory       (exists)  provider and facility discovery
  localization         (exists)  ne / ne-Latn / en

  health-records       (new)  capture → extract → structured record → timeline
  storage-adapters     (new)  BYO Drive | hosted object storage, behind one port
  interop              (new)  FHIR R4 mapping, export bundles, access grants
  devices              (new)  wearable ingestion and normalisation
  entitlements         (new)  module catalogue, tiers, metering, feature gates
```

### 3.1 `storage-adapters` — the critical seam

One port, several adapters. Everything upstream is storage-agnostic.

```ts
interface HealthDocumentStore {
  put(doc: EncryptedDocument): Promise<StoredRef>;
  get(ref: StoredRef): Promise<EncryptedDocument>;
  list(scope: RecordScope): Promise<StoredRef[]>;
  delete(ref: StoredRef): Promise<void>;
  capabilities(): StoreCapabilities; // server-side OCR? versioning? offline?
}
```

Adapters: `HostedObjectStore` (S3/MinIO — already in `compose.yaml`),
`GoogleDriveStore` (user-owned, OAuth, app-scoped folder).

**Constraint that shapes the design:** consumer Google Drive carries no
business-associate agreement and Mero Health is not the controller of that
folder. So the Drive adapter must treat the file as **opaque and encrypted**,
with extraction happening on-device rather than server-side. That is not a
limitation to work around — it is the honest architecture for "your data, your
storage", and it is a genuine differentiator. Hosted storage is where
server-side processing, sharing and search are offered, which is also the
natural paid tier.

### 3.2 `health-records`

Capture pipeline: `image → de-skew/enhance → OCR (Devanagari + Latin) →
structure extraction → clinician-reviewable draft → confirmed record`.

Two properties are non-negotiable, and both already match this repo's stance:

- **Provenance on every fact.** A value is always traceable to the source
  document and the extraction run that produced it.
- **Nothing is asserted without confirmation.** Extraction produces a *draft*;
  the person confirms, corrects or skips. This is the pattern `digital-twin`
  already uses and it should not be abandoned under time pressure.

### 3.3 `interop` — be realistic about Nepal

There is no national health information exchange to plug into. FHIR R4 is the
right long-term target, but v1 that actually ships value is:

1. Export a record bundle as PDF + structured JSON.
2. A time-limited, revocable share link scoped to selected records.
3. A QR code a clinician can scan in the consultation room.

FHIR resources and hospital system connections come after, once there is a
partner who wants them. Modelling to FHIR internally from the start is still
worth it — it costs little and makes step 4 mechanical.

### 3.4 `entitlements`

Module catalogue with per-module tiers and metering. Gates must be enforced at
the API, never only in the UI. Metered dimensions worth defining now: documents
stored, OCR pages processed, assistant messages, device sync volume, share
links issued.

## 4. Risks that are actually hard

Listed honestly, worst first.

1. **Nepali clinical accuracy.** Frontier models are materially weaker in
   Nepali than English, and Nepali medical vocabulary is inconsistent between
   registers. Mitigation: ground answers in the user's documents and vetted
   sources with citations; keep `clinical-safety` interception deterministic
   and ahead of the model; refuse rather than guess. Do not describe the
   assistant as diagnostic.
2. **OCR on Devanagari medical documents.** Handwritten Nepali prescriptions
   are close to worst-case OCR. Expect a human-confirmation step to be
   permanent, not temporary.
3. **Regulation.** Nepal's Individual Privacy Act 2018 and Privacy Rules 2020
   cover health data; the Electronic Transactions Act applies too. Nepalis
   abroad pull in GDPR, and any US covered-entity relationship pulls in HIPAA.
   `docs/compliance/compliance-gap-register.md` is the right home for this.
4. **Storing health records raises the stakes on every other decision.** A
   demonstration companion that gives poor advice is embarrassing. A health
   record that leaks, or that a clinician relies on and is wrong, is not.

## 5. What this changes about work already in flight

- `apps/web` gains a pricing page, a module catalogue, and account/billing
  entry points. The Teladoc-equivalent IA still holds.
- `apps/mobile` becomes the capture surface — camera is already wired for the
  consultation preview and is the same capability needed for document capture.
- `apps/api` gains the record, storage, entitlement and interop modules.
- `packages/digital-twin` shifts from hand-entered facts to a derived view over
  `health-records`, keeping its confirmation and provenance semantics.
