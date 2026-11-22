// «🔔 Звоночек»: потрусив телефон (Радовалка відкрита) — у другого телефон вібрує, дзвенить дзвіночок
// і сиплються пелюстки сакури (у нього — зорі); закрита Радовалка в другого — push і рядок у чаті
import { DATA, who } from './data.js';
import { send } from './api.js';
import { toast, cap } from './ui.js';
import { bellFx } from './fx.js';
import { sfx } from './sound.js';

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
  sfx('ring');
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
  if (touched()) buzz();
  else afterTap(at);
  bellFx(true);
  toast(`🔔 ${cap(who().partner)} зовёт тебя`);
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
}

const buzz = () => { navigator.vibrate?.(BUZZ); sfx('bell'); };
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
