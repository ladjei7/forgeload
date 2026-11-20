'use client';
// Home prompts for people who chose a weekly schedule. Shown once per planned workout (or once per
// week); every answer is saved to their account, so the same prompt never comes back on any device.
// Nothing is ever skipped silently: a workout the person moves past simply stays unfinished.
import { useState } from 'react';
import { daysLeftInWeek, type HomePrompt, type Occurrence } from '../lib/schedule';
import { answerPrompt } from '../lib/scheduleData';
import { logEvent } from '../lib/events';
import { ui } from './ui';

const weekday = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
const listNames = (xs: string[]) => xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

export default function SchedulePrompt({ prompt, planId, today, names, todayPlanned, onAnswered }: {
  prompt: Extract<HomePrompt, { kind: 'missed' | 'new_week' }>; planId: string; today: string;
  names: Record<string, string>; todayPlanned: string | null; onAnswered: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [err, setErr] = useState('');
  const name = (o: Occurrence) => names[o.dayId] ?? 'that workout';

  async function run(label: string, writes: Promise<{ error: unknown }>[]) {
    if (busy) return;
    setBusy(true); setErr('');
    const results = await Promise.all(writes);
    setBusy(false);
    if (results.some(r => r.error)) return setErr("Couldn't save your answer. Check your connection and try again.");
    void logEvent('schedule_prompt', { prompt: prompt.kind, action: label });
    onAnswered();
  }

  if (prompt.kind === 'missed') {
    const o = prompt.missed;
    const later = daysLeftInWeek(today).filter(d => d > today);
    const other = todayPlanned && todayPlanned !== o.dayId ? names[todayPlanned] : null;
    return (
      <section className={`${ui.card} border-fl-acc/40`} aria-label="Missed workout">
        <h2 className={ui.h2}>You planned {name(o)} for {weekday(o.date)}</h2>
        <p className={`${ui.sub} mb-4 mt-1`}>{other ? `Do it next, or continue with today's ${other}?` : 'Do it next, or keep going with your plan?'} Nothing is skipped unless you say so.</p>
        <div className="space-y-2">
          <button disabled={busy} onClick={() => run('do_next', [answerPrompt(planId, o, 'rescheduled', today)])} className={ui.secondary}>Do {name(o)} next</button>
          <button disabled={busy} onClick={() => run('continue', [answerPrompt(planId, o, 'dismissed')])} className={ui.secondary}>{other ? `Continue with ${other}` : 'Keep going with my plan'}</button>
          {later.length > 0 && (moving ? (
            <div className="rounded-xl bg-fl-s2 p-3">
              <p className="mb-2 text-sm text-fl-tx2">Move {name(o)} to:</p>
              <div className="flex flex-wrap gap-2">
                {later.map(d => <button key={d} disabled={busy} onClick={() => run('moved', [answerPrompt(planId, o, 'rescheduled', d)])} className={`${ui.pill} ${ui.pillOff}`}>{weekday(d)}</button>)}
              </div>
            </div>
          ) : <button disabled={busy} onClick={() => setMoving(true)} className={ui.secondary}>Move it to another day</button>)}
          <button disabled={busy} onClick={() => run('not_now', [answerPrompt(planId, o, 'dismissed')])} className={`${ui.textBtn} w-full justify-center`}>Not now</button>
        </div>
        {err && <p role="alert" className="mt-3 text-sm text-fl-bad">⚠ {err}</p>}
      </section>
    );
  }

  const left = prompt.unfinished;
  const first = left[0];
  return (
    <section className={`${ui.card} border-fl-acc/40`} aria-label="New training week">
      <h2 className={ui.h2}>New training week</h2>
      <p className={`${ui.sub} mb-4 mt-1`}>
        {left.length === 1 ? `${name(first)} from last week wasn't done.` : `${left.length} workouts from last week weren't done: ${listNames(left.map(name))}.`} They stay unfinished in your history. Nothing is deleted.
      </p>
      <div className="space-y-2">
        <button disabled={busy} onClick={() => run('do_first', [answerPrompt(planId, first, 'rescheduled', today), ...left.slice(1).map(o => answerPrompt(planId, o, 'dismissed'))])} className={ui.secondary}>Do {name(first)} first</button>
        <button disabled={busy} onClick={() => run('fresh', left.map(o => answerPrompt(planId, o, 'dismissed')))} className={ui.secondary}>Start this week fresh</button>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-fl-bad">⚠ {err}</p>}
    </section>
  );
}
