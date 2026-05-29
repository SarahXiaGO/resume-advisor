# ResumeIQ — Hedge Fund Resume Advisor

AI-powered resume scoring with visual inline annotations, built for undergrads and new grads targeting hedge funds.

## Stack
- **Frontend**: React + TypeScript
- **AI**: Anthropic Claude Sonnet 4 (streaming)
- **Database**: Supabase (PostgreSQL) — knowledge base, scoring criteria, RLHF ratings
- **Deploy**: GitHub Pages / Vercel

## Features
- 🎨 **Visual Annotator** — inline colored highlights with expert comments
- 📊 **Section Scoring** — A–F grades for 6 resume sections
- 🔑 **HF Keyword Analysis** — 49 hedge fund signal words checked
- 🧠 **RLHF Learning** — user ratings saved to Supabase, fed back into future prompts
- 🏦 **HF-Specific** — rubrics for Analyst, PM, Quant, IR, Risk, Macro roles

## Setup

### 1. Clone & install
```bash
git clone <your-repo>
cd resume-advisor
npm install
```

### 2. Environment variables
Create `.env.local`:
```
REACT_APP_ANTHROPIC_API_KEY=sk-ant-...
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run locally
```bash
npm start
```

## Database (Supabase)
Four tables pre-seeded with HF knowledge:
- `keywords` — 49 hedge fund signal words with position relevance
- `scoring_criteria` — per-role rubrics (must_have, good_to_have, red_flags)
- `advice_bank` — curated HF-specific resume tips by section
- `resumes` — stores analyses + user ratings for RLHF loop

## Push to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/resume-advisor.git
git push -u origin master
```
