// «✍️ Написать»: лист зараз, на ранок або записка в її/його конверт; нижче — що вже надіслано
import { DATA, who } from './data.js';
import { send } from './api.js';
import { petName, petSrc, petFor } from './icons.js';
import { h, toast, cap, ARROW } from './ui.js';
import { mountHelper } from './helper.js';
import { loadWishes, fitsBudget, money, budgetSlider, ANY_BUDGET } from './wishes.js';
import { composeMeme, composeGif } from './memes.js';
import { openGifs } from './maker.js';

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

export function openWrite() {
  const me = who();
  const envs = DATA.partnerEnvelopes || [];
  let where = 'now';
  let envId = envs[0]?.id || null;
  let pet = petFor('push');

  const said = `Пиши как есть — так, как ${me.partner === 'она' ? 'сказал' : 'сказала'} бы вслух…`;
  const area = h('textarea', { class: 'write-text', 'data-voice': true, 'aria-label': 'Текст письма', placeholder: said });
  area.value = draft.get();
  area.addEventListener('input', () => draft.set(area.value));

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
    area.placeholder = where === 'gift' ? 'Пару слов к подарку (можно без)' : said;
    note.textContent = where === 'gift'
      ? `${cap(me.partner)} увидит закрытые конверты и выберет один. Что внутри — узнает после выбора, остальные тоже откроются.`
      : where === 'now'
      ? `Появится у ${me.partner === 'он' ? 'него' : 'неё'}, как только ${me.partner} откроет Радовалку.`
      : where === 'morning'
        ? `Придёт ${dayWord(m.getTime())} в ${hhmm(m.getTime())} — как письмо дня.`
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

  const whereRow = chips([
    { v: 'now', label: 'Сейчас' },
    { v: 'morning', label: 'На утро' },
    { v: 'date', label: '🎂 К дате' },
    ...(envs.length ? [{ v: 'env', label: 'В конверт' }] : []),
    { v: 'gift', label: '🎁 Подарок' },
  ], where, (v) => { where = v; paintNote(); });
  envRow.append(chips(envs.map((e) => ({ v: e.id, label: `${e.emoji} ${e.label}` })), envId, (v) => { envId = v; }));
  paintNote();

  const pets = Object.keys(DATA.mascots);
  const petRow = chips(pets.map((k) => ({
    v: k, html: `<img src="${petSrc(k)}" alt="" width="40" height="40"><span>${petName(k)}</span>`,
  })), pet, (v) => { pet = v; });
  petRow.classList.add('write-pets');

  const helper = h('div', { class: 'write-helper' });
  mountHelper(helper, area);
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
  const memeRow = h('div', { class: 'write-meme' },
    h('span', {}, 'Или мемчик:'),
    h('label', { class: 'mk-chip' }, picker, '📷 Из галереи'),
    h('button', {
      type: 'button', class: 'mk-chip',
      onclick: () => { close(); openGifs((gif) => composeGif(gif, memeSent)); },
    }, '🎞 Гифка'));

  go.addEventListener('click', async () => {
    const text = area.value.trim();
    const gift = where === 'gift' ? giftOptions() : null;
    if (gift && gift.length < 2) { toast('Нужно хотя бы два варианта'); giftRows[gift.length].title.focus(); return; }
    if (!text && !gift) { area.focus(); return; }
    if (where === 'date' && !dateAt()) { toast('Выбери дату'); dateInput.focus(); return; }
    go.disabled = true;
    try {
      await send('letters', 'POST', {
        kind: where,
        text,
        mascot: pet,
        env: where === 'env' ? envId : undefined,
        at: where === 'morning' ? nextMorning().getTime() : where === 'date' ? dateAt() : undefined,
        gift: gift || undefined,
      });
      draft.set('');
      close();
      document.dispatchEvent(new CustomEvent('radovalka:sent'));
      toast(`${petName(pet) || 'Почтальон'} ${isShe(pet) ? 'понесла' : 'понёс'} ${gift ? 'подарок 🎁' : 'письмо ➶'}`);
    } catch {
      go.disabled = false;
      toast('Не отправилось — проверь интернет. Текст сохранён.');
    }
  });

  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-maker sheet-write', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Письмо ${me.toWhom}` },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    h('div', { class: 'sheet-inner' },
      h('h2', {}, `Письмо ${me.toWhom}`),
      memeRow,
      helper,
      area,
      h('div', { class: 'mk-group' }, h('p', { class: 'mk-label' }, 'Когда'), whereRow, envRow, dateRow, giftBox, note),
      pets.length ? h('div', { class: 'mk-group' }, h('p', { class: 'mk-label' }, 'Кто понесёт'), petRow) : null,
      go));
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  if (!area.value) area.focus();
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
    box.replaceChildren(h('p', { class: 'mk-wait' }, 'Все три варианта уже заполнены — очисти название, куда поставить хотелку.'));
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
