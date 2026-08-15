# Asset brief — prompts for Veo and ChatGPT

## Status — what has landed

Wired and live. Anything missing keeps its SVG artwork, so the site is
complete either way.

| Asset                                              | State                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `imagery/mero-family-report.webp`                  | ✅ wired — homepage hero, original illustrative photography                                 |
| `imagery/mero-private-care.webp`                   | ✅ wired — record/care story, original illustrative photography                             |
| `imagery/mero-community-care.webp`                 | ✅ wired — featured care card and story-film poster                                         |
| `video/mero-health-hero.mp4`                       | ⬜ present but unused — the new hero is photo-led to keep the care form stable and readable |
| `video/mero-health-story.mp4`                      | ✅ wired — prominent story-film player                                                      |
| `video/mero-health-capture.mp4`                    | ⬜ present but unused — 9:16, no slot for it yet                                            |
| `imagery/portrait-{sabina,raju,mina,prakash}.webp` | 🗑 removed — fictional scenarios do not need synthetic identity portraits                   |
| `mero-health-social.png`                           | ✅ used as the OG/Twitter card                                                              |
| The 9 remaining images                             | ⬜ missing — SVG artwork stands in                                                          |

The three `mero-*` photographs were generated as original assets on 2026-08-15, inspected, and converted to WebP at quality 86. They total about 400 KB. They contain no readable interface, logo, or medical claim. They are illustrative scenes and must not be described as real patients, clinicians, or outcomes.

### Four things to know about the older delivered portraits

1. **Every one carries a visible AI watermark** — the four-pointed ✦ in the
   bottom-right. It is cropped out incidentally at the 44px avatar size, but it
   will be visible anywhere these are used larger. It has deliberately **not**
   been removed: it is a provenance marker disclosing that the image is
   generated, and stripping it to pass synthetic photographs off as real on a
   health site is not a thing to do quietly. If you want them clean, regenerate
   on a tier that does not watermark.
2. **Aspect ratios do not match the brief.** It asked for 1:1; only
   `portrait-mina` came back square. The other three are ~16:9, so the square
   avatar crop takes a centre band. Fine at 44px, wrong if reused larger.
3. **Source files are 2-9 MB each.** `next/image` re-encodes on the way out —
   the 8.2 MB `portrait-sabina` serves as a 1.4 KB avatar — so visitors are
   unaffected. The repository now carries ~30 MB of assets, which is the real
   cost.
4. **`portrait-raju..webp` had a double dot** and was renamed;
   **`portrait-sgroup-4.webp` was a four-up contact sheet**, not a single
   portrait, so it was moved out of `public/` to
   `docs/product/source-contact-sheet-4up.webp` rather than served as one.

Generate these externally, drop the files at the exact paths below, and the
code picks them up. Filenames are load-bearing: match them exactly.

## Before you start

**Paste this house-style block at the front of every image prompt.** It is
what makes fourteen separately-generated images look like one shoot rather
than fourteen stock photos.

> Documentary editorial photography, shot on 35mm film, Kodak Portra colour.
> Warm natural light, mostly from a window. Shallow depth of field. Real
> unposed moment, never a stock-photo smile at the camera unless specified.
> Muted palette of deep forest green, warm cream and marigold orange. Visible
> film grain. Nepali people and Nepali interiors. No text, no lettering, no
> signage, no watermarks, no logos.

**Two hard rules.**

1. **No readable text anywhere.** Generators produce garbled fake Devanagari
   that looks broken and is unreadable to screen readers. Every prompt below
   ends with a no-text instruction — keep it.
2. **These faces are synthetic.** The testimonials they sit beside are already
   labelled as fictional examples, and that labelling must stay. Do not
   present a generated face as a real patient — that is the line between
   illustrative and deceptive.

## Videos — Google Veo

### 1. Hero brand film

**Path:** `apps/web/public/video/mero-health-hero.mp4`
**Ratio:** 16:9 · **Length:** 8–12s · silent, loops seamlessly

> Slow push-in on the hands of a middle-aged Nepali woman at a wooden table by
> a window, unfolding a creased paper medical report. Warm morning light rakes
> across the paper. Her thumb smooths a fold. Shallow depth of field, the
> background falling to soft green. Film grain, Kodak Portra colour, no
> camera shake. Calm, unhurried, hopeful. No text or lettering visible on the
> paper. No faces.

### 2. Story film

**Path:** `apps/web/public/video/mero-health-story.mp4`
**Ratio:** 16:9 · **Length:** 25–40s · **This slot already exists in the code**

> A sequence of quiet documentary moments in Nepal: a woman photographing a
> paper lab report with her phone at a kitchen table; an older man in a hill
> village checking a blood pressure cuff on his forearm; a young doctor in a
> simple clinic listening to a patient; a nurse walking a sunlit hospital
> corridor. Warm natural light throughout, film grain, unhurried pacing, each
> shot held 4-6 seconds. No text, no signage, no on-screen graphics.

### 3. App capture loop

**Path:** `apps/web/public/video/mero-health-capture.mp4`
**Ratio:** 9:16 · **Length:** 6–8s · silent loop

> Close overhead shot of hands holding a phone above a paper medical report on
> a wooden table, framing it to photograph it. Warm window light. The phone
> screen is dark and reflective — no interface visible. Shallow depth of
> field, film grain. No text anywhere.

## Images — ChatGPT, Imagen or Veo stills

### Testimonial portraits — 1:1, four files

Warm natural portrait, soft window light, plain warm-cream background,
shallow depth of field, looking directly at camera with a slight genuine
smile. Film grain. No text.

| Path                                            | Subject                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/web/public/imagery/portrait-sabina.webp`  | Nepali woman, early thirties, simple deep green kurta, quietly confident |
| `apps/web/public/imagery/portrait-raju.webp`    | Nepali man, early forties, plain collared shirt, warm and open           |
| `apps/web/public/imagery/portrait-mina.webp`    | Nepali woman, late twenties, dark hair tied back, thoughtful             |
| `apps/web/public/imagery/portrait-prakash.webp` | Nepali man, sixties, grey hair, weathered kind face, dignified           |

### Organisation section — 3:2

**`apps/web/public/imagery/org-health-plans.webp`**

> A Nepali man in his thirties sitting on a step outside a modest home,
> talking to someone on his phone, relaxed and mid-conversation. Late
> afternoon light. Shallow depth of field, film grain. No text.

**`apps/web/public/imagery/org-employers.webp`**

> Two Nepali colleagues, a woman and a man in their thirties in smart casual
> clothes, talking over a laptop at a shared desk beside a window in a bright
> Kathmandu office. Plants, natural daylight, candid unposed moment. Film
> grain. No text or signage on screens.

**`apps/web/public/imagery/org-hospitals.webp`**

> A bright modern Nepali hospital corridor, a nurse walking away from camera,
> tall windows casting long warm light across a polished floor. Calm and
> spacious. Shallow depth of field, film grain. No signage or lettering.

### Condition and service pages — 3:2

**`apps/web/public/imagery/care-247.webp`**

> A young Nepali man sitting on the edge of a bed at night in a modest
> Kathmandu apartment, lit by a warm bedside lamp and the glow of the phone in
> his hand. Calm, not distressed. Deep green and amber tones. Film grain. No
> text.

**`apps/web/public/imagery/primary-care.webp`**

> A Nepali woman doctor in her forties in a simple clinic room, leaning in to
> listen to an elderly patient seated across from her. Warm daylight through a
> carved wooden window frame. Stethoscope around her neck. Genuine unposed
> moment of attention. Film grain. No text.

**`apps/web/public/imagery/mental-health.webp`**

> A young Nepali woman sitting alone by a large window in soft diffuse morning
> light, looking out thoughtfully. Warm interior, terracotta wall. Calm and
> dignified, not sad. Muted green and cream. Film grain. No text.

**`apps/web/public/imagery/condition-management.webp`**

> Close shot of the weathered hands of an older Nepali man using a small home
> blood pressure cuff on his forearm, at a wooden table in warm afternoon
> light. A glass of water beside him. Shallow depth of field, film grain. No
> readable numbers or text on the device.

**`apps/web/public/imagery/specialty-care.webp`**

> A Nepali dermatologist examining a patient's forearm with a small
> illuminated magnifier in a bright clean consultation room. Focused
> professional hands in the foreground. Soft natural light, film grain. No
> text.

**`apps/web/public/imagery/healthy-habits.webp`**

> Overhead shot of a Nepali home kitchen counter: fresh spinach, lentils in a
> brass bowl, tomatoes, ginger and garlic on a worn wooden board, a woman's
> hands slicing at the edge of frame. Natural window light, rich marigold and
> deep green. Film grain. No text.

### Wider brand — 3:2

**`apps/web/public/imagery/rural-reach.webp`**

> Golden-hour view of a Nepali hill village with terraced fields, a narrow
> path leading toward a small rural health post with a metal roof. Warm light
> raking across the terraces, soft distant haze, deep green fields. Film
> grain. No signage or lettering.

**`apps/web/public/imagery/clinicians.webp`**

> Three Nepali healthcare workers — a doctor and two nurses in their thirties
> — standing together in a sunlit hospital corridor, mid-conversation, relaxed
> and collegial. Natural light, film grain. No badges, no lettering, no
> signage.

### Social share card

**Path:** `apps/web/public/mero-health-social.png` · **Ratio:** 1.91:1 (1200×630)

> A creased paper medical report on a warm wooden table in soft window light,
> shot from directly above, occupying the left two-thirds of the frame with
> generous empty warm-cream space on the right. Deep green and marigold tones,
> film grain. Absolutely no text — brand text is overlaid separately.

## After generating

Generators output PNG or JPEG; the site wants WebP. From the repository root:

```bash
for f in apps/web/public/imagery/*.png apps/web/public/imagery/*.jpg; do [ -e "$f" ] && cwebp -q 82 "$f" -o "${f%.*}.webp" && rm "$f"; done
```

Pull a poster frame out of each video so the player is never blank:

```bash
ffmpeg -i apps/web/public/video/mero-health-story.mp4 -vf "select=eq(n\,30)" -vframes 1 apps/web/public/imagery/story-poster.webp
```

Keep videos under about 4 MB — re-encode anything larger:

```bash
ffmpeg -i input.mp4 -c:v libx264 -crf 30 -preset slow -an -movflags +faststart output.mp4
```

The `-an` is deliberate: the hero and capture loops must be silent, and a
muted autoplay video with no audio track is the only reliable way to get
autoplay across browsers.

## Wiring

Photography is now wired into the hero, record story, featured service, and
story-film poster with `next/image`. The remaining service and organization
surfaces intentionally retain the local SVG system until a specific approved
photograph exists. A missing future photograph must degrade to the existing
SVG, never to a broken image.
