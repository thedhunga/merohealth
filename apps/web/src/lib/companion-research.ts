export type ResearchLanguage = 'ne' | 'en';

export interface ResearchCitation {
  title: string;
  url: string;
  snippet?: string;
  date?: string;
}

export interface HealthResearch {
  /**
   * `gemini-ungrounded` is the owner-enabled fallback used only when search
   * grounding is refused on the configured key: the model answers without
   * live sources, says so, and returns no citations rather than invented
   * ones. On by owner decision (2026-08-17); RESEARCH_ALLOW_UNGROUNDED=false turns it off.
   */
  provider: 'perplexity-sonar' | 'gemini-grounded' | 'gemini-ungrounded';
  status: 'complete' | 'setup-required' | 'unavailable';
  answer: string | null;
  citations: ResearchCitation[];
  relatedQuestions: string[];
  disclaimer: string;
  /**
   * Deprecated: the UI no longer links off-site, so nothing reads this. Kept
   * on the shape so older clients keep parsing; new providers return null.
   */
  externalHealthHubUrl: string | null;
  /**
   * Present when `status` is `unavailable`, or when the answer came from a
   * degraded path (`gemini-ungrounded`): a short, sanitised reason
   * (upstream HTTP status and error code — never a key, never a URL with
   * credentials). Exists so a failing production call can be diagnosed from
   * its own response instead of from server logs nobody is watching. The UI
   * does not render it.
   */
  diagnostic?: string;
}

/**
 * Present only when the completed answer named a medicine or gave
 * instruction-shaped advice ("take", "stop", a dose). Computed by the route
 * from the answer text via `detectAdvisoryTriggers` — never by the model —
 * so a health question about medicines can never talk its way out of the
 * warning. `medicine` names what was detected; `advice` is the generic
 * variant for instruction-shaped text that named nothing specific.
 */
export interface ResearchAdvisory {
  kind: 'medicine' | 'advice';
  medicines: string[];
}

export interface CompanionResearchResponse {
  assessment: {
    riskLevel: string;
    matchedRuleIds?: string[];
    interruptConversation: boolean;
    templateId?: string;
  };
  template: string | null;
  research: HealthResearch | null;
  advisory: ResearchAdvisory | null;
}
