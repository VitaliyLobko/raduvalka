// Тема: у нього завжди ніч; у неї — «Как в телефоне» (за темною темою телефона), «Светлая» чи «Ночная».
// Узор фону — у кожного свій: у неї 25.12–14.01 Новий рік, решта грудня–лютого зима, інакше сакура;
// у нього взимку північне сяйво, влітку Чумацький Шлях, інакше зоряна карта. Або обраний вручну.
// Пам'ятає цей телефон; ранній скрипт в index.html ставить те саме ще до першого кадру
import { h } from './ui.js';

const KEY = 'radovalka:theme';
const MODES = [['auto', '📱', 'Как в телефоне'], ['light', '☀️', 'Светлая'], ['dark', '🌙', 'Ночная']];
const mq = matchMedia('(prefers-color-scheme: dark)');
const read = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
const PATTERNS = {
  vona: { key: 'radovalka:season', list: [['auto', '🗓️', 'По сезону'], ['spring', '🌸', 'Сакура'], ['winter', '❄️', 'Зима'], ['newyear', '🎄', 'Новый год']],
    names: { spring: 'сакура', winter: 'зима', newyear: 'Новый год' }, about: 'Зима с декабря по февраль, Новый год — с 25 декабря по 14 января' },
  vin: { key: 'radovalka:season:vin', list: [['auto', '🗓️', 'По сезону'], ['stars', '✨', 'Звёзды'], ['aurora', '🌌', 'Сияние'], ['milky', '🌠', 'Млечный Путь']],
    names: { stars: 'звёздная карта', aurora: 'северное сияние', milky: 'Млечный Путь' }, about: 'Сияние с декабря по февраль, Млечный Путь — с июня по август' },
};
const sideOf = (side) => (side === 'vin' ? 'vin' : 'vona');
const readPattern = (side) => { try { return localStorage.getItem(PATTERNS[sideOf(side)].key) || 'auto'; } catch { return 'auto'; } };
// Що дає «По сезону» сьогодні (за Києвом)
function bySeason(side) {
  const [m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', month: 'numeric', day: 'numeric' }).formatToParts(new Date())
    .filter((p) => p.type !== 'literal').map((p) => Number(p.value));
  const winter = [12, 1, 2].includes(m);
  if (sideOf(side) === 'vin') return winter ? 'aurora' : [6, 7, 8].includes(m) ? 'milky' : 'stars';
  if ((m === 12 && d >= 25) || (m === 1 && d <= 14)) return 'newyear';
  return winter ? 'winter' : 'spring';
}
const pattern = (side) => { const s = readPattern(side); return s === 'auto' ? bySeason(side) : s; };
const color = (side, dark) => (side === 'vin' ? '#0B384B' : dark ? '#2A1730' : '#EADFFB');

export function applyTheme(side = document.documentElement.dataset.side) {
  const m = read();
  const dark = side === 'vin' || m === 'dark' || (m === 'auto' && mq.matches);
  const p = pattern(side);
  const root = document.documentElement;
  root.toggleAttribute('data-dark', dark);
  root.classList.toggle('is-winter', p === 'winter' || p === 'newyear');
  root.classList.toggle('is-newyear', p === 'newyear');
  root.classList.toggle('is-aurora', p === 'aurora');
  root.classList.toggle('is-milky', p === 'milky');
  document.querySelector('meta[name="theme-color"]').content = color(side, dark);
}
mq.addEventListener?.('change', () => applyTheme());

// Рядок плиток вибору: значок над підписом, натиснута — підсвічена
function tiles(title, key, list, now, onPick) {
  const btns = list.map(([v, icon, label]) => h('button', {
    type: 'button', class: 'theme-tile', 'aria-pressed': String(v === now),
    onclick: () => {
      try { localStorage.setItem(key, v); } catch { /* приватне вікно — до закриття */ }
      applyTheme();
      btns.forEach((b, i) => b.setAttribute('aria-pressed', String(list[i][0] === v)));
      onPick?.();
    },
  }, h('span', { class: 'theme-tile-ic', 'aria-hidden': 'true' }, icon), h('span', {}, label)));
  return h('div', { class: 'theme-block' }, h('p', { class: 'about-sub' }, title),
    h('div', { class: `theme-tiles is-${list.length}`, role: 'group', 'aria-label': title }, ...btns));
}

// Блок у групі «Оформление»: у неї «Тема» й «Узор фона», у нього — лише свій узор
export function themePanel(side) {
  const P = PATTERNS[sideOf(side)];
  const note = h('p', { class: 'theme-note' });
  const paint = () => {
    note.textContent = readPattern(side) === 'auto' ? `Сейчас — ${P.names[bySeason(side)]}. ${P.about}` : 'Узор выбран вручную — «По сезону» вернёт смену по календарю';
  };
  paint();
  return h('div', { class: 'theme-panel' },
    sideOf(side) === 'vin' ? null : tiles('Тема', KEY, MODES, read()),
    tiles('Узор фона', P.key, P.list, readPattern(side), paint),
    note);
}
