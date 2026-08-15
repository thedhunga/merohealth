export type ResearchLanguage = 'ne' | 'en';

export interface ResearchCitation {
  title: string;
  url: string;
  snippet?: string;
  date?: string;
}

export interface HealthResearch {
  provider: 'perplexity-sonar';
  status: 'complete' | 'setup-required' | 'unavailable';
  answer: string | null;
  citations: ResearchCitation[];
  relatedQuestions: string[];
  disclaimer: string;
  externalHealthHubUrl: string;
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
