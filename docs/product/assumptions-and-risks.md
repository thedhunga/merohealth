# Assumptions and high-risk decisions

## Assumptions

- The first release is a demonstration MVP using entirely fictional people and organizations.
- Nepal is the initial market, but no unverified jurisdictional rule is hard-coded.
- Expo SDK 57's supported OS range is acceptable for the first technical baseline, pending device research.
- English and Nepali Devanagari ship first; Romanized Nepali normalization is assistive and never silently changes stored patient language.
- External AI, video, payment, SMS, mapping, inventory, delivery, lab, and identity-verification services are mocks until separately configured and tested.
- “Complete repository” means architecture and ingestion/review capability for comprehensive coverage, not a claim that authoritative national data is currently loaded.

## Highest-risk decisions

1. **Clinical safety in mixed Nepali language.** Requires locally representative evaluation data and clinician review.
2. **Digital twin expectations.** Product language must prevent users and clinicians from treating incomplete/generated data as ground truth.
3. **Directory trust.** Nationwide completeness and freshness require authoritative partnerships and a staffed verification operation.
4. **Device coverage.** Expo SDK 57 requires iOS 16.4+, which may exclude older Apple devices; quantify before beta.
5. **Motion vs accessibility/performance.** Premium motion is progressive enhancement and must stay smooth on low-cost Android hardware.
6. **Training video operations.** Content needs localization, captioning, review, versioning, distribution, and update ownership—not one-off generated clips.
7. **Microservice timing.** Premature extraction increases privacy surface and failure modes. Extraction follows measured need.

