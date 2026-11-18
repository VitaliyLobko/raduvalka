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

// Настрій підпису: повод і тон разом — один тап, і одразу нові варіанти
const CAPTION_MOODS = [
  { label: '✨ просто так', situation: 'просто так, порадовать', funny: 45, bold: 25 },
  { label: '😂 посмеяться', situation: 'рассмешить', funny: 90, bold: 40 },
  { label: '🥰 нежно', situation: 'сказать что-то нежное', funny: 15, bold: 5 },
  { label: '🥺 скучаю', situation: 'скучаю', funny: 25, bold: 10 },
  { label: '😏 флирт', situation: 'пофлиртовать', funny: 55, bold: 70, passion: 60 },
  { label: '🔥 страстно', situation: 'сказать, как хочется к тебе', funny: 15, bold: 60, passion: 90 },
  { label: '😜 подразнить', situation: 'подразнить', funny: 70, bold: 80 },
  { label: '💪 поддержать', situation: 'у получателя тяжёлый день — поддержать', funny: 35, bold: 15 },
  { label: '☀️ утро', situation: 'доброе утро', funny: 45, bold: 15 },
  { label: '🌙 ночь', situation: 'спокойной ночи', funny: 20, bold: 5 },
];
const OWN = '✎ своё';

// Помічник підпису: щойно відкрили — варіанти від ШІ чипами (тап — підпис на фото), під ними настрій (тап — нові)
// і «✎ своё» (свій повод чи що на фото). about — що відомо про картинку (назва гифки);
// image() — зменшене фото { b64, type } для моделі із зором; onPick — підпис змінився
export function captionHelper(field, { about = '', image = null, onPick }) {
  let mood = CAPTION_MOODS[0];
  let seq = 0;
  const out = h('div', { class: 'mk-chips mk-row mk-capts', 'aria-live': 'polite' });
  const more = h('button', { type: 'button', class: 'mk-chip cap-more', 'aria-label': 'Ещё варианты', onclick: () => ask() }, '🎲 ещё');
  const own = h('input', {
    type: 'text', maxlength: '200', enterkeyhint: 'go', hidden: true, class: 'cap-own',
    placeholder: 'Свой повод или что на фото', 'aria-label': 'Свой повод или что на фото',
  });
  own.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(); } });
  const moods = h('div', { class: 'mk-chips mk-row cap-moods', role: 'radiogroup', 'aria-label': 'Настроение подписи' });
  const paintMoods = (picked) => moods.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === picked)));
  [...CAPTION_MOODS.map((x) => x.label), OWN].forEach((label) => moods.append(h('button', {
    type: 'button', role: 'radio', class: 'mk-chip', 'data-v': label,
    onclick: () => {
      paintMoods(label);
      own.hidden = label !== OWN;
      if (label === OWN) { own.focus(); return; }
      mood = CAPTION_MOODS.find((x) => x.label === label);
      ask();
    },
  }, label)));
  paintMoods(mood.label);
  ribbon(moods);
  ribbon(out);

  async function ask() {
    const n = ++seq;
    out.replaceChildren(h('span', { class: 'mk-wait' }, 'Придумываю подписи…'));
    try {
      const img = image ? await image().catch(() => null) : null;
      const mine = own.hidden ? '' : own.value.trim();
      const { captions } = await send('meme-ideas', 'POST', {
        kind: 'photo', situation: mine || mood.situation, funny: mood.funny, bold: mood.bold, passion: mood.passion || 0, desc: about,
        ...(img ? { image: img.b64, type: img.type } : {}),
      });
      if (n !== seq) return;
      if (!captions?.length) throw new Error('empty');
      out.replaceChildren(...captions.map((c) => h('button', {
        type: 'button', class: 'mk-chip mk-capt',
        onclick: (e) => {
          field.value = c;
          out.querySelectorAll('.mk-capt').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
          onPick();
        },
      }, c)), more);
      out.scrollLeft = 0;
    } catch {
      if (n === seq) out.replaceChildren(h('span', { class: 'mk-wait' }, 'Не придумалось'), more);
    }
  }
  const el = h('div', { class: 'cap-assist' },
    h('p', { class: 'mk-label' }, '✨ Подписи — тап, и она на фото'), out,
    h('p', { class: 'mk-label' }, 'Настроение'), moods, own);
  return { el, start: ask };
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
  { key: 'tease', label: '😏 Подразнить', qs: ['sassy cat', 'cheeky wink', 'dog side eye'], funny: 70, bold: 80 },
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
  const input = h('input', { type: 'search', maxlength: '80', placeholder: 'Найти своими словами', 'aria-label': 'Найти гифку', enterkeyhint: 'search' });
  const form = h('form', { class: 'mk-gif-search', role: 'search' }, input, h('button', { type: 'submit', class: 'btn', 'aria-label': 'Искать' }, '🔎'));
  const aiGo = h('button', { type: 'button', class: 'mk-chip mk-ai-more' }, '✨ Ещё идеи');

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
      onclick: () => { ai = []; ask += 1; moodFor = m; pick({ mood: m }); },
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
      const { queries } = await send('meme-ideas', 'POST', { kind: 'gif', situation, funny: m?.funny ?? 50, bold: m?.bold ?? 20 });
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
    aiGo.textContent = '✨ Ещё идеи';
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
