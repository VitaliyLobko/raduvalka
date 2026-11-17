// Підказки до свайпів: поки людина жодного разу не змахнула в цьому місці — рядок-підказка й одне
// «похитування» першої картки за сеанс. Після першого справжнього змаху — більше не показуємо
import { reduceMotion } from './ui.js';

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

// steps — кроки руху (функції), по одному на ~0,6 с; el зник з екрана — зупиняємось
export function nudge(place, el, steps) {
  if (!el || reduceMotion || learned(place) || nudged.has(place)) return;
  pending.set(place, el);
  let i = 0;
  const tick = () => {
    if (!el.isConnected || i >= steps.length) return;
    if (i === 0) {
      // Перемалювали — хитаємо нову картку, не цю
      if (pending.get(place) !== el || nudged.has(place)) return;
      nudged.add(place);
    }
    steps[i++]();
    setTimeout(tick, 600);
  };
  setTimeout(tick, 900);
}
