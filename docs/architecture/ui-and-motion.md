# UI, interaction, and motion

## Current system

Mero Health uses a deliberately small presentation stack:

- Tailwind CSS 4.3.3 and the tokens in `apps/web/src/styles/globals.css` for layout and visual identity.
- Martel and Mukta for Latin and Devanagari typography.
- Lucide for interface icons; editorial illustrations remain local SVG components.
- Motion for React 12.43.0 for state transitions. `MotionConfig reducedMotion="user"` is required so operating-system reduced-motion preferences disable transform/layout animation.

The visual direction remains deep indigo, marigold, and warm paper. Marigold is reserved for one primary action per screen. Do not introduce a generic health-tech blue, a third type family, or decorative patient photography presented as real.

## Homepage visual system (2026-08-15)

The homepage now uses an editorial, photography-led hierarchy while preserving the symptom-first product flow:

- `SymptomEntry` is the full-bleed first screen. The original family photograph, brand proposition, safety assurances, and care question form behave as one hero rather than separate marketing and utility blocks.
- `Hero` is the record-capture story: original illustrative photography, the existing `RecordTransform` artwork, and three concrete steps explain the differentiator without inventing an outcome.
- `ServiceCards` uses an asymmetric editorial grid. The first service receives a photographic feature; the remaining services retain the local SVG art system.
- `OrganizationTabs` uses a light section and one focused dark panel. Unsubstantiated dash-stat placeholders no longer appear on the public homepage.
- `Testimonials` presents the existing short film prominently and keeps fictional scenarios explicitly labelled. Generated portrait avatars are no longer rendered.
- The placeholder partner marquee is not rendered until real, approved partner information exists.
- `SectionIntro` supports an optional eager-loaded photograph with the route's existing SVG layered as a product cue. The 24/7 care, primary care, mental health, about, and organization-approach pages use this treatment; remaining routes keep their SVG until a specific approved photograph exists.

Original illustrative photography lives in `apps/web/public/imagery/`:

- `mero-family-report.webp` — homepage hero.
- `mero-private-care.webp` — private care / record story.
- `mero-community-care.webp` — care feature and film poster.

These files are web-optimized WebP assets (about 400 KB combined). They depict fictional illustrative scenes, not real Mero Health patients or clinicians. Keep truthful alt text, do not attach a real name or testimonial to a generated person, and do not use the images as evidence of a clinical outcome.

## Library decision (2026-08-15)

Motion was added because the new care flow benefits from clear state transitions and the library provides a first-class reduced-motion policy without replacing the existing component system.

Base UI 1.6.0 is the preferred future primitive layer when the project needs complex dialogs, drawers, comboboxes, menus, popovers, or OTP inputs. It is headless and accessibility-oriented, so it can use Mero Health's tokens without importing another visual brand. Add primitives individually when a real feature needs them.

Radix Primitives and shadcn/ui remain valid alternatives, but adding either now would create a second overlapping primitive system before a concrete need exists. Reassess if Base UI cannot meet an implemented feature's accessibility or behavior requirements.

Primary references:

- Motion for React: https://motion.dev/docs/react
- Motion reduced motion: https://motion.dev/docs/react-accessibility
- Base UI releases and accessibility: https://base-ui.com/react/overview/releases and https://base-ui.com/react/overview/accessibility
- Radix accessibility: https://www.radix-ui.com/primitives/docs/overview/accessibility
- shadcn/ui Tailwind 4 and React 19 support: https://ui.shadcn.com/docs/tailwind-v4

## Quality requirements

- All user-visible copy must exist in both `apps/web/messages/ne.json` and `en.json`.
- New interactive states need keyboard semantics, focus visibility, touch targets of at least 44–48px, and screen-reader status or alert behavior.
- Motion must preserve meaning when reduced or disabled.
- Never render provider URLs unless they have been normalized to HTTP or HTTPS.
- Never put health questions or other sensitive text in a URL.
- Check mobile overflow at 375–390px and inspect Devanagari heading line height after visual changes.
