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
