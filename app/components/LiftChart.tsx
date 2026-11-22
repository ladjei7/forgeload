'use client';
// One lift over time: a single orange line (no legend needed; the heading names it), recessive grid,
// end-dot with a surface ring, the latest value labelled. Tap, drag or use arrow keys to read any
// workout; the same numbers are always listed in the table under the chart.
import { useState } from 'react';
import { setLabel, type Point } from '../lib/progressStats';
import { show, type Unit } from '../lib/units';

const W = 320, H = 150, L = 12, R = 14, T = 14, B = 22;

export default function LiftChart({ points: raw, kind, name, unit = 'lb' }: { points: Point[]; kind: 'weight' | 'reps'; name: string; unit?: Unit }) {
  const [hover, setHover] = useState<number | null>(null);
  // Strength estimates are computed in pounds; shown in the person's unit.
  const points = kind === 'weight' ? raw.map(p => ({ ...p, value: show(p.value, unit) })) : raw;
  // Deload workouts are planned light weeks: shown as hollow, dimmed points off the line, so they
  // never read as a step back.
  const line = points.filter(p => !p.deload);
  if (line.length < 2) return <p className="text-sm text-fl-tx2">Log this exercise once more to see a trend.</p>;

  const vals = points.map(p => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(2, Math.round((hi - lo) * 0.15)); lo = Math.max(0, lo - pad); hi = hi + pad;
  const t0 = +points[0].date, t1 = +points[points.length - 1].date;
  const x = (p: Point) => L + (t1 === t0 ? 0.5 : (+p.date - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = line.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(line[line.length - 1]).toFixed(1)},${H - B} L${x(line[0]).toFixed(1)},${H - B} Z`;
  const ticks = [lo, (lo + hi) / 2, hi].map(v => Math.round(v));
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const last = points[points.length - 1];
  const i = hover ?? points.length - 1;
  const cur = points[i];

  function nearest(clientX: number, el: SVGSVGElement) {
    const r = el.getBoundingClientRect(); const px = ((clientX - r.left) / r.width) * W;
    let best = 0; points.forEach((p, k) => { if (Math.abs(x(p) - px) < Math.abs(x(points[best]) - px)) best = k; });
    setHover(best);
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm" aria-live="polite">
        <span className="font-semibold tabular-nums text-fl-tx">{setLabel(cur, unit)}{cur.record && <span className="ml-1.5 text-xs font-semibold text-fl-ok">New record</span>}{cur.deload && <span className="ml-1.5 text-xs font-semibold text-fl-tx2">Deload</span>}</span>
        <span className="text-xs tabular-nums text-fl-tx2">{fmt(cur.date)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full touch-none select-none outline-none" role="img" tabIndex={0}
        aria-label={`${name}: ${points.length} workouts${points.length > line.length ? ` (${points.length - line.length} deload)` : ''}, best set ${setLabel(points[0], unit)} on ${fmt(points[0].date)}, latest ${setLabel(last, unit)} on ${fmt(last.date)}. Use left and right arrow keys to read each workout.`}
        onPointerMove={e => nearest(e.clientX, e.currentTarget)} onPointerDown={e => nearest(e.clientX, e.currentTarget)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setHover(Math.max(0, i - 1)); }
          if (e.key === 'ArrowRight') { e.preventDefault(); setHover(Math.min(points.length - 1, i + 1)); }
        }}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--fl-line)" strokeWidth="1" />
            {/* No numbers on this axis: the line is a blend of weight and reps, so it has no unit to read. */}
          </g>
        ))}
        <text x={L} y={H - 6} fontSize="10" fill="var(--fl-tx2)">{fmt(points[0].date)}</text>
        <text x={W - R} y={H - 6} fontSize="10" fill="var(--fl-tx2)" textAnchor="end">{fmt(last.date)}</text>
        <path d={area} fill="var(--fl-acc)" opacity="0.1" />
        <path d={path} fill="none" stroke="var(--fl-acc)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.filter(p => p.deload).map(p => (
          <circle key={p.sessionId} cx={x(p)} cy={y(p.value)} r="3.5" fill="var(--fl-s1)" stroke="var(--fl-tx2)" strokeWidth="1.5" opacity="0.8" />
        ))}
        {hover !== null && <line x1={x(cur)} x2={x(cur)} y1={T} y2={H - B} stroke="var(--fl-tx2)" strokeWidth="1" />}
        <circle cx={x(cur)} cy={y(cur.value)} r="4.5" fill={cur.deload ? 'var(--fl-s1)' : 'var(--fl-acc)'} stroke={cur.deload ? 'var(--fl-tx2)' : 'var(--fl-s1)'} strokeWidth="2" />
      </svg>
    </div>
  );
}
