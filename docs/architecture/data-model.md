# Data model

The canonical store is PostgreSQL. UUID primary keys, UTC timestamps, optimistic `version` fields, explicit lifecycle enums, and immutable history records are used. Soft deletion is restricted to records whose legal/audit value permits it.

```mermaid
erDiagram
  USER ||--o| PATIENT_PROFILE : owns
  USER ||--o{ CONSENT : grants
  PATIENT_PROFILE ||--o{ TWIN_FACT : contains
  TWIN_FACT ||--o{ TWIN_FACT_REVISION : versions
  PATIENT_PROFILE ||--o{ ACCESS_GRANT : controls
  ORGANIZATION ||--o{ LOCATION : operates
  ORGANIZATION ||--o{ SERVICE_OFFERING : offers
  PRACTITIONER ||--o{ PRACTITIONER_ROLE : holds
  ORGANIZATION ||--o{ PRACTITIONER_ROLE : engages
  PRACTITIONER_ROLE ||--o{ CREDENTIAL_ASSERTION : evidenced_by
  PATIENT_PROFILE ||--o{ APPOINTMENT : books
  PRACTITIONER_ROLE ||--o{ APPOINTMENT : serves
  APPOINTMENT ||--o| ENCOUNTER : becomes
  ENCOUNTER ||--o{ PRESCRIPTION : creates
  PRESCRIPTION ||--o{ PRESCRIPTION_ITEM : contains
  PRESCRIPTION ||--o{ PHARMACY_ORDER : authorizes
  USER ||--o{ AUDIT_EVENT : acts
```

## Twin fact envelope

Every fact stores `kind`, structured `value`, sensitivity, provenance type and identifier, recorded/effective timestamps, verification status, patient confirmation, supersession link, and policy tags. Clinical assertions authored by clinicians cannot be silently overwritten; patients request correction or add context.

FHIR R4 mapping is pragmatic: PatientProfile→Patient, Practitioner→Practitioner, PractitionerRole→PractitionerRole, Organization/Location, Appointment, Encounter, TwinFact subtypes→Observation/Condition/AllergyIntolerance/MedicationStatement, Prescription→MedicationRequest, Consent, Document→DocumentReference, and AuditEvent. Platform verification, directory freshness, companion progress, and entitlement fields are extensions. This is not a claim of full FHIR conformance.

## Directory model

`DirectoryEntity` provides a stable identity and type. Separate Organization, Location, Practitioner, PractitionerRole, ServiceOffering, CoverageArea, Schedule, CredentialAssertion, VerificationReview, SourceRecord, and DirectoryChangeRequest records prevent the common error of flattening a doctor, their role, and a facility into one record.

## Future services

Each new domain owns its tables and publishes stable events such as `appointment.booked.v1`, `twin.fact-confirmed.v1`, `prescription.signed.v1`, and `directory.entity-verified.v1`. Event payloads carry minimum necessary data and schema versions.

