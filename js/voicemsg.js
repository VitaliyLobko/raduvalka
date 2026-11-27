// Голосові як у месенджері: утримуєш 🎤 — іде запис, відпустив — пішло; вліво — скасувати, вгору — замок (говорити
// без пальця: 🗑 чи ➤). Будь-який збій (дзвінок, згорнули застосунок, межа в 5 хвилин) не відправляє, а зупиняє запис
// і лишає 🗑 / ➤. Не пішло через мережу — запис лишається, ➤ ще раз
import { h, toast } from './ui.js';

export const canRecord = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
// Формат запису — спільний для голосових, листів і «Нужна помощь»
export const recType = () => ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const MAX = 300;
// Коротше — це тап (диктовка чи підказка)
const HOLD = 220;
const CANCEL_DX = -90;
const LOCK_DY = -70;
const BARS = 40;
const LIVE = 20;
const TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
const SEND = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-8-6 16-3-7-7-1z"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

let cur = null;

// Рівні гучності кожні 100 мс → 40 стовпчиків 0–9 одним рядком (для пузиря в чаті)
function squeeze(levels) {
  if (!levels.length) return '';
  const out = [];
  for (let i = 0; i < BARS; i += 1) {
    const a = Math.floor((i * levels.length) / BARS);
    const b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / BARS));
    const part = levels.slice(a, b);
    out.push(part.reduce((s, v) => s + v, 0) / part.length);
  }
  const top = Math.max(...out, 0.02);
  return out.map((v) => Math.max(1, Math.min(9, Math.round((v / top) * 9)))).join('');
}

// btn — кнопка-мікрофон; onSend({ file, d, w }) → Promise<boolean> (пішло чи ні); onTap — короткий тап;
// busy() — зараз не можна (диктовка, у полі текст)
export function holdToRecord(btn, { onSend, onTap = null, busy = () => false }) {
  btn.style.touchAction = 'none';
  let timer = 0;
  let x0 = 0;
  let y0 = 0;
  let down = false;
  let held = false;
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('pointerdown', (e) => {
    held = false;
    if (e.button || busy() || cur) return;
    down = true;
    x0 = e.clientX;
    y0 = e.clientY;
    try { btn.setPointerCapture(e.pointerId); } catch { /* синтетичний дотик без живого pointerId */ }
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!down) return;
      held = true;
      start(btn, onSend, () => down);
    }, HOLD);
  });
  btn.addEventListener('pointermove', (e) => {
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (down && !held && Math.abs(dx) + Math.abs(dy) > 10) { clearTimeout(timer); down = false; return; }
    if (cur?.btn === btn && cur.state === 'hold') cur.move(dx, dy);
  });
  const up = (clean) => () => {
    clearTimeout(timer);
    if (!down) return;
    down = false;
    if (!held || cur?.btn !== btn || cur.state !== 'hold') return;
    if (clean) cur.release();
    else cur.halt();
  };
  btn.addEventListener('pointerup', up(true));
  btn.addEventListener('pointercancel', up(false));
  // Після утримання клік не має ще й запустити диктовку (слухач на фазі захоплення йде перед звичайним)
  btn.addEventListener('click', (e) => {
    if (held) { held = false; e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (onTap) { e.stopImmediatePropagation(); onTap(e); }
  }, true);
}

async function start(btn, onSend, stillDown) {
  if (!canRecord) { toast('Этот телефон не умеет записывать голос'); return; }
  // Диктовка й програвачі замовкають — інакше потраплять у запис
  document.dispatchEvent(new CustomEvent('radovalka:mic'));
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    toast('Нет доступа к микрофону — разреши его Радовалке в настройках телефона');
    return;
  }
  // Поки питали дозвіл, палець відпустили — запис не починаємо
  if (!stillDown() || cur) {
    stream.getTracks().forEach((t) => t.stop());
    if (!cur) toast('Готово! Теперь удерживай 🎤 и говори');
    return;
  }
  cur = session(btn, stream, onSend);
}

function session(btn, stream, onSend) {
  const type = recType();
  const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 });
  const parts = [];
  const levels = [];
  let ac = null;
  let an = null;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    an = ac.createAnalyser();
    an.fftSize = 512;
    ac.createMediaStreamSource(stream).connect(an);
  } catch { an = null; }
  const buf = an ? new Uint8Array(an.fftSize) : null;
  const t0 = Date.now();
  let secs = 0;
  let blob = null;
  let stopped = null;
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  rec.start(500);
  navigator.vibrate?.(20);

  const time = h('span', { class: 'vr-time' }, '0:00');
  const live = h('span', { class: 'vr-live', 'aria-hidden': 'true' }, ...Array.from({ length: LIVE }, () => h('i')));
  const hint = h('span', { class: 'vr-hint' }, '‹ влево — отмена');
  const trash = h('button', { type: 'button', class: 'vr-btn vr-trash', 'aria-label': 'Удалить запись', html: TRASH, onclick: () => s.cancel() });
  const go = h('button', { type: 'button', class: 'vr-btn vr-send', 'aria-label': 'Отправить голосовое', html: SEND, onclick: () => s.send() });
  const bar = h('div', { class: 'voice-rec', role: 'status', 'aria-live': 'polite' },
    trash, h('span', { class: 'vr-dot', 'aria-hidden': 'true' }), time, live, hint, go);
  const r = btn.getBoundingClientRect();
  const lock = h('span', { class: 'vr-lock', 'aria-hidden': 'true', html: `${LOCK}<i>↑</i>` });
  lock.style.left = `${r.left + r.width / 2}px`;
  lock.style.bottom = `${innerHeight - r.top + 10}px`;
  // Смужка лягає на рядок «Написать…» (поле до самої 🎤); 🎤 під листом — на весь рядок
  const row = document.querySelector('.cbar-row')?.getBoundingClientRect();
  const inRow = !!btn.closest('.cbar-row');
  bar.style.top = `${row?.height ? row.top : innerHeight - 64}px`;
  bar.style.height = `${row?.height || 46}px`;
  bar.style.left = '8px';
  bar.style.right = `${inRow ? innerWidth - r.left + 6 : 8}px`;
  document.body.append(bar, lock);
  document.body.classList.add('is-recording');
  btn.classList.add('is-rec');

  const tick = setInterval(() => {
    secs = (Date.now() - t0) / 1000;
    time.textContent = mmss(secs);
    if (an) {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) ** 2;
      levels.push(Math.sqrt(sum / buf.length) / 128);
      const tail = levels.slice(-LIVE);
      [...live.children].forEach((b, i) => {
        const v = tail[i - (LIVE - tail.length)] || 0;
        b.style.transform = `scaleY(${Math.max(0.12, Math.min(1, v * 6))})`;
      });
    }
    // Межа чи кнопку прибрала перемальована стрічка — зупинити й чекати рішення, не відправляти самому
    if (secs >= MAX || (s.state === 'hold' && !btn.isConnected)) s.halt();
  }, 100);
  const onHide = () => { if (document.visibilityState === 'hidden' && (s.state === 'hold' || s.state === 'lock')) s.halt(); };
  document.addEventListener('visibilitychange', onHide);

  // Зупинити запис (один раз) — проміс із готовим файлом
  const finish = () => {
    if (stopped) return stopped;
    clearInterval(tick);
    stopped = new Promise((ok) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        ac?.close().catch(() => {});
        blob = parts.length ? new Blob(parts, { type: (rec.mimeType || type || 'audio/webm').split(';')[0] }) : null;
        ok(blob);
      };
      if (rec.state !== 'inactive') rec.stop(); else rec.onstop();
    });
    return stopped;
  };
  const close = () => {
    clearInterval(tick);
    document.removeEventListener('visibilitychange', onHide);
    bar.remove();
    lock.remove();
    document.body.classList.remove('is-recording');
    btn.classList.remove('is-rec');
    if (cur === s) cur = null;
  };
  const view = (state, note = '') => {
    s.state = state;
    bar.dataset.state = state;
    hint.textContent = note || (state === 'hold' ? '‹ влево — отмена' : state === 'lock' ? 'Говори, руки свободны' : 'Отправить или удалить?');
    lock.hidden = state !== 'hold';
    btn.classList.toggle('is-rec', state === 'hold');
    // Без пальця на 🎤 смужка накриває й саму кнопку — 🗑 і ➤ у ній, випадкового тапу по 🎤 не буде
    if (state !== 'hold') bar.style.right = '8px';
  };

  const s = {
    btn,
    state: 'hold',
    move(dx, dy) {
      hint.style.transform = `translateX(${Math.min(0, dx) * 0.6}px)`;
      lock.style.transform = `translate(-50%, ${Math.min(0, dy) * 0.5}px)`;
      if (dx < CANCEL_DX) s.cancel();
      else if (dy < LOCK_DY) { navigator.vibrate?.(15); view('lock'); }
    },
    // Чисто відпустили палець — відправити (надто коротке — скасувати)
    release() {
      if (secs < 1) { s.cancel(); toast('Слишком коротко — удерживай 🎤, пока говоришь'); return; }
      s.send();
    },
    // Збій чи межа: запис зупинено, рішення — за людиною
    async halt() {
      if (s.state === 'done' || s.state === 'sending') return;
      view('done');
      await finish();
      if (!blob) { s.cancel(); return; }
    },
    cancel() {
      finish();
      navigator.vibrate?.([10, 40, 10]);
      close();
    },
    async send() {
      if (s.state === 'sending') return;
      view('sending', 'Отправляю…');
      const d = Math.max(1, Math.min(MAX, Math.round(secs)));
      const b = await finish();
      if (!b) { close(); toast('Запись пустая — попробуй ещё раз'); return; }
      const ext = /ogg/.test(b.type) ? 'ogg' : /mp4|aac|m4a/.test(b.type) ? 'm4a' : 'webm';
      const file = new File([b], `Голосовое · ${mmss(d)}.${ext}`, { type: b.type });
      let ok = false;
      try { ok = await onSend({ file, d, w: squeeze(levels) }); } catch { ok = false; }
      if (ok) { close(); return; }
      // Не пішло — запис не губимо: ➤ ще раз або 🗑
      view('done', 'Не ушло — нажми ➤ ещё раз');
    },
  };
  view('hold');
  return s;
}

// ── Голосове в чаті: ▶, хвиля (тап — перемотати), час, швидкість 1× / 1.5× / 2×, крапка «ще не слухали» ──
// Старі голосові (з «＋» до 0.4.153) — без хвилі й тривалості в описі: час із назви, хвиля — псевдо від id
const VOICE_NAME = /^Голосовое · (\d+):(\d\d)/;
export const isVoice = (m) => !!m?.file && /^audio\//.test(m.file.t || '') && (m.file.v === 1 || VOICE_NAME.test(m.file.n || ''));
export function voiceSecs(f) {
  if (f.d > 0) return f.d;
  const x = VOICE_NAME.exec(f.n || '');
  return x ? Number(x[1]) * 60 + Number(x[2]) : 0;
}
function waveOf(m) {
  const w = String(m.file.w || '');
  if (/^[1-9]{8,}$/.test(w)) return [...w].map(Number);
  let s = [...String(m.id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return Array.from({ length: BARS }, () => { s = (s * 1103515245 + 12345) >>> 0; return 2 + (s % 7); });
}
const SPEEDS = [1, 1.5, 2];
const SPEED = 'radovalka:voice-speed';
const speedNow = () => { try { const v = Number(localStorage.getItem(SPEED)); return SPEEDS.includes(v) ? v : 1; } catch { return 1; } };
const heardKey = (side) => `radovalka:heard:${side}`;
function heard(side) { try { return new Set(JSON.parse(localStorage.getItem(heardKey(side))) || []); } catch { return new Set(); } }
function markHeard(side, id) {
  const all = heard(side);
  all.add(id);
  try { localStorage.setItem(heardKey(side), JSON.stringify([...all].slice(-300))); } catch { /* приватне вікно */ }
}
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>';
const DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
// Грає лише одне голосове: нове зупиняє попереднє; запис (radovalka:mic) зупиняє будь-яке
let playing = null;
document.addEventListener('radovalka:mic', () => playing?.pause());

// load() → Promise<Blob> (стягнути й розшифрувати); save() — «Скачать»
export function voiceCard(m, { side, load, save }) {
  const f = m.file;
  const secs = voiceSecs(f);
  if (m.gone) return h('div', { class: 'voice-card is-gone' }, h('span', { class: 'vc-gone' }, `🎤 Голосовое ${secs ? mmss(secs) : ''} удалено, чтобы освободить место`));
  const fresh = !m.mine && f.v === 1 && !heard(side).has(m.id);
  const bars = waveOf(m).map((v) => { const b = h('i'); b.style.height = `${Math.round(v * 10 + 10)}%`; return b; });
  const btn = h('button', { type: 'button', class: 'vc-play', 'aria-label': `Слушать голосовое ${mmss(secs)}`, html: PLAY });
  const wave = h('span', { class: 'vc-wave', role: 'slider', tabindex: '-1', 'aria-label': 'Перемотка', 'aria-valuemin': '0', 'aria-valuemax': String(secs), 'aria-valuenow': '0' }, ...bars);
  const time = h('span', { class: 'vc-time' }, mmss(secs));
  const speed = h('button', { type: 'button', class: 'vc-speed', 'aria-label': 'Скорость' }, `${speedNow()}×`);
  const dl = h('button', { type: 'button', class: 'vc-dl', 'aria-label': 'Скачать голосовое', html: DOWN, onclick: (e) => { e.stopPropagation(); save(); } });
  const card = h('div', { class: `voice-card${fresh ? ' is-fresh' : ''}` }, btn, h('span', { class: 'vc-main' }, wave, h('span', { class: 'vc-row' }, time, fresh ? h('span', { class: 'vc-dot', 'aria-label': 'не прослушано' }) : null)), speed, dl);
  let audio = null;
  let url = null;
  let busy = false;
  const total = () => (audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : secs);
  const paint = () => {
    const all = total();
    const t = audio?.currentTime || 0;
    const p = all ? Math.min(1, t / all) : 0;
    const on = Math.round(p * bars.length);
    bars.forEach((b, i) => b.classList.toggle('is-on', i < on));
    time.textContent = audio && (t > 0 || !audio.paused) ? mmss(t) : mmss(all);
    wave.setAttribute('aria-valuenow', String(Math.round(t)));
  };
  const icon = (on) => { btn.innerHTML = on ? PAUSE : PLAY; btn.setAttribute('aria-label', on ? 'Пауза' : `Слушать голосовое ${mmss(secs)}`); card.classList.toggle('is-playing', on); };
  async function ready() {
    if (audio) return audio;
    busy = true;
    card.classList.add('is-loading');
    try {
      url = URL.createObjectURL(await load());
    } finally {
      busy = false;
      card.classList.remove('is-loading');
    }
    audio = new Audio(url);
    audio.preload = 'auto';
    audio.playbackRate = speedNow();
    audio.addEventListener('play', () => { if (playing && playing !== audio) playing.pause(); playing = audio; icon(true); });
    // Стрічку перемалювали, поки грало, — картки вже нема: дограло чи стало — файл із памʼяті геть
    audio.addEventListener('pause', () => { if (playing === audio) playing = null; icon(false); paint(); if (!card.isConnected) URL.revokeObjectURL(url); });
    audio.addEventListener('ended', () => { audio.currentTime = 0; paint(); });
    audio.addEventListener('timeupdate', paint);
    return audio;
  }
  const start = async (at = null) => {
    if (busy) return;
    try {
      const a = await ready();
      if (at != null) a.currentTime = at * total();
      if (a.paused) await a.play();
      if (fresh && card.classList.contains('is-fresh')) { card.classList.remove('is-fresh'); card.querySelector('.vc-dot')?.remove(); markHeard(side, m.id); }
    } catch (e) {
      toast(e?.status === 404 ? 'Голосового уже нет' : e?.name === 'NotAllowedError' ? 'Не играет — нажми ▶ ещё раз' : 'Не загрузилось — нет связи');
    }
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); if (audio && !audio.paused) audio.pause(); else start(); });
  wave.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = wave.getBoundingClientRect();
    start(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  });
  speed.addEventListener('click', (e) => {
    e.stopPropagation();
    const v = SPEEDS[(SPEEDS.indexOf(speedNow()) + 1) % SPEEDS.length];
    try { localStorage.setItem(SPEED, String(v)); } catch { /* приватне вікно */ }
    speed.textContent = `${v}×`;
    if (audio) audio.playbackRate = v;
  });
  return card;
}

// Раз на телефоні: підказка над 🎤 — «утримуй — голосове»
const HINT = 'radovalka:voice-hint';
export function hintOnce(btn) {
  try { if (localStorage.getItem(HINT)) return; } catch { return; }
  const r = btn.getBoundingClientRect();
  if (!r.width || document.querySelector('.voice-tip, [aria-modal="true"], .sheet, .backdrop')) return;
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  if (top !== btn && !btn.contains(top)) return;
  try { localStorage.setItem(HINT, '1'); } catch { return; }
  const tip = h('div', { class: 'voice-tip', role: 'note' }, 'Удерживай 🎤 — запишется голосовое. Тап — текст голосом');
  tip.style.right = `${Math.max(8, innerWidth - r.right)}px`;
  tip.style.bottom = `${innerHeight - r.top + 12}px`;
  const off = () => { tip.remove(); document.removeEventListener('pointerdown', off, true); };
  document.body.append(tip);
  document.addEventListener('pointerdown', off, true);
  setTimeout(off, 7000);
}
