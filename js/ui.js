// Спільні дрібниці інтерфейсу
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.filter((c) => c != null && c !== false));
  return el;
}

const toastEl = document.getElementById('toast');
let toastTimer;
export function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-shown'), 2400);
}

export const cap = (s) => s[0].toUpperCase() + s.slice(1);

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Стрічка чипів, що гортається вбік: край, за яким ще щось є, тане — видно, що можна горнути; вибраний чип — у полі зору
export function ribbon(row) {
  row.classList.add('mk-ribbon');
  // Стрілки по краях — і для компʼютера (мишею вбік не погортаєш), і щоб на телефоні було видно, що це стрічка
  const go = (dir) => row.scrollBy({ left: dir * row.clientWidth * 0.7, behavior: reduceMotion ? 'auto' : 'smooth' });
  const back = h('button', { type: 'button', class: 'rib-arrow rib-back', 'aria-label': 'Листать назад', tabindex: '-1', onclick: () => go(-1) }, '‹');
  const next = h('button', { type: 'button', class: 'rib-arrow rib-next', 'aria-label': 'Листать дальше', tabindex: '-1', onclick: () => go(1) }, '›');
  const wrap = h('div', { class: 'rib-wrap' });
  const edges = () => {
    const end = row.scrollWidth - row.clientWidth - row.scrollLeft;
    row.classList.toggle('is-more-start', row.scrollLeft > 4);
    row.classList.toggle('is-more-end', end > 4);
    wrap.classList.toggle('is-more-start', row.scrollLeft > 4);
    wrap.classList.toggle('is-more-end', end > 4);
  };
  // Обгортка для стрілок — щойно стрічка опинилась у документі (ribbon часто кличуть до вставки)
  const mount = (n = 0) => {
    if (!row.parentNode) { if (n < 120) requestAnimationFrame(() => mount(n + 1)); return; }
    if (!row.parentNode.classList?.contains('rib-wrap')) { row.replaceWith(wrap); wrap.append(back, row, next); }
    edges();
  };
  mount();
  row.addEventListener('scroll', edges, { passive: true });
  // Компʼютер: коліщатко миші гортає стрічку вбік, поки є куди; на краю — сторінку як завжди
  row.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const max = row.scrollWidth - row.clientWidth;
    if (max <= 0 || (e.deltaY < 0 && row.scrollLeft <= 0) || (e.deltaY > 0 && row.scrollLeft >= max - 1)) return;
    e.preventDefault();
    row.scrollLeft += e.deltaY;
  }, { passive: false });
  // Компʼютер: потягнути мишею; після перетягування клік по чипу не спрацьовує
  let drag = null;
  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: row.scrollLeft, moved: false };
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    drag.moved = true;
    row.classList.add('is-dragging');
    row.scrollLeft = drag.left - dx;
  });
  addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.moved) row.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true });
    setTimeout(() => row.classList.remove('is-dragging'));
    drag = null;
  });
  row.addEventListener('click', (e) => e.target.closest('.mk-chip')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' }));
  new ResizeObserver(edges).observe(row);
  // Чипи підмінили (нові варіанти від ШІ) — ширина вмісту інша
  new MutationObserver(() => requestAnimationFrame(edges)).observe(row, { childList: true });
}

// Стріла Стрільця — малюнком, бо символ ♐ телефони показують емодзі
export const SAGITTARIUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19 19 5"/><path d="M11 5h8v8"/><path d="M7 11l6 6"/></svg>`;

// Сургучна печатка: оплилий нерівний край, вдавлене кільце відбитка, видавлений знак і відблиск
const BLOB = (() => {
  const r = [45, 47.5, 44, 46.5, 48, 44.5, 46, 47, 43.5, 46.5, 48.5, 45, 44, 47];
  const pts = r.map((v, i) => {
    const a = (i / r.length) * Math.PI * 2;
    return [50 + v * Math.cos(a), 50 + v * Math.sin(a)];
  });
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const f = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  let d = `M${f(mid(pts.at(-1), pts[0]))}`;
  pts.forEach((p, i) => { d += `Q${f(p)} ${f(mid(p, pts[(i + 1) % pts.length]))}`; });
  return `${d}Z`;
})();

let sealN = 0;
// glyph — вміст viewBox 0 0 24 24 (лише path), його «вдавлюємо» в центр
export function waxSeal(glyph) {
  const n = (sealN += 1);
  return `<svg class="wax" viewBox="0 0 100 100" aria-hidden="true">
<defs>
<radialGradient id="wx${n}" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#d77aac"/><stop offset=".45" stop-color="#a8417d"/><stop offset="1" stop-color="#6a2149"/></radialGradient>
<radialGradient id="wi${n}" cx="60%" cy="65%" r="70%"><stop offset="0" stop-color="#a8417d"/><stop offset="1" stop-color="#7d2c5c"/></radialGradient>
</defs>
<path d="${BLOB}" fill="url(#wx${n})"/>
<circle cx="50" cy="50" r="30" fill="url(#wi${n})"/>
<circle cx="50" cy="50" r="30" fill="none" stroke="#5a1b3e" stroke-width="2.4" stroke-opacity=".55"/>
<circle cx="50.8" cy="51.2" r="31.6" fill="none" stroke="#f3bfdc" stroke-width="1.2" stroke-opacity=".45"/>
<g fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(32 32) scale(1.5)">
<g transform="translate(.45 .55)" stroke="#f6c9e1" stroke-opacity=".55" stroke-width="2.2">${glyph}</g>
<g stroke="#521637" stroke-width="2.2">${glyph}</g>
</g>
<ellipse cx="35" cy="27" rx="13" ry="6.5" transform="rotate(-28 35 27)" fill="#fff" fill-opacity=".22"/>
</svg>`;
}

// Підпис під листом другого: свій, якщо його задано на сервері (signs), інакше «Твой/Твоя» і стрілець
export const signLine = (sign, from) => (sign
  ? h('p', { class: 'letter-sign' }, sign)
  : h('p', { class: 'letter-sign', html: `${from} <span class="sign-arrow">${SAGITTARIUS}</span>` }));

// Кишеня великого конверта (лист дня, «Открой, когда…»): бокові й нижній клини
export const ENV_POCKET = `<svg viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><path class="pocket" d="M0 2 150 106 300 2V200H0z"/><path class="pocket-fold" d="M0 200 130 116M300 200 170 116"/></svg>`;

export const SAGITTARIUS_GLYPH = '<path d="M5 19 19 5"/><path d="M11 5h8v8"/><path d="M7 11l6 6"/>';

export const ARROW = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 19 5"/><path d="M12 5h7v7"/><path d="M4 20l1.5-4.5M4 20l4.5-1.5"/></svg>`;

// Фото на весь екран: тап будь-де, ✕ чи Esc — закрити
export function showPhoto(src, alt = 'Фото') {
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'photo-view', role: 'dialog', 'aria-modal': 'true', 'aria-label': alt, onclick: close },
    h('img', { src, alt }),
    h('button', { type: 'button', class: 'photo-view-close', 'aria-label': 'Закрыть' }, '✕'));
  document.addEventListener('keydown', onKey);
  document.body.append(box);
  box.querySelector('button').focus();
}

// Зоряне небо справжніми елементами: кожна зірка мерехтить у своєму ритмі.
// SVG-плиткою у фоні того ж не досягти — однакові зірки сусідніх плиток гаснуть разом.
const STAR = '<svg viewBox="-6 -6 12 12"><path d="M0-6l1.5 4.5L6 0 1.5 1.5 0 6-1.5 1.5-6 0-1.5-1.5z"/></svg>';
const DOT = '<svg viewBox="-6 -6 12 12"><circle r="6"/></svg>';
export function sky(count, seed = 1, cls = '') {
  // Сталий генератор: та сама картка — те саме небо, без стрибків при перемальовуванні
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const box = h('div', { class: `sky ${cls}`.trim(), 'aria-hidden': 'true' });
  for (let i = 0; i < count; i++) {
    const big = rnd() < 0.35;
    const size = big ? 7 + rnd() * 8 : 2 + rnd() * 2.5;
    const star = h('i', { html: big ? STAR : DOT });
    star.style.cssText = `left:${(rnd() * 100).toFixed(2)}%;top:${(rnd() * 100).toFixed(2)}%;`
      + `width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;`
      + `--lo:${(0.1 + rnd() * 0.45).toFixed(2)};animation-duration:${(3 + rnd() * 6).toFixed(2)}s;`
      + `animation-delay:${(-rnd() * 9).toFixed(2)}s`;
    box.append(star);
  }
  return box;
}
