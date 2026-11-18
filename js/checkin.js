// «❤️ Я в порядке»: один тап — другому push «всё хорошо», а на «Письмах» у нього видно, коли відмітились.
// Лише свіже (до двох діб) і без лічильника «давно не отмечался» — щоб кнопка не ставала обовʼязком
import { DATA, who } from './data.js';
import { h, toast, cap } from './ui.js';
import { deliver, waiting } from './outbox.js';
import { sosSlider, sosShown } from './sos.js';

const FRESH = 48 * 3600 * 1000;
const isToday = (ms) => new Date(ms).toDateString() === new Date().toDateString();
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
// Лінія пульсу, як на кардіомоніторі: бліда лінія і яскравий відрізок, що біжить по ній.
// Відрізок — «віконце», що їде вбік, з яскравою лінією всередині, яка їде назад і стоїть на місці: лише зсуви,
// їх рахує відеокарта. Анімація штриха SVG перемальовувалась щокадру й тримала процесор зайнятим (замір 18.11)
const LINE = '<polyline points="0,9 11,9 14,7 17,9 20,9 22,1 25,15 28,9 32,9 35,6 38,9 44,9"/>';
const PULSE = `<svg class="pulse-base" viewBox="0 0 44 16" aria-hidden="true">${LINE}</svg>`
  + `<span class="pulse-win" aria-hidden="true"><span class="pulse-in"><svg class="pulse-run" viewBox="0 0 44 16">${LINE}</svg></span></span>`;

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
        // «сегодня в» у згорнутому рядку ховається — лишається час
        h('span', { class: 'checkin-when' }, ...(isToday(at) ? [h('span', { class: 'checkin-day' }, 'сегодня в '), hhmm(at)] : [when(at)])))
      : null,
    DATA.partnerPush === false ? h('span', {}, `🔕 У ${me.partner === 'она' ? 'неё' : 'него'} выключены уведомления`) : null,
    n ? h('span', { class: 'checkin-wait' }, `📮 Ждёт связи: ${n === 1 ? 'одно письмо' : `${n} ${n < 5 ? 'письма' : 'писем'}`}`) : null);
}

function checkinBtn() {
  const btn = h('button', {
    type: 'button', class: 'checkin-btn',
    'aria-label': `Я в порядке: один тап, и ${who().partner} узнает, что всё хорошо`,
    onclick: () => { btn.disabled = true; btn.classList.add('is-beat'); checkIn(); },
  }, h('span', { class: 'checkin-heart', html: HEART }), h('span', { class: 'checkin-label' }, 'Я в порядке'));
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

// Над заголовком «Писем»: рядок стану, під ним в один ряд «Я в порядке» і повзунок «Нужна помощь».
// Згорнутий блок переїжджає в шапку: ❤ 🆘 ˅ праворуч від «Радовалки», стан — рядком під нею. Кожен телефон пам'ятає своє
const FOLD = 'radovalka:checkin-folded';
const isFolded = () => { try { return localStorage.getItem(FOLD) === '1'; } catch { return false; } };
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>';
const UNFOLD = 'Развернуть: «Я в порядке» и «Нужна помощь»';

// Поки на екрані картка SOS, блок сам згорнутий — інакше на малому телефоні «Написать…» їде під вкладки.
// Розгорнула вручну — до кінця цього SOS лишається розгорнутим
let sosOpened = false;
const sosOn = sosShown;
const theRow = () => document.querySelector('.checkin-row');

function paintFold(row = theRow()) {
  if (!row) return;
  const on = isFolded() || (sosOn() && !sosOpened);
  row.classList.toggle('is-folded', on);
  const fold = row.querySelector('.checkin-fold');
  fold?.setAttribute('aria-expanded', String(!on));
  fold?.setAttribute('aria-label', on ? UNFOLD : 'Свернуть в шапку');
  paintTop(row);
}

function setFold(on) {
  if (!on && sosOn()) sosOpened = true;
  try { localStorage.setItem(FOLD, on ? '1' : '0'); } catch { /* приватне вікно — просто не запам'ятає */ }
  paintFold();
}

function topHeart() {
  const btn = h('button', {
    type: 'button', class: 'top-heart',
    'aria-label': `Я в порядке: один тап, и ${who().partner} узнает, что всё хорошо`,
    onclick: () => { btn.disabled = true; btn.classList.add('is-beat'); checkIn(); },
  }, h('span', { class: 'checkin-heart', html: HEART }));
  return btn;
}

// Шапка: заповнена лише поки блок згорнутий (клас .has-checkin на .top) —
// розгорнутий не дублює стан і кнопки
function paintTop(row = theRow()) {
  const box = document.getElementById('top-checkin');
  const status = document.getElementById('top-status');
  if (!box || !status) return;
  const on = !!row?.classList.contains('is-folded');
  // Клас, а не body:has(...): :has на body змушував перераховувати стилі всієї сторінки на кожній вставці (гальмувало «Написать…»)
  document.querySelector('.top')?.classList.toggle('has-checkin', on);
  if (!on) { box.replaceChildren(); status.replaceChildren(); return; }
  status.replaceChildren(statusLine());
  box.replaceChildren(
    topHeart(),
    // 🆘 у шапці лише розгортає: сигнал іде тільки повзунком, щоб не натиснути випадково
    h('button', {
      type: 'button', class: 'top-sos', 'aria-label': 'Нужна помощь — открыть ползунок',
      onclick: () => { setFold(false); theRow()?.querySelector('.sos-thumb')?.focus(); },
    }, '🆘'),
    h('button', { type: 'button', class: 'top-fold', html: CHEVRON, 'aria-expanded': 'false', 'aria-label': UNFOLD, onclick: () => setFold(false) }));
}

export function checkinRow() {
  const row = h('div', { class: 'checkin-row' });
  const fold = h('button', { type: 'button', class: 'checkin-fold', html: CHEVRON, onclick: () => setFold(true) });
  row.append(statusLine(), h('div', { class: 'checkin-strip' }, checkinBtn(), sosSlider(), fold));
  paintFold(row);
  return row;
}

document.addEventListener('radovalka:sos', () => { if (!sosOn()) sosOpened = false; paintFold(); });

// Перемалювати стан і кнопку; повзунок не чіпаємо — його можуть саме тягнути
export function paint() {
  const row = theRow();
  if (!row) return;
  row.querySelector('.checkin-status').replaceWith(statusLine());
  row.querySelector('.checkin-btn').replaceWith(checkinBtn());
  paintTop(row);
}

document.addEventListener('radovalka:outbox', paint);
document.addEventListener('radovalka:partner-push', paint);
