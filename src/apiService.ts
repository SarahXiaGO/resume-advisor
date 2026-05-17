import { ResumeScore, ResumeSection } from './types';
import { kbService } from './knowledgeBase';

const API_URL = 'https://api.anthropic.com/v1/messages';

function buildSystemPrompt(position: string): string {
  const kbContext = kbService.getRelevantContext(position);

  return `You are an expert resume advisor and career coach specializing in ${position} roles. You have deep knowledge of hiring practices, ATS systems, and what recruiters look for.

Your task is to analyze resumes and provide:
1. Numerical scores (0-100) for each section
2. Specific, actionable feedback
3. Concrete improvement suggestions

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.

${kbContext}

Return this exact JSON structure:
{
  "overall": <number 0-100>,
  "atsCompatibility": <number 0-100>,
  "industryFit": <number 0-100>,
  "readabilityScore": <number 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "keyStrengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "criticalImprovements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "scoringRationale": "<brief explanation of how you scored this resume>",
  "sections": [
    {
      "name": "Contact & Header",
      "score": <0-100>,
      "maxScore": 100,
      "feedback": ["<specific observation>"],
      "improvements": ["<actionable fix>"],
      "strengths": ["<what works well>"]
    },
    {
      "name": "Professional Summary",
      "score": <0-100>,
      "maxScore": 100,
      "feedback": ["<specific observation>"],
      "improvements": ["<actionable fix>"],
      "strengths": ["<what works well>"]
    },
    {
      "name": "Work Experience",
      "score": <0-100>,
      "maxScore": 100,
      "feedback": ["<specific observation>"],
      "improvements": ["<actionable fix>"],
      "strengths": ["<what works well>"]
    },
    {
      "name": "Skills & Technologies",
      "score": <0-100>,
      "maxScore": 100,
      "feedback": ["<specific observation>"],
      "improvements": ["<actionable fix>"],
      "strengths": ["<what works well>"]
    },
    {
      "name": "Education",
      "score": <0-100>,
      "maxScore": 100,
      "feedback": ["<specific observation>"],
      "improvements": ["<actionable fix>"],
      "strengths": ["<what works well>"]
    },
    {
      "name": "Achievements & Impact",
      "score": <0-100>,
      "maxScore": 100,
      "feedback": ["<specific observation>"],
      "improvements": ["<actionable fix>"],
      "strengths": ["<what works well>"]
    }
  ]
}`;
}

export async function analyzeResume(
  resumeText: string,
  position: string,
  apiKey: string,
  onStream?: (partial: string) => void
): Promise<ResumeScore> {
  const userMessage = `Please analyze this resume for a ${position} position:\n\n${resumeText}`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: buildSystemPrompt(position),
      messages: [{ role: 'user', content: userMessage }],
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
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
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

  // Parse JSON
  const clean = jsonText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  // Store in knowledge base
  kbService.addEntry({
    position,
    resumeSnippet: resumeText.slice(0, 300),
    scoringRationale: parsed.scoringRationale || '',
    sectionScores: Object.fromEntries(
      (parsed.sections || []).map((s: ResumeSection) => [s.name, s.score])
    ),
    feedback: parsed.criticalImprovements?.join('; ') || '',
  });

  return parsed as ResumeScore;
}
