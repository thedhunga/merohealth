import { expect, type Page } from '@playwright/test';

/**
 * Writes a pre-existing anonymous conversation to `localStorage` before the
 * page ever loads, matching `apps/web/src/lib/anonymous-history.ts`'s own
 * shape exactly. `page.addInitScript` runs before any page script, so the
 * value is already there when `HomeGate`/`GetCareFlow` read it on mount —
 * far more deterministic than performing the real ask-a-question flow just
 * to get a device into a "has history" state. `askedPrompts` defaults to
 * all three profile-prompt keys so a seeded "returning" device does not
 * also trip a profile prompt mid-journey; pass `[]` to test that path on
 * purpose.
 */
export async function seedAnonymousHistory(
  page: Page,
  exchanges: Array<{
    question: string;
    answer: string | null;
    outcome: 'answered' | 'emergency' | 'offTopic' | 'unavailable';
    language?: 'ne' | 'en';
  }>,
  askedPrompts: string[] = ['ageBand', 'askingFor', 'chronicCondition'],
) {
  const store = {
    version: 1,
    exchanges: exchanges.map((e, i) => ({
      id: `seed-${i}`,
      askedAt: new Date().toISOString(),
      language: e.language ?? 'ne',
      ...e,
    })),
    profile: { askedPrompts },
    usage: { monthKey: new Date().toISOString().slice(0, 7), secondsUsed: 0 },
  };
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ['mero-health:anon-history', JSON.stringify(store)] as [string, string],
  );
}

/**
 * Intercepts `POST /api/companion/research` with a queue of canned
 * responses, one per call, in order — so a journey can exercise a real
 * multi-turn conversation without a live model call. The shape matches
 * `CompanionResearchResponse` (`apps/web/src/lib/companion-research.ts`).
 */
export async function mockResearchAnswers(
  page: Page,
  responses: Array<{ answer: string; advisory?: { kind: 'medicine' | 'advice'; medicines: string[] } }>,
) {
  let call = 0;
  await page.route('**/api/companion/research', async (route) => {
    const next = responses[Math.min(call, responses.length - 1)];
    call += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        assessment: { riskLevel: 'LOW', interruptConversation: false },
        template: null,
        research: {
          provider: 'gemini-ungrounded',
          status: 'complete',
          answer: next.answer,
          citations: [],
          relatedQuestions: [],
          disclaimer: 'यो जानकारी अनुसन्धान र बुझाइका लागि मात्र हो, चिकित्सकीय सल्लाह होइन।',
          externalHealthHubUrl: null,
        },
        advisory: next.advisory ?? null,
        domain: 'HEALTH',
      }),
    });
  });
}

/**
 * Fakes a signed-in `GET /v1/auth/me` response — the shape
 * `round-seven.journeys.spec.ts`'s `/account` journey already established
 * inline; pulled out here so `/contribute`'s session-gated journeys (and any
 * future protected-page journey) can reuse it instead of re-typing the
 * fixture body. Overrides merge onto the same defaults that journey uses, so
 * an existing inline call and this one produce an identical session.
 */
export async function mockSignedInSession(
  page: Page,
  overrides: Partial<{
    userId: string;
    phone: string;
    role: string;
    locale: 'ne' | 'en';
    patientProfileId: string | null;
    assuranceLevel: string;
  }> = {},
) {
  await page.route('**/v1/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        userId: 'e2e-user',
        phone: '9800000000',
        role: 'PATIENT',
        locale: 'ne',
        patientProfileId: null,
        assuranceLevel: 'REGISTERED',
        ...overrides,
      }),
    });
  });
}

/**
 * Fakes `GET /v1/language-corpus/consent` and
 * `POST /v1/language-corpus/consent/VOICE_CONTRIBUTION/grant` with a small
 * in-memory grant list, so a `/contribute` journey can start from either a
 * "never consented" or "already consented" state and, in the first case,
 * actually exercise the real grant button rather than starting pre-granted
 * every time. `initiallyGranted` seeds the state; granting flips it so
 * `useCorpusConsent`'s `refreshConsent()` (a second `GET` after the `POST`)
 * sees the change, matching how the real API behaves.
 */
export async function mockCorpusConsent(page: Page, initiallyGranted: boolean) {
  let granted = initiallyGranted;
  const grant = () => ({
    id: 'e2e-consent-grant',
    userId: 'e2e-user',
    kind: 'VOICE_CONTRIBUTION',
    version: 'voice-contribution-consent-v1',
    grantedAt: new Date(0).toISOString(),
    revokedAt: null,
  });

  await page.route('**/v1/language-corpus/consent', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ grants: granted ? [grant()] : [] }),
    });
  });

  await page.route('**/v1/language-corpus/consent/VOICE_CONTRIBUTION/grant', async (route) => {
    granted = true;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(grant()) });
  });
}

/**
 * Fakes `POST /v1/language-corpus/voice-contribution/clips` with a bare
 * success body — `TaskRecorder.handleSubmit` never reads the response, only
 * whether the request resolved, so an empty JSON object is a faithful mock.
 */
export async function mockVoiceClipSubmit(page: Page) {
  await page.route('**/v1/language-corpus/voice-contribution/clips', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({}) });
  });
}

/**
 * Replaces `navigator.mediaDevices.getUserMedia` and `window.MediaRecorder`
 * with fakes that drive `useVoiceContributionRecorder`'s own event listeners
 * (`ondataavailable`/`onstop`) directly, the same `page.addInitScript`
 * technique `fixtures.ts` already uses to report `SpeechRecognition`
 * presence — chosen over Playwright's `--use-fake-device-for-media-stream`
 * launch flags because those are Chromium-only and this repo's `iphone`
 * (WebKit) project needs the same journey to run. `start()` emits a chunk
 * every 100ms so a short recording still has data before `stop()`; `stop()`
 * always emits one final chunk first so `chunksRef` is never empty.
 */
export async function mockVoiceRecorder(page: Page) {
  await page.addInitScript(() => {
    class FakeMediaStreamTrack {
      readonly kind = 'audio';
      enabled = true;
      readyState: 'live' | 'ended' = 'live';
      stop() {
        this.readyState = 'ended';
      }
    }

    class FakeMediaStream {
      private readonly tracks = [new FakeMediaStreamTrack()];
      getTracks() {
        return this.tracks;
      }
      getAudioTracks() {
        return this.tracks;
      }
    }

    class FakeMediaRecorder {
      mimeType: string;
      state: 'inactive' | 'recording' = 'inactive';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      private timer: ReturnType<typeof setInterval> | null = null;

      static isTypeSupported() {
        return true;
      }

      constructor(stream: unknown, options?: { mimeType?: string }) {
        void stream;
        this.mimeType = options?.mimeType ?? 'audio/webm';
      }

      start() {
        this.state = 'recording';
        this.timer = setInterval(() => {
          this.ondataavailable?.({ data: new Blob(['fake-audio-chunk'], { type: this.mimeType }) });
        }, 100);
      }

      stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        if (this.timer !== null) clearInterval(this.timer);
        this.ondataavailable?.({ data: new Blob(['fake-audio-final'], { type: this.mimeType }) });
        this.onstop?.();
      }
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => new FakeMediaStream() },
    });
    (window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder;
  });
}

/** Type a question on /get-care and submit it as a person would. */
export async function askOnGetCare(page: Page, message: string, locale: 'ne' | 'en' = 'ne') {
  await page.goto(locale === 'en' ? '/en/get-care' : '/get-care');
  const box = page.getByRole('textbox').first();
  await expect(box).toBeVisible();
  await box.fill(message);
  // Enter submits in the flow; the button is the fallback.
  await box.press('Enter');
  const submit = page.getByRole('button', { name: /सुरक्षित रूपमा जाँच्नुहोस्|Check safely|पठाउनुहोस्|Send/ });
  if (await submit.isVisible().catch(() => false)) await submit.click().catch(() => undefined);
}

/** Every interactive control on screen must meet the 44 px tap-target floor. */
export async function expectTapTargets(page: Page, minPx = 44) {
  const small = await page.evaluate((min) => {
    const els = [...document.querySelectorAll<HTMLElement>('a,button,[role=button],input,textarea,select')]
      // Skip links and screen-reader-only controls are hidden until focused;
      // their resting box is not a tap target.
      .filter((el) => !(el instanceof HTMLAnchorElement && el.getAttribute('href')?.startsWith('#')))
      .filter((el) => !String(el.className).split(/\s+/).some((c) => c === 'sr-only' || c.startsWith('sr-only')));
    return els
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { t: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((x) => x.w > 0 && x.h > 0 && (x.h < min || x.w < min));
  }, minPx);
  expect(small, `controls under ${minPx}px: ${JSON.stringify(small)}`).toEqual([]);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow, 'page scrolls horizontally').toBe(false);
}
