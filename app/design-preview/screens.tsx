'use client';
import { useEffect, useRef, useState } from 'react';
import { EQUIP, MUSCLES, estMinutes, fmtW, libOf, mmss, totalSets, type Day, type LibEx, type PlanEx } from './data';
import type { Ctx, Screen, SetLog, WEx } from './ctx';
import { FMark, Icon, Stepper, Switch } from './ui';
import type { Extra } from './Proto';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const ago = (d: number) => (d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`);
const rx = (e: { sets: number; min: number; max: number }) => `${e.sets} x ${e.min}-${e.max}`;

/* ---------- shared: save / sync status (words + shape, never color alone) ---------- */
export function SyncChip({ c, scope }: { c: Ctx; scope: 'workout' | 'plan' }) {
  const s = c.s;
  let kind = 'ok', label = 'Saved', action: (() => void) | null = null;
  if (scope === 'plan') {
    if (s.planSave === 'saving') { kind = 'saving'; label = 'Saving'; }
    else if (s.planSave === 'failed') { kind = 'failed'; label = 'Not saved. Retry'; action = c.retryPlanSave; }
    else if (s.planSave === 'offline') { kind = 'offline'; label = 'Offline. Saved on this device'; }
  } else {
    const sets = s.workout?.sets ?? [];
    const failed = sets.filter((x) => x.status === 'failed'); const queued = sets.filter((x) => x.status === 'queued'); const saving = sets.filter((x) => x.status === 'saving');
    if (failed.length) { kind = 'failed'; label = `${failed.length} unsaved. Retry`; action = () => failed.forEach((x) => c.retrySet(x.id)); }
    else if (queued.length) { kind = 'offline'; label = `Offline. ${queued.length} queued`; }
    else if (s.net === 'offline') { kind = 'offline'; label = 'Offline'; }
    else if (saving.length) { kind = 'saving'; label = 'Saving'; }
  }
  const inner = <><i aria-hidden="true" />{label}</>;
  return action
    ? <button className={`fl-sync ${kind}`} style={{ minHeight: 44 }} onClick={action}>{inner}</button>
    : <span className={`fl-sync ${kind}`} role="status">{inner}</span>;
}

/* ---------- Home ---------- */
export function Home({ c }: { c: Ctx }) {
  const { s } = c;
  const day = s.plan[s.nextDay];
  const w = s.workout;
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const full = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const doneCount = s.weekDone.filter(Boolean).length;
  const benchSessions = [...(s.hist.bench ?? [])].reverse();
  const tops = benchSessions.map((x) => Math.max(...x.sets.map((y) => y.w)));
  const spark = tops.length >= 2 ? tops.map((v, i) => { const mn = Math.min(...tops), mx = Math.max(...tops); return `${6 + (i * 108) / (tops.length - 1)},${28 - ((v - mn) / Math.max(1, mx - mn)) * 22}`; }).join(' ') : '';
  const lastAgoOf = (d: Day) => { const a = d.ex.flatMap((e) => (s.hist[e.exId]?.[0] ? [s.hist[e.exId][0].daysAgo] : [])); return a.length ? ago(Math.min(...a)) : 'not done yet'; };
  const firstT = day?.ex[0] ? c.targetOf(day.ex[0]) : null;
  const firstEx = day?.ex[0] ? libOf(c.lib, day.ex[0].exId) : null;
  const wFailed = w?.sets.filter((x) => x.status === 'failed' || x.status === 'queued').length ?? 0;
  return (
    <div className={`fl-scr${s.back ? ' back' : ''}`} key="home">
      <div className="fl-between">
        <div className="fl-row"><FMark size={22} /><span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em' }}>Forgeload</span></div>
        <button className="fl-btn sec" style={{ width: 44, minHeight: 44, padding: 0, borderRadius: 22 }} aria-label="Account and settings" onClick={() => c.open('account')}>{Icon.user}</button>
      </div>

      {w ? (
        <div className="fl-card fl-hl">
          <p className="fl-sub">Workout in progress</p>
          <h2 className="fl-h1" style={{ margin: '2px 0 4px' }}>{w.exs.length ? s.plan[w.dayIdx].name : ''}</h2>
          <p className="fl-sub">{w.sets.length} of {w.exs.reduce((a, e) => a + e.sets + e.extra, 0)} sets logged · started {mmss(Math.floor((c.now - w.startedAt) / 1000))} ago</p>
          {wFailed > 0 && <div className="fl-banner bad" style={{ marginTop: 12 }}><span>{plural(wFailed, 'set')} did not save. Your values are still here.</span></div>}
          <button className="fl-btn pri big" style={{ marginTop: 14 }} onClick={() => c.startWorkout(w.dayIdx)}>Resume workout</button>
          <button className="fl-btn ghost" style={{ width: '100%', marginTop: 4 }} onClick={() => c.finish()}>Finish or discard</button>
        </div>
      ) : day ? (
        <div className="fl-card">
          <p className="fl-sub">Up next · workout {s.nextDay + 1} of {s.plan.length}</p>
          <h2 className="fl-h1" style={{ margin: '2px 0 2px' }}>{day.name}</h2>
          <p className="fl-sub">{plural(day.ex.length, 'exercise')} · {plural(totalSets(day.ex), 'set')} · about {estMinutes(day.ex)} min · last done {lastAgoOf(day)}</p>
          {firstT && firstEx && (
            <div className="fl-target" style={{ marginTop: 14 }}>
              <p className="fl-sub">First lift, today&apos;s target</p>
              <p style={{ fontSize: 15, margin: '2px 0' }}>{firstEx.name}</p>
              <p className="big" style={{ fontSize: 30, fontWeight: 600, color: 'var(--acc)', letterSpacing: '-.03em' }}>
                {firstEx.kind === 'bodyweight' ? `${firstT.r} reps` : `${fmtW(firstT.w)} x ${firstT.r}`}
              </p>
              <p className="fl-sub" style={{ marginTop: 2 }}>{firstT.headline}</p>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            {day.ex.slice(1, 4).map((e) => { const ex = libOf(c.lib, e.exId); const t = c.targetOf(e); return (
              <div key={e.id} className="fl-between" style={{ padding: '9px 0', borderTop: '1px solid var(--line)' }}>
                <span>{ex.name}</span><span className="fl-sub">{ex.kind === 'bodyweight' ? `${t.r} reps` : `${fmtW(t.w)} x ${t.r}`}</span>
              </div>); })}
            {day.ex.length > 4 && <p className="fl-sub" style={{ padding: '9px 0', borderTop: '1px solid var(--line)' }}>+ {day.ex.length - 4} more</p>}
          </div>
          <button className="fl-btn pri big" style={{ marginTop: 12 }} onClick={() => c.startWorkout(s.nextDay)}>Start workout</button>
          <button className="fl-btn ghost" style={{ width: '100%', marginTop: 4 }} onClick={() => c.open('days')}>Choose a different workout</button>
        </div>
      ) : (
        <div className="fl-card" style={{ textAlign: 'center', padding: 28 }}>
          <FMark size={36} /><h2 className="fl-h2" style={{ margin: '10px 0 6px' }}>No plan yet</h2>
          <button className="fl-btn pri" onClick={() => c.go('onboard')}>Set up my plan</button>
        </div>
      )}

      <div className="fl-grid2">
        <div className="fl-card" style={{ padding: 14 }}>
          <p className="fl-sub" style={{ marginBottom: 10 }}>This week</p>
          <div className="fl-row" style={{ gap: 5, marginBottom: 8 }}>
            {s.weekDone.map((d, i) => (
              <span key={i} role="img" aria-label={`${full[i]}: ${d ? 'workout done' : i === s.today ? 'today' : 'rest'}`}
                style={{ width: 16, height: 16, borderRadius: 4, background: d ? 'var(--ok)' : 'transparent', border: d ? 0 : `1.5px solid ${i === s.today ? 'var(--acc)' : 'var(--field)'}` }}>
                <span className="fl-sr">{days[i]}</span>
              </span>
            ))}
          </div>
          <p>{doneCount} of {s.plan.length} workouts</p>
        </div>
        <div className="fl-card" style={{ padding: 14 }}>
          <p className="fl-sub">Bench press</p>
          {spark ? (
            <>
              <svg className="fl-spark" viewBox="0 0 120 34" preserveAspectRatio="none" role="img" aria-label={`Bench press top set across ${tops.length} sessions: ${tops.join(', ')} pounds`}>
                <polyline points={spark} fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              <p>{fmtW(tops[tops.length - 1])} lb <span className="fl-ok" style={{ fontSize: 13 }}>{tops[tops.length - 1] - tops[0] >= 0 ? '+' : ''}{fmtW(tops[tops.length - 1] - tops[0])} in {tops.length} sessions</span></p>
            </>
          ) : <p className="fl-sub" style={{ marginTop: 8 }}>Your first sessions will chart here.</p>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Active workout ---------- */
function TargetBlock({ c, we }: { c: Ctx; we: WEx }) {
  const w = c.s.workout!; const ex = libOf(c.lib, we.exId); const t = c.targetOf(we); const o = w.ovr[we.id];
  const tw = o ? o.w : t.w; const tr = o ? o.r : t.r; const bw = ex.kind === 'bodyweight';
  return (
    <div>
      <div className="fl-target">
        <div className="fl-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="fl-sub">{o ? 'Your target' : 'Target'}</span>
          {!o && t.kind === 'up' && <span className="fl-chip" style={{ color: 'var(--acc)' }}><FMark size={14} />+{fmtW(t.delta ?? 0)} lb</span>}
          {!o && t.kind === 'first' && <span className="fl-chip">Suggested</span>}
          {o && <span className="fl-chip">Changed</span>}
        </div>
        <p className="big">{bw ? <>{tr}<small>reps</small></> : <>{fmtW(tw)}<small>x</small>{tr}</>}</p>
        <p className="fl-last" style={{ marginTop: 4 }}>Last time: <b style={{ color: 'var(--tx)', fontWeight: 500 }}>{t.lastLine}</b></p>
        {o && <p className="fl-last">Recommended was {bw ? `${t.r} reps` : `${fmtW(t.w)} x ${t.r}`}</p>}
      </div>
      <p style={{ fontSize: 14, margin: '10px 0 8px' }}>{o ? 'You changed the recommendation. Your logged sets will be used for next time.' : t.headline}</p>
      <details className="fl-why">
        <summary><span>Why this target</span><span className="chev" style={{ transition: 'transform .15s' }}>{Icon.chev}</span></summary>
        <div className="body">
          {t.detail.map((l, i) => <p key={i}>{l}</p>)}
          <div className="fl-row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <button className="fl-btn sm sec" onClick={() => c.open('override', { a: we.id })}>Change target</button>
            {o && <button className="fl-btn sm ghost" onClick={() => { const nw = { ...w, ovr: { ...w.ovr } }; delete nw.ovr[we.id]; nw.draft = { ...w.draft, [we.id]: { w: fmtW(t.w), r: String(t.r) } }; c.set({ workout: nw }); }}>Use recommended</button>}
          </div>
        </div>
      </details>
    </div>
  );
}

function ListSets({ c, we }: { c: Ctx; we: WEx }) {
  const w = c.s.workout!; const ex = libOf(c.lib, we.exId); const bw = ex.kind === 'bodyweight';
  const logs = w.sets.filter((x) => x.peId === we.id); const count = we.sets + we.extra; const cur = logs.length + 1;
  const prev = c.s.hist[we.exId]?.[0]?.sets ?? []; const d = w.draft[we.id]; const o = w.ovr[we.id]; const t = c.targetOf(we);
  const tw = o ? o.w : t.w; const tr = o ? o.r : t.r;
  const valid = parseInt(d.r, 10) >= 1 && (bw || parseFloat(d.w) > 0);
  const cols = bw ? 'fl-set bw' : 'fl-set';
  const curRef = useRef<HTMLDivElement>(null);
  useEffect(() => { curRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [logs.length, we.id]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className={`${cols} head`}><div>Set</div><div>Last</div>{!bw && <div>Weight lb</div>}<div>Reps</div><div /></div>
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
        const log = logs.find((x) => x.n === n); const p = prev[n - 1];
        const pv = p ? (bw ? `${p.r}` : `${fmtW(p.w)}x${p.r}`) : '-';
        if (log) return <LoggedRow key={n} c={c} log={log} pv={pv} bw={bw} cols={cols} />;
        if (n === cur) return (
          <div key={n} className={cols} ref={curRef}>
            <div className="fl-badge cur" role="img" aria-label={`Set ${n}, current`}>{n}</div>
            <div className="fl-prev">{pv}</div>
            {!bw && <input className="fl-field cur" inputMode="decimal" enterKeyHint="next" aria-label={`Set ${n} weight in pounds`} value={d.w} onFocus={(e) => e.target.select()} onChange={(e) => c.editDraft(we.id, { w: e.target.value.replace(/[^0-9.]/g, '') })} />}
            <input className="fl-field cur" inputMode="numeric" enterKeyHint="done" aria-label={`Set ${n} reps`} value={d.r} onFocus={(e) => e.target.select()} onChange={(e) => c.editDraft(we.id, { r: e.target.value.replace(/[^0-9]/g, '') })}
              onKeyDown={(e) => { if (e.key === 'Enter' && valid) c.logSet(we.id); }} />
            <button className="fl-log" disabled={!valid} onClick={() => c.logSet(we.id)} aria-label={`Log set ${n}: ${bw ? '' : fmtW(parseFloat(d.w) || 0) + ' pounds, '}${d.r} reps`}>Log</button>
          </div>
        );
        return (
          <div key={n} className={cols} style={{ opacity: 0.75 }}>
            <div className="fl-badge" role="img" aria-label={`Set ${n}, planned`}>{n}</div>
            <div className="fl-prev">{pv}</div>
            {!bw && <div className="fl-prev" style={{ fontSize: 16 }}>{fmtW(tw)}</div>}
            <div className="fl-prev" style={{ fontSize: 16 }}>{tr}</div><div />
          </div>
        );
      })}
      <button className="fl-btn ghost" style={{ borderStyle: 'dashed', borderColor: 'var(--field)', borderWidth: 1 }} onClick={() => c.set({ workout: { ...w, exs: w.exs.map((e) => (e.id === we.id ? { ...e, extra: e.extra + 1 } : e)) } })}>+ Add set</button>
    </div>
  );
}

function LoggedRow({ c, log, pv, bw, cols }: { c: Ctx; log: SetLog; pv: string; bw: boolean; cols: string }) {
  const msg = log.status === 'failed' ? 'Not saved' : log.status === 'queued' ? 'Waiting for connection' : log.status === 'saving' ? 'Saving' : '';
  return (
    <div className={cols}>
      <div className={`fl-badge ${log.status}`} role="img" aria-label={`Set ${log.n} ${log.status === 'saved' ? 'saved' : log.status === 'saving' ? 'saving' : log.status === 'queued' ? 'queued' : 'not saved'}`}>{log.n}</div>
      <div className="fl-prev">{pv}</div>
      <div style={{ gridColumn: bw ? 'span 1' : 'span 2' }}>
        <div style={{ fontSize: 20, fontWeight: 600, textAlign: 'center' }}>{bw ? `${log.r} reps` : <>{fmtW(log.w)} <span className="fl-mut" style={{ fontWeight: 400 }}>x</span> {log.r}</>}</div>
        {msg && <div className={`fl-state ${log.status === 'failed' ? 'fl-bad' : 'fl-mut'}`} style={{ textAlign: 'center' }}>{msg}</div>}
      </div>
      {log.status === 'failed'
        ? <button className="fl-log rt" onClick={() => c.retrySet(log.id)}>Retry</button>
        : <button className="fl-log ed" disabled={log.status !== 'saved'} onClick={() => c.open('editset', { a: log.id })} aria-label={`Edit set ${log.n}`}>{log.status === 'saved' ? 'Edit' : log.status === 'queued' ? 'Queued' : '...'}</button>}
    </div>
  );
}

function FocusEntry({ c, we }: { c: Ctx; we: WEx }) {
  const w = c.s.workout!; const ex = libOf(c.lib, we.exId); const bw = ex.kind === 'bodyweight';
  const logs = w.sets.filter((x) => x.peId === we.id); const count = we.sets + we.extra; const n = logs.length + 1;
  const d = w.draft[we.id]; const p = c.s.hist[we.exId]?.[0]?.sets[n - 1];
  const valid = parseInt(d.r, 10) >= 1 && (bw || parseFloat(d.w) > 0);
  const step = ex.inc || 5;
  return (
    <div className="fl-entry">
      <div className="fl-rail" aria-label="Sets">
        {Array.from({ length: count }, (_, i) => i + 1).map((k) => {
          const l = logs.find((x) => x.n === k); const cls = l ? l.status : k === n ? 'cur' : '';
          return (
            <span key={k} className="fl-row" style={{ gap: 6, flex: k < count ? 1 : 'none' }}>
              {l ? <button className={`fl-dot ${cls}`} style={{ background: l.status === 'saved' ? undefined : 'transparent', minWidth: 44, minHeight: 44, width: 44, height: 44 }} aria-label={`Set ${k}, ${l.status === 'saved' ? 'saved' : l.status}. ${l.status === 'failed' ? 'Retry' : 'Edit'}`} onClick={() => (l.status === 'failed' ? c.retrySet(l.id) : c.open('editset', { a: l.id }))}>{k}</button>
                : <span className={`fl-dot ${cls}`} role="img" aria-label={`Set ${k}${k === n ? ', current' : ', planned'}`}>{k}</span>}
              {k < count && <span className={`ln${l?.status === 'saved' ? ' ok' : ''}`} />}
            </span>
          );
        })}
      </div>
      {n > count ? (
        <div className="fl-between"><span className="fl-row" style={{ gap: 6 }}><FMark size={18} /><b>All sets logged</b></span><button className="fl-btn sm sec" onClick={() => c.set({ workout: { ...w, exs: w.exs.map((e) => (e.id === we.id ? { ...e, extra: e.extra + 1 } : e)) } })}>+ Add set</button></div>
      ) : (
        <>
          <div className="fl-between"><b>Set {n} of {count}</b><span className="fl-last">{p ? `Last time: ${bw ? `${p.r} reps` : `${fmtW(p.w)} x ${p.r}`}` : 'No set to compare'}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: bw ? '1fr' : '1fr 1fr', gap: 8 }}>
            {!bw && (
              <div><span className="fl-lbl">Weight lb</span>
                <div className="fl-step cmp"><button aria-label="Decrease weight" onClick={() => c.stepDraft(we.id, 'w', -1, step)}>&minus;</button>
                  <input className="v" inputMode="decimal" aria-label="Weight in pounds" value={d.w} onFocus={(e) => e.target.select()} onChange={(e) => c.editDraft(we.id, { w: e.target.value.replace(/[^0-9.]/g, '') })} />
                  <button aria-label="Increase weight" onClick={() => c.stepDraft(we.id, 'w', 1, step)}>+</button></div></div>
            )}
            <div><span className="fl-lbl">Reps</span>
              <div className="fl-step cmp"><button aria-label="Decrease reps" onClick={() => c.stepDraft(we.id, 'r', -1, 1)}>&minus;</button>
                <input className="v" inputMode="numeric" aria-label="Reps" value={d.r} onFocus={(e) => e.target.select()} onChange={(e) => c.editDraft(we.id, { r: e.target.value.replace(/[^0-9]/g, '') })} />
                <button aria-label="Increase reps" onClick={() => c.stepDraft(we.id, 'r', 1, 1)}>+</button></div></div>
          </div>
          <button className="fl-btn pri big" disabled={!valid} onClick={() => c.logSet(we.id)}>Log set {n}{valid ? `: ${bw ? '' : fmtW(parseFloat(d.w)) + ' x '}${d.r}` : ''}</button>
        </>
      )}
    </div>
  );
}

export function Workout({ c }: { c: Ctx }) {
  const { s } = c; const w = s.workout;
  if (!w) return <div className="fl-scr"><div className="fl-card" style={{ textAlign: 'center' }}><FMark size={30} /><p className="fl-h2" style={{ margin: '8px 0' }}>No workout in progress</p><button className="fl-btn pri" onClick={() => c.go('home')}>Back to Home</button></div></div>;
  const we = w.exs[w.idx]; const ex = libOf(c.lib, we.exId);
  const planned = w.exs.reduce((a, e) => a + e.sets + e.extra, 0);
  const logsFor = w.sets.filter((x) => x.peId === we.id).length;
  const exDone = logsFor >= we.sets + we.extra;
  const last = w.idx === w.exs.length - 1;
  const rem = w.restEnd ? Math.ceil((w.restEnd - c.now) / 1000) : null;
  return (
    <>
      <div style={{ padding: '14px 16px 0', paddingRight: 16 }}>
        <div className="fl-between">
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 16, fontWeight: 600 }}>{s.plan[w.dayIdx].name}</div><div className="fl-sub" style={{ whiteSpace: 'nowrap' }}>{mmss(Math.floor((c.now - w.startedAt) / 1000))} · {w.sets.length} of {planned} sets</div></div>
          <div className="fl-row"><SyncChip c={c} scope="workout" /><button className="fl-btn sm" onClick={() => c.finish()}>Finish</button></div>
        </div>
        <div className="fl-seg" style={{ marginTop: 10 }} role="img" aria-label={`Exercise ${w.idx + 1} of ${w.exs.length}`}>
          {w.exs.map((e, i) => <i key={e.id} className={w.sets.filter((x) => x.peId === e.id).length >= e.sets + e.extra ? 'd' : i === w.idx ? 'c' : ''} />)}
        </div>
      </div>
      <div className="fl-scr" key={`${we.id}-${w.idx}`} style={{ paddingTop: 12 }}>
        <div className="fl-between">
          <div style={{ minWidth: 0 }}><p className="fl-sub">Exercise {w.idx + 1} of {w.exs.length} · {ex.muscle}</p><h1 className="fl-h1" style={{ fontSize: 26 }}>{ex.name}</h1></div>
        </div>
        <div className="fl-row" style={{ flexWrap: 'wrap' }}>
          <div className="fl-row" style={{ gap: 4 }} role="group" aria-label="Logger layout">
            <button className="fl-pill" aria-pressed={s.mode === 'list'} onClick={() => c.set({ mode: 'list' })}>List</button>
            <button className="fl-pill" aria-pressed={s.mode === 'focus'} onClick={() => c.set({ mode: 'focus' })}>Focus</button>
          </div>
          <button className="fl-btn sm sec" onClick={() => c.open('swap', { a: we.id })}>{Icon.swap}Swap</button>
        </div>
        <TargetBlock c={c} we={we} />
        {s.mode === 'list' && <ListSets c={c} we={we} />}
      </div>
      <div className="fl-dock">
        {s.mode === 'focus' && <FocusEntry c={c} we={we} />}
        {rem !== null && (
          <div>
            <div className="fl-restrow">
              <div className="fl-row" style={{ gap: 8 }}><span className="fl-sub">{rem > 0 ? 'Rest' : 'Rest over'}</span><span className="t" style={{ color: rem > 0 ? 'var(--tx)' : 'var(--acc)' }}>{rem > 0 ? mmss(rem) : 'Go'}</span></div>
              <div className="fl-row" style={{ gap: 6 }}>
                <button className="fl-btn sm sec" style={{ minWidth: 52 }} onClick={() => c.set({ workout: { ...w, restEnd: (w.restEnd ?? Date.now()) - 15000 } })} aria-label="Subtract 15 seconds">-15s</button>
                <button className="fl-btn sm sec" style={{ minWidth: 52 }} onClick={() => c.set({ workout: { ...w, restEnd: (w.restEnd ?? Date.now()) + 15000 } })} aria-label="Add 15 seconds">+15s</button>
                <button className="fl-btn sm" onClick={() => c.set({ workout: { ...w, restEnd: null } })}>{rem > 0 ? 'Skip' : 'Done'}</button>
              </div>
            </div>
            {rem > 0 && <div className="fl-bar" style={{ marginTop: 4 }}><i style={{ width: `${Math.min(100, Math.max(0, 100 - (rem / Math.max(1, w.restLen)) * 100))}%` }} /></div>}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 10 }}>
          <button className="fl-btn" style={{ minHeight: 52, padding: 0 }} aria-label="All exercises" onClick={() => c.open('exlist')}>{Icon.list}</button>
          {last
            ? <button className={`fl-btn big ${exDone ? 'pri' : 'sec'}`} style={{ minHeight: 52 }} onClick={() => c.finish()}>Finish workout</button>
            : <button className={`fl-btn big ${exDone ? 'pri' : 'sec'}`} style={{ minHeight: 52 }} onClick={() => c.set({ workout: { ...w, idx: w.idx + 1 } })}>Next: {libOf(c.lib, w.exs[w.idx + 1].exId).name}</button>}
        </div>
      </div>
    </>
  );
}

/* ---------- Plan editor ---------- */
export function PlanScreen({ c }: { c: Ctx }) {
  const { s } = c; const day = s.plan[s.selDay] ?? s.plan[0];
  const removed = useRef<{ dayId: string; i: number; e: PlanEx } | null>(null);
  useEffect(() => {
    const h = () => { const r = removed.current; if (!r) return; c.mutatePlan((d) => d.map((x) => (x.id === r.dayId ? { ...x, ex: [...x.ex.slice(0, r.i), r.e, ...x.ex.slice(r.i)] } : x))); removed.current = null; };
    document.addEventListener('fl-undo', h); return () => document.removeEventListener('fl-undo', h);
  });
  if (!day) return <div className="fl-scr"><div className="fl-card" style={{ textAlign: 'center' }}><FMark size={30} /><p className="fl-h2" style={{ margin: '8px 0' }}>No plan yet</p><button className="fl-btn pri" onClick={() => c.go('onboard')}>Set up my plan</button></div></div>;
  const upd = (id: string, p: Partial<PlanEx>) => c.mutatePlan((d) => d.map((x) => (x.id === day.id ? { ...x, ex: x.ex.map((e) => (e.id === id ? { ...e, ...p } : e)) } : x)));
  const moveEx = (i: number, dir: number) => c.mutatePlan((d) => d.map((x) => { if (x.id !== day.id) return x; const a = [...x.ex]; const j = i + dir; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, ex: a }; }));
  const moveDay = (dir: number) => {
    const ids = s.plan.map((d) => d.id); const nextId = ids[s.nextDay]; const lastId = s.lastDay !== null ? ids[s.lastDay] : null;
    const a = [...s.plan]; const i = s.selDay; const j = i + dir; if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    c.mutatePlan(() => a); c.set({ selDay: j, nextDay: a.findIndex((d) => d.id === nextId), lastDay: lastId ? a.findIndex((d) => d.id === lastId) : null });
  };
  const addDay = () => { const id = `d${Date.now()}`; c.mutatePlan((d) => [...d, { id, name: `Workout ${String.fromCharCode(65 + d.length)}`, ex: [] }]); c.set({ selDay: s.plan.length }); };
  return (
    <div className={`fl-scr${s.back ? ' back' : ''}`} key="plan">
      <div className="fl-between"><h1 className="fl-h1">Plan</h1><SyncChip c={c} scope="plan" /></div>
      <div className="fl-card">
        <div className="fl-between"><b style={{ fontSize: 16 }}>Rotation</b><span className="fl-sub">{plural(s.plan.length, 'workout')}, in order</span></div>
        <div className="fl-scroll-x" style={{ marginTop: 10 }}>
          {s.plan.map((d, i) => (
            <button key={d.id} className="fl-pill" aria-pressed={i === s.selDay} onClick={() => c.set({ selDay: i, exp: null })} style={{ minHeight: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
              <span>{d.name}</span><span style={{ fontSize: 11, opacity: 0.85 }}>{i === s.nextDay ? 'Next' : i === s.lastDay ? 'Last done' : `${i + 1}`}</span>
            </button>
          ))}
          <button className="fl-pill" style={{ minHeight: 52, borderStyle: 'dashed' }} onClick={addDay} aria-label="Add workout">+ Add</button>
        </div>
        <p className="fl-sub" style={{ marginTop: 10 }}>Next is always the workout after your last one. Missed a day? Nothing is skipped. You can make any workout next.</p>
        <div className="fl-row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <button className="fl-btn sm sec" disabled={s.selDay === s.nextDay} onClick={() => { c.set({ nextDay: s.selDay }); c.toast(`${day.name} is now next`); }}>Make next</button>
          <button className="fl-btn sm sec" disabled={s.selDay === 0} onClick={() => moveDay(-1)}>Move earlier</button>
          <button className="fl-btn sm sec" disabled={s.selDay === s.plan.length - 1} onClick={() => moveDay(1)}>Move later</button>
        </div>
      </div>

      <div>
        <span className="fl-lbl">Workout name</span>
        <input className="fl-search" value={day.name} enterKeyHint="done" onChange={(e) => c.mutatePlan((d) => d.map((x) => (x.id === day.id ? { ...x, name: e.target.value } : x)))} aria-label="Workout name" />
        <p className="fl-sub" style={{ marginTop: 6 }}>{plural(day.ex.length, 'exercise')} · {plural(totalSets(day.ex), 'set')} · about {day.ex.length ? estMinutes(day.ex) : 0} min</p>
      </div>

      {day.ex.length === 0 && <div className="fl-card" style={{ textAlign: 'center' }}><FMark size={28} /><p style={{ margin: '8px 0 10px' }}>No exercises in this workout yet.</p></div>}
      {day.ex.map((e, i) => {
        const ex = libOf(c.lib, e.exId); const open = s.exp === e.id;
        return (
          <div key={e.id} className="fl-card pad0" style={open ? { borderColor: 'var(--acc)' } : undefined}>
            <button className="fl-li" style={{ border: 0, borderRadius: 0, background: 'transparent' }} aria-expanded={open} onClick={() => c.set({ exp: open ? null : e.id })}>
              <span><span className="t" style={{ display: 'block' }}>{ex.name}</span><span className="s">{rx(e)} · rest {mmss(e.rest)}{e.rir ? ' · RIR on' : ''}</span></span>
              <span className="fl-row" style={{ gap: 4, color: open ? 'var(--acc)' : 'var(--tx2)', fontSize: 13 }}>{open ? 'Close' : 'Edit'}<span style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s', display: 'flex' }}>{Icon.chev}</span></span>
            </button>
            {open && (
              <div style={{ padding: '4px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="fl-steps3">
                  <Stepper wide label="Sets" value={String(e.sets)} onDec={() => upd(e.id, { sets: Math.max(1, e.sets - 1) })} onInc={() => upd(e.id, { sets: Math.min(8, e.sets + 1) })} />
                  <Stepper wide label="Rest" value={mmss(e.rest)} onDec={() => upd(e.id, { rest: Math.max(30, e.rest - 15) })} onInc={() => upd(e.id, { rest: Math.min(300, e.rest + 15) })} />
                  <Stepper wide label="Min reps" value={String(e.min)} onDec={() => upd(e.id, { min: Math.max(1, e.min - 1) })} onInc={() => upd(e.id, { min: Math.min(e.max, e.min + 1) })} />
                  <Stepper wide label="Max reps" value={String(e.max)} onDec={() => upd(e.id, { max: Math.max(e.min, e.max - 1) })} onInc={() => upd(e.id, { max: Math.min(30, e.max + 1) })} />
                </div>
                <Switch on={e.rir} onChange={(v) => upd(e.id, { rir: v })}>Ask for reps in reserve (RIR)</Switch>
                <div className="fl-row" style={{ flexWrap: 'wrap' }}>
                  <button className="fl-btn sm sec" disabled={i === 0} onClick={() => moveEx(i, -1)} aria-label={`Move ${ex.name} up`}>{Icon.up}Up</button>
                  <button className="fl-btn sm sec" disabled={i === day.ex.length - 1} onClick={() => moveEx(i, 1)} aria-label={`Move ${ex.name} down`}>{Icon.down}Down</button>
                  <button className="fl-btn sm sec" onClick={() => c.open('swapplan', { a: e.id })}>{Icon.swap}Replace</button>
                  <button className="fl-btn sm bad" onClick={() => { removed.current = { dayId: day.id, i, e }; c.mutatePlan((d) => d.map((x) => (x.id === day.id ? { ...x, ex: x.ex.filter((y) => y.id !== e.id) } : x))); c.set({ exp: null }); c.toast(`Removed ${ex.name}`, true); }}>Remove</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button className="fl-btn" style={{ borderStyle: 'dashed', minHeight: 52 }} onClick={() => c.open('addplan')}>+ Add exercise</button>
    </div>
  );
}

/* ---------- Progress ---------- */
export function Progress({ c }: { c: Ctx }) {
  const ids = Array.from(new Set(c.s.plan.flatMap((d) => d.ex.map((e) => e.exId)))).filter((id) => c.s.hist[id]?.length);
  const [sel, setSel] = useState<string>(ids.includes('bench') ? 'bench' : ids[0] ?? '');
  const ex = sel ? libOf(c.lib, sel) : null; const sess = sel ? [...(c.s.hist[sel] ?? [])].reverse() : [];
  const val = (x: { sets: { w: number; r: number }[] }) => (ex?.kind === 'bodyweight' ? Math.max(...x.sets.map((y) => y.r)) : Math.max(...x.sets.map((y) => y.w)));
  const vals = sess.map(val); const mn = Math.min(...vals), mx = Math.max(...vals, mn + 1);
  const pts = vals.map((v, i) => `${24 + (i * 280) / Math.max(1, vals.length - 1)},${120 - ((v - mn) / (mx - mn)) * 90}`);
  return (
    <div className={`fl-scr${c.s.back ? ' back' : ''}`} key="progress">
      <h1 className="fl-h1">Progress</h1>
      {ids.length === 0 ? (
        <div className="fl-card" style={{ textAlign: 'center', padding: 28 }}><FMark size={36} /><p className="fl-h2" style={{ margin: '10px 0 4px' }}>Nothing to chart yet</p><p className="fl-sub">Log your first workout and your lifts will show up here.</p></div>
      ) : (
        <>
          <div className="fl-scroll-x">{ids.map((id) => <button key={id} className="fl-pill" aria-pressed={id === sel} onClick={() => setSel(id)}>{libOf(c.lib, id).name}</button>)}</div>
          {ex && (
            <div className="fl-card">
              <div className="fl-between"><b>{ex.name}</b><span className="fl-sub">{ex.kind === 'bodyweight' ? 'Best set, reps' : 'Top set, lb'}</span></div>
              <p className="fl-kpi" style={{ marginTop: 4 }}>{vals[vals.length - 1]}{ex.kind === 'bodyweight' ? ' reps' : ' lb'} {vals.length > 1 && <span className="fl-ok" style={{ fontSize: 15, fontWeight: 500 }}>{vals[vals.length - 1] - vals[0] >= 0 ? '+' : ''}{fmtW(vals[vals.length - 1] - vals[0])} over {plural(vals.length, 'session')}</span>}</p>
              {vals.length > 1 ? (
                <svg viewBox="0 0 320 140" width="100%" height="140" role="img" aria-label={`${ex.name}: ${vals.join(', ')}`}>
                  {[30, 75, 120].map((y) => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="var(--line)" />)}
                  <polyline points={pts.join(' ')} fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinejoin="round" />
                  {pts.map((p, i) => { const [x, y] = p.split(','); const last = i === pts.length - 1; return <circle key={i} cx={x} cy={y} r={last ? 6 : 3.5} fill={last ? 'var(--bg)' : 'var(--ok)'} stroke={last ? 'var(--acc)' : 'none'} strokeWidth="2.5" />; })}
                </svg>
              ) : <p className="fl-sub" style={{ margin: '10px 0' }}>One session so far. A trend line appears after the next one.</p>}
            </div>
          )}
          <div className="fl-card pad0">
            {[...sess].reverse().map((x, i) => (
              <div key={i} className="fl-between" style={{ padding: '12px 14px', borderTop: i ? '1px solid var(--line)' : 0 }}>
                <span>{ago(x.daysAgo)}</span><span className="fl-mut">{ex?.kind === 'bodyweight' ? x.sets.map((y) => y.r).join(', ') + ' reps' : x.sets.map((y) => `${fmtW(y.w)}x${y.r}`).join(', ')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Library (browse + picker) ---------- */
export function LibraryView({ c, onPick }: { c: Ctx; onPick?: (e: LibEx) => void }) {
  const [q, setQ] = useState(''); const [tab, setTab] = useState('all'); const [mu, setMu] = useState(''); const [eq, setEq] = useState('');
  const { s } = c;
  let list = c.lib.filter((e) => (!q || e.name.toLowerCase().includes(q.toLowerCase())) && (!mu || e.muscle === mu) && (!eq || e.equip === eq));
  if (tab === 'fav') list = list.filter((e) => s.fav.includes(e.id));
  if (tab === 'recent') list = s.recent.map((id) => list.find((e) => e.id === id)).filter(Boolean) as LibEx[];
  if (tab === 'mine') list = list.filter((e) => e.custom);
  const tabs: [string, string][] = [['all', 'All'], ['fav', 'Favorites'], ['recent', 'Recent'], ['mine', 'Mine']];
  return (
    <>
      <div style={{ position: 'relative' }}>
        <label className="fl-sr" htmlFor="libq">Search exercises</label>
        <input id="libq" className="fl-search" type="search" enterKeyHint="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="fl-scroll-x">{tabs.map(([id, l]) => <button key={id} className="fl-pill" aria-pressed={tab === id} onClick={() => setTab(id)}>{l}</button>)}</div>
      <div className="fl-row">
        <select className="fl-sel" aria-label="Muscle" value={mu} onChange={(e) => setMu(e.target.value)}><option value="">All muscles</option>{MUSCLES.map((m) => <option key={m}>{m}</option>)}</select>
        <select className="fl-sel" aria-label="Equipment" value={eq} onChange={(e) => setEq(e.target.value)}><option value="">All equipment</option>{EQUIP.map((m) => <option key={m}>{m}</option>)}</select>
      </div>
      {list.length === 0 && (
        <div className="fl-card" style={{ textAlign: 'center' }}>
          <FMark size={30} />
          <p style={{ margin: '8px 0 10px' }}>{tab === 'mine' ? 'You have not made any exercises yet.' : tab === 'fav' ? 'Star an exercise to keep it here.' : tab === 'recent' ? 'Exercises you log will show up here.' : q ? `No exercise called "${q}".` : 'No exercises match these filters.'}</p>
          {(q || tab === 'mine') && <button className="fl-btn pri" onClick={() => c.open('create', { a: q })}>Create {q ? `"${q}"` : 'an exercise'}</button>}
        </div>
      )}
      {list.map((e) => (
        <div key={e.id} className="fl-row" style={{ gap: 6 }}>
          <button className="fl-li" onClick={() => (onPick ? onPick(e) : c.open('detail', { a: e.id }))}>
            <span className="fl-row"><span className="fl-thumb" aria-hidden="true">{e.muscle.slice(0, 2)}</span><span><span className="t" style={{ display: 'block' }}>{e.name}</span><span className="s">{e.muscle} · {e.equip}{e.custom ? ' · Mine' : ''}</span></span></span>
            {Icon.chevR}
          </button>
          <button className="fl-btn ghost" style={{ flex: 'none', width: 44, minHeight: 56, padding: 0, color: s.fav.includes(e.id) ? 'var(--acc)' : 'var(--tx2)' }} aria-pressed={s.fav.includes(e.id)} aria-label={`Favorite ${e.name}`}
            onClick={() => c.set({ fav: s.fav.includes(e.id) ? s.fav.filter((x) => x !== e.id) : [...s.fav, e.id] })}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={s.fav.includes(e.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
          </button>
        </div>
      ))}
    </>
  );
}
export function LibraryScreen({ c }: { c: Ctx }) {
  return (
    <div className={`fl-scr${c.s.back ? ' back' : ''}`} key="library">
      <div className="fl-between"><h1 className="fl-h1">Exercises</h1><button className="fl-btn sm sec" onClick={() => c.open('create')}>+ Create</button></div>
      <LibraryView c={c} />
    </div>
  );
}

/* ---------- Onboarding + generated plan review ---------- */
const QS: { k: 'days' | 'exp' | 'goal' | 'time'; q: string; help: string; opts: { v: string | number; t: string; d: string }[] }[] = [
  { k: 'days', q: 'How many days a week can you train?', help: 'Pick what you can keep doing. Consistency beats ambition.', opts: [2, 3, 4, 5, 6].map((n) => ({ v: n, t: `${n} days`, d: n <= 3 ? 'Full body' : n === 4 ? 'Upper / lower' : 'Split' })) },
  { k: 'exp', q: 'How would you describe your lifting?', help: 'This sets how fast the targets move.', opts: [{ v: 'new', t: 'New to lifting', d: 'Under 6 months' }, { v: 'some', t: 'Some experience', d: '6 months to 2 years' }, { v: 'exp', t: 'Experienced', d: 'More than 2 years' }] },
  { k: 'goal', q: 'What matters most right now?', help: 'You can change this later.', opts: [{ v: 'muscle', t: 'Build muscle', d: 'More reps per set' }, { v: 'strength', t: 'Get stronger', d: 'Heavier, fewer reps' }, { v: 'both', t: 'A bit of both', d: 'Balanced' }] },
  { k: 'time', q: 'How long is a typical session?', help: 'We keep every workout within this limit.', opts: [{ v: 45, t: '45 minutes', d: '4 exercises' }, { v: 60, t: '60 minutes', d: '4 to 5 exercises' }, { v: 90, t: '90 minutes', d: '5 or more' }] },
];
export function Onboard({ c, x }: { c: Ctx; x: Extra }) {
  const { ob } = c.s; const q = QS[ob.step]; const val = ob.a[q.k];
  const setStep = (step: number) => c.set({ ob: { ...ob, step } });
  return (
    <div className="fl-scr" key={`ob${ob.step}`}>
      <div className="fl-row">
        <button className="fl-btn ghost sm" disabled={ob.step === 0} onClick={() => setStep(ob.step - 1)} aria-label="Back">Back</button>
        <div className="fl-seg" style={{ flex: 1 }} role="img" aria-label={`Question ${ob.step + 1} of ${QS.length}`}>{QS.map((_, i) => <i key={i} className={i < ob.step ? 'd' : i === ob.step ? 'c' : ''} />)}</div>
      </div>
      <div style={{ marginTop: 6 }}>
        {ob.step === 0 && <div className="fl-row" style={{ marginBottom: 8 }}><FMark size={28} /><span className="fl-sub">Let&apos;s build your plan in four questions</span></div>}
        <h1 className="fl-h1" style={{ fontSize: 26 }}>{q.q}</h1>
        <p className="fl-sub" style={{ marginTop: 6 }}>{q.help}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {q.opts.map((o) => <button key={String(o.v)} className="fl-opt" aria-pressed={val === o.v} onClick={() => c.set({ ob: { ...ob, a: { ...ob.a, [q.k]: o.v } } })}><b>{o.t}</b><span>{o.d}</span></button>)}
      </div>
      <div style={{ marginTop: 'auto' }}>
        <button className="fl-btn pri big" onClick={() => { if (ob.step < QS.length - 1) setStep(ob.step + 1); else { c.set({ draftPlan: x.generate(ob.a) }); c.go('review'); } }}>{ob.step < QS.length - 1 ? 'Continue' : 'Build my plan'}</button>
        <button className="fl-btn ghost" style={{ width: '100%', marginTop: 4 }} onClick={() => { c.set({ plan: [{ id: 'd1', name: 'Workout A', ex: [] }], hist: {}, nextDay: 0, lastDay: null, selDay: 0, fresh: true }); c.go('plan'); }}>Skip. I will build it myself</button>
      </div>
    </div>
  );
}

export function Review({ c }: { c: Ctx }) {
  const { s } = c; const a = s.ob.a; const plan = s.draftPlan ?? [];
  const split = a.days <= 3 ? 'full-body workouts, so each muscle is trained several times a week' : a.days === 4 ? 'an upper/lower split, so each muscle is trained twice a week' : a.days === 5 ? 'a mix of upper/lower and push/pull/legs' : 'push, pull and legs twice a week';
  const goalTxt = a.goal === 'muscle' ? 'Rep ranges lean higher to build muscle.' : a.goal === 'strength' ? 'Main lifts use lower rep ranges to build strength.' : 'Rep ranges sit in the middle for muscle and strength.';
  const avg = plan.length ? Math.round(plan.reduce((t, d) => t + estMinutes(d.ex), 0) / plan.length) : 0;
  return (
    <div className="fl-scr" key="review">
      <div className="fl-row"><FMark size={26} /><h1 className="fl-h1" style={{ fontSize: 26 }}>Your plan</h1></div>
      <div className="fl-card">
        <p><b>{a.days} days a week · about {avg} min</b></p>
        <p className="fl-sub" style={{ marginTop: 6 }}>Because you can train {a.days} days, we chose {split}. {goalTxt}</p>
        <div className="fl-row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <span className="fl-chip">{a.exp === 'new' ? 'New to lifting' : a.exp === 'some' ? 'Some experience' : 'Experienced'}</span>
          <span className="fl-chip">up to {a.time} min</span>
        </div>
      </div>
      {plan.map((d, di) => (
        <details key={d.id} className="fl-why" open={di === 0}>
          <summary><span><b>{d.name}</b> <span className="fl-sub">· {plural(d.ex.length, 'exercise')} · about {estMinutes(d.ex)} min</span></span><span className="chev" style={{ transition: 'transform .15s' }}>{Icon.chev}</span></summary>
          <div className="body" style={{ paddingTop: 0 }}>
            {d.ex.map((e) => (
              <div key={e.id} className="fl-between" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--tx)' }}>{libOf(c.lib, e.exId).name}<span className="fl-sub"> · {rx(e)}</span></span>
                <button className="fl-btn sm ghost" onClick={() => c.open('swapdraft', { a: d.id, b: e.id })}>Swap</button>
              </div>
            ))}
          </div>
        </details>
      ))}
      <p className="fl-sub">Targets appear after your first session. Nothing is locked: you can edit every workout later.</p>
      <button className="fl-btn pri big" onClick={() => { c.set({ plan, hist: {}, nextDay: 0, lastDay: null, weekDone: [false, false, false, false, false, false, false], selDay: 0, fresh: true, workout: null }); c.go('home'); c.toast('Plan created. Start your first workout when you are ready.'); }}>Create this plan</button>
      <button className="fl-btn ghost" onClick={() => c.go('onboard')}>Change my answers</button>
    </div>
  );
}

/* ---------- Workout complete ---------- */
export function Complete({ c }: { c: Ctx }) {
  const m = c.s.summary; if (!m) return <div className="fl-scr"><button className="fl-btn" onClick={() => c.go('home')}>Home</button></div>;
  return (
    <div className="fl-scr" key="done">
      <div style={{ textAlign: 'center', padding: '10px 0 0' }}>
        <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: 32, background: 'var(--s1)', border: '1px solid var(--line)', alignItems: 'center', justifyContent: 'center', animation: 'fl-pop .5s ease-out' }}><FMark size={34} title="Workout complete" /></div>
        <h1 className="fl-h1" style={{ marginTop: 10 }}>{m.dayName} done</h1>
        <p className="fl-sub">{m.minutes} min · {m.logged} of {m.planned} sets{m.skipped ? ` · ${m.skipped} not logged` : ''}</p>
      </div>
      {m.unsynced > 0 && <div className="fl-banner off"><span>{plural(m.unsynced, 'set')} will sync when you are back online. They are safe on this device.</span></div>}
      <div className="fl-grid2">
        <div className="fl-card" style={{ padding: 14 }}><p className="fl-sub">Volume</p><p className="fl-kpi">{m.volume.toLocaleString()}</p><p className="fl-sub">lb lifted</p></div>
        <div className="fl-card" style={{ padding: 14 }}><p className="fl-sub">Next workout</p><p className="fl-h2" style={{ marginTop: 2 }}>{m.nextDayName}</p><p className="fl-sub">{m.nextPos} of {m.total} in rotation</p></div>
      </div>
      {m.highs.length > 0 && <div className="fl-card"><b>New highs</b>{m.highs.map((h, i) => <p key={i} className="fl-row" style={{ marginTop: 8, alignItems: 'flex-start' }}><FMark size={16} /><span>{h}</span></p>)}</div>}
      <div className="fl-card"><b>Next time you will aim for</b>{m.next.map((n) => <div key={n.name} className="fl-between" style={{ marginTop: 8 }}><span>{n.name}</span><b className="fl-acc">{n.text}</b></div>)}</div>
      <button className="fl-btn pri big" onClick={() => c.go('home')}>Done</button>
      <button className="fl-btn ghost" onClick={() => c.go('progress' as Screen)}>See progress</button>
    </div>
  );
}
