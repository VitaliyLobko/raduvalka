// «💚 Я в порядке»: один тап — другому push «всё хорошо», а на «Письмах» у нього видно, коли відмітились.
// Лише свіже (до двох діб) і без лічильника «давно не отмечался» — щоб кнопка не ставала обовʼязком
import { DATA, who } from './data.js';
import { h, toast, cap } from './ui.js';
import { deliver, waiting } from './outbox.js';

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

function theirLine() {
  const at = DATA.checkins?.theirs;
  if (!at || Date.now() - at > FRESH) return null;
  const did = who().partner === 'он' ? 'Он в порядке' : 'Она в порядке';
  return h('p', { class: 'checkin-theirs' }, `💚 ${did} — ${when(at)}`);
}

async function tap(btn) {
  const at = Date.now();
  btn.disabled = true;
  DATA.checkins = { ...DATA.checkins, mine: at };
  try {
    const r = await deliver('checkin', 'checkin', { at });
    if (r.queued) toast(`Нет связи. Отметка уйдёт сама, когда будет интернет, — с временем ${hhmm(at)}`);
    else if (r.sent) toast(`${cap(who().partner)} узнает 💚`);
    else if (!r.reaches) toast(`Отмечено. ${cap(who().partner)} увидит, когда откроет Радовалку`);
    else toast('Отмечено 💚');
  } catch {
    toast('Не получилось — попробуй ещё раз');
  }
  paint();
}

// Рядок на «Письмах»: кнопка, чужа відмітка і скільки листів чекає зв'язку
export function checkinRow() {
  const n = waiting();
  const btn = h('button', { type: 'button', class: 'btn checkin-btn', onclick: () => tap(btn) }, '💚 Я в порядке');
  return h('div', { class: 'checkin-row' },
    btn,
    theirLine(),
    n ? h('p', { class: 'checkin-wait' }, `📮 Ждёт связи: ${n === 1 ? 'одно письмо' : `${n} ${n < 5 ? 'письма' : 'писем'}`}`) : null);
}

// Перемалювати лише рядок — лист дня під ним не зсувається
export function paint() {
  const row = document.querySelector('.checkin-row');
  if (row) row.replaceWith(checkinRow());
}

document.addEventListener('radovalka:outbox', paint);
