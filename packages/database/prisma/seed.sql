-- Entirely fictional demonstration data. Never replace with patient production data.
INSERT INTO "Organization" ("id", "type", "name", "nameNe", "verification", "isFictionalDemo", "createdAt", "updatedAt") VALUES
  ('10000000-0000-4000-8000-000000000001', 'HOSPITAL', 'Sajilo Community Hospital — Demo', 'सजिलो सामुदायिक अस्पताल — नमुना', 'VERIFIED', true, now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'PHARMACY', 'Nawa Jeevan Pharmacy — Demo', 'नव जीवन फार्मेसी — नमुना', 'VERIFIED', true, now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "DirectoryEntity" ("id", "type", "name", "nameNe", "verification", "district", "municipality", "serviceData", "sourceLabel", "dataAsOf", "isFictionalDemo", "createdAt", "updatedAt") VALUES
  ('20000000-0000-4000-8000-000000000001', 'HOSPITAL', 'Sajilo Community Hospital — Demo', 'सजिलो सामुदायिक अस्पताल — नमुना', 'VERIFIED', 'Kathmandu', 'Kathmandu Metropolitan', '{"realTimeAvailability":false}', 'Fictional demonstration registry', '2026-07-15T00:00:00Z', true, now(), now()),
  ('20000000-0000-4000-8000-000000000002', 'PHARMACY', 'Nawa Jeevan Pharmacy — Demo', 'नव जीवन फार्मेसी — नमुना', 'VERIFIED', 'Lalitpur', 'Lalitpur Metropolitan', '{"homeService":true,"realTimeInventory":false}', 'Fictional demonstration registry', '2026-07-10T00:00:00Z', true, now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "FeatureFlag" ("id", "key", "description", "enabled", "rules", "createdAt", "updatedAt") VALUES
  ('30000000-0000-4000-8000-000000000001', 'real_payments', 'Production payment provider', false, '{}', now(), now()),
  ('30000000-0000-4000-8000-000000000002', 'authoritative_directory', 'Authoritative national directory ingestion', false, '{}', now(), now())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Plan" ("id", "code", "name", "audience", "pricing", "active", "createdAt", "updatedAt") VALUES
  ('40000000-0000-4000-8000-000000000001', 'patient-free-demo', 'Patient Free — Demo', 'PATIENT', '{"currency":"NPR","amount":0}', true, now(), now())
ON CONFLICT ("code") DO NOTHING;

-- One fictional owner, wired through every new personal-health-record table
-- so the migration is exercised by more than an empty schema. The reference
-- range and checksum below are illustrative demo values, not real patient
-- data — same "— Demo" convention as the rows above.
INSERT INTO "HealthDocument" ("id", "ownerId", "kind", "status", "storageBackend", "externalRef", "byteSize", "contentType", "checksumSha256", "title", "documentDate", "capturedAt", "sensitivity", "clientEncrypted", "pageCount", "createdAt", "updatedAt") VALUES
  ('50000000-0000-4000-8000-000000000001', 'demo-owner-fictional-001', 'LAB_REPORT', 'CONFIRMED', 'HOSTED', 'demo/health-documents/50000000-0000-4000-8000-000000000001.pdf', 482933, 'application/pdf', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85', 'Complete Blood Count — Demo', '2026-06-01T00:00:00Z', now(), 'STANDARD', false, 1, now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "HealthObservation" ("id", "documentId", "ownerId", "code", "codeSystem", "labelNe", "labelEn", "value", "unit", "referenceRange", "abnormalFlag", "effectiveAt", "status", "provenance", "confidence", "extractionRunId", "createdAt", "updatedAt") VALUES
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'demo-owner-fictional-001', 'LOCAL:HAEMOGLOBIN', 'LOCAL', 'हेमोग्लोबिन', 'Haemoglobin', '13.5', 'g/dL', '12.0-15.5', 'NORMAL', '2026-06-01T00:00:00Z', 'CONFIRMED', 'DOCUMENT_EXTRACTED', 0.94, 'demo-extraction-run-001', now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "DeviceSample" ("id", "ownerId", "kind", "source", "deviceLabel", "value", "unit", "recordedAt", "recordedUntil", "createdAt") VALUES
  ('70000000-0000-4000-8000-000000000001', 'demo-owner-fictional-001', 'STEPS', 'MANUAL', NULL, 6400, 'steps', '2026-06-01T00:00:00Z', '2026-06-01T23:59:59Z', now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Subscription" ("id", "ownerId", "tier", "status", "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt") VALUES
  ('80000000-0000-4000-8000-000000000001', 'demo-owner-fictional-001', 'FREE', 'ACTIVE', now(), NULL, now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "UsageCounter" ("id", "ownerId", "dimension", "period", "count", "updatedAt") VALUES
  ('90000000-0000-4000-8000-000000000001', 'demo-owner-fictional-001', 'DOCUMENTS_STORED', 'ALL_TIME', 1, now())
ON CONFLICT ("id") DO NOTHING;
