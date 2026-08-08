# Clinical suite — eClinicalWorks capability parity

> Status: proposed. Extends
> [`platform-vision.md`](./platform-vision.md) from a personal health platform
> to one a clinic or hospital can also run on.

## 1. Scope, honestly

eClinicalWorks is a ~25-year-old ambulatory EHR and practice-management suite
with thousands of engineers behind it. Reaching capability parity is a
multi-year programme, not a sprint. This document exists so the work is
sequenced correctly rather than started everywhere at once.

**Two things must be said before the feature list.**

First, a large share of what eCW does is **United States regulatory
machinery**: ONC certification, MIPS/MACRA quality reporting, X12 837/835
claim and remittance formats, EPCS for controlled substances, CMS eligibility
checks, US immunization registries. Reproducing those literally would be
building for the wrong market. The capability underneath each is usually real
and portable — quality reporting, claims, prescribing, eligibility — but the
*implementation* must be Nepali. Where a capability is purely a US regulatory
artefact, this document says so and skips it.

Second, the moment a clinician prescribes from Mero Health, or bills from it,
the product stops being a demonstration. Prescribing, dosing and billing carry
patient-safety and financial-liability weight that the current
"fictional data" posture does not cover. `docs/compliance/` must lead each of
those modules, not trail it.

## 2. Fault isolation — the governing constraint

The requirement is that any module can fail without taking the others down.
That is an architectural property, not something to retrofit, so it is defined
before the feature list.

### Rules

1. **A module owns its data.** Each gets its own schema namespace. No foreign
   keys across module boundaries — cross-module references are by opaque id,
   resolved through the owning module's port.
2. **No cross-module transactions.** If two modules must both change, the
   second is driven by an event with an outbox and idempotent handling. A
   scheduling write must never share a transaction with a billing write.
3. **Modules talk through ports and events, never through each other's
   internals.** A module may import another's *types*; never its repository,
   its client, or its tables.
4. **Every dependency declares its degradation.** A module states what it does
   when a dependency is unavailable, and the answer is never "throw".
5. **The shell renders around holes.** If billing is down, the chart still
   opens. Navigation hides or disables what is unavailable and says why.
6. **Timeouts and circuit breakers on every outbound call.** A slow lab
   interface must not exhaust the request pool and take scheduling with it.

### The contract

```ts
type Degradation =
  | 'HIDE'             // remove the surface entirely; nothing else notices
  | 'READ_ONLY'        // serve persisted data, refuse writes
  | 'QUEUE_AND_RETRY'  // accept the write, deliver later, tell the user
  | 'MANUAL';          // offer the offline path (print, phone, paper)

interface ModuleDescriptor {
  key: ClinicalModuleKey;
  /** Absent → this module cannot run at all. Keep this list near-empty. */
  requires: readonly ClinicalModuleKey[];
  /** Absent → this module still runs, with the stated degradation. */
  degradesWith: readonly Array<{ key: ClinicalModuleKey; mode: Degradation }>;
  health(): Promise<{ status: 'UP' | 'DEGRADED' | 'DOWN'; detail?: string }>;
}
```

`requires` is the dangerous field. Every entry is a way for one outage to
become two, so adding one should need a justification in review. Most
"requirements" are really `degradesWith`.

**Worked example.** Prescribing depends on the drug database for interaction
checking. If that is `DOWN`, prescribing does not stop — it switches to
`MANUAL`: the interaction panel shows an explicit "checks unavailable, verify
manually" state, the prescription records that it was written without
automated checking, and the audit log captures it. That is safer than a dead
screen, and honest about what was and was not checked.

## 3. Capability map

| # | eCW capability | Mero Health module | Notes |
|---|---|---|---|
| 1 | Patient registration, demographics | `patient-registry` | Foundation. Owns identity; others reference by id only. |
| 2 | Scheduling, resource calendars | `scheduling` | Degrades to `READ_ONLY` without the registry. |
| 3 | Charting, SOAP notes, templates | `clinical-charting` | Core EHR surface. Consumes `health-records`. |
| 4 | Problem list, allergies, medications | `clinical-summary` | Extends `digital-twin` with clinician provenance. |
| 5 | Drug interaction / allergy checking | `medication-safety` | Built *before* prescribing, so prescribing can degrade against it. |
| 6 | ePrescribing | `prescribing` | Nepali formulary, not US EPCS. Safety-critical. |
| 7 | Lab and imaging orders + results | `diagnostics-orders` | HL7 v2 where partners speak it; manual entry where they do not. |
| 8 | Patient portal | `apps/web` + `apps/mobile` | Mero Health leads here — the portal *is* the product. |
| 9 | Telehealth | `teleconsultation` | WebRTC. Already stubbed in `apps/mobile`. |
| 10 | Billing, claims, revenue cycle | `billing` | Nepal: cash, insurance boards, NHIF. **Not** X12. |
| 11 | Eligibility / insurance verification | `coverage` | Blocked on Nepali insurer interfaces that do not yet exist. |
| 12 | Referral management | `referrals` | Pairs with `care-directory`. |
| 13 | Population health, registries, recall | `population-health` | Reads from other modules; never writes to them. |
| 14 | Analytics and dashboards | `analytics` | Read-only replica. Must never slow the clinical path. |
| 15 | Patient messaging, reminders | `engagement` | SMS/WhatsApp. `QUEUE_AND_RETRY` by nature. |
| 16 | Document management, scanning | `health-records` | Already built. Mero Health leads here too. |
| 17 | Interoperability, CCDA, HL7, FHIR | `interop` | Already queued in the platform vision. |
| 18 | Immunization records | `immunization` | Nepal EPI schedule, not US registries. |
| 19 | Quality reporting | `quality-reporting` | Nepal DoHS/HMIS indicators, **not** MIPS. |
| 20 | Multi-site, role-based access | `tenancy` | Cuts across everything; design early, build late. |

**Deliberately skipped as US-only regulatory artefacts:** ONC certification
criteria, MIPS/MACRA scoring, X12 EDI transaction sets, EPCS, DEA validation,
US payer clearinghouses. Revisit only if Mero Health enters the US market,
which is a different company.

## 4. Sequencing

Modules 1–4 are the smallest thing a clinic can actually use: register a
patient, book them, chart the visit, maintain their problem list. Nothing
before module 5 touches prescribing, where the safety and regulatory burden
begins in earnest.

Build order is the table order. Each module ships with its `ModuleDescriptor`,
a health endpoint, and a test proving the system still works with that module
forced `DOWN`. **That test is the deliverable**, not a nice-to-have — it is
the only thing that keeps the isolation property true as the suite grows.
