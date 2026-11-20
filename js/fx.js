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

// «💞 Люблю тебя!» побачили вперше: рядок б'ється, як серце, і з нього злітають угору сердечка, погойдуючись
const LOVE = ['💞', '❤️', '💗', '💖', '💕', '💘'];
export function loveRain(el) {
  if (reduceMotion || !el?.isConnected) return;
  el.animate([
    { transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' },
    { transform: 'scale(1.18)' }, { transform: 'scale(1)' },
  ], { duration: 950, easing: 'ease-out' });
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 16; i += 1) {
    const s = document.createElement('span');
    s.className = 'fx-burst fx-love';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = LOVE[i % LOVE.length];
    s.style.left = `${r.left + 12 + Math.random() * Math.max(40, r.width - 24)}px`;
    s.style.top = `${r.top + r.height / 2}px`;
    s.style.fontSize = `${1.1 + Math.random() * 1.1}rem`;
    document.body.append(s);
    const up = 220 + Math.random() * 260;
    const sway = (Math.random() - 0.5) * 90;
    s.animate([
      { transform: 'translate(-50%, -50%) scale(.2)', opacity: 0 },
      { transform: `translate(calc(-50% + ${sway * 0.4}px), calc(-50% - ${up * 0.25}px)) scale(1)`, opacity: 1, offset: 0.2 },
      { transform: `translate(calc(-50% - ${sway * 0.5}px), calc(-50% - ${up * 0.6}px)) scale(1.05) rotate(${sway / 6}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${sway}px), calc(-50% - ${up}px)) scale(.9) rotate(${-sway / 4}deg)`, opacity: 0 },
    ], { duration: 1700 + Math.random() * 900, delay: i * 70 + Math.random() * 120, easing: 'cubic-bezier(.25, .7, .35, 1)', fill: 'backwards' })
      .finished.finally(() => s.remove());
  }
}

