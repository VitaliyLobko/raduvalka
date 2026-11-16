// Звʼязок із сервером: ключ приходить у посиланні після # і зберігається лише на цьому телефоні
import { toast } from './ui.js';

const STORE = 'radovalka:key';
const LOCAL = ['127.0.0.1', 'localhost'].includes(location.hostname);

export const API = LOCAL ? 'http://127.0.0.1:8787' : 'https://raduvalka.vitaliy-lobko.workers.dev';

// Ключ із посилання «…/#ключ» (чи старого «…#k=ключ») або просто ключ
export function parseKey(text) {
  const s = String(text || '').trim();
  const m = s.match(/[#&?]k=([A-Za-z0-9_-]{20,})/)
    || s.match(/#([A-Za-z0-9_-]{20,})$/)
    || s.match(/^([A-Za-z0-9_-]{20,})$/);
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
    else localStorage.removeItem(STORE);
  } catch { /* приватний режим — ключ житиме до закриття вкладки */ }
}

// Ключ з адреси одразу прибираємо, щоб він не лишився в історії та на скриншотах
export function takeKeyFromUrl() {
  const key = parseKey(location.hash);
  if (!key) return;
  setKey(key);
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

export const get = async (path) => (await request(path)).json();

// Запит, результат якого потрібен одразу (надіслати, видалити): помилку ловить той, хто кличе
export async function send(path, method, body) {
  const res = await request(path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json();
}

// Запис — у фоні: інтерфейс уже показав зміну, сервер лише наздоганяє
export function save(path, body) {
  return request(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => toast('Не сохранилось — нет связи'));
}

export async function imageUrl(name) {
  return URL.createObjectURL(await (await request(`img/${name}`)).blob());
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
