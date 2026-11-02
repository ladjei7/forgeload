'use client';
import { useState } from 'react';
import { EQUIP, MUSCLES, computeTarget, comfortLevel, fmtW, lastLine, levelOf, libOf, type Comfort, type LibEx } from './data';
import { preferenceSuggestions, suggest, type Suggestion } from './adapt';
import { whyKey, type Ctx, type Net } from './ctx';
import { Sheet, Stepper, Switch } from './ui';
import { LibraryView } from './screens';
import type { Extra } from './Proto';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function Candidates({ c, current, taken, onChoose, note }: { c: Ctx; current: LibEx; taken: string[]; onChoose: (e: LibEx) => void; note?: string }) {
  const list = c.lib.filter((e) => e.muscle === current.muscle && e.id !== current.id && !taken.includes(e.id)).sort((a, b) => Number(levelOf(b) <= comfortLevel(c.s.comfort)) - Number(levelOf(a) <= comfortLevel(c.s.comfort)) || Number(b.equip === current.equip) - Number(a.equip === current.equip));
  return (
    <>
      <p className="fl-sub">Same muscle ({current.muscle}). Options that fit your comfort setting are listed first; everything is available.{note ? ` ${note}` : ''}</p>
      {list.length === 0 && <p>No other {current.muscle.toLowerCase()} exercises available.</p>}
      {list.map((e) => (
        <button key={e.id} className="fl-li" onClick={() => onChoose(e)}>
          <span><span className="t" style={{ display: 'block' }}>{e.name}</span><span className="s">{e.equip}{e.equip === current.equip ? ' · same equipment' : ''} · {c.s.hist[e.id]?.length ? `Last: ${lastLine(c.s.hist[e.id], e.kind)}` : 'First time'}</span></span>
        </button>
      ))}
    </>
  );
}

const COMFORT: { v: Comfort; t: string; d: string }[] = [
  { v: 'machines', t: 'Mostly machines', d: 'I prefer guided movements while getting comfortable.' },
  { v: 'mixed', t: 'Machines and dumbbells', d: 'I like a combination of both.' },
  { v: 'all', t: 'All gym equipment', d: 'I am comfortable with barbells, dumbbells, and machines.' },
  { v: 'unsure', t: 'I am not sure', d: 'Choose for me.' },
];
/* Changing a preference never edits the plan. It only offers optional swaps that the user can accept one at a time. */
function Prefs({ c }: { c: Ctx }) {
  const { s } = c; const [changed, setChanged] = useState(false);
  const offers: Suggestion[] = changed ? preferenceSuggestions(s.plan, s.comfort, s.avoid, c.lib).filter((x) => !s.dismissed.includes(x.id)) : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontWeight: 600 }}>Exercise comfort</p>
      <p className="fl-sub">Picks which exercises we suggest first. Your plan does not change when you pick one.</p>
      {COMFORT.map((o) => <button key={o.v} className="fl-opt" aria-pressed={s.comfort === o.v} onClick={() => { c.set({ comfort: o.v }); setChanged(true); }}><b>{o.t}</b><span>{o.d}</span></button>)}
      {changed && (offers.length === 0 ? <p className="fl-sub">Saved. Your plan already fits this setting.</p> : (
        <div className="fl-card">
          <p><b>Optional swaps for this setting</b></p>
          <p className="fl-sub" style={{ marginTop: 2 }}>Your plan has not changed. Accept any, all, or none.</p>
          {offers.length > 1 && <button className="fl-btn sm pri" style={{ marginTop: 8 }} onClick={() => c.applySug(offers, true)}>Swap all {offers.length}</button>}
          {offers.map((o) => (
            <div key={o.id} className="fl-between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', gap: 8 }}>
              <span style={{ minWidth: 0 }}>{o.title}</span>
              <button className="fl-btn sm sec" onClick={() => c.applySug(o, true)}>Swap</button>
            </div>))}
        </div>))}
      <p style={{ fontWeight: 600, marginTop: 6 }}>Typical session length</p>
      <div className="fl-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {[30, 45, 60, 90].map((m) => <button key={m} className="fl-btn sm sec" aria-pressed={s.planTime === m} style={s.planTime === m ? { borderColor: 'var(--acc)', color: 'var(--acc)' } : undefined} onClick={() => c.set({ planTime: m })}>{m} min</button>)}
      </div>
      <p className="fl-sub">If a workout runs longer than this, we may suggest trimming it. We never trim it ourselves.</p>
    </div>
  );
}

function Create({ c, initial }: { c: Ctx; initial: string }) {
  const [name, setName] = useState(initial); const [muscle, setMuscle] = useState('Chest'); const [equip, setEquip] = useState('Dumbbell'); const [kind, setKind] = useState<'weight' | 'bodyweight'>('weight');
  const [err, setErr] = useState('');
  const save = () => {
    const n = name.trim();
    if (!n) { setErr('Give the exercise a name.'); return; }
    if (c.lib.some((e) => e.name.toLowerCase() === n.toLowerCase())) { setErr('That exercise already exists. Search for it instead.'); return; }
    const e: LibEx = { id: `c${Date.now()}`, name: n, muscle, equip: kind === 'bodyweight' ? 'Bodyweight' : equip, kind, inc: kind === 'bodyweight' ? 0 : 5, startW: 20, desc: 'Custom exercise', custom: true };
    c.set({ custom: [...c.s.custom, e], recent: [e.id, ...c.s.recent], sheet: null, toast: { msg: `${n} added to Mine` } });
  };
  return (
    <>
      <div><label className="fl-lbl" htmlFor="cn">Name</label><input id="cn" className="fl-search" value={name} enterKeyHint="done" placeholder="e.g. Cable Lateral Raise" onChange={(e) => { setName(e.target.value); setErr(''); }} aria-invalid={!!err} aria-describedby={err ? 'cerr' : undefined} /></div>
      {err && <p id="cerr" className="fl-bad" role="alert">{err}</p>}
      <div className="fl-grid2">
        <div><label className="fl-lbl" htmlFor="cm">Main muscle</label><select id="cm" className="fl-sel" style={{ width: '100%' }} value={muscle} onChange={(e) => setMuscle(e.target.value)}>{MUSCLES.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div><label className="fl-lbl" htmlFor="ce">Equipment</label><select id="ce" className="fl-sel" style={{ width: '100%' }} disabled={kind === 'bodyweight'} value={kind === 'bodyweight' ? 'Bodyweight' : equip} onChange={(e) => setEquip(e.target.value)}>{EQUIP.filter((m) => m !== 'Bodyweight').map((m) => <option key={m}>{m}</option>)}{kind === 'bodyweight' && <option>Bodyweight</option>}</select></div>
      </div>
      <div><span className="fl-lbl">How do you log it?</span>
        <div className="fl-grid2">
          <button className="fl-opt" aria-pressed={kind === 'weight'} onClick={() => setKind('weight')}><b>Weight and reps</b><span>135 lb x 8</span></button>
          <button className="fl-opt" aria-pressed={kind === 'bodyweight'} onClick={() => setKind('bodyweight')}><b>Reps only</b><span>12 reps</span></button>
        </div></div>
      <button className="fl-btn pri big" onClick={save}>Save exercise</button>
    </>
  );
}

function AddToDay({ c, ex }: { c: Ctx; ex: LibEx }) {
  const [di, setDi] = useState(c.s.selDay);
  return (
    <div className="fl-row" style={{ alignItems: 'flex-end' }}>
      <div style={{ flex: 1 }}><label className="fl-lbl" htmlFor="ad">Add to workout</label>
        <select id="ad" className="fl-sel" style={{ width: '100%' }} value={di} onChange={(e) => setDi(+e.target.value)}>{c.s.plan.map((d, i) => <option key={d.id} value={i}>{d.name}</option>)}</select></div>
      <button className="fl-btn pri" disabled={!c.s.plan.length} onClick={() => { c.mutatePlan((d) => d.map((x, i) => (i === di ? { ...x, ex: [...x.ex, { id: `p${Date.now()}`, exId: ex.id, sets: 3, min: 8, max: 12, rest: 90, rir: false }] } : x))); c.set({ sheet: null, toast: { msg: `Added to ${c.s.plan[di].name}` } }); }}>Add</button>
    </div>
  );
}

export function SheetHost({ c, x }: { c: Ctx; x: Extra }) {
  const { s } = c; const sh = s.sheet; if (!sh) return null; const w = s.workout;
  const close = c.close;
  switch (sh.t) {
    case 'proto': return <Sheet title="Prototype tools" onClose={close}><ProtoControls c={c} x={x} /></Sheet>;
    case 'suggest': {
      const sg = suggest({ plan: s.plan, hist: s.hist, events: s.events, dismissed: s.dismissed, comfort: s.comfort, avoid: s.avoid, planTime: s.planTime, lib: c.lib }).find((x) => x.id === sh.a);
      if (!sg) return null;
      return (
        <Sheet title="Suggestion" onClose={close}>
          <p style={{ fontWeight: 600, fontSize: 17 }}>{sg.title}</p>
          <p>{sg.why}</p>
          <p className="fl-sub">Nothing changes unless you accept. You can undo right after, and you can always change it yourself in Plan.</p>
          <button className="fl-btn pri big" onClick={() => c.applySug(sg)}>{sg.accept}</button>
          <button className="fl-btn ghost" onClick={() => { c.set({ dismissed: [...s.dismissed, sg.id], sheet: null }); }}>No thanks</button>
        </Sheet>);
    }
    case 'account': return (
      <Sheet title="Account and preferences" onClose={close}>
        <Prefs c={c} />
        <p className="fl-sub">In the real app this opens Settings: export your data, delete your account, sign out. The preview keeps those screens unchanged.</p>
        <Switch on={s.theme === 'light'} onChange={(v) => c.set({ theme: v ? 'light' : 'dark' })}>Light theme (optional)</Switch>
      </Sheet>);
    case 'days': return (
      <Sheet title="Choose a workout" onClose={close}>
        <p className="fl-sub">Doing a different day does not break your rotation. Next is always the workout after the one you finish.</p>
        {s.plan.map((d, i) => (
          <button key={d.id} className="fl-li" onClick={() => { c.startWorkout(i); }}>
            <span><span className="t" style={{ display: 'block' }}>{d.name}</span><span className="s">{i === s.nextDay ? 'Next in rotation' : i === s.lastDay ? 'Last done' : `${plural(d.ex.length, 'exercise')}`}</span></span>
          </button>))}
        <button className="fl-btn sec" onClick={() => { c.set({ nextDay: (s.nextDay + 1) % s.plan.length, sheet: null, toast: { msg: `Skipped ${s.plan[s.nextDay].name}. Next is ${s.plan[(s.nextDay + 1) % s.plan.length].name}.` } }); }}>Skip {s.plan[s.nextDay]?.name} for now</button>
      </Sheet>);
    case 'override': {
      if (!w) return null; const we = w.exs.find((e) => e.id === sh.a); if (!we) return null; return <Override c={c} weId={we.id} />;
    }
    case 'swap': {
      if (!w) return null; const we = w.exs.find((e) => e.id === sh.a); if (!we) return null; const cur = libOf(c.lib, we.exId); const started = w.sets.some((q) => q.peId === we.id);
      return <SwapWorkout c={c} we={we} cur={cur} started={started} />;
    }
    case 'swapplan': {
      const day = s.plan[s.selDay]; const pe = day?.ex.find((e) => e.id === sh.a); if (!pe) return null; const cur = libOf(c.lib, pe.exId);
      return (<Sheet title={`Replace ${cur.name}`} onClose={close}>
        <Candidates c={c} current={cur} taken={day.ex.map((e) => e.exId)} onChoose={(e) => { c.mutatePlan((d) => d.map((dd) => (dd.id === day.id ? { ...dd, ex: dd.ex.map((q) => (q.id === pe.id ? { ...q, exId: e.id } : q)) } : dd))); c.addEvent({ k: 'swap', from: cur.id, to: e.id, d: 0 }); c.set({ sheet: null, toast: { msg: `Replaced with ${e.name}` } }); }} />
      </Sheet>);
    }
    case 'swapdraft': {
      const day = s.draftPlan?.find((d) => d.id === sh.a); const pe = day?.ex.find((e) => e.id === sh.b); if (!day || !pe) return null; const cur = libOf(c.lib, pe.exId);
      return (<Sheet title={`Swap ${cur.name}`} onClose={close}>
        <Candidates c={c} current={cur} taken={day.ex.map((e) => e.exId)} onChoose={(e) => c.set({ draftPlan: s.draftPlan!.map((d) => (d.id === day.id ? { ...d, ex: d.ex.map((q) => (q.id === pe.id ? { ...q, exId: e.id } : q)) } : d)), sheet: null })} />
      </Sheet>);
    }
    case 'exlist': return !w ? null : (
      <Sheet title="Exercises" onClose={close}>
        {w.exs.map((e, i) => { const n = w.sets.filter((q) => q.peId === e.id).length; const tot = e.sets + e.extra; return (
          <button key={e.id} className="fl-li" style={i === w.idx ? { borderColor: 'var(--acc)' } : undefined} onClick={() => c.set({ workout: { ...w, idx: i }, sheet: null })}>
            <span><span className="t" style={{ display: 'block' }}>{libOf(c.lib, e.exId).name}</span><span className="s">{n >= tot ? 'All sets logged' : n === 0 ? 'Not started' : `${n} of ${tot} sets`}{i === w.idx ? ' · current' : ''}</span></span>
          </button>); })}
      </Sheet>);
    case 'finish': {
      if (!w) return null; const planned = w.exs.reduce((a, e) => a + e.sets + e.extra, 0); const logged = w.sets.length;
      const bad = w.sets.filter((q) => q.status === 'failed' || q.status === 'queued'); const failed = w.sets.filter((q) => q.status === 'failed');
      if (logged === 0) return (
        <Sheet title="Nothing logged yet" onClose={close}><p>You have not logged a set. Discarding removes this workout and nothing is saved.</p>
          <button className="fl-btn pri big" onClick={close}>Keep going</button><button className="fl-btn bad big" onClick={() => c.finish(true)}>Discard workout</button></Sheet>);
      return (
        <Sheet title="Finish workout?" onClose={close}>
          {bad.length > 0 && <div className="fl-banner bad"><span>{plural(bad.length, 'set')} {failed.length ? 'did not save' : 'are waiting for a connection'}. Your numbers are kept on this device.</span></div>}
          {logged < planned && <p>{plural(planned - logged, 'set')} not logged. They will be recorded as skipped, and your next targets are based on the sets you did log.</p>}
          {failed.length > 0 && <button className="fl-btn pri big" onClick={() => { failed.forEach((q) => c.retrySet(q.id)); close(); }}>Retry saving</button>}
          <button className={`fl-btn big ${failed.length ? 'sec' : 'pri'}`} onClick={() => c.finish(true)}>Finish anyway</button>
          <button className="fl-btn ghost" onClick={close}>Keep going</button>
        </Sheet>);
    }
    case 'editset': {
      const l = w?.sets.find((q) => q.id === sh.a); if (!w || !l) return null; return <EditSet c={c} id={l.id} />;
    }
    case 'addplan': return (
      <Sheet title="Add exercise" onClose={close}>
        <LibraryView c={c} onPick={(e) => { const id = `p${Date.now()}`; c.mutatePlan((d) => d.map((dd, i) => (i === s.selDay ? { ...dd, ex: [...dd.ex, { id, exId: e.id, sets: 3, min: 8, max: 12, rest: 90, rir: false }] } : dd))); c.set({ sheet: null, exp: id, toast: { msg: `Added ${e.name}` } }); }} />
        <button className="fl-btn" onClick={() => c.open('create')}>Create a new exercise</button>
      </Sheet>);
    case 'create': return <Sheet title="Create exercise" onClose={close}><Create c={c} initial={sh.a ?? ''} /></Sheet>;
    case 'detail': {
      const e = c.lib.find((q) => q.id === sh.a); if (!e) return null; const fav = s.fav.includes(e.id);
      return (
        <Sheet title={e.name} onClose={close}>
          <div className="fl-row" style={{ flexWrap: 'wrap' }}><span className="fl-chip">{e.muscle}</span><span className="fl-chip">{e.equip}</span><span className="fl-chip">{e.kind === 'bodyweight' ? 'Reps only' : 'Weight and reps'}</span></div>
          <p>{e.desc}</p>
          <p className="fl-sub">Last time: {lastLine(s.hist[e.id], e.kind)}</p>
          <AddToDay c={c} ex={e} />
          <button className="fl-btn" aria-pressed={fav} onClick={() => c.set({ fav: fav ? s.fav.filter((q) => q !== e.id) : [...s.fav, e.id] })}>{fav ? 'Remove from favorites' : 'Add to favorites'}</button>
          <p className="fl-sub">Illustrative mock exercise. Photos and instructions will come from the licensed exercise library.</p>
        </Sheet>);
    }
  }
  return null;
}

function Override({ c, weId }: { c: Ctx; weId: string }) {
  const w = c.s.workout!; const we = w.exs.find((e) => e.id === weId)!; const ex = libOf(c.lib, we.exId); const t = c.targetOf(we); const o = w.ovr[weId];
  const [wt, setWt] = useState(o?.w ?? t.w); const [r, setR] = useState(o?.r ?? t.r); const bw = ex.kind === 'bodyweight'; const step = ex.inc || 5;
  return (
    <Sheet title="Change target" onClose={c.close}>
      <p className="fl-sub">Recommended: <b style={{ color: 'var(--tx)' }}>{bw ? `${t.r} reps` : `${fmtW(t.w)} x ${t.r}`}</b>. Feeling worse or better today? Set your own. It only changes this workout.</p>
      <div className="fl-row">
        {!bw && <Stepper wide label="Weight lb" value={fmtW(wt)} onDec={() => setWt(Math.max(0, wt - step))} onInc={() => setWt(wt + step)} />}
        <Stepper wide label="Reps" value={String(r)} onDec={() => setR(Math.max(1, r - 1))} onInc={() => setR(r + 1)} />
      </div>
      <button className="fl-btn pri big" onClick={() => c.set({ workout: { ...w, ovr: { ...w.ovr, [weId]: { w: bw ? 0 : wt, r } }, draft: { ...w.draft, [weId]: { w: fmtW(bw ? 0 : wt), r: String(r) } } }, sheet: null })}>Use this target</button>
    </Sheet>
  );
}

function SwapWorkout({ c, we, cur, started }: { c: Ctx; we: { id: string; exId: string; sets: number; min: number; max: number; rest: number; rir: boolean; extra: number }; cur: LibEx; started: boolean }) {
  const w = c.s.workout!; const [alsoPlan, setAlso] = useState(false);
  const choose = (e: LibEx) => {
    c.addEvent({ k: 'swap', from: cur.id, to: e.id, d: 0 });
    const t = computeTarget(we, e, c.s.hist[e.id]); const ovr = { ...w.ovr }; delete ovr[we.id];
    c.set({ workout: { ...w, ovr, exs: w.exs.map((q) => (q.id === we.id ? { ...q, exId: e.id } : q)), draft: { ...w.draft, [we.id]: { w: fmtW(t.w), r: String(t.r) } } }, sheet: null, toast: { msg: `Swapped to ${e.name}` } });
    if (alsoPlan) c.mutatePlan((d) => d.map((dd) => (dd.id === w.dayId ? { ...dd, ex: dd.ex.map((q) => (q.id === we.id ? { ...q, exId: e.id } : q)) } : dd)));
  };
  return (
    <Sheet title={`Swap ${cur.name}`} onClose={c.close}>
      {started ? <div className="fl-banner off"><span>You have already logged sets of this exercise, so it cannot be swapped. Finish it, then swap the next one.</span></div> : (
        <>
          <Switch on={alsoPlan} onChange={setAlso}>Also change it in my plan</Switch>
          <Candidates c={c} current={cur} taken={w.exs.map((q) => q.exId)} onChoose={choose} note={alsoPlan ? 'The plan will be updated too.' : 'Only this workout changes.'} />
        </>)}
    </Sheet>
  );
}

function EditSet({ c, id }: { c: Ctx; id: string }) {
  const w = c.s.workout!; const l = w.sets.find((q) => q.id === id)!; const we = w.exs.find((e) => e.id === l.peId)!; const ex = libOf(c.lib, we.exId); const bw = ex.kind === 'bodyweight';
  const [wt, setWt] = useState(l.w); const [r, setR] = useState(l.r); const step = ex.inc || 5;
  return (
    <Sheet title={`Edit set ${l.n}`} onClose={c.close}>
      <div className="fl-row">
        {!bw && <Stepper wide label="Weight lb" value={fmtW(wt)} onDec={() => setWt(Math.max(0, wt - step))} onInc={() => setWt(wt + step)} />}
        <Stepper wide label="Reps" value={String(r)} onDec={() => setR(Math.max(1, r - 1))} onInc={() => setR(r + 1)} />
      </div>
      <button className="fl-btn pri big" onClick={() => c.set({ workout: { ...w, sets: w.sets.map((q) => (q.id === id ? { ...q, w: wt, r } : q)) }, sheet: null, toast: { msg: `Set ${l.n} updated` } })}>Save changes</button>
      <button className="fl-btn bad" onClick={() => c.set({ workout: { ...w, sets: w.sets.filter((q) => q.id !== id).map((q) => (q.peId === l.peId && q.n > l.n ? { ...q, n: q.n - 1 } : q)) }, sheet: null, toast: { msg: `Set ${l.n} removed` } })}>Remove this set</button>
    </Sheet>
  );
}

/* ---------- prototype controls (side panel on desktop, sheet on phones) ---------- */
export function ProtoControls({ c, x }: { c: Ctx; x: Extra }) {
  const s = c.s; const nets: [Net, string][] = [['online', 'Online'], ['slow', 'Slow'], ['fail', 'Next save fails'], ['offline', 'Offline']];
  const avg = x.costs.length ? (x.costs.reduce((a, b) => a + b, 0) / x.costs.length).toFixed(1) : '-';
  const jump = (fn: () => void) => () => { fn(); c.close(); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="fl-panel"><h3>Theme and logger</h3>
        <div className="seg"><button aria-pressed={s.theme === 'dark'} onClick={() => c.set({ theme: 'dark' })}>Dark</button><button aria-pressed={s.theme === 'light'} onClick={() => c.set({ theme: 'light' })}>Light</button></div>
        <div className="seg"><button aria-pressed={s.mode === 'list'} onClick={() => c.set({ mode: 'list' })}>List logger</button><button aria-pressed={s.mode === 'focus'} onClick={() => c.set({ mode: 'focus' })}>Focus logger</button></div>
      </div>
      <div className="fl-panel"><h3>Network (affects set and plan saves)</h3>
        <div className="seg">{nets.map(([n, l]) => <button key={n} aria-pressed={s.net === n} onClick={() => c.set({ net: n })}>{l}</button>)}</div>
        <p className="fl-sub">&quot;Next save fails&quot; fails once, then recovers, so you can test Retry.</p>
      </div>
      <div className="fl-panel"><h3>Scenarios</h3>
        <div className="seg">
          <button onClick={jump(() => x.interrupted())}>Interrupted workout</button>
          <button onClick={jump(() => { x.reset({ screen: 'onboard', plan: [], hist: {}, lastDay: null, weekDone: [false, false, false, false, false, false, false], ob: { step: 0, a: { days: 4, exp: 'some', goal: 'both', time: 60, comfort: 'unsure' } }, why: {}, events: [], dismissed: [], comfort: 'unsure' }); })}>New user</button>
          <button onClick={jump(() => x.reset())}>Reset demo</button>
        </div>
        <div className="seg">
          <button onClick={jump(() => c.go('home'))}>Home</button><button onClick={jump(() => c.startWorkout(s.nextDay))}>Workout</button><button onClick={jump(() => c.go('plan'))}>Plan</button>
          <button onClick={jump(() => c.go('progress'))}>Progress</button><button onClick={jump(() => c.go('library'))}>Library</button>
          <button onClick={jump(() => { const r = x.generate(s.ob.a); c.set({ draftPlan: r.days, draftNotes: r.notes, draftWhy: Object.fromEntries(r.days.flatMap((d) => d.ex.map((e) => [whyKey(e), r.why[e.id]]))) }); c.go('review'); })}>Plan review</button>
        </div>
      </div>
      <div className="fl-panel"><h3>Interaction counter</h3>
        <p><b style={{ fontSize: 22 }}>{c.acts}</b> <span className="fl-sub">taps since reset</span></p>
        <p className="fl-sub">Taps per logged set: last <b style={{ color: 'var(--tx)' }}>{x.costs.length ? x.costs[x.costs.length - 1] : '-'}</b> · average <b style={{ color: 'var(--tx)' }}>{avg}</b> over {plural(x.costs.length, 'set')}</p>
        <div className="seg"><button onClick={x.resetActs}>Reset counter</button></div>
      </div>
      <div className="fl-panel"><h3>Edge cases built in</h3>
        <p className="fl-sub">Barbell Row: every set at 12, weight goes up. Overhead Press: one set under the range, weight is held. Pull-Up: reps only. Lat Pulldown: first time, suggested start. Bench: 8, 8, 7, target 8.</p>
      </div>
    </div>
  );
}
