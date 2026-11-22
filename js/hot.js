// «🔥 Совпадёт?» для двох: рівень (💗 / 🔥 / 🌶️), 10 питань, «да / может / нет» кожен за себе.
// Другий бачить лише збіги: обидва «да» — «Обоим хочется», «да» + «может» — «Можно попробовать»; «нет» не видно нікому.
// Тексти питань — лише з сервера в шторці (у коді й у стрічці — ні), відповіді рахує сервер і після гри стирає
import { DATA, who } from './data.js';
import { get, send } from './api.js';
import { h, toast, cap, reduceMotion } from './ui.js';
import { burst } from './fx.js';
import { gameSheet } from './games.js';

const N = 10;
const POLL = 3000;
export const HOT_LEVELS = [
  ['soft', '💗', 'Нежно', 'Объятия, поцелуи, вечер вдвоём'],
  ['hot', '🔥', 'Горячо', 'Посмелее и пооткровеннее'],
  ['fire', '🌶️', 'Огонь', 'Для самых смелых фантазий'],
];
const OPTS = [[2, 'Да 🔥'], [1, 'Может быть'], [0, 'Нет']];
const MATCH = { 2: ['🔥', 'Обоим хочется'], 1: ['✨', 'Можно попробовать'] };
const gen = () => (who().partner === 'она' ? 'её' : 'его');
const qText = (t) => t || 'Вопрос из новой версии — обнови Радовалку';

// Дограні ігри, підсумок яких я вже бачив (останні 30)
const seenKey = () => `radovalka:hot-seen:${DATA.side}`;
function seenList() {
  try { return JSON.parse(localStorage.getItem(seenKey()) || '[]'); } catch { return []; }
}
const sawEnd = (g) => !g.done || seenList().includes(g.id);
function markSeen(g) {
  try { if (!seenList().includes(g.id)) localStorage.setItem(seenKey(), JSON.stringify([g.id, ...seenList()].slice(0, 30))); } catch { /* приватне вікно */ }
  document.dispatchEvent(new CustomEvent('radovalka:duel-seen'));
}

const verdict = (hits) => (hits === 0 ? 'В этот раз мимо — попробуйте другие вопросы'
  : hits <= 2 ? 'Есть с чего начать 😉'
    : hits <= 5 ? 'Есть о чём помечтать вместе'
      : hits <= 8 ? 'Вы явно на одной волне' : 'Огонь! Хочется одного и того же');

// Картка в чаті — скромна: ні рівня, ні питань, лише чия черга чи скільки збіглося
export function hotCard(g, onOpen) {
  const hidden = g.done && !sawEnd(g);
  const turn = !g.done && !g.me;
  const state = g.done ? (hidden ? 'Ответы открылись' : `Совпало ${g.hits} из ${g.n}`) : turn ? 'Твоя очередь отвечать' : `Ждём ${gen()} ответы`;
  const go = hidden ? 'Посмотреть' : turn ? 'Ответить' : null;
  const dots = h('span', { class: 'same-dots', 'aria-hidden': 'true' }, ...Array.from({ length: g.n }, (_, i) => {
    const m = g.done && !hidden ? g.match[i] : -1;
    return h('i', { class: m > 0 ? 'is-hit' : '' }, m > 0 ? MATCH[m][0] : m === 0 ? '·' : '?');
  }));
  return h('button', {
    type: 'button', class: `duel-card same-card hot-card${turn ? ' is-turn' : ''}${g.done ? ' is-done' : ''}`, onclick: onOpen,
    'aria-label': `Вопросы только для вас двоих. ${state}`,
  },
  h('span', { class: 'duel-card-head' }, '🔥 Вопросы только для вас двоих'),
  dots,
  h('span', { class: 'duel-card-foot' }, h('span', { class: 'duel-card-state' }, state), go ? h('span', { class: 'duel-card-go' }, go) : null));
}
export const hotSig = (g) => JSON.stringify([g.me, g.theirDone, g.done, g.hits, sawEnd(g)]);

let open = null;

export async function openHot(past = null) {
  if (open) return;
  const sh = gameSheet({ icon: '🔥', title: 'Совпадёт?', cls: 'same-sheet hot-sheet', onClose: () => { clearInterval(open?.timer); open = null; } });
  open = { body: sh.body, state: '', busy: false, timer: 0, gameId: null, pastId: past?.done ? past.id : null };
  sh.body.append(h('p', { class: 'hint duel-hint' }, 'Загружаю…'));
  await refresh(true);
  if (open) open.timer = setInterval(() => { if (open && !open.busy && document.visibilityState === 'visible') refresh(); }, POLL);
}

async function refresh(first = false) {
  let r;
  try { r = await get('hot'); } catch (e) {
    if (first && open) open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, e.status === 503 ? 'Эта игра пока недоступна' : 'Нет связи — игра откроется, когда появится интернет'));
    return;
  }
  if (!open || open.busy) return;
  const state = JSON.stringify(r);
  if (state === open.state) return;
  open.state = state;
  // Відкрили дограну з чату — її підсумок, поки не натиснуть «Сыграть ещё»; не бачене — теж спершу підсумок
  const last = r.last && (r.last.id === open.pastId || !sawEnd(r.last) || r.last.id === open.gameId) ? r.last : null;
  show(open.pastId && last ? last : r.hot || last);
}

function show(g) {
  open.gameId = g ? g.id : null;
  if (!g) { open.body.replaceChildren(...levels()); return; }
  if (g.done) { result(g); return; }
  if (!g.me) { answer(g.qs, (ans) => reply(g, ans)); return; }
  waiting();
}

// По одному питанню: текст і три кнопки, «Назад»
function answer(qs, onDone, back = null) {
  const ans = [];
  const body = open.body;
  const step = () => {
    const i = ans.length;
    if (i === qs.length) { onDone(ans); return; }
    const pick = (v) => { ans.push(v); step(); };
    const card = h('div', { class: 'same-q hot-q' },
      h('p', { class: 'same-progress' }, ...qs.map((_, k) => h('i', { class: k < i ? 'is-done' : k === i ? 'is-now' : '' })), h('span', {}, `${i + 1} из ${qs.length}`)),
      h('p', { class: 'same-q-text' }, qText(qs[i])),
      h('div', { class: 'hot-opts' }, ...OPTS.map(([v, label]) => h('button', { type: 'button', class: 'same-opt hot-opt', 'data-v': String(v), onclick: () => pick(v) }, label))));
    const prev = i > 0 ? () => { ans.pop(); step(); } : back;
    body.replaceChildren(...[card, prev ? h('button', { type: 'button', class: 'duel-cancel', onclick: prev }, '← Назад') : null].filter(Boolean));
    if (!reduceMotion) card.animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  };
  step();
}

const sending = () => open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, 'Отправляю…'));

async function reply(g, ans) {
  if (!open) return;
  open.busy = true;
  sending();
  let r;
  try { r = await send('hot/answer', 'POST', { id: g.id, ans }); } catch (e) {
    if (!open) return;
    open.busy = false;
    if (e.status === 409) { toast('Эта игра уже закончилась или отменена'); open.state = ''; refresh(); return; }
    toast('Ответы не ушли — нет связи');
    open.body.replaceChildren(h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: () => reply(g, ans) }, 'Отправить ещё раз'));
    return;
  }
  if (!open) return;
  open.busy = false;
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
  open.state = '';
  show(r.hot);
}

// Свої відповіді пішли — тут їх не показуємо: телефон можуть побачити чужі очі
function waiting() {
  const g = { id: open.gameId };
  open.body.replaceChildren(
    h('div', { class: 'duel-arena same-wait' },
      h('p', { class: 'same-big' }, '🤫'),
      h('p', { class: 'duel-status' }, `Твои ответы ушли. Ждём ${gen()} — откроются только совпадения`)),
    h('div', { class: 'duel-act' }, h('button', { type: 'button', class: 'duel-cancel', onclick: () => cancel(g) }, 'Отменить игру')));
}

function again() {
  open.pastId = null;
  open.gameId = null;
  open.state = '';
  open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, 'Загружаю…'));
  refresh(true);
}

// Підсумок: лише збіги, спершу «Обоим хочется»
function result(g) {
  const fresh = !sawEnd(g);
  const big = h('p', { class: 'same-score' }, h('small', {}, 'Совпало'), h('b', {}, String(g.hits)), ` из ${g.n}`);
  const hits = g.match.map((m, i) => [m, i]).filter(([m]) => m > 0).sort((a, b) => b[0] - a[0]);
  const list = hits.length ? h('ul', { class: 'same-rows hot-rows' }, ...hits.map(([m, i]) => h('li', { class: `same-row is-hit hot-row is-${m}` },
    h('span', { class: 'same-row-q' }, qText(g.qs?.[i])),
    h('span', { class: 'hot-tag' }, `${MATCH[m][0]} ${MATCH[m][1]}`))))
    : h('p', { class: 'hint duel-hint' }, 'Ни одного совпадения. Зато никто не узнал чужих «нет» 🤫');
  open.body.replaceChildren(
    h('div', { class: 'duel-arena same-result' }, big, h('p', { class: 'duel-status is-final' }, verdict(g.hits))),
    list,
    h('div', { class: 'duel-act' }, h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: again }, 'Сыграть ещё')));
  if (fresh) {
    if (!reduceMotion) {
      big.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
      [...open.body.querySelectorAll('.hot-row')].forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 300 + i * 120, easing: 'ease-out', fill: 'backwards' }));
    }
    if (g.hits >= 3) burst(big, '🔥', g.hits * 3);
    markSeen(g);
    // Картка в чаті ще «ждём ответы» — перечитати стрічку
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
  }
}

// Новий виклик: спершу рівень, потім 10 питань з нього («Другие вопросы»), потім свої відповіді
function levels() {
  const pick = (lvl) => deal(lvl);
  return [
    h('p', { class: 'hint duel-hint' }, `Отвечай честно: ${who().partner} увидит только совпадения, твои «нет» останутся при тебе.`),
    h('div', { class: 'hot-levels' }, ...HOT_LEVELS.map(([lvl, icon, name, about]) => h('button', {
      type: 'button', class: `game-tile hot-level is-${lvl}`, onclick: () => pick(lvl),
    }, h('span', { class: 'game-tile-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'game-tile-text' }, h('b', {}, name), h('span', {}, about))))),
  ];
}

async function deal(level) {
  if (!open) return;
  open.busy = true;
  open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, 'Подбираю вопросы…'));
  let r;
  try { r = await get(`hot/deal?level=${level}`); } catch {
    if (!open) return;
    open.busy = false;
    toast('Вопросы не загрузились — нет связи');
    open.body.replaceChildren(...levels());
    return;
  }
  if (!open) return;
  const [, icon, name] = HOT_LEVELS.find(([l]) => l === level);
  const list = h('ol', { class: 'same-list' }, ...r.qs.map((q) => h('li', {}, q)));
  const toLevels = () => { open.busy = false; open.body.replaceChildren(...levels()); };
  const view = [
    h('section', { class: 'duel-block' }, h('h3', { class: 'duel-block-title' }, `${icon} ${name}`), list,
      h('button', { type: 'button', class: 'mk-chip same-reroll', onclick: () => deal(level) }, '🔄 Другие вопросы')),
    h('p', { class: 'hint duel-hint' }, `Сначала твои ответы, потом — ${gen()}. Откроются только совпадения.`),
    h('button', {
      type: 'button', class: 'btn btn-primary duel-go',
      onclick: () => answer(r.qs, (ans) => start(level, r.keys, ans), () => open.body.replaceChildren(...view)),
    }, 'Ответить на вопросы'),
    h('button', { type: 'button', class: 'duel-cancel', onclick: toLevels }, '← Другой уровень'),
  ];
  open.body.replaceChildren(...view);
}

async function start(level, keys, ans) {
  if (!open) return;
  open.busy = true;
  sending();
  try {
    const r = await send('hot', 'POST', { level, qs: keys, ans });
    open.busy = false;
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
    toast(r.reaches ? `🔥 Вопросы улетели — ${who().partner} получит уведомление` : `🔥 Вопросы улетели — ${who().partner} увидит в чате`);
    if (open) { open.state = ''; await refresh(); }
  } catch (e) {
    if (!open) return;
    open.busy = false;
    if (e.status === 409) { toast('Игра уже идёт — сначала доиграйте'); open.state = ''; refresh(); return; }
    toast('Вопросы не ушли — нет связи');
    open.body.replaceChildren(h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: () => start(level, keys, ans) }, 'Отправить ещё раз'));
  }
}

async function cancel(g) {
  try { await send('hot/cancel', 'POST', { id: g.id }); } catch { toast('Не отменилось — нет связи'); return; }
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
  toast('Игра отменена');
  if (open) { open.state = ''; open.gameId = null; open.body.replaceChildren(...levels()); }
}
