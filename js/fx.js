// Маленькі анімації на відповідь людині: сердечка, виліт картки, згортання рядка.
// Web Animations API — без класів у CSS для кожного руху; «менше руху» в телефоні — нічого не рухаємо
import { reduceMotion } from './ui.js';
import { sfx } from './sound.js';
import { usPhoto, US, HER, HIS } from './usphoto.js';
import { GALAXY } from './galaxy.js';

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
const gone = (s, keep) => (a) => {
  const delay = a.effect?.getTiming().delay || 0;
  const add = () => { if (!s.isConnected) document.body.append(s); };
  if (delay > 40) setTimeout(add, delay - 30);
  else add();
  if (keep) keep.push(s);
  else a.finished.finally(() => s.remove());
};
const C = 'translate(-50%, -50%)';

// Реакції з фото: сцена грає як завжди, але фото з рамкою й тлом не тануть — лишаються, поки не торкнешся екрана.
// hold(D) — почати (повертає список, куди gone складає те, що лишається); stay — ті самі кадри без останнього, зникнення
let held = null;
function release() {
  const hd = held;
  if (!hd) return;
  held = null;
  clearTimeout(hd.timer);
  removeEventListener('keydown', hd.key);
  hd.tap?.remove();
  for (const s of hd.els) s.animate([{ opacity: 0 }], { duration: 320, easing: 'ease-in', fill: 'forwards' }).finished.finally(() => s.remove());
  hd.ok();
}
function hold(D) {
  release();
  const hd = { els: [], tap: null };
  hd.done = new Promise((ok) => { hd.ok = ok; });
  // Шар для дотику — лише коли сцена дограла: до того дотик іде в саму сторінку, як і в інших реакцій
  hd.timer = setTimeout(() => {
    if (held !== hd) return;
    // Вікно для back.js (role=dialog): «Назад» на телефоні клацає по ньому й закриває. Закриваємо на click, а не
    // на pointerdown — інакше відпущений палець «клацнув» би по листу під фото
    hd.tap = document.createElement('div');
    hd.tap.className = 'fx-hold';
    hd.tap.setAttribute('role', 'dialog');
    hd.tap.setAttribute('aria-label', 'Фото из реакции');
    const hint = document.createElement('p');
    hint.className = 'fx-hold-hint';
    hint.textContent = 'Коснись, чтобы закрыть';
    hd.tap.append(hint);
    hd.tap.addEventListener('click', release);
    hd.key = (e) => { if (e.key === 'Escape') release(); };
    addEventListener('keydown', hd.key);
    document.body.append(hd.tap);
  }, D * SLOW);
  held = hd;
  return hd.els;
}
const stay = (frames) => {
  const f = frames.slice(0, -1);
  const { offset, ...last } = f[f.length - 1];
  f[f.length - 1] = last;
  return f;
};

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
function veil(cls, frames, dur, delay = 0, x = 0, y = 0, keep = null) {
  const v = shape(cls, 0, 0);
  v.style.setProperty('--vx', `${x}px`);
  v.style.setProperty('--vy', `${y}px`);
  gone(v, keep)(v.animate(keep ? stay(frames) : frames, { duration: dur, delay, fill: 'both' }));
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
const DUR = { '🌌': 4600, '🧸': 3000, '😉': 2600, '🍒': 2800, '🪖': 3200, '🎁': 3000, '🤣': 2700, '🫣': 3000, '🌸': 3000, '⭐': 3200, '🎖️': 3400, '🛡️': 3000, '🚀': 3000, '🍿': 2900, '💊': 3600, '🤮': 3300, '🌈': 3200, '😏': 2600, '🪐': 2900, '🏹': 2700, '🐾': 2800, '❤️': 3400, '😍': 2500, '😂': 2300, '🥺': 2700, '🍓': 2600, '🫦': 2500, '🙏': 3000, '😎': 2700, '🫡': 3500, '🤯': 3100, '🤷': 2500, '🔥': 2600, '😴': 3000, '🤗': 2600, '😢': 3300, '🙃': 3100, '🍀': 2700, '💯': 2500, '😘': 2800, '👏': 2800, '🎉': 3000, '💪': 2700, '🙈': 2600, '👀': 2600, '😱': 3400, '🤔': 2900, '🌹': 4300, '☕': 2800, '👍': 2600, '☀️': 3200, '🌙': 3400, '😇': 3300, '🍷': 3000, '🍕': 2800, '🥶': 3000, '🥵': 2900, '🤒': 3300 };

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
  // Три хмари вгорі екрана: велика над смайликом і дві менші по боках, трохи пливуть
  [[0.12, -1, '4.6rem', 260], [0.38, 1, '5.4rem', 120], [0.64, -1, '5rem', 200], [0.9, 1, '4.4rem', 320]].forEach(([fx, dir, size, d]) => {
    // Намальована дощова хмара (без своїх крапель — ллє злива нижче): пухнаста, сіро-синя, темніша знизу
    const w = parseFloat(size) * 28;
    const cl = shape('fx-raincloud', innerWidth * fx, 34, `<svg viewBox="0 0 120 64" width="${w}" height="${w * 0.53}"><defs><linearGradient id="rc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B9C4D6"/><stop offset="1" stop-color="#6E7F99"/></linearGradient></defs><path fill="url(#rc)" d="M22 58c-11 0-19-7-19-16 0-8 6-14 14-15 2-12 12-20 25-20 9 0 17 5 21 12 3-2 7-3 11-3 11 0 20 8 21 18 9 1 16 7 16 15 0 6-5 9-11 9z"/></svg>`);
    gone(cl)(cl.animate([
      { transform: `${C} translateY(-40px) scale(.4)`, opacity: 0 }, { transform: `${C} scale(1)`, opacity: 1, offset: 0.18 },
      { transform: `${C} translateX(${dir * -8}px)`, opacity: 1, offset: 0.5 }, { transform: `${C} translateX(${dir * 8}px)`, opacity: 1, offset: 0.82 },
      { transform: `${C} translateY(-24px) scale(.9)`, opacity: 0 },
    ], { duration: 3000, delay: d, easing: 'ease-out', fill: 'backwards' }));
  });
  // Злива: два шари косих струменів на весь екран — дальній дрібніший і повільніший, ближній крупніший і швидший
  // (глибина); візерунок безшовний, рухається сам шар — це дешево навіть на слабкому телефоні
  const sheet = document.createElement('div');
  sheet.className = 'fx-burst fx-rainfall';
  sheet.setAttribute('aria-hidden', 'true');
  sheet.innerHTML = '<i class="is-far"></i><i class="is-near"></i>';
  gone(sheet)(sheet.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }],
    { duration: 2700, delay: 350, easing: 'ease-in-out', fill: 'backwards' }));
  for (const [cls, tile, ms] of [['.is-far', 140, 520], ['.is-near', 220, 380]]) {
    sheet.querySelector(cls).animate([{ transform: `translateY(-${tile}px)` }, { transform: 'translateY(0)' }],
      { duration: ms, delay: 350, iterations: Math.ceil(2700 / ms) });
  }
  // Бризки по низу екрана, поки ллє
  for (let i = 0; i < 22; i += 1) {
    const sp = shape('fx-splash', Math.random() * innerWidth, innerHeight - 20 - Math.random() * 60);
    gone(sp)(sp.animate([{ transform: 'translate(-50%, -50%) scale(.2)', opacity: 0.9 }, { transform: 'translate(-50%, -50%) scale(1.7)', opacity: 0 }],
      { duration: 500, delay: 700 + Math.random() * 2000, easing: 'ease-out', fill: 'backwards' }));
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

// «Воображение» 🌈 — як у мемі: долоні зводять угорі й розводять по дузі, за ними на всю ширину малюється веселка,
// над нею великий білий підпис з обводкою, на кінцях блищить
const RAINBOW = ['#E5484D', '#F2892B', '#F5C518', '#3FA34D', '#3B7DD8', '#8E4EC6'];
REACT_FX['🌈'] = (el, x, y) => {
  const D = 3100;
  const cx = innerWidth / 2;
  const R = Math.min(innerWidth - 40, 330) / 2 - 8;
  const by = clamp(y + 60, R + 120, innerHeight - 110);
  const band = 8;
  const H = R + band;
  const W = 2 * R + band;
  // Дві половини від верху до кінців — малюються одночасно, услід за долонями
  // Кожна половинка починається на 2° за верхівкою, тож посередині вони накладаються — без щілини на стику
  const arcs = RAINBOW.map((c, i) => {
    const r = R - i * band;
    const pt = (deg) => `${(W / 2 + r * Math.cos((deg * Math.PI) / 180)).toFixed(2)} ${(H - r * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`;
    return `<path pathLength="1" stroke="${c}" d="M${pt(88)} A${r} ${r} 0 0 0 ${W / 2 - r} ${H}"/>`
      + `<path pathLength="1" stroke="${c}" d="M${pt(92)} A${r} ${r} 0 0 1 ${W / 2 + r} ${H}"/>`;
  }).join('');
  const arc = shape('fx-arc', cx, by, `<svg viewBox="0 0 ${W} ${H + 2}" width="${W}" height="${H + 2}" aria-hidden="true"><g fill="none" stroke-width="${band + 0.6}">${arcs}</g></svg>`);
  gone(arc)(arc.animate([{ opacity: 1 }, { opacity: 1, offset: 0.86 }, { opacity: 0 }], { duration: D, fill: 'backwards' }));
  const draw = { duration: D * 0.3, delay: D * 0.08, easing: 'cubic-bezier(.4, 0, .3, 1)', fill: 'backwards' };
  for (const p of arc.querySelectorAll('path')) p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], draw);
  // Долоні: разом угорі — розходяться по дузі до кінців
  const at = (deg) => [cx + R * Math.cos((deg * Math.PI) / 180), by - R * Math.sin((deg * Math.PI) / 180)];
  for (const [g, side] of [['🫲', -1], ['🫱', 1]]) {
    const pts = [90, 70, 45, 20, 0].map((d) => at(side < 0 ? 180 - d : d));
    const [x0, y0] = pts[0];
    const hand = glyphAt(g, x0, y0, '3.2rem');
    const mv = ([px, py], rot) => `translate(calc(-50% + ${px - x0}px), calc(-50% + ${py - y0}px)) rotate(${rot}deg)`;
    const o0 = 0.08;
    const span = 0.3;
    gone(hand)(hand.animate([
      { transform: `${mv(pts[0], 0)} scale(.4)`, opacity: 0 },
      { transform: mv(pts[0], 0), opacity: 1, offset: o0 },
      ...pts.slice(1).map((p, i) => ({ transform: mv(p, side * (i + 1) * 12), offset: o0 + (span * (i + 1)) / 4 })),
      { transform: mv(pts[4], side * 48), opacity: 1, offset: 0.84 },
      { transform: `${mv(pts[4], side * 48)} scale(.7)`, opacity: 0 },
    ], { duration: D, easing: 'linear', fill: 'backwards' }));
  }
  // Іскри по дузі, щойно вона домалювалась
  for (let i = 0; i < 7; i += 1) {
    const [px, py] = at(15 + i * 25);
    twinkle(i % 2 ? '✨' : '⭐', px + (Math.random() - 0.5) * 16, py - 10, `${1.1 + Math.random() * 0.5}rem`, D * 0.36 + i * 90);
  }
  const word = glyphAt('ВООБРАЖЕНИЕ', cx, Math.max(56, by - R - 34), 'min(2.5rem, 9vw)', 'fx-meme');
  gone(word)(word.animate([
    { transform: `${C} scale(.4)`, opacity: 0 }, { transform: `${C} scale(1.12)`, opacity: 1, offset: 0.14 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.24 }, { transform: `${C} scale(1.03)`, opacity: 1, offset: 0.86 },
    { transform: `${C} translateY(-10px)`, opacity: 0 },
  ], { duration: D * 0.7, delay: D * 0.3, easing: 'ease-out', fill: 'backwards' }));
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
// Реакції з фото: на першому старті фото ще стягуються — чекаємо перше (не довше 2,5 с), інакше вийшла б галактика
// чи звичайна полуниця. Сама реакція має бути синхронною (SLOW), тож чекаємо до неї
function albumWait(el, glyph) {
  const album = glyph === '🌌' ? US : glyph === '🍓' && fromHim(el) ? HER : glyph === '🛡️' && !fromHim(el) ? HIS : null;
  if (!album?.waiting()) return null;
  return Promise.race([album.ready(), new Promise((ok) => { setTimeout(ok, 2500); })]);
}

// Ключ реакції (r:<повідомлення>:<смайлик>) — для вибору фото з альбому, однакового в обох; рухи сцени синхронні
let fxSeed = null;
export function reactFx(el, glyph, waited = false, seed = null) {
  const wait = !waited && albumWait(el, glyph);
  if (wait) { wait.then(() => reactFx(el, glyph, true, seed)); return; }
  if (glyph && el?.isConnected) sfx('react');
  if (reduceMotion || !el?.isConnected || !glyph) return;
  release();
  // Поки йде реакція, тло не їздить за нахилом (depth.js) — відеокарта зайнята лише смайликами
  const root = document.documentElement;
  root.classList.add('is-fx');
  clearTimeout(fxCalm);
  fxCalm = setTimeout(() => root.classList.remove('is-fx'), (durOf(glyph, el) || 1600) * SLOW + 200);
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
  fxSeed = seed;
  try {
    QUAKE[glyph]?.(el);
    if (fx) fx(el, x, y, r);
    else {
      big(glyph, x, y, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.3 }, { transform: 'scale(1)', opacity: 1, offset: 0.8 }, { transform: 'scale(.6)', opacity: 0 }], 1300);
      spray(x, y, [glyph], 8, { delay: 300 });
    }
  } finally {
    Element.prototype.animate = animate;
    fxSeed = null;
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
export function reactFxQueued(el, glyph, seed = null) {
  fxQueue = fxQueue.then(() => albumWait(el, glyph)).then(() => {
    if (!el?.isConnected || reduceMotion) return undefined;
    reactFx(el, glyph, true, seed);
    // Фото з реакції чекає дотику — наступна йде, коли його прибрали
    return new Promise((ok) => { setTimeout(ok, (durOf(glyph, el) || 2200) * SLOW - 400); }).then(() => held?.done);
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
  // Ще дві мавпочки вискакують знизу по боках і ховаються: «не чую» й «мовчу»
  [['🙉', -96, 1150], ['🙊', 96, 1400]].forEach(([g, dx, d]) => {
    const m = glyphAt(g, x + dx, y + 40, '3.4rem');
    gone(m)(m.animate([
      { transform: `translate(-50%, calc(-50% + 40px)) scale(.3) rotate(${dx < 0 ? -20 : 20}deg)`, opacity: 0 },
      { transform: `${C} scale(1.15) rotate(${dx < 0 ? 8 : -8}deg)`, opacity: 1, offset: 0.25 },
      { transform: `${C} scale(1) rotate(${dx < 0 ? -4 : 4}deg)`, opacity: 1, offset: 0.5 },
      { transform: `${C} scale(1.05) rotate(0)`, opacity: 1, offset: 0.8 },
      { transform: 'translate(-50%, calc(-50% + 30px)) scale(.6)', opacity: 0 },
    ], { duration: 1150, delay: d, easing: 'ease-out', fill: 'backwards' }));
  });
  spray(x, y - 20, ['💗', '💕', '🌸'], 9, { dist: 120, size: '1.3rem', delay: 1500 });
};

// «Цікаво» 👀: очі бігають ліворуч-праворуч, потім пильно нахиляються до листа; довкола спалахують іскорки
REACT_FX['👀'] = (el, x, y, r) => {
  big('👀', x, y, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.12 },
    { transform: 'translateX(-26px) scale(1.1)', offset: 0.24 }, { transform: 'translateX(26px) scale(1.1)', offset: 0.38 },
    { transform: 'translateX(-20px) scale(1.1)', offset: 0.5 }, { transform: 'translateX(0) scale(1.1)', offset: 0.6 },
    { transform: 'translateY(24px) scale(1.35)', opacity: 1, offset: 0.74 }, { transform: 'translateY(24px) scale(1.3)', opacity: 1, offset: 0.88 },
    { transform: 'translateY(30px) scale(.8)', opacity: 0 },
  ], 2600, '5.4rem');
  jolt(el, [{ transform: 'none' }, { transform: 'scale(1.03)' }, { transform: 'none' }], 300, 1900);
  // Лупа читає лист: зигзагом рядок за рядком, під склом — мʼяка пляма світла; наприкінці «знайшла» — спалах іскор
  const box = r || el?.getBoundingClientRect?.() || { left: x - 120, right: x + 120, top: y - 30, bottom: y + 60 };
  const L = clamp(box.left + 30, 30, innerWidth - 60);
  const R = clamp(box.right - 30, L + 60, innerWidth - 30);
  const T = clamp(box.top + 24, 70, innerHeight - 160);
  const B = clamp(box.bottom - 20, T + 40, innerHeight - 90);
  const rows = [T, (T + B) / 2, B];
  const pts = rows.flatMap((ry, i) => (i % 2 ? [[R, ry], [L, ry]] : [[L, ry], [R, ry]]));
  const [x0, y0] = pts[0];
  const glow = shape('fx-lensglow', x0, y0);
  const lens = glyphAt('🔍', x0, y0, '3rem', 'fx-lens');
  const dur = 1900;
  const mv = (px, py, extra = '') => `translate(calc(-50% + ${px - x0}px), calc(-50% + ${py - y0}px)) ${extra}`;
  const path = pts.map(([px, py], i) => ({ transform: mv(px, py, `rotate(${i % 2 ? 8 : -8}deg)`), offset: 0.08 + (i / (pts.length - 1)) * 0.78 }));
  const opts = { duration: dur, delay: 380, easing: 'ease-in-out', fill: 'backwards' };
  gone(lens)(lens.animate([
    { transform: `${mv(x0, y0)} scale(.3)`, opacity: 0 }, ...path.map((f, i) => ({ ...f, opacity: 1, ...(i ? {} : { transform: `${f.transform} scale(1)` }) })),
    { transform: `${mv(...pts.at(-1))} scale(1.25)`, opacity: 1, offset: 0.93 }, { transform: `${mv(...pts.at(-1))} scale(.6)`, opacity: 0 },
  ], opts));
  gone(glow)(glow.animate([
    { transform: `${mv(x0, y0)} scale(.3)`, opacity: 0 }, ...path.map((f) => ({ transform: f.transform, offset: f.offset, opacity: 1 })),
    { transform: `${mv(...pts.at(-1))} scale(1.6)`, opacity: 0.9, offset: 0.93 }, { transform: `${mv(...pts.at(-1))} scale(2)`, opacity: 0 },
  ], opts));
  const [fx2, fy2] = pts.at(-1);
  [[-26, -24], [28, -20], [-10, 30], [24, 26]].forEach(([dx, dy], i) => twinkle('✨', fx2 + dx, fy2 + dy, '1.3rem', 380 + dur * 0.9 + i * 70));
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

// Чумацький Шлях — малюємо раз на сцену в canvas: дуга навскіс через центр, ширина гуляє, біля центру — вздуття;
// хмари світла, темні пилові прожилки з розривами, густий зоряний пил уздовж і рідкі зорі по небу.
// Два полотна: c — сяйво з пилом, s — зорі (мерехтять і пливуть окремо — глибина). at(t, off) — точка на смузі
// (t 0…1 уздовж, off — пікселі вбік), wid(t) — її ширина
function milkyWay(W, H, cx, cy) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const layer = () => {
    const el = document.createElement('canvas');
    el.width = Math.round(W * dpr);
    el.height = Math.round(H * dpr);
    const g = el.getContext('2d');
    g.scale(dpr, dpr);
    return [el, g];
  };
  const [c, x] = layer();
  const rnd = Math.random;
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  // Нахил щоразу інший: 35…65°, то знизу зліва вгору, то згори зліва вниз
  const a = ((rnd() < 0.5 ? -1 : 1) * (35 + rnd() * 30) * Math.PI) / 180;
  const L = Math.hypot(W, H) * 0.62;
  const [dx, dy] = [Math.cos(a), Math.sin(a)];
  const [nx, ny] = [-dy, dx];
  const bow = (rnd() < 0.5 ? -1 : 1) * W * (0.14 + rnd() * 0.08);
  const P0 = [cx - dx * L - nx * bow, cy - dy * L - ny * bow];
  const P1 = [cx + nx * bow, cy + ny * bow];
  const P2 = [cx + dx * L - nx * bow, cy + dy * L - ny * bow];
  const at = (t, off = 0) => {
    const u = 1 - t;
    const tx = 2 * u * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
    const ty = 2 * u * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
    const l = Math.hypot(tx, ty) || 1;
    return [u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0] - (ty / l) * off, u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1] + (tx / l) * off];
  };
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  const core = (t) => Math.exp(-(((t - 0.5) / 0.13) ** 2));
  const wid = (t) => 44 * (0.75 + 0.18 * Math.sin(t * 9 + ph[0]) + 0.22 * Math.sin(t * 23 + ph[1])) + 38 * core(t);
  const blob = (px, py, r, rgb, al) => {
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(${rgb}, ${al})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    x.fillStyle = g;
    x.fillRect(px - r, py - r, r * 2, r * 2);
  };
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 170; i += 1) {
    const t = rnd();
    const w = wid(t);
    const [px, py] = at(t, gauss() * w * 0.8);
    const rgb = rnd() < core(t) * 0.8 ? '255, 226, 190' : rnd() < 0.45 ? '247, 184, 210' : '142, 116, 224';
    blob(px, py, w * (0.5 + rnd() * 0.8), rgb, 0.05 + rnd() * 0.07);
  }
  for (let i = 0; i < 40; i += 1) {
    const t = rnd();
    const w = wid(t);
    const [px, py] = at(t, gauss() * w * 0.5);
    blob(px, py, w * (0.12 + rnd() * 0.2), '255, 240, 230', 0.1 + rnd() * 0.12);
  }
  // Пил — дві тонкі звивисті прожилки з розривами: багато дрібних слабких плям зливаються у волокно
  x.globalCompositeOperation = 'destination-out';
  // Плями витягнуті вздовж смуги й різної товщини — волокно, а не пунктир
  for (const [k, shift] of [[11, 0.12], [7, -0.22]]) {
    for (let i = 0; i < 360; i += 1) {
      const t = rnd();
      if (Math.sin(t * 17 + ph[2] + shift * 9) < -0.3) continue;
      const w = wid(t);
      const thick = 0.5 + 0.5 * Math.sin(t * 29 + ph[1] + k);
      const [px, py] = at(t, w * (shift + 0.13 * Math.sin(t * k + ph[2]) + gauss() * 0.08));
      const [qx, qy] = at(Math.min(1, t + 0.002), w * (shift + 0.13 * Math.sin((t + 0.002) * k + ph[2])));
      x.save();
      x.translate(px, py);
      x.rotate(Math.atan2(qy - py, qx - px) + gauss() * 0.4);
      x.scale(2.2 + rnd() * 1.6, 1);
      blob(0, 0, w * (0.03 + thick * 0.08 + rnd() * 0.03), '0, 0, 0', 0.07 + rnd() * 0.12);
      x.restore();
    }
  }
  const [s, z] = layer();
  z.globalCompositeOperation = 'lighter';
  const dot = (px, py, r, al) => {
    z.fillStyle = `rgba(255, ${235 + Math.floor(rnd() * 20)}, ${215 + Math.floor(rnd() * 40)}, ${al})`;
    z.beginPath();
    z.arc(px, py, r, 0, Math.PI * 2);
    z.fill();
  };
  for (let i = 0; i < 520; i += 1) {
    const t = rnd();
    const [px, py] = at(t, gauss() * wid(t) * 1.1);
    dot(px, py, rnd() < 0.08 ? 1.1 + rnd() * 0.6 : 0.35 + rnd() * 0.6, 0.35 + rnd() * 0.6);
  }
  for (let i = 0; i < 70; i += 1) dot(rnd() * W, rnd() * H, 0.3 + rnd() * 0.6, 0.2 + rnd() * 0.4);
  return { c, s, at, wid };
}

// «Вселенная нас любит» 🌌: ніч і навскіс Чумацький Шлях; у центрі народжується зірка — спалах розкривається
// колом із нашим фото (не вибрали — своя галактика), золоте кільце прокреслює світло; довкола сузірʼя, написи по дузі.
// Сцена — по центру екрана, не над повідомленням: вона на весь екран
let cosmosFrame = Math.random() < 0.5 ? 'gold' : 'stars';
REACT_FX['🌌'] = () => {
  const D = 4600;
  const cx = innerWidth / 2;
  const cy = clamp(innerHeight * 0.46, 250, innerHeight - 250);
  const R = 98;
  const RS = 146;
  const us = usPhoto(fxSeed);
  const keep = us ? hold(D) : null;
  const live = (s, frames, o, k) => gone(s, k)(s.animate(k ? stay(frames) : frames, { ...o, fill: k ? 'both' : 'backwards' }));
  const fade = [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }];
  veil('fx-cosmos', fade, D, 0, cx, cy, keep);
  const mw = milkyWay(innerWidth, innerHeight, cx, cy);
  const milky = shape('fx-milky', 0, 0);
  milky.style.width = `${innerWidth}px`;
  milky.style.height = `${innerHeight}px`;
  milky.append(mw.c, mw.s);
  live(milky, fade, { duration: D }, keep);
  // Небо ледь повертається й наближається, зорі — швидше за сяйво й мерехтять: смуга не стоїть картинкою
  if (!reduceMotion) {
    mw.c.animate([{ transform: 'scale(1.06) rotate(-1.5deg)' }, { transform: 'scale(1) rotate(.8deg)' }], { duration: D, easing: 'ease-out', fill: 'forwards' });
    mw.s.animate([{ transform: 'scale(1.12) rotate(-2.5deg)' }, { transform: 'scale(1) rotate(1.4deg)' }], { duration: D, easing: 'ease-out', fill: 'forwards' });
    mw.s.animate([{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], { duration: 1400, iterations: Infinity, easing: 'ease-in-out' });
  }
  // Блискітки — на самій смузі
  for (let i = 0; i < 26; i += 1) {
    const t = 0.08 + Math.random() * 0.84;
    const [px, py] = mw.at(t, (Math.random() + Math.random() - 1) * mw.wid(t) * 0.8);
    const s = shape('fx-dot is-tiny', px, py);
    live(s, [{ transform: `${C} scale(.3)`, opacity: 0 }, { transform: C, opacity: 1, offset: 0.2 }, { transform: C, opacity: 0.35, offset: 0.5 },
      { transform: C, opacity: 1, offset: 0.75 }, { transform: C, opacity: 0 }], { duration: D * 0.9, delay: Math.random() * 600 });
  }
  // Народження зірки: точка набирає світла, спалахує — і з неї розкривається коло
  live(shape('fx-nova', cx, cy), [
    { transform: `${C} scale(0)`, opacity: 0 }, { transform: `${C} scale(.45)`, opacity: 1, offset: 0.35 },
    { transform: `${C} scale(.3)`, offset: 0.5 }, { transform: `${C} scale(4.5)`, opacity: 0.9, offset: 0.8 }, { transform: `${C} scale(6)`, opacity: 0 },
  ], { duration: 1300, delay: 300, easing: 'ease-out' });
  const disc = shape(`fx-us${us ? '' : ' is-galaxy'}`, cx, cy, us ? '' : GALAXY);
  if (us) disc.style.backgroundImage = `url("${us}")`;
  else disc.firstElementChild.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-140deg)' }], { duration: D, easing: 'linear' });
  live(disc, [
    { transform: `${C} scale(.05)`, opacity: 0 }, { transform: `${C} scale(1.06)`, opacity: 1, offset: 0.12 }, { transform: `${C} scale(1)`, offset: 0.18 },
    { transform: `${C} scale(1.035)`, offset: 0.45 }, { transform: `${C} scale(1)`, offset: 0.55 }, { transform: `${C} scale(1.035)`, offset: 0.65 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.9 }, { transform: `${C} scale(.92)`, opacity: 0 },
  ], { duration: D - 900, delay: 900, easing: 'ease-in-out' }, keep);
  // Рамка — по черзі золоте кільце й кільце із зірочок. Проявляється за зіркою, що біжить по колу від верху.
  // Рамкою, не штрихом SVG: stroke-dashoffset рахує процесор кожен кадр, а прозорість і масштаб — відеокарта
  cosmosFrame = cosmosFrame === 'gold' ? 'stars' : 'gold';
  if (cosmosFrame === 'stars') {
    for (let i = 0; i < 14; i += 1) {
      const t = (i / 14) * Math.PI * 2 - Math.PI / 2;
      const s = shape(`fx-cos-star${i % 2 ? ' is-small' : ''}`, cx + Math.cos(t) * (R + 18), cy + Math.sin(t) * (R + 18), i % 2 ? '✦' : '★');
      live(s, [
        { transform: `${C} scale(0)`, opacity: 0 }, { transform: `${C} scale(1.6)`, opacity: 1, offset: 0.06 }, { transform: C, offset: 0.12 },
        { transform: `${C} scale(${i % 2 ? 1.3 : 0.75})`, opacity: 0.6, offset: 0.4 }, { transform: C, opacity: 1, offset: 0.65 },
        { transform: C, opacity: 1, offset: 0.9 }, { transform: `${C} scale(0)`, opacity: 0 },
      ], { duration: D - 1000 - i * 60, delay: 1000 + i * 60, easing: 'ease-out' }, keep);
    }
  }
  live(shape(`fx-us-ring${cosmosFrame === 'stars' ? ' is-stars' : ''}`, cx, cy), [
    { transform: `${C} scale(1.12)`, opacity: 0 }, { transform: C, opacity: 1, offset: 0.22 }, { transform: C, opacity: 1, offset: 0.9 }, { transform: C, opacity: 0 },
  ], { duration: D - 1000, delay: 1000, easing: 'ease-out' }, keep);
  live(shape('fx-dot is-big', cx, cy), [
    { transform: `${C} rotate(0) translateY(-${R + 2}px)`, opacity: 1 }, { transform: `${C} rotate(360deg) translateY(-${R + 2}px)`, opacity: 1, offset: 0.9 },
    { transform: `${C} rotate(380deg) translateY(-${R + 2}px) scale(2)`, opacity: 0 },
  ], { duration: 880, delay: 1000, easing: 'ease-in-out' });
  // Сузірʼя: зорі запалюються по колу, потім проступають лінії між ними
  const pts = [];
  for (let i = 0; i < 18; i += 1) {
    const t = (i / 18) * Math.PI * 2 - Math.PI / 2 + 0.08;
    const rr = RS + [8, -6, 2][i % 3];
    pts.push([Math.cos(t) * rr, Math.sin(t) * rr]);
  }
  const lines = pts.map(([x1, y1], i) => { const [x2, y2] = pts[(i + 1) % 18]; return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`; }).join('');
  const box = RS + 20;
  live(shape('fx-cons', cx, cy, `<svg viewBox="${-box} ${-box} ${box * 2} ${box * 2}" width="${box * 2}" height="${box * 2}">${lines}</svg>`),
    [{ transform: `${C} scale(.96)`, opacity: 0 }, { transform: C, opacity: 1, offset: 0.15 }, { transform: C, opacity: 1, offset: 0.85 }, { transform: C, opacity: 0 }],
    { duration: D - 2300, delay: 2200 });
  pts.forEach(([px, py], i) => live(shape(`fx-dot${i % 4 ? '' : ' is-big'}`, cx + px, cy + py), [
    { transform: `${C} scale(0)`, opacity: 0 }, { transform: `${C} scale(1.8)`, opacity: 1, offset: 0.06 }, { transform: C, offset: 0.12 },
    { transform: `${C} scale(${i % 2 ? 0.7 : 1.2})`, offset: 0.5 }, { transform: C, opacity: 1, offset: 0.88 }, { transform: `${C} scale(0)`, opacity: 0 },
  ], { duration: D - 1500 - i * 55, delay: 1500 + i * 55, easing: 'ease-out' }));
  // Написи по дузі: зверху — над сузірʼям, знизу — під ним, літерами назовні
  const rt = RS + 32;
  const rb = RS + 40;
  const arc = (cls, d, text, base) => `<svg class="${cls}" viewBox="${-rb - 40} ${-rb - 40} ${(rb + 40) * 2} ${(rb + 40) * 2}" width="${(rb + 40) * 2}" height="${(rb + 40) * 2}">`
    + `<path id="${cls}-p" d="${d}" fill="none"/><text><textPath href="#${cls}-p" startOffset="50%" text-anchor="middle"${base}>${text}</textPath></text></svg>`;
  const arcIn = [{ transform: C, opacity: 0 }, { transform: C, opacity: 1, offset: 0.14 }, { transform: C, opacity: 1, offset: 0.86 }, { transform: C, opacity: 0 }];
  live(shape('fx-cos-arc', cx, cy, arc('fx-cos-t', `M ${-rt} 0 A ${rt} ${rt} 0 0 1 ${rt} 0`, 'Вселенная нас любит', '')), arcIn, { duration: D - 2000, delay: 1900 }, keep);
  live(shape('fx-cos-arc', cx, cy, arc('fx-cos-b', `M ${-rb} 0 A ${rb} ${rb} 0 0 0 ${rb} 0`, 'Вместе, долго и счастливо!', ' dominant-baseline="hanging"')), arcIn, { duration: D - 2500, delay: 2400 }, keep);
  for (let i = 0; i < 4; i += 1) {
    const t = Math.PI * (0.2 + i * 0.5);
    twinkle('✨', cx + Math.cos(t) * (R + 4), cy + Math.sin(t) * (R + 4), '1.2rem', 2700 + i * 260);
  }
};

// 🍓 від нього, коли є її фото (альбом her): велика полуниця падає в центр і розкривається серцем з одним її фото —
// щоразу іншим (випадкове, не те, що минулого разу); серце двічі «тукає», довкола полуничний дощ. Від неї чи без
// фото — звичайна 🍓. Хто поставив: реакція стоїть на чужому листі — на моєму телефоні чужий рядок означає «я»
const HEART = 'M130 228 C 52 170, 6 124, 6 72 C 6 34, 36 8, 72 8 C 98 8, 118 24, 130 44 C 142 24, 162 8, 188 8 C 224 8, 254 34, 254 72 C 254 124, 208 170, 130 228 Z';
const BERRY_D = 3900;
const BERRY_POP = 760;
const BERRY_BEATS = [1300, 2300];
const fromHim = (el) => {
  const vin = document.documentElement.dataset.side === 'vin';
  const row = el?.closest?.('.feed-row');
  return row ? row.classList.contains('is-theirs') === vin : vin;
};
const berryPhotos = (el) => HER.size() > 0 && fromHim(el);
function durOf(glyph, el) {
  if (glyph === '🍓' && berryPhotos(el)) return BERRY_D;
  if (glyph === '🛡️' && shieldPhotos(el)) return SHIELD_D;
  return DUR[glyph];
}
let berryId = 0;
function berryHeart() {
  const D = BERRY_D;
  const cx = innerWidth / 2;
  const cy = clamp(innerHeight * 0.45, 200, innerHeight - 220);
  const live = (s, frames, o, k) => gone(s, k)(s.animate(k ? stay(frames) : frames, { ...o, fill: k ? 'both' : 'backwards' }));
  const keep = hold(D);
  veil('fx-berry', [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], D, 0, cx, cy, keep);
  // Полуничний дощ на весь екран — за серцем
  const drops = 14;
  for (let i = 0; i < drops; i += 1) {
    const px = 20 + Math.random() * (innerWidth - 40);
    const s = glyphAt('🍓', px, innerHeight + 40, `${1.3 + Math.random() * 1.1}rem`);
    const sway = (Math.random() - 0.5) * 70;
    live(s, [
      { transform: `translate(-50%, calc(-50% - ${innerHeight + 110}px)) rotate(0)`, opacity: 1 },
      { transform: `translate(calc(-50% + ${sway}px), -50%) rotate(${(Math.random() - 0.5) * 140}deg)`, opacity: 1 },
    ], { duration: 2400 + Math.random() * 900, delay: 150 + (i / drops) * 900, easing: 'linear' });
  }
  // Велика полуниця падає в центр, плющиться — і з неї розкривається серце
  live(glyphAt('🍓', cx, cy, '5.6rem', 'fx-big'), [
    { transform: `translate(-50%, calc(-50% - ${cy + 80}px))`, opacity: 1, easing: 'ease-in' },
    { transform: C, offset: 0.6 }, { transform: `${C} translateY(12px) scale(1.35, .65)`, offset: 0.75 }, { transform: `${C} scale(.2)`, opacity: 0 },
  ], { duration: 1000 });
  ring(cx, cy, BERRY_POP);
  const id = `fx-berry-${berryId += 1}`;
  const w = shape('fx-heart', cx, cy, `<div class="fx-heart-ph"><i></i></div><svg viewBox="0 0 260 240" width="260" height="240">`
    + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8db4"/><stop offset=".5" stop-color="#ff3d7f"/><stop offset="1" stop-color="#d4145a"/></linearGradient></defs>`
    + `<path d="${HEART}" fill="none" stroke="url(#${id})" stroke-width="7" stroke-linejoin="round"/>`
    + `<path d="${HEART}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.6" transform="translate(130 120) scale(.955) translate(-130 -120)"/></svg>`);
  const ph = w.firstElementChild;
  ph.style.clipPath = `path('${HEART}')`;
  const photo = ph.firstElementChild;
  photo.style.backgroundImage = `url("${HER.pick(fxSeed)}")`;
  // Фото повільно наближається, поки серце на екрані
  photo.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }], { duration: D - BERRY_POP, delay: BERRY_POP, fill: 'both', easing: 'linear' });
  // Серце: виростає з полуниці, двічі подвійний «тук», наприкінці тане
  const len = D - BERRY_POP;
  const o = (ms) => clamp(ms / len, 0, 1);
  const frames = [{ transform: `${C} scale(.05)`, opacity: 0 }, { transform: `${C} scale(1.1)`, opacity: 1, offset: o(260) }, { transform: C, offset: o(440) }];
  BERRY_BEATS.forEach((at, i) => {
    const b = at - BERRY_POP;
    frames.push({ transform: C, offset: o(b - 80) }, { transform: `${C} scale(1.07)`, offset: o(b) }, { transform: C, offset: o(b + 110) },
      { transform: `${C} scale(1.035)`, offset: o(b + 190) }, { transform: C, offset: o(b + 300) });
    twinkle('💗', cx + (i ? 1 : -1) * (120 + Math.random() * 30), cy - 60 + Math.random() * 130, '1.3rem', at);
  });
  frames.push({ transform: C, opacity: 1, offset: o(len - 380) }, { transform: `${C} scale(.9)`, opacity: 0 });
  live(w, frames, { duration: len, delay: BERRY_POP, easing: 'ease-out' }, keep);
  for (let i = 0; i < 3; i += 1) twinkle('✨', cx + [-110, 105, 0][i], cy + [-95, -100, 112][i], '1.2rem', BERRY_POP + 300 + i * 220);
}
const plainBerry = REACT_FX['🍓'];
REACT_FX['🍓'] = (el, x, y, r) => (berryPhotos(el) ? berryHeart() : plainBerry(el, x, y, r));

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

// 🛡️ від неї, коли є його фото (альбом his): посеред екрана золотий щит із заклепками й одним його фото — щоразу
// іншим; довкола купол, три удари відскакують іскрами. Від нього чи без фото — звичайний щит
const SHIELD = 'M120 6 L228 40 C228 150 194 228 120 272 C46 228 12 150 12 40 Z';
const SHIELD_D = 3600;
const shieldPhotos = (el) => HIS.size() > 0 && !fromHim(el);
let shieldId = 0;
function shieldPhoto() {
  const D = SHIELD_D;
  const cx = innerWidth / 2;
  const cy = clamp(innerHeight * 0.45, 210, innerHeight - 220);
  const live = (s, frames, o, k) => gone(s, k)(s.animate(k ? stay(frames) : frames, { ...o, fill: k ? 'both' : 'backwards' }));
  const keep = hold(D);
  live(shape('fx-dome is-wide', cx, cy), [
    { transform: `${C} scale(.3)`, opacity: 0 }, { transform: `${C} scale(1)`, opacity: 1, offset: 0.18 },
    { transform: `${C} scale(1.04)`, opacity: 0.85, offset: 0.85 }, { transform: `${C} scale(1.2)`, opacity: 0 },
  ], { duration: D, easing: 'ease-out' }, keep);
  const id = `fx-shield-${shieldId += 1}`;
  const rivets = [[120, 15], [34, 45], [206, 45], [120, 260]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#FFE7A0" stroke="#A9761E" stroke-width="1.2"/>`).join('');
  const w = shape('fx-shield', cx, cy, `<div class="fx-shield-ph"><i></i></div><svg viewBox="0 0 240 280" width="240" height="280">`
    + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE7A0"/><stop offset=".45" stop-color="#E8B84A"/><stop offset="1" stop-color="#A9761E"/></linearGradient></defs>`
    + `<path d="${SHIELD}" fill="none" stroke="url(#${id})" stroke-width="9" stroke-linejoin="round"/>`
    + `<path d="${SHIELD}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.4" transform="translate(120 140) scale(.94) translate(-120 -140)"/>${rivets}</svg>`);
  const ph = w.firstElementChild;
  ph.style.clipPath = `path('${SHIELD}')`;
  const photo = ph.firstElementChild;
  photo.style.backgroundImage = `url("${HIS.pick(fxSeed)}")`;
  photo.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }], { duration: D, fill: 'both', easing: 'linear' });
  // Щит виїжджає знизу, на кожен удар здригається, наприкінці тане
  const hits = [[-1, -0.35, 1100], [1, -0.05, 1650], [-1, 0.3, 2200]];
  const frames = [{ transform: `${C} translateY(90px) scale(.4)`, opacity: 0 }, { transform: `${C} scale(1.08)`, opacity: 1, offset: 0.14 }, { transform: C, offset: 0.2 }];
  for (const [side, , at] of hits) {
    const o = at / D;
    frames.push({ transform: `${C} translateX(${side * -10}px) rotate(${side * -5}deg) scale(.97)`, offset: o + 0.015 }, { transform: C, offset: o + 0.07 });
  }
  frames.push({ transform: `${C} scale(1.03)`, opacity: 1, offset: 0.9 }, { transform: `${C} scale(.75)`, opacity: 0 });
  live(w, frames, { duration: D, easing: 'ease-out' }, keep);
  // Удари — по краю щита (нижче він вужчий)
  for (const [side, dy, at] of hits) {
    const hx = cx + side * (106 - Math.max(0, dy) * 70);
    const hy = cy + dy * 140;
    const c = glyphAt('☄️', hx, hy, '1.8rem');
    gone(c)(c.animate([
      { transform: `translate(calc(-50% + ${side * innerWidth * 0.6}px), calc(-50% - 90px)) rotate(${side > 0 ? 200 : -20}deg)`, opacity: 1 },
      { transform: `${C} rotate(${side > 0 ? 200 : -20}deg)`, opacity: 1, offset: 0.9 }, { transform: `${C} scale(.3)`, opacity: 0 },
    ], { duration: 420, delay: at - 400, easing: 'ease-in', fill: 'backwards' }));
    const boom = glyphAt('💥', hx, hy, '2.4rem');
    gone(boom)(boom.animate([{ transform: `${C} scale(.3)`, opacity: 0 }, { transform: `${C} scale(1.2)`, opacity: 1, offset: 0.3 }, { transform: `${C} scale(1.5)`, opacity: 0 }],
      { duration: 450, delay: at, fill: 'backwards' }));
    spray(hx, hy, ['✨'], 5, { dist: 70, size: '1rem', delay: at, from: side > 0 ? -60 : 120, to: side > 0 ? 60 : 240, dur: 600 });
  }
}
const plainShield = REACT_FX['🛡️'];
REACT_FX['🛡️'] = (el, x, y, r) => (shieldPhotos(el) ? shieldPhoto() : plainShield(el, x, y, r));

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
  // Над пігулкою: під нею в останнього повідомлення — поле вводу й меню, підпис ховався за ними
  say('Секса тебе просто не хватает!', clamp(x, 150, innerWidth - 150), Math.max(70, y - 112), '1.55rem', D * 0.42, D * 0.56, true);
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

// ── Переділані й нові реакції (27.11) ─────────────
// Напис над сценою («ну-ну», «Спасибо»): вискакує, тримається, спливає
function shout(text, x, y, delay, dur = 1400, size = '1.5rem', cls = '') {
  const s = glyphAt(text, x, y, size, `fx-ha${cls ? ` ${cls}` : ''}`);
  gone(s)(s.animate([
    { transform: `${C} scale(.3) rotate(-8deg)`, opacity: 0 }, { transform: `${C} scale(1.1) rotate(3deg)`, opacity: 1, offset: 0.2 },
    { transform: `${C} scale(1) rotate(0)`, opacity: 1, offset: 0.8 }, { transform: 'translate(-50%, calc(-50% - 16px)) scale(.9)', opacity: 0 },
  ], { duration: dur, delay, easing: 'ease-out', fill: 'backwards' }));
}
// Значок вискакує на місці й тане (для одиночних сердечок, підморгувань)
function pop(g, x, y, size, delay, dur = 1100, cls = '') {
  const s = glyphAt(g, x, y, size, cls);
  gone(s)(s.animate([
    { transform: `${C} scale(0)`, opacity: 0 }, { transform: `${C} scale(1.2)`, opacity: 1, offset: 0.25 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.75 }, { transform: 'translate(-50%, calc(-50% - 24px)) scale(.9)', opacity: 0 },
  ], { duration: dur, delay, easing: 'ease-out', fill: 'backwards' }));
  return s;
}
// Світлий блік пробігає по листу навскіс
function glint(r, delay) {
  const g = shape('fx-glint', r.left, Math.max(r.top, 0));
  g.style.width = `${r.width}px`;
  g.style.height = `${Math.min(r.height, innerHeight)}px`;
  const band = document.createElement('i');
  g.append(band);
  gone(g)(g.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 900, delay, fill: 'backwards' }));
  band.animate([{ transform: 'translateX(-90px) skewX(-20deg)' }, { transform: `translateX(${r.width + 30}px) skewX(-20deg)` }],
    { duration: 900, delay, easing: 'ease-in-out', fill: 'both' });
}

// «Крик» 😱 — у манері Мунка, без його картини: з рота розходяться хвилясті кільця мазків (закат і темна вода),
// кожне крутиться у свій бік, тож увесь екран «пливе»; обличчя витягується й кричить, на кожен «а-а-а» — хвиля й здриг
const SCREAM_INK = [
  ['#1D3256', '#4A6EA3'], ['#E8522E', '#FFD27A'], ['#F3B342', '#FFE7A0'], ['#2E4C7C', '#5B80B5'], ['#C9382D', '#F08B3A'],
  ['#F08B3A', '#FFE7A0'], ['#22395F', '#4A6EA3'], ['#F6CB5C', '#FFF1C2'], ['#D85A30', '#8E2A22'], ['#EE9A3E', '#FFD27A'],
  ['#8E2A22', '#E8522E'], ['#F2B04A', '#FFE7A0'], ['#4A6EA3', '#1D3256'], ['#E06A32', '#F6CB5C'],
];
// Нерівне кільце навколо (0, 0): радіус гуляє хвилею з 3–5 горбів і дрібним тремтінням руки, згладжено кривими
function screamRing(i, r, rnd) {
  const n = 26;
  const lobes = 3 + (i % 3);
  const ph = rnd() * 6.283;
  const pts = [];
  for (let j = 0; j < n; j++) {
    const t = (j / n) * 6.283;
    const rr = r * (1 + 0.08 * Math.sin(lobes * t + ph) + (rnd() - 0.5) * 0.04);
    pts.push([rr * Math.cos(t), rr * Math.sin(t) * 1.18]);
  }
  const q = (v) => v.toFixed(1);
  let d = 'M' + q(pts[0][0]) + ' ' + q(pts[0][1]);
  for (let j = 0; j < n; j++) {
    const [p0, p1, p2, p3] = [pts[(j + n - 1) % n], pts[j], pts[(j + 1) % n], pts[(j + 2) % n]];
    d += 'C' + q(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + q(p1[1] + (p2[1] - p0[1]) / 6) + ' '
      + q(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + q(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + q(p2[0]) + ' ' + q(p2[1]);
  }
  return d + 'Z';
}
REACT_FX['😱'] = () => {
  const D = 3400;
  const W = innerWidth;
  const H = innerHeight;
  const hx = W / 2;
  const hy = H * 0.47;
  // Кільця — до найдальшого кута; крок 30 px, мазок ширший за крок, щоб між кільцями не світилося
  const reach = Math.hypot(Math.max(hx, W - hx), Math.max(hy, H - hy) / 1.18) + 40;
  const STEP = 30;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let rings = '';
  for (let i = 0, r = 22; r < reach; i++, r += STEP) {
    const [ink, hi] = SCREAM_INK[i % SCREAM_INK.length];
    const d = screamRing(i, r, rnd);
    rings += '<g class="ss-ring"><path d="' + d + '" stroke="' + ink + '" stroke-width="' + (STEP * 1.25) + '"/>'
      + '<path d="' + d + '" stroke="' + hi + '" stroke-width="3" stroke-dasharray="' + (40 + i * 7) + ' ' + (26 + i * 3) + '" opacity=".55"/></g>';
  }
  const box = shape('fx-scream-sky', 0, 0, '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><rect width="' + W + '" height="' + H + '" fill="#D8602E"/>'
    + '<g transform="translate(' + hx + ' ' + hy + ')" fill="none" stroke-linecap="round">' + rings + '</g></svg>');
  gone(box)(box.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }], { duration: D, fill: 'backwards' }));
  // Кільця виростають з рота одне за одним, далі гойдаються в різні боки й на кожен крик здуваються
  box.querySelectorAll('.ss-ring').forEach((g, i) => {
    const k = i % 2 ? -1 : 1;
    const a = (7 + (i % 3) * 4) * k;
    const grown = Math.min(0.08 + i * 0.013, 0.28);
    const kf = [{ offset: 0, transform: 'scale(.05) rotate(0deg)' }, { offset: grown, transform: 'scale(1) rotate(' + (a * 0.3) + 'deg)' }];
    for (const o of [0.36, 0.5, 0.64]) {
      if (o <= grown) continue;
      kf.push({ offset: o, transform: 'scale(1.07) rotate(' + (a * (o < 0.5 ? 0.5 : -0.2)) + 'deg)' });
      kf.push({ offset: o + 0.06, transform: 'scale(1) rotate(' + (a * (o < 0.5 ? 0.4 : -0.35)) + 'deg)' });
    }
    kf.push({ offset: 1, transform: 'scale(1.12) rotate(' + (-a) + 'deg)' });
    g.animate(kf, { duration: D, easing: 'ease-in-out', fill: 'both' });
  });
  big('😱', hx, hy, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.22 },
    { transform: 'scale(.94, 1.26) rotate(-4deg)', offset: 0.38 }, { transform: 'scale(1, 1.14) rotate(4deg)', offset: 0.5 },
    { transform: 'scale(.94, 1.3) rotate(-3deg)', offset: 0.62 }, { transform: 'scale(1, 1.2) rotate(2deg)', opacity: 1, offset: 0.85 },
    { transform: 'scale(1)', opacity: 0 },
  ], D, '5.4rem');
  // На кожен «а-а-а» — хвиля від рота і здриг усього екрана
  for (const o of [0.36, 0.5, 0.64]) {
    const w = shape('fx-scream', hx, hy + 12);
    gone(w)(w.animate([{ transform: C + ' scale(.5)', opacity: 0.9 }, { transform: C + ' scale(3.4, 3)', opacity: 0 }],
      { duration: 950, delay: D * o, easing: 'ease-out', fill: 'backwards' }));
    box.animate([
      { transform: 'none' }, { transform: 'translate(-3px, 1px) scale(1.02)' }, { transform: 'translate(3px, -1px) scale(1.02)' }, { transform: 'none' },
    ], { duration: 260, delay: D * o, easing: 'ease-in-out' });
  }
  shout('А-а-а-а!', W / 2, H * 0.17, D * 0.36, D * 0.5, '2.4rem', 'fx-munch-say');
};

// Щенячі очі 🥺 — без сліз: довкола темніє, обличчя наближається й тремтить, в очах блищить
REACT_FX['🥺'] = (el, x, y) => {
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
  twinkle('✨', x + 25, y - 12, '1.3rem', 1880);
  jolt(el, [{ transform: 'none' }, { transform: 'scale(.97)', offset: 0.4 }, { transform: 'scale(1.01)', offset: 0.7 }, { transform: 'none' }], 1400, 600);
};

// «Ведмедик» 🧸: плюхається на лист, міцно обіймає (двічі стискає) і випускає з лапок сердечко, що пливе вгору
REACT_FX['🧸'] = (el, x, y) => {
  const D = 3000;
  big('🧸', x, y - 10, [
    { transform: `translateY(${-y - 60}px) rotate(-20deg)`, opacity: 1, easing: 'ease-in' },
    { transform: 'translateY(0) rotate(0)', offset: 0.18 },
    { transform: 'translateY(10px) scale(1.25, .8)', offset: 0.23 },
    { transform: 'translateY(-6px) scale(.95, 1.08)', offset: 0.3 }, { transform: 'scale(1)', offset: 0.36 },
    { transform: 'scale(1.22, .9)', offset: 0.42 }, { transform: 'scale(1)', offset: 0.5 },
    { transform: 'scale(1.22, .9)', offset: 0.56 }, { transform: 'scale(1.04)', offset: 0.64 },
    { transform: 'scale(1) rotate(-5deg)', offset: 0.76 }, { transform: 'scale(1) rotate(4deg)', opacity: 1, offset: 0.88 },
    { transform: 'scale(.7)', opacity: 0 },
  ], D, '6.4rem');
  for (const o of [0.38, 0.52]) jolt(el, [{ transform: 'none' }, { transform: 'scale(.94, .97)', offset: 0.5 }, { transform: 'none' }], 320, D * o);
  const hrt = glyphAt('💗', x, y + 12, '3rem', 'fx-big');
  gone(hrt)(hrt.animate([
    { transform: `${C} scale(0)`, opacity: 0 }, { transform: `${C} scale(1.3)`, opacity: 1, offset: 0.2 },
    { transform: `${C} scale(1)`, offset: 0.3 }, { transform: `${C} scale(1.15)`, offset: 0.4 }, { transform: `${C} scale(1)`, offset: 0.48 },
    { transform: 'translate(-50%, calc(-50% - 150px)) scale(1.1)', opacity: 1, offset: 0.86 },
    { transform: 'translate(-50%, calc(-50% - 190px)) scale(.8)', opacity: 0 },
  ], { duration: 1500, delay: D * 0.64, easing: 'ease-out', fill: 'backwards' }));
  ring(x, y + 12, D * 0.66);
  rise(x, y - 20, ['💕', '🤎', '💗'], 6, { delay: D * 0.72, up: 180, spread: 200, size: 1 });
};

// «Хитренько» 😏: брова двічі підстрибує, смайлик косить на лист, а збоку підморгує 😉 «ну-ну»
REACT_FX['😏'] = (el, x, y) => {
  const D = 2600;
  big('😏', x, y, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.14 }, { transform: 'scale(1)', offset: 0.22 },
    { transform: 'translateY(-10px) rotate(-6deg) scale(1.04, 1.08)', offset: 0.28 }, { transform: 'translateY(0) rotate(0)', offset: 0.34 },
    { transform: 'translateY(-10px) rotate(-6deg) scale(1.04, 1.08)', offset: 0.4 }, { transform: 'translateY(0) rotate(0)', offset: 0.46 },
    { transform: 'translate(-14px, 10px) rotate(-14deg)', offset: 0.58 },
    { transform: 'translate(-14px, 10px) rotate(-14deg)', opacity: 1, offset: 0.86 },
    { transform: 'translate(-14px, 10px) rotate(-14deg) scale(.6)', opacity: 0 },
  ], D, '6rem');
  twinkle('✨', x + 36, y - 42, '1.3rem', D * 0.28);
  twinkle('✨', x + 36, y - 42, '1.3rem', D * 0.4);
  const w = glyphAt('😉', x + 78, y - 50, '2.6rem');
  gone(w)(w.animate([
    { transform: `${C} scale(0) rotate(-30deg)`, opacity: 0 }, { transform: `${C} scale(1.15) rotate(6deg)`, opacity: 1, offset: 0.22 },
    { transform: `${C} scale(1) rotate(0)`, offset: 0.34 }, { transform: `${C} scale(1.05, .8)`, offset: 0.5 }, { transform: `${C} scale(1)`, offset: 0.58 },
    { transform: `${C} scale(1)`, opacity: 1, offset: 0.85 }, { transform: `${C} scale(.6)`, opacity: 0 },
  ], { duration: 1300, delay: D * 0.5, easing: 'ease-out', fill: 'backwards' }));
  shout('ну-ну', x + 74, y - 96, D * 0.56, 1150);
};

// «Підглядаю» 🫣: над листом опускається оксамитова завіса; обличчя двічі визирає у щілинку — зліва й справа, —
// завіса розходиться, щоки червоніють, злітають сердечка — «Кто здесь?»
const scallops = (w, n, y, dip) => {
  const s = w / n;
  let d = '';
  for (let i = n; i > 0; i -= 1) d += `Q${(i - 0.5) * s} ${y + dip} ${(i - 1) * s} ${y}`;
  return d;
};
const FOLDS = [['0', '#6E1A40'], ['.12', '#B23A6E'], ['.22', '#7E2149'], ['.36', '#C9457F'], ['.48', '#85244F'],
  ['.62', '#C24078'], ['.74', '#7E2149'], ['.88', '#B23A6E'], ['1', '#8A2753']];
const curtain = (right) => `<svg viewBox="0 0 124 214" width="124" height="214" aria-hidden="true"><defs><linearGradient id="cu${right ? 'R' : 'L'}" x2="1">`
  + FOLDS.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + '</linearGradient></defs>'
  + `<g${right ? ' transform="translate(124 0) scale(-1 1)"' : ''}>`
  + `<path d="M0 0H124V200${scallops(124, 6, 200, 10)}Z" fill="url(#cu${right ? 'R' : 'L'})"/>`
  + `<path d="M124 200${scallops(124, 6, 200, 10)}" fill="none" stroke="#F2C14E" stroke-width="3"/>`
  + '<path d="M121 0V200" stroke="#F2C14E" stroke-width="3"/></g></svg>';
const VALANCE = '<svg viewBox="0 0 264 48" width="264" height="48" aria-hidden="true">'
  + `<path d="M0 0H264V26${scallops(264, 11, 26, 18)}Z" fill="#8A2753"/>`
  + `<path d="M264 26${scallops(264, 11, 26, 18)}" fill="none" stroke="#F2C14E" stroke-width="3"/>`
  + '<rect width="264" height="9" fill="#5C1534"/><g fill="#F2C14E">'
  + Array.from({ length: 11 }, (_, i) => `<circle cx="${(i + 0.5) * 24}" cy="41" r="3"/>`).join('') + '</g></svg>';
REACT_FX['🫣'] = (el, x, y) => {
  const D = 3000;
  const cy = y - 6;
  // Обличчя за завісою — видно лише у щілинці
  big('🫣', x, cy, [
    { transform: 'scale(.9)', opacity: 0 }, { transform: 'scale(.9)', opacity: 0, offset: 0.1 }, { transform: 'scale(1)', opacity: 1, offset: 0.12 },
    { transform: 'scale(1)', offset: 0.2 }, { transform: 'translateX(-22px) rotate(-14deg)', offset: 0.26 }, { transform: 'translateX(-22px) rotate(-14deg)', offset: 0.33 },
    { transform: 'scale(1)', offset: 0.39 }, { transform: 'scale(1)', offset: 0.44 },
    { transform: 'translateX(22px) rotate(14deg)', offset: 0.5 }, { transform: 'translateX(22px) rotate(14deg)', offset: 0.57 },
    { transform: 'scale(1)', offset: 0.61 }, { transform: 'translateY(-6px) scale(1.18)', offset: 0.7 }, { transform: 'scale(1)', offset: 0.76 },
    { transform: 'rotate(-6deg)', offset: 0.82 }, { transform: 'rotate(5deg)', opacity: 1, offset: 0.9 }, { transform: 'scale(.7)', opacity: 0 },
  ], D, '5.4rem');
  // Поли: щілинка зліва, потім справа, потім обидві збираються до країв
  const side = (dir, a, b) => {
    const c = shape(`fx-curtain ${dir < 0 ? 'is-l' : 'is-r'}`, x + dir * 62, cy - 4, curtain(dir > 0));
    const open = `${C} translateX(${dir * 14}px) scaleX(.42)`;
    gone(c)(c.animate([
      { transform: `${C} translateY(-50px)`, opacity: 0 }, { transform: C, opacity: 1, offset: 0.1 },
      { transform: C, offset: a }, { transform: `${C} translateX(${dir * 36}px)`, offset: a + 0.05 },
      { transform: `${C} translateX(${dir * 36}px)`, offset: b }, { transform: C, offset: b + 0.05 },
      { transform: C, offset: 0.61 }, { transform: open, offset: 0.68 }, { transform: open, opacity: 1, offset: 0.9 }, { transform: open, opacity: 0 },
    ], { duration: D, easing: 'ease-in-out', fill: 'backwards' }));
  };
  side(-1, 0.2, 0.34);
  side(1, 0.44, 0.55);
  const top = shape('fx-valance', x, cy - 111, VALANCE);
  gone(top)(top.animate([
    { transform: `${C} translateY(-50px)`, opacity: 0 }, { transform: C, opacity: 1, offset: 0.1 },
    { transform: C, opacity: 1, offset: 0.9 }, { transform: C, opacity: 0 },
  ], { duration: D, easing: 'ease-out', fill: 'backwards' }));
  twinkle('✨', x - 30, cy - 26, '1.2rem', D * 0.27);
  twinkle('✨', x + 30, cy - 26, '1.2rem', D * 0.51);
  for (const dx of [-30, 30]) {
    const b = shape('fx-blush', x + dx, cy + 18);
    gone(b)(b.animate([
      { transform: `${C} scale(.4)`, opacity: 0 }, { transform: `${C} scale(1)`, opacity: 1, offset: 0.3 },
      { transform: `${C} scale(1.1)`, opacity: 1, offset: 0.8 }, { transform: `${C} scale(1)`, opacity: 0 },
    ], { duration: D * 0.3, delay: D * 0.66, fill: 'backwards' }));
  }
  rise(x, cy - 40, ['💗', '💕'], 6, { delay: D * 0.7, up: 160, spread: 180, size: 1 });
  shout('Кто здесь?', x, cy + 74, D * 0.68, D * 0.3, '1.5rem');
};

// «Оплески» 👏: великі долоні плескають чотири рази, на кожен хлопок спалах, а на останній — овація маленьких 👏
REACT_FX['👏'] = (el, x, y) => {
  const D = 2800;
  const claps = [0.16, 0.3, 0.44, 0.58];
  const frames = [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.1 }];
  for (const o of claps) frames.push({ transform: 'scale(1.22, .88) rotate(-5deg)', offset: o }, { transform: 'scale(1) rotate(3deg)', offset: o + 0.07 });
  frames.push({ transform: 'scale(1.05)', opacity: 1, offset: 0.88 }, { transform: 'scale(.6)', opacity: 0 });
  big('👏', x, y, frames, D, '7.2rem');
  for (const o of claps) {
    const f = shape('fx-clap', x, y - 6);
    gone(f)(f.animate([{ transform: `${C} scale(.3)`, opacity: 1 }, { transform: `${C} scale(2.2)`, opacity: 0 }],
      { duration: 420, delay: o * D, easing: 'ease-out', fill: 'backwards' }));
    spray(x, y - 10, ['✨', '⭐', '🌟'], 6, { dist: 130, size: '1.2rem', delay: o * D, dur: 800 });
    jolt(el, [{ transform: 'none' }, { transform: 'scale(1.02)' }, { transform: 'none' }], 180, o * D);
  }
  // Овація: маленькі долоні вискакують довкола й плескають разом
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const d = 100 + Math.random() * 70;
    const s = glyphAt('👏', clamp(x + Math.cos(a) * d, 24, innerWidth - 24), clamp(y + Math.sin(a) * d * 0.9, 60, innerHeight - 60), `${1.3 + Math.random() * 0.8}rem`);
    gone(s)(s.animate([
      { transform: `${C} scale(0)`, opacity: 0 }, { transform: `${C} scale(1)`, opacity: 1, offset: 0.15 },
      { transform: `${C} scale(1.25, .82)`, offset: 0.3 }, { transform: `${C} scale(1)`, offset: 0.42 },
      { transform: `${C} scale(1.25, .82)`, offset: 0.56 }, { transform: `${C} scale(1)`, offset: 0.68 },
      { transform: `${C} scale(1.25, .82)`, offset: 0.8 }, { transform: `${C} scale(.8)`, opacity: 0 },
    ], { duration: 1200, delay: D * 0.6 + i * 35, easing: 'ease-in-out', fill: 'backwards' }));
  }
  shout('Браво!', x, y - 92, D * 0.62, 1300, '1.9rem');
};

// «Дякую» 🙏: складені долоні, над ними розкривається сяйво з променями, згори падає зірочка — «Спасибо»
REACT_FX['🙏'] = (el, x, y) => {
  const D = 3000;
  const rays = shape('fx-rays', x, y - 24);
  gone(rays)(rays.animate([
    { transform: `${C} scale(.2) rotate(0)`, opacity: 0 }, { transform: `${C} scale(1.1) rotate(30deg)`, opacity: 1, offset: 0.3 },
    { transform: `${C} scale(1.25) rotate(70deg)`, opacity: 1, offset: 0.82 }, { transform: `${C} scale(1.35) rotate(85deg)`, opacity: 0 },
  ], { duration: D * 0.9, delay: 150, fill: 'backwards' }));
  big('🙏', x, y + 10, [
    { transform: 'translateY(60px) scale(.4)', opacity: 0 }, { transform: 'translateY(0) scale(1.2)', opacity: 1, offset: 0.22 },
    { transform: 'scale(1.1)', offset: 0.34 }, { transform: 'scale(1.2)', offset: 0.46 },
    { transform: 'scale(1.05, .95) translateY(4px)', offset: 0.53 }, { transform: 'scale(1.2)', offset: 0.6 },
    { transform: 'scale(1.15)', opacity: 1, offset: 0.88 }, { transform: 'translateY(-20px) scale(1)', opacity: 0 },
  ], D, '6.6rem');
  const land = D * 0.53;
  const st = glyphAt('🌟', x, y - 58, '2.6rem', 'fx-big');
  gone(st)(st.animate([
    { transform: `translate(-50%, calc(-50% - ${y}px)) rotate(-200deg) scale(.7)`, opacity: 1, easing: 'ease-in' },
    { transform: `${C} rotate(0) scale(1.25)`, offset: 0.5 }, { transform: `${C} scale(.92)`, offset: 0.6 },
    { transform: `${C} scale(1.05)`, opacity: 1, offset: 0.88 }, { transform: 'translate(-50%, calc(-50% - 30px)) scale(.8)', opacity: 0 },
  ], { duration: 1500, delay: land - 750, fill: 'backwards' }));
  ring(x, y - 58, land, 'is-gold');
  spray(x, y - 58, ['✨', '⭐'], 8, { dist: 110, size: '1.2rem', delay: land, dur: 900 });
  shout('Спасибо', x, y - 120, land + 100, 1500, '1.9rem');
  for (let i = 0; i < 5; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const d = 90 + Math.random() * 60;
    twinkle('✨', x + Math.cos(a) * d, y + Math.sin(a) * d, `${1.2 + Math.random() * 0.6}rem`, 400 + i * 220);
  }
};

// «Підморгую» 😉: двічі підморгує, з вії злітає іскорка, по листу пробігає блік, поруч — сердечко
REACT_FX['😉'] = (el, x, y, r) => {
  const D = 2600;
  big('😉', x, y, [
    { transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.14 }, { transform: 'scale(1)', offset: 0.22 },
    { transform: 'scale(1.06, .84) rotate(-6deg)', offset: 0.3 }, { transform: 'scale(1) rotate(0)', offset: 0.36 },
    { transform: 'scale(1.06, .84) rotate(-6deg)', offset: 0.46 }, { transform: 'scale(1) rotate(3deg)', offset: 0.52 },
    { transform: 'scale(1) rotate(3deg)', opacity: 1, offset: 0.86 }, { transform: 'scale(.6)', opacity: 0 },
  ], D, '6rem');
  const sp = glyphAt('✨', x + 22, y - 18, '1.7rem');
  gone(sp)(sp.animate([
    { transform: `${C} scale(.3)`, opacity: 0 }, { transform: 'translate(calc(-50% + 40px), calc(-50% - 50px)) scale(1.2) rotate(90deg)', opacity: 1, offset: 0.45 },
    { transform: 'translate(calc(-50% + 96px), calc(-50% - 30px)) scale(.6) rotate(200deg)', opacity: 0 },
  ], { duration: 950, delay: D * 0.46, easing: 'ease-out', fill: 'backwards' }));
  glint(r, D * 0.5);
  pop('💗', x - 74, y - 46, '2.2rem', D * 0.58, 1200);
};

// «Вишеньки» 🍒: дві вишеньки на гілочці спускаються над лист, розгойдуються й двічі «цілуються» — чмок, сердечка.
// Ягоди обʼємні: темніють донизу, ямка біля хвостика, блік і відсвіт; на вузлику — два листочки з прожилками
const berry = (cx, g) => `<path d="M${cx} 93C${cx - 8} 85 ${cx - 27} 88 ${cx - 27} 111C${cx - 27} 129 ${cx - 14} 140 ${cx} 140`
  + `C${cx + 14} 140 ${cx + 27} 129 ${cx + 27} 111C${cx + 27} 88 ${cx + 8} 85 ${cx} 93Z" fill="url(#${g})" stroke="#6B0A1C" stroke-width="1.5"/>`
  + `<path d="M${cx - 4} 94Q${cx} 98 ${cx + 4} 94" stroke="#5A0816" stroke-width="2" fill="none" stroke-linecap="round"/>`
  + `<ellipse cx="${cx - 11}" cy="${106}" rx="7" ry="11" fill="url(#chS)" transform="rotate(-25 ${cx - 11} 106)"/>`
  + `<circle cx="${cx - 13}" cy="102" r="2.6" fill="#fff"/>`
  + `<path d="M${cx + 8} 134Q${cx + 21} 128 ${cx + 23} 114" stroke="#FF8A95" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".55"/>`;
const CHERRIES = '<svg viewBox="0 0 140 150" width="156" height="167" aria-hidden="true"><defs>'
  + '<radialGradient id="chA" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#FF6B7A"/><stop offset=".45" stop-color="#E0213D"/><stop offset=".85" stop-color="#A0102A"/><stop offset="1" stop-color="#7A0A1E"/></radialGradient>'
  + '<radialGradient id="chB" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#FF5E70"/><stop offset=".45" stop-color="#D21A38"/><stop offset=".85" stop-color="#930D26"/><stop offset="1" stop-color="#6E091B"/></radialGradient>'
  + '<radialGradient id="chS"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
  + '<linearGradient id="chT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E4220"/><stop offset=".35" stop-color="#6E8E2A"/><stop offset="1" stop-color="#8DB040"/></linearGradient>'
  + '<linearGradient id="chF" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6CD27A"/><stop offset="1" stop-color="#2E8B3E"/></linearGradient></defs>'
  + '<g class="ch-l"><path d="M70 12Q50 50 30 93" stroke="url(#chT)" stroke-width="4" fill="none" stroke-linecap="round"/>' + berry(30, 'chA') + '</g>'
  + '<g class="ch-r"><path d="M70 12Q90 50 110 93" stroke="url(#chT)" stroke-width="4" fill="none" stroke-linecap="round"/>' + berry(110, 'chB') + '</g>'
  + '<path d="M72 13C84 2 102 1 116 7 104 19 86 21 72 13Z" fill="url(#chF)" stroke="#2A7A36" stroke-width="1"/>'
  + '<path d="M74 13Q95 7 114 7" stroke="#2A7A36" stroke-width="1.4" fill="none"/>'
  + '<path d="M68 13C60 4 48 2 38 6 46 16 58 18 68 13Z" fill="url(#chF)" stroke="#2A7A36" stroke-width="1"/>'
  + '<path d="M67 13Q52 8 40 6" stroke="#2A7A36" stroke-width="1.2" fill="none"/>'
  + '<circle cx="70" cy="12" r="4" fill="#5B3A1E"/>'
  + '</svg>';
REACT_FX['🍒'] = (el, x, y) => {
  const D = 2800;
  const box = shape('fx-cherry', x, y - 10, CHERRIES);
  gone(box)(box.animate([
    { transform: `translate(-50%, calc(-50% - ${y + 120}px))`, opacity: 1, easing: 'cubic-bezier(.3, 0, .4, 1)' },
    { transform: `${C} translateY(10px)`, offset: 0.2 }, { transform: `${C} translateY(-4px)`, offset: 0.26 }, { transform: `${C}`, offset: 0.3 },
    { transform: `${C}`, opacity: 1, offset: 0.9 }, { transform: `${C} scale(.7)`, opacity: 0 },
  ], { duration: D, fill: 'backwards' }));
  // Обертання кожної вишеньки навколо верхівки гілочки: розходяться — сходяться (торкаються при ±9°)
  const swing = (sign) => [
    { transform: 'rotate(0)' }, { transform: 'rotate(0)', offset: 0.3 },
    { transform: `rotate(${8 * sign}deg)`, offset: 0.38 }, { transform: `rotate(${-9 * sign}deg)`, offset: 0.47 },
    { transform: `rotate(${-8 * sign}deg)`, offset: 0.5 }, { transform: `rotate(${7 * sign}deg)`, offset: 0.58 },
    { transform: `rotate(${-9 * sign}deg)`, offset: 0.67 }, { transform: `rotate(${-8 * sign}deg)`, offset: 0.7 },
    { transform: 'rotate(0)', offset: 0.8 }, { transform: 'rotate(0)' },
  ];
  box.querySelector('.ch-l').animate(swing(1), { duration: D, easing: 'ease-in-out', fill: 'both' });
  box.querySelector('.ch-r').animate(swing(-1), { duration: D, easing: 'ease-in-out', fill: 'both' });
  const ky = y - 10 + 42;
  for (const o of [0.47, 0.67]) {
    pop('💋', x, ky - 30, '1.8rem', D * o, 800);
    spray(x, ky, ['💗', '💕'], 5, { dist: 70, size: '1rem', delay: D * o, from: 200, to: 340, fall: 0, dur: 700 });
  }
  spray(x, ky + 20, ['💗', '💦'], 8, { dist: 120, size: '1.2rem', delay: D * 0.74, fall: 50, dur: 900 });
};

// «Каска» 🪖: падає згори на лист і сідає набекрень — бум, пил; потім з каски проростає квіточка — «Думаю о тебе»
REACT_FX['🪖'] = (el, x, y, r) => {
  const D = 3200;
  const hy = clamp(r.top - 20, 200, innerHeight - 190);
  const hm = glyphAt('🪖', x, hy, '5.6rem', 'fx-big');
  gone(hm)(hm.animate([
    { transform: `translate(-50%, calc(-50% - ${hy + 80}px)) rotate(-30deg)`, opacity: 1, easing: 'ease-in' },
    { transform: `${C} rotate(0)`, offset: 0.16 }, { transform: `${C} translateY(8px) scale(1.2, .8)`, offset: 0.2 },
    { transform: `${C} translateY(-4px) scale(.96, 1.05) rotate(6deg)`, offset: 0.26 }, { transform: `${C} rotate(12deg)`, offset: 0.32 },
    { transform: `${C} rotate(12deg)`, opacity: 1, offset: 0.9 }, { transform: `${C} rotate(12deg) scale(.8)`, opacity: 0 },
  ], { duration: D, fill: 'backwards' }));
  spray(x, hy + 34, ['💨'], 6, { dist: 90, size: '1.4rem', delay: D * 0.17, from: 160, to: 380, fall: -10, dur: 800 });
  jolt(el, [{ transform: 'none' }, { transform: 'translateY(5px) scaleY(.97)' }, { transform: 'none' }], 320, D * 0.17);
  const sx = x + 10;
  const sy = hy - 30;
  const stem = shape('fx-stem', sx, sy);
  gone(stem)(stem.animate([
    { transform: 'translate(-50%, -100%) scaleY(0)', opacity: 1 }, { transform: 'translate(-50%, -100%) scaleY(1)', opacity: 1, offset: 0.3 },
    { transform: 'translate(-50%, -100%) scaleY(1) rotate(-4deg)', opacity: 1, offset: 0.9 }, { transform: 'translate(-50%, -100%) scaleY(1)', opacity: 0 },
  ], { duration: D * 0.6, delay: D * 0.36, fill: 'backwards' }));
  const fl = glyphAt('🌼', sx, sy - 52, '2.4rem', 'fx-big');
  gone(fl)(fl.animate([
    { transform: `${C} scale(0) rotate(-90deg)`, opacity: 0 }, { transform: `${C} scale(1.3) rotate(10deg)`, opacity: 1, offset: 0.3 },
    { transform: `${C} scale(1) rotate(0)`, offset: 0.42 }, { transform: `${C} scale(1.05) rotate(-6deg)`, opacity: 1, offset: 0.9 },
    { transform: `${C} scale(.8)`, opacity: 0 },
  ], { duration: D * 0.46, delay: D * 0.5, easing: 'ease-out', fill: 'backwards' }));
  shout('Думаю о тебе', x, sy - 104, D * 0.62, 1500, '1.7rem');
  rise(sx, sy - 40, ['💛', '💙'], 6, { delay: D * 0.66, up: 160, spread: 180, size: 1 });
};

// «Подарунок» 🎁: коробка підстрибує й трясеться, бант розвʼязується, кришка відлітає — фонтан сердечок і 💝
const GIFT = '<svg viewBox="0 0 120 130" width="128" height="139" aria-hidden="true">'
  + '<g class="gf-box"><rect x="16" y="60" width="88" height="62" rx="6" fill="#E5486F"/><rect x="53" y="60" width="14" height="62" fill="#FFD36B"/>'
  + '<rect x="16" y="60" width="88" height="8" fill="#000" opacity=".12"/></g>'
  + '<g class="gf-lid"><rect x="10" y="44" width="100" height="20" rx="5" fill="#F0628A"/><rect x="53" y="44" width="14" height="20" fill="#FFD36B"/>'
  + '<g class="gf-bow"><path d="M60 44C44 22 28 30 37 41c6 6 16 5 23 3z" fill="#FFC23D"/><path d="M60 44C76 22 92 30 83 41c-6 6-16 5-23 3z" fill="#FFC23D"/>'
  + '<circle cx="60" cy="43" r="5" fill="#F2A900"/></g></g></svg>';
REACT_FX['🎁'] = (el, x, y) => {
  const D = 3000;
  const box = shape('fx-gift', x, y, GIFT);
  gone(box)(box.animate([
    { transform: `${C} scale(.3)`, opacity: 0 }, { transform: `${C} scale(1)`, opacity: 1, offset: 0.1 },
    { transform: `${C} translateY(-26px)`, offset: 0.17 }, { transform: `${C} scale(1.08, .92)`, offset: 0.24 }, { transform: `${C}`, offset: 0.28 },
    { transform: `${C} translateY(-26px)`, offset: 0.34 }, { transform: `${C} scale(1.08, .92)`, offset: 0.41 }, { transform: `${C}`, offset: 0.45 },
    { transform: `${C} rotate(-7deg)`, offset: 0.48 }, { transform: `${C} rotate(7deg)`, offset: 0.51 }, { transform: `${C} rotate(-6deg)`, offset: 0.54 },
    { transform: `${C} rotate(0)`, offset: 0.57 },
    { transform: `${C}`, opacity: 1, offset: 0.9 }, { transform: `${C} scale(.8)`, opacity: 0 },
  ], { duration: D, fill: 'backwards' }));
  box.querySelector('.gf-bow').animate([
    { transform: 'scale(1) rotate(0)', opacity: 1 }, { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.57 },
    { transform: 'scale(1.3) rotate(18deg)', opacity: 1, offset: 0.61 }, { transform: 'scale(0) rotate(90deg)', opacity: 0, offset: 0.66 },
    { transform: 'scale(0)', opacity: 0 },
  ], { duration: D, fill: 'both' });
  box.querySelector('.gf-lid').animate([
    { transform: 'translate(0, 0) rotate(0)', opacity: 1 }, { transform: 'translate(0, 0) rotate(0)', opacity: 1, offset: 0.64 },
    { transform: 'translate(34px, -130px) rotate(40deg)', opacity: 1, offset: 0.78 }, { transform: 'translate(50px, -170px) rotate(55deg)', opacity: 0, offset: 0.84 },
    { transform: 'translate(50px, -170px)', opacity: 0 },
  ], { duration: D, easing: 'ease-out', fill: 'both' });
  const open = D * 0.66;
  ring(x, y - 20, open);
  rise(x, y - 20, ['💗', '💕', '💖'], 10, { delay: open, up: 230, spread: 200, size: 1.2 });
  spray(x, y - 24, ['🎉', '✨', '🎊'], 10, { dist: 130, size: '1.3rem', delay: open, from: 200, to: 340, fall: 40, dur: 1000 });
  const hrt = glyphAt('💝', x, y - 10, '3.4rem', 'fx-big');
  gone(hrt)(hrt.animate([
    { transform: `${C} scale(0)`, opacity: 0 }, { transform: 'translate(-50%, calc(-50% - 70px)) scale(1.25)', opacity: 1, offset: 0.35 },
    { transform: 'translate(-50%, calc(-50% - 80px)) scale(1)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%, calc(-50% - 100px)) scale(.8)', opacity: 0 },
  ], { duration: 1100, delay: open + 60, easing: 'ease-out', fill: 'backwards' }));
};
