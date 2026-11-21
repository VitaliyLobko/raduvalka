// Ігри на двох з «🎲 Игры»: камінь-ножиці до двох перемог, хрестики-нолики, «Четыре в ряд» і морський бій; ставка — «На что играем».
// Камінь-ножиці: хід другого відкривається, коли сходили обидва; хрестики — по черзі, кожен хід видно
import { DATA, who } from './data.js';
import { get, send, getAltKey } from './api.js';
import { h, toast, cap, reduceMotion } from './ui.js';
import { burst, boardWin, boardLose, boardDraw } from './fx.js';
import { mascotImg, petName, petLine } from './icons.js';
import { placer, seaEl, shipEl, cellOf, markShot, fxShot, fxMiss, fxHit, fxSink, noteReveal, pause, SHOT, WORLD } from './battle.js';

// Улюбленці «радять» на мій хід — шкідливо й смішно. Своя фраза улюбленця з бази — lines.gametip
const TIPS = {
  rps: ['Бумагу не бери, она ненадёжная.', 'Камень. Всегда камень. Ну, почти всегда.', 'Покажи ножницы, но с очень уверенным лицом.',
    'Смотри в глаза и выбирай третье.', 'Говорят, после камня всегда бумага. Или нет.', 'Ножницы режут бумагу, а я — колбаску. Бери ножницы.',
    'Закрой глаза и тыкай. Я всегда так делаю.', 'Покажи лапу. А, у тебя рука. Ну, тоже сойдёт.', 'Шепну по секрету: камень. Только никому.',
    'Ножницы сегодня острые. Мне так кажется.', 'Считай до трёх и бери то, что первое в голову придёт.',
    'Новички чаще начинают с камня. Бумага это знает.', 'Кто выиграл, часто повторяет. Подумай, чем ответить.',
    'Три раза одно и то же почти никто не кидает. Хитрость!', 'Ножницы в начале показывают реже всего. Сюрприз?',
    'После проигрыша обычно меняют ход. А я меняю диван.', 'Повторить прошлый ход? Смело. Или хитро.'],
  ttt: ['Конём ходи!', 'Ставь в угол, углы любят победителей.', 'Центр — для слабаков. Хотя нет, ставь в центр.',
    'Нарисуй сердечко. Ой, тут так нельзя?', 'Главное — не туда, где уже занято.', 'Лапой бы вот сюда. Или туда.',
    'Крестик — это два нолика, которые поссорились.', 'Нолики круглые, как мячик. Уважаю нолики.',
    'Хочешь, сяду на клеточку? Тогда её никто не займёт.', 'Угол, центр, угол. Или наоборот. Я забываю.',
    'Два в ряд у соперника? Сначала закрой, потом мечтай.', 'Сделай вилку: две угрозы сразу. Мне вилки тоже нравятся.',
    'На угол отвечают центром. Так в умных книжках пишут.', 'Противоположный угол — коварный ход. Уважаю коварство.',
    'Ничья — тоже хорошо. Никто не плачет, все гладят меня.'],
  c4: ['Конём ходи!', 'Бросай в середину, там теплее.', 'Смотри наискосок, там вечно кто-то прячется.',
    'Брось и сделай вид, что так и задумано.', 'Если проиграешь — это был не мой совет.', 'Бросай повыше. Хм, всё равно падает вниз.',
    'Я тоже люблю ронять вещи сверху. Бросай!', 'Четыре в ряд? У меня четыре лапы, я в теме.', 'Столбик слева скучает. Порадуй его.',
    'Можно я подержу фишку? Обещаю не грызть.', 'Не спеши. Я вот могу полдня смотреть в окно.',
    'Середина — главное место. Как диван в квартире.', 'Под чужую тройку не бросай: сверху станет четыре.',
    'Две угрозы сразу не закроешь. Сделай две!', 'Посмотри, нет ли у соперника трёх в ряд. Я тоже посмотрю.',
    'Иногда лучший ход — помешать. Мешать я умею лучше всех.', 'Строй снизу, фишкам нужна опора. Мне тоже.'],
  bs: ['Стреляй в середину, там точно кто-то прячется.', 'Попал? Стреляй рядом — кораблики длинные.', 'Кораблики не касаются друг друга. Значит, вокруг потопленного пусто.',
    'Я бы спрятался в углу. Но я и так всегда в углу.', 'Буль! Ой, это я в миску.', 'Записки внутри! Топи скорее, интересно же.',
    'Стреляй крестиком: через клеточку. Так хитрые капитаны делают.', 'Мимо — не беда. Море большое, а небо ещё больше.',
    'Я плавать не умею, но болею за тебя.', 'Ракеты боятся щекотки. Целься в бок.'],
  any: ['Хвостом чую: сейчас будет красиво.', 'Думай сколько надо. Только миска сама не наполнится.', 'Победишь — с тебя вкусняшка.',
    'Я в тебя верю. Почти.', 'Выиграешь или нет, обнимашки всё равно будут.', 'Почеши мне за ухом и ходи. Так удачнее.',
    'Сделай умное лицо. Мне помогает.', 'Я тихонько посмотрю. Только посоплю немножко.',
    'Ты играешь, я болею. За тебя, конечно.', 'Хорошая партия. Лапу даю.', 'Засчитываю любой ход, если потом погладишь.',
    'Глубоко вдохни. Я так перед прыжком на шкаф делаю.', 'Я на твоей стороне. И на твоей подушке.',
    'Ходи красиво, вдруг нас снимают.', 'Весь дом за тебя. Ну, я точно.', 'Сыграем потом в мячик? Это моя любимая игра.',
    'Если что, я болею из-под одеяла.'],
};
// Як часто порада на мій хід: у «Четыре в ряд» ходів багато — рідше, щоб не набридало
const TIP_CHANCE = { rps: 0.5, ttt: 0.5, c4: 0.2, bs: 0.2 };
// Випадковий улюбленець із порадою під полем
function petTip(kind) {
  const pets = Object.keys(DATA.mascots || {});
  if (!pets.length || Math.random() >= TIP_CHANCE[kind]) return null;
  const key = pets[Math.floor(Math.random() * pets.length)];
  const list = [...TIPS[kind], ...TIPS.any];
  const line = petLine(key, 'gametip', list[Math.floor(Math.random() * list.length)]);
  return h('div', { class: 'pet-tip', role: 'note' },
    h('span', { class: 'pet-tip-face', 'aria-hidden': 'true', html: mascotImg(key) }),
    h('p', {}, h('b', {}, petName(key)), ' ', line));
}

const MOVES = [['r', '✊', 'Камень'], ['s', '✌️', 'Ножницы'], ['p', '✋', 'Бумага']];
const GLYPH = Object.fromEntries(MOVES.map(([k, g]) => [k, g]));
const BEAT = { r: 'Камень тупит ножницы', s: 'Ножницы режут бумагу', p: 'Бумага накрывает камень' };
// doer — хто робить: справу (собака, посуд) — той, хто програв; вибір (фільм, куди піти, желание) — переможець.
// «Просто так» — без ставки
const PRESETS = {
  free: { icon: '🎲', label: 'Просто так', short: 'Просто так' },
  wish: { icon: '🎁', label: 'На желание', short: 'На желание', doer: 'winner', me: 'Желание загадываешь ты', them: (p) => `Желание загадывает ${p}` },
  dog: { icon: '🐶', label: 'Кто гуляет с собакой', short: 'Гулять с собакой', doer: 'loser', me: 'С собакой гуляешь ты', them: (p) => `С собакой гуляет ${p}` },
  dishes: { icon: '🍽', label: 'Кто моет посуду', short: 'Мыть посуду', doer: 'loser', me: 'Посуду моешь ты', them: (p) => `Посуду моет ${p}` },
  film: { icon: '🎬', label: 'Кто выбирает фильм', short: 'Выбрать фильм', doer: 'winner', me: 'Фильм выбираешь ты', them: (p) => `Фильм выбирает ${p}` },
  place: { icon: '🗺', label: 'Кто выбирает, куда пойдём', short: 'Куда пойдём', doer: 'winner', me: 'Куда пойдём — выбираешь ты', them: (p) => `Куда пойдём — выбирает ${p}` },
};
const POLL = 3000;

const GAMES = { rps: { icon: '✊', name: 'Камень-ножницы' }, ttt: { icon: '♂️♀️', name: 'Крестики-нолики' }, c4: { icon: '🔵🔴', name: 'Четыре в ряд' }, bs: { icon: '🚢', name: 'Морской бой' } };
// Ігри на полі: розмір, фішки, дієслово ходу; drop — фішка падає донизу стовпчика
const GRIDS = {
  ttt: { kind: 'ttt', w: 3, h: 3, icon: '♂️', verb: 'ставь' },
  c4: { kind: 'c4', w: 7, h: 6, icon: '🔵', verb: 'бросай', drop: true },
};
const gridOf = (g) => (Object.hasOwn(GRIDS, g?.game ?? '') ? GRIDS[g.game] : null);
// Фішки — знаки ♂/♀ лінією: фішка належить стороні (він — синій ♂, вона — червона ♀), хто б не ходив першим
const SYM = {
  he: '<circle cx="16" cy="24" r="10" pathLength="1"/><path d="M23.5 16.5 34 6" pathLength="1"/><path d="M25 6h9v9" pathLength="1"/>',
  she: '<circle cx="20" cy="15" r="10" pathLength="1"/><path d="M20 25v12" pathLength="1"/><path d="M14 31h12" pathLength="1"/>',
};
const mySex = () => (DATA.side === 'vona' ? 'she' : 'he');
const otherSex = () => (mySex() === 'he' ? 'she' : 'he');
const sexOf = (c, mine) => (c === mine ? mySex() : otherSex());
const symSvg = (sex) => '<svg viewBox="0 0 40 40">' + SYM[sex] + '</svg>';
const sym = (sex, cls = '') => h('span', { class: 'gsym is-' + sex + cls, 'aria-hidden': 'true', html: symSvg(sex) });

const gen = () => (who().partner === 'она' ? 'её' : 'его');
const icon = (g) => PRESETS[g.preset]?.icon || (gridOf(g)?.icon ?? '✊');
const isBoard = (g) => !!gridOf(g);
const isBs = (g) => g?.game === 'bs';
const kindOf = (g) => gridOf(g)?.kind ?? (isBs(g) ? 'bs' : 'rps');
export const duelKind = kindOf;
const gameName = (kind) => `${GAMES[kind].icon} ${GAMES[kind].name}`;
// Поступ гри, який я бачив: камінь-ножиці — розіграні раунди, хрестики — зроблені ходи
const progress = (g) => (isBoard(g) || isBs(g) ? g.n : g.rounds.length);
const scoreOf = (g) => `${Math.max(g.score.me, g.score.them)}:${Math.min(g.score.me, g.score.them)}`;

// Скільки цієї гри я вже бачив (раундів чи ходів)
const seenKey = () => `radovalka:duel-seen:${DATA.side}`;
function seenRounds(g) {
  try {
    const [id, n] = (localStorage.getItem(seenKey()) || '').split(':');
    return id === g.id ? Number(n) || 0 : 0;
  } catch { return progress(g); }
}
// Дограні ігри, підсумок яких я вже бачив (останні 30), — інакше після нової гри старі рядки знову «посмотри, кто победил»
const doneKey = () => `radovalka:duel-done:${DATA.side}`;
function doneSeen() {
  try { return JSON.parse(localStorage.getItem(doneKey()) || '[]'); } catch { return []; }
}
const sawEnd = (g) => doneSeen().includes(g.id) || (seenRounds(g) >= progress(g));
function markSeen(g) {
  try {
    localStorage.setItem(seenKey(), `${g.id}:${progress(g)}`);
    if (g.done && !doneSeen().includes(g.id)) localStorage.setItem(doneKey(), JSON.stringify([g.id, ...doneSeen()].slice(0, 30)));
  } catch { /* приватне вікно */ }
  document.dispatchEvent(new CustomEvent('radovalka:duel-seen'));
}

// Підсумок словами: для готової ставки — хто робить, «Просто так» і своя — за ким перемога
export function duelResult(g) {
  const p = PRESETS[g.preset];
  const won = g.done.won;
  // У хрестиках рахунок завжди 1:0 — не пишемо
  const score = isBoard(g) ? '' : `, ${scoreOf(g)}`;
  const victory = `победа за ${won ? 'тобой' : who().partner === 'она' ? 'ней' : 'ним'}`;
  if (g.preset === 'free') return `🏆 ${cap(victory)}${score}`;
  if (p) return `${p.icon} ${(p.doer === 'winner') === won ? p.me : p.them(who().partner)}${isBoard(g) ? '' : ` (${scoreOf(g)})`}`;
  return `🏆 «${g.topic}»: ${victory}${score}`;
}

// Картка спору в стрічці: тема, рахунок, чий хід. Дограний, але розкриття ще не бачила — рахунок «?», щоб не зіпсувати
export function duelCard(g, onOpen) {
  const hidden = g.done && !sawEnd(g);
  const turn = !g.done && !g.myMove;
  // «На желание»: переможець ще не загадав — кличемо загадати
  const toWish = g.done && !hidden && g.preset === 'wish' && g.done.won && !g.wish;
  const state = g.done ? (hidden ? '🏆 Игра окончена' : duelResult(g)) : turn ? (g.needFleet ? 'Расставь флот' : 'Твой ход')
    : isBs(g) && !g.ready ? `Ждём, когда ${who().partner} расставит флот` : `Ждём ${gen()} ход`;
  const go = hidden ? 'Посмотреть' : turn ? 'Сходить' : toWish ? '🎁 Загадать' : null;
  const n = (x) => h('b', {}, String(x));
  const mini = () => h('span', { class: `duel-card-board is-${kindOf(g)}`, 'aria-hidden': 'true' }, ...[...g.board].map((c, i) => h('i', { class: g.line?.includes(i) ? 'is-line' : '' }, c === '.' ? '' : sym(sexOf(c, g.mark)))));
  // Догране й ще не бачене — не «?», а розмите поле (чи рахунок) і «Чья победа? 👀»: видно, що всередині результат
  const mid = hidden
    ? h('span', { class: 'duel-card-secret' }, isBoard(g) ? mini() : h('span', { class: 'duel-card-score' }, n('?'), h('i', {}, ':'), n('?')), h('b', {}, 'Чья победа? 👀'))
    : !isBoard(g) ? h('span', { class: 'duel-card-score' }, h('span', {}, cap(who().partner)), n(g.score.them), h('i', {}, ':'), n(g.score.me), h('span', {}, 'Ты'))
      : mini();
  return h('button', {
    type: 'button', class: `duel-card${turn || toWish ? ' is-turn' : ''}${g.done ? ' is-done' : ''}`, onclick: onOpen,
    'aria-label': `${GAMES[kindOf(g)].name}, «${g.topic}»: ${state}`,
  },
  // Назва гри й ставка — одним рядком: ставка маленькою плашкою, а не великим заголовком
  h('span', { class: 'duel-card-head' }, isBoard(g) || isBs(g) ? gameName(kindOf(g)) : `${gameName('rps')} · до двух побед`,
    h('span', { class: 'duel-card-stake' }, `${icon(g)} ${g.topic}`)),
  mid,
  h('span', { class: 'duel-card-foot' }, h('span', { class: 'duel-card-state' }, state), go ? h('span', { class: 'duel-card-go' }, go) : null));
}
// Що малює картка — для підпису рядка стрічки (перемальовується, лише коли змінилось)
export const duelSig = (g) => JSON.stringify([g.score, g.myMove, g.theirMoved, g.done, sawEnd(g), g.rounds.length, g.n, g.board, g.wish]);

// «🎁 Желание» окремим рядком у стрічці: висить, поки той, хто програв, не відмітить «Исполнено ✓»
export function gwishCard(n) {
  const w = n.wish;
  if (!w) return null;
  const card = h('div', { class: `duel-card gwish-card${w.done ? ' is-done' : !w.mine ? ' is-turn' : ''}` });
  const paint = () => card.replaceChildren(
    h('span', { class: 'duel-card-head' }, w.mine ? '🎁 Твоё желание' : `🎁 Желание ${who().partner === 'она' ? 'от неё' : 'от него'}`),
    h('span', { class: 'duel-card-topic gwish-text' }, w.text),
    h('span', { class: 'duel-card-foot' }, w.done ? h('span', { class: 'duel-card-state' }, 'Исполнено ✓')
      : w.mine ? h('span', { class: 'duel-card-state' }, `Ждёт, когда ${who().partner} исполнит`)
        : h('button', { type: 'button', class: 'duel-card-go gwish-done', onclick: done }, 'Исполнено ✓')));
  async function done(e) {
    e.currentTarget.disabled = true;
    const r = await wishDone(n.game);
    if (!r) { e.currentTarget.disabled = false; return; }
    Object.assign(w, r);
    card.className = 'duel-card gwish-card is-done';
    paint();
    burst(card, '🎁', 10);
  }
  paint();
  return card;
}

async function wishDone(id) {
  try {
    const r = await dsend('duel/wish-done', 'POST', { id });
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
    toast(`Исполнено ✓ — ${who().partner} узнает`);
    return r.wish;
  } catch (e) {
    toast(e.status ? 'Не получилось — желание уже отмечено' : 'Не отметилось — нет связи');
    return null;
  }
}

// «🎁 На желание» під підсумком: переможець пише желание, той, хто програв, бачить його і відмічає «Исполнено ✓»
function wishBox(g) {
  if (g.preset !== 'wish' || !g.done) return null;
  const box = h('div', { class: 'duel-wish' });
  const state = (text) => h('p', { class: 'duel-wish-state' }, text);
  const paint = (w) => {
    if (w) {
      box.replaceChildren(h('p', { class: 'duel-wish-text' }, `🎁 ${w.text}`),
        w.done ? state('Исполнено ✓') : w.mine ? state(`Ждёт, когда ${who().partner} исполнит`)
          : h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: async (e) => {
            e.currentTarget.disabled = true;
            const r = await wishDone(g.id);
            if (r) { g.wish = r; paint(r); burst(box, '🎁', 10); } else e.currentTarget.disabled = false;
          } }, 'Исполнено ✓'));
      return;
    }
    if (!g.done.won) { box.replaceChildren(state(`🎁 Ждём, что ${who().partner} загадает`)); return; }
    const input = h('textarea', { class: 'duel-own duel-wish-input', maxlength: '300', rows: '2', placeholder: 'Твоё желание…', 'aria-label': 'Твоё желание' });
    const go = h('button', { type: 'button', class: 'btn btn-primary duel-go', disabled: true }, '🎁 Загадать');
    input.addEventListener('input', () => { go.disabled = !input.value.trim(); });
    go.addEventListener('click', async () => {
      const text = input.value.replace(/\s+/g, ' ').trim();
      if (!text) return;
      go.disabled = true;
      if (open) open.busy = true;
      try {
        const r = await dsend('duel/wish', 'POST', { id: g.id, text });
        g.wish = r.wish;
        document.dispatchEvent(new CustomEvent('radovalka:marked'));
        toast(`🎁 Желание улетело — ${who().partner} увидит в чате`);
        paint(r.wish);
      } catch (e) {
        go.disabled = false;
        toast(e.status ? 'Не получилось — эта игра уже не на желание' : 'Желание не ушло — нет связи');
      }
      if (open) { open.busy = false; open.state = ''; }
    });
    box.replaceChildren(input, go);
  };
  paint(g.wish);
  return box;
}

let open = null;

// game — з плитки «Игры»: яку гру пропонувати, коли зараз нічого не йде
// Налагодження «Играть за двоих» (лише в нього, де збережено обидва ключі): гра перемальовується з її боку,
// її ходи йдуть її ключем. DATA.side підмінюємо лише поки відкрита гра — закрив чи повернувся, і все назад
let actAs = null;
const asOpt = () => (actAs ? { key: actAs.key } : {});
const dsend = (path, method, body) => send(path, method, body, asOpt());
const canActBoth = () => { try { return localStorage.getItem('radovalka:debug-both') === '1'; } catch { return false; } };
function playAs(on) {
  if (on && !actAs) { actAs = { key: getAltKey(), real: DATA.side }; DATA.side = DATA.side === 'vin' ? 'vona' : 'vin'; }
  if (!on && actAs) { DATA.side = actAs.real; actAs = null; }
}

export async function openDuel({ game = 'rps' } = {}) {
  if (open) return;
  if (!GAMES[game]) game = 'rps';
  const body = h('div', { class: 'duel-body' });
  const title = h('h2', {}, gameName(game));
  const close = () => {
    clearInterval(open?.timer);
    playAs(false);
    open = null;
    el.remove();
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const el = h('div', { class: 'sheet duel-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': GAMES[game].name },
    h('div', { class: 'sheet-inner' },
      h('div', { class: 'duel-head' },
        title,
        // «🎭 За неё» — лише з його половини, коли в «Отладке» ввімкнено «Играть за двоих»
        DATA.side === 'vin' && canActBoth() && getAltKey() ? h('button', {
          type: 'button', class: 'duel-as',
          onclick: (e) => {
            if (open?.busy) return;
            playAs(!actAs);
            e.currentTarget.textContent = actAs ? '🪐 За себя' : '🎭 За неё';
            open.state = '';
            refresh(true);
          },
        }, '🎭 За неё') : null,
        h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕')),
      body));
  // kind — яку гру показуємо: ту, що йде, або обрану плиткою; заголовок шторки — за нею
  const setKind = (kind) => {
    open.kind = kind;
    title.textContent = gameName(kind);
    el.setAttribute('aria-label', GAMES[kind].name);
  };
  open = { body, close, state: '', busy: false, timer: 0, gameId: null, kind: game, setKind };
  document.body.append(backdrop, el);
  document.addEventListener('keydown', onKey);
  body.append(h('p', { class: 'hint duel-hint' }, 'Загружаю…'));
  await refresh(true);
  // Поки відкрито — питаємо сервер часто: хід другого й розкриття приходять самі
  if (open) open.timer = setInterval(() => { if (open && !open.busy && document.visibilityState === 'visible') refresh(); }, POLL);
}

async function refresh(first = false) {
  let r;
  try { r = await get(`duel?game=${open.kind}`, asOpt()); } catch {
    if (first && open) { open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, 'Нет связи — игра откроется, когда появится интернет')); }
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
  if (fresh || !g) { open.setKind(open.kind); body.replaceChildren(...setup()); return; }
  // «Сыграть ещё» після неї — та сама гра
  open.setKind(kindOf(g));
  if (isBoard(g)) { showBoard(g); return; }
  if (isBs(g)) { showBs(g); return; }
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
    act.replaceChildren(...doneActs(g));
    return;
  }
  if (g.myMove) {
    if (!fresh1) status.textContent = `Ждём ${gen()} ход…`;
    else status.textContent += ` Твой ход — ${GLYPH[g.myMove]}. Ждём ${gen()}…`;
    act.replaceChildren(h('button', { type: 'button', class: 'duel-cancel', onclick: () => cancel(g) }, 'Отменить игру'));
    return;
  }
  if (!fresh1) status.textContent = g.theirMoved ? `${cap(who().partner)} уже ${who().partner === 'она' ? 'сходила' : 'сходил'} — твой ход` : `Раунд ${g.rounds.length + 1} — твой ход`;
  act.replaceChildren(...[movesRow((m) => move(g, m)), petTip('rps')].filter(Boolean));
}

// Під дограною грою: желание (якщо грали на нього) і «Сыграть ещё» — та сама гра; поруч із желанием кнопка тихіша
function doneActs(g) {
  const wish = wishBox(g);
  return [wish, h('button', { type: 'button', class: `btn ${wish ? '' : 'btn-primary '}duel-go`, onclick: () => show(null, true) }, 'Сыграть ещё')].filter(Boolean);
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

// Нова гра (тієї, що в open.kind): на що граємо (готове чи своє, спершу «Просто так») і одразу свій перший хід
function setup() {
  let preset = 'free';
  let mv = null;
  const { kind } = open;
  const own = h('input', { type: 'text', class: 'duel-own', maxlength: '60', placeholder: 'Или своя ставка…', 'aria-label': 'Своя ставка' });
  const go = h('button', { type: 'button', class: 'btn btn-primary duel-go', disabled: true }, 'Позвать играть');
  const topic = () => (preset ? PRESETS[preset].label : own.value.replace(/\s+/g, ' ').trim());
  const sync = () => { go.disabled = !topic() || (!mv && !fleet); };
  const fleet = kind === 'bs' ? placer(DATA.side) : null;
  const chips = h('div', { class: 'duel-topics', role: 'radiogroup', 'aria-label': 'На что играем' },
    ...Object.entries(PRESETS).map(([k, p]) => h('button', {
      type: 'button', class: 'duel-topic-tile', role: 'radio', 'aria-checked': String(k === preset), 'aria-label': p.label, 'data-k': k,
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
      const r = await dsend('duel', 'POST', { preset: preset || undefined, topic: preset ? undefined : topic(), move: mv || undefined, fleet: fleet?.fleet(), game: kind === 'rps' ? undefined : kind });
      markSeen(r.duel);
      document.dispatchEvent(new CustomEvent('radovalka:marked'));
      toast(`${GAMES[kind].icon} Позвали играть — ${who().partner} ${r.reaches ? 'получит уведомление' : 'увидит в чате'}`);
      if (open) { open.state = ''; await refresh(); }
    } catch (e) {
      go.disabled = false;
      if (e.status === 409) { toast('Эта игра уже идёт — сначала доиграйте её'); if (open) { open.state = ''; refresh(); } return; }
      toast('Не ушло — нет связи');
    }
  });
  // Блоки по порядку: на що граємо → твій хід → покликати
  const block = (title, ...kids) => h('section', { class: 'duel-block' }, h('h3', { class: 'duel-block-title' }, title), ...kids);
  const HINT = {
    rps: 'До двух побед. Ходы откроются, когда сходите оба.',
    ttt: ['Ты — ', sym(mySex()), `, твой ход первый. Ничья — новая партия, начинает ${who().partner}.`],
    c4: ['Ты — ', sym(mySex()), `, твой ход первый. Нужно четыре в ряд, можно и наискосок. Ничья — новая партия, начинает ${who().partner}.`],
    bs: `Поле 6×6, флот: 3, 2, 2 и 1 клетка. Попал — стреляешь ещё. Твой выстрел первый, а ${who().partner} расставит свой флот, когда примет вызов.`,
  };
  const hint = h('p', { class: 'hint duel-hint' }, ...[HINT[kind]].flat());
  const pick = h('div', { class: 'duel-pick' });
  // Перший хід: камінь-ножиці — рука, хрестики — клітинка на маленькому полі, «Четыре в ряд» — нижній ряд (стовпчик)
  const paintPick = () => {
    if (kind === 'rps') { pick.replaceChildren(movesRow((k) => { mv = k; sync(); })); return; }
    const grid = GRIDS[kind];
    const pickGrid = grid.drop ? { ...grid, h: 1 } : grid;
    const empty = '.'.repeat(pickGrid.w * pickGrid.h);
    const bd = boardEl(pickGrid, 'Первый ход', ' is-pick');
    const put = (i) => {
      mv = String(i);
      bd.replaceChildren(...cells(pickGrid, empty.split('').map((c, j) => (j === i ? 'x' : c)).join(''), { mine: 'x', play: true, onPick: put }));
      land(pickGrid, bd, i);
      sync();
    };
    bd.replaceChildren(...cells(pickGrid, empty, { mine: 'x', play: true, onPick: put }));
    pick.replaceChildren(bd);
  };
  if (fleet) {
    sync();
    return [block('На что играем', chips, own), block(`Расставь ${WORLD[DATA.side].ships}`, fleet.board, fleet.tools), block('Записки', ...fleet.notes), hint, go];
  }
  paintPick();
  return [
    block('На что играем', chips, own),
    block('Твой ход', pick),
    hint,
    go,
  ];
}

// ── Ігри на полі: «❌⭕ Крестики-нолики» 3×3 і «🔴🟡 Четыре в ряд» 7×6 (тап по стовпчику — фішка падає донизу).
// Одна партія; хто покликав — x і ходить першим; нічия — нова партія, починає інший
const wait = (ms) => new Promise((done) => setTimeout(done, reduceMotion ? Math.min(ms, 300) : ms));
const pop = (el) => { if (!reduceMotion && el) el.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' }); };
// Фішка падає з-над поля у свою клітинку (лише transform), наприкінці легенько підскакує
const fall = (el, row) => {
  if (reduceMotion || !el) return;
  el.animate([{ transform: `translateY(${-(row + 1) * 112}%)` }, { transform: 'translateY(0)', offset: 0.75 }, { transform: 'translateY(-12%)', offset: 0.88 }, { transform: 'translateY(0)' }],
    { duration: 300 + row * 45, easing: 'ease-in' });
};
// Новий хід на полі: у «Четыре в ряд» — падіння, у хрестиках — поява
const land = (grid, board, i) => {
  const piece = board.children[i]?.firstElementChild;
  if (grid.drop) fall(piece, Math.floor(i / grid.w)); else { piece?.classList.add('is-draw'); pop(piece); }
};
// Куди ляже хід: клітинка або найнижча вільна у стовпчику (-1 — нікуди)
function cellFor(grid, bd, move) {
  if (!grid.drop) return bd[move] === '.' ? move : -1;
  for (let r = grid.h - 1; r >= 0; r -= 1) if (bd[r * grid.w + move] === '.') return r * grid.w + move;
  return -1;
}

function cells(grid, bd, { mine, line = null, play = false, onPick = null } = {}) {
  return [...bd].map((c, i) => {
    const col = i % grid.w;
    // Хрестики — вільна клітинка; «Четыре в ряд» — будь-яка клітинка неповного стовпчика
    const open = grid.drop ? bd[col] === '.' : c === '.';
    const what = c === '.' ? '' : `: ${c === mine ? 'твой' : gen()} знак`;
    return h('button', {
      type: 'button',
      class: `ttt-cell${line?.includes(i) ? ' is-line' : ''}${c !== '.' ? ` is-${c === mine ? 'me' : 'them'}` : ''}`,
      'data-i': String(i),
      'aria-label': grid.drop ? `Столбец ${col + 1}, ряд ${grid.h - Math.floor(i / grid.w)}${what}` : `Клетка ${i + 1}${what}`,
      disabled: !play || !open,
      onclick: onPick ? () => onPick(grid.drop ? col : i) : null,
    }, c === '.' ? '' : sym(sexOf(c, mine), ' cell-piece'));
  });
}
// Перекреслення переможного ряду: лінія від першої до останньої клітинки, промальовується (fresh) або одразу
function strike(board, line, fresh, won) {
  if (!line?.length) return;
  const a = board.children[line[0]];
  const b = board.children[line.at(-1)];
  if (!a || !b) return;
  const box = board.getBoundingClientRect();
  const ca = a.getBoundingClientRect();
  const cb = b.getBoundingClientRect();
  const pt = (r) => [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
  const [x1, y1] = pt(ca);
  const [x2, y2] = pt(cb);
  // Трохи за межі крайніх клітинок — як рукою
  const k = 0.32;
  const dx = (x2 - x1) * k / Math.max(1, line.length - 1);
  const dy = (y2 - y1) * k / Math.max(1, line.length - 1);
  board.querySelector('.ttt-strike')?.remove();
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', `ttt-strike${won ? ' is-won' : ''}${fresh && !reduceMotion ? ' is-fresh' : ''}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  svg.innerHTML = `<line x1="${x1 - dx}" y1="${y1 - dy}" x2="${x2 + dx}" y2="${y2 + dy}" pathLength="1"/>`;
  board.append(svg);
}
const boardEl = (grid, label, cls = '') => h('div', { class: `ttt-board is-${grid.kind}${cls}`, role: 'group', 'aria-label': label });

async function showBoard(g) {
  const { body } = open;
  const grid = gridOf(g);
  const seen = g.done && sawEnd(g) ? g.n : seenRounds(g);
  const mine = g.mark;
  const legend = h('p', { class: 'ttt-legend' },
    h('span', { class: 'ttt-who' }, `${cap(who().partner)} `, sym(otherSex())), h('span', { class: 'ttt-vs' }, 'vs'), h('span', { class: 'ttt-who' }, 'Ты ', sym(mySex())));
  const board = boardEl(grid, 'Поле');
  const status = h('p', { class: 'duel-status' });
  const history = h('div', { class: 'duel-history', 'aria-label': 'Партии' });
  const act = h('div', { class: 'duel-act' });
  const paintHistory = (k) => history.replaceChildren(...g.rounds.slice(0, k).map((r, i) => h('span', { class: 'duel-past', title: `Партия ${i + 1}` },
    h('small', {}, `Партия ${i + 1}`), 'ничья')));
  body.replaceChildren(h('p', { class: 'duel-topic' }, `${icon(g)} ${g.topic}`), h('div', { class: 'duel-arena' }, legend, board, status), history, act);

  const fresh = g.n > seen;
  open.busy = true;
  // Нічия, якої ще не бачив: спершу повне поле минулої партії, потім — нова
  const drew = fresh && g.rounds.length > 0 && seen < grid.w * grid.h * g.rounds.length;
  if (drew) {
    const prev = g.rounds.at(-1);
    board.replaceChildren(...cells(grid, prev.board, { mine }));
    paintHistory(g.rounds.length - 1);
    status.textContent = 'Ничья!';
    if (!reduceMotion) boardDraw(board, symSvg('he'), symSvg('she'));
    await wait(reduceMotion ? 1400 : 2400);
    if (!open) return;
    status.textContent = `Новая партия — ${prev.first === 'me' ? `начинает ${who().partner}` : 'начинаешь ты'}`;
    await wait(1000);
    if (!open) return;
  }
  open.busy = false;
  paintHistory(g.rounds.length);
  const play = !g.done && g.turn === 'me';
  board.replaceChildren(...cells(grid, g.board, { mine, play, onPick: (m) => boardMove(g, m, board) }));
  if (fresh && g.lastBy === 'them' && g.lastCell !== null) land(grid, board, g.lastCell);
  // Куди щойно сходив другий — тонке кільце (свіжий хід — ще й спалахує)
  if (!g.done && g.lastBy === 'them' && g.lastCell !== null) board.children[g.lastCell]?.classList.add('is-last', ...(fresh ? ['is-last-new'] : []));
  if (g.done) {
    if (fresh) await wait(grid.drop ? 700 : 450);
    if (!open) return;
    (g.line || []).forEach((i, k) => {
      const c = board.children[i];
      c.classList.add('is-line');
      if (fresh && !reduceMotion) c.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 420, delay: k * 140, easing: 'ease-in-out' });
    });
    strike(board, g.line, fresh, g.done.won);
    status.textContent = duelResult(g);
    status.classList.add('is-final');
    if (fresh) { if (g.done.won) boardWin(board, symSvg(mySex()), mySex()); else boardLose(board, symSvg(otherSex()), otherSex()); }
    act.replaceChildren(...doneActs(g));
  } else {
    status.replaceChildren(`${drew ? 'Новая партия. ' : ''}${play ? `Твой ход — ${grid.verb} ` : `Ждём ${gen()} ход…`}`, play ? sym(mySex()) : '');
    act.replaceChildren(...[play ? petTip(grid.kind) : null, h('button', { type: 'button', class: 'duel-cancel', onclick: () => cancel(g) }, 'Отменить игру')].filter(Boolean));
  }
  if (fresh || (g.done && !sawEnd(g))) {
    markSeen(g);
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
  }
}

// Хід на полі: фішка одразу на місці (і падає), сервер підтверджує; поле застаріло — перечитуємо
async function boardMove(g, m, board) {
  if (!open || open.busy) return;
  const grid = gridOf(g);
  const i = cellFor(grid, g.board, m);
  if (i < 0) return;
  open.busy = true;
  const bd = [...g.board];
  bd[i] = g.mark;
  board.replaceChildren(...cells(grid, bd.join(''), { mine: g.mark }));
  land(grid, board, i);
  let r;
  try { r = await dsend('duel/move', 'POST', { id: g.id, move: String(m) }); } catch (e) {
    if (!open) return;
    open.busy = false;
    // Поле застаріло (другий уже сходив, клітинка зайнята) — просто перечитуємо
    if (e.status === 409 || e.status === 400) {
      if (e.code === 'gone') toast('Эта игра уже закончилась или отменена');
      open.state = '';
      refresh();
      return;
    }
    board.replaceChildren(...cells(grid, g.board, { mine: g.mark, play: true, onPick: (x) => boardMove(g, x, board) }));
    toast('Ход не ушёл — нет связи');
    return;
  }
  if (!open) return;
  open.busy = false;
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
  open.state = '';
  show(r.duel, false);
}

// ── «🚢 Морской бой»: два поля — «Моё» (маленьке, мій світ: мої кораблі й постріли другого) і чуже (велике, світ другого:
// тап — постріл). Постріли, яких ще не бачив, програються по черзі: значок прилітає, мимо — сплеск чи іскри, влучив — спалах,
// потопив — тоне чи розсипається, і записка з нього
const otherSide = () => (DATA.side === 'vin' ? 'vona' : 'vin');
const byMe = (he, she) => (DATA.side === 'vin' ? he : she);
const theyDid = (he, she) => (who().partner === 'она' ? she : he);
const section = (title, ...kids) => h('section', { class: 'duel-block' }, h('h3', { class: 'duel-block-title' }, title), ...kids);

// Мене покликали: ставлю свій флот (з записками) — і бій починається, першим стріляє той, хто покликав
function bsAccept(g) {
  const fleet = placer(DATA.side);
  const go = h('button', { type: 'button', class: 'btn btn-primary duel-go' }, 'Готово — в бой!');
  go.addEventListener('click', async () => {
    if (!open || open.busy) return;
    go.disabled = true;
    open.busy = true;
    let r;
    try { r = await dsend('duel/fleet', 'POST', { id: g.id, fleet: fleet.fleet() }); } catch (e) {
      if (!open) return;
      open.busy = false;
      go.disabled = false;
      if (e.status === 409) { toast('Эта игра уже закончилась или отменена'); open.state = ''; refresh(); return; }
      toast(e.status === 400 ? 'Расстановка не подошла — нажми «🎲 Расставить»' : 'Не ушло — нет связи');
      return;
    }
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
    toast(`🚢 Флот на месте — первый выстрел за ${theyDid('ним', 'ней')}`);
    if (!open) return;
    open.busy = false;
    open.state = '';
    show(r.duel, false);
  });
  open.body.replaceChildren(h('p', { class: 'duel-topic' }, `${icon(g)} ${g.topic}`),
    h('p', { class: 'hint duel-hint' }, `${cap(who().partner)} ${theyDid('позвал', 'позвала')} в морской бой и уже ${theyDid('расставил', 'расставила')} флот. Расставь свой — первый выстрел за ${theyDid('ним', 'ней')}.`),
    section(`Расставь ${WORLD[DATA.side].ships}`, fleet.board, fleet.tools), section('Записки', ...fleet.notes), go,
    h('button', { type: 'button', class: 'duel-cancel', onclick: () => cancel(g) }, 'Отменить игру'));
}

async function showBs(g) {
  if (g.needFleet) { bsAccept(g); return; }
  const me = DATA.side;
  const them = otherSide();
  const seen = g.done && sawEnd(g) ? g.n : Math.min(seenRounds(g), g.n);
  const play = !g.done && g.turn === 'me';
  const mine = seaEl(me, { label: WORLD[me].mine, cls: ' is-mine' });
  const theirs = seaEl(them, { label: WORLD[them].their, cls: ' is-theirs', onCell: play ? (c) => bsShoot(g, c, theirs) : null });
  const myShips = (g.fleet || []).map((s) => { const el = shipEl(me, s.cells); mine.append(el); return { cells: s.cells, el }; });
  const status = h('p', { class: 'duel-status bs-status' });
  const score = h('p', { class: 'bs-score' });
  const found = h('div', { class: 'bs-found' });
  const stage = h('div', { class: 'bs-stage' }, h('p', { class: 'bs-label' }, WORLD[them].their), theirs);
  const act = h('div', { class: 'duel-act' });
  open.body.replaceChildren(h('p', { class: 'duel-topic' }, `${icon(g)} ${g.topic}`),
    h('div', { class: 'duel-arena bs-arena' },
      h('div', { class: 'bs-top' }, h('div', { class: 'bs-mine' }, h('p', { class: 'bs-label' }, WORLD[me].mine), mine), h('div', { class: 'bs-side' }, score, status)),
      stage),
    found, act);

  const count = { me: 0, them: 0 };
  const notes = [];
  const paintScore = () => score.replaceChildren(h('span', {}, 'Потоплено'),
    h('span', {}, 'ты ', h('b', {}, String(count.me)), ' из 4'), h('span', {}, `${who().partner} `, h('b', {}, String(count.them)), ' из 4'));
  const paintFound = () => found.replaceChildren(...(notes.length
    ? [h('p', { class: 'bs-found-title' }, '💌 Найденные записки'), ...notes.map((t) => h('p', { class: 'bs-found-note' }, t))] : []));
  // Один постріл на поле; anim — з рухом і паузою (новий), інакше — одразу (уже бачений)
  async function apply(s, anim) {
    const board = s.by === 'me' ? theirs : mine;
    const world = s.by === 'me' ? them : me;
    const mark = markShot(board, s.c, s.by === 'me' ? me : them, s.hit);
    if (anim) { fxShot(mark); if (s.hit) fxHit(cellOf(board, s.c)); else fxMiss(cellOf(board, s.c), world); }
    if (!s.sunk) { if (anim) await pause(s.hit ? 800 : 1000); return; }
    count[s.by] += 1;
    paintScore();
    const ship = s.by === 'me' ? g.sunk.find((x) => x.cells.includes(s.c)) : myShips.find((x) => x.cells.includes(s.c));
    if (!ship) return;
    const el = s.by === 'me' ? shipEl(them, ship.cells) : ship.el;
    if (s.by === 'me') { theirs.append(el); if (ship.note) notes.push(ship.note); }
    if (!anim) { el.classList.add('is-sunk'); return; }
    await pause(450);
    await fxSink(el, world, board, ship.cells);
    if (s.by === 'me' && ship.note) { noteReveal(stage, ship.note, them); paintFound(); await pause(1600); }
  }
  for (const s of g.shots.slice(0, seen)) apply(s, false);
  paintScore();
  paintFound();
  const fresh = g.shots.slice(seen);
  if (fresh.length) {
    open.busy = true;
    status.textContent = fresh[0].by === 'me' ? 'Залп!' : `${cap(who().partner)} ${theyDid('стрелял', 'стреляла')}…`;
    for (const s of fresh) {
      // eslint-disable-next-line no-await-in-loop
      await apply(s, true);
      if (!open) return;
      paintScore();
    }
    open.busy = false;
  }
  const last = g.shots.at(-1);
  if (g.done) {
    // Кінець: решта чужого флоту — привидами, без записок
    (g.rest || []).forEach((s) => theirs.append(shipEl(them, s.cells, ' is-ghost')));
    status.textContent = duelResult(g);
    status.classList.add('is-final');
    if (fresh.length) { if (g.done.won) boardWin(theirs, symSvg(mySex()), mySex()); else boardLose(theirs, symSvg(otherSex()), otherSex()); }
    act.replaceChildren(...doneActs(g));
  } else {
    status.textContent = !g.ready ? `Ждём, когда ${who().partner} расставит ${WORLD[them].ships}…`
      : play ? (last?.by === 'me' && last.hit ? `${last.sunk ? byMe('Потопил', 'Потопила') : byMe('Попал', 'Попала')}! Стреляй ещё ${SHOT[me]}` : `Твой ход — стреляй ${SHOT[me]}`)
        : last?.by === 'them' && last.hit ? `${cap(who().partner)} ${theyDid('попал', 'попала')} и стреляет ещё…` : `Ждём ${gen()} ход…`;
    act.replaceChildren(...[play ? petTip('bs') : null, h('button', { type: 'button', class: 'duel-cancel', onclick: () => cancel(g) }, 'Отменить игру')].filter(Boolean));
  }
  if (fresh.length || (g.done && !sawEnd(g))) {
    markSeen(g);
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
  }
}

// Постріл: клітинка підсвічується, сервер відповідає — і постріл програється на полі
async function bsShoot(g, c, board) {
  if (!open || open.busy) return;
  open.busy = true;
  board.querySelectorAll('.bs-cell').forEach((b) => { b.disabled = true; });
  cellOf(board, c)?.classList.add('is-aim');
  let r;
  try { r = await dsend('duel/move', 'POST', { id: g.id, move: String(c) }); } catch (e) {
    if (!open) return;
    open.busy = false;
    open.state = '';
    if (e.status === 409 || e.status === 400) {
      if (e.code === 'gone') toast('Эта игра уже закончилась или отменена');
      refresh();
      return;
    }
    toast('Выстрел не ушёл — нет связи');
    show(g, false);
    return;
  }
  if (!open) return;
  open.busy = false;
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
  open.state = '';
  show(r.duel, false);
}

async function move(g, m) {
  if (!open || open.busy) return;
  open.busy = true;
  open.body.querySelectorAll('.duel-move').forEach((b) => { b.disabled = true; });
  let r;
  try { r = await dsend('duel/move', 'POST', { id: g.id, move: m }); } catch (e) {
    if (!open) return;
    open.busy = false;
    if (e.status === 409) { toast('Эта игра уже закончилась или отменена'); open.state = ''; refresh(); return; }
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
  try { await dsend('duel/cancel', 'POST', { id: g.id }); } catch { toast('Не отменилось — нет связи'); return; }
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
  toast('Игра отменена');
  if (open) { open.state = ''; show(null, true); }
}
