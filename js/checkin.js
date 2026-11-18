// «❤️ Я в порядке»: один тап — другому push «всё хорошо», а на «Письмах» у нього видно, коли відмітились.
// Лише свіже (до двох діб) і без лічильника «давно не отмечался» — щоб кнопка не ставала обовʼязком
import { DATA, who } from './data.js';
import { h, toast, cap } from './ui.js';
import { deliver, waiting } from './outbox.js';
import { sosSlider } from './sos.js';

const FRESH = 48 * 3600 * 1000;
const hhmm = (ms) => new Date(ms).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });

function when(ms) {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return `сегодня в ${hhmm(ms)}`;
  if (d.toDateString() === yesterday.toDateString()) return `вчера в ${hhmm(ms)}`;
  return `${d.toLocaleDateString('ru', { weekday: 'short' })} в ${hhmm(ms)}`;
}

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
// Лінія пульсу, як на кардіомоніторі: бліда лінія і яскравий відрізок, що біжить по ній
const PULSE = '<svg viewBox="0 0 44 16" aria-hidden="true"><polyline class="pulse-base" points="0,9 11,9 14,7 17,9 20,9 22,1 25,15 28,9 32,9 35,6 38,9 44,9"/><polyline class="pulse-run" points="0,9 11,9 14,7 17,9 20,9 22,1 25,15 28,9 32,9 35,6 38,9 44,9"/></svg>';

// Дрібний рядок над кнопками: свіжа відмітка другого, вимкнені в нього сповіщення, що чекає зв'язку
function statusLine() {
  const me = who();
  const at = DATA.checkins?.theirs;
  const n = waiting();
  return h('div', { class: 'checkin-status' },
    at && Date.now() - at <= FRESH
      ? h('span', { class: 'checkin-theirs' },
        h('span', { class: 'checkin-pulse', html: PULSE }),
        h('b', {}, me.partner === 'он' ? 'Он в порядке' : 'Она в порядке'),
        h('span', { class: 'checkin-when' }, when(at)))
      : null,
    DATA.partnerPush === false ? h('span', {}, `🔕 У ${me.partner === 'она' ? 'неё' : 'него'} выключены уведомления`) : null,
    n ? h('span', { class: 'checkin-wait' }, `📮 Ждёт связи: ${n === 1 ? 'одно письмо' : `${n} ${n < 5 ? 'письма' : 'писем'}`}`) : null);
}

function checkinBtn() {
  const btn = h('button', {
    type: 'button', class: 'checkin-btn',
    'aria-label': `Я в порядке: один тап, и ${who().partner} узнает, что всё хорошо`,
    onclick: () => { btn.disabled = true; btn.classList.add('is-beat'); checkIn(); },
  }, h('span', { class: 'checkin-heart', html: HEART }), 'Я в порядке');
  return btn;
}

// Кнопка на «Письмах» і ярлик з іконки (?do=checkin) — одне й те саме
export async function checkIn() {
  const at = Date.now();
  DATA.checkins = { ...DATA.checkins, mine: at };
  try {
    const r = await deliver('checkin', 'checkin', { at });
    if (r.queued) toast(`Нет связи. Отметка уйдёт сама, когда будет интернет, — с временем ${hhmm(at)}`);
    else if (r.sent) toast(`${cap(who().partner)} узнает ❤️`);
    else if (!r.reaches) toast(`Отмечено. ${cap(who().partner)} увидит, когда откроет Радовалку`);    else toast('Отмечено ❤️');
  } catch {
    toast('Не получилось — попробуй ещё раз');
  }
  // Дати серцю добитись, потім перемалювати рядок
  setTimeout(paint, 700);
}

// Над заголовком «Писем»: рядок стану, під ним в один ряд «Я в порядке» і повзунок «Нужна помощь»
export function checkinRow() {
  return h('div', { class: 'checkin-row' },
    statusLine(),
    h('div', { class: 'checkin-strip' }, checkinBtn(), sosSlider()));
}

// Перемалювати стан і кнопку; повзунок не чіпаємо — його можуть саме тягнути
export function paint() {
  const row = document.querySelector('.checkin-row');
  if (!row) return;
  row.querySelector('.checkin-status').replaceWith(statusLine());
  row.querySelector('.checkin-btn').replaceWith(checkinBtn());
}

document.addEventListener('radovalka:outbox', paint);
document.addEventListener('radovalka:partner-push', paint);
