// Розмір букв у листах чату — у кожного свій, пам'ятає цей телефон
import { h } from './ui.js';

const KEY = 'radovalka:text-size';
// Пікселі рукописного тексту в чаті; база стилів — 19px (--msg-k = px / 19). За замовчуванням трохи більший — Caveat вузький
const BASE = 19;
const MIN = 17;
const MAX = 30;
const DEF = 21;
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

// Блок у «О Радовалке»: повзунок від дрібного до дуже крупного, зразок листа міняється одразу.
// Заголовок дає група «О Радовалке»
export function textSizePanel() {
  const px = read();
  const value = h('span', { class: 'text-size-px' }, `${px} px`);
  const range = h('input', {
    type: 'range', class: 'text-size-range', min: String(MIN), max: String(MAX), step: '1', value: String(px),
    'aria-label': 'Размер букв в письмах', 'aria-valuetext': `${px} пикселей`,
    oninput: (e) => {
      const n = clamp(Number(e.target.value));
      applyTextSize(n);
      value.textContent = `${n} px`;
      e.target.setAttribute('aria-valuetext', `${n} пикселей`);
      try { localStorage.setItem(KEY, String(n)); } catch { /* приватне вікно — до закриття */ }
    },
  });
  return h('div', { class: 'text-size' },
    h('div', { class: 'text-size-row' },
      h('span', { class: 'text-size-a is-small', 'aria-hidden': 'true' }, 'А'),
      range,
      h('span', { class: 'text-size-a is-big', 'aria-hidden': 'true' }, 'А'),
      value),
    h('p', { class: 'text-size-sample' }, 'Скучаю по тебе. Считаю дни до встречи 💗'));
}
