import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, ParsedResume } from '../types';
import { DocumentView, ParsedView, BlockLayout, UpdateBlock } from './ResumeView';
import { OverallTab, AnnotationTab, SectionTab } from './AnalysisPanel';
import { RingVariant } from './primitives';

type Tab = 'overall' | 'annotation' | 'sections';
type LeftView = 'document' | 'parsed';

// Baked-in design defaults (the prototype's tweaks panel is design-time only).
const RING: RingVariant = 'gauge';
const LAYOUT: BlockLayout = 'form';

export const ResultsView: React.FC<{
  result: AnalysisResult;
  rating: number; rated: boolean; canRate: boolean; onRate: (stars: number) => void;
}> = ({ result, rating, rated, canRate, onRate }) => {
  const { score, annotations: anns } = result;
  const [tab, setTab] = useState<Tab>('overall');
  const [leftView, setLeftView] = useState<LeftView>('parsed');
  const [activeAnnId, setActiveAnnId] = useState<string | null>(null);
  const [resume, setResume] = useState<ParsedResume>(() => JSON.parse(JSON.stringify(result.resume)));
  const [leftPct, setLeftPct] = useState(50);
  const splitRef = useRef<HTMLDivElement>(null);

  // Re-seed the editable copy if a new analysis arrives.
  useEffect(() => { setResume(JSON.parse(JSON.stringify(result.resume))); }, [result]);

  const annotationMode = tab === 'annotation';
  const effectiveLeft: LeftView = annotationMode ? 'document' : leftView;

  const pickAnn = (id: string | null) => {
    setActiveAnnId(id);
    if (id && tab !== 'annotation') setTab('annotation');
  };

  const startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const div = e.currentTarget;
    div.classList.add('dragging');
    const onMove = (ev: MouseEvent) => {
      const rect = splitRef.current!.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(72, Math.max(28, pct)));
    };
    const onUp = () => {
      div.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Edit a parsed block field. key: 'jobTitle' | 'company' | … | 'body' | 'bullet:<id>' | 'addBullet' | 'removeBullet:<id>'.
  const updateBlock: UpdateBlock = (blockId, key, value = '') => {
    setResume((prev) => {
      const next: ParsedResume = JSON.parse(JSON.stringify(prev));
      for (const sec of next.sections) {
        if (sec.body && sec.body.id === blockId && key === 'body') { sec.body.text = value; return next; }
        if (!sec.items) continue;
        const it = sec.items.find((x) => x.id === blockId);
        if (!it) continue;
        const arr = it.bullets || it.details;
        if (!arr) return next;
        if (key === 'addBullet') {
          arr.push({ id: `${it.id}-n${arr.length + 1}`, text: '' });
        } else if (key.startsWith('removeBullet:')) {
          const bid = key.slice(13);
          const idx = arr.findIndex((x) => x.id === bid);
          if (idx >= 0) arr.splice(idx, 1);
        } else if (key.startsWith('bullet:')) {
          const bid = key.slice(7);
          const b = arr.find((x) => x.id === bid);
          if (b) b.text = value;
        } else {
          (it as any)[key] = value;
        }
        return next;
      }
      return next;
    });
  };

  return (
    <div className="split" ref={splitRef}>
      {/* ── LEFT: resume view ── */}
      <section className="panel left" style={{ width: leftPct + '%' }}>
        <div className="panel-bar">
          <div className="seg">
            <button className={`seg-btn ${effectiveLeft === 'document' ? 'on' : ''}`}
              onClick={() => !annotationMode && setLeftView('document')} disabled={annotationMode && effectiveLeft === 'document'}>
              Document
            </button>
            <button className={`seg-btn ${effectiveLeft === 'parsed' ? 'on' : ''}`}
              onClick={() => setLeftView('parsed')} disabled={annotationMode}>
              Parsed
            </button>
          </div>
          {annotationMode
            ? <span className="panel-hint">Highlights active — click to inspect</span>
            : effectiveLeft === 'parsed'
              ? <span className="panel-hint">Hover a block, then Edit</span>
              : <span className="panel-hint">Rendered resume</span>}
        </div>
        {effectiveLeft === 'document'
          ? <DocumentView resume={resume} anns={anns} activeId={activeAnnId} onPick={pickAnn} showHighlights={annotationMode} />
          : <ParsedView resume={resume} layout={LAYOUT} onChange={updateBlock} />}
      </section>

      <div className="divider" onMouseDown={startDrag} title="Drag to resize"><span className="divider-grip" /></div>

      {/* ── RIGHT: analysis ── */}
      <section className="panel right">
        <div className="panel-bar tabs-bar">
          {([['overall', 'Overall analysis'], ['annotation', 'Resume Annotation'], ['sections', 'Section score']] as [Tab, string][]).map(([id, label]) => (
            <button key={id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === 'overall' && <OverallTab score={score} ring={RING} rating={rating} rated={rated} canRate={canRate} onRate={onRate} />}
        {tab === 'annotation' && <AnnotationTab anns={anns} activeId={activeAnnId} onPick={pickAnn} />}
        {tab === 'sections' && <SectionTab score={score} ring={RING} />}
      </section>
    </div>
  );
};
