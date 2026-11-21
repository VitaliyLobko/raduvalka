// Обʼємний фон: шари на різній «глибині» зсуваються від нахилу телефона (на компʼютері — від миші).
// Лише transform шарів (рахує відеокарта), подія датчика — не частіше кадру, стоїть, коли згорнуто, під шторкою
// чи «уменьшить движение». Шари — у CSS (.depth > i, --k — наскільки далеко зсувається шар)
import { h, reduceMotion, sky } from './ui.js';
import { DATA } from './data.js';

const MAX = 1;
// «Движение фона» вимикається в меню (раптом укачує): нахил, пелюстки, падаюча зірка, плями — стоять
const STILL = 'radovalka:still';
export function isStill() { try { return localStorage.getItem(STILL) === '1'; } catch { return false; } }
let root = null;
export function setStill(on) {
  try { if (on) localStorage.setItem(STILL, '1'); else localStorage.removeItem(STILL); } catch { /* приватне вікно — до перезапуску */ }
  document.documentElement.classList.toggle('is-still', on);
  root?.style.setProperty('--dx', '0');
  root?.style.setProperty('--dy', '0');
}
// Пелюстка сакури — та сама форма, що в гілочці на її фоні
const PETAL = '<svg viewBox="-7 -13 14 14" aria-hidden="true"><path d="M0 0C-3.5-1-7.5-5-6.2-9.2C-5.3-12-2.4-12.6-.9-11.6L0-10.4L.9-11.6C2.4-12.6 5.3-12 6.2-9.2C7.5-5 3.5-1 0 0Z"/></svg>';
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

// Боке: мʼякі кружечки світла різного розміру, як вогні не у фокусі; кожен ледь пливе й дихає
function bokeh(n, seed) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const tones = ['255, 255, 255', '233, 210, 255', '255, 205, 228', '214, 190, 250'];
  return Array.from({ length: n }, () => {
    const b = h('span', { class: 'bokeh' });
    const size = 26 + rnd() * rnd() * 130;
    b.style.cssText = `left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 100).toFixed(1)}%;width:${size.toFixed(0)}px;height:${size.toFixed(0)}px;`
      + `--c:${tones[Math.floor(rnd() * tones.length)]};--a:${(0.28 + rnd() * 0.35).toFixed(2)};`
      + `--d:${(9 + rnd() * 10).toFixed(1)}s;--delay:${(-rnd() * 15).toFixed(1)}s;--mx:${(rnd() * 30 - 15).toFixed(0)}px;--my:${(rnd() * 24 - 12).toFixed(0)}px`;
    return b;
  });
}
// Падають повільно, кожна — своїм шляхом; сталі значення, щоб при перезапуску картина не стрибала
function petals(n, seed, size) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return Array.from({ length: n }, () => {
    const p = h('span', { class: 'petal', html: PETAL });
    const d = 14 + rnd() * 12;
    p.style.cssText = `left:${(rnd() * 100).toFixed(1)}%;--d:${d.toFixed(1)}s;--delay:${(-rnd() * d).toFixed(1)}s;`
      + `--s:${(size * (0.75 + rnd() * 0.5)).toFixed(2)};--drift:${(-40 - rnd() * 80).toFixed(0)}px;--tone:${rnd() < 0.5 ? '#F7B8D2' : '#F2A7C8'}`;
    return p;
  });
}
const clamp = (v) => Math.max(-MAX, Math.min(MAX, v));

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
  const x2 = Math.min(W - 30, x0 + Math.max(150, W * 0.5));
  const y2 = Math.max(90, y0 - innerHeight * 0.3);
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
    const [bx, by] = [x2 - Math.cos(end) * 10 - 18, y2 - Math.sin(end) * 10 - 17];
    part('sa-big', HEART_SVG, [{ opacity: 0, transform: tr(bx, by, 0.2) }, { opacity: 1, offset: 0.2, transform: tr(bx, by, 1.35) },
      { offset: 0.32, transform: tr(bx, by, 0.95) }, { offset: 0.42, transform: tr(bx, by, 1.05) }, { opacity: 1, offset: 0.75, transform: tr(bx, by, 1) },
      { opacity: 0, transform: tr(bx, by - 10, 1.1) }], { duration: STUCK, delay: hit - 30, easing: 'ease-out' });
    // Під стрілою — щоб стріла «пробивала» сердце
    box.prepend(box.lastChild);
  } else {
    part('sa-flash', STAR4, [{ opacity: 0, transform: tr(x2 - 14, y2 - 14, 0.2, ' rotate(0deg)') }, { opacity: 1, offset: 0.45, transform: tr(x2 - 14, y2 - 14, 1.7, ' rotate(45deg)') },
      { opacity: 0, transform: tr(x2 - 14, y2 - 14, 0.4, ' rotate(90deg)') }], { duration: 800, delay: hit, easing: 'ease-out' });
  }
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
    const d = 34 + (i % 3) * 12;
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    const half = her ? 10 : 8;
    part(her ? 'sa-heart' : 'sa-star', her ? HEART_SVG : STAR4, [
      { opacity: 0, transform: tr(x2 - half, y2 - half, 0.2) },
      { opacity: 1, offset: 0.45, transform: tr(x2 - half + dx, y2 - half + dy, her ? 1 - (i % 3) * 0.15 : 0.9) },
      { opacity: 0, transform: tr(x2 - half + dx * 1.2, y2 - half + dy * 1.2 + 16, 0.6) },
    ], { duration: 950, delay: hit + (i % 2) * 40, easing: 'cubic-bezier(.2,.7,.3,1)' });
    if (her) box.lastChild.style.setProperty('--c', ['#FF5C9A', '#FF8DBB', '#E0679F', '#C25A95'][i % 4]);
  }
  setTimeout(() => { box.remove(); shooting = false; }, DRAW + T + 150);
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

export function startDepth() {
  // Її половина: плями (далеко), сердечка й хвилі (посередині), лотос і сакура (близько)
  const vona = h('div', { class: 'depth depth-vona' },
    h('i', { class: 'dv-back' }, ...bokeh(14, 5)),
    h('i', { class: 'dv-mid' }, constellation(true), ...petals(5, 7, 0.75)),
    h('i', { class: 'dv-front' }, ...petals(6, 3, 1.2), h('span', { class: 'meteor meteor-vona' })));
  // Його космос (без туману): далекі дрібні зірки, середні, кілька близьких великих, що мерехтять, і падаюча зірка
  const vin = h('div', { class: 'depth depth-vin' },
    h('i', { class: 'ds-chart', html: CHART }),
    h('i', { class: 'ds-far' }, sky(70, 21)),
    h('i', { class: 'ds-mid' }, sky(26, 3), constellation(false)),
    h('i', { class: 'ds-near' }, sky(9, 5), h('span', { class: 'meteor' })));
  // Обидві половини в одній обгортці: зсув (--dx/--dy) успадковують шари обох; показується — своя (CSS)
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
    if (e.target.closest('button, a, input, textarea, select, label, summary, [role="dialog"], .sheet, .plan-wheel, .feed-row, .feed-news, .want, .env-card, .plan-card, .letter, .bubble, .courier')) return;
    const el = document.querySelector('[data-side="vona"] .depth-vona .sgr, [data-side="vin"] .depth-vin .sgr');
    const r = el?.getBoundingClientRect();
    if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) shootConstellation();
  });
  if (reduceMotion) return;

  let tx = 0; let ty = 0; let x = 0; let y = 0; let raf = 0;
  const idle = () => document.hidden || document.documentElement.classList.contains('is-covered');
  const step = () => {
    // Мʼяко доганяємо ціль — шари пливуть, а не смикаються
    x += (tx - x) * 0.055;
    y += (ty - y) * 0.055;
    box.style.setProperty('--dx', x.toFixed(3));
    box.style.setProperty('--dy', y.toFixed(3));
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
  };
  const aim = (nx, ny) => {
    if (document.documentElement.classList.contains('is-still')) return;
    // Датчик тремтить — ціль теж згладжуємо
    tx = tx * 0.75 + clamp(nx) * 0.25;
    ty = ty * 0.75 + clamp(ny) * 0.25;
    if (!raf && !idle()) raf = requestAnimationFrame(step);
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
