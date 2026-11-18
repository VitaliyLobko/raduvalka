// Маленькі анімації на відповідь людині: сердечка, виліт картки, згортання рядка.
// Web Animations API — без класів у CSS для кожного руху; «менше руху» в телефоні — нічого не рухаємо
import { reduceMotion } from './ui.js';

// Сердечка (чи інший значок) розлітаються з середини елемента
export function burst(el, glyph = '❤️', n = 9) {
  if (reduceMotion || !el?.isConnected) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < n; i += 1) {
    const s = document.createElement('span');
    s.className = 'fx-burst';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = glyph;
    s.style.left = `${r.left + r.width / 2}px`;
    s.style.top = `${r.top + r.height / 2}px`;
    document.body.append(s);
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
    const d = 70 + Math.random() * 70;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d - 50;
    s.animate([
      { transform: 'translate(-50%, -50%) scale(.3)', opacity: 1 },
      { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${1 + Math.random() * 0.7}) rotate(${(Math.random() - 0.5) * 70}deg)`, opacity: 0 },
    ], { duration: 750 + Math.random() * 350, easing: 'cubic-bezier(.2, .8, .3, 1)' })
      .finished.finally(() => s.remove());
  }
}

// Виліт за край: з того місця, де картку відпустили (from — її поточний transform)
export function flyOut(el, dir = -1, from = '') {
  if (reduceMotion || !el?.isConnected) return Promise.resolve();
  return el.animate([
    { transform: from || 'none', opacity: 1 },
    { transform: `translateX(${dir * 115}%) rotate(${dir * 10}deg)`, opacity: 0 },
  ], { duration: 230, easing: 'cubic-bezier(.4, 0, .9, .6)', fill: 'forwards' }).finished.catch(() => {});
}

// Рядок плавно згортається, а не зникає ривком
export function collapse(el) {
  if (reduceMotion || !el?.isConnected) return Promise.resolve();
  el.style.overflow = 'hidden';
  return el.animate([
    { height: `${el.offsetHeight}px` },
    { height: '0px', marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' },
  ], { duration: 200, easing: 'ease-in-out', fill: 'forwards' }).finished.catch(() => {});
}

// Відправка: конверт летить стрілою Стрільця дугою за правий верхній край (from — прямокутник кнопки)
const ARROW_FLY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19 19 5"/><path d="M11 5h8v8"/><path d="M7 11l6 6"/></svg>';
export function arrowFly(from) {
  if (reduceMotion || !from) return;
  const s = document.createElement('span');
  s.className = 'fx-arrow';
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<span class="fx-env">💌</span>${ARROW_FLY}`;
  s.style.left = `${from.left + from.width / 2}px`;
  s.style.top = `${from.top + from.height / 2}px`;
  document.body.append(s);
  const dx = innerWidth - from.left + 60;
  const dy = -(from.top + 120);
  s.animate([
    { transform: 'translate(-50%, -50%) scale(.6) rotate(0deg)', opacity: 0 },
    { transform: 'translate(-50%, -50%) scale(1.1) rotate(-8deg)', opacity: 1, offset: 0.15 },
    { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.25 - 40}px)) scale(1) rotate(-20deg)`, offset: 0.55 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7) rotate(-35deg)`, opacity: 0.2 },
  ], { duration: 1100, easing: 'cubic-bezier(.4, 0, .6, 1)' }).finished.finally(() => s.remove());
}

// Хвиля від елемента (серце «Я в порядке»)
export function ripple(el, color = 'rgba(232, 71, 60, .45)') {
  if (reduceMotion || !el?.isConnected) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 2; i += 1) {
    const s = document.createElement('span');
    s.className = 'fx-ripple';
    s.setAttribute('aria-hidden', 'true');
    const size = Math.max(r.width, r.height);
    Object.assign(s.style, { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, width: `${size}px`, height: `${size}px`, borderColor: color });
    document.body.append(s);
    s.animate([{ transform: 'translate(-50%, -50%) scale(.6)', opacity: 0.9 }, { transform: 'translate(-50%, -50%) scale(2.6)', opacity: 0 }],
      { duration: 900, delay: i * 220, easing: 'cubic-bezier(.2, .7, .3, 1)' }).finished.finally(() => s.remove());
  }
}

// Новий лист у чаті: улюбленець-курʼєр підбігає збоку до рядка й зникає (html — мордочка)
export function petRun(row, html) {
  if (reduceMotion || !row?.isConnected || !html) return;
  const r = row.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'fx-pet';
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = html;
  s.style.top = `${r.top + r.height / 2}px`;
  document.body.append(s);
  s.animate([
    { transform: 'translate(-110%, -50%) rotate(-8deg)', opacity: 0 },
    { transform: `translate(${Math.max(8, r.left - 40)}px, -50%) rotate(4deg)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${Math.max(8, r.left - 40)}px, -62%) rotate(-4deg)`, opacity: 1, offset: 0.65 },
    { transform: `translate(${Math.max(8, r.left - 40)}px, -50%) scale(.6)`, opacity: 0 },
  ], { duration: 1500, easing: 'ease-out' }).finished.finally(() => s.remove());
}
