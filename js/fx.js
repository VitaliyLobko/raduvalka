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

// «🫡 Да, капитан!» побачили вперше: згори на рядок падає піратська треуголка, рядок віддає честь,
// по екрану пропливає хвиля з якорем
const TRICORN = '<svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true">'
  + '<ellipse cx="32" cy="13" rx="15" ry="10" fill="#1c1a22"/>'
  + '<path d="M3 25 Q13 5 32 11 Q51 5 61 25 Q46 19 32 32 Q18 19 3 25 Z" fill="#24212b" stroke="#e8b84a" stroke-width="2.4" stroke-linejoin="round"/>'
  + '<circle cx="32" cy="19" r="3.6" fill="#fff"/>'
  + '<path d="M27.5 23.5l9-4M27.5 19.5l9 4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'
  + '<circle cx="30.7" cy="18.6" r=".9" fill="#24212b"/><circle cx="33.3" cy="18.6" r=".9" fill="#24212b"/>'
  + '</svg>';
export function captainSalute(el) {
  if (reduceMotion || !el?.isConnected) return;
  const r = el.getBoundingClientRect();
  const text = el.querySelector('.feed-captain-text') || el;
  text.animate([
    { transform: 'rotate(0)' }, { transform: 'rotate(-8deg) scale(1.15)' }, { transform: 'rotate(4deg) scale(1.1)' }, { transform: 'rotate(0)' },
  ], { duration: 700, delay: 650, easing: 'ease-out' });
  const cap = document.createElement('span');
  cap.className = 'fx-burst fx-cap fx-cap-big';
  cap.setAttribute('aria-hidden', 'true');
  cap.innerHTML = TRICORN;
  const tr = text.getBoundingClientRect();
  cap.style.left = `${tr.left - 10}px`;
  cap.style.top = `${tr.top - 58}px`;
  document.body.append(cap);
  cap.animate([
    { transform: `translateY(${-tr.top - 80}px) rotate(-40deg)`, opacity: 1 },
    { transform: 'translateY(0) rotate(-14deg)', offset: 0.42 },
    { transform: 'translateY(-14px) rotate(-6deg)', offset: 0.55 },
    { transform: 'translateY(0) rotate(-12deg)', offset: 0.68 },
    { transform: 'translateY(0) rotate(-12deg)', opacity: 1, offset: 0.88 },
    { transform: 'translateY(-24px) rotate(-12deg)', opacity: 0 },
  ], { duration: 2600, easing: 'cubic-bezier(.3, .7, .4, 1)' }).finished.finally(() => cap.remove());
  const wave = ['🌊', '🌊', '⚓', '🌊', '⛵', '🌊', '🌊'];
  const y = r.top + r.height / 2 + 26;
  wave.forEach((g, i) => {
    const s = document.createElement('span');
    s.className = 'fx-burst fx-wave';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = g;
    s.style.left = '0px';
    s.style.top = `${y}px`;
    document.body.append(s);
    const bob = g === '🌊' ? 6 : 10;
    s.animate([
      { transform: `translate(-60px, 0) rotate(0)`, opacity: 0 },
      { transform: `translate(${innerWidth * 0.3}px, ${-bob}px) rotate(-6deg)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${innerWidth * 0.65}px, ${bob}px) rotate(6deg)`, opacity: 1, offset: 0.7 },
      { transform: `translate(${innerWidth + 40}px, 0) rotate(0)`, opacity: 0 },
    ], { duration: 2400, delay: 700 + i * 110, easing: 'linear', fill: 'backwards' }).finished.finally(() => s.remove());
  });
}

// ── Реакції: у кожного смайлика своя велика анімація над повідомленням ─────────────
// Тому, хто ставить, — одразу; тому, кому поставили, — раз, при першому погляді (feed.js, reactIo)
function glyphAt(text, x, y, size, cls = '') {
  const s = document.createElement('span');
  s.className = `fx-burst fx-react${cls ? ` ${cls}` : ''}`;
  s.setAttribute('aria-hidden', 'true');
  s.textContent = text;
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  s.style.fontSize = size;
  document.body.append(s);
  return s;
}
const gone = (s) => (a) => a.finished.finally(() => s.remove());
const C = 'translate(-50%, -50%)';

// Розліт дрібних значків з точки: glyphs по колу (або в секторі from..to, градуси), dist — як далеко
function spray(x, y, glyphs, n, { dist = 120, size = '1.8rem', delay = 0, from = 0, to = 360, fall = 40, dur = 1000 } = {}) {
  for (let i = 0; i < n; i += 1) {
    const s = glyphAt(glyphs[i % glyphs.length], x, y, size);
    const a = ((from + ((to - from) * (i + Math.random() * 0.6)) / n) * Math.PI) / 180;
    const d = dist * (0.6 + Math.random() * 0.5);
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    gone(s)(s.animate([
      { transform: `${C} scale(.3)`, opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${dy * 0.6}px)) scale(1.1)`, opacity: 1, offset: 0.35 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + fall}px)) scale(.8) rotate(${(Math.random() - 0.5) * 80}deg)`, opacity: 0 },
    ], { duration: dur + Math.random() * 300, delay: delay + i * 25, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'backwards' }));
  }
}

// Великий смайлик у центрі повідомлення: frames — власний рух (поверх translate(-50%,-50%))
function big(glyph, x, y, frames, dur, size = '5rem') {
  const s = glyphAt(glyph, x, y, size, 'fx-big');
  gone(s)(s.animate(frames.map((f) => ({ ...f, transform: `${C} ${f.transform || ''}` })), { duration: dur, easing: 'ease-out', fill: 'forwards' }));
  return s;
}
const shake = (el, frames, dur) => el?.isConnected && el.animate(frames, { duration: dur, easing: 'ease-in-out' });

const REACT_FX = {
  // Велике серце двічі бʼється й розсипається на сердечка
  '❤️': (el, x, y) => {
    big('❤️', x, y, [
      { transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.25)', opacity: 1, offset: 0.18 },
      { transform: 'scale(.95)', offset: 0.32 }, { transform: 'scale(1.2)', offset: 0.46 }, { transform: 'scale(1)', offset: 0.6 },
      { transform: 'scale(1)', opacity: 1, offset: 0.78 }, { transform: 'scale(1.6)', opacity: 0 },
    ], 1500);
    spray(x, y, ['💗', '💖', '❤️', '💕'], 14, { dist: 150, size: '1.7rem', delay: 1150 });
  },
  // Закоханий смайлик, довкола кільцем розлітаються сердечка
  '😍': (el, x, y) => {
    big('😍', x, y, [
      { transform: 'scale(.2) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1.3) rotate(8deg)', opacity: 1, offset: 0.25 },
      { transform: 'scale(1.05) rotate(-4deg)', offset: 0.45 }, { transform: 'scale(1.15) rotate(0)', opacity: 1, offset: 0.8 },
      { transform: 'scale(.6)', opacity: 0 },
    ], 1600);
    spray(x, y, ['💕', '❤️', '💘'], 12, { dist: 140, size: '1.9rem', delay: 300, fall: 0 });
  },
  // Регоче: труситься, сльози бризкають у боки, повідомлення підстрибує
  '😂': (el, x, y) => {
    big('😂', x, y, [
      { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.2) rotate(-14deg)', opacity: 1, offset: 0.15 },
      { transform: 'scale(1.2) rotate(14deg)', offset: 0.28 }, { transform: 'scale(1.2) rotate(-12deg)', offset: 0.41 },
      { transform: 'scale(1.2) rotate(12deg)', offset: 0.54 }, { transform: 'scale(1.15) rotate(-6deg)', offset: 0.67 },
      { transform: 'scale(1.1) rotate(0)', opacity: 1, offset: 0.82 }, { transform: 'scale(.7) translateY(-30px)', opacity: 0 },
    ], 1700);
    spray(x - 30, y, ['💧'], 5, { dist: 110, size: '1.5rem', delay: 200, from: 160, to: 230, fall: 70 });
    spray(x + 30, y, ['💧'], 5, { dist: 110, size: '1.5rem', delay: 260, from: -50, to: 20, fall: 70 });
    shake(el, [{ transform: 'none' }, { transform: 'translateY(-10px)' }, { transform: 'none' }, { transform: 'translateY(-6px)' }, { transform: 'none' }], 700);
  },
  // Зворушений: повільно росте й тремтить, котяться дві сльозинки, повідомлення «зітхає»
  '🥺': (el, x, y) => {
    big('🥺', x, y, [
      { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1) translateX(0)', opacity: 1, offset: 0.35 },
      { transform: 'scale(1.15) translateX(-2px)', offset: 0.45 }, { transform: 'scale(1.2) translateX(2px)', offset: 0.55 },
      { transform: 'scale(1.25) translateX(-2px)', offset: 0.65 }, { transform: 'scale(1.3) translateX(0)', opacity: 1, offset: 0.85 },
      { transform: 'scale(1.3)', opacity: 0 },
    ], 2000);
    for (const dx of [-20, 20]) {
      const t = glyphAt('💧', x + dx, y + 18, '1.3rem');
      gone(t)(t.animate([
        { transform: `${C} scale(.3)`, opacity: 0 }, { transform: `${C} scale(1)`, opacity: 1, offset: 0.2 },
        { transform: `translate(-50%, calc(-50% + 90px)) scale(.8)`, opacity: 0 },
      ], { duration: 1100, delay: 800 + (dx > 0 ? 150 : 0), easing: 'ease-in', fill: 'backwards' }));
    }
    shake(el, [{ transform: 'none' }, { transform: 'scale(.97)', offset: 0.4 }, { transform: 'scale(1.01)', offset: 0.7 }, { transform: 'none' }], 1400);
  },
  // Дощ із полуниць: падають згори на повідомлення й відскакують
  '🍓': (el, x, y, r) => {
    for (let i = 0; i < 12; i += 1) {
      const px = r.left + 16 + Math.random() * Math.max(40, r.width - 32);
      const s = glyphAt('🍓', px, r.top + 6, `${1.8 + Math.random() * 1}rem`);
      const h = r.top + 80;
      const side = (Math.random() - 0.5) * 70;
      gone(s)(s.animate([
        { transform: `translate(-50%, calc(-50% - ${h}px)) rotate(${side}deg)`, opacity: 1 },
        { transform: `${C} rotate(0)`, offset: 0.55 },
        { transform: `translate(calc(-50% + ${side * 0.4}px), calc(-50% - 34px)) rotate(${side / 2}deg)`, offset: 0.75 },
        { transform: `translate(calc(-50% + ${side * 0.6}px), -50%) rotate(${side}deg)`, opacity: 1, offset: 0.9 },
        { transform: `translate(calc(-50% + ${side * 0.7}px), -50%) rotate(${side}deg)`, opacity: 0 },
      ], { duration: 1500, delay: i * 80 + Math.random() * 120, easing: 'cubic-bezier(.5, 0, .7, 1)', fill: 'backwards' }));
    }
  },
  // Поцілунок: губи підлітають до повідомлення, на ньому на мить лишається відбиток 💋
  '🫦': (el, x, y, r) => {
    big('🫦', x, y, [
      { transform: 'translate(140px, 180px) scale(.4) rotate(20deg)', opacity: 0 },
      { transform: 'translate(0, 0) scale(1.35) rotate(-6deg)', opacity: 1, offset: 0.45 },
      { transform: 'translate(0, 0) scale(1.1) rotate(0)', opacity: 1, offset: 0.6 },
      { transform: 'translate(0, 0) scale(.4)', opacity: 0 },
    ], 1300);
    const k = glyphAt('💋', Math.min(r.right - 46, x + 60), y, '3.4rem');
    gone(k)(k.animate([
      { transform: `${C} scale(1.8) rotate(-14deg)`, opacity: 0 }, { transform: `${C} scale(1) rotate(-14deg)`, opacity: 0.95, offset: 0.12 },
      { transform: `${C} scale(1) rotate(-14deg)`, opacity: 0.95, offset: 0.75 }, { transform: `${C} scale(1) rotate(-14deg)`, opacity: 0 },
    ], { duration: 1900, delay: 750, fill: 'backwards' }));
    shake(el, [{ transform: 'none' }, { transform: 'scale(1.03) rotate(-1deg)', offset: 0.5 }, { transform: 'none' }], 500);
  },
  // Долоньки підіймаються, кругом розходяться іскри
  '🙏': (el, x, y) => {
    big('🙏', x, y, [
      { transform: 'translateY(50px) scale(.4)', opacity: 0 }, { transform: 'translateY(0) scale(1.25)', opacity: 1, offset: 0.35 },
      { transform: 'translateY(-4px) scale(1.15)', offset: 0.6 }, { transform: 'translateY(0) scale(1.2)', opacity: 1, offset: 0.85 },
      { transform: 'translateY(-20px) scale(1)', opacity: 0 },
    ], 1800);
    spray(x, y, ['✨', '⭐', '✨'], 12, { dist: 150, size: '1.6rem', delay: 450, fall: 0 });
    spray(x, y, ['✨'], 8, { dist: 90, size: '1.2rem', delay: 800, fall: 0 });
  },
  // Віддає честь — і зверху на нього падає треуголка
  '🫡': (el, x, y) => {
    big('🫡', x, y, [
      { transform: 'scale(.3) rotate(10deg)', opacity: 0 }, { transform: 'scale(1.2) rotate(-12deg)', opacity: 1, offset: 0.25 },
      { transform: 'scale(1.15) rotate(-8deg)', offset: 0.5 }, { transform: 'scale(1.15) rotate(-10deg)', opacity: 1, offset: 0.85 },
      { transform: 'scale(.8)', opacity: 0 },
    ], 2000);
    const cap = document.createElement('span');
    cap.className = 'fx-burst fx-cap fx-cap-big';
    cap.setAttribute('aria-hidden', 'true');
    cap.innerHTML = TRICORN;
    cap.style.left = `${x}px`;
    cap.style.top = `${y - 46}px`;
    document.body.append(cap);
    gone(cap)(cap.animate([
      { transform: `translate(-50%, ${-y - 60}px) rotate(-40deg)`, opacity: 1 },
      { transform: 'translate(-50%, 0) rotate(-14deg)', offset: 0.4 },
      { transform: 'translate(-50%, -14px) rotate(-8deg)', offset: 0.5 },
      { transform: 'translate(-50%, 0) rotate(-12deg)', opacity: 1, offset: 0.82 },
      { transform: 'translate(-50%, -20px) rotate(-12deg)', opacity: 0 },
    ], { duration: 2000, delay: 250, easing: 'cubic-bezier(.3, .7, .4, 1)', fill: 'backwards' }));
  },
};

// «Да уж» 😎: на звичайне велике обличчя 🙂 повільно опускаються піксельні окуляри, клац — блік по скельцях і підпис
const SHADES = '<svg viewBox="0 0 24 6" width="78" height="20" shape-rendering="crispEdges" aria-hidden="true">'
  + '<g fill="#111"><rect x="0" y="0" width="24" height="1"/><rect x="2" y="1" width="8" height="3"/><rect x="14" y="1" width="8" height="3"/>'
  + '<rect x="10" y="1" width="4" height="1"/><rect x="3" y="4" width="6" height="1"/><rect x="4" y="5" width="4" height="1"/>'
  + '<rect x="15" y="4" width="6" height="1"/><rect x="16" y="5" width="4" height="1"/></g>'
  + '<g fill="#fff"><rect x="3" y="2" width="1" height="1"/><rect x="4" y="3" width="1" height="1"/>'
  + '<rect x="15" y="2" width="1" height="1"/><rect x="16" y="3" width="1" height="1"/></g></svg>';
REACT_FX['😎'] = (el, x, y) => {
  big('🙂', x, y, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.12 },
    { transform: 'scale(1.1)', offset: 0.55 }, { transform: 'scale(1.18) rotate(-4deg)', offset: 0.6 },
    { transform: 'scale(1.12) rotate(0)', opacity: 1, offset: 0.88 }, { transform: 'scale(.8)', opacity: 0 },
  ], 2600);
  const g = document.createElement('span');
  g.className = 'fx-burst fx-shades';
  g.setAttribute('aria-hidden', 'true');
  g.innerHTML = SHADES;
  g.style.left = `${x}px`;
  g.style.top = `${y - 8}px`;
  document.body.append(g);
  gone(g)(g.animate([
    { transform: `translate(-50%, ${-y - 40}px)`, opacity: 1 },
    { transform: 'translate(-50%, -50%)', offset: 0.55, easing: 'steps(1)' },
    { transform: 'translate(-50%, -50%)', opacity: 1, offset: 0.88 },
    { transform: 'translate(-50%, -50%) scale(.8)', opacity: 0 },
  ], { duration: 2600, easing: 'linear', fill: 'forwards' }));
  // Блік: біла смужка пробігає по скельцях, щойно окуляри сіли
  const shine = glyphAt('✨', x + 22, y - 14, '1.4rem');
  gone(shine)(shine.animate([
    { transform: `${C} scale(.2) rotate(0)`, opacity: 0 }, { transform: `${C} scale(1.3) rotate(40deg)`, opacity: 1, offset: 0.4 },
    { transform: `${C} scale(.4) rotate(90deg)`, opacity: 0 },
  ], { duration: 700, delay: 1500, fill: 'backwards' }));
  const say = glyphAt('Да уж', x, y + 58, '1.6rem', 'fx-say');
  gone(say)(say.animate([
    { transform: `${C} translateY(10px) scale(.6)`, opacity: 0 }, { transform: `${C} scale(1.08)`, opacity: 1, offset: 0.25 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.8 }, { transform: `${C}`, opacity: 0 },
  ], { duration: 1300, delay: 1500, fill: 'backwards' }));
};

export function reactFx(el, glyph) {
  if (reduceMotion || !el?.isConnected || !glyph) return;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = Math.max(90, r.top + Math.min(r.height / 2, 70));
  const fx = REACT_FX[glyph];
  if (fx) fx(el, x, y, r);
  else {
    big(glyph, x, y, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.3 }, { transform: 'scale(1)', opacity: 1, offset: 0.8 }, { transform: 'scale(.6)', opacity: 0 }], 1300);
    spray(x, y, [glyph], 8, { delay: 300 });
  }
}
