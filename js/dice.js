// «🎲 Кубики» 18+: три кубики (что · где · как) рівня 💗 / 🔥 / 🌶️. Кидаю для другого: до 3 перекидань,
// «Сохранить купоном» — купон іде в чат, той, кому подарували, відмічає «Исполнено ✓».
// Кидає сервер; тексти граней — у секреті воркера, тут їх нема
import { who } from './data.js';
import { get, send } from './api.js';
import { h, toast, reduceMotion } from './ui.js';
import { burst } from './fx.js';
import { sfx } from './sound.js';
import { gameSheet } from './games.js';

const LEVELS = [
  ['soft', '💗', 'Нежно', 'Поцелуи и ласки'],
  ['hot', '🔥', 'Горячо', 'Посмелее: масло, лёд, повязка на глаза'],
  ['fire', '🌶️', 'Огонь', 'Самые откровенные купоны'],
];
const DICE = ['Что', 'Где', 'Как'];
// Поки кубики трясуться — мелькають нейтральні значки (справжні грані знає лише сервер)
const BLUR = ['❤️', '✨', '💫', '💞', '🌙', '🔥', '💋', '🎲'];
const blur = () => BLUR[Math.floor(Math.random() * BLUR.length)];
const SPIN_MS = 700;

let open = null;

export async function openDice() {
  if (open) return;
  const sh = gameSheet({ icon: '🎲', title: 'Кубики', cls: 'dice-sheet', onClose: () => { clearInterval(open?.spin); open = null; } });
  open = { body: sh.body, close: sh.close, busy: false, spin: 0 };
  sh.body.append(h('p', { class: 'hint duel-hint' }, 'Загружаю…'));
  let r;
  try { r = await get('dice'); } catch (e) {
    if (open) msg(e.status === 503 ? 'Эта игра пока недоступна' : 'Нет связи — кубики откроются, когда появится интернет');
    return;
  }
  if (!open) return;
  if (r.roll) play(r.roll, false);
  else levels();
}

const msg = (text) => open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, text));
const forThem = () => (who().partner === 'она' ? 'для неё' : 'для него');

function levels() {
  open.body.replaceChildren(
    h('p', { class: 'hint duel-hint' }, `Кидаешь ${forThem()}: три кубика — что, где и как. Не нравится — перебрось, до трёх раз. Понравилось — сохрани купоном на встречу.`),
    h('div', { class: 'hot-levels' }, ...LEVELS.map(([level, icon, name, about]) => h('button', {
      type: 'button', class: `game-tile hot-level is-${level}`, onclick: () => roll({ level }),
    }, h('span', { class: 'game-tile-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'game-tile-text' }, h('b', {}, name), h('span', {}, about))))));
}

// Грань кубика — значок того, що випало
function die(icon) {
  const el = h('span', { class: 'dice-die', 'aria-hidden': 'true' });
  paintDie(el, icon);
  return el;
}
function paintDie(el, icon) {
  el.textContent = icon;
}

// Кидок: кубики крутяться, поки чекаємо сервер, і ще трохи — потім стають на свої грані
function play(r, animate = true) {
  const [, icon, name] = LEVELS.find(([l]) => l === r.level) || LEVELS[0];
  const dies = r.icons.map((ic) => die(ic));
  const words = r.texts.map((t) => h('span', { class: 'dice-word' }, t));
  const cols = dies.map((d, i) => h('div', { class: 'dice-col' }, h('span', { class: 'dice-label' }, DICE[i]), d, words[i]));
  const rerollBtn = h('button', { type: 'button', class: 'btn dice-reroll', disabled: r.left <= 0, onclick: () => roll({ id: r.id }) },
    r.left > 0 ? `🎲 Перебросить · ещё ${r.left}` : 'Перебросов больше нет');
  open.body.replaceChildren(
    h('section', { class: 'duel-block dice-block' },
      h('h3', { class: 'duel-block-title' }, `${icon} ${name}`),
      h('div', { class: 'dice-row' }, ...cols),
      h('p', { class: 'dice-phrase' }, r.texts.join(' · '))),
    h('button', { type: 'button', class: 'btn btn-primary duel-go dice-keep', onclick: () => keep(r) }, '🎁 Сохранить купоном'),
    rerollBtn,
    h('button', { type: 'button', class: 'duel-cancel', onclick: drop }, '← Другой уровень'));
  if (animate && !reduceMotion) spin(dies, r.icons, words);
}

function spin(dies, icons, words) {
  const block = open.body.querySelector('.dice-block');
  block.classList.add('is-rolling');
  sfx('dice');
  clearInterval(open.spin);
  open.spin = setInterval(() => dies.forEach((d) => paintDie(d, blur())), 90);
  const t = open.spin;
  setTimeout(() => {
    if (!open || open.spin !== t) return;
    clearInterval(t);
    open.spin = 0;
    dies.forEach((d, i) => paintDie(d, icons[i]));
    block.classList.remove('is-rolling');
    words.forEach((w) => w.classList.add('is-in'));
  }, SPIN_MS);
}

async function roll(body) {
  if (open.busy) return;
  open.busy = true;
  try {
    const r = await send('dice', 'POST', body);
    if (open) play(r.roll);
  } catch (e) {
    toast(e.status === 409 ? 'Этот бросок уже закончился' : 'Нет связи — попробуй ещё раз');
    if (e.status === 409 && open) levels();
  } finally { if (open) open.busy = false; }
}

async function keep(r) {
  if (open.busy) return;
  open.busy = true;
  try {
    await send('dice/keep', 'POST', { id: r.id });
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
    burst(open.body.querySelector('.dice-block'), '🎲', 10);
    toast(`Купон у ${who().partner === 'она' ? 'неё' : 'него'} в чате`);
    const close = open.close;
    setTimeout(close, 600);
  } catch (e) {
    toast(e.status === 409 ? 'Этот бросок уже закончился' : 'Нет связи — попробуй ещё раз');
    if (open) open.busy = false;
  }
}

async function drop() {
  if (open.busy) return;
  try { await send('dice/drop', 'POST', {}); } catch { /* без звʼязку — кидок лишиться до наступного */ }
  if (open) levels();
}

// Кубики, що котяться в картці купона, поки не відкрився текст, і стають на ті самі значки
export function diceTumble() {
  const dies = [0, 1, 2].map(() => die(blur()));
  const row = h('span', { class: 'dice-row dice-row-mini is-rolling' }, ...dies);
  if (reduceMotion) return { row, done: Promise.resolve() };
  const t = setInterval(() => dies.forEach((d) => paintDie(d, blur())), 90);
  sfx('dice');
  return { row, done: new Promise((ok) => setTimeout(() => { clearInterval(t); ok(); }, SPIN_MS)) };
}
// Три значки купона рядком над його текстом
export const diceIcons = (icons) => h('span', { class: 'dice-row dice-row-mini', 'aria-hidden': 'true' }, ...icons.map((ic) => die(ic)));
