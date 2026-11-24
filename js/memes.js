// Мемчики: фото й GIF одне одному (показ — у стрічці «Письма», feed.js). Картинку стискає і кодує телефон, не сервер
import { sfx } from './sound.js';
import { DATA } from './data.js';
import { get, send } from './api.js';
import { openBlob } from './seal.js';
import { petName, petFor, petFiles, petFileSrc } from './icons.js';
import { h, toast } from './ui.js';
import { GALAXY } from './galaxy.js';
import { SHIELD_ICON } from './shield.js';
import { rememberGif } from './maker.js';

const MAX_SIDE = 1280;
const GIF_MAX = 1_300_000;
// Реакції в чаті (довге натискання) — той самий набір, що на сервері; у повному віконці — групами
export const REACT_GROUPS = [
  ['Нежные', ['❤️', '😘', '😍', '🤗', '🫦', '🌹', '😇', '🧸']],
  ['Смешно и неожиданно', ['😂', '🤣', '🙃', '😏', '🙈', '🫣', '👀', '😱', '🤯', '🤔', '😎', '🤷', '🌈']],
  // Наші: Юпітер із листівки, стріла Стрільця, полуниця, її сакура й його зірка, медаль, щит, ракета (🐾 прибрано — сервер його ще приймає)
  ['Про нас', ['🪐', '🏹', '🍓', '🌸', '⭐', '🎖️', '🛡️', '🚀', '🌌']],
  ['Поддержка и восторг', ['🥺', '😢', '🙏', '🍀', '💪', '👏', '🎉', '🔥', '💯']],
  ['Будни', ['☀️', '☕', '🍕', '🍷', '👍', '🫡', '😴', '🌙', '🍿']],
  ['Самочувствие', ['🥶', '🥵', '🤒', '💊', '🤮']],
];
export const REACTIONS = REACT_GROUPS.flatMap(([, g]) => g);
// Як показати реакцію: 🌌 і 🛡️ — свої намальовані значки, решта — сам смайлик
const FACES = { '🌌': ['Вселенная нас любит', GALAXY], '🛡️': ['Щит', SHIELD_ICON] };
export const reactFace = (e) => (FACES[e] ? h('span', { class: 'rx-face', role: 'img', 'aria-label': FACES[e][0], html: FACES[e][1] }) : e);
// Ряд частих, поки нічого не ставили; далі його підлаштовує лічильник
export const REACT_TOP = ['❤️', '😘', '😂', '🔥', '😍', '🥺', '🙏', '👏'];

// id мемчика → blob-URL; свої щойно надіслані кладемо сюди одразу, щоб не тягнути назад
const urls = new Map();

// GIF із GIPHY приходить як MP4 — показуємо беззвучним відео по колу, виглядає як гіфка
const isVideo = (url) => /\.mp4(\?|$)/.test(url || '');

// kind — посилання, за яким вирішуємо img чи video; src ставимо одразу або пізніше (лениво)
export function media(kind, label, src) {
  if (!isVideo(kind)) return h('img', { alt: label, decoding: 'async', ...(src ? { src } : {}) });
  const v = h('video', { 'aria-label': label, autoplay: true, loop: true, muted: true, playsinline: true, preload: 'auto', ...(src ? { src } : {}) });
  v.muted = true;
  return v;
}

// ── Підпис поверх гифки, як у фото: стиль, колір, місце, розмір і поворот. Текст шифрується як завжди (caption),
// у style — лише де й як він намальований: 'look.колір.x.y.k.r' (x, y — тисячні кадру, k — відсотки, r — градуси).
// Малює CSS, а не canvas, тож гифка лишається живою; у редакторі, стрічці й на весь екран — той самий шар
export const CAP_COLORS = ['#ffffff', '#ff4f8b', '#ffcb3d', '#6fd3ff', '#2a1730'];
export const CAP_COLOR_NAMES = ['белый', 'розовый', 'жёлтый', 'голубой', 'тёмный'];
const capLum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
export const capLight = (hex) => capLum(hex) > 0.6;
// Шрифти підпису поверх виду (без шрифту — свій шрифт виду). k — у скільки разів шрифт ширший за Rubik
// (розмір ділимо на нього, щоб підпис займав те ж місце); lh — міжрядковий; caps — чи читається великими (мем)
export const CAP_FONTS = [
  { v: 'lobster', label: 'Открытка', family: 'Lobster', weight: 400, k: 0.95, lh: 1.15, caps: false },
  { v: 'marck', label: 'Почерк', family: 'Marck Script', weight: 400, k: 0.8, lh: 1.1, caps: false },
  { v: 'bubbles', label: 'Пузыри', family: 'Rubik Bubbles', weight: 400, k: 1.05, lh: 1.15, caps: true },
  { v: 'comfortaa', label: 'Мягкий', family: 'Comfortaa', weight: 700, k: 1.05, lh: 1.2, caps: true },
  { v: 'russo', label: 'Мощный', family: 'Russo One', weight: 400, k: 1.05, lh: 1.15, caps: true },
  { v: 'playfair', label: 'Журнал', family: 'Playfair Display', weight: 700, k: 1, lh: 1.15, caps: true },
  { v: 'press', label: 'Пиксели', family: 'Press Start 2P', weight: 400, k: 1.7, lh: 1.45, caps: true },
];
export const capFont = (v) => CAP_FONTS.find((f) => f.v === v) || null;
// Розмір підпису з окремим шрифтом — частка ширини кадру для Rubik (рукописні види задумані під вужчий Caveat)
export const CAP_SIZE = { meme: 0.075, plate: 0.06, bubble: 0.06, hand: 0.07, tape: 0.063, neon: 0.077, note: 0.06, cut: 0.065 };
// Назви сімейств — у лапках: «Press Start 2P» без них ламає весь рядок шрифту
export const capFontCss = (f, size) => `${f.weight} ${size} '${f.family}', system-ui, sans-serif`;
// Колір — номер готового кружка (0–4) або свій: шість hex-цифр без «#»; шрифт — необовʼязковий хвіст
// Хвости: шрифт і колір тексту на плашці (.i_rrggbb — підкреслення, щоб hex із самих літер не сплутався зі шрифтом)
const FREE = /^(meme|hand|plate|bubble|tape|neon|note|cut)\.([0-4]|[0-9a-f]{6})\.(\d{1,4})\.(\d{1,4})\.(\d{1,3})\.(-?\d{1,3})(?:\.([a-z]{3,9}))?(?:\.i_([0-9a-f]{6}))?$/;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Види з фоном під текстом — на світлому фоні текст темно-сливовий
const FILLED = new Set(['plate', 'bubble', 'tape', 'note']);
// «Вырезки»: кожна літера — клаптик із журналу. Вигляд залежить лише від номера літери (без пробілів) — однаково
// в редакторі, у другого й на готовому фото; кожна третя — кольору, обраного кружком
const CUT_PAPER = ['#ffffff', '#1d1a1f', '#ffd84d', '#ff7aa8', '#9fd8ff', '#f3ead8'];
const CUT_FONTS = [[700, 'Rubik', 1], [700, 'Playfair Display', 1], [400, 'Russo One', 0.92], [700, 'Comfortaa', 0.95], [400, 'Lobster', 1.05]];
export const CUT_FAMILIES = CUT_FONTS.map((f) => `${f[0]} 40px '${f[1]}'`);
export function cutLetter(i, color) {
  const n = Math.imul(i + 7, 2654435761) >>> 0;
  const paper = n % 3 === 0 && color ? color : CUT_PAPER[(n >>> 4) % CUT_PAPER.length];
  const [weight, family, k] = CUT_FONTS[(n >>> 8) % CUT_FONTS.length];
  const ink = capLight(paper) ? ((n >>> 12) % 4 === 0 ? '#c8102e' : '#1d1a1f') : '#ffffff';
  return { paper, ink, weight, family, k: k * (0.9 + ((n >>> 14) % 5) * 0.06), rot: ((n >>> 18) % 13) - 6, up: (n >>> 22) % 3 === 0 };
}
export function freeStyle(code) {
  const m = FREE.exec(code || '');
  return m ? {
    look: m[1], color: m[2].length === 6 ? `#${m[2]}` : +m[2], x: clamp(+m[3] / 1000, 0, 1), y: clamp(+m[4] / 1000, 0, 1),
    k: clamp(+m[5] / 100, 0.25, 8), r: +m[6], font: capFont(m[7])?.v || '', ink: m[8] ? `#${m[8]}` : '',
  } : null;
}
// Без шрифту й кольору тексту — старі шість частин: такий код читають і застосунки до появи шрифтів
const inkOf = (c) => (FILLED.has(c.look) && /^#[0-9a-f]{6}$/.test(c.ink || '') ? c.ink : '');
export const freeCode = (c) => [c.look, typeof c.color === 'string' ? c.color.slice(1) : c.color, Math.round(clamp(c.x, 0, 1) * 1000), Math.round(clamp(c.y, 0, 1) * 1000),
  Math.round(clamp(c.k, 0.25, 8) * 100), Math.round(((((c.r % 360) + 540) % 360) - 180)), ...(capFont(c.font) ? [c.font] : []),
  ...(inkOf(c) ? [`i_${inkOf(c).slice(1)}`] : [])].join('.');
export function paintFree(el, c, text) {
  const color = (typeof c.color === 'string' && /^#[0-9a-f]{6}$/.test(c.color) ? c.color : CAP_COLORS[c.color]) || CAP_COLORS[0];
  el.className = `meme-free is-${c.look}`;
  el.textContent = text;
  if (c.look === 'cut') {
    el.textContent = '';
    let i = 0;
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
      const w = h('span', { class: 'cut-word' });
      for (const ch of word) {
        const L = cutLetter(i, color);
        i += 1;
        const s = h('span', { class: 'cut-l' }, L.up ? ch.toUpperCase() : ch.toLowerCase());
        s.style.cssText = `--p:${L.paper};--i:${L.ink};--lr:${L.rot}deg;font:${L.weight} ${L.k}em/1 '${L.family}', system-ui, sans-serif`;
        w.append(s);
      }
      el.append(w, ' ');
    }
  }
  // Обвідка облачка — завжди під тло (як на фото); свій колір — лише в тексту
  const edge = capLight(color) ? (FILLED.has(c.look) ? '#2a1730' : '#000') : '#fff';
  const ink = inkOf(c) || edge;
  // Неон: сяйво кольором і біла серцевина; темний колір — навпаки
  const dark = capLum(color) < 0.22;
  el.style.cssText = `--x:${c.x * 100}%;--y:${c.y * 100}%;--k:${c.k};--r:${c.r}deg;--c:${color};--ink:${ink};--edge:${edge};`
    + `--glow:${dark ? '#fff' : color};--core:${dark ? color : '#fff'}`;
  // Свій шрифт — поверх шрифту виду (inline сильніший за клас); прописи в мемі не перетворюємо на великі
  const f = c.look !== 'cut' && capFont(c.font);
  if (f) {
    el.style.font = capFontCss(f, `${(CAP_SIZE[c.look] * 100) / f.k}cqw/${f.lh}`);
    if (!f.caps) el.style.textTransform = 'none';
  }
  return el;
}
export const freeCap = (c, text) => paintFree(h('span', { 'aria-hidden': 'true' }), c, text);
// ── Наклейки-улюбленці поверх гифки: той самий шар у редакторі, стрічці, листі й на весь екран.
// Код (сервер перевіряє той самий вигляд): 'ключ.поза.x.y.розмір.поворот.дзеркало' через «~»; x, y, розмір — тисячні кадру
export const MAX_STICK = 8;
const STICK_ONE = /^[a-z0-9_-]{1,24}\.\d{1,2}\.\d{1,4}\.\d{1,4}\.\d{1,4}\.-?\d{1,3}\.[01]$/;
export const stickCode = (list) => (list.length ? list.slice(0, MAX_STICK).map((s) => [s.key, s.i,
  Math.round(clamp(s.x, 0, 1) * 1000), Math.round(clamp(s.y, 0, 1) * 1000), Math.round(clamp(s.k, 0.05, 1.5) * 1000),
  Math.round(((((s.r % 360) + 540) % 360) - 180)), s.fx ? 1 : 0].join('.')).join('~') : null);
export function stickParse(code) {
  return String(code || '').split('~').filter((x) => STICK_ONE.test(x)).slice(0, MAX_STICK).map((x) => {
    const [key, i, sx, sy, k, r, f] = x.split('.');
    return { key, i: +i, x: +sx / 1000, y: +sy / 1000, k: +k / 1000, r: +r, fx: f === '1' };
  });
}
// Смайлик-наклейка: ключ «e_» + кодові точки hex через «-» (😍 → e_1f60d, 🇺🇦 → e_1f1fa-1f1e6) — влазить у той самий код
const EMOJI_KEY = /^e_[0-9a-f]{2,5}(?:-[0-9a-f]{2,5}){0,3}$/;
export const emojiKey = (s) => `e_${[...s].map((c) => c.codePointAt(0).toString(16)).join('-')}`;
export const stickEmoji = (s) => {
  if (!EMOJI_KEY.test(s.key)) return null;
  const cps = s.key.slice(2).split('-').map((x) => parseInt(x, 16));
  return cps.every((c) => c >= 0x200d && c <= 0x10ffff) ? String.fromCodePoint(...cps) : null;
};
// Файл пози (нема такого улюбленця чи пози — наклейку пропускаємо); фото, що ще докачується, підставиться саме (data-pet)
export const stickFile = (s) => petFiles(s.key)[s.i] || null;
export const stickImg = (s, attrs = {}) => {
  const e = stickEmoji(s);
  if (e) return h('span', { ...attrs, class:['stick-emo', attrs.class].filter(Boolean).join(' ') }, e);
  const f = stickFile(s);
  return f ? h('img', { src: petFileSrc(f) || null, 'data-pet': f, alt: '', draggable: 'false', ...attrs }) : null;
};
export function paintSticks(layer, list, sel = -1) {
  layer.replaceChildren(...list.map((s, n) => {
    const img = stickImg(s, { 'data-n': String(n), class: n === sel ? 'is-sel' : null });
    if (!img) return null;
    // Смайлик — текст: розмір шрифту від ширини кадру (cqw), щоб скрізь збігався з редактором
    img.style.cssText = `left:${s.x * 100}%;top:${s.y * 100}%;width:${s.k * 100}%;${img.tagName === 'SPAN' ? `font-size:${(s.k * 78).toFixed(2)}cqw;` : ''}transform:translate(-50%, -50%) rotate(${s.r}deg)${s.fx ? ' scaleX(-1)' : ''}`;
    return img;
  }).filter(Boolean));
  return layer;
}
export const stickLayer = (list) => paintSticks(h('span', { class: 'gif-sticks', 'aria-hidden': 'true' }), list);
// Гифка з підписом поверх і/або наклейками — рамкою точно по кадру; нема ні того, ні того — null (показати як є)
export function gifOver(el, caption, style, stick) {
  const free = caption && freeStyle(style);
  const list = stickParse(stick);
  if (!free && !list.length) return null;
  const frame = gifFrame(el, free ? freeCap(free, caption) : null);
  if (list.length) frame.insertBefore(stickLayer(list), frame.children[1] || null);
  return frame;
}
// Рамка точно по кадру гифки (пропорції — з відео), щоб місце підпису в частках кадру всюди збігалось
export function gifFrame(el, cap = null, ar = 0) {
  const frame = h('span', { class: 'gif-frame' }, el, cap);
  const set = (w, hh) => { if (w && hh) frame.style.setProperty('--ar', String(w / hh)); };
  set(ar, 1);
  const read = () => set(el.videoWidth || el.naturalWidth, el.videoHeight || el.naturalHeight);
  el.addEventListener(el.tagName === 'VIDEO' ? 'loadedmetadata' : 'load', read);
  read();
  return frame;
}

const pet = () => petFor('memes');
const isShe = (key) => DATA.mascots[key]?.g === 'f';

export async function memeUrl(id) {
  if (!urls.has(id)) {
    const { type, data } = await get(`memes/${id}/img`);
    // Фото зашифроване (RAD1) — розшифровуємо тут: інакше браузер отримує шифротекст і пише «не загрузилась»
    const blob = await openBlob(await (await fetch(`data:${type};base64,${data}`)).blob());
    urls.set(id, URL.createObjectURL(blob));
  }
  return urls.get(id);
}

// Фото — до maxSide px (типово 1280) у webp; GIF не чіпаємо (canvas зʼїв би анімацію), лише перевіряємо розмір
// Тип від галереї буває порожнім (фото з хмари) — тоді вирішує сам вміст. Помилки: 'type' — не картинка,
// 'heic' — фото HEIC, якого браузер не відкриває, 'decode' — інша картинка, що не відкрилась, 'encode' — не стиснулась
export async function prepare(file, maxSide = MAX_SIDE, keepGif = true) {
  const type = file.type || '';
  // Тип не картинки (application/octet-stream, порожній) ще не вирок: вирішує, чи відкриється
  if (/^(video|audio|text)\//.test(type)) throw new Error('type');
  const kind = await sniff(file);
  if (keepGif && (type === 'image/gif' || kind === 'gif')) {
    if (file.size > GIF_MAX) throw new Error('big');
    return type ? file : new Blob([file], { type: 'image/gif' });
  }
  const pic = await decode(file);
  if (!pic) throw new Error(kind === 'heic' || /hei[cf]/.test(type) ? 'heic' : type.startsWith('image/') || !type ? 'decode' : 'type');
  try {
    const k = Math.min(1, maxSide / Math.max(pic.w, pic.h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(pic.w * k));
    canvas.height = Math.max(1, Math.round(pic.h * k));
    canvas.getContext('2d').drawImage(pic.src, 0, 0, canvas.width, canvas.height);
    const webp = await new Promise((ok) => canvas.toBlob(ok, 'image/webp', 0.82));
    if (webp?.type === 'image/webp') return webp;
    const jpeg = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    if (!jpeg) throw new Error('encode');
    return jpeg;
  } finally {
    pic.done();
  }
}

// Перші байти файла: GIF чи HEIC (контейнер ftyp із брендом HEIF; mif1 буває й у AVIF — його браузер відкриває сам)
async function sniff(file) {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const s = String.fromCharCode(...b);
  if (s.startsWith('GIF8')) return 'gif';
  if (s.slice(4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(s.slice(8, 12))) return 'heic';
  return '';
}

// Відкрити картинку: звичайно; не вийшло (знімок на 50–200 Мп не влазить у пам'ять) — одразу зменшену;
// і останнє — звичайним <img>, він відкриває дещо, чого не бере createImageBitmap. null — не відкрилась
async function decode(file) {
  const bitmap = (bmp) => ({ src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() });
  try { return bitmap(await createImageBitmap(file)); } catch { /* далі */ }
  try { return bitmap(await createImageBitmap(file, { resizeWidth: MAX_SIDE * 2, resizeQuality: 'high' })); } catch { /* далі */ }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw new Error('empty');
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

// Чому фото не відкрилось — людськими словами, щоб наступна невдача сама сказала причину
const PREPARE_ERRORS = {
  big: 'GIF слишком большой — до 1,3 МБ',
  type: 'Это не картинка — выбери фото',
  heic: 'Это фото в формате HEIC, браузер его не открывает. Сделай скриншот этого фото и отправь скриншот',
};
export const prepareError = (e) => PREPARE_ERRORS[e?.message] || 'Эту картинку открыть не получилось. Попробуй другое фото или скриншот';

// Не відправилось: немає звʼязку, сервер не прийняв чи щось інше — кажемо, що саме
export function sendError(e) {
  if (e?.status === 413) return 'Слишком большая картинка';
  if (e?.status) return `Сервер не принял (код ${e.status}${e.code ? `, ${e.code}` : ''}). Попробуй ещё раз`;
  if (!navigator.onLine || e instanceof TypeError) return 'Нет связи — не ушло. Попробуй ещё раз, когда появится интернет';
  return `Не отправилось (${String(e?.message || e).slice(0, 60)}). Попробуй ещё раз`;
}

// Для моделі із зором — маленька JPEG (512 px): досить, щоб розгледіти, і швидко
async function aiPhoto(blob) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const jpeg = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8));
  return { b64: await toBase64(jpeg), type: 'image/jpeg' };
}
const once = (fn) => { let p = null; return () => (p ||= fn()); };

export const toBase64 = (blob) => new Promise((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1]);
  r.onerror = no;
  r.readAsDataURL(blob);
});

// Сюди ж прийде файл із «Поделиться» і листівка з конструктора
// re — { quote, on }: фото у відповідь на повідомлення
export async function composeMeme(file, done, re = null) {
  let blob;
  try {
    blob = await prepare(file);
  } catch (e) {
    toast(prepareError(e));
    return;
  }
  // Редактор — окремий модуль, вантажиться лише тепер, коли вибрали фото (у кеші оболонки він уже лежить)
  const { photoEditor } = await import('./photoedit.js');
  photoEditor(blob, {
    image: once(() => aiPhoto(blob)),
    fail: sendError,
    // out — те саме фото або вже з підписом / наклейками / малюнком; підпис текстом — лише «Под фото»
    send: async (out, caption) => {
      const meme = await send('memes', 'POST', { type: out.type, data: await toBase64(out), caption, style: null, ...re });
      urls.set(meme.id, URL.createObjectURL(out));
      DATA.memes = [meme, ...(DATA.memes || [])];
      sfx('sent');
      const key = DATA.mascots[re?.mascot] ? re.mascot : pet();
      toast(`${petName(key) || 'Почтальон'} ${isShe(key) ? 'понесла' : 'понёс'} фото ➶`);
      done?.();
    },
  });
}

// Наклейка-улюбленець окремим повідомленням (вибір — у клавіатурі 😊): лише код пози, фото є на обох телефонах
export async function sendSticker(key, i, done, re = null) {
  try {
    const meme = await send('memes', 'POST', { sticker: stickCode([{ key, i, x: 0.5, y: 0.5, k: 1, r: 0, fx: false }]), ...re });
    DATA.memes = [meme, ...(DATA.memes || [])];
    sfx('sent');
    const p = DATA.mascots[re?.mascot] ? re.mascot : pet();
    toast(`${petName(p) || 'Почтальон'} ${isShe(p) ? 'понесла' : 'понёс'} наклейку ➶`);
    done?.();
  } catch (e) { toast(sendError(e)); }
}

// GIF із пошуку: на сервер іде лише посилання GIPHY; підпис — шаром поверх (редактор gifedit.js)
export async function composeGif(gif, done, re = null) {
  const { gifEditor } = await import('./gifedit.js');
  gifEditor(gif, {
    fail: sendError,
    send: async (caption, style, stick) => {
      const meme = await send('memes', 'POST', { gif: { url: gif.url }, caption, style, stick, ...re });
      rememberGif(gif);
      DATA.memes = [meme, ...(DATA.memes || [])];
      sfx('sent');
      const key = DATA.mascots[re?.mascot] ? re.mascot : pet();
      toast(`${petName(key) || 'Почтальон'} ${isShe(key) ? 'понесла' : 'понёс'} гифку ➶`);
      done?.();
    },
  });
}
