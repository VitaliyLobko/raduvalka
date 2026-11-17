// Service worker Радовалки: приймає «Поделиться → Радовалка» і показує push-сповіщення.
// Оболонку НЕ кешує — оновлення приходять самі, як і без нього
const SHARE_CACHE = 'shared-radovalka';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.searchParams.get('go') === 'shared') {
    event.respondWith(receiveShare(event.request));
  }
});

// Картинку чи посилання — у свій кеш (назва не з префіксів інших застосунків на цьому ж сайті, їх activate її не зачепить),
// застосунок забере її за ?go=shared після входу
async function receiveShare(request) {
  try {
    const data = await request.formData();
    const file = data.get('image');
    const cache = await caches.open(SHARE_CACHE);
    const link = [data.get('url'), data.get('text'), data.get('title')].map((x) => String(x || '')).join(' ').trim();
    if (file && file.size) {
      await cache.put('shared', new Response(file, { headers: { 'Content-Type': file.type || 'image/jpeg' } }));
    } else if (/https?:\/\//i.test(link)) {
      // Посилання з магазину — стане новою хотілкою
      await cache.put('shared-link', new Response(link));
    } else {
      await cache.put('shared-none', new Response('1'));
    }
  } catch { /* не вийшло — застосунок просто відкриється */ }
  return Response.redirect(new URL('?go=shared', self.registration.scope).href, 303);
}

// Push: сповіщення показуємо завжди, навіть якщо вміст не розібрався, — інакше Chrome покаже свою заглушку
self.addEventListener('push', (event) => {
  let note = {};
  try {
    note = event.data ? event.data.json() : {};
  } catch { /* лишаємо загальний текст */ }
  const scope = self.registration.scope;
  event.waitUntil(self.registration.showNotification(note.title || 'Радовалка', {
    body: note.body || 'Тебе что-то принесли 💌',
    tag: note.tag || 'radovalka',
    renotify: true,
    silent: !!note.silent,
    icon: new URL('icons/icon-192.png', scope).href,
    data: { url: scope, go: note.go || 'letter' },
  }));
});

// Тап по сповіщенню: уже відкриту Радовалку — на передній план, інакше відкрити. Ключ у застосунку, не в адресі
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const mine = wins.find((w) => w.url.startsWith(self.registration.scope));
    // Листи, мемчики й відповіді — «Письма»; нова хотілка — «Хотелки»
    const go = event.notification.data?.go || 'letter';
    if (mine) { mine.postMessage({ go }); return mine.focus(); }
    return self.clients.openWindow(go === 'letter' ? url : new URL(`?go=${go}`, self.registration.scope).href);
  })());
});
