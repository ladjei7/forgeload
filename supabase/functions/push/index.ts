// Forgeload notifications (Supabase Edge Function, Deno).
//
// Called by:
//   the app (signed-in user's token):  config, subscribe, unsubscribe, rest.schedule, rest.cancel, test
//   the scheduler (x-push-cron secret): rest (alerts due in the next few seconds), daily (reminders)
//   the phone's service worker (token in the message): ack (delivery receipt, for measuring timing)
//
// The VAPID key pair is generated here on first use and kept in Supabase Vault: no person ever sees the
// private key. Rules (when to remind, what to say, when a rest alert is too late) live in shared/, which
// is an exact copy of the app's app/lib files (scripts/sync-push-shared.sh, checked by a test).
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';
import { decide, localNow, restAlertAction, restTtlSeconds, type ReminderPrefs, type ReminderState } from './shared/reminders.ts';
import { nextDayId } from './shared/rotation.ts';
import type { Schedule } from './shared/schedule.ts';
import { RULES } from './shared/rules.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/push`;
const CONTACT = 'https://forgeload.vercel.app';
const WAIT_LIMIT_MS = 120_000; // the function waits for alerts due within 2 minutes; the scheduler covers longer rests

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, Math.max(0, ms)));
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const background = (p: Promise<unknown>) => { if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(p); else void p; };

async function secret(name: string): Promise<string | null> {
  const { data, error } = await admin.rpc('push_secret', { p_name: name });
  if (error) throw new Error('vault: ' + error.message);
  return (data as string | null) ?? null;
}

// ---- keys and sending ----
let appServer: webpush.ApplicationServer | null = null;
async function server(): Promise<webpush.ApplicationServer> {
  if (appServer) return appServer;
  let priv = await secret('push_vapid_private');
  let pub = await secret('push_vapid_public_jwk');
  if (!priv || !pub) {
    const keys = await webpush.generateVapidKeys({ extractable: true });
    const exported = await webpush.exportVapidKeys(keys);
    const appKey = await webpush.exportApplicationServerKey(keys);
    await admin.rpc('push_store_keys', { p_public_key: appKey, p_public_jwk: JSON.stringify(exported.publicKey), p_private_jwk: JSON.stringify(exported.privateKey) });
    priv = await secret('push_vapid_private'); // if two runs raced, both use whichever pair was stored first
    pub = await secret('push_vapid_public_jwk');
  }
  const vapidKeys = await webpush.importVapidKeys({ publicKey: JSON.parse(pub!), privateKey: JSON.parse(priv!) });
  appServer = await webpush.ApplicationServer.new({ contactInformation: CONTACT, vapidKeys });
  return appServer;
}

type SubRow = { id: string; user_id: string; device_id: string; endpoint: string; p256dh: string; auth: string };
type Payload = { kind: 'rest' | 'reminder' | 'comeback' | 'test'; title: string; body: string; url: string; ref: string; token: string; dueAt?: number; sentAt: number; ack: string };

async function sendTo(sub: SubRow, payload: Payload, opts: { ttl: number; urgency: 'high' | 'normal'; topic: string }): Promise<'ok' | 'gone' | string> {
  try {
    const s = (await server()).subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } });
    await s.pushTextMessage(JSON.stringify(payload), {
      ttl: opts.ttl,
      urgency: opts.urgency as unknown as webpush.Urgency, // 'high' asks for immediate delivery
      topic: opts.topic, // a newer message with the same topic replaces an undelivered older one
    });
    await admin.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', sub.id);
    return 'ok';
  } catch (e) {
    if (e instanceof webpush.PushMessageError && e.isGone()) {
      await admin.from('push_subscriptions').update({ gone_at: new Date().toISOString(), rest_alerts: false }).eq('id', sub.id);
      return 'gone';
    }
    return 'error: ' + String((e as Error)?.message ?? e).slice(0, 200);
  }
}

// ---- rest alerts ----
type AlertRow = { id: string; user_id: string; subscription_id: string; due_at: string; ack_token: string };

async function sendRest(a: AlertRow) {
  const due = Date.parse(a.due_at);
  const now = Date.now();
  if (restAlertAction(due, now) === 'expire') {
    await admin.from('rest_alerts').update({ status: 'expired' }).eq('id', a.id);
    return;
  }
  const { data: sub } = await admin.from('push_subscriptions').select('*').eq('id', a.subscription_id).is('gone_at', null).maybeSingle();
  if (!sub) { await admin.from('rest_alerts').update({ status: 'failed', error: 'no subscription' }).eq('id', a.id); return; }
  const r = await sendTo(sub as SubRow, {
    kind: 'rest', title: 'Rest complete', body: 'Time for your next set.', url: '/log',
    ref: a.id, token: a.ack_token, dueAt: due, sentAt: Date.now(), ack: FUNCTION_URL,
  }, { ttl: restTtlSeconds(due, Date.now()), urgency: 'high', topic: 'rest' });
  await admin.from('rest_alerts').update({ status: r === 'ok' ? 'sent' : 'failed', sent_at: new Date().toISOString(), error: r === 'ok' ? null : r }).eq('id', a.id);
}

/** Claim one alert (only if still pending), wait until it's due, send it. Exactly one sender wins the claim. */
async function waitAndSend(id: string, dueMs: number) {
  await sleep(dueMs - Date.now() - RULES.push.restEarlyMs);
  const { data } = await admin.from('rest_alerts').update({ status: 'sending' }).eq('id', id).eq('status', 'pending').select('id, user_id, subscription_id, due_at, ack_token');
  if (data?.length) await sendRest(data[0] as AlertRow);
}

/** Scheduler tick: claim everything due in the next few seconds and send each at its second. */
async function restTick() {
  const soon = new Date(Date.now() + 6000).toISOString();
  const { data } = await admin.from('rest_alerts').update({ status: 'sending' }).eq('status', 'pending').lte('due_at', soon).select('id, user_id, subscription_id, due_at, ack_token');
  await Promise.all((data ?? []).map(async (a: AlertRow) => { await sleep(Date.parse(a.due_at) - Date.now() - RULES.push.restEarlyMs); await sendRest(a); }));
  return data?.length ?? 0;
}

// ---- daily reminders and comebacks ----
async function stateFor(userId: string, tz: string, now: Date): Promise<ReminderState> {
  const { data: plans } = await admin.from('workout_plans').select('id, is_active, created_at').eq('user_id', userId).order('created_at', { ascending: false });
  const plan = (plans ?? []).find(p => p.is_active) ?? plans?.[0] ?? null;
  let schedule: Schedule | null = null; const dayNames: Record<string, string> = {}; let rotationNextDayId: string | null = null;
  const { data: recent } = await admin.from('workout_sessions').select('completed_at, workout_day_id').eq('user_id', userId).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(60);
  if (plan) {
    const { data: days } = await admin.from('workout_days').select('id, day_name, sort_order').eq('plan_id', plan.id).order('sort_order');
    for (const d of days ?? []) dayNames[d.id] = d.day_name;
    const { data: sch } = await admin.from('plan_schedules').select('mode, week_start, slots, since').eq('plan_id', plan.id).maybeSingle();
    schedule = sch ? { mode: sch.mode, weekStart: sch.week_start, slots: sch.slots ?? [], since: sch.since } : { mode: 'rotation', weekStart: 0, slots: [] };
    const ids = (days ?? []).map(d => d.id);
    const { data: pe } = ids.length ? await admin.from('plan_exercises').select('workout_day_id').in('workout_day_id', ids) : { data: [] };
    const hasEx = new Set((pe ?? []).map(r => r.workout_day_id));
    const last = (recent ?? []).find(s => s.workout_day_id && ids.includes(s.workout_day_id));
    rotationNextDayId = nextDayId((days ?? []).map(d => ({ id: d.id })), last?.workout_day_id ?? null, id => hasEx.has(id)); // read only: never advances anything
  }
  const completedDates = (recent ?? []).map(s => localNow(new Date(s.completed_at), tz).date);
  const lastCompleted = recent?.[0]?.completed_at ?? null;
  const today = localNow(now, tz).date;
  const { data: logs } = await admin.from('push_log').select('kind, local_date, sent_at').eq('user_id', userId).in('kind', ['reminder', 'comeback']).order('sent_at', { ascending: false }).limit(20);
  return {
    schedule, dayNames, rotationNextDayId,
    lastCompletedDate: lastCompleted ? localNow(new Date(lastCompleted), tz).date : null,
    completedDates,
    sentReminderToday: (logs ?? []).some(l => l.kind === 'reminder' && l.local_date === today),
    sentComebackToday: (logs ?? []).some(l => l.kind === 'comeback' && l.local_date === today),
    comebacksSinceLastWorkout: (logs ?? []).filter(l => l.kind === 'comeback' && (!lastCompleted || l.sent_at > lastCompleted)).length,
  };
}

async function daily(now = new Date()) {
  const { data: rows } = await admin.from('push_prefs').select('*').or('workout_reminders.eq.true,comeback.eq.true');
  let sent = 0;
  for (const p of rows ?? []) {
    try {
      const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', p.user_id).is('gone_at', null);
      if (!subs?.length) continue;
      const prefs: ReminderPrefs = { workoutReminders: p.workout_reminders, comeback: p.comeback, reminderTime: String(p.reminder_time).slice(0, 5), reminderDays: p.reminder_days ?? [], timezone: p.timezone };
      const msg = decide(now, prefs, await stateFor(p.user_id, p.timezone, now));
      if (!msg) continue;
      const today = localNow(now, p.timezone).date;
      // The log row is the "send once" lock: a second run (or a racing one) fails the unique index and stops.
      const { data: log, error } = await admin.from('push_log').insert({ user_id: p.user_id, kind: msg.kind, local_date: today }).select('id, ack_token').single();
      if (error || !log) continue;
      if (msg.kind === 'comeback' && p.workout_reminders) await admin.from('push_log').insert({ user_id: p.user_id, kind: 'reminder', local_date: today }); // one message that day
      let ok = 0;
      for (const s of subs as SubRow[]) {
        const r = await sendTo(s, { ...msg, ref: String(log.id), token: log.ack_token, sentAt: Date.now(), ack: FUNCTION_URL }, { ttl: 4 * 3600, urgency: 'normal', topic: msg.kind });
        if (r === 'ok') ok++;
      }
      await admin.from('push_log').update({ devices: subs.length, ok }).eq('id', log.id);
      sent++;
    } catch (e) { console.error('daily', p.user_id, e); }
  }
  return sent;
}

// ---- request handling ----
async function userFrom(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // Test-only fake push service: a subscription whose endpoint is this function + ?sink records when a
  // message arrives and with which headers, to measure the server side of rest-alert timing without a phone.
  const url = new URL(req.url);
  if (url.searchParams.has('sink')) {
    const { data: sub } = await admin.from('push_subscriptions').select('user_id, device_id').like('endpoint', `%sink=${url.searchParams.get('sink')}`).maybeSingle();
    if (!sub) return new Response('gone', { status: 410 });
    const encrypted = req.headers.get('content-encoding') === 'aes128gcm' && /^vapid t=/.test(req.headers.get('authorization') ?? '');
    await admin.from('push_acks').insert({ user_id: sub.user_id, kind: 'test', ref: 'sink', device_id: sub.device_id, shown: encrypted,
      reason: `ttl=${req.headers.get('ttl')} urg=${req.headers.get('urgency')} topic=${req.headers.get('topic')}`.slice(0, 60) });
    return new Response(null, { status: 201 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const action = String(body.action ?? '');

  try {
    // Scheduler
    if (action === 'rest' || action === 'daily') {
      const cron = await secret('push_cron_secret');
      if (!cron || req.headers.get('x-push-cron') !== cron) return json({ error: 'forbidden' }, 403);
      if (action === 'rest') return json({ claimed: await restTick() });
      return json({ sent: await daily() });
    }

    // Delivery receipt from a phone (no sign-in in a service worker; the message's token proves it).
    if (action === 'ack') {
      const kind = String(body.kind); const ref = String(body.ref); const token = String(body.token);
      let userId: string | null = null; let due: number | null = null; let sentAt: number | null = Number(body.sentAt) || null;
      if (kind === 'rest') {
        const { data } = await admin.from('rest_alerts').select('user_id, due_at, ack_token').eq('id', ref).maybeSingle();
        if (data && data.ack_token === token) { userId = data.user_id; due = Date.parse(data.due_at); }
      } else {
        const { data } = await admin.from('push_log').select('user_id, sent_at, ack_token').eq('id', Number(ref)).maybeSingle();
        if (data && data.ack_token === token) { userId = data.user_id; sentAt = Date.parse(data.sent_at); }
      }
      if (!userId) return json({ error: 'unknown' }, 404);
      const received = Number(body.receivedAt) || Date.now();
      await admin.from('push_acks').insert({
        user_id: userId, kind, ref, device_id: String(body.deviceId ?? '').slice(0, 64) || null,
        due_at: due ? new Date(due).toISOString() : null, received_at: new Date(received).toISOString(),
        delay_ms: Math.round(received - (due ?? sentAt ?? received)), shown: !!body.shown, reason: String(body.reason ?? '').slice(0, 60) || null,
      });
      return json({ ok: true });
    }

    // Everything else: the signed-in person, for their own devices only.
    const userId = await userFrom(req);
    if (!userId) return json({ error: 'sign in' }, 401);
    const deviceId = String(body.deviceId ?? '');
    const mySub = async () => (await admin.from('push_subscriptions').select('*').eq('user_id', userId).eq('device_id', deviceId).is('gone_at', null).maybeSingle()).data as (SubRow & { rest_alerts: boolean }) | null;

    if (action === 'config') {
      await server();
      const { data } = await admin.from('push_config').select('vapid_public_key').eq('id', 1).single();
      return json({ publicKey: data?.vapid_public_key });
    }

    if (action === 'subscribe') {
      const s = body.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined;
      if (!deviceId || !s?.endpoint?.startsWith('https://') || !s.keys?.p256dh || !s.keys?.auth) return json({ error: 'bad subscription' }, 400);
      // A phone shared between accounts: the browser keeps one endpoint, so it belongs to whoever enabled last.
      await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint).neq('user_id', userId);
      const { error } = await admin.from('push_subscriptions').upsert({
        user_id: userId, device_id: deviceId, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth,
        platform: String(body.platform ?? '').slice(0, 40) || null, gone_at: null, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,device_id' });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'unsubscribe') {
      await admin.from('push_subscriptions').delete().eq('user_id', userId).eq('device_id', deviceId);
      return json({ ok: true });
    }

    if (action === 'rest.schedule') {
      const sub = await mySub();
      if (!sub || !sub.rest_alerts) return json({ ok: false, reason: 'off' });
      const dueMs = Number(body.dueAt);
      if (!Number.isFinite(dueMs) || dueMs < Date.now() - 1000 || dueMs > Date.now() + 15 * 60_000) return json({ error: 'bad time' }, 400);
      // Supersede: one pending alert per device. Cancel the old one, then add the new one.
      await admin.from('rest_alerts').update({ status: 'cancelled' }).eq('subscription_id', sub.id).eq('status', 'pending');
      const { data: a, error } = await admin.from('rest_alerts').insert({
        user_id: userId, subscription_id: sub.id, session_id: typeof body.sessionId === 'string' ? body.sessionId : null, due_at: new Date(dueMs).toISOString(),
      }).select('id').single();
      if (error || !a) return json({ error: error?.message ?? 'insert failed' }, 409);
      if (dueMs - Date.now() <= WAIT_LIMIT_MS) background(waitAndSend(a.id, dueMs));
      return json({ ok: true, id: a.id });
    }

    if (action === 'rest.cancel') {
      const sub = await mySub();
      if (sub) await admin.from('rest_alerts').update({ status: 'cancelled' }).eq('subscription_id', sub.id).eq('status', 'pending');
      return json({ ok: true });
    }

    if (action === 'test') {
      const sub = await mySub();
      if (!sub) return json({ ok: false, reason: 'not-enabled' });
      const { data: log } = await admin.from('push_log').insert({ user_id: userId, kind: 'test', local_date: new Date().toISOString().slice(0, 10) }).select('id, ack_token').single();
      const r = await sendTo(sub, { kind: 'test', title: 'Forgeload', body: 'Notifications are working.', url: '/settings', ref: String(log!.id), token: log!.ack_token, sentAt: Date.now(), ack: FUNCTION_URL }, { ttl: 300, urgency: 'high', topic: 'test' });
      await admin.from('push_log').update({ devices: 1, ok: r === 'ok' ? 1 : 0 }).eq('id', log!.id);
      return json({ ok: r === 'ok', result: r });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    console.error(action, e);
    return json({ error: 'server error' }, 500);
  }
});
