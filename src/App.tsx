import React, { useState, useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';
import { analyzeResume, parseResumeFile } from './apiService';
import { saveResume, rateResume, getResumeStats } from './supabaseClient';
import { HF_POSITIONS, AnalysisResult } from './types';
import { ResultsView } from './components/ResultsView';
import './App.css';

type AppView = 'upload' | 'analyzing' | 'results' | 'stats';

// Baked-in design defaults (the prototype's live tweaks panel is design-time only).
const ACCENT_VARS = { '--accent': '#174F3A', '--accent-dark': '#0E3A2A', '--accent-soft': '#E9EFF6' } as React.CSSProperties;

// ── File upload zone ─────────────────────────────────────────────────────────
const UploadZone: React.FC<{ onFile: (f: File) => void; file: File | null }> = ({ onFile, file }) => {
  const [drag, setDrag] = useState(false);
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); };
  return (
    <div className={`upload-zone ${drag ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
      onClick={() => document.getElementById('file-input')?.click()}>
      <input id="file-input" type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {file ? (
        <div className="file-selected">
          <FileText className="upload-glyph" size={30} strokeWidth={1.6} />
          <div className="file-name">{file.name}</div>
          <div className="file-size">{(file.size / 1024).toFixed(0)} KB · Click to change</div>
        </div>
      ) : (
        <div className="upload-prompt">
          <Upload className="upload-glyph" size={30} strokeWidth={1.6} />
          <div className="upload-title">Drop your resume here</div>
          <div className="upload-sub">PDF, DOCX, or TXT · Max 10MB</div>
        </div>
      )}
    </div>
  );
};

const ANALYZE_STEPS = [
  'Loading HF keywords & criteria from the knowledge base',
  'Parsing the resume into structured sections',
  'Applying the quant-finance rubric',
  'Generating inline annotations',
  'Calculating scores',
];

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [position, setPosition] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [stats, setStats] = useState<any[]>([]);

  const posObj = HF_POSITIONS.find((p) => p.value === position);

  const handleAnalyze = useCallback(async () => {
    if (!file || !position) { setError('Please upload a resume and select a role.'); return; }
    setError(''); setProgress(0); setView('analyzing');
    try {
      setStatus('Parsing your resume'); setProgress(8);
      const text = await parseResumeFile(file);
      setStatus('Loading quant knowledge base'); setProgress(16);
      const res = await analyzeResume(text, position, (partial) => {
        const pct = Math.min(96, Math.round((partial.length / 6000) * 100));
        setStatus('Analyzing your resume'); setProgress((p) => Math.max(p, 18, pct));
      });
      setStatus('Finalizing'); setProgress(100);
      const label = HF_POSITIONS.find((p) => p.value === position)?.label;
      if (label) res.score.position = label;
      setResult(res);
      const id = await saveResume({
        position, resume_text: text,
        overall_score: res.score.overall, ats_score: res.score.ats,
        industry_fit: res.score.hfFit, readability_score: res.score.clarity,
        section_scores: Object.fromEntries((res.score.sections || []).map((s) => [s.name, s.score])),
        ai_feedback: { summary: res.score.summary, keyStrengths: res.score.keyStrengths, criticalImprovements: res.score.criticalImprovements },
        target_level: 'new_grad',
      });
      setSavedId(id); setRated(false); setRating(0);
      setView('results');
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Make sure the server is running.');
      setView('upload');
    }
  }, [file, position]);

  const handleRate = async (stars: number) => {
    if (rated) return;
    setRating(stars); setRated(true);
    if (savedId) await rateResume(savedId, stars, stars >= 3);
  };

  const newAnalysis = () => {
    setFile(null); setPosition(''); setResult(null); setError(''); setProgress(0); setView('upload');
  };

  const openStats = async () => { const d = await getResumeStats(); setStats(d || []); setView('stats'); };

  return (
    <div className="shell theme-light surf-cool" style={ACCENT_VARS}>
      <header className="top">
        <div className="brand">
          <div className="brand-icon">Q</div>
          <div className="brand-text">
            <div className="brand-name">Quantara</div>
            <div className="brand-sub">Resume Intelligence</div>
          </div>
        </div>
        <div className="top-mid">
          {view === 'results' && file && <span className="file-pill"><span className="file-dot" />{file.name}</span>}
        </div>
        <div className="top-right">
          {view === 'results' ? (
            <>
              {result && <span className="role-pill">◆ {result.score.position}</span>}
              <button className="ghost-btn" onClick={newAnalysis}>↻ New Analysis</button>
            </>
          ) : (
            <button className="ghost-btn" onClick={() => (view === 'stats' ? setView('upload') : openStats())}>
              {view === 'stats' ? '← Back' : 'History'}
            </button>
          )}
        </div>
      </header>

      {/* ── UPLOAD ── */}
      {view === 'upload' && (
        <div className="entry-scroll">
          <div className="entry fade-in">
            <div className="entry-hero">
              <h1 className="entry-title serif">Score my resume</h1>
              <p className="entry-sub">Upload your resume and select a target role. Get expert scores, inline annotations,
                and quant-finance–calibrated feedback in seconds.</p>
            </div>
            <div className="entry-card">
              <div className="field-label">01 — Upload resume</div>
              <UploadZone file={file} onFile={setFile} />
            </div>
            <div className="entry-card">
              <div className="field-label">02 — Target role</div>
              <div className="role-grid">
                {HF_POSITIONS.map((p) => { const Icon = p.icon; return (
                  <button key={p.value} className={`role-btn ${position === p.value ? 'selected' : ''}`} onClick={() => setPosition(p.value)}>
                    <Icon className="role-icon" size={20} strokeWidth={1.75} />
                    <div>
                      <div className="role-name">{p.label}</div>
                      <div className="role-desc">{p.description}</div>
                    </div>
                  </button>
                ); })}
              </div>
            </div>
            {error && <div className="entry-err">{error}</div>}
            <button className="cta-btn" onClick={handleAnalyze} disabled={!file || !position}>
              Analyze resume <span className="cta-arrow">→</span>
            </button>
          </div>
        </div>
      )}

      {/* ── ANALYZING ── */}
      {view === 'analyzing' && (
        <div className="entry-scroll">
          <div className="analyzing fade-in">
            <div className="orb"><span className="orb-glyph">◆</span></div>
            <h2 className="analyzing-title serif">Analyzing your resume</h2>
            <p className="analyzing-sub">Running against the quant-finance knowledge base{posObj ? ` for ${posObj.label}` : ''}</p>
            <div className="steps">
              {ANALYZE_STEPS.map((s, i) => (
                <div key={i} className="step" style={{ animationDelay: `${i * 0.6}s` }}><span className="step-dot" />{s}</div>
              ))}
            </div>
            <div className="an-progress">
              <div className="an-progress-meta">
                <span className="an-progress-label">{status || 'Starting'}</span>
                <span className="an-progress-pct">{progress}%</span>
              </div>
              <div className="an-progress-track">
                <div className="an-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {view === 'results' && result && (
        <ResultsView result={result} rating={rating} rated={rated} canRate={!!savedId} onRate={handleRate} />
      )}

      {/* ── STATS ── */}
      {view === 'stats' && (
        <div className="entry-scroll">
          <div className="stats-view fade-in">
            <h2 className="stats-title serif">Analysis history</h2>
            {stats.length === 0 ? (
              <div className="stats-empty">No analyses yet.</div>
            ) : (
              <>
                <div className="stat-cards">
                  {[
                    { v: stats.length, l: 'Total Analyses' },
                    { v: stats.filter((s: any) => s.user_rating).length, l: 'Rated' },
                    { v: Math.round(stats.reduce((a: number, s: any) => a + (s.overall_score || 0), 0) / stats.length), l: 'Avg Score' },
                    { v: stats.filter((s: any) => s.user_rating >= 4).length, l: 'High Rated' },
                  ].map((s, i) => (
                    <div key={i} className="stat-card"><div className="stat-val">{s.v}</div><div className="stat-lbl">{s.l}</div></div>
                  ))}
                </div>
                <div className="stats-tbl-wrap">
                  <table className="stats-tbl">
                    <thead><tr><th>Role</th><th>Score</th><th>Rating</th><th>Date</th></tr></thead>
                    <tbody>{[...stats].reverse().map((s: any, i: number) => (
                      <tr key={i}>
                        <td><span className="role-tag">{s.position}</span></td>
                        <td><span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: s.overall_score >= 80 ? 'var(--green)' : s.overall_score >= 60 ? 'var(--gold)' : 'var(--red)' }}>{s.overall_score ?? '—'}</span></td>
                        <td style={{ color: 'var(--gold)' }}>{s.user_rating ? '★'.repeat(s.user_rating) + '☆'.repeat(5 - s.user_rating) : '—'}</td>
                        <td style={{ color: 'var(--text3)' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
