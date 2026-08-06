# Swasthya Sathi product requirements

Status: MVP working specification. Medical, legal, and regulatory content requires qualified review before production.

## Product promise

Swasthya Sathi (स्वास्थ्य साथी) is a Nepali-first health companion for Android and iOS. It helps people understand what to do next, progressively organize a patient-controlled health profile, find verified care, and move safely into clinician-led services. It is not an autonomous diagnostic or prescribing system.

## Experience principles

1. **Guided, not chat-only.** Each conversation has an explicit purpose, progress, editable facts, and a next action.
2. **Designed, not generated.** Core journeys, safety copy, motion, illustrations, and training scripts are versioned product assets reviewed by humans. Generative output never invents UI, services, citations, or clinical policy.
3. **One fact at a time.** The digital twin grows through short consented steps. People can skip, correct, see provenance, and delete non-retained data.
4. **Safety interrupts flow.** Approved emergency templates replace routine conversation when a high-risk rule fires.
5. **Low-bandwidth by default.** Useful text and static fallbacks precede animation and video. Downloads are opt-in and resumable.
6. **Trust is visible.** Verified-provider status, source freshness, consent scope, AI uncertainty, and mock/demo status are always legible.

## Mobile platforms

- One React Native application delivered through Expo for Android and iOS.
- Minimum initial targets follow Expo SDK 57: Android 7+ and iOS 16.4+; market/device research may require lowering the iOS target through a supported SDK decision.
- Responsive web is a later distribution surface, not a substitute for native validation.
- Touch targets are at least 44×44 points, screens support text enlargement, keyboard/screen readers, dark/high-contrast themes, and reduced motion.

## MVP release slice

A patient can select a language, complete separately versioned consents, meet the guided companion, answer progressive health-profile prompts, ask a health question, trigger a deterministic safety escalation, review cited information from approved demonstration sources, find a fictional verified provider/facility, and see every material access or change in an audit trail.

Provider, pharmacy, and administration surfaces follow as web applications sharing the same contracts. Prescribing remains clinician-only. Payments, video, SMS, maps, inventory, lab connectivity, home nursing dispatch, and delivery use honest mock adapters until configured and tested.

## Health digital twin definition

The health digital twin is a patient-controlled, longitudinal representation of known health facts and care context. Every fact has a category, value, author/source, confidence state, verification state, effective date, sensitivity class, and consent/access policy. It must never masquerade as a biological simulation, diagnosis, predicted outcome, or complete medical record.

Initial domains: identity and demographics, emergency contacts, allergies, medicines, conditions, immunizations, measurements, documents, goals, accessibility preferences, care team, encounters, and provenance. Completion is contextual, never a coercive universal score.

## Care network repository

The directory supports hospitals, clinics, pharmacies, laboratories, doctors, specialists, home nurses, home sample collectors, emergency services, and future service types. Records distinguish claimed, imported, reviewed, verified, suspended, and retired states. Availability, prices, inventory, licenses, and service areas are time-bound assertions with provenance; stale assertions are never represented as real-time truth.

## Training content

Short task-based lessons cover onboarding, asking safely, building the health twin, consent sharing, booking care, prescriptions, pharmacy orders, emergencies, and privacy. Each video has Nepali/English captions, transcript, audio description metadata, poster image, downloadable low-bandwidth rendition, version, clinical/legal review status, and a non-video step-by-step equivalent.

## Success criteria

- At least 90% of usability-test participants complete the first companion step without help.
- Emergency test prompts route correctly with zero routine-response leakage.
- Users can identify what the assistant knows, where it came from, and how to correct it.
- Care search never displays unverified demo data as operational.
- Reduced-motion and low-bandwidth journeys remain complete.
- No critical accessibility, authorization, prescription, consent, or audit failures at release.

