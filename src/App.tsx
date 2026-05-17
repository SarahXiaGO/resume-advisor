import React, { useState, useEffect, useCallback } from 'react';
import { analyzeResume } from './apiService';
import { kbService } from './knowledgeBase';
import { ResumeScore, JOB_POSITIONS } from './types';
import './App.css';

type AppView = 'input' | 'analyzing' | 'results' | 'knowledge';

const CircleScore: React.FC<{ score: number; size?: number; label?: string }> = ({
  score, size = 120, label
}) => {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="circle-score-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8"/>
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="circle-score-inner">
        <span className="circle-score-num">{score}</span>
        {label && <span className="circle-score-label">{label}</span>}
      </div>
    </div>
  );
};

const SectionCard: React.FC<{ section: any; index: number }> = ({ section, index }) => {
  const [expanded, setExpanded] = useState(false);
  const pct = section.score;
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
  const grade = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';

  return (
    <div className="section-card" style={{ animationDelay: `${index * 0.08}s` }}>
      <div className="section-header" onClick={() => setExpanded(!expanded)}>
        <div className="section-left">
          <div className="section-grade" style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
            {grade}
          </div>
          <div>
            <div className="section-name">{section.name}</div>
            <div className="section-bar-wrap">
              <div className="section-bar-bg">
                <div className="section-bar-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="section-score-text" style={{ color }}>{pct}/100</span>
            </div>
          </div>
        </div>
        <div className={`section-chevron ${expanded ? 'open' : ''}`}>▾</div>
      </div>

      {expanded && (
        <div className="section-body">
          {section.strengths?.length > 0 && (
            <div className="section-group">
              <div className="section-group-title strengths-title">✓ Strengths</div>
              {section.strengths.map((s: string, i: number) => (
                <div key={i} className="feedback-item strength-item">
                  <span className="dot green-dot" />
                  {s}
                </div>
              ))}
            </div>
          )}
          {section.feedback?.length > 0 && (
            <div className="section-group">
              <div className="section-group-title feedback-title">⚡ Observations</div>
              {section.feedback.map((f: string, i: number) => (
                <div key={i} className="feedback-item">
                  <span className="dot amber-dot" />
                  {f}
                </div>
              ))}
            </div>
          )}
          {section.improvements?.length > 0 && (
            <div className="section-group">
              <div className="section-group-title improvements-title">🎯 Improvements</div>
              {section.improvements.map((imp: string, i: number) => (
                <div key={i} className="feedback-item improvement-item">
                  <span className="dot blue-dot" />
                  {imp}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('input');
  const [resumeText, setResumeText] = useState('');
  const [position, setPosition] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ra_api_key') || '');
  const [score, setScore] = useState<ResumeScore | null>(null);
  const [error, setError] = useState('');
  const [streamText, setStreamText] = useState('');
  const [kbStats, setKbStats] = useState(kbService.getStats());
  const [kbEntries, setKbEntries] = useState(kbService.getAll());
  const [lastEntryId, setLastEntryId] = useState('');
  const [userRating, setUserRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    if (apiKey) localStorage.setItem('ra_api_key', apiKey);
  }, [apiKey]);

  const handleAnalyze = useCallback(async () => {
    if (!resumeText.trim() || !position || !apiKey.trim()) {
      setError('Please fill in your resume, select a position, and provide an API key.');
      return;
    }
    setError('');
    setView('analyzing');
    setStreamText('');
    try {
      const result = await analyzeResume(resumeText, position, apiKey, (partial) => {
        setStreamText(partial.slice(0, 200) + '...');
      });
      setScore(result);
      setKbStats(kbService.getStats());
      const all = kbService.getAll();
      if (all.length > 0) setLastEntryId(all[0].id);
      setRatingSubmitted(false);
      setUserRating(0);
      setView('results');
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Check your API key and try again.');
      setView('input');
    }
  }, [resumeText, position, apiKey]);

  const handleRating = (stars: number) => {
    if (ratingSubmitted || !lastEntryId) return;
    setUserRating(stars);
    kbService.rateEntry(lastEntryId, stars >= 3, stars);
    setRatingSubmitted(true);
    setKbStats(kbService.getStats());
  };

  const refreshKB = () => {
    setKbStats(kbService.getStats());
    setKbEntries(kbService.getAll());
  };

  const posObj = JOB_POSITIONS.find(p => p.value === position);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">R</div>
            <div>
              <div className="logo-title">ResumeIQ</div>
              <div className="logo-sub">AI-Powered Career Advisor</div>
            </div>
          </div>
          <nav className="header-nav">
            <button className={`nav-btn ${view !== 'knowledge' ? 'active' : ''}`} onClick={() => setView('input')}>Analyze</button>
            <button className={`nav-btn ${view === 'knowledge' ? 'active' : ''}`} onClick={() => { refreshKB(); setView('knowledge'); }}>
              Knowledge Base
              {kbStats.total > 0 && <span className="kb-badge">{kbStats.total}</span>}
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {view === 'input' && (
          <div className="input-view fade-in">
            <div className="hero-section">
              <div className="hero-eyebrow">AI Resume Analysis</div>
              <h1 className="hero-title">Get Your Resume<br/><span className="gradient-text">Scored &amp; Perfected</span></h1>
              <p className="hero-sub">Section-by-section analysis powered by Claude AI with reinforcement learning from previous evaluations</p>
            </div>

            <div className="input-grid">
              <div className="input-col-main">
                <div className="form-card">
                  <label className="form-label"><span className="label-icon">🔑</span> Anthropic API Key</label>
                  <input type="password" className="form-input" placeholder="sk-ant-..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
                  <p className="form-hint">Stored locally only. Get yours at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a></p>
                </div>

                <div className="form-card">
                  <label className="form-label"><span className="label-icon">🎯</span> Target Position</label>
                  <div className="position-grid">
                    {JOB_POSITIONS.map(p => (
                      <button key={p.value} className={`position-btn ${position === p.value ? 'selected' : ''}`} onClick={() => setPosition(p.value)}>
                        <span className="pos-icon">{p.icon}</span>
                        <span className="pos-label">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-card">
                  <label className="form-label">
                    <span className="label-icon">📄</span> Resume Text
                    <span className="char-count">{resumeText.length} chars</span>
                  </label>
                  <textarea className="resume-textarea" placeholder={"Paste your full resume here...\n\nInclude all sections: contact info, summary, experience, skills, education, etc."} value={resumeText} onChange={e => setResumeText(e.target.value)} rows={18} />
                </div>

                {error && <div className="error-msg">⚠️ {error}</div>}

                <button className="analyze-btn" onClick={handleAnalyze} disabled={!resumeText || !position || !apiKey}>
                  <span>Analyze Resume</span>
                  <span className="btn-arrow">→</span>
                </button>
              </div>

              <div className="input-col-side">
                <div className="side-card">
                  <div className="side-card-title">How It Works</div>
                  <div className="how-steps">
                    {[
                      { n: '01', t: 'Paste Resume', d: 'Copy your full resume text into the input field' },
                      { n: '02', t: 'Select Position', d: "Choose the role you're targeting for tailored advice" },
                      { n: '03', t: 'AI Analysis', d: 'Claude evaluates each section with deep expertise' },
                      { n: '04', t: 'Learn & Improve', d: 'Rating feedback builds a smarter knowledge base' },
                    ].map(s => (
                      <div key={s.n} className="how-step">
                        <div className="step-num">{s.n}</div>
                        <div><div className="step-title">{s.t}</div><div className="step-desc">{s.d}</div></div>
                      </div>
                    ))}
                  </div>
                </div>

                {kbStats.total > 0 && (
                  <div className="side-card kb-stats-card">
                    <div className="side-card-title">🧠 Knowledge Base</div>
                    <div className="kb-stat-grid">
                      {[
                        { val: kbStats.total, label: 'Analyses' },
                        { val: kbStats.rated, label: 'Rated' },
                        { val: kbStats.avgRating > 0 ? kbStats.avgRating.toFixed(1) : '—', label: 'Avg Rating' },
                        { val: kbStats.helpful, label: 'Helpful' },
                      ].map((s, i) => (
                        <div key={i} className="kb-stat">
                          <div className="kb-stat-val">{s.val}</div>
                          <div className="kb-stat-label">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <p className="kb-hint">Your ratings help improve future analyses</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'analyzing' && (
          <div className="analyzing-view fade-in">
            <div className="analyzing-center">
              <div className="analyzing-orb">
                <div className="orb-inner">
                  <div className="orb-pulse" />
                  <div className="orb-icon">🧠</div>
                </div>
              </div>
              <h2 className="analyzing-title">Analyzing Your Resume</h2>
              <p className="analyzing-sub">Claude is evaluating your resume for <strong>{posObj?.label || position}</strong></p>
              <div className="analyzing-steps">
                {['Parsing document structure...', 'Evaluating section quality...', 'Checking ATS compatibility...', 'Generating improvement suggestions...', 'Calculating final scores...'].map((step, i) => (
                  <div key={i} className="analyzing-step" style={{ animationDelay: `${i * 0.7}s` }}><span className="step-dot" />{step}</div>
                ))}
              </div>
              {streamText && <div className="stream-preview"><span className="stream-label">Processing…</span><code>{streamText}</code></div>}
            </div>
          </div>
        )}

        {view === 'results' && score && (
          <div className="results-view fade-in">
            <div className="results-header">
              <button className="back-btn" onClick={() => setView('input')}>← Back</button>
              <h2 className="results-title">Resume Analysis Results</h2>
              {posObj && <div className="results-position">{posObj.icon} {posObj.label}</div>}
            </div>

            <div className="score-overview">
              <div className="main-score-area">
                <CircleScore score={score.overall} size={160} label="Overall" />
                <div className="score-summary"><h3>Overall Assessment</h3><p>{score.summary}</p></div>
              </div>
              <div className="sub-scores">
                <CircleScore score={score.atsCompatibility} size={90} label="ATS" />
                <CircleScore score={score.industryFit} size={90} label="Industry" />
                <CircleScore score={score.readabilityScore} size={90} label="Clarity" />
              </div>
            </div>

            <div className="insights-grid">
              <div className="insights-card strengths-card">
                <h4 className="insights-title">💪 Key Strengths</h4>
                {score.keyStrengths?.map((s, i) => (
                  <div key={i} className="insight-item"><span className="insight-dot green-dot" />{s}</div>
                ))}
              </div>
              <div className="insights-card improvements-card">
                <h4 className="insights-title">🚀 Critical Improvements</h4>
                {score.criticalImprovements?.map((s, i) => (
                  <div key={i} className="insight-item"><span className="insight-dot red-dot" />{s}</div>
                ))}
              </div>
            </div>

            <div className="sections-area">
              <h3 className="sections-title">Section-by-Section Breakdown</h3>
              <p className="sections-sub">Click any section to see detailed feedback</p>
              <div className="sections-list">
                {score.sections?.map((section, i) => <SectionCard key={i} section={section} index={i} />)}
              </div>
            </div>

            <div className="rating-card">
              <h4 className="rating-title">🧠 Help Improve the AI</h4>
              <p className="rating-sub">Rate this analysis to contribute to the knowledge base</p>
              <div className="star-row">
                {[1,2,3,4,5].map(star => (
                  <button key={star} className={`star-btn ${userRating >= star ? 'active' : ''} ${ratingSubmitted ? 'submitted' : ''}`} onClick={() => handleRating(star)} disabled={ratingSubmitted}>★</button>
                ))}
              </div>
              {ratingSubmitted && <div className="rating-thanks">✅ Thanks! Your rating helps improve future analyses.</div>}
            </div>

            <button className="analyze-btn" onClick={() => setView('input')}><span>Analyze Another Resume</span><span className="btn-arrow">→</span></button>
          </div>
        )}

        {view === 'knowledge' && (
          <div className="kb-view fade-in">
            <div className="kb-header">
              <h2 className="kb-title">🧠 Knowledge Base</h2>
              <p className="kb-desc">Reinforcement learning memory — the AI learns from rated analyses to improve future scoring</p>
              <div className="kb-actions">
                <button className="kb-action-btn" onClick={() => {
                  const data = kbService.exportKB();
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'resume_advisor_kb.json'; a.click();
                }}>⬇ Export KB</button>
                <button className="kb-action-btn danger" onClick={() => { if (window.confirm('Clear all knowledge base entries?')) { kbService.clear(); refreshKB(); } }}>🗑 Clear</button>
              </div>
            </div>

            <div className="kb-stats-row">
              {[{ val: kbStats.total, label: 'Total Analyses' }, { val: kbStats.rated, label: 'User Rated' }, { val: kbStats.helpful, label: 'Marked Helpful' }, { val: kbStats.avgRating > 0 ? kbStats.avgRating.toFixed(1) : '—', label: 'Avg Rating' }].map((s, i) => (
                <div key={i} className="kb-big-stat"><div className="kb-big-val">{s.val}</div><div className="kb-big-label">{s.label}</div></div>
              ))}
            </div>

            {kbEntries.length === 0 ? (
              <div className="kb-empty"><div className="kb-empty-icon">🗄️</div><p>No knowledge base entries yet. Analyze a resume to start building it!</p></div>
            ) : (
              <div className="kb-entries">
                {kbEntries.map((entry) => (
                  <div key={entry.id} className="kb-entry-card">
                    <div className="kb-entry-header">
                      <span className="kb-entry-position">{JOB_POSITIONS.find(p => p.value === entry.position)?.icon || '💼'} {entry.position}</span>
                      <span className="kb-entry-date">{new Date(entry.timestamp).toLocaleDateString()}</span>
                      {entry.userRating !== undefined && <span className="kb-entry-rating">{'★'.repeat(entry.userRating)}{'☆'.repeat(5 - entry.userRating)}</span>}
                    </div>
                    <div className="kb-entry-scores">
                      {Object.entries(entry.sectionScores || {}).map(([sec, sc]) => (
                        <span key={sec} className="kb-score-chip">{sec.split(' ')[0]}: <strong>{sc as number}</strong></span>
                      ))}
                    </div>
                    {entry.scoringRationale && <p className="kb-entry-rationale">{entry.scoringRationale}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
