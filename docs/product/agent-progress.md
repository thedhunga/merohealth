# Autonomous build ledger

A scheduled cloud agent works through this file. Each run starts with **zero
memory of previous runs**, so this document is the only continuity between
them. Read it first, do one task, update it last.

## Working agreement

1. Work on the branch `mero-health/platform-foundation`. Never commit to
   `main`, and never merge.
2. Take **the first unchecked task** in the queue below. One task per run.
   Do not start a second task, even if the first was quick.
3. Before committing, all of these must pass from the repository root:
   `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`,
   `pnpm test`, `pnpm build`.
4. If a task cannot be completed, leave it unchecked, write what blocked it
   in the log, commit whatever is genuinely finished and stop. Do not fake
   completion, and do not weaken a test to make it pass.
5. Tick the task, append a log entry, commit, and push.

## Standing constraints

These hold for every task and override any instinct to the contrary.

- **Nepali first.** Nepali is the default locale and is served from the bare
  path; English lives under `/en`. Every user-visible string goes in both
  `apps/web/messages/ne.json` and `en.json` — never hardcode copy in a
  component.
- **Invent no facts.** No statistics, partner names, clinical claims,
  testimonials or credentials that are not already in the repo. Placeholders
  must read as placeholders. This is a health product; a fabricated figure is
  worse than an empty slot.
- **Never weaken the safety layer.** `packages/clinical-safety` runs its
  deterministic interception before any model call. Do not route around it.
- **Only trusted observations are reasoned over.** `CONFIRMED` and
  `CORRECTED` only — a `DRAFT` extraction must never reach the assistant, a
  share link or an export. See `packages/health-records`.
- **Bring-your-own storage stays opaque.** Documents bound for a backend we do
  not control must be client-encrypted; extraction for those runs on-device.
  See `packages/storage-adapters`.
- Match the surrounding code: dense TypeScript, colocated `index.test.ts`,
  comments that explain *why* rather than restating the code.

## Art direction — do not drift from this

The visual identity was set deliberately. Every new page inherits it.

- **Palette:** deep forest (`forest-700` `#0B4F3A`) as a confident full-bleed
  ground, jade for interaction, **marigold `#F4A62A`** as the accent — सयपत्री,
  in every Nepali festival doorway. Warm paper `#FFFCF7` base, never a grey or
  greenish white. Tokens live in `apps/web/src/styles/globals.css` and are
  mirrored in `packages/configuration`. **Never reintroduce the old teal
  `#0B685C`, and never add a health-tech blue** — every competitor uses one,
  which is the reason we do not.
- **Marigold is for one action per screen.** It is the loudest thing in the
  palette; spend it once. Never on body text.
- **Type:** Martel (display, 800/900) and Mukta (body). Both Devanagari-native
  so Nepali leads the type system. Do not add Inter, Noto Sans, or a third
  family.
- **Never set a `leading-*` utility on a heading.** The base layer sets 1.12
  for Latin and 1.34 for `:lang(ne)`; a utility wins over both and clips
  Devanagari matras at display sizes.
- **Show, don't tell.** Prefer artwork, diagram or photograph over another
  paragraph. Copy should be short; the page should carry meaning visually.
  Aim for at most one short paragraph per section.
- **Never render text as an image.** It is invisible to search, unreadable by
  screen readers and untranslatable, which would break the ne/en toggle.
  Visual weight comes from artwork *around* the text, not from replacing it.
- **The signature** is oversized Devanagari set as artwork (`.script-mark`),
  always `aria-hidden` and always paired with a real heading elsewhere in the
  section. Use it sparingly — roughly one per page, or it stops being a
  signature.
- SVG artwork lives in `apps/web/src/components/art/`. See `RecordTransform`
  for the standard: `aria-hidden`, no fake lettering, and it must survive
  being scaled down to a phone.

## Context

Mero Health is a personal health platform, not a telehealth website. The
architecture and its sequencing are in
[`docs/architecture/platform-vision.md`](../architecture/platform-vision.md) —
read that before the first task.

- `apps/web` — Next.js 16 marketing site, the public front door
- `apps/mobile` — Expo app, the product surface, ships to Android and iOS
- `apps/api` — NestJS
- `packages/*` — extraction-ready domain packages

## Task queue

Tasks are ordered. Later ones assume earlier ones are done.

### Visual system — highest priority

The owner's verdict on the first pass was that it looked terrible and generic.
The palette, type and hero have since been rebuilt (see Art direction). These
tasks extend that identity to everything else. **Do these before adding new
routes** — new pages built on a half-finished visual system just multiply the
work.

- [x] Editorial SVG artwork for all six service cards in
      `apps/web/src/components/art/`, replacing the small lucide icon chips.
      Each should be a distinct small composition in the brand palette, not a
      recoloured icon. This is the single biggest visual upgrade left.
- [x] Rework the organisation section: full-bleed forest ground, artwork per
      tab, and stat slots that look deliberate while the figures are still
      em-dashes.
- [x] Give the header and mega-menu the new identity — the panel is still
      styled from the old system and now feels bolted on.
- [x] A reusable `SectionIntro` + artwork layout so every inner page opens with
      a visual rather than a wall of text.
- [x] Responsive audit at 375px, 768px and 1280px. The oversized `.script-mark`
      and the hero grid are the likely breakages.
- [x] Sync the Expo app to the new palette: `apps/mobile/app/index.web.tsx` and
      the tab screens still use the old teal styling directly rather than
      `@swasthya/configuration` tokens.

### Marketing site

- [x] Shared page templates: a hero/section/CTA template pair for condition
      pages and segment pages, so the ~35 remaining routes are content, not
      bespoke layout.
- [x] Individuals routes: `24-7-care`, `primary-care`, `mental-health`,
      `weight-management`, `diabetes-management`, `hypertension-management`,
      `specialty-wellness`, plus the nested `nutrition`,
      `diabetes-prevention`, `dermatology`, `expert-medical-opinion`, `sleep`.
- [x] Individuals utility routes: `how-it-works`, `without-insurance`, `faqs`
      (with FAQ schema.org markup).
- [x] Organizations routes: `employers`, `health-plans`,
      `hospitals-health-systems`, `our-approach`, `partners`,
      `resource-center`, `events`.
- [x] Clinicians routes: `our-providers`, `clinical-leadership`, `careers`,
      `commitment-to-quality`.
- [x] Company routes: `about`, `about/impact`, `about/leadership`, `careers`,
      `newsroom`, `contact`.
- [x] Legal routes: `legal`, `legal/privacy`, `legal/community-guidelines`,
      `accessibility`, `help`.
- [x] Health library: index plus article route, with a typed content model.
- [x] Pricing page driven by `packages/entitlements` — the catalogue is the
      source of truth, so prices are never duplicated into copy.
- [x] `sitemap.ts`, `robots.ts`, per-route `generateMetadata`, and
      `Organization` + `WebSite` structured data. Keep `robots` set to
      noindex while the demonstration notice is still shown.
- [x] Accessibility pass: heading order, landmarks, focus traps in the mobile
      drawer, contrast, and a keyboard walkthrough of the mega-menu.

### Platform core

- [x] `apps/api`: records module exposing capture, list, timeline and
      confirm/correct/reject endpoints over `packages/health-records`, with
      the storage port injected.
- [x] `apps/api`: entitlement guard enforcing `checkModule` and `checkQuota`
      at the route boundary. A UI-only gate is not a gate.
- [x] Prisma schema for `HealthDocument`, `HealthObservation`, `DeviceSample`,
      `Subscription` and usage counters, plus a migration and seed data.
- [x] Hosted storage adapter against the MinIO service already in
      `compose.yaml`, implementing `HealthDocumentStore`.
- [x] Google Drive adapter: OAuth, an app-scoped folder, and client-side
      encryption so stored bytes stay opaque to the server.
- [x] `packages/interop`: FHIR R4 mapping for documents and observations, a
      record export bundle (PDF + JSON), and a revocable, time-limited share
      link.
- [x] `packages/devices`: normalisation for Health Connect and HealthKit
      samples into `DeviceSample`.
- [x] `apps/mobile`: document capture flow — camera, review, upload, and the
      confirmation queue driven by `pendingConfirmations`.

### Photography wiring

Prompts and exact filenames are in
[`asset-brief.md`](./asset-brief.md). The owner is generating these
externally with Veo and ChatGPT.

**Only start this once files actually exist in `apps/web/public/`.** Check
first; if the directory is still empty, skip to the next unchecked task rather
than building slots for files that are not there.

- [ ] Add an `EditorialImage` component that takes a `src` and an SVG
      `fallback`, renders `next/image` when the file exists and the artwork
      when it does not. **A missing asset must degrade to the existing SVG,
      never to a broken image** — the site has to stay shippable whether or
      not the photography has landed.
- [ ] Wire the testimonial portraits, then the organisation tabs, then the
      condition-page heroes, in that order of visual payoff.
- [ ] Wire the hero and story videos. Both are silent and must carry a poster
      frame; autoplay only ever muted, and never for the story film, which is
      user-initiated.
- [ ] Confirm every generated photograph still sits inside its existing
      fictional-example labelling. Synthetic faces beside testimonials are
      fine while labelled; presenting one as a real patient is not.

### Identity and professional credentialing

Design in
[`docs/architecture/identity-and-credentialing.md`](../architecture/identity-and-credentialing.md).
Read it first — it contains one decision that must not be quietly reversed:
**a national ID is never required to sign up.** Identity is verified at the
point it is actually needed, and the person is told why at that moment.
Patients are the primary interface; clinicians are a clearly-marked tab.

- [ ] `packages/identity`: assurance levels
      (`ANONYMOUS` → `REGISTERED` → `IDENTITY_VERIFIED`), the verification
      state machine, and the evidence lifecycle — including deletion of the
      document image once the decision is recorded.
- [ ] `packages/credentialing`: Nepali council registry (NMC, NNC, NHPC,
      Pharmacy, Ayurvedic), application state machine, review queue and badge
      rules. **No automatic approval** — there is no public council API, so a
      human reads the register. Never render "verified" for a submission no
      person has reviewed.
- [ ] Clinician registration flow on `apps/web`: council selection,
      registration number, certificate and ID capture, and a clear status
      screen while the application is pending.
- [ ] Reviewer queue: a distinct role, not a general admin power, with every
      evidence-image read logged and every decision attributed.
- [ ] Verified badge component stating **which council, which number, when
      last checked** — never "trusted doctor". Must render from the persisted
      badge, never computed live from a service that can fail.

### Clinical suite — eClinicalWorks parity

Full capability map and the fault-isolation contract are in
[`docs/architecture/clinical-suite.md`](../architecture/clinical-suite.md).
Read it before starting anything in this section. Build strictly in order.

**Every module here ships with three things or it is not done:** its
`ModuleDescriptor`, a health endpoint, and a test that forces the module
`DOWN` and asserts the rest of the system still works. That last test is the
deliverable — it is the only thing keeping the isolation property true as the
suite grows. A module that "works" but has no outage test is not finished.

- [ ] `packages/module-registry`: the `ModuleDescriptor` / `Degradation`
      contract, a registry, and a resolver computing what is available given a
      set of module health states. Build this first — everything below plugs
      into it, and retrofitting it later means touching every module.
- [ ] `patient-registry`: demographics and identity. Owns patient identity;
      every other module references by opaque id, never by foreign key.
- [ ] `scheduling`: appointments and resource calendars. Degrades to
      `READ_ONLY` when the registry is unavailable rather than failing.
- [ ] `clinical-charting`: encounters, SOAP notes, templates.
- [ ] `clinical-summary`: problem list, allergies, medications — extending
      `digital-twin` with clinician-authored provenance.
- [ ] `medication-safety`: interaction and allergy checking. Built **before**
      prescribing, so prescribing degrades to `MANUAL` against it rather than
      depending on it.
- [ ] `prescribing`: Nepali formulary. Safety-critical — `docs/compliance/`
      must lead this module, not trail it.

Stop after prescribing and reassess. Modules 7-20 in the capability map are
sequenced but must not be started while anything above is unfinished.

## Log

Newest first. One entry per run: date, task, outcome, and anything the next
run needs to know.

- 2026-08-09 — Built `apps/mobile`'s document capture flow: camera → review →
  upload → confirmation queue. Closes out "Platform core" entirely — the
  queue moves to "Photography wiring" next, which is gated on asset files
  that don't exist yet (see that section's own note).

  **First task to give `apps/mobile` a real backend client.** Grepped first
  and confirmed nothing in the app had ever called `apps/api`'s records
  module — the only existing HTTP call anywhere in the app was
  `(tabs)/companion.tsx`'s one-off `fetch` to `/v1/companion/research`. New
  `src/lib/records-api.ts` is a thin typed wrapper (`captureDocument`,
  `listDocuments`, `listDocumentObservations`, `listTimeline`,
  `confirm`/`correct`/`rejectObservation`) over exactly the six endpoints
  `records.controller.ts` already exposes — deliberately not a generic HTTP
  client, since there is nothing else to generalize for yet. Reused
  `companion.tsx`'s own `EXPO_PUBLIC_API_URL` / same-origin-`/api/...`
  fallback convention rather than inventing a second one; that fallback path
  isn't actually served anywhere yet (companion's isn't either), so a bare
  `expo start` with no API configured will 404 on either — an existing,
  named gap, not a new one. `RecordsApiError` carries the entitlements
  guard's `code`/`upgradeTo` forward specifically so the capture screen can
  show "you've hit your plan limit" instead of a generic failure — the guard
  run's whole point was returning a verdict instead of a flat 403, and a
  client that swallows that distinction would waste it.

  **`pendingConfirmations` driving the queue, taken literally, exposed a real
  API gap: there is no "all observations for an owner" endpoint, only
  per-document.** `listPendingConfirmations(ownerId)` fetches the owner's
  documents, then fetches each document's observations, flattens, and hands
  the result to `@swasthya/health-records`' own `pendingConfirmations` —
  worst-confidence first, exactly as that function already promises. This is
  a real N+1 against the API. Documented rather than hidden, on the same
  "reference implementation, revisit if it matters" basis the MinIO adapter's
  own `list()` N+1 already set — a bulk endpoint is a straightforward future
  addition to `records.controller.ts`, not a design change here.

  **Honest about what the queue will actually show today: nothing.** No
  extraction pipeline exists anywhere in this repo (the records-module run
  named this explicitly), so every captured document lands `STORED` with
  zero observations — the confirmation queue is correctly wired but will
  render its empty state on every real run until extraction exists. The
  empty-state copy says exactly that ("appears here once a document has been
  processed") rather than any wording that implies the feature is broken or
  the queue is decorative — an honest empty state, not a fabricated demo
  queue, per the standing "invent nothing" constraint.

  **No identity/auth layer still means no real owner identity — named again,
  handled the same conservative way `apps/api` runs have handled it.** Added
  `ownerId` to `AppStateProvider`, generated once per app launch via new
  `src/lib/local-id.ts` (`Math.random`-based, explicitly not a persistent
  account id — doc comment explains why `crypto.randomUUID` and
  `node:crypto` were both rejected, the same Metro-bundling constraint
  `packages/devices` hit). This matches every other piece of `AppStateProvider`
  state (`facts`, `skippedPrompts`): none of it persists across a relaunch
  today, so a documents captured in one session are orphaned from a fresh
  one. That is a real, known limitation worth a future run's attention (some
  minimal persistence — `expo-secure-store` or even `AsyncStorage` — the
  moment there's an actual account to persist), not something this task
  could fix without inventing an auth system nowhere on this queue yet.

  **Camera capture built on `expo-camera` alone, no new native dependency.**
  `consultation.tsx` already wired `expo-camera` for a live video *preview*
  only (no `takePictureAsync`, no `ref`); this run is the first still-photo
  capture in the app. Checked the installed `expo-camera@57` types directly
  (`CameraView.takePictureAsync(options?): Promise<CameraCapturedPicture>`,
  with a `base64` option) before writing the screen — that alone covers
  camera → JPEG → base64 with no `expo-image-picker` or `expo-file-system`
  addition, so `apps/mobile/package.json` gained exactly one new dependency
  (`@swasthya/health-records`, workspace), not four. Updated
  `app.json`'s `expo-camera` plugin `cameraPermission` string to name both
  uses now that the one OS-level camera permission covers the consultation
  preview and document capture — the string is user-facing rationale text,
  and leaving it consultation-only would have made it inaccurate rather than
  merely incomplete.

  **New pure, colocated-tested modules** (`src/lib/`, no rendering involved —
  this app has no DOM/React Native testing harness configured, so, matching
  the accessibility-pass run's own precedent for `focusTrap.ts`, logic that
  needs testing was kept in plain functions and verified with vitest
  directly): `local-id.ts`, `document-kinds.ts` (a `Record` keyed by every
  `HealthDocumentKind` so a kind added upstream without a label is a compile
  error, same exhaustiveness discipline `packages/devices` used for its
  record-type switch), `records-api.ts`. 10 new tests across three files —
  `records-api.test.ts` mocks `global.fetch` via `vi.stubGlobal` (no such
  pattern existed anywhere in this repo before; grepped first to confirm),
  covering the `EXPO_PUBLIC_API_URL` branch, the entitlements-guard error
  shape, and the N+1 aggregation actually sorting worst-confidence-first
  across two documents.

  **New screens** `app/capture.tsx` (camera → review → upload, all one
  screen/component with local step state rather than three routes passing a
  captured photo's base64 through router params, which expo-router's
  string-based params are a poor fit for) and `app/records.tsx` (the
  confirmation queue plus the existing `buildTimeline` output, since a
  document list with nothing to view it on would be its own gap). Both
  reachable from a new `ActionCard` on `(tabs)/index.tsx` ("कागजातहरू" /
  "Documents") — added one localization key (`documents`) to
  `packages/localization`'s flat `copy` object, matching how every other
  short/reused mobile label already gets translated there; everything else
  in both new screens is inline `language === 'en' ? … : …` ternary copy,
  matching `companion.tsx`/`twin.tsx`'s existing convention exactly (this
  app has no `next-intl`/per-namespace message-file setup — confirmed by the
  same explore pass that found the `copy` object in the first place — so the
  web app's "every string in `ne.json`/`en.json`" rule has no mobile
  equivalent to follow yet).

  **Verified past the unit tests:** `pnpm build`'s `expo export --platform
  web` actually compiled and statically rendered both new routes
  (`dist/capture.html`, `dist/records.html`, plus the updated
  `dist/(tabs)/index.html`) — grepped the exported HTML directly for the
  screens' real Nepali copy ("कागजातको फोटो खिच्नुहोस्", "मेरा कागजातहरू",
  the new action card's "कागजातहरू" + its subtitle) and confirmed no
  error-boundary markers, rather than trusting that `tsc --noEmit` passing
  meant the screens actually render. No live device/simulator was available
  in this environment to test the camera permission flow or a real
  `takePictureAsync` call end to end — that remains unverified beyond the
  type-level contract with `expo-camera`'s own `.d.ts` files, worth a future
  run's attention the first time a simulator is available.

  Verified: `pnpm install` (new workspace dependency,
  `@swasthya/health-records` added to `apps/mobile` — confirmed
  `--frozen-lockfile` passes clean afterward), `pnpm lint`, `pnpm typecheck`
  (confirmed `.toSorted()` inside `health-records`' source type-checks
  cleanly when pulled in through `apps/mobile`'s own `ESNext`-lib tsconfig,
  since the `react-native` export condition resolves that package straight
  to its `.ts` source rather than a prebuilt `.d.ts`), `pnpm test` (`apps/api`
  and `apps/mobile` — the two packages the ledger already flagged as
  possibly affected — plus all 26 turbo test tasks green; `@swasthya/mobile`
  contributing 10 new tests from zero), `pnpm build`, all green.

  **For the next run:** "Platform core" is now fully checked. The queue's
  next unchecked section is "Photography wiring" — its own header says not
  to start until files actually exist in `apps/web/public/`; check that
  first, and if still empty, skip to "Identity and professional
  credentialing" (`packages/identity`) instead, per that section's own
  instruction. Two gaps this run surfaced worth a future run's attention
  regardless of which section is picked up: (1) session-scoped `ownerId`
  means captured documents don't survive a relaunch — real persistence
  needs at minimum a place to store one id, which in turn wants at least a
  minimal identity layer, the same gap `packages/identity` exists to close;
  (2) `listPendingConfirmations`'s per-document N+1 would be worth a bulk
  `GET /records/observations?ownerId=` endpoint the moment a real owner has
  more than a handful of documents.

- 2026-08-09 — Built `packages/devices`: normalisation for Health Connect
  (Android) and HealthKit (iOS) wearable records into `DeviceSample`. First
  "Platform core" package that constructs new domain objects from external
  input rather than transforming existing ones — `health-records` and
  `interop` both operate on `HealthDocument`/`HealthObservation` that already
  exist; this one has to decide, for the first time in this codebase, how a
  raw platform reading becomes a `DeviceSample`.

  **A real type-shape problem, not glossed over:** `DeviceSample` carries one
  `value: number`, but a blood pressure reading is inherently two numbers
  (systolic/diastolic) — and both source platforms actually agree with that:
  Health Connect's `BloodPressureRecord` has two fields, HealthKit represents
  a reading as two separately-typed, correlated `HKQuantitySample`s. The old
  single `DeviceMetricKind.BLOOD_PRESSURE` in `packages/shared-types` could
  not have been normalised into correctly without inventing a shape (cramming
  two numbers into one `value`, or lying about which one is stored). Grepped
  first to confirm nothing in the repo reads `DeviceMetricKind` or
  `DeviceSample` yet except the type definitions and the Prisma seed (one
  `STEPS` row) — so this was a safe, load-bearing type change, not a
  retrofit — and replaced `BLOOD_PRESSURE` with
  `BLOOD_PRESSURE_SYSTOLIC`/`BLOOD_PRESSURE_DIASTOLIC` in `shared-types`.
  `Prisma`'s `DeviceSample.kind` column is a plain `String` (no enum
  constraint, matching every other categorical field in that schema), so this
  needed no migration. A systolic/diastolic pair now shares `recordedAt` and
  is meant to be re-paired by a reader, not merged into one row — documented
  on the type itself so a future consumer doesn't have to rediscover why
  there are two kinds.

  **Id generation deliberately left out, on the same precedent
  `records.service.ts` already set** for `HealthDocument`: `randomUUID()` is
  called at the repository/service layer, not inside the pure domain
  package, and this task's own bullet never mentions `apps/api`. So
  `normalizeHealthConnectRecord`/`normalizeHealthKitSample` return
  `NormalizedDeviceSample` (`Omit<DeviceSample, 'id'>` plus a
  `sourceRecordId`) rather than a full `DeviceSample` — assigning an id here
  would mean either calling `node:crypto` (breaking Metro/React Native
  bundling, the same constraint `storage-adapters` split its Node-only code
  around) or fabricating one, neither of which is this package's job.
  `sourceRecordId` carries the platform's own record/sample id forward
  instead — Health Connect's `metadata.id` and HealthKit's `HKObject.uuid`
  are both real per-record UUIDs already, so a future repository has a ready
  idempotency key for re-synced data without this package inventing one.

  **Raw record shapes are real platform API surface, checked against training
  knowledge of the actual SDKs, not invented:** Health Connect's record class
  names and fields (`StepsRecord.count`, `HeartRateRecord.samples[].
  beatsPerMinute`, `SleepSessionRecord.stages[].stage`, etc.) and HealthKit's
  stable `HKQuantityTypeIdentifier`/`HKCategoryTypeIdentifier` string
  constants and `HKObject.uuid` are Apple's and Android's own public,
  documented identifiers — using them as the discriminant a JS bridge would
  report records under is representing an SDK shape, not asserting a clinical
  fact, so this doesn't trip the "invent no facts" constraint the way a
  fabricated statistic or clinical code would. Two platform quirks worth a
  future run knowing: HealthKit's `HKUnit.percent()` reports oxygen
  saturation as a 0.0–1.0 fraction, not 0–100 (handled via an explicit
  `isFraction` flag on the input type rather than guessing from magnitude);
  and `HKCategoryValueSleepAnalysis` versus Health Connect's sleep stage enum
  don't line up 1:1, so both are normalised through the same rule — sum only
  genuinely-asleep stages/values, drop `AWAKE`/`INBED`/`OUT_OF_BED`/`UNKNOWN`
  — rather than pretending they're the same enum.

  **Canonical units chosen from precedent already in this repo, not
  arbitrarily:** `mg/dL` for blood glucose matches the unit already used in
  `packages/health-records`' and `packages/interop`'s own test fixtures for
  lab-panel analytes; `steps` for step count matches the Prisma seed row that
  predates this run. Conversions applied (mmol/L↔mg/dL for glucose, kg↔lb,
  °C↔°F, HealthKit's saturation fraction↔percent) all use published,
  checkable physical constants (glucose's 18.0182 mg/dL-per-mmol/L factor
  from its molar mass, the exact 0.45359237 kg avoirdupois pound) — commented
  inline with where the number comes from, same "cite it or don't assert it"
  standard the standing constraints apply to statistics.

  **Malformed input throws rather than silently storing garbage:**
  `InvalidDeviceRecordError` for a non-finite reading or an end-before-start
  window, `UnsupportedDeviceRecordError` (backed by a TypeScript exhaustive
  switch, so a new record type added to either union without a matching
  `case` is a compile error, not a silent fallthrough) for a record type this
  package doesn't recognise. Both are real trust-boundary decisions — this
  package is the first thing to touch data that crossed a native bridge from
  a wearable — not defensive scaffolding for inputs that can't happen.

  New package `packages/devices`, mirrors `health-records`' shape exactly
  (root export used directly by both `apps/api` and `apps/mobile`, no
  `node:`-anything so no export-condition split was needed — pure arithmetic
  and `Date.parse`, nothing Metro can't bundle). New tests: `index.test.ts`
  (26 cases — one per `DeviceMetricKind` per platform, the sleep-stage
  filter, the blood-pressure split sharing `recordedAt`, both unit
  conversions each way, the two error paths, device-label composition).
  Verified past the unit tests: built the package and ran
  `dist/index.js` directly against a realistic blood-pressure record (with a
  device label) and a mmol/L glucose reading, and confirmed an unrecognised
  `recordType` throws through the compiled output, not just the TS source.

  Verified: `pnpm install` (new workspace member, lockfile updated — confirmed
  `--frozen-lockfile` passes clean afterward), `pnpm lint`, `pnpm typecheck`,
  `pnpm test` (26/26 tasks green; `@swasthya/devices` contributing 26 new
  tests from zero; every other package's test count unchanged, confirming the
  `DeviceMetricKind` rename broke nothing downstream), `pnpm build`, all
  green.

  **For the next run:** the queue's next unchecked item is `apps/mobile`'s
  document capture flow (camera, review, upload, confirmation queue driven by
  `pendingConfirmations`) — unrelated to this run, this package has no mobile
  UI. If a future run instead wants to build the device *sync* flow this
  package enables: nothing calls `normalizeHealthConnectRecord`/
  `normalizeHealthKitSample` yet, so wiring needs (1) an `apps/mobile` bridge
  that actually reads from Health Connect/HealthKit (this package assumes
  that bridge's output shape but doesn't provide it — no such native module
  is installed in this repo yet), and (2) an `apps/api` endpoint plus a
  `DeviceSample` repository to receive and dedupe (via `sourceRecordId`) what
  this package produces, the same shape `RecordsRepository` already set for
  documents. Neither exists yet; naming both here so neither is discovered by
  accident.

- 2026-08-09 — Built `packages/interop`: FHIR R4 mapping, the JSON/PDF export
  bundle, and a revocable time-limited share link. First task in "Platform
  core" that is a pure domain package rather than `apps/api` wiring — matches
  `health-records`' shape (logic lives directly in `index.ts`, a colocated
  test beside it), not `storage-adapters`' port-plus-adapters shape, because
  this task's bullet never mentions `apps/api`, the same signal that made
  earlier package-only tasks (`health-records`, `entitlements`) skip wiring
  too.

  **The three deliverables share one engine, deliberately.** `platform-vision.md`
  §3.3 says modelling to FHIR internally "costs little and makes step 4
  mechanical" — this run leaned on that directly: `buildFhirExportBundle`
  (JSON) is the FHIR mapping applied to a document/observation set, and
  `resolveSharedBundle` is the same function applied to a share link's scoped
  subset. A share link doesn't carry its own export logic; it just narrows the
  input before handing it to the same builder. One consequence worth naming:
  `resolveSharedBundle` re-derives the bundle from current `documents`/
  `observations` on every call rather than freezing one at issue time, so a
  document deleted or an observation corrected after a link is issued is
  reflected the next time the link is opened — the link grants access to the
  current trusted record, not a snapshot. If a future run wants frozen
  snapshots instead, that's a deliberate reversal of this choice, not a bug.

  **"Only trusted observations are reasoned over" enforced twice, on purpose.**
  `buildFhirExportBundle` calls `selectTrusted` before mapping anything, and
  `toFhirObservation` itself throws `UntrustedObservationError` for a
  DRAFT/REJECTED observation regardless of who calls it — same
  defence-in-depth shape as `assertPlacementAllowed` in `storage-adapters`,
  so a future caller that forgets to pre-filter still can't leak a draft
  through this path. Verified concretely, not just asserted: a scratch script
  built a bundle from one CONFIRMED and one DRAFT observation and printed the
  JSON — the DRAFT never appears in the output (see below).

  **Document-type and clinical codes: named what could not be verified rather
  than guessing.** FHIR has real LOINC codes for some document types (e.g.
  discharge summaries), but this run could not confirm a correct code for
  every `HealthDocumentKind` with certainty, so `toFhirDocumentReference`
  emits `type: { text: ... }` with no `coding` at all rather than a coding
  that might be wrong — the "invent no facts" constraint applied to a wrong
  clinical code exactly as it would to a wrong statistic. Similarly,
  `abnormalFlag: 'CRITICAL'` maps to the HL7 v3 interpretation code `AA`
  ("critical abnormal"), not `HH`/`LL` ("critical high"/"critical low") --
  the domain type doesn't record which direction a critical value went, so
  asserting a direction would be inventing one.

  **A real, unglamorous technical limit, named rather than hidden:** `pdf-lib`'s
  standard 14 fonts only support WinAnsi (Latin-1-ish) encoding, and this repo
  has no embedded Devanagari font to hand `pdf-lib`'s `fontkit` integration, so
  a Nepali title or label would make `drawText` throw mid-export. Rather than
  crash or silently drop the record, `export-pdf.ts`'s `pdfSafeText` strips
  characters above U+00FF and appends a visible `[+ non-Latin text omitted]`
  marker — the PDF degrades legibly, and the parallel JSON/FHIR export (which
  has no such constraint) still carries the untouched Unicode text, so nothing
  is actually lost, only the printed rendering. A future run embedding a
  Mukta/Devanagari font via `fontkit` removes this limitation entirely; until
  then, exported PDFs are effectively English-only regardless of the person's
  locale, which is worth knowing before anyone hands one to a Nepali-speaking
  clinician expecting Devanagari labels.

  **New dependency: `pdf-lib` 1.17.1**, added to `packages/interop` only. Pure
  JS/TS, no native bindings, MIT-licensed, ~1M weekly downloads — checked
  against the same bar the Google Drive run used to reject a single-maintainer
  mock package, this cleared it easily. Kept off the `react-native` export
  condition on purpose: `pdf-lib`'s RN compatibility is unverified in this
  repo and there is no mobile PDF-export flow yet to prove it, so
  `export-pdf.ts` only ships via a second export, `@swasthya/interop/pdf`
  (mirrors `storage-adapters`' `/hosted` split for the same reason: keep the
  root `.` export exactly as RN-safe as it was, don't bet an unverified
  assumption against Metro bundling until something actually needs it there).
  The root `.` export (FHIR mapping, share links, JSON bundle) has zero Node
  imports and stays RN-safe.

  **One real debugging detour, resolved rather than routed around:** `Buffer`
  was unresolvable (`TS2591`) in `export-pdf.test.ts` despite `@types/node`
  being correctly installed and symlinked into `packages/interop/node_modules/
  @types/node` — confirmed identical tsconfig structure, identical `@types/node`
  version and resolution path to `storage-adapters`, which has no such problem.
  Best working theory: `storage-adapters`' files explicitly `import` from
  `node:crypto`, which pulls `@types/node` in via normal module resolution
  regardless of automatic type-acquisition; `packages/interop`'s only Node-only
  file imports nothing with a `node:` specifier (`pdf-lib` is a plain package,
  not a Node built-in), so it depended entirely on automatic global inclusion,
  which did not fire for reasons this run could not fully pin down. Fixed with
  an explicit `"types": ["node"]` in `packages/interop/tsconfig.json` — a
  common, well-understood fix for exactly this class of pnpm-workspace
  TypeScript issue, not a suppression of a real error.

  **Verified past the unit tests, same standard the storage-adapter runs set:**
  built the package and ran the compiled `dist/index.js` and `dist/export-pdf.js`
  from a scratch script against realistic data (one CONFIRMED observation, one
  DRAFT). Confirmed in the printed JSON: the DRAFT observation never appears;
  the FHIR `Observation` for the CONFIRMED one carries the right LOINC coding,
  `valueQuantity`, `referenceRange`, and `interpretation.coding.code: "H"` for
  its HIGH flag. Confirmed the share link scoped to one document excludes an
  unrelated second document's observation. Then went one step further on the
  PDF specifically: inflated its FlateDecode content stream by hand (`zlib`)
  and decoded the hex-encoded `Tj` text-showing operators back to ASCII —
  found the literal string `"- Creatinine: 1.4 mg/dL (ref 0.7-1.3) [HIGH]"` in
  the decompressed page content, i.e. real, correctly-formatted text is
  actually drawn on the page, not just a structurally-valid empty PDF.

  New tests: `index.test.ts` (26 cases — FHIR document/observation mapping,
  the untrusted-observation guard, bundle filtering, share link issue/revoke/
  expiry/scope, `InMemoryShareLinkStore`) and `export-pdf.test.ts` (5 cases —
  valid-PDF round trip via `PDFDocument.load`, deleted-document exclusion,
  DRAFT/REJECTED exclusion, Devanagari title does not throw, pagination once
  content overflows a page). `packages/interop` is a new package, so these are
  31 tests from zero, not a delta.

  Verified: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test` (25/25 turbo tasks, `@swasthya/interop` contributing 31 new
  tests; every pre-existing package's test count unchanged), `pnpm build`,
  all green. (`pnpm format:check` was not part of this run's gate — it is
  already failing across ~106 pre-existing files repo-wide, confirmed by
  checking that untouched packages like `health-records` appear in its output
  too, so this is a pre-existing gap this task did not create and does not fix.)

  **For the next run:** this task's own bullet named `apps/api` nowhere, so —
  same as `health-records` and `entitlements` before their own guard/wiring
  tasks — nothing here is reachable over HTTP yet. The next unchecked queue
  item is `packages/devices` (Health Connect/HealthKit normalisation into
  `DeviceSample`), which does not depend on this run. If a future run instead
  wants to wire this package into `apps/api` (an export-bundle endpoint, a
  share-link create/resolve/revoke endpoint), two real gaps to know about
  first: (1) `InMemoryShareLinkStore` is the only `ShareLinkStore`
  implementation — a durable one needs the same `HealthDocument`/
  `Subscription` treatment the Prisma-schema run gave everything else, and (2)
  there is still no identity/auth layer anywhere in this repo (the same gap
  every prior run touching `apps/api` has named), so an HTTP endpoint that
  issues a share link would need to decide, honestly, who is allowed to ask
  for one on an owner's behalf — not something to default silently.

- 2026-08-09 — Built the Google Drive adapter: `GoogleDriveDocumentStore` and
  `GoogleOAuthTokenProvider` in `packages/storage-adapters`, implementing
  `HealthDocumentStore` against the person's own Drive. Second, independent
  example of an adapter behind the port (after `MinioDocumentStore`), and the
  first one for the bring-your-own side of the "your data, your storage"
  split `docs/architecture/platform-vision.md` §3.1 describes.

  **Scoped the "OAuth" bullet to what an adapter actually owns.** The task
  reads "OAuth, an app-scoped folder, and client-side encryption." Client-side
  encryption was already enforced at the port boundary before this run
  (`assertPlacementAllowed` on `GOOGLE_DRIVE` requires `blob.clientEncrypted`)
  — this run's `put()` re-checks it anyway, same defense-in-depth
  `MinioDocumentStore` already established, rather than trusting every future
  caller to remember. "OAuth" for an adapter that only ever calls Drive's REST
  API is the *token refresh* mechanics — `GoogleOAuthTokenProvider` does a
  real `grant_type=refresh_token` exchange against
  `https://oauth2.googleapis.com/token`, caches the access token, and
  refreshes a minute ahead of expiry. **Deliberately did not build the consent
  screen / authorization-code flow that produces the first refresh token** —
  there is still no identity/auth layer anywhere in this repo to hang a
  "connected accounts" concept off of (confirmed again by grep, same gap
  every run touching `apps/api` auth has named), so persisting a per-person
  refresh token has no home yet. Building that flow now would mean inventing
  where it lives, which is exactly the kind of unscoped decision this ledger
  asks not to make by accident. `GoogleDriveStoreConfig.refreshToken`'s own
  doc comment names this explicitly as the next run's problem, not a gap
  papered over. **For the same reason, this adapter is not wired into
  `apps/api`'s `RecordsModule`** — unlike `MinioDocumentStore` (one shared
  service credential, a genuine drop-in default), Drive requires one OAuth
  grant per person, and there is nowhere yet to read one from per request.
  Wiring it in now would mean either hardcoding a single fake owner's token
  (fabricating a capability that doesn't exist) or leaving a dead code path
  nothing can reach — both worse than naming the gap here and leaving
  `RecordsModule` as is until a connected-accounts flow exists to feed it.

  **"App-scoped folder" taken as a real design decision, not a checkbox.**
  Google Drive's `drive.file` OAuth scope restricts an app to only see
  files/folders it created — but Drive separately offers a special hidden
  `appDataFolder`, invisible in the person's own Drive UI, normally used for
  app config. Deliberately did **not** use that: these are the person's own
  health documents, and hiding them from their own Drive would work against
  the entire point of bring-your-own storage ("your data, your storage" means
  they can find, rename, or delete a file outside Mero Health too). Instead
  the adapter creates (and, on every later use, finds and reuses) one
  ordinary, named, visible folder, `"Mero Health Records"` — same
  memoized-promise idempotency pattern as `MinioDocumentStore#ensureBucket`,
  `#ensureFolder`, proven race-free under concurrent `put()`s in a dedicated
  test (see below). Per-document checksum lives in Drive's `appProperties`
  (visible only to the app that wrote it, same `drive.file`-scope guarantee),
  since Drive has no native SHA-256 field — mirrors `MinioDocumentStore`'s own
  `x-amz-meta-` checksum convention, just Drive's metadata mechanism instead.

  **No live Google account or credentials exist in this environment**, and
  unlike MinIO there is no widely-used, long-established local emulator for
  Drive's REST API to fall back on the way `s3rver` did for S3 (checked: the
  one hit on the npm registry, `google-drive-mock`, is a single-maintainer
  package with zero prior history in this codebase — not something to trust
  into a health product's dependency tree over a hand-rolled alternative).
  So `google-drive-store.test.ts` hand-rolls the actual slice of the Drive v3
  wire protocol this adapter speaks — OAuth token refresh, folder search and
  creation, real `multipart/related` upload bodies (not `multipart/form-data`
  — `FormData`/`Blob` build the wrong one, so the body is constructed by
  hand), `alt=media` download, listing, deletion — as a real in-process
  `node:http` server, so the client's request shaping, header handling and
  response parsing are all genuinely exercised over a real socket, the same
  bar the MinIO run set with `s3rver`. Caught one real bug from this while
  writing the tests: an early version of the "folder created at most once
  under concurrent `put`s" test shared the describe block's one mock server
  (and its one global folder namespace) with an earlier test, so the folder
  already existed by the time that test ran and the assertion of "exactly one
  *new* creation" was unmeetable by construction — fixed by giving that one
  test its own throwaway server, not by loosening the assertion. Also
  verified past the unit tests, same standard as the MinIO run: built the
  package, imported the compiled `dist/google-drive-store.js` from a scratch
  script against a second, independently written mock server, and drove a
  full put → get → list round trip through the compiled output, not just the
  TypeScript source. That pass also flaged exactly one bug — in the scratch
  script's own mock, whose lazy `q.includes('folder')` folder-search check
  false-matched a file-listing query (because the folder id happens to be
  named `folder-0`); the shipped test file already uses the precise MIME-type
  string so this was never a risk to the real suite, but worth naming since it
  is the kind of mistake a less careful mock could ship silently.

  New env vars in `.env.example`: `GOOGLE_OAUTH_CLIENT_ID` /
  `GOOGLE_OAUTH_CLIENT_SECRET` (the app's own OAuth client, shared across every
  person who connects a Drive — distinct from the per-person refresh token,
  which has nowhere to live yet). New package export
  `@swasthya/storage-adapters/google-drive`, Node-only for the same reason
  `./hosted` already is (`Buffer`/`node:crypto`; Metro can't bundle either for
  `apps/mobile`) — the root `.` export stays exactly as React-Native-safe as
  before this run.

  Verified: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test` (`@swasthya/storage-adapters` up to 32 tests from 21 — 11 new in
  `google-drive-store.test.ts`; every other package unchanged), `pnpm build`,
  all green.

  **For the next run:** two honest gaps this run named rather than solved,
  both blocking further progress on Drive specifically: (1) the OAuth consent
  flow that produces a person's first refresh token — needs a redirect route,
  a callback, and somewhere to persist the token per person, which in turn
  wants at least a minimal identity/auth layer to hang "connected accounts"
  off of; (2) wiring `GoogleDriveDocumentStore` into `RecordsModule` is
  mechanical once (1) exists, but not before. Absent picking either of those
  up, the next unchecked queue item is `packages/interop`: FHIR R4 mapping,
  a record export bundle (PDF + JSON), and a revocable, time-limited share
  link — read `docs/architecture/platform-vision.md` §3.3 first; it is
  explicit that v1 is the export bundle and share link, not a hospital-system
  FHIR connection, since there is no national health information exchange to
  plug into yet.

- 2026-08-09 — Built the hosted storage adapter: `MinioDocumentStore` in
  `packages/storage-adapters`, an S3-compatible implementation of
  `HealthDocumentStore` against the MinIO service in `compose.yaml`, wired
  into `apps/api`'s `RecordsModule` as a real (not hypothetical) alternative
  to the in-memory store.

  **Kept off the package's root export on purpose.** `packages/storage-adapters`
  ships a `"react-native"` export condition so `apps/mobile` can one day import
  its source directly — but the `minio` client pulls in `node:http`/`node:net`,
  which Metro cannot bundle. Rather than risk breaking that path the day mobile
  actually wires this package in, the adapter lives in a new file,
  `hosted-store.ts`, exported only via a second package-export entry,
  `@swasthya/storage-adapters/hosted` (no `react-native` condition on that one
  — Node-only, deliberately unreachable from a bundler). `apps/api` imports
  that subpath; the root `.` export `apps/mobile` would use stays exactly as
  Node-free as it was before this run.

  **No way to run real MinIO in this environment, so said so and found the next
  best thing rather than either skipping verification or mocking the client
  library.** No Docker daemon (same gap the Prisma-schema run hit for
  Postgres), and this sandbox's network policy rejects `dl.min.io` outright
  (confirmed via `$HTTPS_PROXY/__agentproxy/status`, `connect_rejected` /
  policy denial), so there's no path to the real MinIO binary here. Rather
  than mock the `minio` client (which would only prove the adapter calls the
  client correctly, not that the client's requests are correct against a real
  S3-compatible server), used `s3rver` — a real, in-process, S3-compatible
  HTTP server, installed as a devDependency — so `hosted-store.test.ts` drives
  the actual `minio` client over an actual HTTP round trip: real request
  signing, real header parsing, real response bodies. This is genuine
  integration coverage of the wire protocol, just not against MinIO's own
  binary specifically — worth a future run repeating this against real MinIO
  the moment Docker is available, though nothing here suggests it would behave
  differently (MinIO's whole design goal is exact S3 API compatibility).
  Prototyped this compatibility question standalone (a scratch script against
  a live `s3rver` instance) before committing to the approach, specifically to
  confirm the `minio` client's `putObject` metadata handling
  (`prependXAMZMeta` auto-prefixes plain metadata keys with `x-amz-meta-`
  unless already an AWS/supported header) actually round-trips through
  `statObject` the way the adapter's `list()` depends on, rather than
  discovering that gap after the adapter was already written.

  **Went one step further than the package-level tests: booted the real
  server against the real adapter.** Built `apps/api`, started
  `node dist/main.js` twice — once with no `OBJECT_STORAGE_*` env vars (falls
  back to `InMemoryDocumentStore`, confirmed capture/list still work exactly
  as before this run) and once with them pointed at a standalone `s3rver`
  instance on a scratch port — and drove a real `POST /v1/records/documents`
  through curl against the MinIO-backed path. Confirmed the response `ref`,
  the `GET /v1/records/documents` listing, and the actual bytes + metadata
  file `s3rver` wrote to disk (`cat`, not just trusting the HTTP response) all
  agree: same 39-byte payload, same SHA-256, same content-type, object key
  correctly scoped `owner-live/<uuid>-discharge_summary.pdf`. This is the same
  "wire it concretely, not just build it in the abstract" standard the
  entitlement-guard run set — a port with two adapters and a factory that
  never gets exercised end to end is still, functionally, an abstraction.

  **Design choices worth recording:** object keys are
  `${ownerId}/${uuid}-${sanitizedFilename}`, so `list(ownerId)` is a plain
  prefix query — the bucket itself stays the only source of truth for what
  exists, with no side database to fall out of sync (matching
  `InMemoryDocumentStore`'s own contract, just S3-backed instead of a `Map`).
  `byteSize`/`contentType`/`checksumSha256` on `list()` come from a `statObject`
  call per key rather than being cached anywhere — an N+1 against the object
  store, acceptable for a reference adapter at this stage, worth revisiting if
  a single owner's document count grows large enough for it to matter.
  `minioConfigFromEnv()` reads `OBJECT_STORAGE_ENDPOINT` /
  `OBJECT_STORAGE_BUCKET` / `OBJECT_STORAGE_ACCESS_KEY` /
  `OBJECT_STORAGE_SECRET_KEY` — these were already declared in `.env.example`
  from before this run existed, so this introduces no new environment
  contract; only parses the endpoint URL into host/port/TLS that didn't exist
  yet. Noticed but deliberately did not touch: `.env.example`'s
  `OBJECT_STORAGE_SECRET_KEY=replace-me` doesn't match `compose.yaml`'s actual
  `MINIO_ROOT_PASSWORD=replace-me-local-only` — a pre-existing placeholder
  mismatch, harmless until someone actually runs `compose.yaml`'s MinIO
  locally and copies `.env.example` verbatim, at which point auth would fail
  until the value is corrected by hand. `RecordsModule` now picks the adapter
  via `OBJECT_STORAGE_ENDPOINT`'s presence rather than a hard swap, so a bare
  checkout with no object store configured still boots and passes its own
  test suite — the previous run's comment ("swapping in the real adapter is a
  one-line change") undersold it slightly; it's one line, but conditional,
  not unconditional, specifically so this module doesn't gain a hard runtime
  dependency on an object store existing.

  Verified: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test` (`@swasthya/storage-adapters` up to 21 tests from 12; `apps/api`
  unchanged at 39 — its records tests instantiate `RecordsService` directly
  with a stub store, so this run's module-wiring change had nothing new for
  them to catch, which is exactly why the live-server curl pass above mattered),
  `pnpm build`, all green.

  **For the next run:** next unchecked item is the Google Drive adapter —
  OAuth, an app-scoped folder, client-side encryption so stored bytes stay
  opaque to the server. `resolveStoragePlacement`/`assertPlacementAllowed` in
  `packages/storage-adapters/src/index.ts` already encode the policy this
  adapter must honour (`requiresClientEncryption: true` for `GOOGLE_DRIVE`);
  this run's `MinioDocumentStore` is a second, independent example of an
  adapter that calls `assertPlacementAllowed` defensively at its own `put`
  boundary rather than trusting the caller, worth matching. Consider whether
  the Drive adapter needs its own `@swasthya/storage-adapters/*` subpath (an
  OAuth-capable Node/browser client is a different bundling question than
  `minio`'s Node-only one — don't assume the same subpath split applies
  without checking what the Drive SDK actually needs).

- 2026-08-09 — Built the Prisma schema for the personal health platform:
  `HealthDocument`, `HealthObservation`, `DeviceSample`, `Subscription`,
  `UsageCounter`, plus a migration and seed data. First task to touch
  `packages/database` — everything before this ran in-memory.

  **The naming collision the previous run flagged had to be resolved, not
  deferred:** `schema.prisma` already had a `Subscription` model, but it was
  the pre-pivot one (`subscriberType`/`subscriberId`/`planId` against a
  DB-driven `Plan` catalogue) — confirmed by grep, again, that nothing in the
  codebase reads `Subscription`, `Plan` or `Entitlement` at all, and that no
  `migrations/` directory existed yet, so this is genuinely the first
  migration this package has ever had rather than a change against a live
  schema. Given that, replacing the old `Subscription` model was the correct
  call, not scope creep: this product's plan catalogue is code-defined in
  `packages/entitlements` (pricing, modules, limits all live there), so a
  subscription only needs to record which `PlanTier` an owner is on, not a
  foreign key into a `Plan` table. **Deliberately did not touch `Plan` or
  `Entitlement`** — removing those too would be pruning the wider pre-pivot
  schema, which is the larger decision the previous run named and this run
  is explicitly not making by accident. `Plan`/`Entitlement` now have no
  reader anywhere; whether they still belong is still open.

  **No live database was available in this environment** (no Docker daemon;
  `compose.yaml`'s Postgres never starts) — this could easily have meant an
  untested migration written on faith. Found a real path instead: Postgres
  16 is installed on the box directly (`pg_ctlcluster`), so this run started
  a local cluster, created the `swasthya`/`swasthya` role and database
  matching `compose.yaml`'s credentials, generated the initial migration
  with `prisma migrate diff --from-empty --to-schema ... --script` (works
  without a live connection — it diffs the schema file, not a database), and
  then actually applied it with `prisma migrate deploy`, ran
  `prisma migrate diff --from-config-datasource --to-schema` afterward to
  confirm zero drift between the applied migration and the schema file, ran
  the new seed rows against it, queried every new table back out to confirm
  the values landed as written, and re-ran the seed a second time to confirm
  the `ON CONFLICT DO NOTHING` idempotency actually holds rather than
  assuming it from reading the SQL. Stopped the cluster afterward — nothing
  about this depends on it staying up; the next run gets a clean box and can
  repeat the same steps if it needs to touch the schema again.

  **Design notes for whoever wires a real reader/resolver against these
  tables next:** `ownerId` on every new table is a plain `String`, not
  `@db.Uuid`, deliberately — there is still no identity/auth layer (same gap
  the entitlements-guard run named), so it is exactly the client-supplied
  string `RecordsController` already validates, no more trustworthy than
  that. None of the five new models declare a Prisma `@relation` to another
  model in this file (e.g. `HealthObservation.documentId` is a bare
  `@db.Uuid` column) — that matches this schema's existing convention across
  all ~40 pre-pivot models, none of which cross-reference each other via
  Prisma relations either, presumably to keep each bounded context
  extraction-ready into its own service later. `UsageCounter` uses a
  non-null `period` column ("YYYY-MM" for the two monthly-reset dimensions,
  the sentinel `"ALL_TIME"` for the other three) rather than a nullable
  `DateTime?`, specifically so `@@unique([ownerId, dimension, period])`
  actually holds — Postgres treats every `NULL` as distinct, so a nullable
  period column would have silently allowed duplicate all-time counters per
  owner. `Subscription` has `@@unique([ownerId])`: one row per owner,
  updated in place on a tier change, no history table — the simplest shape
  that unblocks replacing `FreeTierSubscriptionResolver`
  (`apps/api/src/entitlements/subscription-resolver.ts`), which still names
  this table as its own replacement; wiring a real resolver against it is
  the natural next step but is not this task. `DocumentStatus` and
  `ObservationStatus` got real Postgres enums (matching the existing
  precedent of `AppointmentStatus`/`PrescriptionStatus`/`PharmacyOrderStatus`
  — workflow state machines get enums here, plain categorical fields like
  `kind`/`storageBackend`/`sensitivity` stay `String`), and their members
  are copy-pasted 1:1 from `packages/health-records`'s `canTransition` table
  and `ObservationStatus` union so a row can never hold a status the domain
  logic disallows.

  Seed data: one fictional owner (`demo-owner-fictional-001`) threaded
  through all five new tables — a demo lab document, one haemoglobin
  observation on it (`LOCAL` code system, not a LOINC number, specifically
  to avoid asserting a real-world clinical code this run could not verify
  with certainty), a manual step-count device sample, a `FREE` subscription,
  and a `DOCUMENTS_STORED` usage counter. Checksum on the demo document is
  the well-known SHA-256 of the empty string rather than an invented-looking
  hex string, on the same "invent nothing" logic the standing constraints
  already apply to statistics and credentials.

  Verified: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test` (24/24 tasks, unchanged pass count — this task added no
  TypeScript, only schema/SQL/docs), `pnpm build` all green.

- 2026-08-09 — Built the entitlement guard: `apps/api` now enforces
  `checkModule`/`checkQuota` at the route boundary rather than trusting a
  client to respect a plan limit. First task any run has done that needed a
  NestJS guard — none existed anywhere in the repo (confirmed by grep before
  starting: zero matches for `CanActivate`/`UseGuards`/`ExecutionContext`) —
  so this run established the pattern rather than following one.

  **Two honest gaps surfaced by this task, both handled by naming them
  rather than papering over them:** (1) nothing in `apps/api` resolves "what
  plan does this owner have" — no auth layer, no `Subscription` lookup
  anywhere the API can read (there's a `Subscription` Prisma model in
  `packages/database/prisma/schema.prisma`, but that schema is the
  pre-pivot telehealth model — `Document`/`Observation`/`Prescription`/
  `PharmacyOrder`, not `HealthDocument`/`HealthObservation` — and nothing in
  `apps/api` reads it at all, confirmed by grep). (2) `ownerId` itself is
  still just a client-supplied string with no identity verification behind
  it, same as every other route. Building a guard on top of either gap
  pretending it was solved would have been fabricating enforcement that
  doesn't exist, so instead: **new `apps/api/src/entitlements/`**
  (`subscription-resolver.ts` — the `SubscriptionResolver` port, DI token,
  and `FreeTierSubscriptionResolver`, a stand-in that resolves every owner
  to `FREE` with a doc comment explaining why that's the correct
  *conservative* default — nobody has been verified as a paying subscriber,
  so nobody should be treated as one — and naming the upcoming `Subscription`
  Prisma-schema item as what actually replaces it, the same
  stand-in-names-its-own-replacement pattern `RecordsRepository` already
  set; `usage-reader.ts` — the `UsageReader` port, deliberately module-local
  rather than one global implementation, since no single reader can answer
  for all five `QuotaDimension`s yet; `require-entitlement.decorator.ts` —
  `@RequireModule(module)`/`@RequireQuota(dimension)`, plain
  `SetMetadata` wrappers; `entitlements.guard.ts` — `EntitlementsGuard`,
  reads both decorators via `Reflector`, resolves the caller's tier,
  calls `packages/entitlements`'s `checkModule`/`checkQuota` unchanged, and
  forwards the whole verdict — including `upgradeTo` — in a
  `ForbiddenException` body, since the package's own doc comment is explicit
  that returning a verdict rather than throwing exists so a caller can offer
  an upgrade instead of a flat failure; a route with neither decorator
  passes through untouched, so the guard adds no behaviour anywhere it
  isn't opted into).

  **Wired concretely, not just built in the abstract**, per the previous
  run's own note: `RecordsController.capture` (`POST /records/documents`)
  now carries `@UseGuards(EntitlementsGuard)`,
  `@RequireModule('HEALTH_RECORD')`, `@RequireQuota('DOCUMENTS_STORED')`.
  New `RecordsUsageReader` (`apps/api/src/records/records-usage.reader.ts`)
  implements `UsageReader` for exactly one dimension —
  `DOCUMENTS_STORED`, a straight count off `RecordsRepository.listDocuments`
  — and throws rather than returning zero if asked about any other
  dimension, so a future route wired to a quota with no real meter behind
  it fails loudly in tests instead of silently passing every request.
  `RecordsModule` binds `SUBSCRIPTION_RESOLVER` → `FreeTierSubscriptionResolver`
  and `USAGE_READER` → `RecordsUsageReader`, both scoped to this module —
  `EntitlementsGuard` itself is generic and module-agnostic, ready for
  `patient-registry`/`scheduling`/etc. to bind their own resolvers later.
  `HEALTH_RECORD` gating is currently a no-op (every tier includes it) —
  included anyway so both `checkModule` and `checkQuota` are demonstrably
  wired at a real route, not just one of the two; it becomes meaningful the
  moment a module without universal FREE access needs the same treatment.

  Added `@swasthya/entitlements` to `apps/api`'s dependencies (it had never
  been wired in before) and ran a plain `pnpm install` once to update the
  lockfile, same as the Pricing run's precedent for adding a new workspace
  edge — confirmed `--frozen-lockfile` passes clean afterward.

  **Verified past what the unit tests can prove:** `RecordsController`'s own
  existing tests instantiate the controller directly
  (`new RecordsController(service)`), which never runs Nest's guard
  pipeline at all — a guard only executes when Nest's HTTP layer resolves
  the route, so those tests staying green says nothing about whether the
  guard is actually wired correctly. Caught this before trusting the test
  suite alone: built and ran a live server (`pnpm build && node dist/main.js`)
  and drove it with `curl` — captured 25 documents for one owner (the FREE
  limit), confirmed the 26th returns `HTTP 403` with
  `{"code":"QUOTA_EXCEEDED","dimension":"DOCUMENTS_STORED","limit":25,"used":25,"upgradeTo":"PLUS"}`;
  confirmed a fresh owner under quota still captures successfully
  (`HTTP 201`); confirmed a gated request missing `ownerId` gets rejected by
  the guard itself with `HTTP 400` before it reaches the repository; and
  confirmed `GET /records/documents` (no decorators) still runs open with no
  entitlement check. All four outcomes matched the design exactly. New
  tests: `entitlements.guard.test.ts` (8 cases — open routes pass through,
  module allow/deny, quota allow/deny, the verdict/`upgradeTo` payload shape,
  missing-`ownerId` rejection, reading `ownerId` from query as well as body),
  `subscription-resolver.test.ts`, `records-usage.reader.test.ts` (including
  the "throws for an unmetered dimension" case) — `apps/api` is up to 39
  tests from 28. All green
  (install/lint/typecheck/test/build).

  **Two lint fights worth recording for the next run touching NestJS
  guards:** `Reflector.get(key, target)` is untyped (`any`) unless called
  with an explicit generic — `this.reflector.get<ModuleKey | undefined>(...)`
  — or `@typescript-eslint/no-unsafe-assignment` fires on the result.
  Referencing a class's own methods as bare function values for a fake
  `ExecutionContext` in the guard's test (`controller.moduleGated` as a
  handler reference) trips `@typescript-eslint/unbound-method` even though
  none of the methods touch `this` — fixed by declaring `this: void` on each
  test-double method and reading them off the prototype rather than an
  instance, which is what the rule is actually asking for, not by
  disabling the rule.

  **For the next run:** the queue's next unchecked item is the Prisma
  schema — `HealthDocument`, `HealthObservation`, `DeviceSample`,
  `Subscription` and usage counters, plus a migration and seed data. Two
  things this run learned that the next one shouldn't rediscover from
  scratch: first, `packages/database/prisma/schema.prisma` already exists
  but models the *pre-pivot* telehealth product (`Document`, `Observation`,
  `Prescription`, `PharmacyOrder`, `Appointment`, ~50 other models) — it is
  not a partial version of this task, and this run did not touch it;
  whether the new models belong in that same schema file (with the stale
  models pruned or left alone) or a fresh one is a real decision the next
  run has to make deliberately, not discover by accident. Second, a real
  `Subscription` table is exactly what `FreeTierSubscriptionResolver`
  (`apps/api/src/entitlements/subscription-resolver.ts`) names as its own
  replacement — wiring a real resolver against it is the natural
  continuation, and at that point every owner stops being hardcoded to
  `FREE`.

- 2026-08-09 — Built `apps/api`'s records module: capture, list, timeline and
  confirm/correct/reject endpoints over `packages/health-records`, with the
  storage port injected. First task in "Platform core" and the first task any
  run has done against `apps/api` rather than `apps/web` — read
  `docs/architecture/platform-vision.md` §3.2 and `packages/health-records`'s
  actual source before starting, per the previous run's own note, and that
  paid off: the module design follows directly from what was already there
  rather than inventing a shape for it.

  **New `apps/api/src/records/`** — `records.repository.ts` (an in-memory
  `Map`-backed store for `HealthDocument`/`HealthObservation`, explicitly a
  stand-in: its own doc comment says the next queue item, the Prisma schema,
  replaces only this file, not the service or controller above it),
  `records.service.ts` (the actual logic, wrapping
  `@swasthya/health-records`'s pure functions —
  `buildTimeline`/`confirmObservation`/`correctObservation`/
  `rejectObservation` — around the repository), `records.controller.ts` (zod
  request validation, matching `companion.controller.ts`'s existing pattern),
  and `records.module.ts`. Wired into `AppModule` alongside the existing
  three controllers.

  **"With the storage port injected" taken literally:** `RecordsService`
  takes `HealthDocumentStore` (the port `packages/storage-adapters` already
  defines) through a Nest DI token, `HEALTH_DOCUMENT_STORE`, exported from
  `records.service.ts` and bound in `records.module.ts` to
  `InMemoryDocumentStore('HOSTED')` for now. Swapping in the real MinIO
  adapter, queued right after the Prisma schema, is a one-line change in the
  module — nothing in the service or controller knows or needs to know which
  adapter is behind the port. `captureDocument` also calls
  `assertPlacementAllowed` itself before `store.put()`, rather than trusting
  every future adapter to enforce it internally — the standing constraint
  that a backend Mero Health doesn't control must never receive readable
  bytes has to hold regardless of which adapter is plugged in, so the check
  lives at the port boundary in the service, not inside one adapter's `put`.

  **Scoped honestly around what isn't built yet:** there is no OCR/extraction
  pipeline anywhere in this repo, so `captureDocument` uploads bytes and
  records a document already `STORED` — it does not, and should not,
  fabricate `HealthObservation`s. That leaves confirm/correct/reject with
  nothing to act on through the HTTP surface alone yet; they're fully
  implemented, wired, and tested (service- and controller-level tests seed a
  `DRAFT` observation directly into the repository, since that's the only way
  to produce one honestly today), but a real client can't exercise them until
  an extraction step exists to create drafts in the first place. Documented
  here explicitly rather than papering over it with a fake extraction
  endpoint — the mobile capture-flow item later in this same queue section
  names `pendingConfirmations` as what it needs to drive its confirmation
  queue, so this module's job was to have that contract ready, not to build
  extraction early.

  **A pre-existing, unrelated bug found and fixed during verification:**
  `pnpm test` never actually boots the Nest application (vitest imports the
  controller classes directly), so nothing before this run had ever run
  `node dist/main.js` against a real build. Doing that here — the only way to
  verify the new endpoints against a live server rather than just direct
  class instantiation — showed the app has never actually been able to
  start: `CompanionController`'s constructor
  (`private readonly healthResearch = new PerplexityHealthService()`, no
  type annotation) makes `tsc --emitDecoratorMetadata` reflect the parameter
  as a bare `Object` rather than `PerplexityHealthService`, and Nest's
  injector throws on boot trying to resolve a provider for `Object`.
  Confirmed this predates this run entirely by building and running the
  *unmodified* `origin/mero-health/platform-foundation` tip in a scratch
  `git worktree` — same crash, same stack, before a single line of this
  run's work was added. Fixed with a one-line, one-file change: an explicit
  `: PerplexityHealthService` annotation on that same parameter (kept the
  default value too, since `companion.controller.test.ts` still constructs
  it directly without Nest). This was a blocking prerequisite for verifying
  this run's own task, not a second task — the records module's new
  `RecordsService` has the same shape of dependency (a constructor parameter
  Nest must resolve by type) and would have hit the identical class of
  failure the moment anyone actually tried to run the server, so leaving it
  broken would have meant shipping code that had only ever been exercised
  through direct-construction unit tests, never through Nest's own
  instantiation path.

  Verified end to end: `pnpm build && node dist/main.js` now starts cleanly
  and logs every route, `RecordsController` included, under
  `NestApplication successfully started`. Drove it with `curl` against a
  live server: capture → returns a `STORED` document with a real `ref` from
  the injected `InMemoryDocumentStore`; list scopes strictly to the given
  `ownerId`; timeline reflects the captured document with zero counts (no
  observations exist yet, as expected); observations-for-document returns an
  empty list for a real document and a 404 for an unknown one; confirming an
  unknown observation 404s; omitting `ownerId` on list/timeline 400s. All
  green (install/lint/typecheck/test/build — `pnpm test` includes 28 tests in
  `apps/api` now, up from 3, across the three new colocated
  `records.*.test.ts` files plus the pre-existing `companion.controller.test.ts`,
  itself unaffected by the DI fix).

  **For the next run:** next unchecked item is the entitlement guard
  (`checkModule`/`checkQuota` at the route boundary — "a UI-only gate is not
  a gate"). This run's `RecordsController` has no entitlement enforcement at
  all yet — every endpoint is open — which is correct sequencing per the
  queue order, not an oversight, but means the guard's own task should wire
  through `records/documents` (capture in particular: it's the one endpoint
  a paid quota — documents stored — should actually gate) as its first real
  target, not just add the guard in the abstract. After that, the Prisma
  schema item replaces this run's `RecordsRepository` — check
  `records.repository.ts`'s own doc comment first, since it names exactly
  what has to move.

- 2026-08-09 — Accessibility pass: heading order, landmarks, focus traps in
  the mobile drawer, contrast, and a keyboard walkthrough of the mega-menu.
  Closes out the "Marketing site" section entirely — the queue moves into
  "Platform core" next.

  **Scoped as an audit-plus-fix, not a rewrite:** read every relevant
  component (`Header.tsx`, `MegaMenu.tsx`, `MobileNav.tsx`,
  `app/[locale]/layout.tsx`, `SectionIntro.tsx`, `Section.tsx`,
  `styles/globals.css`) before changing anything, then fixed exactly what was
  actually broken. Two of the five checklist items needed no code change —
  documenting that plainly here rather than inventing busywork to look like
  five fixes:
  - **Landmarks:** already correct. `header`/`nav` (×2, both
    `aria-label`led)/`main id="main"`/`footer` are the only landmarks, one of
    each, and the skip-link (`Header.tsx`) correctly targets `#main`.
  - **Contrast:** audited computationally (WCAG relative-luminance formula,
    not eyeballed) against every token pair actually used for text —
    `ink`/`ink-soft` on `paper`, all six `Button.tsx` variants against their
    own backgrounds, `jade-100`/`jade-200` on `forest-800`/`forest-700`,
    `danger-500` on `paper`. Lowest ratio found was 6.58:1
    (`primary` button hover state, white on `forest-600`), every other pair
    cleared 7:1 — all comfortably above the 4.5:1 AA threshold for normal
    text. The palette was already built deliberately for this (`Button.tsx`'s
    own comment: "Marigold on deep forest is the highest-contrast pairing in
    the palette"), so this item is a clean audit result, not a fix.

  **Heading order — one real inconsistency, fixed.** Grepped every `<h1`
  in `apps/web/src`: exactly two, `SectionIntro.tsx` and `home/Hero.tsx`,
  and every route composes exactly one of the two (home → `Hero`, all ~35
  other routes → `PageTemplate` → `SectionIntro`), so there's reliably one
  `h1` per page with no risk of a page defining zero or two. The one real
  bug: `MegaMenu.tsx`'s column headings were `<h2>` while `MobileNav.tsx`'s
  identical column headings (same content, same `headings.<key>` translation
  key, just a different viewport) were `<h3>` — same semantic content at two
  different heading levels, and both live in header chrome that precedes the
  page's own `h1` in document order whenever a panel is open, which a screen
  reader's heading-navigation command would surface directly. Changed
  `MegaMenu.tsx` to `<h3>` to match `MobileNav.tsx`, with a comment
  explaining why (not "restating what the code does" — the *why* is the
  document-order relationship to the page's own `h1`, which isn't visible
  from the line itself).

  **Focus trap in the mobile drawer — the substantial piece, built from
  scratch.** Confirmed first (grepped the whole app) that nothing like this
  existed anywhere: no `role="dialog"`, no `aria-modal`, no `inert`, no
  focus-trap utility. The drawer (`Header.tsx`'s `#mobile-drawer`) opened and
  closed correctly and Escape already closed it (global keydown handler),
  but Tab could walk straight out of the drawer into `main`/`footer` behind
  it — both visually hidden under the fixed overlay but still in the tab
  order and still reachable by a screen reader's landmark navigation — and
  focus was never moved into the drawer on open or back to the hamburger
  button on close.

  New `lib/focusTrap.ts` + colocated `lib/focusTrap.test.ts` (5 cases): a
  single pure function, `shouldWrapFocus(activeElement, first, last,
  shiftKey)`, deciding only *whether* Tab/Shift+Tab should wrap and to which
  end — comparing element identity, never touching `document` or calling
  `.focus()` itself, so it's fully testable with plain values and needs no
  jsdom (this app has never had a DOM testing environment configured; adding
  one — `jsdom` + a React testing library — for one hook felt like the wrong
  trade for what's genuinely a two-branch boundary check). New
  `hooks/useFocusTrap.ts` (the first file in a new `hooks/` directory, no
  DOM-wiring test — verified instead by driving a real browser, same
  methodology every prior interactive-behaviour run in this log has used)
  wires that pure function to the actual DOM: on activation, moves focus to
  the first focusable element inside the container (falling back to the
  container itself, which is why the drawer `<div>` now carries
  `tabIndex={-1}`), marks `main`/`footer` `inert` for the duration so a
  screen reader can't wander behind the modal, and on deactivation restores
  focus to a caller-supplied `returnFocusRef` (the hamburger button) rather
  than trusting `document.activeElement`, which Safari doesn't reliably set
  on a mouse click.

  `Header.tsx`: added `mobileToggleRef`/`mobileDrawerRef`, one
  `useFocusTrap(mobileDrawerRef, mobileOpen, { returnFocusRef:
  mobileToggleRef })` call, and `role="dialog"` `aria-modal="true"`
  `aria-label={t('actions.menuLabel')}` `tabIndex={-1}` on the drawer
  wrapper. New `nav.actions.menuLabel` key ("Menu" / "मेनु") added to both
  message files — reused nowhere existing since `openMenu`/`closeMenu` are
  action labels for the toggle button, not a name for the dialog itself, and
  conflating the two would read oddly to a screen reader ("dialog: Open
  menu").

  **Considered and deliberately reverted: `aria-haspopup="true"` on the
  desktop mega-menu triggers.** Added it first, then re-read `MegaMenu.tsx`'s
  own comment — "The panel is a region rather than a menu: it holds links,
  not commands" — a previous run's deliberate choice not to use the ARIA
  `menu` widget pattern (which requires arrow-key/Home/End navigation this
  panel doesn't implement). `aria-haspopup="true"` specifically signals that
  `menu` pattern to assistive tech, so adding it would have set a false
  expectation for exactly the audience this task is about. Reverted before
  committing; `aria-expanded`/`aria-controls` alone is the correct, already-
  present signal for a disclosure controlling a plain link region.

  **Keyboard walkthrough of the mega-menu found a second real, more
  consequential bug, also fixed:** driving the actual desktop trigger button
  with headless Chromium (not just reading the code) showed that focusing it
  (Tab arrival) correctly opened its panel via `onFocus`, but a *following*
  Enter press, or a mouse click after a hover had already opened it,
  immediately closed the panel again. Cause: `onClick` toggled
  (`setOpenSegment(expanded ? null : segment.key)`), and by the time a click
  or Enter-activation event reaches the button, `onFocus`/`onMouseEnter` has
  already flipped `expanded` to `true` for that render — so the click's own
  toggle reads the now-open state and closes it. Net effect: a touchscreen
  user tapping the trigger (no separate hover event on touch, so tap =
  focus+click almost simultaneously) or a screen-reader/keyboard user
  pressing Enter/Space to explicitly "activate" a button with
  `aria-expanded` — the expected interaction for a disclosure control — saw
  the panel flash open and immediately close. Fixed by making `onClick`
  unconditionally open (`setOpenSegment(segment.key)`) rather than toggle:
  the panel already has three independent ways to close (Escape, an outside
  click, blurring the header), so `onClick` doesn't need to be a fourth, and
  removing the toggle removes the race with the focus/hover state entirely.

  Verified end to end with headless Chromium (system Playwright, run from
  inside `/opt/node22/lib/node_modules/playwright`'s own directory so plain
  ESM `import 'playwright'` resolves — `NODE_PATH` alone didn't work for
  ESM's resolver on this container, worth noting for a future run hitting
  the same `ERR_MODULE_NOT_FOUND`) against the production build
  (`pnpm build && pnpm start`): drawer `role="dialog"`/`aria-modal="true"`/
  `aria-label` all present; focus lands inside the drawer on open; both
  `main` and `footer` report `.inert === true` while open and `false` after
  close; Shift+Tab from the first focusable element wraps to the last and
  Tab from the last wraps back to the first; Escape closes the drawer *and*
  returns focus to the hamburger button (checked by element identity, not
  just visibility); the mega-menu panel now stays open through both Enter
  and a real click, in both orders (focus-then-Enter, hover-then-click); its
  column headings render as `H3` on both viewports; the page's `h1` count
  stays exactly 1 with a panel open; Escape still closes the mega-menu;
  confirmed the drawer's `aria-label` reads "मेनु" on the bare (Nepali)
  path and "Menu" under `/en`. Three unrelated pre-existing 404s
  (`/signin`, `/register`, `/get-care` RSC prefetches) showed up in the
  console during this pass — not a regression, matches this log's own
  earlier notes that those routes don't resolve yet. All green
  (install/lint/typecheck/test/build — `pnpm test` includes the five new
  `lib/focusTrap.test.ts` cases).

  **For the next run:** the queue's next unchecked item moves into
  "Platform core": `apps/api`'s records module exposing capture, list,
  timeline and confirm/correct/reject endpoints over `packages/health-records`,
  with the storage port injected. This is a different kind of task than any
  run in the "Marketing site"/"Visual system" sections above — read
  `docs/architecture/platform-vision.md` §3.2 and `packages/health-records`'s
  actual source (not just this ledger's summary of it) before starting, and
  note the standing constraint this module has to hold from day one: only
  `CONFIRMED`/`CORRECTED` observations may ever be exposed to anything
  downstream (the assistant, a share link, an export) — a `DRAFT` extraction
  must never leave this module's own boundary.

- 2026-08-08 — Built `sitemap.ts`, `robots.ts`, per-route `generateMetadata`
  and `Organization`/`WebSite` structured data. This is a retroactive item —
  it had to touch all 40 existing static routes plus the one dynamic
  health-library route, not add a new one, per the previous run's own note.

  **Single source of truth, not 40 hand-written metadata blocks:** new
  `content/routes.ts` is one `RouteEntry[]` — `{ pathname, titleKey,
  descriptionKey }` — that both `sitemap.ts` and every page's
  `generateMetadata` read from. It's assembled from the shared content
  arrays that already exist rather than re-listing the same routes a second
  time: `individualsPages` (15 routes), `organizationPartnerPages` (3
  routes, keyed to `home.organizations.tabs.<key>` since that's where their
  hero copy actually lives — see `content/organizations.ts`'s own doc
  comment) and `healthLibraryArticles` (3 slugs), plus 22 bespoke entries
  for every route with no shared array (home, pricing, the clinicians/
  company/legal pages, individuals utility pages). Every `titleKey`/
  `descriptionKey` points at a `hero.title`/`hero.body` pair the page
  already renders — checked namespace-by-namespace against both message
  files before writing the registry — so there is no second, SEO-only
  sentence anywhere that could drift from what the page actually says.
  `getRouteEntry(pathname)` throws on an unknown pathname rather than
  silently returning nothing, so a typo'd route in a future page.tsx fails
  loudly instead of shipping with no metadata.

  **New `lib/seo.ts`:** `siteUrl` falls back to `https://example.invalid`
  (no production domain configured anywhere in the repo — reusing the same
  reserved-for-documentation placeholder pattern `packages/configuration`
  already uses for the support email, rather than inventing a real-looking
  domain). `isDemonstrationBuild` is `brandConfig.legalEntity.registrationId
  === null` — deliberately not a new standalone flag: it's the same concrete
  fact `legal/privacy` already keys its own copy off ("no registered legal
  entity yet"), so registering a real entity is the one change that reopens
  indexing everywhere at once, with nothing to remember to edit by hand in a
  second place. `absoluteUrl`/`alternateLanguages` hand-roll the
  `localePrefix: 'as-needed'` rule (bare path for `ne`, `/en` prefix for
  everything else) instead of going through `next-intl/navigation`'s
  `getPathname` — that pulls in Next's client-router bindings, which choked
  vitest's module resolution when a plain test tried to import it (see
  below); the rule itself is three lines, not worth the dependency here.
  `createRouteMetadata(pathname)` is the one line every page.tsx needed:
  looks the route up in the registry and returns a ready-to-export
  `generateMetadata`. The health-library `[slug]` route is the one page that
  couldn't use it directly (the pathname isn't known until `params`
  resolves), so it calls `buildPageMetadata` itself after looking the
  article up — same registry, same helper, just not the same one-liner.

  **`robots.ts` blocks crawling outright while `isDemonstrationBuild` holds**
  (`Disallow: /`), rather than relying on the per-page `noindex` meta tag
  alone — a crawler that never fetches a page never has a reason to index
  it. The existing per-page `robots` meta in `[locale]/layout.tsx` (already
  `index:false, follow:false` from an earlier run, hardcoded) now reads
  `isDemonstrationBuild` too, so both mechanisms key off the same field
  instead of one being a hardcoded literal that silently drifts from the
  other. `sitemap.ts` still advertises `sitemap.xml` in `robots.txt`
  regardless — Google explicitly treats the sitemap directive as independent
  of disallow rules, and it costs nothing to have ready for when indexing
  turns on.

  **Structured data — new `components/seo/OrganizationJsonLd.tsx`,** an
  `Organization` + `WebSite` `@graph` rendered once in `[locale]/layout.tsx`
  (site-wide, not per-page). Deliberately minimal: `name`/`alternateName`
  from `brand.name`/`brand.nameLatin` (copy already shown in the page
  `<title>` and header), `url`, and `logo`. No `sameAs`, no `contactPoint`,
  no address. The footer's social icons link to generic platform homepages
  (`facebook.com`, not an actual Mero Health profile) and
  `brandConfig.contact.supportEmail` is an explicit `.invalid` placeholder
  that isn't rendered anywhere in the UI yet — surfacing either to a search
  engine as if it were real would be exactly the fabrication the standing
  constraint rules out, so both are left out entirely rather than included
  with caveats.

  **The one real asset in the repo got wired up as a side effect:**
  `public/mero-health-social.png` existed, unused, since before this run.
  New `socialImageUrl()` in `lib/seo.ts` points every page's `openGraph`/
  `twitter` image and the JSON-LD `logo` at it. Caught two locale bugs while
  wiring this in, both from the same wrong assumption (that a public asset
  needs the same locale-prefixing a route does): first pass ran it through
  `absoluteUrl`, which happily produced `/en/mero-health-social.png` for
  English pages — a URL that 404s, since `proxy.ts`'s own matcher
  (`'/((?!api|_next|_expo|app|.*\\..*).*)'`) explicitly excludes any path
  with a file extension from locale rewriting; static files are always
  served at the same bare path no matter which locale is rendering the
  page. Fixed by dropping the `locale` parameter entirely — `socialImageUrl`
  takes none, on purpose, and a doc comment on it explains why so the next
  run doesn't reintroduce the same bug reaching for consistency with
  `absoluteUrl`. Second bug was a stale dev-server false negative during
  verification, not a code bug: a `pnpm start` from an earlier `pnpm build`
  was still bound to :3000 from a previous shell in this same run, so
  curling "after the fix" was silently hitting the pre-fix build the whole
  time. `kill %1` didn't touch it — background jobs don't carry across
  separate Bash tool calls in this environment — `fuser -k 3000/tcp` did.
  Worth recording for a future run doing its own local server verification:
  confirm the port is actually free (or the response content actually
  changed) before trusting a "looks fixed" curl.

  **Also fixed one unrelated lint error surfaced while adding the JSON-LD
  component:** `@typescript-eslint/no-unnecessary-type-assertion` on `locale
  as (typeof routing.locales)[number]` inside the page body — `hasLocale()`
  a few lines above is a type guard, so by the time that line runs `locale`
  is already narrowed to `Locale` and the cast was dead weight. The
  identical-looking cast a few lines up inside `generateMetadata` is still
  required there — different function, `locale` there is a plain
  `params`-sourced `string`, never run through `hasLocale`.

  **New `apps/web/vitest.config.ts`, the first one this app has needed:**
  every test file up to now only imported plain content/data modules with no
  `@/` alias and no `.tsx` in their import graph, so nothing ever exercised
  vitest's module resolution against this app's actual `@/*` → `./src/*`
  tsconfig path or against a React component. `lib/seo.test.ts` and
  `content/routes.test.ts` (both new — the working agreement's "colocated
  test beside the source" applies here the same as it did for
  `content/pricing.test.ts`) are the first to do either, since `routes.ts`
  transitively imports the art `.tsx` components through
  `individualsPages`/`healthLibraryArticles`. Two real fixes were needed:
  the `@` alias needs to be configured by hand (`resolve.alias`, mirroring
  `tsconfig.json`'s path exactly — Vite does not read tsconfig paths on its
  own), and `tsconfig.json`'s `"jsx": "preserve"` (correct for Next's own
  compiler, which does its own JSX transform downstream) makes Vite's
  default oxc transformer refuse to touch JSX at all when read verbatim —
  fixed by setting `oxc: false` and `esbuild: { jsx: 'automatic' }` to fall
  back to the esbuild transform path for the test run specifically; the app
  build itself is untouched. `getPathname` from `next-intl/navigation` hit a
  *third*, harder problem in this same investigation — Node ESM resolving it
  to the `react-client` condition and failing to resolve `next/navigation`
  from there — which is what led to hand-rolling `localizedPathname`
  instead of fighting a fourth layer of module-resolution configuration for
  a three-line rule.

  Verified end to end: `pnpm build` lists `/robots.txt` and `/sitemap.xml`
  as static routes alongside every existing page. Served the production
  build and confirmed with `curl`: `robots.txt` is `Disallow: /` site-wide
  (matches `isDemonstrationBuild === true` today); `sitemap.xml` lists every
  route twice (bare `ne`, prefixed `en`) with correct `hreflang` alternates
  pointing at each other; `/pricing` and `/en/pricing` each render their own
  `<title>`, meta description, canonical and `og:`/`twitter:` tags in the
  right language (checked against the actual catalogue-driven copy from the
  Pricing run, not re-typed by eye); an unknown health-library slug still
  404s and carries no metadata (`generateMetadata` returns `{}` for it,
  falling through to the page's own `notFound()`); the JSON-LD `@graph` on
  every page contains only `brand.name`/`brand.nameLatin`/`brand.tagline`
  and the real social image URL, checked against both locales' rendered
  HTML; `og:image`/`twitter:image` resolve to `/mero-health-social.png`
  unprefixed on *both* `/pricing` and `/en/pricing` (this is the specific
  regression the locale-prefixing bug above would have shipped silently —
  confirmed by curling both after killing the stale server). All green
  (install/lint/typecheck/test/build — `pnpm test` includes the ten new
  cases across `lib/seo.test.ts` and `content/routes.test.ts`).

  **For the next run:** the queue's next unchecked item is the
  Accessibility pass — heading order, landmarks, focus traps in the mobile
  drawer, contrast, and a keyboard walkthrough of the mega-menu. That closes
  out "Marketing site" entirely; the queue after it moves into "Platform
  core" (the `apps/api` records module), a different kind of task than any
  run so far has done — read `docs/architecture/platform-vision.md` §3.2 and
  `packages/health-records` before starting it, not just this file.

- 2026-08-08 — Built the Pricing page (`/pricing`), driven end to end by
  `@swasthya/entitlements`'s `plans` array — the first marketing route in
  `apps/web` that pulls real values out of a domain package rather than
  writing them as copy, and the first task in the "Marketing site" section
  where a wrong *number* was the specific risk rather than a wrong claim.

  **Wiring the package in, not just reading it:** `apps/web` had never
  depended on `@swasthya/entitlements` before this run (only
  `@swasthya/configuration` and `@swasthya/shared-types` were wired in).
  Added it to `apps/web/package.json` dependencies, added it to
  `next.config.ts`'s `transpilePackages` (it ships TS source under the
  `react-native`/`types` export conditions the same way `configuration` and
  `shared-types` already do, so it needs the same transpile treatment), and
  ran a plain `pnpm install` (not `--frozen-lockfile`) once to update
  `pnpm-lock.yaml` for the new workspace edge — confirmed
  `--frozen-lockfile` passes clean afterward.

  **What's actually on the page:** hero, then a three-card comparison grid
  (`components/pricing/PricingView.tsx`) — one card per `plans` entry,
  reading `nameNe`/`nameEn`, `descriptionNe`/`descriptionEn`, and
  `monthlyPricePaisa` (through the package's own `formatPrice`) directly off
  each `PlanDefinition`. Every card lists all ten `ModuleKey`s with a
  check/dash per plan (`plan.modules.includes(moduleKey)`) and all five
  quota dimensions with their actual limit or "Unlimited" for a `null`
  limit, then closes on the shared CTA band. Nothing about a price, a
  module's inclusion, or a limit is hand-typed anywhere in this component —
  changing what a plan costs or includes means editing the catalogue, and
  the page picks it up automatically.

  **New typed helper, `content/pricing.ts`, and the first `index.test.ts`
  this run wrote for `apps/web` itself** (every prior marketing run relied
  on manual browser verification only, since `apps/web`'s `test` script has
  always run with `--passWithNoTests` and no `.test.tsx` file exists
  anywhere else in the app — this is the first page with real data-shaping
  logic worth a unit test, not just static copy). `PRICING_MODULE_ORDER` is
  deliberately *not* a second hand-maintained list of the ten module keys —
  it's read straight off `getPlan('PRO').modules`, since `entitlements`'s
  own test suite (`never removes a module as the tier goes up`) already
  guarantees PRO is the superset of every lower tier, so PRO's own order is
  a safe canonical order for the comparison grid. `PRICING_QUOTA_ORDER` is
  the one array in this file that *isn't* derived from the catalogue (
  `QuotaDimension` is a union, not something iterable) — flagged as such in
  its own comment so a future reader doesn't assume every constant here is
  catalogue-sourced. `formatQuotaValue` mirrors `formatPrice`'s own
  `ne-NP`/`en-NP` locale mapping for consistency. `content/pricing.test.ts`
  checks the module-order list actually contains every module any plan
  offers (would catch it silently dropping one if PRO's list ever
  regressed) and that `formatQuotaValue` defers to the real `Intl` grouping
  for both locales rather than asserting a hardcoded digit string (Nepali
  locale formatting isn't something to guess at in a test).

  **Content grounding — labels only, no new facts:** the ten module labels
  and five quota labels needed for the comparison grid don't exist as
  phrases anywhere yet, so each was checked against existing vetted
  copy before being written rather than invented fresh: `HOSTED_STORAGE`,
  `DOCUMENT_EXTRACTION`, `DEVICE_SYNC` and `TELECONSULTATION`'s English
  labels ("hosted storage", "automatic document extraction", "device
  sync", "clinician consultations") come straight from
  `individuals.faqs.items.six.answer` (already-shipped copy on what the
  free plan doesn't include); their Nepali counterparts ("सुरक्षित
  भण्डारण", "स्वतः कागजात विवरण झिक्ने सुविधा", "उपकरण सिंक") likewise reuse
  that answer's exact wording. `ASSISTANT`, `HEALTH_RECORD`,
  `BRING_YOUR_OWN_STORAGE`, `CARE_DIRECTORY`, `RECORD_SHARING` and
  `PROVIDER_EXPORT` reuse the phrasing already sitting in each
  `PlanDefinition`'s own `descriptionNe`/`descriptionEn` in
  `packages/entitlements/src/index.ts` (e.g. PRO's descriptionNe literally
  ends "...भिडियो परामर्श", reused verbatim for `TELECONSULTATION`'s
  label). The footnote restates the tier-boundary fact from the package's
  own doc comment ("bring-your-own storage is free, hosted storage is
  paid") rather than paraphrasing it fresh a second way. No "most popular"
  or "recommended" badge on any tier — the impact page this run's
  predecessors built already states plainly that Mero Health hasn't
  reached real patients yet, so a popularity claim would be fabricated;
  the only visual distinction between cards is that the Free plan's button
  uses the `accent` (marigold) variant as the page's one highlighted
  action, which is a design choice about the lowest-friction path, not a
  claim about other users' behavior.

  **Nav wiring:** added `pricing` to `nav.items` (both locales) and wired
  the route into two places it was missing from — the individuals
  mega-menu's `explore` column (right after `faqs`) and the footer's
  `helpfulLinks` column (right after `contactUs`) — via `content/navigation.ts`.
  Ran the full key-parity check (recursive leaf-path diff) between
  `messages/en.json` and `messages/ne.json` before committing; both files
  have exactly the same key set, zero drift either direction.

  **Art:** `WorkplaceInvestment` (an office window with a rising bar series,
  "investment that compounds" — previously only used for
  `organizations/employers`, `clinicians/careers` and company `careers`)
  for the hero. Flagging this one honestly as a fit-over-reuse call, same
  as the `about`/`RecordTransform` precedent: `CalmMind` and `VitalsTrend`
  were tied for least-reused (3 each) going into this run, but neither's
  established metaphor ("calm ripples", "a tracked value over time") maps
  onto pricing/plans the way "investment that compounds" does, so thematic
  fit won over reuse-avoidance here, making this `WorkplaceInvestment`'s
  fourth use.

  Verified end to end: `pnpm build` lists `/[locale]/pricing` as SSG for
  both locales (`/pricing` bare for Nepali, `/en/pricing` for English —
  matching every other route's convention). Served the production build
  (`pnpm build && pnpm start`)
  and drove it with headless Chromium (`/opt/node22/lib/node_modules/playwright`,
  binary at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `args:
  ['--no-sandbox']`, `waitUntil: 'load'` for `goto` — same working recipe
  the last two runs' notes recorded). Confirmed the rendered prices exactly
  match the catalogue: Free → "निःशुल्क"/"Free", Plus → "रु ४९९"/"Rs 499"
  (49,900 paisa), Pro → "रु १,४९९"/"Rs 1,499" (149,900 paisa). Confirmed
  every module row and every quota row for all three cards against the
  actual `plans` array values (25/500/unlimited documents, 10/150/1,000
  extraction pages, 50/500/unlimited assistant messages, 1/5/25 share
  links, 1/3/10 devices — all present, all correct, "Unlimited" rendering
  only where the limit is genuinely `null`). `scrollWidth`/`clientWidth`
  equal at 375/768/1280px on both locales (no overflow). Confirmed real
  navigation: clicking the footer's `pricing` link (matched by `href`, not
  link text, same reasoning prior runs recorded for a bare-Nepali default
  locale) from `/individuals/faqs` lands on `/pricing`; each plan card's
  "Get started" button resolves to `/register`. All green
  (install/lint/typecheck/test/build — `pnpm test` includes the four new
  `content/pricing.test.ts` cases, all passing).

  **For the next run:** the queue's next unchecked item is
  `sitemap.ts`/`robots.ts`/per-route `generateMetadata` +
  `Organization`/`WebSite` structured data, with `robots` kept `noindex`
  while the demonstration notice is still shown. `/pricing` (this run) and
  every route built in prior runs still have no `generateMetadata` at all —
  that item covers the whole site retroactively, not just new pages, so
  expect it to touch nearly every `page.tsx` rather than add a new route.
  Check `packages/configuration` for what "the demonstration notice" refers
  to concretely before writing the `robots.ts` logic gating on it.

- 2026-08-08 — Built the Health library: `/health-library` (index) and
  `/health-library/[slug]` (article), the first genuinely dynamic route in
  `apps/web` — every prior page was a static folder. Closes out the
  "Marketing site" section's last zero-source-material item and, per the
  previous run's own note, fixes the `nav.items.healthLibrary`/footer
  `helpfulLinks` link that had 404'd since the mega-menu and footer were
  first built.

  **Why three articles, and why these three:** the ledger's own note on this
  item flagged the risk plainly — "no articles exist anywhere in the repo...
  this will need either an honest empty state or a very small typed set of
  genuinely-written articles that stay inside invent-no-facts." An empty
  state was ruled out because the task explicitly asks for an *article
  route*, and a route with nothing to route to would be pointless scaffolding
  ahead of content, the same reasoning `resource-center` used to justify
  *not* building a library two runs ago. So: a very small typed set, and
  deliberately not a new topic. `legal/privacy`'s `PrivacyView` already
  distilled "what's genuinely true today" down to exactly three principles
  (`PRINCIPLE_KEYS = ['storage', 'confirmed', 'safety']`) and already had
  that content vetted against `packages/configuration`/`clinical-safety`/
  `health-records` by a previous run. Rather than inventing a fourth topic
  with its own grounding risk, this run's three articles
  (`storageChoice`, `confirmedRecords`, `safetyCheck`) restate that exact
  triad in longer explainer voice — each closing with a `relatedPrompt` link
  back to the specific existing page the fact came from (`/legal/privacy`,
  `/individuals/faqs`, `/clinicians/commitment-to-quality` respectively),
  so the library routes deeper into real content instead of dead-ending.
  Nepali copy reuses the *exact* vetted phrasing from `legal.privacy`'s
  highlights and `individuals.faqs` answers three/four/five wherever the
  sentence was already right, rather than re-translating the same fact a
  third time and risking terminology drift (e.g. "इन्क्रिप्ट", "मस्यौदा",
  "पुष्टि" all carried over verbatim).

  **New typed content model:** `content/healthLibrary.ts` —
  `HealthLibraryArticle { key, slug, Art, artPosition, relatedHref,
  relatedNavKey }`, the same shape-per-array-entry pattern as
  `content/individuals.ts`. `getHealthLibraryArticle(slug)` is the one lookup
  both the index (mapping all of them) and the article route (finding one)
  use. Two new view components in `components/health-library/`:
  `HealthLibraryIndexView` (hero + `FeatureGrid` of the three articles,
  reusing `common.readMore` rather than `common.learnMore` since these are
  articles, not services) and `HealthLibraryArticleView` (hero + two body
  paragraphs + the `relatedPrompt` mint section, the same shape
  `PrivacyView`/`AccessibilityView` already established for a closing
  contact-style prompt, generalised to link anywhere via
  `article.relatedHref` instead of hardcoding `/contact`). Both share one
  `healthLibrary.cta` band (primary "Get started" → `/register`, secondary
  "See FAQs" → `/individuals/faqs`) across the index and all three articles,
  matching the `individuals.cta`/`organizations.cta` reuse precedent.

  **The dynamic route itself, new ground for this codebase:**
  `app/[locale]/health-library/[slug]/page.tsx` uses `notFound()` for an
  unknown slug and a `generateStaticParams` that returns only `{ slug }` —
  confirmed against Next.js's own documented pattern for a dynamic segment
  nested under another dynamic segment (the parent `[locale]` layout already
  enumerates locales; the child is invoked once per locale and only needs to
  add its own segment). `pnpm build` confirms this actually worked: both
  `/health-library` and `/health-library/[slug]` are listed under SSG with
  all three slugs prerendered for both `ne` and `en` (6 article pages + 2
  index pages, 8 routes total). Verified with `curl` against `pnpm start`
  that a made-up slug (`/health-library/does-not-exist`) returns a real 404,
  not a silent empty page.

  Art: three least-reused compositions specifically to avoid piling further
  onto `DiagnosticFocus`/`HabitSprout` (9 and 6 direct `Art:` usages
  respectively, before this run — counted via `grep -c "Art: X"` across
  `content/`/`components/`/`app/`). `RecordTransform` (2 uses before this
  run, tied for least-reused) for `confirmedRecords` — the most literal fit
  in the whole library, since it depicts a draft document becoming a
  structured record, exactly what that article explains. `HomeFirstVisit`
  (3 uses) for `storageChoice`, a deliberate stretch flagged honestly: its
  established meaning elsewhere is "ongoing point of contact," repurposed
  here as "your own space to keep something," which is a thinner fit than
  `RecordTransform`'s but avoids piling a sixth use onto `MemberRouting`
  (already the more literal "routing to a destination" choice). Index hero
  reuses `MemberRouting` anyway (its established use as the hub/index
  metaphor, matching `/legal`'s own index page) since an index page's
  identity as a hub is a stronger claim on it than a single article's is.
  `AroundTheClockCare` (3 uses) for `safetyCheck` — "always-on, running every
  time" maps onto "a check that runs before every single response, not just
  risky-looking ones" better than `DiagnosticFocus`'s "closer look" would
  have, and keeps this run from adding a tenth use to the single most-reused
  composition in the library.

  Verified end to end: `pnpm build` lists both new routes as SSG; counting
  generated HTML files directly under `.next/server/app` (excluding the
  `_not-found`/`_global-error` boundaries) gives 84 pages site-wide now, up
  from 76 after the Legal run above — the expected +8 (2 index pages + 3
  articles × 2 locales). Served the production build (`pnpm build && pnpm start`) and
  drove it with headless Chromium (`/opt/node22/lib/node_modules/playwright`,
  binary at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
  `args: ['--no-sandbox']`, same working setup every prior visual run has
  used). One new gotcha this run hit that prior runs' notes didn't:
  `page.goto(..., { waitUntil: 'networkidle' })` timed out at 30s on this
  container for reasons unrelated to the app (it passed instantly on the
  first route, then hung on the second) — switched to `waitUntil: 'load'`
  for every `goto` in the verification script and every navigation
  completed normally. Worth trying `'load'` first on this container instead
  of defaulting to `'networkidle'`, since the earlier `waitForLoadState`
  gotcha two runs ago was the opposite problem (client-side transitions
  never firing `'load'` again) — the fix differs by whether it's a full
  `goto` or an in-app `<Link>` transition, so don't conflate the two.
  `scrollWidth`/`clientWidth` equal at 375/768/1280px across both locales
  for both the index and all three articles (no overflow). Confirmed real
  navigation: clicking an article card on the index (matched by `href`, not
  by link text, since Nepali is the rendered locale by default and hard-coding
  an English name regex silently matches nothing) lands on the correct
  article; that article's `relatedPrompt` button correctly resolves to
  `/individuals/faqs` (there are two `/individuals/faqs` links on an article
  page — the `relatedPrompt` button and the shared CTA band's secondary link
  — `.first()` was needed to disambiguate in the test script, not a bug in
  the page); the homepage footer's previously-404ing `healthLibrary` link
  now resolves to `/health-library`. All green
  (install/lint/typecheck/test/build).

  **For the next run:** the queue's next unchecked item is the Pricing page
  driven by `packages/entitlements` ("the catalogue is the source of truth,
  so prices are never duplicated into copy"). Read `packages/entitlements/
  src/index.ts` before writing anything — the FREE tier and paid modules
  referenced loosely in `individuals.withoutInsurance`/`individuals.faqs`
  will need to become an actual rendered catalogue this time, with real
  `monthlyPricePaisa` values converted to display currency rather than the
  deliberately-numberless copy every prior run used. This is also the first
  task in the queue where a wrong number is the specific risk, not a wrong
  claim — double-check the paisa→rupee conversion and currency formatting
  before shipping it.

- 2026-08-08 — Built the five Legal/utility routes: `legal`, `legal/privacy`,
  `legal/community-guidelines`, `accessibility`, `help`. This was the
  previous run's own flagged next item, and its note that these pages would
  be "the most exposed to the invent-no-facts rule yet" held up — every
  sentence on `/legal/privacy` and `/legal/community-guidelines` was checked
  against `packages/configuration`'s `legalEntity: { displayName:
  'Demonstration entity — configure before launch' }` before being written.

  Five bespoke `View` components in `components/legal/` (mirroring the
  `company`/`clinicians` precedent — five different content shapes, so no
  typed content array), all using `SectionIntro`'s `tone: 'paper'` for the
  first time in the codebase, exactly where the previous run's note said it
  would eventually belong: stacking another full-bleed dark block under the
  permanently dark header reads as too heavy for a legal/utility page. None
  of the five closes on a `CtaBand` — `PageTemplate`'s own doc comment
  already names "legal, utility" as the pages that should omit one.

  **Content grounding, page by page:**
  - `legal` (`LegalIndexView`) is a routing hub to the other four — three
    cards (privacy, community guidelines, accessibility), the same
    `ContactView` card-grid shape reused verbatim. Its hero states plainly,
    in the first sentence, that Mero Health has no registered legal entity
    yet and that these are a description of behaviour rather than a signed
    contract — the fact every other page in this run had to not contradict.
  - `legal/privacy` (`PrivacyView`) does not attempt a lawyer-drafted
    policy — it says outright that it isn't one, since there's no registered
    entity to issue one from — and instead restates three things that are
    genuinely already true today, reusing the exact facts `individuals.faqs`
    items three and five and `company.about`'s highlights already
    established: BYO storage is client-encrypted before it leaves the
    device, only CONFIRMED/CORRECTED observations are ever reasoned over
    (a DRAFT never reaches the assistant, a share link or an export — the
    standing constraint stated as user-facing copy for the first time), and
    the deterministic safety check runs ahead of every model response. A
    closing prompt reuses `company.cta.primaryCta` ("Talk to our team") →
    `/contact` rather than inventing a new label for the same destination.
  - `legal/community-guidelines` (`CommunityGuidelinesView`) is an honest
    empty state, not fabricated rules: Mero Health has no feature yet where
    users interact with each other (no forums, reviews, public profiles), so
    drafting guidelines now would be governing something that doesn't exist.
    States plainly that real guidelines will be published before, not after,
    any such feature ships.
  - `accessibility` (`AccessibilityView`) is the one page in this run that
    had to hold two facts in tension: the ledger's own "Accessibility pass"
    queue item (heading order, landmarks, focus traps in the mobile drawer,
    contrast, a keyboard walkthrough of the mega-menu) is still unchecked,
    so a blanket "we're accessible" claim would misrepresent unfinished
    work. The three highlights are deliberately narrow and independently
    verifiable instead: semantic headings/landmarks (true throughout, per
    every `Section`/`SectionHeading`), `aria-hidden` art per the art
    direction's own "never render text as an image" rule (true), and
    `FaqList`'s native `<details>`/`<summary>` elements responding to a
    keyboard "the same way any browser control does" (true, and narrower
    than claiming the whole site — including the specifically-unaudited
    mega-menu — is keyboard-complete). A closing "Still ahead" section
    names the exact unchecked queue item rather than staying vague, then
    routes to `/contact` to report a barrier.
  - `help` (`HelpView`) has no separate help-desk content to draw on, so —
    same instinct as `ResourceCenterView`/`ContactView` — it routes to the
    three pages that already answer a support question
    (`/individuals/faqs`, `/individuals/how-it-works`, `/contact`) instead
    of a third copy of the same content.

  **Art:** `MemberRouting` (routing to the right document) for `legal`,
  reused a fourth time. `RecordTransform` (a lab report becoming a
  structured record) for `legal/privacy`, a direct fit for "how your data
  is handled," reused a third time. `HabitSprout` ("still forming") for
  `legal/community-guidelines`, the same "feature doesn't exist yet"
  metaphor `LeadershipView`/`ClinicalLeadershipView` already established,
  reused a third time. `CalmMind` and `AroundTheClockCare` both get their
  first dedicated use outside the homepage/condition pages here — `CalmMind`
  ("considered, unhurried") for `accessibility`, `AroundTheClockCare`
  ("available any time") for `help`, a genuine fit for a help center's job
  rather than a stretch.

  Verified end to end: `pnpm build` lists all 5 new routes as SSG for both
  locales (76 pages site-wide now, up from 66). Served the production build
  (`pnpm build && pnpm start`) and drove it with headless Chromium (system
  Playwright at `/opt/node22/lib/node_modules/playwright`, binary at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `args:
  ['--no-sandbox']` — without it `chromium.launch` hung until Playwright's
  own 30s timeout with no error message, worth flagging since the previous
  runs' notes don't mention needing it). All 5 routes × both locales ×
  375/768/1280px: `scrollWidth`/`clientWidth` equal everywhere, no overflow.
  Confirmed with real navigation (`page.locator('main').getByRole('link',
  ...).click()`, not a static href read) that all three `/legal` routing
  cards, both `/legal/privacy` and `/accessibility`'s "Talk to our team"
  buttons, and all three `/help` routing cards resolve to the correct
  destination in both locales — including on the `/legal` index itself,
  where an unscoped locator initially clicked a hidden duplicate of the
  same link text/href inside the header's mega-menu and silently failed to
  navigate; scoping to `main` fixed it. Also hit a second false negative
  worth recording for a future run: right after fixing the scoping, clicks
  still appeared to do nothing because `page.waitForLoadState('load')` never
  resolves for a Next.js client-side route change — the initial page's
  `load` event already fired and a `<Link>` transition doesn't refire it, so
  the URL check was reading the page too early. Fixed with
  `page.waitForURL(...)` instead. Confirmed via `footer a` extraction that
  all five previously-dead `helpfulLinks` hrefs (`/help`, `/legal`,
  `/legal/privacy`, `/accessibility`, `/legal/community-guidelines`) now
  resolve. All green (install/lint/typecheck/test/build).

  **For the next run:** the queue's next unchecked item is the Health
  library (index plus article route, with a typed content model). No
  articles exist anywhere in the repo, so — same as `resource-center`,
  `partners` and every other zero-source-material page before it — this
  will need either an honest empty state or a very small typed set of
  genuinely-written articles that stay inside "invent no facts" (no
  clinical claims, no cited studies that don't exist). Check whether
  `content/navigation.ts`'s `healthLibrary` href (`/health-library`,
  already in the footer's `helpfulLinks` column, still 404ing) implies a
  specific content shape before designing the typed model.

- 2026-08-08 — Built the six Company routes: `about`, `about/impact`,
  `about/leadership`, `careers`, `newsroom`, `contact`. This clears the
  "Marketing site" section's last item that had no dedicated content shape
  yet, and — per the previous run's own note — `/contact` was the
  highest-value single link to fix: nearly every CTA band built across every
  prior run points at it, and it 404'd until now.

  No `content/company.ts` typed array (unlike `individuals.ts`/
  `organizations.ts`): six genuinely different content shapes — a hero+
  highlights mission page, three honest empty states, and a bespoke
  contact-routing page — didn't justify one, the same call the clinicians
  run made for its four routes. Six new bespoke `View` components in
  `components/company/`, one `company` namespace added to both message
  files (mirrors the existing `clinicians`/`organizations` namespace shape:
  a shared `company.cta` band plus a `hero`/`emptyState`-or-`highlights`
  block per route). No new `nav.items` keys were needed — `aboutUs`,
  `ourImpact`, `leadership`, `careers`, `newsroom`, `contactUs` all already
  existed (mega-menu `explore` columns and the footer's `whoWeAre`/
  `helpfulLinks` columns already referenced every one of these six hrefs;
  none of the six resolved before this run).

  **Content grounding, checked before writing a word — the same instinct as
  every prior content run:**
  - `about` is the one page here with real facts to draw on: restates
    `platform-vision.md` §1's own three pillars (personal EHR, storage
    choice, Nepali-first assistant with safety ahead of the model) in
    company-facing voice. The storage-choice highlight reuses
    `organizations.ourApproach`'s own sentence near-verbatim, since it's
    the identical standing fact already established there — same precedent
    as `commitment-to-quality` reusing the safety-check sentence for a
    different audience two runs ago.
  - `about/impact`, `about/leadership`, `careers` (company-wide) and
    `newsroom` have zero source material — no usage figures, no leadership
    roster, no job listings, no press coverage exist anywhere in the repo —
    so all four are honest empty states (`clinical-leadership`/
    `clinicians-careers`/`events`' pattern: a heading like "Not yet
    announced" plus a body naming what happens next), not fabricated
    figures or listings. `impact` in particular says plainly that Mero
    Health hasn't reached real patients yet rather than implying otherwise.
  - **`careers` (`/careers`) vs `clinicians/careers` (`/clinicians/careers`)
    — flagged explicitly by the last run's note not to collapse these.**
    They stay two separate pages with separate copy: this one is
    company-wide hiring (engineering, design, clinical safety — named
    because those are real, already-built areas of the repo, not invented
    departments), the existing one is clinical hiring specifically. Its CTA
    band overrides the secondary link to `/about` (not the shared
    `company.cta` default of `/careers`, which would point at itself) —
    same self-link guard `clinicians/careers` already established.
  - **`contact` had no existing content to restate and could not invent
    any** — no real email, phone or address exists in the repo
    (`packages/configuration`'s `support@example.invalid` and the footer's
    `addressPlaceholder`/`demoNotice` are explicit placeholders marked
    "configure before launch"). A contact *form* was also ruled out: nothing
    in `apps/web` calls any backend, so a form would submit nowhere. Instead
    `ContactView` is a bespoke routing page — no existing shape fit, the
    same reasoning that gave `faqs` its own `FaqList` component — with three
    cards sending "why are you here" traffic to the page that actually
    answers it (`/careers`, `/organizations/our-approach`, `/newsroom`).
    Deliberately has **no closing `CtaBand`**: this page already *is* "talk
    to our team," so a band pointing back at `/contact` from `/contact`
    would be circular — the one page in this run that omits the shared
    `company.cta`, matching `PageTemplate`'s own documented "omit for pages
    that shouldn't end on a CTA band."

  **Art:** one new-to-this-page reuse worth flagging — `about` reuses
  `RecordTransform`, the homepage hero's signature illustration and (per
  the last art-focused run's note) the least-reused piece in the library.
  Breaking from "least-reused first": `RecordTransform` depicts "a lab
  report becoming a structured record" — literally what `/about` exists to
  explain — and no other composition matches that specific idea, so
  thematic fit won over reuse-avoidance here. The other five: `VitalsTrend`
  (a trend line standing in for "the impact we'll eventually measure," no
  real data shown) for `impact`; `HabitSprout` for `leadership`, deliberately
  the *same* choice `clinical-leadership` already made for the identical
  "team still forming" metaphor; `WorkplaceInvestment` for `careers`
  despite already being on its third use (`clinicians/careers`,
  `organizations/events`) — no other composition fits "careers" as well as
  its "investment that compounds" framing, so this is a flagged repeat, not
  an oversight; `HospitalReach` for `newsroom` ("signal reaching outward"
  extended from facilities to press); `MemberRouting` for `contact` (a
  routing metaphor, and this page's entire job is routing the visitor
  onward).

  Verified end to end: `pnpm build` lists all 6 new routes as SSG for both
  locales (68 pages site-wide now, up from 62). Served the production build
  (`pnpm build && pnpm start`) and drove it with headless Chromium (system
  Playwright at `/opt/node22/lib/node_modules`, binary at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, same approach as
  every prior visual run). All 6 routes × both locales × 375/768/1280px:
  `scrollWidth`/`clientWidth` equal everywhere, no overflow. Confirmed with
  real navigation (not just static hrefs) that the previously-404ing footer
  `whoWeAre` links (`/about`, `/about/impact`, `/about/leadership`,
  `/careers`, `/newsroom`) and the mega-menu's `aboutUs`/`ourImpact`/
  `contactUs` entries across all three segments now resolve to 200;
  confirmed `/careers`'s CTA correctly points its secondary link at `/about`
  rather than itself; confirmed `/contact`'s three routing cards resolve to
  `/careers`, `/organizations/our-approach` and `/newsroom` respectively.
  All green (install/lint/typecheck/test/build).

  **For the next run:** the queue's next unchecked item is the Legal routes
  (`legal`, `legal/privacy`, `legal/community-guidelines`, `accessibility`,
  `help`). Like this run and the clinicians run, expect no single typed
  content array to fit — legal text, an accessibility statement and a help
  page are three different shapes. Check `packages/configuration`'s
  `legalEntity: { displayName: 'Demonstration entity — configure before
  launch', ... }` before writing anything: these pages will be the most
  exposed to the "invent no facts" rule yet, since legal/privacy copy
  usually implies a real registered entity, real data-processing terms and
  a real jurisdiction contact, none of which exist here. `SectionIntro`'s
  `paper` tone (used nowhere yet — every route so far has used the default
  `forest` tone) was flagged as the intended fit for legal/utility pages
  back when `SectionIntro` was first built ("stacking another full-bleed
  dark block... would read as too heavy") and still hasn't been exercised;
  this is likely the first section where it actually belongs.

- 2026-08-08 — Built the four Clinicians routes: `our-providers`,
  `clinical-leadership`, `careers`, `commitment-to-quality`. Unlike the
  Organizations run before this one, none of these four had existing content
  to lean on — `content/navigation.ts`'s clinicians segment has no anchor
  children, so all four are standalone bespoke `View` components in
  `components/clinicians/` (mirroring `OurApproachView`/`PartnersView`/
  `EventsView`, not the anchored `OrganizationPartnerView` shape), rather than
  a typed content array like `content/individuals.ts`/`content/organizations.ts` —
  four genuinely different content shapes didn't justify one.

  **Content grounding, checked before writing a word:** the repo has real
  facts to draw on for two of the four pages and none for the other two, so
  they got different treatment rather than uniform hero+highlights copy.
  - `our-providers` restates what `home.services` already establishes
    (`primaryCare`: "board-certified providers... one clinician";
    `mentalHealth`: "licensed therapists and psychiatrists... in your own
    language", reused near-verbatim) plus the Nepali/day-or-night reachability
    already in `individuals.howItWorks` steps three and four. No headcount,
    no named clinicians — the network's *kind*, not its *size*.
  - `commitment-to-quality` restates the standing constraints directly:
    the `emergencyServices` sentence from the Organizations run
    ("A deterministic safety layer runs ahead of every assistant
    response...") is reused verbatim since it's the same standing fact for a
    different audience, and the CONFIRMED/CORRECTED-only rule and "the
    assistant does not diagnose" line both paraphrase the FAQ answers already
    shipped under `individuals.faqs`.
  - `clinical-leadership` and `careers` have zero source material — no
    leadership roster, no job listings exist anywhere in the repo — so both
    are honest empty states (`EventsView`'s pattern: a heading like "Not yet
    announced" / "No open roles right now" plus a body that says what happens
    next), not hero+highlights forced onto nothing. `careers`' hero title
    reuses `nav.promos.clinicians.title` ("Simplify your work. Amplify your
    impact.") verbatim rather than writing a second, competing headline — the
    mega-menu promo tile and this dedicated page make the same pitch.

  **One shared-CTA wrinkle the Organizations run's `resource-center` case
  didn't fully resolve, so this run did it differently:** all four pages
  close on one `clinicians.cta` band ("Talk to our team" → `/contact`, "See
  open roles" → `/clinicians/careers`), except `careers` itself, which can't
  link to itself. The `resource-center` precedent changed the *href* but left
  the *label* pointed at the old destination ("Explore the resource center"
  linking to `/organizations/our-approach`) — a label/destination mismatch.
  `CareersView` avoids repeating that: its own secondary link overrides both
  href and label together (`nav('items.ourProviders')` → `/clinicians/our-providers`),
  so the visible text always names where the link actually goes.

  Art: no new SVGs. `HomeFirstVisit` (a house = ongoing point of contact) for
  `our-providers`, `WorkplaceInvestment` (career/investment growth) for
  `careers`, `DiagnosticFocus` ("a closer look" → a quality review) for
  `commitment-to-quality`. `clinical-leadership` is the stretch of this run,
  same as `events` was last time: `HabitSprout` (a sprout growing) stands in
  for "the team is still forming," which is honest but not a tight visual
  match — flagging it the same way the Organizations log flagged `events`,
  in case a future art pass wants a purpose-built leadership composition.

  Verified end to end: `pnpm build` lists all 4 routes as SSG for both
  locales (62 pages site-wide now, up from 54). Served the production build
  (`pnpm build && pnpm start`, plain `next start`, not `next dev` — no stray
  `AGENTS.md`/`CLAUDE.md` regenerated this run) and drove it with headless
  Chromium (system Playwright at `/opt/node22/lib/node_modules`, binary at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` on this container —
  the `/opt/pw-browsers/chromium/...` path a couple of prior runs' notes
  imply doesn't exist here, recording the actual working path in case a
  future run hits the same `executable doesn't exist` error). Confirmed all
  8 routes return 200 (Nepali served bare, `/en` prefixed — `/clinicians/...`
  gives a 307 redirect if you hit it un-prefixed expecting `/ne/...`, which
  is correct: bare path *is* Nepali, not a locale-less path).
  `scrollWidth`/`clientWidth` equal at 375/768/1280 on both locales for all 4
  routes (no overflow), and confirmed via a real hover interaction (not a
  programmatic style read — see two runs ago's log entry on why that
  distinction matters) that all four `/clinicians/*` links resolve correctly
  from the open mega-menu panel. All green
  (install/lint/typecheck/test/build).

  **For the next run:** the queue's next unchecked item is the Company routes
  (`about`, `about/impact`, `about/leadership`, `careers`, `newsroom`,
  `contact`). Note `/careers` here is a *different* route from this run's
  `/clinicians/careers` — the former is company-wide hiring (footer's
  `whoWeAre` column), the latter is clinician-specific (footer's `clinicians`
  column) — don't collapse them into one page. Also note `/contact` is
  referenced by nearly every CTA band built so far (this run's included) and
  still doesn't resolve; building it will fix a real, currently-broken link
  across most of the site, not just add a new one.

- 2026-08-08 — Built the seven Organizations routes: `employers`,
  `health-plans`, `hospitals-health-systems`, `our-approach`, `partners`,
  `resource-center`, `events`. Three different content shapes, not one,
  because the routes genuinely aren't the same kind of page:

  **`employers`/`health-plans`/`hospitals-health-systems` (new `kind:
  'partner'` in `content/organizations.ts`).** These three already had art
  and hero copy — `organizationTabs` in `content/home.ts` (used by the
  homepage `OrganizationTabs` tab panel) already carries each type's `Art`,
  `title` and `body`. Per the previous run's note, this run's
  `OrganizationPartnerView` pulls the hero straight from
  `home.organizations.tabs.<key>` instead of writing a second, competing
  hero — the homepage teaser and the dedicated page describe the same
  organisation type and must not drift apart. The genuinely new work is the
  anchored capability sections: `content/navigation.ts`'s mega-menu already
  links to `#integrated-care`, `#always-on-care`, `#chronic-care` (employers),
  `#integrated-care`, `#chronic-care` (health plans), and `#platform`,
  `#emergency`, `#inpatient-outpatient` (hospitals) — all of which 404'd
  past the hash before this run since the pages themselves didn't exist.
  Each section is a `Section` with `id={anchorId}` so those links now
  actually land, headed by the same `nav.items.<key>` string the mega-menu
  already uses (no duplicate heading copy), with new section body copy
  added under `organizations.<key>.sections.<navKey>.body`.
  **Content grounding for these six section bodies, the highest-risk copy
  in this run:** each one restates a fact already established elsewhere
  rather than describing new capability. "Integrated Care" and "Chronic
  Care" just point at the already-built individuals condition pages
  (primary care, mental health, chronic condition management). "24/7 Care"
  restates `home.services.care247`. "Virtual Care Platform" restates the
  hospitals tab's own existing body ("extend your own service with virtual
  reach"). "Emergency Services" describes `clinical-safety`'s actual,
  already-standing behaviour — a deterministic check ahead of every
  assistant response — not a claim of ER/hospital-system integration, which
  doesn't exist. "Inpatient & Outpatient Services" restates the
  `health-records` capture pillar (discharge summaries specifically, which
  `platform-vision.md` §3.2 already names) rather than inventing a
  discharge-integration feature. None of the six describe FHIR interop or
  hospital system integration (Tier 4, explicitly not yet built) as live.

  **`our-approach` (new `OurApproachView`).** Single-topic, so it reuses the
  Individuals condition-page shape: hero + a three-item `Highlights` list,
  same component `IndividualsPageView` already uses. All three highlights
  restate standing constraints verbatim in marketing voice (Nepali-by-
  default, the person keeps their own record via BYO storage, the
  deterministic safety check ahead of the model) — deliberately the
  safest copy in this run, since it's paraphrasing the constraints file
  itself rather than deriving anything new.

  **`partners` (new `PartnersView`).** Reuses `partnerPlaceholders` and the
  entire `home.partners` namespace (`heading`, `body`, `placeholderNote`)
  verbatim rather than writing a second disclaimer — the homepage marquee
  and this dedicated directory describe the exact same "no signed partners
  yet" state, and a second copy of that disclaimer risks drifting from the
  first. New copy is only the hero, and it was deliberately written to not
  imply live partnerships ("Partnerships in progress" / "each shown here
  only once a real agreement is signed and confirmed") rather than
  "Our partners," which the actual state (zero signed agreements, per
  `home.partners.body`) would make false.

  **`resource-center` (new `ResourceCenterView`).** No resource library
  exists — the separate, consumer-facing "Health library" queue item is
  further down and unbuilt — so rather than inventing articles this routes
  to the three organisation-type pages via `FeatureGrid`, reusing
  `organizationTabs`' `label`/`body` translations again rather than a third
  copy of the same three descriptions.

  **`events` (new `EventsView`).** No events exist, so this is an honest
  empty state ("Nothing scheduled yet") rather than fabricated listings —
  the same instinct behind `organizationTabs`'s em-dash stats, applied to a
  page instead of a stat slot.

  All seven share one `organizations.cta` CTA band (`primaryCta` → `/contact`,
  `secondaryCta` → `/organizations/resource-center`, except
  `resource-center`'s own band, which points its secondary link at
  `/organizations/our-approach` instead of itself). `/contact` is not yet
  built — tracked under the still-unchecked "Company routes" item — but it's
  already referenced by the footer and mega-menu today, so this isn't a new
  gap, matching the precedent already set for `/register`/`/app`/`/get-care`
  in earlier runs.
  Art: no new SVGs commissioned. The three partner pages reuse
  `organizationTabs`' existing `MemberRouting`/`WorkplaceInvestment`/
  `HospitalReach`. The four simple pages reuse thematically:
  `MemberRouting` (routing to the right care) for `our-approach`,
  `HospitalReach` (signal reaching outward) for `partners`, `DiagnosticFocus`
  ("a closer look") for `resource-center`, `WorkplaceInvestment` (investment
  in the relationship) for `events` — all a stretch for the last one in
  particular; flagging it in case a future art pass wants a purpose-built
  events composition instead.
  Verified end to end: `pnpm build` lists all 7 routes as SSG for both
  locales (54 pages site-wide now, up from 40). Served the production build
  and drove it with headless Chromium (system Playwright at
  `/opt/node22/lib/node_modules`, same approach as every prior visual run):
  `scrollWidth`/`clientWidth` equal at 375px and 1280px on both locales for
  all 7 routes (no overflow), and separately confirmed all eight `#anchor`
  links from `content/navigation.ts` resolve to the correct section on the
  correct page with the correct heading text (e.g.
  `/organizations/hospitals-health-systems#emergency` → "आपतकालीन सेवा" /
  "Emergency Services") — these were dead hash fragments before this run.
  All green (install/lint/typecheck/test/build).

  **For the next run:** the queue's next unchecked item is the Clinicians
  routes (`our-providers`, `clinical-leadership`, `careers`,
  `commitment-to-quality`). No existing content to lean on for these (unlike
  this run's partner pages) — `content/navigation.ts`'s clinicians segment
  has no anchor children, so a simpler hero + `Highlights` shape per route
  (like this run's `our-approach`) likely fits better than the anchored
  `OrganizationPartnerView` pattern. Watch the "board-certified providers" /
  "licensed therapists and psychiatrists" language already in
  `home.services` — `our-providers`/`clinical-leadership` copy needs to stay
  within what's already established there and not invent named clinicians,
  credentials or headcounts.

- 2026-08-08 — Built the three Individuals utility routes: `how-it-works`,
  `without-insurance`, `faqs`. First consumers of a real content shape other
  than `IndividualsPageView`'s condition/segment pair, per the previous run's
  note that these three don't fit that shape.
  Each got its own view component (`HowItWorksView`, `WithoutInsuranceView`,
  `FaqsView` in `components/individuals/`) composed from `PageTemplate` +
  `SectionIntro`, rather than forcing them into `content/individuals.ts`'s
  `ConditionPage`/`SegmentPage` union, which has no shape for "ordered steps"
  or "a Q&A list." All three skip the hero CTA (same as the segment pages) —
  they explain the product rather than routing straight into care, so the
  closing shared CTA band carries the one action instead of duplicating it in
  the hero.
  `howItWorks` reuses `Highlights` for four *ordered* steps rather than
  building a separate "steps" component — `Highlights` already renders a
  numbered 01/02/03 list with no assumption about count, so a sequence of
  four reads identically to the existing three-item "what this includes"
  usage; a bespoke `Steps` component would have duplicated it for no visual
  difference. `withoutInsurance` reuses the same component for three
  highlights and the existing `sectionHeadings.highlights` copy key ("What
  this includes"), consistent with the condition pages.
  `faqs` needed a new component, `FaqList` (`components/ui/FaqList.tsx`):
  native `<details>/<summary>` disclosures (no JS required to expand one) and
  a `FAQPage` JSON-LD `<script>` block built from the *same* `items` array
  the visible list renders from, per the task's "with FAQ schema.org
  markup" — one source, so the structured data can't drift from the visible
  copy. Verified the emitted JSON-LD by curling the built page and confirming
  `@type: FAQPage` with all six `mainEntity` question/answer pairs present.
  Art: reused three existing SVGs rather than commissioning new ones, since
  each already fit without recoloring — `MemberRouting` (a route to a
  destination) for how-it-works, `HospitalReach` (capability reaching
  outward) for without-insurance, `DiagnosticFocus` (a closer look at
  something specific) for faqs. `DiagnosticFocus` is now on its fourth route
  (three specialty-wellness children plus this), same reuse pattern already
  established for `VitalsTrend`.
  **Content grounding, the part of this task most at risk of "invent no
  facts":** `without-insurance` and three of the six FAQ answers describe the
  entitlements/pricing model. Checked `packages/entitlements/src/index.ts`
  before writing a word of copy — the FREE tier genuinely is
  `monthlyPricePaisa: 0` with `ASSISTANT`/`HEALTH_RECORD`/
  `BRING_YOUR_OWN_STORAGE`/`CARE_DIRECTORY`, and `HOSTED_STORAGE`/
  `DOCUMENT_EXTRACTION`/`DEVICE_SYNC`/`RECORD_SHARING`/`TELECONSULTATION` are
  genuinely separate higher-tier modules — so "start free" and "pay only for
  what you add" are real facts, not marketing invention. Deliberately used no
  numbers: the queue's own Pricing-page item says prices come from the
  catalogue and are "never duplicated into copy," so this run's copy names
  what's free and what's paid without a single rupee figure, leaving actual
  numbers for that later page. The FAQ on emergencies paraphrases the
  standing constraint text directly ("does not diagnose," "deterministic
  safety check before every answer"); the FAQ on automatic reading paraphrases
  the CONFIRMED/CORRECTED-only constraint just as directly. Left out two
  vision-doc pillars that would have been easy FAQ material —Tier 3 wearables
  and Tier 4 provider export/share links — because both are explicitly listed
  as *not yet built* in the queue's "Platform core" section; answering "can I
  connect a wearable?" affirmatively on a live FAQ page would misrepresent
  current capability even though the roadmap document mentions it, which is
  a different kind of invention than a fabricated statistic but still one
  the standing constraints are there to prevent.
  One real bug caught only by browser verification, not by the type
  checker or build: `FaqList`'s open/close "+" → "×" indicator
  (`group-open:rotate-45`) initially appeared inert under a naive test —
  setting `details.setAttribute('open', '')` via `page.evaluate` and reading
  `getComputedStyle` back in a *separate* `evaluate` call consistently showed
  `rotate: 0deg` even though the CSS rule was confirmed present and matching
  via `element.matches(rule.selectorText)`. Added `inline-block` to the
  icon span on the theory that `rotate`/`transform` has no effect on
  inline-level boxes — correct as a rule, but as it turned out not the actual
  cause here (the span was already a flex item of the `flex` `<summary>`,
  and flex items are blockified regardless of their own `display` value, so
  it was never truly inline in the way that matters). Kept the class anyway
  since it's accurate and harmless. The real fix was methodological, not a
  code change: a genuine mouse `.click()` on `<summary>` (rather than
  programmatically toggling the `open` attribute) showed `rotate: 45deg`
  immediately, and a cropped screenshot of the icon confirmed the visible ×.
  Recording this because it's a trap worth naming for a future run: verifying
  a `:hover`/`:open`/`:focus`-driven CSS effect by programmatically setting
  the DOM attribute/pseudo-state and reading `getComputedStyle` back in a
  separate `page.evaluate` call is not equivalent to a real interaction and
  can report a false negative — drive it with an actual `click()`/`hover()`
  and re-check before concluding a style rule doesn't work.
  Verified end to end: `pnpm build` lists all three routes as SSG for both
  locales (40 pages total site-wide now, up from 34). Served the production
  build and checked with headless Chromium (system Playwright, same approach
  as every prior visual run): `scrollWidth`/`clientWidth` equal at 375px and
  1280px on both locales for all three routes (no overflow); confirmed the
  homepage hero's secondary CTA (`Hero.tsx`, already linked to
  `/individuals/without-insurance` before this run) now resolves instead of
  404ing — a real, previously-broken link this task closes, not just a new
  route added in isolation. All green
  (install/lint/typecheck/test/build).

  **For the next run:** the queue's next unchecked item is the Organizations
  routes (`employers`, `health-plans`, `hospitals-health-systems`,
  `our-approach`, `partners`, `resource-center`, `events`). Note
  `content/home.ts`'s `organizationTabs` and `OrganizationTabs.tsx` already
  have art (`MemberRouting`, `WorkplaceInvestment`, `HospitalReach`) and
  stats-as-em-dash for `healthPlans`/`employers`/`hospitals` specifically —
  those three routes in particular should probably draw on that existing
  section rather than starting from nothing, the way this run's utility pages
  drew on `home.ts`'s FREE-tier facts instead of re-deriving them. `events`,
  `our-approach`, `partners` and `resource-center` have no existing content
  to lean on and will need new copy, same "invent no facts" care as this run
  and the condition-pages run before it.

- 2026-08-08 — Built the twelve Individuals routes, the first content
  consumer of `PageTemplate`/`SectionIntro`/`FeatureGrid`/`CtaBand`:
  `24-7-care`, `primary-care`, `mental-health`, `weight-management` (+
  `nutrition`, `diabetes-prevention`), `diabetes-management`,
  `hypertension-management`, `specialty-wellness` (+ `dermatology`,
  `expert-medical-opinion`, `sleep`). All 12 build statically for both
  locales (`next build` lists all 24 `ne`/`en` pairs as `SSG`).
  One shared component drives all twelve rather than 12 near-identical
  `page.tsx` bodies: `content/individuals.ts` holds a typed list (art,
  `artPosition`, and — the one real content decision here — a `kind`
  discriminant) and `components/individuals/IndividualsPageView.tsx`
  renders from it. `weightManagement` and `specialtyWellness` are `kind:
  'segment'` — they have no content of their own beyond routing to their
  own children, so they get a `FeatureGrid` linking to their sub-pages
  instead of a highlights list. Every other route is `kind: 'condition'`:
  hero + a new `Highlights` component (`components/ui/Highlights.tsx`, a
  plain numbered three-up text list, no icon). `Highlights` exists because
  `FeatureGrid` requires an `Art` per card and this task needed roughly 30
  short points across 10 leaf pages — illustrating every one would mean
  either 30 new SVGs (diluting "distinct composition, not recolored" past
  the point of meaning anything) or reusing the same handful of arts
  many times over on a single page, which reads as filler, not art.
  Hero art itself is still the existing 6 illustrations, reused
  thematically across the 12 pages (e.g. `VitalsTrend` for
  `diabetesManagement`/`hypertensionManagement`/`diabetesPrevention`,
  `CalmMind` for `mentalHealth`/`sleep`) — no route is ever shown next to
  its reuse-sibling, so this doesn't repeat the "recoloured icon" problem
  the art direction rejects, and building 6 more single-use illustrations
  for this task alone wasn't justified.
  All hero/highlights/children copy is new writing for this run, added to
  `individuals.*` in both message files (243 lines each) — nothing in the
  repo had condition-level marketing copy yet. Stayed inside "invent no
  facts": every sentence describes what the product *is* (Nepali-language
  calls, personal record, coaching, specialist access — all already
  established by `platform-vision.md` and `home.services`) with no
  statistics, named partners, credentials beyond what `home.services`
  already established ("licensed therapist", matching its existing
  "board-certified providers"/"licensed therapists and psychiatrists"), or
  outcome claims. The bottom CTA band is shared verbatim across all 12
  pages (`individuals.cta`) rather than 12 bespoke headings — a Teladoc-
  style condition-page pattern, and it avoids inventing a distinct "why
  act now" hook per condition where no such hook exists yet.
  Reused `nav.segments.individuals` for the hero eyebrow and
  `common.learnMore` for the `FeatureGrid` label instead of adding
  duplicate keys under `individuals.*` — both already existed for exactly
  this purpose.
  Deliberately out of scope, left for their own queued items: no bare
  `/individuals` segment-index route (not listed in this task's route set —
  the mega-menu's `/individuals` link still 404s, a pre-existing gap, not a
  regression); no `generateMetadata` per route (a separate queued item);
  `/get-care`, `/register` and `/app` still don't resolve (referenced
  identically by the homepage already, so not a new gap this task
  introduced).
  One real bug, caught by `pnpm build` rather than by inspection: the
  Python content-authoring script used `**highlights(items)` to splice a
  page's highlight content in, but `highlights()` returns `{"items":
  {...}}` — spread merges `items` in as a sibling of `hero` instead of
  nesting it under `highlights`, so `t('<key>.highlights.items.<n>.title')`
  resolved to nothing. `next build`'s static generation throws
  `MISSING_MESSAGE` per missing key (240 instances, one per locale/page/
  field), which is what surfaced it — `pnpm typecheck` can't catch a wrong
  JSON shape, and `pnpm test` doesn't touch `apps/web` message content.
  Fixed by nesting correctly (`"highlights": highlights(items)`) and
  re-running the generator idempotently. Recording the shape mismatch here
  in case a future run reuses this content-generation-script pattern for
  another route bucket: verify with `pnpm build`, not just `tsc`, since
  next-intl message keys are unchecked strings from TypeScript's point of
  view.
  Verified visually beyond the build: served the production build
  (`pnpm build && pnpm start`) and drove it with headless Chromium (system
  Playwright at `/opt/node22/lib/node_modules`, `PLAYWRIGHT_BROWSERS_PATH=
  /opt/pw-browsers`, same approach as every prior visual run) across a
  leaf condition page and a segment page, both locales, 375px and 1280px —
  `scrollWidth`/`clientWidth` came back equal at every point, no overflow.
  One capture artifact worth recording, distinct from the view-timeline one
  logged two runs ago: `fullPage` screenshots showed the sticky header
  (`Header.tsx`, `sticky top-0`) duplicated mid-page, overlapping the hero
  heading. This is Playwright stitching viewport-height slices while
  scrolling a `position: sticky` element — the header gets captured again
  at its pinned position partway down the stitched image — not a real
  layout bug. Confirmed with an ordinary (non-`fullPage`, no scrolling)
  screenshot of the same route: header and hero render correctly, no
  overlap. Filing both `fullPage` gotchas here (view-timeline reveals, now
  sticky headers) so a future run recognises the pattern instead of
  chasing a phantom bug: when a `fullPage` capture looks wrong but nothing
  else points to a real bug, re-check with a plain viewport screenshot
  before concluding the page is broken.
  All green (install/lint/typecheck/test/build).

  **For the next run:** the queue's next unchecked item is the Individuals
  utility routes (`how-it-works`, `without-insurance`, `faqs` with FAQ
  schema.org markup). `IndividualsPageView`/`content/individuals.ts` are
  specific to the condition/segment shape built this run and don't apply
  directly — `how-it-works` and `faqs` in particular will need their own
  content shape (steps, a Q&A list) rather than hero+highlights. The
  `/individuals` segment-index route and per-route `generateMetadata` are
  still open gaps, tracked under their own later queue items — don't
  assume either exists yet.

- 2026-08-08 — Built the shared hero/section/CTA template pair, the first
  item under "Marketing site" and the queue's first unchecked task now that
  "Visual system" is fully checked. Three new components in
  `apps/web/src/components/ui/`:
  - `CtaBand.tsx` — the closing call-to-action band, extracted from
    `home/FinalCta.tsx` verbatim (same markup, same classes) so both the
    homepage and future inner pages render an identical band from one
    implementation. All copy and links arrive as props; the component holds
    no i18n namespace of its own.
  - `FeatureGrid.tsx` — the card-grid section body, extracted from
    `home/ServiceCards.tsx` the same way. Takes pre-resolved `items` (title,
    body, art, optional sub-links already translated by the caller) rather
    than reading any translation namespace itself, so it isn't coupled to
    `home.services` or `nav.items`.
  - `PageTemplate.tsx` — the shell that actually answers the task: hero via
    `SectionIntro` (built two runs ago), an arbitrary `children` body, and an
    optional closing `CtaBand`. `children` is deliberately untyped rather
    than a fixed array of "sections" — a condition page (single topic, a
    `FeatureGrid` or two) and a segment index (routes out to many sub-pages)
    need different bodies, and no real page content exists yet to justify
    guessing one shape for both. Forcing that guess now would just be
    inventing a layout to work around later, against the "don't design for
    hypothetical requirements" rule. The doc comment states explicitly that
    this one shell serves both condition and segment pages per the queue
    wording — the "pair" is hero+CTA reused across page *types*, not two
    divergent template components.
  Proved both extractions in production rather than leaving them
  theoretical: `home/FinalCta.tsx` now renders `<CtaBand>` with
  `home.finalCta` content, and `home/ServiceCards.tsx` resolves
  `home.services`/`nav.items` translations into plain data and renders
  `<FeatureGrid>`. Byte-for-byte same output — confirmed by diffing rendered
  markup expectations against the pre-refactor JSX before editing, and then
  visually. `PageTemplate` itself has no consumer yet (still no inner routes
  under `apps/web/src/app/[locale]` besides the homepage), same position
  `SectionIntro` was in two runs ago.
  One real bug surfaced by `tsc`, not by inspection: `exactOptionalPropertyTypes`
  (set repo-wide in `tsconfig.base.json`) rejected passing a `boolean |
  undefined` value through to `ButtonLink`'s `external?: boolean` prop and an
  `X[] | undefined` value through to `FeatureGridItem.links?` — both arose
  from deriving new objects from optional source fields (`primaryCta.external`,
  `links?.map(...)`) rather than a literal that's simply present-or-absent.
  Fixed with the narrowest correct change at each site: `external={... ??
  false}` at the two `CtaBand` call sites into `ButtonLink` (coalesce to a
  real boolean, since `ButtonLink` already defaults `external` to `false`
  anyway), and widened `FeatureGridItem.links` to `Array<...> | undefined`
  explicitly (its value is genuinely produced as `X[] | undefined` by a
  `.map` on an optional array, so the type should say so) rather than
  loosening anything on the `Button.tsx` side, which needed no change and
  every other caller of it still type-checks under the strict flag exactly
  as before.
  Verified visually, not just by build: mounted `PageTemplate` on a
  throwaway routable page (`app/[locale]/template-preview`, plain name, no
  leading underscore — Next.js treats a `_`-prefixed segment as a private,
  unroutable folder, so an early `_template-preview` attempt never served)
  composing a real `SectionIntro` hero, a `Section`/`FeatureGrid` body reusing
  existing art (`AroundTheClockCare`, `CalmMind`, `HomeFirstVisit`) and
  existing `common`/`home` copy (no new message keys — the route was never
  committed), and a `CtaBand` close. Screenshot with headless Chromium (system
  Playwright at `/opt/node22/lib/node_modules`, `PLAYWRIGHT_BROWSERS_PATH=
  /opt/pw-browsers`) at 375px and 1280px, both locales, plus the homepage
  itself post-refactor for a regression check — all eight `scrollWidth`/
  `clientWidth` probes came back clean (no overflow). Deleted the throwaway
  route and the `AGENTS.md`/`CLAUDE.md` files `next dev` regenerates as a
  side effect before committing, per the precedent from the `SectionIntro`
  run.
  One capture artifact worth recording so a future run doesn't chase a false
  bug: the homepage's `fullPage` screenshot showed a large blank gap exactly
  where the services `FeatureGrid` should render, in `home-en` only. This is
  not a regression — `ServiceCards`' heading and card grid both carry
  `reveal`/`reveal-stagger` classes (`globals.css`), which drive a
  `animation-timeline: view()` scroll-linked reveal; Chromium's `fullPage`
  screenshot stitches viewport slices without genuinely scrolling the user
  past each section, so a view-timeline-gated element can be captured
  mid-animation (still `opacity: 0`) even though it renders correctly once
  actually scrolled into view. Confirmed by scrolling
  `#services-heading` into view with `scrollIntoView` and a real wait before
  a normal (non-fullPage) screenshot: cards render exactly as before the
  refactor. If a future run sees a similar blank band in a `fullPage`
  capture, scroll-into-view a section before concluding it's broken.
  All green (install/lint/typecheck/test/build).

  **For the next run:** the queue's next unchecked item is the Individuals
  routes (`24-7-care`, `primary-care`, `mental-health`,
  `weight-management`, `diabetes-management`, `hypertension-management`,
  `specialty-wellness`, plus the nested `nutrition`, `diabetes-prevention`,
  `dermatology`, `expert-medical-opinion`, `sleep`) — the first routes to
  actually consume `PageTemplate`/`SectionIntro`/`FeatureGrid`/`CtaBand`.
  Note `content/navigation.ts` and `content/home.ts` already carry the
  correct `href`s for every one of these routes (used by the mega-menu,
  footer and homepage service cards today, all pointing at routes that
  404 until this item lands) — reuse those paths rather than inventing new
  ones. Also note real body copy for each condition doesn't exist in the
  repo yet; per "invent no facts," each route's `SectionIntro`/`FeatureGrid`
  content needs new, genuinely-written (not fabricated-statistic) marketing
  copy added to both message files, not placeholder em-dashes — condition
  descriptions aren't the kind of number/name/credential the "invent
  nothing" rule forbids, but check that any new copy still makes no clinical
  claims and add a review note anywhere it might.

- 2026-08-08 — Synced the Expo app to the new forest/jade/marigold identity,
  the last item under "Visual system." This was the biggest single-task diff
  so far: `apps/mobile/app/index.web.tsx` (the Expo Router web landing page,
  served at `/` on web builds since it's a `.web.tsx` override of `index.tsx`)
  had never been touched by the rebrand — over 100 hardcoded hex values, plus
  a `#3659A8` blue and an `#EDE7F7`/`#684092` violet card scattered across it
  and the tab screens, none routed through `@swasthya/configuration`.
  Extended `colors` in `packages/configuration` with six new tokens
  (`primaryDeep`, `primarySoft`, `mintFaint`, `jadeBright`, `saffronStrong`,
  `saffronDeep`) that mirror shades already in `apps/web/src/styles/
  globals.css` (forest-800/600, jade-50/400, marigold-600/700) but had no
  mobile-side equivalent — the doc comment on `colors` already promises the
  two stay mirrored. Every hardcoded hex in `index.web.tsx`, `src/components/
  ui.tsx`, and all five `app/(tabs)/*.tsx` screens plus `consultation.tsx`
  was replaced with a token; the only hex left are two identical neutral
  greys (`#82918E` placeholder text, `#AAB8B5` a toggle-off track) that
  aren't brand hues and were already consistent across files.
  Three decisions worth recording:
  1. **Marigold, spent once.** `index.web.tsx`'s hero CTA was solid teal
     (`#0B6C61`) — under the new system that's the one marigold moment on the
     screen (mirroring `apps/web`'s Hero CTA), so it's now `colors.saffron`
     with dark text, and the nav's own CTA stays a solid forest pill so
     marigold isn't spent twice in one viewport, same reasoning as the
     header/mega-menu run's `inverse`-vs-`accent` call.
  2. **Off-brand accent tones got renamed, not just recolored.**
     `ui.tsx`'s `ActionCard` had `tone="blue"` and `tone="violet"` mapped to
     literal blue/violet hex — recoloring the values to jade/forest tones
     while keeping the names `blue`/`violet` would leave the prop lying
     about what it renders, so they're renamed to `forest`/`jade` and the
     one call site (`app/(tabs)/index.tsx`) updated to match.
  3. **The three stock photos are gone, not recolored.** `companionImage`,
     `bodyImage`, `careTeamImage` (`apps/mobile/assets/imagery/*.webp`) were
     the exact same AI-generated, teal-styled photos the organisation-section
     run already rejected and deleted from `apps/web` — a previous log entry
     flagged these mobile-side duplicates as still pending. Recoloring a
     photo isn't possible, and generating new photography of a "companion,"
     a body, or a "Nepali doctor with patient and family" would mean
     fabricating imagery of a person, which risks reading as a real
     clinician or patient portrayal. Removed the `<Image>` elements and the
     three files entirely; the hero visual and the two lower story panels
     now use plain `LinearGradient` panels in forest tones instead — the
     same treatment `index.web.tsx`'s own `bentoLead` panel already used
     successfully with no photo at all. Confirmed no other file referenced
     the three images before deleting them.
  Verified with the full pipeline (install/lint/typecheck/test/build all
  green, including `expo export --platform web`), then visually: served the
  static export locally and drove it with headless Chromium (system
  Playwright at `/opt/node22/lib/node_modules`, same approach as prior visual
  runs) at 375px and 1280px. Checked the homepage hero (marigold CTA reads
  correctly, gradient hero panel with floating voice/AI/doctor cards has no
  leftover photo), the service-card grid (four light tones — mint, a faint
  jade, warm paper, soft marigold — no blue or violet), the consultation
  preview room (fully forest/jade now, no navy-blue gradient), and — most
  importantly — the emergency safety-interrupt screen in the companion tab,
  which still renders correctly in `colors.danger` red and was completely
  unaffected by this change, confirming `clinical-safety`'s interception
  wasn't touched.

  **For the next run:** the Visual system section is now fully checked. The
  queue moves into "Marketing site," starting with shared page templates
  (hero/section/CTA pair for condition and segment pages) — `SectionIntro`
  from two runs ago is the opening-section half of that; the template pair
  still needs building before the ~35 remaining routes can be content-only.

- 2026-08-08 — Responsive audit at 375px, 768px and 1280px, both locales.
  Found one real horizontal-overflow bug and confirmed the two components the
  queue flagged as *likely* culprits were actually fine.

  **The real bug:** `Testimonials.tsx`'s layout grid was `grid gap-8
  lg:grid-cols-12 lg:items-center` — no `grid-cols-*` below `lg`, so below
  1024px the grid fell back to implicit column sizing instead of an explicit
  `minmax(0, 1fr)` track. Grid items get an implicit `min-width: auto`, and
  the `<video>` element in that section has no intrinsic width until its
  metadata loads (`preload="none"`, only a `poster`), so its min-content size
  won under that layout and pushed the whole column — and with it
  `document.documentElement`, since nothing upstream constrains a grid
  container's own size — out to what turned out to be exactly the poster
  image's rendered width. Confirmed with `getBoundingClientRect` on every
  element plus `scrollWidth` vs `clientWidth` at each breakpoint: 375px and
  768px both showed `scrollWidth` stuck at desktop widths (1280/1444) in both
  locales; 1280px was clean since `lg:grid-cols-12` applies there. Isolated
  the cause by toggling `display:none` on candidate sections one at a time
  before touching code, rather than guessing — hiding the testimonials
  section alone took `scrollWidth` straight back to `clientWidth`. Fix: added
  an explicit `grid-cols-1` on the same `div` (`Testimonials.tsx`), which is
  Tailwind's `minmax(0, 1fr)` and caps the track at the container width
  regardless of a child's intrinsic size. Verified the fix with the same
  `scrollWidth`/`clientWidth` probe (clean at 375/768/1280, both locales) and
  visually with full-page screenshots.
  Same bare-`grid`-without-a-base-`grid-cols` pattern exists in `Hero.tsx`,
  `Footer.tsx`, `MegaMenu.tsx` and `OrganizationTabs.tsx`, but none of them
  currently overflow — their content shrinks (text wraps, the hero's
  `RecordTransform` SVG has no fixed intrinsic width) rather than forcing a
  min-content width past the container, so nothing there needed changing.
  Flagging it here rather than pre-emptively touching working code: if any of
  those ever gain an unconstrained media element the same way, this is the
  failure mode to check for first.

  **The two suspects named in the queue turned out fine, not broken:**
  `.script-mark` (`Hero.tsx`) sits inside a `relative overflow-hidden`
  section, so although its own `getBoundingClientRect` extends well past a
  375px viewport, that section's `overflow-hidden` clips it before it can
  affect `document.documentElement.scrollWidth` — confirmed by hiding
  everything else and checking it contributed zero page-level overflow on
  its own. No Devanagari clipping either; the base layer's `:lang(ne)`
  leading is respected (`Hero.tsx` still carries no `leading-*` utility on
  the `h1`, per the existing rule). The hero's own `grid
  items-center ... lg:grid-cols-[1.05fr_1fr]` has the same "no base
  `grid-cols`" shape as the real bug above, but never overflowed in testing
  because `RecordTransform` is a `viewBox`-only SVG with `className="w-full"`
  and so has no non-shrinkable intrinsic width — left untouched, since it
  isn't actually broken and the task is an audit, not a rewrite.
  Also checked: the mobile drawer open state, and both locales' full-page
  layouts at all three widths — no other overflow, no clipped headings, no
  broken wraps.
  Verification: `pnpm install --frozen-lockfile`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build` all green. No message-file
  changes — no copy changed, purely a layout-class fix.

  **For the next run:** the queue's next unchecked item is syncing
  `apps/mobile` to the new palette (`apps/mobile/app/index.web.tsx` and the
  tab screens still reference the old teal directly instead of
  `@swasthya/configuration` tokens) — this is also the last item under
  "Visual system," so after it the queue moves into "Marketing site" and the
  shared page-template work.

- 2026-08-08 — Built `SectionIntro` (`apps/web/src/components/ui/SectionIntro.tsx`),
  the reusable opening layout the queue called for: a title/body column next
  to a required `Art` slot, so an inner page structurally cannot skip the
  visual and fall back to a wall of text. It takes two tones. `forest`
  (default) reproduces the layered-depth stack the homepage `Hero` already
  established — dark header into a dark opener, then the same curved-lip
  transition down to paper — for pages that want a strong opening. `paper`
  is a plain light section for routes (legal, utility) where stacking a
  second full-bleed dark block directly under the now-permanent dark header
  would read as too heavy; this is exactly the risk flagged in the previous
  run's log. `artPosition` (`start`/`end`) flips which side the artwork sits
  on via `lg:order-first` so later pages get visual rhythm instead of every
  route looking identical. All copy is passed in as props (`eyebrow`,
  `title`, `body`, `cta.label`) — the component itself has zero hardcoded
  strings, consistent with the Nepali-first rule — so no message-file changes
  were needed for the component itself. No inner pages exist yet to wire it
  into (`apps/web/src/app/[locale]` currently only has the homepage route),
  so it isn't consumed anywhere yet; that's expected; the queue's next
  section ("Individuals routes", etc.) is what will consume it.
  Left it untested like every other presentational component in `apps/web`
  (`Section.tsx`, `Hero.tsx` etc. have no test files either, and `apps/web`
  has zero test files project-wide — `packages/*` is where colocated
  `index.test.ts` applies).
  Verified visually rather than just by build: temporarily mounted both tone
  variants with both `artPosition` values on a throwaway route, ran the dev
  server, and screenshot both locales at 1280px and 375px with headless
  Chromium (system Playwright at `/opt/node22/lib/node_modules`, same
  approach as prior runs — this repo still has no Playwright dependency of
  its own). No clipped Devanagari, both tones and both artwork positions lay
  out correctly, CTA variant switches correctly (marigold `accent` on
  forest, solid `primary` on paper, so a future page doesn't spend the one
  marigold action twice). Deleted the throwaway route before committing —
  nothing under `apps/web/src/app` changed. `next dev` also regenerated
  `apps/web/AGENTS.md` and `CLAUDE.md` as a side effect (a Next.js 16
  built-in that writes agent-rule files reading `node_modules/next/dist/docs`
  on every `next dev`); those aren't part of this task and were deleted
  rather than committed. All green (install/lint/typecheck/test/build).

  **For the next run:** the queue's next unchecked item is a responsive audit
  at 375px/768px/1280px focused on `.script-mark` and the hero grid. Separately,
  once real inner-page content exists, `SectionIntro` is ready to be the
  opening section for it — no further plumbing needed.

- 2026-08-08 — Gave the header (`Header.tsx`) and mega-menu (`MegaMenu.tsx`)
  the new identity, replacing the old `bg-white/95 backdrop-blur-sm` bar and
  its flat `border-t border-line bg-white` dropdown. `Footer.tsx` was already
  `bg-forest-800`, so the header now matches it — the two dark chrome pieces
  book-end the paper content, rather than a plain white bar sitting on top of
  a page that no longer looks like it. `Header` is `bg-forest-800`, one shade
  darker than `Hero`'s `forest-700` panel and matching `Hero`'s own
  `forest-900` announcement strip immediately below it, so the stack reads as
  deliberate layered depth instead of a flat wall of one green. `Logo` and
  `LocaleSwitcher` already had a `tone` prop from an earlier pass and just
  needed `tone="light"` wired through — no changes needed inside either
  component. The mega-menu panel dropped its `border-t border-line` (the
  exact "bolted on" hairline the task called out) and now reads as a white
  card popped forward off the forest header, the same language
  `OrganizationTabs`'s white content card already established; `shadow-menu`
  alone carries the elevation, no border needed since the colour change from
  the header is the boundary.
  One real decision, not just restyling: the header's "Register" CTA was
  `variant="primary"` (`bg-forest-700 text-white`), which is invisible against
  a forest ground — it needed a dark-ground variant regardless. It would have
  been easy to reach for `accent` (marigold) since that's the "primary
  button" instinct, but Hero's own CTA is already marigold and sits in the
  same viewport as the header on the homepage, so a second marigold button
  would spend the accent twice on one screen, against the explicit "spend it
  once" rule. Used `variant="inverse"` (solid white pill) instead. "Sign in"
  needed a text-only style for a dark ground that didn't exist yet —
  `ghost` (`text-forest-700 hover:bg-jade-50`) only works on paper — so added
  one new `Button` variant, `ghostOnDark`
  (`text-jade-100 hover:bg-white/10 hover:text-white`), mirroring the
  existing `ghost`/`onDark` pairing rather than inlining one-off classes.
  Verified with headless Chromium (system Playwright, same approach as the
  organisation-section run) against the production build on both locales: the
  header, an open mega-menu (hover, not click — clicking a second time closes
  it, which is correct existing behaviour, not a regression), the mobile
  drawer, and the 375px viewport all render correctly with no clipped
  Devanagari or layout breaks. No copy changed, so no message-file edits.
  `MobileNav.tsx`'s own content was left untouched — it already sits on a
  paper ground inside the drawer and already uses current-system tokens
  (`primary`/`secondary` buttons, default-tone `LocaleSwitcher`), so nothing
  there was "bolted on." All green (install/lint/typecheck/test/build).

  **For the next run:** the queue's next unchecked item is a reusable
  `SectionIntro` + artwork layout for inner pages. Note for whoever picks
  that up: inner pages will land under a header that's now a solid forest
  bar on every route, not just the homepage — plan each page's opening
  section (or lack of a forest hero) with that fixed dark chrome in mind.

- 2026-08-08 — Reworked the organisation section (`OrganizationTabs.tsx`) onto
  a full-bleed forest ground (`bg-forest-700`, matching `Hero`'s panel), with
  the tab pills restyled for a dark ground using the same white/`white-10`
  pairing `Button`'s `inverse`/`onDark` variants already establish. Replaced
  the three old AI-generated stock photos (`mero-health-companion.webp`,
  `nepali-care-team.webp`'s sibling `digital-health-body.webp`, both teal —
  exactly what the art direction forbids) with three new SVG compositions —
  `MemberRouting`, `WorkplaceInvestment`, `HospitalReach` in
  `apps/web/src/components/art/` — following the `AroundTheClockCare`
  convention. `OrganizationTab.image: string` became `Art: ComponentType`,
  mirroring `ServiceCard`. The stat slots (still legitimately em-dashes; no
  figures exist to substantiate) moved from a bare `<dt>` number into a
  badge-and-label card so the placeholder reads as a deliberate component, not
  an unstyled leftover. Deleted the two now-unreferenced old photos from
  `apps/web/public/imagery/`; left their same-named siblings in
  `apps/mobile/assets/imagery/` untouched since the mobile palette sync is a
  separate, later queue item and out of scope here. Removed the now-dead
  `imageAlt` keys from both message files since the art is `aria-hidden`. No
  other new copy, so no other message-file changes. Verified visually with a
  headless Chromium screenshot (system Playwright at
  `/opt/node22/lib/node_modules`, since this repo has no Playwright
  dependency) in both locales, tab-switched, and at a 375px viewport — no
  clipped Devanagari, tabs wrap cleanly. All green
  (install/lint/typecheck/test/build).

  **For the next run:** the queue's next unchecked item is giving the header
  and mega-menu the new identity. The `apps/mobile` imagery duplicates noted
  above are also still waiting on the "sync Expo to the new palette" item
  further down the queue — don't forget those when that task comes up.

- 2026-08-08 — Built editorial SVG artwork for all six service cards
  (`AroundTheClockCare`, `HomeFirstVisit`, `CalmMind`, `VitalsTrend`,
  `DiagnosticFocus`, `HabitSprout` in `apps/web/src/components/art/`),
  replacing the recoloured lucide icon chips in `ServiceCards.tsx`. Each is a
  distinct small composition built only from brand tokens (forest/jade/
  marigold on paper), matching the `RecordTransform` convention: functional
  component, `aria-hidden`, `className` passthrough, no fake lettering.
  `ServiceCard.Icon`/`tone` in `content/home.ts` were replaced with a single
  `Art: ComponentType` field since each composition now carries its own
  colouring — the six lucide icon imports there are gone. No new copy, so no
  message-file changes were needed. Followed existing precedent and left
  these components untested like `RecordTransform`: `apps/web` has no test
  files at all (`vitest run src --passWithNoTests`), and there is no
  branching logic in a static SVG worth asserting on. All green
  (install/lint/typecheck/test/build).

  **For the next run:** the queue's next unchecked item is the organisation
  section rework (full-bleed forest ground, artwork per tab). The photography
  blocker noted below still applies — keep using SVG artwork, not fabricated
  photos.

- 2026-08-08 — Visual identity rebuilt after the owner rejected the first
  pass as generic. New palette (forest/jade/marigold on warm paper), new type
  (Martel + Mukta, both Devanagari-native), and a new hero built around
  `RecordTransform` artwork instead of a stock photo. `packages/configuration`
  and the Expo splash colour follow. Fixed a real bug found by inspecting
  computed styles: a `leading-[1.06]` utility on the hero `h1` was overriding
  the `:lang(ne)` rule and would have clipped Devanagari matras at 68px.
  All green. Queue now leads with the visual system.

  **Blocker for the next run:** photographic imagery could not be generated —
  the Higgsfield MCP connector's session has expired and re-authorising needs
  an interactive session. Do not fabricate photographs of patients or
  clinicians as a workaround. Build SVG artwork instead, which is the
  documented direction anyway, and leave clearly-marked slots where real
  photography should later drop in.

- 2026-08-08 — Ledger created. Homepage, navigation shell, and the
  `health-records` / `storage-adapters` / `entitlements` packages are in place
  and green.
