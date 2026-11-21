// «💞 Совпадёт?»: 5 питань із двома варіантами. Хто кинув виклик — відповідає одразу, другий — коли зручно;
// відповіді другого не видно, поки не відповіли обидва. Питання — ключі з набору нижче; своє — { q, a, b } (шифрується)
import { DATA, who } from './data.js';
import { get, send } from './api.js';
import { h, toast, cap, reduceMotion } from './ui.js';
import { burst } from './fx.js';
import { gameSheet } from './games.js';

// Ключ не міняти: за ним сервер і другий телефон знаходять питання. Нові — дописувати в кінець своєї теми
export const SAME_TOPICS = [
  ['🍕', 'Еда', {
    tea: ['С утра: чай или кофе?', 'Чай', 'Кофе'],
    pizza: ['Пицца или суши?', 'Пицца', 'Суши'],
    sweet: ['Сладкое или солёное?', 'Сладкое', 'Солёное'],
    cook: ['Ужин: готовим сами или заказываем?', 'Готовим', 'Заказываем'],
    melon: ['Арбуз или дыня?', 'Арбуз', 'Дыня'],
    popcorn: ['В кино: с попкорном или без?', 'С попкорном', 'Без'],
    spicy: ['Еда: поострее или помягче?', 'Поострее', 'Помягче'],
    ice: ['Мороженое: пломбир или шоколадное?', 'Пломбир', 'Шоколадное'],
    breakfast: ['Завтрак: в постель или в кафе?', 'В постель', 'В кафе'],
    choco: ['Шоколад: молочный или горький?', 'Молочный', 'Горький'],
    fries: ['Картошка: фри или пюре?', 'Фри', 'Пюре'],
    cocoa: ['Зимний вечер: какао или глинтвейн?', 'Какао', 'Глинтвейн'],
    dessert: ['В кафе: начать с десерта или по порядку?', 'С десерта', 'По порядку'],
    bbq: ['На природе: шашлык или бутерброды?', 'Шашлык', 'Бутерброды'],
    berry: ['Клубника или черешня?', 'Клубника', 'Черешня'],
    pancake: ['Блины или сырники?', 'Блины', 'Сырники'],
  }],
  ['🏖', 'Отдых', {
    sea: ['Отпуск: море или горы?', 'Море', 'Горы'],
    trip: ['В дорогу: самолёт или поезд?', 'Самолёт', 'Поезд'],
    plan: ['Отпуск: по плану или как пойдёт?', 'По плану', 'Как пойдёт'],
    beach: ['На пляже: загорать или плавать?', 'Загорать', 'Плавать'],
    photo: ['В поездке: фотографировать или просто смотреть?', 'Фото', 'Смотреть'],
    drive: ['В дороге: за рулём или рядом?', 'За рулём', 'Рядом'],
    car: ['В машине: музыка или разговоры?', 'Музыка', 'Разговоры'],
    tent: ['Ночевать в поездке: палатка или гостиница?', 'Палатка', 'Гостиница'],
    abroad: ['Отпуск мечты: далеко-далеко или поближе к дому?', 'Далеко', 'Поближе'],
    museum: ['В новом городе: музеи или кафешки?', 'Музеи', 'Кафешки'],
    pack: ['Чемодан: собрать заранее или в последний вечер?', 'Заранее', 'В последний вечер'],
    window: ['Место в поезде: у окна или у прохода?', 'У окна', 'У прохода'],
    lake: ['Летом купаться: в речке или в бассейне?', 'В речке', 'В бассейне'],
  }],
  ['🏠', 'Дом и быт', {
    city: ['Жить: в городе или за городом?', 'В городе', 'За городом'],
    alarm: ['Будильник: встать сразу или ещё пять минут?', 'Сразу', 'Ещё пять'],
    blanket: ['Спать: укутаться или раскрыться?', 'Укутаться', 'Раскрыться'],
    lazy: ['Утро выходного: валяться или гулять?', 'Валяться', 'Гулять'],
    pet: ['Котик или пёсик?', 'Котик', 'Пёсик'],
    clean: ['Уборка: всё за один раз или понемногу каждый день?', 'За раз', 'Понемногу'],
    bedside: ['Сторона кровати: у стенки или с краю?', 'У стенки', 'С краю'],
    socks: ['Дома: в носках или босиком?', 'В носках', 'Босиком'],
    shower: ['Душ: утром или вечером?', 'Утром', 'Вечером'],
    duvet: ['Одеяло: одно на двоих или каждому своё?', 'Одно на двоих', 'Каждому своё'],
    dishes: ['Посуда после ужина: помыть сразу или утром?', 'Сразу', 'Утром'],
    plants: ['Цветы дома: целые джунгли или пара горшков?', 'Джунгли', 'Пара горшков'],
    sleep: ['Спать: с ночником или в полной темноте?', 'С ночником', 'В темноте'],
  }],
  ['💞', 'Мы двое', {
    call: ['Позвонить или написать?', 'Позвонить', 'Написать'],
    voice: ['Сообщение: голосовое или текстом?', 'Голосовое', 'Текстом'],
    meet: ['При встрече: сначала обнять или поцеловать?', 'Обнять', 'Поцеловать'],
    hug: ['Обнимашки или щекотка?', 'Обнимашки', 'Щекотка'],
    gift: ['Подарок: сюрприз или по списку?', 'Сюрприз', 'По списку'],
    ny: ['Новый год: вдвоём или с друзьями?', 'Вдвоём', 'С друзьями'],
    date: ['Свидание: ресторан или прогулка?', 'Ресторан', 'Прогулка'],
    flowers: ['Цветы в подарок: розы или полевые?', 'Розы', 'Полевые'],
    letters: ['Письмо: длинное раз в неделю или короткое каждый день?', 'Длинное', 'Короткое'],
    station: ['После долгой разлуки встречать: на вокзале или дома?', 'На вокзале', 'Дома'],
    selfie: ['Общее фото: селфи или попросить прохожих?', 'Селфи', 'Прохожих'],
    dance: ['Медленный танец на кухне: обязательно или ни за что?', 'Обязательно', 'Ни за что'],
    sorry: ['После ссоры: мириться сразу или сначала остыть?', 'Сразу', 'Остыть'],
    hands: ['На прогулке: за руку или под руку?', 'За руку', 'Под руку'],
  }],
  ['🌙', 'Вечер и характер', {
    film: ['Вечер вдвоём: кино или сериал?', 'Кино', 'Сериал'],
    winter: ['Зима или лето?', 'Зима', 'Лето'],
    out: ['Выходной: дома или куда-нибудь?', 'Дома', 'Куда-нибудь'],
    book: ['Книга или фильм по ней?', 'Книга', 'Фильм'],
    rain: ['Дождь за окном: плед или прогулка?', 'Плед', 'Прогулка'],
    night: ['Поздний вечер: болтать до ночи или выспаться?', 'Болтать', 'Выспаться'],
    sun: ['Рассвет или закат?', 'Рассвет', 'Закат'],
    music: ['Концерт или тихий вечер?', 'Концерт', 'Тихий вечер'],
    owl: ['Сова или жаворонок?', 'Сова', 'Жаворонок'],
    horror: ['Фильм на вечер: ужастик или комедия?', 'Ужастик', 'Комедия'],
    party: ['На празднике: танцевать или болтать в уголке?', 'Танцевать', 'Болтать'],
    spont: ['Важное решение: сразу или подумать денёк?', 'Сразу', 'Подумать'],
    sing: ['Петь: в караоке или только в душе?', 'В караоке', 'В душе'],
    games: ['Настолки: играть на победу или просто посмеяться?', 'На победу', 'Посмеяться'],
    late: ['На встречу: приходить заранее или впритык?', 'Заранее', 'Впритык'],
  }],
];
export const SAME_QS = Object.assign({}, ...SAME_TOPICS.map(([, , qs]) => qs));
const N = 5;
const POLL = 3000;
const qOf = (q) => (typeof q === 'string' ? SAME_QS[q] || ['Вопрос из новой версии — обнови Радовалку', 'Первое', 'Второе'] : [q.q, q.a, q.b]);
const gen = () => (who().partner === 'она' ? 'её' : 'его');

// Дограні ігри, підсумок яких я вже бачив (останні 30)
const seenKey = () => `radovalka:same-seen:${DATA.side}`;
function seenList() {
  try { return JSON.parse(localStorage.getItem(seenKey()) || '[]'); } catch { return []; }
}
const sawEnd = (g) => !g.done || seenList().includes(g.id);
function markSeen(g) {
  try { if (!seenList().includes(g.id)) localStorage.setItem(seenKey(), JSON.stringify([g.id, ...seenList()].slice(0, 30))); } catch { /* приватне вікно */ }
  document.dispatchEvent(new CustomEvent('radovalka:duel-seen'));
}

const VERDICT = ['Противоположности притягиваются', 'Совпало одно — зато какое', 'Есть о чём поговорить', 'Больше половины — хорошо', 'Почти одно целое', 'Полное совпадение! 💞'];

// Картка в стрічці: поки йде — хто ще відповідає; догране й не бачене — «Посмотреть» без рахунку
export function sameCard(g, onOpen) {
  const hidden = g.done && !sawEnd(g);
  const turn = !g.done && !g.me;
  const state = g.done ? (hidden ? 'Ответы открылись' : `Совпало ${g.hits} из ${N}`) : turn ? 'Твоя очередь отвечать' : `Ждём ${gen()} ответы`;
  const go = hidden ? 'Посмотреть' : turn ? 'Ответить' : null;
  const dots = h('span', { class: 'same-dots', 'aria-hidden': 'true' }, ...g.qs.map((_, i) => h('i', {
    class: g.done && !hidden ? (g.me[i] === g.them[i] ? 'is-hit' : 'is-miss') : '',
  }, g.done && !hidden ? (g.me[i] === g.them[i] ? '💞' : '·') : '?')));
  return h('button', {
    type: 'button', class: `duel-card same-card${turn ? ' is-turn' : ''}${g.done ? ' is-done' : ''}`, onclick: onOpen,
    'aria-label': `Совпадёт? ${state}`,
  },
  h('span', { class: 'duel-card-head' }, `💞 Совпадёт? · ${N} вопросов`),
  dots,
  h('span', { class: 'duel-card-foot' }, h('span', { class: 'duel-card-state' }, state), go ? h('span', { class: 'duel-card-go' }, go) : null));
}
export const sameSig = (g) => JSON.stringify([g.me, g.theirDone, g.done, g.hits, sawEnd(g)]);

let open = null;

// past — дограна гра з чату: показуємо саме її (відповіді можна передивитися), поки не натиснуть «Сыграть ещё»
export async function openSame(past = null) {
  if (open) return;
  const sh = gameSheet({ icon: '💞', title: 'Совпадёт?', cls: 'same-sheet', onClose: () => { clearInterval(open?.timer); open = null; } });
  open = { body: sh.body, state: '', busy: false, timer: 0, gameId: null, past: past?.done ? past : null };
  if (open.past) result(open.past);
  else {
    sh.body.append(h('p', { class: 'hint duel-hint' }, 'Загружаю…'));
    await refresh(true);
  }
  // Поки відкрито — питаємо сервер: відповіді другого відкриваються самі
  if (open) open.timer = setInterval(() => { if (open && !open.busy && document.visibilityState === 'visible') refresh(); }, POLL);
}

async function refresh(first = false) {
  let r;
  try { r = await get('same'); } catch {
    if (first && open) open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, 'Нет связи — игра откроется, когда появится интернет'));
    return;
  }
  if (!open || open.busy || open.past) return;
  const state = JSON.stringify(r);
  if (state === open.state) return;
  open.state = state;
  // Догране, чого ще не бачив, — спершу підсумок; щойно дограну на екрані лишаємо
  const last = r.last && (!sawEnd(r.last) || r.last.id === open.gameId) ? r.last : null;
  show(r.same || last);
}

function show(g) {
  open.gameId = g ? g.id : null;
  if (!g) { open.body.replaceChildren(...setup()); return; }
  if (g.done) { result(g); return; }
  if (!g.me) { answer(g.qs, (ans) => reply(g, ans)); return; }
  waiting(g);
}

// Відповіді по одному питанню: велике питання, дві великі кнопки, «Назад»
function answer(qs, onDone, back = null) {
  const ans = [];
  const body = open.body;
  const step = () => {
    const i = ans.length;
    if (i === qs.length) { onDone(ans); return; }
    const [q, a, b] = qOf(qs[i]);
    const pick = (v) => { ans.push(v); step(); };
    const card = h('div', { class: 'same-q' },
      h('p', { class: 'same-progress' }, ...qs.map((_, k) => h('i', { class: k < i ? 'is-done' : k === i ? 'is-now' : '' })), h('span', {}, `${i + 1} из ${qs.length}`)),
      h('p', { class: 'same-q-text' }, q),
      h('div', { class: 'same-opts' },
        h('button', { type: 'button', class: 'same-opt', 'data-v': '0', onclick: () => pick(0) }, a),
        h('button', { type: 'button', class: 'same-opt', 'data-v': '1', onclick: () => pick(1) }, b)));
    const prev = i > 0 ? () => { ans.pop(); step(); } : back;
    body.replaceChildren(card, prev ? h('button', { type: 'button', class: 'duel-cancel', onclick: prev }, '← Назад') : null);
    if (!reduceMotion) card.animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  };
  step();
}

const sending = () => open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, 'Отправляю…'));

async function reply(g, ans) {
  if (!open) return;
  open.busy = true;
  sending();
  let r;
  try { r = await send('same/answer', 'POST', { id: g.id, ans }); } catch (e) {
    if (!open) return;
    open.busy = false;
    if (e.status === 409) { toast('Эта игра уже закончилась или отменена'); open.state = ''; refresh(); return; }
    toast('Ответы не ушли — нет связи');
    open.body.replaceChildren(h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: () => reply(g, ans) }, 'Отправить ещё раз'));
    return;
  }
  if (!open) return;
  open.busy = false;
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
  open.state = '';
  show(r.same);
}

// Свої відповіді пішли, чекаємо другого; скасувати може будь-хто
function waiting(g) {
  open.body.replaceChildren(
    h('div', { class: 'duel-arena same-wait' },
      h('p', { class: 'same-big' }, '🤫'),
      h('p', { class: 'duel-status' }, `Твои ответы ушли. Ждём ${gen()} — откроются, когда ответите оба`)),
    rows(g),
    h('div', { class: 'duel-act' }, h('button', { type: 'button', class: 'duel-cancel', onclick: () => cancel(g) }, 'Отменить игру')));
}

// Рядки питань: моя відповідь і (коли відкрито) — другого; збіг — золотим
function rows(g) {
  return h('ol', { class: 'same-rows' }, ...g.qs.map((q, i) => {
    const [text, a, b] = qOf(q);
    const opt = (v) => (v === 0 ? a : b);
    const hit = g.done && g.me[i] === g.them[i];
    return h('li', { class: `same-row${g.done ? (hit ? ' is-hit' : ' is-miss') : ''}` },
      h('span', { class: 'same-row-q' }, text),
      h('span', { class: 'same-row-a' },
        h('span', { class: 'same-chip' }, h('small', {}, 'Ты'), opt(g.me[i])),
        g.done ? h('span', { class: 'same-chip' }, h('small', {}, cap(who().partner)), opt(g.them[i])) : null,
        g.done ? h('span', { class: 'same-mark', 'aria-label': hit ? 'Совпало' : 'Не совпало' }, hit ? '💞' : '≠') : null));
  }));
}

// «Сыграть ещё»: якщо вже йде інша гра — вона, інакше вибір питань
function again() {
  open.past = null;
  open.gameId = null;
  open.state = '';
  open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, 'Загружаю…'));
  refresh(true);
}

function result(g) {
  const fresh = !sawEnd(g);
  const big = h('p', { class: 'same-score' }, h('b', {}, String(g.hits)), ` из ${N}`);
  const list = rows(g);
  open.body.replaceChildren(
    h('div', { class: 'duel-arena same-result' }, h('p', { class: 'same-score-label' }, 'Совпало'), big, h('p', { class: 'duel-status is-final' }, VERDICT[g.hits])),
    list,
    h('div', { class: 'duel-act' }, h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: again }, 'Сыграть ещё')));
  if (fresh) {
    if (!reduceMotion) {
      big.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
      [...list.children].forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 300 + i * 120, easing: 'ease-out', fill: 'backwards' }));
    }
    if (g.hits >= 3) burst(big, '💞', g.hits * 3);
    markSeen(g);
  }
}

// Новий виклик: по питанню з кожної теми, «Другие вопросы», своє питання замість останнього, потім — свої відповіді
const pick = (list) => list[Math.floor(Math.random() * list.length)];
function setup() {
  const shuffle = () => SAME_TOPICS.map(([, , qs]) => pick(Object.keys(qs))).sort(() => Math.random() - 0.5).slice(0, N);
  let picked = shuffle();
  const list = h('ol', { class: 'same-list' });
  const q = h('input', { type: 'text', class: 'duel-own', maxlength: '80', placeholder: 'Свой вопрос (можно пропустить)', 'aria-label': 'Свой вопрос' });
  const a = h('input', { type: 'text', class: 'duel-own', maxlength: '24', placeholder: 'Вариант 1', 'aria-label': 'Первый вариант' });
  const b = h('input', { type: 'text', class: 'duel-own', maxlength: '24', placeholder: 'Вариант 2', 'aria-label': 'Второй вариант' });
  const clean = (x) => x.value.replace(/\s+/g, ' ').trim();
  const own = () => (clean(q) && clean(a) && clean(b) ? { q: clean(q), a: clean(a), b: clean(b) } : null);
  const qs = () => (own() ? [...picked.slice(0, N - 1), own()] : picked);
  const go = h('button', { type: 'button', class: 'btn btn-primary duel-go' }, 'Ответить на вопросы');
  const paint = () => {
    list.replaceChildren(...qs().map((x) => h('li', {}, qOf(x)[0])));
    // Почали своє питання — кнопка чекає, поки є обидва варіанти
    go.disabled = !!(clean(q) || clean(a) || clean(b)) && !own();
  };
  for (const x of [q, a, b]) x.addEventListener('input', paint);
  const reroll = h('button', { type: 'button', class: 'mk-chip same-reroll', onclick: () => { picked = shuffle(); paint(); } }, '🔄 Другие вопросы');
  go.addEventListener('click', () => {
    if (go.disabled) return;
    const list5 = qs();
    answer(list5, (ans) => start(list5, ans), () => { open.body.replaceChildren(...view); });
  });
  paint();
  const block = (title, ...kids) => h('section', { class: 'duel-block' }, h('h3', { class: 'duel-block-title' }, title), ...kids);
  const view = [
    block('Вопросы', list, reroll),
    block('Свой вопрос вместо пятого', q, h('div', { class: 'same-own-opts' }, a, b)),
    h('p', { class: 'hint duel-hint' }, `Сначала твои ответы, потом — ${gen()}. Откроются, когда ответите оба.`),
    go,
  ];
  return view;
}

async function start(qs, ans) {
  if (!open) return;
  open.busy = true;
  sending();
  try {
    const r = await send('same', 'POST', { qs, ans });
    open.busy = false;
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
    toast(r.reaches ? `💞 Вопросы улетели — ${who().partner} получит уведомление` : `💞 Вопросы улетели — ${who().partner} увидит в чате`);
    if (open) { open.state = ''; await refresh(); }
  } catch (e) {
    if (!open) return;
    open.busy = false;
    if (e.status === 409) { toast('Игра уже идёт — сначала доиграйте'); open.state = ''; refresh(); return; }
    toast('Вопросы не ушли — нет связи');
    open.body.replaceChildren(h('button', { type: 'button', class: 'btn btn-primary duel-go', onclick: () => start(qs, ans) }, 'Отправить ещё раз'));
  }
}

async function cancel(g) {
  try { await send('same/cancel', 'POST', { id: g.id }); } catch { toast('Не отменилось — нет связи'); return; }
  document.dispatchEvent(new CustomEvent('radovalka:marked'));
  toast('Игра отменена');
  if (open) { open.state = ''; open.gameId = null; open.body.replaceChildren(...setup()); }
}
