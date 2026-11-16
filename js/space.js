// Листівка «від Землі до Юпітера»: спільна для екрана «Вместе» і першого запуску
import { h, reduceMotion } from './ui.js';
import { planetsSvg } from './planets.js';

// Шлях з листівки: від краю Юпітера праворуч угорі — дугою ліворуч — до краю Землі
const PATH = 'M170 110 C 100 118 36 160 42 210 S 88 250 104 268';
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.3 3 4.5 6.7 4.5c2.2 0 3.7 1.2 5.3 3 1.6-1.8 3.1-3 5.3-3 3.7 0 5.9 3.8 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';

// tags — підписи планет { jupiter, earth }; extra — що покласти в листівку зверху; phrase — їхня фраза з сервера
export function spaceCard({ tags, label, extra = [], phrase }) {
  const heart = h('span', { class: 'travel-heart', html: HEART });
  const card = h('section', { class: 'space', 'aria-label': label },
    h('div', { class: 'space-trail', html: `<svg class="space-path" viewBox="0 0 300 400" aria-hidden="true">${planetsSvg()}<path class="trail" d="${PATH}"/></svg>` }, heart),
    tags ? h('span', { class: 'planet-tag tag-jupiter' }, tags.jupiter) : null,
    tags ? h('span', { class: 'planet-tag tag-earth' }, tags.earth) : null,
    ...extra,
    phrase ? h('p', { class: 'phrase' }, phrase) : null);
  return { card, heart };
}

// Сердечко летить від Юпітера до точки progress (0…1) на шляху
export function flyHeart(card, heart, progress, { delay = 0, duration = 1400 } = {}) {
  const path = card.querySelector('.space-path .trail');
  const len = path.getTotalLength();
  const put = (t) => {
    const p = path.getPointAtLength(len * t);
    heart.style.left = `${(p.x / 300) * 100}%`;
    heart.style.top = `${(p.y / 400) * 100}%`;
  };
  if (reduceMotion) { put(progress); return; }
  put(0);
  const start = performance.now() + delay;
  const step = (now) => {
    const k = Math.min(1, Math.max(0, (now - start) / duration));
    put(progress * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
