// «✍️ Написать»: лист зараз, на ранок або записка в її/його конверт; нижче — що вже надіслано
import { DATA, who } from './data.js';
import { deliver } from './outbox.js';
import { petName, petSrc, petFor } from './icons.js';
import { h, toast, cap, ARROW, reduceMotion, ribbon } from './ui.js';
import { mountHelper } from './helper.js';
import { loadWishes, fitsBudget, money, budgetSlider, ANY_BUDGET } from './wishes.js';
import { composeMeme, composeGif } from './memes.js';
import { openGifs } from './maker.js';
import { recentThread } from './feed.js';
import { writeDecor } from './depth.js';

const DRAFT = 'radovalka:draft';
const MORNING_HOUR = 8;

// Чернетку тримаємо в телефоні: випадковий тап повз шторку не з'їсть довгий лист
const draft = {
  get: () => { try { return localStorage.getItem(DRAFT) || ''; } catch { return ''; } },
  set: (v) => { try { localStorage.setItem(DRAFT, v); } catch { /* приватне вікно — без чернетки */ } },
};

// Найближчі 8:00 за часом телефона: увечері — завтра, вночі — вже сьогодні
function nextMorning(now = new Date()) {
  const d = new Date(now);
  d.setHours(MORNING_HOUR, 0, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

const isShe = (key) => DATA.mascots[key]?.g === 'f';
const hhmm = (ms) => new Date(ms).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
const dayWord = (ms) => (new Date(ms).toDateString() === new Date().toDateString() ? 'сегодня' : 'завтра');
const dayMonth = (ms) => new Date(ms).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
// Над полем: сьогоднішнє — годиною, інше — днем
// Поява й зникнення — лише зсув і прозорість: їх рахує відеокарта без перемальовування вікна.
// clip-path перемальовував усе вікно кожен кадр і на телефоні гальмував (18.11)
const MOVE = { opacity: 0, transform: 'translateY(28px) scale(.98)' };
const STILL = { opacity: 1, transform: 'none' };

const whenShort = (ms) => (new Date(ms).toDateString() === new Date().toDateString() ? hhmm(ms) : dayMonth(ms));

// Прогрів. Перше відкриття вікна в кожному запуску було в рази повільнішим за наступні (замір 18.11, CPU ×6:
// розкладка ~1–1,5 с проти ~50 мс): браузер уперше готує шрифти під кожен розмір і накреслення, шукає емодзі,
// збирає поле дати. Тому знімок розмітки вікна з першого відкриття лежить у телефоні, і щойно Радовалка простоює,
// він один кадр невидимо стоїть на екрані. Знімку ще нема (найперший запуск) — хоча б емодзі й поля
const WARM_KEY = 'radovalka:warm-write';
const WARM = '📷 🎞 ✨ 🎂 🎁 💗 😏 🔥 😄 🌸 🙂 ✎ 🎲 ↩ ⬇ 🌷 🍝 💆 😂 🥰 🥺 😜 💪 ☀️ 🌙 🎤 ✂️ ✓';
let snapped = false;
function snapWrite(sheet) {
  if (snapped) return;
  snapped = true;
  try { localStorage.setItem(WARM_KEY, JSON.stringify({ cls: sheet.className, html: sheet.innerHTML.slice(0, 80000) })); } catch { /* немає місця — прогріється простіше */ }
}
export function prewarmWrite() {
  const run = () => {
    let snap = null;
    try { snap = JSON.parse(localStorage.getItem(WARM_KEY) || 'null'); } catch { /* зіпсований знімок — як без нього */ }
    const box = h('div', { class: 'write-warm', 'aria-hidden': 'true', inert: true });
    if (snap?.html) {
      const copy = h('div', { class: snap.cls });
      // Знімок лише для розкладки: без id і без автофокуса, щоб не зачепити справжні елементи; blob-картинки після перезапуску мертві
      copy.innerHTML = snap.html.replace(/\s(id|autofocus)="[^"]*"/g, '').replace(/\ssrc="blob:[^"]*"/g, '');
      box.append(copy);
    } else {
      const pics = (DATA.partnerEnvelopes || []).map((e) => e.emoji).join(' ');
      box.append(h('span', {}, `${WARM} ${pics}`), h('b', {}, WARM), h('input', { type: 'date', tabindex: '-1' }), h('input', { type: 'file', tabindex: '-1' }));
    }
    document.body.append(box);
    requestAnimationFrame(() => requestAnimationFrame(() => box.remove()));
  };
  if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}

// preset — { where: 'env', envId } з тапу по сповіщенню про порожній конверт;
// { reply: { quote, on, sent } } — відповідь: той самий екран із цитатою зверху; лист, фото чи гифка йдуть новим
// повідомленням із цією цитатою; on — на що відповідають ('letter' | 'gif' | 'photo'), sent() — після відправки
export function openWrite(preset = {}) {
  const reply = preset.reply || null;
  const me = who();
  const envs = DATA.partnerEnvelopes || [];
  const presetEnv = envs.some((e) => e.id === preset.envId) ? preset.envId : null;
  let where = presetEnv ? 'env' : 'now';
  let envId = presetEnv || envs[0]?.id || null;
  let pet = petFor('push');

  const said = `Пиши как есть — так, как ${me.partner === 'она' ? 'сказал' : 'сказала'} бы вслух…`;
  const area = h('textarea', { class: 'write-text', 'data-voice': true, 'aria-label': reply ? 'Текст ответа' : 'Текст письма', placeholder: reply ? 'Пару слов в ответ…' : said });
  // Чернетка — лише в листа: відповідь коротка й прив'язана до свого повідомлення
  if (!reply) {
    area.value = draft.get();
    area.addEventListener('input', () => draft.set(area.value));
  }

  const note = h('p', { class: 'write-note' });
  const envRow = h('div', { class: 'mk-chips write-envs', hidden: true });
  // «К дате»: свято обирає сам автор (дати — не в коді), приходить того дня о 8:00
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('sv');
  const dateInput = h('input', { type: 'date', class: 'write-date', min: tomorrow, 'aria-label': 'К какой дате', onchange: () => paintNote() });
  const dateRow = h('label', { class: 'meet-row write-date-row', hidden: true }, h('span', {}, 'Какого числа?'), dateInput);
  const dateAt = () => (dateInput.value ? new Date(`${dateInput.value}T${String(MORNING_HOUR).padStart(2, '0')}:00`).getTime() : null);
  // «Подарок на выбор»: 2–3 варіанти — значок, назва на конверті й що всередині (видно після вибору)
  const SAMPLE = [['🌷', 'Цветы', 'Курьер привезёт букет'], ['🍝', 'Ужин', 'Сходим в наше место'], ['💆', 'Массаж', 'Час массажа от меня, когда вернусь']];
  const giftRows = SAMPLE.map(([e, t, i]) => {
    const emoji = h('input', { type: 'text', class: 'gift-emoji', maxlength: '4', value: e, 'aria-label': 'Значок' });
    const title = h('input', { type: 'text', class: 'gift-title', maxlength: '40', placeholder: t, 'aria-label': 'Что на конверте' });
    const inside = h('input', { type: 'text', class: 'gift-inside', maxlength: '500', placeholder: `Внутри: ${i.toLowerCase()}`, 'aria-label': 'Что внутри' });
    return { el: h('div', { class: 'gift-row' }, emoji, h('div', { class: 'gift-texts' }, title, inside)), emoji, title, inside };
  });
  // Варіанти з її/його «Хотелок»: відмічаєш до трьох — вони стають конвертами
  const fromWish = h('button', { type: 'button', class: 'btn mk-reroll gift-from-wish' }, `🎁 Из ${me.partner === 'она' ? 'её' : 'его'} хотелок`);
  const wishPick = h('div', { class: 'gift-wish-pick', hidden: true });
  fromWish.addEventListener('click', () => pickFromWishes(wishPick, giftRows));
  const giftBox = h('div', { class: 'gift-edit', hidden: true },
    fromWish, wishPick,
    h('p', { class: 'mk-label' }, 'Варианты (минимум два)'), ...giftRows.map((r) => r.el));
  const giftOptions = () => giftRows
    .map((r) => ({ emoji: r.emoji.value.trim() || '🎁', title: r.title.value.trim(), inside: r.inside.value.trim() }))
    .filter((o) => o.title);
  const paintNote = () => {
    const m = nextMorning();
    giftBox.hidden = where !== 'gift';
    area.placeholder = reply ? 'Пару слов в ответ…' : where === 'gift' ? 'Пару слов к подарку (можно без)' : said;
    note.textContent = where === 'gift'
      ? `${cap(me.partner)} увидит закрытые конверты и выберет один. Что внутри — узнает после выбора, остальные тоже откроются.`
      : where === 'now'
      ? `Появится у ${me.partner === 'он' ? 'него' : 'неё'}, как только ${me.partner} откроет Радовалку.`
      : where === 'morning'
        ? `Придёт ${dayWord(m.getTime())} в ${hhmm(m.getTime())} запечатанным конвертом.`
      : where === 'date'
        ? (dateAt() ? `Придёт ${dayMonth(dateAt())} в ${hhmm(dateAt())} — праздничным письмом, принесут все вместе 🎉` : 'Выбери день — день рождения, годовщину, праздник.')
        : `Ляжет в конверт — ${me.partner} откроет, когда понадобится.`;
    envRow.hidden = where !== 'env';
    dateRow.hidden = where !== 'date';
  };

  const chips = (items, picked, onPick) => {
    const row = h('div', { class: 'mk-chips', role: 'radiogroup' });
    const paint = () => row.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === picked)));
    items.forEach(({ v, label, html }) => row.append(h('button', {
      type: 'button', role: 'radio', class: 'mk-chip', 'data-v': v, ...(html ? { html } : {}),
      onclick: () => { picked = v; paint(); onPick(v); },
    }, html ? null : label)));
    paint();
    return row;
  };

  // «Когда» — одна стрічка: усі п'ять варіантів, гортається вбік
  const whereRow = chips([
    { v: 'now', label: 'Сейчас' },
    { v: 'morning', label: 'На утро' },
    ...(envs.length ? [{ v: 'env', label: 'В конверт' }] : []),
    { v: 'date', label: '🎂 К дате' },
    { v: 'gift', label: '🎁 Подарок' },
  ], where, (v) => { where = v; paintNote(); });
  envRow.append(chips(envs.map((e) => ({ v: e.id, label: `${e.emoji} ${e.label}` })), envId, (v) => { envId = v; }));
  [whereRow, envRow.firstChild].forEach((row) => { row.classList.add('write-when'); ribbon(row); });
  paintNote();

  const pets = Object.keys(DATA.mascots);
  // Хто понесе — лише мордочки; ім'я — у підказці й для читалки екрана
  const petRow = chips(pets.map((k) => ({
    v: k, html: `<img src="${petSrc(k)}" alt="${petName(k)}" width="40" height="40">`,
  })), pet, (v) => { pet = v; });
  petRow.classList.add('write-pets');
  petRow.setAttribute('aria-label', 'Кто понесёт');
  petRow.querySelectorAll('button').forEach((b) => { b.title = petName(b.dataset.v); });

  const helper = h('div', { class: 'write-helper' });
  mountHelper(helper, area);
  const go = h('button', { type: 'button', class: 'btn btn-primary write-go', html: `${ARROW}Отправить` });

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  // fast — одразу, без згортання: далі відкривається інша шторка (фото, гифка)
  const close = (fast = false) => {
    document.removeEventListener('keydown', onKey);
    document.documentElement.classList.remove('is-covered');
    // Закрили ще під час руху — знімок для прогріву все одно потрібен
    snapWrite(sheet);
    const done = () => { sheet.remove(); backdrop.remove(); };
    if (fast || reduceMotion) { done(); return; }
    sheet.animate([STILL, MOVE], { duration: 160, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' }).onfinish = done;
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
  };

  // Мемчик замість листа: шторка листа закривається, далі — шторка мемчика; стрічка оновиться сама
  const memeSent = () => { reply?.sent?.(); document.dispatchEvent(new CustomEvent('radovalka:sent')); };
  const re = reply ? { quote: reply.quote, on: reply.on } : null;
  // input лишається в шторці, доки не обрано файл, — від'єднаний input change не надійний
  const picker = h('input', {
    type: 'file', accept: 'image/*', class: 'visually-hidden',
    onchange: (e) => {
      const [file] = e.target.files;
      if (!file) return;
      close(true);
      composeMeme(file, memeSent, re);
    },
  });
  const tools = h('div', { class: 'write-tools' },
    h('label', { class: 'mk-chip' }, picker, '📷 Фото'),
    h('button', {
      type: 'button', class: 'mk-chip',
      onclick: () => { close(true); openGifs((gif) => composeGif(gif, memeSent, re)); },
    }, '🎞 Гифка'),
    helper);

  // Відповідь — над полем цитата (тап — цілим); новий лист — кусок переписки, як у месенджері: новіше внизу, біля поля
  const ctx = reply ? h('button', {
    type: 'button', class: 'write-ctx', 'aria-expanded': 'false',
    onclick: () => ctx.setAttribute('aria-expanded', String(ctx.classList.toggle('is-open'))),
  },
    h('span', { class: 'write-ctx-label' }, 'Отвечаешь на'),
    h('span', { class: 'write-ctx-text' }, reply.quote)) : null;
  const recent = reply ? [] : recentThread();
  const thread = recent.length ? h('div', { class: 'write-thread', role: 'log', 'aria-label': 'Последние сообщения' },
    ...recent.map((m) => h('div', { class: `write-msg ${m.mine ? 'is-mine' : 'is-theirs'}` },
      h('span', { class: 'write-msg-text' }, m.text),
      h('span', { class: 'write-msg-at' }, whenShort(m.at))))) : null;
  // Межа між верхом (переписка чи цитата) і полем — тягнеться пальцем
  const split = thread || ctx ? splitter(thread || ctx, area, ctx ? `${SPLIT_KEY}-reply` : SPLIT_KEY) : null;
  // Поле росте, поки пишеш, — переписка над ним стискається; межу перетягнули — поле просто займає решту
  const grow = () => {
    if (split?.on()) return;
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight + 2}px`;
  };
  area.addEventListener('input', grow);

  go.addEventListener('click', async () => {
    const text = area.value.trim();
    const gift = where === 'gift' ? giftOptions() : null;
    if (gift && gift.length < 2) { toast('Нужно хотя бы два варианта'); giftRows[gift.length].title.focus(); return; }
    if (!text && !gift) { area.focus(); return; }
    if (where === 'date' && !dateAt()) { toast('Выбери дату'); dateInput.focus(); return; }
    go.disabled = true;
    try {
      const r = await deliver('letter', 'letters', {
        kind: where,
        text,
        mascot: pet,
        env: where === 'env' ? envId : undefined,
        at: where === 'morning' ? nextMorning().getTime() : where === 'date' ? dateAt() : undefined,
        gift: gift || undefined,
        quote: reply?.quote,
        on: reply?.on,
      });
      // Чернетка — лише листа; відповідь її не чіпає
      if (!reply) draft.set('');
      reply?.sent?.();
      close();
      // Без зв'язку лист лежить у черзі телефона — чесно кажемо, коли він піде
      if (r.queued) {
        toast(`Нет связи. ${gift ? 'Подарок ждёт' : 'Письмо ждёт'} в телефоне и уйдёт само, когда Радовалка будет открыта с интернетом 📮`);
        return;
      }
      document.dispatchEvent(new CustomEvent('radovalka:sent'));
      toast(`${petName(pet) || 'Почтальон'} ${isShe(pet) ? 'понесла' : 'понёс'} ${gift ? 'подарок 🎁' : 'письмо ➶'}`);
    } catch {
      go.disabled = false;
      toast('Не отправилось. Текст сохранён — попробуй ещё раз.');
    }
  });

  // На весь екран, як у месенджері: заголовок, переписка (або цитата), інструменти, поле, знизу — «Когда», хто понесе, «Отправить»
  const title = reply ? 'Ответ' : `Письмо ${me.toWhom}`;
  const backdrop = h('div', { class: 'backdrop', onclick: () => close() });
  const sheet = h('div', { class: `sheet sheet-full sheet-maker sheet-write${reply ? ' is-reply' : ''}${thread ? ' has-thread' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    writeDecor(),
    h('div', { class: 'sheet-inner' }, ...[
      h('div', { class: 'write-head' },
        h('h2', {}, title),
        h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: () => close() }, '✕')),
      ctx,
      thread,
      split?.bar,
      tools,
      area,
      h('div', { class: 'write-dock' }, ...[
        whereRow, envRow, dateRow, giftBox, note,
        h('div', { class: 'write-send' }, ...[pets.length ? petRow : null, go].filter(Boolean)),
      ]),
    ].filter(Boolean)));
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  split?.mount(sheet);
  // Спливає знизу, від кнопки «Написать…»; клавіатура — вже після, щоб вікно не перебудовувалось посеред руху
  sheet.style.animation = 'none';
  const shown = reduceMotion ? null
    : sheet.animate([MOVE, STILL], { duration: 200, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  if (shown) backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  // Клавіатура стискає вікно — переписка лишається притиснутою донизу, найсвіжіше біля поля
  if (thread) new ResizeObserver(() => { thread.scrollTop = thread.scrollHeight; }).observe(thread);
  // Вікно відкрилось — фон під ним на паузу; клавіатура — вже після руху
  const settled = () => {
    if (!sheet.isConnected) return;
    document.documentElement.classList.add('is-covered');
    const later = self.requestIdleCallback || ((fn) => setTimeout(fn, 800));
    later(() => { if (sheet.isConnected) snapWrite(sheet); }, { timeout: 3000 });
  };
  if (shown) shown.finished.then(() => { settled(); if (!area.value) area.focus(); }, () => {});
  else { settled(); if (!area.value) area.focus(); }
  if (area.value) grow();
  return { sheet, area };
}

// Межа між верхом вікна (переписка чи цитата) і полем: тягнеш угору чи вниз — міняються висоти, поле бере решту.
// Телефон пам'ятає висоту верху; поле не нижче 80px (CSS), вікно не прокручується (з клавіатурою теж)
const SPLIT_KEY = 'radovalka:write-split';
const MIN_TOP = 44;
// key — окремо для листа й відповіді: цитата здебільшого коротка, їй не потрібна висота всієї переписки
function splitter(top, area, key) {
  let sheet = null;
  const grip = h('div', {
    class: 'write-split', role: 'separator', 'aria-orientation': 'horizontal', tabindex: '0',
    'aria-label': 'Граница между перепиской и полем: потяни вверх или вниз',
  }, h('span', { class: 'write-split-grip', 'aria-hidden': 'true' }));
  const on = () => !!sheet?.classList.contains('is-split');
  const set = (px) => {
    sheet.classList.add('is-split');
    area.style.height = '';
    const want = Math.max(MIN_TOP, Math.round(px));
    sheet.style.setProperty('--top-h', `${want}px`);
    // Вікно не прокручується: що не влізло (поле вже мінімальне) — забираємо з верху
    const over = sheet.scrollHeight - sheet.clientHeight;
    if (over > 0) sheet.style.setProperty('--top-h', `${Math.max(MIN_TOP, want - over)}px`);
  };
  const topH = () => top.getBoundingClientRect().height;
  const save = () => { try { localStorage.setItem(key, String(Math.round(topH()))); } catch { /* не запам'ятає */ } };
  let y0 = 0;
  let h0 = 0;
  grip.addEventListener('pointerdown', (e) => {
    y0 = e.clientY;
    h0 = topH();
    grip.setPointerCapture(e.pointerId);
    grip.classList.add('is-drag');
    e.preventDefault();
  });
  grip.addEventListener('pointermove', (e) => { if (grip.hasPointerCapture(e.pointerId)) set(h0 + e.clientY - y0); });
  const end = () => { if (!grip.classList.contains('is-drag')) return; grip.classList.remove('is-drag'); save(); };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowUp' ? -24 : e.key === 'ArrowDown' ? 24 : 0;
    if (!d) return;
    e.preventDefault();
    set(topH() + d);
    save();
  });
  const mount = (s) => {
    sheet = s;
    let saved = 0;
    try { saved = Number(localStorage.getItem(key)) || 0; } catch { /* як уперше */ }
    if (saved) set(saved);
    // Клавіатура стискає вікно — поле не зникає: верх поступається
    new ResizeObserver(() => { if (on() && sheet.scrollHeight > sheet.clientHeight) set(topH()); }).observe(sheet);
  };
  return { bar: grip, mount, on };
}

// Список її/його хотілок із фільтром бюджету; «Взять» заповнює рядки подарунка
async function pickFromWishes(box, rows) {
  if (!box.hidden) { box.hidden = true; return; }
  box.hidden = false;
  box.replaceChildren(h('p', { class: 'mk-wait' }, 'Загружаю хотелки…'));
  let data;
  try {
    data = await loadWishes();
  } catch {
    box.replaceChildren(h('p', { class: 'mk-wait' }, 'Не загрузилось — нет связи'));
    return;
  }
  const picked = new Set();
  let budget = ANY_BUDGET;
  // Хотілки кладемо лише в порожні рядки — вписане руками не чіпаємо; уже куплене не пропонуємо
  const free = rows.filter((r) => !r.title.value.trim());
  if (!free.length) {
    box.replaceChildren(h('p', { class: 'mk-wait' }, 'Все три варианта заняты. Сотри название в одном, и туда встанет хотелка.'));
    return;
  }
  const open = data.theirs.filter((w) => w.mark !== 'bought');
  // Повзунок створюємо раз і поза draw — перемальовується лише список під ним
  const slider = budgetSlider(open.map((w) => w.price), budget, (b) => { budget = b; draw(); });
  const listBox = h('div', { class: 'gift-wish-box' });
  box.replaceChildren(...[slider, listBox].filter(Boolean));
  const draw = () => {
    const list = open.filter((w) => fitsBudget(w, budget));
    listBox.replaceChildren(
      list.length ? h('div', { class: 'gift-wish-list' }, ...list.map((w) => h('button', {
        type: 'button', class: 'mk-chip gift-wish', 'aria-checked': String(picked.has(w.id)),
        onclick: () => {
          if (picked.has(w.id)) picked.delete(w.id);
          else if (picked.size < free.length) picked.add(w.id);
          else toast(free.length === 1 ? 'Свободен один вариант' : `Свободно вариантов: ${free.length}`);
          draw();
        },
      }, `${w.hot ? '🔥 ' : ''}${w.title}${w.price ? ` · ${money(w.price)}` : ''}`))) : h('p', { class: 'mk-wait' }, open.length ? 'В этот бюджет ничего' : 'Хотелок пока нет'),
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: !picked.size,
        onclick: () => {
          const ws = open.filter((w) => picked.has(w.id));
          ws.forEach((w, i) => {
            const r = free[i];
            r.emoji.value = '🎁';
            r.title.value = w.title.slice(0, 40);
            r.inside.value = w.note || 'То самое из твоего списка 💜';
          });
          box.hidden = true;
        },
      }, `Взять (${picked.size})`));
  };
  draw();
}
