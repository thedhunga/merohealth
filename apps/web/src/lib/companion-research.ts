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
   * ones. Off unless RESEARCH_ALLOW_UNGROUNDED=true.
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

export interface CompanionResearchResponse {
  assessment: {
    riskLevel: string;
    matchedRuleIds?: string[];
    interruptConversation: boolean;
    templateId?: string;
  };
  template: string | null;
  research: HealthResearch | null;
}
