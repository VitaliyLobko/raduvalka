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

// Ролики планет, коли сердечко долетіло (координати — з planets.js, viewBox 300×400):
// Юпітер — золоте сяйво по краю й серце на широті Великої червоної плями (смуги з плямою пливуть, тож — по центру);
// Земля — розпускається сакура, пелюстки розлітаються. Тимчасові елементи в SVG листівки, через 2 с — геть
const NS = 'http://www.w3.org/2000/svg';
const HEART_D = 'M0 3.2C-2.4.6-6.4-1.2-6.4-4.6-6.4-7.2-3.2-8.4 0-5.6 3.2-8.4 6.4-7.2 6.4-4.6 6.4-1.2 2.4.6 0 3.2Z';
export function planetFx(card, planet) {
  if (reduceMotion) return;
  const svg = card.querySelector('.space-path');
  if (!svg) return;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', `fx-${planet}`);
  g.setAttribute('aria-hidden', 'true');
  if (planet === 'jupiter') {
    g.innerHTML = '<circle class="fx-glow" cx="222" cy="84" r="59"/>'
      + `<g transform="translate(236 106)"><path class="fx-spot-heart" d="${HEART_D}"/></g>`;
  } else {
    const petals = [0, 72, 144, 216, 288].map((a) => `<ellipse rx="7" ry="13" cy="-14" transform="rotate(${a})"/>`).join('');
    const flying = [[-70, -60], [40, -80], [75, -20], [-80, 10], [10, -110], [-30, -95]]
      .map(([x, y], i) => `<path class="fx-petal" style="--x:${x}px;--y:${y}px;animation-delay:${0.25 + i * 0.04}s" d="M0 0c5-8 13-8 13 0s-8 8-13 0z"/>`).join('');
    g.innerHTML = `<g transform="translate(78 300)"><g class="fx-bloom">${petals}<circle r="5" class="fx-bloom-core"/></g>${flying}</g>`;
  }
  svg.append(g);
  setTimeout(() => g.remove(), 2200);
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
    planetFx(card, planet);
    onPlanet?.(planet);
    setTimeout(() => {
      card.classList.remove(`hit-${planet}`);
      if (!dragging) flyHeart(card, heart, home, { from: end, duration: 900 });
    }, 1400);
  };
  heart.addEventListener('pointerup', drop);
  heart.addEventListener('pointercancel', drop);
}
