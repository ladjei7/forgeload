// Notifications on this device: permission, subscription, rest alerts, reminder settings, test.
// Everything here is best effort: it never blocks or slows down logging a workout.
import { supabase } from './supabase';

const DEVICE_KEY = 'fl-device-id';
const BEEP_KEY = 'fl-rest-beep';

export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, ''); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch { return 'nostorage00'; }
}

export type PushSupport = 'ok' | 'ios-needs-home-screen' | 'unsupported';

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  const has = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (isIos() && !isStandalone()) return 'ios-needs-home-screen'; // iPhone: only after Add to Home Screen
  return has ? 'ok' : 'unsupported';
}
export function permission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

async function call<T = Record<string, unknown>>(action: string, extra: Record<string, unknown> = {}): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke('push', { body: { action, deviceId: deviceId(), ...extra } });
  if (error) return null;
  return data as T;
}

const b64ToBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

/** Call from a tap ("Enable notifications"): asks the system for permission, then registers this device. */
export async function enableNotifications(): Promise<{ ok: boolean; message?: string }> {
  const support = pushSupport();
  if (support === 'ios-needs-home-screen') return { ok: false, message: 'On iPhone, add Forgeload to your Home Screen first (steps below).' };
  if (support === 'unsupported') return { ok: false, message: "This browser can't show notifications." };
  const p = await Notification.requestPermission();
  if (p !== 'granted') return { ok: false, message: p === 'denied' ? 'Notifications are blocked. Turn them on for Forgeload in your phone settings, then try again.' : 'Notifications were not allowed.' };
  try {
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const cfg = await call<{ publicKey?: string }>('config');
    if (!cfg?.publicKey) return { ok: false, message: 'Could not reach the server. Check your connection and try again.' };
    let sub = await reg.pushManager.getSubscription();
    if (sub && !keyMatches(sub, cfg.publicKey)) { await sub.unsubscribe(); sub = null; }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(cfg.publicKey) });
    const saved = await call<{ ok?: boolean }>('subscribe', { subscription: sub.toJSON(), platform: isIos() ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'other' });
    return saved?.ok ? { ok: true } : { ok: false, message: 'Could not save this device. Try again.' };
  } catch (e) {
    return { ok: false, message: 'Could not turn on notifications: ' + String((e as Error)?.message ?? e).slice(0, 120) };
  }
}

function keyMatches(sub: PushSubscription, publicKey: string): boolean {
  const k = sub.options?.applicationServerKey;
  if (!k) return true;
  const a = new Uint8Array(k as ArrayBuffer), b = b64ToBytes(publicKey);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Turn notifications off on this device (reminder settings on the account stay as they are). */
export async function disableNotifications(): Promise<void> {
  try { const reg = await navigator.serviceWorker.getRegistration('/'); const sub = await reg?.pushManager.getSubscription(); await sub?.unsubscribe(); } catch { /* ignore */ }
  await call('unsubscribe');
}

/** Is this device registered (permission granted and a subscription exists)? */
export async function deviceRegistered(): Promise<boolean> {
  if (pushSupport() !== 'ok' || permission() !== 'granted') return false;
  try { const reg = await navigator.serviceWorker.getRegistration('/'); return !!(await reg?.pushManager.getSubscription()); } catch { return false; }
}

export async function sendTest(): Promise<{ ok: boolean; message: string }> {
  const r = await call<{ ok?: boolean; reason?: string; result?: string }>('test');
  if (r?.ok) return { ok: true, message: 'Sent. It should arrive in a few seconds.' };
  if (r?.reason === 'not-enabled') return { ok: false, message: 'Turn on notifications on this device first.' };
  return { ok: false, message: 'Could not send a test. Check your connection and try again.' };
}

// ---- rest timer alerts (this device only) ----

export async function restAlertsOn(): Promise<boolean> {
  const { data } = await supabase.from('push_subscriptions').select('rest_alerts').eq('device_id', deviceId()).maybeSingle();
  return !!data?.rest_alerts;
}
export async function setRestAlerts(on: boolean): Promise<boolean> {
  const { error, count } = await supabase.from('push_subscriptions').update({ rest_alerts: on, updated_at: new Date().toISOString() }, { count: 'exact' }).eq('device_id', deviceId());
  return !error && (count ?? 0) > 0;
}
/** Ask the server to alert this device when rest ends. Replaces any earlier alert. */
export function scheduleRestAlert(endMs: number, sessionId: string | null): void {
  void call('rest.schedule', { dueAt: endMs, sessionId }).catch(() => {});
}
export function cancelRestAlert(): void {
  void call('rest.cancel').catch(() => {});
}

// ---- reminders (account-wide) ----

export type ReminderSettings = { workout_reminders: boolean; comeback: boolean; reminder_time: string; reminder_days: number[]; timezone: string };
export const DEFAULT_REMINDERS: ReminderSettings = { workout_reminders: false, comeback: false, reminder_time: '17:00', reminder_days: [], timezone: 'America/Chicago' };

export const localTimezone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'; } catch { return 'America/Chicago'; } };

export async function loadReminders(): Promise<ReminderSettings> {
  const { data } = await supabase.from('push_prefs').select('workout_reminders, comeback, reminder_time, reminder_days, timezone').maybeSingle();
  return data ? { ...data, reminder_time: String(data.reminder_time).slice(0, 5) } as ReminderSettings : { ...DEFAULT_REMINDERS, timezone: localTimezone() };
}
export async function saveReminders(s: Partial<ReminderSettings>): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { error } = await supabase.from('push_prefs').upsert({ user_id: u.user.id, ...s, timezone: localTimezone(), updated_at: new Date().toISOString() });
  return !error;
}

// ---- in-app beep (works while Forgeload is on screen; no permission needed) ----

export function beepOn(): boolean { try { return localStorage.getItem(BEEP_KEY) !== 'off'; } catch { return true; } }
export function setBeepOn(on: boolean) { try { localStorage.setItem(BEEP_KEY, on ? 'on' : 'off'); } catch { /* ignore */ } }

let ctx: AudioContext | null = null;
/** Call from a tap (for example "Log set") so the phone allows sound later. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* ignore */ }
}
export function beep() {
  try {
    navigator.vibrate?.([200, 100, 200]);
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [i, f] of [880, 1175].entries()) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t + i * 0.22); g.gain.exponentialRampToValueAtTime(0.35, t + i * 0.22 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.22 + 0.18);
      o.connect(g).connect(ctx.destination); o.start(t + i * 0.22); o.stop(t + i * 0.22 + 0.2);
    }
  } catch { /* ignore */ }
}

/**
 * Keep the server's copy of this device's subscription current (browsers can rotate it). Runs at most
 * once a day after sign-in, only if notifications are already allowed. Never asks for permission.
 */
export async function refreshSubscription(): Promise<void> {
  try {
    if (pushSupport() !== 'ok' || permission() !== 'granted') return;
    const last = Number(localStorage.getItem('fl-push-refreshed') ?? 0);
    if (Date.now() - last < 24 * 3600 * 1000) return;
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const r = await call<{ ok?: boolean }>('subscribe', { subscription: sub.toJSON(), platform: isIos() ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'other' });
    if (r?.ok) localStorage.setItem('fl-push-refreshed', String(Date.now()));
  } catch { /* best effort */ }
}
