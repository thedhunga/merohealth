# Veo and Gemini prompts — what is still missing

The first asset brief is largely filled: six photographs and three films
landed, and the site is complete without the rest thanks to SVG fallbacks.
This is the remaining list, rewritten for the **indigo and marigold** palette
(the earlier brief still says green — ignore that) and for what the code
actually requests today.

Paste the block below at the front of every **image** prompt. It is what makes
separately generated images read as one shoot.

> Documentary editorial photography, 35mm film, Kodak Portra colour. Warm
> natural light, mostly from a window. Shallow depth of field. A real unposed
> moment. Palette of deep indigo, warm cream and marigold — clothing and
> interiors lean indigo and warm wood, never green or clinical blue. Visible
> film grain. Nepali people, Nepali interiors. No text, no lettering, no
> signage, no watermarks, no logos.

Two rules that hold for everything:

1. **No readable text anywhere.** Generators produce garbled fake Devanagari
   that looks broken and is unreadable to screen readers.
2. **These faces are synthetic**, and the testimonials beside them are already
   labelled fictional. That labelling stays.

---

## Images — Gemini (Nano Banana / Imagen)

Save each at the exact path. The wiring is already in place; the file
appearing is all that is needed.

### Two testimonial portraits — 1:1

**`apps/web/public/imagery/portrait-raju.webp`**
> Warm natural portrait of a Nepali man in his early forties, plain collared
> shirt in muted indigo, soft window light from the left, warm open
> expression, looking directly at camera, plain warm cream wall behind,
> shallow depth of field, film grain, editorial portrait. Match the framing of
> a seated three-quarter portrait. No text, no watermark.

**`apps/web/public/imagery/portrait-mina.webp`**
> Warm natural portrait of a Nepali woman in her late twenties, dark hair tied
> back, thoughtful gentle expression, simple indigo kurta, looking directly at
> camera, soft window light, plain warm cream wall, shallow depth of field,
> film grain, editorial portrait. No text, no watermark.

### Condition and service pages — 3:2

Only three pages still show artwork alone. Adding a file to `individuals.ts`
takes one line; the pattern is already there for the others.

**`apps/web/public/imagery/mental-health.webp`**
> A young Nepali woman sitting alone by a large window in soft diffuse
> morning light, looking out thoughtfully, warm interior with a deep indigo
> cushion and terracotta wall, calm and dignified rather than sad, shallow
> depth of field, film grain, editorial. No text.

**`apps/web/public/imagery/condition-management.webp`**
> Close documentary shot of the weathered hands of an older Nepali man using a
> small home blood pressure cuff on his forearm, seated at a wooden table in
> warm afternoon light, glass of water beside him, deep indigo sleeve, shallow
> depth of field, film grain. No readable numbers or text on the device.

**`apps/web/public/imagery/specialty-care.webp`**
> A Nepali dermatologist examining a patient's forearm with a small
> illuminated magnifier in a bright clean consultation room, focused
> professional hands in the foreground, soft natural light, warm neutral and
> deep indigo tones, film grain, medical editorial photography. No text.

### Wider brand — 3:2

**`apps/web/public/imagery/rural-reach.webp`**
> Golden-hour view of a Nepali hill village with terraced fields, a narrow
> path leading toward a small rural health post with a metal roof, marigold
> light raking across the terraces, soft distant haze, film grain, National
> Geographic editorial landscape. No signage or lettering.

**`apps/web/public/imagery/org-employers.webp`**
> Two Nepali colleagues, a woman and a man in their thirties in smart casual
> clothes with an indigo accent, talking over a laptop at a shared desk beside
> a window in a bright Kathmandu office, plants, natural daylight, candid
> unposed, film grain. No text or signage on screens.

---

## Videos — Google Veo

The three films from the first brief exist and are wired. What is missing is
short **ambient loops** for the pages that now carry photography — a still
that breathes is more than a still. Each is silent, 6–8 seconds, and must loop
without a visible cut.

Veo takes richer direction than an image model. Say what the *camera* does,
what *moves*, and what stays still. Two lines each is plenty; do not over-write
them.

**`apps/web/public/video/loop-report.mp4`** — 16:9, 8s
> Slow push-in on a creased paper medical report on a warm wooden table by a
> window. A hand enters from the right and smooths one fold; dust drifts in the
> window light. Deep indigo cloth under the paper. Kodak Portra colour, film
> grain, no camera shake, no faces, no readable text on the paper.

**`apps/web/public/video/loop-cuff.mp4`** — 16:9, 6s
> Locked-off close shot of an older Nepali man's hands as a home blood
> pressure cuff slowly inflates on his forearm. Warm afternoon window light.
> Only the cuff and his fingers move. Deep indigo sleeve. Film grain, no
> readable digits.

**`apps/web/public/video/loop-clinic.mp4`** — 16:9, 8s
> Very slow lateral dolly along a sunlit clinic corridor in Nepal, a nurse in
> a deep indigo tunic walking away from camera, long warm light across a
> polished floor. Nothing else moves. Calm and spacious. Film grain, no
> signage.

**`apps/web/public/video/loop-hills.mp4`** — 21:9, 8s
> Static wide shot of Nepali terraced hills at golden hour, thin cloud drifting
> slowly across the far ridge, a small metal-roofed health post catching the
> last light. Only the cloud moves. Marigold and deep indigo tones, film grain,
> no lettering.

### Prompt notes for Veo specifically

- Lead with the camera move or say "locked-off" — an unspecified camera drifts.
- Name the one thing that moves and say everything else is still; that is
  what makes a loop feel intentional rather than like a paused clip.
- Ask for "no faces" on the loops. A face that blinks once per loop reads as
  a glitch.
- Generate at 24fps and export without audio.

---

## After generating

PNG or JPEG out of the generator; the site wants WebP for images and H.264
for video. From the repository root:

```bash
for f in apps/web/public/imagery/*.png apps/web/public/imagery/*.jpg; do
  [ -e "$f" ] && cwebp -q 82 "$f" -o "${f%.*}.webp" && rm "$f"; done
```

```bash
ffmpeg -i in.mp4 -c:v libx264 -crf 30 -preset slow -an -movflags +faststart -vf "fps=24" out.mp4
```

Keep every loop under 3 MB. `-an` is deliberate: silent autoplay only works
reliably when there is no audio track at all.

The image slots degrade to SVG artwork when a file is absent, so drop these
in one at a time — nothing breaks in between.
