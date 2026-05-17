# ResumeIQ — AI-Powered Resume Advisor

A sophisticated resume scoring and improvement tool powered by Claude AI, featuring a reinforcement learning knowledge base that gets smarter with every evaluation.

## Features

- **AI Resume Scoring** — Overall score + section-by-section breakdown (ATS, industry fit, readability)
- **Section Analysis** — Contact, Summary, Experience, Skills, Education, Achievements — each scored and graded
- **Detailed Feedback** — Strengths, observations, and concrete improvement suggestions per section  
- **Knowledge Base** — Reinforcement learning: user ratings feed back into future analyses
- **12 Job Positions** — Tailored evaluation for SWE, PM, Data Scientist, Designer, and more
- **Export/Import KB** — Portable knowledge base as JSON

## Quick Start

### 1. Install

```bash
npm install
```

### 2. API Key

Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com). Enter it in the app UI (stored in localStorage only) or set in `.env.local`:

```
REACT_APP_ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## How the Knowledge Base Works

Every analysis is stored locally with position, scores, and AI rationale. When you **rate** an analysis (1-5 stars), top-rated entries are injected as context into future prompts for the same role — the AI reads and calibrates based on what worked before. This is lightweight RLHF without model retraining.

## Architecture

```
src/
  types.ts          — TypeScript interfaces and job position data
  knowledgeBase.ts  — KB service: storage, retrieval, rating, export
  apiService.ts     — Anthropic API calls with streaming + KB context injection
  App.tsx           — Main UI: Input, Analyzing, Results, KB views
  App.css           — Dark theme styles
```

## Push to GitHub

```bash
git init
git add .
git commit -m "feat: initial ResumeIQ app"
git remote add origin https://github.com/YOUR_USERNAME/resume-advisor.git
git push -u origin main
```
