// Чат «Письма»: листи (отримані й надіслані) і мемчики разом, по днях — старе вгорі, нове внизу, як у месенджері.
// Непрочитаний лист — запечатаний конверт, тап відкриває його на весь екран (шторка — в app.js).
// Свайп вліво — сховати в себе, вправо — відповісти; те саме кнопками
import { DATA, who } from './data.js';
import { get, send, save } from './api.js';
import { h, toast, cap, reduceMotion, hhmm, dayMonth, dayMonthYear, dayWord } from './ui.js';
import { media, memeUrl, REACTIONS } from './memes.js';
import { learned, learn, nudge, hintBar } from './swipehint.js';
import { mascotImg, petFor, petName, firstPose, letterPose } from './icons.js';
import { flyOut, collapse, burst, petRun, loveRain, captainSalute, reactFx, reactFxQueued, openFx } from './fx.js';
import { saveMeme } from './memesave.js';
import { moodWord } from './checkin.js';
import { ask } from './ask.js';
import { duelCard, duelSig, openDuel, gwishCard, duelKind } from './duel.js';
import { sameCard, sameSig, openSame } from './same.js';
import { loveConstellation } from './depth.js';

const SWIPE = 70;
// Від краю екрана Android гортає «Назад» — там свайп не починаємо
const EDGE = 24;

// Скільки рядків на екрані: стрічку перемальовує кожна дія, сотні мемчиків гальмували б телефон
const PAGE = 30;
let limit = PAGE;
// Листи з сервера; мемчики — у DATA.memes. stale — перечитати при наступному показі.
// page — найстаріша підвантажена сторінка feed: more — на сервері є старіше за horizon
let cache = null;
let page = { more: false, horizon: 0 };
let stale = true;
let loading = null;
// Позначки «бачив» на момент завантаження: «новое» на пузирях не гасне, поки стрічка на екрані
let seenAt = { memes: 0, replies: 0 };
let box = null;
// Стрічка всередині box: зверху «Показать раньше» і сховані, рядки, знизу порожньо/підказка свайпу
let head = null;
let list = null;
let foot = null;
// Скільки до низу чату було перед перемальовуванням: щоб живе оновлення не зсувало те, що зараз читають
let fromBottom = 0;
// Скільки було прогорнуто згори — новий box (перемальовка вкладки) стає на те саме місце, а не на початок
let fromTop = 0;
// Унизу чату — «прилипли»: те, що домальовується (фото, шрифт, новий лист), не відсуває низ.
// newest — ключ найновішого рядка: змінився, поки гортали вище, — кнопка «↓ Новое»
let stuck = true;
let newest = null;
let jump = null;
let reactJump = null;
const sizes = new ResizeObserver(() => { if (stuck && box?.isConnected) box.scrollTop = box.scrollHeight; });
// З app.js: open(l) — шторка листа; welcome() — привітальний лист-заготовка (або null); like/reply — для нього
let ops = {};
// Листи, розкриті з конверта, — цілим і після перемальовки; живе оновлення через них не стає (is-open — лише ручне розгортання)
const unfolded = new Set();

// Перечитати листи при наступному показі (вхід на вкладку, повернення в застосунок, щойно надіслане)
export function invalidateFeed() { stale = true; }

// Тихо дотягнути свіже: перемальовується лише стрічка (якщо на екрані) і крапка на марці
export function refreshFeed() {
  stale = true;
  return load().then(settle).catch(() => {});
}

const repliesSeen = () => DATA.mine.repliesSeen || 0;
const memesSeen = () => DATA.mine.memesSeen || 0;

// Скільки нового для крапки на марці «Письма»: мемчики, непрочитані листи, відповіді на моє
export function feedFresh() {
  const memes = DATA.memes || [];
  let n = memes.filter((m) => (m.mine ? (m.replied || 0) > repliesSeen() : m.created > memesSeen())).length;
  if (cache) {
    n += cache.inbox.filter((l) => !l.opened).length;
    n += cache.sent.filter((l) => (l.replied || 0) > repliesSeen()).length;
  }
  return n;
}

// Ключ привітального листа: у нього нема id, лише дата заготовки
export const welcomeKey = (w) => `day:${w.date}`;

// Лист з отриманих за id — після фонового оновлення об'єкт у кеші новий, старий тримати не можна
export const findLetter = (id) => cache?.inbox.find((x) => x.id === id) || null;
export const feedLoaded = () => !!cache;

// Останні повідомлення переписки — для «Написать…», щоб бачити, на що відповідаєш.
// Лише те, що вже видно в чаті: запечатане й заплановане на потім не показуємо
export function recentThread(n = 6) {
  const c = [];
  const now = Date.now();
  const w = ops.welcome?.();
  if (w?.opened) c.push({ at: w.at, text: w.text, mine: false });
  for (const l of cache?.inbox || []) {
    if (l.opened && l.text) c.push({ at: l.at, text: l.text, mine: false });
    if (l.reply) c.push({ at: l.replied || l.at, text: l.reply, mine: true });
  }
  for (const l of cache?.sent || []) {
    if (l.text && ['now', 'morning', 'date'].includes(l.kind) && l.at <= now) c.push({ at: l.at, text: l.text, mine: true });
    if (l.reply) c.push({ at: l.replied || l.at, text: l.reply, mine: false });
  }
  for (const m of DATA.memes || []) {
    c.push({ at: m.created, text: m.caption ? `🖼 ${m.caption}` : memeWord(m, true), mine: !!m.mine });
    if (m.reply) c.push({ at: m.replied || m.created, text: m.reply, mine: !m.mine });
  }
  return c.sort((x, y) => x.at - y.at).slice(-n);
}

// Перемалювати лише стрічку (після шторки листа)
export function redrawFeed() { draw(); }
// Побачив розкриття спору — рядок у чаті показує підсумок
document.addEventListener('radovalka:duel-seen', () => draw());

// Запечатаний: справжній лист чи привітальний, ще не відкритий
const sealed = (l) => !l.opened && (l.tpl || ['now', 'morning', 'date'].includes(l.kind));

// Час, за яким рядок стоїть у чаті, — так само рахує сервер для меж сторінок
const tIn = (l) => l.at;
const tOut = (l) => (l.kind === 'env' ? l.created : (l.at || l.created));
const tMeme = (m) => m.created;
const tNews = (n) => n.at;
const ids = (list) => new Set(list.map((x) => x.id));
// Свіжа перша сторінка + те, що підвантажили раніше й старіше за її межу
const joinNew = (fresh, old, t, horizon) => { const s = ids(fresh); return [...fresh, ...old.filter((x) => !s.has(x.id) && t(x) < horizon)]; };
const joinOld = (cur, older) => { const s = ids(cur); return [...cur, ...older.filter((x) => !s.has(x.id))]; };

// p — сторінка feed. older — дописати старіше знизу; інакше це свіже: замінює верх, підвантажене глибше лишається
function merge(p, older = false) {
  const memes = DATA.memes || [];
  if (older) {
    cache = { inbox: joinOld(cache.inbox, p.inbox), sent: joinOld(cache.sent, p.sent), news: joinOld(cache.news || [], p.news || []) };
    DATA.memes = joinOld(memes, p.memes);
    page = { more: p.more, horizon: p.horizon };
  } else if (cache && p.more && page.horizon < p.horizon) {
    cache = { inbox: joinNew(p.inbox, cache.inbox, tIn, p.horizon), sent: joinNew(p.sent, cache.sent, tOut, p.horizon), news: joinNew(p.news || [], cache.news || [], tNews, p.horizon) };
    DATA.memes = joinNew(p.memes, memes, tMeme, p.horizon);
  } else {
    cache = { inbox: p.inbox, sent: p.sent, news: p.news || [] };
    DATA.memes = p.memes;
    page = { more: p.more, horizon: p.horizon };
  }
}

function load() {
  if (!loading) {
    loading = get('feed')
      .then((p) => {
        merge(p);
        stale = false;
        seenAt = { memes: memesSeen(), replies: repliesSeen() };
      })
      .finally(() => { loading = null; });
  }
  return loading;
}

// «Показать раньше»: на екрані закінчилось підвантажене — тягнемо з сервера наступну сторінку
async function showMore(btn, have) {
  if (limit + PAGE > have && page.more) {
    btn.disabled = true;
    btn.textContent = 'Загружаю…';
    try {
      merge(await get(`feed?before=${page.horizon}`), true);
    } catch {
      btn.disabled = false;
      btn.textContent = 'Показать раньше';
      toast('Не загрузилось — нет связи');
      return;
    }
  }
  limit += PAGE;
  draw(false, true);
}

// Тап по вкладці «Письма» — наступна стрічка стає на найновіше, навіть якщо гортали вище
let toLatest = false;
export function feedToLatest() { toLatest = true; }

// Стрічка «Писем». o — зв'язок з app.js (див. ops)
export function letterFeed(o) {
  ops = o || {};
  fromBottom = box?.isConnected && !toLatest ? gap(box) : 0;
  fromTop = box?.isConnected && !toLatest ? box.scrollTop : 0;
  toLatest = false;
  stuck = fromBottom < 40;
  head = h('div', { class: 'feed-head' });
  list = h('ol', { class: 'feed-list' });
  foot = h('div', { class: 'feed-foot' });
  box = h('div', { class: 'feed-box' }, head, list, foot);
  jump = h('button', { type: 'button', class: 'feed-jump', hidden: true, onclick: toEnd }, '↓ Новое');
  reactJump = h('button', { type: 'button', class: 'feed-jump feed-react-jump', hidden: true, onclick: toReaction });
  // Гортання рукою: дійшла донизу — знову прилипли і «Новое» вже не треба
  box.addEventListener('scroll', () => {
    stuck = gap(box) < 40;
    if (stuck) jump.hidden = true;
    if (reactWait.size) paintReactJump();
  }, { passive: true });
  const section = h('section', { class: 'feed', 'aria-label': 'Переписка' }, box, jump, reactJump);
  // Секцію ще не вставлено в сторінку — малюємо в неї примусово
  if (cache) draw(true);
  else foot.append(h('p', { class: 'mk-wait' }, 'Загружаю…'));
  if (stale || !cache) {
    load().then(settle).catch(() => {
      if (!cache && box.isConnected) foot.replaceChildren(h('p', { class: 'mk-wait' }, 'Не загрузилось — нет связи'));
    });
  }
  return section;
}

const fresh = () => document.dispatchEvent(new CustomEvent('radovalka:fresh'));

// Гифка з пошуку — за посиланням, решта — фото з галереї; icon — з значком, для рядка переписки
const memeWord = (m, icon = false) => (m.url ? `${icon ? '🎞 ' : ''}Гифка`
  : m.file ? `${icon ? '📎 ' : ''}${m.file.n || 'Файл'}` : `${icon ? '🖼 ' : ''}Фото`);
// Що цитувати у відповіді на мемчик/файл і на що відповідають (для push)
const memeSaid = (m) => m.caption || (m.url ? 'гифка' : m.file ? `📎 ${m.file.n || 'файл'}` : 'фото');
const memeOn = (m) => (m.url ? 'gif' : m.file ? 'file' : 'photo');
// Іконка файлу за типом
const fileIcon = (t = '') => (/^image\//.test(t) ? '🖼' : /^video\//.test(t) ? '🎬' : /^audio\//.test(t) ? '🎵'
  : /pdf$/.test(t) ? '📕' : /zip|rar|7z|tar|gzip/.test(t) ? '🗜' : /sheet|excel|csv/.test(t) ? '📊' : /word|document|text/.test(t) ? '📄' : '📎');

// До найновішого — плавно (без анімацій — одразу)
function toEnd() {
  stuck = true;
  jump.hidden = true;
  box.scrollTo({ top: box.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
}

// Реакція другого на моє повідомлення за краєм екрана: плашка вгорі «😍 на твоё сообщение ↑», тап — туди,
// анімація грає, коли рядок з'явиться (reactIo). Сама стрічка не їде — не тягнемо з місця, де читають
const reactWait = new Set();
function waitingReact() {
  for (const el of reactWait) if (!el.isConnected) reactWait.delete(el);
  return [...reactWait].sort((a, b) => Number(b.dataset.reactAt) - Number(a.dataset.reactAt))[0] || null;
}
function paintReactJump() {
  if (!reactJump) return;
  const el = waitingReact();
  reactJump.hidden = !el;
  if (!el) return;
  const up = el.getBoundingClientRect().top < box.getBoundingClientRect().top;
  reactJump.textContent = `${el.dataset.reactGlyph} на твоё сообщение ${up ? '↑' : '↓'}`;
}
function toReaction() {
  const el = waitingReact();
  reactJump.hidden = true;
  el?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
}

function settle() {
  draw();
  fresh();
}

// Фонове оновлення підміняє кеш — зміну пишемо в актуальний об'єкт за id, а не в той, що був при малюванні
const liveLetter = (l) => cache?.inbox.find((x) => x.id === l.id) || l;
const liveMeme = (m) => (DATA.memes || []).find((x) => x.id === m.id) || m;

function items() {
  const now = Date.now();
  const list = [];
  // Привітальний — найперше повідомлення: час — коли його вперше показали на цьому телефоні.
  // Поки на сервері є старіше, він не перший — покажемо, коли догорнуть до початку
  const w = page.more ? null : ops.welcome?.();
  if (w) list.push({ type: 'in', key: welcomeKey(w), at: w.at, l: w });
  for (const l of cache?.inbox || []) list.push({ type: 'in', key: `l:${l.id}`, at: l.at, l });
  for (const l of cache?.sent || []) {
    list.push({ type: 'out', key: `l:${l.id}`, at: l.kind === 'env' ? l.created : (l.at || l.created), l, later: l.at > now });
  }
  for (const m of DATA.memes || []) list.push({ type: 'meme', key: `m:${m.id}`, at: m.created, m });
  for (const n of cache?.news || []) list.push({ type: 'news', key: `n:${n.kind}:${n.id}`, at: n.at, n });
  // Привітальний завжди перший, навіть якщо другий написав раніше, ніж її вперше відкрили
  if (w) list[0].at = Math.min(w.at, ...list.slice(1).map((it) => it.at - 1));
  return list.sort((a, b) => b.at - a.at);
}

const gap = (el) => el.scrollHeight - el.scrollTop - el.clientHeight;

// Після перемальовування: був унизу — лишається внизу (нове видно одразу); гортав вище — те саме місце.
// more — дописали старіше згори: тримаємо відстань до низу, щоб прочитане не втекло
function keepPlace(more) {
  const was = box.isConnected ? gap(box) : fromBottom;
  const top = box.isConnected ? box.scrollTop : fromTop;
  return () => requestAnimationFrame(() => {
    if (!box.isConnected) return;
    if (more || was < 40) box.scrollTop = box.scrollHeight - box.clientHeight - (more ? was : 0);
    else box.scrollTop = top;
  });
}

// force — box ще не в документі (щойно створений letterFeed); інакше старий box, що зник з екрана, не чіпаємо
function draw(force = false, older = false) {
  if (!box || (!force && !box.isConnected)) return;
  const wasStuck = box.isConnected ? gap(box) < 40 : stuck;
  const restore = keepPlace(older);
  // «Спрятать у себя» прибрано: у переписці на двох видно все
  const shown = items();
  // Найновіше змінилось: своє — донизу, щоб видно, що пішло; чуже, поки гортали вище, — «↓ Новое»
  const top = shown[0];
  const arrived = !older && newest && top && top.key !== newest ? top : null;
  if (top) newest = top.key;
  const mineNew = arrived && (arrived.type === 'out' || (arrived.type === 'meme' && arrived.m.mine));

  // Останні limit рядків у хронологічному порядку; старіше — кнопкою «Показать раньше» згори.
  // Незмінні рядки — ті самі вузли: нове лише вставляється, решта не рухається
  around = JSON.stringify([Object.entries(DATA.mascots || {}).map(([k, v]) => [k, v.name, v.g, v.roles]),
    (DATA.partnerEnvelopes || []).map((e) => [e.id, e.emoji, e.label])]);
  const nodes = [];
  let lastDay = '';
  const hiddenIn = new Map();
  for (const it of shown.slice(0, limit).reverse()) {
    const d = dayTitle(it.at);
    if (d !== lastDay) {
      nodes.push(dayFor(d));
      lastDay = d;
    }
    if (foldedDays.has(d)) { hiddenIn.set(d, (hiddenIn.get(d) || 0) + 1); continue; }
    nodes.push(rowFor(it));
  }
  // Підпис дати: згорнутий день — зі скількома повідомленнями всередині
  for (const [d, li] of days) {
    const n = hiddenIn.get(d);
    li.classList.toggle('is-folded', !!n);
    li.firstChild.textContent = n ? `${d} · ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'сообщение' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'сообщения' : 'сообщений'} ▸` : d;
    li.firstChild.setAttribute('aria-expanded', String(!n));
  }
  const want = new Set(nodes);
  [...list.children].forEach((c) => { if (!want.has(c)) c.remove(); });
  nodes.forEach((n, i) => { if (list.children[i] !== n) list.insertBefore(n, list.children[i] || null); });
  const keep = new Set(shown.slice(0, limit).map((it) => it.key));
  for (const k of rows.keys()) if (!keep.has(k)) rows.delete(k);

  const canMore = shown.length > limit || page.more;
  const more = canMore ? h('button', {
    type: 'button', class: 'feed-hidden-toggle feed-more',
    onclick: (e) => showMore(e.currentTarget, shown.length),
  }, page.more ? 'Показать раньше' : `Показать раньше · ${shown.length - limit}`) : null;

  head.replaceChildren(...[more].filter(Boolean));
  foot.replaceChildren(...[
    shown.length ? null : h('p', { class: 'mk-wait' }, emptyText()),
    // Підказка про свайп — лише коли є що гортати: запечатаний конверт тільки відкривають
    shown.some((it) => !(it.type === 'in' && sealed(it.l))) && !learned('feed') ? hintBar('feed-swipe-hint', null, 'ответить') : null,
  ].filter(Boolean));
  watchFresh(nodes);
  restore();
  stuck = wasStuck || !!mineNew;
  if (mineNew) requestAnimationFrame(toEnd);
  else if (arrived && !wasStuck) jump.hidden = false;
  // Новий лист від другого — курʼєр підбігає до нього
  if (arrived && !mineNew && arrived.type === 'in') {
    const pet = arrived.l.mascot || petFor('push');
    requestAnimationFrame(() => petRun(rows.get(arrived.key)?.el, mascotImg(pet)));
  }
  sizes.disconnect();
  sizes.observe(list);
  // Рядок вводу підріс чи вискочила клавіатура — коробка стиснулась, низ переписки лишається видно
  sizes.observe(box);
  // Остання чужа (найближча до низу, де дивляться) — разок показує, що під нею зліва й справа.
  // Запечатаний конверт не гортається — на ньому не показуємо
  const first = [...list.querySelectorAll('.feed-row.is-theirs')].pop();
  if (!first || first.classList.contains('is-sealed')) return;
  const lean = (x, s) => () => {
    first.querySelector('.feed-bubble').style.transform = x ? `translateX(${x}px)` : '';
    first.dataset.swipe = s;
  };
  nudge('feed', first, [lean(64, 'reply-soon'), lean(0, '')]);
}

function emptyText() {
  const me = who();
  return `Здесь будет ваша переписка: письма, ответы, фото и гифки. ${cap(me.partner)} тоже их тут увидит.`;
}

const sameDay = (a, b) => a.toDateString() === b.toDateString();
function dayTitle(at) {
  const d = new Date(at);
  const now = new Date();
  if (at > Date.now()) return 'Ещё в пути';
  if (sameDay(d, now)) return 'Сегодня';
  if (sameDay(d, new Date(Date.now() - 86400000))) return 'Вчера';
  return d.getFullYear() !== now.getFullYear() ? dayMonthYear(d) : dayMonth(d);
}


// Рядок, що не змінився, — той самий вузол: картинка не вантажиться вдруге, гифка не починається спочатку.
// Заплановані «на потім» міняють підпис із часом — їх щоразу заново
const rows = new Map();
const days = new Map();
// Що, крім самого рядка, видно в пузирі: улюблені-кур'єри й назви її конвертів. «новое» — свій для рядка (fresh)
let around = '';
// Чи позначено рядок «новое» — так само рахують outBubble і memeBubble
function isFresh(it) {
  if (it.type === 'meme') return it.m.mine ? (it.m.replied || 0) > seenAt.replies : it.m.created > seenAt.memes;
  return it.type === 'out' && (it.l.replied || 0) > seenAt.replies;
}
function rowFor(it) {
  // Рядок спору залежить і від того, чи я вже бачив розкриття (localStorage), — текст рядка теж у підписі
  const duel = it.n?.kind === 'duel' ? duelSig(it.n.duel) : it.n?.kind === 'same' ? sameSig(it.n.same) : null;
  const sig = it.later ? null : JSON.stringify([it.type, it.l || it.m || it.n, unfolded.has(it.key), isFresh(it), around, duel]);
  const had = rows.get(it.key);
  if (had && sig && had.sig === sig) return had.el;
  const el = row(it);
  rows.set(it.key, { sig, el });
  return el;
}
// Тап по даті («Вчера», «12 ноября») — увесь цей день згортається в один рядок «Вчера · 5 ▸», ще тап — розгортається
const foldedDays = new Set();
function dayFor(d) {
  if (!days.has(d)) {
    const btn = h('button', { type: 'button', class: 'feed-day-btn', onclick: () => { if (foldedDays.has(d)) foldedDays.delete(d); else foldedDays.add(d); draw(); } }, d);
    days.set(d, h('li', { class: 'feed-day' }, btn));
  }
  return days.get(d);
}

// Обертання, якого я ще не бачив у «Наугад», — назву не видаємо, хай докрутиться в мене (ключ — з plans.js)
const spinSeen = (at) => { try { return localStorage.getItem(`radovalka:wheel-seen:${DATA.side}`) === String(at); } catch { return true; } };

// Рядок стрічки: li стоїть на місці (під ним — підказка свайпу), пузир їде за пальцем
// Новина: другий додав хотілку чи план — тихий рядок посередині, тап веде у вкладку
function newsRow(n) {
  const she = who().partner === 'она';
  if (n.kind === 'ok' || n.kind === 'ask' || n.kind === 'heart' || n.kind === 'captain' || n.kind === 'bell') return markRow(n, she);
  // «✊ Спор»: картка — тема, рахунок, чий хід чи підсумок; тап — сам спор
  if (n.kind === 'duel') return h('li', { class: 'feed-news feed-duel' }, duelCard(n.duel, () => openDuel({ game: duelKind(n.duel) })));
  // «💞 Совпадёт?»: картка — хто ще відповідає чи скільки збіглося; тап — сама гра
  if (n.kind === 'same') return h('li', { class: 'feed-news feed-duel' }, sameCard(n.same, () => openSame(n.same)));
  // «🎁 Желание» з гри «на желание»: висить, поки не відмітять «Исполнено ✓»
  if (n.kind === 'gwish') return h('li', { class: 'feed-news feed-duel', hidden: !n.wish }, n.wish ? gwishCard(n) : null);
  // «Подарено»: хто подарив і що; тап — у «Хотелки»
  if (n.kind === 'gifted') {
    const text = n.mine ? `🎁 Подарено: «${n.title}»` : `✨ ${cap(who().partner)} ${she ? 'подарила' : 'подарил'}: «${n.title}»`;
    return h('li', { class: 'feed-news' }, h('button', { type: 'button', class: 'feed-news-btn', onclick: () => ops.go?.('wish') }, text));
  }
  // Колесо: запрошення від другого й останнє обертання; тап — одразу колесо
  // «Нежність» — з натяком і підморгуванням
  if (n.love) {
    const offers = she ? 'предлагает' : 'предлагает';
    const line = n.title === 'Заняться любовью' ? `${cap(who().partner)} ${offers} 🍓😉` : `${cap(who().partner)} ${offers}: «${n.title}» 😉`;
    // Для «Заняться любовью» 🍓 уже в самому тексті — окремий значок попереду не дублюємо
    return h('li', { class: 'feed-news feed-news-love' },
      h('button', { type: 'button', class: 'feed-news-btn', onclick: () => ops.go?.('deck') }, n.title === 'Заняться любовью' ? line : `🍓 ${line}`));
  }
  // Пачка ідей від ШІ: перші три назви, решта — числом
  const some = n.titles ? `${n.titles.slice(0, 3).map((t) => `«${t}»`).join(', ')}${n.titles.length > 3 ? ` и ещё ${n.titles.length - 3}` : ''}` : '';
  const text = n.kind === 'invite' ? `${cap(who().partner)} зовёт крутить барабан — жми «Готов»`
    : n.kind === 'plans' ? `${cap(who().partner)} ${she ? 'предложила' : 'предложил'} ${n.titles.length > 1 ? `планы: ${some}` : `план ${some}`}`
    : n.kind === 'spin' ? (spinSeen(n.at) ? `Барабан выбрал: «${n.title}»` : 'Барабан докрутился — посмотри, что выпало')
    : `${cap(who().partner)} ${n.kind === 'wish' ? `${she ? 'добавила' : 'добавил'} хотелку` : `${she ? 'предложила' : 'предложил'} план`} «${n.title}»`;
  const [icon, tab] = n.kind === 'wish' ? ['🎁', 'wish'] : n.kind === 'plan' || n.kind === 'plans' ? ['🧭', 'deck'] : ['🎰', 'wheel'];
  return h('li', { class: 'feed-news' },
    h('button', { type: 'button', class: 'feed-news-btn', onclick: () => ops.go?.(tab) },
      h('span', { 'aria-hidden': 'true' }, icon), ` ${text}`));
}

// «Я в порядке» і «Как ты?» — дрібний рядок з боку того, хто відмітився: моє праворуч, другого ліворуч
function markRow(n, she) {
  const female = n.mine ? DATA.side === 'vona' : she;
  const word = n.mood ? moodWord(n.mood, female) : '';
  const mood = n.mood ? ` ${n.mood}${word ? ` ${word}` : ''}` : '';
  // Сердечко з «Вместе», донесене до планети другого
  if (n.kind === 'heart') {
    // Від другого — при першому погляді на нього сердечка злітають (loveIo у watchFresh)
    return h('li', { class: `feed-mark is-heart${n.mine ? ' is-mine' : ' is-love'}`, 'data-love': n.mine ? null : n.id },
      h('span', {}, '💞 Люблю тебя!'), h('span', { class: 'feed-mark-time' }, hhmm(n.at)));
  }
  // «🫡 Да, капитан!» на моє повідомлення: при першому погляді падає піратська треуголка (той самий loveIo)
  if (n.kind === 'captain') {
    return h('li', { class: `feed-mark is-captain${n.mine ? ' is-mine' : ' is-aye'}`, 'data-love': n.mine ? null : n.id },
      h('span', { class: 'feed-captain' }, h('span', { class: 'feed-captain-text' }, '🫡 Да, капитан!'), quoteLine(n.mood, n.at)),
      h('span', { class: 'feed-mark-time' }, hhmm(n.at)));
  }
  // «🔔 Звоночек»: кілька поспіль — з лічильником
  if (n.kind === 'bell') {
    const times = n.count > 1 ? ` ×${n.count}` : '';
    const text = n.mine ? `🔔 Позвал${DATA.side === 'vona' ? 'а' : ''}${times}` : `🔔 ${cap(who().partner)} ${she ? 'звала' : 'звал'} тебя${times}`;
    return h('li', { class: `feed-mark is-bell${n.mine ? ' is-mine' : ''}` }, h('span', {}, text), h('span', { class: 'feed-mark-time' }, hhmm(n.at)));
  }
  const text = n.kind === 'ask'
    ? (n.mine ? `💬 Спросил${DATA.side === 'vona' ? 'а' : ''}, как ${she ? 'она' : 'он'}` : `💬 ${cap(who().partner)} спрашивает, как ты`)
    : `❤️ ${n.mine ? 'Я' : cap(who().partner)} в порядке${mood}`;
  return h('li', { class: `feed-mark${n.mine ? ' is-mine' : ''}` }, h('span', {}, text), h('span', { class: 'feed-mark-time' }, hhmm(n.at)));
}

// Реакції: довге натискання на чуже повідомлення — рядок значків над ним; тап — поставити, ще тап — зняти
const canReact = (it) => (it.type === 'in' && !it.l.tpl) || (it.type === 'meme' && !it.m.mine);
const reactionOf = (it) => (it.type === 'meme' ? it.m.reaction : it.l?.reaction) || null;
function holdToReact(bubble, it) {
  let timer = 0;
  let x0 = 0;
  let y0 = 0;
  const stop = () => clearTimeout(timer);
  bubble.addEventListener('pointerdown', (e) => {
    x0 = e.clientX;
    y0 = e.clientY;
    stop();
    timer = setTimeout(() => {
      // Після довгого натискання клік не має ще й розгорнути лист
      bubble.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
      navigator.vibrate?.(15);
      openReactions(bubble, it);
    }, 450);
  });
  bubble.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 10) stop(); });
  bubble.addEventListener('pointerup', stop);
  bubble.addEventListener('pointercancel', stop);
  // На компʼютері мишею не тримають — правий клік відкриває ті самі смайлики
  bubble.addEventListener('contextmenu', (e) => { e.preventDefault(); stop(); openReactions(bubble, it); });
  // І звичайний клік мишею — теж. Як раніше лишаються: кнопки, фото, цитата, ще не прочитаний лист,
  // згорнутий довгий текст (клік його розкриває) і вже розкритий (клік згортає)
  bubble.addEventListener('click', (e) => {
    if (!MOUSE.matches || e.target.closest('.feed-acts, .feed-act, a, .feed-pic, .feed-react, .feed-quote')) return;
    if (bubble.classList.contains('is-open') || bubble.classList.contains('is-full')) return;
    const t = bubble.querySelector('.feed-text');
    if (t && t.scrollHeight > t.clientHeight + 2) return;
    if (it.type === 'in' && !it.l.opened) return;
    e.preventDefault();
    e.stopPropagation();
    openReactions(bubble, it);
  }, true);
}
const MOUSE = matchMedia('(hover: hover) and (pointer: fine)');
function openReactions(bubble, it) {
  document.querySelector('.react-layer')?.remove();
  const cur = reactionOf(it);
  const r = bubble.getBoundingClientRect();
  const close = () => layer.remove();
  const pick = h('div', { class: 'react-pick', role: 'menu', 'aria-label': 'Реакция' },
    ...REACTIONS.map((e) => h('button', {
      type: 'button', role: 'menuitem', class: `react-opt${e === cur ? ' is-on' : ''}`, 'aria-label': e,
      onclick: (ev) => { ev.stopPropagation(); close(); setReaction(it, e === cur ? null : e, bubble); },
    }, e)));
  // Палець, що щойно відпустили після довгого натискання, теж «клацає» — перші пів секунди шар не закривається
  const opened = Date.now();
  const layer = h('div', { class: 'react-layer', onclick: () => { if (Date.now() - opened > 500) close(); } }, pick);
  document.body.append(layer);
  // Над повідомленням, а коли нагорі місця нема — під ним; не виходимо за краї екрана
  const w = pick.offsetWidth;
  pick.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  const ph = pick.offsetHeight;
  pick.style.top = `${r.top > ph + 20 ? r.top - ph - 6 : Math.min(r.bottom + 8, innerHeight - ph - 8)}px`;
}

async function setReaction(it, value, bubble) {
  const live = it.type === 'meme' ? liveMeme(it.m) : liveLetter(it.l);
  const prev = live.reaction || null;
  live.reaction = value;
  draw();
  // Рядок перемальовано — анімуємо вже новий пузир
  if (value) reactFx(rows.get(it.key)?.el?.firstElementChild || bubble, value);
  try {
    await send(it.type === 'meme' ? `memes/${live.id}` : `letters/${live.id}`, 'PUT', { reaction: value });
  } catch {
    live.reaction = prev;
    draw();
    toast('Не получилось — нет связи');
  }
}

function row(it) {
  if (it.type === 'news') return newsRow(it.n);
  const mine = it.type === 'out' || (it.type === 'meme' && it.m.mine);
  const closed = it.type === 'in' && sealed(it.l);
  const bubble = it.type === 'meme' ? memeBubble(it.m) : closed ? envBubble(it.l) : it.type === 'in' ? inBubble(it.l) : outBubble(it.l, it.later);
  // Мордочки збоку нема — вона читалась як автор. Улюбленець лише приносить: сидить біля конверта, у листі — «🐾 ім'я»
  // Значок реакції в куті: на чужому — моя, на моєму — його/її
  const reaction = reactionOf(it);
  // Значок реакції — у власному рядку під вмістом (has-react дає місце), щоб не накривав час і «Ответить»
  // Тап по своєму смайлику на чужому повідомленні — змінити чи прибрати
  // Свій смайлик на чужому — прямо на кнопці 🤍 (тап — змінити), окремого рядка не треба
  const heart = reaction && !closed && canReact(it) ? bubble.querySelector('.feed-acts .feed-act[aria-label="Сердечко"]') : null;
  if (heart) {
    heart.textContent = reaction;
    heart.classList.add('is-reacted');
    heart.setAttribute('aria-label', `Реакция: ${reaction}. Тап — поменять`);
  } else if (reaction) {
    bubble.classList.add('has-react');
    const own = !closed && canReact(it);
    bubble.append(h('span', {
      class: `feed-react${own ? ' is-tap' : ''}`, 'aria-label': `Реакция: ${reaction}`,
      onclick: own ? (e) => { e.stopPropagation(); openReactions(bubble, it); } : null,
    }, reaction));
  }
  if (!closed && canReact(it)) holdToReact(bubble, it);
  const li = h('li', { class: `feed-row ${mine ? 'is-mine' : 'is-theirs'}${it.type === 'meme' ? ' is-meme' : ''}${closed ? ' is-sealed' : ''}`, 'data-key': it.key }, bubble);
  // Реакція другого на моє: при першому погляді — її анімація (reactIo у watchFresh)
  if (reaction && mine) {
    li.classList.add('has-their-react');
    li.dataset.react = `r:${it.key}:${reaction}`;
    li.dataset.reactGlyph = reaction;
    li.dataset.reactAt = String(it.type === 'meme' ? it.m.created : (it.l.at || it.l.created || 0));
  }
  // Конверт лише відкривають: сховати чи відповісти, не прочитавши, не можна
  if (closed) return li;
  const canReply = () => replyTarget(it) != null;
  swipeable(li, bubble, {
    place: 'feed',
    canRight: canReply,
    onRight: () => openReplyFor(it),
  });
  return li;
}

// Кому можна відповісти: лише на чуже і лише раз
// Відповісти можна на кожне отримане повідомлення і скільки завгодно разів: відповідь — нове повідомлення з цитатою
function replyTarget(it) {
  if (it.type === 'in') return it.l.tpl ? { tpl: true, obj: it.l } : { path: `letters/${it.l.id}`, obj: it.l };
  if (it.type === 'meme' && !it.m.mine) return { path: `memes/${it.m.id}`, obj: it.m };
  return null;
}

// Над повідомленням-відповіддю — на що відповіли; тап — до того повідомлення (at — коли написали відповідь)
function quoteLine(q, at) {
  if (!q) return null;
  const go = (e) => { e.stopPropagation(); toQuoted(q, at); };
  return h('span', {
    class: 'feed-quote', role: 'button', tabindex: '0', 'aria-label': `Перейти к сообщению: ${q}`,
    onclick: go, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } },
  }, h('span', { class: 'feed-quote-mark', 'aria-hidden': 'true' }, '↩ '), q);
}

// Цитата — лише текст (до 300 знаків і «…»), тож шукаємо найновіше повідомлення з таким текстом, написане раніше за відповідь
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const saidIn = (it) => (it.type === 'meme' ? memeSaid(it.m) : it.l?.text || '');
const writtenAt = (it) => (it.type === 'meme' ? it.m.created : it.l?.created || it.at);
function quoted(q, at) {
  const want = norm(q);
  const head = want.endsWith('…') ? want.slice(0, -1) : null;
  return items().find((it) => ['in', 'out', 'meme'].includes(it.type) && writtenAt(it) < at
    && (norm(saidIn(it)) === want || (head && norm(saidIn(it)).startsWith(head)))) || null;
}
async function toQuoted(q, at) {
  let found = quoted(q, at);
  // Не підвантажене — гортаємо історію з сервера, поки не знайдеться (не більше кількох сторінок)
  for (let i = 0; !found && page.more && i < 6; i += 1) {
    try {
      merge(await get(`feed?before=${page.horizon}`), true);
    } catch {
      toast('Не загрузилось — нет связи');
      return;
    }
    found = quoted(q, at);
  }
  if (!found) { toast('Этого сообщения уже нет в переписке'); return; }
  const idx = items().findIndex((it) => it.key === found.key);
  if (idx >= limit) limit = idx + 3;
  foldedDays.delete(dayTitle(found.at));
  draw(false, true);
  // Після того, як draw поверне прокрутку на місце, — до знайденого, і воно коротко світиться
  setTimeout(() => {
    const row = rows.get(found.key)?.el;
    if (!row?.isConnected) return;
    stuck = false;
    row.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    const b = row.querySelector('.feed-bubble') || row;
    b.classList.remove('is-found');
    void b.offsetWidth;
    b.classList.add('is-found');
    setTimeout(() => b.classList.remove('is-found'), 1800);
  }, 60);
}

function newMark(on) {
  return on ? h('span', { class: 'inbox-new' }, 'новое') : null;
}

function replyBtn(it) {
  return h('button', {
    type: 'button', class: 'feed-act feed-reply',
    onclick: (e) => { e.stopPropagation(); openReplyFor(it); },
  }, '↩ Ответить');
}

// Відповісти на його/її старішу відповідь під повідомленням — так само новим повідомленням із цитатою
function againBtn(reply) {
  return h('button', {
    type: 'button', class: 'feed-act feed-reply',
    onclick: (e) => { e.stopPropagation(); replySheet(reply, 'letter'); },
  }, '↩ Ответить');
}

// Лист лише зі смайлів (1–3) — у чаті великими, як у месенджері; 0 — звичайний текст
const graphemes = new Intl.Segmenter('ru', { granularity: 'grapheme' });
const PICTO = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})/u;
function emojiOnly(t) {
  const s = (t || '').replace(/\s+/g, '');
  if (!s || s.length > 32) return 0;
  const g = [...graphemes.segment(s)].map((x) => x.segment);
  return g.length <= 3 && g.every((x) => PICTO.test(x)) ? g.length : 0;
}
const textClass = (t) => { const n = emojiOnly(t); return n ? `feed-text is-emoji is-emoji-${n}` : 'feed-text'; };

function inBubble(l) {
  const me = who();
  const it = { type: 'in', key: l.tpl ? welcomeKey(l) : `l:${l.id}`, l };
  const text = h('p', { class: textClass(l.text) }, l.text || '');
  const full = unfolded.has(it.key);
  const bubble = h('div', { class: `feed-bubble${l.opened ? '' : ' is-new'}${full ? ' is-full' : ''}` });
  const body = h('button', {
    type: 'button', class: 'feed-body', 'aria-expanded': String(full),
    onclick: () => {
      // Розкритий з конверта — тап згортає, як звичайний
      if (bubble.classList.contains('is-full')) {
        unfolded.delete(it.key);
        bubble.classList.remove('is-full');
        body.setAttribute('aria-expanded', 'false');
        return;
      }
      const open = bubble.classList.toggle('is-open');
      body.setAttribute('aria-expanded', String(open));
      // Відкрив тут — прочитано; лише за тапом, не за показом
      if (open && !l.opened) {
        l.opened = true;
        bubble.classList.remove('is-new');
        bubble.querySelector('.inbox-new')?.remove();
        send(`letters/${l.id}`, 'PUT', { opened: true }).catch(() => {});
        fresh();
        openFx(bubble, l.text);
      }
    },
  },
  h('span', { class: 'feed-meta' },
    h('span', {}, `${l.kind === 'date' ? '🎉' : '💌'} ${hhmm(l.at)}`),
    courierOf(l) ? h('span', { class: 'feed-courier' }, `🐾 ${petName(courierOf(l))}`) : null,
    l.tpl ? h('span', {}, 'первое письмо') : null,
    newMark(!l.opened)),
  quoteLine(l.quote, l.created || l.at),
  l.text ? text : null);
  const like = h('button', {
    type: 'button', class: 'feed-act', 'aria-pressed': String(!!l.liked), 'aria-label': 'Сердечко',
    onclick: async (e) => {
      e.stopPropagation();
      if (l.tpl) { ops.like?.(l); return; }
      // Сердечко відкриває смайлики (❤️ серед них) — і на телефоні, і на компʼютері; старі «понравилось» лишаються
      if (canReact(it)) { openReactions(bubble, it); return; }
      const cur = liveLetter(l);
      const prev = cur.liked;
      cur.liked = !prev;
      // Міняємо лише саму кнопку — перебудова всієї стрічки на кожне ❤️ гальмувала б
      const paint = (on) => { like.textContent = on ? '❤️' : '🤍'; like.setAttribute('aria-pressed', String(!!on)); };
      paint(cur.liked);
      if (cur.liked) burst(like, '❤️', 7);
      try { await send(`letters/${l.id}`, 'PUT', { liked: cur.liked, opened: true }); liveLetter(l).opened = true; } catch {
        liveLetter(l).liked = prev;
        paint(prev);
        toast('Не сохранилось — нет связи');
      }
    },
  }, l.liked ? '❤️' : '🤍');
  // append, на відміну від h(), друкує null як текст — порожні відсіюємо
  bubble.append(...[body,
    l.reply ? h('p', { class: 'sent-reply' }, h('b', {}, 'Твой ответ: '), l.reply) : null,
    h('div', { class: 'feed-acts' }, like, replyBtn(it))].filter(Boolean));
  return bubble;
}

// Хто приніс лист: його кур'єр, а як нема — той, хто зазвичай приносить
const courierOf = (l) => (DATA.mascots[l.mascot] ? l.mascot : petFor('push'));

// Запечатаний лист у чаті: міні-конверт із печаттю, назва й «Открыть»; тап — шторка на весь екран
function envBubble(l) {
  const festive = l.kind === 'date';
  const pet = courierOf(l);
  const she = DATA.mascots[pet]?.g === 'f';
  const name = festive ? 'Праздничное письмо 🎉' : 'Тебе письмо 💌';
  return h('button', {
    type: 'button', class: `feed-bubble feed-env${festive ? ' is-festive' : ''}`,
    'aria-label': `${name}: открыть`,
    onclick: (e) => (l.tpl || festive ? ops.open?.(l) : openHere(l, e.currentTarget)),
  },
    // Улюбленець тримає конверт; до свята — у святковому ковпаку
    pet ? h('span', { class: 'mascot feed-env-pet', 'aria-hidden': 'true', html: mascotImg(pet, festive ? firstPose(pet, 'party', 'festive') : letterPose(pet, l.id ?? l.date)) }) : null,
    h('span', { class: 'feed-env-pic', 'aria-hidden': 'true' }),
    h('span', { class: 'feed-env-text' },
      h('b', {}, name),
      h('span', {}, `${pet ? `${petName(pet)} ${she ? 'принесла' : 'принёс'} · ` : ''}${hhmm(l.at)}${l.tpl ? ' · первое письмо' : ''}`)),
    h('span', { class: 'feed-env-go', 'aria-hidden': 'true' }, 'Открыть'));
}

// Звичайний лист розкривається прямо в чаті: печатка злітає — і на місці конверта сам лист, цілим
function openHere(l, env) {
  const key = `l:${l.id}`;
  const done = () => {
    const cur = liveLetter(l);
    cur.opened = true;
    // Найновіший лист живе ще й у DATA.letter (з boot)
    if (DATA.letter?.id === l.id) DATA.letter.opened = true;
    send(`letters/${l.id}`, 'PUT', { opened: true }).catch(() => {});
    unfolded.add(key);
    draw();
    fresh();
    // Щойно розкритий лист уже на місці конверта — ефект від нього
    const row = [...document.querySelectorAll('.feed-row')].find((x) => x.dataset.key === key);
    openFx(row?.querySelector('.feed-bubble'), l.text);
  };
  if (reduceMotion) { done(); return; }
  env.classList.add('is-opening');
  env.disabled = true;
  setTimeout(done, 420);
}

function outBubble(l, later) {
  const me = who();
  const e = (DATA.partnerEnvelopes || []).find((x) => x.id === l.env);
  const where = l.kind === 'env' ? `${e ? e.emoji : '✉'} ${hhmm(l.created)} · в конверт «${e ? e.label : '…'}»`
      : `${l.stocked ? '📦 из запаса ·' : '➶'} ${hhmm(later ? l.created : l.at)}`;
  let state;
  // «На утро» — о 8:00; «Ко времени» — той самий вид листа, але свій час
  if (l.kind === 'morning' && later) state = `${new Date(l.at).getHours() === 8 && !new Date(l.at).getMinutes() ? 'ждёт утра' : 'ждёт'} · ${dayWord(l.at)} в ${hhmm(l.at)}`;
  else if (l.kind === 'date' && later) state = `🎂 ждёт · ${dayMonth(l.at)} в ${hhmm(l.at)}`;
  else if (l.opened) state = `${me.partnerOpened} ✓${l.liked ? ' · ❤️' : ''}`;
  else state = l.kind === 'env' ? 'лежит в конверте' : `ещё не ${me.partnerOpened}`;

  const bubble = h('div', { class: 'feed-bubble' });
  const take = l.opened ? null : h('button', {
    type: 'button', class: 'sent-take',
    onclick: async (ev) => {
      ev.stopPropagation();
      if (!await ask({ title: 'Забрать письмо?', text: 'Оно исчезнет, будто его не было.', yes: 'Забрать', say: 'takeLetter' })) return;
      try {
        await send(`letters/${l.id}`, 'DELETE');
        cache.sent = cache.sent.filter((x) => x.id !== l.id);
        draw();
      } catch (err) {
        toast(err.status === 409 ? `Поздно — ${me.partner} уже ${me.partnerOpened}` : 'Не получилось — нет связи');
      }
    },
  }, 'Забрать');
  const isNew = (l.replied || 0) > seenAt.replies;
  bubble.append(...[
    quoteLine(l.quote, l.created || l.at),
    l.text ? h('p', { class: textClass(l.text), onclick: () => bubble.classList.toggle('is-open') }, l.text) : null,
    h('p', { class: 'feed-meta' }, h('span', {}, `${where} · ${state}`)),
    l.reply ? h('p', { class: `sent-reply${isNew ? ' is-fresh' : ''}`, 'data-replied': l.replied || 0 },
      h('b', {}, `${cap(me.partner)} ответил${me.partner === 'она' ? 'а' : ''}: `), l.reply, newMark(isNew)) : null,
    h('div', { class: 'feed-acts' }, take, l.reply ? againBtn(l.reply) : null)].filter(Boolean));
  return bubble;
}

// Файл «як файл»: значок, назва, розмір і «Скачать»; стертий (місце в сховищі) — лише назва
function fileCard(m) {
  const f = m.file;
  const size = f.s < 1024 * 1024 ? `${Math.max(1, Math.round(f.s / 1024))} КБ` : `${(f.s / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
  return h('div', { class: `file-card${m.gone ? ' is-gone' : ''}` },
    h('span', { class: 'file-card-icon', 'aria-hidden': 'true' }, fileIcon(f.t)),
    h('span', { class: 'file-card-text' },
      h('b', { class: 'file-card-name' }, f.n || 'Файл'),
      h('small', {}, m.gone ? 'Файл удалён, чтобы освободить место' : size)),
    m.gone ? null : h('button', {
      type: 'button', class: 'file-card-get', 'aria-label': `Скачать ${f.n || 'файл'}`,
      onclick: async (e) => { e.stopPropagation(); (await import('./files.js')).downloadFile(m); },
    }, '⬇ Скачать'));
}

function memeBubble(m) {
  const me = who();
  const it = { type: 'meme', key: `m:${m.id}`, m };
  const over = m.caption && m.style ? h('span', { class: `meme-over is-${m.style}`, 'aria-hidden': 'true' }, m.caption) : null;
  // Старе фото стерли, щоб у базі лишалось місце: підпис і відповіді лишаються, картинки нема
  const pic = m.file ? fileCard(m) : m.gone && !m.url
    ? h('p', { class: 'meme-gone' }, '🖼 Фото удалено, чтобы освободить место')
    : h('button', {
      type: 'button', class: 'meme-img feed-pic', 'data-id': m.id, 'data-url': m.url || '', 'aria-label': 'Открыть на весь экран',
      onclick: () => showMeme(m, pic),
    }, media(m.url, m.caption || memeWord(m)), over);
  const isNew = m.mine ? (m.replied || 0) > seenAt.replies : m.created > seenAt.memes;
  let acts;
  if (m.mine) {
    acts = [
      m.reply ? againBtn(m.reply) : null,
      h('button', { type: 'button', class: 'feed-act', 'aria-label': 'Удалить у обоих', onclick: () => removeMeme(m) }, '🗑'),
    ];
  } else {
    // Смайлик на фото — та сама кнопка, що й на листі (довге натискання теж працює)
    acts = [h('button', {
      type: 'button', class: 'feed-act', 'aria-label': 'Сердечко',
      onclick: (e) => { e.stopPropagation(); openReactions(e.currentTarget.closest('.feed-bubble'), it); },
    }, '🤍'), replyBtn(it)];
  }
  const replyLine = m.reply
    ? h('p', { class: `sent-reply${m.mine && isNew ? ' is-fresh' : ''}`, 'data-replied': m.replied || 0 },
      h('b', {}, m.mine ? `${cap(me.partner)} ответил${me.partner === 'она' ? 'а' : ''}: ` : 'Твой ответ: '), m.reply, newMark(m.mine && isNew))
    : null;
  return h('div', { class: `feed-bubble feed-meme${!m.mine && isNew ? ' is-fresh' : ''}`, 'data-created': m.created },
    quoteLine(m.quote, m.created),
    pic,
    m.caption && !over ? h('p', { class: 'meme-cap' }, m.caption) : null,
    replyLine,
    h('div', { class: 'feed-acts' },
      h('span', { class: 'feed-meta' }, `${m.file ? '📎' : '🖼'} ${hhmm(m.created)}`, newMark(!m.mine && isNew)),
      ...acts));
}


async function removeMeme(m) {
  if (!await ask({ title: `Удалить ${m.url ? 'эту гифку' : m.file ? 'этот файл' : 'это фото'} у обоих?`, yes: 'Удалить', say: 'deleteMeme' })) return;
  try {
    await send(`memes/${m.id}`, 'DELETE');
    DATA.memes = DATA.memes.filter((x) => x.id !== m.id);
    draw();
  } catch {
    toast('Не удалилось — нет связи');
  }
}

function openReplyFor(it) {
  const target = replyTarget(it);
  if (!target) return;
  // Привітальний — без відправника: відповідь іде звичайним листом, це робить app.js
  if (target.tpl) { ops.reply?.(it.l); return; }
  const meme = it.type === 'meme';
  const quote = meme ? memeSaid(it.m) : (it.l.text || '');
  // Відповіла на лист — значить, прочитала
  const sent = meme || it.l.opened ? null : () => {
    liveLetter(it.l).opened = true;
    send(target.path, 'PUT', { opened: true }).catch(() => {});
  };
  replySheet(quote, meme ? memeOn(it.m) : 'letter', sent);
}

// Відповідь — той самий екран «Написать» (app.js передає openWrite) з цитатою зверху; піде новим повідомленням
function replySheet(quote, on, sent = null) {
  ops.compose?.({ reply: { quote: quote.length > 300 ? `${quote.slice(0, 300)}…` : quote, on, sent } });
}

// Мемчик на весь екран: та сама картинка чи відео з підписом поверх
function showMeme(m, pic) {
  const src = pic.querySelector('img, video')?.src;
  if (!src) return;
  const close = () => { view.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const el = media(m.url, m.caption || memeWord(m), src);
  const view = h('div', { class: 'photo-view feed-full', role: 'dialog', 'aria-modal': 'true', 'aria-label': memeWord(m), onclick: close },
    h('div', { class: 'feed-full-frame' }, el,
      m.caption && m.style ? h('span', { class: `meme-over is-${m.style}`, 'aria-hidden': 'true' }, m.caption) : null),
    m.caption && !m.style ? h('p', { class: 'feed-full-cap' }, m.caption) : null,
    h('button', {
      type: 'button', class: 'feed-full-save', 'aria-label': `Сохранить ${m.url ? 'гифку' : 'фото'} на устройство`,
      onclick: (e) => { e.stopPropagation(); saveMeme(m, el); },
    }, '⬇ Сохранить'),
    h('button', { type: 'button', class: 'photo-view-close', 'aria-label': 'Закрыть' }, '✕'));
  document.addEventListener('keydown', onKey);
  document.body.append(view);
  view.querySelector('.photo-view-close').focus();
}

// Картинки тягнемо, коли пузир під'їжджає до екрана; нове гасне, коли його справді побачили.
// els — щойно вставлені вузли (уже бачені не чіпаємо). Гифки (беззвучне відео) грають лише на екрані:
// за краєм — пауза, інакше довгий чат крутив би десятки відео й тримав процесор зайнятим
const watched = new WeakSet();
let picIo = null;
let seenIo = null;
let playIo = null;
function watchFresh(els) {
  const fresh = els.filter((el) => !watched.has(el));
  fresh.forEach((el) => watched.add(el));
  if (!fresh.length) return;
  picIo ||= new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      picIo.unobserve(target);
      loadPic(target);
    }
  }, { rootMargin: '300px 0px' });
  // Низ екрана закриває меню з марками — під ним ще не «побачено»
  seenIo ||= new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) { seenIo.unobserve(target); seen(target); }
    }
  }, { threshold: 0.6, rootMargin: '0px 0px -96px 0px' });
  playIo ||= new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) target.play().catch(() => {});
      else target.pause();
    }
  });
  const pick = (sel) => fresh.flatMap((r) => [...(r.matches(sel) ? [r] : []), ...r.querySelectorAll(sel)]);
  pick('.meme-img').forEach((el) => picIo.observe(el));
  pick('.feed-meme.is-fresh, .sent-reply.is-fresh').forEach((el) => seenIo.observe(el));
  pick('.meme-img video').forEach((el) => playIo.observe(el));
  // «💞 Люблю тебя!» від другого: побачили вперше на цьому телефоні — сердечка злітають
  loveIo ||= new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      loveIo.unobserve(target);
      if (!markLoveSeen(target.dataset.love)) continue;
      if (target.classList.contains('is-aye')) setTimeout(() => captainSalute(target), 250);
      else setTimeout(() => { loveRain(target); loveConstellation(); }, 250);
    }
  }, { threshold: 0.9, rootMargin: '0px 0px -96px 0px' });
  const old = loveSeen();
  pick('.feed-mark.is-love, .feed-mark.is-aye').forEach((el) => { if (!old.includes(el.dataset.love)) loveIo.observe(el); });
  // Побачено — коли видно 60% рядка або він займає пів екрана (довгий лист на 60% не влізе ніколи)
  reactIo ||= new IntersectionObserver((entries) => {
    for (const { target, isIntersecting, intersectionRatio, intersectionRect, rootBounds } of entries) {
      if (!isIntersecting) continue;
      if (intersectionRatio < 0.6 && intersectionRect.height < (rootBounds?.height || innerHeight) * 0.5) continue;
      reactIo.unobserve(target);
      reactWait.delete(target);
      paintReactJump();
      if (markLoveSeen(target.dataset.react)) setTimeout(() => reactFxQueued(target.firstElementChild, target.dataset.reactGlyph), 250);
    }
  }, { threshold: [0, 0.2, 0.4, 0.6], rootMargin: '0px 0px -96px 0px' });
  const reacts = pick('.feed-row.has-their-react').filter((el) => !old.includes(el.dataset.react));
  // Перший запуск з цією функцією: наявні реакції — вже бачені, без салюту; далі — кожна нова, хоч і на старому листі
  if (!reactBase()) {
    reacts.forEach((el) => markLoveSeen(el.dataset.react));
    setReactBase();
  } else {
    reacts.forEach((el) => { reactWait.add(el); reactIo.observe(el); });
    // Видимі за цей час уже зіграли — плашка лише для тих, що за краєм
    if (reacts.length) setTimeout(paintReactJump, 700);
  }
}

let reactIo = null;
const REACT_BASE = 'radovalka:react-base';
function reactBase() {
  try { return !!localStorage.getItem(REACT_BASE); } catch { return true; }
}
function setReactBase() {
  try { localStorage.setItem(REACT_BASE, String(Date.now())); } catch { /* приватне вікно */ }
}

let loveIo = null;
const LOVE_KEY = 'radovalka:love-seen';
function loveSeen() {
  try { return JSON.parse(localStorage.getItem(LOVE_KEY) || '[]'); } catch { return []; }
}
// true — бачимо вперше; памʼятаємо останні 400 (серця, «капитан», реакції), щоб список не ріс
function markLoveSeen(id) {
  const list = loveSeen();
  if (!id || list.includes(id)) return false;
  try { localStorage.setItem(LOVE_KEY, JSON.stringify([...list, id].slice(-400))); } catch { /* приватне вікно — анімація все одно */ }
  return true;
}

let saveTimer = 0;
function seen(el) {
  const patch = {};
  if (el.dataset.created && +el.dataset.created > memesSeen()) patch.memesSeen = +el.dataset.created;
  if (el.dataset.replied && +el.dataset.replied > repliesSeen()) patch.repliesSeen = +el.dataset.replied;
  if (!Object.keys(patch).length) return;
  Object.assign(DATA.mine, patch);
  fresh();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save('mine', { memesSeen: memesSeen(), repliesSeen: repliesSeen() }), 600);
}

async function loadPic(target) {
  const el = target.querySelector('img, video');
  try {
    const src = target.dataset.url || await memeUrl(target.dataset.id);
    const ok = () => target.classList.add('is-loaded');
    if (el.tagName === 'VIDEO') el.addEventListener('loadeddata', ok, { once: true });
    else el.onload = ok;
    el.onerror = () => target.classList.add('is-broken');
    el.src = src;
  } catch {
    target.classList.add('is-broken');
  }
}

// Свайп пузиря: горизонтальний рух веде пузир, вертикальний — віддаємо прокрутці сторінки
// fold — після вильоту згорнути рядок (хотілка замість цього стає рядком «Вернуть»)
export function swipeable(row, bubble, { onLeft, onRight, canRight = () => true, place = '', fold = true }) {
  let x0 = null;
  let y0 = 0;
  let dx = 0;
  let mode = '';
  // Горизонталь — наша, вертикаль — прокрутці; без цього телефон забирає жест і шле pointercancel
  bubble.style.touchAction = 'pan-y';
  const reset = () => {
    bubble.style.transform = '';
    row.dataset.swipe = '';
    bubble.classList.remove('is-drag');
  };
  bubble.addEventListener('pointerdown', (e) => {
    if (e.button || e.clientX < EDGE || e.clientX > innerWidth - EDGE) return;
    if (e.target.closest('textarea, input')) return;
    x0 = e.clientX;
    y0 = e.clientY;
    dx = 0;
    mode = '';
  });
  bubble.addEventListener('pointermove', (e) => {
    if (x0 == null) return;
    dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (!mode) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (mode === 'y') { x0 = null; return; }
      bubble.setPointerCapture(e.pointerId);
      bubble.classList.add('is-drag');
    }
    // У бік без дії — лише пружинить
    const d = dx > 0 && !canRight() ? Math.min(dx, 60) * 0.35 : dx < 0 && !onLeft ? -Math.min(-dx, 60) * 0.35 : dx;
    bubble.style.transform = `translateX(${d}px)`;
    // Підпис — лише в бік, де змах справді щось зробить
    row.dataset.swipe = !onLeft && d < 0 ? '' : !canRight() && d > 0 ? ''
      : d < -SWIPE ? 'hide' : d > SWIPE ? 'reply' : d < -20 ? 'hide-soon' : d > 20 ? 'reply-soon' : '';
  });
  const end = () => {
    if (x0 == null) return;
    x0 = null;
    if (mode !== 'x') return;
    // Після перетягування клік не має відкрити/натиснути те, що під пальцем
    const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    bubble.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => bubble.removeEventListener('click', stop, { capture: true }), 300);
    const go = dx < -SWIPE && onLeft ? onLeft : dx > SWIPE && onRight && canRight() ? onRight : null;
    if (go && place) learn(place);
    if (go && go === onLeft) {
      // Відлітає з того місця, де відпустили, рядок згортається — і лише тоді зникає зі списку
      const from = bubble.style.transform;
      bubble.classList.remove('is-drag');
      row.style.pointerEvents = 'none';
      flyOut(bubble, -1, from).then(() => (fold ? collapse(row) : null)).then(() => onLeft());
      return;
    }
    // Відповісти — пузир пружинить назад на місце
    bubble.classList.add('is-spring');
    setTimeout(() => bubble.classList.remove('is-spring'), 500);
    reset();
    go?.();
  };
  bubble.addEventListener('pointerup', end);
  bubble.addEventListener('pointercancel', () => { x0 = null; reset(); });
}
