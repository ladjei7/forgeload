'use client';
// One lift over time: a single orange line (no legend needed; the heading names it), recessive grid,
// end-dot with a surface ring, the latest value labelled. Tap, drag or use arrow keys to read any
// workout; the same numbers are always listed in the table under the chart.
import { useState } from 'react';
import type { Point } from '../lib/progressStats';

const W = 320, H = 150, L = 34, R = 14, T = 14, B = 22;

export default function LiftChart({ points, kind, name }: { points: Point[]; kind: 'weight' | 'reps'; name: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="text-sm text-fl-tx2">Log this exercise once more to see a trend.</p>;

  const vals = points.map(p => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(2, Math.round((hi - lo) * 0.15)); lo = Math.max(0, lo - pad); hi = hi + pad;
  const t0 = +points[0].date, t1 = +points[points.length - 1].date;
  const x = (p: Point) => L + (t1 === t0 ? 0.5 : (+p.date - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points[points.length - 1]).toFixed(1)},${H - B} L${x(points[0]).toFixed(1)},${H - B} Z`;
  const ticks = [lo, (lo + hi) / 2, hi].map(v => Math.round(v));
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const unit = kind === 'weight' ? '' : ' reps';
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
        <span className="font-semibold tabular-nums text-fl-tx">{cur.value}{unit}{cur.record && <span className="ml-1.5 text-xs font-semibold text-fl-ok">New record</span>}</span>
        <span className="text-xs tabular-nums text-fl-tx2">{fmt(cur.date)} · {cur.weight > 0 ? `${cur.weight} lb × ${cur.reps}` : `${cur.reps} reps`}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full touch-none select-none outline-none" role="img" tabIndex={0}
        aria-label={`${name}: ${points.length} workouts, from ${points[0].value}${unit} on ${fmt(points[0].date)} to ${last.value}${unit} on ${fmt(last.date)}. Use left and right arrow keys to read each workout.`}
        onPointerMove={e => nearest(e.clientX, e.currentTarget)} onPointerDown={e => nearest(e.clientX, e.currentTarget)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setHover(Math.max(0, i - 1)); }
          if (e.key === 'ArrowRight') { e.preventDefault(); setHover(Math.min(points.length - 1, i + 1)); }
        }}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--fl-line)" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--fl-tx2)" className="tabular-nums">{v}</text>
          </g>
        ))}
        <text x={L} y={H - 6} fontSize="10" fill="var(--fl-tx2)">{fmt(points[0].date)}</text>
        <text x={W - R} y={H - 6} fontSize="10" fill="var(--fl-tx2)" textAnchor="end">{fmt(last.date)}</text>
        <path d={area} fill="var(--fl-acc)" opacity="0.1" />
        <path d={path} fill="none" stroke="var(--fl-acc)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={x(cur)} x2={x(cur)} y1={T} y2={H - B} stroke="var(--fl-tx2)" strokeWidth="1" />}
        <circle cx={x(cur)} cy={y(cur.value)} r="4.5" fill="var(--fl-acc)" stroke="var(--fl-s1)" strokeWidth="2" />
      </svg>
    </div>
  );
}
