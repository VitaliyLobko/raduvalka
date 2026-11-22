// Гифка перед відправкою: підпис як у фото — вид, шрифт і колір (вкладки capStyle); пальцем тягнеться,
// двома — розмір і поворот. Гифку не перемальовуємо (canvas зʼїв би анімацію): підпис — шар поверх, на сервер іде
// його текст (шифрується, як завжди) і код місця в style
import { h, toast, ARROW, reduceMotion } from './ui.js';
import { captionHelper } from './maker.js';
import { media, gifFrame, freeCap, paintFree, freeCode, CAP_COLORS } from './memes.js';
import { sampleColor } from './colorpick.js';
import { capStyle, histButtons } from './capstyle.js';

// gif — { url, title, w, h } з пошуку; send(caption, style) — надіслати (кидає помилку — вікно лишається)
export function gifEditor(gif, { send, fail, label = 'Отправить' }) {
  const cap = { look: 'below', color: 0, font: '', x: 0.5, y: 0.8, k: 1, r: 0 };
  // crossOrigin — щоб піпетка могла прочитати кадр (Giphy віддає дозвіл); ставимо до src, інакше не діє
  const video = media(gif.url, 'Что отправляю');
  video.crossOrigin = 'anonymous';
  video.src = gif.url;
  let armed = false;
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
    if (armed) { pickFrom(e); return; }
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
  const up = (e) => { if (ptrs.delete(e.pointerId)) gesture(); if (!ptrs.size) commit(); };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);

  // ── Підпис, вигляд і колір ──
  const caption = h('input', {
    type: 'text', class: 'ph-caption', 'data-voice': true, maxlength: '300', enterkeyhint: 'send',
    placeholder: 'Подпись (можно без)', 'aria-label': 'Подпись',
  });
  const style = capStyle({
    belowLabel: 'Под гифкой',
    onLook: (v) => { cap.look = v; sync(); },
    onFont: (v) => { cap.font = v; sync(); },
    onColor: (c) => { cap.color = c; sync(); },
    onPipette: () => { armed = !armed; if (armed) toast('Коснись гифки — возьму оттуда цвет'); sync(); },
  });
  // Піпетка: поточний кадр у полотно розміром з рамку, колір під пальцем
  function pickFrom(e) {
    armed = false;
    const r = frame.getBoundingClientRect();
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(r.width));
    c.height = Math.max(1, Math.round(r.height));
    const cx = c.getContext('2d', { willReadFrequently: true });
    let hex = null;
    try { cx.drawImage(video, 0, 0, c.width, c.height); hex = sampleColor(cx, e.clientX - r.left, e.clientY - r.top); } catch { /* кадр ще не готовий */ }
    if (hex) cap.color = hex; else toast('Из этой гифки цвет не взять — выбери в 🎨');
    sync();
  }
  function sync() {
    const custom = typeof cap.color === 'string';
    style.paint({
      text: caption.value.trim(), look: cap.look, font: cap.font,
      color: custom ? cap.color : CAP_COLORS[cap.color], preset: custom ? -1 : cap.color, armed,
    });
    stage.classList.toggle('is-pipette', armed);
    redraw();
    requestAnimationFrame(fit);
  }
  caption.addEventListener('input', sync);

  // ── Історія ↶ ↷: знімок підпису (вид, шрифт, колір, місце, розмір, поворот) після кожної завершеної дії
  const past = [];
  const future = [];
  let now = JSON.stringify(cap);
  function commit() {
    const k = JSON.stringify(cap);
    if (k === now) return;
    past.push(now);
    if (past.length > 60) past.shift();
    future.length = 0;
    now = k;
    paintHistory();
  }
  const step = (from, to) => {
    if (!from.length) return;
    to.push(now);
    now = from.pop();
    Object.assign(cap, JSON.parse(now));
    sync();
    paintHistory();
  };
  const [hUndo, hRedo] = histButtons(() => step(past, future), () => step(future, past));
  function paintHistory() {
    hUndo.disabled = !past.length;
    hRedo.disabled = !future.length;
  }
  caption.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
  const helper = captionHelper(caption, { about: gif.title || '', onPick: sync });

  // ── Відправка ──
  // Не «Отправить» (у лист — прикласти): словами й скріпкою, щоб не плутати зі стрілкою відправки
  const go = label === 'Отправить' ? h('button', { type: 'button', class: 'ph-send', 'aria-label': label, title: label, html: ARROW })
    : h('button', { type: 'button', class: 'ph-send is-attach' }, '📎 ', label);
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
  // Фон — та сама гифка, сильно розмита (як у редакторі фото)
  const back = media(gif.url, '');
  back.classList.add('ph-backdrop');
  back.setAttribute('aria-hidden', 'true');
  const sheet = h('div', { class: 'sheet sheet-full sheet-photo sheet-gif', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Новая гифка' },
    back,
    h('div', { class: 'ph-top' }, x, hUndo, hRedo, h('span', { class: 'ph-gap' })),
    stage,
    h('div', { class: 'ph-bottom' }, belowLine, style.el, helper.el, h('div', { class: 'ph-send-row' }, caption, go)));
  const ro = new ResizeObserver(() => fit());
  sheet.addEventListener('click', (e) => { if (!e.target.closest('.ph-hist')) commit(); });
  sheet.addEventListener('change', commit);
  document.body.append(sheet);
  ro.observe(stage);
  sync();
  fit();
  if (!reduceMotion) sheet.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  setTimeout(() => { if (sheet.isConnected) document.documentElement.classList.add('is-covered'); }, 220);
}
