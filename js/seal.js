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

// Файли (фото, голос): байти «RAD1» ‖ iv ‖ шифротекст, у base64 як раніше — сервер зберігає їх, не заглядаючи
const MAGIC = [0x52, 0x41, 0x44, 0x31];
const isMagic = (u8) => MAGIC.every((b, i) => u8[i] === b);
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function toB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}
export async function sealBytes(b64) {
  const k = await aes();
  if (!k || typeof b64 !== 'string' || !b64) return b64;
  const raw = fromB64(b64);
  if (isMagic(raw)) return b64;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, raw));
  const out = new Uint8Array(4 + 12 + ct.length);
  out.set(MAGIC);
  out.set(iv, 4);
  out.set(ct, 16);
  return toB64(out);
}
// Прийшов файл: зашифрований — розшифрувати (тип лишається той самий), звичайний — як є
export async function openBlob(blob) {
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (!isMagic(head)) return blob;
  const k = await aes();
  if (!k) return blob;
  try {
    const raw = new Uint8Array(await blob.arrayBuffer());
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(4, 16) }, k, raw.slice(16));
    return new Blob([pt], { type: blob.type });
  } catch { return blob; }
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
// Опис поля: число — текст із межею; 'bin' — файл у base64; { … } — вкладений обʼєкт; [{ … }] — список обʼєктів
const FIELDS = [
  [/^letters(\/[\w-]+)?$/, { text: 4000, quote: 300, reply: 4000 }],
  [/^memes(\/[\w-]+)?$/, { caption: 300, quote: 300, reply: 4000, data: 'bin' }],
  // Ціна хотілки лишається відкритою (сервер тримає її числом)
  [/^wishes(\/[\w-]+)?$/, { title: 120, note: 500, link: 500, img: { data: 'bin' } }],
  // Голос до «Нужна помощь»; місце шифрує sos.js одним рядком loc
  [/^sos\/[\w-]+$/, { audio: { data: 'bin' } }],
  // Своя тема «✊ Спора» (готові теми йдуть ключем preset)
  [/^duel$/, { topic: 60 }],
];
export async function sealBy(spec, v) {
  if (typeof spec === 'number') return typeof v === 'string' && v.trim() && !isSealed(v) ? seal(v.trim().slice(0, spec)) : v;
  if (spec === 'bin') return sealBytes(v);
  if (Array.isArray(spec)) return Array.isArray(v) ? Promise.all(v.map((x) => sealBy(spec[0], x))) : v;
  if (!v || typeof v !== 'object') return v;
  const out = { ...v };
  for (const [f, s] of Object.entries(spec)) if (f in out) out[f] = await sealBy(s, out[f]);
  return out;
}
export async function sealBody(path, body) {
  if (!body || typeof body !== 'object' || !hasSecret()) return body;
  const rule = FIELDS.find(([re]) => re.test(path));
  return rule ? sealBy(rule[1], body) : body;
}

// Файл «як файл»: ті самі RAD1 ‖ iv ‖ шифротекст, але байтами (Blob), без base64 — до 25 МБ
export async function sealFile(blob) {
  const k = await aes();
  if (!k) return blob;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, await blob.arrayBuffer());
  return new Blob([new Uint8Array(MAGIC), iv, ct], { type: 'application/octet-stream' });
}

// Перехід: уже завантажене відкрите фото → зашифрований base64
export async function sealBlob(blob) {
  return sealBytes(toB64(new Uint8Array(await blob.arrayBuffer())));
}
