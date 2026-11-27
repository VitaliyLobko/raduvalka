// Обʼємний фон: шари на різній «глибині» зсуваються від нахилу телефона (на компʼютері — від миші).
// Лише transform шарів (рахує відеокарта), подія датчика — не частіше кадру, стоїть, коли згорнуто, під шторкою
// чи «уменьшить движение». Шари — у CSS (.depth > i, --k — наскільки далеко зсувається шар)
import { h, reduceMotion, sky } from './ui.js';
import { DATA } from './data.js';
import { sfx } from './sound.js';

const MAX = 1;
// «Движение фона» вимикається в меню (раптом укачує): нахил, пелюстки, падаюча зірка, плями — стоять
const STILL = 'radovalka:still';
export function isStill() { try { return localStorage.getItem(STILL) === '1'; } catch { return false; } }
let root = null;
// Шари фону з їхньою глибиною: [елемент, k у px]; зсув пишемо прямо в transform кожного шару
let layers = [];
const shift = (x, y) => { for (const [el, k] of layers) el.style.transform = `translate3d(${(-x * k).toFixed(2)}px, ${(-y * k).toFixed(2)}px, 0)`; };
export function setStill(on) {
  try { if (on) localStorage.setItem(STILL, '1'); else localStorage.removeItem(STILL); } catch { /* приватне вікно — до перезапуску */ }
  document.documentElement.classList.toggle('is-still', on);
  shift(0, 0);
}
// Пелюстка сакури — та сама форма, що в гілочці на її фоні
const PETAL = '<svg viewBox="-7 -13 14 14" aria-hidden="true"><path d="M0 0C-3.5-1-7.5-5-6.2-9.2C-5.3-12-2.4-12.6-.9-11.6L0-10.4L.9-11.6C2.4-12.6 5.3-12 6.2-9.2C7.5-5 3.5-1 0 0Z"/></svg>';
// Зимою замість пелюстки — сніжинка (показує CSS за html.is-winter)
const FLAKE = `<svg class="flake" viewBox="-7 -7 14 14" aria-hidden="true"><g stroke-width="1.1" stroke-linecap="round">${[0, 60, 120, 180, 240, 300].map((a) => `<path transform="rotate(${a})" d="M0 0V-6M0-3.4L-1.7-5M0-3.4L1.7-5"/>`).join('')}</g></svg>`;
// Сузірʼя Стрільця — астеризм «чайник» (як на зоряних картах): зірки й лінії між ними; heart — зірки-сердечка (її)
// Положення — зі справжніх координат зірок (схід ліворуч, північ угорі, як на зоряній карті): носик (γ) праворуч, ручка (σ, τ) ліворуч
const SGR = { g: [167, 68], d: [128, 61], e: [120, 113], l: [111, 10], p: [66, 28], s: [42, 20], t: [12, 36], z: [23, 61] };
const SGR_LINES = ['gd', 'de', 'eg', 'dl', 'lp', 'pd', 'ps', 'st', 'tz', 'zp', 'ez'];
const HEART = 'M0 1.6C-1.2.3-3.2-.6-3.2-2.3-3.2-3.6-1.6-4.2 0-2.8 1.6-4.2 3.2-3.6 3.2-2.3 3.2-.6 1.2.3 0 1.6Z';
function constellation(heart) {
  const lines = SGR_LINES.map(([a, b]) => `<line x1="${SGR[a][0]}" y1="${SGR[a][1]}" x2="${SGR[b][0]}" y2="${SGR[b][1]}"/>`).join('');
  const stars = Object.entries(SGR).map(([k, [x, y]], i) => {
    // Розмір — за справжньою яскравістю: найяскравіші ε (Каус Аустраліс) і σ (Нункі), найтьмяніші φ і τ
    const r = { e: 1.4, s: 1.3, z: 1.1, d: 1.05, l: 1, g: 0.95, p: 0.85, t: 0.85 }[k];
    const tw = `style="animation-delay:-${(i * 1.37) % 5}s;animation-duration:${4 + (i % 3) * 1.3}s;--i:${i}"`;
    return heart ? `<g transform="translate(${x} ${y}) scale(${r * 1.5})"><path ${tw} d="${HEART}"/></g>` : `<circle ${tw} cx="${x}" cy="${y}" r="${r * 2.6}"/>`;
  }).join('');
  // Під сузірʼям — підпис, як на зоряній карті (в обох; у неї — сливовим)
  const label = '<text class="sgr-label" x="8" y="144">Sagittarius</text>';
  return h('span', { class: `sgr${heart ? ' sgr-heart' : ''}`, html: `<svg viewBox="0 0 180 152" aria-hidden="true"><g class="sgr-lines">${lines}</g><g class="sgr-stars">${stars}</g>${label}</svg>` });
}
// Його фон — зоряна карта: кола координат, лінії й пунктир екліптики (тонко, золотом)
const CHART = '<svg viewBox="0 0 250 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#EDB949" stroke-width=".7">'
  + '<circle cx="125" cy="300" r="120"/><circle cx="125" cy="300" r="200"/><circle cx="125" cy="300" r="290"/>'
  + '<line x1="125" y1="0" x2="125" y2="500"/><line x1="-40" y1="300" x2="290" y2="300"/><line x1="-30" y1="150" x2="280" y2="450"/></g>'
  + '<path d="M-10 360C70 300 160 230 270 180" fill="none" stroke="#EDB949" stroke-width=".9" stroke-dasharray="5 5" opacity="1.6"/></svg>';

// Восени замість пелюстки — кленовий листок (показує CSS за html.is-autumn)
const LEAF = '<svg class="leaf" viewBox="-11 -11 22 22" aria-hidden="true"><path d="M0-9.5L1.7-5.4L4.4-6.7L3.8-2.7L8-3.8L6.5-1L9 .5L4.6 2.3L5.2 4.4L1 3.5L.6 6.6H-.6L-1 3.5L-5.2 4.4L-4.6 2.3L-9 .5L-6.5-1L-8-3.8L-3.8-2.7L-4.4-6.7L-1.7-5.4Z"/></svg>';
// Падають повільно, кожна — своїм шляхом; сталі значення, щоб при перезапуску картина не стрибала
function petals(n, seed, size) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return Array.from({ length: n }, () => {
    const p = h('span', { class: 'petal', html: PETAL + FLAKE + LEAF });
    // Знесення — один із 4 готових варіантів: змінна в ключових кадрах коштувала б перерахунку стилю щокадру
    const d = 14 + rnd() * 12;
    p.style.cssText = `left:${(rnd() * 100).toFixed(1)}%;--d:${d.toFixed(1)}s;--delay:${(-rnd() * d).toFixed(1)}s;`
      + `--s:${(size * (0.75 + rnd() * 0.5)).toFixed(2)};animation-name:petal-fall-${Math.floor(rnd() * 4)};--tone:${rnd() < 0.5 ? '#F7B8D2' : '#F2A7C8'}`;
    return p;
  });
}
// Літо: бджілки ліниво літають (вкладені шари: хід уздовж, погойдування вгору-вниз, розворот) — лише transform;
// уночі замість бджілок світлячки (CSS). Показує CSS за html.is-summer
const BEE = '<svg class="bee-b" viewBox="-12 -11 24 20" aria-hidden="true"><g class="bee-w"><ellipse cx="-2" cy="-5.5" rx="3" ry="5" transform="rotate(-25 -2 -5.5)"/><ellipse cx="2.2" cy="-5" rx="2.5" ry="4.2" transform="rotate(22 2.2 -5)"/></g>'
  + '<path class="bee-t" d="M-7 1.2l-2.6.5 2.6.9Z"/><ellipse class="bee-y" cx="0" cy="1" rx="7" ry="4.8"/><path class="bee-s" d="M-2.6-3.3v8.6M1.4-3.6v9.2"/>'
  + '<circle class="bee-h" cx="7" cy="0" r="3.1"/><circle class="bee-e" cx="8.2" cy="-.6" r=".8"/><path class="bee-a" d="M7.6-2.8q.6-2.4 2.6-3.2M6-3q-.4-2.4 1-3.8"/></svg>';
function bees(n, seed) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return Array.from({ length: n }, (_, i) => {
    const d = 9 + rnd() * 7;
    const delay = (-rnd() * d * 2).toFixed(1);
    // Удень — чотири бджілки, уночі світлячків більше
    const b = h('span', { class: i < 4 ? 'bee' : 'bee bee-extra' }, h('span', { class: 'bee-bob' }, h('span', { class: 'bee-turn', html: BEE })));
    b.style.cssText = `left:${(6 + rnd() * 55).toFixed(1)}%;top:${(14 + rnd() * 68).toFixed(1)}%;--d:${d.toFixed(1)}s;--delay:${delay}s;`
      + `--mx:${(90 + rnd() * 90).toFixed(0)}px;--bd:${(2.4 + rnd() * 1.8).toFixed(1)}s;--my:${(14 + rnd() * 26).toFixed(0)}px;--glow:${(1.8 + rnd() * 2.4).toFixed(1)}s`;
    return b;
  });
}
// Метелики (лише вдень): два крильця з плямками змахують, сам метелик петляє по екрану
const FLY = '<svg class="fly-b" viewBox="-15 -14 30 28" aria-hidden="true"><g class="fly-w fly-l"><path class="fly-up" d="M-1 -1C-4 -10 -13 -12.5 -13.5 -6C-14 -1.5 -8 1 -1 0Z"/><path class="fly-lo" d="M-1 1C-6 1.5 -10.5 5.5 -8.5 9.5C-6 12 -2 8.5 -1 1Z"/><ellipse class="fly-in" cx="-6.5" cy="-4.5" rx="3.4" ry="2.2" transform="rotate(-25 -6.5 -4.5)"/><g class="fly-spot"><circle cx="-11" cy="-6.5" r="1"/><circle cx="-9" cy="-9.4" r=".8"/><circle cx="-12" cy="-3.4" r=".7"/><circle cx="-6.5" cy="7.2" r=".8"/></g></g><g class="fly-w fly-r"><path class="fly-up" d="M1 -1C4 -10 13 -12.5 13.5 -6C14 -1.5 8 1 1 0Z"/><path class="fly-lo" d="M1 1C6 1.5 10.5 5.5 8.5 9.5C6 12 2 8.5 1 1Z"/><ellipse class="fly-in" cx="6.5" cy="-4.5" rx="3.4" ry="2.2" transform="rotate(25 6.5 -4.5)"/><g class="fly-spot"><circle cx="11" cy="-6.5" r="1"/><circle cx="9" cy="-9.4" r=".8"/><circle cx="12" cy="-3.4" r=".7"/><circle cx="6.5" cy="7.2" r=".8"/></g></g><ellipse class="fly-body" cx="0" cy="1.5" rx="1.3" ry="6.5"/><circle class="fly-body" cx="0" cy="-5.6" r="1.7"/><path class="fly-t" d="M-.5-7Q-2-11-4-12.5M.5-7Q2-11 4-12.5"/><circle class="fly-body" cx="-4" cy="-12.6" r=".9"/><circle class="fly-body" cx="4" cy="-12.6" r=".9"/></svg>';
// Стрекоза: довге тіло з сегментами, великі очі, дві пари прозорих крил із прожилкою
const DRAGON = '<svg class="drag-b" viewBox="-8 -12 34 24" aria-hidden="true">'
  + '<g class="drag-w"><ellipse cx="5" cy="-5.2" rx="9.5" ry="2.3" transform="rotate(-14 5 -5.2)"/><ellipse cx="5" cy="5.2" rx="9.5" ry="2.3" transform="rotate(14 5 5.2)"/>'
  + '<ellipse cx="3" cy="-4" rx="8" ry="2" transform="rotate(-34 3 -4)"/><ellipse cx="3" cy="4" rx="8" ry="2" transform="rotate(34 3 4)"/>'
  + '<path class="drag-v" d="M0-1L13-7.5M0 1L13 7.5M0-.6L9.5-8.6M0 .6L9.5 8.6"/></g>'
  + '<path class="drag-body" d="M1-1.3H24Q25.5 0 24 1.3H1Z"/><path class="drag-seg" d="M6-1.3V1.3M10-1.3V1.3M14-1.3V1.3M18-1.3V1.3M22-1.3V1.3"/>'
  + '<ellipse class="drag-body" cx="0" cy="0" rx="2.6" ry="2"/><circle class="drag-eye" cx="-3" cy="-1.6" r="1.9"/><circle class="drag-eye" cx="-3" cy="1.6" r="1.9"/></svg>';
function dragons(n, seed) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const tones = ['#D98A2B', '#C2452D', '#C99A2E'];
  return Array.from({ length: n }, (_, i) => {
    const d = 11 + rnd() * 6;
    const el = h('span', { class: 'drag' }, h('span', { class: 'drag-turn', html: DRAGON }));
    el.style.cssText = `left:${(10 + rnd() * 45).toFixed(1)}%;top:${(22 + rnd() * 45).toFixed(1)}%;--d:${d.toFixed(1)}s;--delay:${(-rnd() * d).toFixed(1)}s;`
      + `--mx:${(90 + rnd() * 90).toFixed(0)}px;--my:${(30 + rnd() * 50).toFixed(0)}px;--dc:${tones[i % tones.length]}`;
    return el;
  });
}
function flies(n, seed) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  // [крило, облямівка, світла пляма]: монарх, адмірал, лимонниця, рожевий — лише теплі, як усе літо
  const wings = [['#F59A3A', '#5A2E1A', '#FFC46A'], ['#EE6A4A', '#5A2418', '#FFC9A8'], ['#F7D04A', '#7A5A1A', '#FFF0A8'], ['#F2A0C8', '#8A3A6A', '#FFD6EA']];
  return Array.from({ length: n }, (_, i) => {
    const d = 14 + rnd() * 8;
    const f = h('span', { class: 'fly' }, h('span', { class: 'fly-bob', html: FLY }));
    f.style.cssText = `left:${(8 + rnd() * 50).toFixed(1)}%;top:${(18 + rnd() * 55).toFixed(1)}%;--d:${d.toFixed(1)}s;--delay:${(-rnd() * d).toFixed(1)}s;`
      + `--mx:${(80 + rnd() * 100).toFixed(0)}px;--my:${(40 + rnd() * 50).toFixed(0)}px;--w:${wings[i % wings.length][0]};--w2:${wings[i % wings.length][1]};--w3:${wings[i % wings.length][2]}`;
    return f;
  });
}
// Новий рік: вогники гірлянди на пів ялинки біля лівого краю. Координати вже перераховані
// у .dv-front: [left, bottom] у px шару (ялинка — left 30px, bottom 112px, масштаб 1.2, як у CSS). Мерехтять чотирма фазами:
// анімація на обгортці фази, а не на кожному вогнику — кожна запущена анімація дорожчає кожен кадр інтерфейсу
const FIR_LIGHTS = [[64,486],[76,474],[60,436],[65,441],[80,430],[95,424],[60,387],[66,394],[83,384],[100,378],[116,375],[60,338],[67,347],[85,339],[103,332],[120,327],[138,324],[60,288],[67,299],[86,292],[104,285],[124,280],[142,278],[161,275],[60,239],[68,251],[86,245],[106,238],[125,233],[144,230],[163,227],[182,226],[60,190],[68,203],[88,197],[107,191],[127,186],[146,183],[166,179],[185,178],[205,176]];
// Вісь ялинки в px шару (left 30px + вісь 22 × 1.2); ліва половина видна лише смужкою при нахилі — дзеркалимо ближні до осі
const FIR_AXIS = 56.4;
const FIR_ALL = FIR_LIGHTS.concat(FIR_LIGHTS.filter(([x]) => x > FIR_AXIS + 2 && x <= 106).map(([x, y]) => [Math.round(2 * FIR_AXIS - x), y]));
function firLights() {
  return [0, 1, 2, 3].map((ph) => {
    const g = h('span', { class: 'fir-ph' }, ...FIR_ALL.flatMap(([x, y], i) => {
      if (i % 4 !== ph) return [];
      const s = h('span', { class: 'fir-light' });
      s.style.cssText = `left:${x}px;bottom:${y}px;--c:${BULBS[i % BULBS.length]}`;
      return [s];
    }));
    g.style.cssText = `--i:${ph}`;
    return g;
  });
}
// Осінній дощ: похилі краплі різної швидкості — лише transform. Шар видно, лише коли html.is-raining
function rain(n) {
  let s = 17;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return Array.from({ length: n }, () => {
    const d = 0.7 + rnd() * 0.5;
    const r = h('span');
    r.style.cssText = `left:${(rnd() * 125).toFixed(1)}%;--d:${d.toFixed(2)}s;--delay:${(-rnd() * d).toFixed(2)}s;--o:${(0.35 + rnd() * 0.35).toFixed(2)}`;
    return r;
  });
}
// Порив вітру: оберемок кленового листя пролітає екраном зліва направо, крутиться й трохи падає (WAAPI, лише transform/opacity)
const GUST = ['#F2B13C', '#F08A2E', '#E5562E', '#FFCB52', '#D9462E'];
// Пелюстки сакури навесні — від блідо-рожевого до малинового
const SAKURA = ['#FFD3E2', '#FFB7CF', '#FF9DC0', '#F7C6DA', '#FF86B0'];
let gusting = false;
function leafGust(y0 = innerHeight * (0.22 + Math.random() * 0.4)) {
  const html = document.documentElement;
  if (reduceMotion || gusting || document.hidden || html.classList.contains('is-still') || html.classList.contains('is-covered')) return;
  gusting = true;
  // Узимку замість листя — сніжинки: їх більше, вони дрібніші й крутяться повільніше (стиль — як у вихора);
  // навесні — пелюстки сакури: легкі, їх багато, пливуть повільніше й хвилею
  const snow = html.classList.contains('is-winter');
  const spring = !snow && html.classList.contains('is-spring');
  const box = h('div', { class: snow ? 'snow-whirl' : spring ? 'leaf-gust petal-gust' : 'leaf-gust', 'aria-hidden': 'true' });
  const W = innerWidth;
  for (let i = 0; i < (snow ? 26 : spring ? 24 : 16); i += 1) {
    const s = h('span', { html: snow ? FLAKE : spring ? PETAL : LEAF });
    if (!snow) s.style.setProperty('--leaf', (spring ? SAKURA : GUST)[i % (spring ? SAKURA : GUST).length]);
    box.append(s);
    const y = y0 + (Math.random() - 0.5) * (snow ? 190 : 150);
    const dy = 30 + Math.random() * 120;
    const sc = (snow ? 0.45 + Math.random() * 0.75 : spring ? 0.5 + Math.random() * 0.7 : 0.7 + Math.random() * 0.9).toFixed(2);
    const spin = snow ? 90 + Math.random() * 200 : spring ? 200 + Math.random() * 360 : 300 + Math.random() * 600;
    s.animate([
      { transform: `translate(-40px, ${y.toFixed(0)}px) rotate(0deg) scale(${sc})`, opacity: 0 },
      { opacity: 1, offset: 0.08 },
      { transform: `translate(${(W * 0.5).toFixed(0)}px, ${(y - 30 + dy * 0.3).toFixed(0)}px) rotate(${(spin * 0.5).toFixed(0)}deg) scale(${sc})`, offset: 0.5 },
      { transform: `translate(${W + 40}px, ${(y + dy).toFixed(0)}px) rotate(${spin.toFixed(0)}deg) scale(${sc})`, opacity: 0.85 },
    ], { duration: (spring ? 3400 : 2600) + Math.random() * 1300, delay: Math.random() * (spring ? 1100 : 800), easing: 'cubic-bezier(.35,.1,.6,.95)', fill: 'both' });
  }
  document.body.append(box);
  setTimeout(() => { box.remove(); gusting = false; }, 5000);
}
// Восени й узимку порив — раз на півтори хвилини з імовірністю 45 %, перший невдовзі після відкриття
function gustLoop() {
  const html = document.documentElement;
  const maybe = () => { if (html.dataset.side === 'vona' && (html.classList.contains('is-autumn') || html.classList.contains('is-winter') || html.classList.contains('is-spring')) && Math.random() < 0.45) leafGust(); };
  setTimeout(maybe, 15000);
  setInterval(maybe, 90000);
}
// Раз на дві хвилини кидаємо жереб: у 25 % випадків іде дощ на 40–80 с, потім за 3 с плавно вщухає
function rainLoop() {
  const html = document.documentElement;
  let on = false;
  setInterval(() => {
    if (on || document.hidden || !html.classList.contains('is-autumn') || html.classList.contains('is-still') || Math.random() > 0.25) return;
    on = true;
    html.classList.add('is-raining');
    setTimeout(() => {
      html.classList.add('is-rain-end');
      setTimeout(() => { html.classList.remove('is-raining', 'is-rain-end'); on = false; }, 3000);
    }, 40000 + Math.random() * 40000);
  }, 120000);
}
const clamp = (v) => Math.max(-MAX, Math.min(MAX, v));

// Зимою тап по фону в неї — вихор сніжинок: закручуються від пальця, розлітаються й осідають униз.
// WAAPI, лише transform/opacity, ~16 елементів; одночасно не більше двох вихорів
// Новий рік у неї: гірлянда вгорі — провід провисає трьома дугами, на ньому лампочки, що мигають по черзі (CSS)
const BULBS = ['#FF5C7A', '#FFD24A', '#5CD6A0', '#6FA8FF', '#C98BFF'];
function garland(n) {
  // Три фази мерехтіння — три обгортки, у кожній кожна третя лампочка
  return [0, 1, 2].map((ph) => {
    const g = h('span', { class: 'bulb-ph' }, ...Array.from({ length: n }, (_, i) => i).filter((i) => i % 3 === ph).map((i) => {
      const u = (i + 0.5) / n;
      const k = (u * 3) % 1;
      const b = h('span', { class: 'bulb' });
      // Провід — квадратична дуга: y = 4 + 64·k·(1 − k) у межах однієї дуги
      b.style.cssText = `left:${(u * 100).toFixed(2)}%;top:${(3 + 64 * k * (1 - k)).toFixed(1)}px;--c:${BULBS[i % BULBS.length]}`;
      return b;
    }));
    g.style.cssText = `--i:${ph}`;
    return g;
  });
}
let whirls = 0;
function snowWhirl(x, y) {
  if (reduceMotion || whirls > 1 || document.documentElement.classList.contains('is-still')) return;
  whirls += 1;
  const box = h('div', { class: 'snow-whirl', 'aria-hidden': 'true' });
  document.body.append(box);
  const N = 16;
  const turn = Math.random() < 0.5 ? -1 : 1;
  for (let i = 0; i < N; i += 1) {
    const f = h('span', { html: FLAKE });
    box.append(f);
    const a = (i / N) * Math.PI * 2 + Math.random() * 0.4;
    const d = 34 + Math.random() * 52;
    const s = 0.55 + Math.random() * 0.8;
    const spin = turn * (200 + Math.random() * 260);
    // Точка на спіралі: кут повертається, радіус росте — виходить вихор, а не просто вибух
    const at = (k, fall, sc, rot, opacity, offset) => {
      const ang = a + turn * k * 1.4;
      const px = x + Math.cos(ang) * d * k - 7;
      const py = y + Math.sin(ang) * d * k - 7 + fall;
      return { opacity, offset, transform: `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) rotate(${rot.toFixed(0)}deg) scale(${sc.toFixed(2)})` };
    };
    f.animate([at(0, 0, 0.3, 0, 0, 0), at(0.55, 0, s, spin * 0.3, 1, 0.18), at(1, 10, s, spin * 0.6, 1, 0.5),
      at(1.1, 80 + Math.random() * 70, s * 0.8, spin, 0, 1)], { duration: 1700 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'both' });
  }
  sfx('react');
  setTimeout(() => { box.remove(); whirls -= 1; }, 2600);
}

// Сузірʼя спалахує зірка за зіркою (збіг у «Планах», тап по сузірʼю на фоні)
export function flashConstellation() {
  const el = document.querySelector('[data-side="vona"] .depth-vona .sgr, [data-side="vin"] .depth-vin .sgr');
  if (!el || reduceMotion) return;
  el.classList.remove('is-lit');
  void el.offsetWidth;
  el.classList.add('is-lit');
  setTimeout(() => el.classList.remove('is-lit'), 2600);
}

// Тап по сузірʼю: Стрілець натягує лук і стріляє — з «носика» чайника по дузі летить стріла з іскрами
// й застрягає, тремтячи; у неї в цілі розлітаються сердечка, у нього — спалахує зірка.
// Лише transform/opacity (WAAPI, без rAF), ~20 елементів, після — усе прибирається
const ARROW = '<svg viewBox="0 0 44 12" aria-hidden="true"><path class="sa-tail" d="M1 2.5l5 3.5-5 3.5M5 2.5l5 3.5-5 3.5"/>'
  + '<line x1="4" y1="6" x2="37" y2="6"/><path class="sa-head" d="M33 1.5L44 6 33 10.5 35.5 6Z"/></svg>';
const STAR4 = '<svg viewBox="-5 -5 10 10" aria-hidden="true"><path d="M0-5L1.1-1.1 5 0 1.1 1.1 0 5-1.1 1.1-5 0-1.1-1.1Z"/></svg>';
const HEART_SVG = `<svg viewBox="-3.4 -4.4 6.8 6.2" aria-hidden="true"><path d="${HEART}"/></svg>`;
let shooting = false;
export function shootConstellation() {
  const el = document.querySelector('[data-side="vona"] .depth-vona .sgr, [data-side="vin"] .depth-vin .sgr');
  const spout = el?.querySelector('.sgr-stars > :first-child')?.getBoundingClientRect();
  if (!spout || reduceMotion || shooting) return;
  shooting = true;
  flashConstellation();
  const her = DATA.side !== 'vin';
  const W = innerWidth;
  const x0 = spout.left + spout.width / 2;
  const y0 = spout.top + spout.height / 2;
  // Ціль — праворуч угорі (Стрілець цілиться в Антарес, на карті він праворуч); дуга — вище прямої
  const x2 = Math.min(W - 90, x0 + Math.max(150, W * 0.5));
  const y2 = Math.max(150, y0 - innerHeight * 0.3);
  const cx = (x0 + x2) / 2;
  const cy = Math.min(y0, y2) - 45;
  const at = (t) => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x2, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y2];
  const dir = (t) => Math.atan2(2 * (1 - t) * (cy - y0) + 2 * t * (y2 - cy), 2 * (1 - t) * (cx - x0) + 2 * t * (x2 - cx));
  const ease = (t) => 1 - (1 - t) ** 2;
  const DRAW = 380;
  const FLY = 700;
  const STUCK = 900;
  const box = h('div', { class: `sgr-shot${her ? ' is-her' : ''}`, 'aria-hidden': 'true' });
  document.body.append(box);
  const part = (cls, html, frames, opts) => {
    const p = h('span', { class: cls, html });
    box.append(p);
    p.animate(frames, { fill: 'both', ...opts });
  };
  const tr = (x, y, s, extra = '') => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)${extra} scale(${s})`;

  // Лук натягується: сузірʼя відтягується назад і відпускає
  el.animate([{ transform: 'none' }, { transform: 'translateX(-7px) scaleX(.94)', offset: 0.75 }, { transform: 'translateX(3px)', offset: 0.88 }, { transform: 'none' }],
    { duration: DRAW / 0.75, easing: 'ease-in-out' });

  // Стріла 60×16: вістря (60, 8) — у точці дуги, кут — за дотичною; в кінці тремтить і тане
  const T = FLY + STUCK;
  const end = dir(1);
  const frames = Array.from({ length: 11 }, (_, i) => {
    const u = ease(i / 10);
    const [x, y] = at(u);
    return { offset: (i / 10) * FLY / T, opacity: i ? 1 : 0, transform: `translate(${(x - 60).toFixed(1)}px, ${(y - 8).toFixed(1)}px) rotate(${dir(u).toFixed(3)}rad)` };
  });
  const stuck = (k, wob, opacity = 1) => ({ offset: (FLY + k) / T, opacity, transform: `translate(${(x2 - 60).toFixed(1)}px, ${(y2 - 8).toFixed(1)}px) rotate(${(end + wob).toFixed(3)}rad)` });
  frames.push(stuck(70, 0.16), stuck(140, -0.12), stuck(210, 0.08), stuck(280, -0.04), stuck(350, 0), stuck(600, 0), stuck(STUCK, 0, 0));
  part('sa-arrow', ARROW, frames, { duration: T, delay: DRAW });

  // Іскри слідом: з'являються там, де стріла щойно пролетіла, і осідають
  for (let i = 1; i <= 7; i += 1) {
    const s = i / 8;
    const [x, y] = at(ease(s));
    part('sa-spark', '', [{ opacity: 0, transform: tr(x - 2.5, y - 2.5, 1) }, { opacity: 1, offset: 0.15 }, { opacity: 0, transform: tr(x - 2.5, y + 8, 0.3) }],
      { duration: 650, delay: DRAW + s * FLY, easing: 'ease-out' });
  }

  // Влучання: у неї — велике сердце, пробите стрілою (як у Купідона), і сердечка навсібіч;
  // у нього — велика зірка й промінчики-зірочки
  const hit = DRAW + FLY;
  if (her) {
    const [bx, by] = [x2 - Math.cos(end) * 12 - 28, y2 - Math.sin(end) * 12 - 26];
    part('sa-big', HEART_SVG, [{ opacity: 0, transform: tr(bx, by, 0.2) }, { opacity: 1, offset: 0.16, transform: tr(bx, by, 1.5) },
      { offset: 0.28, transform: tr(bx, by, 0.9) }, { offset: 0.38, transform: tr(bx, by, 1.12) }, { offset: 0.48, transform: tr(bx, by, 1) },
      { opacity: 1, offset: 0.78, transform: tr(bx, by, 1) }, { opacity: 0, transform: tr(bx, by - 14, 1.15) }],
    { duration: STUCK + 300, delay: hit - 30, easing: 'ease-out' });
    // Під стрілою — щоб стріла «пробивала» сердце
    box.prepend(box.lastChild);
  } else {
    part('sa-flash', STAR4, [{ opacity: 0, transform: tr(x2 - 20, y2 - 20, 0.2, ' rotate(0deg)') }, { opacity: 1, offset: 0.4, transform: tr(x2 - 20, y2 - 20, 2.2, ' rotate(45deg)') },
      { opacity: 0, transform: tr(x2 - 20, y2 - 20, 0.5, ' rotate(100deg)') }], { duration: 900, delay: hit, easing: 'ease-out' });
  }
  // Ударна хвиля: два кільця розходяться від цілі
  for (const k of [0, 1]) {
    part('sa-ring', '', [{ opacity: 0.9, transform: tr(x2 - 20, y2 - 20, 0.3) }, { opacity: 0, transform: tr(x2 - 20, y2 - 20, 5 + k * 2) }],
      { duration: 750 + k * 200, delay: hit + k * 130, easing: 'cubic-bezier(.15,.7,.3,1)' });
  }
  // Вибух: ближнє коло — швидко й недалеко, дальнє — ширше, повільніше й падає вниз, як конфеті
  const N = 22;
  const half = her ? 10 : 8;
  for (let i = 0; i < N; i += 1) {
    const far = i >= 10;
    const a = (far ? (i - 10) / 12 : i / 10) * Math.PI * 2 + (far ? 0.26 : 0) + (Math.random() - 0.5) * 0.35;
    const d = far ? 95 + Math.random() * 70 : 48 + Math.random() * 30;
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    const s = far ? 0.8 + Math.random() * 0.8 : 0.7 + Math.random() * 0.5;
    const spin = ` rotate(${Math.round((Math.random() - 0.5) * (far ? 120 : 60))}deg)`;
    part(her ? 'sa-heart' : 'sa-star', her ? HEART_SVG : STAR4, [
      { opacity: 0, transform: tr(x2 - half, y2 - half, 0.2) },
      { opacity: 1, offset: 0.12, transform: tr(x2 - half + dx * 0.35, y2 - half + dy * 0.35, s * 0.9) },
      { opacity: 1, offset: 0.5, transform: tr(x2 - half + dx, y2 - half + dy, s, spin) },
      { opacity: 0, transform: tr(x2 - half + dx * 1.15, y2 - half + dy * 1.15 + (far ? 70 : 24), s * 0.6, spin) },
    ], { duration: far ? 1500 : 1000, delay: hit + (far ? 60 : 0) + (i % 3) * 25, easing: 'cubic-bezier(.2,.75,.35,1)' });
    if (her) box.lastChild.style.setProperty('--c', ['#FF5C9A', '#FF8DBB', '#E0679F', '#C25A95', '#FFB3D1'][i % 5]);
  }
  setTimeout(() => { box.remove(); shooting = false; }, Math.max(DRAW + T, hit + 1700) + 150);
}

// «💞 Люблю тебя!»: над усіма вікнами вгорі — сузірʼя із сердечок, вони спалахують по черзі, лінії загоряються, і все тане
export function loveConstellation() {
  if (reduceMotion) return;
  document.querySelector('.love-sky')?.remove();
  const sgr = constellation(true);
  const box = h('div', { class: 'love-sky', 'aria-hidden': 'true' }, sgr);
  document.body.append(box);
  requestAnimationFrame(() => sgr.classList.add('is-love'));
  setTimeout(() => box.remove(), 3800);
}

// Особливий день (дні народження, річниця — з «Вместе»): конфеті падає, сузірʼя світиться яскравіше
const CONFETTI = ['#F6D27A', '#F7B8D2', '#C9B6F2', '#E8473C', '#8FD3E8'];
export function markFestive() {
  const T = DATA.together || {};
  const md = new Date().toLocaleDateString('sv').slice(5);
  const today = [T.since, T.bdayVona, T.bdayVin].some((d) => d && d.slice(5) === md);
  document.documentElement.classList.toggle('is-festive', today);
  if (!today || !root || root.querySelector('.confetti')) return;
  for (const layer of root.querySelectorAll('.dv-front, .ds-near')) {
    for (let i = 0; i < 14; i += 1) {
      const c = h('span', { class: 'confetti' });
      const d = 9 + ((i * 7) % 9);
      c.style.cssText = `left:${(i * 37) % 100}%;--d:${d}s;--delay:-${(i * 1.9) % d}s;--c:${CONFETTI[i % CONFETTI.length]};--drift:${-30 - (i % 5) * 18}px`;
      layer.append(c);
    }
  }
}

// Нерухомі прикраси для «Написать» на весь екран: та сама половина, що на фоні, без сузірʼя й без руху (дешево)
export function writeDecor() {
  const vin = DATA.side === 'vin';
  return vin
    ? h('div', { class: 'write-decor', 'aria-hidden': 'true' }, h('i', { class: 'ds-chart', html: CHART }), sky(40, 9))
    : h('div', { class: 'write-decor', 'aria-hidden': 'true' }, h('i', { class: 'dv-mid' }), h('i', { class: 'dv-front' }));
}

// Луна за справжньою фазою: 0 — молодик, 0,5 — повня. Відлік від молодика 6.01.2000 18:14 UTC, синодичний місяць 29,53 доби
const SYNODIC = 29.530588853;
function moonPhase() {
  try {
    const t = parseFloat(localStorage.getItem('radovalka:moon-test'));
    if (t >= 0 && t < 1) return t;
  } catch { /* без сховища — справжня фаза */ }
  const days = (Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
  return ((days / SYNODIC) % 1 + 1) % 1;
}
// Освітлена частина: півколо з освітленого боку (до повні — праворуч) і назад по еліпсу термінатора
function moonSvg(p, id) {
  const r = 16;
  const rx = (r * Math.abs(Math.cos(2 * Math.PI * p))).toFixed(2);
  const wax = p < 0.5;
  const back = wax ? (p < 0.25 ? 0 : 1) : (p > 0.75 ? 1 : 0);
  const lit = 'M0 ' + (-r) + 'A' + r + ' ' + r + ' 0 0 ' + (wax ? 1 : 0) + ' 0 ' + r + 'A' + rx + ' ' + r + ' 0 0 ' + back + ' 0 ' + (-r) + 'Z';
  return '<svg viewBox="-20 -20 40 40" aria-hidden="true"><defs>'
    + '<radialGradient id="' + id + '-g" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#FFF8E2"/><stop offset="1" stop-color="#E6D29C"/></radialGradient>'
    + '<clipPath id="' + id + '-c"><path d="' + lit + '"/></clipPath></defs>'
    + '<circle class="moon-dark" r="' + r + '" fill-opacity=".6" stroke="#FFF0C8" stroke-opacity=".14" stroke-width=".8"/>'
    + '<path d="' + lit + '" fill="url(#' + id + '-g)"/>'
    + '<g clip-path="url(#' + id + '-c)" fill="#C9B47E" fill-opacity=".45"><circle cx="-5" cy="-6" r="3.6"/><circle cx="6" cy="3" r="2.6"/>'
    + '<circle cx="-3" cy="7" r="2"/><circle cx="8" cy="-8" r="1.5"/><circle cx="-10" cy="2" r="1.8"/></g></svg>';
}
// id — свій для кожної Луни: градієнт за id із прихованої половини (display: none) не малюється
function moon(id) {
  const disc = h('span', { class: 'ds-moon-disc' });
  const halo = h('span', { class: 'ds-moon-halo' }, h('span'));
  const el = h('span', { class: 'ds-moon-box' }, halo, disc);
  let shown = -1;
  const paint = () => {
    const p = moonPhase();
    if (Math.abs(p - shown) < 0.004) return;
    shown = p;
    disc.innerHTML = moonSvg(p, id);
    el.dataset.phase = p.toFixed(3);
    // Ореол — за освітленою часткою: у повню сяє, у молодик майже зникає
    halo.style.opacity = String(0.15 + 0.85 * (1 - Math.cos(2 * Math.PI * p)) / 2);
  };
  paint();
  setInterval(paint, 30 * 60e3);
  return el;
}

// Його падаючі зірки: щоразу в новому місці, під своїм кутом, вліво чи вправо, з довшим чи коротшим слідом;
// раз на кілька разів — зорепад із 3–5 поспіль. Між ними 20–60 с; під вікном, без «Движения фона» і у фоні — пауза
let starLayer = null;
const calm = () => document.hidden || document.documentElement.classList.contains('is-still')
  || document.documentElement.classList.contains('is-covered');
export function fallingStar() {
  if (!starLayer || document.documentElement.dataset.side !== 'vin' || calm()) return;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const ang = -(16 + Math.random() * 30);
  const len = 100 + Math.round(Math.random() * 90);
  const m = h('span', { class: 'meteor meteor-fly' });
  m.style.cssText = 'top:' + (8 + Math.random() * 48).toFixed(1) + '%;left:' + (dir > 0 ? 40 + Math.random() * 55 : 5 + Math.random() * 50).toFixed(1)
    + '%;width:' + len + 'px';
  m.style.setProperty('--a', ang + 'deg');
  starLayer.append(m);
  const go = 'scaleX(' + dir + ') rotate(' + ang + 'deg) translateX(';
  const a = m.animate([
    { opacity: 0, transform: go + '0)' }, { opacity: 1, offset: 0.2 }, { opacity: 0, transform: go + (-220 - Math.random() * 160).toFixed(0) + 'px)' },
  ], { duration: 1500 + Math.random() * 900, easing: 'linear' });
  a.onfinish = () => m.remove();
  a.oncancel = () => m.remove();
}
function starLoop() {
  setTimeout(() => {
    if (!calm()) {
      if (Math.random() < 0.15) {
        const n = 3 + Math.floor(Math.random() * 3);
        for (let i = 0, t = 0; i < n; i++, t += 250 + Math.random() * 500) setTimeout(fallingStar, t);
      } else fallingStar();
    }
    starLoop();
  }, 20000 + Math.random() * 40000);
}

export function startDepth() {
  // Її половина: плями (далеко), сердечка й хвилі (посередині), лотос і сакура (близько)
  const vona = h('div', { class: 'depth depth-vona' },
    h('i', { class: 'dv-mid' }, constellation(true), ...petals(5, 7, 0.75)),
    h('i', { class: 'dv-front' }, ...petals(6, 3, 1.2), ...bees(5, 11), ...flies(3, 23), ...dragons(2, 41), ...firLights(), h('span', { class: 'meteor meteor-vona' })),
    h('i', { class: 'dv-moon' }, moon('dv-moon')),
    h('i', { class: 'dv-garland' }, ...garland(14)),
    h('i', { class: 'dv-rain' }, ...rain(52)));
  // Його космос (без туману): Луна, далекі дрібні зірки, середні, кілька близьких великих, що мерехтять; падаючі зірки — starLoop
  const near = h('i', { class: 'ds-near' }, sky(9, 5));
  const vin = h('div', { class: 'depth depth-vin' },
    h('i', { class: 'ds-chart', html: CHART }),
    h('i', { class: 'ds-moon' }, moon('ds-moon')),
    h('i', { class: 'ds-milky' }),
    h('i', { class: 'ds-aurora' }, h('span'), h('span'), h('span')),
    h('i', { class: 'ds-far' }, sky(70, 21)),
    h('i', { class: 'ds-mid' }, sky(26, 3), constellation(false)),
    near);
  // Обидві половини в одній обгортці; показується — своя (CSS). Зсув — не змінною на обгортці
  // (її успадковують сотні вузлів, і кожен кадр перераховував би їм стилі), а transform самих шарів
  const box = h('div', { class: 'depth-root', 'aria-hidden': 'true' }, vona, vin);
  root = box;
  // Будь-яке вікно поверх (шторка, читання, печенька, знайомство) — прикраси фону на паузу:
  // під вікном їх не видно, а рух забирав би процесор і відеокарту в самого вікна. Дивимось лише прямих дітей body
  const OVER = '.backdrop, .reader, .cookie-layer, .sheet, .photo-view, .plan-match, .tour';
  const cover = () => document.documentElement.classList.toggle('is-covered', [...document.body.children].some((el) => el.matches(OVER)));
  new MutationObserver(cover).observe(document.body, { childList: true });
  document.documentElement.classList.toggle('is-still', isStill());
  document.body.prepend(box);
  document.addEventListener('click', (e) => {
    // Лише по фону: не по кнопках, полях, шторках і не по повідомленнях чи картках (у них свої дії)
    // Шлях події, а не e.target.closest: кнопка могла замінити свій значок (＋ → ✕), і ціль уже відірвана від кнопки
    const SKIP = 'button, a, input, textarea, select, label, summary, [role="dialog"], .sheet, .plan-wheel, .feed-row, .feed-news, .want, .env-card, .plan-card, .letter, .bubble, .courier';
    if (!e.target.isConnected || e.composedPath().some((n) => n instanceof Element && n.matches(SKIP))) return;
    const el = document.querySelector('[data-side="vona"] .depth-vona .sgr, [data-side="vin"] .depth-vin .sgr');
    const r = el?.getBoundingClientRect();
    if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) shootConstellation();
    else if (document.documentElement.dataset.side !== 'vin' && document.documentElement.classList.contains('is-winter')) snowWhirl(e.clientX, e.clientY);
    else if (document.documentElement.dataset.side !== 'vin' && (document.documentElement.classList.contains('is-autumn') || document.documentElement.classList.contains('is-spring'))) leafGust(e.clientY);
  });
  if (reduceMotion) return;
  rainLoop();
  gustLoop();
  starLayer = near;
  starLoop();

  // Без покадрового циклу: поки на сторінці крутиться requestAnimationFrame, браузер щокадру перераховує в головному
  // потоці всі CSS-анімації фону (на телефоні датчик нахилу тримав би його завжди). Тому рідко (≤ 5 разів на секунду
  // й лише на помітний нахил) ставимо шарам нову ціль, а пливуть вони CSS-переходом — його веде відеокарта
  let tx = 0; let ty = 0; let sx = 0; let sy = 0; let timer = 0;
  const idle = () => document.hidden || document.documentElement.classList.contains('is-covered') || document.documentElement.classList.contains('is-fx');
  const send = () => {
    timer = 0;
    // Шторка чи реакція — стоїмо; наступний нахил після них знову зсуне
    if (idle() || Math.abs(tx - sx) + Math.abs(ty - sy) < 0.04) return;
    sx = tx; sy = ty;
    if (!layers.length) layers = [...box.querySelectorAll('.depth > i')].map((el) => [el, parseFloat(getComputedStyle(el).getPropertyValue('--k')) || 0]);
    shift(sx, sy);
  };
  const aim = (nx, ny) => {
    if (document.documentElement.classList.contains('is-still')) return;
    // Датчик тремтить — ціль теж згладжуємо
    tx = tx * 0.75 + clamp(nx) * 0.25;
    ty = ty * 0.75 + clamp(ny) * 0.25;
    if (!timer) timer = setTimeout(send, 220);
  };

  // Телефон: нахил відносно того, як його зараз тримають (база повільно підлаштовується) — тож у руці завжди «посередині»
  let base = null;
  addEventListener('deviceorientation', (e) => {
    if (e.gamma == null || e.beta == null) return;
    base = base ? { g: base.g * 0.985 + e.gamma * 0.015, b: base.b * 0.985 + e.beta * 0.015 } : { g: e.gamma, b: e.beta };
    aim((e.gamma - base.g) / 18, (e.beta - base.b) / 18);
  });
  // Компʼютер: миша по вікну
  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => aim((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1), { passive: true });
  }
}
