// Мемчики: фото й GIF одне одному (показ — у стрічці «Письма», feed.js). Картинку стискає і кодує телефон, не сервер
import { DATA } from './data.js';
import { get, send } from './api.js';
import { openBlob } from './seal.js';
import { petName, petFor } from './icons.js';
import { h, toast, ARROW } from './ui.js';
import { rememberGif, captionHelper } from './maker.js';

const MAX_SIDE = 1280;
const GIF_MAX = 1_300_000;
// Реакції в чаті (довге натискання) — той самий набір, що на сервері
// Перший рядок — ніжність, другий — відповідь на слова
export const REACTIONS = ['❤️', '😘', '😍', '🫶', '🤗', '🫦', '🍓', '🥺', '😢', '🙏', '🍀', '😂', '🙃', '🔥', '💯', '👏', '🎉', '💪', '🤯', '😎', '🤷', '😴', '🫡'];

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
      const key = pet();
      toast(`${petName(key) || 'Почтальон'} ${isShe(key) ? 'понесла' : 'понёс'} фото ➶`);
      done?.();
    },
  });
}

// GIF із пошуку: на сервер іде лише посилання GIPHY
export function composeGif(gif, done, re = null) {
  sendSheet(gif.url, async (caption, style) => {
    const meme = await send('memes', 'POST', { gif: { url: gif.url }, caption, style, ...re });
    rememberGif(gif);
    return meme;
  }, done, 'bottom', gif.title || '');
}

// Шторка «що надсилаю»: прев'ю, підпис (свій або ✨ від ШІ) і де він — під картинкою чи поверх, «Отправить».
// post(caption, style) повертає збережений мемчик; style0 — де підпис спочатку (GIF — поверх знизу);
// about — що відомо про картинку (назва гифки) для ШІ; image() — зменшене фото для моделі із зором
function sendSheet(preview, post, done, style0 = null, about = '', image = null) {
  // Гифка з пошуку приходить посиланням, фото з галереї — blob: так і називаємо
  const gif = !preview.startsWith('blob:');
  let style = style0;
  const over = h('span', { class: 'meme-over', 'aria-hidden': 'true' });
  const caption = h('input', {
    type: 'text',
    'data-voice': true,
    maxlength: '300',
    placeholder: 'Подпись (можно без)',
    'aria-label': 'Подпись',
  });
  const paint = () => {
    over.textContent = caption.value;
    over.className = `meme-over is-${style || 'none'}`;
    over.hidden = !style || !caption.value.trim();
    place.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === String(style))));
  };
  const place = h('div', { class: 'mk-chips meme-place', role: 'radiogroup', 'aria-label': 'Где подпись' },
    ...[['null', 'Под картинкой'], ['top', 'Сверху'], ['bottom', 'Снизу']].map(([v, label]) => h('button', {
      type: 'button', role: 'radio', class: 'mk-chip', 'data-v': v,
      onclick: () => { style = v === 'null' ? null : v; paint(); },
    }, label)));
  caption.addEventListener('input', paint);
  const helper = captionHelper(caption, { about, image, onPick: paint });
  const close = () => { sheet.remove(); backdrop.remove(); };
  const go = h('button', { type: 'button', class: 'btn btn-primary', html: `${ARROW}Отправить` });
  go.addEventListener('click', async () => {
    go.disabled = true;
    try {
      const meme = await post(caption.value, caption.value.trim() ? style : null);
      DATA.memes = [meme, ...(DATA.memes || [])];
      close();
      const key = pet();
      toast(`${petName(key) || 'Почтальон'} ${isShe(key) ? 'понесла' : 'понёс'} ${gif ? 'гифку' : 'фото'} ➶`);
      done?.();
    } catch (e) {
      go.disabled = false;
      toast(sendError(e));
    }
  });
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-maker sheet-meme', role: 'dialog', 'aria-modal': 'true', 'aria-label': gif ? 'Новая гифка' : 'Новое фото' },
    h('div', { class: 'sheet-inner' },
      h('h2', {}, gif ? 'Гифка' : 'Фото'),
      h('div', { class: 'meme-frame' }, Object.assign(media(preview, 'Что отправляю', preview), { className: 'meme-preview' }), over),
      caption,
      helper.el,
      h('p', { class: 'mk-label' }, 'Где подпись'),
      place,
      h('div', { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'btn', onclick: close }, 'Отмена'),
        go)));
  document.body.append(backdrop, sheet);
  paint();
  // Варіанти — одразу, без «✨»: людина бачить, що підпис можна взяти готовий
  helper.start();
}
