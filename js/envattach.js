// Вкладення листа в конверт: одне фото чи гифка з підписом, голос (до хвилини), пісня файлом чи посиланням.
// Модуль вантажиться лише тоді, коли щось прикріплюють або відкривають конверт із вкладенням (лежить у кеші оболонки)
import { API, getKey } from './api.js';
import { sealBody, sealFile, openBlob, openDeep } from './seal.js';
import { h, toast } from './ui.js';
import { media, gifFrame, freeCap, freeStyle, prepare, prepareError, sendError } from './memes.js';
import { openGifs } from './maker.js';

const VOICE_MAX = 60;
const SONG_MAX = 25 * 1024 * 1024;
const LABEL = 'Прикрепить';
// Що несуть байтами (R2), а що — лише описом
export const hasBytes = (a) => ['photo', 'voice', 'song'].includes(a?.k);

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Посилання на пісню: лише http(s) — і коли прикріплюють, і коли відкривають
export function songLink(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : null;
  } catch { return null; }
}
const SERVICES = [
  [/^music\.youtube\.com$/, 'YouTube Music'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)spotify\.(com|link)$/, 'Spotify'],
  [/^music\.apple\.com$/, 'Apple Music'],
  [/(^|\.)soundcloud\.com$/, 'SoundCloud'],
  [/(^|\.)deezer\.(com|page\.link)$/, 'Deezer'],
  [/(^|\.)tidal\.com$/, 'Tidal'],
];
export function service(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\.|^m\./, '');
    return SERVICES.find(([re]) => re.test(host))?.[1] || host;
  } catch { return ''; }
}

// Коротко, що прикріплено: для рядка у «Написать» і в надісланому
export function attachLine(a) {
  if (!a) return '';
  if (a.gone) return '📎 вложение удалено, чтобы освободить место';
  if (a.k === 'photo') return '📷 фото';
  if (a.k === 'gif') return '🎞 гифка';
  if (a.k === 'voice') return `🎤 голос · ${mmss(a.d || 0)}`;
  if (a.k === 'song') return `🎵 ${a.n || 'песня'}`;
  if (a.k === 'link') return `🔗 песня · ${service(a.url)}`;
  return '📎 вложение';
}

// ── Вибір ──
// Фото з галереї — той самий редактор, що й для чату; «Отправить» стає «Прикрепить»
export async function pickPhoto(file, onAtt) {
  let blob;
  try { blob = await prepare(file); } catch (e) { toast(prepareError(e)); return; }
  const { photoEditor } = await import('./photoedit.js');
  photoEditor(blob, {
    label: LABEL,
    fail: sendError,
    send: async (out, cap) => onAtt({ k: 'photo', blob: out, t: out.type, cap: cap || null }),
  });
}

export function pickGif(onAtt) {
  openGifs(async (gif) => {
    const { gifEditor } = await import('./gifedit.js');
    gifEditor(gif, { label: LABEL, fail: sendError, send: async (cap, style) => onAtt({ k: 'gif', gif, cap: cap || null, style }) });
  });
}

// Шторка поверх «Написать»: заголовок, ✕, тіло; onClose — прибрати мікрофон
function sheet(title, onClose) {
  const body = h('div', { class: 'duel-body ea-body' });
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const backdrop = h('div', { class: 'backdrop ea-backdrop', onclick: () => close() });
  const el = h('div', { class: 'sheet duel-sheet ea-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-inner' },
      h('div', { class: 'duel-head' },
        h('h2', {}, title),
        h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: () => close() }, '✕')),
      body));
  function close() {
    onClose?.();
    el.remove();
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
  }
  document.body.append(backdrop, el);
  document.addEventListener('keydown', onKey, true);
  return { body, close };
}

// «🎵 Музыка»: голос, посилання чи файл
export function pickMusic(onAtt) {
  let stopMic = null;
  const sh = sheet('🎵 Музыкальное письмо', () => stopMic?.());
  const done = (a) => { onAtt(a); sh.close(); };
  const file = h('input', {
    type: 'file', accept: 'audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac', class: 'visually-hidden',
    onchange: (e) => {
      const [f] = e.target.files;
      e.target.value = '';
      if (!f) return;
      if (!f.size) { toast('Файл пустой'); return; }
      if (f.size > SONG_MAX) { toast('Песня больше 25 МБ — выбери файл поменьше'); return; }
      const t = /^audio\//.test(f.type) ? f.type : 'audio/mpeg';
      done({ k: 'song', blob: f, t, n: (f.name || 'песня').replace(/\.[a-z0-9]{2,4}$/i, '').slice(0, 120) });
    },
  });
  const row = (ic, title, sub, attrs, ...extra) => h(attrs.tag || 'button', { type: attrs.tag ? null : 'button', class: 'ea-choice', onclick: attrs.onclick },
    ...extra,
    h('span', { class: 'ea-choice-ic', 'aria-hidden': 'true' }, ic),
    h('span', { class: 'ea-choice-text' }, h('b', {}, title), h('small', {}, sub)));
  const menu = () => sh.body.replaceChildren(
    row('🎤', 'Записать голос', 'До минуты: скажи или спой', { onclick: () => { stopMic = recorder(sh.body, done, menu); } }),
    row('🔗', 'Ссылка на песню', 'YouTube, Spotify, Apple Music…', { onclick: () => linkForm(sh.body, done, menu) }),
    row('🎵', 'Файл с песней', 'MP3, M4A — до 25 МБ, сыграет прямо в письме', { tag: 'label' }, file));
  menu();
}

function linkForm(body, done, back) {
  const input = h('input', { type: 'url', class: 'ea-link-input', inputmode: 'url', placeholder: 'https://…', 'aria-label': 'Ссылка на песню', autocomplete: 'off' });
  const hint = h('p', { class: 'ea-hint' }, 'Скопируй ссылку в приложении с музыкой: «Поделиться» → «Копировать ссылку»');
  const take = h('button', { type: 'button', class: 'btn btn-primary' }, LABEL);
  const go = () => {
    const url = songLink(input.value);
    if (!url) { hint.textContent = 'Это не похоже на ссылку — нужна вида https://…'; hint.classList.add('is-bad'); input.focus(); return; }
    done({ k: 'link', url });
  };
  take.addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  body.replaceChildren(input, hint, h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: back }, 'Назад'), take));
  input.focus();
}

// Запис голосу: велика кнопка, таймер до хвилини, прослухати, перезаписати, прикріпити. Повертає «вимкнути мікрофон»
function recorder(body, done, back) {
  let stream = null;
  let rec = null;
  let timer = 0;
  let t0 = 0;
  let got = null;
  let preview = null;
  const time = h('p', { class: 'ea-rec-time', 'aria-live': 'polite' }, `0:00 из ${mmss(VOICE_MAX)}`);
  const big = h('button', { type: 'button', class: 'ea-rec', 'aria-label': 'Начать запись' }, h('span', { 'aria-hidden': 'true' }, '🎤'));
  const slot = h('div', { class: 'ea-rec-slot' });
  const take = h('button', { type: 'button', class: 'btn btn-primary', disabled: true }, LABEL);
  const mic = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  const stop = () => { clearInterval(timer); if (rec?.state === 'recording') rec.stop(); else mic(); };
  const start = async () => {
    preview?.stop();
    preview = null;
    got = null;
    slot.replaceChildren();
    take.disabled = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('no mic');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      time.textContent = 'Нет доступа к микрофону — разреши его Радовалке в настройках телефона';
      return;
    }
    if (!body.isConnected) { mic(); return; }
    const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 });
    const parts = [];
    rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    rec.onstop = () => {
      mic();
      big.classList.remove('is-on');
      big.setAttribute('aria-label', 'Записать заново');
      const d = Math.max(1, Math.min(VOICE_MAX, Math.round((Date.now() - t0) / 1000)));
      if (!parts.length || !body.isConnected) return;
      const blob = new Blob(parts, { type: (rec.mimeType || type || 'audio/webm').split(';')[0] });
      got = { k: 'voice', blob, t: blob.type, d };
      time.textContent = `Записано ${mmss(d)} — послушай или запиши заново`;
      preview = player(blob, '🎤 Голос', d);
      slot.replaceChildren(preview.el);
      take.disabled = false;
    };
    rec.start(500);
    t0 = Date.now();
    big.classList.add('is-on');
    big.setAttribute('aria-label', 'Остановить запись');
    const tick = () => {
      const s = (Date.now() - t0) / 1000;
      time.textContent = `● ${mmss(s)} из ${mmss(VOICE_MAX)}`;
      if (s >= VOICE_MAX) stop();
    };
    tick();
    timer = setInterval(tick, 250);
  };
  big.addEventListener('click', () => (rec?.state === 'recording' ? stop() : start()));
  take.addEventListener('click', () => { if (got) { preview?.stop(); done(got); } });
  body.replaceChildren(big, time, slot,
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: () => { stop(); preview?.stop(); back(); } }, 'Назад'), take));
  return () => { stop(); preview?.stop(); };
}

// ── Програвач: ▶/⏸, смуга перемотки, час. d — тривалість, якщо файл її не каже (запис із телефона) ──
export function player(blob, title, d = 0) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.src = url;
  const btn = h('button', { type: 'button', class: 'ea-play', 'aria-label': 'Слушать' }, '▶');
  const seek = h('input', { type: 'range', class: 'ea-seek', min: '0', max: '1000', value: '0', step: '1', 'aria-label': 'Перемотка' });
  const time = h('span', { class: 'ea-time' }, d ? mmss(d) : '');
  const total = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : d);
  const paint = () => {
    const all = total();
    seek.value = String(all ? Math.round((audio.currentTime / all) * 1000) : 0);
    seek.style.setProperty('--p', `${seek.value / 10}%`);
    time.textContent = all ? `${mmss(audio.currentTime)} / ${mmss(all)}` : mmss(audio.currentTime);
  };
  btn.addEventListener('click', () => { if (audio.paused) audio.play().catch(() => toast('Не играет — попробуй ещё раз')); else audio.pause(); });
  audio.addEventListener('play', () => { btn.textContent = '⏸'; btn.setAttribute('aria-label', 'Пауза'); });
  audio.addEventListener('pause', () => { btn.textContent = '▶'; btn.setAttribute('aria-label', 'Слушать'); });
  audio.addEventListener('ended', () => { audio.currentTime = 0; paint(); });
  audio.addEventListener('timeupdate', paint);
  audio.addEventListener('loadedmetadata', paint);
  seek.addEventListener('input', () => { const all = total(); if (all) audio.currentTime = (seek.value / 1000) * all; paint(); });
  const el = h('div', { class: 'ea-player' }, btn,
    h('div', { class: 'ea-player-main' }, h('b', { class: 'ea-player-title' }, title), seek, time));
  return { el, stop: () => { audio.pause(); audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); } };
}

// ── Рядок у «Написать»: що прикріплено, ✕ — прибрати ──
export function attachChip(a, onRemove) {
  let thumb = null;
  let url = null;
  if (a.k === 'photo') { url = URL.createObjectURL(a.blob); thumb = h('img', { src: url, alt: '' }); }
  if (a.k === 'gif') thumb = media(a.gif.url, '', a.gif.url);
  const el = h('div', { class: 'write-att-chip' },
    thumb ? h('span', { class: 'write-att-thumb' }, thumb) : null,
    h('span', { class: 'write-att-text' }, attachLine(a)),
    h('button', {
      type: 'button', class: 'write-att-x', 'aria-label': 'Убрать вложение',
      onclick: () => { if (url) URL.revokeObjectURL(url); onRemove(); },
    }, '✕'));
  return el;
}

// Опис для сервера: лише те, що він зберігає (підпис, назва й посилання шифрує sealBody)
export function mediaBody(a) {
  if (a.k === 'gif') return { k: 'gif', gif: a.gif.url, cap: a.cap || null, style: a.style || null };
  if (a.k === 'link') return { k: 'link', url: a.url };
  return { k: a.k, t: a.t, ...(a.d ? { d: a.d } : {}), ...(a.n ? { n: a.n } : {}), ...(a.cap ? { cap: a.cap } : {}) };
}

// Лист із байтами — одним запитом: 4 байти довжини ‖ JSON листа (зашифровані поля) ‖ байти (RAD1). Без черги:
// такий лист завеликий для телефона без звʼязку — краще чесно сказати «не пішло»
export async function sendAttached(letter, a, onProgress) {
  const plain = { ...letter, media: mediaBody(a) };
  const [sealed, bytes] = await Promise.all([sealBody('letters/attach', plain), sealFile(a.blob)]);
  const json = new TextEncoder().encode(JSON.stringify(sealed));
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, json.byteLength);
  const body = new Blob([len, json, bytes], { type: 'application/octet-stream' });
  const out = await new Promise((ok, no) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/letters/attach`);
    xhr.setRequestHeader('authorization', `Bearer ${getKey()}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let j = null;
      try { j = JSON.parse(xhr.responseText); } catch { /* не JSON */ }
      if (xhr.status < 300 && j) ok(j);
      else no(Object.assign(new Error(`api ${xhr.status}`), { status: xhr.status, code: j?.error }));
    };
    xhr.onerror = () => no(new Error('net'));
    xhr.send(body);
  });
  return openDeep(out);
}
export function attachError(e) {
  if (e?.status === 429) return 'На сегодня лимит файлов исчерпан — попробуй завтра';
  if (e?.status === 413) return 'Слишком большой файл — до 25 МБ';
  if (e?.status === 415) return 'Такой файл не подходит — нужна песня MP3 или M4A';
  if (e?.status) return `Сервер не принял (код ${e.status}${e.code ? `, ${e.code}` : ''}). Попробуй ещё раз`;
  return 'Нет связи — письмо с вложением не ушло. Попробуй ещё раз, когда появится интернет';
}

// ── Відкриття конверта: вкладення над текстом. Кидає помилку, якщо не завантажилось (конверт лишається запечатаним);
// стерте (місце в сховищі) — лише напис ──
async function bytesOf(id, t) {
  const res = await fetch(`${API}/api/letters/${id}/file`, { headers: { authorization: `Bearer ${getKey()}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw Object.assign(new Error(`api ${res.status}`), { status: res.status });
  const plain = await openBlob(await res.blob());
  return new Blob([plain], { type: t || 'application/octet-stream' });
}
export async function renderAttach(note) {
  const a = note.media;
  const gone = () => ({ el: h('p', { class: 'ea-gone' }, attachLine({ gone: true })), stop: () => {} });
  if (!a || a.gone) return gone();
  if (a.k === 'gif') {
    const el = media(a.gif, 'Гифка в письме', a.gif);
    const free = a.cap && freeStyle(a.style);
    return {
      el: h('div', { class: 'ea-gif' }, free ? gifFrame(el, freeCap(free, a.cap)) : gifFrame(el), !free && a.cap ? h('p', { class: 'ea-cap' }, a.cap) : null),
      stop: () => {},
    };
  }
  if (a.k === 'link') {
    const url = songLink(a.url);
    if (!url) return { el: h('p', { class: 'ea-gone' }, '🔗 Ссылка на песню не открылась'), stop: () => {} };
    return {
      el: h('a', { class: 'ea-song-link', href: url, target: '_blank', rel: 'noopener noreferrer' },
        h('span', { class: 'ea-song-play', 'aria-hidden': 'true' }, '▶'),
        h('span', { class: 'ea-choice-text' }, h('b', {}, 'Песня для тебя'), h('small', {}, `Слушать в ${service(url)}`))),
      stop: () => {},
    };
  }
  const blob = await bytesOf(note.id, a.t);
  if (!blob) return gone();
  if (a.k === 'photo') {
    const url = URL.createObjectURL(blob);
    return {
      el: h('figure', { class: 'ea-photo' }, h('img', { src: url, alt: 'Фото в письме' }), a.cap ? h('figcaption', { class: 'ea-cap' }, a.cap) : null),
      stop: () => URL.revokeObjectURL(url),
    };
  }
  const p = player(blob, a.k === 'voice' ? '🎤 Голосовое письмо' : `🎵 ${a.n || 'Песня для тебя'}`, a.d || 0);
  return p;
}
