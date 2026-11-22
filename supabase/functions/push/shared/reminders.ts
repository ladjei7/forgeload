// Notification rules: daily workout reminders, comeback nudges and rest-timer alert timing.
// Pure functions: no database, no UI, no network. The server (supabase/functions/push) and the app
// both use them, and tests/reminders.test.ts covers them.
//
// Lock-screen copy stays simple and never shows lifting numbers: those stay inside the app.
import { occurrencesForWeek, type Schedule } from './schedule.ts';
import { RULES } from './rules.ts';

/** Local calendar date ('YYYY-MM-DD'), minutes since midnight and weekday (0 = Monday) in a time zone. */
export function localNow(now: Date, timeZone: string): { date: string; minutes: number; weekday: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(now);
  } catch {
    return localNow(now, 'UTC'); // unknown zone name: fall back rather than fail the whole run
  }
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')), weekday: wd };
}

/** 'HH:MM' -> minutes since midnight (null if malformed). */
export function parseTime(t: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)/.exec(t ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Whole days from date a to date b ('YYYY-MM-DD'). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
}

export type ReminderPrefs = {
  workoutReminders: boolean;
  comeback: boolean;
  reminderTime: string;   // 'HH:MM' local
  reminderDays: number[]; // Flexible Rotation only: 0 = Monday ... 6 = Sunday
  timezone: string;
};

export type ReminderState = {
  schedule: Schedule | null;          // the current plan's schedule (null = no plan)
  dayNames: Record<string, string>;   // workout day id -> name
  rotationNextDayId: string | null;   // next workout in the rotation (never advanced by a reminder)
  lastCompletedDate: string | null;   // local date of the most recent completed workout, any plan
  completedDates: string[];           // local dates with a completed workout (recent ones are enough)
  sentReminderToday: boolean;
  sentComebackToday: boolean;
  comebacksSinceLastWorkout: number;  // comeback messages already sent since the last completed workout
};

export type Message = { kind: 'reminder' | 'comeback'; title: string; body: string; url: string };

/**
 * What to send right now, if anything. Called every few minutes; a message is due once the local time
 * reaches the person's reminder time and stays due for RULES.push.dueWindowMinutes (so one missed run
 * doesn't lose it). The send log (sent*Today) makes sure it goes out once.
 *
 *  - Workout reminder: Weekly Schedule -> only on days with a planned workout. Flexible Rotation -> only
 *    on the days the person picked, and it names the next workout in the rotation. Never sent if a
 *    workout is already completed today. Never advances the rotation.
 *  - Comeback: only for people with at least one completed workout, after RULES.push.comebackDays
 *    without one; one follow-up a week later at most, then nothing until they train again.
 *  - Both due on the same day: send one message (the comeback one).
 */
export function decide(now: Date, prefs: ReminderPrefs, s: ReminderState): Message | null {
  const local = localNow(now, prefs.timezone);
  const at = parseTime(prefs.reminderTime) ?? parseTime(RULES.push.defaultReminderTime)!;
  if (local.minutes < at || local.minutes >= at + RULES.push.dueWindowMinutes) return null;
  if (s.completedDates.includes(local.date)) return null; // trained today: nothing to remind

  const comeback = comebackDue(prefs, s, local.date);
  if (comeback) return comeback;

  if (!prefs.workoutReminders || s.sentReminderToday || !s.schedule) return null;
  if (s.schedule.mode === 'weekly') {
    const today = occurrencesForWeek(s.schedule, local.date).find(o => o.date === local.date);
    if (!today) return null; // rest day
    const name = s.dayNames[today.dayId];
    return { kind: 'reminder', title: 'Workout day', body: name ? `${name} is planned for today.` : 'You have a workout planned today.', url: '/log' };
  }
  if (!prefs.reminderDays.includes(local.weekday)) return null;
  const next = s.rotationNextDayId ? s.dayNames[s.rotationNextDayId] : null;
  return { kind: 'reminder', title: 'Workout day', body: next ? `Next up: ${next}.` : 'Your next workout is ready.', url: '/log' };
}

function comebackDue(prefs: ReminderPrefs, s: ReminderState, today: string): Message | null {
  if (!prefs.comeback || s.sentComebackToday || !s.lastCompletedDate) return null; // never trained: no nudge
  const away = daysBetween(s.lastCompletedDate, today);
  const { comebackDays, comebackMax } = RULES.push;
  if (s.comebacksSinceLastWorkout >= comebackMax) return null;
  // First at day 7, the follow-up at day 14 (a week later), never on any other day.
  if (away !== comebackDays * (s.comebacksSinceLastWorkout + 1)) return null;
  return { kind: 'comeback', title: 'Ready when you are', body: 'Your next workout is waiting.', url: '/' };
}

// ---- Rest timer alerts ----

/** Send a rest alert now? Only while it's still useful: never early, never more than maxLateSeconds late. */
export function restAlertAction(dueAtMs: number, nowMs: number): 'wait' | 'send' | 'expire' {
  if (nowMs < dueAtMs - RULES.push.restEarlyMs) return 'wait';
  if (nowMs > dueAtMs + RULES.push.restMaxLateSeconds * 1000) return 'expire';
  return 'send';
}

/** Push time-to-live: what's left of the useful window, so a late "Rest complete" is dropped by the push service. */
export function restTtlSeconds(dueAtMs: number, nowMs: number): number {
  return Math.max(5, Math.ceil((dueAtMs + RULES.push.restMaxLateSeconds * 1000 - nowMs) / 1000));
}
