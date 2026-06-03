import { Microscope, BarChart3, Zap, Handshake, Shield, Globe, LucideIcon } from 'lucide-react';

// ── Analysis result shapes (mirror the Quantara design payload) ──────────────
export type AnnotationType = 'strength' | 'warning' | 'critical' | 'suggestion';

export interface Annotation {
  id: string;
  type: AnnotationType;
  sectionName: string;
  blockId: string;        // references a parsed block id; highlightText is a substring of that block
  highlightText: string;
  comment: string;
  suggestion: string;
  color?: string;         // filled client-side from ANNOTATION_COLORS
}

export interface SectionScore {
  id: string;
  name: string;
  score: number;
  strengths: string[];
  feedback: string[];
  improvements: string[];
}

export interface ResumeScore {
  overall: number;
  ats: number;
  hfFit: number;
  clarity: number;
  position: string;
  summary: string;
  keyStrengths: string[];
  criticalImprovements: string[];
  keywordsFound: string[];
  keywordsMissing: string[];
  sections: SectionScore[];
}

// ── Parsed (structured, editable) resume ─────────────────────────────────────
export interface Contact {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
}

export interface ParsedBullet { id: string; text: string; }

export interface ParsedItem {
  id: string;
  jobTitle?: string;   // experience / projects
  company?: string;
  school?: string;     // education
  degree?: string;
  location?: string;
  start?: string;
  end?: string;
  bullets?: ParsedBullet[];   // experience / projects
  details?: ParsedBullet[];   // education
}

export type ParsedSectionType = 'summary' | 'experience' | 'education' | 'skills' | 'projects';

export interface ParsedSection {
  id: string;
  heading: string;
  type: ParsedSectionType;
  body?: { id: string; text: string };
  items?: ParsedItem[];
}

export interface ParsedResume {
  contact: Contact;
  sections: ParsedSection[];
}

export interface AnalysisResult {
  score: ResumeScore;
  resume: ParsedResume;
  annotations: Annotation[];
}

// ── Constants ────────────────────────────────────────────────────────────────
export const ANNOTATION_COLORS: Record<AnnotationType, string> = {
  strength: '#0B7A52',
  suggestion: '#0070C0',
  warning: '#B7791F',
  critical: '#C02626',
};

export const SCORE_META: Record<'overall' | 'ats' | 'hfFit' | 'clarity', { label: string; help: string }> = {
  overall: { label: 'Overall', help: 'Weighted composite of every dimension below, calibrated to a quant-research bar.' },
  ats: { label: 'ATS', help: 'Applicant Tracking System compatibility — how cleanly automated parsers read structure, dates and contact info.' },
  hfFit: { label: 'HF Fit', help: 'Hedge-fund fit — alignment of skills, experience and signaling with what quant/HF desks screen for.' },
  clarity: { label: 'Clarity', help: 'Readability & writing quality — concision, active voice, and quantified, scannable bullets.' },
};

// ── Legacy localStorage knowledge base (superseded by supabaseClient; kept for compat) ──
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

export const HF_POSITIONS: { value: string; label: string; icon: LucideIcon; description: string }[] = [
  { value: 'analyst', label: 'Research Analyst', icon: Microscope, description: 'Fundamental & quantitative research' },
  { value: 'portfolio_manager', label: 'Portfolio Manager', icon: BarChart3, description: 'Portfolio construction & PM support' },
  { value: 'quant', label: 'Quant Analyst', icon: Zap, description: 'Quantitative strategies & models' },
  { value: 'ir', label: 'Investor Relations', icon: Handshake, description: 'LP communication & fundraising' },
  { value: 'risk', label: 'Risk Analyst', icon: Shield, description: 'Risk management & monitoring' },
  { value: 'macro', label: 'Macro Analyst', icon: Globe, description: 'Global macro & top-down research' },
];
