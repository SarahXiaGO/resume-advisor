# QuantEdge

**Quant Finance Resume Intelligence Platform**

QuantEdge is a resume scoring and advisory tool designed for undergraduate students and new graduates targeting roles in quantitative finance. The platform provides structured scoring, section-level feedback, and inline annotations calibrated to the standards of hedge funds and quant trading firms.

---

## Table of Contents

- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [AI System](#ai-system)
- [Design System](#design-system)
- [Local Development](#local-development)
- [API Reference](#api-reference)
- [Security](#security)
- [Roadmap](#roadmap)

---

## Architecture

The application follows a three-tier architecture. The React frontend communicates exclusively with the Express backend, which holds all credentials and proxies requests to external services.

```
Client (Browser)
    |
    |  HTTP :3000
    |
React Frontend
    |
    |  HTTP :3001
    |
Express Backend ——— Anthropic Claude API
    |
Supabase (PostgreSQL)
```

**Frontend** (port 3000)
Handles file upload, role selection, result rendering, and user ratings. Contains no API credentials.

**Backend** (port 3001)
Parses uploaded files (PDF, DOCX, TXT), holds the Anthropic API key, proxies analysis requests with streaming, and persists results to Supabase.

**Supabase**
Stores the knowledge base (keywords, scoring criteria, expert advice) and all analysis results. Top-rated results are fed back into future prompts to improve scoring over time.

---

## Project Structure

```
resume-advisor/
├── public/
│   └── index.html
├── server/
│   └── index.js          # Express server — file parsing and API proxy
├── src/
│   ├── App.tsx           # Root component — manages all views and state
│   ├── App.css           # Global styles and design tokens
│   ├── apiService.ts     # Prompt construction, backend calls, response parsing
│   ├── supabaseClient.ts # Database queries — knowledge base reads and result writes
│   ├── types.ts          # TypeScript interfaces and role definitions
│   └── index.tsx         # Application entry point
├── .env.local            # Environment variables (not committed)
├── .gitignore
├── package.json
└── README.md
```

---

## Database Schema

All tables are hosted on Supabase (PostgreSQL) with Row Level Security enabled.

### keywords

Hedge fund and quant finance signal terms. Scanned against every uploaded resume.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| word | text | Signal term, e.g. "Sharpe ratio", "backtesting" |
| category | text | investment, technical, metric, tool, quant |
| position_relevance | text[] | Roles this term applies to |
| weight | integer | Relevance weight, 1–5 |
| created_at | timestamptz | |

### scoring_criteria

Role-specific scoring rubrics. Injected into the AI prompt before each analysis.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| position | text | analyst, quant, portfolio_manager, ir, risk, macro |
| section | text | Resume section this rubric applies to |
| criteria | jsonb | Object containing must_have, good_to_have, red_flags arrays |
| weight | integer | Section importance weight |

### advice_bank

Curated expert guidance by role and section. Injected into the AI prompt by priority order.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| section | text | Resume section, e.g. "Work Experience" |
| position | text | Target role (null applies to all roles) |
| advice_text | text | Expert guidance |
| example | text | Concrete before/after example |
| priority | integer | Injection priority, 1–5 |

### resumes

Stores every analysis result and user rating. The primary data source for the feedback loop.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| position | text | Target role |
| resume_text | text | Extracted plain text |
| overall_score | integer | Composite score, 0–100 |
| ats_score | integer | ATS compatibility score |
| industry_fit | integer | Quant finance alignment score |
| readability_score | integer | Clarity score |
| section_scores | jsonb | Per-section score map |
| ai_feedback | jsonb | Summary, strengths, and improvements |
| user_rating | integer | Student rating, 1–5 |
| helpful | boolean | True if user_rating >= 3 |
| target_level | text | new_grad, sophomore, junior, experienced |
| created_at | timestamptz | |

---

## AI System

### Prompt Construction

Each analysis request builds a system prompt dynamically from the knowledge base before calling Claude. The construction pipeline:

1. Load signal keywords for the selected role from `keywords`
2. Load scoring rubric for the selected role from `scoring_criteria`
3. Load top-priority advice entries for the selected role from `advice_bank`
4. Load the five highest-rated past analyses for the selected role from `resumes`
5. Assemble all of the above into the system prompt
6. Stream the response from Claude back to the client

### Feedback Loop

User ratings are stored against each analysis record in Supabase. On subsequent analyses for the same role, the highest-rated past results are included in the prompt as learned context. This allows the scoring behavior to improve incrementally without modifying the underlying model.

```
Analysis submitted
       |
Result saved to resumes table
       |
Student submits star rating
       |
Rating stored on record
       |
Next analysis for same role
       |
Top-rated records injected as context
       |
Scoring calibrated against prior high-quality examples
```

### Response Schema

The model returns a single JSON object. Annotations reference exact substrings from the resume text, enabling the frontend to highlight and attach comments inline.

```json
{
  "overall": 72,
  "atsCompatibility": 68,
  "industryFit": 75,
  "readabilityScore": 80,
  "summary": "string",
  "keyStrengths": ["string"],
  "criticalImprovements": ["string"],
  "hfKeywordsFound": ["string"],
  "hfKeywordsMissing": ["string"],
  "scoringRationale": "string",
  "annotations": [
    {
      "id": "string",
      "sectionName": "string",
      "highlightText": "string",
      "comment": "string",
      "type": "strength | warning | critical | suggestion"
    }
  ],
  "sections": [
    {
      "name": "string",
      "score": 0,
      "maxScore": 100,
      "feedback": ["string"],
      "improvements": ["string"],
      "strengths": ["string"]
    }
  ]
}
```

---

## Design System

The interface follows a dark terminal aesthetic consistent with the T Alpha product family.

### Colors

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0D0D0D` | Page background |
| `--bg2` | `#111111` | Card background |
| `--bg3` | `#161616` | Input and nested surfaces |
| `--bg4` | `#1C1C1C` | Hover states |
| `--border` | `#222222` | Default borders |
| `--green` | `#00FF85` | Primary accent, CTAs, scores above 80 |
| `--gold` | `#E8A020` | Secondary accent, ratings, scores 60–79 |
| `--red` | `#FF4444` | Critical issues, scores below 60 |
| `--blue` | `#4D9EFF` | Improvement suggestions |
| `--text` | `#F5F5F5` | Primary text |
| `--text2` | `#888888` | Secondary text |
| `--text3` | `#444444` | Muted text |

### Typography

| Role | Family |
|---|---|
| Brand, labels, scores, code | Space Mono |
| Body, UI, buttons | Space Grotesk |

### Annotation Types

| Type | Color | Meaning |
|---|---|---|
| strength | `#00FF85` | Well-executed element |
| warning | `#E8A020` | Present but improvable |
| critical | `#FF4444` | Significant weakness to address |
| suggestion | `#4D9EFF` | Recommended addition |

---

## Local Development

### Prerequisites

- Node.js 18 or later
- A Supabase project (free tier)
- An Anthropic API key

### Installation

```bash
git clone https://github.com/SarahXiaGO/resume-advisor.git
cd resume-advisor
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```
REACT_APP_ANTHROPIC_API_KEY=sk-ant-...
REACT_APP_SUPABASE_URL=https://<project-id>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon-key>
```

This file is excluded from version control.

### Running the Application

```bash
# Start both servers concurrently
npm run dev

# Start servers individually
node server/index.js    # Backend on port 3001
npm start               # Frontend on port 3000
```

---

## API Reference

### POST /api/parse

Accepts a file upload and returns the extracted plain text content.

| | |
|---|---|
| Content-Type | multipart/form-data |
| Field | `resume` (file) |
| Accepted formats | .pdf, .docx, .txt |
| Max file size | 10 MB |

Response:
```json
{ "text": "string" }
```

### POST /api/analyze

Proxies an analysis request to the Anthropic API. Returns a streaming response. The API key is held server-side and is never included in the response or accessible from the client.

| | |
|---|---|
| Content-Type | application/json |
| Body | `{ "system": "string", "messages": [] }` |
| Response | text/event-stream (Anthropic SSE format) |

### GET /api/health

```json
{ "ok": true }
```

---

## Security

**API key isolation.** The Anthropic API key is loaded from the server environment and used only in server-side requests. It is not included in any client-side bundle or API response.

**Supabase RLS.** Row Level Security is enabled on all tables. The anon key exposed to the frontend grants read access to the knowledge base tables and insert access to the resumes table only.

**File handling.** Uploaded files are parsed in memory using `pdf-parse` and `mammoth`. No file data is written to disk or persisted beyond the duration of the parse request.

**Secrets management.** All credentials are stored in `.env.local`, which is listed in `.gitignore` and never committed to version control.

---

## Roadmap

- User authentication via Supabase Auth
- Per-user resume history and version tracking
- Side-by-side resume comparison (before and after edits)
- Annotated resume export as PDF
- Admin interface for knowledge base management
- Production deployment: frontend to Vercel, backend to Railway
- Coverage expansion: Credit Analyst, Sales and Trading, Derivatives roles
