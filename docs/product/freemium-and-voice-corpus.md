# Freemium, duplex voice, and a spoken-Nepali corpus

> Owner direction, 2026-08-17: go freemium — offer choices on purpose so a
> person knows what premium costs; and collect spoken Nepali across dialects
> and accents so we can train our own model later, aiming for the most robust
> spoken-Nepali data anywhere. This document is the assessment and the plan.
> Prices, licence, and consent wording are **owner decisions** — placeholders
> are marked.

## 1. What is true today

- Tiers exist in code (`packages/entitlements`: Free / Plus / Pro) with no
  product content behind them and no payment provider.
- Voice is half-duplex (browser Web Speech). Duplex is possible via the
  Gemini Live API: **Nepali (`ne`) is on its language list, it has VAD and
  interruption, and ephemeral tokens let a phone browser connect directly**
  — so it can ship on Vercel without a relay server. It is paid.
- The API (`apps/api`) is not deployed. Paid tiers, accounts, and any
  storage of audio all depend on it. See `docs/product/HANDOFF.md`.

## 2. Freemium

### Tiers (content proposal — owner confirms)

| | Free | Plus | Pro |
|---|---|---|---|
| Ask by text or tap-to-talk; Nepali answers; emergency guidance | ✅ always | ✅ | ✅ |
| Duplex voice conversation (Gemini Live) | trial minutes / month | N minutes / month | more minutes |
| Turn memory, transcript history | on device; account after sign-in | ✅ | ✅ |
| Personal record: photo → confirmed values → trend | 1 profile | family | family |
| Family / proxy profiles | — | ✅ | ✅ |
| Consult a clinician | — | pay-per-consult | credits included |

Prices: `PRICE_PLUS_NPR`, `PRICE_PRO_NPR`, `MINUTES_PLUS`, `MINUTES_PRO`,
`TRIAL_MINUTES_FREE` in one config file, shown in NPR. **Owner sets.**

### Principles

1. **Safety is never paid.** Emergency interception, basic answers, and the
   advisory copy are free forever. Charge for convenience, capacity and
   depth — never for the thing that keeps someone alive at 11 pm.
2. **The choice appears when the value is felt**, in the dialogue box, in one
   Nepali sentence with the price, e.g. after a first voice answer:
   *आवाजमै कुराकानी गर्न चाहनुहुन्छ? Plus — रु X/महिना।* No pricing wall on
   arrival. A `/pricing` page exists for people who want to compare.
3. **Metering is honest and visible.** Remaining free minutes are shown; the
   moment they run out the app says so and offers Plus — it does not silently
   degrade.
4. **Anonymous first.** Free-tier metering runs on-device against the
   anonymous id and migrates to the account on sign-in (existing path).
   Paid tiers require an account and a Nepal payment method (eSewa /
   Khalti / ConnectIPS — comparison is Round four G).

### Build order

1. Tier content + config + `/pricing` page (static; no server).
2. On-device metering for duplex trial minutes; upsell card in the dialogue.
3. Server: entitlement checks in `apps/api`, usage ledger per user.
4. Payments (owner picks provider) → tier upgrade → entitlement.

## 3. Duplex voice (Gemini Live) — Round five K′

Spike first, product second.

- `/voice-lab` (owner-only, behind `GEMINI_LIVE_ENABLED=true`): a Vercel
  route mints an **ephemeral token**; the page opens a Live session in Nepali
  with our system instruction (same safety text as the text path), shows the
  live transcript of both sides, and runs the **emergency watcher**: on a red
  flag in either transcript, cancel generation and play our fixed template.
- Prove on the owner's real phone: Nepali in/out, interruption, latency,
  behaviour on a bad connection (fall back to Round five H conversation
  mode). Record findings in this file.
- Then: duplex becomes the default when the mic is tapped for Plus/Pro
  and trial minutes; conversation mode (H) is the free / fallback path.
- **Safety shape changes** in duplex: interception is concurrent on the
  transcript (interrupt within ~1 s), not pre-model. Owner has been told;
  the watcher plus a hard system instruction is the mitigation.

## 4. Spoken-Nepali corpus

### Why it is worth doing

Public Nepali speech data is small, mostly read speech, mostly Kathmandu
standard. There is no spontaneous, dialect-diverse, health-domain Nepali
corpus. One that covers Terai/Madhesh, Karnali, far-west and eastern hills,
and Nepali as spoken by Maithili, Bhojpuri, Tharu, Tamang, Newar, Gurung and
Magar first-language speakers, would let us fine-tune an ASR model
(Whisper / MMS class) that understands our actual users. That is a moat.

### The rule that makes it survivable

Health conversations are the most sensitive data there is. Consent must be
**explicit, separate from using the service, revocable, and never a
condition of the free tier.** No "free because we keep your voice". Nepal's
Individual Privacy Act (2075) and ordinary ethics both point the same way.

### Two streams

**A. Voice Contribution (the corpus engine).** A separate flow, Common
Voice style: read prompts *and* free-speech tasks (*"describe how you make
dal"*, *"tell me about your village"*, *"explain what a fever feels like"*),
with self-reported district, mother tongue, age band, and optional gender.
Non-health by default, richly labelled, clean.

**B. Opt-in on health conversations.** A clear toggle, **off by default**,
explained in plain Nepali, delete-anytime, shown in the account page and
once — never nagging — in the dialogue. Stored separately from identity.

**Reward, don't coerce.** Contributions earn Plus minutes (e.g. 20 verified
recordings → 1 month Plus). Transparent value exchange; also a freemium
funnel.

**Crowd verification.** Contributors validate others' clips (listen; mark
the transcript right / wrong / unclear). Two agreeing validations = verified.
This is what produces training-grade transcripts.

### Pipeline

- Capture: browser `MediaRecorder` (opus/webm) → upload to object storage
  **on our own server** (never Vercel), 16 kHz mono derived copy for
  training, original kept.
- Record: `{clipId, contributorId (pseudonymous), consentVersion, task,
  promptId?, district, motherTongue, ageBand, gender?, device, durationMs,
  snrDb, draftTranscript, validations[]}`.
- Draft transcript from ASR (Live API transcription or Whisper), then human
  validation queue.
- Quality gates: min/max duration, SNR floor, silence trim, near-duplicate
  detection, profanity/PII scan on transcripts before any release.
- Releases: versioned (`nepali-speech-v0.1`), with a datasheet (who, where,
  how consented, known gaps). **Licence is an owner decision** — decide
  before the first release: proprietary, or open (CC-BY-style) to build
  goodwill and attract validators.
- Deletion: a contributor's request removes clips from storage and from
  every future release; releases already made are documented as such.

### Baselines to measure against (do not invent numbers — link)

- Mozilla Common Voice — Nepali subset
- OpenSLR — Nepali ASR / TTS sets (Google-contributed)
- Google FLEURS — Nepali
- Whisper large-v3 / MMS Nepali WER on our own validation set, once we have one

### Build order

1. Consent copy (ne/en) + consent versioning + toggle in account (needs API).
2. Contribution flow UI + storage endpoint + quality gates (needs server).
3. Validation flow + verified-transcript pipeline.
4. First internal release + datasheet; WER baseline of open models on it.
5. Fine-tune spike; compare WER; decide whether to serve our own model.

## 5. What blocks all of it

The dedicated API server: accounts, entitlements, payments, audio storage
and the corpus pipeline all live there. `docs/deployment/dedicated-server.md`
is the runbook. Until it runs, only §2 step 1–2 and the §3 spike (with
billing on) can ship.
