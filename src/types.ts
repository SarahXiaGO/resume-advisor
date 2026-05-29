export interface ResumeSection {
  name: string;
  content: string;
  score: number;
  maxScore: number;
  feedback: string[];
  improvements: string[];
  strengths: string[];
  annotations?: Annotation[];
}

export interface Annotation {
  id: string;
  sectionName: string;
  highlightText: string;
  comment: string;
  type: 'strength' | 'warning' | 'critical' | 'suggestion';
  color: string;
}

export interface ResumeScore {
  overall: number;
  sections: ResumeSection[];
  summary: string;
  keyStrengths: string[];
  criticalImprovements: string[];
  atsCompatibility: number;
  industryFit: number;
  readabilityScore: number;
  hfKeywordsFound: string[];
  hfKeywordsMissing: string[];
  annotations: Annotation[];
  scoringRationale?: string;
}

export interface KnowledgeEntry {
  id: string;
  timestamp: number;
  position: string;
  resumeSnippet: string;
  scoringRationale: string;
  sectionScores: Record<string, number>;
  feedback: string;
  userRating?: number;
  helpful?: boolean;
}

export interface KnowledgeBase {
  entries: KnowledgeEntry[];
  version: number;
  lastUpdated: number;
}

export const HF_POSITIONS = [
  { value: 'analyst', label: 'Research Analyst', icon: '🔬', description: 'Fundamental & quantitative research' },
  { value: 'portfolio_manager', label: 'Portfolio Manager', icon: '📊', description: 'Portfolio construction & PM support' },
  { value: 'quant', label: 'Quant Analyst', icon: '⚡', description: 'Quantitative strategies & models' },
  { value: 'ir', label: 'Investor Relations', icon: '🤝', description: 'LP communication & fundraising' },
  { value: 'risk', label: 'Risk Analyst', icon: '🛡️', description: 'Risk management & monitoring' },
  { value: 'macro', label: 'Macro Analyst', icon: '🌐', description: 'Global macro & top-down research' },
];

export const ANNOTATION_COLORS: Record<string, string> = {
  strength: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  suggestion: '#6366f1',
};
