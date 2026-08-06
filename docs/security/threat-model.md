# Threat model

Method: STRIDE with health-data harm analysis. This is an engineering baseline, not a completed penetration test or legal certification.

| Threat | Primary controls | Release evidence |
|---|---|---|
| Account takeover | passkeys/strong auth port, MFA, rate limits, risk events, secure recovery | auth abuse tests |
| Cross-patient access | deny-by-default RBAC + consent + relationship checks, object-level guards | authorization matrix tests |
| Malicious staff access | least privilege, just-in-time elevation, no casual impersonation, immutable audit | admin access review |
| Prompt injection | instructions isolated from retrieved content, tool allowlists, deterministic safety policy, output validation | adversarial safety dataset |
| Citation fabrication | approved registry IDs required; unknown/expired citations reject the answer | citation validator tests |
| Unsafe saved inference | explicit preview and consent before saving generated facts; provenance retained | twin consent tests |
| Directory fraud/staleness | evidence-backed verification, expiry, maker-checker review, visible freshness | directory workflow tests |
| Prescription abuse | verified clinician role, step-up auth/signature, immutable amendments, pharmacy validation | authorization/state tests |
| Sensitive log leakage | structured allowlist logging, redaction tests, payload size limits | log snapshot tests |
| Uploaded malware | type/size checks, quarantine, scan-provider port, signed URLs | upload validation tests |
| Mobile token theft | OS secure storage, rotating sessions, device revocation, no secrets in app bundle | mobile security review |
| Video enumeration | server-authorized participants, expiring join tokens, no public room URLs | adapter contract tests |

## Data handling

- TLS is mandatory outside local development; production databases and object storage require managed encryption at rest.
- Secrets come from a secret manager, never source control or client configuration.
- Ordinary logs exclude conversation text, document content, full prescriptions, tokens, passwords, and payment data.
- Analytics events use pseudonymous identifiers and coarse clinical-free dimensions.
- Backups are encrypted, access-controlled, restoration-tested, and subject to retention policy.

## Open work

External penetration testing, privacy impact assessment, mobile binary hardening, vendor security reviews, production key-management design, disaster-recovery exercises, and Nepal-specific data-hosting/cross-border review are release blockers.

