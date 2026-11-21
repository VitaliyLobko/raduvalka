// «✊ Спор»: камінь, ножиці, папір до двох перемог. Виклик — з «Написать…», хід другого відкривається,
// коли сходили обидва: у того, хто сходив другим, — одразу, у першого — коли відкриє спор
import { DATA, who } from './data.js';
import { get, send } from './api.js';
import { h, toast, cap, reduceMotion } from './ui.js';
import { burst } from './fx.js';

const MOVES = [['r', '✊', 'Камень'], ['s', '✌️', 'Ножницы'], ['p', '✋', 'Бумага']];
const GLYPH = Object.fromEntries(MOVES.map(([k, g]) => [k, g]));
const BEAT = { r: 'Камень тупит ножницы', s: 'Ножницы режут бумагу', p: 'Бумага накрывает камень' };
// doer — хто робить: справу (собака, посуд) — той, хто програв; вибір (фільм, куди піти) — переможець
const PRESETS = {
  dog: { icon: '🐶', label: 'Кто гуляет с собакой', short: 'Гулять с собакой', doer: 'loser', me: 'С собакой гуляешь ты', them: (p) => `С собакой гуляет ${p}` },
  dishes: { icon: '🍽', label: 'Кто моет посуду', short: 'Мыть посуду', doer: 'loser', me: 'Посуду моешь ты', them: (p) => `Посуду моет ${p}` },
  film: { icon: '🎬', label: 'Кто выбирает фильм', short: 'Выбрать фильм', doer: 'winner', me: 'Фильм выбираешь ты', them: (p) => `Фильм выбирает ${p}` },
  place: { icon: '🗺', label: 'Кто выбирает, куда пойдём', short: 'Куда пойдём', doer: 'winner', me: 'Куда пойдём — выбираешь ты', them: (p) => `Куда пойдём — выбирает ${p}` },
};
const POLL = 3000;

const gen = () => (who().partner === 'она' ? 'её' : 'его');
const icon = (g) => PRESETS[g.preset]?.icon || '✊';
const scoreOf = (g) => `${Math.max(g.score.me, g.score.them)}:${Math.min(g.score.me, g.score.them)}`;

// Скільки розіграних раундів цієї гри я вже бачив розкритими
const seenKey = () => `radovalka:duel-seen:${DATA.side}`;
function seenRounds(g) {
  try {
    const [id, n] = (localStorage.getItem(seenKey()) || '').split(':');
    return id === g.id ? Number(n) || 0 : 0;
  } catch { return g.rounds.length; }
}
// Дограні ігри, підсумок яких я вже бачив (останні 30), — інакше після нової гри старі рядки знову «посмотри, кто победил»
const doneKey = () => `radovalka:duel-done:${DATA.side}`;
function doneSeen() {
  try { return JSON.parse(localStorage.getItem(doneKey()) || '[]'); } catch { return []; }
}
const sawEnd = (g) => doneSeen().includes(g.id) || (seenRounds(g) >= g.rounds.length);
function markSeen(g) {
  try {
    localStorage.setItem(seenKey(), `${g.id}:${g.rounds.length}`);
    if (g.done && !doneSeen().includes(g.id)) localStorage.setItem(doneKey(), JSON.stringify([g.id, ...doneSeen()].slice(0, 30)));
  } catch { /* приватне вікно */ }
  document.dispatchEvent(new CustomEvent('radovalka:duel-seen'));
}

// Підсумок словами: для готової теми — хто робить, для своєї — за ким перемога
export function duelResult(g) {
  const p = PRESETS[g.preset];
  const won = g.done.won;
  if (p) return `${p.icon} ${(p.doer === 'winner') === won ? p.me : p.them(who().partner)} (${scoreOf(g)})`;
  return `🏆 «${g.topic}»: победа за ${won ? 'тобой' : who().partner === 'она' ? 'ней' : 'ним'}, ${scoreOf(g)}`;
}

// Картка спору в стрічці: тема, рахунок, чий хід. Дограний, але розкриття ще не бачила — рахунок «?», щоб не зіпсувати
export function duelCard(g, onOpen) {
  const hidden = g.done && !sawEnd(g);
  const turn = !g.done && !g.myMove;
  const state = g.done ? (hidden ? '🏆 Спор решён' : duelResult(g)) : turn ? 'Твой ход' : `Ждём ${gen()} ход`;
  const go = hidden ? 'Посмотреть' : turn ? 'Сходить' : null;
  const n = (x) => h('b', {}, hidden ? '?' : String(x));
  return h('button', {
    type: 'button', class: `duel-card${turn ? ' is-turn' : ''}${g.done ? ' is-done' : ''}`, onclick: onOpen,
    'aria-label': `Спор «${g.topic}»: ${state}`,
  },
  h('span', { class: 'duel-card-head' }, '✊ Спор · до двух побед'),
  h('span', { class: 'duel-card-topic' }, `${icon(g)} ${g.topic}`),
  h('span', { class: 'duel-card-score' }, h('span', {}, cap(who().partner)), n(g.score.them), h('i', {}, ':'), n(g.score.me), h('span', {}, 'Ты')),
  h('span', { class: 'duel-card-foot' }, h('span', { class: 'duel-card-state' }, state), go ? h('span', { class: 'duel-card-go' }, go) : null));
}
// Що малює картка — для підпису рядка стрічки (перемальовується, лише коли змінилось)
export const duelSig = (g) => JSON.stringify([g.score, g.myMove, g.theirMoved, g.done, sawEnd(g), g.rounds.length]);

let open = null;

export async function openDuel() {
  if (open) return;
  const body = h('div', { class: 'duel-body' });
  const close = () => {
    clearInterval(open?.timer);
    open = null;
    el.remove();
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const el = h('div', { class: 'sheet duel-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Спор' },
    h('div', { class: 'sheet-inner' },
      h('div', { class: 'duel-head' },
        h('h2', {}, '✊ Спор'),
        h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕')),
      body));
  open = { body, close, state: '', busy: false, timer: 0, gameId: null };
  document.body.append(backdrop, el);
  document.addEventListener('keydown', onKey);
  body.append(h('p', { class: 'hint duel-hint' }, 'Загружаю…'));
  await refresh(true);
  // Поки відкрито — питаємо сервер часто: хід другого й розкриття приходять самі
  if (open) open.timer = setInterval(() => { if (open && !open.busy && document.visibilityState === 'visible') refresh(); }, POLL);
}

async function refresh(first = false) {
  let r;
  try { r = await get('duel'); } catch {
    if (first && open) { open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, 'Нет связи — спор откроется, когда появится интернет')); }
    return;
  }
  if (!open || open.busy) return;
  const state = JSON.stringify(r);
  if (state === open.state) return;
  open.state = state;
  // Дограна гра, якої я ще не бачив до кінця, — спершу її розкриття; щойно дограна на екрані — лишається підсумок
  const last = r.last && (!sawEnd(r.last) || r.last.id === open.gameId) ? r.last : null;
  show(r.duel || last, !r.duel && !last);
}

// g — гра (чинна чи щойно дограна) або null; fresh — одразу «новий спор»
async function show(g, fresh) {
  const { body } = open;
  open.gameId = fresh || !g ? null : g.id;
  if (fresh || !g) { body.replaceChildren(...setup()); return; }
  const seen = g.done && sawEnd(g) ? g.rounds.length : seenRounds(g);
  const stage = h('div', { class: 'duel-stage' });
  const status = h('p', { class: 'duel-status' });
  const scoreEl = h('p', { class: 'duel-score' });
  const paintScore = (s) => scoreEl.replaceChildren(
    h('span', {}, cap(who().partner)), h('b', {}, String(s.them)), h('span', { class: 'duel-colon' }, ':'), h('b', {}, String(s.me)), h('span', {}, 'Ты'));
  const history = h('div', { class: 'duel-history', 'aria-label': 'Раунды' });
  // Раунд: номер, ходи (другий · я) і чий — словом
  const paintHistory = (n) => history.replaceChildren(...g.rounds.slice(0, n).map((r, i) => h('span', {
    class: `duel-past${r.win ? ` is-${r.win}` : ''}`, title: `Раунд ${i + 1}`,
  }, h('small', {}, String(i + 1)), `${GLYPH[r.them]} ${GLYPH[r.me]}`, h('small', {}, r.win === 'me' ? 'твой' : r.win ? gen() : 'ничья'))));
  const act = h('div', { class: 'duel-act' });
  // Арена: рахунок, руки одна проти одної, що сталося; під нею — розіграні раунди
  body.replaceChildren(h('p', { class: 'duel-topic' }, `${icon(g)} ${g.topic}`), h('div', { class: 'duel-arena' }, scoreEl, stage, status), history, act);

  // Новий розіграний раунд — розкриваємо останній, рахунок до нього — без нього
  const fresh1 = g.rounds.length > seen;
  if (fresh1) {
    const r = g.rounds[g.rounds.length - 1];
    const before = { me: g.score.me - (r.win === 'me' ? 1 : 0), them: g.score.them - (r.win === 'them' ? 1 : 0) };
    paintScore(before);
    paintHistory(g.rounds.length - 1);
    open.busy = true;
    await reveal(stage, status, r);
    open.busy = false;
    if (!open) return;
    markSeen(g);
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
  } else {
    // Свій обраний хід — одразу на моєму боці; у другого ❔, поки раунд не відкрито (сходив чи ні — каже текст)
    stage.replaceChildren(...hands(g.done ? GLYPH[g.rounds.at(-1).them] : '❔', g.done ? GLYPH[g.rounds.at(-1).me] : g.myMove ? GLYPH[g.myMove] : '✊'));
    const r = g.rounds.at(-1);
    if (g.done && r?.win) {
      const [them, me] = stage.children;
      (r.win === 'me' ? me : them).classList.add('is-win');
      (r.win === 'me' ? them : me).classList.add('is-lose');
    }
  }
  paintScore(g.score);
  paintHistory(g.rounds.length);

  if (g.done) {
    status.textContent = duelResult(g);
    status.classList.add('is-final');
    if (fresh1) burst(stage, g.done.won ? '🎉' : '💪', 12);
    act.replaceChildren(h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: () => show(null, true) }, 'Новый спор'));
    return;
  }
  if (g.myMove) {
    if (!fresh1) status.textContent = `Ждём ${gen()} ход…`;
    else status.textContent += ` Твой ход — ${GLYPH[g.myMove]}. Ждём ${gen()}…`;
    act.replaceChildren(h('button', { type: 'button', class: 'duel-cancel', onclick: () => cancel(g) }, 'Отменить спор'));
    return;
  }
  if (!fresh1) status.textContent = g.theirMoved ? `${cap(who().partner)} уже ${who().partner === 'она' ? 'сходила' : 'сходил'} — твой ход` : `Раунд ${g.rounds.length + 1} — твой ход`;
  act.replaceChildren(movesRow((m) => move(g, m)));
}

// Я — праворуч, як свої повідомлення в чаті й рахунок «Она 0 : 1 Ты»
const hands = (them, me) => {
  const t = h('div', { class: 'duel-hand is-them' }, h('span', { class: 'duel-glyph' }, them), h('span', { class: 'duel-who' }, cap(who().partner)));
  const m = h('div', { class: 'duel-hand is-me' }, h('span', { class: 'duel-glyph' }, me), h('span', { class: 'duel-who' }, 'Ты'));
  return [t, m];
};

// «Камень, ножницы, бумага — раз, два, три!»: кулаки тричі підстрибують, потім — справжні ходи
async function reveal(stage, status, r) {
  const [them, me] = hands('✊', '✊');
  stage.replaceChildren(them, me);
  status.textContent = 'Раз, два, три…';
  if (!reduceMotion) {
    const bob = [{ transform: 'translateY(0)' }, { transform: 'translateY(-22px)', offset: 0.45 }, { transform: 'translateY(0)' }];
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all([them, me].map((x) => x.querySelector('.duel-glyph').animate(bob, { duration: 340, easing: 'ease-in-out' }).finished.catch(() => {})));
    }
  }
  them.querySelector('.duel-glyph').textContent = GLYPH[r.them];
  me.querySelector('.duel-glyph').textContent = GLYPH[r.me];
  if (r.win) (r.win === 'me' ? me : them).classList.add('is-win');
  if (r.win) (r.win === 'me' ? them : me).classList.add('is-lose');
  if (!reduceMotion) {
    [them, me].forEach((x) => x.querySelector('.duel-glyph').animate([{ transform: 'scale(.4)' }, { transform: 'scale(1.25)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' }));
  }
  const winMove = r.win === 'me' ? r.me : r.them;
  status.textContent = !r.win ? 'Ничья — ещё раунд!'
    : `${BEAT[winMove]} — ${r.win === 'me' ? 'раунд твой!' : `раунд ${gen()}.`}`;
  await new Promise((done) => setTimeout(done, reduceMotion ? 300 : 900));
}

function movesRow(onPick, picked = null) {
  const row = h('div', { class: 'duel-moves', role: 'group', 'aria-label': 'Твой ход' });
  for (const [k, g, label] of MOVES) {
    row.append(h('button', {
      type: 'button', class: 'duel-move', 'aria-pressed': String(picked === k), 'data-move': k,
      onclick: () => {
        row.querySelectorAll('.duel-move').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.move === k)));
        onPick(k);
      },
    }, h('span', { class: 'duel-move-glyph', 'aria-hidden': 'true' }, g), h('span', {}, label)));
  }
  return row;
}

// Новий спор: тема (готова чи своя) і одразу свій перший хід
function setup() {
  let preset = null;
  let mv = null;
  const own = h('input', { type: 'text', class: 'duel-own', maxlength: '60', placeholder: 'Или свой спор…', 'aria-label': 'Свой спор' });
  const go = h('button', { type: 'button', class: 'btn btn-primary duel-go', disabled: true }, 'Бросить вызов');
  const topic = () => (preset ? PRESETS[preset].label : own.value.replace(/\s+/g, ' ').trim());
  const sync = () => { go.disabled = !topic() || !mv; };
  const chips = h('div', { class: 'duel-topics', role: 'radiogroup', 'aria-label': 'О чём спор' },
    ...Object.entries(PRESETS).map(([k, p]) => h('button', {
      type: 'button', class: 'duel-topic-tile', role: 'radio', 'aria-checked': 'false', 'aria-label': p.label, 'data-k': k,
      onclick: () => {
        preset = preset === k ? null : k;
        if (preset) own.value = '';
        chips.querySelectorAll('.duel-topic-tile').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.k === preset)));
        sync();
      },
    }, h('span', { class: 'duel-topic-icon', 'aria-hidden': 'true' }, p.icon), h('span', {}, p.short))));
  own.addEventListener('input', () => {
    if (own.value.trim() && preset) { preset = null; chips.querySelectorAll('.duel-topic-tile').forEach((c) => c.setAttribute('aria-checked', 'false')); }
    sync();
  });
  go.addEventListener('click', async () => {
    if (go.disabled) return;
    go.disabled = true;
    try {
      const r = await send('duel', 'POST', { preset: preset || undefined, topic: preset ? undefined : topic(), move: mv });
      markSeen(r.duel);
      document.dispatchEvent(new CustomEvent('radovalka:marked'));
      toast(r.reaches ? `✊ Вызов улетел — ${who().partner} получит уведомление` : `✊ Вызов улетел — ${who().partner} увидит в чате`);
      if (open) { open.state = ''; await refresh(); }
    } catch (e) {
      go.disabled = false;
      if (e.status === 409) { toast('Спор уже идёт — сначала доиграйте'); if (open) { open.state = ''; refresh(); } return; }
      toast('Вызов не улетел — нет связи');
    }
  });
  // Блоки по порядку: о чём → твій хід → кинути виклик
  const block = (title, ...kids) => h('section', { class: 'duel-block' }, h('h3', { class: 'duel-block-title' }, title), ...kids);
  return [
    block('О чём спор', chips, own),
    block('Твой ход · камень, ножницы, бумага', movesRow((k) => { mv = k; sync(); })),
    h('p', { class: 'hint duel-hint' }, 'До двух побед. Ходы откроются, когда сходите оба.'),
    go,
  ];
}

async function move(g, m) {
  if (!open || open.busy) return;
  open.busy = true;
  open.body.querySelectorAll('.duel-move').forEach((b) => { b.disabled = true; });
  let r;
  try { r = await send('duel/move', 'POST', { id: g.id, move: m }); } catch (e) {
    if (!open) return;
    open.busy = false;
    if (e.status === 409) { toast('Этот спор уже закончился или отменён'); open.state = ''; refresh(); return; }
    open.body.querySelectorAll('.duel-move').forEach((b) => { b.disabled = false; });
    toast('Ход не ушёл — нет связи');
    return;
  }
  if (!open) return;
  open.busy = false;
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
  open.state = '';
  show(r.duel, false);
}

async function cancel(g) {
  try { await send('duel/cancel', 'POST', { id: g.id }); } catch { toast('Не отменилось — нет связи'); return; }
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
  toast('Спор отменён');
  if (open) { open.state = ''; show(null, true); }
}
