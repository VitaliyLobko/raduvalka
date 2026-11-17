// Мемчики: вибір гифки (пошук російською, популярне, недавні, теми, підбір під настрій)
// і помічник підпису для шторки «що надсилаю» — повод, настрій, ✨ варіанти від ШІ
import { send, get } from './api.js';
import { h, toast } from './ui.js';

const SITUATIONS = ['просто так', 'скучаю', 'доброе утро', 'тяжёлый день', 'поддержать', 'подразнить', 'спокойной ночи'];
const OWN = '✎ своё';

const GIF_PRESETS = [
  ['Скучаю', 'miss you'], ['Обнимаю', 'hug'], ['Люблю', 'i love you'], ['Целую', 'kiss'],
  ['Доброе утро', 'good morning'], ['Спокойной ночи', 'good night'], ['Держись', 'you got this'],
  ['Жду тебя', 'waiting for you'], ['Ура', 'yay celebration'], ['Смешное', 'funny animals'],
  ['Котики', 'cute cats'], ['Собачки', 'cute dogs'], ['Танцую', 'happy dance'], ['Устал(а)', 'so tired'],
];

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
  const tune = h('details', { class: 'mk-tune' }, h('summary', {}, 'Повод и настроение'), m.el);
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
  return { button: go, el: h('div', { class: 'mk-helper' }, out, tune) };
}

// Шторка вибору гифки; onGif(gif) — обрали
export function openGifs(onGif) {
  const close = () => { sheet.remove(); backdrop.remove(); };
  const panel = gifPanel((g) => { close(); onGif(g); });
  const m = mood();
  const aiGo = h('button', { type: 'button', class: 'btn btn-primary mk-go' }, '✨ Подобрать гифки');
  const aiBox = h('details', { class: 'mk-ai' }, h('summary', {}, '✨ Подобрать под настроение'), m.el, aiGo);
  aiGo.addEventListener('click', async () => {
    aiGo.disabled = true;
    aiGo.textContent = 'Подбираю…';
    try {
      const { queries } = await send('meme-ideas', 'POST', { ...m.ask(), kind: 'gif' });
      if (!queries?.length) throw new Error('empty');
      panel.addAi(queries);
      aiBox.open = false;
    } catch {
      toast('Не получилось подобрать — попробуй ещё раз');
    }
    aiGo.disabled = false;
    aiGo.textContent = '✨ Подобрать гифки';
  });
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-maker', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Гифка' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    h('div', { class: 'sheet-inner' }, h('h2', {}, 'Гифка'), aiBox, panel.el));
  document.body.append(backdrop, sheet);
  panel.start();
}

// Сітка гифок: одразу «Скучаю»; пошук російською, популярне, недавні, теми й підібрані ШІ
function gifPanel(done) {
  let active = 'q:miss you';
  let source = { q: 'miss you' };
  let offset = 0;
  let ai = [];
  const grid = h('div', { class: 'mk-gifs' });
  const more = h('button', { type: 'button', class: 'btn mk-more', hidden: true }, 'Ещё гифки');
  const chips = h('div', { class: 'mk-chips mk-gif-chips', role: 'radiogroup', 'aria-label': 'Темы гифок' });
  const input = h('input', { type: 'search', maxlength: '80', placeholder: 'Найти гифку — можно по-русски', 'aria-label': 'Найти гифку', enterkeyhint: 'search' });
  const form = h('form', { class: 'mk-gif-search', role: 'search' }, input, h('button', { type: 'submit', class: 'btn', 'aria-label': 'Искать' }, '🔎'));

  const pick = (key, src) => {
    active = key;
    source = src;
    offset = 0;
    drawChips();
    load(false);
  };
  const drawChips = () => {
    const list = [
      ...(recentGifs().length ? [{ key: 'recent', label: '🕘 Недавние', src: { recent: true } }] : []),
      { key: 'trending', label: '🔥 Популярное', src: { trending: true } },
      ...ai.map((x) => ({ key: `ai:${x.q}`, label: `✨ ${x.label}`, src: { q: x.q } })),
      ...GIF_PRESETS.map(([label, q]) => ({ key: `q:${q}`, label, src: { q } })),
    ];
    chips.replaceChildren(...list.map((c) => h('button', {
      type: 'button', role: 'radio', class: 'mk-chip', 'aria-checked': String(c.key === active),
      onclick: () => { input.value = ''; pick(c.key, c.src); },
    }, c.label)));
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) pick('search', { q });
    input.blur();
  });

  let seq = 0;
  const load = async (append) => {
    const my = ++seq;
    if (!append) grid.replaceChildren(h('p', { class: 'mk-wait' }, 'Ищу гифки…'));
    let list;
    try {
      if (source.recent) list = offset ? [] : recentGifs();
      else if (source.trending) list = await get(`gifs?trending=1&offset=${offset}`);
      else list = await get(`gifs?q=${encodeURIComponent(source.q)}&offset=${offset}`);
    } catch (e) {
      if (my !== seq) return;
      grid.replaceChildren(h('p', { class: 'mk-wait' }, e.status === 503
        ? 'Поиск гифок ещё не подключён — можно прислать картинку из галереи.'
        : 'Гифки не загрузились — попробуй ещё раз.'));
      more.hidden = true;
      return;
    }
    if (my !== seq) return;
    const tiles = list.map((g) => h('button', {
      type: 'button', class: 'mk-gif', 'aria-label': g.title ? `Гифка: ${g.title}` : 'Выбрать эту гифку', onclick: () => done(g),
    }, h('img', { src: g.preview, alt: '', loading: 'lazy', decoding: 'async' })));
    if (append) grid.append(...tiles);
    else grid.replaceChildren(...tiles);
    more.hidden = source.recent || list.length < 12;
    if (!list.length && !append) grid.replaceChildren(h('p', { class: 'mk-wait' }, 'Ничего не нашлось — попробуй другое слово.'));
  };
  more.addEventListener('click', () => { offset += 12; load(true); });

  return {
    el: h('div', { class: 'mk-gif-panel' }, form, chips, grid, more, h('p', { class: 'mk-giphy' }, 'Powered by GIPHY')),
    start() { drawChips(); load(false); },
    addAi(list) {
      ai = list.slice(0, 6);
      pick(`ai:${ai[0].q}`, { q: ai[0].q });
      chips.scrollLeft = 0;
    },
  };
}
