// Святковий лист (kind 'date'): мерехтіння довкола золотого конверта, хлопавки з конфеті на печатці, кульки вгору.
// Вантажиться лише для святкового листа; лише transform/opacity, «менше руху» — нічого
import { reduceMotion } from './ui.js';
import { STAR } from './cookie.js';

const CONFETTI = ['#FF5C9A', '#FFD45C', '#C9B6F2', '#7FD1C7', '#F7B8D2', '#FFA94D'];
const BALLOONS = ['#FF5C9A', '#FFC94D', '#9B8CF2', '#6FCFC0', '#FF8DBB', '#FFA94D', '#C9B6F2'];
const rnd = (a, b) => a + Math.random() * (b - a);

// Зірочки мерехтять довкола конверта, доки його не відкрили
export function decorEnvelope(env) {
  if (reduceMotion || !env?.isConnected || env.querySelector('.fest-tw')) return;
  const spots = [[-4, 12], [104, 18], [-6, 78], [106, 84], [22, -8], [78, -10], [50, 108], [92, 50]];
  spots.forEach(([x, y], i) => env.append(Object.assign(document.createElement('span'), {
    className: 'fest-tw ck-tw',
    innerHTML: STAR,
    style: `left:${x}%;top:${y}%;width:${Math.round(rnd(12, 22))}px;height:${Math.round(rnd(12, 22))}px;animation-delay:${(i * 0.27).toFixed(2)}s`,
  })));
}

function layer() {
  const fx = document.createElement('div');
  fx.className = 'fest-fx';
  fx.setAttribute('aria-hidden', 'true');
  document.body.append(fx);
  return fx;
}

// Тап по печатці: дві хлопавки з нижніх кутів, конфеті злітає дугою й осідає, крутячись
export function popConfetti() {
  if (reduceMotion) return;
  const fx = layer();
  const W = innerWidth;
  const H = innerHeight;
  [[24, 1], [W - 24, -1]].forEach(([x0, dir]) => {
    const y0 = H - 40;
    const pop = fx.appendChild(Object.assign(document.createElement('span'), { className: 'fest-pop', textContent: '🎉' }));
    pop.style.transform = `translate(${x0}px, ${y0}px)${dir < 0 ? ' scaleX(-1)' : ''}`;
    pop.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.3)${dir < 0 ? ' scaleX(-1)' : ''}`, opacity: 0 },
      { transform: `translate(${x0}px, ${y0}px) scale(1.35)${dir < 0 ? ' scaleX(-1)' : ''}`, opacity: 1, offset: 0.25 },
      { transform: `translate(${x0}px, ${y0}px) scale(1)${dir < 0 ? ' scaleX(-1)' : ''}`, opacity: 1, offset: 0.7 },
      { transform: `translate(${x0}px, ${y0}px) scale(.9)${dir < 0 ? ' scaleX(-1)' : ''}`, opacity: 0 },
    ], { duration: 1400, easing: 'ease-out', fill: 'forwards' });
    for (let i = 0; i < 34; i += 1) {
      const c = fx.appendChild(document.createElement('span'));
      c.className = `fest-bit${i % 3 === 0 ? ' is-round' : ''}`;
      c.style.background = CONFETTI[i % CONFETTI.length];
      // Кут вильоту: угору й до середини екрана
      const a = rnd(55, 85) * (Math.PI / 180);
      const up = H * rnd(0.45, 0.8);
      const dx = Math.cos(a) * up * 0.75 * dir;
      const peakX = x0 + dx;
      const peakY = y0 - Math.sin(a) * up;
      const endX = peakX + rnd(-60, 60);
      const endY = peakY + rnd(H * 0.3, H * 0.55);
      const spin = rnd(360, 900) * (Math.random() < 0.5 ? -1 : 1);
      c.animate([
        { transform: `translate(${x0}px, ${y0}px) rotate(0deg) scale(.4)`, opacity: 1 },
        { transform: `translate(${peakX}px, ${peakY}px) rotate(${spin * 0.35}deg) rotateX(${rnd(90, 270)}deg) scale(1)`, opacity: 1, offset: 0.32 },
        { transform: `translate(${endX}px, ${endY}px) rotate(${spin}deg) rotateX(${rnd(360, 900)}deg) scale(.9)`, opacity: 0 },
      ], { duration: rnd(2200, 3200), delay: rnd(0, 140), easing: 'cubic-bezier(.12, .7, .4, 1)', fill: 'both' });
    }
  });
  setTimeout(() => fx.remove(), 3600);
}

// Лист розкрився: знизу спливають кульки, похитуючись, і зникають за верхнім краєм
export function balloons() {
  if (reduceMotion) return;
  const fx = layer();
  const W = innerWidth;
  const H = innerHeight;
  BALLOONS.forEach((color, i) => {
    const b = fx.appendChild(document.createElement('span'));
    b.className = 'fest-balloon';
    b.innerHTML = `<svg viewBox="0 0 40 70"><ellipse cx="20" cy="20" rx="17" ry="20" fill="${color}"/>`
      + '<ellipse cx="13" cy="12" rx="4" ry="6" fill="#fff" opacity=".45"/><path d="M17 39h6l-3 4z" fill="' + color + '"/>'
      + '<path d="M20 43c-4 7 4 12 0 19s3 6 0 8" fill="none" stroke="#9a8aa8" stroke-width="1.2"/></svg>';
    const size = rnd(0.8, 1.25);
    const x = (W / (BALLOONS.length + 1)) * (i + 1) + rnd(-18, 18) - 22;
    const sway = rnd(14, 26) * (i % 2 ? 1 : -1);
    const rise = H + 160;
    b.animate([
      { transform: `translate(${x}px, ${H + 20}px) scale(${size}) rotate(0deg)` },
      { transform: `translate(${x + sway}px, ${H + 20 - rise * 0.33}px) scale(${size}) rotate(${sway / 4}deg)`, offset: 0.33 },
      { transform: `translate(${x - sway}px, ${H + 20 - rise * 0.66}px) scale(${size}) rotate(${-sway / 4}deg)`, offset: 0.66 },
      { transform: `translate(${x + sway / 2}px, ${H + 20 - rise}px) scale(${size}) rotate(0deg)` },
    ], { duration: rnd(4200, 5600), delay: i * 160 + rnd(0, 200), easing: 'cubic-bezier(.35, .1, .55, 1)', fill: 'both' });
  });
  setTimeout(() => fx.remove(), 7200);
}
