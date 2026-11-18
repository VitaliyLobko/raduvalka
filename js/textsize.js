// Розмір букв у листах чату — у кожного свій, пам'ятає цей телефон
import { h } from './ui.js';

const KEY = 'radovalka:text-size';
// k — множник до розміру рукописного тексту в чаті (19px); за замовчуванням трохи більший — Caveat вузький
const SIZES = [
  { v: 's', label: 'Как было', k: 1 },
  { v: 'm', label: 'Крупнее', k: 1.12 },
  { v: 'l', label: 'Ещё крупнее', k: 1.28 },
];
const read = () => { try { return localStorage.getItem(KEY) || 'm'; } catch { return 'm'; } };

export function applyTextSize(v = read()) {
  const size = SIZES.find((x) => x.v === v) || SIZES[1];
  document.documentElement.style.setProperty('--msg-k', String(size.k));
}

// Блок у «О Радовалке»: три розміри й зразок, який міняється одразу
export function textSizePanel() {
  let picked = read();
  const row = h('div', { class: 'mk-chips text-size-row', role: 'radiogroup', 'aria-label': 'Размер букв в письмах' });
  const paint = () => row.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === picked)));
  SIZES.forEach(({ v, label }) => row.append(h('button', {
    type: 'button', role: 'radio', class: 'mk-chip', 'data-v': v,
    onclick: () => {
      picked = v;
      try { localStorage.setItem(KEY, v); } catch { /* приватне вікно — до закриття */ }
      applyTextSize(v);
      paint();
    },
  }, label)));
  paint();
  return h('div', { class: 'text-size' },
    h('h3', {}, 'Размер букв в письмах'),
    row,
    h('p', { class: 'text-size-sample' }, 'Скучаю по тебе. Считаю дни до встречи 💗'));
}
