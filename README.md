# QuantEdge — Quant Finance Resume Intelligence

> AI-powered resume scoring and advisory platform built for undergraduates and new graduates targeting quant finance roles at hedge funds, prop trading firms, and asset managers.

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Student Browser                       │
│  Upload PDF/DOCX → Select Role → View Scores + Annotations  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (localhost:3000)
┌────────────────────────▼────────────────────────────────────┐
│                   React Frontend (Port 3000)                 │
│  - PDF drag & drop upload                                    │
│  - Role selector (6 quant finance roles)                    │
│  - Visual inline annotator (color-coded highlights)         │
│  - Section score cards (A–F grades)                         │
│  - HF keyword tracker (found vs. missing)                   │
│  - Star rating → RLHF feedback loop                         │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (localhost:3001)
┌────────────────────────▼────────────────────────────────────┐
│                  Express Backend (Port 3001)                  │
│  - POST /api/parse   → PDF/DOCX/TXT → plain text            │
│  - POST /api/analyze → proxies to Anthropic API             │
│  - Holds API key server-side (never exposed to browser)     │
└──────────┬─────────────────────────────┬────────────────────┘
           │                             │
┌──────────▼──────────┐    ┌─────────────▼──────────────────┐
│   Anthropic Claude  │    │        Supabase (PostgreSQL)    │
│   Sonnet 4 API      │    │  - keywords (49 HF signals)     │
│   Streaming JSON    │    │  - scoring_criteria (rubrics)   │
└─────────────────────┘    │  - advice_bank (expert tips)    │
                           │  - resumes (analyses + ratings) │
                           └────────────────────────────────┘
```

---

## 📁 Project Structure

```
resume-advisor/
├── public/
│   └── index.html
├── server/
│   └── index.js          # Express backend — file parsing + API proxy
├── src/
│   ├── App.tsx           # Main UI — 4 views: upload / analyzing / results / stats
│   ├── App.css           # T Alpha-inspired design system
│   ├── apiService.ts     # Builds prompts from KB, calls backend, parses response
│   ├── supabaseClient.ts # All Supabase queries (read KB, save results, ratings)
│   ├── types.ts          # TypeScript interfaces + HF position definitions
│   └── index.tsx         # React entry point
├── .env.local            # 🔒 Secret keys — never committed to git
├── .gitignore
├── package.json
└── README.md
```

---

## 🗄 Database Schema (Supabase / PostgreSQL)

### `keywords`
Hedge fund signal words scanned in every resume.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| word | text | e.g. "Sharpe ratio", "DCF", "backtesting" |
| category | text | investment / technical / metric / tool / quant |
| position_relevance | text[] | e.g. `['analyst', 'quant']` |
| weight | integer | 1–5 importance score |
| created_at | timestamptz | Auto timestamp |

### `scoring_criteria`
Role-specific rubrics injected into every AI prompt.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| position | text | analyst / quant / portfolio_manager / ir / risk / macro |
| section | text | Resume section name |
| criteria | jsonb | `{ must_have[], good_to_have[], red_flags[], weight }` |
| weight | integer | Section importance weight |

### `advice_bank`
Curated expert tips by section and role, injected into AI prompt.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| section | text | e.g. "Work Experience", "Professional Summary" |
| position | text | Role this advice targets (null = all roles) |
| advice_text | text | Expert guidance paragraph |
| example | text | Before/after example |
| priority | integer | 1–5, higher = injected first into prompt |

### `resumes`
Every analysis result saved here. Powers the RLHF learning loop.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| position | text | Target role |
| resume_text | text | Extracted plain text from uploaded file |
| overall_score | integer | 0–100 |
| ats_score | integer | ATS compatibility score |
| industry_fit | integer | Quant finance fit score |
| readability_score | integer | Clarity/readability score |
| section_scores | jsonb | `{ "Work Experience": 72, ... }` |
| ai_feedback | jsonb | `{ summary, keyStrengths[], criticalImprovements[] }` |
| user_rating | integer | 1–5 stars submitted by student |
| helpful | boolean | true if user_rating ≥ 3 |
| target_level | text | new_grad / sophomore / junior / experienced |
| created_at | timestamptz | Auto timestamp |

---

## 🧠 AI & RLHF System

### How the prompt is built (per analysis)

Every time a student submits a resume, the system:

1. Loads `keywords` for the selected role from Supabase
2. Loads `scoring_criteria` rubric for that role
3. Loads top 8 `advice_bank` entries by priority for that role
4. Loads top 5 highest-rated past `resumes` for that role (`user_rating ≥ 4`)
5. Injects all of the above into the Claude system prompt as context
6. Streams Claude's structured JSON response back to the frontend

### RLHF feedback loop

```
Student rates analysis (1–5 stars)
         ↓
Saved to resumes.user_rating in Supabase
         ↓
Next student analyzes same role
         ↓
Top-rated past analyses injected into prompt as "learned context"
         ↓
Claude calibrates scoring based on what was rated highly
         ↓
Accuracy improves over time without retraining the model
```

### AI response structure (JSON)

```json
{
  "overall": 72,
  "atsCompatibility": 68,
  "industryFit": 75,
  "readabilityScore": 80,
  "summary": "3-sentence expert assessment...",
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "criticalImprovements": ["improvement 1", "improvement 2"],
  "hfKeywordsFound": ["DCF", "Bloomberg", "Sharpe ratio"],
  "hfKeywordsMissing": ["backtesting", "factor model", "alpha generation"],
  "scoringRationale": "Brief explanation of scoring approach",
  "annotations": [
    {
      "id": "ann_1",
      "sectionName": "Work Experience",
      "highlightText": "conducted research on tech sector",
      "comment": "Vague — no quantified outcome or investment thesis stated",
      "type": "critical"
    }
  ],
  "sections": [
    {
      "name": "Work Experience",
      "score": 65,
      "maxScore": 100,
      "feedback": ["observation 1"],
      "improvements": ["actionable fix 1"],
      "strengths": ["what works well"]
    }
  ]
}
```

---

## 🎨 Design System

Inspired by T Alpha — dark terminal aesthetic for a professional quant finance feel.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#0D0D0D` | Page background |
| `--bg2` | `#111111` | Card background |
| `--bg3` | `#161616` | Input / nested background |
| `--bg4` | `#1C1C1C` | Hover states |
| `--border` | `#222222` | Default borders |
| `--green` | `#00FF85` | Primary accent, CTAs, passing scores |
| `--gold` | `#E8A020` | Highlights, star ratings, warnings |
| `--red` | `#FF4444` | Critical issues, failing scores |
| `--blue` | `#4D9EFF` | Improvement suggestions |
| `--text` | `#F5F5F5` | Primary text |
| `--text2` | `#888888` | Secondary text |
| `--text3` | `#444444` | Muted / placeholder text |

### Typography

| Role | Font | Usage |
|------|------|-------|
| Brand / terminal | Space Mono | Logo, section labels, scores, code |
| Body / UI | Space Grotesk | All readable content, buttons |

### Annotation Color Coding

| Color | Type | Meaning |
|-------|------|---------|
| 🟢 `#00FF85` | `strength` | Something done well — keep it |
| 🟡 `#E8A020` | `warning` | Could be improved |
| 🔴 `#FF4444` | `critical` | Must fix before applying |
| 🔵 `#4D9EFF` | `suggestion` | Nice-to-have addition |

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase project (free tier at supabase.com)
- Anthropic API key (console.anthropic.com)

### Setup

```bash
git clone https://github.com/SarahXiaGO/resume-advisor.git
cd resume-advisor
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```env
REACT_APP_ANTHROPIC_API_KEY=sk-ant-api03-...
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
```

> ⚠️ Never commit `.env.local` — it's in `.gitignore`

### Run Locally

```bash
# Run both frontend + backend together
npm run dev

# Or separately in two terminals:
node server/index.js    # Backend → http://localhost:3001
npm start               # Frontend → http://localhost:3000
```

---

## 📡 API Endpoints

### `POST /api/parse`
Accepts a resume file upload, returns extracted plain text.

- **Content-Type:** `multipart/form-data`
- **Field:** `resume` (file)
- **Accepts:** `.pdf`, `.docx`, `.txt` (max 10MB)
- **Returns:** `{ text: string }`
- **Errors:** `{ error: string }`

### `POST /api/analyze`
Proxies the analysis request to Anthropic Claude with streaming. The API key never leaves the server.

- **Content-Type:** `application/json`
- **Body:** `{ system: string, messages: [{role, content}] }`
- **Returns:** `text/event-stream` (SSE — Anthropic streaming format)

### `GET /api/health`
Simple health check.

- **Returns:** `{ ok: true }`

---

## 🔒 Security

- **Anthropic API key** — stored in `.env.local`, loaded server-side only, never sent to or accessible from the browser
- **Supabase anon key** — safe to expose publicly; Row Level Security (RLS) is enabled on all tables
- **RLS policies** — public read on `keywords`, `advice_bank`, `scoring_criteria`; public insert + read + update on `resumes`
- **File uploads** — stored in memory only (never written to disk), processed and discarded immediately
- **`.gitignore`** — excludes `.env.local`, `node_modules/`, `build/`

---

## 🗺 Roadmap

- [ ] User authentication (Supabase Auth)
- [ ] Resume version history per user
- [ ] Side-by-side before/after resume comparison
- [ ] Export annotated resume as PDF
- [ ] Admin dashboard to manage knowledge base content
- [ ] Deploy frontend → Vercel
- [ ] Deploy backend → Railway or Render
- [ ] Add more roles: Credit Analyst, Sales & Trading, Derivatives
- [ ] Mock interview module (follow-on feature)
