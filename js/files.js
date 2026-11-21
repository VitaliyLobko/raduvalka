// Файл «як файл» (документ, архів, відео — що завгодно до 25 МБ): шифрується на телефоні й іде в R2 одним запитом.
// Модуль вантажиться лише тоді, коли вибрали файл чи тиснуть «Скачать» (лежить у кеші оболонки)
import { API, getKey } from './api.js';
import { seal, sealFile, openBlob, openDeep } from './seal.js';
import { h, toast } from './ui.js';
import { DATA } from './data.js';

export const MAX_FILE = 25 * 1024 * 1024;

// Розмір по-людськи: 820 КБ, 3,4 МБ
export function fileSize(n) {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',')} МБ`;
}

const b64u = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Смужка над рядком: назва, відсотки, ✕ — скасувати
function progress(name, onCancel) {
  const bar = h('i', { class: 'file-up-bar' });
  const pct = h('span', { class: 'file-up-pct' }, '0%');
  const el = h('div', { class: 'file-up', role: 'status' },
    h('span', { class: 'file-up-name' }, `📎 ${name}`), pct,
    h('button', { type: 'button', class: 'file-up-x', 'aria-label': 'Отменить отправку', onclick: onCancel }, '✕'), bar);
  document.body.append(el);
  let raf = 0;
  let want = 0;
  return {
    // Подія прогресу приходить часто — малюємо не частіше кадру
    set(p) {
      want = p;
      raf ||= requestAnimationFrame(() => {
        raf = 0;
        bar.style.transform = `scaleX(${want})`;
        pct.textContent = `${Math.round(want * 100)}%`;
      });
    },
    done() { cancelAnimationFrame(raf); el.remove(); },
  };
}

// re — { quote, on }: файл у відповідь на повідомлення
export async function sendFile(file, done, re = null) {
  if (!file.size) { toast('Файл пустой'); return; }
  if (file.size > MAX_FILE) { toast(`Файл ${fileSize(file.size)} — можно до 25 МБ`); return; }
  const name = (file.name || 'файл').slice(0, 200);
  let xhr = null;
  const bar = progress(name, () => xhr?.abort());
  try {
    const [body, n, quote] = await Promise.all([
      sealFile(file),
      seal(name),
      re?.quote ? seal(String(re.quote).slice(0, 300)) : null,
    ]);
    const meta = b64u(JSON.stringify({ n, t: file.type || 'application/octet-stream', s: file.size, ...(re ? { quote, on: re.on } : {}) }));
    const meme = await new Promise((ok, no) => {
      xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/api/files`);
      xhr.setRequestHeader('authorization', `Bearer ${getKey()}`);
      xhr.setRequestHeader('x-file-meta', meta);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) bar.set(e.loaded / e.total); };
      xhr.onload = () => {
        let j = null;
        try { j = JSON.parse(xhr.responseText); } catch { /* не JSON */ }
        if (xhr.status < 300 && j) ok(j);
        else no(Object.assign(new Error(`api ${xhr.status}`), { status: xhr.status, code: j?.error }));
      };
      xhr.onerror = () => no(new Error('net'));
      xhr.onabort = () => no(Object.assign(new Error('abort'), { abort: true }));
      xhr.send(body);
    });
    await openDeep(meme);
    DATA.memes = [meme, ...(DATA.memes || [])];
    toast('Файл отправлен 📎');
    done?.();
  } catch (e) {
    if (e.abort) toast('Отправка отменена');
    else if (e.status === 429) toast('На сегодня файлов хватит — завтра снова можно');
    else if (e.status === 503) toast('Файлы пока не подключены');
    else if (e.status === 413) toast('Файл слишком большой — можно до 25 МБ');
    else toast('Не отправилось — нет связи');
  } finally {
    bar.done();
  }
}

// «Скачать»: байти з R2 → розшифрувати → зберегти під справжньою назвою й типом
const busy = new Set();
export async function downloadFile(m) {
  if (busy.has(m.id)) return;
  busy.add(m.id);
  toast('Скачиваю…');
  try {
    const res = await fetch(`${API}/api/memes/${m.id}/file`, { headers: { authorization: `Bearer ${getKey()}` }, cache: 'no-store' });
    if (!res.ok) throw Object.assign(new Error(`api ${res.status}`), { status: res.status });
    const plain = await openBlob(await res.blob());
    const url = URL.createObjectURL(new Blob([plain], { type: m.file.t || 'application/octet-stream' }));
    const a = h('a', { href: url, download: m.file.n || 'файл', hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    // Посилання живе, доки браузер забирає файл
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    toast(e.status === 404 ? 'Файла уже нет' : 'Не скачалось — нет связи');
  } finally {
    busy.delete(m.id);
  }
}
