import { KnowledgeBase, KnowledgeEntry, ResumeScore } from './types';

const KB_STORAGE_KEY = 'resume_advisor_knowledge_base';

export class KnowledgeBaseService {
  private kb: KnowledgeBase;

  constructor() {
    this.kb = this.load();
  }

  private load(): KnowledgeBase {
    try {
      const raw = localStorage.getItem(KB_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { entries: [], version: 1, lastUpdated: Date.now() };
  }

  private save() {
    try {
      localStorage.setItem(KB_STORAGE_KEY, JSON.stringify(this.kb));
    } catch (e) {
      console.warn('KB save failed:', e);
    }
  }

  addEntry(entry: Omit<KnowledgeEntry, 'id' | 'timestamp'>) {
    const newEntry: KnowledgeEntry = {
      ...entry,
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    this.kb.entries.push(newEntry);
    if (this.kb.entries.length > 100) {
      this.kb.entries = this.kb.entries.slice(-100);
    }
    this.kb.lastUpdated = Date.now();
    this.save();
    return newEntry.id;
  }

  rateEntry(id: string, helpful: boolean, userRating?: number) {
    const entry = this.kb.entries.find(e => e.id === id);
    if (entry) {
      entry.helpful = helpful;
      if (userRating !== undefined) entry.userRating = userRating;
      this.save();
    }
  }

  getRelevantContext(position: string, maxEntries = 5): string {
    const relevant = this.kb.entries
      .filter(e => e.position === position && e.helpful !== false)
      .sort((a, b) => {
        const ratingScore = ((b.userRating ?? 3) - (a.userRating ?? 3)) * 2;
        const helpfulScore = (b.helpful ? 1 : 0) - (a.helpful ? 1 : 0);
        const recencyScore = (b.timestamp - a.timestamp) / 1e10;
        return ratingScore + helpfulScore + recencyScore;
      })
      .slice(0, maxEntries);

    if (relevant.length === 0) return '';

    return `\n\n## KNOWLEDGE BASE CONTEXT (learned from previous evaluations):\n` +
      relevant.map((e, i) =>
        `Entry ${i + 1} [rating: ${e.userRating ?? 'unrated'}]:\n` +
        `- Scoring rationale: ${e.scoringRationale}\n` +
        `- Key feedback patterns: ${e.feedback.slice(0, 200)}`
      ).join('\n\n');
  }

  getStats() {
    const total = this.kb.entries.length;
    const rated = this.kb.entries.filter(e => e.userRating !== undefined).length;
    const avgRating = rated > 0
      ? this.kb.entries.filter(e => e.userRating !== undefined)
          .reduce((s, e) => s + (e.userRating ?? 0), 0) / rated
      : 0;
    const helpful = this.kb.entries.filter(e => e.helpful === true).length;
    return { total, rated, avgRating, helpful };
  }

  exportKB(): string {
    return JSON.stringify(this.kb, null, 2);
  }

  importKB(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.entries && Array.isArray(parsed.entries)) {
        this.kb = parsed;
        this.save();
        return true;
      }
    } catch {}
    return false;
  }

  clear() {
    this.kb = { entries: [], version: 1, lastUpdated: Date.now() };
    this.save();
  }

  getAll(): KnowledgeEntry[] {
    return [...this.kb.entries].reverse();
  }
}

export const kbService = new KnowledgeBaseService();
