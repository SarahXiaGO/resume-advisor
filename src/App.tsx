import React, { useState, useCallback } from 'react';
import { analyzeResume, parseResumeFile } from './apiService';
import { saveResume, rateResume, getResumeStats } from './supabaseClient';
import { ResumeScore, Annotation, HF_POSITIONS, ANNOTATION_COLORS } from './types';
import './App.css';

type AppView = 'upload' | 'analyzing' | 'results' | 'stats';
type ResultsTab = 'annotator' | 'scores' | 'keywords';

// ── Circular Score ─────────────────────────────────────────────────────────
const CircleScore: React.FC<{ score: number; size?: number; label?: string }> = ({ score, size = 120, label }) => {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#00FF85' : score >= 60 ? '#E8A020' : '#FF4444';
  return (
    <div className="circle-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transform:'rotate(-90deg)', transformOrigin:'center', transition:'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}/>
      </svg>
      <div className="circle-inner">
        <span className="circle-num" style={{ color }}>{score}</span>
        {label && <span className="circle-lbl">{label}</span>}
      </div>
    </div>
  );
};

// ── Section Card ───────────────────────────────────────────────────────────
const SectionCard: React.FC<{ section: any; index: number }> = ({ section, index }) => {
  const [open, setOpen] = useState(false);
  const s = section.score;
  const color = s >= 80 ? '#00FF85' : s >= 60 ? '#E8A020' : '#FF4444';
  const grade = s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F';
  return (
    <div className="sec-card" style={{ animationDelay: `${index * 0.07}s` }}>
      <div className="sec-header" onClick={() => setOpen(!open)}>
        <div className="sec-left">
          <div className="sec-grade" style={{ color, border:`1px solid ${color}44`, background:`${color}11` }}>{grade}</div>
          <div style={{ flex:1 }}>
            <div className="sec-name">{section.name}</div>
            <div className="sec-bar-row">
              <div className="sec-bar-bg"><div className="sec-bar-fill" style={{ width:`${s}%`, background:color }}/></div>
              <span className="sec-score" style={{ color }}>{s}/100</span>
            </div>
          </div>
        </div>
        <span className={`sec-chev ${open?'open':''}`}>▾</span>
      </div>
      {open && (
        <div className="sec-body">
          {section.strengths?.length > 0 && (
            <div className="sec-group"><div className="sec-grp-title" style={{color:'#00FF85'}}>✓ Strengths</div>
              {section.strengths.map((s:string,i:number) => <div key={i} className="sec-item"><span className="dot" style={{background:'#00FF85'}}/>{s}</div>)}
            </div>
          )}
          {section.feedback?.length > 0 && (
            <div className="sec-group"><div className="sec-grp-title" style={{color:'#E8A020'}}>⚡ Observations</div>
              {section.feedback.map((f:string,i:number) => <div key={i} className="sec-item"><span className="dot" style={{background:'#E8A020'}}/>{f}</div>)}
            </div>
          )}
          {section.improvements?.length > 0 && (
            <div className="sec-group"><div className="sec-grp-title" style={{color:'#4D9EFF'}}>🎯 Improvements</div>
              {section.improvements.map((imp:string,i:number) => <div key={i} className="sec-item"><span className="dot" style={{background:'#4D9EFF'}}/>{imp}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Visual Annotator ───────────────────────────────────────────────────────
const VisualAnnotator: React.FC<{ resumeText: string; annotations: Annotation[] }> = ({ resumeText, annotations }) => {
  const [activeId, setActiveId] = useState<string|null>(null);
  (window as any).__setAnn = (id: string) => setActiveId(id === activeId ? null : id);

  const html = (() => {
    let t = resumeText;
    const sorted = [...annotations].sort((a,b) => b.highlightText.length - a.highlightText.length);
    const used = new Set<string>();
    for (const ann of sorted) {
      if (!ann.highlightText || used.has(ann.id)) continue;
      const re = new RegExp(ann.highlightText.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i');
      if (re.test(t)) {
        t = t.replace(re, match => { used.add(ann.id); return `<mark class="ann ann-${ann.type}" data-id="${ann.id}" style="background:${ann.color}22;border-bottom:2px solid ${ann.color};cursor:pointer;border-radius:2px;padding:1px 2px;" onclick="window.__setAnn('${ann.id}')">${match}</mark>`; });
      }
    }
    return t.replace(/\n/g,'<br/>');
  })();

  const active = annotations.find(a => a.id === activeId);
  const typeLabel: Record<string,string> = { strength:'Strength', warning:'Warning', critical:'Critical Issue', suggestion:'Suggestion' };
  const typeIcon: Record<string,string> = { strength:'✅', warning:'⚠️', critical:'🚨', suggestion:'💡' };

  return (
    <div className="ann-wrap">
      <div className="ann-legend">
        {Object.entries(ANNOTATION_COLORS).map(([t,c]) => (
          <span key={t} className="leg-item"><span className="leg-dot" style={{background:c}}/>{typeLabel[t]}</span>
        ))}
      </div>
      <div className="ann-body">
        <div className="ann-resume">
          <div className="resume-text" dangerouslySetInnerHTML={{ __html: html }}/>
        </div>
        <div className="ann-side">
          {active ? (
            <div className="ann-card" style={{ borderColor: active.color }}>
              <div className="ann-type" style={{ color: active.color }}>{typeIcon[active.type]} {typeLabel[active.type]}</div>
              <div className="ann-section">{active.sectionName}</div>
              <div className="ann-quote">"{active.highlightText}"</div>
              <div className="ann-comment">{active.comment}</div>
              <button className="ann-close" onClick={() => setActiveId(null)}>✕ Close</button>
            </div>
          ) : (
            <div className="ann-empty">
              <div style={{fontSize:'2rem',marginBottom:'0.75rem'}}>👆</div>
              <p>Click any highlighted text to see expert feedback</p>
              <div className="ann-counts">
                {Object.entries(ANNOTATION_COLORS).map(([t,c]) => {
                  const n = annotations.filter(a=>a.type===t).length;
                  return n > 0 ? <div key={t} className="ann-count"><span className="leg-dot" style={{background:c}}/>{n} {typeLabel[t]}{n>1?'s':''}</div> : null;
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
  <div className="kw-grid">
    <div className="kw-col">
      <div className="kw-title" style={{color:'#00FF85'}}>✅ Found ({found.length})</div>
      <div className="kw-chips">{found.map((k,i) => <span key={i} className="chip found">{k}</span>)}</div>
    </div>
    <div className="kw-col">
      <div className="kw-title" style={{color:'#FF4444'}}>❌ Missing ({missing.length})</div>
      <div className="kw-chips">{missing.map((k,i) => <span key={i} className="chip missing">{k}</span>)}</div>
    </div>
  </div>
);

// ── File Upload Zone ───────────────────────────────────────────────────────
const UploadZone: React.FC<{ onFile: (f: File) => void; file: File|null }> = ({ onFile, file }) => {
  const [drag, setDrag] = useState(false);
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); };
  return (
    <div className={`upload-zone ${drag?'dragging':''} ${file?'has-file':''}`}
      onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
      onClick={() => document.getElementById('file-input')?.click()}>
      <input id="file-input" type="file" accept=".pdf,.docx,.txt" style={{display:'none'}}
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}/>
      {file ? (
        <div className="file-selected">
          <div className="file-icon">📄</div>
          <div className="file-name">{file.name}</div>
          <div className="file-size">{(file.size/1024).toFixed(0)} KB · Click to change</div>
        </div>
      ) : (
        <div className="upload-prompt">
          <div className="upload-icon">⬆</div>
          <div className="upload-title">Drop your resume here</div>
          <div className="upload-sub">PDF, DOCX, or TXT · Max 10MB</div>
        </div>
      )}
    </div>
  );
};

// ── Main App ───────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [view, setView] = useState<AppView>('upload');
  const [tab, setTab] = useState<ResultsTab>('annotator');
  const [file, setFile] = useState<File|null>(null);
  const [position, setPosition] = useState('');
  const [score, setScore] = useState<ResumeScore|null>(null);
  const [resumeText, setResumeText] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [savedId, setSavedId] = useState<string|null>(null);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [stats, setStats] = useState<any[]>([]);

  const handleAnalyze = useCallback(async () => {
    if (!file || !position) { setError('Please upload a resume and select a role.'); return; }
    setError(''); setView('analyzing');
    try {
      setStatus('Parsing your resume...');
      const text = await parseResumeFile(file);
      setResumeText(text);
      setStatus('Loading quant knowledge base...');
      const result = await analyzeResume(text, position, (partial) => {
        const pct = Math.min(95, Math.round((partial.length / 2500) * 100));
        setStatus(`Analyzing... ${pct}%`);
      });
      setScore(result);
      const id = await saveResume({
        position, resume_text: text,
        overall_score: result.overall, ats_score: result.atsCompatibility,
        industry_fit: result.industryFit, readability_score: result.readabilityScore,
        section_scores: Object.fromEntries((result.sections||[]).map(s=>[s.name,s.score])),
        ai_feedback: { summary: result.summary, keyStrengths: result.keyStrengths, criticalImprovements: result.criticalImprovements },
        target_level: 'new_grad',
      });
      setSavedId(id); setRated(false); setRating(0);
      setTab('annotator'); setView('results');
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Make sure the server is running.'); setView('upload');
    }
  }, [file, position]);

  const handleRate = async (stars: number) => {
    if (rated) return; setRating(stars); setRated(true);
    if (savedId) await rateResume(savedId, stars, stars >= 3);
  };

  const posObj = HF_POSITIONS.find(p => p.value === position);

  return (
    <div className="app">
      {/* ── HEADER ── */}
      <header className="hdr">
        <div className="hdr-inner">
          <div className="brand">
            <div className="brand-icon">&gt;_</div>
            <div>
              <div className="brand-name"><span className="brand-q">Q</span> QuantEdge</div>
              <div className="brand-sub">Resume Intelligence</div>
            </div>
          </div>
          <nav className="hdr-nav">
            <button className={`hdr-btn ${view!=='stats'?'active':''}`} onClick={() => setView('upload')}>Score Resume</button>
            <button className={`hdr-btn ${view==='stats'?'active':''}`} onClick={async()=>{const d=await getResumeStats();setStats(d||[]);setView('stats');}}>History</button>
          </nav>
        </div>
      </header>

      <main className="main">

        {/* ── UPLOAD VIEW ── */}
        {view === 'upload' && (
          <div className="fade-in">
            <div className="hero">
              <div className="beta-pill"><span className="beta-dot"/>NOW IN BETA</div>
              <h1 className="hero-title">Score My Resume</h1>
              <p className="hero-sub">Upload your resume and select your target role. Get expert scores, inline annotations, and quant finance–calibrated feedback in seconds.</p>
            </div>

            <div className="form-wrap">
              <div className="form-card">
                <div className="field-label">01 — Upload Resume</div>
                <UploadZone file={file} onFile={setFile}/>
              </div>

              <div className="form-card">
                <div className="field-label">02 — Target Role</div>
                <div className="role-grid">
                  {HF_POSITIONS.map(p => (
                    <button key={p.value} className={`role-btn ${position===p.value?'selected':''}`} onClick={()=>setPosition(p.value)}>
                      <span className="role-icon">{p.icon}</span>
                      <div>
                        <div className="role-name">{p.label}</div>
                        <div className="role-desc">{p.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="err-msg">⚠ {error}</div>}

              <button className="cta-btn" onClick={handleAnalyze} disabled={!file||!position}>
                Analyze Resume <span className="cta-arrow">→</span>
              </button>

              <div className="trust-row">
                {['📄 PDF & DOCX supported', '🔒 Your data stays private', '🧠 Learns from ratings'].map((t,i) => (
                  <span key={i} className="trust-item">{t}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYZING VIEW ── */}
        {view === 'analyzing' && (
          <div className="analyzing fade-in">
            <div className="orb-wrap">
              <div className="orb"><div className="orb-pulse"/><span className="orb-icon">⬡</span></div>
            </div>
            <h2 className="analyzing-title">Analyzing Your Resume</h2>
            <p className="analyzing-sub">Running against quant finance knowledge base{posObj ? ` for ${posObj.label}` : ''}</p>
            <div className="steps">
              {['📚 Loading HF keywords & criteria from database...','🔍 Parsing resume sections...','💼 Applying quant finance rubric...','🎨 Generating inline annotations...','📊 Calculating scores...'].map((s,i) => (
                <div key={i} className="step" style={{animationDelay:`${i*0.6}s`}}><span className="step-dot"/>{s}</div>
              ))}
            </div>
            {status && <div className="status-bar"><code>{status}</code></div>}
          </div>
        )}

        {/* ── RESULTS VIEW ── */}
        {view === 'results' && score && (
          <div className="results fade-in">
            <div className="results-hdr">
              <button className="back-btn" onClick={() => setView('upload')}>← New Analysis</button>
              <div className="results-title">Resume Analysis</div>
              {posObj && <div className="role-pill">{posObj.icon} {posObj.label}</div>}
            </div>

            {/* Scores */}
            <div className="scores-row">
              <div className="main-score">
                <CircleScore score={score.overall} size={160} label="Overall"/>
                <div className="score-text">
                  <div className="score-heading">Quant Finance Assessment</div>
                  <p className="score-summary">{score.summary}</p>
                </div>
              </div>
              <div className="sub-scores">
                <CircleScore score={score.atsCompatibility} size={88} label="ATS"/>
                <CircleScore score={score.industryFit} size={88} label="HF Fit"/>
                <CircleScore score={score.readabilityScore} size={88} label="Clarity"/>
              </div>
            </div>

            {/* Insights */}
            <div className="insights-row">
              <div className="insight-card">
                <div className="insight-title" style={{color:'#00FF85'}}>💪 Key Strengths</div>
                {score.keyStrengths?.map((s,i) => <div key={i} className="insight-item"><span className="dot" style={{background:'#00FF85'}}/>{s}</div>)}
              </div>
              <div className="insight-card">
                <div className="insight-title" style={{color:'#FF4444'}}>🚀 Critical Improvements</div>
                {score.criticalImprovements?.map((s,i) => <div key={i} className="insight-item"><span className="dot" style={{background:'#FF4444'}}/>{s}</div>)}
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              {([['annotator','🎨 Annotations'],['scores','📊 Section Scores'],['keywords','🔑 Keywords']] as [ResultsTab,string][]).map(([id,label]) => (
                <button key={id} className={`tab ${tab===id?'active':''}`} onClick={()=>setTab(id)}>{label}</button>
              ))}
            </div>

            {tab === 'annotator' && <VisualAnnotator resumeText={resumeText} annotations={score.annotations||[]}/>}
            {tab === 'scores' && <div className="secs">{score.sections?.map((s,i) => <SectionCard key={i} section={s} index={i}/>)}</div>}
            {tab === 'keywords' && <KeywordTracker found={score.hfKeywordsFound||[]} missing={score.hfKeywordsMissing||[]}/>}

            {/* Rating */}
            <div className="rating-card">
              <div className="rating-title">Help improve the AI</div>
              <p className="rating-sub">Your rating is saved and improves future analyses</p>
              <div className="stars">
                {[1,2,3,4,5].map(s => (
                  <button key={s} className={`star ${rating>=s?'on':''} ${rated?'done':''}`} onClick={()=>handleRate(s)} disabled={rated}>★</button>
                ))}
              </div>
              {rated && <div className="rated-msg">✅ Saved! Future {posObj?.label} analyses will learn from this.</div>}
            </div>

            <button className="cta-btn" onClick={()=>setView('upload')}>Analyze Another Resume <span className="cta-arrow">→</span></button>
          </div>
        )}

        {/* ── STATS VIEW ── */}
        {view === 'stats' && (
          <div className="stats-view fade-in">
            <div className="results-hdr">
              <button className="back-btn" onClick={()=>setView('upload')}>← Back</button>
              <div className="results-title">Analysis History</div>
            </div>
            {stats.length === 0 ? (
              <div className="empty"><div style={{fontSize:'3rem',marginBottom:'1rem'}}>📊</div><p>No analyses yet.</p></div>
            ) : (
              <>
                <div className="stat-cards">
                  {[{v:stats.length,l:'Total Analyses'},{v:stats.filter((s:any)=>s.user_rating).length,l:'Rated'},{v:Math.round(stats.reduce((a:number,s:any)=>a+(s.overall_score||0),0)/stats.length),l:'Avg Score'},{v:stats.filter((s:any)=>s.user_rating>=4).length,l:'High Rated'}].map((s,i)=>(
                    <div key={i} className="stat-card"><div className="stat-val">{s.v}</div><div className="stat-lbl">{s.l}</div></div>
                  ))}
                </div>
                <div className="stats-tbl-wrap">
                  <table className="stats-tbl">
                    <thead><tr><th>Role</th><th>Score</th><th>Rating</th><th>Date</th></tr></thead>
                    <tbody>{[...stats].reverse().map((s:any,i:number)=>(
                      <tr key={i}>
                        <td><span className="role-tag">{s.position}</span></td>
                        <td><span className="score-tag" style={{color:s.overall_score>=80?'#00FF85':s.overall_score>=60?'#E8A020':'#FF4444'}}>{s.overall_score??'—'}</span></td>
                        <td style={{color:'#E8A020'}}>{s.user_rating?'★'.repeat(s.user_rating)+'☆'.repeat(5-s.user_rating):'—'}</td>
                        <td style={{color:'#555'}}>{new Date(s.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}</tbody>
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
