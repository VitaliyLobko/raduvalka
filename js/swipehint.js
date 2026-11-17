// Підказки до свайпів: поки людина жодного разу не змахнула в цьому місці — рядок-підказка й одне
// «похитування» першої картки за сеанс. Після першого справжнього змаху — більше не показуємо
import { h, reduceMotion } from './ui.js';

const key = (place) => `radovalka:swiped:${place}`;
// Уже хитнули за сеанс; pending — остання картка, яку хитатимемо (екран міг перемалюватися до старту)
const nudged = new Set();
const pending = new Map();

export function learned(place) {
  try { return localStorage.getItem(key(place)) === '1'; } catch { return false; }
}

export function learn(place) {
  try { localStorage.setItem(key(place), '1'); } catch { /* приватне вікно — підказка лишиться */ }
}

// Плашка-підказка: ліворуч — що буде від змаху вліво, пальчик посередині, праворуч — вправо.
// right = null — змах лише вліво, тоді пальчик ходить тільки туди; tap — підпис праворуч без стрілки
export function hintBar(cls, left, right, tap = null) {
  return h('p', { class: `swipe-hint ${cls}`, role: 'note' },
    h('span', { class: 'swipe-hint-l' }, `← ${left}`),
    h('span', { class: `swipe-hint-hand${right ? '' : ' is-left'}`, 'aria-hidden': 'true' }, '👆'),
    right ? h('span', { class: 'swipe-hint-r' }, `${right} →`) : null,
    tap ? h('span', { class: 'swipe-hint-tap' }, tap) : null);
}

// steps — кроки руху (функції), по одному на ~0,6 с; el зник з екрана — зупиняємось
export function nudge(place, el, steps) {
  if (!el || reduceMotion || learned(place) || nudged.has(place)) return;
  pending.set(place, el);
  let i = 0;
  const tick = () => {
    if (!el.isConnected || i >= steps.length) return;
    if (i === 0) {
      // Поки йде знайомство, картку під ним не видно — чекаємо, доки його закриють
      if (document.querySelector('.tour')) { setTimeout(tick, 800); return; }
      // Перемалювали — хитаємо нову картку, не цю
      if (pending.get(place) !== el || nudged.has(place)) return;
      nudged.add(place);
    }
    steps[i++]();
    setTimeout(tick, 600);
  };
  setTimeout(tick, 900);
}
