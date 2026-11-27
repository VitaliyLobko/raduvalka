// Розіграш «Поменяться темами»: до «Вернуть», але не довше доби, вона бачить його космос, а він — її узор.
// Міняється лише вигляд (атрибут data-side на <html>), тексти, листи й кнопки в кожного свої.
// Стан — на сервері (doc swap): другий дізнається, щойно відкриє Радовалку. Мітку телефон кешує, щоб ранній
// скрипт index.html одразу ставив обмінений вигляд і тема не блимала своєю при старті
import { DATA } from './data.js';
import { send } from './api.js';
import { applyTheme } from './theme.js';
import { h, toast } from './ui.js';

const KEY = 'radovalka:swap';
const SEEN = 'radovalka:swap-seen';
const DAY = 864e5;
let at = 0;
let timer = 0;
const store = (k, v) => { try { if (v) localStorage.setItem(k, String(v)); else localStorage.removeItem(k); } catch { /* приватне вікно */ } };
const seen = () => { try { return Number(localStorage.getItem(SEEN)) || 0; } catch { return 0; } };

export const isSwapped = () => at > 0 && Date.now() - at < DAY;
const look = () => (isSwapped() ? (DATA.side === 'vin' ? 'vona' : 'vin') : DATA.side);

function paint() {
  const side = look();
  document.documentElement.dataset.side = side;
  applyTheme(side);
  document.dispatchEvent(new CustomEvent('radovalka:swap'));
}

// s — { at, by } із boot чи pulse (null — обміну нема). Тост — лише раз на кожен обмін і на повернення
export function setSwap(s) {
  const next = s?.at && Date.now() - s.at < DAY ? s.at : 0;
  const was = isSwapped();
  at = next;
  store(KEY, at);
  clearTimeout(timer);
  // Доба минула, поки Радовалка відкрита, — повертаємо самі
  if (at) timer = setTimeout(() => setSwap(null), at + DAY - Date.now() + 500);
  paint();
  if (isSwapped() && seen() !== at) {
    store(SEEN, at);
    toast('Темы поменялись местами 😄', { label: 'Вернуть', run: () => toggleSwap(false) });
  } else if (was && !isSwapped()) toast('Темы вернулись на место');
}

export async function toggleSwap(on) {
  try {
    const r = await send('swap', 'POST', { on });
    if (on && r.swap?.at) store(SEEN, 0);
    setSwap(r.swap);
  } catch {
    toast('Не получилось — нет связи');
  }
}

// Рядок у «Оформлении»: поміняти — або, поки обмін діє, повернути
export function swapRow() {
  const btn = h('button', { type: 'button', class: 'about-row' });
  const draw = () => btn.replaceChildren(
    h('span', { class: 'about-row-ic', 'aria-hidden': 'true' }, '🔄'),
    h('span', { class: 'about-row-label' }, isSwapped() ? 'Вернуть темы' : 'Поменяться темами',
      h('small', {}, isSwapped() ? 'Сейчас у каждого тема другого' : 'В шутку: тема другого у обоих, на сутки')),
    h('span', { class: 'about-row-go', 'aria-hidden': 'true' }, '›'));
  btn.addEventListener('click', () => toggleSwap(!isSwapped()));
  const onSwap = () => (btn.isConnected ? draw() : document.removeEventListener('radovalka:swap', onSwap));
  document.addEventListener('radovalka:swap', onSwap);
  draw();
  return btn;
}
