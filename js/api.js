// Звʼязок із сервером: ключ приходить у посиланні після # і зберігається лише на цьому телефоні
import { toast } from './ui.js';
import { openDeep, sealBody, setSecret } from './seal.js';

const STORE = 'radovalka:key';
// Половина цього телефону — щоб index.html увімкнув тему ще до першого кадру
const SIDE = 'radovalka:side';
const LOCAL = ['127.0.0.1', 'localhost'].includes(location.hostname);

export const API = LOCAL ? 'http://127.0.0.1:8787' : 'https://raduvalka.vitaliy-lobko.workers.dev';

// Ключ із посилання «…/#ключ.секрет», «…/#ключ» (чи старого «…#k=ключ») або просто ключ
export function parseKey(text) {
  const s = String(text || '').trim();
  const m = s.match(/(?:^|#)([A-Za-z0-9_-]{20,}).[A-Za-z0-9_-]{43}$/)
    || s.match(/[#&?]k=([A-Za-z0-9_-]{20,})/)
    || s.match(/#([A-Za-z0-9_-]{20,})$/)
    || s.match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

// Секрет шифрування — друга частина посилання після крапки; на сервер не йде
export function parseSecret(text) {
  const m = String(text || '').trim().match(/(?:^|#)[A-Za-z0-9_-]{20,}.([A-Za-z0-9_-]{43})$/);
  return m ? m[1] : null;
}

export function getKey() {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
}

export function setKey(key) {
  try {
    if (key) localStorage.setItem(STORE, key);
    else { localStorage.removeItem(STORE); localStorage.removeItem(ALT); localStorage.removeItem(SIDE); }
  } catch { /* приватний режим — ключ житиме до закриття вкладки */ }
}

export function rememberSide(side) {
  try {
    localStorage.setItem(SIDE, side);
  } catch { /* приватний режим — тема прийде з сервера, як раніше */ }
}

// Другий ключ на тому ж телефоні (він перевіряє обидві половини): друге посилання не затирає перший ключ
const ALT = 'radovalka:key2';

export function getAltKey() {
  try {
    return localStorage.getItem(ALT);
  } catch {
    return null;
  }
}

export function swapKeys() {
  const key = getKey();
  const alt = getAltKey();
  if (!key || !alt) return;
  try {
    localStorage.setItem(STORE, alt);
    localStorage.setItem(ALT, key);
    // Другий ключ — друга половина
    const side = localStorage.getItem(SIDE);
    if (side) localStorage.setItem(SIDE, side === 'vin' ? 'vona' : 'vin');
  } catch { /* без сховища перемикати нічого */ }
}

// Ключ з адреси одразу прибираємо, щоб він не лишився в історії та на скриншотах
export function takeKeyFromUrl() {
  const key = parseKey(location.hash);
  if (!key) return;
  const old = getKey();
  try {
    if (old && old !== key) { localStorage.setItem(ALT, old); localStorage.removeItem(SIDE); }
  } catch { /* приватний режим */ }
  setKey(key);
  setSecret(parseSecret(location.hash));
  history.replaceState(null, '', location.pathname + location.search);
}

async function request(path, init = {}) {
  const res = await fetch(`${API}/api/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${getKey()}`, ...(init.headers || {}) },
  });
  if (!res.ok) {
    // Код помилки з тіла ({ error }), щоб розрізнити причини з однаковим статусом
    const code = await res.json().then((j) => j?.error || '').catch(() => '');
    throw Object.assign(new Error(`api ${res.status}`), { status: res.status, code });
  }
  return res;
}

// Читання без зв'язку: останні відповіді цих запитів лежать у кеші телефона (Cache Storage — не localStorage:
// його 5 МБ ділять усі застосунки на цьому сайті). Нема мережі — віддаємо збережене і кажемо, що це воно
const DATA_CACHE = 'data-radovalka';
const OFFLINE_PATHS = /^(boot|letter|envelopes|feed|plans|wishes)$/;
let offline = false;
export const isOffline = () => offline;

function setOffline(v) {
  if (offline === v) return;
  offline = v;
  document.dispatchEvent(new CustomEvent('radovalka:offline', { detail: v }));
}

// Кожна половина (на одному телефоні може бути дві) — своє збережене; ключ у назву не кладемо, лише його відбиток
let printFor = '';
let print = '';
async function keyPrint() {
  const key = getKey() || '';
  if (printFor !== key) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    print = Array.from(new Uint8Array(hash).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
    printFor = key;
  }
  return print;
}
const dataUrl = async (path) => `${API}/api/${path}?saved=${await keyPrint()}`;

export async function get(path) {
  if (!OFFLINE_PATHS.test(path) || !self.caches) return openDeep(await (await request(path)).json());
  try {
    const text = await (await request(path)).text();
    caches.open(DATA_CACHE).then(async (c) => c.put(await dataUrl(path), new Response(text))).catch(() => {});
    setOffline(false);
    // У кеші — як прийшло (зашифроване); розшифровуємо лише в памʼяті
    return openDeep(JSON.parse(text));
  } catch (e) {
    // Сервер відповів помилкою (401, 500) — це не «нема зв'язку», старе не підсовуємо
    if (e.status) throw e;
    const hit = await caches.open(DATA_CACHE).then(async (c) => c.match(await dataUrl(path))).catch(() => null);
    if (!hit) throw e;
    setOffline(true);
    return openDeep(await hit.json());
  }
}

// Вихід на цьому телефоні — збережені листи теж геть
export const forgetSaved = () => (self.caches ? caches.delete(DATA_CACHE).catch(() => {}) : Promise.resolve());

// Запит, результат якого потрібен одразу (надіслати, видалити): помилку ловить той, хто кличе.
// timeout — для черги без зв'язку: на слабкому сигналі fetch висить хвилинами, обрив = «нема зв'язку» (без status)
export async function send(path, method, plain, { timeout } = {}) {
  const body = await sealBody(path, plain);
  const ctl = timeout ? new AbortController() : null;
  const timer = ctl && setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await request(path, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(ctl ? { signal: ctl.signal } : {}),
    });
    return await openDeep(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

// Файл із ключем, без кешу (голос «Нужна помощь» у телефоні не зберігаємо)
export async function getBlob(path) {
  return (await request(path, { cache: 'no-store' })).blob();
}

// Запис — у фоні: інтерфейс уже показав зміну, сервер лише наздоганяє
export async function save(path, plain) {
  const body = await sealBody(path, plain);
  return request(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => toast('Не сохранилось — нет связи'));
}

// Фото з версією (час заливки) живуть у кеші телефона: та сама версія — без мережі й без перевірок.
// Назва кешу — не з префіксів інших застосунків на цьому сайті, їх activate її не прибере
const IMG_CACHE = 'img-radovalka';
const imgKey = (name, v) => `${API}/api/img/${name}?v=${v}`;

export async function imageUrl(name, v) {
  if (!v || !self.caches) return URL.createObjectURL(await (await request(`img/${name}`)).blob());
  const cache = await caches.open(IMG_CACHE).catch(() => null);
  const hit = await cache?.match(imgKey(name, v)).catch(() => null);
  if (hit) return URL.createObjectURL(await hit.blob());
  const blob = await (await request(`img/${name}?v=${v}`)).blob();
  cache?.put(imgKey(name, v), new Response(blob, { headers: { 'content-type': blob.type } })).catch(() => {});
  return URL.createObjectURL(blob);
}

// Лише з кешу телефона, без мережі: нема — null
export async function cachedImageUrl(name, v) {
  if (!v || !self.caches) return null;
  try {
    const hit = await (await caches.open(IMG_CACHE)).match(imgKey(name, v));
    return hit ? URL.createObjectURL(await hit.blob()) : null;
  } catch {
    return null;
  }
}

// Прибрати з кешу старі версії: keep — пари [імʼя, версія], які зараз потрібні
export async function dropStaleImages(keep) {
  try {
    const want = new Set(keep.filter(([, v]) => v).map(([n, v]) => imgKey(n, v)));
    const cache = await caches.open(IMG_CACHE);
    for (const req of await cache.keys()) if (!want.has(req.url)) await cache.delete(req);
  } catch { /* кеш недоступний — нічого прибирати */ }
}

// POST, відповідь якого — файл (фото товару через Worker)
export async function postBlob(path, body) {
  const res = await request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.blob();
}
