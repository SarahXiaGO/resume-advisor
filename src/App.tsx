import React, { useState, useEffect, useCallback } from 'react';
import { analyzeResume } from './apiService';
import { saveResume, rateResume, getResumeStats } from './supabaseClient';
import { ResumeScore, Annotation, HF_POSITIONS, ANNOTATION_COLORS } from './types';
import './App.css';

// ── Circular score widget ──────────────────────────────────────────────────
const CircleScore: React.FC<{ score: number; size?: number; label?: string }> = ({ score, size = 120, label }) => {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="circle-score-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transform:'rotate(-90deg)', transformOrigin:'center', transition:'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}/>
      </svg>
      <div className="circle-score-inner">
        <span className="circle-score-num" style={{ color }}>{score}</span>
        {label && <span className="circle-score-label">{label}</span>}
      </div>
    </div>
  );
};

// ── Section card ───────────────────────────────────────────────────────────
const SectionCard: React.FC<{ section: any; index: number }> = ({ section, index }) => {
  const [expanded, setExpanded] = useState(false);
  const pct = section.score;
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
  const grade = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';
  return (
    <div className="section-card" style={{ animationDelay: `${index * 0.07}s` }}>
      <div className="section-header" onClick={() => setExpanded(!expanded)}>
        <div className="section-left">
          <div className="section-grade" style={{ background: color+'22', color, border:`1px solid ${color}44` }}>{grade}</div>
          <div style={{ flex: 1 }}>
            <div className="section-name">{section.name}</div>
            <div className="section-bar-wrap">
              <div className="section-bar-bg">
                <div className="section-bar-fill" style={{ width:`${pct}%`, background:color }}/>
              </div>
              <span className="section-score-text" style={{ color }}>{pct}/100</span>
            </div>
          </div>
        </div>
        <div className={`section-chevron ${expanded?'open':''}`}>▾</div>
      </div>
      {expanded && (
        <div className="section-body">
          {section.strengths?.length > 0 && (
            <div className="section-group">
              <div className="section-group-title strengths-title">✓ Strengths</div>
              {section.strengths.map((s: string, i: number) => (
                <div key={i} className="feedback-item strength-item"><span className="dot green-dot"/>{s}</div>
              ))}
            </div>
          )}
          {section.feedback?.length > 0 && (
            <div className="section-group">
              <div className="section-group-title feedback-title">⚡ Observations</div>
              {section.feedback.map((f: string, i: number) => (
                <div key={i} className="feedback-item"><span className="dot amber-dot"/>{f}</div>
              ))}
            </div>
          )}
          {section.improvements?.length > 0 && (
            <div className="section-group">
              <div className="section-group-title improvements-title">🎯 Improvements</div>
              {section.improvements.map((imp: string, i: number) => (
                <div key={i} className="feedback-item improvement-item"><span className="dot blue-dot"/>{imp}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Visual Annotator ───────────────────────────────────────────────────────
const VisualAnnotator: React.FC<{ resumeText: string; annotations: Annotation[] }> = ({ resumeText, annotations }) => {
  const [activeAnn, setActiveAnn] = useState<string | null>(null);

  const buildAnnotatedHTML = () => {
    let html = resumeText;
    // Sort by length desc to avoid nested replacements
    const sorted = [...annotations].sort((a, b) => b.highlightText.length - a.highlightText.length);
    const used = new Set<string>();
    for (const ann of sorted) {
      if (!ann.highlightText || used.has(ann.id)) continue;
      const escaped = ann.highlightText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      if (regex.test(html)) {
        html = html.replace(regex, (match) => {
          used.add(ann.id);
          return `<mark class="ann-mark ann-${ann.type}" data-id="${ann.id}" style="background:${ann.color}22;border-bottom:2px solid ${ann.color};cursor:pointer;" onclick="window.__setAnn('${ann.id}')">${match}</mark>`;
        });
      }
    }
    return html.replace(/\n/g, '<br/>');
  };

  useEffect(() => {
    (window as any).__setAnn = (id: string) => setActiveAnn(id === activeAnn ? null : id);
    return () => { delete (window as any).__setAnn; };
  }, [activeAnn]);

  const activeAnnotation = annotations.find(a => a.id === activeAnn);
  const typeIcon: Record<string, string> = { strength: '✅', warning: '⚠️', critical: '🚨', suggestion: '💡' };
  const typeLabel: Record<string, string> = { strength: 'Strength', warning: 'Warning', critical: 'Critical Issue', suggestion: 'Suggestion' };

  return (
    <div className="annotator-wrap">
      <div className="annotator-legend">
        {Object.entries(ANNOTATION_COLORS).map(([type, color]) => (
          <span key={type} className="legend-item">
            <span className="legend-dot" style={{ background: color }}/>
            {typeLabel[type]}
          </span>
        ))}
      </div>
      <div className="annotator-body">
        <div className="annotator-resume">
          <div className="resume-rendered" dangerouslySetInnerHTML={{ __html: buildAnnotatedHTML() }}/>
        </div>
        <div className="annotator-sidebar">
          {activeAnnotation ? (
            <div className="ann-callout" style={{ borderColor: activeAnnotation.color }}>
              <div className="ann-callout-type" style={{ color: activeAnnotation.color }}>
                {typeIcon[activeAnnotation.type]} {typeLabel[activeAnnotation.type]}
              </div>
              <div className="ann-callout-section">{activeAnnotation.sectionName}</div>
              <div className="ann-callout-text">"{activeAnnotation.highlightText}"</div>
              <div className="ann-callout-comment">{activeAnnotation.comment}</div>
              <button className="ann-close" onClick={() => setActiveAnn(null)}>✕ Close</button>
            </div>
          ) : (
            <div className="ann-hint">
              <div className="ann-hint-icon">👆</div>
              <p>Click any highlighted text to see the expert comment</p>
              <div className="ann-count-list">
                {Object.entries(ANNOTATION_COLORS).map(([type, color]) => {
                  const count = annotations.filter(a => a.type === type).length;
                  if (count === 0) return null;
                  return (
                    <div key={type} className="ann-count-item">
                      <span className="legend-dot" style={{ background: color }}/>
                      <span>{count} {typeLabel[type]}{count > 1 ? 's' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Keyword Tracker ────────────────────────────────────────────────────────
const KeywordTracker: React.FC<{ found: string[]; missing: string[] }> = ({ found, missing }) => (
  <div className="keyword-tracker">
    <div className="kw-col">
      <div className="kw-col-title found-title">✅ Keywords Found ({found.length})</div>
      <div className="kw-chips">
        {found.map((kw, i) => <span key={i} className="kw-chip found-chip">{kw}</span>)}
      </div>
    </div>
    <div className="kw-col">
      <div className="kw-col-title missing-title">❌ Keywords Missing ({missing.length})</div>
      <div className="kw-chips">
        {missing.map((kw, i) => <span key={i} className="kw-chip missing-chip">{kw}</span>)}
      </div>
    </div>
  </div>
);

// ── Main App ───────────────────────────────────────────────────────────────
type AppView = 'input' | 'analyzing' | 'results' | 'stats';
type ResultsTab = 'annotator' | 'scores' | 'keywords';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('input');
  const [resultsTab, setResultsTab] = useState<ResultsTab>('annotator');
  const [resumeText, setResumeText] = useState('');
  const [position, setPosition] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ra_api_key') || '');
  const [score, setScore] = useState<ResumeScore | null>(null);
  const [error, setError] = useState('');
  const [streamStatus, setStreamStatus] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => { if (apiKey) localStorage.setItem('ra_api_key', apiKey); }, [apiKey]);

  const handleAnalyze = useCallback(async () => {
    if (!resumeText.trim() || !position || !apiKey.trim()) {
      setError('Please fill in your resume, select a position, and provide an API key.');
      return;
    }
    setError('');
    setView('analyzing');
    setStreamStatus('Loading knowledge base from Supabase...');
    try {
      const result = await analyzeResume(resumeText, position, apiKey, (partial) => {
        const pct = Math.min(95, Math.round((partial.length / 2000) * 100));
        setStreamStatus(`Analyzing... ${pct}%`);
      });
      setScore(result);
      setRatingSubmitted(false);
      setUserRating(0);
      // Save to Supabase
      const id = await saveResume({
        position,
        resume_text: resumeText,
        overall_score: result.overall,
        ats_score: result.atsCompatibility,
        industry_fit: result.industryFit,
        readability_score: result.readabilityScore,
        section_scores: Object.fromEntries((result.sections || []).map(s => [s.name, s.score])),
        ai_feedback: { summary: result.summary, keyStrengths: result.keyStrengths, criticalImprovements: result.criticalImprovements },
        target_level: 'new_grad',
      });
      setSavedId(id);
      setResultsTab('annotator');
      setView('results');
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Check your API key and try again.');
      setView('input');
    }
  }, [resumeText, position, apiKey]);

  const handleRating = async (stars: number) => {
    if (ratingSubmitted) return;
    setUserRating(stars);
    setRatingSubmitted(true);
    if (savedId) await rateResume(savedId, stars, stars >= 3);
  };

  const handleViewStats = async () => {
    const data = await getResumeStats();
    setStats(data || []);
    setView('stats');
  };

  const posObj = HF_POSITIONS.find(p => p.value === position);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">R</div>
            <div>
              <div className="logo-title">ResumeIQ</div>
              <div className="logo-sub">Hedge Fund Career Advisor</div>
            </div>
          </div>
          <nav className="header-nav">
            <button className={`nav-btn ${view !== 'stats' ? 'active' : ''}`} onClick={() => setView('input')}>Analyze</button>
            <button className={`nav-btn ${view === 'stats' ? 'active' : ''}`} onClick={handleViewStats}>Stats</button>
          </nav>
        </div>
      </header>

      <main className="app-main">

        {/* ── INPUT VIEW ── */}
        {view === 'input' && (
          <div className="input-view fade-in">
            <div className="hero-section">
              <div className="hero-eyebrow">Hedge Fund Resume Intelligence</div>
              <h1 className="hero-title">Get Your Resume<br/><span className="gradient-text">HF-Ready</span></h1>
              <p className="hero-sub">Expert scoring + visual inline annotations powered by Claude AI and a curated hedge fund knowledge base</p>
            </div>

            <div className="input-grid">
              <div className="input-col-main">
                <div className="form-card">
                  <label className="form-label"><span className="label-icon">🔑</span> Anthropic API Key</label>
                  <input type="password" className="form-input" placeholder="sk-ant-..." value={apiKey} onChange={e => setApiKey(e.target.value)}/>
                  <p className="form-hint">Stored locally. Get yours at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a></p>
                </div>

                <div className="form-card">
                  <label className="form-label"><span className="label-icon">🎯</span> Target HF Role</label>
                  <div className="position-grid">
                    {HF_POSITIONS.map(p => (
                      <button key={p.value} className={`position-btn ${position === p.value ? 'selected' : ''}`} onClick={() => setPosition(p.value)}>
                        <span className="pos-icon">{p.icon}</span>
                        <div>
                          <div className="pos-label">{p.label}</div>
                          <div className="pos-desc">{p.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-card">
                  <label className="form-label">
                    <span className="label-icon">📄</span> Resume Text
                    <span className="char-count">{resumeText.length} chars</span>
                  </label>
                  <textarea className="resume-textarea" rows={20}
                    placeholder={"Paste your full resume here...\n\nTip: Include all sections — contact, summary, experience, education, skills, and any achievements like investment club, stock pitch competitions, or relevant projects."}
                    value={resumeText} onChange={e => setResumeText(e.target.value)}/>
                </div>

                {error && <div className="error-msg">⚠️ {error}</div>}
                <button className="analyze-btn" onClick={handleAnalyze} disabled={!resumeText || !position || !apiKey}>
                  <span>Analyze Resume</span><span className="btn-arrow">→</span>
                </button>
              </div>

              <div className="input-col-side">
                <div className="side-card hf-card">
                  <div className="side-card-title">🏦 HF Targeting</div>
                  <p className="side-card-text">Optimized for new grads and undergrads targeting:</p>
                  <div className="hf-fund-list">
                    {['Citadel', 'Two Sigma', 'Point72', 'Bridgewater', 'D.E. Shaw', 'Millennium'].map(f => (
                      <span key={f} className="fund-chip">{f}</span>
                    ))}
                  </div>
                </div>
                <div className="side-card">
                  <div className="side-card-title">✨ What You Get</div>
                  <div className="feature-list">
                    {[
                      { icon: '🎨', t: 'Visual Annotations', d: 'Inline comments on your resume text' },
                      { icon: '📊', t: 'Section Scoring', d: 'A–F grades with detailed feedback' },
                      { icon: '🔑', t: 'HF Keyword Analysis', d: '49 hedge fund signal words checked' },
                      { icon: '🧠', t: 'RLHF Learning', d: 'Improves from your ratings via Supabase' },
                    ].map(f => (
                      <div key={f.t} className="feature-item">
                        <span className="feature-icon">{f.icon}</span>
                        <div><div className="feature-title">{f.t}</div><div className="feature-desc">{f.d}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYZING VIEW ── */}
        {view === 'analyzing' && (
          <div className="analyzing-view fade-in">
            <div className="analyzing-center">
              <div className="analyzing-orb">
                <div className="orb-inner"><div className="orb-pulse"/><div className="orb-icon">🧠</div></div>
              </div>
              <h2 className="analyzing-title">Analyzing Your Resume</h2>
              <p className="analyzing-sub">Running against hedge fund knowledge base for <strong>{posObj?.label || position}</strong></p>
              <div className="analyzing-steps">
                {[
                  '📚 Loading HF keywords & scoring criteria...',
                  '🔍 Parsing resume sections...',
                  '💼 Applying hedge fund rubric...',
                  '🎨 Generating inline annotations...',
                  '📊 Calculating scores & feedback...',
                  '💾 Saving to Supabase...',
                ].map((step, i) => (
                  <div key={i} className="analyzing-step" style={{ animationDelay:`${i*0.6}s` }}>
                    <span className="step-dot"/>{step}
                  </div>
                ))}
              </div>
              {streamStatus && <div className="stream-preview"><code>{streamStatus}</code></div>}
            </div>
          </div>
        )}

        {/* ── RESULTS VIEW ── */}
        {view === 'results' && score && (
          <div className="results-view fade-in">
            <div className="results-header">
              <button className="back-btn" onClick={() => setView('input')}>← New Analysis</button>
              <h2 className="results-title">Resume Analysis</h2>
              {posObj && <div className="results-position">{posObj.icon} {posObj.label}</div>}
            </div>

            {/* Score overview */}
            <div className="score-overview">
              <div className="main-score-area">
                <CircleScore score={score.overall} size={160} label="Overall"/>
                <div className="score-summary">
                  <h3>HF Recruiter Assessment</h3>
                  <p>{score.summary}</p>
                </div>
              </div>
              <div className="sub-scores">
                <CircleScore score={score.atsCompatibility} size={90} label="ATS"/>
                <CircleScore score={score.industryFit} size={90} label="HF Fit"/>
                <CircleScore score={score.readabilityScore} size={90} label="Clarity"/>
              </div>
            </div>

            {/* Insights */}
            <div className="insights-grid">
              <div className="insights-card strengths-card">
                <h4 className="insights-title">💪 Key Strengths</h4>
                {score.keyStrengths?.map((s, i) => (
                  <div key={i} className="insight-item"><span className="insight-dot green-dot"/>{s}</div>
                ))}
              </div>
              <div className="insights-card improvements-card">
                <h4 className="insights-title">🚀 Critical Improvements</h4>
                {score.criticalImprovements?.map((s, i) => (
                  <div key={i} className="insight-item"><span className="insight-dot red-dot"/>{s}</div>
                ))}
              </div>
            </div>

            {/* Tab nav */}
            <div className="results-tabs">
              {([
                { id: 'annotator', label: '🎨 Visual Annotations' },
                { id: 'scores', label: '📊 Section Scores' },
                { id: 'keywords', label: '🔑 Keywords' },
              ] as { id: ResultsTab; label: string }[]).map(tab => (
                <button key={tab.id} className={`results-tab ${resultsTab === tab.id ? 'active' : ''}`}
                  onClick={() => setResultsTab(tab.id)}>{tab.label}</button>
              ))}
            </div>

            {/* Tab content */}
            {resultsTab === 'annotator' && (
              <VisualAnnotator resumeText={resumeText} annotations={score.annotations || []}/>
            )}

            {resultsTab === 'scores' && (
              <div className="sections-list">
                {score.sections?.map((section, i) => <SectionCard key={i} section={section} index={i}/>)}
              </div>
            )}

            {resultsTab === 'keywords' && (
              <KeywordTracker found={score.hfKeywordsFound || []} missing={score.hfKeywordsMissing || []}/>
            )}

            {/* Rating */}
            <div className="rating-card">
              <h4 className="rating-title">🧠 Rate This Analysis</h4>
              <p className="rating-sub">Your rating is saved to Supabase and improves future analyses via RLHF</p>
              <div className="star-row">
                {[1,2,3,4,5].map(star => (
                  <button key={star} className={`star-btn ${userRating >= star ? 'active' : ''} ${ratingSubmitted ? 'submitted' : ''}`}
                    onClick={() => handleRating(star)} disabled={ratingSubmitted}>★</button>
                ))}
              </div>
              {ratingSubmitted && <div className="rating-thanks">✅ Saved to Supabase! Future analyses for {posObj?.label} will learn from this.</div>}
            </div>

            <button className="analyze-btn" onClick={() => setView('input')}>
              <span>Analyze Another Resume</span><span className="btn-arrow">→</span>
            </button>
          </div>
        )}

        {/* ── STATS VIEW ── */}
        {view === 'stats' && (
          <div className="stats-view fade-in">
            <div className="results-header">
              <button className="back-btn" onClick={() => setView('input')}>← Back</button>
              <h2 className="results-title">Knowledge Base Stats</h2>
            </div>
            {stats.length === 0 ? (
              <div className="kb-empty"><div className="kb-empty-icon">📊</div><p>No analyses yet. Analyze a resume to start building the knowledge base!</p></div>
            ) : (
              <>
                <div className="kb-stats-row">
                  {[
                    { val: stats.length, label: 'Total Analyses' },
                    { val: stats.filter((s:any) => s.user_rating).length, label: 'Rated' },
                    { val: stats.length > 0 ? Math.round(stats.reduce((a:number,s:any) => a + (s.overall_score||0), 0) / stats.length) : 0, label: 'Avg Score' },
                    { val: stats.filter((s:any) => s.user_rating >= 4).length, label: 'High Rated' },
                  ].map((s, i) => (
                    <div key={i} className="kb-big-stat">
                      <div className="kb-big-val">{s.val}</div>
                      <div className="kb-big-label">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="stats-table-wrap">
                  <table className="stats-table">
                    <thead><tr><th>Position</th><th>Score</th><th>Rating</th><th>Date</th></tr></thead>
                    <tbody>
                      {[...stats].reverse().map((s: any, i: number) => (
                        <tr key={i}>
                          <td><span className="pos-badge">{s.position}</span></td>
                          <td><span className={`score-badge ${s.overall_score >= 80 ? 'score-green' : s.overall_score >= 60 ? 'score-amber' : 'score-red'}`}>{s.overall_score ?? '—'}</span></td>
                          <td>{s.user_rating ? '★'.repeat(s.user_rating) + '☆'.repeat(5 - s.user_rating) : '—'}</td>
                          <td>{new Date(s.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
