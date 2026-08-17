export type ResearchLanguage = 'ne' | 'en';

export interface ResearchCitation {
  title: string;
  url: string;
  snippet?: string;
  date?: string;
}

export interface HealthResearch {
  provider: 'perplexity-sonar' | 'gemini-grounded';
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
   * Present only when `status` is `unavailable`: a short, sanitised reason
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
