// «🚢 Морской бой» — малювання й рух: поле 6×6 у світі сторони. Обидва світи — море: її денне рожеве з корабликами
// під вітрилами-сердечками, його нічне бірюзове з місячною доріжкою й корабликами під золотими вітрилами з ліхтариком.
// Розстановка без перетягування, постріли, потоплення, записки. Стан гри й черга — у duel.js; тут лише те, що видно.
// Анімації — лише transform/opacity (Web Animations API чи CSS), без filter; reduceMotion — без руху
import { h, reduceMotion, sky, toast } from './ui.js';

export const W = 6;
export const FLEET = [3, 2, 2, 1];
// Готові записки в кораблики — одним тапом; підходять і йому, і їй (без роду: «ты», «с меня», «за мной»)
export const NOTE_SETS = [
  ['Нежные', ['Обнимаю крепко-крепко, как ты любишь', 'С тобой даже в очереди в поликлинику весело',
    'Рядом с тобой мне спокойно', 'Скучаю по твоему голосу, позвони просто так',
    'Ты мой самый любимый человек на свете', 'Хочу сегодня уснуть у тебя на плече', 'Я всё ещё влюбляюсь в тебя, каждый день понемножку',
    'Думаю о тебе чаще, чем признаюсь', 'Люблю, как ты смеёшься', 'Где ты, там и дом',
    'Спасибо, что ты у меня есть', 'Держу тебя за руку, даже отсюда',
    'Ты моё любимое утро', 'Мне с тобой повезло, и я это помню', 'Как хорошо, что мы нашлись', 'Приходи скорее, без тебя тут пусто', 'Мне хорошо у тебя под боком', 'Ты делаешь мои дни теплее']],
  ['Обещания', ['С меня массаж, и никаких отговорок', 'Завтрак в постель за мной 🥐', 'Фильм выбираешь ты, а я не ною', 'Вечер без телефонов, только мы вдвоём',
    'Заварю тебе чай с лимоном, как ты любишь', 'Посуда сегодня на мне 🍽', 'В выходные свидание, куда — секрет',
    'Весь вечер слушаю тебя и не перебиваю', 'Плед, какао и твой сериал, спорить не буду', 'Пойдём гулять, куда глаза глядят',
    'Потанцуем на кухне под любую песню', 'Исполню одно желание. Почти любое',
    'Сделаю тебе какао с зефирками', 'Отвезу тебя, куда скажешь', 'Пикник на выходных, корзинка с меня', 'Испеку что-нибудь вкусное, только для тебя', 'Разомну тебе плечи, сколько захочешь', 'Напишу тебе письмо от руки ✉️']],
  ['Игривые 🍓', ['С тебя поцелуй, и с процентами 😘', 'Сегодня вечером ты в моей власти 😏', 'Приходи пораньше, объясню на месте 🍓', 'Целую туда, куда скажешь',
    'По-моему, ты целишься не только в кораблики 😏', 'Ещё одно попадание, и я сдаюсь без боя', 'Жду вечера и тебя в нём 🍓',
    'За каждый потопленный кораблик с меня поцелуй', 'Я уже придумываю, как отыграться 😘', 'Свет сегодня выключим пораньше 🌙',
    'От одной мысли о тебе мурашки', 'Найди меня вечером, награда прилагается',
    'Проигравший целует первым 😘', 'Шепну кое-что на ушко, когда увидимся', 'Надень сегодня то, что мне нравится 😏', 'Ты слишком метко целишься, это подозрительно', 'Отыграюсь вечером, готовься 🍓', 'Мне нравится, когда ты так близко']],
  ['Смешные', ['Ты красивее всего, когда споришь', 'Попадание засчитано, любовь тоже', 'Сдаюсь, но только тебе 🏳️', 'Ты мило храпишь. Ну, почти',
    'Кораблик утонул, а я всё равно улыбаюсь', 'Опять попадание с первого раза, как тогда в меня', 'Последний пельмень твой, вот это любовь 🥟',
    'Отдам тебе одеяло. Половину. Может быть', 'Люблю тебя даже до утреннего кофе', 'Пульт от телевизора сегодня твой, я серьёзно',
    'Здесь могла быть ваша реклама, но тут любовь', 'Мой флот тонет, а мне почему-то весело',
    'Сдаюсь, но морально держусь', 'Сердце украдено, кораблик тоже', 'Вообще-то это был мой любимый кораблик', 'Ещё одно попадание, и я начну жульничать', 'Капитан утонул, но передаёт привет', 'За потопленный флот жду компенсацию шоколадкой 🍫']],
];
// Чим стріляє сторона: вона — сердечками, він — золотими зірками
export const SHOT = { vona: '💗', vin: '⭐' };
// Назви світів: її денне море й його нічне
export const WORLD = { vona: { mine: 'Моё море', their: 'Её море', ships: 'кораблики', one: 'кораблик' }, vin: { mine: 'Моё ночное море', their: 'Его ночное море', ships: 'кораблики', one: 'кораблик' } };

const rc = (c) => [Math.floor(c / W), c % W];
const shipCells = (at, len, vert) => Array.from({ length: len }, (_, i) => at + (vert ? i * W : i));
const fits = (at, len, vert) => (vert ? Math.floor(at / W) + len <= W : (at % W) + len <= W);
const near = (a, b) => { const [r1, c1] = rc(a); const [r2, c2] = rc(b); return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1; };
const clash = (cells, others) => others.some((s) => s.cells.some((b) => cells.some((a) => near(a, b))));
export const isVert = (cells) => cells.length > 1 && cells[1] - cells[0] === W;

// Випадкова правильна розстановка (кораблі не торкаються навіть кутами); на 6×6 знаходиться за кілька спроб
export function randomFleet() {
  for (;;) {
    const ships = [];
    for (const len of FLEET) {
      let placed = null;
      for (let t = 0; t < 60 && !placed; t += 1) {
        const vert = Math.random() < 0.5;
        const at = Math.floor(Math.random() * W * W);
        if (!fits(at, len, vert)) continue;
        const cells = shipCells(at, len, vert);
        if (!clash(cells, ships)) placed = { cells };
      }
      if (!placed) break;
      ships.push(placed);
    }
    if (ships.length === FLEET.length) return ships;
  }
}

// Поворот корабля k. На 6×6, де кораблі не торкаються навіть кутами, поворот навколо першої клітинки
// майже завжди впирався в сусіда чи край — тап «не працював». Тепер: пробуємо повернути навколо кожної його
// клітинки, а не влазить — ставимо повернутим на найближче вільне місце. Зовсім нікуди — null
export function rotate(ships, k) {
  const s = ships[k];
  const len = s.cells.length;
  if (len < 2) return null;
  const vert = !isVert(s.cells);
  const others = ships.filter((_, i) => i !== k);
  const ok = (at) => at >= 0 && at < W * W && fits(at, len, vert) && !clash(shipCells(at, len, vert), others);
  const put = (at) => ships.map((x, i) => (i === k ? { ...x, cells: shipCells(at, len, vert) } : x));
  // 1) навколо кожної клітинки: опорна клітинка стає j-ю в новому положенні
  for (const p of s.cells) {
    const [pr, pc] = rc(p);
    for (let j = 0; j < len; j += 1) {
      const r = vert ? pr - j : pr;
      const c = vert ? pc : pc - j;
      if (r >= 0 && c >= 0 && ok(r * W + c)) return put(r * W + c);
    }
  }
  // 2) найближче вільне місце до центру корабля
  const mid = (cells) => cells.map(rc).reduce(([a, b], [r, c]) => [a + r / len, b + c / len], [0, 0]);
  const [cr, cc] = mid(s.cells);
  const spots = [...Array(W * W).keys()].filter(ok)
    .map((at) => { const [r, c] = mid(shipCells(at, len, vert)); return [at, (r - cr) ** 2 + (c - cc) ** 2]; })
    .sort((a, b) => a[1] - b[1]);
  return spots.length ? put(spots[0][0]) : null;
}

// ── Малюнки корабликів: згори, горизонтально, 40 одиниць на клітинку, ніс праворуч; вертикальні повертаємо носом угору.
// Вітрила, щогли, прапорець і ліхтарик — завжди «стоять» (у повернутому кораблі повертаємо їх назад)
const PAL = {
  vona: { hull: '#B24A7E', deck: '#FAD0E2', plank: '#E9A5C4', sail: '#FF4F8E', edge: '#fff', mast: '#8A3462', shadow: 'rgba(150, 40, 100, .2)', foam: '#fff', wet: '#F3A9C8', flag: '#FFD36E' },
  vin: { hull: '#6B4226', deck: '#C99A5E', plank: '#A47A45', sail: '#EDB949', edge: '#FFF1C4', mast: '#3E2615', shadow: 'rgba(0, 0, 0, .35)', foam: '#BFE8EE', wet: '#0A2C3E', flag: '#E35D6A' },
};
const heart = (cx, cy, r) => `M${cx} ${cy + r * 0.9}C${cx - r * 1.6} ${cy - r * 0.1} ${cx - r * 0.9} ${cy - r * 1.3} ${cx} ${cy - r * 0.45}`
  + `C${cx + r * 0.9} ${cy - r * 1.3} ${cx + r * 1.6} ${cy - r * 0.1} ${cx} ${cy + r * 0.9}Z`;
// Вітрило на щоглі в точці x; r — розмір; top — прапорець (у неї) чи ліхтарик (у нього) на верхівці
function sail(world, p, x, r, top) {
  const cy = 22 - r * 1.15;
  const tip = cy - r * 1.25;
  let s = `<path d="M${x} 25V${tip}" stroke="${p.mast}" stroke-width="1.6" stroke-linecap="round"/>`;
  if (world === 'vona') {
    s += `<path d="${heart(x, cy, r)}" fill="${p.sail}" stroke="${p.edge}" stroke-width="1.5"/>`
      + `<path d="M${x - r * 0.75} ${cy - r * 0.35}q${r * 0.2} -${r * 0.45} ${r * 0.55} -${r * 0.4}" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>`;
    if (top) s += `<path d="M${x} ${tip}v-6.5" stroke="${p.mast}" stroke-width="1.2"/><path class="bs-flag" d="M${x} ${tip - 6.5}l${r * 0.9} 2.6-${r * 0.9} 2.6Z" fill="${p.flag}" stroke="${p.mast}" stroke-width=".6"/>`;
    return s;
  }
  // Золоте прямокутне вітрило «пузом» і зірочка на ньому
  const w = r * 0.95;
  s += `<path d="M${x - w} ${cy - r}Q${x} ${cy - r - 3} ${x + w} ${cy - r}Q${x + w + 2.5} ${cy} ${x + w} ${cy + r}Q${x} ${cy + r - 3} ${x - w} ${cy + r}Q${x - w - 2.5} ${cy} ${x - w} ${cy - r}Z" fill="${p.sail}" stroke="${p.edge}" stroke-width="1.2"/>`
    + `<path d="M${x} ${cy - r * 0.45}l${r * 0.16} ${r * 0.3} ${r * 0.3} ${r * 0.15}-${r * 0.3} ${r * 0.15}-${r * 0.16} ${r * 0.3}-${r * 0.16}-${r * 0.3}-${r * 0.3}-${r * 0.15} ${r * 0.3}-${r * 0.15}Z" fill="#FFF6D5"/>`;
  if (top) s += `<path d="M${x} ${tip}v-3" stroke="${p.mast}" stroke-width="1.2"/><g class="bs-lamp"><circle cx="${x}" cy="${tip - 5}" r="6.5" fill="#FFE08A" opacity=".35"/><circle cx="${x}" cy="${tip - 5}" r="2.8" fill="#FFF4C2" stroke="${p.mast}" stroke-width=".7"/></g>`;
  return s;
}
// Кораблик: тінь на воді, корпус із бортом, палуба з дошками, піна біля носа; розміри трохи різні на вигляд:
// 1 — круглий човник з одним вітрилом, 2 — вітрило й кливер, 3 — дві щогли, кливер і рятувальний круг на кормі
function boat(world, len, vert) {
  const p = PAL[world];
  const L = len * 40;
  const hull = len === 1 ? 'M4 20C4 9 10 5 20 5C30 5 36 9 37 20C36 31 30 35 20 35C10 35 4 31 4 20Z'
    : `M4 20C4 9 9 5 17 5H${L - 18}C${L - 8} 5 ${L - 1} 13 ${L - 0.5} 20C${L - 1} 27 ${L - 8} 35 ${L - 18} 35H17C9 35 4 31 4 20Z`;
  const deck = len === 1 ? 'M8.5 20C8.5 12 13 9.5 20 9.5C27 9.5 32 12 32.5 20C32 28 27 30.5 20 30.5C13 30.5 8.5 28 8.5 20Z'
    : `M8.5 20C8.5 12 12 9.5 17 9.5H${L - 19}C${L - 11} 9.5 ${L - 6} 14 ${L - 5} 20C${L - 6} 26 ${L - 11} 30.5 ${L - 19} 30.5H17C12 30.5 8.5 28 8.5 20Z`;
  const e = len === 1 ? 13 : 16;
  let s = `<ellipse cx="${L / 2 + 1}" cy="23.5" rx="${L / 2 - 2}" ry="16" fill="${p.shadow}"/>`
    + `<path d="M${L - 3} 10Q${L + 5} 20 ${L - 3} 30" fill="none" stroke="${p.foam}" stroke-width="2" stroke-linecap="round" opacity=".8"/>`
    + `<path d="${hull}" fill="${p.hull}"/><path d="${deck}" fill="${p.deck}"/>`
    + `<path d="M12 20H${L - 8}M${e} 14.5H${L - e}M${e} 25.5H${L - e}" stroke="${p.plank}" stroke-width=".9"/>`
    + `<path d="M${len === 1 ? 12 : 15} 7.4H${L - (len === 1 ? 12 : 20)}" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>`;
  if (len === 3) s += `<circle cx="15" cy="20" r="4.5" fill="none" stroke="#fff" stroke-width="2.6"/><circle cx="15" cy="20" r="4.5" fill="none" stroke="${p.flag}" stroke-width="2.4" stroke-dasharray="3 3.3"/>`;
  s += `<path class="bs-wet" d="${hull}" fill="${p.wet}"/>`;
  const sails = len === 1 ? [[20, 9.5, true]] : len === 2 ? [[34, 11.5, true], [63, 6.5, false]] : [[43, 11, false], [80, 12, true], [107, 6, false]];
  for (const [x, r, top] of sails) s += `<g transform="rotate(${vert ? 90 : 0} ${x} 20)">${sail(world, p, x, r, top)}</g>`;
  return s;
}
function shipSvg(world, cells) {
  const len = cells.length;
  const vert = isVert(cells);
  const L = len * 40;
  const art = boat(world, len, vert);
  return vert
    ? `<svg viewBox="0 0 40 ${L}"><g transform="translate(0 ${L}) rotate(-90)">${art}</g></svg>`
    : `<svg viewBox="0 0 ${L} 40">${art}</svg>`;
}
const area = (cells) => {
  const [r, c] = rc(cells[0]);
  return isVert(cells) ? `${r + 1} / ${c + 1} / span ${cells.length} / span 1` : `${r + 1} / ${c + 1} / span 1 / span ${cells.length}`;
};
// Маленький кораблик для рахунку «Потоплено»
export const miniShip = (world) => shipSvg(world, [0, 1]);
export function shipEl(world, cells, cls = '') {
  const el = h('span', { class: `bs-ship${cls}`, 'aria-hidden': 'true', html: shipSvg(world, cells) });
  el.style.gridArea = area(cells);
  // Кожен гойдається у своєму ритмі
  el.style.setProperty('--k', String(cells[0] % 5));
  return el;
}
// Знайдена записка — значок на потопленому кораблику
export const noteBadge = (ship) => ship.append(h('i', { class: 'bs-ship-note', 'aria-hidden': 'true' }, '💌'));

// Поле у світі сторони world: вода з хвилями (у неї — сонячні відблиски, у нього — зорі й місячна доріжка), клітинки-кнопки
// з явним місцем у сітці — кораблі лягають поверх тих самих рядків
// Місячна доріжка: сяйво від місяця розширюється донизу й тане, по ньому — відблиски різної довжини,
// біля місяця густі й короткі, ближче до нас — рідші й ширші; мерехтять кожен у своєму ритмі
function moonPath() {
  const el = h('span', { class: 'bs-moon', 'aria-hidden': 'true' });
  // Псевдовипадкові, але щоразу однакові — розклад відблисків не стрибає при перемальовуванні
  const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const n = 34;
  for (let i = 0; i < n; i += 1) {
    const t = (i + rnd(i, 1) * 0.8) / n;
    // Розкид від осі — «дзвоном»: здебільшого біля центру, зрідка далі; донизу доріжка трохи ширшає
    const spread = (rnd(i, 2) + rnd(i, 3) + rnd(i, 4) - 1.5) * (10 + t * 22);
    const near = 1 - Math.min(1, Math.abs(spread) / 22);
    const g = h('i');
    g.style.cssText = `top:${1 + t * 96}%;left:${50 + spread}%;width:${(3 + rnd(i, 5) * 7 + t * 5).toFixed(1)}%;`
      + `--o:${(0.35 + near * 0.6 - t * 0.2).toFixed(2)};--d:${(1.2 + rnd(i, 6) * 2.2).toFixed(2)}s;animation-delay:${(-rnd(i, 7) * 3).toFixed(2)}s`;
    el.append(g);
  }
  return el;
}

export function seaEl(world, { label, cls = '', onCell = null } = {}) {
  const board = h('div', { class: `bs-board is-${world}${cls}`, role: 'group', 'aria-label': label });
  const deco = world === 'vin'
    ? [sky(14, 7, 'bs-sky'), moonPath()]
    : [h('span', { class: 'bs-glints', 'aria-hidden': 'true' }, ...[[18, 22], [64, 12], [40, 48], [80, 58], [22, 76], [62, 86]].map(([x, y], i) => {
      const g = h('i');
      g.style.cssText = `left:${x}%;top:${y}%;animation-delay:${-i * 0.9}s`;
      return g;
    }))];
  board.append(...deco, h('span', { class: 'bs-waves', 'aria-hidden': 'true' }));
  for (let c = 0; c < W * W; c += 1) {
    const [r, col] = rc(c);
    const cell = h('button', { type: 'button', class: 'bs-cell', 'data-c': String(c), disabled: !onCell, 'aria-label': `${'АБВГДЕ'[col]}${r + 1}`, onclick: onCell ? () => onCell(c) : null });
    cell.style.gridArea = `${r + 1} / ${col + 1}`;
    board.append(cell);
  }
  return board;
}
export const cellOf = (board, c) => board.querySelector(`.bs-cell[data-c="${c}"]`);

// Відмітка пострілу: мимо — кільця на воді, влучив — вогник; клітинка вже не в тумані й не натискається
const FIRE = '<svg viewBox="0 0 24 30"><path d="M12 29C5 29 2 24 2 19 2 12 8 9 9 2c4 3 5 7 4 10 2-1 3-3 3-5 4 4 6 8 6 12 0 6-4 10-10 10Z" fill="#E8473C"/>'
  + '<path d="M12 28.4C6.4 28.4 3.6 24.3 3.6 20 3.6 14 8.4 11.4 9.6 5.6c3 2.6 3.8 5.8 3 8.4 1.8-.9 2.7-2.6 2.7-4.4 3.2 3.4 4.9 6.6 4.9 10 0 5-3.4 8.8-8.2 8.8Z" fill="#FF8A3D"/>'
  + '<path d="M12 28c-4 0-6-3-6-6 0-4 3-6 4-9 2 2 2 4 2 6 1-1 2-2 2-4 2 2 4 5 4 7 0 4-2 6-6 6Z" fill="#FFD36E"/><ellipse cx="12" cy="24" rx="2.6" ry="3.2" fill="#FFF6D5"/>'
  + '<circle class="bs-spark" cx="7" cy="9" r="1.1" fill="#FFD36E"/><circle class="bs-spark is-b" cx="17" cy="6" r=".9" fill="#FFE9A8"/></svg>';
export function markShot(board, c, hit) {
  const cell = cellOf(board, c);
  if (!cell) return null;
  cell.classList.add(hit ? 'is-hit' : 'is-miss');
  cell.disabled = true;
  const mark = h('span', { class: `bs-mark ${hit ? 'is-fire' : 'is-ripple'}`, 'aria-hidden': 'true', html: hit ? FIRE : '' });
  cell.append(mark);
  cell.setAttribute('aria-label', `${cell.getAttribute('aria-label').slice(0, 2)}: ${hit ? 'попадание' : 'мимо'}`);
  return mark;
}
// Навколо потопленого — кораблів бути не може (не торкаються навіть кутами): ці клітинки тихо «порожні»,
// по них більше не стріляють. Останній постріл — кільцем, щоб було видно, куди пішов хід
export function markAround(board, cells) {
  for (const a of cells) {
    const [r, c] = rc(a);
    for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
      const y = r + dr;
      const x = c + dc;
      if (y < 0 || x < 0 || y >= W || x >= W) continue;
      const cell = cellOf(board, y * W + x);
      if (!cell || cells.includes(y * W + x) || cell.classList.contains('is-hit') || cell.classList.contains('is-miss')) continue;
      cell.classList.add('is-near');
      cell.disabled = true;
      cell.setAttribute('aria-label', `${cell.getAttribute('aria-label').slice(0, 2)}: пусто`);
    }
  }
}
export function markLast(board, c) {
  board.querySelector('.bs-cell.is-last-shot')?.classList.remove('is-last-shot');
  cellOf(board, c)?.classList.add('is-last-shot');
}

// Потоплені клітинки: вогник гасне в димок
export function markSunk(board, cells) {
  cells.forEach((c) => {
    const cell = cellOf(board, c);
    if (!cell) return;
    cell.classList.add('is-sunk');
    cell.setAttribute('aria-label', `${cell.getAttribute('aria-label').slice(0, 2)}: потоплен`);
  });
}

// ── Рух. Шматочки всередині клітинки (вона position: relative), прибираються після анімації
const ms = (x) => (reduceMotion ? 1 : x);
const bit = (cell, cls, css = '') => { const s = h('i', { class: `bs-fx ${cls}`, 'aria-hidden': 'true' }); s.style.cssText = css; cell.append(s); return s; };
const bye = (el, a) => a.finished.catch(() => {}).finally(() => el.remove());
const mid = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

// Снаряд (зірка чи сердечко) летить дугою з поля того, хто стріляє, у клітинку
export function fxFly(from, cell, glyph) {
  if (reduceMotion || !from?.isConnected || !cell?.isConnected) return Promise.resolve();
  const [x0, y0] = mid(from);
  const [x1, y1] = mid(cell);
  const s = h('span', { class: 'bs-fly', 'aria-hidden': 'true' }, glyph);
  s.style.left = `${x0}px`;
  s.style.top = `${y0}px`;
  document.body.append(s);
  const lift = Math.min(140, 50 + Math.abs(x1 - x0) * 0.25 + Math.abs(y1 - y0) * 0.15);
  const kf = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => ({
    transform: `translate(-50%, -50%) translate(${(x1 - x0) * t}px, ${(y1 - y0) * t - lift * 4 * t * (1 - t)}px) scale(${0.6 + 0.8 * Math.sin(Math.PI * t) + 0.2 * t}) rotate(${t * 300}deg)`,
    opacity: t === 0 ? 0 : 1,
    offset: t,
  }));
  return s.animate(kf, { duration: 620, easing: 'linear' }).finished.catch(() => {}).finally(() => s.remove());
}
// Відмітка сідає на місце
export function fxShot(mark) {
  if (reduceMotion || !mark) return;
  mark.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.25)', opacity: 1, offset: 0.6 }, { transform: 'none' }], { duration: 320, easing: 'ease-out' });
}
// Мимо: кільця по воді й бризки (у нього — золоті іскри)
export function fxMiss(cell, world) {
  if (reduceMotion || !cell) return;
  for (let i = 0; i < 2; i += 1) {
    const r = bit(cell, `bs-ring${world === 'vin' ? ' is-gold' : ''}`);
    bye(r, r.animate([{ transform: 'scale(.15)', opacity: 0.95 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 850, delay: i * 200, easing: 'ease-out', fill: 'backwards' }));
  }
  for (let i = 0; i < 5; i += 1) {
    const d = bit(cell, world === 'vin' ? 'bs-spark is-gold' : 'bs-drop');
    const dx = (i - 2) * 9;
    bye(d, d.animate([{ transform: 'translate(0, 0) scale(.6)', opacity: 1 }, { transform: `translate(${dx}px, -${16 + Math.abs(dx) / 2}px)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx * 1.4}px, 6px) scale(.4)`, opacity: 0 }], { duration: 650, easing: 'ease-out', fill: 'backwards' }));
  }
}
// Влучив: спалах і віяло іскор
export function fxHit(cell, world) {
  if (reduceMotion || !cell) return;
  const f = bit(cell, 'bs-flash');
  bye(f, f.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(1.7)', opacity: 0 }], { duration: 520, easing: 'ease-out' }));
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI * 2 * i) / 6 + 0.3;
    const s = bit(cell, world === 'vin' ? 'bs-spark is-gold' : 'bs-spark is-pink');
    bye(s, s.animate([{ transform: 'translate(0, 0) scale(1.2)', opacity: 1 }, { transform: `translate(${Math.cos(a) * 26}px, ${Math.sin(a) * 26}px) scale(.2)`, opacity: 0 }],
      { duration: 560, delay: 40, easing: 'ease-out', fill: 'backwards' }));
  }
}
// Потоплено: кораблик хитається, кренится й іде під воду з бульбашками; у нього гасне ліхтарик (CSS для is-sunk).
// Кінцевий вигляд — клас is-sunk; бульбашок не більше 3 на клітинку
export function fxSink(ship, world, board, cells) {
  ship.classList.add('is-sunk');
  markSunk(board, cells);
  if (reduceMotion) return Promise.resolve();
  const end = getComputedStyle(ship);
  const a = ship.animate([{ transform: 'none', opacity: 1 }, { transform: 'rotate(-5deg)', opacity: 1, offset: 0.15 }, { transform: 'rotate(4deg) translateY(-3%)', opacity: 1, offset: 0.3 },
    { transform: end.transform, opacity: end.opacity }], { duration: 1200, easing: 'ease-in' });
  cells.forEach((c, k) => {
    const cell = cellOf(board, c);
    for (let i = 0; i < 3; i += 1) {
      const b = bit(cell, `bs-bubble${world === 'vin' ? ' is-night' : ''}`, `left:${25 + Math.random() * 50}%;top:${40 + Math.random() * 30}%`);
      bye(b, b.animate([{ transform: 'translateY(0) scale(.4)', opacity: 0 }, { transform: 'translateY(-40%) scale(1)', opacity: 0.9, offset: 0.3 },
        { transform: `translate(${(Math.random() - 0.5) * 16}px, -46px) scale(.8)`, opacity: 0 }], { duration: 1000 + Math.random() * 400, delay: 300 + k * 120 + i * 110, easing: 'ease-out', fill: 'backwards' }));
    }
  });
  return a.finished.catch(() => {});
}

// «💌 Записка в кораблике»: конвертик вилітає з потопленого кораблика й розгортається листком над полем;
// тап чи кілька секунд — ховається
export function noteReveal(host, text, world, from = null) {
  const card = h('button', { type: 'button', class: `bs-note-pop is-${world}`, 'aria-live': 'polite' },
    h('span', { class: 'bs-note-head' }, '💌 Записка в кораблике:'), h('span', { class: 'bs-note-text' }, text));
  host.append(card);
  const hide = () => {
    if (!card.isConnected) return;
    if (reduceMotion) { card.remove(); return; }
    bye(card, card.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-12px) scale(.96)', opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' }));
  };
  card.addEventListener('click', hide);
  setTimeout(hide, 6500);
  if (reduceMotion) return card;
  let delay = 0;
  if (from?.isConnected) {
    const [x0, y0] = mid(from);
    const hr = host.getBoundingClientRect();
    const env = h('i', { class: 'bs-env', 'aria-hidden': 'true' }, '💌');
    env.style.left = `${x0 - hr.left}px`;
    env.style.top = `${y0 - hr.top}px`;
    host.append(env);
    const dx = hr.left + hr.width / 2 - x0;
    const dy = hr.top + hr.height * 0.52 - y0;
    bye(env, env.animate([{ transform: 'translate(-50%, -50%) scale(.3)', opacity: 0 }, { transform: `translate(-50%, -50%) translate(${dx * 0.3}px, ${dy * 0.3 - 40}px) scale(1.3) rotate(-12deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(2.2) rotate(6deg)`, opacity: 0 }], { duration: 700, easing: 'ease-in-out' }));
    delay = 520;
  }
  card.animate([{ transform: 'translateY(20px) scale(.3) rotate(-8deg)', opacity: 0 }, { transform: 'translateY(-4px) scale(1.06) rotate(2deg)', opacity: 1, offset: 0.6 },
    { transform: 'none', opacity: 1 }], { duration: 560, delay, easing: 'cubic-bezier(.2, .8, .3, 1.2)', fill: 'backwards' });
  return card;
}

// Фінал у стилі світу, де йшов бій: перемога — фонтан сердечок чи зірок і корона, поразка — якір гойдається, бульбашки й «Реванш?»
export function bsFinal(host, world, won) {
  const glyph = won ? SHOT[world === 'vona' ? 'vin' : 'vona'] : '🫧';
  const box = h('button', { type: 'button', class: `bs-final is-${world}${won ? ' is-won' : ''}` },
    h('span', { class: 'bs-final-icon', 'aria-hidden': 'true' }, won ? '👑' : '⚓'),
    h('span', { class: 'bs-final-title' }, won ? 'Победа!' : 'Флот на дне'),
    h('span', { class: 'bs-final-sub' }, won ? 'Весь флот потоплен' : 'Реванш? 😉'));
  host.append(box);
  const hide = () => { if (box.isConnected) bye(box, box.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.94)' }], { duration: reduceMotion ? 1 : 300, fill: 'forwards' })); };
  box.addEventListener('click', hide);
  setTimeout(hide, 3600);
  if (reduceMotion) return;
  box.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'ease-out' });
  box.firstChild.animate(won ? [{ transform: 'translateY(-40px) rotate(-20deg)', opacity: 0 }, { transform: 'none', opacity: 1 }]
    : [{ transform: 'translateY(0)' }, { transform: 'translateY(10px) rotate(12deg)' }, { transform: 'translateY(0)' }], { duration: won ? 600 : 1600, delay: 200, easing: 'ease-out', iterations: won ? 1 : 2, fill: 'backwards' });
  // Частинки: не більше 12
  for (let i = 0; i < 12; i += 1) {
    const p = h('i', { class: 'bs-final-bit', 'aria-hidden': 'true' }, glyph);
    p.style.left = `${8 + ((i * 37) % 84)}%`;
    host.append(p);
    const turn = (i % 2 ? 1 : -1) * 90;
    const kf = won
      ? [{ transform: 'translate(-50%, 0) scale(.4)', opacity: 0 }, { transform: `translate(-50%, -${120 + (i % 4) * 30}px) scale(1) rotate(${turn}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(-50%, -${60 + (i % 3) * 20}px) scale(.7) rotate(${turn * 2}deg)`, opacity: 0 }]
      : [{ transform: 'translate(-50%, 0) scale(.5)', opacity: 0 }, { transform: 'translate(-50%, -40px) scale(1)', opacity: 0.9, offset: 0.4 }, { transform: `translate(-50%, -${110 + (i % 3) * 25}px) scale(.8)`, opacity: 0 }];
    bye(p, p.animate(kf, { duration: 1500, delay: 250 + i * 90, easing: 'ease-out', fill: 'backwards' }));
  }
}

// Зміна ходу: напис плавно перемикається
export function fxSwap(el) {
  if (reduceMotion || !el) return;
  el.animate([{ transform: 'translateY(10px) scale(.94)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.2, .8, .3, 1.15)' });
}

export const pause = (x) => new Promise((done) => setTimeout(done, ms(x)));

// Кораблик після перемальовування «перелітає» зі старого місця дугою (кубик) чи плавно повертається на turn градусів (тап)
function flip(el, old, turn = 0) {
  if (reduceMotion || !el) return;
  const now = el.getBoundingClientRect();
  if (turn) {
    // Поворот навколо першої клітинки: горизонтальний іде від неї праворуч, вертикальний — донизу
    const cell = Math.min(now.width, now.height);
    el.style.transformOrigin = `${cell / 2}px ${cell / 2}px`;
    el.animate([{ transform: `rotate(${turn}deg)` }, { transform: `rotate(${-turn * 0.08}deg)`, offset: 0.75 }, { transform: 'none' }], { duration: 380, easing: 'ease-out' })
      .finished.catch(() => {}).finally(() => { el.style.transformOrigin = ''; });
    return;
  }
  if (!old) return;
  const dx = old.left - now.left;
  const dy = old.top - now.top;
  if (!dx && !dy) return;
  el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: `translate(${dx / 2}px, ${dy / 2 - 22}px) scale(1.15)`, offset: 0.5 }, { transform: 'none' }],
    { duration: 460, easing: 'ease-in-out' });
}

// Розстановка: «🎲 Расставить» — нова випадкова, тап по кораблику — повернути; під полем — записки (необов'язково)
export function placer(world) {
  let ships = randomFleet();
  const notes = FLEET.map(() => '');
  const board = seaEl(world, { label: 'Расстановка', cls: ' is-place' });
  // Перетягування пальцем: корабель їде за пальцем, під ним силует — зелений, якщо стане, червоний, якщо ні.
  // Відпустив на доброму місці — стає (м'яко «доїжджає» в клітинку), на поганому — повертається назад
  const ghost = h('span', { class: 'bs-ghost', 'aria-hidden': 'true' });
  // Коли щойно відпустили після перетягування: клік, що прилетить слідом (і на перемальований корабель), — не тап
  let draggedAt = 0;
  function drag(el, s, k) {
    let d = null;
    const len = s.cells.length;
    const vert = isVert(s.cells);
    el.addEventListener('pointerdown', (e) => {
      const r = board.getBoundingClientRect();
      const cw = r.width / W;
      const ch = r.height / W;
      const [sr, sc] = rc(s.cells[0]);
      d = { x: e.clientX, y: e.clientY, r, cw, ch, dr: Math.floor((e.clientY - r.top) / ch) - sr, dc: Math.floor((e.clientX - r.left) / cw) - sc, moved: false, at: -1 };
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 8) return;
      d.moved = true;
      el.classList.add('is-dragging');
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      const r0 = Math.floor((e.clientY - d.r.top) / d.ch) - d.dr;
      const c0 = Math.floor((e.clientX - d.r.left) / d.cw) - d.dc;
      const at = r0 >= 0 && c0 >= 0 && r0 < W && c0 < W ? r0 * W + c0 : -1;
      const good = at >= 0 && fits(at, len, vert) && !clash(shipCells(at, len, vert), ships.filter((_, i) => i !== k));
      d.at = good ? at : -1;
      el.classList.toggle('is-bad', !good);
      if (at >= 0 && fits(at, len, vert)) {
        ghost.style.gridArea = area(shipCells(at, len, vert));
        ghost.classList.toggle('is-bad', !good);
        if (!ghost.isConnected) board.append(ghost);
      } else ghost.remove();
    });
    const end = () => {
      if (!d) return;
      const was = d;
      d = null;
      ghost.remove();
      el.classList.remove('is-dragging', 'is-bad');
      if (!was.moved) return;
      draggedAt = Date.now();
      if (was.at >= 0) {
        const old = el.getBoundingClientRect();
        ships = ships.map((x, i) => (i === k ? { ...x, cells: shipCells(was.at, len, vert) } : x));
        el.style.transform = '';
        paint();
        flip(board.querySelectorAll('.bs-ship')[k], old);
        return;
      }
      const from = el.style.transform;
      el.style.transform = '';
      if (!reduceMotion) el.animate([{ transform: from }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  const paint = () => {
    board.querySelectorAll('.bs-ship').forEach((s) => s.remove());
    ships.forEach((s, k) => {
      const el = shipEl(world, s.cells, s.cells.length > 1 ? ' is-turnable' : '');
      el.setAttribute('role', 'button');
      el.removeAttribute('aria-hidden');
      el.setAttribute('aria-label', `${WORLD[world].one} на ${s.cells.length} — повернуть или перетащить`);
      drag(el, s, k);
      el.addEventListener('click', () => {
        // Щойно тягли — це не тап, не повертаємо
        if (Date.now() - draggedAt < 450) return;
        const next = rotate(ships, k);
        if (!next) {
          if (!reduceMotion) el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 260 });
          // Повернутому ніде немає місця (поле тісне) — кажемо, що робити, а не мовчки трусимось
          toast('Повёрнутому тут негде встать — нажми «🎲 Расставить» или поверни соседа');
          return;
        }
        ships = next;
        paint();
        // Став вертикальним — «доповертається» з горизонталі, і навпаки
        flip(board.querySelectorAll('.bs-ship')[k], null, isVert(ships[k].cells) ? -90 : 90);
      });
      board.append(el);
    });
  };
  paint();
  const dice = h('button', { type: 'button', class: 'btn bs-dice', onclick: () => {
    const old = [...board.querySelectorAll('.bs-ship')].map((s) => s.getBoundingClientRect());
    ships = randomFleet();
    paint();
    board.querySelectorAll('.bs-ship').forEach((s, k) => flip(s, old[k]));
  } }, '🎲 Расставить');
  // Записки: поле на кожен корабель; готові варіанти — у поле, де курсор (чи в перше порожнє)
  let focus = null;
  const inputs = FLEET.map((len, k) => {
    const inp = h('input', { type: 'text', class: 'duel-own bs-note-input', maxlength: '120', placeholder: 'Записка — если хочешь', 'aria-label': `Записка в кораблик на ${len}` });
    inp.addEventListener('focus', () => { focus = k; });
    inp.addEventListener('input', () => { notes[k] = inp.value; });
    return inp;
  });
  const put = (t) => {
    const k = focus ?? notes.findIndex((n) => !n.trim());
    if (k < 0) return;
    inputs[k].value = t;
    notes[k] = t;
    if (!reduceMotion) inputs[k].animate([{ transform: 'scale(.97)', opacity: 0.5 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'ease-out' });
    focus = notes.findIndex((n) => !n.trim());
    if (focus < 0) focus = null;
  };
  // Готові записки — за темами: вкладки й варіанти обраної
  const ideas = h('div', { class: 'bs-ideas', role: 'group', 'aria-label': 'Готовые записки' });
  const tabs = h('div', { class: 'bs-idea-tabs', role: 'group', 'aria-label': 'Темы записок' });
  let theme = 0;
  const pick = (i) => {
    theme = i;
    tabs.querySelectorAll('.bs-idea-tab').forEach((t, j) => t.setAttribute('aria-pressed', String(j === i)));
    ideas.replaceChildren(...[...NOTE_SETS[i][1]].sort(() => Math.random() - 0.5).slice(0, 6).map((t) => h('button', { type: 'button', class: 'bs-idea', onclick: () => put(t) }, t)));
  };
  tabs.append(...NOTE_SETS.map(([name], i) => h('button', { type: 'button', class: 'bs-idea-tab', 'aria-pressed': 'false', onclick: () => pick(i) }, name)));
  pick(0);
  const rows = FLEET.map((len, k) => h('label', { class: 'bs-note-row' }, h('span', { class: `bs-note-ship is-${world}`, 'aria-hidden': 'true', style: `--len:${len}`, html: shipSvg(world, shipCells(0, len, false)) }), inputs[k],
    // Кубик — випадкова записка з обраної теми, якої ще немає в інших корабликах
    h('button', { type: 'button', class: 'bs-note-dice', 'aria-label': 'Случайная записка из темы', onclick: (e) => {
      e.preventDefault();
      const free = NOTE_SETS[theme][1].filter((t) => !notes.includes(t));
      if (!free.length) return;
      focus = k;
      put(free[Math.floor(Math.random() * free.length)]);
    } }, '🎲')));
  return {
    board,
    tools: h('div', { class: 'bs-tools' }, dice, h('span', { class: 'bs-turn-hint' }, '↻ Тап — повернуть, потяни — переставить')),
    notes: [h('p', { class: 'hint duel-hint' }, `Спрячь в кораблики записки — ${world === 'vona' ? 'он' : 'она'} прочитает, когда потопит.`), ...rows, tabs, ideas],
    fleet: () => ships.map((s, k) => ({ cells: s.cells, note: notes[k].replace(/\s+/g, ' ').trim() || undefined })),
  };
}
