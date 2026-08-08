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
