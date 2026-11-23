// Маленькі анімації на відповідь людині: сердечка, виліт картки, згортання рядка.
// Web Animations API — без класів у CSS для кожного руху; «менше руху» в телефоні — нічого не рухаємо
import { reduceMotion } from './ui.js';
import { sfx } from './sound.js';

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
  if (el?.isConnected) sfx('love');
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

// Піратська треуголка для 🫡
const TRICORN = '<svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true">'
  + '<ellipse cx="32" cy="13" rx="15" ry="10" fill="#1c1a22"/>'
  + '<path d="M3 25 Q13 5 32 11 Q51 5 61 25 Q46 19 32 32 Q18 19 3 25 Z" fill="#24212b" stroke="#e8b84a" stroke-width="2.4" stroke-linejoin="round"/>'
  + '<circle cx="32" cy="19" r="3.6" fill="#fff"/>'
  + '<path d="M27.5 23.5l9-4M27.5 19.5l9 4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'
  + '<circle cx="30.7" cy="18.6" r=".9" fill="#24212b"/><circle cx="33.3" cy="18.6" r=".9" fill="#24212b"/>'
  + '</svg>';
// Старі рядки «🫡 Да, капитан!» (до 0.2.58) — та сама анімація, що й у реакції 🫡
export function captainSalute(el) {
  reactFx(el?.querySelector('.feed-captain-text') || el, '🫡');
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
  return s;
}
// Елемент потрапляє на сторінку лише тоді, коли починається його рух: інакше перший кадр
// малює всі 20–30 великих емодзі разом і на слабкому телефоні «залипає»
const gone = (s) => (a) => {
  const delay = a.effect?.getTiming().delay || 0;
  const add = () => { if (!s.isConnected) document.body.append(s); };
  if (delay > 40) setTimeout(add, delay - 30);
  else add();
  a.finished.finally(() => s.remove());
};
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

function shape(cls, x, y, html = '') {
  const s = document.createElement('span');
  s.className = `fx-burst ${cls}`;
  s.setAttribute('aria-hidden', 'true');
  if (html) s.innerHTML = html;
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  return s;
}
const jolt = (el, frames, dur, delay = 0) => el?.isConnected && el.animate(frames, { duration: dur, delay, easing: 'ease-in-out' });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Ударна хвиля від точки
function ring(x, y, delay, cls = '') {
  const s = shape(`fx-ring${cls ? ` ${cls}` : ''}`, x, y);
  gone(s)(s.animate([{ transform: `${C} scale(.4)`, opacity: 0.9 }, { transform: `${C} scale(4)`, opacity: 0 }],
    { duration: 800, delay, easing: 'ease-out', fill: 'backwards' }));
}
// Значки злітають угору, як повітряні кульки, погойдуючись
function rise(x, y, glyphs, n, { delay = 0, up = 290, spread = 260, size = 1.6 } = {}) {
  for (let i = 0; i < n; i += 1) {
    const s = glyphAt(glyphs[i % glyphs.length], x + (Math.random() - 0.5) * 50, y, `${size + Math.random() * 0.9}rem`);
    const dx = (Math.random() - 0.5) * spread;
    const hh = up * (0.7 + Math.random() * 0.5);
    const sway = 14 + Math.random() * 16;
    gone(s)(s.animate([
      { transform: `${C} scale(.3)`, opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.3 - sway}px), calc(-50% - ${hh * 0.2}px)) scale(1)`, opacity: 1, offset: 0.2 },
      { transform: `translate(calc(-50% + ${dx * 0.65 + sway}px), calc(-50% - ${hh * 0.6}px)) scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${hh}px)) scale(.8)`, opacity: 0 },
    ], { duration: 1500 + Math.random() * 500, delay: delay + i * 45, easing: 'ease-out', fill: 'backwards' }));
  }
}
// Хоровод значків навколо точки
function orbit(x, y, glyphs, n, rad, delay, dur) {
  const o = shape('fx-orbit', x, y);
  for (let i = 0; i < n; i += 1) {
    const a = (360 * i) / n;
    const c = document.createElement('span');
    c.textContent = glyphs[i % glyphs.length];
    c.style.transform = `translate(-50%, -50%) rotate(${a}deg) translateX(${rad}px) rotate(${-a}deg)`;
    o.append(c);
  }
  gone(o)(o.animate([
    { transform: 'rotate(0) scale(.3)', opacity: 0 }, { transform: 'rotate(110deg) scale(1)', opacity: 1, offset: 0.25 },
    { transform: 'rotate(290deg) scale(1)', opacity: 1, offset: 0.8 }, { transform: 'rotate(370deg) scale(1.4)', opacity: 0 },
  ], { duration: dur, delay, easing: 'linear', fill: 'backwards' }));
}
// Іскорка, що блимає на місці
function twinkle(g, x, y, size, delay, dur = 700) {
  const s = glyphAt(g, x, y, size);
  gone(s)(s.animate([
    { transform: `${C} scale(0) rotate(0)`, opacity: 0 }, { transform: `${C} scale(1.2) rotate(45deg)`, opacity: 1, offset: 0.45 },
    { transform: `${C} scale(0) rotate(90deg)`, opacity: 0 },
  ], { duration: dur, delay, easing: 'ease-out', fill: 'backwards' }));
}
// Напівпрозорий шар на весь екран (затемнення, спалах)
function veil(cls, frames, dur, delay = 0, x = 0, y = 0) {
  const v = shape(cls, 0, 0);
  v.style.setProperty('--vx', `${x}px`);
  v.style.setProperty('--vy', `${y}px`);
  gone(v)(v.animate(frames, { duration: dur, delay, fill: 'both' }));
}
const CANNON = '<svg viewBox="0 -14 60 54" width="86" height="77" aria-hidden="true">'
  + '<g transform="rotate(-50 22 26)" fill="#2b2a31" stroke="#e8b84a" stroke-width="1.6">'
  + '<rect x="10" y="18" width="44" height="13" rx="5"/><rect x="50" y="16" width="6" height="17" rx="2"/>'
  + '<circle cx="10" cy="24.5" r="6"/></g>'
  + '<circle cx="24" cy="31" r="8" fill="#7a4b2a" stroke="#3b2414" stroke-width="2"/><circle cx="24" cy="31" r="2" fill="#3b2414"/>'
  + '</svg>';

// Темп реакцій: числа нижче — база, кожна анімація йде на 20 % повільніше (просили спокійніше)
const SLOW = 1.2;
// Скільки триває кожна — щоб кілька реакцій ішли по черзі
const DUR = { '🧸': 2800, '🤣': 2700, '🫣': 2800, '🌸': 3000, '⭐': 3200, '🎖️': 3400, '🛡️': 3000, '🚀': 3000, '🍿': 2900, '💊': 3600, '🤮': 3300, '🌈': 3200, '😏': 2400, '🪐': 2900, '🏹': 2700, '🐾': 2800, '❤️': 3400, '😍': 2500, '😂': 2300, '🥺': 2700, '🍓': 2600, '🫦': 2500, '🙏': 2600, '😎': 2700, '🫡': 3500, '🤯': 3100, '🤷': 2500, '🔥': 2600, '😴': 3000, '🤗': 2600, '😢': 2800, '🙃': 3100, '🍀': 2700, '💯': 2500, '😘': 2800, '👏': 2600, '🎉': 3000, '💪': 2700, '🙈': 2600, '👀': 2600, '😱': 2500, '🤔': 2900, '🌹': 4300, '☕': 2800, '👍': 2600, '☀️': 3200, '🌙': 3400, '😇': 3300, '🍷': 3000, '🍕': 2800, '🥶': 3000, '🥵': 2900, '🤒': 3300 };

const REACT_FX = {
  // Серце двічі бʼється з ударною хвилею, потім сердечка злітають кульками
  '❤️': (el, x, y) => {
    big('❤️', x, y, [
      { transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.14 },
      { transform: 'scale(.92)', offset: 0.24 }, { transform: 'scale(1.32)', offset: 0.32 }, { transform: 'scale(1)', offset: 0.42 },
      { transform: 'scale(.92)', offset: 0.5 }, { transform: 'scale(1.32)', offset: 0.58 }, { transform: 'scale(1.05)', offset: 0.68 },
      { transform: 'scale(1.05)', opacity: 1, offset: 0.8 }, { transform: 'scale(1.7)', opacity: 0 },
    ], 2200, '6.6rem');
    ring(x, y, 680);
    ring(x, y, 1250);
    rise(x, y, ['💗', '💖', '❤️', '💕'], 9, { delay: 1600 });
  },
  // З очей двічі вистрибують серця прямо на тебе, потім кругом іде хоровод сердечок
  '😍': (el, x, y) => {
    big('😍', x, y, [
      { transform: 'scale(.2) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1.15) rotate(6deg)', opacity: 1, offset: 0.14 },
      { transform: 'scale(1.3)', offset: 0.2 }, { transform: 'scale(1.1)', offset: 0.28 },
      { transform: 'scale(1.3)', offset: 0.42 }, { transform: 'scale(1.1)', offset: 0.5 },
      { transform: 'scale(1.12) rotate(-4deg)', opacity: 1, offset: 0.85 }, { transform: 'scale(.6)', opacity: 0 },
    ], 2400, '6.6rem');
    for (const [dx, d] of [[-22, 450], [22, 450], [-22, 1000], [22, 1000]]) {
      const s = glyphAt('❤️', x + dx, y - 10, '1.5rem');
      gone(s)(s.animate([
        { transform: `${C} scale(.5)`, opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 2.5}px), calc(-50% - 10px)) scale(3.6)`, opacity: 0.9, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx * 3}px), calc(-50% - 14px)) scale(4.4)`, opacity: 0 },
      ], { duration: 650, delay: d, easing: 'ease-out', fill: 'backwards' }));
    }
    orbit(x, y, ['💕', '💖', '💗'], 8, 106, 900, 1500);
  },
  // Регоче до сліз: сльози бʼють фонтанчиками, кругом вискакують «ха-ха», повідомлення підстрибує
  '😂': (el, x, y) => {
    big('😂', x, y, [
      { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.2) rotate(-16deg)', opacity: 1, offset: 0.12 },
      { transform: 'scale(1.2) rotate(16deg) translateY(-6px)', offset: 0.24 }, { transform: 'scale(1.2) rotate(-14deg)', offset: 0.36 },
      { transform: 'scale(1.2) rotate(14deg) translateY(-6px)', offset: 0.48 }, { transform: 'scale(1.2) rotate(-12deg)', offset: 0.6 },
      { transform: 'scale(1.15) rotate(8deg)', offset: 0.72 }, { transform: 'scale(1.1) rotate(0)', opacity: 1, offset: 0.84 },
      { transform: 'scale(.7) translateY(-30px)', opacity: 0 },
    ], 2200, '6.6rem');
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i += 1) {
        const s = glyphAt('💧', x + side * 31, y - 5, `${1.3 + Math.random() * 0.6}rem`);
        const dx = side * (75 + Math.random() * 85);
        const up = 50 + Math.random() * 50;
        const down = 80 + Math.random() * 40;
        gone(s)(s.animate([
          { transform: `${C} scale(.4)`, opacity: 0 },
          { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% - ${up}px)) scale(1)`, opacity: 1, offset: 0.4, easing: 'ease-in' },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${down}px)) scale(.8)`, opacity: 0 },
        ], { duration: 900, delay: 250 + i * 160 + (side > 0 ? 80 : 0), easing: 'ease-out', fill: 'backwards' }));
      }
    }
    ['ха', 'ха-ха', 'ХА', 'ха', 'хи-хи'].forEach((t, i) => {
      const a = ((-150 + i * 30 + (Math.random() - 0.5) * 14) * Math.PI) / 180;
      const d = 118 + Math.random() * 28;
      const rot = (Math.random() - 0.5) * 30;
      const s = glyphAt(t, x + Math.cos(a) * d, y + Math.sin(a) * d, `${1.5 + Math.random() * 0.6}rem`, 'fx-ha');
      gone(s)(s.animate([
        { transform: `${C} scale(.2) rotate(${rot}deg)`, opacity: 0 }, { transform: `${C} scale(1.15) rotate(${rot}deg)`, opacity: 1, offset: 0.2 },
        { transform: `translate(-50%, calc(-50% - 16px)) rotate(${rot}deg)`, opacity: 1, offset: 0.7 },
        { transform: `translate(-50%, calc(-50% - 26px)) scale(.9) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: 1100, delay: 200 + i * 220, easing: 'ease-out', fill: 'backwards' }));
    });
    jolt(el, [{ transform: 'none' }, { transform: 'translateY(-10px)' }, { transform: 'none' }, { transform: 'translateY(-7px)' },
      { transform: 'none' }, { transform: 'translateY(-4px)' }, { transform: 'none' }], 1100, 200);
  },
  // Щенячі очі: довкола темніє, обличчя повільно наближається й тремтить, в очах блищить, котяться сльози
  '🥺': (el, x, y) => {
    veil('fx-veil', [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], 2600, 0, x, y);
    big('🥺', x, y, [
      { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.3 },
      { transform: 'scale(1.25) translateX(-2px)', offset: 0.45 }, { transform: 'scale(1.3) translateX(2px)', offset: 0.52 },
      { transform: 'scale(1.33) translateX(-2px)', offset: 0.6 }, { transform: 'scale(1.36) translateX(2px)', offset: 0.68 },
      { transform: 'scale(1.38) translateX(0)', opacity: 1, offset: 0.86 }, { transform: 'scale(1.4)', opacity: 0 },
    ], 2600, '6.6rem');
    twinkle('✨', x - 25, y - 12, '1.3rem', 900);
    twinkle('✨', x + 25, y - 12, '1.3rem', 1080);
    twinkle('✨', x - 25, y - 12, '1.3rem', 1700);
    for (const dx of [-29, 29]) {
      const t = glyphAt('💧', x + dx, y + 20, '1.6rem');
      gone(t)(t.animate([
        { transform: `${C} scale(.3)`, opacity: 0 }, { transform: `${C} scale(1)`, opacity: 1, offset: 0.2 },
        { transform: `translate(calc(-50% + ${dx > 0 ? 4 : -4}px), calc(-50% + 50px)) scale(.95)`, opacity: 1, offset: 0.6 },
        { transform: 'translate(-50%, calc(-50% + 100px)) scale(.8)', opacity: 0 },
      ], { duration: 1100, delay: 1350 + (dx > 0 ? 180 : 0), easing: 'ease-in', fill: 'backwards' }));
    }
    jolt(el, [{ transform: 'none' }, { transform: 'scale(.97)', offset: 0.4 }, { transform: 'scale(1.01)', offset: 0.7 }, { transform: 'none' }], 1400, 600);
  },
  // Полуничний дощ на повідомлення, а наостанок велика полуниця падає з плюхом і бризками
  '🍓': (el, x, y, r) => {
    const land = clamp(r.top + 6, 40, innerHeight - 120);
    for (let i = 0; i < 10; i += 1) {
      const px = clamp(r.left + 16 + Math.random() * Math.max(40, r.width - 32), 20, innerWidth - 20);
      const s = glyphAt('🍓', px, land, `${2 + Math.random() * 1.2}rem`);
      const side = (Math.random() - 0.5) * 70;
      gone(s)(s.animate([
        { transform: `translate(-50%, calc(-50% - ${land + 60}px)) rotate(${side}deg)`, opacity: 1 },
        { transform: `${C} rotate(0)`, offset: 0.55 },
        { transform: `translate(calc(-50% + ${side * 0.4}px), calc(-50% - 34px)) rotate(${side / 2}deg)`, offset: 0.75 },
        { transform: `translate(calc(-50% + ${side * 0.6}px), -50%) rotate(${side}deg)`, opacity: 1, offset: 0.9 },
        { transform: `translate(calc(-50% + ${side * 0.7}px), -50%) rotate(${side}deg)`, opacity: 0 },
      ], { duration: 1400, delay: i * 95 + Math.random() * 120, easing: 'cubic-bezier(.5, 0, .7, 1)', fill: 'backwards' }));
    }
    const g = glyphAt('🍓', x, y, '6.4rem', 'fx-big');
    gone(g)(g.animate([
      { transform: `translate(-50%, calc(-50% - ${y + 80}px))`, opacity: 1, easing: 'ease-in' },
      { transform: `${C} scale(1)`, offset: 0.35 },
      { transform: `${C} translateY(14px) scale(1.4, .62)`, offset: 0.42 },
      { transform: `${C} translateY(-8px) scale(.9, 1.12)`, offset: 0.52 },
      { transform: `${C} scale(1)`, offset: 0.6 },
      { transform: `${C} scale(1)`, opacity: 1, offset: 0.86 }, { transform: `${C} scale(.7)`, opacity: 0 },
    ], { duration: 1400, delay: 1100, fill: 'backwards' }));
    spray(x, y + 32, ['💦'], 8, { dist: 130, size: '1.7rem', delay: 1680, from: 195, to: 345, fall: 60, dur: 800 });
    jolt(el, [{ transform: 'none' }, { transform: 'translateY(6px) scaleY(.97)' }, { transform: 'none' }], 300, 1680);
  },
  // Губи підлітають і двічі прикушують, екран рожево спалахує, на повідомлення по черзі ляпаються три поцілунки
  '🫦': (el, x, y, r) => {
    veil('fx-flash', [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], 650, 550);
    big('🫦', x, y, [
      { transform: 'translate(140px, 180px) scale(.4) rotate(20deg)', opacity: 0 },
      { transform: 'translate(0, 0) scale(1.35) rotate(-6deg)', opacity: 1, offset: 0.3 },
      { transform: 'scale(1.35, 1.1)', offset: 0.36 }, { transform: 'scale(1.3)', offset: 0.42 },
      { transform: 'scale(1.35, 1.1)', offset: 0.48 }, { transform: 'scale(1.25)', offset: 0.54 },
      { transform: 'scale(1.2)', opacity: 1, offset: 0.7 }, { transform: 'scale(.4)', opacity: 0 },
    ], 1800, '6.6rem');
    [[0.22, 0.32, -18], [0.56, 0.66, 12], [0.82, 0.38, -6]].forEach(([fx, fy, rot], i) => {
      const k = glyphAt('💋', clamp(r.left + r.width * fx, 30, innerWidth - 30),
        clamp(r.top + r.height * fy, 40, innerHeight - 120), '3.3rem');
      const d = 900 + i * 260;
      gone(k)(k.animate([
        { transform: `${C} scale(2.2) rotate(${rot}deg)`, opacity: 0 }, { transform: `${C} scale(1) rotate(${rot}deg)`, opacity: 0.95, offset: 0.1 },
        { transform: `${C} scale(1) rotate(${rot}deg)`, opacity: 0.95, offset: 0.8 }, { transform: `${C} scale(1) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: 1600 - i * 200, delay: d, fill: 'backwards' }));
      jolt(el, [{ transform: 'none' }, { transform: `scale(.985) rotate(${rot > 0 ? 0.6 : -0.6}deg)` }, { transform: 'none' }], 220, d);
    });
  },
  // Долоньки підіймаються, за ними повільно обертається золоте сяйво, довкола блимають іскри
  '🙏': (el, x, y) => {
    const rays = shape('fx-rays', x, y);
    gone(rays)(rays.animate([
      { transform: `${C} scale(.3) rotate(0)`, opacity: 0 }, { transform: `${C} scale(1) rotate(25deg)`, opacity: 1, offset: 0.3 },
      { transform: `${C} scale(1.1) rotate(60deg)`, opacity: 1, offset: 0.8 }, { transform: `${C} scale(1.2) rotate(75deg)`, opacity: 0 },
    ], { duration: 2400, delay: 150, fill: 'backwards' }));
    big('🙏', x, y, [
      { transform: 'translateY(60px) scale(.4)', opacity: 0 }, { transform: 'translateY(0) scale(1.25)', opacity: 1, offset: 0.3 },
      { transform: 'scale(1.1)', offset: 0.42 }, { transform: 'scale(1.25)', offset: 0.5 }, { transform: 'scale(1.1)', offset: 0.6 },
      { transform: 'scale(1.2)', opacity: 1, offset: 0.86 }, { transform: 'translateY(-20px) scale(1)', opacity: 0 },
    ], 2300, '6.6rem');
    for (let i = 0; i < 7; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const d = 88 + Math.random() * 72;
      twinkle(i % 3 ? '✨' : '⭐', x + Math.cos(a) * d, y + Math.sin(a) * d, `${1.3 + Math.random() * 0.7}rem`, 500 + i * 170);
    }
  },
  // Пушковий салют: треуголка сідає на голову, збоку викочується гармата, постріл, феєрверк, піратський прапор і сувій
  '🫡': (el, x, y) => {
    big('🫡', x, y, [
      { transform: 'scale(.3) rotate(10deg)', opacity: 0 }, { transform: 'scale(1.15) rotate(-8deg)', opacity: 1, offset: 0.12 },
      { transform: 'scale(1.1) rotate(-8deg)', offset: 0.29 }, { transform: 'scale(1.18) rotate(-14deg) translateX(-6px)', offset: 0.32 },
      { transform: 'scale(1.1) rotate(-8deg)', offset: 0.4 }, { transform: 'scale(1.1) rotate(-8deg)', opacity: 1, offset: 0.9 },
      { transform: 'scale(.8)', opacity: 0 },
    ], 3400, '6.6rem');
    const cap = shape('fx-cap fx-cap-big', x, y - 97, TRICORN);
    gone(cap)(cap.animate([
      { transform: `translate(-50%, ${-y - 40}px) rotate(-40deg)`, opacity: 1 },
      { transform: 'translate(-50%, 0) rotate(-10deg)', offset: 0.16 },
      { transform: 'translate(-50%, -10px) rotate(-6deg)', offset: 0.2 },
      { transform: 'translate(-50%, 0) rotate(-10deg)', offset: 0.24 },
      { transform: 'translate(-50%, 0) rotate(-10deg)', offset: 0.29 },
      { transform: 'translate(-50%, -26px) rotate(-22deg)', offset: 0.33 },
      { transform: 'translate(-50%, 0) rotate(-10deg)', offset: 0.42 },
      { transform: 'translate(-50%, 0) rotate(-10deg)', opacity: 1, offset: 0.9 },
      { transform: 'translate(-50%, -20px) rotate(-10deg)', opacity: 0 },
    ], { duration: 3400, easing: 'ease-out', fill: 'forwards' }));
    const cx = Math.max(6, x - 154);
    const cy = y + 18;
    const gun = shape('fx-cannon', cx, cy, CANNON);
    gone(gun)(gun.animate([
      { transform: `translateX(${-cx - 90}px)`, opacity: 1 },
      { transform: 'translateX(0)', offset: 0.2 },
      { transform: 'translateX(0)', offset: 0.29 },
      { transform: 'translateX(-16px) rotate(-6deg)', offset: 0.31 },
      { transform: 'translateX(0)', offset: 0.4 },
      { transform: 'translateX(0)', opacity: 1, offset: 0.88 },
      { transform: `translateX(${-cx - 90}px)`, opacity: 1 },
    ], { duration: 3400, easing: 'ease-out', fill: 'forwards' }));
    const mx = cx + 61;
    const my = cy + 19;
    const boom = glyphAt('💥', mx + 8, my - 8, '3.5rem');
    gone(boom)(boom.animate([
      { transform: `${C} scale(.2)`, opacity: 0 }, { transform: `${C} scale(1.3)`, opacity: 1, offset: 0.3 }, { transform: `${C} scale(1.6)`, opacity: 0 },
    ], { duration: 500, delay: 1000, fill: 'backwards' }));
    spray(mx, my, ['💨'], 6, { dist: 75, size: '2.1rem', delay: 1020, from: 190, to: 300, fall: -30, dur: 1100 });
    jolt(el, [{ transform: 'none' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(2px)' }, { transform: 'none' }], 350, 1000);
    const tx = x - 10;
    const ty = Math.max(46, y - 178);
    const ball = shape('fx-ball', mx, my);
    gone(ball)(ball.animate([
      { transform: `${C} scale(.6)`, opacity: 1 },
      { transform: `translate(calc(-50% + ${(tx - mx) * 0.55}px), calc(-50% + ${(ty - my) * 0.75}px))`, offset: 0.5 },
      { transform: `translate(calc(-50% + ${tx - mx}px), calc(-50% + ${ty - my}px)) scale(.7)`, opacity: 1, offset: 0.97 },
      { transform: `translate(calc(-50% + ${tx - mx}px), calc(-50% + ${ty - my}px)) scale(.7)`, opacity: 0 },
    ], { duration: 480, delay: 1000, easing: 'ease-out', fill: 'both' }));
    ring(tx, ty, 1460, 'is-gold');
    ring(tx, ty, 1620, 'is-gold');
    twinkle('🌟', tx, ty, '3.4rem', 1440, 600);
    spray(tx, ty, ['✨', '⭐', '🌟', '✨'], 12, { dist: 150, size: '1.8rem', delay: 1480, fall: 40, dur: 1200 });
    const flag = glyphAt('🏴‍☠️', Math.min(innerWidth - 32, x + 98), y - 44, '3.2rem');
    flag.style.transformOrigin = '15% 100%';
    gone(flag)(flag.animate([
      { transform: `translate(-50%, calc(-50% - ${y + 40}px))`, opacity: 1 },
      { transform: `${C} rotate(0)`, offset: 0.12 },
      { transform: `${C} rotate(-7deg) skewY(-4deg)`, offset: 0.3 },
      { transform: `${C} rotate(4deg) skewY(3deg)`, offset: 0.5 },
      { transform: `${C} rotate(-6deg) skewY(-3deg)`, offset: 0.7 },
      { transform: `${C} rotate(0)`, opacity: 1, offset: 0.88 },
      { transform: C, opacity: 0 },
    ], { duration: 2100, delay: 1300, easing: 'ease-out', fill: 'backwards' }));
    const sc = glyphAt('🫡 Да, капитан!', x, y + 94, '1.9rem', 'fx-scroll');
    // Сувій розгортається від середини — текст не сплющується
    gone(sc)(sc.animate([
      { transform: C, clipPath: 'inset(-10px 46% -10px 46%)', opacity: 0 },
      { transform: C, clipPath: 'inset(-10px 46% -10px 46%)', opacity: 1, offset: 0.06 },
      { transform: C, clipPath: 'inset(-10px -10px -10px -10px)', opacity: 1, offset: 0.36 },
      { transform: C, clipPath: 'inset(-10px -10px -10px -10px)', opacity: 1, offset: 0.88 },
      { transform: `${C} translateY(10px)`, clipPath: 'inset(-10px -10px -10px -10px)', opacity: 0 },
    ], { duration: 1900, delay: 1500, easing: 'ease-out', fill: 'backwards' }));
  },
};

// «Да уж» 😎: на звичайне велике обличчя 🙂 повільно опускаються піксельні окуляри, клац — блік по скельцях і підпис
const SHADES = '<svg viewBox="0 0 24 6" width="96" height="24" shape-rendering="crispEdges" aria-hidden="true">'
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
  ], 2600, '6.2rem');
  const g = document.createElement('span');
  g.className = 'fx-burst fx-shades';
  g.setAttribute('aria-hidden', 'true');
  g.innerHTML = SHADES;
  g.style.left = `${x}px`;
  g.style.top = `${y - 10}px`;
  document.body.append(g);
  gone(g)(g.animate([
    { transform: `translate(-50%, ${-y - 40}px)`, opacity: 1 },
    { transform: 'translate(-50%, -50%)', offset: 0.55, easing: 'steps(1)' },
    { transform: 'translate(-50%, -50%)', opacity: 1, offset: 0.88 },
    { transform: 'translate(-50%, -50%) scale(.8)', opacity: 0 },
  ], { duration: 2600, easing: 'linear', fill: 'forwards' }));
  // Блік: біла смужка пробігає по скельцях, щойно окуляри сіли
  const shine = glyphAt('✨', x + 27, y - 17, '1.7rem');
  gone(shine)(shine.animate([
    { transform: `${C} scale(.2) rotate(0)`, opacity: 0 }, { transform: `${C} scale(1.3) rotate(40deg)`, opacity: 1, offset: 0.4 },
    { transform: `${C} scale(.4) rotate(90deg)`, opacity: 0 },
  ], { duration: 700, delay: 1500, fill: 'backwards' }));
  const say = glyphAt('Да уж', x, y + 74, '1.9rem', 'fx-say');
  gone(say)(say.animate([
    { transform: `${C} translateY(10px) scale(.6)`, opacity: 0 }, { transform: `${C} scale(1.08)`, opacity: 1, offset: 0.25 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.8 }, { transform: `${C}`, opacity: 0 },
  ], { duration: 1300, delay: 1500, fill: 'backwards' }));
};

// Великий смайлик, що зʼявляється не одразу, а через delay
function bigLater(glyph, x, y, frames, dur, delay, size = '6.6rem') {
  const s = glyphAt(glyph, x, y, size, 'fx-big');
  gone(s)(s.animate(frames.map((f) => ({ ...f, transform: `${C} ${f.transform || ''}` })), { duration: dur, delay, easing: 'ease-out', fill: 'backwards' }));
  return s;
}

// «Крише знесло» 🤯: обличчя червоніє й трясеться дедалі сильніше — бах! — голова вибухає, мозок відлітає
REACT_FX['🤯'] = (el, x, y) => {
  bigLater('😳', x, y, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.2 },
    { transform: 'scale(1.04) translateX(-2px)', offset: 0.35 }, { transform: 'scale(1.08) translateX(3px)', offset: 0.45 },
    { transform: 'scale(1.12) translateX(-4px)', offset: 0.55 }, { transform: 'scale(1.16) translateX(5px)', offset: 0.65 },
    { transform: 'scale(1.2) translateX(-6px)', offset: 0.75 }, { transform: 'scale(1.25) translateX(6px)', offset: 0.85 },
    { transform: 'scale(1.3) translateX(-6px)', opacity: 1, offset: 0.97 }, { transform: 'scale(1.3)', opacity: 0 },
  ], 1050, 0);
  bigLater('🤯', x, y, [
    { transform: 'scale(1.5)', opacity: 1 }, { transform: 'scale(1.05) rotate(-6deg)', offset: 0.12 },
    { transform: 'scale(1.18) rotate(5deg)', offset: 0.22 }, { transform: 'scale(1.12) rotate(0)', offset: 0.32 },
    { transform: 'scale(1.12)', opacity: 1, offset: 0.88 }, { transform: 'scale(.8)', opacity: 0 },
  ], 1950, 1030);
  veil('fx-flash', [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], 500, 1030);
  ring(x, y - 40, 1030, 'is-gold');
  ring(x, y - 40, 1180);
  const boom = glyphAt('💥', x, y - 70, '4.2rem');
  gone(boom)(boom.animate([
    { transform: `${C} scale(.2)`, opacity: 0 }, { transform: `${C} scale(1.4)`, opacity: 1, offset: 0.3 }, { transform: `${C} translateY(-30px) scale(1.8)`, opacity: 0 },
  ], { duration: 700, delay: 1030, fill: 'backwards' }));
  spray(x, y - 50, ['💫', '✨', '⭐', '💥'], 12, { dist: 170, size: '1.7rem', delay: 1060, from: 190, to: 350, fall: 60, dur: 1200 });
  const brain = glyphAt('🧠', x, y - 50, '2.8rem');
  const side = Math.random() < 0.5 ? -1 : 1;
  gone(brain)(brain.animate([
    { transform: `${C} scale(.4) rotate(0)`, opacity: 0 },
    { transform: `translate(calc(-50% + ${side * 40}px), calc(-50% - 90px)) scale(1.1) rotate(${side * 120}deg)`, opacity: 1, offset: 0.3 },
    { transform: `translate(calc(-50% + ${side * 110}px), calc(-50% - 170px)) scale(1) rotate(${side * 300}deg)`, opacity: 1, offset: 0.7 },
    { transform: `translate(calc(-50% + ${side * 170}px), calc(-50% - ${y + 40}px)) scale(.8) rotate(${side * 480}deg)`, opacity: 0 },
  ], { duration: 1500, delay: 1080, easing: 'ease-out', fill: 'backwards' }));
  jolt(el, [{ transform: 'none' }, { transform: 'translate(6px, -3px)' }, { transform: 'translate(-6px, 3px)' }, { transform: 'translate(4px, 2px)' },
    { transform: 'translate(-3px, -2px)' }, { transform: 'none' }], 450, 1030);
};

// «Ну таке» 🤷: двічі знизує плечима, по боках спливають знаки питання, внизу ¯\_(ツ)_/¯
REACT_FX['🤷'] = (el, x, y) => {
  big('🤷', x, y, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.14 },
    { transform: 'translateY(-14px) scale(1.12, 1.04)', offset: 0.24 }, { transform: 'translateY(0) scale(1.1)', offset: 0.34 },
    { transform: 'translateY(-14px) scale(1.12, 1.04)', offset: 0.46 }, { transform: 'translateY(0) scale(1.1)', offset: 0.56 },
    { transform: 'rotate(-5deg) scale(1.1)', offset: 0.68 }, { transform: 'rotate(4deg) scale(1.1)', offset: 0.78 },
    { transform: 'rotate(0) scale(1.1)', opacity: 1, offset: 0.88 }, { transform: 'scale(.8)', opacity: 0 },
  ], 2500);
  [[-1, 350], [1, 650], [-1, 950], [1, 1250]].forEach(([s, d], i) => {
    const q = glyphAt('❔', x + s * (70 + i * 6), y - 20, `${1.8 + (i % 2) * 0.4}rem`);
    const rot = s * (10 + i * 5);
    gone(q)(q.animate([
      { transform: `${C} scale(.2) rotate(0)`, opacity: 0 }, { transform: `${C} scale(1.1) rotate(${rot}deg)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${s * 14}px), calc(-50% - 60px)) rotate(${-rot}deg)`, opacity: 1, offset: 0.75 },
      { transform: `translate(calc(-50% + ${s * 20}px), calc(-50% - 90px)) scale(.8)`, opacity: 0 },
    ], { duration: 1100, delay: d, easing: 'ease-out', fill: 'backwards' }));
  });
  const say = glyphAt('¯\\_(ツ)_/¯', x, y + 76, '1.6rem', 'fx-say');
  gone(say)(say.animate([
    { transform: `${C} translateY(10px) scale(.6)`, opacity: 0 }, { transform: `${C} scale(1.08)`, opacity: 1, offset: 0.2 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.85 }, { transform: C, opacity: 0 },
  ], { duration: 1700, delay: 700, fill: 'backwards' }));
};

// «Вогонь» 🔥: знизу по листу піднімаються язики полумʼя, лист розжарюється, вгору летять іскри й димок
REACT_FX['🔥'] = (el, x, y, r) => {
  veil('fx-heat', [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], 2600, 0, x, y);
  const base = clamp(r.bottom - 10, 80, innerHeight - 90);
  const w = Math.max(120, r.width - 20);
  for (let i = 0; i < 10; i += 1) {
    const fx = clamp(r.left + 10 + (w * (i + Math.random() * 0.6)) / 10, 16, innerWidth - 16);
    const f = glyphAt('🔥', fx, base, `${1.8 + Math.random() * 1.4}rem`, 'fx-flame');
    const up = 50 + Math.random() * 90;
    gone(f)(f.animate([
      { transform: `${C} scale(.2)`, opacity: 0 },
      { transform: `translate(-50%, calc(-50% - ${up * 0.3}px)) scale(1.1, 1.25)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + 4px), calc(-50% - ${up * 0.6}px)) scale(.9, 1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(calc(-50% - 4px), calc(-50% - ${up * 0.85}px)) scale(1.05, 1.2)`, opacity: 0.9, offset: 0.75 },
      { transform: `translate(-50%, calc(-50% - ${up}px)) scale(.5)`, opacity: 0 },
    ], { duration: 1300 + Math.random() * 500, delay: i * 50 + Math.random() * 250, easing: 'ease-out', fill: 'backwards' }));
  }
  big('🔥', x, y, [
    { transform: 'translateY(40px) scale(.3)', opacity: 0 }, { transform: 'translateY(0) scale(1.15, 1.3)', opacity: 1, offset: 0.2 },
    { transform: 'scale(1.05, 1.15)', offset: 0.32 }, { transform: 'scale(1.2, 1.35)', offset: 0.44 },
    { transform: 'scale(1.08, 1.18)', offset: 0.56 }, { transform: 'scale(1.2, 1.32)', offset: 0.68 },
    { transform: 'scale(1.1, 1.2)', opacity: 1, offset: 0.86 }, { transform: 'translateY(-30px) scale(.6)', opacity: 0 },
  ], 2400);
  spray(x, y - 40, ['✨', '🌟'], 8, { dist: 150, size: '1.3rem', delay: 600, from: 220, to: 320, fall: -40, dur: 1200 });
  spray(x, y - 60, ['💨'], 4, { dist: 70, size: '1.8rem', delay: 1300, from: 240, to: 300, fall: -30, dur: 1100 });
  // Розжарення — окремий шар поверх листа, що змінює лише прозорість (сам лист не перемальовується щокадру)
  const glow = shape('fx-glow', r.left, r.top);
  glow.style.width = `${r.width}px`;
  glow.style.height = `${r.height}px`;
  glow.style.borderRadius = getComputedStyle(el).borderRadius;
  gone(glow)(glow.animate([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0.8, offset: 0.7 }, { opacity: 0 }],
    { duration: 2400, easing: 'ease-in-out' }));
};

// «Добраніч» 😴: екран тихо темніє, випливає місяць, летять «Z z z», запалюються зірки, смайлик сонно гойдається
REACT_FX['😴'] = (el, x, y) => {
  veil('fx-night', [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.78 }, { opacity: 0 }], 3000, 0, x, y);
  big('😴', x, y, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.15 },
    { transform: 'scale(1.06) rotate(-6deg)', offset: 0.32 }, { transform: 'scale(1) rotate(5deg)', offset: 0.5 },
    { transform: 'scale(1.06) rotate(-6deg)', offset: 0.68 }, { transform: 'scale(1) rotate(3deg)', opacity: 1, offset: 0.86 },
    { transform: 'scale(.8) rotate(0)', opacity: 0 },
  ], 2900);
  const moon = glyphAt('🌙', Math.min(innerWidth - 40, x + 96), Math.max(50, y - 120), '3.4rem', 'fx-moon');
  gone(moon)(moon.animate([
    { transform: `${C} translateY(30px) rotate(-30deg)`, opacity: 0 }, { transform: `${C} rotate(0)`, opacity: 1, offset: 0.25 },
    { transform: `${C} rotate(8deg)`, opacity: 1, offset: 0.85 }, { transform: `${C} rotate(10deg)`, opacity: 0 },
  ], { duration: 2700, delay: 200, easing: 'ease-out', fill: 'backwards' }));
  [[400, 1.3], [800, 1.7], [1200, 2.1], [1700, 1.3], [2050, 1.7]].forEach(([d, size], i) => {
    const z = glyphAt(i % 3 === 2 ? 'Z' : 'z', x + 42, y - 30, `${size}rem`, 'fx-zzz');
    gone(z)(z.animate([
      { transform: `${C} scale(.3)`, opacity: 0 }, { transform: `translate(calc(-50% + 18px), calc(-50% - 24px)) rotate(-10deg)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + 46px), calc(-50% - 70px)) rotate(8deg)`, opacity: 1, offset: 0.7 },
      { transform: `translate(calc(-50% + 64px), calc(-50% - 104px)) rotate(-6deg)`, opacity: 0 },
    ], { duration: 1300, delay: d, easing: 'ease-out', fill: 'backwards' }));
  });
  for (let i = 0; i < 6; i += 1) {
    twinkle(i % 2 ? '✨' : '⭐', 24 + Math.random() * (innerWidth - 48), 40 + Math.random() * Math.max(80, y - 80),
      `${0.9 + Math.random() * 0.6}rem`, 500 + i * 280, 900);
  }
};

// «Обіймаю» 🤗: долоні лягають на лівий і правий край листа, трохи стискають його й погойдують разом з ним;
// смайлик визирає з-за верхнього краю, з обіймів — сердечка
// Найближчий предок, що прокручується (стрічка «Письма»)
function scroller(el) {
  for (let p = el?.parentElement; p && p !== document.body; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}
// Обійми: [момент 0..1, стиснення по ширині, нахил у градусах]
const HUG = [[0, 1, 0], [0.18, 0.95, 0], [0.34, 0.95, -2.2], [0.52, 0.955, 2], [0.7, 0.95, -1.6], [0.84, 0.96, 0.8], [1, 1, 0]];
const HUG_MS = 1700;
const HUG_AT = 420;
REACT_FX['🤗'] = (el, x, y, r) => {
  // Довгий лист чи частково під шапкою — тримаємо за видиму в стрічці частину
  const box = scroller(el)?.getBoundingClientRect();
  const top = Math.max(64, box?.top ?? 0);
  const bottom = Math.min(innerHeight - 84, box?.bottom ?? innerHeight);
  const vt = Math.max(r.top, top);
  const vb = Math.max(vt + 40, Math.min(r.bottom, bottom));
  const hy = (vt + vb) / 2;
  const cx = (r.left + r.right) / 2;
  const half = r.width / 2;
  // Точка, навколо якої гойдається лист (центр пузиря), — щоб долоні йшли разом з його краями
  const cy = (r.top + r.bottom) / 2;
  // Обидві долоні — той самий 🫱, права віддзеркалена: 🫲 на деяких телефонах намальована інакше й дивиться не туди
  for (const side of [-1, 1]) {
    const flip = side > 0 ? ' scaleX(-1)' : '';
    const hx = clamp(cx + side * (half + 2), 22, innerWidth - 22);
    const hnd = glyphAt('🫱', hx, hy, '3rem', 'fx-big');
    const at = (sx, rot) => {
      const rad = (rot * Math.PI) / 180;
      const dx = -side * half * (1 - sx) + side * half * (Math.cos(rad) - 1) - (hy - cy) * Math.sin(rad);
      const dy = side * half * Math.sin(rad) + (hy - cy) * (Math.cos(rad) - 1);
      return `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px)) rotate(${rot}deg)${flip}`;
    };
    const t0 = HUG_AT / (HUG_AT + HUG_MS + 380);
    const span = HUG_MS / (HUG_AT + HUG_MS + 380);
    gone(hnd)(hnd.animate([
      { transform: `translate(calc(-50% + ${side * 60}px), -50%) rotate(${side * 25}deg)${flip}`, opacity: 0 },
      { transform: at(1, 0), opacity: 1, offset: t0 * 0.85 },
      ...HUG.slice(1, -1).map(([o, sx, rot]) => ({ transform: at(sx, rot), offset: t0 + o * span })),
      { transform: at(1, 0), opacity: 1, offset: t0 + span },
      { transform: `translate(calc(-50% + ${side * 40}px), -50%)${flip}`, opacity: 0 },
    ], { duration: HUG_AT + HUG_MS + 380, delay: 100, easing: 'ease-in-out', fill: 'backwards' }));
  }
  jolt(el, HUG.map(([o, sx, rot]) => ({ transform: sx === 1 && !rot ? 'none' : `scale(${sx}, ${(2 - sx).toFixed(3)}) rotate(${rot}deg)`, offset: o })),
    HUG_MS, 100 + HUG_AT);
  big('🤗', cx, Math.max(vt, top + 20) + 4, [
    { transform: 'translateY(16px) scale(.3)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.16 },
    { transform: 'scale(1)', offset: 0.28 }, { transform: 'scale(1) rotate(-7deg)', offset: 0.46 },
    { transform: 'scale(1.05) rotate(6deg)', offset: 0.6 }, { transform: 'scale(1) rotate(-4deg)', offset: 0.72 },
    { transform: 'scale(1)', opacity: 1, offset: 0.86 }, { transform: 'scale(.7)', opacity: 0 },
  ], 2600, '3.2rem');
  rise(cx, vt, ['💕', '💗', '🧡', '💖'], 8, { delay: 1300, up: 200, spread: Math.min(220, r.width) });
};

// «Сумно» 😢: над обличчям згущується хмарка й крапає дощиком, обличчя никне, котиться сльоза,
// а наостанок з-під хмарки підіймається маленьке сердечко — втішити
REACT_FX['😢'] = (el, x, y) => {
  veil('fx-gloom', [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], 2800, 0, x, y);
  big('😢', x, y, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.15 },
    { transform: 'translateY(6px) scale(1.05) rotate(-4deg)', offset: 0.4 }, { transform: 'translateY(12px) scale(1) rotate(3deg)', offset: 0.65 },
    { transform: 'translateY(14px) scale(1) rotate(0)', opacity: 1, offset: 0.88 }, { transform: 'translateY(20px) scale(.8)', opacity: 0 },
  ], 2700);
  const cloud = glyphAt('🌧️', x, y - 96, '4.2rem', 'fx-cloud');
  gone(cloud)(cloud.animate([
    { transform: `${C} translateY(-30px) scale(.4)`, opacity: 0 }, { transform: `${C} scale(1)`, opacity: 1, offset: 0.2 },
    { transform: `${C} translateX(-6px)`, opacity: 1, offset: 0.5 }, { transform: `${C} translateX(6px)`, opacity: 1, offset: 0.8 },
    { transform: `${C} translateY(-20px) scale(.9)`, opacity: 0 },
  ], { duration: 2600, delay: 150, easing: 'ease-out', fill: 'backwards' }));
  for (let i = 0; i < 8; i += 1) {
    const d = glyphAt('💧', x - 34 + Math.random() * 68, y - 76, `${0.8 + Math.random() * 0.4}rem`);
    gone(d)(d.animate([
      { transform: `${C} scale(.6)`, opacity: 0 }, { transform: `${C} scale(1)`, opacity: 0.9, offset: 0.15 },
      { transform: 'translate(-50%, calc(-50% + 70px)) scale(.9)', opacity: 0 },
    ], { duration: 650, delay: 500 + i * 170 + Math.random() * 80, easing: 'ease-in', fill: 'backwards' }));
  }
  const t = glyphAt('💧', x - 26, y + 10, '1.8rem');
  gone(t)(t.animate([
    { transform: `${C} scale(.3)`, opacity: 0 }, { transform: `${C} scale(1)`, opacity: 1, offset: 0.2 },
    { transform: 'translate(calc(-50% - 4px), calc(-50% + 60px)) scale(1)', opacity: 1, offset: 0.7 },
    { transform: 'translate(-50%, calc(-50% + 110px)) scale(.8)', opacity: 0 },
  ], { duration: 1300, delay: 900, easing: 'ease-in', fill: 'backwards' }));
  const h = glyphAt('💗', x + 50, y + 40, '2rem');
  gone(h)(h.animate([
    { transform: `${C} scale(.2)`, opacity: 0 }, { transform: `${C} scale(1.15)`, opacity: 1, offset: 0.3 },
    { transform: 'translate(-50%, calc(-50% - 50px)) scale(1)', opacity: 1, offset: 0.75 },
    { transform: 'translate(-50%, calc(-50% - 80px)) scale(.8)', opacity: 0 },
  ], { duration: 1200, delay: 1900, easing: 'ease-out', fill: 'backwards' }));
};

// «Догори дриґом» 🙃: 🙂 повільно перевертається, слідом перевертається весь екран, довкола вискакують «¿» і «¡»
REACT_FX['🙃'] = (el, x, y) => {
  big('🙂', x, y, [
    { transform: 'scale(.3) rotate(0)', opacity: 0 }, { transform: 'scale(1.1) rotate(0)', opacity: 1, offset: 0.15 },
    { transform: 'scale(1.1) rotate(200deg)', offset: 0.45 }, { transform: 'scale(1.12) rotate(170deg)', offset: 0.55 },
    { transform: 'scale(1.1) rotate(185deg)', offset: 0.65 }, { transform: 'scale(1.1) rotate(180deg)', opacity: 1, offset: 0.88 },
    { transform: 'scale(.8) rotate(180deg)', opacity: 0 },
  ], 3000);
  // Весь екран перевертається догори дриґом і повертається; смайлик крутиться разом з ним — тож на перевернутому екрані він рівний
  const body = document.body;
  body.style.transformOrigin = `${innerWidth / 2}px ${scrollY + innerHeight / 2}px`;
  body.animate([
    { transform: 'none' }, { transform: 'rotate(180deg)', offset: 0.3 },
    { transform: 'rotate(180deg)', offset: 0.72 }, { transform: 'rotate(360deg)' },
  ], { duration: 2500, delay: 500, easing: 'cubic-bezier(.65, 0, .35, 1)' }).finished.finally(() => { body.style.transformOrigin = ''; });
  ['¿', '¡', '¿', '¡', '¿'].forEach((g, i) => {
    const a = ((200 + i * 35 + (Math.random() - 0.5) * 16) * Math.PI) / 180;
    const d = 110 + Math.random() * 30;
    const rot = 180 + (Math.random() - 0.5) * 40;
    const s = glyphAt(g, x + Math.cos(a) * d, y + Math.sin(a) * d, `${2 + Math.random() * 0.6}rem`, 'fx-ha');
    gone(s)(s.animate([
      { transform: `${C} scale(.2) rotate(0)`, opacity: 0 }, { transform: `${C} scale(1.15) rotate(${rot}deg)`, opacity: 1, offset: 0.3 },
      { transform: `translate(-50%, calc(-50% - 14px)) rotate(${rot}deg)`, opacity: 1, offset: 0.75 },
      { transform: `translate(-50%, calc(-50% - 24px)) scale(.9) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 1350, delay: 540 + i * 200, easing: 'ease-out', fill: 'backwards' }));
  });
};

// «На удачу» 🍀: конюшина виростає, розкручуючись, на кожному листку блимає іскра, злітають маленькі 🍀 і монетки
REACT_FX['🍀'] = (el, x, y) => {
  big('🍀', x, y, [
    { transform: 'scale(.1) rotate(-220deg)', opacity: 0 }, { transform: 'scale(1.2) rotate(15deg)', opacity: 1, offset: 0.25 },
    { transform: 'scale(1.05) rotate(-6deg)', offset: 0.4 }, { transform: 'scale(1.1) rotate(0)', offset: 0.55 },
    { transform: 'scale(1.1) rotate(0)', opacity: 1, offset: 0.86 }, { transform: 'scale(.8) rotate(10deg)', opacity: 0 },
  ], 2700, '6.4rem');
  ring(x, y, 500, 'is-gold');
  [[-26, -26], [26, -26], [26, 26], [-26, 26]].forEach(([dx, dy], i) => twinkle('✨', x + dx, y + dy, '1.6rem', 700 + i * 160));
  rise(x, y + 30, ['🍀', '✨', '🍀', '🪙'], 10, { delay: 800, up: 300, spread: 280, size: 1.3 });
  const say = glyphAt('На удачу!', x, y + 76, '1.8rem', 'fx-say');
  gone(say)(say.animate([
    { transform: `${C} translateY(10px) scale(.6)`, opacity: 0 }, { transform: `${C} scale(1.08)`, opacity: 1, offset: 0.25 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.8 }, { transform: `${C}`, opacity: 0 },
  ], { duration: 1400, delay: 1100, fill: 'backwards' }));
};

// «На все сто» 💯: падає згори печаткою — бух! — повідомлення здригається, золоті хвилі й іскри
REACT_FX['💯'] = (el, x, y) => {
  big('💯', x, y, [
    { transform: 'scale(2.8) rotate(-14deg)', opacity: 0 }, { transform: 'scale(.92) rotate(-8deg)', opacity: 1, offset: 0.16, easing: 'ease-out' },
    { transform: 'scale(1.08) rotate(-8deg)', offset: 0.24 }, { transform: 'scale(1) rotate(-8deg)', offset: 0.32 },
    { transform: 'scale(1) rotate(-8deg)', opacity: 1, offset: 0.86 }, { transform: 'scale(.8) rotate(-8deg)', opacity: 0 },
  ], 2500, '6.2rem');
  jolt(el, [{ transform: 'none' }, { transform: 'translateY(5px) scale(.97)' }, { transform: 'translateY(-2px)' }, { transform: 'none' }], 320, 380);
  ring(x, y, 400, 'is-gold');
  ring(x, y, 600, 'is-gold');
  spray(x, y, ['✨', '⭐'], 10, { delay: 420, dist: 140, size: '1.5rem' });
  const say = glyphAt('На все сто!', x, y + 76, '1.8rem', 'fx-say');
  gone(say)(say.animate([
    { transform: `${C} translateY(10px) scale(.6)`, opacity: 0 }, { transform: `${C} scale(1.08)`, opacity: 1, offset: 0.25 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.8 }, { transform: `${C}`, opacity: 0 },
  ], { duration: 1300, delay: 900, fill: 'backwards' }));
};

// «Веселка» 🌈: дуга виростає над повідомленням, на кінцях спалахують іскорки, згори сиплються різнокольорові сердечка
REACT_FX['🌈'] = (el, x, y) => {
  big('🌈', x, y - 20, [
    { transform: 'translateY(40px) scale(.2) rotate(-25deg)', opacity: 0 }, { transform: 'scale(1.12) rotate(4deg)', opacity: 1, offset: 0.3 },
    { transform: 'scale(1) rotate(0)', offset: 0.42 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.82 }, { transform: 'translateY(-30px) scale(.8)', opacity: 0 },
  ], 2600, '6rem');
  for (const dx of [-62, 62]) for (let k = 0; k < 3; k += 1) twinkle(k % 2 ? '✨' : '⭐', x + dx + (Math.random() - 0.5) * 24, y + 14 + (Math.random() - 0.5) * 18, '1.3rem', 650 + k * 260);
  rise(x, y + 30, ['💜', '💙', '💚', '💛', '🧡', '❤️'], 9, { delay: 900, up: 220, spread: 220, size: 1 });
  // Долоні розʼїжджаються від центру — ніби малюють дугу між собою
  for (const [g, side] of [['🫲', -1], ['🫱', 1]]) {
    const hand = glyphAt(g, x, y + 22, '3rem');
    gone(hand)(hand.animate([
      { transform: `${C} scale(.4)`, opacity: 0 },
      { transform: `translate(calc(-50% + ${side * 22}px), -50%) scale(1)`, opacity: 1, offset: 0.12 },
      { transform: `translate(calc(-50% + ${side * 92}px), calc(-50% - 14px)) rotate(${side * 14}deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(calc(-50% + ${side * 96}px), calc(-50% - 14px)) rotate(${side * 14}deg)`, opacity: 1, offset: 0.82 },
      { transform: `translate(calc(-50% + ${side * 110}px), calc(-50% - 20px)) scale(.7)`, opacity: 0 },
    ], { duration: 2800, easing: 'ease-out', fill: 'backwards' }));
  }
  // «Воображение» — кожна буква свого кольору веселки, проступає зліва направо
  const word = shape('fx-imagine', x, y + 86);
  for (const ch of 'Воображение') word.append(Object.assign(document.createElement('span'), { textContent: ch }));
  gone(word)(word.animate([
    { transform: `${C} scale(.7)`, clipPath: 'inset(-20px 100% -20px -20px)', opacity: 1 },
    { transform: `${C} scale(1.06)`, clipPath: 'inset(-20px -20px -20px -20px)', opacity: 1, offset: 0.35 },
    { transform: `${C} scale(1)`, clipPath: 'inset(-20px -20px -20px -20px)', opacity: 1, offset: 0.86 },
    { transform: `${C} translateY(-8px)`, clipPath: 'inset(-20px -20px -20px -20px)', opacity: 0 },
  ], { duration: 2300, delay: 350, easing: 'ease-out', fill: 'backwards' }));
};

// «Хитренько» 😏: прищур і підморгування (стиск по вертикалі), брова вгору — нахил, поруч пробігає вогник
REACT_FX['😏'] = (el, x, y) => {
  big('😏', x, y, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.1) rotate(-6deg)', opacity: 1, offset: 0.18 },
    { transform: 'scale(1) rotate(-8deg)', offset: 0.32 }, { transform: 'scale(1.05, .86) rotate(-8deg)', offset: 0.44 },
    { transform: 'scale(1) rotate(6deg)', offset: 0.56 }, { transform: 'scale(1.02) rotate(4deg)', opacity: 1, offset: 0.86 }, { transform: 'scale(.6)', opacity: 0 },
  ], 2400, '5.6rem');
  const f = glyphAt('🔥', x - 110, y + 46, '1.6rem');
  gone(f)(f.animate([
    { transform: `${C} scale(.3)`, opacity: 0 }, { transform: 'translate(calc(-50% + 40px), calc(-50% - 6px)) scale(1)', opacity: 1, offset: 0.25 },
    { transform: 'translate(calc(-50% + 150px), calc(-50% + 4px)) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translate(calc(-50% + 220px), -50%) scale(.4)', opacity: 0 },
  ], { duration: 1300, delay: 700, easing: 'ease-in-out', fill: 'backwards' }));
  twinkle('✨', x + 46, y - 40, '1.4rem', 1050);
};

// «Наш Юпітер» 🪐: Юпітер пропливає екраном по дузі, за ним летить сердечко — як у листівці «Вместе»
REACT_FX['🪐'] = (el, x, y) => {
  const path = (from, k) => [
    { transform: `translate(calc(-50% + ${from}px), calc(-50% + 50px)) scale(.4) rotate(-20deg)`, opacity: 0 },
    { transform: `translate(calc(-50% + ${from * 0.5}px), calc(-50% - 20px)) scale(${k}) rotate(-6deg)`, opacity: 1, offset: 0.3 },
    { transform: `translate(-50%, calc(-50% - 34px)) scale(${k}) rotate(0)`, opacity: 1, offset: 0.55 },
    { transform: `translate(calc(-50% + ${-from * 0.5}px), calc(-50% - 20px)) scale(${k}) rotate(6deg)`, opacity: 1, offset: 0.8 },
    { transform: `translate(calc(-50% + ${-from}px), calc(-50% + 50px)) scale(.4) rotate(20deg)`, opacity: 0 },
  ];
  const j = glyphAt('🪐', x, y, '5.4rem', 'fx-big');
  gone(j)(j.animate(path(-150, 1), { duration: 2600, easing: 'ease-in-out', fill: 'backwards' }));
  const h = glyphAt('❤️', x, y, '2rem');
  gone(h)(h.animate(path(-150, 0.9), { duration: 2600, delay: 320, easing: 'ease-in-out', fill: 'backwards' }));
  for (let k = 0; k < 6; k += 1) twinkle('✦', x - 120 + k * 48, y - 30 + (k % 2 ? -26 : 18), '1rem', 300 + k * 260, 600);
};

// «Стріла Стрільця» 🏹: лук біля краю, стріла-серце летить дугою й влучає в повідомлення — хвиля й сердечка
REACT_FX['🏹'] = (el, x, y) => {
  const bx = 70;
  const by = y + 120;
  big('🏹', bx, by, [
    { transform: 'scale(.3) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1) rotate(-12deg)', opacity: 1, offset: 0.25 },
    { transform: 'scale(.92, 1) rotate(-14deg)', offset: 0.4 }, { transform: 'scale(1.06) rotate(-10deg)', offset: 0.5 },
    { transform: 'scale(1) rotate(-12deg)', opacity: 1, offset: 0.8 }, { transform: 'scale(.6)', opacity: 0 },
  ], 2200, '4rem');
  const a = glyphAt('💘', bx, by, '2.4rem');
  const dx = x - bx;
  const dy = y - by;
  gone(a)(a.animate([
    { transform: `${C} scale(.6) rotate(-30deg)`, opacity: 0 },
    { transform: `translate(calc(-50% + ${dx * 0.1}px), calc(-50% + ${dy * 0.3 - 30}px)) scale(1) rotate(-20deg)`, opacity: 1, offset: 0.15 },
    { transform: `translate(calc(-50% + ${dx * 0.55}px), calc(-50% + ${dy * 0.85 - 70}px)) scale(1.05) rotate(5deg)`, opacity: 1, offset: 0.6 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.2) rotate(20deg)`, opacity: 1, offset: 0.9 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.4)`, opacity: 0 },
  ], { duration: 900, delay: 900, easing: 'cubic-bezier(.35, 0, .4, 1)', fill: 'backwards' }));
  ring(x, y, 1720, 'is-gold');
  spray(x, y, ['❤️', '💖', '✨'], 10, { delay: 1720, dist: 110, size: '1.4rem' });
  jolt(el, [{ transform: 'none' }, { transform: 'translateX(4px)' }, { transform: 'none' }], 220, 1720);
};

// «Лапки» 🐾: слідами через повідомлення пробігає улюбленець — лапки по черзі зліва направо, перевальцем
REACT_FX['🐾'] = (el, x, y, r) => {
  const n = 7;
  const w = Math.min(260, (r?.width || 240) + 40);
  for (let i = 0; i < n; i += 1) {
    const px = x - w / 2 + (w * i) / (n - 1);
    const py = y + (i % 2 ? -14 : 14);
    const s = glyphAt('🐾', px, py, '1.9rem');
    gone(s)(s.animate([
      { transform: `${C} scale(.2) rotate(${i % 2 ? 20 : -20}deg)`, opacity: 0 },
      { transform: `${C} scale(1.15) rotate(${i % 2 ? 12 : -12}deg)`, opacity: 1, offset: 0.2 },
      { transform: `${C} scale(1) rotate(${i % 2 ? 12 : -12}deg)`, opacity: 1, offset: 0.7 },
      { transform: `${C} scale(.9)`, opacity: 0 },
    ], { duration: 1500, delay: 200 + i * 190, easing: 'ease-out', fill: 'backwards' }));
  }
  rise(x + w / 2, y, ['💕'], 3, { delay: 200 + n * 190, up: 120, spread: 60, size: 1 });
};

// Лише 🤯: дрижить саме повідомлення, поки голова «закипає», і здригається на вибуху. Увесь екран не трусимо —
// на телефоні з довгою перепискою це був величезний шар і ривки. Час — як у рухах смайлика (× SLOW, бо з reactFx).
// Стрічку за 0,35 с перемальовують і пузир міняється на новий — тож у мить старту шукаємо живий пузир за ключем рядка
const quake = (el, frames, duration, delay = 0) => {
  const key = el?.closest?.('.feed-row')?.dataset.key;
  setTimeout(() => {
    const live = el?.isConnected ? el : key ? document.querySelector(`.feed-row[data-key="${CSS.escape(key)}"] .feed-bubble`) : null;
    if (!live) return;
    live.style.willChange = 'transform';
    // Тут уже поза reactFx — уповільнення × SLOW рахуємо самі
    const a = live.animate(frames, { duration: duration * SLOW, easing: 'linear' });
    a.onfinish = () => { if (!live.getAnimations().some((x) => x !== a && x.playState === 'running')) live.style.willChange = ''; };
  }, delay * SLOW);
};
// Плавне гойдання: кадр на ~16 мс, синусоїда з обвідною env(t) 0…1. px — розмах, cycles — скільки разів туди-назад, rot — нахил
const sway = (px, cycles, ms, env, rot = 0) => {
  const n = Math.max(12, Math.round(ms / 16));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const k = env(t);
    const a = 2 * Math.PI * cycles * t;
    const x = px * k * Math.sin(a);
    const y = px * 0.3 * k * Math.sin(a * 1.5 + 1);
    return { transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${(rot * k * Math.sin(a + 0.6)).toFixed(3)}deg)` };
  });
};
// Дрож наростає й спадає на нулі якраз перед вибухом; вибух — різкий старт і довге затухання
const swell = (t) => Math.sin(Math.PI * t) ** 2 * (0.4 + 0.6 * t);
const decay = (t) => (1 - t) ** 2.2 * Math.min(1, t * 12);
const QUAKE = {
  // Повідомлення менше за екран — розмах трохи більший, з нахилом
  '🤯': (el) => { quake(el, sway(2.4, 6, 700, swell, 0.8), 700, 330); quake(el, sway(10, 4.5, 800, decay, 2.2), 800, 1030); },
};

let fxCalm = 0;
export function reactFx(el, glyph) {
  if (glyph && el?.isConnected) sfx('react');
  if (reduceMotion || !el?.isConnected || !glyph) return;
  // Поки йде реакція, тло не їздить за нахилом (depth.js) — відеокарта зайнята лише смайликами
  const root = document.documentElement;
  root.classList.add('is-fx');
  clearTimeout(fxCalm);
  fxCalm = setTimeout(() => root.classList.remove('is-fx'), (DUR[glyph] || 1600) * SLOW + 200);
  const r = el.getBoundingClientRect();
  // Центр — над повідомленням, але так, щоб уся анімація влізла в екран
  const x = clamp(r.left + r.width / 2, 125, innerWidth - 125);
  const y = clamp(r.top + Math.min(r.height / 2, 70), 185, innerHeight - 205);
  const fx = REACT_FX[glyph];
  // Усі рухи реакції створюються тут синхронно — на цей час кожен animate() отримує тривалість і затримку × SLOW
  const animate = Element.prototype.animate;
  Element.prototype.animate = function slowed(frames, o) {
    return animate.call(this, frames, typeof o === 'number' ? o * SLOW : { ...o, duration: (o?.duration || 0) * SLOW, delay: (o?.delay || 0) * SLOW });
  };
  try {
    QUAKE[glyph]?.(el);
    if (fx) fx(el, x, y, r);
    else {
      big(glyph, x, y, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.3 }, { transform: 'scale(1)', opacity: 1, offset: 0.8 }, { transform: 'scale(.6)', opacity: 0 }], 1300);
      spray(x, y, [glyph], 8, { delay: 300 });
    }
  } finally {
    Element.prototype.animate = animate;
  }
}

// «🔔 Звоночек»: дзвіночок гойдається вгорі екрана, згори сиплються пелюстки сакури (у нього — зорі).
// incoming — у того, кого кличуть: густіше й довше; у того, хто трусив, — коротко, що полетіло
export function bellFx(incoming = true) {
  if (reduceMotion) return;
  const x = innerWidth / 2;
  const y = Math.min(innerHeight * 0.3, 240);
  big('🔔', x, y, [
    { transform: 'scale(.3) rotate(0)', opacity: 0 },
    { transform: 'scale(1.15) rotate(-24deg)', opacity: 1, offset: 0.1 },
    { transform: 'scale(1.1) rotate(22deg)', offset: 0.22 },
    { transform: 'scale(1.1) rotate(-18deg)', offset: 0.34 },
    { transform: 'scale(1.1) rotate(14deg)', offset: 0.46 },
    { transform: 'scale(1.1) rotate(-8deg)', offset: 0.58 },
    { transform: 'scale(1.1) rotate(0)', opacity: 1, offset: 0.8 },
    { transform: 'scale(.8) rotate(0)', opacity: 0 },
  ], incoming ? 3400 : 2000, '6.6rem');
  [150, 500, ...(incoming ? [850, 1200] : [])].forEach((d) => ring(x, y, d));
  const her = document.documentElement.dataset.side !== 'vin';
  const glyphs = her ? ['🌸'] : ['✨', '⭐', '🌟'];
  const n = incoming ? 28 : 12;
  for (let i = 0; i < n; i += 1) {
    const s = glyphAt(glyphs[i % glyphs.length], Math.random() * innerWidth, -40, `${1.3 + Math.random() * 1.1}rem`);
    const sway = (Math.random() - 0.5) * 120;
    const fall = innerHeight + 80;
    const rot = (Math.random() - 0.5) * 540;
    gone(s)(s.animate([
      { transform: `${C} translate(0, 0) rotate(0)`, opacity: 0 },
      { transform: `${C} translate(${sway * 0.4}px, ${fall * 0.2}px) rotate(${rot * 0.2}deg)`, opacity: 1, offset: 0.12 },
      { transform: `${C} translate(${-sway * 0.3}px, ${fall * 0.6}px) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.6 },
      { transform: `${C} translate(${sway}px, ${fall}px) rotate(${rot}deg)`, opacity: 0.2 },
    ], { duration: 2600 + Math.random() * 1600, delay: Math.random() * (incoming ? 1800 : 700), easing: 'linear', fill: 'backwards' }));
  }
}

// Кілька реакцій прийшли разом — граємо по черзі, а не купою
let fxQueue = Promise.resolve();
export function reactFxQueued(el, glyph) {
  fxQueue = fxQueue.then(() => {
    if (!el?.isConnected || reduceMotion) return undefined;
    reactFx(el, glyph);
    return new Promise((ok) => { setTimeout(ok, (DUR[glyph] || 2200) * SLOW - 400); });
  });
}


// «Цьом» 😘: смайлик підморгує, з губ вилітає поцілунок і лишає великий відбиток 💋, довкола сердечка
REACT_FX['😘'] = (el, x, y) => {
  big('😘', x - 50, y + 24, [
    { transform: 'scale(.3) rotate(-15deg)', opacity: 0 }, { transform: 'scale(1.1) rotate(5deg)', opacity: 1, offset: 0.18 },
    { transform: 'scale(1) rotate(0)', offset: 0.3 }, { transform: 'scale(1.15) translateX(6px)', offset: 0.38 },
    { transform: 'scale(1)', opacity: 1, offset: 0.8 }, { transform: 'scale(.6)', opacity: 0 },
  ], 2600, '5.6rem');
  const kiss = glyphAt('💋', x - 26, y + 24, '2.2rem');
  const at = 'translate(calc(-50% + 70px), calc(-50% - 74px))';
  gone(kiss)(kiss.animate([
    { transform: `${C} scale(.3)`, opacity: 0 },
    { transform: 'translate(calc(-50% + 10px), calc(-50% - 20px)) scale(.8)', opacity: 1, offset: 0.15 },
    { transform: 'translate(calc(-50% + 50px), calc(-50% - 96px)) scale(1.6) rotate(-10deg)', opacity: 1, offset: 0.45 },
    { transform: `${at} scale(2.7) rotate(-14deg)`, opacity: 1, offset: 0.55 },
    { transform: `${at} scale(2.2) rotate(-14deg)`, opacity: 1, offset: 0.85 },
    { transform: `${at} scale(2.4) rotate(-14deg)`, opacity: 0 },
  ], { duration: 2000, delay: 700, easing: 'ease-out', fill: 'backwards' }));
  spray(x + 44, y - 50, ['💕', '💗', '✨'], 8, { dist: 110, size: '1.3rem', delay: 1500 });
};

// «Оплески» 👏: долоні плескають чотири рази, на кожен хлопок — зірочки, а лист ледь здригається
REACT_FX['👏'] = (el, x, y) => {
  const D = 2500;
  const claps = [0.18, 0.33, 0.48, 0.63];
  const frames = [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.12 }];
  for (const o of claps) frames.push({ transform: 'scale(1.18, .9) rotate(-4deg)', offset: o }, { transform: 'scale(1) rotate(3deg)', offset: o + 0.07 });
  frames.push({ transform: 'scale(1)', opacity: 1, offset: 0.88 }, { transform: 'scale(.6)', opacity: 0 });
  big('👏', x, y, frames, D, '5.8rem');
  for (const o of claps) {
    spray(x, y - 10, ['✨', '⭐', '🌟'], 6, { dist: 120, size: '1.2rem', delay: o * D, dur: 800 });
    jolt(el, [{ transform: 'none' }, { transform: 'scale(1.02)' }, { transform: 'none' }], 180, o * D);
  }
};

// «Хлопавка» 🎉: хлопавка бахкає, з неї віялом летить конфеті, а згори на весь екран сиплеться кольорове
REACT_FX['🎉'] = (el, x, y) => {
  big('🎉', x - 40, y + 40, [
    { transform: 'scale(.3) rotate(20deg)', opacity: 0 }, { transform: 'scale(1.1) rotate(-10deg)', opacity: 1, offset: 0.15 },
    { transform: 'scale(1.35) rotate(-25deg)', offset: 0.24 }, { transform: 'scale(1) rotate(-15deg)', offset: 0.34 },
    { transform: 'scale(1) rotate(-15deg)', opacity: 1, offset: 0.85 }, { transform: 'scale(.6)', opacity: 0 },
  ], 2600, '5.4rem');
  spray(x - 10, y + 10, ['🎊', '✨', '🎉', '💥'], 12, { dist: 170, size: '1.5rem', delay: 550, from: 250, to: 350, fall: 60, dur: 1100 });
  const bits = ['🎊', '✨', '💛', '💜', '💗', '💙', '🎉'];
  for (let i = 0; i < 22; i += 1) {
    const s = glyphAt(bits[i % bits.length], 16 + Math.random() * (innerWidth - 32), -20, `${0.9 + Math.random() * 0.8}rem`);
    const down = innerHeight * (0.55 + Math.random() * 0.4);
    const drift = (Math.random() - 0.5) * 80;
    gone(s)(s.animate([
      { transform: C, opacity: 0 },
      { transform: `translate(calc(-50% + ${drift * 0.3}px), calc(-50% + ${down * 0.2}px)) rotate(90deg)`, opacity: 1, offset: 0.15 },
      { transform: `translate(calc(-50% + ${drift}px), calc(-50% + ${down}px)) rotate(${300 + Math.random() * 200}deg)`, opacity: 0 },
    ], { duration: 1800 + Math.random() * 700, delay: 700 + Math.random() * 600, easing: 'cubic-bezier(.3, .6, .5, 1)', fill: 'backwards' }));
  }
};

// «Пишаюсь» 💪: рука напружується двічі, біцепс «надувається» дедалі більше — хвиля й іскри
REACT_FX['💪'] = (el, x, y) => {
  big('💪', x, y, [
    { transform: 'translateX(-30px) scale(.3) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.15 },
    { transform: 'scale(1.12) rotate(-6deg)', offset: 0.28 }, { transform: 'scale(1) rotate(0)', offset: 0.36 },
    { transform: 'scale(1.28) rotate(-8deg)', offset: 0.5 }, { transform: 'scale(1.15) rotate(-4deg)', offset: 0.58 },
    { transform: 'scale(1.38) rotate(-10deg)', offset: 0.68 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.86 },
    { transform: 'scale(.7)', opacity: 0 },
  ], 2600, '5.8rem');
  ring(x, y, 1700);
  spray(x, y, ['⚡', '✨', '🌟'], 10, { dist: 140, size: '1.4rem', delay: 1720, dur: 900 });
};

// «Соромлюсь» 🙈: мавпочка ховає очі, на мить визирає 🐵 — і знову ховається, довкола рум'яні сердечка
REACT_FX['🙈'] = (el, x, y) => {
  big('🙈', x, y, [
    { transform: 'scale(.3) rotate(-10deg)', opacity: 0 }, { transform: 'scale(1.1) rotate(4deg)', opacity: 1, offset: 0.14 },
    { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.34 }, { transform: 'scale(1)', opacity: 0, offset: 0.38 },
    { transform: 'scale(1)', opacity: 0, offset: 0.52 }, { transform: 'scale(1.08) rotate(-5deg)', opacity: 1, offset: 0.56 },
    { transform: 'scale(1) rotate(3deg)', offset: 0.7 }, { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.88 },
    { transform: 'scale(.6)', opacity: 0 },
  ], 2600, '5.8rem');
  bigLater('🐵', x, y, [
    { transform: 'scale(1)', opacity: 0 }, { transform: 'scale(1.05) translateY(-4px)', opacity: 1, offset: 0.12 },
    { transform: 'scale(1.05) translateY(-4px)', opacity: 1, offset: 0.85 }, { transform: 'scale(1)', opacity: 0 },
  ], 420, 2600 * 0.36, '5.8rem');
  jolt(el, [{ transform: 'none' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], 420, 1460);
  spray(x, y - 20, ['💗', '💕', '🌸'], 9, { dist: 120, size: '1.3rem', delay: 1500 });
};

// «Цікаво» 👀: очі бігають ліворуч-праворуч, потім пильно нахиляються до листа; довкола спалахують іскорки
REACT_FX['👀'] = (el, x, y) => {
  big('👀', x, y, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.12 },
    { transform: 'translateX(-26px) scale(1.1)', offset: 0.24 }, { transform: 'translateX(26px) scale(1.1)', offset: 0.38 },
    { transform: 'translateX(-20px) scale(1.1)', offset: 0.5 }, { transform: 'translateX(0) scale(1.1)', offset: 0.6 },
    { transform: 'translateY(24px) scale(1.35)', opacity: 1, offset: 0.74 }, { transform: 'translateY(24px) scale(1.3)', opacity: 1, offset: 0.88 },
    { transform: 'translateY(30px) scale(.8)', opacity: 0 },
  ], 2600, '5.4rem');
  jolt(el, [{ transform: 'none' }, { transform: 'scale(1.03)' }, { transform: 'none' }], 300, 1900);
  [[-70, -40, 1900], [76, -26, 2020], [-50, 58, 2140], [64, 62, 2260]].forEach(([dx, dy, d]) => twinkle('✨', x + dx, y + dy, '1.5rem', d));
};

// «Ой-ой» 😱: крик — обличчя тремтить, навсібіч розлітаються «!», лист підскакує від переляку
REACT_FX['😱'] = (el, x, y) => {
  const frames = [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.25, 1.35)', opacity: 1, offset: 0.12 }];
  for (let i = 0; i < 8; i += 1) frames.push({ transform: `scale(1.2, 1.3) rotate(${i % 2 ? 6 : -6}deg)`, offset: 0.16 + i * 0.05 });
  frames.push({ transform: 'scale(1.05) rotate(0)', opacity: 1, offset: 0.86 }, { transform: 'scale(.7)', opacity: 0 });
  big('😱', x, y, frames, 2500, '5.8rem');
  ring(x, y, 250);
  ring(x, y, 520);
  spray(x, y, ['❗', '‼️', '⚡'], 12, { dist: 150, size: '1.6rem', delay: 300, fall: 0, dur: 1100 });
  jolt(el, [{ transform: 'none' }, { transform: 'translateY(-14px)', offset: 0.35 }, { transform: 'translateY(3px)', offset: 0.7 }, { transform: 'none' }], 420, 260);
};

// «Хм» 🤔: задумливо гойдається, над головою спливають «?», а потім — дзинь! — загоряється 💡
REACT_FX['🤔'] = (el, x, y) => {
  big('🤔', x, y + 20, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.05)', opacity: 1, offset: 0.14 },
    { transform: 'rotate(-8deg) scale(1.05)', offset: 0.3 }, { transform: 'rotate(6deg) scale(1.05)', offset: 0.46 },
    { transform: 'rotate(-4deg) scale(1.05)', offset: 0.58 }, { transform: 'rotate(0) scale(1.15)', offset: 0.68 },
    { transform: 'scale(1.1)', opacity: 1, offset: 0.88 }, { transform: 'scale(.7)', opacity: 0 },
  ], 2700, '5.6rem');
  [[-1, 300], [1, 650], [-1, 1000]].forEach(([s, d], i) => {
    const q = glyphAt('❓', x + s * (48 + i * 8), y - 40, `${1.4 + i * 0.25}rem`);
    gone(q)(q.animate([
      { transform: `${C} scale(.2)`, opacity: 0 }, { transform: `${C} scale(1.1) rotate(${s * 12}deg)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${s * 10}px), calc(-50% - 50px)) rotate(${-s * 10}deg)`, opacity: 1, offset: 0.75 },
      { transform: `translate(calc(-50% + ${s * 14}px), calc(-50% - 74px)) scale(.8)`, opacity: 0 },
    ], { duration: 1000, delay: d, easing: 'ease-out', fill: 'backwards' }));
  });
  bigLater('💡', x, y - 70, [
    { transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.3)', opacity: 1, offset: 0.2 },
    { transform: 'scale(1)', opacity: 1, offset: 0.35 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.8 },
    { transform: 'translateY(-20px) scale(.6)', opacity: 0 },
  ], 1200, 1650, '3.4rem');
  ring(x, y - 70, 1800, 'is-gold');
  spray(x, y - 70, ['✨', '⭐'], 8, { dist: 90, size: '1.1rem', delay: 1850, dur: 800 });
};

// «Троянда» 🌹: екран теплішає, велика троянда виростає знизу й розпускається — вибух пелюсток колом,
// хвилі, іскри; потім на весь екран згори падає пелюстковий дощ, а з троянди злітають сердечка
REACT_FX['🌹'] = (el, x, y) => {
  veil('fx-rose', [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], 4000, 0, x, y);
  // Довгий стебель із листком домальовано під смайлом (CSS .fx-rose-big) — гойдається разом із квіткою
  big('🌹', x, y - 50, [
    { transform: 'translateY(160px) scale(.15) rotate(-30deg)', opacity: 0 },
    { transform: 'translateY(20px) scale(.8) rotate(8deg)', opacity: 1, offset: 0.14 },
    { transform: 'scale(.9) rotate(-6deg)', offset: 0.22 },
    { transform: 'scale(1.35) rotate(4deg)', offset: 0.3 },
    { transform: 'scale(1.1) rotate(-5deg)', offset: 0.42 }, { transform: 'scale(1.15) rotate(5deg)', offset: 0.56 },
    { transform: 'scale(1.1) rotate(-3deg)', offset: 0.7 }, { transform: 'scale(1.12) rotate(0)', opacity: 1, offset: 0.86 },
    { transform: 'translateY(-60px) scale(.8)', opacity: 0 },
  ], 3800, '7.6rem').classList.add('fx-rose-big');
  const bloom = 0.3 * 3800;
  y -= 70;
  ring(x, y, bloom - 60);
  ring(x, y, bloom + 220);
  ring(x, y, bloom + 500);
  // Розпустилась — пелюстки розлітаються колом і осідають
  for (let i = 0; i < 24; i += 1) {
    const p = shape('fx-petal', x, y - 10);
    const a = ((360 * (i + Math.random() * 0.5)) / 24) * (Math.PI / 180);
    const d = 150 + Math.random() * 90;
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    const rot = (Math.random() - 0.5) * 720;
    const s = 0.9 + Math.random() * 0.9;
    gone(p)(p.animate([
      { transform: `${C} scale(.3) rotate(0)`, opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(${s}) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.3 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 70}px)) scale(${s}) rotate(${rot * 0.8}deg)`, opacity: 1, offset: 0.75 },
      { transform: `translate(calc(-50% + ${dx * 1.05}px), calc(-50% + ${dy + 130}px)) scale(${s * 0.8}) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 1600 + Math.random() * 500, delay: bloom + i * 12, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'backwards' }));
  }
  spray(x, y, ['✨', '💖', '✨', '🌟'], 12, { dist: 170, size: '1.4rem', delay: bloom + 80, dur: 1000 });
  // Пелюстковий дощ на весь екран
  for (let i = 0; i < 34; i += 1) {
    const p = shape('fx-petal', Math.random() * innerWidth, -30);
    const sway = (Math.random() - 0.5) * 140;
    const fall = innerHeight + 80;
    const rot = (Math.random() - 0.5) * 900;
    const s = 0.8 + Math.random() * 1.1;
    gone(p)(p.animate([
      { transform: `${C} scale(${s}) rotate(0)`, opacity: 0 },
      { transform: `translate(calc(-50% + ${sway * 0.5}px), calc(-50% + ${fall * 0.25}px)) scale(${s}) rotate(${rot * 0.25}deg)`, opacity: 1, offset: 0.12 },
      { transform: `translate(calc(-50% + ${-sway * 0.4}px), calc(-50% + ${fall * 0.65}px)) scale(${s}) rotate(${rot * 0.65}deg)`, opacity: 1, offset: 0.65 },
      { transform: `translate(calc(-50% + ${sway}px), calc(-50% + ${fall}px)) scale(${s}) rotate(${rot}deg)`, opacity: 0.3 },
    ], { duration: 2600 + Math.random() * 1300, delay: bloom + 250 + Math.random() * 1500, easing: 'linear', fill: 'backwards' }));
  }
  rise(x, y - 30, ['💗', '💕', '💖'], 8, { delay: bloom + 900, size: 1.3 });
  jolt(el, [{ transform: 'none' }, { transform: 'scale(1.04)' }, { transform: 'none' }], 320, bloom);
};

// «Кава» ☕: з чашки піднімаються три цівки пари й складаються в біле сердечко — «доброго ранку»
REACT_FX['☕'] = (el, x, y) => {
  big('☕', x, y + 40, [
    { transform: 'translateY(20px) scale(.4)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.15 },
    { transform: 'scale(1)', offset: 0.3 }, { transform: 'scale(1)', opacity: 1, offset: 0.88 }, { transform: 'scale(.7)', opacity: 0 },
  ], 2800, '5.4rem');
  [-16, 0, 16].forEach((dx, i) => {
    const s = shape('fx-steam', x + dx, y - 6);
    gone(s)(s.animate([
      { transform: `${C} scaleY(.3)`, opacity: 0 },
      { transform: `translate(calc(-50% + ${-dx * 0.2 + 6}px), calc(-50% - 30px)) scaleY(1)`, opacity: 0.9, offset: 0.35 },
      { transform: `translate(calc(-50% + ${-dx * 0.6 - 6}px), calc(-50% - 62px)) scaleY(.8)`, opacity: 0.7, offset: 0.7 },
      { transform: `translate(calc(-50% + ${-dx}px), calc(-50% - 86px)) scaleY(.5)`, opacity: 0 },
    ], { duration: 1300, delay: 300 + i * 120, easing: 'ease-out', fill: 'backwards' }));
  });
  bigLater('🤍', x, y - 80, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.25 },
    { transform: 'scale(1)', opacity: 1, offset: 0.45 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.75 },
    { transform: 'translateY(-26px) scale(.8)', opacity: 0 },
  ], 1400, 1250, '3rem');
  [[-46, -96, 1500], [44, -70, 1650], [10, -124, 1800]].forEach(([dx, dy, d]) => twinkle('✨', x + dx, y + dy, '1.2rem', d));
};

// «Лайк» 👍: палець вистрибує й двічі «тисне», над ним спливає «+1», а вгору, як у стрімі, пливуть лайки й сердечка
REACT_FX['👍'] = (el, x, y) => {
  big('👍', x, y + 20, [
    { transform: 'translateY(80px) scale(.3) rotate(-20deg)', opacity: 0 }, { transform: 'translateY(-14px) scale(1.15) rotate(6deg)', opacity: 1, offset: 0.14 },
    { transform: 'translateY(0) scale(1) rotate(0)', offset: 0.24 }, { transform: 'scale(1.22) rotate(-8deg)', offset: 0.32 },
    { transform: 'scale(1) rotate(0)', offset: 0.4 }, { transform: 'scale(1.22) rotate(-8deg)', offset: 0.48 },
    { transform: 'scale(1.05) rotate(0)', opacity: 1, offset: 0.86 }, { transform: 'scale(.7)', opacity: 0 },
  ], 2600, '5.8rem');
  [0.32, 0.48].forEach((o) => { ring(x, y + 20, o * 2600 - 40); jolt(el, [{ transform: 'none' }, { transform: 'scale(1.025)' }, { transform: 'none' }], 200, o * 2600); });
  const plus = glyphAt('+1', x + 58, y - 40, '1.8rem', 'fx-say');
  gone(plus)(plus.animate([
    { transform: `${C} translateY(16px) scale(.4)`, opacity: 0 }, { transform: `${C} scale(1.15)`, opacity: 1, offset: 0.2 },
    { transform: `${C} translateY(-40px) scale(1)`, opacity: 1, offset: 0.75 }, { transform: `${C} translateY(-64px) scale(.9)`, opacity: 0 },
  ], { duration: 1500, delay: 800, easing: 'ease-out', fill: 'backwards' }));
  rise(x, y + 10, ['👍', '❤️', '👍', '💙', '👍', '💜'], 16, { delay: 900, up: 340, spread: 300, size: 1.2 });
};

// «Доброго ранку» ☀️: сонце сходить знизу, повільно крутиться, екран теплішає, довкола кружляють промінчики
REACT_FX['☀️'] = (el, x, y) => {
  veil('fx-sun', [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], 3200, 0, x, y);
  big('☀️', x, y, [
    { transform: 'translateY(140px) scale(.4) rotate(0)', opacity: 0 }, { transform: 'translateY(0) scale(1.1) rotate(40deg)', opacity: 1, offset: 0.3 },
    { transform: 'scale(1) rotate(80deg)', offset: 0.5 }, { transform: 'scale(1.08) rotate(130deg)', opacity: 1, offset: 0.85 },
    { transform: 'scale(.8) rotate(160deg)', opacity: 0 },
  ], 3000, '6.2rem');
  orbit(x, y, ['✨', '🌟'], 10, 96, 700, 2200);
  ring(x, y, 900, 'is-gold');
  ring(x, y, 1300, 'is-gold');
  rise(x, y + 40, ['🌼', '🌸', '✨'], 7, { delay: 1300, size: 1.1 });
};

// «Добраніч» 🌙: екран темніє, місяць гойдається, як колиска, довкола спалахують зорі
REACT_FX['🌙'] = (el, x, y) => {
  veil('fx-night', [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 3400, 0, x, y);
  big('🌙', x, y, [
    { transform: 'translateY(-60px) scale(.4) rotate(-30deg)', opacity: 0 }, { transform: 'translateY(0) scale(1.05) rotate(12deg)', opacity: 1, offset: 0.22 },
    { transform: 'rotate(-14deg)', offset: 0.4 }, { transform: 'rotate(10deg)', offset: 0.56 }, { transform: 'rotate(-6deg)', offset: 0.7 },
    { transform: 'rotate(0)', opacity: 1, offset: 0.86 }, { transform: 'translateY(-20px) scale(.8)', opacity: 0 },
  ], 3300, '6.2rem');
  for (let i = 0; i < 14; i += 1) {
    twinkle(i % 3 ? '✨' : '⭐', 20 + Math.random() * (innerWidth - 40), 60 + Math.random() * (innerHeight * 0.6), `${0.9 + Math.random() * 0.9}rem`, 500 + i * 130, 900);
  }
};

// «Янгол» 😇: згори падає промінь світла, у ньому сиплеться золотий пил; обличчя злітає вгору,
// німб, обертаючись, опускається й сідає на голову, спалахує ореол, у боки розлітаються голуби
REACT_FX['😇'] = (el, x, y) => {
  const D = 3200;
  const beam = shape('fx-beam', x, 0);
  beam.style.height = `${y + 40}px`;
  gone(beam)(beam.animate([
    { transform: 'translateX(-50%) scaleX(.2)', opacity: 0 }, { transform: 'translateX(-50%) scaleX(1)', opacity: 1, offset: 0.18 },
    { transform: 'translateX(-50%) scaleX(1)', opacity: 1, offset: 0.75 }, { transform: 'translateX(-50%) scaleX(.4)', opacity: 0 },
  ], { duration: D, easing: 'ease-out', fill: 'both' }));
  for (let i = 0; i < 12; i += 1) {
    const g = glyphAt('✨', x + (Math.random() - 0.5) * 70, 10 + Math.random() * 40, `${0.7 + Math.random() * 0.6}rem`);
    gone(g)(g.animate([
      { transform: `${C} scale(.5)`, opacity: 0 }, { transform: `${C} scale(1)`, opacity: 1, offset: 0.2 },
      { transform: `translate(-50%, calc(-50% + ${y - 60}px)) scale(.7)`, opacity: 0 },
    ], { duration: 1600 + Math.random() * 600, delay: 200 + i * 120, easing: 'ease-in', fill: 'backwards' }));
  }
  big('😇', x, y + 10, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.14 },
    { transform: 'translateY(-26px) scale(1.04)', offset: 0.42 }, { transform: 'translateY(-34px) scale(1.06)', offset: 0.6 },
    { transform: 'translateY(-28px) scale(1.04)', opacity: 1, offset: 0.86 }, { transform: 'translateY(-50px) scale(.8)', opacity: 0 },
  ], D, '5.8rem');
  // Німб: плаский золотий еліпс «крутиться» (стискається по ширині), спускаючись, і сідає над головою, що піднялась
  const halo = shape('fx-halo', x, y - 170);
  gone(halo)(halo.animate([
    { transform: `${C} scale(.4, .4)`, opacity: 0 },
    { transform: `${C} translateY(26px) scale(.15, 1)`, opacity: 1, offset: 0.12 },
    { transform: `${C} translateY(52px) scale(1, 1)`, opacity: 1, offset: 0.24 },
    { transform: `${C} translateY(78px) scale(.15, 1)`, opacity: 1, offset: 0.36 },
    { transform: `${C} translateY(104px) scale(1.12, 1.1)`, opacity: 1, offset: 0.5 },
    { transform: `${C} translateY(98px) scale(1, 1)`, opacity: 1, offset: 0.6 },
    { transform: `${C} translateY(98px) scale(1.06, 1.06)`, opacity: 1, offset: 0.75 },
    { transform: `${C} translateY(98px) scale(1, 1)`, opacity: 1, offset: 0.88 },
    { transform: `${C} translateY(84px) scale(1.4, 1.4)`, opacity: 0 },
  ], { duration: D - 300, delay: 200, easing: 'ease-in-out', fill: 'backwards' }));
  const sat = 200 + 0.5 * (D - 300);
  ring(x, y - 24, sat, 'is-gold');
  ring(x, y - 24, sat + 260, 'is-gold');
  [-1, 1].forEach((s) => {
    const d = glyphAt('🕊️', x + s * 30, y - 10, '2.2rem');
    if (s > 0) d.style.scale = '-1 1';
    gone(d)(d.animate([
      { transform: `${C} scale(.3)`, opacity: 0 }, { transform: `translate(calc(-50% + ${s * 40}px), calc(-50% - 20px)) scale(1)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${s * 130}px), calc(-50% - 110px)) scale(1.1)`, opacity: 1, offset: 0.7 },
      { transform: `translate(calc(-50% + ${s * 190}px), calc(-50% - 170px)) scale(.9)`, opacity: 0 },
    ], { duration: 1500, delay: sat + 100, easing: 'ease-out', fill: 'backwards' }));
  });
  rise(x, y - 30, ['🤍', '✨', '🤍'], 7, { delay: sat + 300, size: 1.1 });
};

// «Тост» 🍷: два келихи з боків сходяться, нахиляються одне до одного — дзинь! — іскри, і разом здіймаються вгору
REACT_FX['🍷'] = (el, x, y) => {
  const D = 3000;
  // Келихи справді чокаються: вінця сходяться внахил (дзинь!), відскок, другий легкий дзинь — і разом угору «за нас»
  const hit1 = 0.34;
  const hit2 = 0.5;
  [-1, 1].forEach((s) => {
    // Правий — дзеркальний: відбиття в кінці кожного кадру, тож зсув і нахил лишаються «до центру»
    big('🍷', x + s * 34, y + 10, [
      { transform: `translateX(${s * 150}px) rotate(${s * 8}deg) scale(.6)`, opacity: 0 },
      { transform: `translateX(${s * 46}px) rotate(0) scale(1)`, opacity: 1, offset: 0.22 },
      { transform: `translateX(${-s * 12}px) rotate(${-s * 24}deg) scale(1)`, offset: hit1 },
      { transform: `translateX(${s * 10}px) rotate(${-s * 10}deg) scale(1)`, offset: 0.41 },
      { transform: `translateX(${-s * 8}px) rotate(${-s * 20}deg) scale(1)`, offset: hit2 },
      { transform: `translateX(${s * 4}px) rotate(${-s * 12}deg) scale(1)`, offset: 0.56 },
      { transform: `translateX(${-s * 4}px) translateY(-52px) rotate(${-s * 16}deg) scale(1.06)`, opacity: 1, offset: 0.76 },
      { transform: `translateX(${-s * 4}px) translateY(-58px) rotate(${-s * 16}deg) scale(1.06)`, opacity: 1, offset: 0.88 },
      { transform: `translateX(${s * 26}px) translateY(-84px) rotate(0) scale(.8)`, opacity: 0 },
    ].map((f) => (s > 0 ? { ...f, transform: `${f.transform} scale(-1, 1)` } : f)), D, '5rem');
  });
  // Місце зіткнення — над центром, де сходяться вінця; перший дзинь гучний, другий тихіший
  for (const [o, loud] of [[hit1, true], [hit2, false]]) {
    const t = o * D;
    ring(x, y - 34, t, 'is-gold');
    twinkle('✨', x, y - 44, loud ? '2.8rem' : '1.8rem', t - 40, 600);
    spray(x, y - 44, ['✨', '🫧', '⭐'], loud ? 12 : 6, { dist: loud ? 120 : 70, size: '1.1rem', delay: t, fall: -20, dur: 850 });
  }
  const say = glyphAt('дзынь!', x, y - 108, '1.6rem', 'fx-say');
  gone(say)(say.animate([
    { transform: `${C} scale(.4) rotate(-8deg)`, opacity: 0 }, { transform: `${C} scale(1.12) rotate(-4deg)`, opacity: 1, offset: 0.22 },
    { transform: `${C} translateY(-20px) scale(1)`, opacity: 1, offset: 0.75 }, { transform: `${C} translateY(-34px)`, opacity: 0 },
  ], { duration: 1500, delay: hit1 * D + 30, fill: 'backwards' }));
  rise(x, y - 60, ['🫧', '✨', '💗'], 9, { delay: 0.6 * D, size: 1 });
};

// «Смакота» 🍕: піца крутиться, з неї йде пара, а довкола водять хоровод смаколики
REACT_FX['🍕'] = (el, x, y) => {
  big('🍕', x, y, [
    { transform: 'scale(.3) rotate(-90deg)', opacity: 0 }, { transform: 'scale(1.12) rotate(20deg)', opacity: 1, offset: 0.2 },
    { transform: 'scale(1) rotate(-10deg)', offset: 0.34 }, { transform: 'scale(1.06) rotate(8deg)', offset: 0.55 },
    { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.86 }, { transform: 'scale(.7) rotate(30deg)', opacity: 0 },
  ], 2700, '6rem');
  orbit(x, y, ['🍰', '🍓', '🧀', '🍟', '🍩', '🍒'], 6, 100, 450, 2100);
  [-14, 0, 14].forEach((dx, i) => {
    const s = shape('fx-steam', x + dx, y - 44);
    gone(s)(s.animate([
      { transform: `${C} scaleY(.3)`, opacity: 0 },
      { transform: `translate(calc(-50% + 6px), calc(-50% - 26px)) scaleY(1)`, opacity: 0.8, offset: 0.4 },
      { transform: `translate(calc(-50% - 6px), calc(-50% - 60px)) scaleY(.6)`, opacity: 0 },
    ], { duration: 1200, delay: 700 + i * 160, easing: 'ease-out', fill: 'backwards' }));
  });
  const yum = glyphAt('😋', x + 66, y - 56, '2.4rem');
  gone(yum)(yum.animate([
    { transform: `${C} scale(.2)`, opacity: 0 }, { transform: `${C} scale(1.2) rotate(10deg)`, opacity: 1, offset: 0.3 },
    { transform: `${C} scale(1) rotate(-6deg)`, opacity: 1, offset: 0.8 }, { transform: `${C} scale(.6)`, opacity: 0 },
  ], { duration: 1200, delay: 1400, easing: 'ease-out', fill: 'backwards' }));
};

// «Холодно» 🥶: краї екрана береться інеєм, на весь екран падають сніжинки, смайлик і лист тремтять від холоду
REACT_FX['🥶'] = (el, x, y) => {
  veil('fx-frost', [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.78 }, { opacity: 0 }], 3000, 0, x, y);
  const frames = [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.14 }];
  for (let i = 0; i < 14; i += 1) frames.push({ transform: `translateX(${i % 2 ? 5 : -5}px) scale(1.05)`, offset: 0.2 + i * 0.045 });
  frames.push({ transform: 'scale(1)', opacity: 1, offset: 0.88 }, { transform: 'scale(.7)', opacity: 0 });
  big('🥶', x, y, frames, 2900, '5.8rem');
  jolt(el, [{ transform: 'none' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(-2px)' }, { transform: 'none' }], 500, 700);
  for (let i = 0; i < 22; i += 1) {
    const s = glyphAt(i % 3 ? '❄️' : '✻', Math.random() * innerWidth, -30, `${0.9 + Math.random() * 1}rem`, 'fx-snow');
    const sway = (Math.random() - 0.5) * 80;
    const fall = innerHeight + 60;
    gone(s)(s.animate([
      { transform: `${C} rotate(0)`, opacity: 0 },
      { transform: `translate(calc(-50% + ${sway * 0.4}px), calc(-50% + ${fall * 0.2}px)) rotate(90deg)`, opacity: 1, offset: 0.15 },
      { transform: `translate(calc(-50% + ${sway}px), calc(-50% + ${fall}px)) rotate(360deg)`, opacity: 0.4 },
    ], { duration: 2400 + Math.random() * 1200, delay: Math.random() * 1200, easing: 'linear', fill: 'backwards' }));
  }
};

// «Жарко» 🥵: екран розжарюється, від смайлика здіймається марево, бризкає піт, а згори падає рятівний кубик льоду
REACT_FX['🥵'] = (el, x, y) => {
  veil('fx-heat', [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], 2900, 0, x, y);
  big('🥵', x, y, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.16 },
    { transform: 'scale(1.04, .96) rotate(-4deg)', offset: 0.32 }, { transform: 'scale(.98, 1.04) rotate(4deg)', offset: 0.48 },
    { transform: 'scale(1.04, .96) rotate(-3deg)', offset: 0.62 }, { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.86 },
    { transform: 'scale(.7)', opacity: 0 },
  ], 2800, '5.8rem');
  [-30, -10, 10, 30].forEach((dx, i) => {
    const s = shape('fx-steam fx-haze', x + dx, y - 50);
    gone(s)(s.animate([
      { transform: `${C} scaleY(.3)`, opacity: 0 },
      { transform: `translate(calc(-50% + ${i % 2 ? 8 : -8}px), calc(-50% - 40px)) scaleY(1)`, opacity: 0.7, offset: 0.4 },
      { transform: `translate(calc(-50% + ${i % 2 ? -8 : 8}px), calc(-50% - 90px)) scaleY(.6)`, opacity: 0 },
    ], { duration: 1400, delay: 300 + i * 150, easing: 'ease-out', fill: 'backwards' }));
  });
  spray(x, y - 10, ['💦', '💧'], 10, { dist: 120, size: '1.3rem', delay: 600, from: 180, to: 360, fall: 80, dur: 1100 });
  const ice = glyphAt('🧊', x + 54, -40, '2.4rem');
  gone(ice)(ice.animate([
    { transform: `${C} rotate(0)`, opacity: 1 },
    { transform: `translate(-50%, calc(-50% + ${y + 10}px)) rotate(200deg)`, opacity: 1, offset: 0.6 },
    { transform: `translate(-50%, calc(-50% + ${y - 10}px)) rotate(230deg)`, opacity: 1, offset: 0.72 },
    { transform: `translate(-50%, calc(-50% + ${y + 6}px)) rotate(250deg)`, opacity: 1, offset: 0.85 },
    { transform: `translate(-50%, calc(-50% + ${y + 6}px)) rotate(250deg) scale(.6)`, opacity: 0 },
  ], { duration: 1500, delay: 1300, easing: 'ease-in', fill: 'backwards' }));
  spray(x + 54, y, ['✨', '💧'], 6, { dist: 60, size: '1rem', delay: 2200, dur: 700 });
};

// «Захворів» 🤒: смайлик морозить, поруч градусник повзе вгору, падає пігулка, а потім — «Выздоравливай!» і сердечка
REACT_FX['🤒'] = (el, x, y) => {
  const frames = [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.05)', opacity: 1, offset: 0.14 }];
  for (let i = 0; i < 8; i += 1) frames.push({ transform: `translateX(${i % 2 ? 3 : -3}px) rotate(${i % 2 ? 2 : -2}deg)`, offset: 0.2 + i * 0.04 });
  frames.push({ transform: 'scale(1) rotate(0)', offset: 0.6 }, { transform: 'scale(1.05) translateY(-4px)', opacity: 1, offset: 0.86 }, { transform: 'scale(.7)', opacity: 0 });
  big('🤒', x - 24, y + 10, frames, 3100, '5.6rem');
  const t = glyphAt('🌡️', x + 58, y + 30, '3rem');
  gone(t)(t.animate([
    { transform: `${C} translateY(40px) rotate(10deg)`, opacity: 0 }, { transform: `${C} translateY(0) rotate(10deg)`, opacity: 1, offset: 0.2 },
    { transform: `${C} translateY(-30px) rotate(-6deg) scale(1.1)`, opacity: 1, offset: 0.55 },
    { transform: `${C} translateY(-26px) rotate(-6deg) scale(1.1)`, opacity: 1, offset: 0.85 }, { transform: `${C} translateY(-26px) scale(.7)`, opacity: 0 },
  ], { duration: 2000, delay: 200, easing: 'ease-out', fill: 'backwards' }));
  const pill = glyphAt('💊', x - 24, -30, '2rem');
  gone(pill)(pill.animate([
    { transform: `${C} rotate(0)`, opacity: 1 },
    { transform: `translate(-50%, calc(-50% + ${y - 40}px)) rotate(300deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(-50%, calc(-50% + ${y - 64}px)) rotate(340deg)`, opacity: 1, offset: 0.7 },
    { transform: `translate(-50%, calc(-50% + ${y - 44}px)) rotate(360deg) scale(.4)`, opacity: 0 },
  ], { duration: 1100, delay: 1000, easing: 'ease-in', fill: 'backwards' }));
  const say = glyphAt('Выздоравливай!', x, y + 90, '1.5rem', 'fx-say');
  gone(say)(say.animate([
    { transform: `${C} translateY(10px) scale(.6)`, opacity: 0 }, { transform: `${C} scale(1.06)`, opacity: 1, offset: 0.2 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.85 }, { transform: C, opacity: 0 },
  ], { duration: 1600, delay: 1700, fill: 'backwards' }));
  rise(x - 24, y - 20, ['💗', '🍵', '💗', '🍋'], 9, { delay: 1900, size: 1.1 });
};

// Підпис-плашка під смайликом (як «Да уж»); wrap — у два рядки для довгого
function say(text, x, y, size, delay, dur, wrap = false) {
  const s = glyphAt(text, x, y, size, `fx-say${wrap ? ' fx-say-2' : ''}`);
  gone(s)(s.animate([
    { transform: `${C} translateY(10px) scale(.6)`, opacity: 0 }, { transform: `${C} scale(1.06)`, opacity: 1, offset: 0.2 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.85 }, { transform: C, opacity: 0 },
  ], { duration: dur, delay, fill: 'backwards' }));
}

// «Ведмедик» 🧸: плюхається згори на повідомлення й обіймає — лист двічі стискається, ведмедик гойдається, злітають сердечка
REACT_FX['🧸'] = (el, x, y) => {
  big('🧸', x, y - 10, [
    { transform: `translateY(${-y - 60}px) rotate(-20deg)`, opacity: 1, easing: 'ease-in' },
    { transform: 'translateY(0) rotate(0)', offset: 0.22 },
    { transform: 'translateY(10px) scale(1.25, .8)', offset: 0.27 },
    { transform: 'translateY(-6px) scale(.95, 1.08)', offset: 0.34 },
    { transform: 'scale(1) rotate(-7deg)', offset: 0.48 }, { transform: 'scale(1.06) rotate(7deg)', offset: 0.62 },
    { transform: 'scale(1) rotate(-4deg)', offset: 0.74 }, { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.88 },
    { transform: 'scale(.7)', opacity: 0 },
  ], 2700, '6rem');
  jolt(el, [{ transform: 'none' }, { transform: 'scale(.95, .97)', offset: 0.3 }, { transform: 'none', offset: 0.5 },
    { transform: 'scale(.96, .98)', offset: 0.75 }, { transform: 'none' }], 1300, 750);
  rise(x, y - 30, ['💕', '🤎', '💗'], 8, { delay: 1100, up: 200, spread: 200, size: 1.1 });
};

// «Катаюсь від сміху» 🤣: смайлик викочується зліва, трясеться від реготу з бризками сліз і відкочується вправо
REACT_FX['🤣'] = (el, x, y) => {
  big('🤣', x, y, [
    { transform: 'translateX(-150px) rotate(-540deg) scale(.7)', opacity: 0 },
    { transform: 'translateX(-60px) rotate(-200deg) scale(.95)', opacity: 1, offset: 0.12 },
    { transform: 'translateX(0) rotate(0) scale(1.1)', offset: 0.26 },
    { transform: 'rotate(-12deg) translateY(-6px) scale(1.15)', offset: 0.34 }, { transform: 'rotate(12deg) scale(1.15)', offset: 0.42 },
    { transform: 'rotate(-12deg) translateY(-6px) scale(1.15)', offset: 0.5 }, { transform: 'rotate(10deg) scale(1.15)', offset: 0.58 },
    { transform: 'rotate(0) scale(1.1)', opacity: 1, offset: 0.68 },
    { transform: 'translateX(70px) rotate(300deg) scale(1)', opacity: 1, offset: 0.84 },
    { transform: 'translateX(160px) rotate(620deg) scale(.8)', opacity: 0 },
  ], 2600, '6.2rem');
  for (const side of [-1, 1]) spray(x + side * 30, y - 8, ['💦', '💧'], 5, { dist: 110, size: '1.4rem', delay: 900, from: side < 0 ? 190 : -10, to: side < 0 ? 250 : 50, fall: 70, dur: 900 });
  jolt(el, [{ transform: 'none' }, { transform: 'translateY(-8px) rotate(-1deg)' }, { transform: 'none' }, { transform: 'translateY(-5px) rotate(1deg)' }, { transform: 'none' }], 900, 850);
};

// «Підглядаю» 🫣: визирає з-за верхнього краю повідомлення, ховається й визирає ще раз — вище й нахилившись
REACT_FX['🫣'] = (el, x, y, r) => {
  const edge = clamp(r.top + 4, 150, innerHeight - 200);
  const box = shape('fx-peek', x, edge);
  const face = document.createElement('span');
  face.textContent = '🫣';
  box.append(face);
  gone(box)(box.animate([{ opacity: 1 }, { opacity: 1, offset: 0.95 }, { opacity: 0 }], { duration: 2700, fill: 'backwards' }));
  face.animate([
    { transform: 'translateY(105%)' }, { transform: 'translateY(48%)', offset: 0.18 }, { transform: 'translateY(52%) rotate(-4deg)', offset: 0.3 },
    { transform: 'translateY(105%)', offset: 0.42 }, { transform: 'translateY(105%)', offset: 0.5 },
    { transform: 'translateY(12%) rotate(10deg)', offset: 0.64 }, { transform: 'translateY(16%) rotate(6deg)', offset: 0.8 },
    { transform: 'translateY(105%)' },
  ], { duration: 2700, easing: 'ease-in-out', fill: 'forwards' });
  twinkle('✨', x + 52, edge - 70, '1.2rem', 1750);
};

// «Сакура» 🌸: квітка розпускається над повідомленням, потім налітає вітер і несе пелюстки через увесь екран
REACT_FX['🌸'] = (el, x, y) => {
  big('🌸', x, y, [
    { transform: 'scale(.2) rotate(-120deg)', opacity: 0 }, { transform: 'scale(1.2) rotate(10deg)', opacity: 1, offset: 0.25 },
    { transform: 'scale(1) rotate(0)', offset: 0.38 }, { transform: 'scale(1.05) rotate(-6deg)', opacity: 1, offset: 0.55 },
    { transform: 'translateX(60px) scale(.6) rotate(40deg)', opacity: 0, offset: 0.8 }, { transform: 'translateX(60px) scale(.6)', opacity: 0 },
  ], 2900, '6.4rem');
  for (let i = 0; i < 16; i += 1) {
    const s = glyphAt('🌸', x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 50, `${0.8 + Math.random() * 0.8}rem`);
    const dx = innerWidth - x + 60 + Math.random() * 80;
    const dy = (Math.random() - 0.6) * 180;
    const sw = 20 + Math.random() * 30;
    const rot = 200 + Math.random() * 400;
    gone(s)(s.animate([
      { transform: `${C} scale(.4)`, opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.25}px), calc(-50% + ${dy * 0.25 - sw}px)) rotate(${rot * 0.3}deg)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${dy * 0.6 + sw}px)) rotate(${rot * 0.65}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg)`, opacity: 0.6 },
    ], { duration: 1500 + Math.random() * 600, delay: 1300 + i * 45, easing: 'ease-in', fill: 'backwards' }));
  }
};

// «Зорепад» 🌠: темніє, згори навскіс летять зірки з хвостами, а над повідомленням спалахує одна велика — загадай бажання
REACT_FX['⭐'] = (el, x, y) => {
  veil('fx-veil', [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 3100, 0, x, y);
  const ang = 145;
  const a = (ang * Math.PI) / 180;
  for (let i = 0; i < 9; i += 1) {
    const sx = innerWidth * (0.35 + Math.random() * 0.75);
    const sy = -30 + Math.random() * innerHeight * 0.35;
    const len = 260 + Math.random() * 220;
    const ex = sx + Math.cos(a) * len;
    const ey = sy + Math.sin(a) * len;
    const s = shape('fx-shoot', 0, 0);
    gone(s)(s.animate([
      { transform: `translate(${sx}px, ${sy}px) rotate(${ang}deg) scaleX(.2)`, opacity: 0 },
      { transform: `translate(${sx + (ex - sx) * 0.2}px, ${sy + (ey - sy) * 0.2}px) rotate(${ang}deg) scaleX(1)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${ex}px, ${ey}px) rotate(${ang}deg) scaleX(.6)`, opacity: 0 },
    ], { duration: 800 + Math.random() * 300, delay: 150 + i * 190 + Math.random() * 120, easing: 'ease-in', fill: 'backwards' }));
  }
  big('⭐', x, y - 10, [
    { transform: 'scale(0) rotate(-90deg)', opacity: 0 }, { transform: 'scale(0) rotate(-90deg)', opacity: 0, offset: 0.35 },
    { transform: 'scale(1.3) rotate(10deg)', opacity: 1, offset: 0.5 }, { transform: 'scale(1) rotate(0)', offset: 0.6 },
    { transform: 'scale(1.08)', opacity: 1, offset: 0.88 }, { transform: 'scale(.6)', opacity: 0 },
  ], 3100, '5.6rem');
  ring(x, y - 10, 1500, 'is-gold');
  for (let i = 0; i < 6; i += 1) {
    const t = (i / 6) * Math.PI * 2;
    twinkle('✨', x + Math.cos(t) * 70, y - 10 + Math.sin(t) * 60, '1.2rem', 1600 + i * 110);
  }
  say('Загадай желание', x, y + 74, '1.6rem', 1700, 1300);
};

// «Медаль» 🎖️: на стрічці спускається згори й чіпляється до кута повідомлення, яке на мить світиться золотом
REACT_FX['🎖️'] = (el, x, y, r) => {
  const px = clamp(r.right - 34, 40, innerWidth - 40);
  const py = clamp(r.top + 18, 60, innerHeight - 160);
  const m = glyphAt('🎖️', px, py, '3.6rem', 'fx-big fx-medal');
  gone(m)(m.animate([
    { transform: `translate(-50%, ${-py - 80}px) rotate(-30deg)`, opacity: 1, easing: 'ease-in' },
    { transform: 'translate(-50%, -50%) rotate(18deg)', offset: 0.26 },
    { transform: 'translate(-50%, -50%) rotate(-12deg)', offset: 0.36 }, { transform: 'translate(-50%, -50%) rotate(8deg)', offset: 0.45 },
    { transform: 'translate(-50%, -50%) rotate(-4deg)', offset: 0.53 }, { transform: 'translate(-50%, -50%) rotate(0)', offset: 0.6 },
    { transform: 'translate(-50%, -50%) rotate(0)', opacity: 1, offset: 0.9 }, { transform: 'translate(-50%, -50%) scale(.7)', opacity: 0 },
  ], { duration: 3300, easing: 'ease-out', fill: 'backwards' }));
  jolt(el, [{ transform: 'none' }, { transform: 'translateY(3px)', offset: 0.3 }, { transform: 'none' }], 300, 860);
  el?.isConnected && el.animate([
    { boxShadow: '0 0 0 0 rgba(232, 184, 74, 0)' }, { boxShadow: '0 0 0 3px #E8B84A, 0 0 26px rgba(232, 184, 74, .75)', offset: 0.25 },
    { boxShadow: '0 0 0 3px #E8B84A, 0 0 18px rgba(232, 184, 74, .5)', offset: 0.75 }, { boxShadow: '0 0 0 0 rgba(232, 184, 74, 0)' },
  ], { duration: 2000, delay: 900, easing: 'ease-out' });
  twinkle('✨', px + 14, py - 8, '1.6rem', 1300);
  twinkle('✨', px - 16, py + 14, '1.2rem', 1650);
  spray(px, py, ['✨', '⭐'], 8, { dist: 80, size: '1.1rem', delay: 950, dur: 800 });
  say('За лучшее сообщение!', clamp(x, 130, innerWidth - 130), clamp(r.bottom + 30, 120, innerHeight - 140), '1.5rem', 1300, 1800);
};

// «Щит» 🛡️: щит висувається перед повідомленням, довкола купол-сяйво, три удари відскакують іскрами — «я тебе захищу»
REACT_FX['🛡️'] = (el, x, y) => {
  const dome = shape('fx-dome', x, y);
  gone(dome)(dome.animate([
    { transform: `${C} scale(.3)`, opacity: 0 }, { transform: `${C} scale(1)`, opacity: 1, offset: 0.2 },
    { transform: `${C} scale(1.04)`, opacity: 0.85, offset: 0.8 }, { transform: `${C} scale(1.2)`, opacity: 0 },
  ], { duration: 2900, easing: 'ease-out', fill: 'backwards' }));
  const hits = [[-1, -0.5, 900], [1, -0.2, 1350], [-1, 0.4, 1800]];
  const frames = [{ transform: 'translateY(70px) scale(.4)', opacity: 0 }, { transform: 'translateY(0) scale(1.1)', opacity: 1, offset: 0.16 }, { transform: 'scale(1)', offset: 0.24 }];
  for (const [side, , at] of hits) {
    const o = at / 2900;
    frames.push({ transform: `translateX(${side * -9}px) rotate(${side * -6}deg) scale(.97)`, offset: o + 0.02 }, { transform: 'scale(1)', offset: o + 0.08 });
  }
  frames.push({ transform: 'scale(1.05)', opacity: 1, offset: 0.88 }, { transform: 'scale(.7)', opacity: 0 });
  big('🛡️', x, y, frames, 2900, '6rem');
  for (const [side, dy, at] of hits) {
    const hx = x + side * 34;
    const hy = y + dy * 60;
    const c = glyphAt('☄️', hx, hy, '1.8rem');
    const fromX = side * (innerWidth * 0.6);
    gone(c)(c.animate([
      { transform: `translate(calc(-50% + ${fromX}px), calc(-50% - 90px)) rotate(${side > 0 ? 200 : -20}deg)`, opacity: 1 },
      { transform: `${C} rotate(${side > 0 ? 200 : -20}deg)`, opacity: 1, offset: 0.9 }, { transform: `${C} scale(.3)`, opacity: 0 },
    ], { duration: 420, delay: at - 400, easing: 'ease-in', fill: 'backwards' }));
    const boom = glyphAt('💥', hx, hy, '2.4rem');
    gone(boom)(boom.animate([{ transform: `${C} scale(.3)`, opacity: 0 }, { transform: `${C} scale(1.2)`, opacity: 1, offset: 0.3 }, { transform: `${C} scale(1.5)`, opacity: 0 }],
      { duration: 450, delay: at, fill: 'backwards' }));
    spray(hx, hy, ['✨'], 5, { dist: 70, size: '1rem', delay: at, from: side > 0 ? -60 : 120, to: side > 0 ? 60 : 240, dur: 600 });
  }
};

// «Ракета» 🚀: тремтить біля повідомлення, клубочиться дим — старт угору за екран зі слідом іскор, нагорі спалахує зірочка
REACT_FX['🚀'] = (el, x, y) => {
  const D = 2900;
  const lift = 0.42;
  const frames = [{ transform: 'rotate(-45deg) scale(.4) translateY(30px)', opacity: 0 }, { transform: 'rotate(-45deg) scale(1)', opacity: 1, offset: 0.1 }];
  for (let i = 0; i < 8; i += 1) frames.push({ transform: `translateX(${i % 2 ? 2 : -2}px) rotate(-45deg)`, offset: 0.12 + i * 0.035 });
  frames.push({ transform: 'translateY(0) rotate(-45deg)', offset: lift, easing: 'cubic-bezier(.55, 0, .85, .4)' },
    { transform: `translateY(${-y - 140}px) rotate(-45deg)`, opacity: 1, offset: 0.72 }, { transform: `translateY(${-y - 140}px) rotate(-45deg)`, opacity: 0 });
  big('🚀', x, y + 10, frames, D, '5.4rem');
  spray(x, y + 52, ['💨'], 8, { dist: 70, size: '2rem', delay: 250, from: 150, to: 390, fall: -10, dur: 1300 });
  spray(x, y + 52, ['💨'], 6, { dist: 110, size: '2.4rem', delay: D * lift, from: 160, to: 380, fall: 0, dur: 1000 });
  jolt(el, [{ transform: 'none' }, { transform: 'translateY(4px)' }, { transform: 'none' }], 260, D * lift);
  // Слід: іскри там, де ракета щойно пролетіла
  for (let k = 0; k < 7; k += 1) {
    const t = k / 7;
    const py = y + 30 - (y + 120) * (t * t);
    spray(x, py, ['✨', '🔥'], 3, { dist: 30, size: '1rem', delay: D * (lift + 0.3 * Math.sqrt(t)), from: 60, to: 120, fall: 30, dur: 600 });
  }
  twinkle('⭐', x, 46, '2.2rem', D * 0.74, 900);
};

// «Попкорн» 🍿: відерце підстрибує, зерна вискакують фонтанчиком і падають назад — «дивлюся з цікавістю»
REACT_FX['🍿'] = (el, x, y) => {
  const by = y + 24;
  const frames = [{ transform: 'translateY(40px) scale(.4)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.14 }];
  for (const o of [0.24, 0.38, 0.52, 0.66]) frames.push({ transform: 'scale(1.08, .9) translateY(4px)', offset: o }, { transform: 'scale(1) translateY(0)', offset: o + 0.05 });
  frames.push({ transform: 'scale(1)', opacity: 1, offset: 0.88 }, { transform: 'scale(.7)', opacity: 0 });
  big('🍿', x, by, frames, 2800, '5.2rem');
  for (let i = 0; i < 18; i += 1) {
    const k = shape('fx-kernel', x + (Math.random() - 0.5) * 30, by - 30);
    const dx = (Math.random() - 0.5) * 220;
    const up = 90 + Math.random() * 110;
    const down = 30 + Math.random() * 60;
    const rot = (Math.random() - 0.5) * 720;
    gone(k)(k.animate([
      { transform: `${C} scale(.3)`, opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% - ${up}px)) rotate(${rot * 0.5}deg) scale(1)`, opacity: 1, offset: 0.45, easing: 'ease-in' },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${down}px)) rotate(${rot}deg) scale(.9)`, opacity: 0 },
    ], { duration: 1000 + Math.random() * 300, delay: 600 + Math.floor(i / 4.5) * 390 + Math.random() * 120, easing: 'ease-out', fill: 'backwards' }));
  }
};

// «Пігулка» 💊: капсула крутиться, розкривається навпіл — з неї сиплються сердечка й діагноз
REACT_FX['💊'] = (el, x, y) => {
  const D = 3500;
  [['fx-pill-l', -1], ['fx-pill-r', 1]].forEach(([cls, side]) => {
    const s = glyphAt('💊', x, y, '5.6rem', `fx-big ${cls}`);
    gone(s)(s.animate([
      { transform: `${C} scale(.3) rotate(-200deg)`, opacity: 0 },
      { transform: `${C} scale(1.15) rotate(20deg)`, opacity: 1, offset: 0.16 },
      { transform: `${C} scale(1) rotate(0)`, offset: 0.24 },
      { transform: `${C} scale(1.05) rotate(-8deg)`, offset: 0.3 },
      { transform: `${C} scale(1) rotate(0)`, offset: 0.34 },
      { transform: `translate(calc(-50% + ${side * 46}px), calc(-50% + ${-side * 30}px)) rotate(${side * 24}deg)`, opacity: 1, offset: 0.44 },
      { transform: `translate(calc(-50% + ${side * 52}px), calc(-50% + ${-side * 34}px)) rotate(${side * 28}deg)`, opacity: 1, offset: 0.82 },
      { transform: `translate(calc(-50% + ${side * 60}px), calc(-50% + ${-side * 40}px)) rotate(${side * 30}deg) scale(.7)`, opacity: 0 },
    ], { duration: D, easing: 'ease-out', fill: 'forwards' }));
  });
  ring(x, y, D * 0.34);
  spray(x, y, ['❤️', '💗', '💕', '💖'], 14, { dist: 140, size: '1.5rem', delay: D * 0.35, fall: 50, dur: 1200 });
  rise(x, y, ['❤️', '💗'], 6, { delay: D * 0.42, up: 200, spread: 180, size: 1 });
  say('Секса тебе просто не хватает!', x, y + 96, '1.7rem', D * 0.42, D * 0.56, true);
};

// «Фу» 🤮: зеленіє, надуває щоки, екран похитує — і трошки ригає дугою на повідомлення, там лишається калюжка
REACT_FX['🤮'] = (el, x, y, r) => {
  const D = 3200;
  const at = D * 0.36;
  big('🤮', x - 40, y - 34, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.1 },
    { transform: 'scale(1.12, .95) rotate(-4deg)', offset: 0.18 }, { transform: 'scale(1) rotate(3deg)', offset: 0.24 },
    { transform: 'scale(1.18, .92) rotate(-3deg)', offset: 0.31 }, { transform: 'scale(1.05) rotate(-14deg) translateY(4px)', offset: 0.36 },
    { transform: 'scale(1.05) rotate(-18deg) translateY(6px)', offset: 0.6 }, { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.86 },
    { transform: 'scale(.7)', opacity: 0 },
  ], D, '5.4rem');
  jolt(el, [{ transform: 'none' }, { transform: 'rotate(-1.2deg)' }, { transform: 'rotate(1.2deg)' }, { transform: 'rotate(-.8deg)' }, { transform: 'none' }], 1100, 0);
  // Струмінь — краплі дугою з рота на лист
  const mx = x - 18;
  const my = y - 6;
  const land = clamp(r.top + 14, my + 40, innerHeight - 120);
  for (let i = 0; i < 22; i += 1) {
    const d = glyphAt('', mx, my, '1rem', 'fx-puke');
    const size = 8 + Math.random() * 10;
    d.style.width = `${size}px`;
    d.style.height = `${size}px`;
    const dx = 40 + Math.random() * 90;
    const dy = land - my + (Math.random() - 0.3) * 18;
    gone(d)(d.animate([
      { transform: `${C} scale(.4)`, opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% - ${22 + Math.random() * 14}px)) scale(1)`, opacity: 1, offset: 0.4, easing: 'ease-in' },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.2, .7)`, opacity: 1, offset: 0.92 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.3, .5)`, opacity: 0 },
    ], { duration: 650, delay: at + i * 38, fill: 'backwards' }));
  }
  const splat = shape('fx-splat', mx + 70, land + 4);
  gone(splat)(splat.animate([
    { transform: `${C} scale(.1, .1)`, opacity: 0 }, { transform: `${C} scale(1.15, .9)`, opacity: 0.95, offset: 0.12 },
    { transform: `${C} scale(1)`, opacity: 0.95, offset: 0.7 }, { transform: `${C} scale(1.05, .8)`, opacity: 0 },
  ], { duration: D - at - 300, delay: at + 350, easing: 'ease-out', fill: 'backwards' }));
  jolt(el, [{ transform: 'none' }, { transform: 'translateY(3px) scaleY(.98)' }, { transform: 'none' }], 300, at + 400);
  const puff = glyphAt('💨', x - 70, y - 40, '2rem');
  gone(puff)(puff.animate([{ transform: `${C} scale(.3)`, opacity: 0 }, { transform: `translate(calc(-50% - 30px), calc(-50% - 10px)) scale(1.2)`, opacity: 1, offset: 0.4 },
    { transform: 'translate(calc(-50% - 60px), calc(-50% - 20px)) scale(1.5)', opacity: 0 }], { duration: 900, delay: D * 0.7, fill: 'backwards' }));
};

// Відкрили лист зі смайлом-почуттям — у того, хто відкрив, ефект: сердечка, конфеті чи вогники.
// Вирішує перший такий смайл у тексті
const OPEN_FX = [
  [/❤|💕|💖|💗|💞|😍|🥰|😘|💋/u, (el) => loveRain(el)],
  [/🎉|🎊|🥳/u, (el) => { burst(el, '🎉', 6); burst(el, '🎊', 6); burst(el, '✨', 5); }],
  [/🔥/u, (el) => burst(el, '🔥', 10)],
];
// Смайл без відтінку шкіри, статі та VS16 — щоб 👏🏻 і 🤷‍♀️ впізнавались як реакції 👏 і 🤷
const bare = (s) => s.replace(/[\u{1F3FB}-\u{1F3FF}️]|‍[♀♂]/gu, '');
const REACT_BY_BARE = new Map(Object.keys(DUR).map((g) => [bare(g), g]));
export function openFx(el, text) {
  if (!text) return;
  // Лист з одного смайла, на який є анімація реакції, — граємо її саму
  const one = REACT_BY_BARE.get(bare(text.replace(/\s+/g, '')));
  if (one) { reactFx(el, one); return; }
  let best = null;
  let at = Infinity;
  for (const [re, fx] of OPEN_FX) {
    const m = re.exec(text);
    if (m && m.index < at) { at = m.index; best = fx; }
  }
  best?.(el);
}

// ── Фінал гри на полі (знаки ♂/♀): svg — знак, sex — he/she, колір береться з CSS (--he / --she)
const SALUTE = { he: ['#3d8bfd', '#8cc4ff', '#ffffff', '#ffd25a'], she: ['#ef476f', '#ff9db2', '#ffffff', '#ffd25a'] };
const boardMid = (board) => {
  const r = board.getBoundingClientRect();
  return { r, x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const bigSym = (svg, sex, x, y, size) => shape('fx-gsym', x, y, `<span class="gsym is-${sex}" style="width:${size}px;height:${size}px">${svg}</span>`);
// Салют кольору переможця: кольорові іскри розлітаються й опадають
function salute(x, y, colors, n, delay) {
  for (let i = 0; i < n; i += 1) {
    const s = shape('fx-dot', x, y);
    s.style.background = colors[i % colors.length];
    const a = (Math.PI * 2 * (i + Math.random() * 0.5)) / n;
    const d = 60 + Math.random() * 70;
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    gone(s)(s.animate([
      { transform: `${C} scale(.4)`, opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + 70}px)) scale(.5)`, opacity: 0 },
    ], { duration: 1300 + Math.random() * 400, delay, easing: 'cubic-bezier(.15, .7, .4, 1)', fill: 'backwards' }));
  }
}
// Перемога: мої фішки підстрибують, салют мого кольору, великий знак з 👑
export function boardWin(board, svg, sex) {
  sfx('win');
  if (reduceMotion || !board?.isConnected) return;
  const { r, x, y } = boardMid(board);
  board.querySelectorAll(':is(.ttt-cell, .db-box, .mm-card).is-me .gsym').forEach((p, k) => jolt(p, [
    { transform: 'translateY(0)' }, { transform: 'translateY(-24%) scale(1.18)' }, { transform: 'translateY(0)' },
    { transform: 'translateY(-10%) scale(1.06)' }, { transform: 'translateY(0)' },
  ], 750, 250 + k * 70));
  const c = SALUTE[sex] || SALUTE.he;
  salute(r.left + r.width * 0.22, r.top + r.height * 0.3, c, 18, 350);
  salute(r.left + r.width * 0.78, r.top + r.height * 0.25, c, 18, 750);
  salute(x, r.top + r.height * 0.15, c, 22, 1150);
  const s = bigSym(svg, sex, x, y, 124);
  gone(s)(s.animate([
    { transform: `${C} scale(.2) rotate(-25deg)`, opacity: 0 },
    { transform: `${C} scale(1.15) rotate(6deg)`, opacity: 1, offset: 0.25 },
    { transform: `${C} scale(1) rotate(0)`, opacity: 1, offset: 0.4 },
    { transform: `${C} scale(1.05)`, opacity: 1, offset: 0.8 },
    { transform: `${C} scale(1.4)`, opacity: 0 },
  ], { duration: 2600, delay: 500, easing: 'ease-out', fill: 'backwards' }));
  const crown = glyphAt('👑', x, y - 78, '3rem', 'fx-big');
  gone(crown)(crown.animate([
    { transform: `translate(-50%, -260%) rotate(-20deg)`, opacity: 0 },
    { transform: `${C} rotate(8deg)`, opacity: 1, offset: 0.3 },
    { transform: `${C} rotate(-4deg)`, opacity: 1, offset: 0.4 },
    { transform: `${C} rotate(0)`, opacity: 1, offset: 0.8 },
    { transform: `translate(-50%, -80%) scale(1.3)`, opacity: 0 },
  ], { duration: 2400, delay: 800, easing: 'ease-out', fill: 'backwards' }));
  for (let i = 0; i < 6; i += 1) twinkle('✨', x + (Math.random() - 0.5) * 170, y + (Math.random() - 0.5) * 150, '1.4rem', 900 + i * 180);
}
// Поразка: мої фішки никнуть і бліднуть, легкий дощик над полем, потім «Реванш?»
export function boardLose(board, svg, sex) {
  sfx('lose');
  if (reduceMotion || !board?.isConnected) return;
  const { r, x, y } = boardMid(board);
  board.querySelectorAll(':is(.ttt-cell, .db-box, .mm-card).is-me .gsym').forEach((p, k) => p.animate([
    { transform: 'none', opacity: 1 },
    { transform: 'translateY(14%) rotate(16deg) scale(.88)', opacity: 0.45 },
  ], { duration: 900, delay: 300 + k * 90, easing: 'ease-in', fill: 'forwards' }));
  for (let i = 0; i < 16; i += 1) {
    const s = glyphAt('💧', r.left + 14 + Math.random() * (r.width - 28), r.top - 30, `${0.9 + Math.random() * 0.5}rem`);
    gone(s)(s.animate([
      { transform: `${C} translateY(0)`, opacity: 0 },
      { transform: `${C} translateY(30px)`, opacity: 0.85, offset: 0.15 },
      { transform: `${C} translateY(${r.height * 0.9}px)`, opacity: 0 },
    ], { duration: 1200 + Math.random() * 500, delay: 400 + i * 110, easing: 'ease-in', fill: 'backwards' }));
  }
  const s = bigSym(svg, sex, x, y - 10, 96);
  gone(s)(s.animate([
    { transform: `${C} scale(.3)`, opacity: 0 }, { transform: `${C} scale(1.05)`, opacity: 0.95, offset: 0.25 },
    { transform: `${C} scale(1) rotate(-6deg)`, opacity: 0.95, offset: 0.45 }, { transform: `${C} scale(1) rotate(6deg)`, opacity: 0.95, offset: 0.65 },
    { transform: `${C} scale(.9)`, opacity: 0 },
  ], { duration: 2000, delay: 300, easing: 'ease-out', fill: 'backwards' }));
  const say = glyphAt('Реванш? 😉', x, r.bottom - 26, '1.6rem', 'fx-say');
  gone(say)(say.animate([
    { transform: `${C} scale(.4)`, opacity: 0 }, { transform: `${C} scale(1.1)`, opacity: 1, offset: 0.15 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.25 }, { transform: `${C} scale(1)`, opacity: 1, offset: 0.85 },
    { transform: `${C} translateY(-20px)`, opacity: 0 },
  ], { duration: 2600, delay: 1900, easing: 'ease-out', fill: 'backwards' }));
}
// Нічия: ♂ і ♀ з'їжджаються до середини й обіймаються, між ними ❤️, угору — сердечка
export function boardDraw(board, svgHe, svgShe) {
  sfx('draw');
  if (reduceMotion || !board?.isConnected) return;
  const { x, y } = boardMid(board);
  const pair = [[svgHe, 'he', -1], [svgShe, 'she', 1]];
  for (const [svg, sex, dir] of pair) {
    const s = bigSym(svg, sex, x, y, 84);
    gone(s)(s.animate([
      { transform: `translate(calc(-50% + ${dir * 170}px), -50%) scale(.6)`, opacity: 0 },
      { transform: `translate(calc(-50% + ${dir * 46}px), -50%) scale(1) rotate(${-dir * 10}deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(calc(-50% + ${dir * 40}px), -50%) scale(1.04) rotate(${-dir * 4}deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(calc(-50% + ${dir * 46}px), -50%) scale(1) rotate(${-dir * 10}deg)`, opacity: 1, offset: 0.85 },
      { transform: `translate(calc(-50% + ${dir * 46}px), -60%) scale(.9)`, opacity: 0 },
    ], { duration: 2200, easing: 'ease-out', fill: 'backwards' }));
  }
  const heart = glyphAt('❤️', x, y, '2.4rem', 'fx-big');
  gone(heart)(heart.animate([
    { transform: `${C} scale(0)`, opacity: 0 }, { transform: `${C} scale(1.3)`, opacity: 1, offset: 0.3 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.45 }, { transform: `${C} scale(1.2)`, opacity: 1, offset: 0.6 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.85 }, { transform: `${C} scale(1.4)`, opacity: 0 },
  ], { duration: 1900, delay: 500, easing: 'ease-out', fill: 'backwards' }));
  rise(x, y, ['💙', '❤️', '💜'], 10, { delay: 900, up: 200, spread: 200, size: 1.1 });
}
