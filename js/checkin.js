// «❤️ Я в порядке»: один тап — другому push «всё хорошо», а на «Письмах» у нього видно, коли відмітились.
// Лише свіже (до двох діб) і без лічильника «давно не отмечался» — щоб кнопка не ставала обовʼязком
import { DATA, who } from './data.js';
import { h, toast, cap } from './ui.js';
import { deliver, waiting } from './outbox.js';
import { send } from './api.js';
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
  // Давніше тижня день тижня вже плутає — дата
  if (Date.now() - ms > 6 * 86400000) return d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  return `${d.toLocaleDateString('ru', { weekday: 'short' })} в ${hhmm(ms)}`;
}

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
// Лінія пульсу, як на кардіомоніторі: бліда лінія і яскравий відрізок, що біжить по ній.
// Відрізок — «віконце», що їде вбік, з яскравою лінією всередині, яка їде назад і стоїть на місці: лише зсуви,
// їх рахує відеокарта. Анімація штриха SVG перемальовувалась щокадру й тримала процесор зайнятим (замір 18.11)
const LINE = '<polyline points="0,9 11,9 14,7 17,9 20,9 22,1 25,15 28,9 32,9 35,6 38,9 44,9"/>';
const PULSE = `<svg class="pulse-base" viewBox="0 0 44 16" aria-hidden="true">${LINE}</svg>`
  + `<span class="pulse-win" aria-hidden="true"><span class="pulse-in"><svg class="pulse-run" viewBox="0 0 44 16">${LINE}</svg></span></span>`;

// Давня відмітка — сіра рівна лінія: видно, що блок живий, але без докору
const FLAT = '<svg class="pulse-base" viewBox="0 0 44 16" aria-hidden="true"><polyline points="0,9 44,9"/></svg>';

// Настрій до відмітки — довге натискання на ❤ (як реакції в чаті); слово — за родом того, хто відмітився
const MOODS = { '😊': ['хорошо', 'хорошо'], '😴': ['сонный', 'сонная'], '🥱': ['устал', 'устала'], '🤒': ['приболел', 'приболела'], '😔': ['грустно', 'грустно'], '🥰': ['скучает', 'скучает'] };
const moodText = (mood, she) => (MOODS[mood] ? ` · ${mood} ${MOODS[mood][she ? 1 : 0]}` : '');
const iAmHe = () => DATA.side === 'vin';

// Відмітку другого побачили на екрані — сказати серверу один раз, у нього зʼявиться «увидела ✓»
const SEEN = 'radovalka:checkin-seen';
function markSeen(at) {
  if (!at || document.hidden) return;
  try {
    if (localStorage.getItem(`${SEEN}:${DATA.side}`) === String(at)) return;
    localStorage.setItem(`${SEEN}:${DATA.side}`, String(at));
  } catch { /* без сховища — скажемо ще раз, сервер повтор ігнорує */ }
  send('checkin/seen', 'POST', { at }).catch(() => {});
}

// Дрібний рядок над кнопками: відмітка другого (свіжість — кольором пульсу), «Как ты?», моя відмітка, сповіщення, черга
function statusLine() {
  const me = who();
  const c = DATA.checkins || {};
  const at = c.theirs;
  const she = me.partner === 'она';
  const n = waiting();
  markSeen(at);
  const fresh = at && Date.now() - at <= FRESH;
  // Сьогодні — пульс біжить; учора — блідий і спокійний; давніше — сіра рівна лінія
  const age = !at ? 'none' : isToday(at) ? 'today' : fresh ? 'old' : 'stale';
  return h('div', { class: 'checkin-status' },
    h('span', { class: `checkin-theirs is-${age}${fresh && MOODS[c.theirsMood] ? ' has-mood' : ''}` },
      h('span', { class: 'checkin-pulse', html: fresh ? PULSE : FLAT }),
      fresh ? h('b', {}, `${she ? 'Она' : 'Он'} в порядке${moodText(c.theirsMood, she)}`)
        : h('span', {}, at ? (she ? 'Отмечалась' : 'Отмечался') : 'Отметок пока не было'),
      // «сегодня в» у згорнутому рядку ховається — лишається час
      at ? h('span', { class: 'checkin-when' }, ...(isToday(at) ? [h('span', { class: 'checkin-day' }, 'сегодня в '), hhmm(at)] : [when(at)])) : null),
    askBtn(she),
    c.asked ? h('span', { class: 'checkin-asked' }, `💬 ${she ? 'Она' : 'Он'} спрашивает, как ты`) : null,
    // Моя сьогоднішня відмітка і чи її вже побачили
    c.mine && isToday(c.mine) ? h('span', { class: 'checkin-mine' },
      `❤ ты в ${hhmm(c.mine)}${MOODS[c.mineMood] ? ` ${c.mineMood}` : ''}`,
      c.mineSeen ? h('b', {}, ` · ${she ? 'увидела' : 'увидел'} ✓`) : null) : null,
    DATA.partnerPush === false ? h('span', {}, `🔕 У ${she ? 'неё' : 'него'} выключены уведомления`) : null,
    n ? h('span', { class: 'checkin-wait' }, `📮 Ждёт связи: ${n === 1 ? 'одно письмо' : `${n} ${n < 5 ? 'письма' : 'писем'}`}`) : null);
}

// «Как ты?»: другому push, у якому «❤️ Я в порядке» — одним тапом, не відкриваючи застосунок
function askBtn(she) {
  const btn = h('button', {
    type: 'button', class: 'checkin-ask', 'aria-label': `Спросить, как ${she ? 'она' : 'он'}`,
    onclick: async () => {
      btn.disabled = true;
      const asked = iAmHe() ? 'Спросил' : 'Спросила';
      try {
        const r = await send('checkin/ask', 'POST', {});
        if (r.again) toast(`Уже ${asked.toLowerCase()} — ${she ? 'она' : 'он'} ответит одним тапом`);
        else if (!r.reaches) toast(`У ${she ? 'неё' : 'него'} выключены уведомления — увидит, когда откроет Радовалку`);
        else toast(`${asked} 🫶 ${cap(she ? 'она' : 'он')} ответит одним тапом`);
      } catch {
        toast('Не получилось — нет связи');
      }
      btn.disabled = false;
    },
  }, '💬 Как ты?');
  return btn;
}

// Довге натискання на ❤ — вибрати настрій; після нього клік не має ще й відмітити без настрою
function holdForMood(btn) {
  let timer = 0;
  let held = false;
  btn.addEventListener('pointerdown', () => {
    held = false;
    clearTimeout(timer);
    timer = setTimeout(() => { held = true; navigator.vibrate?.(15); openMoods(btn); }, 450);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, () => clearTimeout(timer));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('click', (e) => { if (held) { held = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  return btn;
}

function openMoods(btn) {
  document.querySelector('.react-layer')?.remove();
  const r = btn.getBoundingClientRect();
  const close = () => layer.remove();
  const pick = h('div', { class: 'react-pick', role: 'menu', 'aria-label': 'Как ты?' },
    ...Object.keys(MOODS).map((e) => h('button', {
      type: 'button', role: 'menuitem', class: 'react-opt', 'aria-label': e,
      onclick: (ev) => { ev.stopPropagation(); close(); btn.disabled = true; btn.classList.add('is-beat'); checkIn(e); },
    }, e)));
  // Палець, що щойно відпустили після довгого натискання, теж «клацає» — перші пів секунди шар не закривається
  const opened = Date.now();
  const layer = h('div', { class: 'react-layer', onclick: () => { if (Date.now() - opened > 500) close(); } }, pick);
  document.body.append(layer);
  const w = pick.offsetWidth;
  pick.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  pick.style.top = `${r.top > 70 ? r.top - 58 : r.bottom + 8}px`;
}

const HEART_LABEL = () => `Я в порядке: один тап, и ${who().partner} узнает, что всё хорошо. Подержи — добавить настроение`;

function checkinBtn() {
  const btn = h('button', {
    type: 'button', class: 'checkin-btn', 'aria-label': HEART_LABEL(),
    onclick: () => { btn.disabled = true; btn.classList.add('is-beat'); checkIn(); },
  }, h('span', { class: 'checkin-heart', html: HEART }), h('span', { class: 'checkin-label' }, 'Я в порядке'));
  return holdForMood(btn);
}

// Підказка про настрій — один раз, після першої звичайної відмітки
const MOOD_TIP = 'radovalka:mood-tip';
function moodTip() {
  try {
    if (localStorage.getItem(MOOD_TIP)) return '';
    localStorage.setItem(MOOD_TIP, '1');
    return ' Подержи ❤, чтобы добавить настроение';
  } catch { return ''; }
}

// Кнопка на «Письмах» і ярлик з іконки (?do=checkin) — одне й те саме
export async function checkIn(mood = null) {
  const at = Date.now();
  // Нова відмітка: «увидела ✓» ще нема, «как ты?» уже відповіли
  DATA.checkins = { ...DATA.checkins, mine: at, mineMood: mood, mineSeen: false, asked: null };
  const tip = mood ? '' : moodTip();
  try {
    const r = await deliver('checkin', 'checkin', mood ? { at, mood } : { at });
    if (r.queued) toast(`Нет связи. Отметка уйдёт сама, когда будет интернет, — с временем ${hhmm(at)}`);
    else if (r.sent) toast(`${cap(who().partner)} узнает ❤️${tip}`);
    else if (!r.reaches) toast(`Отмечено. ${cap(who().partner)} увидит, когда откроет Радовалку`);
    else toast(`Отмечено ❤️${tip}`);
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
    type: 'button', class: 'top-heart', 'aria-label': HEART_LABEL(),
    onclick: () => { btn.disabled = true; btn.classList.add('is-beat'); checkIn(); },
  }, h('span', { class: 'checkin-heart', html: HEART }));
  return holdForMood(btn);
}

// Інші вкладки: шапка завжди як згорнутий блок (❤ 🆘 і стан), 🆘 веде на «Письма» до повзунка. away — як туди перейти
let away = null;
export function awayTop(goLetters) {
  away = goLetters;
  paintTop(null);
}

// Шапка: заповнена, поки блок згорнутий (клас .has-checkin на .top) або ми не на «Письмах» —
// розгорнутий не дублює стан і кнопки
function paintTop(row = theRow()) {
  const box = document.getElementById('top-checkin');
  const status = document.getElementById('top-status');
  if (!box || !status) return;
  const on = !!away || !!row?.classList.contains('is-folded');
  // Клас, а не body:has(...): :has на body змушував перераховувати стилі всієї сторінки на кожній вставці (гальмувало «Написать…»)
  document.querySelector('.top')?.classList.toggle('has-checkin', on);
  if (!on) { box.replaceChildren(); status.replaceChildren(); return; }
  status.replaceChildren(statusLine());
  const toSos = () => {
    setFold(false);
    if (away) away();
    setTimeout(() => theRow()?.querySelector('.sos-thumb')?.focus(), 50);
  };
  box.replaceChildren(
    topHeart(),
    // 🆘 у шапці лише розгортає: сигнал іде тільки повзунком, щоб не натиснути випадково
    h('button', { type: 'button', class: 'top-sos', 'aria-label': 'Нужна помощь — открыть ползунок', onclick: toSos }, '🆘'),
    // Розгорнути є куди лише на «Письмах»
    ...(away ? [] : [h('button', { type: 'button', class: 'top-fold', html: CHEVRON, 'aria-expanded': 'false', 'aria-label': UNFOLD, onclick: () => setFold(false) })]));
}

export function checkinRow() {
  away = null;
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
  if (!row) { if (away) paintTop(null); return; }
  row.querySelector('.checkin-status').replaceWith(statusLine());
  row.querySelector('.checkin-btn').replaceWith(checkinBtn());
  paintTop(row);
}

document.addEventListener('radovalka:outbox', paint);
document.addEventListener('radovalka:partner-push', paint);
