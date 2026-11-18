// Розмір букв у листах чату — у кожного свій, пам'ятає цей телефон
import { h } from './ui.js';

const KEY = 'radovalka:text-size';
// Пікселі рукописного тексту в чаті; база стилів — 19px (--msg-k = px / 19). За замовчуванням трохи більший — Caveat вузький
const BASE = 19;
const MIN = 17;
const MAX = 30;
const DEF = 21;
// Засічки під повзунком: тап ставить розмір; «средне» — стандарт, ним і повертаються
const MARKS = [[17, 'мелко'], [DEF, 'средне'], [25, 'крупно'], [MAX, 'очень крупно']];
// Колись було три кнопки — збережене тоді перекладаємо в пікселі
const OLD = { s: 19, m: 21, l: 24 };
const clamp = (n) => Math.min(MAX, Math.max(MIN, Math.round(n)));
const read = () => {
  let v = null;
  try { v = localStorage.getItem(KEY); } catch { /* приватне вікно */ }
  if (v in OLD) return OLD[v];
  return Number(v) ? clamp(Number(v)) : DEF;
};

export function applyTextSize(px = read()) {
  document.documentElement.style.setProperty('--msg-k', String(px / BASE));
}

// Блок у «О Радовалке»: повзунок від дрібного до дуже крупного з засічками, зразок листа міняється одразу.
// Заголовок дає група «О Радовалке»
export function textSizePanel() {
  const value = h('span', { class: 'text-size-px' });
  const range = h('input', {
    type: 'range', class: 'text-size-range', min: String(MIN), max: String(MAX), step: '1',
    'aria-label': 'Размер букв в письмах', oninput: (e) => pick(Number(e.target.value)),
  });
  const marks = MARKS.map(([px, label]) => h('button', {
    type: 'button', class: 'text-size-mark', 'data-px': String(px),
    style: `--at: ${(px - MIN) / (MAX - MIN)}`,
    'aria-label': `${label}${px === DEF ? ', стандарт' : ''}: ${px} пикселей`,
    onclick: () => pick(px),
  }, label, px === DEF ? h('small', {}, 'стандарт') : null));
  function pick(n, save = true) {
    const px = clamp(n);
    applyTextSize(px);
    range.value = String(px);
    range.setAttribute('aria-valuetext', `${px} пикселей${px === DEF ? ', стандарт' : ''}`);
    value.textContent = `${px} px`;
    marks.forEach((m) => m.setAttribute('aria-pressed', String(Number(m.dataset.px) === px)));
    if (save) { try { localStorage.setItem(KEY, String(px)); } catch { /* приватне вікно — до закриття */ } }
  }
  pick(read(), false);
  return h('div', { class: 'text-size' },
    h('div', { class: 'text-size-row' },
      h('span', { class: 'text-size-a is-small', 'aria-hidden': 'true' }, 'А'),
      h('div', { class: 'text-size-track' }, range, h('div', { class: 'text-size-marks' }, ...marks)),
      h('span', { class: 'text-size-a is-big', 'aria-hidden': 'true' }, 'А'),
      value),
    h('p', { class: 'text-size-sample' }, 'Скучаю по тебе. Считаю дни до встречи 💗'));
}
