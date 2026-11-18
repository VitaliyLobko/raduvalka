// «❤️ Я в порядке»: один тап — другому push «всё хорошо», а на «Письмах» у нього видно, коли відмітились.
// Лише свіже (до двох діб) і без лічильника «давно не отмечался» — щоб кнопка не ставала обовʼязком
import { DATA, who } from './data.js';
import { h, toast, cap } from './ui.js';
import { deliver, waiting } from './outbox.js';
import { partnerOff } from './push.js';

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

// Праворуч від кнопки: свіжа відмітка другого, інакше — що робить кнопка
function theirLine() {
  const at = DATA.checkins?.theirs;
  const me = who();
  if (!at || Date.now() - at > FRESH) {
    return h('p', { class: 'checkin-theirs is-hint' }, `Один тап, и ${me.partner} узнает, что всё хорошо`);
  }
  return h('p', { class: 'checkin-theirs' },
    h('b', {}, me.partner === 'он' ? 'Он в порядке' : 'Она в порядке'),
    h('span', { class: 'checkin-when' }, when(at)));
}

// Кнопка на «Письмах» і ярлик з іконки (?do=checkin) — одне й те саме
export async function checkIn() {
  const at = Date.now();
  DATA.checkins = { ...DATA.checkins, mine: at };
  try {
    const r = await deliver('checkin', 'checkin', { at });
    if (r.queued) toast(`Нет связи. Отметка уйдёт сама, когда будет интернет, — с временем ${hhmm(at)}`);
    else if (r.sent) toast(`${cap(who().partner)} узнает ❤️`);
    else if (!r.reaches) toast(`Отмечено. ${cap(who().partner)} увидит, когда откроет Радовалку`);
    else toast('Отмечено ❤️');
  } catch {
    toast('Не получилось — попробуй ещё раз');
  }
  // Дати серцю добитись, потім перемалювати рядок
  setTimeout(paint, 700);
}

// Рядок на «Письмах»: кнопка, чужа відмітка і скільки листів чекає зв'язку
export function checkinRow() {
  const n = waiting();
  const btn = h('button', {
    type: 'button', class: 'checkin-btn',
    onclick: () => { btn.disabled = true; btn.classList.add('is-beat'); checkIn(); },
  }, h('span', { class: 'checkin-heart', html: HEART }), 'Я в порядке');
  return h('div', { class: 'checkin-row' },
    btn,
    theirLine(),
    partnerOff(false),
    n ? h('p', { class: 'checkin-wait' }, `📮 Ждёт связи: ${n === 1 ? 'одно письмо' : `${n} ${n < 5 ? 'письма' : 'писем'}`}`) : null);
}

// Перемалювати лише рядок — лист дня під ним не зсувається
export function paint() {
  const row = document.querySelector('.checkin-row');
  if (row) row.replaceWith(checkinRow());
}

document.addEventListener('radovalka:outbox', paint);
document.addEventListener('radovalka:partner-push', paint);
