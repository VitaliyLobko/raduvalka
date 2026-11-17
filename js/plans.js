// «Планы»: ідеї, куди піти й як провести час. Кожен гортає й ставить ❤️ чи ✕ сам;
// чужу відповідь сервер не віддає — видно лише збіг, коли обоє ❤️. Колесо обирає з наших планів
import { DATA, who } from './data.js';
import { get, send } from './api.js';
import { mascotImg, petName, petFor } from './icons.js';
import { h, toast, cap, reduceMotion } from './ui.js';

export const CATS = [
  ['date', '💞', 'Свидание'],
  ['trip', '🧳', 'Поездка'],
  ['home', '🏠', 'Дома вдвоём'],
  ['pets', '🐾', 'С питомцами'],
  ['other', '✨', 'Другое'],
];
const catOf = (key) => CATS.find(([k]) => k === key) || CATS[CATS.length - 1];

const WHEEL_MAX = 12;
const SPIN_MS = 3200;

let view = 'deck';
let wheelCat = '';
let data = null;
// Накопичений кут колеса: кожне обертання починається з того місця, де зупинилось попереднє
let turned = 0;

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Екран міг змінитись, поки йшла відповідь сервера (інша вкладка чи закрита шторка), — тоді не малюємо
const alive = (screen) => screen.isConnected && !!screen.querySelector(':scope > .plan-screen');

// Які збіги вже бачили на цьому телефоні — щоб позначити нові; лише зручність, не обовʼязкове
const seenKey = () => `radovalka:plans-seen:${DATA.side}`;
function seenAt() {
  try {
    return Number(localStorage.getItem(seenKey())) || 0;
  } catch {
    return 0;
  }
}
function markSeen(t) {
  try {
    if (t > seenAt()) localStorage.setItem(seenKey(), String(t));
  } catch { /* приватний режим — позначка просто не запамʼятається */ }
}
const freshMatches = () => (data?.ours || []).filter((p) => !p.done && (p.matched || 0) > seenAt());

export async function loadPlans() {
  data = await get('plans');
  return data;
}

// Крапка: є ідеї від другої половини без моєї відповіді або новий збіг
export function markPlans() {
  const fresh = !!data && (data.deck.length > 0 || freshMatches().length > 0);
  document.querySelector('.tab[data-tab="plans"]')?.classList.toggle('has-new', fresh);
  document.getElementById('together-chip')?.classList.toggle('plan-has-new', fresh);
  document.querySelectorAll('[data-plans-entry]').forEach((el) => el.classList.toggle('plan-has-new', fresh));
}

export function renderPlans(screen) {
  const me = who();
  const pet = petFor('box');
  const counts = data ? { deck: data.deck.length, ours: data.ours.filter((p) => !p.done).length } : {};

  const seg = h('div', { class: 'mk-chips mk-kind plan-seg', role: 'radiogroup', 'aria-label': 'Раздел планов' },
    ...[['deck', 'Листать'], ['ours', 'Наши планы'], ['wheel', 'Колесо']].map(([v, label]) => h('button', {
      type: 'button', role: 'radio', class: 'mk-chip', 'aria-checked': String(view === v),
      onclick: () => { view = v; renderPlans(screen); },
    }, label, counts[v] ? h('span', { class: 'plan-count' }, String(counts[v])) : null)));

  const head = [h('h2', { class: 'title' }, 'Планы'), seg];
  const paint = (...body) => screen.replaceChildren(h('div', { class: 'plan-screen' }, ...head, ...body.filter(Boolean)));

  if (!data) {
    const retry = () => {
      paint(h('p', { class: 'mk-wait' }, 'Загружаю…'));
      loadPlans()
        .then(() => { if (alive(screen)) renderPlans(screen); markPlans(); })
        .catch(() => {
          if (!alive(screen)) return;
          paint(h('p', { class: 'mk-wait' }, 'Не загрузилось — нет связи.'),
            h('button', { type: 'button', class: 'btn plan-wide', onclick: retry }, 'Попробовать ещё'));
        });
    };
    retry();
    return;
  }

  if (view === 'ours') paint(...oursView(screen, me, pet));
  else if (view === 'wheel') paint(...wheelView(screen, me, pet));
  else paint(...deckView(screen, me, pet));
  markPlans();
}

// Свіжі дані з сервера й перемальовка, якщо екран ще наш
function reload(screen) {
  loadPlans()
    .then(() => { markPlans(); if (alive(screen)) renderPlans(screen); })
    .catch(() => toast('Список не обновился — нет связи'));
}

function courier(pet, text) {
  if (!pet) return null;
  return h('div', { class: 'courier plan-courier' },
    h('span', { class: 'mascot', html: mascotImg(pet, 'festive') }),
    h('p', { class: 'bubble' }, h('b', {}, `${petName(pet)}: `), text));
}

// ── Листать ───────────────────────────────────────────────────────────────

function deckView(screen, me, pet) {
  const idea = data.deck[0];
  const fresh = freshMatches();
  const banner = fresh.length ? h('button', {
    type: 'button', class: 'plan-banner', onclick: () => { view = 'ours'; renderPlans(screen); },
  }, `🎉 ${fresh.length > 1 ? `Новые совпадения: ${fresh.length}` : 'Новое совпадение'} — посмотреть`) : null;
  const tools = h('div', { class: 'plan-tools' },
    h('button', { type: 'button', class: 'btn', onclick: () => editIdea(screen) }, '＋ Своя идея'),
    h('button', { type: 'button', class: 'btn btn-primary', onclick: () => askIdeas(screen) }, '✨ Подкинуть идеи'));

  if (!idea) {
    return [banner,
      courier(pet, data.mine.length
        ? `Все идеи ${me.partner === 'она' ? 'от неё' : 'от него'} разобраны. Предложи ещё — вдруг совпадёт 😉`
        : 'Тут пусто. Добавь, куда хочется сходить или поехать, — или попроси меня подкинуть идей.'),
      tools, waitingList(screen, me)];
  }

  const card = ideaCard(idea, me);
  const voteBtn = (v, label, text) => h('button', {
    type: 'button', class: `plan-vote plan-vote-${v ? 'yes' : 'no'}`, 'aria-label': label,
    onclick: () => vote(screen, idea, v, card),
  }, text);
  swipe(card, (v) => vote(screen, idea, v, card));

  return [banner,
    h('div', { class: `plan-deck${data.deck.length > 1 ? ' has-more' : ''}` }, card),
    h('div', { class: 'plan-votes' }, voteBtn(0, 'Не сейчас', '✕'), voteBtn(1, 'Хочу', '❤️')),
    h('p', { class: 'hint plan-hint' }, `${data.deck.length > 1 ? `Ещё ${data.deck.length - 1} после этой. ` : ''}`
      + `Твой ответ ${me.partner} не увидит — только если вы оба ❤️.`),
    tools, waitingList(screen, me)];
}

// Картка ідеї: великий значок теми, назва від руки, подробиці; foot — рядок унизу
function cardBody(p, extra = '', foot = null) {
  const [, emoji, label] = catOf(p.cat);
  return h('article', { class: `plan-card plan-cat-${p.cat} ${extra}`.trim() },
    h('span', { class: 'plan-card-emoji', 'aria-hidden': 'true' }, emoji),
    h('span', { class: 'plan-card-cat' }, label),
    h('h3', { class: 'plan-card-title' }, p.title),
    p.note ? h('p', { class: 'plan-card-note' }, p.note) : null,
    foot ? h('p', { class: 'plan-card-from' }, foot) : null);
}

function ideaCard(idea, me) {
  const she = me.partner === 'она';
  const from = idea.ai ? `✨ ${me.partner} ${she ? 'попросила' : 'попросил'} помощника` : `${she ? 'Предложила' : 'Предложил'} ${me.partner}`;
  return cardBody(idea, '', idea.own ? 'Твоя идея' : from);
}

// Перетягнути картку вбік — те саме, що натиснути ✕ чи ❤️; вертикальне гортання сторінки не заважає
function swipe(card, onVote) {
  let x0 = null;
  let dx = 0;
  const lean = (x) => {
    card.style.transform = x ? `translateX(${x}px) rotate(${x / 18}deg)` : '';
    card.dataset.lean = x > 40 ? 'yes' : x < -40 ? 'no' : '';
  };
  card.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    x0 = e.clientX;
    dx = 0;
    card.setPointerCapture(e.pointerId);
    card.classList.add('is-drag');
  });
  card.addEventListener('pointermove', (e) => {
    if (x0 == null) return;
    dx = e.clientX - x0;
    lean(dx);
  });
  const end = () => {
    if (x0 == null) return;
    x0 = null;
    card.classList.remove('is-drag');
    if (Math.abs(dx) > 90) onVote(dx > 0 ? 1 : 0);
    else lean(0);
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', () => { dx = 0; end(); });
}

let voting = false;
async function vote(screen, idea, v, card) {
  if (voting) return;
  voting = true;
  card.classList.add('is-gone');
  card.style.transform = `translateX(${v ? 130 : -130}%) rotate(${v ? 16 : -16}deg)`;
  card.dataset.lean = v ? 'yes' : 'no';
  if (!reduceMotion) await wait(240);
  // За id, а не за обʼєктом: фонове оновлення могло вже підмінити списки свіжими копіями
  data.deck = data.deck.filter((x) => x.id !== idea.id);
  voting = false;
  if (alive(screen)) renderPlans(screen);
  try {
    const r = await send(`plans/${idea.id}`, 'PUT', { vote: v });
    if (r.match && r.idea) {
      if (!data.ours.some((p) => p.id === r.idea.id)) data.ours.unshift(r.idea);
      markSeen(r.idea.matched || 0);
      if (alive(screen)) {
        renderPlans(screen);
        celebrate(r.idea);
      }
    }
  } catch (e) {
    if (e.status === 404) {
      // Автор встиг прибрати ідею — повертати картку нікуди
      toast('Эту идею уже убрали');
      reload(screen);
    } else {
      if (!data.deck.some((x) => x.id === idea.id)) data.deck.unshift(idea);
      if (alive(screen)) renderPlans(screen);
      toast(e.status ? 'Не сохранилось — попробуй ещё раз' : 'Не сохранилось — нет связи');
    }
  }
  markPlans();
}

// Збіг: улюбленець радіє разом із вами
function celebrate(idea) {
  const pet = petFor('box');
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const ok = h('button', { type: 'button', class: 'btn btn-primary', onclick: close }, 'Ура!');
  const box = h('div', { class: 'plan-match', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Совпадение', onclick: (e) => { if (e.target === box) close(); } },
    h('div', { class: 'plan-match-hearts', 'aria-hidden': 'true' }, ...Array.from({ length: 9 }, (_, i) => h('i', { style: `--i:${i}` }, '❤️'))),
    h('div', { class: 'plan-match-card' },
      pet ? h('span', { class: 'mascot', html: mascotImg(pet, 'festive') }) : null,
      h('h2', {}, 'Совпадение!'),
      h('p', { class: 'plan-match-title' }, `${catOf(idea.cat)[1]} ${idea.title}`),
      h('p', { class: 'plan-match-line' }, pet ? `${petName(pet)}: вы оба этого хотите! Теперь это в «Наших планах» 💞` :'Вы оба этого хотите — это теперь в «Наших планах» 💞'),
      ok));
  document.body.append(box);
  document.addEventListener('keydown', onKey);
  ok.focus();
}

// Мої ❤️, на які друга половина ще не відповіла «так». Чи бачила — невідомо, і це навмисно
function waitingList(screen, me) {
  if (!data.mine.length) return null;
  return h('details', { class: 'plan-wait' },
    h('summary', {}, `Мои идеи ждут ответа · ${data.mine.length}`),
    h('p', { class: 'hint' }, `${cap(me.partner)} видит их у себя. Если тоже ❤️ — будет совпадение.`),
    h('ul', { class: 'plan-list' }, ...data.mine.map((p) => planRow(p, p.own ? h('button', {
      type: 'button', class: 'plan-row-btn', 'aria-label': `Убрать «${p.title}»`, onclick: () => removeIdea(screen, p),
    }, '✕') : null))));
}

function planRow(p, action) {
  const [, emoji] = catOf(p.cat);
  return h('li', { class: `plan-row${p.done ? ' is-done' : ''}` },
    h('span', { class: 'plan-row-emoji', 'aria-hidden': 'true' }, emoji),
    h('span', { class: 'plan-row-text' },
      h('span', { class: 'plan-row-title' }, p.title),
      p.note ? h('span', { class: 'plan-row-note' }, p.note) : null),
    action);
}

async function removeIdea(screen, p) {
  if (!confirm(`Убрать идею «${p.title}»?`)) return;
  try {
    await send(`plans/${p.id}`, 'DELETE');
    data.mine = data.mine.filter((x) => x.id !== p.id);
    if (alive(screen)) renderPlans(screen);
  } catch (e) {
    if (e.status === 409) {
      toast('Уже совпало — теперь это ваш общий план 💞');
      reload(screen);
    } else toast('Не удалилось — нет связи');
  }
}

// ── Наши планы ────────────────────────────────────────────────────────────

function oursView(screen, me, pet) {
  const fresh = new Set(freshMatches().map((p) => p.id));
  markSeen(Math.max(0, ...data.ours.map((p) => p.matched || 0)));
  const open = data.ours.filter((p) => !p.done);
  const done = data.ours.filter((p) => p.done);
  const doneBtn = (p) => h('button', {
    type: 'button', class: 'plan-done', 'aria-pressed': String(p.done), onclick: () => setDone(screen, p, !p.done),
  }, p.done ? 'вернуть' : 'сделали ✓');

  if (!data.ours.length) {
    return [courier(pet, 'Пока совпадений нет. Листай идеи — когда вы оба ❤️ одно и то же, оно появится здесь.'),
      h('button', { type: 'button', class: 'btn btn-primary plan-wide', onclick: () => { view = 'deck'; renderPlans(screen); } }, 'Листать идеи')];
  }
  return [
    open.length >= 2 ? h('button', { type: 'button', class: 'btn btn-primary plan-wide', onclick: () => { view = 'wheel'; renderPlans(screen); } }, '🎡 Что сегодня? Крутить колесо') : null,
    open.length
      ? h('ul', { class: 'plan-list' }, ...open.map((p) => {
        const row = planRow(p, doneBtn(p));
        if (fresh.has(p.id)) row.append(h('span', { class: 'plan-new' }, 'новое'));
        return row;
      }))
      : h('p', { class: 'mk-wait' }, 'Всё, что совпало, уже сделано 🎉 Листай дальше — найдутся новые.'),
    done.length ? h('details', { class: 'plan-wait' },
      h('summary', {}, `Сделали · ${done.length}`),
      h('ul', { class: 'plan-list' }, ...done.map((p) => planRow(p, doneBtn(p))))) : null,
    h('p', { class: 'hint' }, `Здесь только то, что вы оба отметили ❤️. «Сделали» видите и ты, и ${me.partner}.`),
  ];
}

async function setDone(screen, p, done) {
  const prev = p.done;
  // Шукаємо за id у поточних даних — після фонового оновлення p може бути старою копією
  const mark = (value) => { const cur = data.ours.find((x) => x.id === p.id); if (cur) cur.done = value; };
  mark(done);
  renderPlans(screen);
  try {
    await send(`plans/${p.id}`, 'PUT', { done });
    if (done) toast('Ура! Отмечено ✓');
  } catch {
    mark(prev);
    if (alive(screen)) renderPlans(screen);
    toast('Не сохранилось — нет связи');
  }
}

// ── Колесо «что сегодня» ──────────────────────────────────────────────────

const PICK_LINES = [
  'Колесо сказало — значит, так тому и быть 🎡',
  'Решено! Осталось выбрать день 📅',
  'Отличный выбор — моя лапа за! 🐾',
  'Вот и план. Не забудьте мне потом всё рассказать 😉',
];
const PET_LINES = ['Это и про меня! Без меня не начинайте 🐾', 'Ура, я тоже участвую! Уже жду 🐾'];

function wheelView(screen, me, pet) {
  const open = data.ours.filter((p) => !p.done);
  const cats = CATS.filter(([k]) => open.some((p) => p.cat === k));
  if (wheelCat && !cats.some(([k]) => k === wheelCat)) wheelCat = '';
  const pool = open.filter((p) => !wheelCat || p.cat === wheelCat);

  const filter = cats.length > 1 ? h('div', { class: 'mk-chips plan-filter', role: 'radiogroup', 'aria-label': 'Что крутим' },
    ...[['', '', 'Все'], ...cats].map(([k, emoji, label]) => h('button', {
      type: 'button', role: 'radio', class: 'mk-chip', 'aria-checked': String(wheelCat === k),
      onclick: () => { wheelCat = k; renderPlans(screen); },
    }, emoji ? `${emoji} ${label}` : label))) : null;

  if (pool.length < 2) {
    return [filter,
      courier(pet, open.length < 2
        ? 'Колесу нужно хотя бы два общих плана. Листай идеи — каждое совпадение попадёт сюда.'
        : 'В этой теме пока один план — выбирать не из чего. Возьми «Все» или полистай ещё.'),
      h('button', { type: 'button', class: 'btn btn-primary plan-wide', onclick: () => { view = 'deck'; renderPlans(screen); } }, 'Листать идеи')];
  }

  // Більше 12 секторів не прочитати — беремо випадкові 12
  const slots = pool.length > WHEEL_MAX ? [...pool].sort(() => Math.random() - 0.5).slice(0, WHEEL_MAX) : pool;
  const disc = wheelSvg(slots);
  disc.style.transform = `rotate(${turned}deg)`;
  const result = h('div', { class: 'plan-pick', 'aria-live': 'polite' });
  const spinBtn = h('button', { type: 'button', class: 'plan-hub', onclick: () => spin() }, 'Крутить!');

  const spin = async () => {
    spinBtn.disabled = true;
    result.replaceChildren();
    const i = Math.floor(Math.random() * slots.length);
    const step = 360 / slots.length;
    // Спершу обираємо план, тоді рахуємо кут, щоб стрілка вгорі зупинилась на його секторі
    const target = -((i + 0.5) * step + (Math.random() - 0.5) * step * 0.6);
    const base = turned + (reduceMotion ? 0 : 5 * 360);
    turned = base + ((((target - base) % 360) + 360) % 360);
    disc.style.transform = `rotate(${turned}deg)`;
    if (!reduceMotion) await wait(SPIN_MS);
    if (!disc.isConnected) return;
    spinBtn.disabled = false;
    showPick(result, slots[i]);
  };

  return [filter,
    h('div', { class: 'plan-wheel' },
      disc,
      h('span', { class: 'plan-pin', 'aria-hidden': 'true' }),
      spinBtn),
    pool.length > WHEEL_MAX ? h('p', { class: 'hint plan-hint' }, `На колесе ${WHEEL_MAX} из ${pool.length} — каждый раз другие.`) : null,
    result];
}

function showPick(box, p) {
  const pet = p.cat === 'pets' ? pick(Object.keys(DATA.mascots)) || petFor('box') : petFor('box');
  box.replaceChildren(
    cardBody(p, 'plan-pick-card'),
    courier(pet, pick(p.cat === 'pets' ? PET_LINES : PICK_LINES)));
}

// Колесо в SVG: сектори за годинниковою стрілкою від верху, підписи вздовж радіуса
function wheelSvg(slots) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text) n.textContent = text;
    return n;
  };
  const R = 96;
  const step = 360 / slots.length;
  const at = (deg) => {
    const a = (deg * Math.PI) / 180;
    return `${(R * Math.sin(a)).toFixed(2)} ${(-R * Math.cos(a)).toFixed(2)}`;
  };
  const svg = el('svg', { viewBox: '-100 -100 200 200', class: 'plan-disc', role: 'img', 'aria-label': `Колесо: ${slots.map((p) => p.title).join(', ')}` });
  svg.append(el('circle', { r: '99', class: 'plan-rim' }));
  slots.forEach((p, i) => {
    const a0 = i * step;
    // Останній сектор не повинен збігтися кольором із першим, з яким він сусідить
    const tone = i && i === slots.length - 1 && i % 4 === 0 ? 2 : i % 4;
    const g = el('g', { class: `plan-sector plan-sector-${tone}` });
    g.append(el('path', { d: `M0 0L${at(a0)}A${R} ${R} 0 ${step > 180 ? 1 : 0} 1 ${at(a0 + step)}Z` }));
    const title = p.title.length > 15 ? `${p.title.slice(0, 14).trim()}…` : p.title;
    g.append(el('text', { x: '31', y: '0', 'dominant-baseline': 'central', transform: `rotate(${a0 + step / 2 - 90})` }, `${catOf(p.cat)[1]} ${title}`));
    svg.append(g);
  });
  return svg;
}

// ── Шторки: своя ідея і «Подкинуть идеи» ───────────────────────────────────

function catChips(current, choose) {
  const box = h('div', { class: 'mk-chips plan-cats', role: 'radiogroup', 'aria-label': 'Тема' });
  const draw = () => box.replaceChildren(...CATS.map(([k, emoji, label]) => h('button', {
    type: 'button', role: 'radio', class: 'mk-chip', 'aria-checked': String(current() === k),
    onclick: () => { choose(k); draw(); },
  }, `${emoji} ${label}`)));
  draw();
  return box;
}

// Шторка з формою; після закриття (будь-яким способом) перемальовуємо екран — список міг змінитись
function openSheet(screen, label, ...content) {
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    sheet.remove();
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (alive(screen)) renderPlans(screen);
  };
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-maker', role: 'dialog', 'aria-modal': 'true', 'aria-label': label },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    h('div', { class: 'sheet-inner plan-form' }, ...content));
  stack(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  return { close };
}

// Шторка поверх шторки (форма поверх «Планов» у шторці): кожна наступна — вище за попередню разом із затемненням
function stack(backdrop, sheet) {
  const z = 20 + 2 * document.querySelectorAll('.sheet').length;
  backdrop.style.zIndex = String(z);
  sheet.style.zIndex = String(z + 1);
  document.body.append(backdrop, sheet);
}

// «Планы» у шторці — якщо вхід не вкладкою, а кнопкою (наприклад, у «Вместе»); тема своєї половини
export function openPlans(onClose) {
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.plan-form, .plan-match')) close(); };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    backdrop.remove();
    onClose?.();
  };
  const body = h('div', { class: 'sheet-inner' });
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-together plan-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Планы' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    body);
  stack(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  renderPlans(body);
  if (data) loadPlans().then(() => { markPlans(); if (alive(body)) renderPlans(body); }).catch(() => {});
}

function editIdea(screen) {
  const me = who();
  let cat = 'date';
  const title = h('input', { type: 'text', maxlength: '120', placeholder: 'Куда пойдём или что сделаем', 'aria-label': 'Идея' });
  const note = h('input', { type: 'text', maxlength: '300', placeholder: 'Подробности — по желанию', 'aria-label': 'Подробности' });
  const saveBtn = h('button', { type: 'button', class: 'btn btn-primary' }, 'Предложить');
  const { close } = openSheet(screen, 'Новая идея',
    h('h2', {}, 'Идея'),
    catChips(() => cat, (k) => { cat = k; }),
    title, note,
    h('p', { class: 'plan-sheet-note' }, `${cap(me.partner)} увидит её у себя и ответит ❤️ или ✕. Что ответит — узнаешь, только если совпадёт.`),
    h('div', { class: 'sheet-actions' }, saveBtn));
  saveBtn.addEventListener('click', async () => {
    if (!title.value.trim()) { title.focus(); return; }
    saveBtn.disabled = true;
    try {
      const idea = await send('plans', 'POST', { title: title.value, note: note.value, cat });
      data?.mine.unshift(idea);
    } catch {
      saveBtn.disabled = false;
      toast('Не сохранилось — нет связи');
      return;
    }
    close();
    toast(`Готово — ${me.partner} увидит её в колоде`);
  });
  title.focus();
}

const AI_ERRORS = {
  503: 'Помощник сейчас недоступен — попробуй позже.',
  502: 'Не придумалось — попробуй ещё раз или другую тему.',
};

function askIdeas(screen) {
  const me = who();
  let cat = 'date';
  const hint = h('input', { type: 'text', maxlength: '120', placeholder: 'Пожелание: зимой, недорого, рядом с домом…', 'aria-label': 'Пожелание' });
  const status = h('p', { class: 'plan-sheet-note', 'aria-live': 'polite' });
  const goBtn = h('button', { type: 'button', class: 'btn btn-primary plan-wide' }, '✨ Придумать');
  const out = h('div', { class: 'plan-ai-out' });
  const { close } = openSheet(screen, 'Подкинуть идеи',
    h('h2', {}, 'Подкинуть идеи'),
    catChips(() => cat, (k) => { cat = k; }),
    hint, goBtn, status, out);

  const drawAdded = (added) => {
    out.replaceChildren(
      h('ul', { class: 'plan-list' }, ...added.map((p) => planRow(p, h('button', {
        type: 'button', class: 'plan-row-btn', 'aria-label': `Убрать «${p.title}»`,
        onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          try {
            await send(`plans/${p.id}`, 'DELETE');
            added.splice(added.indexOf(p), 1);
            if (data) data.mine = data.mine.filter((x) => x.id !== p.id);
            drawAdded(added);
          } catch {
            btn.disabled = false;
            toast('Не удалилось — нет связи');
          }
        },
      }, '✕')))),
      h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: close }, 'Готово')));
  };

  goBtn.addEventListener('click', async () => {
    goBtn.disabled = true;
    status.textContent = 'Придумываю…';
    try {
      const { added } = await send('plan-ideas', 'POST', { cat, hint: hint.value });
      if (data) data.mine = [...added, ...data.mine];
      status.textContent = `Готово: ${added.length}. ${cap(me.partner)} увидит их в колоде. Лишнее убери ✕`;
      drawAdded(added);
      out.scrollIntoView?.({ block: 'nearest' });
    } catch (e) {
      status.textContent = AI_ERRORS[e.status] || 'Нет связи — попробуй ещё раз.';
    } finally {
      goBtn.disabled = false;
    }
  });
}
