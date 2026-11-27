// «🛠 Отладка» — лише на його половині: печеньки, запас ідей, питання «Совпадёт?». Нічого звідси не йде до неї
import { DATA } from './data.js';
import { get, send, swapKeys } from './api.js';
import { forgetFirstDay } from './tour.js';
import { ask } from './ask.js';
import { h, toast, aboutGroup, aboutRow } from './ui.js';
import { previewCookie, allFortunes } from './cookie.js';
import { previewNewYear } from './newyear.js';
import { CATS } from './plans.js';
import { SAME_TOPICS } from './same.js';
import { INSTRUMENTS, SOUND_NAMES, myInstrument, playAs, soundOn, soundParts } from './sound.js';

// Одна шторка за раз; підшторка замість «Отладки», після ✕ чи Escape — назад до неї (back)
function sheet(label, cls, back, ...kids) {
  const onKey = (e) => { if (e.key === 'Escape') close(true); };
  const close = (goBack) => {
    document.removeEventListener('keydown', onKey);
    box.remove();
    backdrop.remove();
    if (goBack && back) back();
  };
  const backdrop = h('div', { class: 'backdrop', onclick: () => close(true) });
  const box = h('div', { class: `sheet sheet-together sheet-about ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': back ? 'Назад к отладке' : 'Закрыть', onclick: () => close(true) }, '✕'),
    h('div', { class: 'sheet-inner' }, ...kids));
  document.body.append(backdrop, box);
  document.addEventListener('keydown', onKey);
  return close;
}

const section = (title, items) => [h('h3', { class: 'about-group-title' }, title), h('ol', { class: 'fortune-list' }, ...items)];

function openFortunes() {
  const { regular, golden, newYear } = allFortunes();
  sheet('Все предсказания', 'debug-sub', openDebug,
    h('h2', { class: 'title' }, 'Предсказания'),
    ...section(`🎄 Новогодние · ${newYear.length}`, newYear.map((t) => h('li', {}, t))),
    ...section(`✨ Золотые · ${golden.length}`, golden.map((t) => h('li', {}, t))),
    ...section(`🥠 Обычные · ${regular.length}`, regular.map((t) => h('li', {}, t))));
}

// Проба Хелловіну: на 20 с його телефон бере її осінній вигляд із Джеком-ліхтарем, потім повертає свій
function previewHalloween() {
  const root = document.documentElement;
  const was = { side: root.dataset.side, dark: root.hasAttribute('data-dark'), cls: root.className };
  root.dataset.side = 'vona';
  root.removeAttribute('data-dark');
  root.classList.remove('is-aurora', 'is-milky', 'is-summer', 'is-winter', 'is-newyear');
  root.classList.add('is-autumn', 'is-halloween');
  toast('Хэллоуин у неё — 20 секунд 🎃');
  setTimeout(() => { root.dataset.side = was.side; root.toggleAttribute('data-dark', was.dark); root.className = was.cls; }, 20000);
}

// Його новорічне побажання їй: до 200 знаків, зашифроване; вона отримає його в новорічній печеньці 1 січня
async function openWish() {
  let mine = '';
  try { mine = (await get('ny-wish'))?.mine || ''; } catch { toast('Не загрузилось — нет связи'); return; }
  const field = h('textarea', { class: 'tpl-field ny-wish-field', rows: 4, maxlength: 200, placeholder: 'Например: «Пусть этот год соберёт нас за одним столом…»', 'aria-label': 'Пожелание ей на Новый год' });
  field.value = mine;
  const save = async (text) => {
    try {
      await send('ny-wish', 'PUT', { text });
      toast(text ? 'Сохранено — откроется у неё 1 января 🎄' : 'Убрано — будет фраза из списка');
      close();
      openDebug();
    } catch { toast('Не сохранилось — нет связи'); }
  };
  const close = sheet('Пожелание на Новый год', 'debug-sub', openDebug,
    h('h2', { class: 'title' }, 'Пожелание ей'),
    h('p', { class: 'hint' }, 'В 00:00 1 января её новогодняя печенька покажет эти слова с подписью «от него» вместо фразы из списка. До этого она их не увидит'),
    field,
    h('div', { class: 'actions' },
      mine ? h('button', { type: 'button', class: 'btn', onclick: () => save('') }, 'Убрать') : null,
      h('button', { type: 'button', class: 'btn btn-primary', onclick: () => save(field.value.trim()) }, 'Сохранить')));
  field.focus();
}

// Запас ідей «Планов» — із сервера (їй сервер його не віддає)
async function openPool() {
  let pool;
  try { pool = await get('plan-pool'); } catch { toast('Не загрузилось — нет связи'); return; }
  const total = Object.values(pool).reduce((n, l) => n + l.length, 0);
  sheet('Идеи для планов', 'debug-sub', openDebug,
    h('h2', { class: 'title' }, `Идеи · ${total}`),
    ...CATS.filter(([k]) => pool[k]?.length).flatMap(([k, emoji, label]) => section(`${emoji} ${label} · ${pool[k].length}`,
      pool[k].map(([t, n]) => h('li', {}, h('b', {}, t), n ? h('br') : null, n ? h('small', {}, n) : null)))));
}

function openSameQs() {
  const total = SAME_TOPICS.reduce((n, [, , qs]) => n + Object.keys(qs).length, 0);
  sheet('Вопросы «Совпадёт?»', 'debug-sub', openDebug,
    h('h2', { class: 'title' }, `Совпадёт? · ${total}`),
    h('p', { class: 'hint' }, 'В игре 10 вопросов, из каждой темы хотя бы один'),
    ...SAME_TOPICS.flatMap(([emoji, title, qs]) => section(`${emoji} ${title} · ${Object.keys(qs).length}`,
      Object.values(qs).map(([q, a, b]) => h('li', {}, q, h('br'), h('small', {}, `${a} · ${b}`))))));
}

// Пульт звуків: обрати інструмент і зіграти будь-яку подію. Остання група — звуки без інструмента (однакові в усіх)
const SFX_GROUPS = [
  ['💌 Письма', [['letter', 'Пришло письмо'], ['sent', 'Отправлено'], ['open', 'Конверт открыт']]],
  ['🎲 Игры', [['turn', 'Твой ход'], ['place', 'Крестик'], ['drop', 'Фишка'], ['line', 'Рисочка'], ['flip', 'Карточка'],
    ['pair', 'Пара'], ['miss', 'Мимо'], ['tick', 'Раз, два'], ['tock', 'Три!'], ['reveal', 'Руки открылись'],
    ['win', 'Победа'], ['lose', 'Проигрыш'], ['draw', 'Ничья'], ['splash', 'Морской бой: мимо']]],
  ['🥠 Печеньки и планы', [['cookieIn', 'Печенька пришла'], ['cookie', 'Разломить'], ['goldIn', 'Золотая пришла'],
    ['gold', 'Разломить золотую'], ['spin', 'Барабан'], ['pick', 'Барабан встал'], ['like', 'План: ❤️'], ['pass', 'План: ✕ или ⏳'],
    ['match', 'Совпали планы']]],
  ['🔇 Без инструмента, у всех одинаково', [['react', 'Реакция'], ['love', 'Сердечки'], ['shot', 'Выстрел'], ['hit', 'Попал'],
    ['sunk', 'Потопил'], ['note', 'Записка в кораблике'], ['bell', 'Звоночек: зовут'], ['ring', 'Звоночек: зовёшь'], ['sos', 'SOS: тревога у второго']]],
];
function openSounds() {
  let inst = myInstrument();
  const chips = h('div', { class: 'instr-row', role: 'radiogroup', 'aria-label': 'Инструмент' });
  const paint = () => chips.replaceChildren(...Object.entries(INSTRUMENTS).map(([k, { name }]) => h('button', {
    type: 'button', class: 'instr-chip', role: 'radio', 'aria-checked': String(k === inst),
    onclick: () => { inst = k; paint(); playAs('pair', inst); },
  }, name)));
  paint();
  const listed = new Set(SFX_GROUPS.flatMap(([, list]) => list.map(([k]) => k)));
  const rest = SOUND_NAMES.filter((k) => !listed.has(k)).map((k) => [k, k]);
  const groups = rest.length ? [...SFX_GROUPS, ['Прочее', rest]] : SFX_GROUPS;
  sheet('Все звуки', 'debug-sub', openDebug,
    h('h2', { class: 'title' }, 'Звуки'),
    h('p', { class: 'hint' }, soundOn() ? 'Тап по инструменту — послушать его (первый раз запись грузится пару секунд). Твой выбор в «Звуках» не меняется'
      : 'Звуки выключены — включи в «О Радовалке» → «Звуки»'),
    chips,
    h('p', { class: 'hint' }, '🎤 — запись шума, 🎵 — нота инструмента, который выбран выше. Без значков — простой синтез'),
    ...groups.flatMap(([title, list]) => [h('h3', { class: 'about-group-title' }, title),
      h('div', { class: 'instr-row sfx-row' }, ...list.map(([k, label]) => {
        const { inst: i, rec } = soundParts(k);
        return h('button', { type: 'button', class: 'instr-chip', onclick: () => playAs(k, inst) },
          label, rec || i ? h('span', { class: 'sfx-marks', 'aria-hidden': 'true' }, `${rec ? '🎤' : ''}${i ? '🎵' : ''}`) : null);
      }))]));
}

// «Играть за двоих»: у грі зʼявляється кнопка «🎭 За неё» — її ходи йдуть її ключем (на цьому телефоні є обидва)
const BOTH = 'radovalka:debug-both';
const bothOn = () => { try { return localStorage.getItem(BOTH) === '1'; } catch { return false; } };
function bothRow() {
  const note = () => (bothOn() ? 'Включено: в игре кнопка «🎭 За неё»' : 'Ходить и за неё — проверить игру одному');
  const row = aboutRow('🎭', 'Играть за двоих', note(), () => {
    try { localStorage.setItem(BOTH, bothOn() ? '0' : '1'); } catch { /* приватне вікно */ }
    row.querySelector('small').textContent = note();
    toast(bothOn() ? 'Включено — открой игру, вверху «🎭 За неё»' : 'Выключено');
  });
  return row;
}

async function rehearse() {
  const yes = await ask({ title: 'Репетиция первого дня у неё?', text: 'Сброшу на этом телефоне тур, оформление и подсказки, отключу уведомления — тур спросит их заново. Письма, конверты и ключи останутся. Откроется её половина', yes: 'Начать' });
  if (!yes) return;
  await forgetFirstDay();
  swapKeys();
  location.replace(location.pathname);
}

export function openDebug() {
  if (DATA.side !== 'vin') return;
  const cookie = (gold) => () => { close(); setTimeout(() => previewCookie(gold), 300); };
  const sub = (open) => () => { close(); open(); };
  // Пробний Новий рік; у її вигляді — з його побажанням (якщо написав)
  const ny = (look) => async () => {
    close();
    let wish = null;
    if (look) { try { wish = (await get('ny-wish'))?.mine || null; } catch { /* без мережі — фраза зі списку */ } }
    setTimeout(() => previewNewYear({ look, wish }), 300);
  };
  const count = SAME_TOPICS.reduce((n, [, , qs]) => n + Object.keys(qs).length, 0);
  const close = sheet('Отладка', 'debug-sheet', null,
    h('h2', { class: 'title' }, 'Отладка'),
    h('p', { class: 'hint' }, 'Видно только тебе. Отсюда ничего не уходит, кроме твоего новогоднего пожелания — его она увидит 1 января'),
    aboutGroup('Печеньки',
      aboutRow('🥠', 'Показать печеньку', 'Пробная: настоящую не тратит, отправить нельзя', cookie(false)),
      aboutRow('✨', 'Показать золотую', null, cookie(true)),
      aboutRow('🎄', 'Показать новогоднюю', 'Та, что выпадет 1 января', cookie('ny')),
      aboutRow('📜', 'Все предсказания', null, sub(openFortunes))),
    aboutGroup('Новый год',
      aboutRow('✍️', 'Моё пожелание ей', 'Откроется в её новогодней печеньке 1 января в 00:00', sub(openWish)),
      aboutRow('🎆', 'Показать у меня', 'Отсчёт 10 секунд, печенька, салют — пробно', ny(null)),
      aboutRow('🎄', 'Показать у неё — светлая', 'Как увидит она: ёлка, гирлянда, твоё пожелание', ny('light')),
      aboutRow('🌙', 'Показать у неё — ночная', null, ny('dark'))),
    aboutGroup('Первый день', aboutRow('🎬', 'Репетиция первого дня у неё', 'Открытка, тур с разрешениями, весна днём — как в первый раз. Письма и ключи остаются', () => { close(); rehearse(); })),
    aboutGroup('Хэллоуин', aboutRow('🎃', 'Показать Хэллоуин у неё', '31 октября тыква в листьях становится Джеком-фонарём — 20 секунд', () => { close(); setTimeout(previewHalloween, 300); })),
    aboutGroup('Планы', aboutRow('💡', 'Все идеи', 'Запас для «Подкинуть идеи»', sub(openPool))),
    aboutGroup('Игры', aboutRow('💞', 'Вопросы «Совпадёт?»', `${count} штук по темам`, sub(openSameQs)), bothRow()),
    aboutGroup('Звуки', aboutRow('🎻', 'Все звуки', 'Любой инструмент, любое событие', sub(openSounds))));
}
