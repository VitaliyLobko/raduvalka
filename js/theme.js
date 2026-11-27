// Тема: у нього завжди ніч; у неї — «Как в телефоне» (за темною темою телефона), «Светлая» чи «Ночная».
// Узор її фону: «По сезону» (25.12–14.01 — Новий рік, решта грудня–лютого — зима, інакше сакура) або обраний.
// Пам'ятає цей телефон; ранній скрипт в index.html ставить те саме ще до першого кадру
import { h } from './ui.js';

const KEY = 'radovalka:theme';
const MODES = [['auto', '📱', 'Как в телефоне'], ['light', '☀️', 'Светлая'], ['dark', '🌙', 'Ночная']];
const mq = matchMedia('(prefers-color-scheme: dark)');
const read = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
const SEASON = 'radovalka:season';
const SEASONS = [['auto', '🗓️', 'По сезону'], ['spring', '🌸', 'Сакура'], ['winter', '❄️', 'Зима'], ['newyear', '🎄', 'Новый год']];
const NAMES = { spring: 'сакура', winter: 'зима', newyear: 'Новый год' };
const readSeason = () => { try { return localStorage.getItem(SEASON) || 'auto'; } catch { return 'auto'; } };
// Що дає «По сезону» сьогодні (за Києвом)
function bySeason() {
  const [m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', month: 'numeric', day: 'numeric' }).formatToParts(new Date())
    .filter((p) => p.type !== 'literal').map((p) => Number(p.value));
  if ((m === 12 && d >= 25) || (m === 1 && d <= 14)) return 'newyear';
  return [12, 1, 2].includes(m) ? 'winter' : 'spring';
}
export const season = () => { const s = readSeason(); return s === 'auto' ? bySeason() : s; };
const color = (side, dark) => (side === 'vin' ? '#0B384B' : dark ? '#2A1730' : '#EADFFB');

export function applyTheme(side = document.documentElement.dataset.side) {
  const m = read();
  const dark = side === 'vin' || m === 'dark' || (m === 'auto' && mq.matches);
  const s = season();
  const root = document.documentElement;
  root.toggleAttribute('data-dark', dark);
  root.classList.toggle('is-winter', s === 'winter' || s === 'newyear');
  root.classList.toggle('is-newyear', s === 'newyear');
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

// Її блок «Тема» і «Узор» у групі «Оформление»
export function themePanel() {
  const note = h('p', { class: 'theme-note' });
  const paint = () => {
    note.textContent = readSeason() === 'auto' ? `Сейчас — ${NAMES[bySeason()]}. Зима с декабря по февраль, Новый год — с 25 декабря по 14 января` : 'Узор выбран вручную — «По сезону» вернёт смену по календарю';
  };
  paint();
  return h('div', { class: 'theme-panel' },
    tiles('Тема', KEY, MODES, read()),
    tiles('Узор фона', SEASON, SEASONS, readSeason(), paint),
    note);
}
