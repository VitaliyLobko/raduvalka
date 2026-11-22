// Рядок «Написать…» під перепискою, як у месенджері: ＋ зліва, поле, справа 🎤 (порожньо) або ➤.
// Над ним, поки пишеш, — хто понесе, коли (зараз / на утро) і «✨ Помочь»; над ними — цитата, якщо це відповідь.
// «＋» — фото, гифка, спор і особливі листи (у конверт, до дати, велике вікно). Рядок один на весь запуск:
// вкладка перемальовується, а набране, цитата й фокус лишаються
import { DATA } from './data.js';
import { deliver } from './outbox.js';
import { petName, petSrc, petFor } from './icons.js';
import { h, toast, ARROW, hhmm, dayWord as dayName } from './ui.js';
import { composeMeme, composeGif, sendSticker } from './memes.js';
import { openGifs } from './maker.js';
import { openGames } from './games.js';
import { openWrite, draft, nextMorning, QUEUED, sentToast } from './write.js';
import { listen, canDictate, MIC } from './voice.js';

const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const CARET = '<svg class="cbar-caret" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
const SMILE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="2.6"/></svg>';
const KEYS = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8" stroke-width="2.2"/></svg>';
const MAX_H = 132;
const FILE_ACCEPT = 'application/*,text/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.rtf,.txt,.csv,.zip,.rar,.7z';

let ui = null;
// Android: системне «Назад» ховає клавіатуру, а поле лишається у фокусі (blur не приходить) — вкладки знизу так і
// лишались схованими. Вікно знову на повну висоту (interactive-widget=resizes-content) — клавіатури нема, знімаємо фокус
let tallest = innerHeight;
let shrunk = false;
addEventListener('resize', () => {
  if (!document.body.classList.contains('is-typing')) { tallest = innerHeight; shrunk = false; return; }
  if (innerHeight < tallest * 0.8) shrunk = true;
  else if (shrunk && innerHeight > tallest * 0.9) { shrunk = false; ui?.area?.blur(); }
});
// 'now' | 'morning' (о 8:00) | 'time' (свій час — atTime); «на утро» і свій час ідуть на сервер одним видом: kind 'morning' з at.
// Святковий лист — лише з плитки «🎉 Праздничное» у ＋, у великому вікні
let when = 'now';
let atTime = 0;
let pet = null;
// Вибрали кур'єра самі — він і носить далі; не вибирали — після кожного листа новий випадковий
let petPicked = false;
let reply = null;
let picking = false;
let plus = null;
// Панель смайлів (на місці клавіатури) і де стояла каретка, коли клавіатура сховалась
let emo = null;
let caret = null;

// Кнопки над полем не забирають фокус: клавіатура не ховається, рядок не стрибає
const keep = { onmousedown: (e) => e.preventDefault() };

// Хто понесе наступний лист: щоразу випадковий улюбленець (у чаті різні мордочки й пози); вибрати свого — як і раніше
function anyPet() {
  const pets = Object.keys(DATA.mascots);
  return pets[Math.floor(Math.random() * pets.length)] || petFor('push');
}

function build() {
  pet = anyPet();
  const area = h('textarea', {
    class: 'cbar-text', rows: '1', enterkeyhint: 'enter', placeholder: 'Написать…', 'aria-label': 'Текст письма',
  });
  area.value = draft.get();
  const act = h('button', { type: 'button', class: 'cbar-act', ...keep });
  const plusBtn = h('button', { type: 'button', class: 'cbar-plus-btn', 'aria-expanded': 'false', ...keep, onclick: () => (plus ? closePlus() : openPlus()) });
  const quote = h('div', { class: 'cbar-quote', hidden: true },
    h('span', { class: 'cbar-quote-label' }, 'Отвечаешь на'),
    h('span', { class: 'cbar-quote-text' }),
    h('button', { type: 'button', class: 'cbar-quote-x', 'aria-label': 'Не отвечать', html: CROSS, ...keep, onclick: () => { reply = null; paint(); } }));
  const pets = Object.keys(DATA.mascots);
  // Питомець: свайп по чипу — сусідній одразу, тап — ряд мордочок
  let swiped = false;
  let x0 = null;
  const petBtn = h('button', {
    type: 'button', class: 'cbar-chip cbar-pet', 'aria-expanded': 'false', title: 'Свайп — сменить', ...keep,
    onclick: () => { if (swiped) { swiped = false; return; } picking = !picking; paint(); },
  });
  petBtn.addEventListener('pointerdown', (e) => {
    x0 = e.clientX;
    swiped = false;
    try { petBtn.setPointerCapture(e.pointerId); } catch { /* палець уже відпущено */ }
  });
  petBtn.addEventListener('pointermove', (e) => {
    if (x0 === null || swiped || Math.abs(e.clientX - x0) < 28) return;
    swiped = true;
    stepPet(pets, e.clientX < x0 ? 1 : -1);
  });
  const lift = () => { x0 = null; };
  petBtn.addEventListener('pointerup', lift);
  petBtn.addEventListener('pointercancel', lift);
  // «Сейчас» → тап відкриває годинник (одразу 8:00 — ранок в один дотик); уже вибраний час тап скасовує — знову «сейчас»
  const whenBtn = h('button', {
    type: 'button', class: 'cbar-chip cbar-when', ...keep,
    onclick: () => {
      if (when === 'now') { pickTime(); return; }
      when = 'now';
      paint();
    },
  });
  // Дата й час телефона: типово сьогодні, але можна будь-який день наперед (до року).
  // Час сьогодні, що вже минув, — той самий час завтра
  const clock = h('input', {
    type: 'datetime-local', class: 'visually-hidden cbar-clock', tabindex: '-1', 'aria-label': 'Ко времени',
    onchange: () => {
      // Годинник очистили — знову «сейчас»
      if (!clock.value) { if (when === 'time') { when = 'now'; paint(); } return; }
      const d = new Date(clock.value);
      if (Number.isNaN(d.getTime())) return;
      if (d.getTime() <= Date.now() + 60000) {
        const t = new Date();
        t.setHours(d.getHours(), d.getMinutes(), 0, 0);
        if (t.getTime() <= Date.now() + 60000) t.setDate(t.getDate() + 1);
        d.setTime(t.getTime());
      }
      d.setTime(Math.min(d.getTime(), Date.now() + MAX_AHEAD));
      atTime = d.getTime();
      when = 'time';
      paint();
      ui.area.focus();
    },
  });
  // Слово «Помочь» ховається, коли поруч свій час і 🎉, — щоб рядок умістився на вузькому телефоні
  const helpBtn = h('button', { type: 'button', class: 'cbar-chip cbar-help', 'aria-label': 'Помочь написать', ...keep, onclick: () => big({ help: true }) },
    '✨', h('span', { class: 'cbar-help-word' }, ' Помочь'));
  const petRow = h('div', { class: 'cbar-pets', role: 'radiogroup', 'aria-label': 'Кто понесёт', hidden: true },
    ...pets.map((k) => h('button', {
      type: 'button', role: 'radio', class: 'cbar-pet-pick', 'data-v': k, title: petName(k), ...keep,
      html: `<img src="${petSrc(k)}" alt="${petName(k)}" width="40" height="40">`,
      onclick: () => { pet = k; petPicked = true; picking = false; paint(); },
    })));
  const opts = h('div', { class: 'cbar-opts' }, ...[pets.length > 1 ? petBtn : null, whenBtn, helpBtn].filter(Boolean));
  // 😊 у полі зліва, як у месенджері: тап — смайли замість клавіатури, ще тап (⌨) — назад до клавіатури
  const emoBtn = h('button', { type: 'button', class: 'cbar-emo-btn', 'aria-expanded': 'false', ...keep, onclick: () => (emo ? closeEmoji(true) : openEmoji()) });
  // ⤢ у полі справа зверху — лише коли текст уже не вміщається: те саме, але у великому вікні
  const expandBtn = h('button', {
    type: 'button', class: 'cbar-expand', hidden: true, 'aria-label': 'Развернуть письмо на весь экран', title: 'Развернуть', ...keep,
    onclick: () => big(),
  });
  // Кутики «на весь екран», а не ⤢ — щоб не плутати зі стрілою «Отправить» поруч
  expandBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
  const row = h('div', { class: 'cbar-row' }, plusBtn, h('label', { class: 'cbar-field' }, emoBtn, area, expandBtn), act);
  const el = h('div', { class: 'cbar', role: 'group', 'aria-label': 'Новое письмо' }, quote, petRow, opts, row, clock);
  ui = { el, area, act, plusBtn, emoBtn, quote, petBtn, whenBtn, petRow, opts, clock, expandBtn };

  area.addEventListener('input', () => { if (!reply) draft.set(area.value); grow(); paint(); });
  // Клавіатура на телефоні — нижні вкладки ховаються, місце переписці (лише на дотиковому екрані: на ноутбуці вони не заважають)
  area.addEventListener('focus', () => { closePlus(); closeEmoji(); document.body.classList.add('is-typing'); paint(); });
  area.addEventListener('blur', () => {
    caret = [area.selectionStart, area.selectionEnd];
    document.body.classList.remove('is-typing');
    picking = false;
    paint();
  });
  // На ноутбуці Ctrl+Enter — відправити; Enter — новий рядок, як і на телефоні
  area.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendText(); } });
  act.addEventListener('click', () => {
    if (act.dataset.mode === 'mic') listen(area, act, () => paint());
    else sendText();
  });
}

function stepPet(pets, d) {
  petPicked = true;
  const i = pets.indexOf(pet);
  pet = pets[(i + d + pets.length) % pets.length];
  picking = false;
  paint();
  const img = ui.petBtn.querySelector('img');
  img?.animate([{ transform: `translateX(${d * 14}px)`, opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 180, easing: 'ease-out' });
}

// Коли прийде: undefined — зараз
const sendAt =() => (when === 'morning' ? nextMorning().getTime() : when === 'time' ? atTime : undefined);
// Над рядком: сьогоднішнє — лише годиною, інше — «завтра в …» чи «25 декабря в …»
// Дальній день — коротким місяцем («1 дек»), щоб чип не виштовхнув «Помочь» з рядка
const SHORT = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' });
const dayWord = (ms) => {
  const w = dayName(ms);
  if (w === 'сегодня') return '';
  return w === 'завтра' ? 'завтра ' : `${SHORT.format(ms).replace('.', '')} `;
};
const MAX_AHEAD = 365 * 24 * 3600 * 1000;
// datetime-local хоче місцевий час без зони: 2026-11-21T14:00
const local = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// «Ко времени»: своя шторка (дата сіткою, час барабанами); вибране йде через той самий обробник прихованого поля
async function pickTime() {
  closePlus();
  const { clock } = ui;
  const t = await (await import('./picker.js')).pickSendTime(when === 'time' ? atTime : 0);
  if (t == null) return;
  clock.value = local(new Date(t));
  clock.dispatchEvent(new Event('change'));
}

function grow() {
  const { area } = ui;
  area.style.height = 'auto';
  area.style.height = `${Math.min(area.scrollHeight + 2, MAX_H)}px`;
  area.classList.toggle('is-tall', area.scrollHeight + 2 > MAX_H);
  showExpand();
}
function showExpand() {
  if (ui) ui.expandBtn.hidden = !ui.area.classList.contains('is-tall');
}

function paint() {
  if (!ui) return;
  const { el, area, act, plusBtn, quote, petBtn, whenBtn, petRow, opts } = ui;
  const text = area.value.trim();
  const typing = document.activeElement === area;
  quote.hidden = !reply;
  if (reply) quote.querySelector('.cbar-quote-text').textContent = reply.quote;
  area.setAttribute('aria-label', reply ? 'Текст ответа' : 'Текст письма');
  area.placeholder = reply ? 'Пару слов в ответ…' : 'Написать…';
  // Над полем — лише коли пишуть: у спокої рядок один, як у месенджері
  opts.hidden = !!plus || !(typing || text || reply);
  petRow.hidden = opts.hidden || !picking;
  petBtn.setAttribute('aria-expanded', String(picking));
  petBtn.innerHTML = `<img src="${petSrc(pet)}" alt="" width="28" height="28"><span>${petName(pet)}</span>${CARET}`;
  petBtn.setAttribute('aria-label', `Несёт ${petName(pet)} — сменить`);
  petRow.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === pet)));
  // Свій час, що вже минув (рядок довго лежав), — назад на «сейчас»
  if (when === 'time' && atTime <= Date.now()) when = 'now';
  showExpand();
  const morning = when === 'morning';
  const later = when !== 'now';
  whenBtn.classList.toggle('is-on', later);
  whenBtn.setAttribute('aria-pressed', String(later));
  whenBtn.textContent = morning ? '🌅 на утро' : when === 'time' ? `🕐 ${dayWord(atTime)}в ${hhmm(atTime)}` : '🕐 сейчас';
  whenBtn.setAttribute('aria-label', morning ? `На утро, в ${hhmm(nextMorning().getTime())}. Тап — отправить сейчас`
    : when === 'time' ? `Придёт ${dayWord(atTime)}в ${hhmm(atTime)}. Тап — отправить сейчас` : 'Сейчас. Тап — выбрать время');
  // Зі своїм часом рядок довший — «Помочь» стискається до ✨
  opts.classList.toggle('is-tight', when === 'time');
  ui.emoBtn.innerHTML = emo ? KEYS : SMILE;
  ui.emoBtn.setAttribute('aria-label', emo ? 'Клавиатура' : 'Смайлы');
  ui.emoBtn.setAttribute('aria-expanded', String(!!emo));
  plusBtn.innerHTML = plus ? CROSS : PLUS;
  plusBtn.setAttribute('aria-label', plus ? 'Закрыть' : 'Ещё: галерея, камера, файл, гифка, игры, письмо ко времени');
  plusBtn.setAttribute('aria-expanded', String(!!plus));
  // Порожньо — 🎤 (де браузер уміє голос); є текст або йде запис — ➤ чи та сама 🎤, поки слухає
  const listening = act.classList.contains('is-listening');
  const mode = listening || (!text && canDictate) ? 'mic' : 'send';
  act.dataset.mode = mode;
  if (mode === 'mic') {
    if (!listening) { act.innerHTML = MIC; act.setAttribute('aria-label', 'Сказать голосом'); }
  } else {
    act.innerHTML = ARROW;
    act.setAttribute('aria-label', morning ? 'Отправить на утро' : when === 'time' ? `Отправить к ${hhmm(atTime)}` : 'Отправить');
    act.removeAttribute('aria-pressed');
  }
  act.classList.toggle('is-empty', mode === 'send' && !text);
  el.classList.toggle('is-active', !opts.hidden || !!emo);
}

async function sendText() {
  const { area, act } = ui;
  const text = area.value.trim();
  if (!text) { area.focus(); return; }
  const r0 = reply;
  const p = pet;
  act.disabled = true;
  try {
    const at = sendAt();
    const r = await deliver('letter', 'letters', {
      kind: at ? 'morning' : 'now',
      text,
      mascot: p,
      at,
      quote: r0?.quote,
      on: r0?.on,
    });
    area.value = '';
    draft.set('');
    if (reply === r0) reply = null;
    when = 'now';
    if (!petPicked) pet = anyPet();
    r0?.sent?.();
    grow();
    paint();
    if (r.queued) { toast(QUEUED); return; }
    document.dispatchEvent(new CustomEvent('radovalka:sent'));
    toast(sentToast(p));
  } catch {
    toast('Не отправилось. Текст сохранён — попробуй ещё раз.');
  } finally {
    act.disabled = false;
  }
}

// Фото чи гифка відповіддю: цитата йде з ними й зникає, щойно надіслано
function memeReply() {
  const r0 = reply;
  return {
    re: r0 ? { quote: r0.quote, on: r0.on } : null,
    sent: () => {
      if (reply === r0) { reply = null; paint(); }
      r0?.sent?.();
      document.dispatchEvent(new CustomEvent('radovalka:sent'));
    },
  };
}

// Велике вікно з тим, що вже в рядку: текст (лист — через спільну чернетку), хто несе, цитата
function big(preset = {}) {
  closePlus();
  const r0 = reply;
  openWrite({
    where: when === 'time' ? 'time' : when === 'morning' ? 'morning' : undefined,
    at: when === 'time' ? atTime : undefined,
    ...preset,
    pet,
    text: r0 ? ui.area.value : undefined,
    reply: r0 ? { ...r0, sent: () => { if (reply === r0) reply = null; r0.sent?.(); } } : undefined,
    onClose: (sent, text) => {
      ui.area.value = sent ? '' : r0 ? text : draft.get();
      if (sent) when = 'now';
      grow();
      paint();
      // Узяли текст із помічника — він у рядку, клавіатура вже відкрита: лишилось ➤
      if (preset.help && !sent && ui.area.value.trim()) setTimeout(() => ui.area.focus(), 180);
    },
  });
}

// «＋» — шторка під рядком (на місці клавіатури). role=dialog у body: «Назад» на телефоні закриває її, як інші вікна
function openPlus() {
  if (plus) return;
  closeEmoji();
  ui.area.blur();
  const { re, sent } = memeReply();
  // Фото — у редактор (підпис, мем); відео й документ — як файл до 25 МБ (files.js вантажиться лише тепер)
  const asFile = async (file) => { const { sendFile } = await import('./files.js'); sendFile(file, sent, re); };
  const input = (attrs, take) => h('input', {
    type: 'file', class: 'visually-hidden', ...attrs,
    onchange: (e) => {
      const [file] = e.target.files;
      e.target.value = '';
      if (!file) return;
      closePlus();
      take(file);
    },
  });
  // «Галерея» — системний вибір фото й відео (камери там на новому Android нема — для неї своя плитка)
  const gallery = input({ accept: DATA.files ? 'image/*,video/*' : 'image/*' },
    (file) => (file.type.startsWith('video/') ? asFile(file) : composeMeme(file, sent, re)));
  const camera = input({ accept: 'image/*', capture: 'environment' }, (file) => composeMeme(file, sent, re));
  // Без картинок і відео в accept Android одразу відкриває файли, а не «Камера / Видеокамера»
  const filePicker = input({ accept: FILE_ACCEPT }, asFile);
  const fileTile = (el, icon, label) => h('label', { class: 'cbar-tile' }, el, h('span', { 'aria-hidden': 'true' }, icon), label);
  const tile = (icon, label, onclick, cls = '') => h('button', { type: 'button', class: `cbar-tile${cls}`, onclick },
    h('span', { 'aria-hidden': 'true' }, icon), label);
  const envs = DATA.partnerEnvelopes || [];
  const panel = h('div', { class: 'cbar-plus', role: 'dialog', 'aria-label': 'Ещё' },
    h('button', { type: 'button', class: 'sheet-close visually-hidden', 'aria-label': 'Закрыть', onclick: () => closePlus() }),
    h('p', { class: 'cbar-plus-label' }, 'Прикрепить'),
    h('div', { class: 'cbar-tiles' }, ...[
      fileTile(gallery, '🖼️', 'Галерея'),
      fileTile(camera, '📷', 'Камера'),
      DATA.files ? fileTile(filePicker, '📎', 'Файл') : null,
      tile('🎞', 'Гифка', () => { closePlus(); openGifs((gif) => composeGif(gif, sent, re)); }),
      reply ? null : tile('🎲', 'Игры', () => { closePlus(); openGames(); }),
    ].filter(Boolean)),
    h('p', { class: 'cbar-plus-label' }, 'Особое письмо'),
    h('div', { class: 'cbar-tiles' }, ...[
      tile('🕐', 'Ко времени', () => pickTime(), ' is-special'),
      envs.length ? tile('✉️', 'В конверт', () => big({ where: 'env' }), ' is-special') : null,
      reply ? null : tile('🎉', 'Праздничное', () => big({ festive: true }), ' is-special'),
    ].filter(Boolean)));
  plus = panel;
  document.body.append(panel);
  document.body.classList.add('is-plus');
  // Рядок стоїть над шторкою: екран чату стискається на її висоту
  document.documentElement.style.setProperty('--plus-h', `${panel.offsetHeight}px`);
  document.addEventListener('keydown', onEsc);
  paint();
}

function onEsc(e) { if (e.key === 'Escape') { closePlus(); closeEmoji(); } }

// Куди вставляти: у фокусі — виділення поля, інакше — де була каретка (або в кінець)
function spot() {
  const { area } = ui;
  if (document.activeElement === area) return [area.selectionStart, area.selectionEnd];
  const n = area.value.length;
  return caret ? [Math.min(caret[0], n), Math.min(caret[1], n)] : [n, n];
}
function putText(s, t, text) {
  const { area } = ui;
  area.value = area.value.slice(0, s) + text + area.value.slice(t);
  const p = s + text.length;
  caret = [p, p];
  area.setSelectionRange(p, p);
  // Той самий шлях, що й набір з клавіатури: чернетка, висота, ➤ замість 🎤
  area.dispatchEvent(new Event('input'));
}

// 😊 — смайли на місці клавіатури (модуль — лише з першим тапом). Шторка, як «＋»: рядок стоїть над нею
async function openEmoji() {
  if (emo) return;
  closePlus();
  if (document.activeElement === ui.area) ui.area.blur();
  const { emojiPanel, lastGrapheme } = await import('./emoji.js');
  if (emo || !ui) return;
  const { re, sent } = memeReply();
  const panel = h('div', { class: 'cbar-plus cbar-emoji', role: 'dialog', 'aria-label': 'Смайлы и наклейки' },
    h('button', { type: 'button', class: 'sheet-close visually-hidden', 'aria-label': 'Закрыть', onclick: () => closeEmoji() }),
    ...emojiPanel({
      // Наклейка-улюбленець: тап по позі — одразу в чат, клавіатура закривається
      onSticker: (key, i) => { closeEmoji(); sendSticker(key, i, sent, re); },
      onPick: (e) => { const [s, t] = spot(); putText(s, t, e); },
      onErase: () => {
        const [s, t] = spot();
        if (s !== t) { putText(s, t, ''); return; }
        if (!s) return;
        const [a] = lastGrapheme(ui.area.value, s);
        putText(a, s, '');
      },
    }));
  emo = panel;
  document.body.append(panel);
  // Як клавіатура: вкладки ховаються, панель — у самому низу
  document.body.classList.add('is-emoji');
  document.documentElement.style.setProperty('--plus-h', `${panel.offsetHeight}px`);
  document.addEventListener('keydown', onEsc);
  paint();
}

// keys — повернути клавіатуру (⌨): фокус у поле, каретка там, де була
function closeEmoji(keys = false) {
  if (!emo) return;
  const p = emo;
  emo = null;
  p.remove();
  document.body.classList.remove('is-emoji');
  document.removeEventListener('keydown', onEsc);
  if (keys && ui) {
    ui.area.focus();
    if (caret) ui.area.setSelectionRange(caret[0], caret[1]);
  }
  paint();
}

function closePlus() {
  if (!plus) return;
  const p = plus;
  plus = null;
  p.remove();
  document.body.classList.remove('is-plus');
  document.removeEventListener('keydown', onEsc);
  paint();
}

// Для «Писем»: той самий рядок щоразу (вкладка перемальовується — набране не губиться)
export function composeBar() {
  if (!ui) build();
  paint();
  requestAnimationFrame(grow);
  return ui.el;
}

// Пішли з «Писем» — «＋» закриваємо, щоб не висіла над іншою вкладкою
export function composeLeave() { closePlus(); closeEmoji(); }

// Відповідь на повідомлення з чату чи з відкритого листа: цитата над рядком, клавіатура — одразу (фокус у тому ж тапі)
export function composeReply(r) {
  if (!ui) build();
  closePlus();
  reply = r;
  paint();
  ui.area.focus();
}

// «Написать» зі сповіщення: просто в рядок
export function composeFocus() {
  if (!ui) return;
  closePlus();
  ui.area.focus();
}
