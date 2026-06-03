import React, { useState, useRef, useEffect } from 'react';

export type RingVariant = 'ring' | 'gauge' | 'bar';

export const scoreColor = (s: number) => (s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--gold)' : 'var(--red)');
export const scoreGrade = (s: number) => (s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F');

/* Score indicator — supports three ring styles via the `variant` prop. */
export const CircleScore: React.FC<{ score: number; size?: number; label?: string; variant?: RingVariant }> = ({
  score, size = 120, label, variant = 'ring',
}) => {
  const color = scoreColor(score);

  if (variant === 'bar') {
    return (
      <div className="cs-bar-wrap" style={{ width: size }}>
        <div className="cs-bar-top">
          <span className="cs-bar-num" style={{ color }}>{score}</span>
          {label && <span className="cs-bar-lbl">{label}</span>}
        </div>
        <div className="cs-bar-track">
          <div className="cs-bar-fill" style={{ width: `${score}%`, background: color }} />
        </div>
      </div>
    );
  }

  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const span = variant === 'gauge' ? 0.75 : 1; // gauge = 270° arc; ring = full circle
  const dash = circ * span;
  const offset = dash - (score / 100) * dash;
  const rot = variant === 'gauge' ? 135 : -90;

  return (
    <div className="circle-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transform: `rotate(${rot}deg)`, transformOrigin: 'center' }} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transform: `rotate(${rot}deg)`, transformOrigin: 'center', transition: 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div className="circle-inner">
        <span className="circle-num" style={{ color, fontSize: size * 0.22 }}>{score}</span>
        {label && <span className="circle-lbl">{label}</span>}
      </div>
    </div>
  );
};

/* Hover/focus tooltip — used to explain score meanings. */
export const Info: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="info-wrap" tabIndex={0}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      <span className="info-dot">i</span>
      {open && <span className="info-pop">{text}</span>}
    </span>
  );
};

/* Inline-editable field. Read-only until the row's Edit is clicked (controlled by `editing`). */
export const EditField: React.FC<{
  value: string;
  onChange?: (v: string) => void;
  editing: boolean;
  multiline?: boolean;
  placeholder?: string;
  mono?: boolean;
}> = ({ value, onChange, editing, multiline, placeholder, mono }) => {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  if (!editing) {
    return <span className={`ef-val ${mono ? 'mono' : ''} ${!value ? 'ef-empty' : ''}`}>{value || placeholder}</span>;
  }
  if (multiline) {
    return (
      <textarea ref={ref} className={`ef-input ${mono ? 'mono' : ''}`} value={value}
        placeholder={placeholder} rows={3} onChange={(e) => onChange?.(e.target.value)} />
    );
  }
  return (
    <input ref={ref} className={`ef-input ${mono ? 'mono' : ''}`} value={value}
      placeholder={placeholder} onChange={(e) => onChange?.(e.target.value)} />
  );
};
