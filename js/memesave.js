// «⬇ Сохранить» фото чи гифку на пристрій: у фото підпис упікається в картинку так, як її видно на екрані;
// гифка — оригінальний файл (у GIF підпис не впекти без перекодування)
import { h, toast } from './ui.js';

// Рядки підпису під ширину: по словах, задовге слово — як є
function wrap(ctx, text, max) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// Фото + підпис: поверх (як .meme-over — Rubik, великими, біла з чорною обводкою) або смужкою під фото (як рукописний підпис)
async function bake(img, caption, style) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const text = String(caption || '').trim();
  const pad = Math.round(W * 0.04);
  const handSize = Math.max(22, Math.round(W * 0.06));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let strip = [];
  if (text && !style) {
    ctx.font = `400 ${handSize}px Caveat, 'Segoe Print', cursive`;
    strip = wrap(ctx, text, W - pad * 2);
  }
  const stripH = strip.length ? Math.round(strip.length * handSize * 1.25 + pad * 1.5) : 0;
  canvas.width = W;
  canvas.height = H + stripH;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, W, H);
  ctx.textAlign = 'center';
  if (text && style) {
    const size = Math.max(20, Math.round(W * 0.075));
    ctx.font = `700 ${size}px Rubik, system-ui, sans-serif`;
    const lines = wrap(ctx, text.toUpperCase(), W - pad * 2);
    const lh = size * 1.1;
    const top = style === 'top' ? pad + size * 0.85 : H - pad - lh * (lines.length - 1) - size * 0.2;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.16);
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';
    lines.forEach((l, i) => { ctx.strokeText(l, W / 2, top + i * lh); ctx.fillText(l, W / 2, top + i * lh); });
  }
  if (strip.length) {
    ctx.font = `400 ${handSize}px Caveat, 'Segoe Print', cursive`;
    ctx.fillStyle = '#4A2545';
    strip.forEach((l, i) => ctx.fillText(l, W / 2, H + pad + handSize * (0.9 + i * 1.25)));
  }
  return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('blob'))), 'image/jpeg', 0.92));
}

function download(blob, name) {
  const href = URL.createObjectURL(blob);
  const a = h('a', { href, download: name, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}

// m — мемчик; el — показаний <img>/<video> (у нього вже завантажений файл)
export async function saveMeme(m, el) {
  const day = new Date(m.created || Date.now()).toISOString().slice(0, 10);
  const name = `radovalka-${day}-${String(m.id || '').slice(-6) || 'foto'}`;
  try {
    if (m.url) {
      const res = await fetch(m.url);
      if (!res.ok) throw new Error('gif');
      download(await res.blob(), `${name}.gif`);
    } else if (el?.tagName === 'IMG') {
      await document.fonts?.ready;
      download(await bake(el, m.caption, m.style), `${name}.jpg`);
    } else {
      const blob = await fetch(el.src).then((r) => r.blob());
      download(blob, `${name}.${(blob.type.split('/')[1] || 'bin').replace('quicktime', 'mov')}`);
    }
    toast('Сохранено в «Загрузки» ⬇');
  } catch {
    toast('Не получилось сохранить — попробуй ещё раз');
  }
}
