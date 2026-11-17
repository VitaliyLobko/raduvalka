// «Мемчики»: фото й GIF одне одному, реакції 😂 ❤️. Картинку стискає і кодує телефон, не сервер
import { DATA, who } from './data.js';
import { get, send, save } from './api.js';
import { mascotImg, petName, petFor } from './icons.js';
import { h, toast, cap, ARROW } from './ui.js';
import { openGifs, rememberGif, captionHelper } from './maker.js';

const MAX_SIDE = 1280;
const GIF_MAX = 1_300_000;
const REACTIONS = ['😂', '❤️'];

// id мемчика → blob-URL; свої щойно надіслані кладемо сюди одразу, щоб не тягнути назад
const urls = new Map();

// GIF із GIPHY приходить як MP4 — показуємо беззвучним відео по колу, виглядає як гіфка
const isVideo = (url) => /\.mp4(\?|$)/.test(url || '');

// kind — посилання, за яким вирішуємо img чи video; src ставимо одразу або пізніше (лениво)
function media(kind, label, src) {
  if (!isVideo(kind)) return h('img', { alt: label, decoding: 'async', ...(src ? { src } : {}) });
  const v = h('video', { 'aria-label': label, autoplay: true, loop: true, muted: true, playsinline: true, preload: 'auto', ...(src ? { src } : {}) });
  v.muted = true;
  return v;
}

const pet = () => petFor('memes');
const isShe = (key) => DATA.mascots[key]?.g === 'f';
const pose = (key) => (DATA.mascots[key]?.poses?.cowboy ? 'cowboy' : 'main');

// Скільки нових від другої половини з останнього заходу в розділ
export function freshCount() {
  const seen = DATA.mine.memesSeen || 0;
  return (DATA.memes || []).filter((m) => !m.mine && m.created > seen).length;
}

export function markBadge() {
  document.querySelector('.tab[data-tab="memes"]')?.classList.toggle('has-new', freshCount() > 0);
}

export async function refreshMemes() {
  try {
    const list = await get('memes');
    const changed = JSON.stringify(list) !== JSON.stringify(DATA.memes);
    DATA.memes = list;
    return changed;
  } catch {
    return false;
  }
}

export function renderMemes(screen) {
  const key = pet();
  const name = petName(key);
  const fresh = freshCount();
  const list = DATA.memes || [];

  // Зайшла в розділ — нові вже не нові (бейдж на марці гасне)
  const newest = list.find((m) => !m.mine)?.created || 0;
  if (newest > (DATA.mine.memesSeen || 0)) {
    DATA.mine.memesSeen = newest;
    save('mine', { memesSeen: newest });
  }
  markBadge();

  const line = fresh
    ? `${isShe(key) ? 'Притащила' : 'Притащил'} ${fresh > 1 ? `${fresh} мемчика` : 'мемчик'}! 😹`
    : (list.length ? 'Есть ещё? Неси, я донесу.' : 'Тут пока пусто. Пришли первый — я донесу.');

  const picker = h('input', {
    type: 'file',
    accept: 'image/*',
    class: 'visually-hidden',
    onchange: (e) => {
      const [file] = e.target.files;
      e.target.value = '';
      if (file) composeMeme(file, () => renderMemes(screen));
    },
  });

  screen.replaceChildren(...[
    h('h2', { class: 'title' }, 'Мемчики'),
    key ? h('div', { class: 'courier want-courier' },
      h('span', { class: 'mascot', html: mascotImg(key, pose(key)) }),
      h('p', { class: 'bubble' }, h('b', {}, `${name}: `), line)) : null,
    h('div', { class: 'meme-send' },
      h('label', { class: 'btn btn-primary' }, picker, '📷 Из галереи'),
      h('button', {
        type: 'button',
        class: 'btn btn-primary',
        onclick: () => openGifs((gif) => composeGif(gif, () => renderMemes(screen))),
      }, '🎞 Гифка')),
    list.length ? h('div', { class: 'meme-feed' }, ...list.map((m) => card(m, screen))) : null,
  ].filter(Boolean));

  lazyLoad(screen);
}

function card(m, screen) {
  const me = who();
  const when = new Date(m.created).toLocaleDateString('ru', { day: 'numeric', month: 'short' }).replace('.', '');
  const from = m.mine ? 'ты' : (DATA.side === 'vona' ? 'от него' : 'от неё');

  let tail;
  if (m.mine) {
    tail = h('span', { class: 'meme-actions' },
      m.reaction ? h('span', { class: 'meme-their' }, `${cap(me.partner)}: ${m.reaction}`) : null,
      h('button', {
        type: 'button',
        class: 'meme-del',
        'aria-label': 'Удалить мемчик',
        onclick: () => removeMeme(m, screen),
      }, '🗑'));
  } else {
    tail = h('span', { class: 'meme-actions' }, ...REACTIONS.map((r) => h('button', {
      type: 'button',
      class: 'meme-react',
      'aria-pressed': String(m.reaction === r),
      'aria-label': r === '😂' ? 'Смешно' : 'Нравится',
      onclick: () => react(m, r, screen),
    }, r)));
  }

  // Підпис поверх картинки (style top/bottom) — як у справжнього мема; інакше під нею
  const over = m.caption && m.style ? h('span', { class: `meme-over is-${m.style}`, 'aria-hidden': 'true' }, m.caption) : null;
  return h('article', { class: `meme${m.mine ? ' is-mine' : ''}` },
    h('div', { class: 'meme-img', 'data-id': m.id, 'data-url': m.url }, media(m.url, m.caption || 'Мемчик'), over),
    m.caption && !over ? h('p', { class: 'meme-cap' }, m.caption) : null,
    h('div', { class: 'meme-meta' }, h('span', {}, `${from} · ${when}`), tail));
}

// Картинки тягнемо, лише коли картка підʼїжджає до екрана
function lazyLoad(screen) {
  const io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach(async ({ target }) => {
      io.unobserve(target);
      const el = target.querySelector('img, video');
      try {
        // GIF із GIPHY — пряме посилання; своє фото — з бази через ключ
        const src = target.dataset.url || await memeUrl(target.dataset.id);
        const ok = () => target.classList.add('is-loaded');
        if (el.tagName === 'VIDEO') el.addEventListener('loadeddata', ok, { once: true });
        else el.onload = ok;
        el.onerror = () => target.classList.add('is-broken');
        el.src = src;
      } catch {
        target.classList.add('is-broken');
      }
    });
  }, { rootMargin: '400px 0px' });
  screen.querySelectorAll('.meme-img').forEach((el) => io.observe(el));
}

async function memeUrl(id) {
  if (!urls.has(id)) {
    const { type, data } = await get(`memes/${id}/img`);
    const blob = await (await fetch(`data:${type};base64,${data}`)).blob();
    urls.set(id, URL.createObjectURL(blob));
  }
  return urls.get(id);
}

async function react(m, r, screen) {
  const prev = m.reaction;
  m.reaction = prev === r ? null : r;
  renderMemes(screen);
  try {
    await send(`memes/${m.id}`, 'PUT', { reaction: m.reaction });
  } catch {
    m.reaction = prev;
    renderMemes(screen);
    toast('Не сохранилось — нет связи');
  }
}

async function removeMeme(m, screen) {
  if (!confirm('Удалить этот мемчик у обоих?')) return;
  try {
    await send(`memes/${m.id}`, 'DELETE');
    DATA.memes = DATA.memes.filter((x) => x.id !== m.id);
    renderMemes(screen);
  } catch {
    toast('Не удалилось — нет связи');
  }
}

// Фото — до maxSide px (типово 1280) у webp; GIF не чіпаємо (canvas зʼїв би анімацію), лише перевіряємо розмір
export async function prepare(file, maxSide = MAX_SIDE, keepGif = true) {
  if (!file.type.startsWith('image/')) throw new Error('type');
  if (keepGif && file.type === 'image/gif') {
    if (file.size > GIF_MAX) throw new Error('big');
    return file;
  }
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const webp = await new Promise((ok) => canvas.toBlob(ok, 'image/webp', 0.82));
  if (webp?.type === 'image/webp') return webp;
  return new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
}

export const toBase64 = (blob) => new Promise((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1]);
  r.onerror = no;
  r.readAsDataURL(blob);
});

// Сюди ж прийде файл із «Поделиться» і листівка з конструктора
export async function composeMeme(file, done) {
  let blob;
  try {
    blob = await prepare(file);
  } catch (e) {
    toast(e.message === 'big' ? 'GIF слишком большой — до 1,3 МБ' : 'Эту картинку открыть не получилось');
    return;
  }
  const preview = URL.createObjectURL(blob);
  sendSheet(preview, async (caption, style) => {
    const meme = await send('memes', 'POST', { type: blob.type, data: await toBase64(blob), caption, style });
    urls.set(meme.id, preview);
    return meme;
  }, done);
}

// GIF із пошуку: на сервер іде лише посилання GIPHY
export function composeGif(gif, done) {
  sendSheet(gif.url, async (caption, style) => {
    const meme = await send('memes', 'POST', { gif: { url: gif.url }, caption, style });
    rememberGif(gif);
    return meme;
  }, done, 'bottom', gif.title || '');
}

// Шторка «що надсилаю»: прев'ю, підпис (свій або ✨ від ШІ) і де він — під картинкою чи поверх, «Отправить».
// post(caption, style) повертає збережений мемчик; style0 — де підпис спочатку (GIF — поверх знизу);
// about — що відомо про картинку (назва гифки) для ШІ
function sendSheet(preview, post, done, style0 = null, about = '') {
  let style = style0;
  const over = h('span', { class: 'meme-over', 'aria-hidden': 'true' });
  const caption = h('input', {
    type: 'text',
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
  const helper = captionHelper(caption, () => about, paint);
  const close = () => { sheet.remove(); backdrop.remove(); };
  const go = h('button', { type: 'button', class: 'btn btn-primary', html: `${ARROW}Отправить` });
  go.addEventListener('click', async () => {
    go.disabled = true;
    try {
      const meme = await post(caption.value, caption.value.trim() ? style : null);
      DATA.memes = [meme, ...(DATA.memes || [])];
      close();
      const key = pet();
      toast(`${petName(key) || 'Почтальон'} ${isShe(key) ? 'понесла' : 'понёс'} мемчик ➶`);
      done?.();
    } catch (e) {
      go.disabled = false;
      toast(e.status === 413 ? 'Слишком большая картинка' : 'Не отправилось — проверь интернет');
    }
  });
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-maker sheet-meme', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Новый мемчик' },
    h('div', { class: 'sheet-inner' },
      h('h2', {}, 'Мемчик'),
      h('div', { class: 'meme-frame' }, Object.assign(media(preview, 'Что отправляю', preview), { className: 'meme-preview' }), over),
      h('div', { class: 'meme-cap-row' }, caption, helper.button),
      helper.captions,
      place,
      helper.tune,
      h('div', { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'btn', onclick: close }, 'Отмена'),
        go)));
  document.body.append(backdrop, sheet);
  paint();
}
