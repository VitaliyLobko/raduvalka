// Гифка перед відправкою: підпис як у фото — вид, шрифт і колір (вкладки capStyle); пальцем тягнеться,
// двома — розмір і поворот. Гифку не перемальовуємо (canvas зʼїв би анімацію): підпис — шар поверх, на сервер іде
// його текст (шифрується, як завжди) і код місця в style
import { h, toast, ARROW, reduceMotion } from './ui.js';
import { captionHelper, captionField } from './maker.js';
import { media, gifFrame, freeCap, paintFree, freeCode, CAP_COLORS, stickLayer, paintSticks, stickCode, MAX_STICK, emojiKey } from './memes.js';
import { stickerRow, EMOJI_STICKERS, HANDLE_PATH, pawIcon } from './stickpick.js';
import { sampleColor } from './colorpick.js';
import { capStyle, histButtons } from './capstyle.js';

// gif — { url, title, w, h } з пошуку; send(caption, style, stick) — надіслати (кидає помилку — вікно лишається);
// stick — код наклейок-улюбленців (memes.js), вони теж шаром поверх живої гифки
export function gifEditor(gif, { send, fail, label = 'Отправить' }) {
  // ink — колір тексту на плашці, облачку, скотчі ('' — сам під тло)
  const cap = { look: 'below', color: 0, font: '', ink: '', x: 0.5, y: 0.8, k: 1, r: 0 };
  // crossOrigin — щоб піпетка могла прочитати кадр (Giphy віддає дозвіл); ставимо до src, інакше не діє
  const video = media(gif.url, 'Что отправляю');
  video.crossOrigin = 'anonymous';
  video.src = gif.url;
  let armed = false;
  const layer = freeCap({ ...cap, look: 'meme' }, '');
  layer.hidden = true;
  const frame = gifFrame(video, layer, gif.w && gif.h ? gif.w / gif.h : 0);
  // Наклейки: під підписом; обрана (sel ≥ 0) — її тягне палець, інакше палець тягне підпис
  const sticks = [];
  let sel = -1;
  const sLayer = stickLayer([]);
  sLayer.classList.add('is-edit');
  frame.insertBefore(sLayer, layer);
  const knob = h('span', { class: 'gif-handle', 'aria-hidden': 'true', hidden: true });
  knob.innerHTML = `<svg viewBox="0 0 24 24"><path d="${HANDLE_PATH}"/></svg>`;
  frame.append(knob);
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
    paintSticks(sLayer, sticks, sel);
    selBar.hidden = sel < 0;
    // Ручка — у правому нижньому куті обраної наклейки, а без неї — підпису; кут повертається разом з ними
    const o = sel >= 0 ? sticks[sel] : on ? cap : null;
    knob.hidden = !o;
    if (!o) return;
    // Відступ від краю росте разом з розміром — тоді ручка йде точно за пальцем
    const [hx, hy] = sel >= 0 ? Array(2).fill(`${o.k * 56}cqw`)
      : [`${layer.offsetWidth * o.k * 0.56}px`, `${layer.offsetHeight * o.k * 0.6}px`];
    const a = (o.r * Math.PI) / 180;
    const c = Math.cos(a).toFixed(4);
    const s = Math.sin(a).toFixed(4);
    knob.style.left = `calc(${o.x * 100}% + ${c} * ${hx} + ${(-s).toFixed(4)} * ${hy})`;
    knob.style.top = `calc(${o.y * 100}% + ${s} * ${hx} + ${c} * ${hy})`;
    knob.style.setProperty('--r', `${o.r}deg`);
  };
  const redraw = () => { if (!raf) raf = requestAnimationFrame(paint); };

  // ── Палець: один — тягне підпис, два — розмір і поворот (де б не торкнулись гифки) ──
  const ptrs = new Map();
  let g = null;
  let hd = null;
  const target =() => (sel >= 0 ? sticks[sel] : cap.look === 'below' ? null : cap);
  const gesture = () => {
    const pts = [...ptrs.values()];
    const r = frame.getBoundingClientRect();
    const o = target();
    if (!pts.length || !o || !r.width) { g = null; return; }
    if (pts.length === 1) g = { one: true, o, x: pts[0].x, y: pts[0].y, ix: o.x, iy: o.y, W: r.width, H: r.height };
    else {
      const [a, b] = pts;
      g = {
        one: false, o, d: Math.hypot(b.x - a.x, b.y - a.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x),
        mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ix: o.x, iy: o.y, k: o.k, r: o.r, W: r.width, H: r.height,
      };
    }
  };
  stage.addEventListener('pointerdown', (e) => {
    if (armed) { pickFrom(e); return; }
    // Ручка: один палець крутить і розтягує довкола центру обраного
    const o = target();
    if (!ptrs.size && o && e.target.closest?.('.gif-handle')) {
      const r = frame.getBoundingClientRect();
      const cx = r.left + o.x * r.width;
      const cy = r.top + o.y * r.height;
      hd = { id: e.pointerId, o, cx, cy, d: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, a: Math.atan2(e.clientY - cy, e.clientX - cx), k: o.k, r: o.r };
      try { stage.setPointerCapture(e.pointerId); } catch { /* синтетичний дотик */ }
      return;
    }
    // Перший палець обирає: на наклейці — її, повз — підпис (наклейка знімається з вибору)
    if (!ptrs.size) {
      const hit = e.target.closest?.('.gif-sticks [data-n]');
      const n = hit ? Number(hit.dataset.n) : -1;
      if (n !== sel) { sel = n; redraw(); }
    }
    try { stage.setPointerCapture(e.pointerId); } catch { /* синтетичний дотик */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture();
  });
  stage.addEventListener('pointermove', (e) => {
    if (hd && hd.id === e.pointerId) {
      const [lo, hi] = hd.o === cap ? [0.25, 8] : [0.06, 1.2];
      hd.o.k = Math.min(hi, Math.max(lo, (hd.k * Math.hypot(e.clientX - hd.cx, e.clientY - hd.cy)) / hd.d));
      hd.o.r = hd.r + ((Math.atan2(e.clientY - hd.cy, e.clientX - hd.cx) - hd.a) * 180) / Math.PI;
      redraw();
      return;
    }
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!g) return;
    const pts = [...ptrs.values()];
    const o = g.o;
    // Розмір: підпис — у разах від свого шрифту, наклейка — частка ширини кадру
    const [lo, hi] = o === cap ? [0.25, 8] : [0.06, 1.2];
    if (g.one && pts.length === 1) {
      o.x = Math.min(1, Math.max(0, g.ix + (pts[0].x - g.x) / g.W));
      o.y = Math.min(1, Math.max(0, g.iy + (pts[0].y - g.y) / g.H));
    } else if (!g.one && pts.length >= 2) {
      const [a, b] = pts;
      o.k = Math.min(hi, Math.max(lo, (g.k * Math.hypot(b.x - a.x, b.y - a.y)) / g.d));
      o.r = g.r + ((Math.atan2(b.y - a.y, b.x - a.x) - g.ang) * 180) / Math.PI;
      o.x = Math.min(1, Math.max(0, g.ix + ((a.x + b.x) / 2 - g.mx) / g.W));
      o.y = Math.min(1, Math.max(0, g.iy + ((a.y + b.y) / 2 - g.my) / g.H));
    }
    redraw();
  });
  const up = (e) => {
    if (hd?.id === e.pointerId) hd = null;
    if (ptrs.delete(e.pointerId)) gesture();
    if (!ptrs.size) commit();
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);

  // ── Підпис, вигляд і колір ──
  const caption = captionField();
  const style = capStyle({
    belowLabel: 'Под гифкой',
    onLook: (v) => { cap.look = v; sync(); },
    onFont: (v) => { cap.font = v; sync(); },
    onColor: (c) => { cap.color = c; sync(); },
    onInk: (c) => { cap.ink = typeof c === 'number' ? CAP_COLORS[c] : c; sync(); },
    onPipette: (t) => {
      armed = !armed;
      inkPick = t === 'text';
      if (armed) toast('Коснись гифки — возьму оттуда цвет');
      sync();
    },
  });
  // Піпетка бере колір тексту на плашці, а не саму плашку
  let inkPick = false;
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
    if (hex && inkPick) cap.ink = hex;
    else if (hex) cap.color = hex;
    else toast('Из этой гифки цвет не взять — выбери в 🎨');
    sync();
  }
  function sync() {
    const custom = typeof cap.color === 'string';
    style.paint({
      text: caption.value.trim(), look: cap.look, font: cap.font,
      color: custom ? cap.color : CAP_COLORS[cap.color], preset: custom ? -1 : cap.color,
      ink: cap.ink, inkPreset: CAP_COLORS.indexOf(cap.ink), armed,
    });
    stage.classList.toggle('is-pipette', armed);
    redraw();
    requestAnimationFrame(fit);
  }
  caption.addEventListener('input', sync);

  // ── Історія ↶ ↷: знімок підпису (вид, шрифт, колір, місце, розмір, поворот) після кожної завершеної дії
  const past = [];
  const future = [];
  const snap = () => JSON.stringify({ cap, sticks });
  let now = snap();
  function commit() {
    const k = snap();
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
    const v = JSON.parse(now);
    Object.assign(cap, v.cap);
    sticks.splice(0, sticks.length, ...v.sticks);
    sel = -1;
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
      await send(text, text && cap.look !== 'below' ? freeCode(cap) : null, stickCode(sticks));
      close();
    } catch (e) {
      go.disabled = false;
      toast(fail(e));
    }
  });

  // ── Наклейки-улюбленці: 🐾 у шапці відкриває рядок вибору; обрана — 🗑 і ⇆ над гифкою
  const addStick = (key, i, k) => {
    if (sticks.length >= MAX_STICK) { toast(`На гифку — не больше ${MAX_STICK} наклеек`); return; }
    const n = sticks.length;
    sticks.push({ key, i, x: 0.3 + (n % 3) * 0.2, y: 0.35 + (n % 2) * 0.15, k, r: 0, fx: false });
    sel = n;
    commit();
    redraw();
  };
  const { el: petRow } = stickerRow({
    onPet: (key, i) => addStick(key, i, 0.3),
    emojis: EMOJI_STICKERS,
    onEmoji: (s) => addStick(emojiKey(s), 0, 0.22),
  });
  const stickPanel = h('div', { class: 'ph-panel ph-panel-stick', hidden: true }, petRow);
  const tStick = petRow ? h('button', {
    type: 'button', class: 'ph-tool', 'aria-label': 'Наклейка', 'aria-pressed': 'false',
    onclick: () => { stickPanel.hidden = !stickPanel.hidden; tStick.setAttribute('aria-pressed', String(!stickPanel.hidden)); requestAnimationFrame(fit); },
  }, pawIcon()) : null;
  const selBar = h('div', { class: 'ph-sel', hidden: true },
    h('button', { type: 'button', class: 'mk-chip ph-icon ph-trash', 'aria-label': 'Убрать наклейку', onclick: () => { if (sel < 0) return; sticks.splice(sel, 1); sel = -1; commit(); redraw(); } }, '🗑'),
    h('button', { type: 'button', class: 'mk-chip ph-icon', 'aria-label': 'Отразить наклейку', onclick: () => { if (sel < 0) return; sticks[sel].fx = !sticks[sel].fx; commit(); redraw(); } }, '⇆'));
  stage.append(selBar);

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
    h('div', { class: 'ph-top' }, x, hUndo, hRedo, h('span', { class: 'ph-gap' }), tStick),
    stage,
    stickPanel,
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
