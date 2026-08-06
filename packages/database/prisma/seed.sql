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
