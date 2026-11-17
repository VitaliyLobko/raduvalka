// Стрічка «Письма»: листи (отримані й надіслані) і мемчики разом, нові згори, по днях.
// Свайп вліво — сховати в себе, вправо — відповісти; те саме кнопками
import { DATA, who } from './data.js';
import { get, send, save } from './api.js';
import { h, toast, cap, ARROW } from './ui.js';
import { media, memeUrl, refreshMemes, REACTIONS } from './memes.js';
import { learned, learn, nudge, hintBar } from './swipehint.js';
import { mascotImg, petFor } from './icons.js';

const FILTERS = [['all', 'Все'], ['letters', 'Письма'], ['memes', 'Мемчики']];
const SWIPE = 70;
// Від краю екрана Android гортає «Назад» — там свайп не починаємо
const EDGE = 24;

let filter = 'all';
let showHidden = false;
let showStock = false;
// Листи з сервера; мемчики — у DATA.memes. stale — перечитати при наступному показі
let cache = null;
let stale = true;
let loading = null;
// Позначки «бачив» на момент завантаження: «новое» на пузирях не гасне, поки стрічка на екрані
let seenAt = { memes: 0, replies: 0 };
let box = null;
let redrawAll = null;

const hiddenKey = () => `radovalka:hidden:${DATA.side}`;

function readHidden() {
  try { return new Set(JSON.parse(localStorage.getItem(hiddenKey()) || '[]')); } catch { return new Set(); }
}

function writeHidden(set) {
  try { localStorage.setItem(hiddenKey(), JSON.stringify([...set].slice(-300))); } catch { /* приватне вікно — сховане повернеться */ }
}

export const isHidden = (key) => readHidden().has(key);

export function hide(key) {
  const set = readHidden();
  set.add(key);
  writeHidden(set);
}

function unhide(key) {
  const set = readHidden();
  set.delete(key);
  writeHidden(set);
}

// Перечитати листи при наступному показі (вхід на вкладку, повернення в застосунок, щойно надіслане)
export function invalidateFeed() { stale = true; }

// Тихо дотягнути свіже: перемальовується лише стрічка (якщо на екрані) і крапка на марці
export function refreshFeed() {
  stale = true;
  return load().then(() => { draw(); fresh(); }).catch(() => {});
}

const repliesSeen = () => DATA.mine.repliesSeen || 0;
const memesSeen = () => DATA.mine.memesSeen || 0;

// Скільки нового для крапки на марці «Письма»: мемчики, непрочитані листи, відповіді на моє
export function feedFresh() {
  const memes = DATA.memes || [];
  let n = memes.filter((m) => (m.mine ? (m.replied || 0) > repliesSeen() : m.created > memesSeen())).length;
  if (cache) {
    n += cache.inbox.filter((l) => !l.opened && l.id !== dayId()).length;
    n += cache.sent.filter((l) => (l.replied || 0) > repliesSeen()).length;
  }
  return n;
}

const dayId = () => (isHidden(dayKey()) ? null : DATA.letter?.id);
export const dayKey = () => (DATA.letter ? `day:${DATA.letter.id || DATA.letter.date}` : '');

function load() {
  if (!loading) {
    // Запас — лише свій; старий воркер його не знає — тоді просто без нього
    loading = Promise.all([get('letters/inbox'), get('letters/sent'), refreshMemes(), get('letters/stock').catch(() => [])])
      .then(([inbox, sent, , stock]) => {
        cache = { inbox, sent, stock };
        stale = false;
        seenAt = { memes: memesSeen(), replies: repliesSeen() };
      })
      .finally(() => { loading = null; });
  }
  return loading;
}

// Стрічка під листом дня. rerender — перемалювати весь екран «Письма» (для повернення листа дня)
export function letterFeed(rerender) {
  redrawAll = rerender;
  box = h('div', { class: 'feed-box' });
  const section = h('section', { class: 'feed', 'aria-label': 'Переписка' },
    h('h3', { class: 'archive-title' }, 'Переписка'), box);
  // Секцію ще не вставлено в сторінку — малюємо в неї примусово
  if (cache) draw(true);
  else box.append(h('p', { class: 'mk-wait' }, 'Загружаю…'));
  if (stale || !cache) {
    load().then(() => { draw(); fresh(); }).catch(() => {
      if (!cache && box.isConnected) box.replaceChildren(h('p', { class: 'mk-wait' }, 'Не загрузилось — нет связи'));
    });
  }
  return section;
}

const fresh = () => document.dispatchEvent(new CustomEvent('radovalka:fresh'));

// Фонове оновлення підміняє кеш — зміну пишемо в актуальний об'єкт за id, а не в той, що був при малюванні
const liveLetter = (l) => cache?.inbox.find((x) => x.id === l.id) || l;
const liveMeme = (m) => (DATA.memes || []).find((x) => x.id === m.id) || m;

function items() {
  const now = Date.now();
  const day = dayId();
  const list = [];
  if (filter !== 'memes') {
    for (const l of cache?.inbox || []) if (l.id !== day) list.push({ type: 'in', key: `l:${l.id}`, at: l.at, l });
    for (const l of cache?.sent || []) {
      list.push({ type: 'out', key: `l:${l.id}`, at: l.kind === 'env' ? l.created : (l.at || l.created), l, later: l.at > now });
    }
  }
  if (filter !== 'letters') {
    for (const m of DATA.memes || []) list.push({ type: 'meme', key: `m:${m.id}`, at: m.created, m });
  }
  return list.sort((a, b) => b.at - a.at);
}

// force — box ще не в документі (щойно створений letterFeed); інакше старий box, що зник з екрана, не чіпаємо
function draw(force = false) {
  if (!box || (!force && !box.isConnected)) return;
  const hidden = readHidden();
  const all = items();
  const shown = all.filter((it) => !hidden.has(it.key));
  const hiddenItems = all.filter((it) => hidden.has(it.key));
  const dayHidden = DATA.letter && hidden.has(dayKey());

  const seg = h('div', { class: 'mk-chips mk-kind archive-seg', role: 'radiogroup', 'aria-label': 'Что показать' },
    ...FILTERS.map(([v, label]) => h('button', {
      type: 'button', role: 'radio', class: 'mk-chip', 'aria-checked': String(filter === v),
      onclick: () => { filter = v; draw(); },
    }, label)));

  const list = h('ol', { class: 'feed-list' });
  let lastDay = '';
  for (const it of shown) {
    const d = dayTitle(it.at);
    if (d !== lastDay) {
      list.append(h('li', { class: 'feed-day' }, d));
      lastDay = d;
    }
    list.append(row(it));
  }

  const nHidden = hiddenItems.length + (dayHidden ? 1 : 0);
  box.replaceChildren(...[
    seg,
    shown.length && !learned('feed') ? hintBar('feed-swipe-hint', 'спрятать у себя', 'ответить') : null,
    shown.length ? list : h('p', { class: 'mk-wait' }, emptyText()),
    nHidden ? h('button', {
      type: 'button', class: 'feed-hidden-toggle', 'aria-expanded': String(showHidden),
      onclick: () => { showHidden = !showHidden; draw(); },
    }, showHidden ? 'Скрыть спрятанные' : `Спрятанные · ${nHidden}`) : null,
    showHidden && nHidden ? h('ul', { class: 'feed-hidden' },
      dayHidden ? h('li', {}, h('span', {}, '💌 Письмо дня'), restoreBtn(dayKey(), true)) : null,
      ...hiddenItems.map((it) => h('li', {}, h('span', {}, hiddenLabel(it)), restoreBtn(it.key)))) : null,
    stockBlock(),
  ].filter(Boolean));
  watchFresh(list);
  // Перша чужа — разок показує, що під нею зліва й справа
  const first = list.querySelector('.feed-row.is-theirs');
  const lean = (x, s) => () => {
    const b = first.querySelector('.feed-bubble');
    b.style.transform = x ? `translateX(${x}px)` : '';
    first.dataset.swipe = s;
  };
  nudge('feed', first, [lean(-64, 'hide-soon'), lean(0, ''), lean(64, 'reply-soon'), lean(0, '')]);
}

// Запас: листи на дні, коли від мене нічого не буде; «с какого дня» — без неї запас на паузі
const plural = (n, one, few, many) => {
  const t = n % 10; const h100 = n % 100;
  return t === 1 && h100 !== 11 ? one : t >= 2 && t <= 4 && (h100 < 12 || h100 > 14) ? few : many;
};

function stockBlock() {
  const stock = cache?.stock || [];
  if (!stock.length) return null;
  const from = DATA.mine.stockFrom || '';
  const toggle = h('button', {
    type: 'button', class: 'feed-hidden-toggle feed-stock-toggle', 'aria-expanded': String(showStock),
    onclick: () => { showStock = !showStock; draw(); },
  }, showStock ? 'Свернуть запас' : `📦 Запас · ${stock.length}${from ? '' : ' · на паузе'}`);
  if (!showStock) return toggle;
  const setFrom = (v) => {
    DATA.mine.stockFrom = v || null;
    save('mine', { stockFrom: v || null });
    draw();
  };
  const n = stock.length;
  const status = from
    ? `Выручает с ${dayMonth(new Date(`${from}T12:00`).getTime())}: в день без твоего письма утром придёт одно из запаса. Хватит на ${n} ${plural(n, 'утро', 'утра', 'утр')}.`
    : 'На паузе. Выбери, с какого дня выручать, — тогда в день без твоего письма утром придёт одно из запаса.';
  const take = (l) => h('button', {
    type: 'button', class: 'sent-take',
    onclick: async () => {
      try {
        await send(`letters/${l.id}`, 'DELETE');
        cache.stock = cache.stock.filter((x) => x.id !== l.id);
        draw();
      } catch { toast('Не получилось — нет связи'); }
    },
  }, 'Забрать');
  return h('div', { class: 'feed-stock' }, toggle,
    h('p', { class: 'feed-stock-note' }, status),
    h('label', { class: 'feed-stock-from' }, 'Выручать с',
      h('input', { type: 'date', value: from, onchange: (e) => setFrom(e.target.value) }),
      from ? h('button', { type: 'button', class: 'sent-take', onclick: () => setFrom('') }, 'Пауза') : null),
    h('ul', { class: 'feed-hidden' }, ...stock.map((l) => h('li', {}, h('span', {}, `📦 ${l.text}`), take(l)))));
}

function emptyText() {
  const me = who();
  if (filter === 'memes') return 'Мемчиков пока нет. Печать «Написать» → «📷» или «🎞».';
  return `Здесь будет ваша переписка: письма, ответы и мемчики. ${cap(me.partner)} тоже их тут увидит.`;
}

function restoreBtn(key, whole = false) {
  return h('button', {
    type: 'button', class: 'sent-take',
    onclick: () => { unhide(key); if (whole) redrawAll?.(); else draw(); fresh(); },
  }, 'Вернуть');
}

function hiddenLabel(it) {
  if (it.type === 'meme') {
    const whose = it.m.mine ? 'Твой' : (who().partner === 'она' ? 'Её' : 'Его');
    return `🖼 ${whose} мемчик${it.m.caption ? `: ${it.m.caption.slice(0, 40)}` : ''}`;
  }
  const text = (it.l.text || (it.l.kind === 'gift' ? '🎁 Подарок' : '')).slice(0, 40);
  return `${it.type === 'out' ? '➶' : '💌'} ${text}${(it.l.text || '').length > 40 ? '…' : ''}`;
}

const sameDay = (a, b) => a.toDateString() === b.toDateString();
function dayTitle(at) {
  const d = new Date(at);
  const now = new Date();
  if (at > Date.now()) return 'Ещё в пути';
  if (sameDay(d, now)) return 'Сегодня';
  if (sameDay(d, new Date(Date.now() - 86400000))) return 'Вчера';
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

const hhmm = (ms) => new Date(ms).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
const dayMonth = (ms) => new Date(ms).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
const dayWord = (ms) => (new Date(ms).toDateString() === new Date().toDateString() ? 'сегодня' : 'завтра');

// Рядок стрічки: li стоїть на місці (під ним — підказка свайпу), пузир їде за пальцем
function row(it) {
  const mine = it.type === 'out' || (it.type === 'meme' && it.m.mine);
  const bubble = it.type === 'meme' ? memeBubble(it.m) : it.type === 'in' ? inBubble(it.l) : outBubble(it.l, it.later);
  // Чуже повідомлення — з мордочкою того, хто приніс: лист — його кур'єр, мемчик — хто носить мемчики
  const pet = mine ? null : it.type === 'meme' ? petFor('memes') : DATA.mascots[it.l.mascot] ? it.l.mascot : petFor('push');
  const li = h('li', { class: `feed-row ${mine ? 'is-mine' : 'is-theirs'}${it.type === 'meme' ? ' is-meme' : ''}${pet ? ' has-pet' : ''}`, 'data-key': it.key },
    pet ? h('span', { class: 'mascot feed-pet', 'aria-hidden': 'true', html: mascotImg(pet) }) : null, bubble);
  const canReply = () => replyTarget(it) != null;
  swipeable(li, bubble, {
    place: 'feed',
    canRight: canReply,
    onLeft: () => {
      hide(it.key);
      draw();
      fresh();
      toast('Спрятано у тебя. Вернуть — внизу «Спрятанные»');
    },
    onRight: () => openReplyFor(it),
  });
  return li;
}

// Кому можна відповісти: лише на чуже і лише раз
function replyTarget(it) {
  if (it.type === 'in' && !it.l.reply) return { path: `letters/${it.l.id}`, obj: it.l };
  if (it.type === 'meme' && !it.m.mine && !it.m.reply) return { path: `memes/${it.m.id}`, obj: it.m };
  return null;
}

function newMark(on) {
  return on ? h('span', { class: 'inbox-new' }, 'новое') : null;
}

function hideBtn(key) {
  return h('button', {
    type: 'button', class: 'feed-act feed-hide', 'aria-label': 'Спрятать у себя',
    onclick: (e) => { e.stopPropagation(); hide(key); draw(); fresh(); toast('Спрятано у тебя. Вернуть — внизу «Спрятанные»'); },
  }, '🙈');
}

function replyBtn(it) {
  return h('button', {
    type: 'button', class: 'feed-act feed-reply',
    onclick: (e) => { e.stopPropagation(); openReplyFor(it); },
  }, '↩ Ответить');
}

function inBubble(l) {
  const me = who();
  const chose = me.youOpened === 'открыла' ? 'выбрала' : 'выбрал';
  const gift = l.gift && l.gift.chosen != null ? l.gift.options[l.gift.chosen] : null;
  const it = { type: 'in', key: `l:${l.id}`, l };
  const text = h('p', { class: 'feed-text' }, l.text || '');
  const bubble = h('div', { class: `feed-bubble${l.opened ? '' : ' is-new'}` });
  const body = h('button', {
    type: 'button', class: 'feed-body', 'aria-expanded': 'false',
    onclick: () => {
      const open = bubble.classList.toggle('is-open');
      body.setAttribute('aria-expanded', String(open));
      // Відкрив тут — прочитано; лише за тапом, не за показом
      if (open && !l.opened) {
        l.opened = true;
        bubble.classList.remove('is-new');
        bubble.querySelector('.inbox-new')?.remove();
        send(`letters/${l.id}`, 'PUT', { opened: true }).catch(() => {});
        fresh();
      }
    },
  },
  h('span', { class: 'feed-meta' },
    h('span', {}, `${l.kind === 'date' ? '🎉' : '💌'} ${hhmm(l.at)}`),
    newMark(!l.opened),
    gift ? h('span', {}, `🎁 ты ${chose}: ${gift.emoji} ${gift.title}`) : null),
  l.text ? text : null);
  const like = h('button', {
    type: 'button', class: 'feed-act', 'aria-pressed': String(!!l.liked), 'aria-label': 'Сердечко',
    onclick: async (e) => {
      e.stopPropagation();
      const cur = liveLetter(l);
      const prev = cur.liked;
      cur.liked = !prev;
      draw();
      try { await send(`letters/${l.id}`, 'PUT', { liked: cur.liked, opened: true }); liveLetter(l).opened = true; } catch {
        liveLetter(l).liked = prev;
        draw();
        toast('Не сохранилось — нет связи');
      }
    },
  }, l.liked ? '❤️' : '🤍');
  // append, на відміну від h(), друкує null як текст — порожні відсіюємо
  bubble.append(...[body,
    l.reply ? h('p', { class: 'sent-reply' }, h('b', {}, 'Твой ответ: '), l.reply) : null,
    h('div', { class: 'feed-acts' }, like, l.reply ? null : replyBtn(it), hideBtn(it.key))].filter(Boolean));
  return bubble;
}

function outBubble(l, later) {
  const me = who();
  const e = (DATA.partnerEnvelopes || []).find((x) => x.id === l.env);
  const chose = me.partner === 'она' ? 'выбрала' : 'выбрал';
  const where = l.kind === 'gift'
    ? `🎁 ${(l.gift || []).map((o) => `${o.emoji} ${o.title}`).join(' / ')}`
    : l.kind === 'env' ? `${e ? e.emoji : '✉'} в конверт «${e ? e.label : '…'}»`
      : `${l.stocked ? '📦 из запаса ·' : '➶'} ${hhmm(later ? l.created : l.at)}`;
  let state;
  if (l.kind === 'gift') state = l.chosen != null ? `${chose}: ${l.gift[l.chosen].emoji} ${l.gift[l.chosen].title}` : 'ждёт выбора';
  else if (l.kind === 'morning' && later) state = `ждёт утра · ${dayWord(l.at)} в ${hhmm(l.at)}`;
  else if (l.kind === 'date' && later) state = `🎂 ждёт · ${dayMonth(l.at)} в ${hhmm(l.at)}`;
  else if (l.opened) state = `${me.partnerOpened} ✓${l.liked ? ' · ❤️' : ''}`;
  else state = l.kind === 'env' ? 'лежит в конверте' : `ещё не ${me.partnerOpened}`;

  const bubble = h('div', { class: 'feed-bubble' });
  const take = l.opened ? null : h('button', {
    type: 'button', class: 'sent-take',
    onclick: async (ev) => {
      ev.stopPropagation();
      if (!confirm('Забрать письмо? Оно исчезнет, будто его не было.')) return;
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
    l.text ? h('p', { class: 'feed-text', onclick: () => bubble.classList.toggle('is-open') }, l.text) : null,
    h('p', { class: 'feed-meta' }, h('span', {}, `${where} · ${state}`)),
    l.reply ? h('p', { class: `sent-reply${isNew ? ' is-fresh' : ''}`, 'data-replied': l.replied || 0 },
      h('b', {}, `${cap(me.partner)} ответил${me.partner === 'она' ? 'а' : ''}: `), l.reply, newMark(isNew)) : null,
    h('div', { class: 'feed-acts' }, take, hideBtn(`l:${l.id}`))].filter(Boolean));
  return bubble;
}

function memeBubble(m) {
  const me = who();
  const it = { type: 'meme', key: `m:${m.id}`, m };
  const over = m.caption && m.style ? h('span', { class: `meme-over is-${m.style}`, 'aria-hidden': 'true' }, m.caption) : null;
  const pic = h('button', {
    type: 'button', class: 'meme-img feed-pic', 'data-id': m.id, 'data-url': m.url || '', 'aria-label': 'Открыть мемчик на весь экран',
    onclick: () => showMeme(m, pic),
  }, media(m.url, m.caption || 'Мемчик'), over);
  const isNew = m.mine ? (m.replied || 0) > seenAt.replies : m.created > seenAt.memes;
  let acts;
  if (m.mine) {
    acts = [
      m.reaction ? h('span', { class: 'meme-their' }, `${cap(me.partner)}: ${m.reaction}`) : null,
      h('button', { type: 'button', class: 'feed-act', 'aria-label': 'Удалить мемчик у обоих', onclick: () => removeMeme(m) }, '🗑'),
    ];
  } else {
    acts = [
      ...REACTIONS.map((r) => h('button', {
        type: 'button', class: 'feed-act', 'aria-pressed': String(m.reaction === r),
        'aria-label': r === '😂' ? 'Смешно' : 'Нравится', onclick: () => react(m, r),
      }, r)),
      m.reply ? null : replyBtn(it),
    ];
  }
  const replyLine = m.reply
    ? h('p', { class: `sent-reply${m.mine && isNew ? ' is-fresh' : ''}`, 'data-replied': m.replied || 0 },
      h('b', {}, m.mine ? `${cap(me.partner)} ответил${me.partner === 'она' ? 'а' : ''}: ` : 'Твой ответ: '), m.reply, newMark(m.mine && isNew))
    : null;
  return h('div', { class: `feed-bubble feed-meme${!m.mine && isNew ? ' is-fresh' : ''}`, 'data-created': m.created },
    pic,
    m.caption && !over ? h('p', { class: 'meme-cap' }, m.caption) : null,
    replyLine,
    h('div', { class: 'feed-acts' },
      h('span', { class: 'feed-meta' }, `🖼 ${hhmm(m.created)}`, newMark(!m.mine && isNew)),
      ...acts, hideBtn(it.key)));
}

async function react(m0, r) {
  const m = liveMeme(m0);
  const prev = m.reaction;
  m.reaction = prev === r ? null : r;
  draw();
  try {
    await send(`memes/${m.id}`, 'PUT', { reaction: m.reaction });
  } catch {
    liveMeme(m0).reaction = prev;
    draw();
    toast('Не сохранилось — нет связи');
  }
}

async function removeMeme(m) {
  if (!confirm('Удалить этот мемчик у обоих?')) return;
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
  const quote = it.type === 'meme' ? (it.m.caption || 'на мемчик') : (it.l.text || '');
  replySheet(quote, async (text) => {
    await send(target.path, 'PUT', { reply: text });
    const cur = it.type === 'in' ? liveLetter(target.obj) : liveMeme(target.obj);
    cur.reply = text;
    if (it.type === 'in') cur.opened = true;
    draw();
    fresh();
  });
}

// Шторка відповіді: цитата, поле, «Отправить»; onSend кидає помилку — шторка лишається з текстом
function replySheet(quote, onSend) {
  const area = h('textarea', { 'data-voice': true, 'aria-label': 'Текст ответа', placeholder: 'Пару слов в ответ…' });
  const close = () => { sheet.remove(); backdrop.remove(); };
  const go = h('button', { type: 'button', class: 'btn btn-primary', html: `${ARROW}Отправить` });
  go.addEventListener('click', async () => {
    const text = area.value.trim();
    if (!text) { area.focus(); return; }
    go.disabled = true;
    try {
      await onSend(text);
      close();
      toast('Отправлено ➶');
    } catch {
      go.disabled = false;
      toast('Не отправилось — проверь интернет');
    }
  });
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ответ' },
    h('div', { class: 'sheet-inner' },
      h('h2', {}, 'Ответ'),
      quote ? h('p', { class: 'feed-quote' }, quote.length > 140 ? `${quote.slice(0, 140)}…` : quote) : null,
      area,
      h('div', { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'btn', onclick: close }, 'Отмена'),
        go)));
  document.body.append(backdrop, sheet);
  area.focus();
}

// Мемчик на весь екран: та сама картинка чи відео з підписом поверх
function showMeme(m, pic) {
  const src = pic.querySelector('img, video')?.src;
  if (!src) return;
  const close = () => { view.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const el = media(m.url, m.caption || 'Мемчик', src);
  const view = h('div', { class: 'photo-view feed-full', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Мемчик', onclick: close },
    h('div', { class: 'feed-full-frame' }, el,
      m.caption && m.style ? h('span', { class: `meme-over is-${m.style}`, 'aria-hidden': 'true' }, m.caption) : null),
    m.caption && !m.style ? h('p', { class: 'feed-full-cap' }, m.caption) : null,
    h('button', { type: 'button', class: 'photo-view-close', 'aria-label': 'Закрыть' }, '✕'));
  document.addEventListener('keydown', onKey);
  document.body.append(view);
  view.querySelector('.photo-view-close').focus();
}

// Картинки тягнемо, коли пузир під'їжджає до екрана; нове гасне, коли його справді побачили
function watchFresh(list) {
  const io = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      io.unobserve(target);
      loadPic(target);
    }
  }, { rootMargin: '300px 0px' });
  list.querySelectorAll('.meme-img').forEach((el) => io.observe(el));
  const seenIo = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) { seenIo.unobserve(target); seen(target); }
    }
  // Низ екрана закриває меню з марками — під ним ще не «побачено»
  }, { threshold: 0.6, rootMargin: '0px 0px -96px 0px' });
  list.querySelectorAll('.feed-meme.is-fresh, .sent-reply.is-fresh').forEach((el) => seenIo.observe(el));
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
export function swipeable(row, bubble, { onLeft, onRight, canRight = () => true, place = '' }) {
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
    // Вправо без можливості відповісти — лише пружинить
    const d = dx > 0 && !canRight() ? Math.min(dx, 60) * 0.35 : dx;
    bubble.style.transform = `translateX(${d}px)`;
    row.dataset.swipe = d < -SWIPE ? 'hide' : d > SWIPE ? 'reply' : d < -20 ? 'hide-soon' : d > 20 ? 'reply-soon' : '';
  });
  const end = () => {
    if (x0 == null) return;
    x0 = null;
    if (mode !== 'x') return;
    // Після перетягування клік не має відкрити/натиснути те, що під пальцем
    const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    bubble.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => bubble.removeEventListener('click', stop, { capture: true }), 300);
    const go = dx < -SWIPE ? onLeft : dx > SWIPE && canRight() ? onRight : null;
    reset();
    if (go && place) learn(place);
    go?.();
  };
  bubble.addEventListener('pointerup', end);
  bubble.addEventListener('pointercancel', () => { x0 = null; reset(); });
}
