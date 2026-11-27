// «Хотелки»: свій список бажань і список другого. Позначки «присмотрел/куплено» бачить лише той, хто ставить
import { DATA, who } from './data.js';
import { get, send, save, postBlob, imageUrl } from './api.js';
import { mascotImg, petName, petFor, petLine } from './icons.js';
import { h, toast, cap, showPhoto, ribbon, dayMonth, dateField } from './ui.js';
import { prepare, prepareError, toBase64 } from './memes.js';
import { swipeable } from './feed.js';
import { ask } from './ask.js';

export const money = (n) => `~${Number(n).toLocaleString('ru')} ₴`;
const PHOTO_SIDE = 720;

// Кроки бюджету «от — до»: ліворуч 0, праворуч ∞ («без верхней границы»), між ними — лише до найдорожчої хотілки
const STEPS = [300, 500, 700, 1000, 1500, 2000, 3000, 5000, 7000, 10000, 15000, 20000, 30000, 50000];
export const ANY_BUDGET = { min: 0, max: Infinity };
const rub = (n) => `${n.toLocaleString('ru')} ₴`;

// Два повзунки на одній смузі. onInput({ min, max }) — на кожен рух, без перемальовки самого повзунка
export function budgetSlider(prices, value, onInput) {
  const top = Math.max(0, ...prices.filter(Boolean));
  const steps = [0, ...STEPS.filter((x) => x < top), Infinity];
  if (steps.length < 3) return null;
  const last = steps.length - 1;
  const thumb = (label, i) => {
    const el = h('input', { type: 'range', min: '0', max: String(last), step: '1', 'aria-label': label });
    el.value = String(i);
    return el;
  };
  // Збережений бюджет міг устаріти (найдорожчу хотілку прибрали) — ставимо на найближчі кроки, що є
  const loAt = Math.min(last - 1, Math.max(0, steps.findLastIndex((x) => x <= value.min)));
  const hiAt = Math.max(loAt + 1, steps.findIndex((x) => x >= value.max));
  const lo = thumb('Бюджет от', loAt);
  const hi = thumb('Бюджет до', hiAt);
  const out = h('output', { class: 'want-budget-val' });
  // Крапки-кроки на смузі: видно, куди можна поставити повзунок
  const ticks = steps.map((_, i) => h('span', { class: 'want-range-tick', style: `--at: ${i / last}` }));
  const bar = h('div', { class: 'want-range' }, h('span', { class: 'want-range-fill' }), ...ticks, lo, hi);
  const show = () => {
    const min = steps[Number(lo.value)];
    const max = steps[Number(hi.value)];
    out.textContent = !min && max === Infinity ? 'любой'
      : !min ? `до ${rub(max)}`
      : max === Infinity ? `от ${rub(min)}`
      : `${min.toLocaleString('ru')} – ${rub(max)}`;
    lo.setAttribute('aria-valuetext', min ? `от ${rub(min)}` : 'от нуля');
    hi.setAttribute('aria-valuetext', max === Infinity ? 'без верхней границы' : `до ${rub(max)}`);
    bar.style.setProperty('--lo', String(Number(lo.value) / last));
    bar.style.setProperty('--hi', String(Number(hi.value) / last));
    // Обидва біля правого краю — лівий зверху, інакше його не вхопити з-під правого
    lo.style.zIndex = Number(lo.value) > last / 2 ? '3' : '1';
    return { min, max };
  };
  // Не перехрещуються: між ними щонайменше один крок
  lo.addEventListener('input', () => {
    if (Number(lo.value) >= Number(hi.value)) lo.value = String(Number(hi.value) - 1);
    onInput(show());
  });
  hi.addEventListener('input', () => {
    if (Number(hi.value) <= Number(lo.value)) hi.value = String(Number(lo.value) + 1);
    onInput(show());
  });
  const now = show();
  if (now.min !== value.min || now.max !== value.max) onInput(now);
  return h('div', { class: 'want-budget' },
    h('div', { class: 'want-budget-head' }, h('span', { class: 'mk-label' }, '💰 Бюджет'), out),
    bar,
    h('div', { class: 'want-range-ends', 'aria-hidden': 'true' }, h('span', {}, '0 ₴'), h('span', {}, 'без предела')));
}

// «К дате»: свята за днем і місяцем — назвою, решта — датою; минула дата вже не показується
const HOLIDAYS = {
  '12-31': 'Новому году', '01-01': 'Новому году', '02-14': '14 февраля', '03-08': '8 марта',
  '12-06': 'Николаю', '12-25': 'Рождеству', '10-01': 'Дню защитников',
};
// Великдень (православний: юліанська пасхалія + 13 днів — так до 2099 року) — щороку інша дата
function easterOf(y) {
  const d = (19 * (y % 19) + 15) % 30;
  const e = (2 * (y % 4) + 4 * (y % 7) - d + 34) % 7;
  const m = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const g = new Date(y, m - 1, day + 13);
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`;
}
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysTo = (due) => Math.round((new Date(`${due}T00:00:00`) - today()) / 864e5);
// Дні народження й річниця — з «Вместе» (лише на сервері); { 'MM-DD': назва для «к …» } очима того, хто дивиться
function ourDays() {
  const T = DATA.together || {};
  const out = {};
  if (T.since) out[T.since.slice(5)] = 'годовщине';
  [['vona', 'её'], ['vin', 'его']].forEach(([side, whose]) => {
    const d = T[side === 'vona' ? 'bdayVona' : 'bdayVin'];
    if (d) out[d.slice(5)] = `${side === DATA.side ? 'твоему' : whose} дню рождения`;
  });
  return out;
}
export function dueText(due) {
  if (!due) return '';
  const days = daysTo(due);
  if (days < 0) return '';
  const name = ourDays()[due.slice(5)] || HOLIDAYS[due.slice(5)] || (due === easterOf(+due.slice(0, 4)) ? 'Пасхе' : '')
    || new Date(`${due}T00:00:00`).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  return `🎁 к ${name}${days > 1 ? ` · через ${days} дн.` : days === 1 ? ' · завтра' : ' · сегодня'}`;
}
// Найближчий такий день: цього року, а якщо вже минув — наступного
// 29 лютого в невисокосний рік — 28-го, інакше рядок дати вийде неіснуючим
const onYear = (y, mmdd) => (mmdd === '02-29' && new Date(y, 1, 29).getMonth() !== 1 ? `${y}-02-28` : `${y}-${mmdd}`);
const nextDay = (mmdd) => {
  const y = today().getFullYear();
  const d = onYear(y, mmdd);
  return daysTo(d) >= 0 ? d : onYear(y + 1, mmdd);
};
// Найближчий Великдень
const nextEaster = () => { const y = today().getFullYear(); const e = easterOf(y); return daysTo(e) >= 0 ? e : easterOf(y + 1); };
// Свято з датою, що щороку інша (Великдень), — повною датою; решта — «MM-DD»
const dateOf = (md) => (md.length > 5 ? md : nextDay(md));

let view = 'theirs';
let budget = ANY_BUDGET;
// Його/її список: спершу «очень хочу», далі — до найближчої дати
const soon = (w) => (w.due && daysTo(w.due) >= 0 ? daysTo(w.due) : Infinity);
const byDue = (list) => [...list].sort((a, b) => (b.hot - a.hot) || (soon(a) - soon(b)));
const photos = new Map();
// Свої хотілки, змахнуті вліво: 5 с можна «Вернуть», потім — видалення на сервері
const removing = new Map();
const UNDO_MS = 5000;
// Згорнуті розділи («Куплено», «Сбылось»): перемальовка екрана не має їх згортати
const unfolded = new Set();
function wantFold(key, summary, ...children) {
  const el = h('details', { class: 'want-fold' }, h('summary', {}, summary), ...children);
  el.open = unfolded.has(key);
  el.addEventListener('toggle', () => { if (el.open) unfolded.add(key); else unfolded.delete(key); });
  return el;
}

// Відповідь сервера могла прийти, коли вже відкрита інша вкладка, — тоді не малюємо
const onWishTab = () => !!document.querySelector('.tab[data-tab="wish"].is-active');

export async function loadWishes() {
  DATA.wishes = await get('wishes');
  return DATA.wishes;
}

// Точка на вкладці: другий додав хотілку, якої ти ще не бачив(ла) у його/її списку
const newestTheirs = () => Math.max(0, ...(DATA.wishes?.theirs || []).map((w) => w.created || 0));
// Нові хотілки підсвічені, поки людина на вкладці: межа — «бачила» до цього заходу. Пішла — гаснуть
let freshFrom = null;
export function forgetFreshWishes() { freshFrom = null; }

export function markWishes() {
  document.querySelector('.tab[data-tab="wish"]')?.classList.toggle('has-new', newestTheirs() > (DATA.mine.wishesSeen || 0));
}

// Без ціни — завжди в списку: невідомо, скільки коштує
export const fitsBudget = (w, b) => !w.price || (w.price >= b.min && w.price <= b.max);

export function renderWishes(screen) {
  const me = who();
  // Є нове від другого — відкриваємо одразу його список
  if (freshFrom == null && newestTheirs() > (DATA.mine.wishesSeen || 0)) view = 'theirs';
  const theirsName = me.partner === 'она' ? 'Её' : 'Его';
  const data = DATA.wishes;
  const pet = petFor('box');
  const iMark = me.partner === 'она' ? 'присмотрел' : 'присмотрела';

  const seg = h('div', { class: 'mk-chips mk-kind want-seg', role: 'radiogroup' },
    ...[['theirs', `${theirsName} хотелки`], ['mine', 'Мои']].map(([v, label]) => h('button', {
      type: 'button', role: 'radio', class: 'mk-chip', 'aria-checked': String(view === v),
      onclick: () => { view = v; renderWishes(screen); },
    }, label)));

  const head = [
    h('h2', { class: 'title' }, 'Хотелки'),
    pet ? h('div', { class: 'courier want-courier' },
      h('span', { class: 'mascot', html: mascotImg(pet, 'festive') }),
      h('p', { class: 'bubble' }, h('b', {}, `${petName(pet)}: `),
        view === 'mine' ? petLine(pet, 'wishMine', `Пиши, чего хочется. ${cap(me.partner)} подглядит 😉`, 'wish')
          : petLine(pet, 'wishTheirs', 'Тсс. Что ты тут отметишь — останется между нами.', 'wish'))) : null,
    seg,
  ];

  if (!data) {
    const retry = () => {
      screen.replaceChildren(...head.filter(Boolean), h('p', { class: 'mk-wait' }, 'Загружаю…'));
      loadWishes()
        .then(() => { if (onWishTab()) renderWishes(screen); })
        .catch(() => {
          if (!onWishTab()) return;
          screen.replaceChildren(...head.filter(Boolean),
            h('p', { class: 'mk-wait' }, 'Не загрузилось — нет связи.'),
            h('button', { type: 'button', class: 'btn want-add', onclick: retry }, 'Попробовать ещё'));
        });
    };
    retry();
    return;
  }

  let body;
  if (view === 'mine') {
    // Подароване — окремо внизу, «Сбылось ✨»: список бажань не росте тим, що вже здійснилось
    const live = data.mine.filter((w) => !w.gifted);
    const came = data.mine.filter((w) => w.gifted).sort((a, b) => b.gifted - a.gifted);
    const gave = me.partner === 'она' ? 'подарила' : 'подарил';
    body = [
      h('button', { type: 'button', class: 'btn btn-primary want-add', onclick: () => editWish(screen, null) }, '+ Хочу'),
      live.length
        ? h('ul', { class: 'want-list' }, ...live.map((w) => mineCard(screen, w)))
        : h('p', { class: 'mk-wait' }, came.length ? 'Всё, что хотелось, сбылось ✨ Добавь новое.'
          : `Пока пусто. Добавь первое — можно просто вставить ссылку из магазина. ${cap(me.partner)} увидит.`),
      came.length ? wantFold('came', `Сбылось ✨ · ${came.length}`,
        h('ul', { class: 'want-list' }, ...came.map((w) => wishCard(w, {
          actions: h('span', { class: 'want-came' }, `✨ ${cap(me.partner)} ${gave} ${dayMonth(w.gifted)}`),
        })))) : null,
    ];
  } else {
    const newest = newestTheirs();
    if (newest > (DATA.mine.wishesSeen || 0)) {
      freshFrom ??= DATA.mine.wishesSeen || 0;
      DATA.mine.wishesSeen = newest;
      save('mine', { wishesSeen: newest });
    }
    markWishes();
    // Повзунок перемальовує лише список під собою — інакше палець зірвався б із нього посеред руху
    const listBox = h('div', { class: 'want-theirs' });
    const drawList = () => {
      // Куплене й подароване — вниз, згорнутим «Куплено»: зверху лишається те, що ще шукати
      const done = (w) => !!w.gifted || w.mark === 'bought';
      const all = byDue(data.theirs);
      const left = all.filter((w) => !done(w));
      const got = all.filter(done);
      const list = left.filter((w) => fitsBudget(w, budget));
      const card = (w) => wishCard(w, {
        open: true,
        fresh: freshFrom != null && w.created > freshFrom,
        actions: h('span', { class: 'want-marks' },
          done(w) ? null : markBtn(screen, w, 'eye', `🤫 ${iMark}`),
          w.gifted ? null : markBtn(screen, w, 'bought', '✓ куплено'),
          done(w) ? giftBtn(screen, w) : null),
      });
      listBox.replaceChildren(list.length
        ? h('ul', { class: 'want-list' }, ...list.map(card))
        : h('p', { class: 'mk-wait' }, left.length ? 'В этот бюджет ничего — сдвинь бегунки.'
          : got.length ? 'Всё уже куплено — оно внизу 🎉'
          : `${cap(me.partner)} пока ничего не ${me.partner === 'она' ? 'добавила' : 'добавил'}.`),
        got.length ? wantFold('got', `Куплено · ${got.length}`, h('ul', { class: 'want-list' }, ...got.map(card))) : '');
    };
    // Повзунок — до першого малювання: застарілий бюджет він сам поправить, а без повзунка фільтра немає
    const slider = budgetSlider(data.theirs.map((w) => w.price), budget, (b) => { budget = b; });
    if (!slider) budget = ANY_BUDGET;
    slider?.addEventListener('input', drawList);
    drawList();
    body = [
      slider,
      listBox,
      h('p', { class: 'hint' }, `Твои отметки ${me.partner} не видит.`),
    ].filter(Boolean);
  }
  screen.replaceChildren(...head.filter(Boolean), ...body.filter(Boolean));
}

// Фото хотілки з сервера — один раз за сеанс, далі з пам'яті
function photo(name, alt = '') {
  const img = h('img', { class: 'want-img', alt, loading: 'lazy' });
  if (!photos.has(name)) photos.set(name, imageUrl(name).catch(() => { photos.delete(name); return ''; }));
  photos.get(name).then((src) => { if (src) img.src = src; });
  return img;
}

// open — уся картка веде в магазин (чужі хотілки); onclick — відкриває форму (свої)
function wishCard(w, { onclick, actions, open, fresh, tag = 'li' } = {}) {
  const toShop = open && w.link;
  const inner = [
    w.img ? photo(w.img) : null,
    h('span', { class: 'want-text' },
      h('span', { class: 'want-title' }, `${w.hot ? '🔥 ' : ''}${w.title}`, fresh ? h('span', { class: 'inbox-new want-new' }, 'новое') : null),
      h('span', { class: 'want-meta' }, `${w.price ? money(w.price) : 'цена не указана'}${toShop ? ' · в магазин ↗' : ''}`),
      dueText(w.due) ? h('span', { class: 'want-due' }, dueText(w.due)) : null,
      w.note ? h('span', { class: 'want-note' }, w.note) : null),
  ];
  const ext = { href: w.link, target: '_blank', rel: 'noopener noreferrer' };
  const link = w.link && !toShop ? h('a', { class: 'want-link', ...ext }, 'открыть ↗') : null;
  const body = toShop ? h('a', { class: 'want-body', ...ext, 'aria-label': `${w.title} — открыть в магазине` }, ...inner)
    : onclick ? h('button', { type: 'button', class: 'want-body', onclick }, ...inner)
    : h('div', { class: 'want-body' }, ...inner);
  return h(tag, { class: `want${w.mark ? ` is-${w.mark}` : ''}${w.img ? ' has-img' : ''}${fresh ? ' is-fresh' : ''}` },
    body,
    link || actions ? h('div', { class: 'want-foot' }, link, actions) : null);
}

// Своя хотілка: тап — форма, змах уліво — прибрати (з «Вернуть»)
function mineCard(screen, w) {
  if (removing.has(w.id)) return undoRow(screen, w);
  // Картка їде за пальцем, а під нею відкривається, що станеться
  const card = wishCard(w, { onclick: () => editWish(screen, w), tag: 'div' });
  const li = h('li', { class: 'want-swipe' }, card);
  swipeable(li, card, {
    place: 'wish',
    canRight: () => false,
    fold: false,
    onLeft: () => {
      const timer = setTimeout(async () => {
        try {
          await send(`wishes/${w.id}`, 'DELETE');
          await loadWishes();
        } catch {
          toast('Не удалилось — нет связи');
        }
        removing.delete(w.id);
        if (onWishTab()) renderWishes(screen);
      }, UNDO_MS);
      removing.set(w.id, timer);
      li.replaceWith(undoRow(screen, w));
    },
  });
  return li;
}

function undoRow(screen, w) {
  return h('li', { class: 'want-undo' },
    h('span', {}, `Убрано: ${w.title}`),
    h('button', {
      type: 'button', class: 'sent-take',
      onclick: () => {
        clearTimeout(removing.get(w.id));
        removing.delete(w.id);
        if (onWishTab()) renderWishes(screen);
      },
    }, 'Вернуть'));
}

// «Подарено» — коли вже вручили: у другого хотілка переходить у «Сбылось ✨», йому push і рядок у чаті
function giftBtn(screen, w) {
  const she = who().partner === 'она';
  return h('button', {
    type: 'button',
    class: 'want-mark want-gift',
    'aria-pressed': String(!!w.gifted),
    onclick: async () => {
      const prev = { gifted: w.gifted, mark: w.mark };
      w.gifted = w.gifted ? null : Date.now();
      if (w.gifted) w.mark = 'bought';
      renderWishes(screen);
      try {
        const r = await send(`wishes/${w.id}`, 'PUT', { gifted: !!w.gifted });
        if (r?.gifted) w.gifted = r.gifted;
        if (w.gifted) toast(`${cap(she ? 'она' : 'он')} увидит это в «Сбылось» ✨`);
        document.dispatchEvent(new CustomEvent('radovalka:marked'));
      } catch {
        Object.assign(w, prev);
        if (onWishTab()) renderWishes(screen);
        toast('Не сохранилось — нет связи');
      }
    },
  }, w.gifted ? '🎁 подарено' : '🎁 Подарено');
}

function markBtn(screen, w, mark, label) {
  return h('button', {
    type: 'button',
    class: 'want-mark',
    'aria-pressed': String(w.mark === mark),
    onclick: async () => {
      const prev = w.mark;
      w.mark = prev === mark ? null : mark;
      renderWishes(screen);
      try {
        await send(`wishes/${w.id}`, 'PUT', { mark: w.mark });
      } catch {
        w.mark = prev;
        if (onWishTab()) renderWishes(screen);
        toast('Не сохранилось — нет связи');
      }
    },
  }, label);
}

// Посилання з тексту, яким поділились («Подивись: Светр … https://…»)
export const linkIn = (text) => /https?:\/\/\S+/i.exec(String(text || ''))?.[0]?.replace(/[)\].,»"']+$/, '') || '';

// Нова хотілка з «Поделиться» в магазині: форма одразу з посиланням і заповнюється сама
export function wishFromShare(screen, link) {
  view = 'mine';
  renderWishes(screen);
  editWish(screen, null, link);
}

const FILL_ERRORS = {
  fetch: 'Магазин не отдал страницу. Открой товар, выдели и скопируй текст страницы — и вставь сюда.',
  empty: 'На странице не видно товара. Скопируй текст со страницы товара и вставь сюда.',
  url: 'Это не похоже на ссылку на сайт.',
};

// Додати або змінити свою хотілку
function editWish(screen, w, sharedLink = '') {
  const field = (attrs, value = '') => { const el = h('input', attrs); el.value = value ?? ''; return el; };
  const link = field({ type: 'url', maxlength: '500', placeholder: 'Ссылка на товар', 'aria-label': 'Ссылка' }, w?.link || sharedLink);
  const title = field({ type: 'text', maxlength: '120', placeholder: 'Что хочется', 'aria-label': 'Что хочется' }, w?.title);
  const price = field({ type: 'number', inputmode: 'numeric', min: '0', step: '50', placeholder: 'Цена, ₴', 'aria-label': 'Примерная цена' }, w?.price);
  const note = field({ type: 'text', maxlength: '500', placeholder: 'Размер, цвет, подробности', 'aria-label': 'Подробности' }, w?.note);
  let hot = !!w?.hot;
  // «К дате»: свято одним дотиком (найближче), своя дата — календарем; ще дотик — без дати
  let due = w?.due || null;
  const dueIn = dateField(h('input', { type: 'date', class: 'want-due-in', 'aria-label': 'К какой дате', hidden: true }));
  const dueChips = h('div', { class: 'mk-chips mk-row want-due-row', role: 'radiogroup', 'aria-label': 'К дате' });
  // Свій день народження (хотілка — подарунок мені) і річниця — якщо дати вписані у «Вместе»
  const T = DATA.together || {};
  const myBday = T[DATA.side === 'vona' ? 'bdayVona' : 'bdayVin'];
  const PRESETS = [
    ...(myBday ? [[myBday.slice(5), '🎂', 'Мой ДР']] : []),
    ...(T.since ? [[T.since.slice(5), '💞', 'Годовщина']] : []),
    ['12-31', '🎄', 'Новый год'], ['02-14', '💘', '14 февраля'], ['03-08', '💐', '8 марта'],
    ['12-06', '🎁', 'Святой Николай'], ['12-25', '🌟', 'Рождество'], [nextEaster(), '🐣', 'Пасха'], ['10-01', '🛡️', 'День защитников'],
  ].filter(([md], i, all) => all.findIndex(([x]) => x === md) === i) // той самий день — одна кнопка, свій ДР першим
    // Найближче свято — першим: так і видно, до чого встигнути
    .sort(([a], [b]) => daysTo(dateOf(a)) - daysTo(dateOf(b)));
  // Картка дати: значок, назва, коли — «10 дек · через 22 дн.»
  const when = (d) => {
    const n = daysTo(d);
    const day = new Date(`${d}T00:00:00`).toLocaleDateString('ru', { day: 'numeric', month: 'short' }).replace('.', '');
    return `${day} · ${n > 1 ? `через ${n} дн.` : n === 1 ? 'завтра' : 'сегодня'}`;
  };
  const card = (emoji, name, sub) => [
    h('span', { class: 'due-emoji', 'aria-hidden': 'true' }, emoji),
    h('span', { class: 'due-name' }, name),
    h('span', { class: 'due-when' }, sub)];
  const drawDue = () => {
    const preset = due && PRESETS.find(([md]) => (md.length > 5 ? due === md : due.slice(5) === md));
    const own = !!due && !preset;
    dueIn.hidden = !own;
    if (own) dueIn.value = due;
    // Своя дата (день народження, річниця) — першою, вона потрібна найчастіше; свята — далі в рядку
    dueChips.replaceChildren(
      h('button', {
        type: 'button', role: 'radio', class: 'mk-chip due-card', 'aria-checked': String(own),
        onclick: () => {
          if (own) { due = null; drawDue(); return; }
          // Своя шторка календаря (та сама, що й тапом по полю)
          dueIn.click();
        },
      }, ...card('📅', own ? 'Своя дата' : 'Дата', own ? when(due) : 'выбрать')),
      ...PRESETS.map(([md, emoji, name]) => h('button', {
        type: 'button', role: 'radio', class: 'mk-chip due-card', 'aria-checked': String(preset?.[0] === md),
        onclick: () => { due = preset?.[0] === md ? null : dateOf(md); drawDue(); },
      }, ...card(emoji, name, when(dateOf(md))))));
  };
  // Стрічка — спільна для всього застосунку (краї тануть, стрілки ‹ ›)
  ribbon(dueChips);
  dueIn.min = today().toLocaleDateString('sv');
  dueIn.addEventListener('change', () => { due = dueIn.value || null; drawDue(); });
  drawDue();
  const hotBtn = h('button', { type: 'button', class: 'mk-chip', 'aria-checked': String(hot), onclick: () => { hot = !hot; hotBtn.setAttribute('aria-checked', String(hot)); } }, '🔥 очень хочу');

  // Фото: undefined — не чіпали, null — прибрали, Blob — нове
  let pic;
  const picBox = h('div', { class: 'want-pic' });
  const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const drawPic = () => {
    const img = pic instanceof Blob ? h('img', { class: 'want-img', alt: 'Фото', src: URL.createObjectURL(pic) })
      : pic === undefined && w?.img ? photo(w.img, 'Фото') : null;
    // replaceChildren не пропускає null, на відміну від h()
    picBox.replaceChildren(...[
      img ? h('span', { class: 'want-pic-frame' },
        h('button', { type: 'button', class: 'want-pic-zoom', 'aria-label': 'Посмотреть фото крупно', onclick: () => { if (img.src) showPhoto(img.src, title.value || 'Фото'); } }, img),
        h('button', { type: 'button', class: 'want-pic-del', 'aria-label': 'Убрать фото', onclick: () => { pic = null; drawPic(); } }, '✕')) : null,
      // Фото — квадратик біля назви, а не цілий рядок; змінити — прибрати ✕ і вибрати нове
      img ? null : h('button', { type: 'button', class: 'want-pic-add', 'aria-label': 'Добавить фото', onclick: () => fileIn.click() }, '📷'),
    ].filter(Boolean));
  };
  const takeFile = async (blob) => {
    try {
      pic = await prepare(blob, PHOTO_SIDE, false);
      drawPic();
    } catch (e) {
      toast(prepareError(e));
    }
  };
  fileIn.addEventListener('change', () => { if (fileIn.files[0]) takeFile(fileIn.files[0]); fileIn.value = ''; });
  drawPic();

  // «Заповнити»: сторінку читає Worker, ИИ складає назву, ціну й подробиці; людина перевіряє
  const status = h('p', { class: 'want-status', 'aria-live': 'polite' });
  const pasted = h('textarea', { class: 'want-paste', rows: '4', placeholder: 'Текст со страницы товара', 'aria-label': 'Текст со страницы товара', hidden: true });
  const fillBtn = h('button', { type: 'button', class: 'btn btn-primary want-fill' }, '✨ Заполнить');
  const fill = async () => {
    const url = linkIn(link.value) || link.value.trim();
    const text = pasted.hidden ? '' : pasted.value.trim();
    if (!url && !text) { link.focus(); return; }
    if (url !== link.value) link.value = url;
    fillBtn.disabled = true;
    status.textContent = text ? 'Читаю текст…' : 'Смотрю, что там в магазине…';
    try {
      const r = await send('wish-from-url', 'POST', text ? { text, ...(url ? { url } : {}) } : { url });
      title.value = r.title || title.value;
      if (r.price) price.value = r.price;
      if (r.note) note.value = r.note;
      pasted.hidden = true;
      status.textContent = 'Готово — проверь и поправь, если что.';
      if (r.image) {
        try {
          await takeFile(await postBlob('wish-image', { url: r.image }));
        } catch { /* без фото теж добре */ }
      }
    } catch (e) {
      const code = e.code || '';
      status.textContent = FILL_ERRORS[code] || (e.status ? 'Не получилось разобрать. Заполни вручную или вставь текст страницы.' : 'Нет связи');
      if (code === 'fetch' || code === 'empty' || code === 'ai') { pasted.hidden = false; pasted.focus(); }
    } finally {
      fillBtn.disabled = false;
    }
  };
  fillBtn.addEventListener('click', fill);

  const close = () => { sheet.remove(); backdrop.remove(); };
  const saveBtn = h('button', { type: 'button', class: 'btn btn-primary' }, 'Сохранить');
  const save = async () => {
    if (!title.value.trim()) { title.focus(); return; }
    saveBtn.disabled = true;
    const body = { title: title.value, price: price.value, link: linkIn(link.value), note: note.value, hot, due };
    try {
      if (pic instanceof Blob) body.img = { type: pic.type, data: await toBase64(pic) };
      else if (pic === null) body.img = null;
      if (w) await send(`wishes/${w.id}`, 'PUT', body);
      else await send('wishes', 'POST', body);
    } catch (e) {
      saveBtn.disabled = false;
      toast(e.status === 413 ? 'Фото слишком большое' : 'Не сохранилось — нет связи');
      return;
    }
    close();
    try {
      await loadWishes();
    } catch {
      toast('Сохранено, но список не обновился — нет связи');
      return;
    }
    if (onWishTab()) renderWishes(screen);
  };
  saveBtn.addEventListener('click', save);
  const remove = async () => {
    if (!await ask({ title: 'Убрать из хотелок?', yes: 'Убрать', say: 'wishRemove' })) return;
    try {
      await send(`wishes/${w.id}`, 'DELETE');
      close();
      await loadWishes();
      if (onWishTab()) renderWishes(screen);
    } catch {
      toast('Не удалилось — нет связи');
    }
  };

  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-maker', role: 'dialog', 'aria-modal': 'true', 'aria-label': w ? 'Изменить хотелку' : 'Новая хотелка' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    h('div', { class: 'sheet-inner want-form' },
      h('h2', {}, w ? 'Хотелка' : 'Хочу…'),
      h('div', { class: 'want-fillbox' },
        h('div', { class: 'want-linkrow' }, link, fillBtn),
        status, pasted),
      fileIn,
      h('div', { class: 'want-titlerow' }, title, picBox),
      // Ціна — коротке поле, поруч «очень хочу»: обидва в один рядок
      h('div', { class: 'want-pricerow' }, price, hotBtn),
      note,
      h('span', { class: 'mk-label want-due-label' }, 'К дате'),
      dueChips, dueIn,
      h('div', { class: 'sheet-actions' },
        w ? h('button', { type: 'button', class: 'btn want-remove', onclick: remove }, 'Уже не хочу') : null,
        saveBtn)));
  document.body.append(backdrop, sheet);
  if (sharedLink) fill();
  else (w ? title : link).focus();
}
