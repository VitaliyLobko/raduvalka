// Свій колір після готових кружків: 🎨 — системна палітра, піпетка — колір із самого фото чи гифки
import { h } from './ui.js';

const PIPETTE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>';

export const HEX = /^#[0-9a-f]{6}$/;

// onPick(hex) — вибрали в палітрі; onPipette() — увімкнути/вимкнути піпетку (колір бере сам редактор на дотик)
export function ownColor({ label, onPick, onPipette }) {
  const input = h('input', { type: 'color', class: 'ph-own-input', tabindex: '-1', 'aria-hidden': 'true' });
  input.addEventListener('input', () => onPick(input.value.toLowerCase()));
  const own = h('button', {
    type: 'button', class: 'ph-swatch ph-own', role: 'radio', 'aria-checked': 'false', 'aria-label': `${label}: свой цвет`,
    onclick: () => { try { input.showPicker(); } catch { input.click(); } },
  });
  const pip = h('button', {
    type: 'button', class: 'ph-swatch ph-pipette', 'aria-pressed': 'false', 'aria-label': 'Пипетка: взять цвет с картинки',
    html: PIPETTE, onclick: () => onPipette(),
  });
  // cur — поточний колір; preset — він із готових кружків; armed — піпетка чекає дотику
  const paint = (cur, preset, armed) => {
    own.setAttribute('aria-checked', String(!preset));
    if (preset) own.style.removeProperty('--c'); else { own.style.setProperty('--c', cur); input.value = cur; }
    pip.setAttribute('aria-pressed', String(!!armed));
  };
  return { el: h('span', { class: 'ph-own-wrap' }, own, input, pip), paint };
}

// Середній колір квадрата 5×5 навколо точки (x, y — пікселі полотна); полотно без дозволу на читання — null
export function sampleColor(ctx, x, y) {
  const s = 5;
  const cx = Math.max(0, Math.min(ctx.canvas.width - s, Math.round(x - s / 2)));
  const cy = Math.max(0, Math.min(ctx.canvas.height - s, Math.round(y - s / 2)));
  let d;
  try { d = ctx.getImageData(cx, cy, s, s).data; } catch { return null; }
  const sum = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; }
  const n = d.length / 4;
  return `#${sum.map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('')}`;
}
