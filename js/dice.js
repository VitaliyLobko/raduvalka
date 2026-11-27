// «🎲 Кубики» 18+: три кубики (что · где · как) рівня 💗 / 🔥 / 🌶️. Кидаю я — це мій подарунок другому:
// не подобається один кубик — тап по ньому, перекинеться лише він (до 3 разів); «Подарить купон» — купон іде в чат.
// Той, кому подарували, дивиться той самий кидок на весь екран і, коли купон виконано, відмічає «Исполнено ✓».
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
// Поки кубики котяться — мелькають нейтральні значки (справжні грані знає лише сервер)
const BLUR = ['❤️', '✨', '💫', '💞', '🌙', '🔥', '💋', '🎲'];
const blur = () => BLUR[Math.floor(Math.random() * BLUR.length)];
// Кубики стають по одному: зліва направо, з клацанням і вібрацією
const SETTLE = [650, 1000, 1350];

let open = null;
const forThem = () => (who().partner === 'она' ? 'ей' : 'ему');
const levelOf = (l) => LEVELS.find(([k]) => k === l) || LEVELS[1];

export async function openDice() {
  if (open) return;
  const sh = gameSheet({ icon: '🎲', title: 'Кубики', cls: 'dice-sheet', onClose: () => { open?.stop?.(); open = null; } });
  open = { body: sh.body, close: sh.close, busy: false, stop: null };
  sh.body.append(h('p', { class: 'hint duel-hint' }, 'Загружаю…'));
  let r;
  try { r = await get('dice'); } catch (e) {
    if (open) msg(e.status === 503 ? 'Эта игра пока недоступна' : 'Нет связи — кубики откроются, когда появится интернет');
    return;
  }
  if (!open) return;
  if (r.roll) play(r.roll, null);
  else levels();
}

const msg = (text) => open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, text));

function levels() {
  open.body.replaceChildren(
    h('p', { class: 'hint duel-hint dice-about' }, `Бросаешь ты — это твой подарок ${forThem()}: что, где и как. Не нравится кубик — тапни его, и он перебросится. Понравилось — подари купон, ${who().partner} предъявит его на встрече 😏`),
    h('div', { class: 'hot-levels' }, ...LEVELS.map(([level, icon, name, about]) => h('button', {
      type: 'button', class: `game-tile hot-level is-${level}`, onclick: () => roll({ level }),
    }, h('span', { class: 'game-tile-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'game-tile-text' }, h('b', {}, name), h('span', {}, about))))));
}

// Великий кубик: грань — значок того, що випало; onTap — перекинути саме його
function bigDie(icon, onTap = null) {
  const face = h('span', { class: 'dice-face', 'aria-hidden': 'true' }, icon);
  const el = onTap ? h('button', { type: 'button', class: 'dice-die is-big', 'aria-label': 'Перебросить этот кубик', onclick: onTap }, face)
    : h('span', { class: 'dice-die is-big' }, face);
  return { el, face };
}

// Сцена кидка (у мене — з перекиданням, у неї — повтор): кубики котяться, стають по одному, тоді слова й фраза
function stage(r, { canReroll = false, onReroll = null } = {}) {
  const [, icon, name] = levelOf(r.level);
  const texts = r.texts || [];
  const dies = r.icons.map((ic, i) => bigDie(ic, canReroll && r.left > 0 ? () => onReroll(i) : null));
  const words = texts.map((t) => h('span', { class: 'dice-word' }, t));
  const cols = dies.map((d, i) => h('div', { class: 'dice-col' }, h('span', { class: 'dice-label' }, DICE[i]), d.el, words[i]));
  const phrase = h('p', { class: 'dice-phrase' }, texts.join(' · '));
  const box = h('section', { class: `dice-stage is-${r.level}` },
    h('p', { class: 'dice-level' }, `${icon} ${name}`),
    h('div', { class: 'dice-row' }, ...cols),
    phrase);
  const shown = () => { words.forEach((w) => w.classList.add('is-in')); phrase.classList.add('is-in'); };
  // which — які кубики котяться (за замовчуванням усі); повертає «зупинити»
  const roll = (which = [0, 1, 2]) => {
    if (reduceMotion) { shown(); return () => {}; }
    box.classList.add('is-rolling');
    which.forEach((i) => { dies[i].el.classList.add('is-tumbling'); words[i]?.classList.remove('is-in'); });
    phrase.classList.remove('is-in');
    sfx('dice');
    const t = setInterval(() => which.forEach((i) => { if (dies[i].el.classList.contains('is-tumbling')) dies[i].face.textContent = blur(); }), 90);
    const timers = which.map((i, k) => setTimeout(() => {
      dies[i].el.classList.remove('is-tumbling');
      dies[i].face.textContent = r.icons[i];
      dies[i].el.classList.add('is-landed');
      setTimeout(() => dies[i].el.classList.remove('is-landed'), 400);
      words[i]?.classList.add('is-in');
      sfx('place');
      navigator.vibrate?.(15);
      if (k === which.length - 1) { clearInterval(t); box.classList.remove('is-rolling'); phrase.classList.add('is-in'); }
    }, SETTLE[k]));
    return () => { clearInterval(t); timers.forEach(clearTimeout); };
  };
  return { box, roll, shown };
}

// Мій кидок: сцена, «Подарить купон», лічильник перекидань, інший рівень. which — що котиться (null — без анімації)
function play(r, which = [0, 1, 2]) {
  const s = stage(r, { canReroll: true, onReroll: (i) => roll({ id: r.id, die: i }, [i]) });
  open.body.replaceChildren(
    s.box,
    h('p', { class: 'dice-left' }, r.left > 0 ? `Тапни кубик, чтобы перебросить его · осталось ${r.left}` : 'Перебросы закончились — дари или выбери другой уровень'),
    h('button', { type: 'button', class: 'btn btn-primary duel-go dice-keep', onclick: () => keep(r) }, `🎁 Подарить купон ${forThem()}`),
    h('button', { type: 'button', class: 'duel-cancel', onclick: drop }, '← Другой уровень'));
  open.stop?.();
  open.stop = null;
  if (which) open.stop = s.roll(which);
  else s.shown();
}

async function roll(body, which = [0, 1, 2]) {
  if (open.busy) return;
  open.busy = true;
  try {
    const r = await send('dice', 'POST', body);
    if (open) play(r.roll, which);
  } catch (e) {
    toast(e.status === 409 ? (body.die != null ? 'Перебросы закончились' : 'Этот бросок уже закончился') : 'Нет связи — попробуй ещё раз');
    if (e.status === 409 && open && body.die == null) levels();
  } finally { if (open) open.busy = false; }
}

async function keep(r) {
  if (open.busy) return;
  open.busy = true;
  try {
    await send('dice/keep', 'POST', { id: r.id });
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
    burst(open.body.querySelector('.dice-stage'), '💋', 12);
    toast(`Купон у ${who().partner === 'она' ? 'неё' : 'него'} в чате — бросок увидит целиком`);
    const close = open.close;
    setTimeout(close, 700);
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

// Повтор кидка на весь екран (купон у чаті): ті самі кубики котяться й стають на свої грані, тоді — текст.
// w — купон { icons, texts?, text, level?, mine }; onDone — закрили
export function diceShow(w, onDone = () => {}) {
  const texts = w.texts?.length === 3 ? w.texts : String(w.text || '').split(' · ');
  const s = stage({ level: w.level || 'hot', icons: w.icons || ['🎲', '🎲', '🎲'], texts });
  const close = () => { stop(); layer.remove(); document.removeEventListener('keydown', onKey); onDone(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const from = w.mine ? 'Твой купон' : `${who().partner === 'она' ? 'Она дарит' : 'Он дарит'} тебе купон`;
  const layer = h('div', { class: 'dice-show', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Купон на встречу' },
    h('p', { class: 'dice-show-head' }, `🎲 ${from}`),
    s.box,
    h('p', { class: 'dice-show-hint' }, w.mine ? 'Предъявит на встрече 😏' : 'Предъяви на встрече 😏'),
    h('button', { type: 'button', class: 'btn btn-primary dice-show-close', onclick: () => close() }, 'Закрыть'));
  document.body.append(layer);
  document.addEventListener('keydown', onKey);
  const stop = s.roll();
  setTimeout(() => { if (layer.isConnected) burst(s.box, '💋', 10); }, SETTLE[2] + 200);
}

// Три значки купона рядком над його текстом (у чаті)
const miniDie = (icon) => h('span', { class: 'dice-die' }, h('span', { class: 'dice-face', 'aria-hidden': 'true' }, icon));
export const diceIcons = (icons) => h('span', { class: 'dice-row dice-row-mini', 'aria-hidden': 'true' }, ...icons.map((ic) => miniDie(ic)));
