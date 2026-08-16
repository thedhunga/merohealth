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
