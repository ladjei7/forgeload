'use client';
import { useEffect, useRef } from 'react';

const P = (d: string) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
export const Icon = {
  home: P('M3 11l9-8 9 8M5 10v10h14V10'),
  plan: P('M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'),
  train: P('M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12'),
  progress: P('M3 17l6-6 4 4 8-9M15 6h6v6'),
  lib: P('M5 4h5v16H5zM14 4h5v16h-5z'),
  chev: P('M6 9l6 6 6-6'),
  chevR: P('M9 6l6 6-6 6'),
  up: P('M12 19V5M6 11l6-6 6 6'),
  down: P('M12 5v14M6 13l6 6 6-6'),
  swap: P('M7 7h12l-3-3M17 17H5l3 3'),
  star: P('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'),
  search: P('M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3'),
  user: P('M12 4a4 4 0 100 8 4 4 0 000-8zM4 21c1-4 4-6 8-6s7 2 8 6'),
  list: P('M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'),
  target: P('M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z'),
};

/**
 * Forgeload progression mark: an F whose top arm turns into an upward arrow.
 * Used sparingly: target gain, workout complete, onboarding, empty states. It does not replace the logo.
 */
export function FMark({ size = 20, title }: { size?: number; title?: string }) {
  return (
    <svg className="fl-fmark" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d="M6 21V5h6" />
      <path d="M6 13h6" />
      <path d="M13 12l7-7M14.5 5H20v5.5" />
    </svg>
  );
}

export function Sheet({ title, onClose, children, label }: { title: string; onClose: () => void; children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button,input,select')?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); prev?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <div className="fl-back" onClick={onClose} aria-hidden="true" />
      <div className="fl-sheet" role="dialog" aria-modal="true" aria-label={label ?? title} ref={ref}>
        <div className="grab" aria-hidden="true" />
        <div className="hd">
          <h2 className="fl-h2">{title}</h2>
          <button className="fl-x" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="bd">{children}</div>
      </div>
    </>
  );
}

export function Switch({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="fl-switch" onClick={() => onChange(!on)}>
      <i />
      <span>{children}</span>
    </button>
  );
}

export function Stepper({ label, value, onDec, onInc, wide }: { label: string; value: string; onDec: () => void; onInc: () => void; wide?: boolean }) {
  return (
    <div style={wide ? { flex: 1 } : undefined}>
      <span className="fl-lbl">{label}</span>
      <div className="fl-num">
        <button onClick={onDec} aria-label={`Decrease ${label}`}>&minus;</button>
        <span>{value}</span>
        <button onClick={onInc} aria-label={`Increase ${label}`}>+</button>
      </div>
    </div>
  );
}
