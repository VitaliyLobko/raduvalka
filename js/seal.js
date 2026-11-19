// Наскрізне шифрування: спільний секрет двох телефонів (частина посилання після «ключ.»), на сервер не потрапляє.
// AES-GCM 256, рядок «e1.» + base64url(iv ‖ шифротекст). Сервер і кеш телефона бачать лише такі рядки.
// Старі листи без «e1.» читаються як є — так перехід поступовий.
// ponytail: секрет лежить у сховищі телефона відкрито; загорнути його PIN-ом замка — наступний крок
const STORE = 'radovalka:secret';
const PREFIX = 'e1.';
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export const SECRET_RE = /^[A-Za-z0-9_-]{43}$/;
export const LOCKED_TEXT = '🔒 Зашифровано. Открой Радовалку по новой ссылке, чтобы прочитать';

export function getSecret() {
  try { return localStorage.getItem(STORE); } catch { return null; }
}
export function setSecret(s) {
  if (!SECRET_RE.test(String(s || ''))) return;
  try { localStorage.setItem(STORE, s); } catch { /* приватне вікно — шифрування до закриття вкладки не буде */ }
  keyFor = '';
}
export function forgetSecret() {
  try { localStorage.removeItem(STORE); } catch { /* нічого */ }
  keyFor = '';
}
export const hasSecret = () => !!getSecret();
export const isSealed = (v) => typeof v === 'string' && v.startsWith(PREFIX);

let keyFor = '';
let key = null;
async function aes() {
  const s = getSecret();
  if (!s) return null;
  if (keyFor !== s) {
    key = await crypto.subtle.importKey('raw', unb64u(s), 'AES-GCM', false, ['encrypt', 'decrypt']);
    keyFor = s;
  }
  return key;
}

export async function seal(text) {
  const k = await aes();
  if (!k || typeof text !== 'string' || !text || isSealed(text)) return text;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(text)));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return PREFIX + b64u(out);
}

export async function open(v) {
  if (!isSealed(v)) return v;
  const k = await aes();
  if (!k) return LOCKED_TEXT;
  try {
    const raw = unb64u(v.slice(PREFIX.length));
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, k, raw.slice(12)));
  } catch { return LOCKED_TEXT; }
}

// Усе, що прийшло із сервера: будь-який рядок «e1.…» (будь-де у відповіді) — розшифрувати на місці
export async function openDeep(x) {
  if (isSealed(x)) return open(x);
  if (Array.isArray(x)) return Promise.all(x.map(openDeep));
  if (x && typeof x === 'object') {
    await Promise.all(Object.keys(x).map(async (k) => { x[k] = await openDeep(x[k]); }));
  }
  return x;
}

// Що шифрувати при відправці: шлях запиту → поля тіла з межею довжини. Обрізаємо ДО шифрування —
// сервер шифротекст не ріже (раніше різав відкритий текст за тими ж межами)
const FIELDS = [
  [/^letters(\/[\w-]+)?$/, { text: 4000, quote: 300, reply: 4000 }],
  [/^memes(\/[\w-]+)?$/, { caption: 300, quote: 300, reply: 4000 }],
  // Ціна хотілки лишається відкритою (сервер тримає її числом)
  [/^wishes(\/[\w-]+)?$/, { title: 120, note: 500, link: 500 }],
];
export async function sealBody(path, body) {
  if (!body || typeof body !== 'object' || !hasSecret()) return body;
  const rule = FIELDS.find(([re]) => re.test(path));
  if (!rule) return body;
  const out = { ...body };
  for (const [f, max] of Object.entries(rule[1])) {
    if (typeof out[f] === 'string' && out[f].trim() && !isSealed(out[f])) out[f] = await seal(out[f].trim().slice(0, max));
  }
  return out;
}
