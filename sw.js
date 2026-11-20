// Service worker Радовалки: тримає оболонку на телефоні, приймає «Поделиться → Радовалка», показує push.
// Оболонка (сторінка, скрипти, стилі, шрифти) — з кешу: старт без мережі й без хвиль перевірок.
// Нову версію застосунок помічає сам (version.js без кешу) і просить updateShell перекачати її цілком
const SHARE_CACHE = 'shared-radovalka';
// Назви — не з префіксів інших застосунків на цьому сайті, їх activate їх не прибере.
// Аварійний вихід, якщо в кеш потрапило зламане: змінити номер — activate прибере старий
const SHELL = 'shell-radovalka-2';
const scope = () => self.registration.scope;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith('shell-radovalka') && k !== SHELL).map((k) => caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method === 'POST' && url.searchParams.get('go') === 'shared') {
    event.respondWith(receiveShare(req));
    return;
  }
  // no-store / reload — свідомо з мережі (перевірка версії); чуже (сервер, гифки) — повз кеш
  if (req.method !== 'GET' || !req.url.startsWith(scope()) || req.cache === 'no-store' || req.cache === 'reload') return;
  // Лише те, що кладе updateShell: сторінка, скрипти, стилі, шрифти (іконки й маніфест — як завжди)
  const navigate = req.mode === 'navigate';
  if (!navigate && !/\.(js|css|woff2)$/.test(url.pathname)) return;
  if (url.pathname.endsWith('/sw.js')) return;
  // Будь-яке відкриття (?go=…, ?hello) — та сама сторінка
  event.respondWith(fromShell(req, navigate ? scope() : url.href.split('#')[0]));
});

// Промах — просто мережа, у кеш НЕ кладемо: дописані поодинці файли могли б змішати версії
// (кеш браузера тримає старі ще 10 хв). Пише в кеш лише updateShell — усю оболонку разом
async function fromShell(req, key) {
  const hit = await (await caches.open(SHELL)).match(key);
  return hit || fetch(req);
}

// Нова версія: спершу качаємо все, і лише коли кожен файл прийшов — кладемо разом.
// Обірвалось — лишається стара оболонка цілою, без суміші старих і нових модулів
// v — версія, яку кладемо. CDN GitHub Pages кілька хвилин після випуску віддає частину файлів старими
// (cache: 'reload' обходить лише кеш браузера) — тоді в кеш лягла б суміш версій і застосунок не стартував би.
// Тому кожен файл — за адресою з міткою версії (її CDN не має, бере свіже), а version.js звіряємо
async function updateShell(urls, v) {
  try {
    const all = [...new Set([scope(), ...urls.filter((u) => u.startsWith(scope()) && !u.endsWith('/sw.js'))])];
    const fresh = (u) => (v ? `${u}${u.includes('?') ? '&' : '?'}shell=${encodeURIComponent(v)}` : u);
    const got = await Promise.all(all.map(async (u) => {
      const res = await fetch(fresh(u), { cache: 'reload' });
      if (!res.ok) throw new Error(u);
      if (v && /\/js\/version\.js$/.test(u) && !(await res.clone().text()).includes(`VERSION = '${v}'`)) throw new Error('stale');
      return [u, res];
    }));
    const cache = await caches.open(SHELL);
    await Promise.all(got.map(([u, res]) => cache.put(u, res)));
    return true;
  } catch {
    return false;
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'update-shell') return;
  event.waitUntil(updateShell(event.data.urls || [], event.data.v).then((ok) => event.ports[0]?.postMessage(ok)));
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
  // Відкрита Радовалка дотягує свіже одразу, не чекаючи перевірки за таймером
  self.clients.matchAll({ type: 'window' }).then((wins) => wins.forEach((w) => w.postMessage({ refresh: true }))).catch(() => {});
  event.waitUntil(self.registration.showNotification(note.title || 'Радовалка', {
    body: note.body || 'Тебе что-то принесли 💌',
    tag: note.tag || 'radovalka',
    renotify: true,
    silent: !!note.silent,
    // «Нужна помощь» висить, доки не відкриють, і довго вібрує
    ...(note.urgent ? { requireInteraction: true, vibrate: [500, 200, 500, 200, 900] } : {}),
    // «🔔 Звоночек» — серцебиття
    ...(note.buzz ? { vibrate: [180, 100, 380, 550, 180, 100, 380, 550, 180, 100, 380, 550, 180, 100, 380] } : {}),
    icon: new URL('icons/icon-192.png', scope).href,
    // «Как ты?»: кнопка «❤️ Я в порядке» прямо в сповіщенні (Android); ok — адреса й разовий токен замість ключа
    ...(Array.isArray(note.actions) ? { actions: note.actions.slice(0, 2) } : {}),
    data: { url: scope, go: note.go || 'letter', ok: note.ok || null },
  }));
});

// Відповідь із кнопки сповіщення: застосунок не відкриваємо, лише коротко підтверджуємо
function answerOk(ok) {
  const icon = new URL('icons/icon-192.png', scope()).href;
  return fetch(ok.url, { method: 'POST', mode: 'no-cors', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ token: ok.token }) })
    .then(() => self.registration.showNotification('Отмечено ❤️', { body: 'Всё хорошо — уже знает', tag: 'ask', silent: true, icon }))
    .catch(() => self.registration.showNotification('Не получилось отметиться', { body: 'Нет связи — открой Радовалку и нажми «Я в порядке»', tag: 'ask', icon }));
}

// Тап по сповіщенню: уже відкриту Радовалку — на передній план, інакше відкрити. Ключ у застосунку, не в адресі
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'ok' && event.notification.data?.ok) { event.waitUntil(answerOk(event.notification.data.ok)); return; }
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const mine = wins.find((w) => w.url.startsWith(self.registration.scope));
    // Листи, мемчики й відповіді — «Письма»; нова хотілка — «Хотелки»; порожній конверт — «Написать» у нього
    const go = event.notification.data?.go || 'letter';
    if (mine) { mine.postMessage({ go }); return mine.focus(); }
    return self.clients.openWindow(go === 'letter' ? url : new URL(`?go=${encodeURIComponent(go)}`, self.registration.scope).href);
  })());
});
