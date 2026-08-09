import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import type { LanguageCode, TwinFact } from '@swasthya/shared-types';
import {
  grantConsent,
  hasPurpose,
  purposeForUtteranceKind,
  retainUtterance,
  revokeConsent,
  type ConsentGrant,
  type ConsentPurpose,
  type CorpusUtterance,
  type UtteranceKind,
} from '@swasthya/language-corpus';
import { generateLocalOwnerId, generateUtteranceId } from '@/lib/local-id';

/** What a caller supplies to capture an utterance; the rest is filled in here. */
export interface UtteranceCapture {
  kind: UtteranceKind;
  rawText: string;
  precedingAssistantText?: string | null;
}

interface AppState {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  facts: TwinFact[];
  addFact: (fact: TwinFact) => void;
  skippedPrompts: string[];
  skipPrompt: (promptId: string) => void;
  lowBandwidth: boolean;
  setLowBandwidth: (enabled: boolean) => void;
  /**
   * Scopes captured documents to this run of the app — see `local-id.ts` for
   * why this is session-scoped rather than a real account id.
   */
  ownerId: string;
  /**
   * language-corpus.md §3 consent grants — every optional purpose defaults
   * off (`consentGrants` starts empty) and is toggled independently through
   * `app/consent.tsx`, never bundled into any terms-acceptance flow.
   */
  consentGrants: ConsentGrant[];
  hasConsent: (purpose: ConsentPurpose) => boolean;
  setConsent: (purpose: ConsentPurpose, granted: boolean) => void;
  /**
   * language-corpus.md §2: the companion's own capture point. Gated on a live
   * grant for the utterance's purpose *before* `retainUtterance` is ever
   * called — when nothing is live this is a silent no-op, which is the normal
   * case for most people. If the gate is satisfied and `retainUtterance`
   * still throws, that is a real bug and must not be swallowed here.
   */
  corpusUtterances: CorpusUtterance[];
  captureUtterance: (input: UtteranceCapture) => void;
  /**
   * language-corpus.md §2's "ask there rather than at signup": the companion
   * offers this the moment a CORRECTION happens, not at consent screen or
   * signup. Grants `MODEL_TRAINING_TEXT` and retains the utterance in one
   * call rather than a `setConsent` followed by `captureUtterance`, because
   * those are two separate `useState` updates — the second would still read
   * the pre-grant `consentGrants` from this render's closure and refuse the
   * very utterance the person just agreed to keep.
   */
  grantConsentAndCapture: (input: UtteranceCapture) => void;
}

const Context = createContext<AppState | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<LanguageCode>('ne');
  const [facts, setFacts] = useState<TwinFact[]>([]);
  const [skippedPrompts, setSkippedPrompts] = useState<string[]>([]);
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const [ownerId] = useState(generateLocalOwnerId);
  const [consentGrants, setConsentGrants] = useState<ConsentGrant[]>([]);
  const [corpusUtterances, setCorpusUtterances] = useState<CorpusUtterance[]>([]);
  const value = useMemo<AppState>(() => ({
    language, setLanguage, facts,
    addFact: (fact) => setFacts((current) => [...current.filter((item) => item.kind !== fact.kind), fact]),
    skippedPrompts, skipPrompt: (id) => setSkippedPrompts((current) => [...new Set([...current, id])]),
    lowBandwidth, setLowBandwidth, ownerId,
    consentGrants,
    hasConsent: (purpose) => hasPurpose(consentGrants, purpose, new Date().toISOString()),
    setConsent: (purpose, granted) => {
      const now = new Date().toISOString();
      setConsentGrants((current) =>
        granted
          ? hasPurpose(current, purpose, now)
            ? current
            : [...current, grantConsent(purpose, ownerId, now)]
          : revokeConsent(current, purpose, now),
      );
    },
    corpusUtterances,
    captureUtterance: (input) => {
      const now = new Date().toISOString();
      // The gate: skip quietly when nothing is live for this purpose, since
      // that is the ordinary state for anyone who hasn't opted in. Once past
      // this check, `retainUtterance` is trusted to throw rather than drop —
      // see its own doc comment in `packages/language-corpus`.
      if (!hasPurpose(consentGrants, purposeForUtteranceKind(input.kind), now)) return;
      const utterance = retainUtterance(
        {
          id: generateUtteranceId(),
          ownerId,
          kind: input.kind,
          rawText: input.rawText,
          locale: language,
          capturedAt: now,
          precedingAssistantText: input.precedingAssistantText ?? null,
        },
        consentGrants,
      );
      setCorpusUtterances((current) => [...current, utterance]);
    },
    grantConsentAndCapture: (input) => {
      const now = new Date().toISOString();
      const purpose = purposeForUtteranceKind(input.kind);
      const grants = hasPurpose(consentGrants, purpose, now)
        ? consentGrants
        : [...consentGrants, grantConsent(purpose, ownerId, now)];
      const utterance = retainUtterance(
        {
          id: generateUtteranceId(),
          ownerId,
          kind: input.kind,
          rawText: input.rawText,
          locale: language,
          capturedAt: now,
          precedingAssistantText: input.precedingAssistantText ?? null,
        },
        grants,
      );
      setConsentGrants(grants);
      setCorpusUtterances((current) => [...current, utterance]);
    },
  }), [consentGrants, corpusUtterances, facts, language, lowBandwidth, ownerId, skippedPrompts]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppState(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error('useAppState must be used within AppStateProvider');
  return value;
}
