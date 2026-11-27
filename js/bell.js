// «🔔 Звоночек»: потрусив телефон (Радовалка відкрита) — у другого телефон вібрує, дзвенить дзвіночок
// і сиплються пелюстки сакури (у нього — зорі); закрита Радовалка в другого — push і рядок у чаті
import { DATA, who } from './data.js';
import { send } from './api.js';
import { h, toast, cap } from './ui.js';
import { bellFx } from './fx.js';
import { sfx } from './sound.js';
import { seasonGust } from './depth.js';

// Сильний змах, не крок і не поворот: 3 поштовхи за 1,2 с; дзвонити — не частіше ніж раз на хвилину
const PEAK = 22;
const PEAKS = 3;
const WINDOW = 1200;
const EVERY = 60000;
const SEEN = 'radovalka:bell-seen';
// Серцебиття ≈ 4,3 с: чотири «тук-ТУК»; удари не коротші за 180 мс — коротший мотор не встигає розкрутитись і б'є слабко (той самий рисунок — у push, sw.js)
const BUZZ = [180, 100, 380, 550, 180, 100, 380, 550, 180, 100, 380, 550, 180, 100, 380];
// Дзвінок, що прийшов давніше, — не дзвонимо: Радовалку відкрили через пів години, кликати вже пізно
const FRESH = 120000;

let peaks = [];
let sentAt = 0;
let started = false;

export function startBell() {
  if (started || !('DeviceMotionEvent' in window)) return;
  started = true;
  addEventListener('devicemotion', onMotion, { passive: true });
}

function strength(e) {
  const a = e.acceleration;
  if (a && a.x != null) return Math.hypot(a.x, a.y, a.z);
  const g = e.accelerationIncludingGravity;
  return g && g.x != null ? Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81) : 0;
}

function onMotion(e) {
  if (strength(e) < PEAK) return;
  const now = Date.now();
  // Один змах дає кілька сильних вимірів поспіль — рахуємо його раз
  if (peaks.length && now - peaks[peaks.length - 1] < 150) return;
  peaks = [...peaks.filter((t) => now - t < WINDOW), now];
  if (peaks.length < PEAKS) { shaking(peaks.length); return; }
  peaks = [];
  shaking(0);
  ring();
}

// Не з замка, не з привітання і не з фону
const ready = () => DATA.side && document.visibilityState === 'visible'
  && !document.body.classList.contains('is-booting') && !document.querySelector('.lock, .welcome');

export async function ring() {
  if (!ready()) return;
  const now = Date.now();
  const partner = who().partner;
  if (now - sentAt < EVERY) { toast('🔔 Звоночек уже звенит — подожди минутку'); return; }
  sentAt = now;
  navigator.vibrate?.(40);
  sfx('ring');
  bellFx(false);
  // У неї — ще й порив за сезоном: пелюстки, листя чи сніг
  seasonGust();
  try {
    const r = await send('bell', 'POST', {});
    if (r.again) { toast('🔔 Звоночек уже звенит — подожди минутку'); return; }
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
    toast(r.reaches ? `🔔 Звоночек улетел — ${partner} услышит`
      : `🔔 Звоночек улетел. Уведомления у ${partner === 'она' ? 'неё' : 'него'} выключены — услышит, когда откроет Радовалку`);
  } catch {
    sentAt = 0;
    toast('Звоночек не улетел — нет связи');
  }
}

// Живе оновлення (live.js) приносить час останнього дзвінка для мене
export function bellArrived(at) {
  let seen = 0;
  try { seen = Number(localStorage.getItem(SEEN)) || 0; } catch { /* приватне вікно */ }
  if (!at || at <= seen) return;
  try { localStorage.setItem(SEEN, String(at)); } catch { /* приватне вікно */ }
  if (Date.now() - at > FRESH) return;
  if (touched()) buzz();
  else afterTap(at);
  bellFx(true);
  seasonGust();
  answerCard(at);
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
}

// Уночі (23:00–8:00) — лише короткий «тук», без дзвону й довгого «серцебиття»
const night = () => { const hr = new Date().getHours(); return hr >= 23 || hr < 8; };
const buzz = () => { if (night()) { navigator.vibrate?.(60); return; } navigator.vibrate?.(BUZZ); sfx('bell'); };

// Поки трусиш: після кожного засчитаного ривка — коротка вібрація й дзвіночок угорі гойдається дедалі сильніше, «1 из 3»
let shakeEl = null;
let shakeTimer = 0;
function shaking(n) {
  clearTimeout(shakeTimer);
  if (!n) { shakeEl?.remove(); shakeEl = null; return; }
  navigator.vibrate?.(25);
  if (!shakeEl) { shakeEl = h('div', { class: 'bell-shake', 'aria-live': 'polite' }); document.body.append(shakeEl); }
  shakeEl.dataset.n = String(n);
  shakeEl.replaceChildren(h('span', { class: 'bell-shake-ic', 'aria-hidden': 'true' }, '🔔'), h('span', {}, `Ещё! ${n} из ${PEAKS}`));
  shakeTimer = setTimeout(() => shaking(0), WINDOW);
}

// Тому, кого кличуть: картка «Иду / Чуть позже»; відповідь летить тому, хто кликав. Сама зникає за хвилину
let card = null;
function answerCard(at) {
  card?.remove();
  const partner = who().partner;
  const close = () => { card?.remove(); card = null; };
  const answer = async (a) => {
    close();
    try {
      await send('bell/answer', 'POST', { a });
      toast(a === 'go' ? `🏃 ${cap(partner)} узнает, что ты идёшь` : `⏳ ${cap(partner)} узнает, что ты чуть позже`);
    } catch (e) { toast(e?.status === 409 ? 'Звоночек уже старый — напиши письмом' : 'Ответ не улетел — нет связи'); }
  };
  card = h('div', { class: 'bell-card', role: 'dialog', 'aria-label': 'Звоночек' },
    h('p', { class: 'bell-card-title' }, h('span', { class: 'bell-card-ic', 'aria-hidden': 'true' }, '🔔'), `${cap(partner)} зовёт тебя`),
    h('div', { class: 'bell-card-acts' },
      h('button', { type: 'button', class: 'btn btn-primary', onclick: () => answer('go') }, '🏃 Иду!'),
      h('button', { type: 'button', class: 'btn', onclick: () => answer('later') }, '⏳ Чуть позже'),
      h('button', { type: 'button', class: 'sheet-close bell-card-x', 'aria-label': 'Закрыть', onclick: close }, '✕')));
  document.body.append(card);
  const mine = card;
  setTimeout(() => { if (card === mine) close(); }, 60000);
}

// Тому, хто кликав: прийшла відповідь (pulse) — тост, вібрація, звук; кожну — один раз
const ANS_SEEN = 'radovalka:bellans-seen';
export function bellAnswered(ans) {
  let seen = 0;
  try { seen = Number(localStorage.getItem(ANS_SEEN)) || 0; } catch { /* приватне вікно */ }
  if (!ans?.at || ans.at <= seen) return;
  try { localStorage.setItem(ANS_SEEN, String(ans.at)); } catch { /* приватне вікно */ }
  if (Date.now() - ans.at > FRESH) return;
  const partner = cap(who().partner);
  navigator.vibrate?.([60, 80, 60]);
  sfx(ans.a === 'go' ? 'pair' : 'miss', 0, 'them');
  toast(ans.a === 'go' ? `🏃 ${partner} уже идёт!` : `⏳ ${partner} подойдёт чуть позже`);
}
// Вібрацію й звук браузер дає лише після першого дотику до сторінки (відкрили з push, перемкнули половину)
const touched = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
// Тоді — за першим тапом, поки дзвінок свіжий. pointerup, а не pointerdown: на сенсорі дозвіл дає саме відпускання
let waitTap = null;
function afterTap(at) {
  if (waitTap) { removeEventListener('pointerup', waitTap, true); removeEventListener('keydown', waitTap, true); }
  waitTap = () => {
    removeEventListener('pointerup', waitTap, true);
    removeEventListener('keydown', waitTap, true);
    waitTap = null;
    if (Date.now() - at < FRESH) buzz();
  };
  addEventListener('pointerup', waitTap, true);
  addEventListener('keydown', waitTap, true);
}
