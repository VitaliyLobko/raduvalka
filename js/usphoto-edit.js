// Вікно альбому фото (з налаштувань Радовалки): us — «Наши фото» для 🌌 (коло), her — її фото для 🍓 (серце, лише в нього),
// his — його фото для 🛡️ (щит, лише в неї).
// Сітка знімків, «＋» додає (можна кілька за раз — кадруємо по одному), прибрати — другим натисканням на знімок.
// Кадр: палець зсуває, два пальці чи повзунок збільшують. Вирізаємо через canvas: заодно зникають метадані (місце, телефон)
import { h, toast } from './ui.js';
import { ALBUMS, LIMIT } from './usphoto.js';
import { reactFx } from './fx.js';
import { prepare, prepareError } from './memes.js';

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
    note: 'До 10 фото. Когда ставишь «Щит» на его письмо, в нём каждый раз другое. Видите их только вы двое',
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
  // Лише image/* — Android відкриває свій вибір фото (як Google Фото, без «Галереї»). Із типом не-картинкою (text/plain)
  // — звичайний вибір застосунку: Галерея, Файли, Google Фото. Не картинку відсіє crop (не відкриється — пропустимо)
  const input = h('input', { type: 'file', accept: 'image/*,text/plain', multiple: true, hidden: true });
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
  // base — масштаб, коли фото рівно накриває кадр (для повороту на чверть — по переставлених сторонах); z — у скільки
  // разів більше (ZMIN…5): менше 1 — у кадр влазить більше; x, y — зсув центру фото, px; turn — поворот, градуси;
  // flip — дзеркально. Порожнє місце в кадрі заповнює розмита копія того ж фото (так само й при збереженні)
  const odd = (deg) => Math.abs(Math.round(deg / 90)) % 2 === 1;
  const baseOf = (deg) => (odd(deg) ? Math.max(V / bmp.height, VH / bmp.width) : Math.max(V / bmp.width, VH / bmp.height));
  let base = baseOf(0);
  let z = 1;
  let x = 0;
  let y = 0;
  let twist = 0;
  let turn = 0;
  let flip = false;
  // Фото можна відсунути за край на третину кадру — там проступить розмите тло
  const SLACK = 0.35;
  const src = URL.createObjectURL(file);
  const img = h('img', { src, alt: '', draggable: 'false' });
  img.style.width = `${bmp.width}px`;
  img.style.height = `${bmp.height}px`;
  const bg = h('img', { src, alt: '', class: 'us-bg', draggable: 'false' });
  const view = h('div', { class: 'us-view', 'aria-label': 'Двигай фото пальцем, двумя — меняй размер и поворачивай' }, bg, img);
  view.style.setProperty('--v', `${V}px`);
  view.style.setProperty('--vh', `${VH}px`);
  const zoom = h('input', { type: 'range', class: 'us-zoom', min: String(ZMIN), max: '5', step: '0.01', value: '1', 'aria-label': 'Размер' });
  const paint = () => {
    const s = base * z;
    const t = (turn * Math.PI) / 180;
    // Межі зсуву — за рамкою повернутого фото
    const bw = (Math.abs(Math.cos(t)) * bmp.width + Math.abs(Math.sin(t)) * bmp.height) * s;
    const bh = (Math.abs(Math.sin(t)) * bmp.width + Math.abs(Math.cos(t)) * bmp.height) * s;
    const mx = Math.abs(bw - V) / 2 + V * SLACK;
    const my = Math.abs(bh - VH) / 2 + VH * SLACK;
    x = clamp(x, -mx, mx);
    y = clamp(y, -my, my);
    img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${turn}deg) scale(${flip ? -s : s}, ${s})`;
    // Тло крутиться лише чвертями: інакше розмите «накриття» не закрило б кути кадру
    const q = Math.round(turn / 90) * 90;
    bg.style.width = `${odd(q) ? VH : V}px`;
    bg.style.height = `${odd(q) ? V : VH}px`;
    bg.style.transform = `translate(-50%, -50%) rotate(${q}deg) scale(${flip ? -1.15 : 1.15}, 1.15)`;
    zoom.value = String(z);
  };
  const setZ = (nz) => { const k = clamp(nz, ZMIN, 5) / z; z *= k; x *= k; y *= k; paint(); };
  // Поворот: біля прямого кута (±5°) фото «прилипає»; base міняється на чвертях — пальцями z підправляємо, щоб розмір
  // не стрибав; кнопкою ⟳ (keep = false) z лишається — повернуте фото знову накриває кадр, як до повороту
  const setTurn = (deg, keep = true) => {
    twist = deg;
    const near = Math.round(deg / 90) * 90;
    turn = Math.abs(deg - near) <= 5 ? near : deg;
    const nb = baseOf(turn);
    if (keep) z = clamp((z * base) / nb, ZMIN, 5);
    base = nb;
    paint();
  };
  zoom.addEventListener('input', () => setZ(Number(zoom.value)));
  view.addEventListener('wheel', (e) => { e.preventDefault(); setZ(z * Math.exp(-e.deltaY / 400)); }, { passive: false });
  // Пальці: один — зсув, два — масштаб, поворот і зсув за серединою
  const pts = new Map();
  let prev = null;
  const geo = () => {
    const [a, b] = [...pts.values()];
    return b ? { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x) } : { mx: a.x, my: a.y, d: 0, a: 0 };
  };
  view.addEventListener('pointerdown', (e) => { view.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); prev = geo(); });
  view.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = geo();
    x += g.mx - prev.mx;
    y += g.my - prev.my;
    if (g.d && prev.d) {
      let da = g.a - prev.a;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      setTurn(twist + (da * 180) / Math.PI);
      setZ(z * (g.d / prev.d));
    } else paint();
    prev = g;
  });
  const up = (e) => { pts.delete(e.pointerId); prev = pts.size ? geo() : null; };
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);

  const tool = (label, text, onclick) => h('button', { type: 'button', class: 'us-tool', 'aria-label': label, title: label, onclick }, text);
  // «Украсить» — той самий редактор, що й для фото в листах (підпис, наклейки, малювання, розмиття, обрізка);
  // «Готово» повертає змінене фото сюди, у рамку; хрестик — назад до цього ж фото
  const decorate = async () => {
    let photo;
    try { photo = await prepare(file); } catch (e) { toast(prepareError(e)); return; }
    s.close();
    const { photoEditor } = await import('./photoedit.js');
    photoEditor(photo, {
      label: 'Готово',
      fail: () => 'Не получилось — попробуй ещё раз',
      send: async (out) => { crop(name, [out, ...files.slice(1)], added); },
      cancel: () => crop(name, files, added),
    });
  };
  const tools = h('div', { class: 'us-tools' },
    tool('Отразить', '⇆', () => { flip = !flip; paint(); }),
    zoom,
    tool('Повернуть', '⟳', () => setTurn(Math.round(twist / 90) * 90 + 90, false)),
    tool('Украсить: подпись, наклейки, рисунок', '✏️', decorate));
  const save = h('button', { type: 'button', class: 'us-btn is-main' }, 'Сохранить');
  const more = files.length > 1;
  const title = more || added ? `${cfg.title} · ${added + 1} из ${added + files.length}` : cfg.title;
  const s = sheet(title, cfg.shape, view, tools, h('p', { class: 'us-note' }, cfg.note), h('div', { class: 'us-acts' },
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
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // Тло — та сама розмита копія, що й у вікні (повернута чвертями й віддзеркалена так само); де фото накриває
      // кадр, його не видно. Без filter у canvas — просто без розмиття
      const q = Math.round(turn / 90) * 90;
      const [qw, qh] = odd(q) ? [cfg.h, cfg.w] : [cfg.w, cfg.h];
      const cs = Math.max(qw / bmp.width, qh / bmp.height) * 1.15;
      ctx.save();
      ctx.translate(cfg.w / 2, cfg.h / 2);
      ctx.rotate((q * Math.PI) / 180);
      ctx.scale(flip ? -1 : 1, 1);
      ctx.filter = `blur(${Math.round(14 * k)}px) brightness(.85)`;
      ctx.drawImage(bmp, (-bmp.width * cs) / 2, (-bmp.height * cs) / 2, bmp.width * cs, bmp.height * cs);
      ctx.restore();
      ctx.filter = 'none';
      // Саме фото: центр зсунутий, поворот, дзеркало — у тому ж порядку, що й transform у вікні
      const ps = base * z * k;
      ctx.save();
      ctx.translate((V / 2 + x) * k, (VH / 2 + y) * k);
      ctx.rotate((turn * Math.PI) / 180);
      ctx.scale(flip ? -1 : 1, 1);
      ctx.drawImage(bmp, (-bmp.width * ps) / 2, (-bmp.height * ps) / 2, bmp.width * ps, bmp.height * ps);
      ctx.restore();
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
