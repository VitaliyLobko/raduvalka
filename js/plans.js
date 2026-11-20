// «Планы»: ідеї, куди піти й як провести час. Кожен гортає й ставить ❤️ чи ✕ сам;
// чужу відповідь сервер не віддає — видно лише збіг, коли обоє ❤️. Колесо обирає з наших планів
import { DATA, who } from './data.js';
import { get, send } from './api.js';
import { mascotImg, petName, petFor } from './icons.js';
import { h, toast, cap, reduceMotion, ribbon } from './ui.js';
import { learned, learn, nudge, hintBar } from './swipehint.js';
import { burst } from './fx.js';
import { flashConstellation } from './depth.js';
import { swipeable } from './feed.js';
import { chipLabel, chipFestive } from './together.js';

export const CATS = [
  ['date', '💞', 'Свидание'],
  ['culture', '🎭', 'Культура'],
  ['active', '🏃', 'Активное'],
  ['trip', '🧳', 'Поездка'],
  ['home', '🏠', 'Дома вдвоём'],
  ['family', '👨‍👩‍👧', 'С друзьями и семьёй'],
  ['holidays', '🎉', 'Праздники'],
  ['dreams', '🌟', 'Мечты и цели'],
  ['pets', '🐾', 'С питомцами'],
  ['love', '🍓', 'Нежность'],
  ['other', '✨', 'Другое'],
];
const catOf = (key) => CATS.find(([k]) => k === key) || CATS[CATS.length - 1];

const WHEEL_MAX = 12;
const SPIN_MS = 3200;

let view = 'deck';
// Обрані на цьому телефоні теми колеса (кілька одразу); null — ще не обирали, тоді всі
let wheelCats = null;
// Які теми вже траплялись на цьому телефоні (нові — обираються самі) і чи взяли теми з власного запрошення
const wheelSeen = new Set();
let wheelSynced = false;
let data = null;
// Розгорнуті списки («Сделали», «Мои идеи ждут ответа»): перемальовка екрана не має їх згортати
const unfolded = new Set();

function fold(key, summary, ...children) {
  const el = h('details', { class: 'plan-wait' }, h('summary', {}, summary), ...children);
  el.open = unfolded.has(key);
  el.addEventListener('toggle', () => { if (el.open) unfolded.add(key); else unfolded.delete(key); });
  return el;
}

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Екран міг змінитись, поки йшла відповідь сервера (інша вкладка чи закрита шторка), — тоді не малюємо
const alive = (screen) => screen.isConnected && !!screen.querySelector(':scope > .plan-screen');

// Які збіги вже бачили на цьому телефоні — щоб позначити нові; лише зручність, не обовʼязкове.
// Набір id, а не одна мітка часу: свій свіжий збіг не має гасити ранніші, яких ще не бачили
const seenKey = () => `radovalka:plans-seen-ids:${DATA.side}`;
const legacyKey = () => `radovalka:plans-seen:${DATA.side}`;
function seenIds() {
  try {
    const raw = localStorage.getItem(seenKey());
    if (raw) return new Set(JSON.parse(raw));
    // Перехід зі старої мітки часу: усе, що збіглося до неї, вже бачили
    const before = Number(localStorage.getItem(legacyKey())) || 0;
    return new Set((data?.ours || []).filter((p) => (p.matched || 0) <= before).map((p) => p.id));
  } catch {
    return new Set();
  }
}
function markSeen(ids) {
  try {
    const all = seenIds();
    ids.forEach((id) => all.add(id));
    // Лише ті, що ще є у «Наших планах», — щоб список не ріс вічно
    const live = new Set((data?.ours || []).map((p) => p.id));
    localStorage.setItem(seenKey(), JSON.stringify([...all].filter((id) => live.has(id))));
  } catch { /* приватний режим — позначка просто не запамʼятається */ }
}
function freshMatches() {
  const seen = seenIds();
  return (data?.ours || []).filter((p) => !p.done && !seen.has(p.id));
}

// Лічильник локальних змін: відповідь GET, що пішла до голосу чи нової ідеї, старіша за екран — її пропускаємо
let gen = 0;
let busy = 0;
async function mutate(path, method, body) {
  gen += 1;
  busy += 1;
  try {
    return await send(path, method, body);
  } finally {
    busy -= 1;
    gen += 1;
  }
}

export async function loadPlans() {
  const before = gen;
  const fresh = await get('plans');
  if (before === gen && !busy) data = fresh;
  return data;
}

// Додати ідеї в «мої», не дублюючи тих, що вже прийшли з сервера
// 🍓 одним дотиком: план «Заняться любовью» — одразу другому (push «предложил план»), без форми
function loveBtn(screen) {
  const btn = h('button', {
    type: 'button', class: 'btn plan-love', 'aria-label': 'Предложить: заняться любовью',
    onclick: async () => {
      btn.disabled = true;
      try {
        const idea = await mutate('plans', 'POST', { title: 'Заняться любовью', cat: 'love' });
        addMine([idea]);
        burst(btn, '🍓', 8);
        toast(`${cap(who().partner)} увидит 🍓 — если тоже ❤️, будет совпадение`);
        if (alive(screen)) renderPlans(screen);
      } catch {
        btn.disabled = false;
        toast('Не отправилось — нет связи');
      }
    },
  }, '🍓');
  return btn;
}

function addMine(list) {
  if (!data) return;
  const have = new Set(data.mine.map((x) => x.id));
  data.mine = [...list.filter((x) => !have.has(x.id)), ...data.mine];
}

// Крапка: є ідеї від другої половини без моєї відповіді або новий збіг
export function markPlans() {
  const fresh = !!data && (data.deck.length > 0 || freshMatches().length > 0);
  document.querySelector('.tab[data-tab="plans"]')?.classList.toggle('has-new', fresh);
}

// Що робить вкладка — один рядок під перемикачем
const ABOUT = {
  deck: (partner) => `❤️ хочу, ✕ не сейчас. ${cap(partner)} увидит только совпадения — они в «Наших планах».`,
  ours: () => 'Только то, что вы оба отметили ❤️.',
  wheel: () => 'Не можете выбрать? Барабан выберет одно из «Наших планов».',
};

export function renderPlans(screen) {
  const me = who();
  const pet = petFor('box');
  const counts = data ? { deck: data.deck.length, ours: data.ours.filter((p) => !p.done).length } : {};

  const seg = h('div', { class: 'mk-chips mk-kind plan-seg', role: 'radiogroup', 'aria-label': 'Раздел планов' },
    ...[['deck', 'Идеи'], ['ours', 'Наши планы'], ['wheel', 'Наугад']].map(([v, label]) => h('button', {
      type: 'button', role: 'radio', class: 'mk-chip', 'aria-checked': String(view === v),
      onclick: () => { view = v; renderPlans(screen); },
    }, label, counts[v] ? h('span', { class: 'plan-count' }, String(counts[v])) : null)));

  const head = [h('h2', { class: 'title' }, 'Планы'), togetherCard(), seg,
    h('p', { class: 'plan-about' }, ABOUT[view](me.partner))];
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
  // Підказки — з цікавим поглядом, якщо таке фото є; святкова поза лишається для «Совпадение!»
  const pose = DATA.mascots[pet]?.poses.look ? 'look' : 'festive';
  return h('div', { class: 'courier plan-courier' },
    h('span', { class: 'mascot', html: mascotImg(pet, pose) }),
    h('p', { class: 'bubble' }, h('b', {}, `${petName(pet)}: `), text));
}

// ── Идеи ───────────────────────────────────────────────────────────────────

function deckView(screen, me, pet) {
  const idea = data.deck[0];
  const fresh = freshMatches();
  const banner = fresh.length ? h('button', {
    type: 'button', class: 'plan-banner', onclick: () => { view = 'ours'; renderPlans(screen); },
  }, `🎉 ${fresh.length > 1 ? `Новые совпадения: ${fresh.length}` : 'Новое совпадение'} — посмотреть`) : null;
  const tools = h('div', { class: 'plan-tools' },
    loveBtn(screen),
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
  if (popNext) { card.classList.add('is-next'); popNext = false; }
  const voteBtn = (v, label, text) => h('button', {
    type: 'button', class: `plan-vote plan-vote-${v ? 'yes' : 'no'}`, 'aria-label': label,
    onclick: () => vote(screen, idea, v, card),
  }, text);
  // Улюбленець визирає з кута картки — без зайвої висоти, колода лишається на один екран
  if (pet) card.append(h('span', { class: 'mascot plan-card-pet', 'aria-hidden': 'true', html: mascotImg(pet, DATA.mascots[pet]?.poses.look ? 'look' : 'main') }));
  const lean = swipe(card, (v) => vote(screen, idea, v, card));
  // Поки жодного разу не змахнули — картка разок хитається: ✕ ліворуч, ❤️ праворуч
  nudge('plans', card, [() => lean(-60), () => lean(0), () => lean(60), () => lean(0)]);

  return [banner,
    h('div', { class: `plan-deck${data.deck.length > 1 ? ' has-more' : ''}` }, card),
    h('div', { class: 'plan-votes' }, voteBtn(0, 'Не сейчас', '✕'), voteBtn(1, 'Хочу', '❤️')),
    learned('plans') ? null : hintBar('plan-swipe-hint', 'не сейчас', 'хочу'),
    data.deck.length > 1 ? h('p', { class: 'hint plan-hint' }, `Ещё ${data.deck.length - 1} после этой.`) : null,
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
    if (Math.abs(dx) > 90) { learn('plans'); onVote(dx > 0 ? 1 : 0); } else lean(0);
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', () => { dx = 0; end(); });
  return lean;
}

let voting = false;
// Після голосу наступна картка «вистрибує» — лише тоді, а не при кожному фоновому перемалюванні
let popNext = false;
async function vote(screen, idea, v, card) {
  if (voting) return;
  voting = true;
  gen += 1;
  if (v) burst(card);
  popNext = true;
  card.classList.add('is-gone');
  card.style.transform = `translateX(${v ? 130 : -130}%) rotate(${v ? 16 : -16}deg)`;
  card.dataset.lean = v ? 'yes' : 'no';
  if (!reduceMotion) await wait(240);
  // За id, а не за обʼєктом: фонове оновлення могло вже підмінити списки свіжими копіями
  data.deck = data.deck.filter((x) => x.id !== idea.id);
  voting = false;
  if (alive(screen)) renderPlans(screen);
  try {
    const r = await mutate(`plans/${idea.id}`, 'PUT', { vote: v });
    if (r.match && r.idea) {
      if (!data.ours.some((p) => p.id === r.idea.id)) data.ours.unshift(r.idea);
      markSeen([r.idea.id]);
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
  // Збіг — і ваше сузірʼя на фоні спалахує
  flashConstellation();
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
  return fold('wait', `Мои идеи ждут ответа · ${data.mine.length}`,
    h('p', { class: 'hint' }, `${cap(me.partner)} видит их у себя. Если тоже ❤️ — будет совпадение.`),
    h('ul', { class: 'plan-list' }, ...data.mine.map((p) => waitRow(screen, p))));
}

// Своя ідея, що чекає: змах уліво — прибрати (як ✕, з тим самим питанням); чужу прибрати не можна
function waitRow(screen, p) {
  const btn = p.own ? h('button', {
    type: 'button', class: 'plan-row-btn', 'aria-label': `Убрать «${p.title}»`, onclick: () => removeIdea(screen, p),
  }, '✕') : null;
  if (!p.own) return planRow(p, null);
  const row = planRow(p, btn, 'div');
  const li = h('li', { class: 'plan-swipe' }, row);
  // Передумали в питанні — картка, що вилетіла, повертається перемальовкою
  swipeable(li, row, { canRight: () => false, fold: false, onLeft: async () => { await removeIdea(screen, p); if (alive(screen)) renderPlans(screen); } });
  return li;
}

function planRow(p, action, tag = 'li') {
  const [, emoji] = catOf(p.cat);
  return h(tag, { class: `plan-row${p.done ? ' is-done' : ''}` },
    h('span', { class: 'plan-row-emoji', 'aria-hidden': 'true' }, emoji),
    h('span', { class: 'plan-row-text' },
      h('span', { class: 'plan-row-title' }, p.title),
      p.note ? h('span', { class: 'plan-row-note' }, p.note) : null),
    action);
}

async function removeIdea(screen, p) {
  if (!confirm(`Убрать идею «${p.title}»?`)) return;
  try {
    await mutate(`plans/${p.id}`, 'DELETE');
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
  markSeen(data.ours.map((p) => p.id));
  // Обраний колесом («Идём!») — угорі
  const nextId = data.next?.id;
  const open = data.ours.filter((p) => !p.done).sort((a, b) => (b.id === nextId) - (a.id === nextId));
  const done = data.ours.filter((p) => p.done);
  const doneBtn = (p) => h('button', {
    type: 'button', class: 'plan-done', 'aria-pressed': String(p.done), onclick: () => setDone(screen, p, !p.done),
  }, p.done ? 'вернуть' : 'сделали ✓');

  if (!data.ours.length) {
    return [courier(pet, 'Пока совпадений нет. Отмечай идеи — когда вы оба ❤️ одно и то же, оно появится здесь.'),
      h('button', { type: 'button', class: 'btn btn-primary plan-wide', onclick: () => { view = 'deck'; renderPlans(screen); } }, 'К идеям')];
  }
  return [
    open.length >= 2 ? h('button', { type: 'button', class: 'btn btn-primary plan-wide', onclick: () => { view = 'wheel'; renderPlans(screen); } }, data.spin ? '🎰 Что выпало' : '🎰 Выбрать наугад') : null,
    open.length
      ? h('ul', { class: 'plan-list' }, ...open.map((p) => {
        const row = swipeRow(screen, p, doneBtn(p));
        if (fresh.has(p.id)) row.firstChild.append(h('span', { class: 'plan-new' }, 'новое'));
        if (p.id === nextId) row.firstChild.append(h('span', { class: 'plan-new plan-go' }, '🎡 идём'));
        return row;
      }))
      : h('p', { class: 'mk-wait' }, 'Всё, что совпало, уже сделано 🎉 В «Идеях» найдутся новые.'),
    done.length ? fold('done', `Сделали · ${done.length}`,
      h('ul', { class: 'plan-list' }, ...done.map((p) => swipeRow(screen, p, doneBtn(p))))) : null,
    h('p', { class: 'hint' }, `«Сделали» видите и ты, и ${me.partner}.`),
  ];
}

// Спільний план: змах вправо — «сделали» (з конфеті), у «Сделали» змах уліво — повернути
function swipeRow(screen, p, action) {
  const row = planRow(p, action, 'div');
  const li = h('li', { class: 'plan-swipe' }, row);
  swipeable(li, row, p.done
    ? { canRight: () => false, fold: false, onLeft: () => setDone(screen, p, false) }
    : { onRight: () => { burst(row, '🎉', 8); setDone(screen, p, true); } });
  return li;
}

async function setDone(screen, p, done) {
  const prev = p.done;
  // Шукаємо за id у поточних даних — після фонового оновлення p може бути старою копією
  const mark = (value) => { const cur = data.ours.find((x) => x.id === p.id); if (cur) cur.done = value; };
  mark(done);
  renderPlans(screen);
  try {
    await mutate(`plans/${p.id}`, 'PUT', { done });
    if (done) toast('Ура! Отмечено ✓');
  } catch {
    mark(prev);
    if (alive(screen)) renderPlans(screen);
    toast('Не сохранилось — нет связи');
  }
}

// ── Колесо «что сегодня» ──────────────────────────────────────────────────

const PICK_LINES = [
  'Барабан сказал — значит, так тому и быть 🎰',
  'Решено! Осталось выбрать день 📅',
  'Отличный выбор — моя лапа за! 🐾',
  'Вот и план. Не забудьте мне потом всё рассказать 😉',
];
const PET_LINES = ['Это и про меня! Без меня не начинайте 🐾', 'Ура, я тоже участвую! Уже жду 🐾'];

// «Вместе» — у «Планах» угорі: зустріч — теж план. Значок планет той самий, що був у шапці; тап — шторка «Вместе»
function togetherCard() {
  const festive = chipFestive();
  const planets = document.querySelector('#together-chip .chip-planets')?.cloneNode(true);
  return h('button', {
    type: 'button', class: `plan-together${festive ? ' is-festive' : ''}`, 'aria-label': `Вместе: ${chipLabel()}`,
    onclick: () => document.dispatchEvent(new Event('radovalka:open-together')),
  }, planets || h('span', { 'aria-hidden': 'true' }, '🪐'), h('span', { class: 'plan-together-text' }, chipLabel(), festive ? ' 🎉' : ''), h('span', { class: 'plan-together-go', 'aria-hidden': 'true' }, '›'));
}

// Колесо вдвох: один кличе «Крутим?» зі своїми темами, другий обирає свої й тисне «Готов» — тоді крутить сервер.
// У колесо — теми, обрані обома. Одне обертання на день на двох, результат обовʼязковий
function wheelView(screen, me, pet) {
  const open = data.ours.filter((p) => !p.done);
  const cats = CATS.filter(([k]) => open.some((p) => p.cat === k));
  const inv = data.invite;
  const iCalled = inv?.by === DATA.side;
  const theyCalled = !!inv && !iCalled;
  const she = me.partner === 'она';
  // Теми, яких ще не бачили (зʼявились нові спільні плани), — одразу обрані; зняті людиною — лишаються знятими
  wheelCats ||= new Set();
  for (const [k] of cats) if (!wheelSeen.has(k)) { wheelSeen.add(k); wheelCats.add(k); }
  // Покликав — показуємо надіслані теми; їх можна змінити, поки другий не натиснув «Готов» (запрошення тихо оновиться)
  if (iCalled && !wheelSynced) { wheelCats = new Set(inv.cats.length ? inv.cats : cats.map(([k]) => k)); wheelSynced = true; }
  if (!iCalled) wheelSynced = false;
  const myCats = wheelCats;

  if (open.length < 2 && !data.spin) {
    return [courier(pet, 'Барабану нужно хотя бы два общих плана. Отмечай идеи — каждое совпадение попадёт сюда.'),
      h('button', { type: 'button', class: 'btn btn-primary plan-wide', onclick: () => { view = 'deck'; renderPlans(screen); } }, 'К идеям')];
  }

  // Що на колесі: сьогоднішні сектори з сервера; інакше — превʼю з обраних тем (покликали — перетин з його/її)
  const byId = new Map(data.ours.map((p) => [p.id, p]));
  const preview = () => {
    const want = theyCalled ? [...myCats].filter((c) => inv.cats.includes(c)) : [...myCats];
    const inWant = open.filter((p) => want.includes(p.cat));
    const pool = inWant.length ? inWant : open;
    return pool.length > WHEEL_MAX ? [...pool].sort(() => Math.random() - 0.5).slice(0, WHEEL_MAX) : pool;
  };
  let slots = (data.spin?.slots || []).map((id) => byId.get(id)).filter(Boolean);
  if (!slots.length) {
    const picked = data.spin && byId.get(data.spin.id);
    slots = picked ? [picked, ...preview().filter((p) => p.id !== picked.id)].slice(0, WHEEL_MAX) : preview();
  }
  const reel = makeReel(slots);
  const result = h('div', { class: 'plan-pick', 'aria-live': 'polite' });
  const spinTo = async (id) => {
    const i = slots.findIndex((p) => p.id === id);
    if (i < 0) return;
    await reel.spin(i);
    if (reel.el.isConnected) showPick(result, slots[i], data.spin);
  };
  // Барабан і кнопка під ним (замість маточини колеса)
  const wheel = (hub) => h('div', { class: 'plan-reel-box' }, reel.el, hub);
  const seenKey = `radovalka:wheel-seen:${DATA.side}`;
  const markSeen = (at) => { try { localStorage.setItem(seenKey, String(at)); } catch { /* приватне вікно */ } };

  // ── Останнє обертання: колесо стоїть на результаті; хто бачить уперше — у нього воно прокрутиться.
  // Нове запрошення (від будь-кого) — важливіше за старий результат
  if (data.spin && !inv) {
    let seen = '';
    try { seen = localStorage.getItem(seenKey) || ''; } catch { /* приватне вікно */ }
    markSeen(data.spin.at);
    // «Ещё раз?» — знову кличемо другого (крутимо вдвох скільки завгодно)
    const hub = h('button', {
      type: 'button', class: 'plan-hub plan-hub-again',
      onclick: async () => {
        hub.disabled = true;
        try {
          const r = await mutate('plans/invite', 'POST', { cats: [...wheelCats] });
          data.invite = r.invite;
          renderPlans(screen);
          toast(r.reaches ? `${cap(me.partner)} получит приглашение 💜` : `${cap(me.partner)} увидит, когда откроет «Планы»`);
        } catch (e) {
          hub.disabled = false;
          if (e.status === 409) { reload(screen); return; }
          toast('Не отправилось — нет связи');
        }
      },
    }, 'Ещё раз?');
    if (seen !== String(data.spin.at) && !reduceMotion) {
      reel.set(0);
      requestAnimationFrame(() => requestAnimationFrame(() => spinTo(data.spin.id)));
    } else {
      reel.set(Math.max(0, slots.findIndex((p) => p.id === data.spin.id)));
      const p = byId.get(data.spin.id);
      if (p) showPick(result, p, data.spin);
      else result.append(h('p', { class: 'hint plan-hint' }, 'Барабан уже крутили. Захотите ещё — жмите «Ещё раз?».'));
    }
    return [wheel(hub), result];
  }

  reel.set(0);
  // Теми — кілька одразу; зняли всі — колесо бере всі
  const chips = cats.length > 1 ? h('div', { class: 'mk-chips mk-row plan-filter', role: 'group', 'aria-label': 'Темы' },
    ...cats.map(([k, emoji, label]) => h('button', {
      type: 'button', class: 'mk-chip', 'aria-pressed': String(myCats.has(k)), 'aria-checked': String(myCats.has(k)),
      onclick: async () => {
        if (wheelCats.has(k)) wheelCats.delete(k); else wheelCats.add(k);
        renderPlans(screen);
        // Уже покликали — оновлюємо теми в запрошенні (без нового push)
        if (iCalled) {
          try { const r = await mutate('plans/invite', 'POST', { cats: [...wheelCats] }); data.invite = r.invite; } catch { toast('Темы не обновились — нет связи'); }
        }
      },
    }, `${emoji} ${label}`))) : null;

  let hub;
  let note;
  if (theyCalled) {
    // Покликали мене: обираю свої теми — «Готов», і крутить сервер
    hub = h('button', {
      type: 'button', class: 'plan-hub',
      onclick: async () => {
        hub.disabled = true;
        let r;
        try {
          r = await mutate('plans/spin', 'POST', { cats: [...wheelCats] });
        } catch (e) {
          hub.disabled = false;
          toast(e.status === 409 ? 'Приглашение уже не действует' : 'Барабан не крутится — нет связи');
          if (e.status === 409) reload(screen);
          return;
        }
        data.spin = r.spin;
        data.invite = null;
        data.next = { id: r.spin.id, by: r.spin.by, at: r.spin.at };
        // Перемалювання з тими самими секторами, що зберіг сервер, — і колесо крутиться (ще «не бачили»)
        renderPlans(screen);
      },
    }, 'Готов!');
    note = courier(pet, `${cap(me.partner)} зовёт крутить!${inv.cats.length ? ` ${she ? 'Её' : 'Его'} темы: ${inv.cats.map((k) => catOf(k)[1]).join(' ')}.` : ''} Отметь свои — и «Готов».`);
  } else if (iCalled) {
    hub = h('button', { type: 'button', class: 'plan-hub', disabled: true }, 'Ждём…');
    note = h('div', {},
      courier(pet, `Позвали ${she ? 'её' : 'его'}! ${cap(me.partner)} ${she ? 'будет готова' : 'будет готов'} — и барабан закрутится у обоих 🎰`),
      h('button', {
        type: 'button', class: 'btn plan-wide',
        onclick: async () => {
          try { await mutate('plans/invite', 'DELETE'); data.invite = null; renderPlans(screen); } catch { toast('Не получилось — нет связи'); }
        },
      }, 'Отменить приглашение'));
  } else {
    hub = h('button', {
      type: 'button', class: 'plan-hub',
      onclick: async () => {
        hub.disabled = true;
        try {
          const r = await mutate('plans/invite', 'POST', { cats: [...wheelCats] });
          data.invite = r.invite;
          renderPlans(screen);
          toast(r.reaches ? `${cap(me.partner)} получит приглашение 💜` : `${cap(me.partner)} увидит, когда откроет «Планы»`);
        } catch (e) {
          hub.disabled = false;
          if (e.status === 409) { reload(screen); return; }
          toast('Не отправилось — нет связи');
        }
      },
    }, 'Крутим?');
    note = h('p', { class: 'hint plan-hint' }, `Выбери темы и позови — ${me.partner} отметит свои, и барабан закрутится для вас обоих.`);
  }

  if (chips) ribbon(chips);
  // Що робити — над колесом, щоб не сховалось під меню
  return [chips, h('div', { class: 'plan-note' }, note), wheel(hub),
    open.length > WHEEL_MAX ? h('p', { class: 'hint plan-hint' }, `На барабане до ${WHEEL_MAX} планов — каждый раз другие.`) : null,
    result];
}

function showPick(box, p, spin) {
  const pet = p.cat === 'pets' ? pick(Object.keys(DATA.mascots)) || petFor('box') : petFor('box');
  // Хто крутив: я — «решено»; другий — «он покрутил / она покрутила» (рід — за його/її половиною)
  // Крутили вдвох (spin.with); старі обертання — один
  // Улюбленець — над карткою, інакше на телефоні його ховає нижнє меню
  box.replaceChildren(
    courier(pet, pick(p.cat === 'pets' ? PET_LINES : PICK_LINES)),
    cardBody(p, 'plan-pick-card'),
    h('p', { class: 'hint plan-hint' }, spin?.with
      ? 'Барабан выбрал для вас двоих — план уже первым в «Наших планах». Ещё раз — снова вдвоём.'
      : 'Решено — план уже первым в «Наших планах» у вас обоих.'));
}

// Тап по сповіщенню «Колесо выбрало» — одразу «Наши планы»
export function showOurs() { view = 'ours'; }
export function showWheel() { view = 'wheel'; }
export function showDeck() { view = 'deck'; }

// Барабан: смужка з назвами (повторена кілька разів), у віконці видно три рядки — посередині обраний.
// spin(i) — прокрутка з кількох обертів до плану i; set(i) — одразу на ньому
const REEL_ROW = 52;
const REEL_REPS = 9;
function makeReel(slots) {
  const n = slots.length;
  const strip = h('ul', { class: 'reel-strip' }, ...Array.from({ length: n * REEL_REPS }, (_, j) => {
    const p = slots[j % n];
    return h('li', {}, h('span', { class: 'reel-emoji', 'aria-hidden': 'true' }, catOf(p.cat)[1]), h('span', { class: 'reel-title' }, p.title));
  }));
  const el = h('div', { class: 'plan-reel', role: 'img', 'aria-label': `Барабан: ${slots.map((p) => p.title).join(', ')}` }, strip);
  const at = (k, ms = 0) => {
    strip.style.transition = ms ? `transform ${ms}ms cubic-bezier(.12, .78, .18, 1)` : 'none';
    strip.style.transform = `translateY(${(1 - k) * REEL_ROW}px)`;
  };
  return {
    el,
    set: (i) => at(n + i),
    spin: async (i) => {
      at(i % n);
      void strip.offsetHeight;
      if (reduceMotion) { at(n + i); return; }
      requestAnimationFrame(() => at((REEL_REPS - 2) * n + i, SPIN_MS));
      await wait(SPIN_MS + 60);
    },
  };
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
      const idea = await mutate('plans', 'POST', { title: title.value, note: note.value, cat });
      addMine([idea]);
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

// «✨ Подкинуть идеи»: по 3 пропозиції (спершу із заздалегідь написаного запасу, потім ШІ); у колоду — лише ті, що ❤️.
// Обрані йдуть тихо (без push другому) — вони й так зʼявляться в його/її колоді
function askIdeas(screen) {
  const me = who();
  let cat = 'date';
  const shown = [];
  const hint = h('input', { type: 'text', maxlength: '120', placeholder: 'Пожелание: зимой, недорого, рядом с домом…', 'aria-label': 'Пожелание' });
  const status = h('p', { class: 'plan-sheet-note', 'aria-live': 'polite' });
  const goBtn = h('button', { type: 'button', class: 'btn btn-primary plan-wide' }, '✨ Подкинуть');
  const out = h('div', { class: 'plan-ai-out' });
  openSheet(screen, 'Подкинуть идеи',
    h('h2', {}, 'Подкинуть идеи'),
    catChips(() => cat, (k) => { cat = k; shown.length = 0; }),
    hint, goBtn, status, out);

  // ❤️ — у колоду; ще тап по ✓ — передумали: ідея прибирається
  const pickCard = (idea) => {
    let saved = null;
    const like = h('button', {
      type: 'button', class: 'plan-vote plan-vote-yes plan-ai-like', 'aria-label': `Хочу: ${idea.title}`, 'aria-pressed': 'false',
      onclick: async () => {
        like.disabled = true;
        try {
          if (saved) {
            await mutate(`plans/${saved.id}`, 'DELETE');
            if (data) data.mine = data.mine.filter((x) => x.id !== saved.id);
            saved = null;
            like.textContent = '❤️';
            like.classList.remove('is-on');
          } else {
            saved = await mutate('plans', 'POST', { ...idea, ai: true });
            addMine([saved]);
            like.textContent = '✓';
            like.classList.add('is-on');
            burst(like, '❤️', 6);
          }
          like.setAttribute('aria-pressed', String(!!saved));
        } catch (e) {
          toast(e.status === 409 ? 'Уже совпало — теперь это ваш общий план 💞' : 'Не сохранилось — нет связи');
        } finally {
          like.disabled = false;
        }
      },
    }, '❤️');
    return h('div', { class: 'plan-ai-card' }, cardBody({ ...idea, id: '' }, 'plan-ai-body'), like);
  };

  goBtn.addEventListener('click', async () => {
    goBtn.disabled = true;
    status.textContent = 'Подбираю…';
    try {
      const { ideas } = await mutate('plan-ideas', 'POST', { cat, hint: hint.value, skip: shown });
      ideas.forEach((x) => shown.push(x.title));
      status.textContent = `Отметь ❤️ то, что хочется, — попадёт в колоду, и ${me.partner} увидит.`;
      out.replaceChildren(...ideas.map(pickCard));
      goBtn.textContent = '✨ Ещё варианты';
      out.scrollIntoView?.({ block: 'nearest' });
    } catch (e) {
      status.textContent = AI_ERRORS[e.status] || 'Нет связи — попробуй ещё раз.';
    } finally {
      goBtn.disabled = false;
    }
  });
}
