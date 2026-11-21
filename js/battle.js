// «🚢 Морской бой» — малювання й рух: поле 6×6 у світі сторони (її — рожеве море з корабликами під вітрилами-сердечками,
// його — зоряне небо з ракетами й супутником), розстановка без перетягування, постріли й потоплення.
// Стан гри й черга — у duel.js; тут лише те, що видно. Анімації — лише transform/opacity (Web Animations API)
import { h, reduceMotion, sky } from './ui.js';

export const W = 6;
export const FLEET = [3, 2, 2, 1];
// Готові записки в кораблики — одним тапом
export const NOTE_IDEAS = ['С меня массаж 💆', 'Ты моё солнышко ☀️', 'Обнимаю крепко-крепко', 'Ужин готовлю я 🍝',
  'Целую в нос 😘', 'Ты самая-самая', 'С меня кофе в постель ☕', 'Скучаю очень-очень'];
// Чим стріляє сторона: вона — сердечками, він — золотими зірками
export const SHOT = { vona: '💗', vin: '⭐' };
// Назви світів: «Моё море» / «Его небо»
export const WORLD = { vona: { mine: 'Моё море', their: 'Её море', ships: 'кораблики', one: 'кораблик' }, vin: { mine: 'Моё небо', their: 'Его небо', ships: 'ракеты', one: 'ракета' } };

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

// Поворот корабля k навколо першої клітинки; не влазить чи торкається інших — null
export function rotate(ships, k) {
  const s = ships[k];
  if (s.cells.length < 2) return null;
  const vert = !isVert(s.cells);
  if (!fits(s.cells[0], s.cells.length, vert)) return null;
  const cells = shipCells(s.cells[0], s.cells.length, vert);
  return clash(cells, ships.filter((_, i) => i !== k)) ? null : ships.map((x, i) => (i === k ? { ...x, cells } : x));
}

// ── Малюнки кораблів: горизонтально в одиницях 40 на клітинку; вертикальні повертаємо (ракета — носом угору)
const heart = (cx, cy, r) => `M${cx} ${cy + r * 0.9}C${cx - r * 1.6} ${cy - r * 0.1} ${cx - r * 0.9} ${cy - r * 1.3} ${cx} ${cy - r * 0.45}`
  + `C${cx + r * 0.9} ${cy - r * 1.3} ${cx + r * 1.6} ${cy - r * 0.1} ${cx} ${cy + r * 0.9}Z`;
// Кораблик згори: корпус із гострим носом, піна біля носа, на палубі — вітрила-сердечка (у повернутому — теж рівні)
function boat(len, vert) {
  const L = len * 40;
  let s = `<path d="M3 20C3 11 9 8 16 8H${L - 16}C${L - 8} 8 ${L - 2} 14 ${L - 1} 20C${L - 2} 26 ${L - 8} 32 ${L - 16} 32H16C9 32 3 29 3 20Z" fill="#B24A7E"/>`
    + `<path d="M8 20C8 14 11 12 16 12H${L - 17}C${L - 11} 12 ${L - 7} 16 ${L - 6} 20C${L - 7} 24 ${L - 11} 28 ${L - 17} 28H16C11 28 8 26 8 20Z" fill="#F6B3CF"/>`
    + `<path d="M${L - 3} 11Q${L + 4} 20 ${L - 3} 29" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>`;
  for (let k = 0; k < len; k += 1) {
    const x = 20 + k * 40;
    s += `<g transform="rotate(${vert ? 90 : 0} ${x} 20)"><path d="${heart(x, 21, 9)}" fill="#FF4F8E" stroke="#fff" stroke-width="1.6"/></g>`;
  }
  return s;
}
function rocket(len) {
  const L = len * 40;
  if (len === 1) {
    return '<rect x="2" y="15" width="11" height="10" fill="#3B6EA8" stroke="#EDB949"/><rect x="27" y="15" width="11" height="10" fill="#3B6EA8" stroke="#EDB949"/>'
      + '<path d="M7.5 15v10M32.5 15v10M13 20h2M25 20h2" stroke="#EDB949"/><rect x="15" y="12" width="10" height="16" rx="3" fill="#E9EEF5" stroke="#0B384B"/>'
      + '<path d="M20 12V6" stroke="#E9EEF5" stroke-width="1.5"/><circle cx="20" cy="5" r="2.2" fill="#EDB949"/>';
  }
  let s = `<path d="M9 13H${L - 16}Q${L - 2} 20 ${L - 16} 27H9Z" fill="#E9EEF5" stroke="#0B384B" stroke-width="1.2"/>`
    + `<path d="M${L - 16} 13Q${L - 2} 20 ${L - 16} 27Z" fill="#EDB949"/>`
    + '<path d="M10 13 3 5h9l6 8ZM10 27l-7 8h9l6-8Z" fill="#E35D6A"/><path d="M9 16Q1 20 9 24Z" fill="#FFB347"/>';
  for (let k = 0; k < len; k += 1) if (24 + k * 40 < L - 20) s += `<circle cx="${24 + k * 40}" cy="20" r="3.6" fill="#6EC6FF" stroke="#0B384B"/>`;
  return s;
}
function shipSvg(world, cells) {
  const len = cells.length;
  const vert = isVert(cells);
  const L = len * 40;
  const art = world === 'vona' ? boat(len, vert) : rocket(len);
  return vert
    ? `<svg viewBox="0 0 40 ${L}"><g transform="translate(0 ${L}) rotate(-90)">${art}</g></svg>`
    : `<svg viewBox="0 0 ${L} 40">${art}</svg>`;
}
const area = (cells) => {
  const [r, c] = rc(cells[0]);
  return isVert(cells) ? `${r + 1} / ${c + 1} / span ${cells.length} / span 1` : `${r + 1} / ${c + 1} / span 1 / span ${cells.length}`;
};
export function shipEl(world, cells, cls = '') {
  const el = h('span', { class: `bs-ship${cls}`, 'aria-hidden': 'true', html: shipSvg(world, cells) });
  el.style.gridArea = area(cells);
  return el;
}

// Поле у світі сторони world: клітинки-кнопки (з явним місцем у сітці — кораблі лягають поверх тих самих рядків)
export function seaEl(world, { label, cls = '', onCell = null } = {}) {
  const board = h('div', { class: `bs-board is-${world}${cls}`, role: 'group', 'aria-label': label });
  board.append(world === 'vin' ? sky(16, 7, 'bs-sky') : h('span', { class: 'bs-waves', 'aria-hidden': 'true' }));
  for (let c = 0; c < W * W; c += 1) {
    const [r, col] = rc(c);
    const cell = h('button', { type: 'button', class: 'bs-cell', 'data-c': String(c), disabled: !onCell, 'aria-label': `${'АБВГДЕ'[col]}${r + 1}`, onclick: onCell ? () => onCell(c) : null });
    cell.style.gridArea = `${r + 1} / ${col + 1}`;
    board.append(cell);
  }
  return board;
}
export const cellOf = (board, c) => board.querySelector(`.bs-cell[data-c="${c}"]`);

// Відмітка пострілу: значок того, хто стріляв; мимо — блідий і менший
export function markShot(board, c, shooter, hit) {
  const cell = cellOf(board, c);
  if (!cell) return null;
  cell.classList.add(hit ? 'is-hit' : 'is-miss');
  cell.disabled = true;
  const mark = h('span', { class: 'bs-mark', 'aria-hidden': 'true' }, SHOT[shooter]);
  cell.append(mark);
  cell.setAttribute('aria-label', `${cell.getAttribute('aria-label').slice(0, 2)}: ${hit ? 'попадание' : 'мимо'}`);
  return mark;
}

// ── Рух. Усе всередині клітинки (вона position: relative), прибирається після анімації
const ms = (x) => (reduceMotion ? 1 : x);
const bit = (cell, cls, css = '') => { const s = h('i', { class: `bs-fx ${cls}`, 'aria-hidden': 'true' }); s.style.cssText = css; cell.append(s); return s; };
const bye = (el, a) => a.finished.catch(() => {}).finally(() => el.remove());

// Постріл прилітає: значок падає згори з поворотом
export function fxShot(mark) {
  if (reduceMotion || !mark) return;
  mark.animate([{ transform: 'translateY(-160%) scale(1.8) rotate(-30deg)', opacity: 0 }, { transform: 'translateY(0) scale(1.15)', offset: 0.7 }, { transform: 'none' }],
    { duration: 380, easing: 'ease-in' });
}
// Мимо: на морі — сплеск і круги по воді; у космосі — зірочка гасне іскрами
export function fxMiss(cell, world) {
  if (reduceMotion || !cell) return;
  if (world === 'vona') {
    for (let i = 0; i < 3; i += 1) {
      const r = bit(cell, 'bs-ring');
      bye(r, r.animate([{ transform: 'scale(.15)', opacity: 0.9 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 900, delay: 300 + i * 180, easing: 'ease-out', fill: 'backwards' }));
    }
    for (let i = 0; i < 5; i += 1) {
      const d = bit(cell, 'bs-drop');
      const dx = (i - 2) * 9;
      bye(d, d.animate([{ transform: 'translate(0, 0) scale(.6)', opacity: 1 }, { transform: `translate(${dx}px, -${16 + Math.abs(dx) / 2}px)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx * 1.4}px, 6px) scale(.5)`, opacity: 0 }], { duration: 650, delay: 320, easing: 'ease-out', fill: 'backwards' }));
    }
    return;
  }
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI * 2 * i) / 6;
    const s = bit(cell, 'bs-spark');
    bye(s, s.animate([{ transform: 'translate(0, 0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * 20}px, ${Math.sin(a) * 20}px) scale(.2)`, opacity: 0 }],
      { duration: 600, delay: 340, easing: 'ease-out', fill: 'backwards' }));
  }
}
// Влучив: спалах і вогник
export function fxHit(cell) {
  if (reduceMotion || !cell) return;
  const f = bit(cell, 'bs-flash');
  bye(f, f.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 520, delay: 300, easing: 'ease-out', fill: 'backwards' }));
  const fire = bit(cell, 'bs-fire');
  fire.textContent = '🔥';
  bye(fire, fire.animate([{ transform: 'translateY(0) scale(.4)', opacity: 0 }, { transform: 'translateY(-30%) scale(1.1)', opacity: 1, offset: 0.3 },
    { transform: 'translateY(-90%) scale(.7)', opacity: 0 }], { duration: 900, delay: 360, easing: 'ease-out', fill: 'backwards' }));
}
// Потоплено: кораблик іде під воду з бульбашками, ракета розсипається іскрами. Кінцевий вигляд — клас is-sunk
export function fxSink(ship, world, board, cells) {
  ship.classList.add('is-sunk');
  if (reduceMotion) return Promise.resolve();
  const end = getComputedStyle(ship);
  const a = ship.animate([{ transform: 'none', opacity: 1 }, { transform: world === 'vona' ? 'translateY(-6%) rotate(-3deg)' : 'scale(1.08)', opacity: 1, offset: 0.2 },
    { transform: end.transform, opacity: end.opacity }], { duration: 1100, delay: 250, easing: 'ease-in' });
  cells.forEach((c, k) => {
    const cell = cellOf(board, c);
    for (let i = 0; i < 4; i += 1) {
      const b = bit(cell, world === 'vona' ? 'bs-bubble' : 'bs-spark is-gold', `left:${25 + Math.random() * 50}%;top:${40 + Math.random() * 30}%`);
      const ang = Math.random() * Math.PI * 2;
      const kf = world === 'vona'
        ? [{ transform: 'translateY(0) scale(.4)', opacity: 0 }, { transform: 'translateY(-40%) scale(1)', opacity: 0.9, offset: 0.3 }, { transform: `translate(${(Math.random() - 0.5) * 16}px, -46px) scale(.8)`, opacity: 0 }]
        : [{ transform: 'translate(0, 0) scale(1.2)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * 34}px, ${Math.sin(ang) * 34}px) scale(.2)`, opacity: 0 }];
      bye(b, b.animate(kf, { duration: 900 + Math.random() * 400, delay: 350 + k * 120 + i * 90, easing: 'ease-out', fill: 'backwards' }));
    }
  });
  return a.finished.catch(() => {});
}

// «💌 Записка в кораблике»: листок над полем; тап чи кілька секунд — ховається
export function noteReveal(host, text, world) {
  const card = h('button', { type: 'button', class: `bs-note-pop is-${world}`, 'aria-live': 'polite' },
    h('span', { class: 'bs-note-head' }, `💌 Записка в ${world === 'vona' ? 'кораблике' : 'ракете'}:`), h('span', { class: 'bs-note-text' }, text));
  host.append(card);
  const hide = () => {
    if (!card.isConnected) return;
    if (reduceMotion) { card.remove(); return; }
    bye(card, card.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-12px) scale(.96)', opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' }));
  };
  card.addEventListener('click', hide);
  setTimeout(hide, 6000);
  if (!reduceMotion) {
    card.animate([{ transform: 'translateY(30px) scale(.4) rotate(-8deg)', opacity: 0 }, { transform: 'translateY(-4px) scale(1.06) rotate(2deg)', opacity: 1, offset: 0.6 },
      { transform: 'none', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(.2, .8, .3, 1.2)' });
  }
  return card;
}

export const pause = (x) => new Promise((done) => setTimeout(done, ms(x)));

// Розстановка: «🎲 Расставить» — нова випадкова, тап по кораблю — повернути; під полем — записки (необов'язково)
export function placer(world) {
  let ships = randomFleet();
  const notes = FLEET.map(() => '');
  const board = seaEl(world, { label: 'Расстановка', cls: ' is-place' });
  const paint = () => {
    board.querySelectorAll('.bs-ship').forEach((s) => s.remove());
    ships.forEach((s, k) => {
      const el = shipEl(world, s.cells, s.cells.length > 1 ? ' is-turnable' : '');
      el.setAttribute('role', 'button');
      el.removeAttribute('aria-hidden');
      el.setAttribute('aria-label', `${WORLD[world].one} на ${s.cells.length} — повернуть`);
      el.addEventListener('click', () => {
        const next = rotate(ships, k);
        if (!next) {
          if (!reduceMotion) el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 260 });
          return;
        }
        ships = next;
        paint();
        const fresh = board.querySelectorAll('.bs-ship')[k];
        if (!reduceMotion) fresh?.animate([{ transform: 'scale(.6)', opacity: 0.3 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.7 }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
      });
      board.append(el);
    });
  };
  paint();
  const dice = h('button', { type: 'button', class: 'btn bs-dice', onclick: () => {
    ships = randomFleet();
    paint();
    if (!reduceMotion) board.querySelectorAll('.bs-ship').forEach((s, k) => s.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 280, delay: k * 60, easing: 'ease-out', fill: 'backwards' }));
  } }, '🎲 Расставить');
  // Записки: поле на кожен корабель; готові варіанти — у поле, де курсор (чи в перше порожнє)
  let focus = null;
  const inputs = FLEET.map((len, k) => {
    const inp = h('input', { type: 'text', class: 'duel-own bs-note-input', maxlength: '120', placeholder: 'Записка (необязательно)', 'aria-label': `Записка в ${WORLD[world].one} на ${len}` });
    inp.addEventListener('focus', () => { focus = k; });
    inp.addEventListener('input', () => { notes[k] = inp.value; });
    return inp;
  });
  const ideas = h('div', { class: 'bs-ideas', role: 'group', 'aria-label': 'Готовые записки' }, ...NOTE_IDEAS.map((t) => h('button', { type: 'button', class: 'bs-idea', onclick: () => {
    const k = focus ?? notes.findIndex((n) => !n.trim());
    if (k < 0) return;
    inputs[k].value = t;
    notes[k] = t;
    focus = notes.findIndex((n) => !n.trim());
    if (focus < 0) focus = null;
  } }, t)));
  const rows = FLEET.map((len, k) => h('label', { class: 'bs-note-row' }, h('span', { class: `bs-note-ship is-${world}`, 'aria-hidden': 'true', html: shipSvg(world, shipCells(0, len, false)) }), inputs[k]));
  return {
    board,
    tools: h('div', { class: 'bs-tools' }, dice, h('span', { class: 'hint' }, `Тап по ${world === 'vona' ? 'кораблику' : 'ракете'} — повернуть`)),
    notes: [h('p', { class: 'hint duel-hint' }, `Можно спрятать в ${WORLD[world].ships} записки — ${world === 'vona' ? 'он' : 'она'} прочитает, когда потопит.`), ...rows, ideas],
    fleet: () => ships.map((s, k) => ({ cells: s.cells, note: notes[k].replace(/\s+/g, ' ').trim() || undefined })),
  };
}
