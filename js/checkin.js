// «❤️ Я в порядке»: один тап — другому push «всё хорошо», а на «Письмах» у нього видно, коли відмітились.
// Лише свіже (до двох діб) і без лічильника «давно не отмечался» — щоб кнопка не ставала обовʼязком
import { DATA, who } from './data.js';
import { h, toast, cap, ribbon } from './ui.js';
import { deliver, waiting } from './outbox.js';
import { send } from './api.js';
import { burst } from './fx.js';
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
  // «в воскресенье, 10:14» — повністю й у правильному відмінку, а не «вс в 10:14»
  return `${['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'][d.getDay()]}, ${hhmm(ms)}`;
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
const MOODS = {
  '😊': ['хорошо', 'хорошо'], '😴': ['устал', 'устала'], '🤒': ['приболел', 'приболела'], '😔': ['грустно', 'грустно'],
  '🥰': ['скучает', 'скучает'], '🤯': ['завал', 'завал'], '🤗': ['обнимашки', 'обнимашки'], '😤': ['злится', 'злится'],
  '🥶': ['замёрз', 'замёрзла'], '🥵': ['жарко', 'жарко'], '🙃': ['ну такое', 'ну такое'], '🍓': ['игривый', 'игривая'],
  // Уже не пропонується (злили з 😴), але давні відмітки з ним показуємо як було
  '🥱': ['устал', 'устала'],
};
// Що пропонувати; не влазять в рядок — у відповіді гортаються стрічкою, у виборі настрою — вбік
// Слово настрою для чату: female — про неї
export const moodWord = (emoji, female) => MOODS[emoji]?.[female ? 1 : 0] || '';
const PICK = ['😊', '😴', '🤒', '😔', '🥰', '🍓', '🤯', '🤗', '😤', '🥶', '🥵', '🙃'];
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

let lastTheirs = null;
let flashUntil = 0;

// Дрібний рядок над кнопками: відмітка другого (свіжість — кольором пульсу), «Как ты?», моя відмітка, сповіщення, черга
function statusLine() {
  const me = who();
  const c = DATA.checkins || {};
  const at = c.theirs;
  const she = me.partner === 'она';
  const n = waiting();
  markSeen(at);
  // Свіжа відмітка прийшла, поки застосунок відкритий, — пігулка на мить підсвічується (і в блоці, і в шапці)
  if (at && lastTheirs && at !== lastTheirs) flashUntil = Date.now() + 1500;
  if (at) lastTheirs = at;
  const fresh = at && Date.now() - at <= FRESH;
  // Сьогодні — пульс біжить; учора — блідий і спокійний; давніше — сіра рівна лінія
  const age = !at ? 'none' : isToday(at) ? 'today' : fresh ? 'old' : 'stale';
  return h('div', { class: 'checkin-status' },
    h('span', { class: `checkin-theirs is-${age}${Date.now() < flashUntil ? ' is-fresh' : ''}` },
      h('span', { class: 'checkin-pulse', html: fresh ? PULSE : FLAT }),
      // Коротко: «Он 👌», а з настроєм — його значок замість 👌 і слово поруч (у згорнутому слово ховається)
      fresh ? h('b', { 'aria-label': `${she ? 'Она' : 'Он'} в порядке` }, h('span', { class: 'checkin-who' }, `${she ? 'Она' : 'Он'} `), MOODS[c.theirsMood] ? c.theirsMood : '👌',
        MOODS[c.theirsMood] ? h('span', { class: 'checkin-moodword' }, ` ${MOODS[c.theirsMood][she ? 1 : 0]}`) : null)
        : h('span', {}, at ? (she ? 'Отмечалась' : 'Отмечался') : 'Отметок пока не было'),
      // «сегодня в» у згорнутому рядку ховається — лишається час
      at ? h('span', { class: 'checkin-when' }, ...(isToday(at) ? [h('span', { class: 'checkin-day' }, 'сегодня в '), hhmm(at)] : [when(at)])) : null),
    askBtn(she),
    // Спитали «как ты?» — відповісти одним тапом смайликом (це й відмітка «в порядке» з настроєм)
    c.asked ? h('span', { class: 'checkin-asked' }, `💬 ${she ? 'Она' : 'Он'} спрашивает, как ты:`, answerRow()) : null,
    // Моя сьогоднішня відмітка і чи її вже побачили
    c.mine && isToday(c.mine) ? h('span', { class: 'checkin-mine' },
      `❤ ты в ${hhmm(c.mine)}${MOODS[c.mineMood] ? ` ${c.mineMood}` : ''}`,
      c.mineSeen ? h('b', {}, ` · ${she ? 'увидела' : 'увидел'} ✓`) : null) : null,
    DATA.partnerPush === false ? h('span', { class: 'checkin-nopush' }, `🔕 У ${she ? 'неё' : 'него'} выключены уведомления`) : null,
    n ? h('span', { class: 'checkin-wait' }, `📮 Ждёт связи: ${n === 1 ? 'одно письмо' : `${n} ${n < 5 ? 'письма' : 'писем'}`}`) : null);
}

// Значок «Как ты?»: залита хмаринка кольором пульсу з білим знаком питання
const ASK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="ask-cloud" d="M12 3C6.8 3 3 6.4 3 10.6c0 2.3 1.2 4.4 3.1 5.8L5.3 20l4.1-2.2c.8.2 1.7.3 2.6.3 5.2 0 9-3.4 9-7.5S17.2 3 12 3z"/><path class="ask-q" d="M9.6 8.2a2.5 2.5 0 0 1 4.9.7c0 1.6-2.4 2-2.4 3.4"/><circle class="ask-dot" cx="12.1" cy="15" r="1.2"/></svg>';

// Відповідь на «как ты?» смайликами: один рядок, а не влазять — стрічкою, як усі стрічки застосунку
function answerRow() {
  const row = h('div', { class: 'checkin-answer' }, ...PICK.map((e) => h('button', {
    type: 'button', class: 'react-opt', 'aria-label': `Ответить: ${e}`,
    onclick: (ev) => { burst(ev.currentTarget, e, 8); row.querySelectorAll('button').forEach((b) => { b.disabled = true; }); checkIn(e); },
  }, e)));
  ribbon(row);
  return row;
}

// «Как ты?»: другому push, у якому «❤️ Я в порядке» — одним тапом, не відкриваючи застосунок
function askBtn(she) {
  const btn = h('button', {
    type: 'button', class: 'checkin-ask', 'aria-label': `Спросить, как ${she ? 'она' : 'он'}`, title: 'Как ты?',
    onclick: async () => {
      btn.disabled = true;
      const asked = iAmHe() ? 'Спросил' : 'Спросила';
      try {
        const r = await send('checkin/ask', 'POST', {});
        // Пішло — хмаринка підстрибує
        if (!r.again) { btn.classList.remove('is-sent'); void btn.offsetWidth; btn.classList.add('is-sent'); document.dispatchEvent(new CustomEvent('radovalka:marked')); }
        if (r.again) toast(`Уже ${asked.toLowerCase()} — ${she ? 'она' : 'он'} ответит одним тапом`);
        else if (!r.reaches) toast(`У ${she ? 'неё' : 'него'} выключены уведомления — увидит, когда откроет Радовалку`);
        else toast(`${asked} 🫶 ${cap(she ? 'она' : 'он')} ответит одним тапом`);
      } catch {
        toast('Не получилось — нет связи');
      }
      btn.disabled = false;
    },
  }, h('span', { class: 'ask-icon', html: ASK }));
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
  // Палець, що щойно відпустили після довгого натискання, теж «клацає» — перші пів секунди ні шар, ні смайлики не реагують
  const opened = Date.now();
  const fresh = () => Date.now() - opened < 500;
  const pick = h('div', { class: 'react-pick mood-pick', role: 'menu', 'aria-label': 'Как ты?' },
    ...PICK.map((e) => h('button', {
      type: 'button', role: 'menuitem', class: 'react-opt', 'aria-label': e,
      onclick: (ev) => { ev.stopPropagation(); if (fresh()) return; burst(ev.currentTarget, e, 8); close(); btn.disabled = true; btn.classList.add('is-beat'); checkIn(e); },
    }, e)));
  const layer = h('div', { class: 'react-layer', onclick: () => { if (!fresh()) close(); } }, pick);
  document.body.append(layer);
  const w = pick.offsetWidth;
  pick.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  // Над кнопкою цілком (у вікні два рядки) — щоб палець не опинився на смайлику; нема місця згори — під кнопкою
  const ph = pick.offsetHeight;
  pick.style.top = `${r.top > ph + 16 ? r.top - ph - 8 : r.bottom + 8}px`;
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
    // Рядок «Я в порядке» у чаті — одразу, не чекаючи живого оновлення
    if (!r.queued) document.dispatchEvent(new CustomEvent('radovalka:marked'));
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
    // Другий спитав «как ты?» — крапка на серці: відповідь — тап по ньому
    type: 'button', class: `top-heart${DATA.checkins?.asked ? ' is-asked' : ''}`, 'aria-label': HEART_LABEL(),
    onclick: () => { btn.disabled = true; btn.classList.add('is-beat'); checkIn(); },
  }, h('span', { class: 'checkin-heart', html: HEART }));
  return holdForMood(btn);
}

// Шапка: заповнена, поки блок згорнутий (клас .has-checkin на .top) — розгорнутий не дублює стан і кнопки.
// Блок однаковий на всіх вкладках
function paintTop(row = theRow()) {
  const box = document.getElementById('top-checkin');
  const status = document.getElementById('top-status');
  if (!box || !status) return;
  const on = !!row?.classList.contains('is-folded');
  // Клас, а не body:has(...): :has на body змушував перераховувати стилі всієї сторінки на кожній вставці (гальмувало «Написать…»)
  document.querySelector('.top')?.classList.toggle('has-checkin', on);
  if (!on) { box.replaceChildren(); status.replaceChildren(); return; }
  status.replaceChildren(statusLine());
  const toSos = () => {
    setFold(false);
    theRow()?.querySelector('.sos-thumb')?.focus();
  };
  box.replaceChildren(
    topHeart(),
    // «Как ты?» — значком одразу праворуч від серця
    askBtn(who().partner === 'она'),
    // 🆘 у шапці лише розгортає: сигнал іде тільки повзунком, щоб не натиснути випадково
    h('button', { type: 'button', class: 'top-sos', 'aria-label': 'Нужна помощь — открыть ползунок', onclick: toSos }, '🆘'),
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
