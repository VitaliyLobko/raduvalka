// Обʼємний фон: шари на різній «глибині» зсуваються від нахилу телефона (на компʼютері — від миші).
// Лише transform шарів (рахує відеокарта), подія датчика — не частіше кадру, стоїть, коли згорнуто, під шторкою
// чи «уменьшить движение». Шари — у CSS (.depth > i, --k — наскільки далеко зсувається шар)
import { h, reduceMotion, sky } from './ui.js';

const MAX = 1;
const clamp = (v) => Math.max(-MAX, Math.min(MAX, v));

export function startDepth() {
  // Її половина: плями (далеко), сердечка й хвилі (посередині), лотос і сакура (близько)
  const vona = h('div', { class: 'depth depth-vona' },
    h('i', { class: 'dv-back' }, h('b')),
    h('i', { class: 'dv-mid' }),
    h('i', { class: 'dv-front' }));
  // Його космос: туманність, далекі дрібні зірки, середні, кілька близьких великих, що мерехтять, і падаюча зірка
  const vin = h('div', { class: 'depth depth-vin' },
    h('i', { class: 'ds-nebula' }),
    h('i', { class: 'ds-far' }, sky(70, 21)),
    h('i', { class: 'ds-mid' }, sky(26, 3)),
    h('i', { class: 'ds-near' }, sky(9, 5), h('span', { class: 'meteor' })));
  // Обидві половини в одній обгортці: зсув (--dx/--dy) успадковують шари обох; показується — своя (CSS)
  const box = h('div', { class: 'depth-root', 'aria-hidden': 'true' }, vona, vin);
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
