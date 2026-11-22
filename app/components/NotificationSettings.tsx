'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { pickCurrent } from '../lib/pickCurrent';
import { storedPlanId } from '../lib/currentPlan';
import {
  pushSupport, permission, isIos, deviceRegistered, enableNotifications, disableNotifications, sendTest,
  restAlertsOn, setRestAlerts, loadReminders, saveReminders, beepOn, setBeepOn, DEFAULT_REMINDERS, type ReminderSettings, type PushSupport,
} from '../lib/push';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Shown on previews built against forgeload-dev, so testers can see they are not on the real database.
const TEST_DB = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes('lwngtnwpycohbqimwqoh');

function Switch({ on, title, sub, onToggle, disabled }: { on: boolean; title: string; sub: string; onToggle: () => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} onClick={onToggle} disabled={disabled} className="flex w-full items-center gap-3 rounded-xl py-2 text-left disabled:opacity-50">
      <span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="block text-sm text-fl-tx2">{sub}</span></span>
      <span aria-hidden="true" className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-fl-acc' : 'border border-fl-field bg-fl-s2'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

/** The iPhone steps: notifications from a website only work after Add to Home Screen (iOS 16.4 or later). */
function IphoneGuide() {
  return (
    <div className="mt-3 rounded-xl border border-fl-field bg-fl-s2 p-3 text-sm leading-relaxed">
      <p className="font-semibold">On iPhone: add Forgeload to your Home Screen first</p>
      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-fl-tx2">
        <li>In Safari, tap the Share button (the square with an arrow).</li>
        <li>Scroll down and tap <span className="font-semibold text-fl-tx">Add to Home Screen</span>, then <span className="font-semibold text-fl-tx">Add</span>.</li>
        <li>Open Forgeload from the new icon on your Home Screen and sign in.</li>
        <li>Come back to Settings and tap <span className="font-semibold text-fl-tx">Enable notifications</span>.</li>
      </ol>
      <p className="mt-1 text-xs text-fl-tx2">Needs iOS 16.4 or later. Silent mode and Focus can still mute sounds, like with any app.</p>
    </div>
  );
}

export default function NotificationSettings() {
  const [support, setSupport] = useState<PushSupport>('unsupported');
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [rest, setRest] = useState(false);
  const [beep, setBeep] = useState(true);
  const [rem, setRem] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [mode, setMode] = useState<'rotation' | 'weekly'>('rotation');
  const [hasWorkout, setHasWorkout] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = pushSupport(); const reg = await deviceRegistered();
      const [r, onRest, plans, done] = await Promise.all([
        loadReminders(), reg ? restAlertsOn() : Promise.resolve(false),
        supabase.from('workout_plans').select('id, name, is_active, created_at').order('created_at'),
        supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).not('completed_at', 'is', null),
      ]);
      const cur = pickCurrent((plans.data ?? []) as { id: string; name: string; is_active: boolean | null; created_at: string }[], storedPlanId());
      let m: 'rotation' | 'weekly' = 'rotation';
      if (cur) { const { data } = await supabase.from('plan_schedules').select('mode').eq('plan_id', cur.id).maybeSingle(); if (data?.mode === 'weekly') m = 'weekly'; }
      if (!alive) return;
      setSupport(s); setRegistered(reg); setRem(r); setRest(onRest); setBeep(beepOn()); setMode(m); setHasWorkout((done.count ?? 0) > 0);
    })();
    return () => { alive = false; };
  }, []);

  async function enable() {
    setBusy(true); setNote(null);
    const r = await enableNotifications();
    setBusy(false);
    if (r.ok) { setRegistered(true); setNote({ ok: true, text: 'Notifications are on for this device. Choose what you want below.' }); }
    else setNote({ ok: false, text: r.message ?? 'Something went wrong.' });
  }
  async function disable() {
    setBusy(true); await disableNotifications(); setBusy(false);
    setRegistered(false); setRest(false); setNote({ ok: true, text: 'Notifications are off on this device.' });
  }
  async function toggleRest() {
    const next = !rest; setRest(next);
    if (!(await setRestAlerts(next))) { setRest(!next); setNote({ ok: false, text: 'Could not save that. Check your connection.' }); }
  }
  async function patch(p: Partial<ReminderSettings>) {
    const before = rem; const next = { ...rem, ...p }; setRem(next);
    if (!(await saveReminders(p))) { setRem(before); setNote({ ok: false, text: 'Could not save that. Check your connection.' }); }
  }
  async function test() {
    setBusy(true); const r = await sendTest(); setBusy(false);
    setNote({ ok: r.ok, text: r.message });
  }

  const denied = permission() === 'denied';
  return (
    <section className="rounded-2xl border border-fl-line bg-fl-s1 p-5">
      {TEST_DB && <p className="mb-2 inline-block rounded-full bg-fl-tint px-3 py-1 text-xs font-bold">Test database (forgeload-dev)</p>}
      <h2 className="mb-1 text-lg font-bold">Notifications</h2>
      <p className="mb-3 text-sm text-fl-tx2">All optional and off until you turn them on. They never show your weights or reps on the lock screen.</p>

      {!registered && (
        <>
          {support === 'ok' && <button onClick={enable} disabled={busy} className="flex h-12 w-full items-center justify-center rounded-xl bg-fl-acc font-bold text-fl-on-acc disabled:opacity-60">{busy ? 'Turning on…' : 'Enable notifications'}</button>}
          {support === 'ok' && denied && <p className="mt-2 text-sm text-fl-tx2">Notifications are blocked for Forgeload. Allow them in your phone or browser settings, then tap Enable.</p>}
          {support === 'unsupported' && <p className="text-sm text-fl-tx2">This browser can&apos;t show notifications.</p>}
          {(support === 'ios-needs-home-screen' || (isIos() && support !== 'ok')) && <IphoneGuide />}
        </>
      )}

      {registered && (
        <div className="space-y-1">
          <Switch on={rest} onToggle={toggleRest} title="Rest timer alerts" sub="When rest ends, even if Forgeload is in the background or your phone is locked. This device only." />
          <Switch on={rem.workout_reminders} onToggle={() => patch({ workout_reminders: !rem.workout_reminders })} title="Workout reminders"
            sub={mode === 'weekly' ? 'On your scheduled training days.' : 'On the days you pick below. It shows your next workout; it never skips one.'} />
          {rem.workout_reminders && (
            <div className="mb-2 ml-1 space-y-2 border-l-2 border-fl-line pl-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Remind me at</span>
                <input type="time" value={rem.reminder_time} onChange={e => e.target.value && patch({ reminder_time: e.target.value })} className="h-10 rounded-lg border border-fl-field bg-fl-s2 px-2 text-fl-tx" />
              </label>
              {mode === 'rotation' && (
                <div role="group" aria-label="Reminder days" className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d, i) => {
                    const on = rem.reminder_days.includes(i);
                    return <button key={d} aria-pressed={on} onClick={() => patch({ reminder_days: on ? rem.reminder_days.filter(x => x !== i) : [...rem.reminder_days, i].sort() })}
                      className={`h-9 min-w-11 rounded-full border px-3 text-sm font-semibold ${on ? 'border-fl-acc bg-fl-tint' : 'border-fl-line bg-fl-s2 text-fl-tx2'}`}>{d}</button>;
                  })}
                </div>
              )}
              {mode === 'rotation' && rem.reminder_days.length === 0 && <p className="text-xs text-fl-tx2">Pick at least one day.</p>}
            </div>
          )}
          {hasWorkout
            ? <Switch on={rem.comeback} onToggle={() => patch({ comeback: !rem.comeback })} title="Comeback reminders" sub="If a week goes by without a workout, one friendly nudge, and at most one more a week later." />
            : <p className="py-2 text-sm text-fl-tx2"><span className="font-semibold text-fl-tx">Comeback reminders</span> become available after your first workout.</p>}
          <p className="pt-1 text-xs text-fl-tx2">Reminders go to every device where notifications are on.</p>
          <div className="flex gap-2 pt-2">
            <button onClick={test} disabled={busy} className="h-11 flex-1 rounded-xl bg-fl-s2 font-semibold disabled:opacity-60">Send test notification</button>
            <button onClick={disable} disabled={busy} className="h-11 rounded-xl px-3 text-sm font-semibold text-fl-tx2">Turn off here</button>
          </div>
        </div>
      )}

      <div className="mt-2 border-t border-fl-line pt-2">
        <Switch on={beep} onToggle={() => { setBeep(!beep); setBeepOn(!beep); }} title="Beep when rest ends" sub="While Forgeload is open on screen. No permission needed." />
      </div>
      {note && <p role={note.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${note.ok ? 'text-fl-ok' : 'text-fl-bad'}`}>{note.ok ? '' : '⚠ '}{note.text}</p>}
    </section>
  );
}
