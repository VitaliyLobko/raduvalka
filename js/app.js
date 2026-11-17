// Старт: ключ → дані з сервера → екрани; без ключа — замок
import { DATA, who } from './data.js';
import { get, save, getKey, setKey, getAltKey, swapKeys, takeKeyFromUrl, rememberSide } from './api.js';
import { VERSION, NEWS } from './version.js';
import { mascotImg, petName, petFor, loadPets } from './icons.js';
import { openWrite } from './write.js';
import { letterFeed, refreshFeed, invalidateFeed, feedFresh, isHidden, hide, dayKey, swipeable } from './feed.js';
import { renderGift } from './gift.js';
import { renderWishes, loadWishes, wishFromShare, linkIn, markWishes } from './wishes.js';
import { h, toast, cap, reduceMotion, SAGITTARIUS, ARROW, waxSeal, SAGITTARIUS_GLYPH, QUILL_GLYPH, sky } from './ui.js';
import { renderEnvelopes } from './envelopes.js';
import { renderTogether, chipLabel } from './together.js';
import { loadPlans, markPlans, renderPlans } from './plans.js';
import { composeMeme } from './memes.js';
import { maybeWelcome } from './welcome.js';
import { showLock } from './lock.js';
import { pushAsk, pushPanel, syncPush, disablePush } from './push.js';
import { initBack, tabChanged, leave } from './back.js';
import { initVoice } from './voice.js';

// Небо його половини — під усім, фіксоване; на її половині сховане стилем
document.body.prepend(sky(46, 3, 'sky-page'));

const screen = document.getElementById('screen');

const POCKET = `<svg viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><path class="pocket" d="M0 2 150 106 300 2V200H0z"/><path class="pocket-fold" d="M0 200 130 116M300 200 170 116"/></svg>`;

let tab = 'letter';

// Стан листа дня { opened, liked, reply }. Лист із застосунку тримає стан у собі на сервері —
// так відправник бачить «відкрила», ❤️ і відповідь. Лист-заготовка — у mine, за датою
function letterState() {
  const l = DATA.letter;
  if (l.id) return { opened: l.opened, liked: l.liked, reply: l.reply };
  const s = DATA.mine.letter;
  return s && s.date === l.date ? s : { date: l.date };
}

function setLetterState(patch) {
  const l = DATA.letter;
  if (l.id) {
    Object.assign(l, patch);
    save(`letters/${l.id}`, patch);
  } else {
    DATA.mine.letter = { ...letterState(), ...patch };
    save('mine', { letter: DATA.mine.letter });
  }
  markLetter();
}

// Прочитаний лист — коротка картка на 3 рядки; цілим — щойно з конверта або після тапу, до перезапуску
const letterKey = () => DATA.letter.id || DATA.letter.date;
let expanded = null;
const setExpanded = (on) => { expanded = on ? letterKey() : null; render(); };

// Лист із застосунку: дата — з часу показу за годинником телефона, репліка кур'єра — за родом
function prepLetter(l) {
  if (l?.at) {
    const d = new Date(l.at);
    l.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (l?.mascot && !l.mascotLine && DATA.mascots[l.mascot]) {
    l.mascotLine = DATA.mascots[l.mascot].g === 'f' ? 'Принесла тебе письмо. Бежала со всех лап 💌' : 'Принёс тебе письмо. Нёс бережно 💌';
  }
  return l;
}

// Сургучна крапка на марці «Письмо», поки свіжий лист не відкрито
function markLetter() {
  const day = !!DATA.letter && !isHidden(dayKey()) && !letterState().opened;
  const fresh = !!DATA.gift || day || feedFresh() > 0;
  document.querySelector('.tab[data-tab="letter"]')?.classList.toggle('has-new', fresh);
}

// Push ще нема: свіжий лист і мемчики дотягуємо при поверненні в застосунок
async function refreshLetter() {
  try {
    const { letter, gift } = await get('letter');
    // Підарунок на екрані вже обирають — не перемальовуємо з-під пальця
    const giftChanged = gift?.id !== DATA.gift?.id && !document.querySelector('.gift-card.is-chosen');
    if (giftChanged) DATA.gift = gift;
    if (giftChanged || letter?.id !== DATA.letter?.id || letter?.text !== DATA.letter?.text) {
      DATA.letter = prepLetter(letter);
      markLetter();
      if (tab === 'letter') render();
    }
  } catch { /* нема зв'язку — лишаємо, що є */ }
}

function dayLabel(iso) {
  const s = new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(iso + 'T12:00'));
  return s[0].toUpperCase() + s.slice(1);
}

function courier(letter) {
  // Лист до особливої дати несуть усі разом, у святкових позах (де вони є)
  if (letter.special) {
    return h('div', { class: 'courier courier-all' },
      h('span', { class: 'mascots' }, ...Object.keys(DATA.mascots).map((k) => h('span', { class: 'mascot', html: mascotImg(k, 'festive') }))),
      h('p', { class: 'bubble' }, 'Мы принесли всей командой — сегодня особенный день! 🎉'));
  }
  if (!DATA.mascots[letter.mascot]) return null;
  return h('div', { class: 'courier' },
    h('span', { class: 'mascot', html: mascotImg(letter.mascot) }),
    h('p', { class: 'bubble' }, h('b', {}, `${petName(letter.mascot)}: `), letter.mascotLine));
}

// Відкритий лист: кур'єр лишається поруч, менший; без кур'єра в листі — той, хто зазвичай приносить
const READ_LINES = ['Ответишь? Я отнесу 💌', 'Я рядом, пока читаешь.', 'Перечитывай сколько хочешь.'];
function readCourier(letter) {
  const pet = DATA.mascots[letter.mascot] ? letter.mascot : petFor('push');
  if (!pet) return null;
  const line = READ_LINES[new Date().getDate() % READ_LINES.length];
  return h('div', { class: 'courier courier-read' },
    h('span', { class: 'mascot', html: mascotImg(pet) }),
    h('p', { class: 'bubble' }, h('b', {}, `${petName(pet)}: `), line));
}

function renderLetter() {
  // Подарунок, що чекає вибору, — першим; після «Ура!» видно звичайний лист дня
  if (DATA.gift) {
    renderGift(screen, DATA.gift, () => { DATA.gift = null; markLetter(); render(); });
    return;
  }
  const { letter } = DATA;
  // Лист дня сховано свайпом — лишається переписка; повернути — у «Спрятанные»
  if (letter && isHidden(dayKey())) {
    screen.replaceChildren(h('p', { class: 'day' }, dayLabel(letter.date)), h('h2', { class: 'title' }, 'Письма'), pushAsk(), letterFeed(render));
    return;
  }
  if (!letter) {
    renderEmpty('Письмо', `${cap(who().partner)} ещё пишет письмо на сегодня. Загляни чуть позже.`, petFor('push'), 'guilty');
    screen.append(pushAsk(), letterFeed(render));
    return;
  }
  const st = letterState();
  const full = expanded === letterKey();

  const head = [
    h('p', { class: 'day' }, dayLabel(letter.date)),
    h('h2', { class: 'title' }, letter.special ? 'Праздничное письмо 🎉' : st.opened ? 'Письмо для тебя' : 'Тебе письмо 💌'),
  ];

  if (!st.opened) {
    const env = h('button', {
      type: 'button',
      class: 'envelope',
      'aria-label': 'Открыть письмо',
      onclick: () => openEnvelope(env),
    },
    h('span', { class: 'env-back' }),
    h('span', { class: 'paper-peek' }),
    h('span', { class: 'env-front', html: POCKET }),
    h('span', { class: 'env-flap' }),
    h('span', { class: 'seal', 'aria-hidden': 'true', html: waxSeal(SAGITTARIUS_GLYPH) }));
    screen.replaceChildren(...head, h('div', { class: 'stage' },
      env,
      h('p', { class: 'hint' }, 'Коснись печати, чтобы открыть'),
      courier(letter)), pushAsk(), letterFeed(render));
    return;
  }

  // replaceChildren не пропускає null, на відміну від h()
  screen.replaceChildren(...[
    ...head,
    h('article', {
      class: `letter${letter.special ? ' is-special' : ''}${full ? '' : ' is-compact'}`,
      ...(full ? {} : {
        role: 'button',
        tabindex: '0',
        'aria-label': 'Прочитать письмо целиком',
        onclick: () => setExpanded(true),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(true); } },
      }),
    },
      h('p', { class: 'letter-text' }, letter.text),
      h('p', { class: 'letter-sign', html: `${who().from} <span class="sign-arrow">${SAGITTARIUS}</span>` })),
    h('div', { class: 'actions' },
      h('button', {
        type: 'button',
        class: 'btn btn-heart',
        'aria-pressed': String(!!st.liked),
        'aria-label': 'Сердечко',
        onclick: toggleHeart,
      }, h('span', { class: 'heart', 'aria-hidden': 'true' }, st.liked ? '❤️' : '🤍'), full ? (st.liked ? 'Нравится' : 'Сердечко') : null),
      st.reply ? null : h('button', { type: 'button', class: 'btn btn-primary', onclick: openReply }, 'Ответить'),
      h('button', {
        type: 'button',
        class: 'btn btn-fold',
        'aria-expanded': String(full),
        onclick: () => { setExpanded(!full); if (full) window.scrollTo({ top: 0 }); },
      }, full ? '▴ Свернуть' : '▾ Целиком')),
    st.reply && full ? h('div', { class: 'reply-sent' }, h('span', {}, 'Твой ответ'), st.reply) : null,
    letter.special ? null : readCourier(letter),
    pushAsk(),
    letterFeed(render),
  ].filter(Boolean));
  // Свайп листа дня: вліво — сховати (лишиться в стрічці), вправо — відповісти
  const card = screen.querySelector('article.letter');
  swipeable(card, card, {
    canRight: () => !letterState().reply,
    onLeft: () => {
      hide(dayKey());
      markLetter();
      render();
      toast('Письмо дня спрятано. Вернуть — внизу «Спрятанные»');
    },
    onRight: openReply,
  });
  // Згасання знизу — лише коли текст справді обрізано, коротке письмо лишається чистим
  const text = screen.querySelector('.letter.is-compact .letter-text');
  if (text) text.classList.toggle('is-clamped', text.scrollHeight > text.clientHeight + 2);
}

function openEnvelope(env) {
  const done = () => {
    expanded = letterKey();
    setLetterState({ opened: true });
    render();
  };
  if (reduceMotion) return done();
  env.classList.add('is-opening');
  env.disabled = true;
  setTimeout(done, 1050);
}

function toggleHeart() {
  const liked = !letterState().liked;
  setLetterState({ liked });
  render();
  if (liked) toast(`${cap(who().partner)} увидит твоё ❤️`);
}

function openReply() {
  const area = h('textarea', { id: 'reply-text', 'data-voice': true, 'aria-label': 'Текст ответа', placeholder: 'Пару слов в ответ…' });
  const close = () => { sheet.remove(); backdrop.remove(); };
  const send = () => {
    const text = area.value.trim();
    if (!text) { area.focus(); return; }
    setLetterState({ reply: text });
    close();
    render();
    toast('Отправлено ➶');
  };
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'reply-title' },
    h('div', { class: 'sheet-inner' },
      h('h2', { id: 'reply-title' }, 'Ответ'),
      area,
      h('div', { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'btn', onclick: close }, 'Отмена'),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: send, html: `${ARROW}Отправить` }))));
  document.body.append(backdrop, sheet);
  area.focus();
}

function renderEmpty(title, text, mascot, pose) {
  screen.replaceChildren(h('div', { class: 'empty' },
    mascot ? h('span', { class: 'mascot', html: mascotImg(mascot, pose) }) : null,
    h('h2', {}, title),
    h('p', {}, text)));
}

function render() {
  if (tab === 'letter') {
    renderLetter();
    // «Написать» — сургуч у куті вкладки «Письма» (раніше — посередині нижнього меню)
    screen.prepend(h('button', { type: 'button', class: 'write-seal', id: 'write-btn', onclick: openWrite },
      h('span', { class: 'write-seal-wax', 'aria-hidden': 'true', html: waxSeal(QUILL_GLYPH) }), 'Написать'));
  }
  else if (tab === 'envelopes') renderEnvelopes(screen);
  else if (tab === 'plans') {
    // Планы: збережене одразу, свіже — слідом (друга половина могла проголосувати чи додати)
    renderPlans(screen);
    loadPlans().then(() => { markPlans(); if (tab === 'plans') renderPlans(screen); }).catch(() => {});
  } else {
    // Хотелки: показуємо збережене й одразу дотягуємо свіже (друга половина могла дописати)
    const had = !!DATA.wishes;
    renderWishes(screen);
    if (had) loadWishes().then(() => { if (tab === 'wish') renderWishes(screen); }).catch(() => {});
  }
}

// Половину визначає ключ: її ключ — лаванда, його — космос
function applySide() {
  document.documentElement.dataset.side = DATA.side;
  document.querySelector('meta[name="theme-color"]').content = DATA.side === 'vin' ? '#0B384B' : '#EADFFB';
  // Встановлять застосунок у цій же сесії — заставка вже його кольору, не з першого завантаження
  document.querySelector('link[rel="manifest"]').href = DATA.side === 'vin' ? 'manifest-vin.webmanifest' : 'manifest.webmanifest';
  rememberSide(DATA.side);
}

// fromBack — вкладку повернула кнопка «Назад»: історію вже зсунув телефон
function selectTab(name, fromBack = false) {
  if (!fromBack) tabChanged(tab, name);
  tab = name;
  if (name === 'letter') { refreshLetter(); invalidateFeed(); }
  document.querySelectorAll('.tab').forEach((x) => {
    const on = x.dataset.tab === name;
    x.classList.toggle('is-active', on);
    if (on) x.setAttribute('aria-current', 'page');
    else x.removeAttribute('aria-current');
  });
  render();
}

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => selectTab(t.dataset.tab)));
initBack((name) => selectTab(name, true));
// 🎤 біля полів з data-voice — у шторках, що з'являються пізніше, теж
initVoice();
// Надіслав лист — «Мои» на вкладці «Письма» одразу з ним
document.addEventListener('radovalka:sent', () => { invalidateFeed(); if (tab === 'letter') render(); else refreshFeed(); });
// Тап по сповіщенню при відкритій Радовалці — на «Письма», свіже дотягне visibilitychange
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.go === 'letter' && tab !== 'letter') selectTab('letter'); });
// Стрічка дізналась про нове або його побачили — оновити крапку на марці
document.addEventListener('radovalka:fresh', markLetter);

// «Поделиться → Радовалка»: service worker поклав картинку в кеш і відкрив ?go=shared.
// Забираємо лише після входу — якщо замок, картинка чекає в кеші
async function takeShared() {
  if (new URLSearchParams(location.search).get('go') !== 'shared') return;
  history.replaceState(null, '', location.pathname);
  let file = null;
  let none = false;
  let link = '';
  try {
    const cache = await caches.open('shared-radovalka');
    const res = await cache.match('shared');
    none = !!(await cache.match('shared-none'));
    link = linkIn(await (await cache.match('shared-link'))?.text());
    if (res) {
      const blob = await res.blob();
      file = new File([blob], 'shared', { type: blob.type || 'image/jpeg' });
    }
    await Promise.all(['shared', 'shared-none', 'shared-link'].map((k) => cache.delete(k)));
  } catch { /* кешу нема — нема й картинки */ }
  if (link && !file) {
    selectTab('wish');
    wishFromShare(screen, link);
    return;
  }
  selectTab('letter');
  if (file) composeMeme(file, () => document.dispatchEvent(new CustomEvent('radovalka:sent')));
  else if (none) toast('Сюда можно поделиться картинкой или ссылкой на товар');
}

function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(() => { /* без нього просто не буде «Поделиться» */ });
}

// «Вместе» — значок у шапці; тап відкриває шторку з листівкою, датою зустрічі й списком
const chip = document.getElementById('together-chip');

function drawChip() {
  chip.querySelector('.chip-text').textContent = chipLabel();
  chip.setAttribute('aria-label', `Вместе: ${chipLabel()}`);
  chip.hidden = false;
  markPlans();
}

function openTogether() {
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    backdrop.remove();
    drawChip();
    chip.focus();
  };
  const body = h('div', { class: 'sheet-inner' });
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-together sheet-full', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Вместе' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    body);
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  renderTogether(body);
}

chip.addEventListener('click', openTogether);


// Рядок у шапці під логотипом: «є нова версія» / «оновилась». Нічого не перекриває, ✕ — сховати
function pill(text, onclick) {
  document.querySelector('.update-pill')?.remove();
  const bar = h('div', { class: 'update-pill', role: 'status' },
    h('button', { type: 'button', class: 'update-go', onclick: () => { bar.remove(); onclick(); } }, text),
    h('button', { type: 'button', class: 'update-x', 'aria-label': 'Скрыть', onclick: () => bar.remove() }, '✕'));
  document.querySelector('.top').append(bar);
}

// Після оновлення — один раз: «обновилась, що нового». Перший запуск на телефоні — лише запамʼятати версію
function noteUpdated() {
  let seen;
  try {
    seen = localStorage.getItem('radovalka:version');
    localStorage.setItem('radovalka:version', VERSION);
  } catch { return; }
  if (seen && seen !== VERSION) pill(`✨ Радовалка обновилась до ${VERSION} — что нового?`, openAbout);
}

// Оновитись насправді: GitHub Pages дозволяє браузеру тримати модулі 10 хв, і звичайний reload
// бере старі з кешу. Тож спершу перекачуємо з мережі сторінку й усі свої скрипти та стилі
// (cache: 'reload' заодно оновлює кеш браузера), а тоді перезавантажуємо
async function hardReload() {
  const own = performance.getEntriesByType('resource').map((e) => e.name)
    .filter((u) => u.startsWith(location.origin) && /\.(js|css|html)(\?|$)/.test(u));
  const urls = [...new Set([location.href.split('#')[0], ...own])];
  await Promise.race([
    Promise.allSettled(urls.map((u) => fetch(u, { cache: 'reload' }))),
    new Promise((ok) => setTimeout(ok, 8000)),
  ]);
  leave(() => location.reload());
}

// Застосунок довго відкритий у фоні: при поверненні дивимось, чи не вийшла нова версія
async function checkUpdate() {
  try {
    const text = await (await fetch('js/version.js', { cache: 'no-store' })).text();
    const v = text.match(/VERSION = '([^']+)'/)?.[1];
    if (v && v !== VERSION) pill(`Есть новая версия ${v} — обновить`, hardReload);
  } catch { /* немає звʼязку — перевіримо наступного разу */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !getKey() || document.body.classList.contains('is-booting')) return;
  checkUpdate();
  refreshLetter();
  // Конверти: нові записки — до наступного заходу на вкладку; відкритий екран не чіпаємо, щоб не збити читання
  get('envelopes').then((list) => { if (Array.isArray(list)) DATA.envelopes = list; }).catch(() => {});
  if (tab !== 'wish') loadWishes().then(markWishes).catch(() => {});
  loadPlans().then(markPlans).catch(() => {});
  // Стрічка перемальовує лише себе — відкритий лист дня не зсувається
  refreshFeed();
});

const newsList = (list) => h('ul', { class: 'news' }, ...list.map(([v, text]) => h('li', {}, h('b', {}, v), h('span', {}, text))));

// Тап по «Радовалка»: версія, що нового, вийти на цьому телефоні
function openAbout() {
  const btn = document.getElementById('about-btn');
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    backdrop.remove();
    btn.focus();
  };
  const logout = async () => {
    if (!confirm('Выйти на этом телефоне? Чтобы вернуться, понадобится твоя личная ссылка.')) return;
    // Без ключа телефон більше нічий — і сповіщення йому слати нікому
    await disablePush().catch(() => { /* сервер прибере підписку сам, коли push-сервіс відповість 410 */ });
    setKey(null);
    leave(() => location.replace(location.pathname));
  };
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-together sheet-about', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'О Радовалке' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    h('div', { class: 'sheet-inner' },
      h('h2', { class: 'title' }, 'Радовалка'),
      h('p', { class: 'about-version' }, `Версия ${VERSION}`),
      h('h3', {}, 'Что нового'),
      // Три свіжі версії на виду, решта — під «Ранее», щоб кнопки нижче не тонули
      newsList(NEWS.slice(0, 3)),
      NEWS.length > 3 ? h('details', { class: 'news-more' }, h('summary', {}, 'Ранее'), newsList(NEWS.slice(3))) : null,
      pushPanel(),
      getAltKey() ? h('button', {
        type: 'button',
        class: 'btn about-logout',
        onclick: () => { swapKeys(); leave(() => location.replace(location.pathname)); },
      }, DATA.side === 'vin' ? 'Переключиться на её половину' : 'Переключиться на его половину') : null,
      h('button', { type: 'button', class: 'btn about-logout', onclick: logout }, 'Выйти на этом телефоне')));
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey);
}

document.getElementById('about-btn').addEventListener('click', openAbout);

async function start() {
  if (!getKey()) {
    showLock(null, start);
    return;
  }
  try {
    Object.assign(DATA, await get('boot'));
    await loadPets();
  } catch (e) {
    showLock(e.status === 401 ? 'bad' : 'offline', start);
    return;
  }
  prepLetter(DATA.letter);
  document.body.classList.remove('is-booting');
  applySide();
  drawChip();
  loadWishes().then(markWishes).catch(() => {});
  loadPlans().then(markPlans).catch(() => {});
  markLetter();
  render();
  maybeWelcome();
  takeShared();
  syncPush();
  noteUpdated();
  checkUpdate();
}

registerWorker();
takeKeyFromUrl();
start();
