import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Don't crash the whole app at import time if Supabase isn't configured —
// DB-backed features (keyword bank, history) degrade gracefully instead.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
  console.warn(
    '[supabaseClient] REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY not set — ' +
    'database features disabled. Add them to .env and restart `npm start`.'
  );
}

export async function loadKeywords(position: string): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('keywords')
    .select('word')
    .contains('position_relevance', [position])
    .order('weight', { ascending: false });
  if (error || !data) return [];
  return data.map((r: any) => r.word);
}

export async function loadScoringCriteria(position: string): Promise<any[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('scoring_criteria')
    .select('*')
    .eq('position', position);
  if (error || !data) return [];
  return data;
}

export async function loadAdviceBank(position: string): Promise<any[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('advice_bank')
    .select('*')
    .or(`position.eq.${position},position.is.null`)
    .order('priority', { ascending: false });
  if (error || !data) return [];
  return data;
}

export async function saveResume(payload: {
  position: string;
  resume_text: string;
  overall_score: number;
  ats_score: number;
  industry_fit: number;
  readability_score: number;
  section_scores: any;
  ai_feedback: any;
  target_level: string;
}): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('resumes')
    .insert(payload)
    .select('id')
    .single();
  if (error || !data) { console.error('Save error:', error); return null; }
  return data.id;
}

export async function rateResume(id: string, rating: number, helpful: boolean) {
  if (!supabase) return;
  await supabase
    .from('resumes')
    .update({ user_rating: rating, helpful })
    .eq('id', id);
}

export async function loadTopRatedResumes(position: string, limit = 5): Promise<any[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('resumes')
    .select('section_scores, ai_feedback, user_rating')
    .eq('position', position)
    .gte('user_rating', 4)
    .order('user_rating', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data;
}

export async function getResumeStats(): Promise<any> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('resumes')
    .select('position, overall_score, user_rating, created_at');
  if (error || !data) return null;
  return data;
}
