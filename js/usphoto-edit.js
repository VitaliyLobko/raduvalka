// Вікно «Наше фото» (з ⋯ біля «Письма»): вибрати знімок і поставити його в коло — палець зсуває, два пальці
// чи повзунок збільшують. Вирізаємо квадрат 512 через canvas: заодно зникають метадані знімка (місце, телефон)
import { h, toast } from './ui.js';
import { usPhoto, saveUsPhoto, removeUsPhoto } from './usphoto.js';
import { reactFx } from './fx.js';

const OUT = 512;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function sheet(...kids) {
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'us-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Наше фото' },
    h('h3', { class: 'us-title' }, 'Наше фото'), ...kids);
  document.addEventListener('keydown', onKey);
  document.body.append(box);
  return { box, close };
}

const NOTE = 'Появится в реакции «Вселенная нас любит» — у вас обоих. Видите его только вы двое';

export function openUsPhoto() {
  const cur = usPhoto();
  if (!cur) { pick(); return; }
  // Уже вибрали — показати й запропонувати замінити чи прибрати (прибрати — другим натисканням)
  const view = h('div', { class: 'us-view is-still' }, h('img', { src: cur, alt: 'Наше фото' }));
  let sure = false;
  const drop = h('button', {
    type: 'button', class: 'us-btn',
    onclick: async () => {
      if (!sure) { sure = true; drop.textContent = 'Точно убрать?'; return; }
      drop.disabled = true;
      try { await removeUsPhoto(); toast('Фото убрано — в реакции снова галактика'); s.close(); } catch { drop.disabled = false; toast('Не получилось — проверь интернет'); }
    },
  }, 'Убрать');
  const s = sheet(view, h('p', { class: 'us-note' }, NOTE), h('div', { class: 'us-acts' },
    h('button', { type: 'button', class: 'us-btn is-main', onclick: () => { s.close(); pick(); } }, 'Заменить'),
    drop,
    h('button', { type: 'button', class: 'us-btn', onclick: () => s.close() }, 'Закрыть')));
  s.box.querySelector('.is-main').focus();
}

function pick() {
  const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
  input.addEventListener('change', () => { const f = input.files?.[0]; input.remove(); if (f) crop(f); });
  document.body.append(input);
  input.click();
}

async function crop(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { toast('Это фото открыть не получилось'); return; }
  const V = Math.min(innerWidth - 64, 300);
  // base — масштаб, коли фото рівно накриває коло; z — у скільки разів більше (1…5); x, y — зсув центру фото, px
  const base = Math.max(V / bmp.width, V / bmp.height);
  let z = 1;
  let x = 0;
  let y = 0;
  const src = URL.createObjectURL(file);
  const img = h('img', { src, alt: '', draggable: 'false' });
  img.style.width = `${bmp.width}px`;
  img.style.height = `${bmp.height}px`;
  const view = h('div', { class: 'us-view', 'aria-label': 'Двигай фото пальцем, двумя — меняй размер' }, img);
  view.style.setProperty('--v', `${V}px`);
  const zoom = h('input', { type: 'range', class: 'us-zoom', min: '1', max: '5', step: '0.01', value: '1', 'aria-label': 'Размер' });
  const paint = () => {
    const hw = (bmp.width * base * z - V) / 2;
    const hh = (bmp.height * base * z - V) / 2;
    x = clamp(x, -hw, hw);
    y = clamp(y, -hh, hh);
    img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${base * z})`;
    zoom.value = String(z);
  };
  const setZ = (nz) => { const k = clamp(nz, 1, 5) / z; z *= k; x *= k; y *= k; paint(); };
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
  const s = sheet(view, zoom, h('p', { class: 'us-note' }, NOTE), h('div', { class: 'us-acts' },
    save, h('button', { type: 'button', class: 'us-btn', onclick: () => s.close() }, 'Отмена')));
  const close = s.close;
  s.close = () => { URL.revokeObjectURL(src); bmp.close?.(); close(); };
  paint();
  save.addEventListener('click', async () => {
    save.disabled = true;
    save.textContent = 'Сохраняю…';
    try {
      const c = document.createElement('canvas');
      c.width = OUT;
      c.height = OUT;
      const k = OUT / V;
      const dw = bmp.width * base * z * k;
      const dh = bmp.height * base * z * k;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, (V / 2 + x) * k - dw / 2, (V / 2 + y) * k - dh / 2, dw, dh);
      const jpeg = await new Promise((ok) => { c.toBlob(ok, 'image/jpeg', 0.86); });
      await saveUsPhoto(jpeg);
      s.close();
      toast('Наше фото сохранено ✨');
      // Одразу показати, як воно виглядає у «Вселенная нас любит»
      reactFx(document.querySelector('.chat-title') || document.body, '🌌');
    } catch (e) {
      save.disabled = false;
      save.textContent = 'Сохранить';
      toast(e.code === 'secret' ? 'Фото шифруется ключом пары — открой Радовалку по своей ссылке' : 'Не получилось сохранить — проверь интернет');
    }
  });
}
