# HANDOFF — read this first if you are picking the project up cold

> Written 2026-08-16 so work can resume from any point without the
> conversation that produced it. Everything here is verified against the
> repository and production, not remembered. When something below is
> superseded, edit it here rather than adding a second document.

## What this is

Mero Health is a Nepali-first personal health platform: a person asks a
health question by voice or text, gets a grounded, cited answer in Nepali,
is stopped hard if it sounds like an emergency, and — once the backend is
live — keeps a personal record, adds family members, photographs lab reports,
and eventually pays to consult a clinician. The full intent is in
`docs/architecture/platform-vision.md`; the user-centred gap list is
`docs/product/user-journey-gap.md`.

## Where things live

| Thing | Where |
|---|---|
| Public website (Next.js 16) | `apps/web` — deployed on **Vercel**, `main` branch, Root Directory `apps/web` |
| Backend API (NestJS + Prisma) | `apps/api` — **never deployed**; runbook in `docs/deployment/dedicated-server.md` |
| Mobile app (Expo) | `apps/mobile` — not deployed; `/app` on the site 404s |
| Domain packages (28) | `packages/*` — pure TS, tested with in-memory fakes |
| The build queue the cloud agent works from | `docs/product/agent-progress.md` |
| Vercel-exit checklist | `docs/deployment/hosting-migration-inventory.md` |
| Asset prompts (Gemini/Veo) | `docs/product/asset-brief-veo.md` |
| Freemium, duplex voice, spoken-Nepali corpus — plan and rules | `docs/product/freemium-and-voice-corpus.md` |

Live site: **https://merohealth-beta.vercel.app**
Config probe (safe, public): **`/api/companion/research/health`** — reports
which research provider will answer and whether its key is present. Use this
before anything else when answers say `setup-required`.

## What works in production right now

- Homepage, all marketing routes, both locales (`/` Nepali, `/en` English)
- `/get-care`: text and **voice** input, deterministic emergency interception,
  answer panel with **Listen** (read aloud where a Nepali voice exists)
- Anonymous memory on the device (localStorage), profile prompts as reactions,
  sign-in *suggested* after two real answers
- Photography and two ambient video loops (hero, BP pages)
- Every off-site link and every provider name is gone from the UI

## What does not work, and exactly why

| Broken | Cause | Fix |
|---|---|---|
| Answers carry **no citations** (`provider: gemini-ungrounded`) | **Search grounding is not in Gemini's free tier.** Key is valid; plain calls succeed; every grounded call is refused on quota, on all current Flash models and both endpoints (verified live 2026-08-17). **Owner chose option B the same day**: answer without live sources. This is the code default; answers are labelled, citation-free, with a stronger Nepali/English disclaimer, and take ~5 s. Verified live: a real Nepali fever question answered correctly with red flags and "no antibiotics without a doctor". | To get grounded, cited answers back: enable billing on the Google Cloud project behind `GEMINI_API_KEY`. The grounded path is tried first on every call and takes over automatically the moment quota allows — no code change. To fail closed instead of answering ungrounded, set `RESEARCH_ALLOW_UNGROUNDED=false`. Any failing call returns a sanitised `diagnostic` saying exactly why. |
| Sign-in / register / account / family | Web calls `NEXT_PUBLIC_API_URL`, unset → `http://localhost:4000`. **The API has never been deployed.** | Follow the API-only runbook in `docs/deployment/dedicated-server.md`, then set `NEXT_PUBLIC_API_URL` in Vercel. |
| Google sign-in | Not built; needs an OAuth client id only the owner can create | Spec is in the ledger, section D. |
| `/app` 404 | The Expo build is never published — the script that copies it lives in the root `vercel.json`, which Vercel doesn't read (Root Directory is `apps/web`) | Ledger, Round three B3. |
| 12 API tests fail locally | `TypeError: Right-hand side of 'instanceof'` — a class-identity mismatch (two `@nestjs/common` copies) after a pnpm reinstall. **Pre-existing on `origin/main`, not caused by recent work.** | `pnpm install --frozen-lockfile` from a clean `node_modules`, or `pnpm dedupe`. Not a code bug. |

## What was done in the last session (2026-08-16), in order

1. Removed both off-site exits from `/get-care`; scrubbed every provider name
   from user copy. (`ce83f1c`)
2. Anonymous history + reaction-style profile prompts + sign-in suggestion.
   (`ce83f1c`)
3. Voice in (Web Speech dictation) and voice out (Listen). (`e63cee9`)
4. Two video loops wired; `AmbientLoop` component with poster/reduced-motion
   fallbacks. (`e4b1387`)
5. **Gemini grounded provider** as free-tier default; `research-provider.ts`
   picks by configured key; 11 tests. (`5eb71cd`)
6. Config probe endpoint. Then this round:
7. `docs/product/user-journey-gap.md` — the honest gap list.
8. Round four queue in the ledger (deploy API → journey → payments).
9. `compose.server.yaml`: **Postgres + one-shot migrate service added**;
   API depends on migrate completing; DB bound to loopback.
10. `.env.server.example` rewritten for the real variables.
11. `docs/deployment/dedicated-server.md`: owner runbook prepended.
12. `apps/api`: `DatabaseUnavailableFilter` — a dead DB returns
    `503 DATABASE_UNAVAILABLE` + `Retry-After` on every data route instead
    of a bare 500. 6 tests. Registered in `main.ts`.

## Owner's product direction, 2026-08-17 (now Round five in the ledger)

Fully voice-interactive — "like talking with a real medical professional"
once the microphone is used; the conversation saved as history; the
conversation contained to health; and whenever advice is dispensed or a
common medicine is named, a clear advisory that the person must see a
doctor or authorised health worker before acting, and that this is for the
patient's research only. **None of that exists yet**: today it is one
question → one answer, no turn memory, no containment, no medicine
advisory, single-utterance dictation. The ledger's Round five specifies it
in the deliberate order advisory → containment → conversation.

## Standing rules (do not undo these)

- **Nepali first.** Bare paths are Nepali; `/en` is English. Every string in
  both `apps/web/messages/*.json`. Never hardcode copy.
- **Safety runs before any model.** `packages/clinical-safety` intercepts
  emergencies deterministically; nothing routes around it.
- **Anything computable is computed, never generated.** Trends come from
  `buildAnalyteTrend`; the model phrases, it does not invent numbers.
- **Only CONFIRMED / CORRECTED observations are reasoned over.**
- **No off-site exits, no provider names in the UI.** It is Mero Health's answer.
- **Invent nothing.** No fake stats, partners, clinicians, testimonials.
- **Every module declares its degradation and ships an outage test.**
- **Palette:** indigo `#221C4B` + marigold `#F4A62A` on warm paper. Never the
  old green. Never a health-tech blue.
- **Mobile is the product.** Measure at 375px; 44px tap targets.

## How to resume

```bash
git pull
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Then read `docs/product/agent-progress.md` from `# Round four` and take the
first unchecked task. The scheduled cloud agent does the same hourly on
`main`; check the log at the bottom of that file for what it did overnight.

## The one thing that unblocks everything

**Deploy the API.** Rows 6–10 of the user-journey gap are one gap. Until
`apps/api` runs somewhere with a database and `NEXT_PUBLIC_API_URL` points at
it, everything behind sign-in is unreachable no matter how much of it is
built. The runbook is written; it needs a person with the server login.
