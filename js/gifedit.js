// Гифка перед відправкою: підпис як у фото — «Под гифкой», «Мем», «Рукой», «Плашка», 5 кольорів; пальцем тягнеться,
// двома — розмір і поворот. Гифку не перемальовуємо (canvas зʼїв би анімацію): підпис — шар поверх, на сервер іде
// його текст (шифрується, як завжди) і код місця в style
import { h, toast, ARROW, ribbon, reduceMotion } from './ui.js';
import { captionHelper } from './maker.js';
import { media, gifFrame, freeCap, paintFree, freeCode, CAP_COLORS, CAP_COLOR_NAMES } from './memes.js';

const LOOKS = [
  { v: 'below', label: 'Под гифкой' },
  { v: 'meme', label: 'Мем' },
  { v: 'hand', label: 'Рукой' },
  { v: 'plate', label: 'Плашка' },
];

// gif — { url, title, w, h } з пошуку; send(caption, style) — надіслати (кидає помилку — вікно лишається)
export function gifEditor(gif, { send, fail, label = 'Отправить' }) {
  const cap = { look: 'below', color: 0, x: 0.5, y: 0.8, k: 1, r: 0 };
  const video = media(gif.url, 'Что отправляю', gif.url);
  const layer = freeCap({ ...cap, look: 'meme' }, '');
  layer.hidden = true;
  const frame = gifFrame(video, layer, gif.w && gif.h ? gif.w / gif.h : 0);
  const stage = h('div', { class: 'ph-stage gif-stage', 'aria-label': 'Гифка: подпись двигается пальцем, двумя — размер и поворот' }, frame);
  const belowLine = h('p', { class: 'ph-below', hidden: true });

  // Рамка — найбільша, що влазить у сцену з пропорціями гифки
  const fit = () => {
    const b = stage.getBoundingClientRect();
    const ar = Number(frame.style.getPropertyValue('--ar')) || 1;
    if (!b.width || !b.height) return;
    frame.style.width = `${Math.min(b.width, b.height * ar)}px`;
  };
  video.addEventListener('loadedmetadata', () => requestAnimationFrame(fit));

  let raf = 0;
  const paint = () => {
    raf = 0;
    const text = caption.value.trim();
    const on = cap.look !== 'below' && text;
    layer.hidden = !on;
    if (on) paintFree(layer, cap, text);
    belowLine.textContent = text;
    belowLine.hidden = cap.look !== 'below' || !text;
  };
  const redraw = () => { if (!raf) raf = requestAnimationFrame(paint); };

  // ── Палець: один — тягне підпис, два — розмір і поворот (де б не торкнулись гифки) ──
  const ptrs = new Map();
  let g = null;
  const gesture = () => {
    const pts = [...ptrs.values()];
    const r = frame.getBoundingClientRect();
    if (!pts.length || cap.look === 'below' || !r.width) { g = null; return; }
    if (pts.length === 1) g = { one: true, x: pts[0].x, y: pts[0].y, ix: cap.x, iy: cap.y, W: r.width, H: r.height };
    else {
      const [a, b] = pts;
      g = {
        one: false, d: Math.hypot(b.x - a.x, b.y - a.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x),
        mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ix: cap.x, iy: cap.y, k: cap.k, r: cap.r, W: r.width, H: r.height,
      };
    }
  };
  stage.addEventListener('pointerdown', (e) => {
    try { stage.setPointerCapture(e.pointerId); } catch { /* синтетичний дотик */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!g) return;
    const pts = [...ptrs.values()];
    if (g.one && pts.length === 1) {
      cap.x = Math.min(1, Math.max(0, g.ix + (pts[0].x - g.x) / g.W));
      cap.y = Math.min(1, Math.max(0, g.iy + (pts[0].y - g.y) / g.H));
    } else if (!g.one && pts.length >= 2) {
      const [a, b] = pts;
      cap.k = Math.min(8, Math.max(0.25, (g.k * Math.hypot(b.x - a.x, b.y - a.y)) / g.d));
      cap.r = g.r + ((Math.atan2(b.y - a.y, b.x - a.x) - g.ang) * 180) / Math.PI;
      cap.x = Math.min(1, Math.max(0, g.ix + ((a.x + b.x) / 2 - g.mx) / g.W));
      cap.y = Math.min(1, Math.max(0, g.iy + ((a.y + b.y) / 2 - g.my) / g.H));
    }
    redraw();
  });
  const up = (e) => { if (ptrs.delete(e.pointerId)) gesture(); };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);

  // ── Підпис, вигляд і колір ──
  const caption = h('input', {
    type: 'text', class: 'ph-caption', 'data-voice': true, maxlength: '300', enterkeyhint: 'send',
    placeholder: 'Подпись (можно без)', 'aria-label': 'Подпись',
  });
  const lookChips = LOOKS.map(({ v, label }) => h('button', {
    type: 'button', role: 'radio', class: 'mk-chip', 'data-v': v,
    onclick: () => { cap.look = v; sync(); },
  }, label));
  const colors = h('span', { class: 'ph-swatches', role: 'radiogroup', 'aria-label': 'Цвет подписи' },
    ...CAP_COLORS.map((c, i) => h('button', {
      type: 'button', class: 'ph-swatch', role: 'radio', style: `--c:${c}`, 'data-v': String(i), 'aria-label': CAP_COLOR_NAMES[i],
      onclick: () => { cap.color = i; sync(); },
    })));
  const looksRow = h('div', { class: 'mk-chips mk-row ph-looks', role: 'radiogroup', 'aria-label': 'Где и как подпись', hidden: true }, ...lookChips, colors);
  ribbon(looksRow);
  function sync() {
    looksRow.hidden = !caption.value.trim();
    lookChips.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === cap.look)));
    colors.hidden = cap.look === 'below';
    colors.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === String(cap.color))));
    redraw();
    requestAnimationFrame(fit);
  }
  caption.addEventListener('input', sync);
  caption.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
  const helper = captionHelper(caption, { about: gif.title || '', onPick: sync });

  // ── Відправка ──
  const go = h('button', { type: 'button', class: 'ph-send', 'aria-label': label, title: label, html: ARROW });
  go.addEventListener('click', async () => {
    if (go.disabled) return;
    go.disabled = true;
    try {
      const text = caption.value.trim();
      await send(text, text && cap.look !== 'below' ? freeCode(cap) : null);
      close();
    } catch (e) {
      go.disabled = false;
      toast(fail(e));
    }
  });

  const close = () => {
    ro.disconnect();
    document.documentElement.classList.remove('is-covered');
    sheet.remove();
  };
  const x = h('button', { type: 'button', class: 'sheet-close ph-close', 'aria-label': 'Закрыть', onclick: () => close() }, '✕');
  const sheet = h('div', { class: 'sheet sheet-full sheet-photo sheet-gif', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Новая гифка' },
    h('div', { class: 'ph-top' }, x, h('span', { class: 'ph-gap' })),
    stage,
    h('div', { class: 'ph-bottom' }, belowLine, looksRow, helper.el, h('div', { class: 'ph-send-row' }, caption, go)));
  const ro = new ResizeObserver(() => fit());
  document.body.append(sheet);
  ro.observe(stage);
  sync();
  fit();
  if (!reduceMotion) sheet.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  setTimeout(() => { if (sheet.isConnected) document.documentElement.classList.add('is-covered'); }, 220);
  helper.start();
}
