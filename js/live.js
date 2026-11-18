// Живе оновлення: поки Радовалку видно, раз на 15 с питаємо в сервера одну мітку змін; змінилась — дотягуємо свіже.
// Push будить одразу (повідомлення від service worker). Поки щось читають чи пишуть — чекаємо, щоб не збити
import { DATA } from './data.js';
import { get, isOffline } from './api.js';

const EVERY = 15000;
let seen = 0;
let busy = false;
let waiting = false;
let refresh = () => {};
let started = false;

// Розкритий лист, шторка або поле з курсором — перемальовка зараз забрала б це з-під пальця
const inUse = () => !!(document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')
  || document.querySelector('[role="dialog"], .feed-box .is-open'));

function run() {
  if (inUse()) { waiting = true; return; }
  waiting = false;
  refresh();
}

export async function check() {
  if (busy || document.visibilityState !== 'visible' || isOffline() || document.body.classList.contains('is-booting')) return;
  if (waiting) { run(); return; }
  busy = true;
  try {
    const { v, partnerPush } = await get('pulse');
    if (partnerPush !== DATA.partnerPush) {
      DATA.partnerPush = partnerPush;
      document.dispatchEvent(new CustomEvent('radovalka:partner-push'));
    }
    if (v && v !== seen) { seen = v; run(); }
  } catch { /* старий сервер чи нема зв'язку — мовчки до наступного разу */ }
  busy = false;
}

// Мітка з boot — щоб зміни між стартом і першою перевіркою не загубились і не дали зайвого оновлення
export function startLive(onChange, since) {
  refresh = onChange;
  seen = since || 0;
  waiting = false;
  // start() буває вдруге (вхід після замка, інша половина) — таймер один
  if (started) return;
  started = true;
  setInterval(check, EVERY);
  document.addEventListener('visibilitychange', check);
}
