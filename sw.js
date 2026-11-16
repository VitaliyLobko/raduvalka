// Service worker Радовалки: поки лише приймає «Поделиться → Радовалка».
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
