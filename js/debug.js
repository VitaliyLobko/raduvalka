// «🛠 Отладка» — лише на його половині: печеньки, запас ідей, питання «Совпадёт?». Нічого звідси не йде до неї
import { DATA } from './data.js';
import { get } from './api.js';
import { h, toast, aboutGroup, aboutRow } from './ui.js';
import { previewCookie, allFortunes } from './cookie.js';
import { CATS } from './plans.js';
import { SAME_TOPICS } from './same.js';
import { INSTRUMENTS, SOUND_NAMES, myInstrument, playAs, soundOn } from './sound.js';

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
  const { regular, golden } = allFortunes();
  sheet('Все предсказания', 'debug-sub', openDebug,
    h('h2', { class: 'title' }, 'Предсказания'),
    ...section(`✨ Золотые · ${golden.length}`, golden.map((t) => h('li', {}, t))),
    ...section(`🥠 Обычные · ${regular.length}`, regular.map((t) => h('li', {}, t))));
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
  ['🔇 Без инструмента, у всех одинаково', [['react', 'Реакция'], ['love', 'Сердечки'], ['shot', 'Выстрел'], ['hit', 'Попал'],
    ['sunk', 'Потопил'], ['note', 'Записка в кораблике'], ['bell', 'Звоночек: зовут'], ['ring', 'Звоночек: зовёшь']]],
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
    h('p', { class: 'hint' }, soundOn() ? 'Тап по инструменту — послушать его. Твой выбор в «Звуках» не меняется'
      : 'Звуки выключены — включи в «О Радовалке» → «Звуки»'),
    chips,
    ...groups.flatMap(([title, list]) => [h('h3', { class: 'about-group-title' }, title),
      h('div', { class: 'instr-row sfx-row' }, ...list.map(([k, label]) => h('button', {
        type: 'button', class: 'instr-chip', onclick: () => playAs(k, inst),
      }, label)))]));
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

export function openDebug() {
  if (DATA.side !== 'vin') return;
  const cookie = (gold) => () => { close(); setTimeout(() => previewCookie(gold), 300); };
  const sub = (open) => () => { close(); open(); };
  const count = SAME_TOPICS.reduce((n, [, , qs]) => n + Object.keys(qs).length, 0);
  const close = sheet('Отладка', 'debug-sheet', null,
    h('h2', { class: 'title' }, 'Отладка'),
    h('p', { class: 'hint' }, 'Видно только тебе. Отсюда ничего не уходит'),
    aboutGroup('Печеньки',
      aboutRow('🥠', 'Показать печеньку', 'Пробная: настоящую не тратит, отправить нельзя', cookie(false)),
      aboutRow('✨', 'Показать золотую', null, cookie(true)),
      aboutRow('📜', 'Все предсказания', null, sub(openFortunes))),
    aboutGroup('Планы', aboutRow('💡', 'Все идеи', 'Запас для «Подкинуть идеи»', sub(openPool))),
    aboutGroup('Игры', aboutRow('💞', 'Вопросы «Совпадёт?»', `${count} штук по темам`, sub(openSameQs)), bothRow()),
    aboutGroup('Звуки', aboutRow('🎻', 'Все звуки', 'Любой инструмент, любое событие', sub(openSounds))));
}
