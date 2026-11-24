// Мемчики: вибір гифки (пошук російською, популярне, недавні, теми, підбір під настрій)
// і помічник підпису для шторки «що надсилаю» — варіанти від ШІ одразу, настрій чипами
import { send, get } from './api.js';
import { h, toast, ribbon } from './ui.js';


const RECENT_KEY = 'radovalka:gifs-recent';
const recentGifs = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
};
// Надіслану гифку — у «Недавние» (лише на цьому телефоні)
export function rememberGif(g) {
  try {
    const list = [{ id: g.id, preview: g.preview, url: g.url, title: g.title }, ...recentGifs().filter((x) => x.url !== g.url)].slice(0, 24);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* без сховища — просто без «Недавних» */ }
}

// Настрій підпису: повод і тон разом — тап по плитці, і одразу варіанти. Утро / Привет / Ночь — одна плитка за часом доби
const timeMood = () => {
  const hr = new Date().getHours();
  if (hr >= 5 && hr < 12) return { ic: '☀️', label: 'Утро', situation: 'доброе утро', funny: 45, bold: 15 };
  if (hr >= 20 || hr < 5) return { ic: '🌙', label: 'Ночь', situation: 'спокойной ночи', funny: 20, bold: 5 };
  return { ic: '👋', label: 'Привет', situation: 'просто привет посреди дня', funny: 45, bold: 20 };
};
const captionMoods = () => [
  { ic: '🥰', label: 'Нежно', situation: 'сказать что-то нежное, просто порадовать', funny: 25, bold: 10 },
  { ic: '😂', label: 'Смешно', situation: 'рассмешить', funny: 90, bold: 40 },
  { ic: '😜', label: 'Дразнить', situation: 'подразнить', funny: 70, bold: 80 },
  { ic: '🥺', label: 'Скучаю', situation: 'скучаю', funny: 25, bold: 10 },
  { ic: '😏', label: 'Флирт', situation: 'пофлиртовать', funny: 55, bold: 70, passion: 60 },
  { ic: '🔥', label: 'Страсть', situation: 'сказать, как хочется к тебе', funny: 15, bold: 60, passion: 90 },
  { ic: '💪', label: 'Держись', situation: 'у получателя тяжёлый день — поддержать', funny: 35, bold: 15 },
  timeMood(),
  { ic: '🙏', label: 'Мириться', situation: 'помириться после ссоры: мягко, с теплом и лёгким юмором, без упрёков', funny: 35, bold: 5 },
  { ic: '🎉', label: 'Поздравить', situation: 'поздравить, порадоваться успеху получателя, сказать, что гордишься', funny: 50, bold: 25 },
];

// Помічник підпису (однаковий на фото й гифці): сітка настроїв, тап — одразу варіанти на місці сітки,
// Поле підпису на фото й гифці: росте до 3 рядків, щоб довгий підпис було видно й можна було правити.
// Підпис — один рядок: Enter надсилає (обробник у редакторі), переноси з вставленого тексту — пробілами
const AREA_VALUE = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
export function captionField() {
  const el = h('textarea', {
    class: 'ph-caption', rows: '1', 'data-voice': true, maxlength: '300', enterkeyhint: 'send',
    placeholder: 'Подпись (можно без)', 'aria-label': 'Подпись',
  });
  const grow = () => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  };
  // Варіант з помічника чи ↶ ставлять value кодом — поле теж має підрости
  Object.defineProperty(el, 'value', {
    get: () => AREA_VALUE.get.call(el),
    set: (v) => { AREA_VALUE.set.call(el, v); grow(); },
  });
  el.addEventListener('input', () => {
    if (el.value.includes('\n')) el.value = el.value.replace(/\s*\n\s*/g, ' ');
    grow();
  });
  el.addEventListener('focus', grow);
  return el;
}

// «‹» — назад до настроїв, «🎲 Ещё» — нові. «✎ Своё» — свій повод у полі над варіантами.
// about — що відомо про картинку (назва гифки); image() — зменшене фото { b64, type } для моделі із зором; onPick — підпис змінився
export function captionHelper(field, { about = '', image = null, onPick }) {
  let mood = null;
  let seq = 0;
  const title = h('span', { class: 'cap-res-title' });
  const own = h('input', {
    type: 'text', maxlength: '200', enterkeyhint: 'go', class: 'cap-own',
    placeholder: 'Свой повод или что на фото', 'aria-label': 'Свой повод или что на фото',
  });
  own.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(); } });
  const again = h('button', { type: 'button', class: 'mk-chip mk-ai-go cap-again', onclick: () => ask() });
  const list = h('div', { class: 'cap-list', 'aria-live': 'polite' });
  const grid = h('div', { class: 'cap-grid', role: 'group', 'aria-label': 'Настроение подписи' });
  const res = h('div', { class: 'cap-res', hidden: true },
    h('div', { class: 'cap-res-head' },
      h('button', { type: 'button', class: 'cap-back', 'aria-label': 'К настроениям', onclick: () => show(false) }, '‹'),
      title, own, again),
    list);
  // Назад до сітки — відповідь, що ще йде, вже не показуємо
  function show(on) {
    if (!on) seq += 1;
    grid.hidden = on;
    res.hidden = !on;
  }
  const open = (m) => {
    mood = m;
    title.hidden = !m;
    own.hidden = !!m;
    title.textContent = m ? `${m.ic} ${m.label}` : '';
    again.textContent = m ? '🎲 Ещё' : '✨';
    again.setAttribute('aria-label', m ? 'Ещё варианты' : 'Придумать');
    again.disabled = false;
    list.replaceChildren();
    show(true);
    if (m) ask();
    else own.focus();
  };
  const tile = (ic, label, onclick) => h('button', { type: 'button', class: 'cap-tile', onclick },
    h('span', { class: 'cap-tile-ic', 'aria-hidden': 'true' }, ic), h('span', {}, label));
  grid.append(...captionMoods().map((m) => tile(m.ic, m.label, () => open(m))), tile('✎', 'Своё', () => open(null)));

  async function ask() {
    const mine = own.value.trim();
    if (!mood && !mine) { own.focus(); return; }
    const n = ++seq;
    const m = mood || { funny: 45, bold: 25 };
    list.replaceChildren(h('p', { class: 'mk-wait' }, 'Придумываю подписи…'));
    again.disabled = true;
    try {
      const img = image ? await image().catch(() => null) : null;
      const { captions } = await send('meme-ideas', 'POST', {
        kind: 'photo', situation: mood ? m.situation : mine, funny: m.funny, bold: m.bold, passion: m.passion || 0, desc: about,
        ...(img ? { image: img.b64, type: img.type } : {}),
      });
      if (n !== seq) return;
      if (!captions?.length) throw new Error('empty');
      list.replaceChildren(...captions.map((c) => h('button', {
        type: 'button', class: 'cap-capt', 'aria-pressed': 'false',
        onclick: (e) => {
          field.value = c;
          list.querySelectorAll('.cap-capt').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
          onPick();
        },
      }, c)));
      list.scrollTop = 0;
    } catch {
      if (n === seq) list.replaceChildren(h('p', { class: 'mk-wait' }, 'Не придумалось — нажми ещё раз'));
    } finally {
      if (n === seq) again.disabled = false;
    }
  }
  return { el: h('div', { class: 'cap-assist' }, grid, res) };
}

// Шторка вибору гифки; onGif(gif) — обрали
export function openGifs(onGif) {
  const close = () => { sheet.remove(); backdrop.remove(); };
  const panel = gifPanel((g) => { close(); onGif(g); });
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-maker', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Гифка' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    h('div', { class: 'sheet-inner' }, h('h2', {}, 'Гифка'), panel.el));
  document.body.append(backdrop, sheet);
  panel.start();
}

// Настрій → одразу суміш із трьох різних пошуків (без очікування ШІ); ШІ — лише за «✨ Ещё идеи»
const MOODS = [
  { key: 'laugh', label: '😂 Посмеяться', qs: ['funny cat fail', 'dog funny face', 'animal lol reaction'], funny: 90, bold: 40 },
  { key: 'tender', label: '🥰 Нежность', qs: ['cute cat cuddle', 'puppy love', 'forehead kiss'], funny: 15, bold: 5 },
  { key: 'miss', label: '🥺 Скучаю', qs: ['miss you', 'dog waiting door', 'sad cat window'], funny: 25, bold: 10 },
  { key: 'hug', label: '🤗 Обнимаю', qs: ['hug', 'cat hug', 'bear hug cute'], funny: 30, bold: 10 },
  { key: 'morning', label: '☀️ Утро', qs: ['good morning', 'sleepy cat wake up', 'coffee morning cute'], funny: 45, bold: 15 },
  { key: 'night', label: '🌙 Ночь', qs: ['good night', 'sleepy puppy', 'cat sleeping cute'], funny: 20, bold: 5 },
  { key: 'cheer', label: '💪 Держись', qs: ['you got this', 'cheer up', 'dog high five'], funny: 40, bold: 20 },
  { key: 'flirt', label: '😏 Флирт', qs: ['flirty wink', 'blowing kiss', 'seductive cat'], funny: 50, bold: 70, passion: 55 },
  { key: 'passion', label: '🔥 Страсть', qs: ['passionate kiss', 'come here i want you', 'kiss me'], funny: 10, bold: 60, passion: 90 },
  { key: 'tease', label: '😜 Подразнить', qs: ['sassy cat', 'cheeky wink', 'dog side eye'], funny: 70, bold: 80 },
  { key: 'yay', label: '🎉 Ура', qs: ['yay celebration', 'happy dance', 'excited dog'], funny: 65, bold: 30 },
];
const PER = 4; // з кожного пошуку суміші — по 4, разом 12
const gifCache = new Map();
async function gifPage(params) {
  const key = new URLSearchParams(params).toString();
  if (!gifCache.has(key)) gifCache.set(key, get(`gifs?${key}`).catch((e) => { gifCache.delete(key); throw e; }));
  return gifCache.get(key);
}
// Почергово з кількох списків, без повторів: кіт, собака, реакція, кіт…
function mix(lists) {
  const seen = new Set();
  const out = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i += 1) {
    lists.forEach((l) => { const g = l[i]; if (g && !seen.has(g.id)) { seen.add(g.id); out.push(g); } });
  }
  return out;
}

// Сітка гифок: настрої плиткою, пошук російською, недавні, популярне, ідеї ШІ під настрій
function gifPanel(done) {
  let source = { mood: MOODS[2] };
  // Під який настрій просити ШІ: останній обраний; пошук своїми словами — під ці слова
  let moodFor = MOODS[2];
  let words = '';
  // Номер запиту до ШІ: інший настрій чи пошук, поки ШІ думав, — його відповідь уже не до речі
  let ask = 0;
  let offset = 0;
  let ai = [];
  const grid = h('div', { class: 'mk-gifs' });
  const more = h('button', { type: 'button', class: 'btn mk-more', hidden: true }, 'Ещё гифки');
  const moods = h('div', { class: 'mk-moods', role: 'radiogroup', 'aria-label': 'Настроение' });
  const chips = h('div', { class: 'mk-chips mk-gif-chips', role: 'radiogroup', 'aria-label': 'Ещё гифки' });
  ribbon(chips);
  const input = h('input', { type: 'search', maxlength: '80', placeholder: 'Найти своими словами', 'aria-label': 'Найти гифку', enterkeyhint: 'search' });
  const form = h('form', { class: 'mk-gif-search', role: 'search' }, input, h('button', { type: 'submit', class: 'btn', 'aria-label': 'Искать' }, '🔎'));
  const aiGo = h('button', { type: 'button', class: 'mk-chip mk-ai-go' }, '✨ Придумать');

  const keyOf = (s) => (s.mood ? `m:${s.mood.key}` : s.recent ? 'recent' : s.trending ? 'trending' : `q:${s.q}`);
  const pick = (src) => {
    source = src;
    offset = 0;
    if (src.fromChip || !src.q) input.value = '';
    draw();
    load(false);
  };
  const draw = () => {
    const now = keyOf(source);
    moods.replaceChildren(...MOODS.map((m) => h('button', {
      type: 'button', role: 'radio', class: 'mk-chip mk-mood-tile', 'aria-checked': String(now === `m:${m.key}`),
      onclick: () => { ai = []; ask += 1; moodFor = m; aiGo.textContent = '✨ Придумать'; pick({ mood: m }); },
    }, m.label)));
    const list = [
      ...(recentGifs().length ? [{ label: '🕘 Недавние', src: { recent: true } }] : []),
      { label: '🔥 Популярное', src: { trending: true } },
      ...ai.map((x) => ({ label: `✨ ${x.label}`, src: { q: x.q, fromChip: true, ai: true } })),
    ];
    chips.replaceChildren(...list.map((c) => h('button', {
      type: 'button', role: 'radio', class: 'mk-chip', 'aria-checked': String(now === keyOf(c.src)),
      onclick: () => pick(c.src),
    }, c.label)), aiGo);
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) { ask += 1; moodFor = null; words = q; pick({ q }); }
    input.blur();
  });
  // ШІ: 6 інших запитів саме під обраний настрій (чи під пошук своїми словами)
  aiGo.addEventListener('click', async () => {
    const m = moodFor;
    const my = ++ask;
    const situation = m ? m.label.replace(/^\S+\s/, '') : words || 'просто так, порадовать';
    aiGo.disabled = true;
    aiGo.textContent = 'Подбираю…';
    try {
      const { queries } = await send('meme-ideas', 'POST', { kind: 'gif', situation, funny: m?.funny ?? 50, bold: m?.bold ?? 20, passion: m?.passion || 0 });
      if (!queries?.length) throw new Error('empty');
      if (my === ask) {
        ai = queries.slice(0, 6);
        pick({ q: ai[0].q, fromChip: true, ai: true });
        chips.scrollLeft = 0;
      }
    } catch {
      toast('Не получилось подобрать — попробуй ещё раз');
    }
    aiGo.disabled = false;
    aiGo.textContent = ai.length ? '🎲 Ещё варианты' : '✨ Придумать';
  });

  let seq = 0;
  const load = async (append) => {
    const my = ++seq;
    // Поки вантажиться — «Ещё» сховано: подвійний тап чи стара тема не загублять сторінку
    more.hidden = true;
    if (!append) grid.replaceChildren(h('p', { class: 'mk-wait' }, 'Ищу гифки…'));
    let list;
    let full;
    try {
      if (source.recent) { list = offset ? [] : recentGifs(); full = false; }
      else if (source.mood) {
        // Один пошук не відповів — беремо інші; не відповів жоден — помилка, як і для звичайного пошуку
        const got = await Promise.allSettled(source.mood.qs.map((q) => gifPage({ q, offset: offset / 3, limit: PER })));
        if (got.every((r) => r.status === 'rejected')) throw got[0].reason;
        const pages = got.map((r) => (r.status === 'fulfilled' ? r.value : []));
        list = mix(pages);
        full = pages.some((p) => p.length >= PER);
      } else {
        list = await gifPage(source.trending ? { trending: 1, offset } : { q: source.q, offset });
        full = list.length === 12;
      }
    } catch (e) {
      if (my !== seq) return;
      if (append) {
        // Уже завантажені гифки лишаються, наступну сторінку можна попросити ще раз
        offset -= 12;
        more.hidden = false;
        toast('Не загрузилось — попробуй ещё раз');
        return;
      }
      grid.replaceChildren(h('p', { class: 'mk-wait' }, e.status === 503
        ? 'Поиск гифок ещё не подключён — можно прислать картинку из галереи.'
        : 'Гифки не загрузились — попробуй ещё раз.'));
      return;
    }
    if (my !== seq) return;
    const tiles = list.map((g) => h('button', {
      type: 'button', class: 'mk-gif', 'aria-label': g.title ? `Гифка: ${g.title}` : 'Выбрать эту гифку', onclick: () => done(g),
    }, h('img', { src: g.preview, alt: '', loading: 'lazy', decoding: 'async' })));
    if (append) grid.append(...tiles);
    else grid.replaceChildren(...tiles);
    more.hidden = !full;
    if (!list.length && !append) grid.replaceChildren(h('p', { class: 'mk-wait' }, 'Ничего не нашлось — попробуй другое слово.'));
  };
  more.addEventListener('click', () => { offset += 12; load(true); });

  return {
    el: h('div', { class: 'mk-gif-panel' }, moods, form, chips, grid, more, h('p', { class: 'mk-giphy' }, 'Powered by GIPHY')),
    start() { draw(); load(false); },
  };
}
