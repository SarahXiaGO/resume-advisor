import { ResumeScore, Annotation, ANNOTATION_COLORS } from './types';
import { loadKeywords, loadScoringCriteria, loadAdviceBank, loadTopRatedResumes } from './supabaseClient';

const SERVER = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';

export async function parseResumeFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('resume', file);
  const res = await fetch(`${SERVER}/api/parse`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to parse file');
  return data.text;
}

async function buildSystemPrompt(position: string): Promise<string> {
  const [keywords, criteria, advice, topRated] = await Promise.all([
    loadKeywords(position),
    loadScoringCriteria(position),
    loadAdviceBank(position),
    loadTopRatedResumes(position),
  ]);

  const keywordList = keywords.slice(0, 30).join(', ');
  const criteriaText = criteria.map((c: any) =>
    `Section: ${c.section}\nCriteria: ${JSON.stringify(c.criteria, null, 2)}`
  ).join('\n\n');
  const adviceText = advice.slice(0, 8).map((a: any) => `[${a.section}] ${a.advice_text}`).join('\n');
  const rlhfContext = topRated.length > 0
    ? `\n\nLEARNED FROM TOP-RATED ANALYSES:\n` + topRated.map((r: any) =>
        `Rating ${r.user_rating}/5 — scores: ${JSON.stringify(r.section_scores)}`
      ).join('\n')
    : '';

  return `You are an elite quant finance career advisor specializing in helping undergraduates and new graduates break into hedge funds, quant trading firms, and asset managers (Citadel, Two Sigma, Bridgewater, Point72, D.E. Shaw, Millennium, AQR).

## HF/QUANT KEYWORDS TO DETECT
${keywordList}

## SCORING RUBRIC FOR ${position.toUpperCase()}
${criteriaText || 'Use standard HF analyst criteria: investment thinking, quantitative rigor, finance tools, measurable outcomes.'}

## EXPERT ADVICE CONTEXT
${adviceText}
${rlhfContext}

Return ONLY valid JSON — no markdown, no text outside JSON.

{
  "overall": <0-100>,
  "atsCompatibility": <0-100>,
  "industryFit": <0-100>,
  "readabilityScore": <0-100>,
  "summary": "<3 sentence expert assessment>",
  "keyStrengths": ["<strength>", "<strength>", "<strength>"],
  "criticalImprovements": ["<improvement>", "<improvement>", "<improvement>"],
  "hfKeywordsFound": ["<keyword>"],
  "hfKeywordsMissing": ["<keyword>"],
  "scoringRationale": "<brief rationale>",
  "annotations": [
    {
      "id": "ann_1",
      "sectionName": "<section>",
      "highlightText": "<exact text from resume, max 80 chars>",
      "comment": "<expert comment>",
      "type": "<strength|warning|critical|suggestion>"
    }
  ],
  "sections": [
    { "name": "Contact & Header", "score": <0-100>, "maxScore": 100, "feedback": ["<obs>"], "improvements": ["<fix>"], "strengths": ["<good>"] },
    { "name": "Professional Summary", "score": <0-100>, "maxScore": 100, "feedback": ["<obs>"], "improvements": ["<fix>"], "strengths": ["<good>"] },
    { "name": "Work Experience", "score": <0-100>, "maxScore": 100, "feedback": ["<obs>"], "improvements": ["<fix>"], "strengths": ["<good>"] },
    { "name": "Skills & Technologies", "score": <0-100>, "maxScore": 100, "feedback": ["<obs>"], "improvements": ["<fix>"], "strengths": ["<good>"] },
    { "name": "Education", "score": <0-100>, "maxScore": 100, "feedback": ["<obs>"], "improvements": ["<fix>"], "strengths": ["<good>"] },
    { "name": "Achievements & Impact", "score": <0-100>, "maxScore": 100, "feedback": ["<obs>"], "improvements": ["<fix>"], "strengths": ["<good>"] }
  ]
}

Be brutally honest. Quant finance standards are extremely high. A score of 80+ should be rare for new grads.`;
}

export async function analyzeResume(
  resumeText: string,
  position: string,
  onStream?: (partial: string) => void
): Promise<ResumeScore> {
  const system = await buildSystemPrompt(position);

  const response = await fetch(`${SERVER}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      messages: [{ role: 'user', content: `Analyze this resume for a ${position} position:\n\n${resumeText}` }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Analysis failed');
  }

  let jsonText = '';
  if (onStream && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'content_block_delta' && data.delta?.text) {
            jsonText += data.delta.text;
            onStream(jsonText);
          }
        } catch {}
      }
    }
  } else {
    const data = await response.json();
    jsonText = data.content?.[0]?.text || '';
  }

  const clean = jsonText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  if (parsed.annotations) {
    parsed.annotations = parsed.annotations.map((ann: Annotation) => ({
      ...ann,
      color: ANNOTATION_COLORS[ann.type] || ANNOTATION_COLORS.suggestion,
    }));
  }
  return parsed as ResumeScore;
}
