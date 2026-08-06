import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import type { LanguageCode, TwinFact } from '@swasthya/shared-types';

interface AppState {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  facts: TwinFact[];
  addFact: (fact: TwinFact) => void;
  skippedPrompts: string[];
  skipPrompt: (promptId: string) => void;
  lowBandwidth: boolean;
  setLowBandwidth: (enabled: boolean) => void;
}

const Context = createContext<AppState | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<LanguageCode>('ne');
  const [facts, setFacts] = useState<TwinFact[]>([]);
  const [skippedPrompts, setSkippedPrompts] = useState<string[]>([]);
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const value = useMemo<AppState>(() => ({
    language, setLanguage, facts,
    addFact: (fact) => setFacts((current) => [...current.filter((item) => item.kind !== fact.kind), fact]),
    skippedPrompts, skipPrompt: (id) => setSkippedPrompts((current) => [...new Set([...current, id])]),
    lowBandwidth, setLowBandwidth,
  }), [facts, language, lowBandwidth, skippedPrompts]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppState(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error('useAppState must be used within AppStateProvider');
  return value;
}
