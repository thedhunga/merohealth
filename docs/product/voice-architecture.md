# Voice architecture — Web Speech API vs server STT/TTS vs Gemini Live

> Round five, task K. This is an assessment, not a decision — the last
> section is a stop sign, not a recommendation. Owner decides.

## 1. Why this document exists

Mero Health's voice path today is one specific choice: the browser's own
Web Speech API, half-duplex, free, already shipped (`useSpeechDictation.ts`,
`useSpeechPlayback.ts`, wired into `GetCareFlow` and the Round seven mic-hero
components). Round six K′ built a second path as a flag-gated spike — Gemini
Live duplex voice — but never turned it on (`GEMINI_LIVE_ENABLED` is unset
everywhere this document was written, so `/api/voice/token` 404s and
`/voice-lab` cannot open a real session). A third path, server-side STT/TTS,
has never been built at all.

Three real options exist. This document lays out what each one actually is
in this codebase today, what it would cost to build the ones that aren't
built, and what it can and cannot do for the person this product is for: a
Nepali speaker, on a mid-range Android phone, often on a slow connection,
asking a health question they are worried about.

## 2. Method — what a headless agent run can and cannot verify

This assessment was written by a scheduled agent with no physical device and
no browser audio/microphone hardware available — the same limitation
`docs/product/pwa.md` disclosed for install testing, and it applies more
here, not less: TTS voice availability, STT accuracy, and Gemini Live's
turn-taking latency are all things a phone in a hand demonstrates and a
sandbox cannot. Everything below that is a **requirement or a behaviour** is
read from the code that implements it (cited by file) or from
`docs/product/freemium-and-voice-corpus.md`, which already carries the
owner's own direction on this trade-off. Everything marked **unverified** is
a real gap, not filled in with a plausible-sounding guess.

This run's network egress also could not reach `ai.google.dev` (blocked by
the sandbox's own egress policy, confirmed by a direct fetch attempt) — the
Gemini API pricing link below is the correct, well-known canonical URL for
that page, but its content was not re-confirmed live in this run.
`cloud.google.com/speech-to-text/pricing` and
`cloud.google.com/text-to-speech/pricing` were reachable and confirmed to
exist.

## 3. Requirements

What the product actually needs from a voice architecture, derived from
Round five (`docs/product/agent-progress.md`, Round five intro) and the
standing constraints in this ledger:

1. **Emergency interception is never optional.** `packages/clinical-safety`
   must see every turn before it reaches the person, in every voice path —
   not just the ones that make it easy.
2. **Nepali is the primary language**, not a fallback — recognition,
   synthesis and the model's own responses.
3. **Works on a mid-range Android phone.** This is the declared target
   device across the ledger (Round seven's design principles, Round six's
   corpus goals); an architecture that only works well on a flagship or on
   desktop Chrome does not meet the bar.
4. **Degrades honestly on a bad connection**, rather than hanging or
   silently failing — Round five H's conversation mode and Round six K′'s
   fallback-to-H behaviour are both existing examples of this principle.
5. **Audio leaves the device only when the architecture requires it**, and
   the person should be able to reason about where it goes — this is the
   same instinct behind `storage-adapters`' BYO-storage design in
   `docs/architecture/platform-vision.md` §3.1, applied to voice.
6. **Cost is visible before it is committed to.** Round six's freemium
   design already prices duplex voice as the paid tier specifically because
   it is not free to run; whichever path becomes default needs its cost
   understood, even if the number itself is an owner decision.

## 4. The three paths

### 4.1 Web Speech API — shipped, default today

**What it is in this repo.** `useSpeechDictation.ts` (STT) and
`useSpeechPlayback.ts` (TTS) call the browser's native
`SpeechRecognition`/`speechSynthesis` APIs directly. No network hop through
Mero Health infrastructure exists for either direction — recognition and
synthesis run in the browser or the OS's own speech service.

**What it can do.**
- **Free.** No API key, no billable request, no infrastructure to run.
- **Already shipped**, including the Round five H conversation mode:
  continuous listening, a 1.2 s silence window before an utterance is
  considered complete rather than the recognizer's own end-of-speech guess
  (`useSpeechDictation.ts:172-184`), and an explicit tap-to-interrupt gesture
  — tapping the mic while the answer is playing cancels playback outright
  and starts listening, rather than passive voice-activity detection
  (`GetCareFlow.tsx:253-265`).
- **The strongest safety shape of the three.** Every utterance is a
  complete, finished piece of text before anything downstream sees it, so
  `detectAdvisoryTriggers` and the domain classifier run **before** the
  model, exactly like the text path — no separate safety mode is needed.
- **No audio ever reaches Mero Health servers** because of this feature —
  stated directly in the code comment at `useSpeechDictation.ts:16-20`.

**What it cannot do.**
- **Half-duplex only.** One party speaks, then the other; there is no true
  interruption mid-sentence, only the explicit "start talking again cancels
  playback" behaviour Round five chose deliberately over passive barge-in.
- **Browser- and OS-dependent, and that dependency is uneven.** Firefox has
  no `SpeechRecognition`/`webkitSpeechRecognition` at all — `supported`
  stays `false` and no mic button renders (`useSpeechDictation.ts:96-97`).
  On the synthesis side, "most Android phones ship a Nepali voice through
  the system TTS, but many desktops do not" is stated directly in
  `useSpeechPlayback.ts:9-11`; when no matching voice exists, the button
  simply does not render rather than reading Devanagari in an English voice.
  **Unverified in this run:** which specific Android OEMs/versions ship a
  Nepali voice and which do not — this needs owner testing on real devices,
  the same gap `pwa.md` already names for install testing.
- **Chrome's recognizer sends audio to Google's own recognition service**
  (not Mero Health's servers, but not purely on-device either) — disclosed
  in the same code comment cited above. Whether that is acceptable for a
  health conversation is a genuine privacy question, separate from whether
  Mero Health's own infrastructure sees the audio.

### 4.2 Server-side STT/TTS — not built

**What it would be.** Audio captured in the browser (`MediaRecorder`, the
same primitive Round six's Voice Contribution flow already uses in
`/contribute`) streamed or uploaded to `apps/api`, forwarded to a
third-party STT vendor, transcribed text run through the existing text
pipeline, and the reply sent to a TTS vendor before playback. **No vendor
has been chosen anywhere in this repository** — this is not a gap in this
document, it is a genuinely open decision. The natural candidates, given the
codebase's existing dependence on Google infrastructure (Gemini for the
model, Gemini Live for the K′ spike), are Google Cloud Speech-to-Text and
Text-to-Speech, but that is an observation about proximity, not a
recommendation.

**What it can do.**
- **Consistent voice quality regardless of device or browser.** This is the
  direct fix for Web Speech's biggest gap: a vendor TTS voice is the same on
  a Firefox desktop, an old Android phone, and an iPhone, closing the "no
  Nepali voice on this device" hole entirely.
- **Works in browsers with no Web Speech support at all** (Firefox, older
  WebViews) — capture-and-upload only needs `MediaRecorder`, which is far
  more broadly supported than `SpeechRecognition`.
- **Keeps the pre-model safety shape.** Like Web Speech, a transcript is a
  finished piece of text before the model or the safety checks ever see it
  — no new safety mode required, same as §4.1.

**What it cannot do, and what it costs to build.**
- **Depends on the dedicated API server being reachable.**
  `docs/product/freemium-and-voice-corpus.md` §5 already states this
  directly: "the dedicated API server... audio storage... all live there
  ... until it runs, only [specific narrow slices] can ship." Server STT/TTS
  is squarely in the blocked set.
- **Adds a real network round trip Web Speech does not have** — browser to
  Mero Health server to vendor API and back, twice (once for the person's
  question, once for the answer), before anything is heard. On a slow
  connection this is strictly worse latency than the on-device Web Speech
  path, and still turn-based rather than duplex — it does not close the
  interruption gap Gemini Live closes, it only closes the voice-quality gap.
- **Audio now leaves the device**, to Mero Health's server and then to
  whichever vendor is chosen — a real change from Web Speech's "browser to
  OS/vendor recognition service" shape, and a bigger one than Gemini Live's
  (§4.3), since Gemini Live at least skips the Mero Health server hop via
  the ephemeral-token pattern.
- **No vendor, no cost model, no code exists.** This is the least-built of
  the three paths.

### 4.3 Gemini Live — built as a spike, gated off

**What it is in this repo.** `useGeminiLiveSession.ts` opens a WebSocket
directly from the browser to
`wss://generativelanguage.googleapis.com/.../BidiGenerateContent`, using an
ephemeral token minted server-side by `apps/web/src/app/api/voice/token/route.ts`
so the real `GEMINI_API_KEY` never reaches the client. The model id is
`gemini-live-2.5-flash-preview` by default, overridable via
`NEXT_PUBLIC_GEMINI_LIVE_MODEL` (`useGeminiLiveSession.ts:24-25`) — this is
the actual constant in the code today; the queue entry that named this task
referred to a different preview id, which is now stale next to what was
actually built. The whole path is inert unless `GEMINI_LIVE_ENABLED=true`,
which requires the owner to turn on Gemini billing; it is off everywhere
this document was written, so the route 404s (`route.ts:17-22`) and
`/voice-lab` cannot open a real session.

**What it can do.**
- **True duplex.** Continuous bidirectional PCM16 audio streaming, with the
  model's own interruption handling (`handleServerFrame`'s `interrupted`
  event stops playback immediately, `useGeminiLiveSession.ts:181-183`) —
  this is the only one of the three paths with real turn-taking rather than
  a silence-timeout heuristic.
- **Nepali (`ne`) is on Gemini Live's supported language list**, per the
  owner-direction summary already recorded in
  `docs/product/freemium-and-voice-corpus.md` §1.
- **The API key never reaches the browser.** The ephemeral-token mint
  (`route.ts`) is a real, working security boundary, not a stub — it returns
  only `{ token, expiresAt }`, and a failed mint is a `502`/`503`, never a
  fallback that leaks more.
- **Falls back to Round five's conversation mode on failure** — `setStatus`
  moves to `'fallback'` on a token-fetch failure, a missing `AudioContext`,
  a denied microphone, a WebSocket error, an unexpected close, or an 8 s
  setup timeout (`useGeminiLiveSession.ts:189-286`). This path does not fail
  silently; it hands back to the path in §4.1.

**What it cannot do, and what is unverified.**
- **The safety shape is genuinely weaker, and this is documented, not
  hidden.** Nothing sits between the microphone and the live model — the
  emergency watcher (`assessSafety` in `appendTranscript`,
  `useGeminiLiveSession.ts:125-137`) runs **concurrently**, on transcript
  deltas as they arrive, and interrupts + ends the session on a flagged
  turn. That is an interrupt-within-roughly-a-second mitigation, not the
  pre-model interception every other path in this product guarantees. The
  ledger itself calls this out under Round six K′: "Safety shape changes in
  duplex... Owner has been told." This document is not the first place that
  trade-off was raised, but it is the clearest single place to weigh it
  against the other two paths.
- **Costs money, and needs the owner's billing decision before it can even
  be spike-tested for real.** Gated behind `GEMINI_LIVE_ENABLED`, which is
  off. No session has ever actually been opened against the live API from
  this codebase.
- **Unverified in this run, and unverifiable without the flag on and a real
  phone:** Nepali recognition/synthesis quality, interruption feel,
  round-trip latency, and behaviour on a degraded connection (3G or worse).
  This is exactly the gap Round six K′'s own next box names — "measured on
  the owner's phone... stop, owner decides go/no-go" — and it remains open
  after this document. Writing this comparison does not close that box; it
  sits next to it, not on top of it.
- **`createScriptProcessor` for audio capture is deprecated** (noted
  directly in the code, `useGeminiLiveSession.ts:147-149`) — acceptable for
  a flag-gated spike, called out in the code itself as not the right choice
  for a shipped product path, which would need an `AudioWorklet` rewrite.

## 5. Comparison

| | Web Speech API | Server STT/TTS | Gemini Live |
|---|---|---|---|
| Built today | ✅ shipped, default | ❌ not built | ✅ spike, flag off |
| Cost | Free | Vendor fee (unchosen) | Paid, billing off |
| Duplex / interruption | No — silence-timeout turns | No — same shape as Web Speech | Yes — real turn-taking |
| Safety interception point | Pre-model, every turn | Pre-model, every turn | Concurrent, ~1 s interrupt |
| Nepali TTS reliability | Device-dependent (gap on many desktops) | Vendor-consistent | Vendor-consistent (per Gemini) |
| Works without Web Speech support (e.g. Firefox) | No | Yes | Yes (needs `AudioContext`/WebSocket, which Firefox has) |
| Audio leaves the device | To OS/browser vendor recognizer only | To Mero Health server, then vendor | To Google, via ephemeral token (skips Mero Health server) |
| Needs the dedicated API server | No | Yes (§5, `freemium-and-voice-corpus.md`) | No (Vercel-only, per the same doc) |
| Mid-range Android, real-world behaviour | Unverified — device-dependent | N/A, unbuilt | Unverified — needs `GEMINI_LIVE_ENABLED=true` + owner's phone |

## 6. Cost sources — links only, no numbers stated here

- Gemini API (covers the Live API used in §4.3): `https://ai.google.dev/pricing`
  — this run's sandbox could not reach `ai.google.dev` (egress blocked) to
  re-confirm the page live; this is the correct, well-known canonical URL,
  not a guess, but treat "still current" as unverified until someone with
  open egress or a browser loads it.
- Google Cloud Speech-to-Text (a candidate vendor for §4.2, unchosen):
  `https://cloud.google.com/speech-to-text/pricing` — reachable and
  confirmed to exist by this run.
- Google Cloud Text-to-Speech (a candidate vendor for §4.2, unchosen):
  `https://cloud.google.com/text-to-speech/pricing` — reachable and
  confirmed to exist by this run.

No other vendor was investigated for §4.2 — Azure Speech, AWS Transcribe/Polly
and self-hosted Whisper are all real alternatives, mentioned here only so
the next reader knows they were not evaluated, not because a comparison
happened.

## 7. Stop — owner decides

This document does not choose. The open question is not just "which is
technically best" — it is whether the safety trade-off in §4.3 (pre-model
interception vs. a ~1 s concurrent interrupt) is acceptable for a health
product at all, and whether §4.2's server dependency and per-minute vendor
cost are worth taking on before the API server is otherwise load-bearing.
Round six K′'s findings box (Nepali quality, interruption, latency, 3G
behaviour, measured on the owner's real phone) is the concrete next step if
Gemini Live is the direction — it is a separate, still-open box in the
queue, not something this document substitutes for.
