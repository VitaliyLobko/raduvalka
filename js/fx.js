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
const DUR = { '❤️': 3400, '😍': 2500, '😂': 2300, '🥺': 2700, '🍓': 2600, '🫦': 2500, '🙏': 2600, '😎': 2700, '🫡': 3500, '🤯': 3100, '🤷': 2500, '🔥': 2600, '😴': 3000, '🤗': 2600, '😢': 2800, '🙃': 3100, '🍀': 2700, '💯': 2500 };

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

// «Обіймаю» 🤗: з двох боків до листа тягнуться долоні й стискають його, з обіймів вистрибують сердечка
REACT_FX['🤗'] = (el, x, y, r) => {
  big('🤗', x, y, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.18 },
    { transform: 'scale(1.05)', offset: 0.3 }, { transform: 'scale(1.2, 1.1)', offset: 0.38 },
    { transform: 'scale(1.1)', offset: 0.48 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.86 }, { transform: 'scale(.7)', opacity: 0 },
  ], 2500);
  const hy = clamp(r.top + r.height / 2, 80, innerHeight - 120);
  const lx = Math.max(26, r.left + 14);
  const rx = Math.min(innerWidth - 26, r.right - 14);
  for (const [g, hx, from] of [['🫱', lx, -1], ['🫲', rx, 1]]) {
    const hnd = glyphAt(g, hx, hy, '3.6rem', 'fx-big');
    gone(hnd)(hnd.animate([
      { transform: `translate(calc(-50% + ${from * 120}px), -50%) rotate(${from * 30}deg)`, opacity: 0 },
      { transform: `${C} rotate(0)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${-from * 12}px), -50%) scale(1.1)`, offset: 0.36 },
      { transform: `${C} scale(1)`, offset: 0.46 },
      { transform: `translate(calc(-50% + ${-from * 10}px), -50%) scale(1.08)`, offset: 0.56 },
      { transform: `${C} scale(1)`, opacity: 1, offset: 0.84 },
      { transform: `translate(calc(-50% + ${from * 60}px), -50%)`, opacity: 0 },
    ], { duration: 2400, delay: 100, easing: 'ease-out', fill: 'backwards' }));
  }
  jolt(el, [{ transform: 'none' }, { transform: 'scale(.95, 1.02)', offset: 0.3 }, { transform: 'none', offset: 0.5 },
    { transform: 'scale(.96, 1.015)', offset: 0.7 }, { transform: 'none' }], 1000, 600);
  rise(x, hy - 20, ['💕', '💗', '🧡', '💖'], 9, { delay: 950, up: 230, spread: 220 });
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

// Лише 🤯: екран дрижить, поки голова «закипає», і здригається на вибуху — шапка, переписка й вкладки разом,
// а самі смайлики летять поверх нерухомо. Час — як у рухах смайлика (теж × SLOW, бо викликається з reactFx)
const quake = (frames, duration, delay = 0) => {
  for (const s of document.querySelectorAll('.top, #screen, .tabs')) s.animate(frames, { duration, delay, easing: 'linear' });
};
// n поштовхів, що згасають: px — зсув, rot — нахил
const rattle = (px, n, rot = 0) => [
  { transform: 'none' },
  ...Array.from({ length: n }, (_, i) => {
    const k = 1 - i / n;
    const s = i % 2 ? -1 : 1;
    return { transform: `translate(${(s * px * k).toFixed(1)}px, ${(((i * 7) % 3) - 1) * px * k * 0.5}px) rotate(${(-s * rot * k).toFixed(2)}deg)` };
  }),
  { transform: 'none' },
];
const QUAKE = {
  '🤯': () => { quake(rattle(1.5, 14), 700, 330); quake(rattle(11, 12, 0.8), 650, 1030); },
};

export function reactFx(el, glyph) {
  if (reduceMotion || !el?.isConnected || !glyph) return;
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
    QUAKE[glyph]?.();
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

