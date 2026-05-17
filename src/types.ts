export interface ResumeSection {
  name: string;
  content: string;
  score: number;
  maxScore: number;
  feedback: string[];
  improvements: string[];
  strengths: string[];
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

export const JOB_POSITIONS = [
  { value: 'software-engineer', label: 'Software Engineer', icon: '💻' },
  { value: 'product-manager', label: 'Product Manager', icon: '📋' },
  { value: 'data-scientist', label: 'Data Scientist', icon: '📊' },
  { value: 'ux-designer', label: 'UX Designer', icon: '🎨' },
  { value: 'marketing-manager', label: 'Marketing Manager', icon: '📣' },
  { value: 'financial-analyst', label: 'Financial Analyst', icon: '💹' },
  { value: 'project-manager', label: 'Project Manager', icon: '🗂️' },
  { value: 'devops-engineer', label: 'DevOps Engineer', icon: '⚙️' },
  { value: 'sales-executive', label: 'Sales Executive', icon: '🤝' },
  { value: 'hr-manager', label: 'HR Manager', icon: '👥' },
  { value: 'business-analyst', label: 'Business Analyst', icon: '📈' },
  { value: 'cybersecurity-analyst', label: 'Cybersecurity Analyst', icon: '🔐' },
];
