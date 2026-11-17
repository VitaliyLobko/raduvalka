// Конструктор мемчика: «Наши» (фото улюбленця), «Своё фото» (з галереї) — підпис від ШІ чи свій, чотири стилі
// листівки з живим прев'ю; «Гифка» — GIPHY одразу, з пошуком російською, популярним, недавніми й підбором під настрій
import { DATA } from './data.js';
import { get, send } from './api.js';
import { petSrc, petName } from './icons.js';
import { h, toast } from './ui.js';

const SITUATIONS = ['скучаю', 'доброе утро', 'тяжёлый день', 'поддержать', 'подразнить', 'спокойной ночи'];
const OWN = '✎ своими словами';
const CARD_W = 720;

const MODES = [
  { v: 'pets', label: '🐾 Наши', hint: 'Фото питомца — и подпись от его лица. Придумает ИИ или напишешь сам(а).' },
  { v: 'photo', label: '📷 Своё фото', hint: 'Любое фото из галереи — с подписью в одном из стилей.' },
  { v: 'gif', label: '🎞 Гифка', hint: 'Живая гифка: найди по-русски, возьми популярную или подбери под настроение.' },
];

const STYLES = [
  { v: 'card', label: 'Открытка' },
  { v: 'meme', label: 'Мем' },
  { v: 'polaroid', label: 'Полароид' },
  { v: 'bubble', label: 'Реплика' },
];

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
    const list = [{ id: g.id, preview: g.preview, url: g.url }, ...recentGifs().filter((x) => x.url !== g.url)].slice(0, 24);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* без сховища — просто без «Недавних» */ }
}

// Повзунок «ліве ↔ праве», значення 0–100
function slider(left, right, value = 30) {
  const input = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(value), 'aria-label': `${left} или ${right}` });
  const el = h('div', { class: 'mk-slider' }, h('span', {}, left), input, h('span', {}, right));
  return { el, value: () => Number(input.value) };
}

// Ряд кнопок, з яких обрана одна; onPick — після кожного вибору
function choice(items, picked, onPick) {
  const row = h('div', { class: 'mk-chips', role: 'radiogroup' });
  const paint = () => row.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === picked)));
  items.forEach(({ v, label, html }) => row.append(h('button', {
    type: 'button',
    role: 'radio',
    class: 'mk-chip',
    'data-v': v,
    ...(html ? { html } : {}),
    onclick: () => { picked = v; paint(); onPick?.(v); },
  }, html ? null : label)));
  paint();
  return { el: row, value: () => picked, set: (v) => { picked = v; paint(); } };
}

const group = (label, ...children) => h('div', { class: 'mk-group' }, label ? h('p', { class: 'mk-label' }, label) : null, ...children);
const reroll = (again, label = '🎲 Ещё варианты') => h('button', { type: 'button', class: 'btn mk-reroll', onclick: again }, label);

export function openMaker({ onPhoto, onGif }) {
  const pets = Object.keys(DATA.mascots);
  let mode = pets.length ? 'pets' : 'photo';
  let pet = pets[0];
  let pose = 'main';
  let photo = null; // Blob свого фото

  const close = () => { sheet.remove(); backdrop.remove(); };

  // ---- Повод і настрій (спільні для «Наши» і «Своё фото», а в «Гифке» — для підбору під настрій)
  const own = h('input', { type: 'text', maxlength: '200', placeholder: 'Например: у тебя экзамен, а я далеко', 'aria-label': 'Ситуация своими словами', hidden: true });
  const situation = choice([...SITUATIONS, OWN].map((s) => ({ v: s, label: s })), SITUATIONS[0], (v) => {
    own.hidden = v !== OWN;
    if (!own.hidden) own.focus();
  });
  const funny = slider('мило', 'смешно', 45);
  const bold = slider('нежно', 'дерзко', 25);
  const absurd = slider('жизненно', 'абсурдно', 30);
  const len = slider('коротко', 'развёрнуто', 35);
  const about = slider('про питомца', 'про нас', 30);
  const emoji = slider('без эмодзи', 'с эмодзи', 15);
  const people = slider('зверята', 'люди', 20);
  const sitGroup = group('Повод', situation.el, own);
  const moodGroup = group('Настроение', funny.el, bold.el);
  const moreTune = h('details', { class: 'mk-more-tune' }, h('summary', {}, 'Ещё настройки'), absurd.el, len.el, about.el, emoji.el);
  moodGroup.append(moreTune);

  // ---- Хто/що на фото
  const poses = h('div', { class: 'mk-poses' });
  const drawPoses = () => {
    const list = Object.keys(DATA.mascots[pet]?.poses || {});
    if (!list.includes(pose)) pose = 'main';
    const pick = choice(list.map((p) => ({ v: p, html: `<img src="${petSrc(pet, p)}" alt="${p}" width="56" height="56">` })), pose, (v) => { pose = v; });
    pick.el.classList.add('mk-pose-row');
    poses.replaceChildren(pick.el);
  };
  const petRow = choice(pets.map((k) => ({ v: k, label: petName(k) })), pet, (v) => { pet = v; drawPoses(); });
  if (pets.length) drawPoses();
  const petGroup = group('Кто на фото', petRow.el, poses);

  const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const photoThumb = h('div', { class: 'mk-photo' });
  const photoBtn = h('button', { type: 'button', class: 'btn mk-reroll', onclick: () => fileIn.click() }, '📷 Выбрать фото');
  const desc = h('input', { type: 'text', maxlength: '120', placeholder: 'Что на фото? Например: ты спишь с котом', 'aria-label': 'Что на фото' });
  fileIn.addEventListener('change', () => {
    const f = fileIn.files[0];
    fileIn.value = '';
    if (!f || !f.type.startsWith('image/')) return;
    photo = f;
    photoThumb.replaceChildren(h('img', { src: URL.createObjectURL(f), alt: 'Выбранное фото' }));
    photoBtn.textContent = '📷 Другое фото';
  });
  const photoGroup = group('Фото', photoThumb, photoBtn, fileIn, desc);

  // ---- Підписи й редактор листівки
  const results = h('div', { class: 'mk-results', 'aria-live': 'polite' });
  const go = h('button', { type: 'button', class: 'btn btn-primary mk-go' }, '✨ Придумать подписи');
  const selfWrite = h('button', { type: 'button', class: 'btn mk-self' }, '✍️ Своя подпись');
  const base = () => (mode === 'pets' ? { pet, pose } : { photo });
  const ready = () => {
    if (mode === 'photo' && !photo) { toast('Сначала выбери фото'); fileIn.click(); return false; }
    return true;
  };
  const ask = () => ({
    kind: mode,
    situation: situation.value() === OWN ? own.value : situation.value(),
    funny: funny.value(),
    bold: bold.value(),
    absurd: absurd.value(),
    len: len.value(),
    about: about.value(),
    emoji: emoji.value(),
    people: people.value(),
    ...(mode === 'pets' ? { pet: { name: DATA.mascots[pet].name, sp: DATA.mascots[pet].sp, g: DATA.mascots[pet].g } } : { desc: desc.value }),
  });
  const finish = (file) => { close(); onPhoto(file); };

  go.addEventListener('click', async () => {
    if (!ready()) return;
    const q = ask();
    if (!q.situation.trim()) { own.focus(); return; }
    go.disabled = true;
    results.replaceChildren(h('p', { class: 'mk-wait' }, mode === 'pets' ? `${petName(pet)} придумывает подписи…` : 'Придумываю подписи…'));
    try {
      const { captions } = await send('meme-ideas', 'POST', q);
      if (!captions?.length) throw new Error('empty');
      results.replaceChildren(
        h('p', { class: 'mk-label' }, 'Выбери подпись — дальше её можно поправить и выбрать стиль'),
        ...captions.map((c) => h('button', { type: 'button', class: 'mk-caption', onclick: () => editor(results, c, base(), finish, () => go.click()) }, c)),
        reroll(() => go.click()));
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      results.replaceChildren(h('p', { class: 'mk-wait' }, 'Не получилось придумать — попробуй ещё раз или напиши свою подпись.'));
    }
    go.disabled = false;
  });
  selfWrite.addEventListener('click', () => { if (ready()) editor(results, '', base(), finish, () => go.click()); });

  // ---- Гифка
  const gif = gifPanel((g) => { close(); onGif(g); });
  const gifAiGo = h('button', { type: 'button', class: 'btn btn-primary mk-go' }, '✨ Подобрать гифки');
  gifAiGo.addEventListener('click', async () => {
    const q = ask();
    if (!q.situation.trim()) { own.focus(); return; }
    gifAiGo.disabled = true;
    gifAiGo.textContent = 'Подбираю…';
    try {
      const { queries } = await send('meme-ideas', 'POST', { ...q, kind: 'gif' });
      if (!queries?.length) throw new Error('empty');
      gif.addAi(queries);
      aiBox.open = false;
      gif.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      toast('Не получилось подобрать — попробуй ещё раз');
    }
    gifAiGo.disabled = false;
    gifAiGo.textContent = '✨ Подобрать гифки';
  });
  const aiBox = h('details', { class: 'mk-ai' }, h('summary', {}, '✨ Подобрать под настроение'));

  // ---- Перемикач режимів: спільні групи переїжджають туди, де потрібні
  const hint = h('p', { class: 'mk-hint' });
  const body = h('div', { class: 'mk-body' });
  const modeRow = choice(MODES.filter((m) => m.v !== 'pets' || pets.length), mode, (v) => { mode = v; layout(); });
  modeRow.el.classList.add('mk-kind', 'mk-modes');
  function layout() {
    hint.textContent = MODES.find((m) => m.v === mode).hint;
    results.replaceChildren();
    if (mode === 'gif') {
      aiBox.replaceChildren(aiBox.firstChild, sitGroup, moodGroup, group(null, people.el), gifAiGo);
      body.replaceChildren(gif.el, aiBox);
      gif.start();
      return;
    }
    body.replaceChildren(
      mode === 'pets' ? petGroup : photoGroup,
      sitGroup,
      moodGroup,
      h('div', { class: 'mk-go-row' }, go, selfWrite),
      results);
  }

  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-maker', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Сделать мемчик' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    h('div', { class: 'sheet-inner' },
      h('h2', {}, 'Сделать мемчик'),
      modeRow.el,
      hint,
      body));
  document.body.append(backdrop, sheet);
  layout();
}

// ---- Редактор: підпис, стиль, де текст — і живе прев'ю того, що піде
function editor(results, text, src, done, again) {
  let style = 'card';
  let pos = 'bottom';
  const field = h('textarea', { maxlength: '140', rows: '2', placeholder: 'Подпись на картинке', 'aria-label': 'Подпись на картинке' });
  field.value = text;
  const canvas = h('canvas', { class: 'mk-canvas', role: 'img', 'aria-label': 'Как будет выглядеть мемчик' });
  const posRow = choice([{ v: 'top', label: 'Текст сверху' }, { v: 'bottom', label: 'Текст снизу' }], pos, (v) => { pos = v; redraw(); });
  const styleRow = choice(STYLES, style, (v) => { style = v; posRow.el.hidden = v !== 'meme'; redraw(); });
  posRow.el.hidden = true;

  let timer;
  let drawing = Promise.resolve();
  const redraw = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { drawing = drawing.then(() => drawCard(canvas, src, field.value.trim(), style, pos)).catch(() => {}); }, 120);
  };
  field.addEventListener('input', redraw);

  const make = h('button', { type: 'button', class: 'btn btn-primary' }, 'Готово →');
  make.addEventListener('click', async () => {
    make.disabled = true;
    try {
      clearTimeout(timer);
      await drawing;
      await drawCard(canvas, src, field.value.trim(), style, pos);
      const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.9));
      done(new File([blob], 'meme.jpg', { type: 'image/jpeg' }));
    } catch {
      make.disabled = false;
      toast('Картинка не нарисовалась');
    }
  });
  results.replaceChildren(
    canvas,
    group('Стиль', styleRow.el, posRow.el),
    group('Подпись', field),
    h('div', { class: 'sheet-actions' }, reroll(again, '🎲 Другие подписи'), make));
  redraw();
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- Малювання листівки
async function loadImage(src) {
  const img = new Image();
  if (src.photo) {
    const url = URL.createObjectURL(src.photo);
    img.src = url;
    await img.decode();
    URL.revokeObjectURL(url);
  } else {
    img.src = petSrc(src.pet, src.pose);
    await img.decode();
  }
  return img;
}

const imgCache = new WeakMap();
async function imageFor(src) {
  if (!imgCache.has(src)) imgCache.set(src, loadImage(src));
  return imgCache.get(src);
}

// Шматок фото з центру з потрібним співвідношенням сторін (w/h)
function cover(ctx, img, x, y, w, hgt) {
  const k = Math.max(w / img.naturalWidth, hgt / img.naturalHeight);
  const sw = w / k;
  const sh = hgt / k;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, hgt);
}

function wrap(ctx, text, max, limit = 4) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, limit);
}

// Найбільший кегль, з яким текст влазить у max рядків
function fit(ctx, text, font, from, to, width, maxLines) {
  for (let size = from; size >= to; size -= 4) {
    ctx.font = font(size);
    const lines = wrap(ctx, text, width, 99);
    if (lines.length <= maxLines) return { size, lines };
  }
  ctx.font = font(to);
  return { size: to, lines: wrap(ctx, text, width, maxLines) };
}

function themeBg(ctx, w, hgt) {
  const vin = DATA.side === 'vin';
  const bg = ctx.createLinearGradient(0, 0, 0, hgt);
  bg.addColorStop(0, vin ? '#0B384B' : '#EEE4FC');
  bg.addColorStop(1, vin ? '#0A3142' : '#FCE6F0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, hgt);
  if (vin) stars(ctx, w, hgt);
  return vin;
}

async function drawCard(c, src, text, style, pos) {
  await Promise.all([document.fonts.load('700 56px Caveat'), document.fonts.load('700 56px Rubik')]);
  const img = await imageFor(src);
  const ctx = c.getContext('2d');
  const W = CARD_W;
  // Своє фото не різати до квадрата в «Мем» і «Реплика»: до 4:5 у висоту
  const ratio = src.photo ? Math.min(1.25, Math.max(0.75, img.naturalHeight / img.naturalWidth)) : 1;

  if (style === 'meme') {
    c.width = W;
    c.height = Math.round(W * ratio);
    cover(ctx, img, 0, 0, W, c.height);
    if (!text) return;
    const { size, lines } = fit(ctx, text.toUpperCase(), (s) => `700 ${s}px Rubik, sans-serif`, 76, 40, W - 60, 3);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(6, size / 7);
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';
    const lh = size * 1.12;
    const top = pos === 'top' ? 28 : c.height - 28 - lines.length * lh;
    lines.forEach((l, i) => {
      ctx.strokeText(l, W / 2, top + i * lh);
      ctx.fillText(l, W / 2, top + i * lh);
    });
    return;
  }

  if (style === 'bubble') {
    const pad = 28;
    const font = (s) => `500 ${s}px Rubik, sans-serif`;
    ctx.font = font(44);
    const { size, lines } = text ? fit(ctx, text, font, 48, 32, W - pad * 2 - 64, 4) : { size: 44, lines: [] };
    const lh = size * 1.25;
    const bubbleH = lines.length ? lines.length * lh + 48 : 0;
    const photoH = Math.round(W * ratio);
    c.width = W;
    c.height = photoH + (bubbleH ? bubbleH + 56 : 0);
    const vin = themeBg(ctx, W, c.height);
    cover(ctx, img, 0, c.height - photoH, W, photoH);
    if (!lines.length) return;
    const bx = pad;
    const by = 24;
    const bw = W - pad * 2;
    ctx.fillStyle = vin ? '#FDF8FF' : '#fff';
    ctx.shadowColor = 'rgba(0,0,0,.18)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bubbleH, 34);
    ctx.fill();
    // Хвостик до улюбленця
    ctx.beginPath();
    ctx.moveTo(bx + 90, by + bubbleH - 2);
    ctx.lineTo(bx + 120, by + bubbleH + 46);
    ctx.lineTo(bx + 150, by + bubbleH - 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = font(size);
    ctx.fillStyle = '#4A2545';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + 32, by + 24 + i * lh));
    return;
  }

  if (style === 'polaroid') {
    const font = (s) => `700 ${s}px Caveat, cursive`;
    ctx.font = font(56);
    const fw = 600;
    const { size, lines } = text ? fit(ctx, text, font, 60, 42, fw - 60, 3) : { size: 56, lines: [] };
    const lh = size * 1.05;
    const capH = Math.max(110, lines.length * lh + 50);
    const fh = 30 + (fw - 60) + capH;
    c.width = W;
    c.height = fh + 110;
    themeBg(ctx, W, c.height);
    ctx.save();
    ctx.translate(W / 2, c.height / 2);
    ctx.rotate(-0.035);
    ctx.shadowColor = 'rgba(40, 20, 50, .28)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#FFFDF8';
    ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
    ctx.shadowColor = 'transparent';
    cover(ctx, img, -fw / 2 + 30, -fh / 2 + 30, fw - 60, fw - 60);
    ctx.font = font(size);
    ctx.fillStyle = '#3A2338';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const ty = -fh / 2 + 30 + (fw - 60) + (capH - lines.length * lh) / 2 - 4;
    lines.forEach((l, i) => ctx.fillText(l, 0, ty + i * lh));
    ctx.restore();
    return;
  }

  // «Открытка»: фото по центру, підпис рукописом під ним, фон — тема своєї половини
  const font = (s) => `700 ${s}px Caveat, cursive`;
  ctx.font = font(58);
  const { size, lines } = text ? fit(ctx, text, font, 62, 44, W - 96, 4) : { size: 58, lines: [] };
  const lh = size * 1.1;
  const photo = 520;
  c.width = W;
  c.height = 60 + photo + 40 + lines.length * lh + (lines.length ? 40 : 0);
  const vin = themeBg(ctx, W, c.height);
  const x = (W - photo) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, 60, photo, photo, 36);
  ctx.clip();
  cover(ctx, img, x, 60, photo, photo);
  ctx.restore();
  ctx.font = font(size);
  ctx.fillStyle = vin ? '#F4E6C4' : '#4A2545';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 60 + photo + 36 + i * lh));
}

function stars(ctx, w, hgt) {
  ctx.fillStyle = '#EDB949';
  for (let i = 0; i < 40; i += 1) {
    ctx.globalAlpha = 0.35 + ((i * 37) % 60) / 100;
    ctx.beginPath();
    ctx.arc((i * 151) % w, (i * 97) % hgt, 1 + (i % 3) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- Гифки: одразу сітка; пошук російською, популярне, недавні, готові теми й підібрані ШІ
function gifPanel(done) {
  let active = 'q:miss you';
  let source = { q: 'miss you' };
  let offset = 0;
  let ai = [];
  let started = false;
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
        ? 'Поиск гифок ещё не подключён. Мемчик с нашими 🐾 работает уже сейчас.'
        : 'Гифки не загрузились — попробуй ещё раз.'));
      more.hidden = true;
      return;
    }
    if (my !== seq) return;
    const tiles = list.map((g) => h('button', {
      type: 'button',
      class: 'mk-gif',
      'aria-label': 'Выбрать эту гифку',
      onclick: () => done(g),
    }, h('img', { src: g.preview, alt: '', loading: 'lazy', decoding: 'async' })));
    if (append) grid.append(...tiles);
    else grid.replaceChildren(...tiles);
    more.hidden = source.recent || list.length < 12;
    if (!list.length && !append) grid.replaceChildren(h('p', { class: 'mk-wait' }, 'Ничего не нашлось — попробуй другое слово.'));
  };
  more.addEventListener('click', () => { offset += 12; load(true); });

  const el = h('div', { class: 'mk-gif-panel' }, form, chips, grid, more, h('p', { class: 'mk-giphy' }, 'Powered by GIPHY'));
  return {
    el,
    start() {
      if (started) return;
      started = true;
      drawChips();
      load(false);
    },
    addAi(list) {
      ai = list.slice(0, 6);
      pick(`ai:${ai[0].q}`, { q: ai[0].q });
      chips.scrollLeft = 0;
    },
  };
}
