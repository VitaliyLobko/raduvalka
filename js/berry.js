// «🍓 Клубничка»: вікторина 18+ на двох. Рівень (💗 / 🔥 / 🌶️), 10 питань, 4 варіанти, на кожне 30 секунд.
// Питання приходять з сервера по одному, час рахує сервер; згорнув застосунок — питання згоріло.
// Рахунок і правильні відповіді відкриваються, коли відповіли обоє; переможець загадує желание на зустріч
import { DATA, who } from './data.js';
import { get, send } from './api.js';
import { h, toast, cap, reduceMotion } from './ui.js';
import { burst } from './fx.js';
import { sfx } from './sound.js';
import { gameSheet } from './games.js';

const POLL = 3000;
export const BERRY_LEVELS = [
  ['soft', '💗', 'Нежно', 'Поцелуи, ласки и немного науки'],
  ['hot', '🔥', 'Горячо', 'Посмелее: тело, желание, удовольствие'],
  ['fire', '🌶️', 'Огонь', 'Самые откровенные вопросы'],
];
const LETTERS = ['А', 'Б', 'В', 'Г'];
const gen = () => (who().partner === 'она' ? 'её' : 'его');
const them = () => cap(who().partner);

// Дограні ігри, рахунок яких я вже бачив (останні 30)
const seenKey = () => `radovalka:berry-seen:${DATA.side}`;
function seenList() {
  try { return JSON.parse(localStorage.getItem(seenKey()) || '[]'); } catch { return []; }
}
const sawEnd = (g) => !g.done || seenList().includes(g.id);
function markSeen(g) {
  try { if (!seenList().includes(g.id)) localStorage.setItem(seenKey(), JSON.stringify([g.id, ...seenList()].slice(0, 30))); } catch { /* приватне вікно */ }
  document.dispatchEvent(new CustomEvent('radovalka:duel-seen'));
}

// Картка в чаті — скромна: ні рівня, ні питань, лише поступ чи рахунок
export function berryCard(g, onOpen) {
  const hidden = g.done && !sawEnd(g);
  const turn = !g.done && g.me < g.n;
  const state = g.done ? (hidden ? 'Счёт открылся' : g.tie ? `Ничья ${g.score.me} : ${g.score.them}` : `Счёт ${g.score.me} : ${g.score.them}`)
    : turn ? (g.me ? `Отвечено ${g.me} из ${g.n}` : 'Твоя очередь отвечать') : `Ждём ${gen()} ответы`;
  const go = hidden ? 'Посмотреть' : turn ? (g.me ? 'Продолжить' : 'Ответить') : null;
  const dots = h('span', { class: 'same-dots', 'aria-hidden': 'true' }, ...Array.from({ length: g.n }, (_, i) => h('i', { class: i < g.me ? 'is-hit' : '' }, i < g.me ? '🍓' : '?')));
  return h('button', {
    type: 'button', class: `duel-card same-card berry-card${turn ? ' is-turn' : ''}${g.done ? ' is-done' : ''}`, onclick: onOpen,
    'aria-label': `Клубничка: кто знает больше. ${state}`,
  },
  h('span', { class: 'duel-card-head' }, '🍓 Клубничка: кто знает больше'),
  g.done ? null : dots,
  h('span', { class: 'duel-card-foot' }, h('span', { class: 'duel-card-state' }, state), go ? h('span', { class: 'duel-card-go' }, go) : null));
}
export const berrySig = (g) => JSON.stringify([g.me, g.them, g.done, g.score, sawEnd(g)]);

let open = null;

export async function openBerry(past = null) {
  if (open) return;
  const sh = gameSheet({
    icon: '🍓', title: 'Клубничка', cls: 'same-sheet berry-sheet',
    onClose: () => { stopTick(); clearInterval(open?.timer); document.removeEventListener('visibilitychange', onVis); open = null; },
  });
  open = { body: sh.body, state: '', busy: false, timer: 0, tick: 0, cur: null, burnt: '', gameId: null, pastId: past?.done ? past.id : null, wishes: null };
  document.addEventListener('visibilitychange', onVis);
  sh.body.append(h('p', { class: 'hint duel-hint' }, 'Загружаю…'));
  await refresh(true);
  if (open) open.timer = setInterval(() => { if (open && !open.busy && document.visibilityState === 'visible') refresh(); }, POLL);
}

async function refresh(first = false) {
  let r;
  try { r = await get('berry'); } catch (e) {
    if (first && open) open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, e.status === 503 ? 'Эта игра пока недоступна' : 'Нет связи — игра откроется, когда появится интернет'));
    return;
  }
  if (!open || open.busy) return;
  const state = JSON.stringify(r);
  if (state === open.state) return;
  open.state = state;
  // Відкрили дограну з чату чи ще не бачили рахунку — спершу він, поки не натиснуть «Сыграть ещё»
  const last = r.last && (r.last.id === open.pastId || !sawEnd(r.last) || r.last.id === open.gameId) ? r.last : null;
  show(open.pastId && last ? last : r.berry || last);
}

function show(g) {
  open.gameId = g ? g.id : null;
  if (!g) open.body.replaceChildren(...levels());
  else if (g.done) result(g);
  else if (g.me >= g.n) waiting(g);
  else if (!g.me) rules(g);
  else play(g);
}

const msg = (text) => open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, text));
const retry = (label, fn) => open.body.replaceChildren(h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: fn }, label));
const lvl = (level) => BERRY_LEVELS.find(([l]) => l === level) || BERRY_LEVELS[0];

// Новий виклик: рівень → правила → «Начать»
function levels() {
  return [
    h('p', { class: 'hint duel-hint' }, `Викторина 18+ для вас двоих: кто знает больше — тот загадывает желание на встречу.`),
    h('div', { class: 'hot-levels' }, ...BERRY_LEVELS.map(([level, icon, name, about]) => h('button', {
      type: 'button', class: `game-tile hot-level is-${level}`, onclick: () => rules({ level }),
    }, h('span', { class: 'game-tile-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'game-tile-text' }, h('b', {}, name), h('span', {}, about))))),
  ];
}

// Правила перед першим питанням: таймер стартує лише після «Начать»
function rules(g) {
  const [, icon, name] = lvl(g.level);
  const fresh = !g.id;
  const rule = (ic, text) => h('li', {}, h('span', { 'aria-hidden': 'true' }, ic), h('span', {}, text));
  open.body.replaceChildren(
    h('section', { class: 'duel-block berry-rules' },
      h('h3', { class: 'duel-block-title' }, `${icon} ${name}`),
      h('ul', { class: 'berry-rule-list' },
        rule('❓', '10 вопросов, у каждого 4 варианта и один верный'),
        rule('⏱️', '30 секунд на вопрос: время вышло — без очка'),
        rule('📵', 'Приложение свернуто — вопрос сгорает'),
        rule('🎁', fresh ? `Счёт откроется, когда ответит и ${who().partner}. Победитель загадывает желание на встречу`
          : 'Счёт откроется после твоих ответов. Победитель загадывает желание на встречу'))),
    h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: () => (fresh ? start(g.level) : play(g)) }, 'Начать'),
    fresh ? h('button', { type: 'button', class: 'duel-cancel', onclick: () => open.body.replaceChildren(...levels()) }, '← Другой уровень')
      : h('button', { type: 'button', class: 'duel-cancel', onclick: () => cancel(g) }, 'Отменить игру'));
}

async function start(level) {
  if (!open) return;
  open.busy = true;
  msg('Подбираю вопросы…');
  let r;
  try { r = await send('berry', 'POST', { level }); } catch (e) {
    if (!open) return;
    open.busy = false;
    if (e.status === 409) { toast('Игра уже идёт — сначала доиграйте'); open.state = ''; refresh(); return; }
    toast('Не началось — нет связи');
    open.body.replaceChildren(...levels());
    return;
  }
  if (!open) return;
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
  play(r.berry);
}

// Наступне питання з сервера (те саме, якщо вже відкрите: час іде від першого показу)
async function play(g) {
  if (!open) return;
  open.busy = true;
  open.gameId = g.id;
  let r;
  try { r = await send('berry/next', 'POST', { id: g.id }); } catch (e) {
    if (!open) return;
    if (e.status === 409) { open.busy = false; toast('Эта игра уже закончилась или отменена'); open.state = ''; refresh(); return; }
    retry('Нет связи — попробовать ещё раз', () => play(g));
    return;
  }
  if (!open) return;
  if (!r.q) {
    open.busy = false;
    open.state = '';
    if (r.berry?.done) { document.dispatchEvent(new CustomEvent('radovalka:marked')); result(r.berry); } else refresh();
    return;
  }
  // Це питання згоріло (застосунок згортали), а «-1» не дійшло — шлемо ще раз
  if (open.burnt === `${g.id}:${r.q.i}`) { pick(g, r.q.i, -1); return; }
  question(g, r.q);
}

function stopTick() { clearInterval(open?.tick); if (open) open.tick = 0; }

function question(g, q) {
  const end = Date.now() + q.left * 1000;
  const total = 30;
  const secs = h('b', { class: 'berry-secs' }, String(q.left));
  const bar = h('i', { class: 'berry-bar-fill' });
  const opts = q.opts.map((t, k) => h('button', { type: 'button', class: 'same-opt berry-opt', onclick: () => choose(k) },
    h('span', { class: 'berry-letter', 'aria-hidden': 'true' }, LETTERS[k]), h('span', {}, t)));
  const card = h('div', { class: 'same-q berry-q' },
    h('p', { class: 'same-progress' }, ...Array.from({ length: 10 }, (_, k) => h('i', { class: k < q.i ? 'is-done' : k === q.i ? 'is-now' : '' })), h('span', {}, `${q.i + 1} из 10`)),
    h('div', { class: 'berry-timer', role: 'timer', 'aria-label': 'Осталось секунд' }, h('span', { class: 'berry-bar' }, bar), secs),
    h('p', { class: 'same-q-text berry-q-text' }, q.q),
    h('div', { class: 'berry-opts' }, ...opts));
  open.body.replaceChildren(card);
  open.cur = { g, i: q.i };
  if (document.visibilityState === 'hidden') { onVis(); return; }
  const paint = () => {
    const left = Math.max(0, (end - Date.now()) / 1000);
    secs.textContent = String(Math.ceil(left));
    bar.style.transform = `scaleX(${left / total})`;
    card.classList.toggle('is-hurry', left <= 5);
    if (left <= 0) choose(-1);
  };
  paint();
  stopTick();
  open.tick = setInterval(paint, 200);
  if (!reduceMotion) card.animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
  function choose(k) {
    if (open?.cur?.i !== q.i) return;
    stopTick();
    open.cur = null;
    opts.forEach((b, j) => { b.disabled = true; b.classList.toggle('is-picked', j === k); });
    if (k < 0) card.classList.add('is-late');
    setTimeout(() => pick(g, q.i, k), k < 0 ? 700 : 250);
  }
}

async function pick(g, i, k) {
  if (!open) return;
  let r;
  try { r = await send('berry/pick', 'POST', { id: g.id, i, pick: k }); } catch (e) {
    if (!open) return;
    if (e.status === 409 && e.code === 'order') { play(g); return; }
    if (e.status === 409) { open.busy = false; toast('Эта игра уже закончилась или отменена'); open.state = ''; refresh(); return; }
    retry('Ответ не ушёл — отправить ещё раз', () => pick(g, i, k));
    return;
  }
  if (!open) return;
  if (r.berry.done) { open.busy = false; document.dispatchEvent(new CustomEvent('radovalka:marked')); result(r.berry); return; }
  if (r.berry.me >= r.berry.n) { open.busy = false; open.state = ''; document.dispatchEvent(new CustomEvent('radovalka:marked')); waiting(r.berry); return; }
  play(g);
}

// Згорнув застосунок посеред питання — воно згоріло (сервер теж не зарахує: час вийде)
function onVis() {
  if (document.visibilityState !== 'hidden' || !open?.cur) return;
  const { g, i } = open.cur;
  stopTick();
  open.cur = null;
  open.burnt = `${g.id}:${i}`;
  send('berry/pick', 'POST', { id: g.id, i, pick: -1 }).catch(() => {});
  open.body.replaceChildren(
    h('div', { class: 'duel-arena same-wait' },
      h('p', { class: 'same-big' }, '🔥'),
      h('p', { class: 'duel-status' }, 'Приложение свернули — этот вопрос сгорел')),
    h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: () => play(g) }, i >= 9 ? 'Дальше' : 'К следующему вопросу'));
}

// Свої відповіді пішли — ні рахунку, ні правильних: другий ще відповідає
function waiting(g) {
  open.gameId = g.id;
  open.body.replaceChildren(
    h('div', { class: 'duel-arena same-wait' },
      h('p', { class: 'same-big' }, '🍓'),
      h('p', { class: 'duel-status' }, `Твои ответы ушли. Ждём ${gen()} — ${g.them ? `${who().partner} на ${g.them}-м из ${g.n}` : 'счёт откроется, когда ответите оба'}`)),
    h('div', { class: 'duel-act' }, h('button', { type: 'button', class: 'duel-cancel', onclick: () => cancel(g) }, 'Отменить игру')));
}

function again() {
  open.pastId = null;
  open.gameId = null;
  open.state = '';
  msg('Загружаю…');
  refresh(true);
}

const verdict = (g) => (g.tie ? 'Ничья — желания в этот раз нет. Сыграйте ещё, чтобы решить'
  : g.won ? 'Победа! Загадай желание на встречу' : `В этот раз ${who().partner} знает больше — желание за ${who().partner === 'она' ? 'ней' : 'ним'}`);

// Підсумок: рахунок, желание і «Разбор ответов» (по одному питанню — на один екран)
function result(g) {
  const fresh = !sawEnd(g);
  open.pastId = g.id;
  open.gameId = g.id;
  const big = h('p', { class: 'berry-score' },
    h('span', {}, h('small', {}, 'Ты'), h('b', {}, String(g.score.me))),
    h('i', { 'aria-hidden': 'true' }, ':'),
    h('span', {}, h('small', {}, them()), h('b', {}, String(g.score.them))));
  open.body.replaceChildren(
    h('div', { class: 'duel-arena same-result' }, big, h('p', { class: 'duel-status is-final' }, verdict(g))),
    wishBox(g),
    h('div', { class: 'duel-act berry-act' },
      g.rows?.length ? h('button', { type: 'button', class: 'mk-chip berry-review-go', onclick: () => review(g, 0) }, '🔍 Разбор ответов') : null,
      h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: again }, 'Сыграть ещё')));
  if (fresh) {
    if (!reduceMotion) big.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
    if (g.won) burst(big, '🍓', 18);
    sfx(g.won ? 'win' : g.tie ? 'win' : 'lose', 250);
    markSeen(g);
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
  }
}

// Разбор: питання, чотири варіанти з позначками «ты» / «он(а)», правильний — зеленим, пояснення
function review(g, i) {
  const r = g.rows[i];
  const mark = (k) => [r.me === k ? 'Ты' : null, r.them === k ? them() : null].filter(Boolean).join(' · ');
  const late = (p, who) => (p === -1 ? h('span', { class: 'berry-late' }, `${who}: время вышло`) : null);
  const nav = h('div', { class: 'berry-nav' },
    h('button', { type: 'button', class: 'duel-cancel', disabled: i === 0, onclick: () => review(g, i - 1), 'aria-label': 'Предыдущий вопрос' }, '←'),
    h('button', { type: 'button', class: 'mk-chip berry-back', onclick: () => result(g) }, `К счёту · ${i + 1} из ${g.rows.length}`),
    h('button', { type: 'button', class: 'duel-cancel', disabled: i === g.rows.length - 1, onclick: () => review(g, i + 1), 'aria-label': 'Следующий вопрос' }, '→'));
  open.body.replaceChildren(...[
    nav,
    r ? h('div', { class: 'same-q berry-q berry-review' },
      h('p', { class: 'same-q-text berry-q-text' }, r.q),
      h('div', { class: 'berry-opts' }, ...r.opts.map((t, k) => h('div', { class: `same-opt berry-opt${k === r.right ? ' is-right' : ''}${(r.me === k || r.them === k) && k !== r.right ? ' is-wrong' : ''}` },
        h('span', { class: 'berry-letter', 'aria-hidden': 'true' }, k === r.right ? '✓' : LETTERS[k]), h('span', {}, t),
        mark(k) ? h('small', { class: 'berry-who' }, mark(k)) : null))),
      late(r.me, 'Ты'), late(r.them, them()),
      r.fact ? h('p', { class: 'berry-fact' }, r.fact) : null)
      : h('p', { class: 'hint duel-hint' }, 'Этого вопроса уже нет в наборе'),
  ]);
}

// Желание переможця: готові на вибір («🔄 Другие») або своє; той, хто програв, відмічає «Исполнено ✓»
function wishBox(g) {
  const box = h('div', { class: 'duel-wish berry-wish' });
  const state = (text) => h('p', { class: 'duel-wish-state' }, text);
  const paint = (w) => {
    if (w) {
      box.replaceChildren(h('p', { class: 'duel-wish-text' }, `🎁 ${w.text}`),
        w.done ? state('Исполнено ✓') : w.mine ? state(`Ждёт встречи — ${who().partner} отметит, когда исполнит`)
          : h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: async (e) => {
            e.currentTarget.disabled = true;
            try {
              const r = await send('duel/wish-done', 'POST', { id: g.id });
              g.wish = r.wish;
              paint(r.wish);
              burst(box, '🎁', 10);
              document.dispatchEvent(new CustomEvent('radovalka:marked'));
            } catch { e.currentTarget.disabled = false; toast('Не отметилось — нет связи'); }
          } }, 'Исполнено ✓'));
      return;
    }
    if (g.tie) { box.hidden = true; return; }
    if (!g.won) { box.replaceChildren(state(`🎁 Ждём, что ${who().partner} загадает`)); return; }
    const input = h('textarea', { class: 'duel-own duel-wish-input', maxlength: '300', rows: '2', placeholder: 'Или своё желание…', 'aria-label': 'Желание на встречу' });
    const go = h('button', { type: 'button', class: 'btn btn-primary duel-go', disabled: true }, '🎁 Загадать');
    const chips = h('div', { class: 'berry-presets' });
    const deal = () => {
      const list = [...(open?.wishes || [])].sort(() => Math.random() - 0.5).slice(0, 3);
      chips.replaceChildren(...list.map((t) => h('button', { type: 'button', class: 'mk-chip berry-preset', onclick: () => { input.value = t; go.disabled = false; } }, t)),
        list.length ? h('button', { type: 'button', class: 'mk-chip berry-more', onclick: deal, 'aria-label': 'Другие желания' }, '🔄') : null);
    };
    if (open.wishes) deal();
    else get('berry/wishes').then((r) => { if (open) { open.wishes = r.wishes || []; deal(); } }).catch(() => {});
    input.addEventListener('input', () => { go.disabled = !input.value.trim(); });
    go.addEventListener('click', async () => {
      const text = input.value.replace(/\s+/g, ' ').trim();
      if (!text) return;
      go.disabled = true;
      try {
        const r = await send('berry/wish', 'POST', { id: g.id, text });
        g.wish = r.wish;
        paint(r.wish);
        burst(box, '🎁', 12);
        toast(`🎁 Загадано — ${who().partner} увидит в чате`);
        document.dispatchEvent(new CustomEvent('radovalka:marked'));
      } catch (e) {
        go.disabled = false;
        toast(e.status ? 'Желание уже загадано' : 'Не ушло — нет связи');
      }
    });
    box.replaceChildren(h('p', { class: 'duel-wish-state' }, '🎁 Твоё желание на встречу'), chips, input, go);
  };
  paint(g.wish);
  return box;
}

async function cancel(g) {
  try { await send('berry/cancel', 'POST', { id: g.id }); } catch { toast('Не отменилось — нет связи'); return; }
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
  toast('Игра отменена');
  if (open) { open.state = ''; open.gameId = null; open.busy = false; open.body.replaceChildren(...levels()); }
}
