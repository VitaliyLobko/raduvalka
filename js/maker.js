// Конструктор «Подобрать»: ситуація + повзунки → ШІ дає підписи до фото улюбленців або запити GIF
import { DATA } from './data.js';
import { get, send } from './api.js';
import { petSrc, petName } from './icons.js';
import { h, toast } from './ui.js';

const SITUATIONS = ['скучаю', 'доброе утро', 'тяжёлый день', 'поддержать', 'подразнить', 'спокойной ночи'];
const OWN = '✎ своими словами';
const CARD_W = 720;

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
  return { el: row, value: () => picked };
}

export function openMaker({ onPhoto, onGif }) {
  const pets = Object.keys(DATA.mascots);
  let kind = pets.length ? 'pets' : 'gif';
  let pet = pets[0];
  let pose = 'main';

  const own = h('input', { type: 'text', maxlength: '200', placeholder: 'Например: у тебя экзамен, а я далеко', 'aria-label': 'Ситуация своими словами', hidden: true });
  const situation = choice([...SITUATIONS, OWN].map((s) => ({ v: s, label: s })), SITUATIONS[0], (v) => {
    own.hidden = v !== OWN;
    if (!own.hidden) own.focus();
  });
  const funny = slider('мило', 'смешно', 40);
  const bold = slider('нежно', 'дерзко', 20);
  const absurd = slider('жизненно', 'абсурдно', 30);
  const people = slider('котики', 'люди', 20);

  const poses = h('div', { class: 'mk-poses' });
  const drawPoses = () => {
    const list = Object.keys(DATA.mascots[pet]?.poses || {});
    if (!list.includes(pose)) pose = 'main';
    const pick = choice(list.map((p) => ({ v: p, html: `<img src="${petSrc(pet, p)}" alt="${p}" width="56" height="56">` })), pose, (v) => { pose = v; });
    pick.el.classList.add('mk-pose-row');
    poses.replaceChildren(pick.el);
  };
  const petRow = choice(pets.map((k) => ({ v: k, label: petName(k) })), pet, (v) => { pet = v; drawPoses(); });
  drawPoses();

  const petBox = h('div', { class: 'mk-group' }, h('p', { class: 'mk-label' }, 'Кто на фото'), petRow.el, poses);
  const peopleBox = h('div', { class: 'mk-group', hidden: true }, people.el);
  const kindRow = choice([{ v: 'pets', label: '🐾 С нашими' }, { v: 'gif', label: 'GIF' }], kind, (v) => {
    kind = v;
    petBox.hidden = v !== 'pets';
    peopleBox.hidden = v !== 'gif';
    results.replaceChildren();
  });
  kindRow.el.classList.add('mk-kind');
  petBox.hidden = kind !== 'pets';
  peopleBox.hidden = kind !== 'gif';

  const results = h('div', { class: 'mk-results', 'aria-live': 'polite' });
  const go = h('button', { type: 'button', class: 'btn btn-primary mk-go' }, '✨ Придумать');

  const close = () => { sheet.remove(); backdrop.remove(); };
  const ask = () => ({
    kind,
    situation: situation.value() === OWN ? own.value : situation.value(),
    funny: funny.value(),
    bold: bold.value(),
    absurd: absurd.value(),
    people: people.value(),
  });

  go.addEventListener('click', async () => {
    const q = ask();
    if (!q.situation.trim()) { own.focus(); return; }
    go.disabled = true;
    results.replaceChildren(h('p', { class: 'mk-wait' }, kind === 'gif' ? 'Ищу гифки…' : `${petName(pet)} придумывает подписи…`));
    try {
      // «🎲» під результатами — те саме, що ще раз «Придумать» з тими ж налаштуваннями
      const again = () => go.click();
      if (kind === 'gif') await showGifs(results, q, (g) => { close(); onGif(g); }, again);
      else await showCaptions(results, q, pet, pose, (file) => { close(); onPhoto(file); }, again);
    } catch {
      results.replaceChildren(h('p', { class: 'mk-wait' }, 'Не получилось — проверь интернет и попробуй ещё раз.'));
    }
    go.disabled = false;
  });

  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-maker', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Подобрать мемчик' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    h('div', { class: 'sheet-inner' },
      h('h2', {}, 'Подобрать мемчик'),
      kindRow.el,
      h('div', { class: 'mk-group' }, h('p', { class: 'mk-label' }, 'Повод'), situation.el, own),
      h('div', { class: 'mk-group' }, h('p', { class: 'mk-label' }, 'Настроение'), funny.el, bold.el, absurd.el),
      peopleBox,
      petBox,
      go,
      results));
  document.body.append(backdrop, sheet);
}

// Підписи від ШІ → кнопки; тап малює листівку з фото й підписом і віддає файлом
const reroll = (again, label = '🎲 Ещё варианты') => h('button', { type: 'button', class: 'btn mk-reroll', onclick: again }, label);

async function showCaptions(results, q, pet, pose, done, again) {
  const m = DATA.mascots[pet];
  const { captions } = await send('meme-ideas', 'POST', { ...q, pet: { name: m.name, sp: m.sp, g: m.g } });
  if (!captions?.length) throw new Error('empty');
  results.replaceChildren(
    h('p', { class: 'mk-label' }, 'Выбери подпись — дальше её можно поправить'),
    ...captions.map((c) => h('button', {
      type: 'button',
      class: 'mk-caption',
      onclick: () => editCaption(results, c, pet, pose, done, again),
    }, c)),
    reroll(again));
}

function editCaption(results, text, pet, pose, done, again) {
  const field = h('textarea', { maxlength: '120', 'aria-label': 'Подпись на картинке' });
  field.value = text;
  const make = h('button', { type: 'button', class: 'btn btn-primary' }, 'Сделать мемчик');
  make.addEventListener('click', async () => {
    make.disabled = true;
    try {
      done(await drawCard(pet, pose, field.value.trim()));
    } catch {
      make.disabled = false;
      toast('Картинка не нарисовалась');
    }
  });
  results.replaceChildren(h('p', { class: 'mk-label' }, 'Подпись'), field,
    h('div', { class: 'sheet-actions' }, reroll(again, '🎲 Другие'), make));
  field.focus();
}

// Листівка: фото пози по центру, підпис рукописом під ним, фон — тема своєї половини
async function drawCard(pet, pose, text) {
  await document.fonts.load('700 56px Caveat');
  const img = new Image();
  img.src = petSrc(pet, pose);
  await img.decode();

  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = '700 58px Caveat, cursive';
  ctx.font = font;
  const lines = wrap(ctx, text, CARD_W - 96);
  const photo = 520;
  c.width = CARD_W;
  c.height = 60 + photo + 40 + lines.length * 64 + (lines.length ? 40 : 0);

  const vin = DATA.side === 'vin';
  const bg = ctx.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0, vin ? '#0B384B' : '#EEE4FC');
  bg.addColorStop(1, vin ? '#0A3142' : '#FCE6F0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  if (vin) stars(ctx, c.width, c.height);

  const x = (CARD_W - photo) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, 60, photo, photo, 36);
  ctx.clip();
  // Обрізаємо до квадрата по центру, щоб фото не розтягувалось
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, x, 60, photo, photo);
  ctx.restore();

  ctx.font = font;
  ctx.fillStyle = vin ? '#F4E6C4' : '#4A2545';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, CARD_W / 2, 60 + photo + 36 + i * 64));

  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
  return new File([blob], 'meme.jpg', { type: 'image/jpeg' });
}

function wrap(ctx, text, max) {
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
  return lines.slice(0, 4);
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

// GIF: ШІ дає 3 англійські запити → чипи; сітка по 12, «Ещё» — наступні 12
async function showGifs(results, q, done, again) {
  const { queries } = await send('meme-ideas', 'POST', q);
  if (!queries?.length) throw new Error('empty');
  let query = queries[0];
  let offset = 0;
  const grid = h('div', { class: 'mk-gifs' });
  const more = h('button', { type: 'button', class: 'btn mk-more' }, 'Ещё');

  const load = async (append) => {
    let list;
    try {
      list = await get(`gifs?q=${encodeURIComponent(query)}&offset=${offset}`);
    } catch (e) {
      grid.replaceChildren(h('p', { class: 'mk-wait' }, e.status === 503
        ? 'Поиск GIF ещё не подключён. Мемчик с нашими 🐾 работает уже сейчас.'
        : 'Гифки не загрузились — попробуй ещё раз.'));
      more.hidden = true;
      return;
    }
    const tiles = list.map((g) => h('button', {
      type: 'button',
      class: 'mk-gif',
      'aria-label': 'Выбрать эту гифку',
      onclick: () => done(g),
    }, h('img', { src: g.preview, alt: '', loading: 'lazy', decoding: 'async' })));
    if (append) grid.append(...tiles);
    else grid.replaceChildren(...tiles);
    more.hidden = list.length < 12;
    if (!list.length && !append) grid.replaceChildren(h('p', { class: 'mk-wait' }, 'Ничего не нашлось — выбери другой запрос.'));
  };

  const chips = choice(queries.map((v) => ({ v, label: v })), query, (v) => {
    query = v;
    offset = 0;
    load(false);
  });
  more.addEventListener('click', () => { offset += 12; load(true); });
  results.replaceChildren(chips.el, grid, more, reroll(again, '🎲 Другие запросы'), h('p', { class: 'mk-giphy' }, 'Powered by GIPHY'));
  await load(false);
}
