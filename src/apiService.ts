import { AnalysisResult, Annotation, ANNOTATION_COLORS } from './types';
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

## YOUR TASK
Do these in one pass and return them as a single JSON object:
1. SCORE the resume across overall dimensions ("score") AND per section ("sectionScores" — REQUIRED top-level array, one entry per standard section).
2. PARSE the resume into structured, editable blocks ("resume": contact + sections).
3. ANNOTATE specific spans with feedback ("annotations").

Return ONLY valid JSON — no markdown fences, no prose outside the JSON.

CRITICAL RULES FOR ANNOTATIONS:
- Every annotation.blockId MUST equal the id of a real block you emit in "resume" (a body block's id, or a bullet/detail id).
- Every annotation.highlightText MUST be an EXACT substring (verbatim, case-sensitive) of that block's text, max ~80 chars. Do not paraphrase.
- Produce 4–8 annotations covering the most important strengths and problems.

RULES FOR PARSING:
- Use stable, descriptive ids: "summary-body", "skills-flat", "exp1", "exp1-b1", "edu1", "edu1-d1", "proj1", "proj1-b1", etc.
- Section "type" is one of: summary, experience, education, skills, projects.
- summary & skills sections use a single "body" object: { "id", "text" }.
- experience & projects sections use "items" with "jobTitle", "company", "location", "start", "end", and "bullets":[{ "id", "text" }].
- education sections use "items" with "school", "degree", "location", "start", "end", and "details":[{ "id", "text" }].
- Preserve the candidate's wording verbatim in block text (so highlights match). Do not invent content.

JSON SHAPE:
{
  "score": {
    "overall": <0-100>, "ats": <0-100>, "hfFit": <0-100>, "clarity": <0-100>,
    "position": "${position}",
    "summary": "<3-sentence expert assessment>",
    "keyStrengths": ["<strength>", "<strength>", "<strength>"],
    "criticalImprovements": ["<improvement>", "<improvement>", "<improvement>"],
    "keywordsFound": ["<keyword>"],
    "keywordsMissing": ["<keyword>"]
  },
  "sectionScores": [
    { "id": "sec-summary", "name": "Professional Summary", "score": <0-100>, "strengths": ["<good>"], "feedback": ["<obs>"], "improvements": ["<fix>"] },
    { "id": "sec-exp", "name": "Experience", "score": <0-100>, "strengths": [], "feedback": [], "improvements": [] },
    { "id": "sec-edu", "name": "Education", "score": <0-100>, "strengths": [], "feedback": [], "improvements": [] },
    { "id": "sec-skills", "name": "Skills", "score": <0-100>, "strengths": [], "feedback": [], "improvements": [] },
    { "id": "sec-proj", "name": "Projects", "score": <0-100>, "strengths": [], "feedback": [], "improvements": [] }
  ],
  "resume": {
    "contact": { "name": "", "title": "", "email": "", "phone": "", "location": "", "links": ["", ""] },
    "sections": [
      { "id": "sec-summary", "heading": "Professional Summary", "type": "summary", "body": { "id": "summary-body", "text": "" } },
      { "id": "sec-exp", "heading": "Experience", "type": "experience", "items": [
        { "id": "exp1", "jobTitle": "", "company": "", "location": "", "start": "", "end": "", "bullets": [ { "id": "exp1-b1", "text": "" } ] }
      ] },
      { "id": "sec-edu", "heading": "Education", "type": "education", "items": [
        { "id": "edu1", "school": "", "degree": "", "location": "", "start": "", "end": "", "details": [ { "id": "edu1-d1", "text": "" } ] }
      ] },
      { "id": "sec-skills", "heading": "Skills", "type": "skills", "body": { "id": "skills-flat", "text": "" } },
      { "id": "sec-proj", "heading": "Projects", "type": "projects", "items": [
        { "id": "proj1", "jobTitle": "", "company": "", "location": "", "start": "", "end": "", "bullets": [ { "id": "proj1-b1", "text": "" } ] }
      ] }
    ]
  },
  "annotations": [
    { "id": "a1", "type": "<strength|warning|critical|suggestion>", "sectionName": "<section>", "blockId": "<an emitted block id>", "highlightText": "<exact substring of that block>", "comment": "<expert comment>", "suggestion": "<concrete suggested rewrite>" }
  ]
}

IMPORTANT — two different top-level arrays, do not confuse them:
- "sectionScores" = the per-section 0-100 grades. ALWAYS emit exactly one entry per standard section (Professional Summary, Experience, Education, Skills, Projects) — NEVER omit this array. If a section is absent from the resume, still score it low with a "missing" note in feedback.
- "resume.sections" = the parsed resume content (editable blocks). Only include sections the resume actually contains.
Be brutally honest. Quant finance standards are extremely high. A score of 80+ should be rare for new grads.`;
}

export async function analyzeResume(
  resumeText: string,
  position: string,
  onStream?: (partial: string) => void
): Promise<AnalysisResult> {
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
  let parsed: any;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('The analysis response was incomplete or malformed (possibly cut off). Please try again.');
  }
  const result = normalizeResult(parsed);

  // Attach annotation colors and drop any annotation that doesn't anchor to a real block span.
  const blockText = collectBlockText(result.resume);
  result.annotations = result.annotations
    .map((ann: Annotation) => ({ ...ann, color: ANNOTATION_COLORS[ann.type] || ANNOTATION_COLORS.suggestion }))
    .filter((ann) => {
      const text = blockText.get(ann.blockId);
      return !!text && !!ann.highlightText && text.includes(ann.highlightText);
    });

  return result;
}

// ── Defensive normalization ──────────────────────────────────────────────────
// The model doesn't always honor the schema exactly (missing arrays, fields, or
// the whole "score"/"resume" object). Coerce into a valid AnalysisResult so the
// UI never hits an undefined .map / .reduce.
const arr = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const num = (v: any): number => (typeof v === 'number' && isFinite(v) ? v : 0);
const str = (v: any): string => (typeof v === 'string' ? v : '');

function normalizeResult(parsed: any): AnalysisResult {
  const p = parsed || {};
  // Some responses inline the score fields at the top level instead of under "score".
  const s = p.score || (p.overall !== undefined ? p : {});
  const r = p.resume || {};
  const c = r.contact || {};

  return {
    score: {
      overall: num(s.overall),
      ats: num(s.ats),
      hfFit: num(s.hfFit),
      clarity: num(s.clarity),
      position: str(s.position),
      summary: str(s.summary),
      keyStrengths: arr<string>(s.keyStrengths),
      criticalImprovements: arr<string>(s.criticalImprovements),
      keywordsFound: arr<string>(s.keywordsFound),
      keywordsMissing: arr<string>(s.keywordsMissing),
      sections: arr<any>(p.sectionScores ?? s.sectionScores ?? s.sections).map((sec: any, i: number) => ({
        id: str(sec?.id) || `sec-${i}`,
        name: str(sec?.name) || `Section ${i + 1}`,
        score: num(sec?.score),
        strengths: arr<string>(sec?.strengths),
        feedback: arr<string>(sec?.feedback),
        improvements: arr<string>(sec?.improvements),
      })),
    },
    resume: {
      contact: {
        name: str(c.name), title: str(c.title), email: str(c.email),
        phone: str(c.phone), location: str(c.location), links: arr<string>(c.links),
      },
      sections: arr<any>(r.sections).map((sec, i) => ({
        id: str(sec?.id) || `psec-${i}`,
        heading: str(sec?.heading) || `Section ${i + 1}`,
        type: sec?.type || 'summary',
        ...(sec?.body ? { body: { id: str(sec.body.id) || `body-${i}`, text: str(sec.body.text) } } : {}),
        ...(sec?.items ? {
          items: arr<any>(sec.items).map((it, j) => ({
            id: str(it?.id) || `item-${i}-${j}`,
            jobTitle: str(it?.jobTitle), company: str(it?.company),
            school: str(it?.school), degree: str(it?.degree),
            location: str(it?.location), start: str(it?.start), end: str(it?.end),
            bullets: arr<any>(it?.bullets).map((b, k) => ({ id: str(b?.id) || `item-${i}-${j}-b${k}`, text: str(b?.text) })),
            details: arr<any>(it?.details).map((d, k) => ({ id: str(d?.id) || `item-${i}-${j}-d${k}`, text: str(d?.text) })),
          })),
        } : {}),
      })),
    },
    annotations: arr<any>(p.annotations).map((a, i) => ({
      id: str(a?.id) || `a${i}`,
      type: a?.type || 'suggestion',
      sectionName: str(a?.sectionName),
      blockId: str(a?.blockId),
      highlightText: str(a?.highlightText),
      comment: str(a?.comment),
      suggestion: str(a?.suggestion),
    })),
  };
}

// Build a map of blockId -> text so we can validate annotation anchoring.
function collectBlockText(resume: AnalysisResult['resume']): Map<string, string> {
  const map = new Map<string, string>();
  if (!resume?.sections) return map;
  for (const sec of resume.sections) {
    if (sec.body) map.set(sec.body.id, sec.body.text);
    for (const it of sec.items || []) {
      for (const b of it.bullets || []) map.set(b.id, b.text);
      for (const d of it.details || []) map.set(d.id, d.text);
    }
  }
  return map;
}
