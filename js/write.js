// «✍️ Написать»: лист зараз, на ранок або записка в її/його конверт; нижче — що вже надіслано
import { DATA, who } from './data.js';
import { deliver } from './outbox.js';
import { petName, petSrc, petFor } from './icons.js';
import { h, toast, cap, ARROW, reduceMotion } from './ui.js';
import { mountHelper } from './helper.js';
import { loadWishes, fitsBudget, money, budgetSlider, ANY_BUDGET } from './wishes.js';
import { composeMeme, composeGif } from './memes.js';
import { openGifs } from './maker.js';
import { recentThread } from './feed.js';

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
// Стрічка чипів, що гортається вбік: край, за яким ще щось є, тане — видно, що можна горнути; вибраний чип — у полі зору
function ribbon(row) {
  row.classList.add('write-when');
  const edges = () => {
    const end = row.scrollWidth - row.clientWidth - row.scrollLeft;
    row.classList.toggle('is-more-start', row.scrollLeft > 4);
    row.classList.toggle('is-more-end', end > 4);
  };
  row.addEventListener('scroll', edges, { passive: true });
  row.addEventListener('click', (e) => e.target.closest('.mk-chip')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' }));
  new ResizeObserver(edges).observe(row);
}

const whenShort = (ms) => (new Date(ms).toDateString() === new Date().toDateString() ? hhmm(ms) : dayMonth(ms));

// preset — { where: 'env', envId } з тапу по сповіщенню про порожній конверт;
// { reply: { quote, onSend } } — той самий екран для відповіді: цитата зверху, без «Когда» й «Кто понесёт»,
// onSend(text) відправляє й повертає текст тосту (або null)
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
  [whereRow, envRow.firstChild].forEach(ribbon);
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
  if (!reply) mountHelper(helper, area);
  const go = h('button', { type: 'button', class: 'btn btn-primary write-go', html: `${ARROW}Отправить` });

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    backdrop.remove();
  };

  // Мемчик замість листа: шторка листа закривається, далі — шторка мемчика; стрічка оновиться сама
  const memeSent = () => document.dispatchEvent(new CustomEvent('radovalka:sent'));
  // input лишається в шторці, доки не обрано файл, — від'єднаний input change не надійний
  const picker = h('input', {
    type: 'file', accept: 'image/*', class: 'visually-hidden',
    onchange: (e) => {
      const [file] = e.target.files;
      if (!file) return;
      close();
      composeMeme(file, memeSent);
    },
  });
  const tools = h('div', { class: 'write-tools' },
    h('label', { class: 'mk-chip' }, picker, '📷 Фото'),
    h('button', {
      type: 'button', class: 'mk-chip',
      onclick: () => { close(); openGifs((gif) => composeGif(gif, memeSent)); },
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
  // Поле росте, поки пишеш, — переписка над ним стискається
  const grow = () => { area.style.height = 'auto'; area.style.height = `${area.scrollHeight + 2}px`; };
  area.addEventListener('input', grow);

  go.addEventListener('click', async () => {
    const text = area.value.trim();
    if (reply) {
      if (!text) { area.focus(); return; }
      go.disabled = true;
      try {
        const said = await reply.onSend(text);
        close();
        toast(said || 'Отправлено ➶');
      } catch {
        go.disabled = false;
        toast('Не отправилось — проверь интернет');
      }
      return;
    }
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
      });
      draft.set('');
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
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: `sheet sheet-full sheet-maker sheet-write${reply ? ' is-reply' : ''}${thread ? ' has-thread' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-inner' }, ...[
      h('div', { class: 'write-head' },
        h('h2', {}, title),
        h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕')),
      ctx,
      thread,
      reply ? null : tools,
      area,
      h('div', { class: 'write-dock' }, ...[
        ...(reply ? [] : [whereRow, envRow, dateRow, giftBox, note]),
        h('div', { class: 'write-send' }, ...[reply || !pets.length ? null : petRow, go].filter(Boolean)),
      ]),
    ].filter(Boolean)));
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  // Клавіатура стискає вікно — переписка лишається притиснутою донизу, найсвіжіше біля поля
  if (thread) new ResizeObserver(() => { thread.scrollTop = thread.scrollHeight; }).observe(thread);
  if (area.value) grow();
  else area.focus();
  return { sheet, area };
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
