# Clinical safety policy

Status: demonstration policy requiring review and approval by Nepal-licensed clinicians before production.

## Control hierarchy

1. Deterministic rules and approved templates control emergency, self-harm, pregnancy, and pediatric escalation.
2. A model may help normalize language and extract candidate intake fields but cannot downgrade a deterministic risk result.
3. Retrieval only returns approved, current source records.
4. Generated content is structured, screened for prohibited behaviors, and rejected if citations do not resolve.
5. Saved or clinician-shared AI summaries are labeled machine-generated, editable, and require explicit consent; official notes require clinician verification.

## Required answer sections

General information; possible explanations framed as uncertainty; warning signs; safe actions now; when to consult; when to seek emergency care; sources. Medication answers do not prescribe, alter dosage, or recommend stopping clinician-prescribed medicine.

## Routing levels

`EMERGENCY_NOW`, `URGENT_SAME_DAY`, `CLINICIAN_RECOMMENDED`, `ROUTINE_SELF_CARE`, `PREVENTIVE_EDUCATION`, `MEDICATION_INFORMATION`, `MENTAL_HEALTH_CONCERN`, `MATERNAL_CONCERN`, and `PEDIATRIC_CONCERN`.

## Emergency behavior

Stop routine generation; display the approved Nepali/English template; state that the app cannot provide emergency care; advise contacting locally validated emergency services or reaching the nearest appropriate facility; offer a trusted-contact action only if configured; never invent a number, route, or nearby facility. Log rule ID, routing outcome, time, and correlation ID without raw message text.

## Quality gates

- Sensitivity targets and false-negative tolerances are set by clinical governance, not developers.
- Rule/template changes require version, reason, reviewer, effective date, rollback, and test cases.
- Citation failures fail closed into a transparent unavailable response.
- Safety incidents support severity, containment, evidence preservation, clinical review, corrective action, and regression tests.

