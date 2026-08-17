
// ASR notification artwork
const ASR_NOTIFICATION_ICON = '/icons/icon-192.png';
const ASR_NOTIFICATION_BADGE = '/icons/asr-notification-badge.png';

const CACHE_NAME = 'asr-iron-pwa-v5';
const ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/asr-logo.png', '/asr-logo-white.png', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))));
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'ASR Iron', body: event.data ? event.data.text() : 'New notification' }; }

  const title = data.title || 'ASR Iron';
  const options = {
    icon: ASR_NOTIFICATION_ICON,
    badge: ASR_NOTIFICATION_BADGE,
    body: data.body || data.message || 'New ASR Iron notification',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || 'asr-iron-notification',
    data: { url: data.url || '/' },
    vibrate: [120, 60, 120]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
