// Вікно альбому фото (з ⋯ біля «Письма»): us — «Наши фото» для 🌌 (коло), her — її фото для 🍓 (серце, лише в нього),
// his — його фото для 🛡️ (щит, лише в неї).
// Сітка знімків, «＋» додає (можна кілька за раз — кадруємо по одному), прибрати — другим натисканням на знімок.
// Кадр: палець зсуває, два пальці чи повзунок збільшують. Вирізаємо через canvas: заодно зникають метадані (місце, телефон)
import { h, toast } from './ui.js';
import { ALBUMS, LIMIT } from './usphoto.js';
import { reactFx } from './fx.js';

// Фігурні кадри: контур у своїй системі координат (як у fx.js), w × h — її розмір
const SHAPES = {
  'is-heart': { w: 260, h: 240, d: 'M130 228 C 52 170, 6 124, 6 72 C 6 34, 36 8, 72 8 C 98 8, 118 24, 130 44 C 142 24, 162 8, 188 8 C 224 8, 254 34, 254 72 C 254 124, 208 170, 130 228 Z' },
  'is-shield': { w: 240, h: 280, d: 'M120 6 L228 40 C228 150 194 228 120 272 C46 228 12 150 12 40 Z' },
};
const CFG = {
  us: {
    title: 'Наши фото', glyph: '🌌', shape: 'is-circle', w: 512, h: 512,
    note: 'До 10 фото. В реакции «Вселенная нас любит» каждый раз случайное — у вас обоих. Видите их только вы двое',
  },
  her: {
    title: 'Её фото', glyph: '🍓', shape: 'is-heart', w: 520, h: 480,
    note: 'До 10 фото. Когда ставишь 🍓 на её письмо, в сердечке каждый раз другое. Видите их только вы двое',
  },
  his: {
    title: 'Его фото', glyph: '🛡️', shape: 'is-shield', w: 480, h: 560,
    note: 'До 10 фото. Когда ставишь 🛡️ на его письмо, в щите каждый раз другое. Видите их только вы двое',
  },
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ZMIN = 0.35;
const play = (cfg) => reactFx(document.querySelector('.chat-title') || document.body, cfg.glyph);

function sheet(title, cls, ...kids) {
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: `us-sheet ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h3', { class: 'us-title' }, title), ...kids);
  document.addEventListener('keydown', onKey);
  document.body.append(box);
  return { box, close };
}

// Форма кадру: серце чи щит — через clip-path (інлайн-стиль лише з JS, CSP) і кант по краю, як у реакції
function frame(el, cfg) {
  el.classList.add(cfg.shape);
  const sh = SHAPES[cfg.shape];
  if (!sh) return;
  const k = el.offsetWidth / sh.w || 1;
  el.style.clipPath = `path('${sh.d.replace(/[\d.]+/g, (n) => String(Math.round(Number(n) * k * 10) / 10))}')`;
  el.insertAdjacentHTML('beforeend', `<svg class="us-heart-edge" viewBox="0 0 ${sh.w} ${sh.h}" preserveAspectRatio="none" aria-hidden="true"><path d="${sh.d}"/></svg>`);
}

export function openAlbum(name) {
  const cfg = CFG[name];
  const album = ALBUMS[name];
  if (!album.size()) { pick(name); return; }
  const grid = h('div', { class: 'us-grid' });
  const s = sheet(cfg.title, cfg.shape, grid, h('p', { class: 'us-note' }, cfg.note), h('div', { class: 'us-acts' },
    h('button', { type: 'button', class: 'us-btn is-main', onclick: () => { s.close(); play(cfg); } }, 'Посмотреть'),
    h('button', { type: 'button', class: 'us-btn', onclick: () => s.close() }, 'Закрыть')));
  let sure = null;
  const draw = () => {
    grid.replaceChildren(...album.list().map(({ id, url }) => {
      const tile = h('button', {
        type: 'button', class: `us-tile${sure === id ? ' is-sure' : ''}`, 'aria-label': sure === id ? 'Точно убрать?' : 'Фото — нажми, чтобы убрать',
        onclick: async () => {
          if (sure !== id) { sure = id; draw(); return; }
          tile.disabled = true;
          try {
            await album.remove(id);
            sure = null;
            if (!album.size()) { s.close(); toast('Фото убраны'); return; }
            draw();
          } catch { tile.disabled = false; toast('Не получилось — проверь интернет'); }
        },
      }, h('img', { src: url, alt: '' }), h('span', { class: 'us-tile-x' }, 'Убрать?'));
      return tile;
    }), ...(album.size() < LIMIT ? [h('button', {
      type: 'button', class: 'us-tile is-add', 'aria-label': 'Добавить фото', onclick: () => { s.close(); pick(name); },
    }, '＋')] : []));
    grid.querySelectorAll('.us-tile:not(.is-add)').forEach((t) => frame(t, cfg));
  };
  draw();
  s.box.querySelector('.is-main').focus();
}

function pick(name) {
  const input = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  input.addEventListener('change', () => {
    const files = [...(input.files || [])];
    input.remove();
    const room = LIMIT - ALBUMS[name].size();
    if (files.length > room) toast(`Влезет ещё ${room} — остальные пропущу`);
    if (files.length) crop(name, files.slice(0, room), 0);
  });
  document.body.append(input);
  input.click();
}

// Після кадрування: перше фото — одразу показати в реакції, далі — назад до сітки
function done(name, added) {
  const album = ALBUMS[name];
  if (!added) { if (album.size()) openAlbum(name); return; }
  if (album.size() === added) { play(CFG[name]); toast('Фото сохранено ✨'); return; }
  openAlbum(name);
  toast(added > 1 ? `Добавлено фото: ${added} ✨` : 'Фото добавлено ✨');
}

async function crop(name, files, added) {
  const cfg = CFG[name];
  const album = ALBUMS[name];
  const file = files[0];
  if (!file) { done(name, added); return; }
  const next = (n) => crop(name, files.slice(1), added + n);
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { toast('Это фото открыть не получилось'); next(0); return; }
  // Високий кадр (щит) — вужчий, щоб вікно влазило в екран телефону
  const V = Math.min(innerWidth - 64, 300, Math.round((290 * cfg.w) / cfg.h));
  const VH = Math.round((V * cfg.h) / cfg.w);
  // base — масштаб, коли фото рівно накриває кадр; z — у скільки разів більше (ZMIN…5): менше 1 — у кадр влазить більше,
  // а порожні краї заповнює розмита копія того ж фото; x, y — зсув центру фото, px
  const base = Math.max(V / bmp.width, VH / bmp.height);
  let z = 1;
  let x = 0;
  let y = 0;
  const src = URL.createObjectURL(file);
  const img = h('img', { src, alt: '', draggable: 'false' });
  img.style.width = `${bmp.width}px`;
  img.style.height = `${bmp.height}px`;
  const view = h('div', { class: 'us-view', 'aria-label': 'Двигай фото пальцем, двумя — меняй размер' }, h('img', { src, alt: '', class: 'us-bg', draggable: 'false' }), img);
  view.style.setProperty('--v', `${V}px`);
  view.style.setProperty('--vh', `${VH}px`);
  const zoom = h('input', { type: 'range', class: 'us-zoom', min: String(ZMIN), max: '5', step: '0.01', value: '1', 'aria-label': 'Размер' });
  const paint = () => {
    const hw = (bmp.width * base * z - V) / 2;
    const hh = (bmp.height * base * z - VH) / 2;
    x = clamp(x, -Math.abs(hw), Math.abs(hw));
    y = clamp(y, -Math.abs(hh), Math.abs(hh));
    img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${base * z})`;
    zoom.value = String(z);
  };
  const setZ = (nz) => { const k = clamp(nz, ZMIN, 5) / z; z *= k; x *= k; y *= k; paint(); };
  zoom.addEventListener('input', () => setZ(Number(zoom.value)));
  view.addEventListener('wheel', (e) => { e.preventDefault(); setZ(z * Math.exp(-e.deltaY / 400)); }, { passive: false });
  // Пальці: один — зсув, два — масштаб і зсув за серединою
  const pts = new Map();
  let prev = null;
  const geo = () => {
    const [a, b] = [...pts.values()];
    return b ? { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) } : { mx: a.x, my: a.y, d: 0 };
  };
  view.addEventListener('pointerdown', (e) => { view.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); prev = geo(); });
  view.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = geo();
    x += g.mx - prev.mx;
    y += g.my - prev.my;
    if (g.d && prev.d) setZ(z * (g.d / prev.d));
    else paint();
    prev = g;
  });
  const up = (e) => { pts.delete(e.pointerId); prev = pts.size ? geo() : null; };
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);

  const save = h('button', { type: 'button', class: 'us-btn is-main' }, 'Сохранить');
  const more = files.length > 1;
  const title = more || added ? `${cfg.title} · ${added + 1} из ${added + files.length}` : cfg.title;
  const s = sheet(title, cfg.shape, view, zoom, h('p', { class: 'us-note' }, cfg.note), h('div', { class: 'us-acts' },
    save,
    ...(more ? [h('button', { type: 'button', class: 'us-btn', onclick: () => { s.close(); next(0); } }, 'Пропустить')] : []),
    h('button', { type: 'button', class: 'us-btn', onclick: () => { s.close(); done(name, added); } }, 'Отмена')));
  const close = s.close;
  s.close = () => { URL.revokeObjectURL(src); bmp.close?.(); close(); };
  frame(view, cfg);
  paint();
  save.addEventListener('click', async () => {
    save.disabled = true;
    save.textContent = 'Сохраняю…';
    try {
      const c = document.createElement('canvas');
      c.width = cfg.w;
      c.height = cfg.h;
      const k = cfg.w / V;
      const dw = bmp.width * base * z * k;
      const dh = bmp.height * base * z * k;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // Фото менше кадру — краї та сама розмита копія, що й у вікні (без filter у canvas — просто без розмиття)
      if (dw < cfg.w || dh < cfg.h) {
        const cs = Math.max(cfg.w / bmp.width, cfg.h / bmp.height) * 1.15;
        ctx.filter = `blur(${Math.round(14 * k)}px) brightness(.85)`;
        ctx.drawImage(bmp, (cfg.w - bmp.width * cs) / 2, (cfg.h - bmp.height * cs) / 2, bmp.width * cs, bmp.height * cs);
        ctx.filter = 'none';
      }
      ctx.drawImage(bmp, (V / 2 + x) * k - dw / 2, (VH / 2 + y) * k - dh / 2, dw, dh);
      const jpeg = await new Promise((ok) => { c.toBlob(ok, 'image/jpeg', 0.86); });
      await album.add(jpeg);
      s.close();
      next(1);
    } catch (e) {
      save.disabled = false;
      save.textContent = 'Сохранить';
      if (e.code === 'limit') { s.close(); toast(`Уже ${LIMIT} фото — убери одно, чтобы добавить`); done(name, added); return; }
      toast(e.code === 'secret' ? 'Фото шифруется ключом пары — открой Радовалку по своей ссылке' : 'Не получилось сохранить — проверь интернет');
    }
  });
}

// Для старого виклику з меню 0.4.116
export const openUsPhoto = () => openAlbum('us');
