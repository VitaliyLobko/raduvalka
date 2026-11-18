// Обʼємний фон: шари на різній «глибині» зсуваються від нахилу телефона (на компʼютері — від миші).
// Лише transform шарів (рахує відеокарта), подія датчика — не частіше кадру, стоїть, коли згорнуто, під шторкою
// чи «уменьшить движение». Шари — у CSS (.depth > i, --k — наскільки далеко зсувається шар)
import { h, reduceMotion, sky } from './ui.js';

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

export function startDepth() {
  // Її половина: плями (далеко), сердечка й хвилі (посередині), лотос і сакура (близько)
  const vona = h('div', { class: 'depth depth-vona' },
    h('i', { class: 'dv-back' }, h('b')),
    h('i', { class: 'dv-mid' }, ...petals(5, 7, 0.75)),
    h('i', { class: 'dv-front' }, ...petals(6, 3, 1.2)));
  // Його космос: туманність, далекі дрібні зірки, середні, кілька близьких великих, що мерехтять, і падаюча зірка
  const vin = h('div', { class: 'depth depth-vin' },
    h('i', { class: 'ds-nebula' }),
    h('i', { class: 'ds-far' }, sky(70, 21)),
    h('i', { class: 'ds-mid' }, sky(26, 3)),
    h('i', { class: 'ds-near' }, sky(9, 5), h('span', { class: 'meteor' })));
  // Обидві половини в одній обгортці: зсув (--dx/--dy) успадковують шари обох; показується — своя (CSS)
  const box = h('div', { class: 'depth-root', 'aria-hidden': 'true' }, vona, vin);
  root = box;
  document.documentElement.classList.toggle('is-still', isStill());
  document.body.prepend(box);
  if (reduceMotion) return;

  let tx = 0; let ty = 0; let x = 0; let y = 0; let raf = 0;
  const idle = () => document.hidden || document.documentElement.classList.contains('is-covered');
  const step = () => {
    x += (tx - x) * 0.12;
    y += (ty - y) * 0.12;
    box.style.setProperty('--dx', x.toFixed(3));
    box.style.setProperty('--dy', y.toFixed(3));
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.004 ? requestAnimationFrame(step) : 0;
  };
  const aim = (nx, ny) => {
    if (document.documentElement.classList.contains('is-still')) return;
    tx = clamp(nx);
    ty = clamp(ny);
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
