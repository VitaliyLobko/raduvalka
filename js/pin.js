// Замок на вхід: PIN (4–6 цифр) або відбиток. Питає при кожному запуску й коли Радовалка була у фоні довше 30 с.
// PIN ніде не лежить: лише перевірочний запис (PBKDF2 → AES-GCM). На екрані замка — «Нужна помощь»: у біді PIN не заважає.
// ponytail: замок — на рівні екрана; дані на телефоні ще не зашифровані ним — це зробить наскрізне шифрування
import { h, toast } from './ui.js';
import { writeDecor } from './depth.js';
import { planetsSvg } from './planets.js';

const STORE = 'radovalka:pin';
const FAILS = 'radovalka:pin-fails';
const AWAY = 30 * 1000;
const ITER = 310000;
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));

function read() {
  try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; }
}
function write(v) {
  try { if (v) localStorage.setItem(STORE, JSON.stringify(v)); else localStorage.removeItem(STORE); } catch { /* приватне вікно — замка не буде */ }
}
export const hasPin = () => !!read()?.ct;
export const hasBio = () => !!read()?.bio;

async function keyFrom(pin, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function setPin(pin) {
  const salt = rnd(16);
  const iv = rnd(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(pin, salt), enc.encode('radovalka'));
  write({ ...read(), salt: b64u(salt), iv: b64u(iv), ct: b64u(ct) });
}

async function checkPin(pin) {
  const s = read();
  if (!s?.ct) return true;
  try {
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(s.iv) }, await keyFrom(pin, unb64u(s.salt)), unb64u(s.ct));
    return true;
  } catch { return false; }
}

export function clearPin() {
  write(null);
  try { localStorage.removeItem(FAILS); } catch { /* нічого */ }
}

// 5 помилок — пауза 30 с, далі вдвічі довша за кожні наступні 5
function fails() {
  try { return JSON.parse(localStorage.getItem(FAILS) || '{"n":0,"until":0}'); } catch { return { n: 0, until: 0 }; }
}
function noteFail() {
  const f = fails();
  f.n += 1;
  if (f.n % 5 === 0) f.until = Date.now() + 30000 * 2 ** (f.n / 5 - 1);
  try { localStorage.setItem(FAILS, JSON.stringify(f)); } catch { /* нічого */ }
  return f;
}

// Відбиток: ключ доступу цього телефона (WebAuthn, «на цьому пристрої»). Успішна перевірка = вхід
// Частина Android-телефонів відповідає «нема» навіть із відбитком (застосунок з іконки, старий Play Services) —
// тож кнопку показуємо, щойно браузер узагалі вміє ключі доступу; не вийде — скажемо чому
export async function bioAvailable() {
  return !!window.PublicKeyCredential && !!navigator.credentials?.create;
}
export async function enableBio() {
  const cred = await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Радовалка', id: location.hostname },
      user: { id: rnd(16), name: 'radovalka', displayName: 'Радовалка' },
      challenge: rnd(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    },
  });
  write({ ...read(), bio: b64u(cred.rawId) });
}
export function disableBio() {
  const s = read();
  if (s) { delete s.bio; write(s); }
}
async function bioUnlock() {
  const id = read()?.bio;
  if (!id) return false;
  try {
    await navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: [{ type: 'public-key', id: unb64u(id) }], userVerification: 'required', timeout: 60000 } });
    return true;
  } catch { return false; }
}

// Клавіатура з цифрами: mode 'unlock' — вхід; 'set' — придумати й повторити. sos — повзунок «Нужна помощь» (на замку)
function pad({ title, onDone, sos, bio }) {
  let code = '';
  const dots = h('div', { class: 'pin-dots', 'aria-hidden': 'true' });
  const msg = h('p', { class: 'pin-msg', role: 'alert' });
  const head = h('p', { class: 'pin-title' }, title);
  const paint = () => dots.replaceChildren(...Array.from({ length: Math.max(4, code.length) }, (_, i) => h('i', { class: i < code.length ? 'is-on' : '' })));
  const press = (d) => { if (code.length < 6) { code += d; msg.textContent = ''; paint(); } };
  const back = () => { code = code.slice(0, -1); paint(); };
  const ok = async () => {
    if (code.length < 4) { msg.textContent = 'Минимум 4 цифры'; return; }
    const c = code;
    code = '';
    paint();
    await onDone(c, { msg, head });
  };
  const key = (label, fn, cls = '') => h('button', { type: 'button', class: `pin-key ${cls}`, onclick: fn }, label);
  const keys = h('div', { class: 'pin-keys' },
    ...'123456789'.split('').map((d) => key(d, () => press(d))),
    key('⌫', back, 'pin-soft'),
    key('0', () => press('0')),
    key('✓', ok, 'pin-ok'));
  const bioBtn = bio ? h('button', { type: 'button', class: 'btn pin-bio', onclick: bio }, '👆 Отпечатком') : null;
  paint();
  const onKey = (e) => {
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') back();
    else if (e.key === 'Enter') ok();
  };
  // Планети з листівки «Вместе» з сердечком посередині пунктиру — замок теж частина Радовалки
  const planets = h('div', { class: 'pin-planets', 'aria-hidden': 'true', html: `<svg viewBox="0 0 300 400">${planetsSvg()}<path class="pin-trail" d="M170 110 C 100 118 36 160 42 210 S 88 250 104 268"/><path class="pin-heart" transform="translate(58 196) scale(3.2)" d="M0 3.2C-2.4.6-6.4-1.2-6.4-4.6-6.4-7.2-3.2-8.4 0-5.6 3.2-8.4 6.4-7.2 6.4-4.6 6.4-1.2 2.4.6 0 3.2Z"/></svg>` });
  return { el: h('div', { class: 'pin-box' }, planets, h('p', { class: 'pin-brand' }, 'Радовалка'), head, dots, msg, keys, bioBtn, sos || null), onKey, msg, head };
}

function overlay(box) {
  // Тло — те саме нерухоме, що під «Написать» (сакура й лотос у неї, зорі й Стрілець у нього)
  const root = h('div', { class: 'pin-lock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Замок Радовалки' }, writeDecor(), box.el);
  document.addEventListener('keydown', box.onKey);
  document.body.append(root);
  return () => { document.removeEventListener('keydown', box.onKey); root.remove(); };
}

let shown = null;
// Показати замок; resolve — коли відкрили. makeSos() — повзунок «Нужна помощь» (може бути null, поки нема даних)
export function lock(makeSos) {
  if (!hasPin()) return Promise.resolve();
  if (shown) return shown;
  shown = new Promise((resolve) => {
    let close = null;
    const done = () => { try { localStorage.removeItem(FAILS); } catch { /* нічого */ } close?.(); shown = null; resolve(); };
    const tryBio = async () => { if (await bioUnlock()) done(); };
    const box = pad({
      title: 'Введи PIN',
      sos: makeSos?.() || null,
      bio: hasBio() ? tryBio : null,
      onDone: async (c, { msg }) => {
        const f = fails();
        if (Date.now() < f.until) { msg.textContent = `Подожди ${Math.ceil((f.until - Date.now()) / 1000)} с`; return; }
        if (await checkPin(c)) { done(); return; }
        const n = noteFail();
        msg.textContent = Date.now() < n.until ? `Неверно. Подожди ${Math.ceil((n.until - Date.now()) / 1000)} с` : 'Неверный PIN';
      },
    });
    box.el.append(h('p', { class: 'pin-forgot' }, 'Забыл PIN — открой свою полную ссылку на Радовалку, замок снимется'));
    close = overlay(box);
    if (hasBio()) tryBio();
  });
  return shown;
}

// Радовалка була у фоні довше 30 с — знову замок
let watching = false;
export function watchResume(makeSos) {
  if (watching) return;
  watching = true;
  let hidden = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hidden = Date.now(); return; }
    if (hidden && Date.now() - hidden > AWAY) lock(makeSos);
    hidden = 0;
  });
}

// Придумати PIN: двічі однаковий
function askNew() {
  return new Promise((resolve) => {
    let first = null;
    let close = null;
    const box = pad({
      title: 'Придумай PIN — 4–6 цифр',
      onDone: async (c, { msg, head }) => {
        if (!first) { first = c; head.textContent = 'Повтори PIN'; return; }
        if (c !== first) { first = null; head.textContent = 'Придумай PIN — 4–6 цифр'; msg.textContent = 'Не совпало — ещё раз'; return; }
        await setPin(c);
        close();
        resolve(true);
      },
    });
    box.el.append(h('button', { type: 'button', class: 'btn pin-cancel', onclick: () => { close(); resolve(false); } }, 'Отмена'));
    close = overlay(box);
  });
}

// Меню: поставити / змінити / зняти PIN, увімкнути відбиток
// row(icon, label, note, onclick) — рядок меню, як решта пунктів «Радовалки»
export function pinPanel(row) {
  const box = h('div', { class: 'pin-panel' });
  const btn = (label, onclick, cls = 'btn') => h('button', { type: 'button', class: cls, onclick }, label);
  const turnBio = async () => {
    try { await enableBio(); toast('Отпечаток подключён 👆'); } catch (e) {
      // NotAllowedError — закрили вікно або відмовили; NotSupportedError / SecurityError — телефон не дає
      toast(e?.name === 'NotAllowedError' ? 'Отпечаток не подключён — окно закрыли или палец не подошёл'
        : `Телефон не дал подключить отпечаток (${e?.name || 'ошибка'}). Вход — по PIN`);
    }
    draw();
  };
  // Знімає лише той, хто знає PIN
  const unlockOff = () => new Promise((resolve) => {
    let close = null;
    const b = pad({
      title: 'Введи PIN, чтобы снять замок',
      onDone: async (c, { msg }) => {
        if (await checkPin(c)) { clearPin(); close(); toast('Замок снят'); resolve(); } else msg.textContent = 'Неверный PIN';
      },
    });
    b.el.append(btn('Отмена', () => { close(); resolve(); }, 'btn pin-cancel'));
    close = overlay(b);
  }).then(draw);
  async function draw() {
    if (!hasPin()) {
      box.replaceChildren(row('🔒', 'Поставить PIN', 'PIN или отпечаток при каждом входе — чтобы никто не открыл Радовалку с твоего телефона',
        async () => { if (await askNew()) { toast('PIN поставлен 🔒'); draw(); } }));
      return;
    }
    const bio = await bioAvailable();
    box.replaceChildren(...[
      bio ? row('👆', hasBio() ? 'Вход отпечатком — включён' : 'Входить отпечатком',
        hasBio() ? 'Тап — выключить. PIN остаётся запасным' : 'Быстрее, чем PIN',
        hasBio() ? () => { disableBio(); toast('Отпечаток выключен'); draw(); } : turnBio) : null,
      row('🔢', 'Сменить PIN', null, async () => { if (await askNew()) toast('PIN изменён'); draw(); }),
      row('🔓', 'Снять замок', 'Попросит PIN', unlockOff),
    ].filter(Boolean));
  }
  draw();
  return box;
}
