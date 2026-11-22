// Forgeload service worker: shows notifications and opens the right screen when one is tapped.
// It does not cache pages (offline saving of sets is handled by the app's own outbox).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const received = Date.now();
    let p = {};
    try { p = event.data ? event.data.json() : {}; } catch { p = { title: 'Forgeload', body: event.data ? event.data.text() : '' }; }
    // A rest alert that arrives very late would interrupt the next set: show it quietly instead.
    // (Browsers require a visible notification for every push, so it is never silently dropped.)
    const late = p.kind === 'rest' && p.dueAt && received - p.dueAt > 20000;
    await self.registration.showNotification(p.title || 'Forgeload', {
      body: late ? 'Your rest ended a moment ago.' : (p.body || ''),
      tag: p.kind || 'forgeload',          // a newer alert of the same kind replaces the old one: no stacks
      renotify: !late,
      silent: !!late,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: p.url || '/' },
    });
    // Delivery receipt, used only to measure timing during testing. Never blocks the notification.
    if (p.ack && p.ref && p.token) {
      try {
        await fetch(p.ack, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ack', kind: p.kind, ref: p.ref, token: p.token, receivedAt: received, shown: true, reason: late ? 'late, shown quietly' : '' }) });
      } catch { /* offline: no receipt */ }
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) {
        await w.focus();
        if ('navigate' in w && new URL(w.url).pathname !== url) { try { await w.navigate(url); } catch { /* ignore */ } }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
