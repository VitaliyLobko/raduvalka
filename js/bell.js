// «🔔 Звоночек»: потрусив телефон (Радовалка відкрита) — у другого телефон вібрує, дзвенить дзвіночок
// і сиплються пелюстки сакури (у нього — зорі); закрита Радовалка в другого — push і рядок у чаті
import { DATA, who } from './data.js';
import { send } from './api.js';
import { toast, cap } from './ui.js';
import { bellFx } from './fx.js';

// Сильний змах, не крок і не поворот: 3 поштовхи за 1,2 с; дзвонити — не частіше ніж раз на хвилину
const PEAK = 22;
const PEAKS = 3;
const WINDOW = 1200;
const EVERY = 60000;
const SEEN = 'radovalka:bell-seen';
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
  if (peaks.length < PEAKS) return;
  peaks = [];
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
  bellFx(false);
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
  navigator.vibrate?.([200, 100, 200, 100, 400]);
  chime();
  bellFx(true);
  toast(`🔔 ${cap(who().partner)} зовёт тебя`);
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
}

// Дзвіночок без файлу: три удари, у кожного — основний тон і два обертони, що швидко гаснуть.
// Браузер дає звук лише після першого дотику до сторінки — інакше мовчки лишаються вібрація й пелюстки
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const strike = (t0) => [[1320, 0.28, 1.4], [2640, 0.1, 0.8], [3960, 0.05, 0.5]].forEach(([f, peak, len]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + len + 0.05);
    });
    const t = ctx.currentTime + 0.05;
    [0, 0.32, 0.64].forEach((d) => strike(t + d));
    setTimeout(() => ctx.close().catch(() => {}), 2800);
  } catch { /* без звуку — не біда */ }
}
