// Мемчики: вибір гифки (пошук російською, популярне, недавні, теми, підбір під настрій)
// і помічник підпису для шторки «що надсилаю» — повод, настрій, ✨ варіанти від ШІ
import { send, get } from './api.js';
import { h, toast } from './ui.js';

const SITUATIONS = ['просто так', 'скучаю', 'доброе утро', 'тяжёлый день', 'поддержать', 'подразнить', 'спокойной ночи'];
const OWN = '✎ своё';

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

// Повзунок «ліве ↔ праве», значення 0–100
function slider(left, right, value = 30) {
  const input = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(value), 'aria-label': `${left} или ${right}` });
  const el = h('div', { class: 'mk-slider' }, h('span', {}, left), input, h('span', {}, right));
  return { el, value: () => Number(input.value) };
}

// Ряд кнопок, з яких обрана одна
function choice(items, picked, onPick) {
  const row = h('div', { class: 'mk-chips', role: 'radiogroup' });
  const paint = () => row.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === picked)));
  items.forEach(({ v, label }) => row.append(h('button', {
    type: 'button', role: 'radio', class: 'mk-chip', 'data-v': v,
    onclick: () => { picked = v; paint(); onPick?.(v); },
  }, label)));
  paint();
  return { el: row, value: () => picked };
}

// Повод і настрій — спільні для підпису й підбору гифок; desc — «що на картинці» (для фото)
function mood({ desc = false } = {}) {
  const own = h('input', { type: 'text', maxlength: '200', placeholder: 'Например: у тебя экзамен', 'aria-label': 'Повод своими словами', hidden: true });
  const situation = choice([...SITUATIONS, OWN].map((s) => ({ v: s, label: s })), SITUATIONS[0], (v) => {
    own.hidden = v !== OWN;
    if (!own.hidden) own.focus();
  });
  situation.el.classList.add('mk-row');
  const funny = slider('мило', 'смешно', 45);
  const bold = slider('нежно', 'дерзко', 25);
  const about = desc ? h('input', { type: 'text', maxlength: '120', placeholder: 'Что на картинке? Подпись выйдет точнее', 'aria-label': 'Что на картинке' }) : null;
  const el = h('div', { class: 'mk-mood' }, situation.el, own, funny.el, bold.el, about);
  const ask = () => {
    const s = situation.value() === OWN ? own.value.trim() : situation.value();
    return {
      situation: s === 'просто так' ? 'просто так, порадовать' : s,
      funny: funny.value(),
      bold: bold.value(),
      ...(about ? { desc: about.value } : {}),
    };
  };
  return { el, ask };
}

// Помічник підпису в шторці: «✨» біля поля → 5 варіантів чипами; повод і настрій — згорнуті.
// context() — що відомо про картинку (назва гифки), field — поле підпису
export function captionHelper(field, context, onPick) {
  const m = mood({ desc: !context() });
  const tune = h('details', { class: 'mk-tune' }, h('summary', {}, 'Повод и настроение для ✨'), m.el);
  const out = h('div', { class: 'mk-chips mk-row mk-capts', 'aria-live': 'polite' });
  const go = h('button', { type: 'button', class: 'btn mk-ai-cap', 'aria-label': 'Придумать подпись' }, '✨');
  go.addEventListener('click', async () => {
    go.disabled = true;
    out.replaceChildren(h('span', { class: 'mk-wait' }, 'Придумываю…'));
    try {
      const q = m.ask();
      const { captions } = await send('meme-ideas', 'POST', { kind: 'photo', ...q, desc: [context(), q.desc].filter(Boolean).join('. ') });
      if (!captions?.length) throw new Error('empty');
      out.replaceChildren(...captions.map((c) => h('button', {
        type: 'button', class: 'mk-chip mk-capt',
        onclick: () => { field.value = c; onPick(); },
      }, c)));
      out.scrollLeft = 0;
    } catch {
      out.replaceChildren(h('span', { class: 'mk-wait' }, 'Не придумалось — попробуй ещё раз'));
    }
    go.disabled = false;
  });
  return { button: go, captions: out, tune };
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
      onclick: () => { ai = []; moodFor = m; pick({ mood: m }); },
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
    if (q) { moodFor = null; pick({ q }); }
    input.blur();
  });
  // ШІ: 6 інших запитів саме під обраний настрій (чи під пошук своїми словами)
  aiGo.addEventListener('click', async () => {
    const m = moodFor;
    const situation = m ? m.label.replace(/^\S+\s/, '') : input.value.trim() || 'просто так, порадовать';
    aiGo.disabled = true;
    aiGo.textContent = 'Подбираю…';
    try {
      const { queries } = await send('meme-ideas', 'POST', { kind: 'gif', situation, funny: m?.funny ?? 50, bold: m?.bold ?? 20 });
      if (!queries?.length) throw new Error('empty');
      ai = queries.slice(0, 6);
      pick({ q: ai[0].q, fromChip: true, ai: true });
      chips.scrollLeft = 0;
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
        const pages = await Promise.all(source.mood.qs.map((q) => gifPage({ q, offset: offset / 3, limit: PER }).catch(() => [])));
        if (!pages.some((p) => p.length) && !offset) throw Object.assign(new Error('none'), { status: 0 });
        list = mix(pages);
        full = pages.some((p) => p.length === PER);
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
