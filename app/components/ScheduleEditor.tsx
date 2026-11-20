'use client';
// Plan tab: choose how the plan follows the week. Rotation is the default and needs nothing set up.
// Weekly: pick which workout goes on which day; Home then shows today's planned workout and asks
// (once) about a planned workout that was missed. Saving restarts the schedule from today, so
// nothing earlier can count as missed.
import { useEffect, useState } from 'react';
import { suggestSchedule, type Schedule, type Slot } from '../lib/schedule';
import { loadSchedule, saveSchedule, ROTATION } from '../lib/scheduleData';
import { ui, Notice } from './ui';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ScheduleEditor({ planId, days }: { planId: string; days: { id: string; day_name: string }[] }) {
  const [saved, setSaved] = useState<Schedule | null>(null);
  const [mode, setMode] = useState<Schedule['mode']>('rotation');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    loadSchedule(planId).then(s => { if (!alive) return; setSaved(s); setMode(s.mode); setSlots(s.slots); setMsg(null); }, () => { if (alive) setSaved(ROTATION); });
    return () => { alive = false; };
  }, [planId]);

  const valid = slots.filter(s => days.some(d => d.id === s.dayId)); // a removed workout drops out
  const dayFor = (w: number) => valid.find(s => s.weekday === w)?.dayId ?? '';
  const setDay = (w: number, dayId: string) => setSlots([...valid.filter(s => s.weekday !== w), ...(dayId ? [{ weekday: w, dayId }] : [])].sort((a, b) => a.weekday - b.weekday));
  const changed = saved && (mode !== saved.mode || JSON.stringify(valid) !== JSON.stringify(saved.slots.filter(s => days.some(d => d.id === s.dayId))));

  async function save() {
    if (busy) return;
    if (mode === 'weekly' && valid.length === 0) return setMsg({ kind: 'error', text: 'Pick at least one training day, or switch back to rotation.' });
    setBusy(true);
    const next: Schedule = { mode, weekStart: 0, slots: mode === 'weekly' ? valid : [] };
    const { error } = await saveSchedule(planId, next);
    setBusy(false);
    if (error) return setMsg({ kind: 'error', text: "Couldn't save your schedule. Check your connection and try again." });
    setSaved(next);
    setMsg({ kind: 'ok', text: mode === 'weekly' ? 'Schedule saved. Home will show what is planned each day, starting today.' : 'Back to rotation: just do the next workout whenever you train.' });
  }

  if (!saved) return null;
  return (
    <section className={`${ui.card} mt-4`} aria-label="Schedule">
      <h2 className={ui.h2}>Schedule</h2>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label="How this plan follows your week">
        {([
          ['rotation', 'Rotation (recommended)', 'Do the next workout whenever you train. Missing a day never puts you behind.'],
          ['weekly', 'Weekly schedule', "Pick your training days. Home shows what's planned and asks once if you miss one."],
        ] as const).map(([id, title, sub]) => (
          <button key={id} role="radio" aria-checked={mode === id} onClick={() => { setMode(id); setMsg(null); if (id === 'weekly' && valid.length === 0) setSlots(suggestSchedule(days.map(d => d.id)).slots); }}
            className={`w-full rounded-xl border p-3 text-left ${mode === id ? 'border-fl-acc bg-fl-tint' : 'border-fl-line bg-fl-s2'}`}>
            <span className="block font-semibold">{title}</span>
            <span className="block text-sm text-fl-tx2">{sub}</span>
          </button>
        ))}
      </div>

      {mode === 'weekly' && (
        <div className="mt-4">
          <div className="divide-y divide-fl-line">
            {WEEKDAYS.map((w, i) => (
              <label key={w} className="flex items-center justify-between gap-3 py-2">
                <span className="w-24 shrink-0 text-sm font-semibold">{w}</span>
                <select value={dayFor(i)} onChange={e => { setDay(i, e.target.value); setMsg(null); }} className={`${ui.input} h-11`} aria-label={`${w} workout`}>
                  <option value="">Rest</option>
                  {days.map(d => <option key={d.id} value={d.id}>{d.day_name}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button onClick={() => { setSlots(suggestSchedule(days.map(d => d.id)).slots); setMsg(null); }} className={`${ui.textBtn} -ml-2 mt-1`}>Suggest days for me</button>
        </div>
      )}

      {changed && <button onClick={save} disabled={busy} className={`${ui.secondary} mt-3`}>{busy ? 'Saving...' : 'Save schedule'}</button>}
      {msg && <div className="mt-3"><Notice msg={msg} /></div>}
    </section>
  );
}
