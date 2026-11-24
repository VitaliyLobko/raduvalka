// Фото перед відправкою: підпис і наклейки (смайли й улюбленці) тягнуться пальцем (двома — розмір і поворот), малювання,
// розмиття пальцем, рамка «Полароид», обрізка й поворот. Усе впікається в саму картинку — сервер і стрічка про це не знають.
// Без правок іде той самий файл, що й раніше; «Под фото» — звичайний підпис текстом під картинкою, як завжди
import { h, toast, ARROW, reduceMotion } from './ui.js';
import { captionHelper, captionField } from './maker.js';
import { stickerRow, EMOJI_STICKERS, HANDLE_PATH, pawIcon } from './stickpick.js';
import { ownColor, sampleColor } from './colorpick.js';
import { capStyle, histButtons } from './capstyle.js';
import { capFont, capFontCss, CAP_SIZE } from './memes.js';

const MAX_SIDE = 1280;
const MAX_BYTES = 1.25 * 1024 * 1024;
// Розмір шрифту — частка ширини кадру (для шрифту виду; свій шрифт — CAP_SIZE / f.k)
const SIZE ={ meme: 0.075, hand: 0.1, plate: 0.06, bubble: 0.06, tape: 0.09, neon: 0.11, emoji: 0.17 };
const FONTS = {
  meme: (s) => `700 ${s}px Rubik, system-ui, sans-serif`,
  hand: (s) => `400 ${s}px Caveat, 'Segoe Print', cursive`,
  plate: (s) => `600 ${s}px Rubik, system-ui, sans-serif`,
  bubble: (s) => `600 ${s}px Rubik, system-ui, sans-serif`,
  tape: (s) => `400 ${s}px Caveat, 'Segoe Print', cursive`,
  neon: (s) => `400 ${s}px Caveat, 'Segoe Print', cursive`,
  // Спершу свій векторний шрифт наклейок (fonts.css) — системні кольорові смайлики Android — картинки, при збільшенні миляться
  emoji: (s) => `${s}px 'Radovalka Emoji', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif`,
};
const COLORS = ['#ffffff', '#ff4f8b', '#ffcb3d', '#6fd3ff', '#2a1730'];
const COLOR_NAMES = ['белый', 'розовый', 'жёлтый', 'голубой', 'тёмный'];
// Рамка «Полароид»: поля — частки ширини фото; низ ширший — під підпис і дату
const FRAME = { side: 0.05, bottom: 0.22, paper: '#fbf8f3', ink: '#2a1730', soft: '#8a7a90' };
// Пензель розмиття — частка ширини кадру; розмите фото — зменшене до BLUR_PX і розтягнуте назад (номерів не прочитати)
const BLUR_W = 0.075;
const BLUR_PX = 56;
const HANDLE_SHAPE = new Path2D(HANDLE_PATH);

const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
const light = (hex) => lum(hex) > 0.6;
const toBlob = (c, type, q) => new Promise((ok) => c.toBlob(ok, type, q));

// Рукописні види — щільніші рядки; поля навколо тексту — частка розміру шрифту
const SCRIPT = new Set(['hand', 'tape', 'neon']);
const PAD = { plate: 0.45, bubble: 0.6, tape: 0.55 };
const ink = (c) => (light(c) ? '#2a1730' : '#ffffff');
const rrect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
};

// Рядки під ширину: по словах, задовге слово — як є
function wrap(ctx, text, max) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > max) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}

// Підпис чи наклейка: розкладка рядків, розмір рамки (для влучання пальцем) і малювання в її власних координатах
function layout(ctx, it) {
  if (it.look === 'pet') { it.box = { w: it.size, h: it.size }; return null; }
  const f = it.look !== 'emoji' && capFont(it.font);
  ctx.font = f ? capFontCss(f, `${it.size}px`) : FONTS[it.look](it.size);
  // Мем — великими, але прописи великими не читаються
  const caps = it.look === 'meme' && (!f || f.caps);
  const lines = it.look === 'emoji' ? [it.text] : wrap(ctx, caps ? it.text.toUpperCase() : it.text, it.wrap);
  const lh = it.size * (f ? f.lh : SCRIPT.has(it.look) ? 1.05 : 1.15);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width), it.size * 0.6);
  const pad = it.size * (PAD[it.look] || 0);
  it.box = { w: w + pad * 2, h: lines.length * lh + pad * 1.2 };
  return { lines, lh, w, pad };
}
// Улюбленець — кружечок з білою облямівкою і тінню
function drawPet(ctx, it) {
  const r = it.size / 2;
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate(it.rot);
  ctx.scale(it.k * (it.fx || 1), it.k * (it.fy || 1));
  ctx.shadowColor = 'rgba(0, 0, 0, .4)';
  ctx.shadowBlur = r * 0.18;
  ctx.shadowOffsetY = r * 0.05;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.clip();
  if (it.img?.naturalWidth) ctx.drawImage(it.img, -r * 0.92, -r * 0.92, r * 1.84, r * 1.84);
  ctx.restore();
}
// Облачко з хвостиком униз-ліворуч (fx/fy переносять його); обвідку малюємо під заливкою — шва між хвостиком і тілом нема
function drawBubble(ctx, it, bw, bh) {
  const sx = it.fx || 1;
  const sy = it.fy || 1;
  const tail = () => {
    ctx.beginPath();
    ctx.moveTo(sx * -bw * 0.3, sy * bh * 0.3);
    ctx.lineTo(sx * -bw * 0.38, sy * (bh / 2 + it.size * 0.85));
    ctx.lineTo(sx * -bw * 0.06, sy * bh * 0.3);
    ctx.closePath();
  };
  const body = () => rrect(ctx, -bw / 2, -bh / 2, bw, bh, Math.min(bh / 2, it.size * 1.1));
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = it.size * 0.18;
  ctx.strokeStyle = ink(it.color);
  ctx.shadowColor = 'rgba(0, 0, 0, .35)';
  ctx.shadowBlur = it.size * 0.3;
  ctx.shadowOffsetY = it.size * 0.06;
  body(); ctx.stroke();
  tail(); ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = it.color;
  body(); ctx.fill();
  tail(); ctx.fill();
  ctx.restore();
}
// Смужка напівпрозорого скотчу з рваними кінцями і відблиском зверху
function drawTape(ctx, it, bw, bh) {
  const t = it.size * 0.16;
  const n = Math.max(4, Math.round(bh / (it.size * 0.28)));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-bw / 2, -bh / 2);
  ctx.lineTo(bw / 2, -bh / 2);
  for (let i = 1; i < n; i++) ctx.lineTo(bw / 2 + (i % 2 ? t : 0), -bh / 2 + (bh * i) / n);
  ctx.lineTo(bw / 2, bh / 2);
  ctx.lineTo(-bw / 2, bh / 2);
  for (let i = n - 1; i > 0; i--) ctx.lineTo(-bw / 2 - (i % 2 ? t : 0), -bh / 2 + (bh * i) / n);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0, 0, 0, .3)';
  ctx.shadowBlur = it.size * 0.25;
  ctx.shadowOffsetY = it.size * 0.05;
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = it.color;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255, 255, 255, .22)';
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh * 0.3);
  ctx.restore();
}
// Неон: кольорове сяйво в два шари, кольорова обвідка і світла серцевина; темний колір — навпаки, біле сяйво
function drawNeon(ctx, it, text, lines, y0, lh) {
  const dark = lum(it.color) < 0.22;
  const glow = dark ? '#ffffff' : it.color;
  ctx.shadowColor = glow;
  ctx.fillStyle = glow;
  for (const b of [0.9, 0.4]) { ctx.shadowBlur = it.size * b; text(); }
  ctx.shadowBlur = it.size * 0.12;
  ctx.lineJoin = 'round';
  ctx.lineWidth = it.size * 0.07;
  ctx.strokeStyle = glow;
  lines.forEach((l, i) => ctx.strokeText(l, 0, y0 + i * lh));
  ctx.fillStyle = dark ? it.color : '#ffffff';
  text();
}
function drawItem(ctx, it) {
  if (it.look === 'pet') { layout(ctx, it); drawPet(ctx, it); return; }
  const { lines, lh, w, pad } = layout(ctx, it);
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate(it.rot);
  // Дзеркалимо лише смайлик; в облачку fx/fy повертають тільки хвостик, текст лишається читабельним
  const m = it.look === 'emoji';
  ctx.scale(it.k * (m && it.fx || 1), it.k * (m && it.fy || 1));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const y0 = -(lines.length * lh) / 2 + lh / 2;
  const bw = w + pad * 2;
  const bh = lines.length * lh + pad * 1.2;
  const text = () => lines.forEach((l, i) => ctx.fillText(l, 0, y0 + i * lh));
  if (it.look === 'bubble') {
    drawBubble(ctx, it, bw, bh);
    ctx.fillStyle = it.ink || ink(it.color);
    text();
  } else if (it.look === 'tape') {
    ctx.rotate(-0.05);
    drawTape(ctx, it, bw, bh);
    ctx.fillStyle = it.ink || ink(it.color);
    text();
  } else if (it.look === 'neon') {
    drawNeon(ctx, it, text, lines, y0, lh);
  } else if (it.look === 'plate') {
    ctx.fillStyle = it.color;
    rrect(ctx, -bw / 2, -bh / 2, bw, bh, it.size * 0.4);
    ctx.fill();
    ctx.fillStyle = it.ink || ink(it.color);
    text();
  } else if (it.look === 'meme') {
    ctx.lineJoin = 'round';
    ctx.lineWidth = it.size * 0.16;
    ctx.strokeStyle = light(it.color) ? '#000000' : '#ffffff';
    ctx.fillStyle = it.color;
    lines.forEach((l, i) => { ctx.strokeText(l, 0, y0 + i * lh); ctx.fillText(l, 0, y0 + i * lh); });
  } else {
    // Рукописний і смайлик — з легкою тінню, щоб читались на будь-якому фото
    ctx.shadowColor = 'rgba(0, 0, 0, .45)';
    ctx.shadowBlur = it.size * 0.12;
    ctx.shadowOffsetY = it.size * 0.03;
    ctx.fillStyle = it.color;
    lines.forEach((l, i) => ctx.fillText(l, 0, y0 + i * lh));
  }
  ctx.restore();
}
function drawStroke(ctx, s) {
  const p = s.pts;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  if (p.length === 2) ctx.lineTo(p[0] + 0.01, p[1]);
  // Плавно: через середини між точками
  for (let i = 2; i < p.length - 2; i += 2) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
  if (p.length > 2) ctx.lineTo(p[p.length - 2], p[p.length - 1]);
  ctx.stroke();
}

// Сьогоднішня дата для рамки: «22 ноября 2026»
const today = () => new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.?$/, '');

// Низ «Полароида»: рукописний підпис (довгий — менше, далі з «…») і дата під ним
function drawFoot(ctx, x0, y0, w, hh, text) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = x0 + w / 2;
  const max = w * 0.92;
  if (text) {
    let s = w * 0.075;
    ctx.font = FONTS.hand(s);
    while (ctx.measureText(text).width > max && s > w * 0.05) { s *= 0.94; ctx.font = FONTS.hand(s); }
    let t = text;
    while (t.length > 1 && ctx.measureText(t).width > max) t = `${t.slice(0, -2).trimEnd()}…`;
    ctx.fillStyle = FRAME.ink;
    ctx.fillText(t, cx, y0 + hh * 0.42);
    ctx.font = FONTS.hand(w * 0.045);
    ctx.fillStyle = FRAME.soft;
    ctx.fillText(today(), cx, y0 + hh * 0.78);
  } else {
    ctx.font = FONTS.hand(w * 0.06);
    ctx.fillStyle = FRAME.soft;
    ctx.fillText(today(), cx, y0 + hh * 0.5);
  }
}

// blob — уже стиснуте фото (prepare); send(out, caption) — надіслати (кидає помилку — вікно лишається);
// fail(e) — текст помилки; image() — зменшене фото для ШІ-підписів; cancel() — закрили хрестиком, нічого не надіславши
export async function photoEditor(blob, { send, fail, image, label = 'Отправить', cancel }) {
  let base;
  try { base = await createImageBitmap(blob); } catch { toast('Эту картинку открыть не получилось'); return; }

  // ── Модель: поворот чвертями за годинниковою, кадр (у координатах повернутого фото), підписи/наклейки, лінії ──
  let turns = 0;
  let crop = null;
  const items = [];
  const strokes = [];
  let capItem = null;
  let look = 'below';
  let color = COLORS[0];
  // Колір тексту на плашці, облачку, скотчі; '' — сам під тло
  let capInk = '';
  let font = '';
  let drawColor = COLORS[1];
  let pipette = null;
  let sel = null;
  let mode = 'move';
  // Ручка обраного (координати фото, рахує відмальовка) і її жест: один палець — розмір і поворот довкола центру
  let handle = null;
  let hd = null;
  let tmpCrop = null;
  let frame = false;
  // Віддзеркалення фото — у координатах уже повернутого фото, поверх повороту
  let flipX = false;
  let flipY = false;
  const rw = () => (turns % 2 ? base.height : base.width);
  const rh = () => (turns % 2 ? base.width : base.height);
  const view = () => (mode === 'crop' ? { x: 0, y: 0, w: rw(), h: rh() } : crop || { x: 0, y: 0, w: rw(), h: rh() });
  const edited = () => turns || flipX || flipY || crop || strokes.length || items.length || frame;
  // Підпис чи колір — для тексту; смайл і улюбленець кольору не мають
  const textual = (it) => it && it.look !== 'emoji' && it.look !== 'pet';
  const sticker = (it) => it && (it.look === 'emoji' || it.look === 'pet');
  // Облачку ⇆ ⇅ переносять хвостик
  const mirrorable = (it) => sticker(it) || it?.look === 'bubble';

  // Фото з поворотом і віддзеркаленням — у координатах повернутого фото
  function drawBase(ctx) {
    ctx.save();
    const W = rw();
    const H = rh();
    if (flipX) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    if (flipY) { ctx.translate(0, H); ctx.scale(1, -1); }
    if (turns === 1) { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); }
    if (turns === 2) { ctx.translate(W, H); ctx.rotate(Math.PI); }
    if (turns === 3) { ctx.translate(0, H); ctx.rotate(-Math.PI / 2); }
    ctx.drawImage(base, 0, 0);
    ctx.restore();
  }
  // Розмите фото рахуємо раз на поворот: зменшили до BLUR_PX і трохи пом'якшили
  let blurCache = null;
  function blurred() {
    const key = `${turns}${+flipX}${+flipY}`;
    if (blurCache?.key === key) return blurCache.c;
    const k = BLUR_PX / Math.max(rw(), rh());
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(rw() * k));
    small.height = Math.max(1, Math.round(rh() * k));
    const sx = small.getContext('2d');
    sx.scale(k, k);
    drawBase(sx);
    const soft = document.createElement('canvas');
    soft.width = small.width * 4;
    soft.height = small.height * 4;
    const mx = soft.getContext('2d');
    mx.imageSmoothingQuality = 'high';
    if ('filter' in mx) mx.filter = 'blur(3px)';
    mx.drawImage(small, 0, 0, soft.width, soft.height);
    blurCache = { key, c: soft };
    return soft;
  }
  // Мазки розмиття — маска на окремому шарі, крізь неї проступає розмите фото
  let layer = null;
  function drawBlur(ctx, sc, v, ox, oy) {
    const list = strokes.filter((s) => s.blur);
    if (!list.length) return;
    layer ||= document.createElement('canvas');
    if (layer.width !== ctx.canvas.width) layer.width = ctx.canvas.width;
    if (layer.height !== ctx.canvas.height) layer.height = ctx.canvas.height;
    const lc = layer.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, layer.width, layer.height);
    lc.setTransform(sc, 0, 0, sc, ox - v.x * sc, oy - v.y * sc);
    list.forEach((s) => drawStroke(lc, s));
    lc.globalCompositeOperation = 'source-in';
    lc.imageSmoothingEnabled = true;
    lc.imageSmoothingQuality = 'high';
    lc.drawImage(blurred(), 0, 0, rw(), rh());
    lc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }

  // Одна відмальовка і для екрана, і для файла: sc — пікселів на піксель фото; ox, oy — зсув фото в полотні (рамка)
  function render(ctx, sc, v, preview = false, ox = 0, oy = 0) {
    ctx.setTransform(sc, 0, 0, sc, ox - v.x * sc, oy - v.y * sc);
    drawBase(ctx);
    const W = rw();
    const H = rh();
    drawBlur(ctx, sc, v, ox, oy);
    strokes.forEach((s) => { if (!s.blur) drawStroke(ctx, s); });
    items.forEach((it) => drawItem(ctx, it));
    if (!preview) return;
    if (sel && mode === 'move') {
      ctx.save();
      ctx.translate(sel.x, sel.y);
      ctx.rotate(sel.rot);
      ctx.scale(sel.k, sel.k);
      ctx.setLineDash([8 / sc / sel.k, 6 / sc / sel.k]);
      ctx.lineWidth = 2 / sc / sel.k;
      ctx.strokeStyle = '#fff';
      ctx.shadowColor = 'rgba(0, 0, 0, .6)';
      ctx.shadowBlur = 3 / sc;
      const m = 8 / sc / sel.k;
      ctx.strokeRect(-sel.box.w / 2 - m, -sel.box.h / 2 - m, sel.box.w + m * 2, sel.box.h + m * 2);
      ctx.restore();
      // Ручка в правому нижньому куті рамки: радіус — 14 css-пікселів за будь-якого масштабу фото
      const cx = (sel.box.w / 2 + m) * sel.k;
      const cy = (sel.box.h / 2 + m) * sel.k;
      const c = Math.cos(sel.rot);
      const s = Math.sin(sel.rot);
      const R = (14 * (canvas.width / parseFloat(canvas.style.width) || 1)) / sc;
      handle = { x: sel.x + cx * c - cy * s, y: sel.y + cx * s + cy * c };
      ctx.save();
      ctx.translate(handle.x, handle.y);
      ctx.shadowColor = 'rgba(0, 0, 0, .45)';
      ctx.shadowBlur = 6 / sc;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.rotate(sel.rot);
      ctx.scale(R / 13, R / 13);
      ctx.translate(-12, -12);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#4A2545';
      ctx.stroke(HANDLE_SHAPE);
      ctx.restore();
    } else handle = null;
    if (mode === 'crop' && tmpCrop) {
      const c = tmpCrop;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, .55)';
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.rect(c.x, c.y, c.w, c.h);
      ctx.fill('evenodd');
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / sc;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      // Ручки в кутах — трохи всередині рамки, щоб не зрізались краєм полотна; сітка третин — легко вирівняти
      ctx.lineWidth = 1 / sc;
      ctx.strokeStyle = 'rgba(255, 255, 255, .45)';
      ctx.beginPath();
      for (const t of [1 / 3, 2 / 3]) {
        ctx.moveTo(c.x + c.w * t, c.y); ctx.lineTo(c.x + c.w * t, c.y + c.h);
        ctx.moveTo(c.x, c.y + c.h * t); ctx.lineTo(c.x + c.w, c.y + c.h * t);
      }
      ctx.stroke();
      const L = 26 / sc;
      const i = 3 / sc;
      ctx.lineWidth = 6 / sc;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#fff';
      ctx.shadowColor = 'rgba(0, 0, 0, .55)';
      ctx.shadowBlur = 4 / sc;
      for (const [cx, cy, dx, dy] of [[c.x, c.y, 1, 1], [c.x + c.w, c.y, -1, 1], [c.x, c.y + c.h, 1, -1], [c.x + c.w, c.y + c.h, -1, -1]]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * (i + L), cy + dy * i);
        ctx.lineTo(cx + dx * i, cy + dy * i);
        ctx.lineTo(cx + dx * i, cy + dy * (i + L));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Поворот на 90° за годинниковою: усе, що вже на фото, їде разом з ним
  function turn() {
    const H = rh();
    const mv = (x, y) => [H - y, x];
    for (const it of items) { [it.x, it.y] = mv(it.x, it.y); it.rot += Math.PI / 2; }
    for (const s of strokes) for (let i = 0; i < s.pts.length; i += 2) [s.pts[i], s.pts[i + 1]] = mv(s.pts[i], s.pts[i + 1]);
    const r = (c) => (c ? { x: H - (c.y + c.h), y: c.x, w: c.h, h: c.w } : null);
    crop = r(crop);
    tmpCrop = r(tmpCrop);
    turns = (turns + 1) % 4;
    // Поворот після дзеркала = дзеркало по іншій осі після повороту
    [flipX, flipY] = [flipY, flipX];
  }
  // Віддзеркалити фото: наклейки, лінії й кадр переїжджають дзеркально, самі наклейки не перевертаються (текст читається)
  function flip(horizontal) {
    const W = rw();
    const H = rh();
    for (const it of items) {
      if (horizontal) it.x = W - it.x; else it.y = H - it.y;
      it.rot = -it.rot;
      // Хвостик облачка дивиться туди ж, куди й раніше, — на того, хто «говорить»
      if (it.look === 'bubble') { const a = horizontal ? 'fx' : 'fy'; it[a] = -(it[a] || 1); }
    }
    for (const s of strokes) for (let i = horizontal ? 0 : 1; i < s.pts.length; i += 2) s.pts[i] = (horizontal ? W : H) - s.pts[i];
    const m = (c) => (!c ? null : horizontal ? { ...c, x: W - (c.x + c.w) } : { ...c, y: H - (c.y + c.h) });
    crop = m(crop);
    tmpCrop = m(tmpCrop);
    if (horizontal) flipX = !flipX; else flipY = !flipY;
  }

  // ── Екран ──
  const canvas = h('canvas', { class: 'ph-canvas', 'aria-label': 'Фото: подпись и наклейки двигаются пальцем, двумя — размер и поворот' });
  const ctx = canvas.getContext('2d');
  const belowLine = h('p', { class: 'ph-below', hidden: true });
  // «Полароид» на екрані — картка довкола полотна; у файлі те саме малює drawFoot
  const footCap = h('p', { class: 'ph-card-cap' });
  const footDate = h('p', { class: 'ph-card-date' }, today());
  const card = h('div', { class: 'ph-card' }, canvas, h('div', { class: 'ph-card-foot', 'aria-hidden': 'true' }, footCap, footDate));
  const stage = h('div', { class: 'ph-stage' }, card);
  let raf = 0;
  const paint = () => {
    raf = 0;
    const v = view();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    render(ctx, canvas.width / v.w, v, true);
  };
  const redraw = () => { if (!raf) raf = requestAnimationFrame(paint); };
  // Шрифт наклейок вантажиться лише тут (50 КБ); доїхав — перемальовуємо, щоб смайлики стали векторними
  document.fonts?.load("40px 'Radovalka Emoji'", '😍').then(redraw, () => {});
  // Полотно — найбільше, що влазить у сцену з пропорціями кадру
  const fit = () => {
    const b = stage.getBoundingClientRect();
    if (!b.width || !b.height) return;
    const v = view();
    const a = v.w / v.h;
    // У рамці фото менше: поля з боків і зверху, ширший низ
    const fr = frame && mode !== 'crop';
    const fs = fr ? FRAME.side : 0;
    const fb = fr ? FRAME.bottom : 0;
    const cw = Math.min(b.width / (1 + 2 * fs), b.height / (1 / a + fs + fb));
    const ch = cw / a;
    const dpr = Math.min(2, devicePixelRatio || 1);
    card.classList.toggle('is-frame', fr);
    card.style.setProperty('--fs', `${cw * fs}px`);
    card.style.setProperty('--fb', `${cw * fb}px`);
    card.style.setProperty('--cw', `${cw}px`);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    paint();
  };
  const fonts = Promise.all(['700 40px Rubik', '600 40px Rubik', '400 40px Caveat'].map((f) => document.fonts?.load(f))).catch(() => {});
  fonts.then(redraw);

  // Палець → координати фото
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    const v = view();
    return { x: v.x + ((e.clientX - r.left) / r.width) * v.w, y: v.y + ((e.clientY - r.top) / r.height) * v.h, per: v.w / r.width };
  };
  const hit = (p) => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const it = items[i];
      if (!it.box) layout(ctx, it);
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      const c = Math.cos(-it.rot);
      const s = Math.sin(-it.rot);
      const lx = (dx * c - dy * s) / it.k;
      const ly = (dx * s + dy * c) / it.k;
      const m = (16 * p.per) / it.k;
      if (Math.abs(lx) <= it.box.w / 2 + m && Math.abs(ly) <= it.box.h / 2 + m) return it;
    }
    return null;
  };

  const ptrs = new Map();
  let g = null;
  const gesture = () => {
    const pts = [...ptrs.values()];
    if (!sel || !pts.length) { g = null; return; }
    if (pts.length === 1) g = { one: true, x: pts[0].x, y: pts[0].y, ix: sel.x, iy: sel.y };
    else {
      const [a, b] = pts;
      g = {
        one: false, d: Math.hypot(b.x - a.x, b.y - a.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x),
        mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ix: sel.x, iy: sel.y, k: sel.k, rot: sel.rot,
      };
    }
  };
  let cropDrag = null;
  let stroke = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas) return;
    if (pipette) {
      // Колір того, що видно під пальцем: фото разом із наклейками
      const r = canvas.getBoundingClientRect();
      const hex = sampleColor(ctx, ((e.clientX - r.left) * canvas.width) / r.width, ((e.clientY - r.top) * canvas.height) / r.height);
      const k = pipette;
      pipette = null;
      if (hex) ({ cap: setCapColor, ink: setCapInk, draw: setDrawColor })[k](hex); else paintTools();
      return;
    }
    try { canvas.setPointerCapture(e.pointerId); } catch { /* синтетичний дотик */ }
    const p = at(e);
    if (mode === 'draw' || mode === 'blur') {
      if (stroke) return;
      const blur = mode === 'blur';
      stroke = { blur, color: blur ? '#000000' : drawColor, width: view().w * (blur ? BLUR_W : 0.012), pts: [p.x, p.y], id: e.pointerId };
      strokes.push(stroke);
      paintTools();
      redraw();
      return;
    }
    if (mode === 'crop') {
      const c = tmpCrop;
      const r = 30 * p.per;
      const corner = [[c.x, c.y, 'nw'], [c.x + c.w, c.y, 'ne'], [c.x, c.y + c.h, 'sw'], [c.x + c.w, c.y + c.h, 'se']]
        .find(([cx, cy]) => Math.hypot(p.x - cx, p.y - cy) <= r);
      const inside = p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h;
      cropDrag = corner || inside ? { k: corner?.[2] || 'move', x: p.x, y: p.y, c: { ...c } } : null;
      return;
    }
    if (!ptrs.size && sel && handle && Math.hypot(p.x - handle.x, p.y - handle.y) <= 24 * p.per) {
      hd = { id: e.pointerId, d: Math.hypot(p.x - sel.x, p.y - sel.y) || 1, a: Math.atan2(p.y - sel.y, p.x - sel.x), k: sel.k, rot: sel.rot };
      return;
    }
    ptrs.set(e.pointerId, p);
    if (ptrs.size === 1) {
      sel = hit(p);
      // Шар не міняємо від дотику — лише кнопками «Выше» / «Ниже»
      paintTools();
    }
    gesture();
    redraw();
  });
  stage.addEventListener('pointermove', (e) => {
    const p = at(e);
    if (mode === 'draw' || mode === 'blur') {
      if (!stroke || stroke.id !== e.pointerId) return;
      stroke.pts.push(p.x, p.y);
      redraw();
      return;
    }
    if (mode === 'crop') {
      if (!cropDrag) return;
      const { c, k } = cropDrag;
      const dx = p.x - cropDrag.x;
      const dy = p.y - cropDrag.y;
      const W = rw();
      const H = rh();
      const min = Math.max(W, H) * 0.12;
      let { x, y, w, h: hh } = c;
      if (k === 'move') {
        x = Math.min(Math.max(0, c.x + dx), W - c.w);
        y = Math.min(Math.max(0, c.y + dy), H - c.h);
      } else {
        if (k.includes('w')) { x = Math.min(Math.max(0, c.x + dx), c.x + c.w - min); w = c.x + c.w - x; }
        if (k.includes('e')) w = Math.min(Math.max(min, c.w + dx), W - c.x);
        if (k.includes('n')) { y = Math.min(Math.max(0, c.y + dy), c.y + c.h - min); hh = c.y + c.h - y; }
        if (k.includes('s')) hh = Math.min(Math.max(min, c.h + dy), H - c.y);
      }
      tmpCrop = { x, y, w, h: hh };
      redraw();
      return;
    }
    if (hd && hd.id === e.pointerId && sel) {
      sel.k = Math.min(8, Math.max(0.25, (hd.k * Math.hypot(p.x - sel.x, p.y - sel.y)) / hd.d));
      sel.rot = hd.rot + Math.atan2(p.y - sel.y, p.x - sel.x) - hd.a;
      redraw();
      return;
    }
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, p);
    if (!sel || !g) return;
    const pts = [...ptrs.values()];
    if (g.one && pts.length === 1) {
      sel.x = g.ix + (p.x - g.x);
      sel.y = g.iy + (p.y - g.y);
    } else if (!g.one && pts.length >= 2) {
      const [a, b] = pts;
      sel.k = Math.min(8, Math.max(0.25, (g.k * Math.hypot(b.x - a.x, b.y - a.y)) / g.d));
      sel.rot = g.rot + Math.atan2(b.y - a.y, b.x - a.x) - g.ang;
      sel.x = g.ix + (a.x + b.x) / 2 - g.mx;
      sel.y = g.iy + (a.y + b.y) / 2 - g.my;
    }
    redraw();
  });
  const up = (e) => {
    if (stroke?.id === e.pointerId) stroke = null;
    cropDrag = null;
    if (hd?.id === e.pointerId) hd = null;
    if (ptrs.delete(e.pointerId)) gesture();
    if (!ptrs.size) commit();
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);

  // ── Підпис ──
  const caption = captionField();
  const v0 = () => view();
  const syncCaption = () => {
    const text = caption.value.trim();
    belowLine.textContent = text;
    // У рамці «Под фото» пишеться в самій рамці
    belowLine.hidden = look !== 'below' || !text || frame;
    footCap.textContent = look === 'below' ? text : '';
    const onPhoto = look !== 'below' && text;
    if (!onPhoto) {
      if (capItem) { items.splice(items.indexOf(capItem), 1); if (sel === capItem) sel = null; capItem = null; }
    } else {
      const v = v0();
      if (!capItem) {
        capItem = { x: v.x + v.w / 2, y: v.y + v.h * 0.8, k: 1, rot: 0, color, ink: capInk, wrap: v.w * 0.86 };
        items.push(capItem);
      }
      const f = capFont(font);
      Object.assign(capItem, { text, look, font, size: v.w * (f ? CAP_SIZE[look] / f.k : SIZE[look]) });
      capItem.box = null;
    }
    paintTools();
    requestAnimationFrame(fit);
  };
  // Свій шрифт canvas сам не довантажить — малював би запасним; вантажимо саме ті літери, що в підписі
  const loadFont = () => {
    const f = capFont(font);
    if (!f || !document.fonts) return Promise.resolve();
    return document.fonts.load(capFontCss(f, '40px'), caption.value.trim() || 'Аа')
      .then(() => { if (capItem) capItem.box = null; redraw(); })
      .catch(() => {});
  };
  caption.addEventListener('input', () => { syncCaption(); loadFont(); });
  caption.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });

  const swatch = (c, i, pick) => h('button', {
    type: 'button', class: 'ph-swatch', role: 'radio', style: `--c:${c}`, 'data-v': c, 'aria-label': COLOR_NAMES[i], onclick: () => pick(c),
  });
  const setCapColor = (x) => {
    color = x;
    const target = textual(sel) ? sel : capItem;
    if (target) target.color = x;
    paintTools();
    redraw();
  };
  const setCapInk = (x) => {
    capInk = x;
    const target = textual(sel) ? sel : capItem;
    if (target) target.ink = x;
    paintTools();
    redraw();
  };
  const setDrawColor = (x) => { drawColor = x; paintTools(); };
  // Піпетка: 'cap', 'ink' (текст на плашці) чи 'draw' — чий колір візьме наступний дотик до фото
  const armPipette = (k) => {
    pipette = pipette === k ? null : k;
    if (pipette) toast('Коснись фото — возьму оттуда цвет');
    paintTools();
  };
  const style = capStyle({
    belowLabel: 'Под фото',
    onLook: (v) => { look = v; syncCaption(); },
    onFont: (v) => { font = v; syncCaption(); loadFont(); },
    onColor: (c) => setCapColor(typeof c === 'number' ? COLORS[c] : c),
    onInk: (c) => setCapInk(typeof c === 'number' ? COLORS[c] : c),
    onPipette: (t) => armPipette(t === 'text' ? 'ink' : 'cap'),
  });
  const helper = captionHelper(caption, { image, onPick: syncCaption });

  // ── Інструменти зверху і їх панелі ──
  const tool = (icon, label, m) => h('button', {
    type: 'button', class: 'ph-tool', 'aria-label': label, 'aria-pressed': 'false', 'data-m': m,
    onclick: () => setMode(mode === m ? 'move' : m),
  }, icon);
  // Звичний значок обрізки (два кути рамки), а не ножиці — ті читались як «вирізати»
  const tCrop = tool(h('span', { class: 'ph-ic', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>' }), 'Обрезать и повернуть', 'crop');
  const tDraw = tool('✏️', 'Рисовать', 'draw');
  const tStick = tool(pawIcon(), 'Наклейка', 'stick');
  const tBlur = tool('💧', 'Размыть', 'blur');
  // Рамка — не режим, а перемикач: фото лишається редагованим
  const tFrame = h('button', {
    type: 'button', class: 'ph-tool', 'aria-label': 'Рамка «Полароид»', 'aria-pressed': 'false',
    onclick: () => { frame = !frame; syncCaption(); },
  }, '🖼️');
  // ── Історія ↶ ↷: знімок — після кожної завершеної дії (палець відпущено, кнопку натиснуто).
  // Текст підпису не входить — його правлять клавіатурою; при відкаті береться поточний
  const snap = () => ({
    items: items.map((it) => ({ ...it, box: null, cap: it === capItem, ...(it === capItem ? { text: '' } : {}) })),
    strokes: strokes.map((s) => ({ ...s, pts: s.pts.slice() })),
    crop: crop && { ...crop }, turns, flipX, flipY, frame, look, color, capInk, font,
  });
  const snapKey = (s) => JSON.stringify(s, (k, v) => (k === 'img' ? undefined : v));
  const past = [];
  const future = [];
  let now = null;
  let nowKey = '';
  function commit() {
    if (!now) return;
    const s = snap();
    const k = snapKey(s);
    if (k === nowKey) return;
    past.push(now);
    if (past.length > 60) past.shift();
    future.length = 0;
    now = s;
    nowKey = k;
    paintHistory();
  }
  function restore(s) {
    items.splice(0, items.length, ...s.items.map((it) => ({ ...it })));
    capItem = items.find((it) => it.cap) || null;
    strokes.splice(0, strokes.length, ...s.strokes.map((x) => ({ ...x, pts: x.pts.slice() })));
    ({ turns, flipX, flipY, frame, look, color, font } = s);
    capInk = s.capInk || '';
    crop = s.crop && { ...s.crop };
    if (mode === 'crop') tmpCrop = crop ? { ...crop } : { x: 0, y: 0, w: rw(), h: rh() };
    sel = null;
    stroke = null;
    syncCaption();
    loadFont();
    redraw();
  }
  const step = (from, to) => {
    if (!from.length) return;
    to.push(now);
    now = from.pop();
    nowKey = snapKey(now);
    restore(now);
    paintHistory();
  };
  const [hUndo, hRedo] = histButtons(() => step(past, future), () => step(future, past));
  function paintHistory() {
    hUndo.disabled = !past.length;
    hRedo.disabled = !future.length;
  }
  const trash = h('button', {
    type: 'button', class: 'mk-chip ph-icon ph-trash', 'aria-label': 'Убрать выбранное',
    onclick: () => {
      if (!sel) return;
      if (sel === capItem) { caption.value = ''; syncCaption(); } else items.splice(items.indexOf(sel), 1);
      sel = null;
      paintTools();
      redraw();
    },
  }, '🗑');
  // Відмінити останній мазок свого інструмента: лінії й розмиття — окремо
  const undoLast = (blur) => {
    for (let i = strokes.length - 1; i >= 0; i -= 1) if (!!strokes[i].blur === blur) { strokes.splice(i, 1); break; }
    paintTools();
    redraw();
  };
  const undo = h('button', { type: 'button', class: 'mk-chip ph-undo', 'aria-label': 'Отменить линию', onclick: () => undoLast(false) }, '↩');
  const blurUndo = h('button', { type: 'button', class: 'mk-chip ph-undo', 'aria-label': 'Отменить размытие', onclick: () => undoLast(true) }, '↩');
  const drawOwn = ownColor({ label: 'Цвет карандаша', onPick: setDrawColor, onPipette: () => armPipette('draw') });
  const drawColors = h('span', { class: 'ph-swatches', role: 'radiogroup', 'aria-label': 'Цвет карандаша' },
    ...COLORS.map((c, i) => swatch(c, i, setDrawColor)), drawOwn.el);
  const done = (label = 'Готово') => h('button', { type: 'button', class: 'mk-chip ph-done', onclick: () => finishMode(true) }, label);
  const drawPanel = h('div', { class: 'ph-panel ph-panel-draw', hidden: true }, drawColors, undo, done());
  const blurPanel = h('div', { class: 'ph-panel', hidden: true }, h('span', { class: 'ph-hint' }, 'Закрась, что спрятать'), blurUndo, done());
  const cropPanel = h('div', { class: 'ph-panel', hidden: true },
    h('button', { type: 'button', class: 'mk-chip ph-icon', 'aria-label': 'Повернуть', onclick: () => { turn(); fit(); } }, '⟳'),
    h('button', { type: 'button', class: 'mk-chip ph-icon', 'aria-label': 'Отразить по горизонтали', onclick: () => { flip(true); redraw(); } }, '⇆'),
    h('button', { type: 'button', class: 'mk-chip ph-icon', 'aria-label': 'Отразить по вертикали', onclick: () => { flip(false); redraw(); } }, '⇅'),
    h('button', { type: 'button', class: 'mk-chip', onclick: () => { tmpCrop = { x: 0, y: 0, w: rw(), h: rh() }; redraw(); } }, 'Всё фото'),
    done());
  // Вибране: шар вище/нижче; наклейку ще й віддзеркалити. Панель висить над фото — сцена не стрибає
  const restack = (d) => {
    const i = items.indexOf(sel);
    const j = i + d;
    if (i < 0 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    paintTools();
    redraw();
  };
  const mirror = (axis) => { if (!mirrorable(sel)) return; sel[axis] = -(sel[axis] || 1); redraw(); };
  const upBtn = h('button', { type: 'button', class: 'mk-chip', 'aria-label': 'Выше остальных', onclick: () => restack(1) }, '⬆ Выше');
  const downBtn = h('button', { type: 'button', class: 'mk-chip', 'aria-label': 'Ниже остальных', onclick: () => restack(-1) }, '⬇ Ниже');
  const mirX = h('button', { type: 'button', class: 'mk-chip ph-icon', 'aria-label': 'Отразить наклейку по горизонтали', onclick: () => mirror('fx') }, '⇆');
  const mirY = h('button', { type: 'button', class: 'mk-chip ph-icon', 'aria-label': 'Отразить наклейку по вертикали', onclick: () => mirror('fy') }, '⇅');
  const selPanel = h('div', { class: 'ph-sel', hidden: true }, trash, downBtn, upBtn, mirX, mirY);
  stage.append(selPanel);
  // Наклейки одним рядком (stickpick.js): улюбленці чи смайлики. Фото без ключа (blob:) — полотно не «брудниться»
  const { el: petRow } = stickerRow({
    onPet: (key, i, src) => {
      const v = view();
      const img = new Image();
      img.onload = redraw;
      img.src = src;
      const n = items.filter((x) => x.look === 'pet').length;
      sel = { look: 'pet', key, img, size: v.w * 0.3, x: v.x + v.w * (0.3 + (n % 3) * 0.2), y: v.y + v.h * 0.35, k: 1, rot: 0 };
      items.push(sel);
      finishMode(true);
    },
    emojis: EMOJI_STICKERS,
    onEmoji: (s) => {
      const v = view();
      const n = items.filter((x) => x.look === 'emoji').length;
      sel = { text: s, look: 'emoji', size: v.w * SIZE.emoji, x: v.x + v.w * (0.5 + ((n % 3) - 1) * 0.12), y: v.y + v.h * (0.42 + (n % 2) * 0.08), k: 1, rot: 0, color: '#000', wrap: v.w };
      items.push(sel);
      finishMode(true);
    },
  });
  const stickPanel = h('div', { class: 'ph-panel ph-panel-stick', hidden: true }, petRow);

  function setMode(m) {
    pipette = null;
    if (mode === 'crop' && m !== 'crop') tmpCrop = null;
    mode = m;
    if (m === 'crop') tmpCrop = crop ? { ...crop } : { x: 0, y: 0, w: rw(), h: rh() };
    if (m !== 'move') sel = null;
    paintTools();
    requestAnimationFrame(fit);
  }
  // ok — «Готово»: обрізку застосувати; ✕ / «Назад» — вийти без неї
  function finishMode(ok) {
    if (mode === 'crop' && ok && tmpCrop) {
      const full = tmpCrop.x < 1 && tmpCrop.y < 1 && tmpCrop.w > rw() - 1 && tmpCrop.h > rh() - 1;
      crop = full ? null : { ...tmpCrop };
    }
    setMode('move');
  }
  function paintTools() {
    sheet.dataset.mode = mode;
    for (const b of [tCrop, tDraw, tStick, tBlur]) b.setAttribute('aria-pressed', String(b.dataset.m === mode));
    tFrame.setAttribute('aria-pressed', String(frame));
    drawPanel.hidden = mode !== 'draw';
    blurPanel.hidden = mode !== 'blur';
    cropPanel.hidden = mode !== 'crop';
    stickPanel.hidden = mode !== 'stick';
    bottom.hidden = mode === 'draw' || mode === 'crop' || mode === 'blur';
    selPanel.hidden = !sel || mode !== 'move';
    const idx = items.indexOf(sel);
    upBtn.hidden = items.length < 2;
    downBtn.hidden = items.length < 2;
    upBtn.disabled = idx === items.length - 1;
    downBtn.disabled = idx <= 0;
    mirX.hidden = !mirrorable(sel);
    mirY.hidden = !mirrorable(sel);
    undo.disabled = !strokes.some((s) => !s.blur);
    blurUndo.disabled = !strokes.some((s) => s.blur);
    const cur = textual(sel) ? sel.color : color;
    const curInk = (textual(sel) ? sel.ink : capInk) || '';
    style.paint({
      text: caption.value.trim(), look, font, color: cur, preset: COLORS.indexOf(cur), ink: curInk, inkPreset: COLORS.indexOf(curInk),
      armed: pipette === 'cap' || pipette === 'ink',
    });
    drawColors.querySelectorAll('.ph-swatch[data-v]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === drawColor)));
    drawOwn.paint(drawColor, COLORS.includes(drawColor), pipette === 'draw');
    stage.classList.toggle('is-pipette', !!pipette);
  }

  // ── Відправка ──
  // Не «Отправить» (у лист — прикласти): словами й скріпкою, щоб не плутати зі стрілкою відправки
  const go = label === 'Отправить' ? h('button', { type: 'button', class: 'ph-send', 'aria-label': label, title: label, html: ARROW })
    : h('button', { type: 'button', class: 'ph-send is-attach' }, '📎 ', label);
  go.addEventListener('click', async () => {
    if (go.disabled) return;
    go.disabled = true;
    try {
      let out = blob;
      if (edited()) {
        await fonts;
        await loadFont();
        const v = crop || { x: 0, y: 0, w: rw(), h: rh() };
        const k = Math.min(1, MAX_SIDE / Math.max(v.w, v.h));
        const pw = Math.max(1, Math.round(v.w * k));
        const ph = Math.max(1, Math.round(v.h * k));
        const fs = frame ? Math.round(pw * FRAME.side) : 0;
        const fb = frame ? Math.round(pw * FRAME.bottom) : 0;
        const c = document.createElement('canvas');
        c.width = pw + fs * 2;
        c.height = ph + fs + fb;
        const cx = c.getContext('2d');
        const saved = mode;
        mode = 'move';
        if (frame) {
          cx.fillStyle = FRAME.paper;
          cx.fillRect(0, 0, c.width, c.height);
          cx.save();
          cx.beginPath();
          cx.rect(fs, fs, pw, ph);
          cx.clip();
        }
        render(cx, k, v, false, fs, fs);
        if (frame) {
          cx.restore();
          drawFoot(cx, fs, fs + ph, pw, fb, look === 'below' ? caption.value.trim() : '');
        }
        mode = saved;
        out = await toBlob(c, 'image/webp', 0.85);
        if (out?.type !== 'image/webp') out = await toBlob(c, 'image/jpeg', 0.88);
        if (out && out.size > MAX_BYTES) out = await toBlob(c, 'image/jpeg', 0.75);
        if (!out) throw new Error('encode');
      }
      // Підпис на фото чи в рамці вже впечений — текстом іде лише «Под фото» без рамки
      await send(out, look === 'below' && !frame ? caption.value.trim() : '');
      close();
    } catch (e) {
      go.disabled = false;
      toast(fail(e));
    }
  });

  const bottom = h('div', { class: 'ph-bottom' },
    belowLine,
    style.el,
    helper.el,
    h('div', { class: 'ph-send-row' }, caption, go));
  const close = () => {
    ro.disconnect();
    base.close?.();
    URL.revokeObjectURL(backUrl);
    document.documentElement.classList.remove('is-covered');
    sheet.remove();
  };
  // ✕ і «Назад» спершу виходять з малювання / обрізки / наклейок, і лише потім закривають
  const x = h('button', {
    type: 'button', class: 'sheet-close ph-close', 'aria-label': 'Закрыть',
    onclick: () => { if (mode !== 'move') finishMode(false); else { close(); cancel?.(); } },
  }, '✕');
  // Фон — саме фото, сильно розмите: у кожного свій колір замість суцільної заливки
  const backUrl = URL.createObjectURL(blob);
  const sheet = h('div', { class: 'sheet sheet-full sheet-photo', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Новое фото' },
    h('img', { class: 'ph-backdrop', src: backUrl, alt: '', 'aria-hidden': 'true' }),
    h('div', { class: 'ph-top' }, x, hUndo, hRedo, h('span', { class: 'ph-gap' }), tCrop, tDraw, tBlur, tStick, tFrame),
    stage,
    drawPanel, blurPanel, cropPanel, stickPanel,
    bottom);
  // Після будь-якої кнопки чи вибору в палітрі — знімок, якщо щось змінилось (обробники кнопок уже відпрацювали)
  sheet.addEventListener('click', (e) => { if (!e.target.closest('.ph-hist')) commit(); });
  sheet.addEventListener('change', commit);
  const ro = new ResizeObserver(() => fit());
  document.body.append(sheet);
  ro.observe(stage);
  paintTools();
  fit();
  now = snap();
  nowKey = snapKey(now);
  if (!reduceMotion) sheet.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  setTimeout(() => { if (sheet.isConnected) document.documentElement.classList.add('is-covered'); }, 220);
}
