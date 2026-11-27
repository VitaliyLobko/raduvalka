// Тема: у нього завжди ніч; у неї — «Как в телефоне» (за темною темою телефона), «Светлая» чи «Ночная».
// Пам'ятає цей телефон; ранній скрипт в index.html ставить те саме ще до першого кадру
import { h } from './ui.js';

const KEY = 'radovalka:theme';
const MODES = [['auto', 'Как в телефоне'], ['light', 'Светлая'], ['dark', 'Ночная']];
const mq = matchMedia('(prefers-color-scheme: dark)');
const read = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
const color = (side, dark) => (side === 'vin' ? '#0B384B' : dark ? '#2A1730' : '#EADFFB');

export function applyTheme(side = document.documentElement.dataset.side) {
  const m = read();
  const dark = side === 'vin' || m === 'dark' || (m === 'auto' && mq.matches);
  document.documentElement.toggleAttribute('data-dark', dark);
  document.querySelector('meta[name="theme-color"]').content = color(side, dark);
}
mq.addEventListener?.('change', () => applyTheme());

// Вибір у «О Радовалке» — лише на її половині
export function themePanel() {
  const now = read();
  const btns = MODES.map(([v, label]) => h('button', {
    type: 'button', class: 'mk-chip', 'aria-pressed': String(v === now),
    onclick: () => {
      try { localStorage.setItem(KEY, v); } catch { /* приватне вікно — до закриття */ }
      applyTheme();
      btns.forEach((b, i) => b.setAttribute('aria-pressed', String(MODES[i][0] === v)));
    },
  }, label));
  return h('div', {}, h('p', { class: 'about-sub' }, 'Оформление'), h('div', { class: 'text-fonts', role: 'group', 'aria-label': 'Оформление' }, ...btns));
}
