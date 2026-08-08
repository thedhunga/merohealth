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

- [ ] Editorial SVG artwork for all six service cards in
      `apps/web/src/components/art/`, replacing the small lucide icon chips.
      Each should be a distinct small composition in the brand palette, not a
      recoloured icon. This is the single biggest visual upgrade left.
- [ ] Rework the organisation section: full-bleed forest ground, artwork per
      tab, and stat slots that look deliberate while the figures are still
      em-dashes.
- [ ] Give the header and mega-menu the new identity — the panel is still
      styled from the old system and now feels bolted on.
- [ ] A reusable `SectionIntro` + artwork layout so every inner page opens with
      a visual rather than a wall of text.
- [ ] Responsive audit at 375px, 768px and 1280px. The oversized `.script-mark`
      and the hero grid are the likely breakages.
- [ ] Sync the Expo app to the new palette: `apps/mobile/app/index.web.tsx` and
      the tab screens still use the old teal styling directly rather than
      `@swasthya/configuration` tokens.

### Marketing site

- [ ] Shared page templates: a hero/section/CTA template pair for condition
      pages and segment pages, so the ~35 remaining routes are content, not
      bespoke layout.
- [ ] Individuals routes: `24-7-care`, `primary-care`, `mental-health`,
      `weight-management`, `diabetes-management`, `hypertension-management`,
      `specialty-wellness`, plus the nested `nutrition`,
      `diabetes-prevention`, `dermatology`, `expert-medical-opinion`, `sleep`.
- [ ] Individuals utility routes: `how-it-works`, `without-insurance`, `faqs`
      (with FAQ schema.org markup).
- [ ] Organizations routes: `employers`, `health-plans`,
      `hospitals-health-systems`, `our-approach`, `partners`,
      `resource-center`, `events`.
- [ ] Clinicians routes: `our-providers`, `clinical-leadership`, `careers`,
      `commitment-to-quality`.
- [ ] Company routes: `about`, `about/impact`, `about/leadership`, `careers`,
      `newsroom`, `contact`.
- [ ] Legal routes: `legal`, `legal/privacy`, `legal/community-guidelines`,
      `accessibility`, `help`.
- [ ] Health library: index plus article route, with a typed content model.
- [ ] Pricing page driven by `packages/entitlements` — the catalogue is the
      source of truth, so prices are never duplicated into copy.
- [ ] `sitemap.ts`, `robots.ts`, per-route `generateMetadata`, and
      `Organization` + `WebSite` structured data. Keep `robots` set to
      noindex while the demonstration notice is still shown.
- [ ] Accessibility pass: heading order, landmarks, focus traps in the mobile
      drawer, contrast, and a keyboard walkthrough of the mega-menu.

### Platform core

- [ ] `apps/api`: records module exposing capture, list, timeline and
      confirm/correct/reject endpoints over `packages/health-records`, with
      the storage port injected.
- [ ] `apps/api`: entitlement guard enforcing `checkModule` and `checkQuota`
      at the route boundary. A UI-only gate is not a gate.
- [ ] Prisma schema for `HealthDocument`, `HealthObservation`, `DeviceSample`,
      `Subscription` and usage counters, plus a migration and seed data.
- [ ] Hosted storage adapter against the MinIO service already in
      `compose.yaml`, implementing `HealthDocumentStore`.
- [ ] Google Drive adapter: OAuth, an app-scoped folder, and client-side
      encryption so stored bytes stay opaque to the server.
- [ ] `packages/interop`: FHIR R4 mapping for documents and observations, a
      record export bundle (PDF + JSON), and a revocable, time-limited share
      link.
- [ ] `packages/devices`: normalisation for Health Connect and HealthKit
      samples into `DeviceSample`.
- [ ] `apps/mobile`: document capture flow — camera, review, upload, and the
      confirmation queue driven by `pendingConfirmations`.

## Log

Newest first. One entry per run: date, task, outcome, and anything the next
run needs to know.

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
