// Свій колір після готових кружків: 🎨 — панель знизу (квадрат відтінку, веселка, HEX), піпетка — колір із самого фото чи гифки
import { h } from './ui.js';

const PIPETTE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>';

export const HEX = /^#[0-9a-f]{6}$/;

// HSV (h 0–360, s і v 0–1) ↔ #rrggbb
function toHex(hu, s, v) {
  const f = (n) => {
    const k = (n + hu / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
function toHsv(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let hu = 0;
  if (d) hu = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(hu * 60 + 360) % 360, max ? d / max : 0, max];
}

// Тягнути пальцем по смузі чи квадрату: f(x 0–1, y 0–1) на кожен рух, один раз за кадр
function drag(el, f) {
  let raf = 0;
  let last = null;
  const at = (e) => {
    const r = el.getBoundingClientRect();
    last = [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; f(...last); });
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* синтетичний дотик */ }
    at(e);
  });
  el.addEventListener('pointermove', (e) => { if (el.hasPointerCapture?.(e.pointerId)) at(e); });
}

// Панель вибору кольору знизу екрана. onInput(hex) — на кожну зміну (колір видно на фото одразу); onClose — «Готово»
let open = null;
export function openPalette({ value, label, onInput, onClose }) {
  open?.close();
  let [hu, s, v] = toHsv(HEX.test(value || '') ? value : '#ff4f8b');
  const preview = h('span', { class: 'cp-preview', 'aria-hidden': 'true' });
  const svDot = h('span', { class: 'cp-dot', 'aria-hidden': 'true' });
  const sv = h('div', { class: 'cp-sv', role: 'slider', 'aria-label': 'Насыщенность и яркость', tabindex: '0' }, svDot);
  const hueDot = h('span', { class: 'cp-dot cp-hue-dot', 'aria-hidden': 'true' });
  const hue = h('div', { class: 'cp-hue', role: 'slider', 'aria-label': 'Оттенок', 'aria-valuemin': '0', 'aria-valuemax': '360', tabindex: '0' }, hueDot);
  const hex = h('input', {
    class: 'cp-hex', type: 'text', inputmode: 'text', maxlength: '7', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Цвет в HEX',
  });
  const done = h('button', { type: 'button', class: 'btn btn-primary cp-done', onclick: () => close() }, 'Готово');
  const panel = h('div', { class: 'cp-panel', role: 'dialog', 'aria-label': label || 'Выбор цвета' },
    h('div', { class: 'cp-top' }, preview, sv),
    hue,
    h('div', { class: 'cp-row' }, h('label', { class: 'cp-hex-wrap' }, h('span', {}, 'HEX'), hex), done));

  const paint = (fromInput = false) => {
    const c = toHex(hu, s, v);
    sv.style.setProperty('--h', String(hu));
    panel.style.setProperty('--cur', c);
    svDot.style.left = `${s * 100}%`;
    svDot.style.top = `${(1 - v) * 100}%`;
    hueDot.style.left = `${(hu / 360) * 100}%`;
    hue.setAttribute('aria-valuenow', String(Math.round(hu)));
    if (!fromInput) hex.value = c;
    return c;
  };
  const emit = () => onInput(paint());
  drag(sv, (x, y) => { s = x; v = 1 - y; emit(); });
  drag(hue, (x) => { hu = Math.min(359.9, x * 360); emit(); });
  // Стрілки на клавіатурі — для тих, хто без пальця
  sv.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[e.key];
    if (!d) return;
    e.preventDefault();
    s = Math.min(1, Math.max(0, s + d[0]));
    v = Math.min(1, Math.max(0, v + d[1]));
    emit();
  });
  hue.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -6, ArrowRight: 6 }[e.key];
    if (!d) return;
    e.preventDefault();
    hu = (hu + d + 360) % 360;
    emit();
  });
  hex.addEventListener('input', () => {
    let t = hex.value.trim().toLowerCase();
    if (!t.startsWith('#')) t = `#${t}`;
    if (!HEX.test(t)) return;
    [hu, s, v] = toHsv(t);
    paint(true);
    onInput(t);
  });
  hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); close(); } });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    if (open !== api) return;
    open = null;
    document.removeEventListener('keydown', onKey);
    panel.remove();
    onClose?.();
  }
  const api = { close };
  open = api;
  paint();
  document.addEventListener('keydown', onKey);
  document.body.append(panel);
  return api;
}

// onPick(hex) — вибрали в панелі (на кожен рух); onDone — панель закрили; onPipette() — увімкнути/вимкнути піпетку
// Останні свої кольори (з 🎨 і піпетки) — на цьому телефоні, спільні для підпису, олівця й гифки; у ряду — два
const RECENT_KEY = 'radovalka:recent-colors';
let recent = null;
const recents = () => {
  if (!recent) {
    try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((c) => HEX.test(c)).slice(0, 3); } catch { recent = []; }
  }
  return recent;
};
const remember = (c) => {
  if (!HEX.test(c || '')) return;
  recent = [c, ...recents().filter((x) => x !== c)].slice(0, 3);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch { /* приватне вікно */ }
};

export function ownColor({ label, onPick, onPipette, onDone }) {
  let cur = '#ff4f8b';
  let mine = false;
  let armedNow = false;
  const own = h('button', {
    type: 'button', class: 'ph-swatch ph-own', role: 'radio', 'aria-checked': 'false', 'aria-label': `${label}: свой цвет`,
    onclick: () => openPalette({
      value: cur, label,
      onInput: (c) => { cur = c; onPick(c); },
      // Закрили панель — одна правка в історії ↶ (редактор знімає стан на change у своїй шторці)
      onClose: () => { remember(cur); own.dispatchEvent(new Event('change', { bubbles: true })); onDone?.(); drawRecent(); },
    }),
  });
  const pip = h('button', {
    type: 'button', class: 'ph-swatch ph-pipette', 'aria-pressed': 'false', 'aria-label': 'Пипетка: взять цвет с картинки',
    html: PIPETTE, onclick: () => onPipette(),
  });
  // Недавні — перед 🎨; той, що вже стоїть у 🎨, вдруге не показуємо
  const box = h('span', { class: 'ph-own-wrap' });
  let shown = '';
  const drawRecent = () => {
    const list = recents().filter((c) => !(mine && c === cur)).slice(0, 2);
    if (list.join() === shown) return;
    shown = list.join();
    box.replaceChildren(...list.map((c) => {
      const b = h('button', {
        type: 'button', class: 'ph-swatch ph-recent', role: 'radio', 'aria-checked': 'false', 'aria-label': `${label}: недавний ${c}`,
        onclick: () => { onPick(c); remember(c); b.dispatchEvent(new Event('change', { bubbles: true })); drawRecent(); },
      });
      b.style.setProperty('--c', c);
      return b;
    }));
  };
  // cur — поточний колір; preset — він із готових кружків; armed — піпетка чекає дотику
  const paint = (c, preset, armed) => {
    own.setAttribute('aria-checked', String(!preset));
    if (HEX.test(c || '')) cur = c;
    mine = !preset;
    if (preset) own.style.removeProperty('--c'); else own.style.setProperty('--c', c);
    pip.setAttribute('aria-pressed', String(!!armed));
    // Піпетка щойно взяла колір — він теж «недавній»
    if (armedNow && !armed && !preset) remember(cur);
    armedNow = !!armed;
    drawRecent();
  };
  drawRecent();
  return { el: h('span', { class: 'ph-own-wrap' }, box, own, pip), paint };
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
