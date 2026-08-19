# What a person wants from this, and what they can actually do today

> Written from the user's chair, then checked against production. Kept short
> on purpose: it is a gap list, not a vision. Re-run the "today" column after
> each round — the point is to watch it fill in.

## The person

Sabina, 34, Lalitpur, smartphone, reads Nepali comfortably but not medical
English. Her mother has high blood pressure and lives two hours away. She
opens the site at 11pm because her mother sounded unwell on the phone.

## What she wants, in the order she wants it

| # | She wants to… | Today (production) | Why not |
|---|---|---|---|
| 1 | Type or say "आमालाई टाउको दुख्यो र चक्कर आयो" and get an answer in Nepali | ✅ voice + text work; answer **blocked** | `GEMINI_API_KEY` not reaching the runtime — see probe |
| 2 | Be stopped, clearly, if it sounds like an emergency | ✅ | deterministic, runs before any model |
| 3 | Have the answer read aloud to her mother over the phone | ✅ where the phone has a Nepali voice | — |
| 4 | Come back tomorrow and have it remember | ✅ on this device | anonymous history, localStorage |
| 5 | Be asked one useful thing, not a form | ✅ | profile prompts as reactions |
| 6 | Save it properly — sign in with phone or Google | ❌ **fails silently** | web calls `http://localhost:4000` — **the API is not deployed** |
| 7 | Add her mother as a person she asks for | ❌ same | `packages/family` exists, unreachable |
| 8 | Photograph her mother's BP report and have it read | ❌ same | records module exists, unreachable |
| 9 | See her mother's BP over the last three months | ❌ same | `buildAnalyteTrend` exists, no data path |
| 10 | Talk to a doctor tonight, pay, get a prescription | ❌ | teleconsultation/billing/prescribing exist as packages; no patient flow, no payment provider |
| 11 | Find a clinic near her mother that is open now | ⚠️ | `care-directory` searches fictional demo data |
| 12 | Trust that what she typed stays private | ✅ | never leaves the phone until sign-in; corpus is opt-in |

## The person — Prakash, grandson asking on her behalf

Prakash, 22, Kathmandu, university student. Devanagari-comfortable but not a
confident reader of long Nepali medical text; English is for coursework, not
health. His हजुरआमा (grandmother) lives with the family and does not use a
smartphone herself — when something is wrong, Prakash is the one who checks.

| # | He wants to… | Today (production) | Why not |
|---|---|---|---|
| 1 | Ask about her without filling in who she is first — "हजुरआमालाई घुँडा दुखेको छ, के गर्ने?" | ✅ | `nextProfilePrompt` never gates an answer on identity |
| 2 | Be asked *who* the question is for, not his own age, since it obviously isn't about him | ✅ | `behalfWords` (`packages: apps/web/src/lib/profile-prompts.ts`) matches हजुरआमा and fires the `askingFor` prompt ahead of `ageBand`; "अरू कसैका लागि" (other) is a real, reachable option — see `personas.journeys.spec.ts` |
| 3 | Have that answer picked up regardless — voice or typed, Nepali script | ✅ | same containment + research path as everyone else |
| 4 | Actually add her as a person in the account, not just an unlabelled "other" | ❌ **fails silently** | web calls `http://localhost:4000` — **the API is not deployed**, so `packages/family` is unreachable |
| 5 | See her by name in the family row next time he opens the home screen | ❌ same | `HomeScreen`'s family row only populates from an authenticated session's guardianship/delegation grants (`useFamilyGrants`) — there is no session to have any |
| 6 | Trust nothing about her condition was invented | ✅ | same no-fabrication guarantee as row 12 above |

## The person — Anish, English-speaking returnee

Anish, 29, moved back to Kathmandu last year after years abroad. Reads
English fluently, speaks Nepali but is slower reading long Nepali medical
text, so he uses the site under `/en`. He asked one question here last week
on this phone.

| # | He wants to… | Today (production) | Why not |
|---|---|---|---|
| 1 | Land on `/en` and see *his* home, not the marketing pitch again | ✅ | `homeVariant` (`apps/web/src/lib/home-screen.ts`) returns `'returning'` for any device with history, in either locale — only a first visit branches on language. Verified live and locked in by `personas.journeys.spec.ts`. |
| 2 | See last week's question, the mic hero, the chips — all in English | ✅ | `HomeScreen` reads every label through `next-intl`; nothing is hardcoded, so `homeScreen.*` in `en.json` covers it exactly as `ne.json` does |
| 3 | Ask a new question and get an answer in English | ✅ answer **not blocked** (superseded row 1 above — see HANDOFF.md: Gemini quota forces the ungrounded path, but it answers) | citation-free, ~5 s, stronger disclaimer instead of sources |
| 4 | Sign in and keep using the product past the anonymous/local-only stage | ❌ | same API-not-deployed gap as everyone else |

## The shape of the gap

Rows 6–10 are **one gap, not five**. Every one of them is domain code that is
written, tested, and unreachable, because there is no server for the web to
talk to. Deploying `apps/api` with a real database turns four ❌ into ✅ in one
move and makes row 10 buildable.

That is the whole priority. Nothing else on this list is worth building until
the API is live, because it would be one more thing pointing at localhost.

## Failure isolation — the standing rule for everything below

Each capability is its own module behind its own port, and **each declares
what happens when it is down**:

| Module | If it fails, the person sees… | Never… |
|---|---|---|
| Research (Gemini/Perplexity) | "answer briefly unavailable, ask again shortly" | a blank, a crash, an off-site link |
| Auth / API | the anonymous flow, exactly as before | a login wall, a lost question |
| Anonymous history | the answer still shows | a lost answer |
| Speech | the mic and Listen buttons vanish | a dead button |
| Family / delegation | her own record still opens | a locked own-record |
| Records / trends | the assistant answers from search, says "no records" | a fabricated number |
| Payments (future) | "payment unavailable, here is how to reach a clinic" | a charge with no consultation |
| Care directory | "directory unavailable" | fictional clinics presented as real |

The test that keeps this true is the same one every clinical module already
ships with: force it `DOWN`, assert the rest still works.

## Order of work

1. **Deploy `apps/api` + Postgres.** Everything else waits on this.
2. Point `NEXT_PUBLIC_API_URL` at it. Rows 6–9 light up.
3. ~~Migrate anonymous history on sign-in.~~ Done 2026-08-16: `POST
   /v1/history/migrate` plus the `apps/web` call after `verifyOtp` succeeds.
4. Google sign-in (queued, needs the owner's OAuth client id).
5. Photograph a report → record → trend, end to end for one analyte.
6. Care directory on real data, or clearly labelled as demonstration in the UI.
7. Pay-and-consult, once a payment provider is chosen. This is the largest
   remaining piece and the first with real money in it.

## Log

- 2026-08-16 — Written after finding that every authenticated web call
  targets `localhost:4000` in production. The API has never been deployed.
- 2026-08-19 — Added the two other personas task U asked for (Prakash,
  grandson asking on his grandmother's behalf; Anish, English-speaking
  returnee), each checked against the current source rather than assumed,
  with a matching Playwright journey in
  `apps/web/e2e/personas.journeys.spec.ts`. Sabina's answer row (row 1) is
  now stale in one respect noticed in passing: HANDOFF.md records that
  answers are no longer blocked as of 2026-08-17 (ungrounded, citation-free,
  ~5 s) — left as-is here since re-verifying that table end to end is a
  separate task from adding personas.
