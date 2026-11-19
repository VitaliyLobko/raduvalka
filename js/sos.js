// «Нужна помощь»: провести повзунок → сигнал іде одразу, місце й голос (до 30 с) доганяють окремо.
// У другого — червона картка вгорі «Писем» з картою й голосом; у того, хто натиснув, — «увидел» і «Отбой»
import { DATA, who } from './data.js';
import { get, send, getBlob } from './api.js';
import { h, toast, cap } from './ui.js';
import { deliver, newCid } from './outbox.js';

const REC_MAX = 30;
const hhmm = (ms) => new Date(ms).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
const ago = (ms) => {
  const min = Math.round((Date.now() - ms) / 60000);
  return min < 1 ? 'только что' : min < 60 ? `${min} мин назад` : `в ${hhmm(ms)}`;
};
const mapUrl = (s) => `https://www.google.com/maps?q=${s.lat},${s.lon}`;
const pressed = (p) => (p === 'он' ? 'Он нажал' : 'Она нажала');

// «Отбой» другого — новина на годину: далі (або після «Понятно») картка зникає, хоч сервер тримає сигнал добу
const OK_SHOW = 3600 * 1000;
const OK_CLOSED = 'radovalka:sos-ok-closed';
const okClosed = (s) => { try { return localStorage.getItem(OK_CLOSED) === s.id; } catch { return false; } };
const okLive = (s) => Date.now() - s.ok < OK_SHOW && !okClosed(s);
// Чи є зараз картка SOS угорі «Писем» (від цього згортається блок «Я в порядке»)
export const sosShown = () => {
  const { theirs, mine } = DATA.sos || {};
  return !!((theirs && (!theirs.ok || okLive(theirs))) || (mine && !mine.ok));
};
let okTimer = 0;

export async function loadSos() {
  try {
    DATA.sos = await get('sos');
  } catch { /* нема зв'язку — лишаємо, що було */ }
  paintSos();
}

// Повзунок поруч із «Я в порядке»: тягнути кружечок управо до кінця. Відпустив раніше — повертається
export function sosSlider(onDone = openSos) {
  const thumb = h('button', { type: 'button', class: 'sos-thumb', 'aria-label': 'Нужна помощь: провести вправо или нажать Enter' }, '🆘');
  const label = h('span', { class: 'sos-label' }, 'Нужна помощь →');
  const track = h('div', { class: 'sos-slider' }, label, thumb);
  let start = null;
  let max = 0;
  let x = 0;
  const set = (v) => { x = v; thumb.style.transform = `translateX(${v}px)`; track.style.setProperty('--p', String(max ? v / max : 0)); };
  const reset = () => { start = null; track.classList.remove('is-drag'); set(0); };
  thumb.addEventListener('pointerdown', (e) => {
    start = e.clientX - x;
    max = track.clientWidth - thumb.offsetWidth - 8;
    track.classList.add('is-drag');
    thumb.setPointerCapture(e.pointerId);
  });
  thumb.addEventListener('pointermove', (e) => { if (start != null) set(Math.max(0, Math.min(max, e.clientX - start))); });
  thumb.addEventListener('pointerup', () => {
    if (start == null) return;
    const done = x >= max * 0.9;
    const tapped = x < 6;
    reset();
    if (done) onDone();
    else if (tapped) hint();
  });
  // Просто тапнули — кружок трохи проїжджає вправо й вертається, підказка замість напису. Сигнал не йде
  let hintTimer = 0;
  const hint = () => {
    track.classList.remove('is-nudge');
    void track.offsetWidth;
    track.classList.add('is-nudge');
    label.textContent = 'Проведи вправо →';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { label.textContent = 'Нужна помощь →'; track.classList.remove('is-nudge'); }, 2200);
  };
  thumb.addEventListener('pointercancel', reset);
  thumb.addEventListener('contextmenu', (e) => e.preventDefault());
  // З клавіатури випадково не натиснеш — Enter
  thumb.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onDone(); } });
  thumb.addEventListener('click', (e) => e.preventDefault());
  return track;
}

// Сигнал пішов — далі шторка: стан сигналу, місце, запис голосу
export async function openSos() {
  const me = who();
  const id = newCid();
  const at = Date.now();
  const lineSignal = h('p', { class: 'sos-line' }, '🚨 Отправляю сигнал…');
  const linePlace = h('p', { class: 'sos-line' }, '📍 Ищу, где ты…');
  const lineVoice = h('p', { class: 'sos-line' }, '🎙 Включаю микрофон…');
  const stopBtn = h('button', { type: 'button', class: 'btn btn-primary', disabled: true }, 'Отправить голосовое');
  const okBtn = h('button', { type: 'button', class: 'btn' }, 'Отбой: всё хорошо');
  const closeBtn = h('button', { type: 'button', class: 'btn' }, 'Закрыть');
  const backdrop = h('div', { class: 'backdrop' });
  const sheet = h('div', { class: 'sheet sos-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Нужна помощь' },
    h('div', { class: 'sheet-inner' },
      h('h2', {}, 'Нужна помощь'),
      lineSignal, linePlace, lineVoice,
      h('p', { class: 'hint' }, `Если можешь — сразу позвони ${me.toWhom}.`),
      h('div', { class: 'sheet-actions sos-actions' }, stopBtn, okBtn, closeBtn)));
  document.body.append(backdrop, sheet);

  let sent = false;
  let rec = null;
  let stream = null;
  let timer = null;
  const stopMic = () => { clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  const close = () => { if (rec?.state === 'recording') rec.stop(); stopMic(); sheet.remove(); backdrop.remove(); loadSos(); };
  closeBtn.addEventListener('click', close);

  // 1. Сигнал — одразу, нічого не чекаючи
  const signal = deliver('sos', 'sos', { id, at }).then((r) => {
    if (r.queued) {
      lineSignal.textContent = '❗ Нет связи — сигнал НЕ ушёл. Уйдёт сам, как появится интернет. Позвони, если можешь';
      lineSignal.classList.add('is-bad');
      return false;
    }
    sent = true;
    lineSignal.textContent = r.reaches
      ? `🚨 Сигнал ушёл ✓ ${cap(me.partner)} получит уведомление`
      : `🚨 Сигнал ушёл ✓ Но у ${me.partner === 'она' ? 'неё' : 'него'} выключены уведомления — увидит, когда откроет Радовалку. Позвони!`;
    if (!r.reaches) lineSignal.classList.add('is-bad');
    return true;
  }).catch(() => {
    lineSignal.textContent = '❗ Сигнал не ушёл. Попробуй ещё раз или позвони';
    lineSignal.classList.add('is-bad');
    return false;
  });

  okBtn.addEventListener('click', async () => {
    okBtn.disabled = true;
    if (!(await signal)) { close(); return; }
    try {
      await send(`sos/${id}/ok`, 'POST');
      toast('Отбой отправлен ❤️');
      close();
    } catch {
      okBtn.disabled = false;
      toast('Не отправилось — нет связи');
    }
  });

  // 2. Місце — коли знайдеться
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon, accuracy } = pos.coords;
      if (!(await signal)) { linePlace.textContent = '📍 Место есть, но без связи не ушло'; return; }
      try {
        await send(`sos/${id}`, 'PUT', { lat, lon, acc: accuracy });
        linePlace.textContent = `📍 Место ушло ✓ (точность ±${Math.round(accuracy)} м)`;
      } catch {
        linePlace.textContent = '📍 Место не ушло — нет связи';
      }
    }, () => {
      linePlace.textContent = '📍 Место не получилось: нет разрешения или GPS';
      linePlace.classList.add('is-bad');
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  } else {
    linePlace.textContent = '📍 Телефон не даёт место';
  }

  // 3. Голос — запис до 30 с, «Отправить голосовое» — раніше
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('no mic');
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!sheet.isConnected) { stopMic(); return; }
    const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 });
    const parts = [];
    rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    rec.onstop = async () => {
      stopMic();
      stopBtn.disabled = true;
      if (!sheet.isConnected || !parts.length) return;
      const blob = new Blob(parts, { type: rec.mimeType || type || 'audio/webm' });
      lineVoice.textContent = '🎙 Отправляю голосовое…';
      if (!(await signal)) { lineVoice.textContent = '🎙 Без связи голосовое не ушло'; return; }
      try {
        const data = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result).split(',')[1] || '');
          fr.onerror = rej;
          fr.readAsDataURL(blob);
        });
        await send(`sos/${id}`, 'PUT', { audio: { type: blob.type.split(';')[0], data } }, { timeout: 30000 });
        lineVoice.textContent = '🎙 Голосовое ушло ✓';
      } catch {
        lineVoice.textContent = '🎙 Голосовое не ушло — нет связи';
        lineVoice.classList.add('is-bad');
      }
    };
    rec.start(1000);
    const t0 = Date.now();
    stopBtn.disabled = false;
    const tick = () => {
      const s = Math.floor((Date.now() - t0) / 1000);
      lineVoice.textContent = `🎙 Говори: запись 0:${String(s).padStart(2, '0')} из 0:${REC_MAX}`;
      if (s >= REC_MAX && rec.state === 'recording') rec.stop();
    };
    tick();
    timer = setInterval(tick, 500);
    stopBtn.addEventListener('click', () => { if (rec.state === 'recording') rec.stop(); });
  } catch {
    stopMic();
    lineVoice.textContent = '🎙 Микрофон не включился — нет разрешения';
    lineVoice.classList.add('is-bad');
  }
}

// Голос другого: завантажити з ключем і програти тут же
function voiceBtn(s) {
  const btn = h('button', { type: 'button', class: 'btn sos-play' }, '▶ Голосовое');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const url = URL.createObjectURL(await getBlob(`sos/${s.id}/audio`));
      const audio = h('audio', { controls: true, src: url, class: 'sos-audio' });
      btn.replaceWith(audio);
      audio.play().catch(() => {});
    } catch {
      btn.disabled = false;
      toast('Голосовое не загрузилось — нет связи');
    }
  });
  return btn;
}

function theirCard(s) {
  const me = who();
  if (s.ok) {
    if (!okLive(s)) return null;
    clearTimeout(okTimer);
    okTimer = setTimeout(paintSos, s.ok + OK_SHOW - Date.now());
    return h('div', { class: 'sos-card is-ok', role: 'status' },
      h('p', {}, h('b', {}, 'Отбой ❤️ '), `${pressed(me.partner)} «Всё хорошо» в ${hhmm(s.ok)} (сигнал был в ${hhmm(s.at)})`),
      h('button', {
        type: 'button', class: 'btn sos-close',
        onclick: () => { try { localStorage.setItem(OK_CLOSED, s.id); } catch { /* приватне вікно — сховається за годину */ } paintSos(); },
      }, 'Понятно'));
  }
  const seenBtn = s.seen ? h('p', { class: 'sos-meta' }, `Ты отметил${me.youOpened === 'открыла' ? 'а' : ''}, что видишь ✓`)
    : h('button', {
      type: 'button', class: 'btn btn-primary sos-seen',
      onclick: async (e) => {
        e.currentTarget.disabled = true;
        try { await send(`sos/${s.id}/seen`, 'POST'); } catch { toast('Не отправилось — нет связи'); }
        loadSos();
      },
    }, 'Вижу');
  return h('div', { class: 'sos-card', role: 'alert' },
    h('p', { class: 'sos-title' }, '🚨 Нужна помощь'),
    h('p', { class: 'sos-meta' }, `${pressed(me.partner)} ${ago(s.at)}`),
    s.lat != null
      ? h('a', { class: 'btn sos-map', href: mapUrl(s), target: '_blank', rel: 'noopener' }, `📍 На карте${s.acc ? ` (±${s.acc} м)` : ''}`)
      : h('p', { class: 'sos-meta' }, '📍 Места пока нет'),
    s.audio ? voiceBtn(s) : h('p', { class: 'sos-meta' }, '🎙 Голосового пока нет'),
    seenBtn);
}

// Що вже показали на своїй картці — щоб помітити мить, коли прийшло «увидел»
let lastMine = null;

function mineCard(s) {
  const me = who();
  if (s.ok) return null;
  const ok = h('button', {
    type: 'button', class: 'btn sos-ok',
    onclick: async (e) => {
      e.currentTarget.disabled = true;
      try { await send(`sos/${s.id}/ok`, 'POST'); toast('Отбой отправлен ❤️'); } catch { toast('Не отправилось — нет связи'); }
      loadSos();
    },
  }, 'Отбой: всё хорошо');
  const she = me.partnerOpened === 'открыла';
  // «Увидел» щойно прийшло, поки екран відкритий, — плашка підстрибує, телефон коротко вібрує
  const fresh = !!s.seen && lastMine?.id === s.id && !lastMine.seen;
  lastMine = { id: s.id, seen: s.seen || null };
  if (fresh) navigator.vibrate?.([120, 80, 120]);
  const saw = s.seen
    ? h('p', { class: `sos-badge is-seen${fresh ? ' is-new' : ''}` }, `✓ ${cap(me.partner)} ${she ? 'увидела' : 'увидел'} в ${hhmm(s.seen)}`)
    : h('p', { class: 'sos-badge is-wait' }, `${cap(me.partner)} ещё не ${she ? 'видела' : 'видел'}`);
  return h('div', { class: 'sos-card is-mine', role: 'status' },
    h('p', {}, h('b', {}, '🆘 Сигнал отправлен '), `в ${hhmm(s.at)}`),
    saw,
    ok);
}

// Картки вгорі «Писем»: чужий сигнал важливіший за все; свій — щоб бачити, чи дійшло, і дати відбій
export function sosBox() {
  const st = DATA.sos || {};
  const theirs = st.theirs ? theirCard(st.theirs) : null;
  const mine = st.mine ? mineCard(st.mine) : null;
  return h('div', { class: 'sos-box' }, theirs, mine);
}

export function paintSos() {
  const box = document.querySelector('.sos-box');
  if (box) box.replaceWith(sosBox());
  // Блок «Я в порядке» згортається, поки є картка SOS
  document.dispatchEvent(new Event('radovalka:sos'));
}

// Наперед дати дозволи на місце й мікрофон — щоб у біді не питало
export async function sosCheck() {
  const res = [];
  await new Promise((done) => {
    if (!navigator.geolocation) { res.push('📍 нет'); done(); return; }
    navigator.geolocation.getCurrentPosition(() => { res.push('📍 место ✓'); done(); }, () => { res.push('📍 место — нет разрешения'); done(); }, { timeout: 15000 });
  });
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    res.push('🎙 микрофон ✓');
  } catch {
    res.push('🎙 микрофон — нет разрешения');
  }
  toast(res.join(', '));
}
