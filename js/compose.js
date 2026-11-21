// Рядок «Написать…» під перепискою, як у месенджері: ＋ зліва, поле, справа 🎤 (порожньо) або ➤.
// Над ним, поки пишеш, — хто понесе, коли (зараз / на утро) і «✨ Помочь»; над ними — цитата, якщо це відповідь.
// «＋» — фото, гифка, спор і особливі листи (у конверт, до дати, велике вікно). Рядок один на весь запуск:
// вкладка перемальовується, а набране, цитата й фокус лишаються
import { DATA } from './data.js';
import { deliver } from './outbox.js';
import { petName, petSrc, petFor } from './icons.js';
import { h, toast, ARROW, hhmm } from './ui.js';
import { composeMeme, composeGif } from './memes.js';
import { openGifs } from './maker.js';
import { openDuel } from './duel.js';
import { openWrite, draft, nextMorning, QUEUED, sentToast } from './write.js';
import { listen, canDictate, MIC } from './voice.js';

const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const CARET = '<svg class="cbar-caret" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
const MAX_H = 132;

let ui = null;
let when = 'now';
let pet = null;
let reply = null;
let picking = false;
let plus = null;

// Кнопки над полем не забирають фокус: клавіатура не ховається, рядок не стрибає
const keep = { onmousedown: (e) => e.preventDefault() };

function build() {
  pet = petFor('push');
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
  const petBtn = h('button', { type: 'button', class: 'cbar-chip cbar-pet', 'aria-expanded': 'false', ...keep, onclick: () => { picking = !picking; paint(); } });
  const whenBtn = h('button', {
    type: 'button', class: 'cbar-chip cbar-when', ...keep,
    onclick: () => {
      when = when === 'now' ? 'morning' : 'now';
      paint();
    },
  });
  const helpBtn = h('button', { type: 'button', class: 'cbar-chip cbar-help', ...keep, onclick: () => big({ help: true }) }, '✨ Помочь');
  const pets = Object.keys(DATA.mascots);
  const petRow = h('div', { class: 'cbar-pets', role: 'radiogroup', 'aria-label': 'Кто понесёт', hidden: true },
    ...pets.map((k) => h('button', {
      type: 'button', role: 'radio', class: 'cbar-pet-pick', 'data-v': k, title: petName(k), ...keep,
      html: `<img src="${petSrc(k)}" alt="${petName(k)}" width="40" height="40">`,
      onclick: () => { pet = k; picking = false; paint(); },
    })));
  const opts = h('div', { class: 'cbar-opts' }, ...[pets.length > 1 ? petBtn : null, whenBtn, helpBtn].filter(Boolean));
  const row = h('div', { class: 'cbar-row' }, plusBtn, h('label', { class: 'cbar-field' }, area), act);
  const el = h('div', { class: 'cbar', role: 'group', 'aria-label': 'Новое письмо' }, quote, petRow, opts, row);
  ui = { el, area, act, plusBtn, quote, petBtn, whenBtn, petRow, opts };

  area.addEventListener('input', () => { if (!reply) draft.set(area.value); grow(); paint(); });
  // Клавіатура на телефоні — нижні вкладки ховаються, місце переписці (лише на дотиковому екрані: на ноутбуці вони не заважають)
  area.addEventListener('focus', () => { closePlus(); document.body.classList.add('is-typing'); paint(); });
  area.addEventListener('blur', () => { document.body.classList.remove('is-typing'); picking = false; paint(); });
  // На ноутбуці Ctrl+Enter — відправити; Enter — новий рядок, як і на телефоні
  area.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendText(); } });
  act.addEventListener('click', () => {
    if (act.dataset.mode === 'mic') listen(area, act, () => paint());
    else sendText();
  });
}

function grow() {
  const { area } = ui;
  area.style.height = 'auto';
  area.style.height = `${Math.min(area.scrollHeight + 2, MAX_H)}px`;
  area.classList.toggle('is-tall', area.scrollHeight + 2 > MAX_H);
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
  const morning = when === 'morning';
  whenBtn.classList.toggle('is-on', morning);
  whenBtn.setAttribute('aria-pressed', String(morning));
  whenBtn.textContent = morning ? '🌅 на утро' : '🕐 сейчас';
  whenBtn.setAttribute('aria-label', morning ? `На утро, в ${hhmm(nextMorning().getTime())}. Тап — отправить сейчас` : 'Сейчас. Тап — отправить на утро');
  plusBtn.innerHTML = plus ? CROSS : PLUS;
  plusBtn.setAttribute('aria-label', plus ? 'Закрыть' : 'Ещё: фото, гифка, спор, конверт');
  plusBtn.setAttribute('aria-expanded', String(!!plus));
  // Порожньо — 🎤 (де браузер уміє голос); є текст або йде запис — ➤ чи та сама 🎤, поки слухає
  const listening = act.classList.contains('is-listening');
  const mode = listening || (!text && canDictate) ? 'mic' : 'send';
  act.dataset.mode = mode;
  if (mode === 'mic') {
    if (!listening) { act.innerHTML = MIC; act.setAttribute('aria-label', 'Сказать голосом'); }
  } else {
    act.innerHTML = ARROW;
    act.setAttribute('aria-label', morning ? 'Отправить на утро' : 'Отправить');
    act.removeAttribute('aria-pressed');
  }
  act.classList.toggle('is-empty', mode === 'send' && !text);
  el.classList.toggle('is-active', !opts.hidden);
}

async function sendText() {
  const { area, act } = ui;
  const text = area.value.trim();
  if (!text) { area.focus(); return; }
  const r0 = reply;
  const p = pet;
  act.disabled = true;
  try {
    const r = await deliver('letter', 'letters', {
      kind: when,
      text,
      mascot: p,
      at: when === 'morning' ? nextMorning().getTime() : undefined,
      quote: r0?.quote,
      on: r0?.on,
    });
    area.value = '';
    draft.set('');
    if (reply === r0) reply = null;
    when = 'now';
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
    where: when === 'morning' ? 'morning' : undefined,
    ...preset,
    pet,
    text: r0 ? ui.area.value : undefined,
    reply: r0 ? { ...r0, sent: () => { if (reply === r0) reply = null; r0.sent?.(); } } : undefined,
    onClose: (sent, text) => {
      ui.area.value = sent ? '' : r0 ? text : draft.get();
      if (sent) when = 'now';
      grow();
      paint();
    },
  });
}

// «＋» — шторка під рядком (на місці клавіатури). role=dialog у body: «Назад» на телефоні закриває її, як інші вікна
function openPlus() {
  if (plus) return;
  ui.area.blur();
  const { re, sent } = memeReply();
  const picker = h('input', {
    type: 'file', accept: 'image/*', class: 'visually-hidden',
    onchange: (e) => {
      const [file] = e.target.files;
      if (!file) return;
      closePlus();
      composeMeme(file, sent, re);
    },
  });
  const tile = (icon, label, onclick, cls = '') => h('button', { type: 'button', class: `cbar-tile${cls}`, onclick },
    h('span', { 'aria-hidden': 'true' }, icon), label);
  const envs = DATA.partnerEnvelopes || [];
  const panel = h('div', { class: 'cbar-plus', role: 'dialog', 'aria-label': 'Ещё' },
    h('button', { type: 'button', class: 'sheet-close visually-hidden', 'aria-label': 'Закрыть', onclick: () => closePlus() }),
    h('p', { class: 'cbar-plus-label' }, 'Прикрепить'),
    h('div', { class: 'cbar-tiles' }, ...[
      h('label', { class: 'cbar-tile' }, picker, h('span', { 'aria-hidden': 'true' }, '📷'), 'Фото'),
      tile('🎞', 'Гифка', () => { closePlus(); openGifs((gif) => composeGif(gif, sent, re)); }),
      reply ? null : tile('✊', 'Спор', () => { closePlus(); openDuel(); }),
    ].filter(Boolean)),
    h('p', { class: 'cbar-plus-label' }, 'Особое письмо'),
    h('div', { class: 'cbar-tiles' }, ...[
      tile('🌅', 'На утро', () => { when = 'morning'; closePlus(); ui.area.focus(); }, ' is-special'),
      envs.length ? tile('✉️', 'В конверт', () => big({ where: 'env' }), ' is-special') : null,
      tile('🎂', 'К дате', () => big({ where: 'date' }), ' is-special'),
      tile('⤢', 'Большое', () => big({ where: when === 'morning' ? 'morning' : 'now' }), ' is-special'),
    ].filter(Boolean)));
  plus = panel;
  document.body.append(panel);
  document.body.classList.add('is-plus');
  // Рядок стоїть над шторкою: екран чату стискається на її висоту
  document.documentElement.style.setProperty('--plus-h', `${panel.offsetHeight}px`);
  document.addEventListener('keydown', onEsc);
  paint();
}

function onEsc(e) { if (e.key === 'Escape') closePlus(); }

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
export function composeLeave() { closePlus(); }

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
