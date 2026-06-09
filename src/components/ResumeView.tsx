import React, { useState, useRef, useEffect } from 'react';
import { Annotation, ParsedResume, ParsedItem, ANNOTATION_COLORS } from '../types';
import { EditField } from './primitives';

export type BlockLayout = 'card' | 'form' | 'timeline';
export type UpdateBlock = (blockId: string, key: string, value?: string) => void;

/* Wrap annotation substrings in <mark> spans within a block's text. */
function highlightText(
  text: string, blockId: string, anns: Annotation[],
  activeId: string | null, onPick: (id: string | null) => void,
): React.ReactNode {
  const here = anns.filter((a) => a.blockId === blockId && text.includes(a.highlightText));
  if (!here.length) return text;
  let segments: { t: string; ann: Annotation | null }[] = [{ t: text, ann: null }];
  here.forEach((ann) => {
    const next: { t: string; ann: Annotation | null }[] = [];
    segments.forEach((seg) => {
      if (seg.ann || !seg.t.includes(ann.highlightText)) { next.push(seg); return; }
      const idx = seg.t.indexOf(ann.highlightText);
      if (idx > 0) next.push({ t: seg.t.slice(0, idx), ann: null });
      next.push({ t: ann.highlightText, ann });
      const rest = seg.t.slice(idx + ann.highlightText.length);
      if (rest) next.push({ t: rest, ann: null });
    });
    segments = next;
  });
  return segments.map((seg, i) => {
    if (!seg.ann) return <React.Fragment key={i}>{seg.t}</React.Fragment>;
    const c = ANNOTATION_COLORS[seg.ann.type];
    const active = activeId === seg.ann.id;
    const annId = seg.ann.id;
    return (
      <mark key={i} data-ann-id={annId} className={`doc-mark ${active ? 'active' : ''}`}
        style={{ background: c + '22', borderBottom: `2px solid ${c}`, boxShadow: active ? `0 0 0 3px ${c}33` : 'none' }}
        onClick={() => onPick(active ? null : annId)}>{seg.t}</mark>
    );
  });
}

/* ── Document view — renders the resume as a clean paper document ── */
export const DocumentView: React.FC<{
  resume: ParsedResume;
  anns: Annotation[];
  activeId: string | null;
  onPick: (id: string | null) => void;
  showHighlights: boolean;
}> = ({ resume, anns, activeId, onPick, showHighlights }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(`[data-ann-id="${activeId}"]`);
    if (el) {
      const c = scrollRef.current;
      const top = el.offsetTop - c.clientHeight / 2 + el.clientHeight / 2;
      c.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }, [activeId]);

  const hl = (text: string, blockId: string) =>
    showHighlights ? highlightText(text, blockId, anns, activeId, onPick) : text;
  const c = resume.contact;

  return (
    <div className="doc-scroll" ref={scrollRef}>
      <div className="doc-paper">
        <div className="doc-head">
          <h1 className="doc-name">{c.name}</h1>
          <div className="doc-title">{c.title}</div>
          <div className="doc-contact">
            {[c.email, c.phone, c.location, ...(c.links || [])].filter(Boolean).map((v, i, arr) => (
              <React.Fragment key={i}>
                <span>{v}</span>
                {i < arr.length - 1 && <span className="doc-sep">·</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
        {resume.sections.map((sec) => (
          <div className="doc-section" key={sec.id}>
            <div className="doc-h">{sec.heading}</div>
            {(sec.type === 'summary' || sec.type === 'skills') && sec.body &&
              <p className="doc-body">{hl(sec.body.text, sec.body.id)}</p>}
            {(sec.type === 'experience' || sec.type === 'projects') && (sec.items || []).map((it) => (
              <div className="doc-entry" key={it.id}>
                <div className="doc-entry-top">
                  <span className="doc-entry-title">{it.jobTitle}</span>
                  <span className="doc-entry-dates">{[it.start, it.end].filter(Boolean).join(' – ')}</span>
                </div>
                <div className="doc-entry-sub">{[it.company, it.location].filter(Boolean).join(' · ')}</div>
                <ul className="doc-bullets">
                  {(it.bullets || []).map((b) => <li key={b.id}>{hl(b.text, b.id)}</li>)}
                </ul>
              </div>
            ))}
            {sec.type === 'education' && (sec.items || []).map((it) => (
              <div className="doc-entry" key={it.id}>
                <div className="doc-entry-top">
                  <span className="doc-entry-title">{it.school}</span>
                  <span className="doc-entry-dates">{[it.start, it.end].filter(Boolean).join(' – ')}</span>
                </div>
                <div className="doc-entry-sub">{it.degree}{it.location ? ` · ${it.location}` : ''}</div>
                <ul className="doc-bullets">
                  {(it.details || []).map((d) => <li key={d.id}>{hl(d.text, d.id)}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── A labelled, editable field stack ── */
const Field: React.FC<{
  label: string; value?: string; onChange?: (v: string) => void;
  editing: boolean; multiline?: boolean; mono?: boolean; placeholder?: string; grow?: boolean;
}> = ({ label, value = '', onChange, editing, multiline, mono, placeholder, grow }) => (
  <div className={`pf-field ${grow ? 'grow' : ''}`}>
    <div className="pf-label">{label}</div>
    <EditField value={value} onChange={onChange} editing={editing} multiline={multiline} mono={mono} placeholder={placeholder} />
  </div>
);

/* ── One parsed experience/project block ── */
const ExperienceBlock: React.FC<{
  item: ParsedItem; layout: BlockLayout; editing: boolean;
  onEdit: (id: string) => void; onSave: () => void; onChange: UpdateBlock;
}> = ({ item, layout, editing, onEdit, onSave, onChange }) => {
  const set = (k: string) => (v: string) => onChange(item.id, k, v);
  const setBullet = (bid: string) => (v: string) => onChange(item.id, `bullet:${bid}`, v);
  return (
    <div className={`pblock layout-${layout} ${editing ? 'editing' : ''}`}>
      {layout === 'timeline' && <div className="pb-rail"><span className="pb-dot" /></div>}
      <div className="pb-main">
        <div className="pb-head">
          <div className="pb-fields">
            <Field label="Job Title" value={item.jobTitle} onChange={set('jobTitle')} editing={editing} placeholder="Title" grow />
            <Field label="Company" value={item.company} onChange={set('company')} editing={editing} placeholder="Company" grow />
          </div>
          <button className="pb-edit" onClick={() => editing ? onSave() : onEdit(item.id)}>
            {editing ? '✓ Done' : '✎ Edit'}
          </button>
        </div>
        <div className="pb-meta">
          <Field label="Location" value={item.location} onChange={set('location')} editing={editing} mono placeholder="—" />
          <Field label="Start" value={item.start} onChange={set('start')} editing={editing} mono placeholder="—" />
          <Field label="End" value={item.end} onChange={set('end')} editing={editing} mono placeholder="Present" />
        </div>
        <div className="pb-bullets">
          <div className="pf-label">Description</div>
          {(item.bullets || []).map((b) => (
            <div className="pb-bullet" key={b.id}>
              <span className="pb-bdot" />
              <div className="pb-bcontent">
                <EditField value={b.text} onChange={setBullet(b.id)} editing={editing} multiline placeholder="Describe impact…" />
              </div>
              {editing && <button className="pb-bremove" title="Remove bullet" onClick={() => onChange(item.id, `removeBullet:${b.id}`)}>✕</button>}
            </div>
          ))}
          {editing && <button className="pb-addbullet" onClick={() => onChange(item.id, 'addBullet')}>+ Add bullet</button>}
        </div>
      </div>
    </div>
  );
};

/* ── Parsed view — sections of editable blocks ── */
export const ParsedView: React.FC<{ resume: ParsedResume; layout: BlockLayout; onChange: UpdateBlock }> = ({
  resume, layout, onChange,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="parsed-scroll">
      <div className="parsed-contact">
        <div className="pc-avatar">{resume.contact.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
        <div className="pc-info">
          <div className="pc-name">{resume.contact.name}</div>
          <div className="pc-title">{resume.contact.title}</div>
          <div className="pc-meta">{[resume.contact.email, resume.contact.location].filter(Boolean).join(' · ')}</div>
        </div>
      </div>

      {resume.sections.map((sec) => (
        <div className="parsed-section" key={sec.id}>
          <div className="ps-heading"><span className="ps-bar" />{sec.heading}</div>

          {(sec.type === 'summary' || sec.type === 'skills') && sec.body && (
            <div className={`pblock layout-${layout} ${editingId === sec.body.id ? 'editing' : ''}`}>
              <div className="pb-main">
                <div className="pb-head">
                  <div className="pf-label">{sec.type === 'skills' ? 'Skills' : 'Summary'}</div>
                  <button className="pb-edit" onClick={() => setEditingId(editingId === sec.body!.id ? null : sec.body!.id)}>
                    {editingId === sec.body.id ? '✓ Done' : '✎ Edit'}
                  </button>
                </div>
                <EditField value={sec.body.text} editing={editingId === sec.body.id} multiline
                  onChange={(v) => onChange(sec.body!.id, 'body', v)} />
              </div>
            </div>
          )}

          {(sec.type === 'experience' || sec.type === 'projects') && (sec.items || []).map((it) => (
            <ExperienceBlock key={it.id} item={it} layout={layout}
              editing={editingId === it.id}
              onEdit={setEditingId} onSave={() => setEditingId(null)} onChange={onChange} />
          ))}

          {sec.type === 'education' && (sec.items || []).map((it) => (
            <div className={`pblock layout-${layout} ${editingId === it.id ? 'editing' : ''}`} key={it.id}>
              {layout === 'timeline' && <div className="pb-rail"><span className="pb-dot" /></div>}
              <div className="pb-main">
                <div className="pb-head">
                  <div className="pb-fields">
                    <Field label="School" value={it.school} onChange={(v) => onChange(it.id, 'school', v)} editing={editingId === it.id} grow />
                    <Field label="Degree" value={it.degree} onChange={(v) => onChange(it.id, 'degree', v)} editing={editingId === it.id} grow />
                  </div>
                  <button className="pb-edit" onClick={() => setEditingId(editingId === it.id ? null : it.id)}>
                    {editingId === it.id ? '✓ Done' : '✎ Edit'}
                  </button>
                </div>
                <div className="pb-meta">
                  <Field label="Start" value={it.start} onChange={(v) => onChange(it.id, 'start', v)} editing={editingId === it.id} mono />
                  <Field label="End" value={it.end} onChange={(v) => onChange(it.id, 'end', v)} editing={editingId === it.id} mono />
                </div>
                <div className="pb-bullets">
                  <div className="pf-label">Detail</div>
                  {(it.details || []).map((d) => (
                    <div className="pb-bullet" key={d.id}>
                      <span className="pb-bdot" />
                      <div className="pb-bcontent">
                        <EditField value={d.text} editing={editingId === it.id} multiline
                          onChange={(v) => onChange(it.id, `bullet:${d.id}`, v)} />
                      </div>
                      {editingId === it.id && <button className="pb-bremove" title="Remove detail" onClick={() => onChange(it.id, `removeBullet:${d.id}`)}>✕</button>}
                    </div>
                  ))}
                  {editingId === it.id && <button className="pb-addbullet" onClick={() => onChange(it.id, 'addBullet')}>+ Add detail</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
