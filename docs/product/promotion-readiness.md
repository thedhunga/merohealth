# Promotion readiness

The first public release is a product demonstration with fictional data. Promotion may invite testers to explore the concept, but must not claim diagnosis, nationwide coverage, clinical validation, emergency response, or guaranteed provider availability.

## Gate A - public fictional-data demonstration

Closing this gate is also what should decide whether `robots` stops emitting
`noindex`. Today that flip is wired to a single code signal:
`apps/web/src/app/robots.ts` and every page's metadata both key off
`isDemonstrationBuild` (`apps/web/src/lib/seo.ts`), which is
`packages/configuration`'s `legalEntity.registrationId` leaving `null`.
Registering a real legal entity is the one change that reopens indexing in
code — but the registration id alone does not make indexing appropriate.
Everything below has to be true first, starting with these four:

- [ ] Every piece of copy touching clinical content has been reviewed by a
      qualified Nepali-licensed clinician, not drafted and published
      unreviewed.
- [ ] Every quantitative claim in public copy (user counts, outcomes,
      coverage, savings) is a substantiated figure with a recorded source. An
      unsubstantiated figure is removed, never rounded or hedged into
      publishing anyway — the same invent-no-facts rule the build ledger
      holds everywhere else applies to marketing copy too.
- [ ] The footer's demonstration notice (`footer.demoNotice`) is removed only
      once no fictional provider, testimonial, or facility record remains
      anywhere in the build being indexed — not merely once the legal entity
      is registered. Registering the entity and clearing the notice are two
      separate facts and both must hold.
- [ ] `packages/configuration`'s `legalEntity` carries a real registered
      address, not just a non-null `registrationId` — the current
      `displayName` placeholder (`"Demonstration entity — configure before
      launch"`) and the absence of any address field are both signals this
      has not happened yet.

- [ ] Brand name, logo, copy, and domain ownership approved.
- [ ] Privacy notice and terms for the demonstration published and reviewed by counsel.
- [ ] Every data-entry surface says not to enter real patient information.
- [ ] Fictional provider and facility records are visibly labeled.
- [ ] Emergency limitations and local emergency instructions are visible and tested.
- [ ] Accessibility, reduced-motion, low-bandwidth, and target-device QA completed.
- [ ] Analytics collect the minimum necessary data and exclude free-text health content.
- [ ] Security headers, dependency review, abuse contact, and vulnerability-reporting process active.
- [ ] Support inbox, feedback workflow, uptime monitor, and incident owner active.
- [ ] Marketing screenshots and videos match the released build and use fictional identities.

## Gate B - required for patient data

- [ ] Named clinical safety officer, data protection owner, security owner, and incident commander.
- [ ] Nepal-specific legal, medical-device, telemedicine, pharmacy, laboratory, consumer, and data-protection analysis completed by qualified counsel and regulators where required.
- [ ] Data map, lawful basis/consent model, retention schedule, deletion/export workflow, and cross-border transfer assessment approved.
- [ ] Threat model remediated; independent penetration test and mobile security review completed.
- [ ] Production identity, MFA/passkeys, role and attribute controls, session revocation, and privileged-access review tested.
- [ ] Encryption, managed secrets, key rotation, immutable audit trail, backup restore, disaster recovery, monitoring, alerting, and breach response exercised.
- [ ] Clinical content provenance, versioning, qualified review, expiry, rollback, translation review, and safety-case evidence operational.
- [ ] AI companion restricted to approved capabilities; deterministic emergency interception, citation/provenance checks, hallucination and bias evaluation, human escalation, logging redaction, and kill switch verified.
- [ ] Digital twin changes require provenance, user confirmation, correction, revocation, and purpose-bound sharing.
- [ ] Provider/facility/pharmacy directory has authoritative sources, credential verification, freshness SLAs, correction workflow, deduplication, and geographic coverage labels.
- [ ] Age, guardian, safeguarding, abuse, self-harm, and vulnerable-user policies reviewed and tested.
- [ ] Clinical incident, complaint, recall, content correction, and post-market monitoring workflows exercised.
- [ ] Vendor agreements, subprocessors, service levels, insurance, and business-continuity dependencies approved.

## Gate C - transactions and remote care

- [ ] Provider onboarding, licensing, scope-of-practice, credential expiry, and disciplinary-status checks operational.
- [ ] Booking, consent, identity verification, clinical documentation, handoff, and failed-call paths tested.
- [ ] Prescription workflows require authorized prescriber signatures, allergy/interaction safeguards, pharmacist review, auditability, and jurisdictional approval.
- [ ] Pharmacy, laboratory, home nursing, delivery, refund, reconciliation, and adverse-event workflows contract-tested with approved partners.
- [ ] Payment handling minimizes card-data scope; disputes, refunds, receipts, taxes, and reconciliation are operational.
- [ ] Load, resilience, recovery-time, recovery-point, and failover objectives demonstrated.

## Promotion sequence

1. Internal usability testing with synthetic personas.
2. Invite-only design-partner testing under a written test protocol.
3. Public fictional-data demonstration with an honest waitlist.
4. Limited regional pilot after Gate B approval, with capped enrollment and human support.
5. Transactional and clinical modules only after Gate C approval.
6. Broader promotion after measured safety, accessibility, reliability, and retention targets are met.

Each gate needs dated evidence and accountable sign-off. A checked box without linked evidence is not approval.
