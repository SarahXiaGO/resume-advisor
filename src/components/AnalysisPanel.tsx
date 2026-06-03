import React, { useState } from 'react';
import { ResumeScore, SectionScore, Annotation, AnnotationType, ANNOTATION_COLORS, SCORE_META } from '../types';
import { CircleScore, Info, RingVariant, scoreColor, scoreGrade } from './primitives';

const TYPE_LABEL: Record<AnnotationType, string> = {
  strength: 'Strength', suggestion: 'Suggestion', warning: 'Warning', critical: 'Critical',
};

/* ── Tab 1: Overall analysis ── */
export const OverallTab: React.FC<{
  score: ResumeScore; ring: RingVariant;
  rating: number; rated: boolean; canRate: boolean; onRate: (stars: number) => void;
}> = ({ score, ring, rating, rated, canRate, onRate }) => {
  const subs: { key: 'ats' | 'hfFit' | 'clarity'; v: number }[] = [
    { key: 'ats', v: score.ats }, { key: 'hfFit', v: score.hfFit }, { key: 'clarity', v: score.clarity },
  ];
  return (
    <div className="ap-scroll">
      <div className="ov-hero">
        <CircleScore score={score.overall} size={132} label="Overall" variant={ring} />
        <div className="ov-hero-text">
          <div className="ov-eyebrow serif">Quant Finance Assessment</div>
          <p className="ov-summary">{score.summary}</p>
        </div>
      </div>

      <div className="ov-subs">
        {subs.map((s) => (
          <div className="ov-sub" key={s.key}>
            <CircleScore score={s.v} size={84} variant={ring} />
            <div className="ov-sub-lbl">{SCORE_META[s.key].label}<Info text={SCORE_META[s.key].help} /></div>
          </div>
        ))}
      </div>

      <div className="ov-insights">
        <div className="ov-card">
          <div className="ov-card-h" style={{ color: 'var(--green)' }}>Key Strengths</div>
          {score.keyStrengths.map((s, i) => (
            <div className="ov-item" key={i}><span className="dot" style={{ background: 'var(--green)' }} />{s}</div>
          ))}
        </div>
        <div className="ov-card">
          <div className="ov-card-h" style={{ color: 'var(--red)' }}>Critical Improvements</div>
          {score.criticalImprovements.map((s, i) => (
            <div className="ov-item" key={i}><span className="dot" style={{ background: 'var(--red)' }} />{s}</div>
          ))}
        </div>
      </div>

      <div className="ov-kw">
        <div className="ov-kw-head">Keywords</div>
        <div className="ov-kw-grid">
          <div className="ov-kw-col">
            <div className="ov-kw-title found">Found · {score.keywordsFound.length}</div>
            <div className="ov-chips">{score.keywordsFound.map((k, i) => <span className="chip found" key={i}>{k}</span>)}</div>
          </div>
          <div className="ov-kw-col">
            <div className="ov-kw-title missing">Missing · {score.keywordsMissing.length}</div>
            <div className="ov-chips">{score.keywordsMissing.map((k, i) => <span className="chip missing" key={i}>{k}</span>)}</div>
          </div>
        </div>
      </div>

      {canRate && (
        <div className="ov-rate">
          <div className="ov-rate-text">
            <div className="ov-rate-title">Rate this analysis</div>
            <div className="ov-rate-sub">Your rating is saved and improves future analyses.</div>
          </div>
          <div className="ov-stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} className={`ov-star ${rating >= s ? 'on' : ''}`} disabled={rated} onClick={() => onRate(s)}>★</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Tab 2: Resume Annotation ── */
export const AnnotationTab: React.FC<{
  anns: Annotation[]; activeId: string | null; onPick: (id: string | null) => void;
}> = ({ anns, activeId, onPick }) => {
  const [filter, setFilter] = useState<'all' | AnnotationType>('all');
  const C = ANNOTATION_COLORS;
  const shown = filter === 'all' ? anns : anns.filter((a) => a.type === filter);
  const counts = anns.reduce<Record<string, number>>((m, a) => { m[a.type] = (m[a.type] || 0) + 1; return m; }, {});

  return (
    <div className="ap-scroll">
      <div className="an-note">Click a suggestion to jump to it in the document on the left.</div>
      <div className="an-filters">
        <button className={`an-fchip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All · {anns.length}</button>
        {(Object.keys(TYPE_LABEL) as AnnotationType[]).filter((t) => counts[t]).map((t) => (
          <button key={t} className={`an-fchip ${filter === t ? 'on' : ''}`} onClick={() => setFilter(t)}
            style={filter === t ? { borderColor: C[t], color: C[t] } : {}}>
            <span className="leg-dot" style={{ background: C[t] }} />{TYPE_LABEL[t]} · {counts[t]}
          </button>
        ))}
      </div>
      <div className="an-list">
        {shown.map((a) => {
          const active = activeId === a.id;
          return (
            <div key={a.id} className={`an-card ${active ? 'active' : ''}`}
              style={{ borderLeftColor: C[a.type] }} onClick={() => onPick(active ? null : a.id)}>
              <div className="an-card-top">
                <span className="an-type" style={{ color: C[a.type] }}>{TYPE_LABEL[a.type]}</span>
                <span className="an-section">{a.sectionName}</span>
              </div>
              <div className="an-quote">“{a.highlightText}”</div>
              <div className="an-comment">{a.comment}</div>
              {active && a.suggestion && (
                <div className="an-suggest">
                  <span className="an-suggest-lbl">Suggested rewrite</span>
                  {a.suggestion}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Tab 3: Section score ── */
const SectionCard: React.FC<{ section: SectionScore; index: number; ring: RingVariant }> = ({ section, index }) => {
  const [open, setOpen] = useState(index === 0);
  const c = scoreColor(section.score);
  const groups = [
    { title: 'Strengths', color: 'var(--green)', items: section.strengths },
    { title: 'Observations', color: 'var(--gold)', items: section.feedback },
    { title: 'Improvements', color: 'var(--blue)', items: section.improvements },
  ].filter((g) => g.items && g.items.length);

  return (
    <div className="sc-card">
      <div className="sc-head" onClick={() => setOpen(!open)}>
        <div className="sc-grade" style={{ color: c, borderColor: c + '55', background: c + '11' }}>{scoreGrade(section.score)}</div>
        <div className="sc-mid">
          <div className="sc-name">{section.name}</div>
          <div className="sc-bar-row">
            <div className="sc-bar-bg"><div className="sc-bar-fill" style={{ width: `${section.score}%`, background: c }} /></div>
            <span className="sc-score" style={{ color: c }}>{section.score}/100</span>
          </div>
        </div>
        <span className={`sc-chev ${open ? 'open' : ''}`}>▾</span>
      </div>
      {open && (
        <div className="sc-body">
          {groups.map((g, i) => (
            <div className="sc-group" key={i}>
              <div className="sc-grp-title" style={{ color: g.color }}>{g.title}</div>
              {g.items.map((t, j) => (
                <div className="sc-item" key={j}><span className="dot" style={{ background: g.color }} />{t}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SectionTab: React.FC<{ score: ResumeScore; ring: RingVariant }> = ({ score, ring }) => {
  const avg = Math.round(score.sections.reduce((a, s) => a + s.score, 0) / Math.max(1, score.sections.length));
  return (
    <div className="ap-scroll">
      <div className="st-summary">
        <CircleScore score={avg} size={64} variant={ring} />
        <div>
          <div className="st-sum-title">Section breakdown</div>
          <div className="st-sum-sub">{score.sections.length} sections scored · average {avg}/100</div>
        </div>
      </div>
      <div className="st-list">
        {score.sections.map((s, i) => <SectionCard key={s.id} section={s} index={i} ring={ring} />)}
      </div>
    </div>
  );
};
