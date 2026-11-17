// Листівка «від Землі до Юпітера»: спільна для екрана «Вместе» і першого запуску
import { h, reduceMotion, sky } from './ui.js';
import { planetsSvg } from './planets.js';

// Шлях з листівки: від краю Юпітера праворуч угорі — дугою ліворуч — до краю Землі
const PATH = 'M170 110 C 100 118 36 160 42 210 S 88 250 104 268';
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.3 3 4.5 6.7 4.5c2.2 0 3.7 1.2 5.3 3 1.6-1.8 3.1-3 5.3-3 3.7 0 5.9 3.8 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';

// tags — підписи планет { jupiter, earth }; extra — що покласти в листівку зверху; phrase — їхня фраза з сервера
export function spaceCard({ tags, label, extra = [], phrase }) {
  const heart = h('span', { class: 'travel-heart', html: HEART });
  const card = h('section', { class: 'space', 'aria-label': label },
    sky(26, 7),
    h('div', { class: 'space-trail', html: `<svg class="space-path" viewBox="0 0 300 400" aria-hidden="true">${planetsSvg()}<path class="trail" d="${PATH}"/></svg>` }, heart),
    tags ? h('span', { class: 'planet-tag tag-jupiter' }, tags.jupiter) : null,
    tags ? h('span', { class: 'planet-tag tag-earth' }, tags.earth) : null,
    ...extra,
    phrase ? h('p', { class: 'phrase' }, phrase) : null);
  return { card, heart };
}

// Сердечко в точці t (0 — Юпітер, 1 — Земля) шляху
function place(card, heart, t) {
  const path = card.querySelector('.space-path .trail');
  const p = path.getPointAtLength(path.getTotalLength() * t);
  heart.style.left = `${(p.x / 300) * 100}%`;
  heart.style.top = `${(p.y / 400) * 100}%`;
}

// Сердечко летить від точки from (типово Юпітер) до progress (0…1) на шляху
export function flyHeart(card, heart, progress, { delay = 0, duration = 1400, from = 0 } = {}) {
  const id = heart.flight = (heart.flight || 0) + 1;  // нове торкання чи політ зупиняє попередній
  if (reduceMotion) { place(card, heart, progress); return; }
  place(card, heart, from);
  const start = performance.now() + delay;
  const step = (now) => {
    if (heart.flight !== id) return;
    const k = Math.min(1, Math.max(0, (now - start) / duration));
    place(card, heart, from + (progress - from) * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Сердечко тягнуть пальцем уздовж пунктиру. Донесли до планети — onPlanet('jupiter' | 'earth')
// (там згодом буде свій ролик), відпустили посередині — повертається на своє місце home.
export function dragHeart(card, heart, home, onPlanet) {
  const box = heart.parentElement;
  const path = card.querySelector('.space-path .trail');
  const len = path.getTotalLength();
  const N = 120;
  const pts = Array.from({ length: N + 1 }, (_, i) => path.getPointAtLength((len * i) / N));
  let t = home;
  let dragging = false;

  heart.classList.add('is-draggable');
  heart.addEventListener('pointerdown', (e) => {
    dragging = true;
    heart.flight = (heart.flight || 0) + 1;
    heart.setPointerCapture(e.pointerId);
    heart.classList.add('is-dragging');
  });
  heart.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const r = box.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 300;
    const y = ((e.clientY - r.top) / r.height) * 400;
    let best = 0;
    let bestD = Infinity;
    pts.forEach((p, i) => {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    t = best / N;
    place(card, heart, t);
  });
  const drop = () => {
    if (!dragging) return;
    dragging = false;
    heart.classList.remove('is-dragging');
    const planet = t <= 0.08 ? 'jupiter' : t >= 0.92 ? 'earth' : null;
    if (!planet) { flyHeart(card, heart, home, { from: t, duration: 600 }); return; }
    const end = planet === 'jupiter' ? 0 : 1;
    place(card, heart, end);
    card.classList.add(`hit-${planet}`);
    onPlanet?.(planet);
    setTimeout(() => {
      card.classList.remove(`hit-${planet}`);
      if (!dragging) flyHeart(card, heart, home, { from: end, duration: 900 });
    }, 1400);
  };
  heart.addEventListener('pointerup', drop);
  heart.addEventListener('pointercancel', drop);
}
