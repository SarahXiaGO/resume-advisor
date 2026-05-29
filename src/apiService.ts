import { ResumeScore, Annotation, ANNOTATION_COLORS } from './types';
import { loadKeywords, loadScoringCriteria, loadAdviceBank, loadTopRatedResumes } from './supabaseClient';

const API_URL = 'https://api.anthropic.com/v1/messages';

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
  const adviceText = advice.slice(0, 8).map((a: any) =>
    `[${a.section}] ${a.advice_text}`
  ).join('\n');
  const rlhfContext = topRated.length > 0
    ? `\n\nLEARNED FROM TOP-RATED ANALYSES:\n` + topRated.map((r: any) =>
        `Rating ${r.user_rating}/5 — scores: ${JSON.stringify(r.section_scores)}`
      ).join('\n')
    : '';

  return `You are an elite hedge fund career advisor and resume expert, specializing in helping undergraduates and new graduates break into hedge funds (analyst, quant, PM, IR, risk, macro roles).

You have deep knowledge of what top funds like Citadel, Two Sigma, Bridgewater, Point72, D.E. Shaw, Millennium look for.

## HEDGE FUND KEYWORDS TO DETECT
${keywordList}

## SCORING RUBRIC FOR ${position.toUpperCase()}
${criteriaText || 'Use standard HF analyst criteria: investment thinking, quantitative rigor, finance tools, measurable outcomes.'}

## EXPERT ADVICE CONTEXT
${adviceText}
${rlhfContext}

## YOUR TASK
Analyze the resume deeply. Return ONLY valid JSON — no markdown, no explanation outside JSON.

Return this exact structure:
{
  "overall": <0-100>,
  "atsCompatibility": <0-100>,
  "industryFit": <0-100>,
  "readabilityScore": <0-100>,
  "summary": "<3 sentence expert assessment from HF recruiter perspective>",
  "keyStrengths": ["<strength>", "<strength>", "<strength>"],
  "criticalImprovements": ["<improvement>", "<improvement>", "<improvement>"],
  "hfKeywordsFound": ["<keyword found in resume>"],
  "hfKeywordsMissing": ["<important keyword missing>"],
  "scoringRationale": "<brief scoring explanation>",
  "annotations": [
    {
      "id": "ann_1",
      "sectionName": "<section name>",
      "highlightText": "<exact short text from resume to highlight, max 80 chars>",
      "comment": "<specific expert comment on this text>",
      "type": "<strength|warning|critical|suggestion>"
    }
  ],
  "sections": [
    {
      "name": "Contact & Header",
      "score": <0-100>,
      "maxScore": 100,
      "feedback": ["<observation>"],
      "improvements": ["<actionable fix>"],
      "strengths": ["<what works>"]
    },
    {
      "name": "Professional Summary",
      "score": <0-100>,
      "maxScore": 100,
      "feedback": ["<observation>"],
      "improvements": ["<actionable fix>"],
      "strengths": ["<what works>"]
    },
    {
      "name": "Work Experience",
      "score": <0-100>,
      "maxScore": 100,
      "feedback": ["<observation>"],
      "improvements": ["<actionable fix>"],
      "strengths": ["<what works>"]
    },
    {
      "name": "Skills & Technologies",
      "score": <0-100>,
      "maxScore": 100,
      "feedback": ["<observation>"],
      "improvements": ["<actionable fix>"],
      "strengths": ["<what works>"]
    },
    {
      "name": "Education",
      "score": <0-100>,
      "maxScore": 100,
      "feedback": ["<observation>"],
      "improvements": ["<actionable fix>"],
      "strengths": ["<what works>"]
    },
    {
      "name": "Achievements & Impact",
      "score": <0-100>,
      "maxScore": 100,
      "feedback": ["<observation>"],
      "improvements": ["<actionable fix>"],
      "strengths": ["<what works>"]
    }
  ]
}

Be brutally honest. HF standards are extremely high. A good score (80+) should be rare for new grads.`;
}

export async function analyzeResume(
  resumeText: string,
  position: string,
  apiKey: string,
  onStream?: (partial: string) => void
): Promise<ResumeScore> {
  const systemPrompt = await buildSystemPrompt(position);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Analyze this resume for a ${position} position at a hedge fund:\n\n${resumeText}` }],
      stream: !!onStream,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  let jsonText = '';
  if (onStream && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
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
    jsonText = data.content[0].text;
  }

  const clean = jsonText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  // Enrich annotations with color
  if (parsed.annotations) {
    parsed.annotations = parsed.annotations.map((ann: Annotation) => ({
      ...ann,
      color: ANNOTATION_COLORS[ann.type] || ANNOTATION_COLORS.suggestion,
    }));
  }

  return parsed as ResumeScore;
}
