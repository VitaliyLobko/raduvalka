// Старт: ключ → дані з сервера → екрани; без ключа — замок
import { DATA, who } from './data.js';
import { get, save, getKey, setKey, takeKeyFromUrl } from './api.js';
import { VERSION, NEWS } from './version.js';
import { mascotImg, petName, petFor, loadPets } from './icons.js';
import { openWrite } from './write.js';
import { h, toast, cap, reduceMotion, SAGITTARIUS, ARROW, waxSeal, SAGITTARIUS_GLYPH, QUILL_GLYPH } from './ui.js';
import { renderEnvelopes } from './envelopes.js';
import { renderTogether, chipLabel } from './together.js';
import { renderMemes, refreshMemes, markBadge, composeMeme } from './memes.js';
import { maybeWelcome } from './welcome.js';
import { showLock } from './lock.js';

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
  const fresh = !!DATA.letter && !letterState().opened;
  document.querySelector('.tab[data-tab="letter"]')?.classList.toggle('has-new', fresh);
}

// Push ще нема: свіжий лист і мемчики дотягуємо при поверненні в застосунок
async function refreshLetter() {
  try {
    const { letter } = await get('letter');
    if (letter?.id !== DATA.letter?.id || letter?.text !== DATA.letter?.text) {
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
  if (!DATA.mascots[letter.mascot]) return null;
  return h('div', { class: 'courier' },
    h('span', { class: 'mascot', html: mascotImg(letter.mascot) }),
    h('p', { class: 'bubble' }, h('b', {}, `${petName(letter.mascot)}: `), letter.mascotLine));
}

function renderLetter() {
  const { letter } = DATA;
  if (!letter) {
    renderEmpty('Письмо', `${cap(who().partner)} ещё пишет письмо на сегодня. Загляни чуть позже.`, petFor('push'));
    return;
  }
  const st = letterState();

  const head = [
    h('p', { class: 'day' }, dayLabel(letter.date)),
    h('h2', { class: 'title' }, st.opened ? 'Письмо для тебя' : 'Тебе письмо 💌'),
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
      courier(letter)));
    return;
  }

  // replaceChildren не пропускає null, на відміну від h()
  screen.replaceChildren(...[
    ...head,
    h('article', { class: 'letter' },
      h('p', { class: 'letter-text' }, letter.text),
      h('p', { class: 'letter-sign', html: `${who().from} <span class="sign-arrow">${SAGITTARIUS}</span>` })),
    h('div', { class: 'actions' },
      h('button', {
        type: 'button',
        class: 'btn btn-heart',
        'aria-pressed': String(!!st.liked),
        onclick: toggleHeart,
      }, h('span', { class: 'heart', 'aria-hidden': 'true' }, st.liked ? '❤️' : '🤍'), st.liked ? 'Нравится' : 'Сердечко'),
      st.reply ? null : h('button', { type: 'button', class: 'btn btn-primary', onclick: openReply }, 'Ответить')),
    st.reply ? h('div', { class: 'reply-sent' }, h('span', {}, 'Твой ответ'), st.reply) : null,
  ].filter(Boolean));
}

function openEnvelope(env) {
  const done = () => {
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
  const area = h('textarea', { id: 'reply-text', 'aria-label': 'Текст ответа', placeholder: 'Пару слов в ответ…' });
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

function renderEmpty(title, text, mascot) {
  screen.replaceChildren(h('div', { class: 'empty' },
    mascot ? h('span', { class: 'mascot', html: mascotImg(mascot) }) : null,
    h('h2', {}, title),
    h('p', {}, text)));
}

function render() {
  if (tab === 'letter') renderLetter();
  else if (tab === 'envelopes') renderEnvelopes(screen);
  else if (tab === 'memes') {
    // Показуємо, що вже є, і одразу дотягуємо свіже (push поки немає)
    renderMemes(screen);
    refreshMemes().then((changed) => { if (changed && tab === 'memes') renderMemes(screen); });
  } else renderEmpty('Шкатулка', 'Здесь будут собираться все письма — чтобы перечитывать любимые.', petFor('box'));
}

// Половину визначає ключ: її ключ — лаванда, його — космос
function applySide() {
  document.documentElement.dataset.side = DATA.side;
  document.querySelector('meta[name="theme-color"]').content = DATA.side === 'vin' ? '#0B384B' : '#EADFFB';
}

function selectTab(name) {
  tab = name;
  if (name === 'letter') refreshLetter();
  document.querySelectorAll('.tab').forEach((x) => {
    const on = x.dataset.tab === name;
    x.classList.toggle('is-active', on);
    if (on) x.setAttribute('aria-current', 'page');
    else x.removeAttribute('aria-current');
  });
  render();
}

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => selectTab(t.dataset.tab)));

// «Поделиться → Радовалка»: service worker поклав картинку в кеш і відкрив ?go=shared.
// Забираємо лише після входу — якщо замок, картинка чекає в кеші
async function takeShared() {
  if (new URLSearchParams(location.search).get('go') !== 'shared') return;
  history.replaceState(null, '', location.pathname);
  let file = null;
  let none = false;
  try {
    const cache = await caches.open('shared-radovalka');
    const res = await cache.match('shared');
    none = !!(await cache.match('shared-none'));
    if (res) {
      const blob = await res.blob();
      file = new File([blob], 'shared', { type: blob.type || 'image/jpeg' });
    }
    await cache.delete('shared');
    await cache.delete('shared-none');
  } catch { /* кешу нема — нема й картинки */ }
  selectTab('memes');
  if (file) composeMeme(file, () => selectTab('memes'));
  else if (none) toast('Сюда можно поделиться только картинкой');
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
  const sheet = h('div', { class: 'sheet sheet-together', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Вместе' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    body);
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  renderTogether(body);
}

chip.addEventListener('click', openTogether);

document.getElementById('write-btn').addEventListener('click', openWrite);
document.querySelector('.nav-seal-wax').innerHTML = waxSeal(QUILL_GLYPH);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !getKey() || document.body.classList.contains('is-booting')) return;
  refreshLetter();
  refreshMemes().then((changed) => {
    markBadge();
    if (changed && tab === 'memes') renderMemes(screen);
  });
});

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
  const logout = () => {
    if (!confirm('Выйти на этом телефоне? Чтобы вернуться, понадобится твоя личная ссылка.')) return;
    setKey(null);
    location.replace(location.pathname);
  };
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-together sheet-about', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'О Радовалке' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    h('div', { class: 'sheet-inner' },
      h('h2', { class: 'title' }, 'Радовалка'),
      h('p', { class: 'about-version' }, `Версия ${VERSION}`),
      h('h3', {}, 'Что нового'),
      h('ul', { class: 'news' }, ...NEWS.map(([v, text]) => h('li', {}, h('b', {}, v), h('span', {}, text)))),
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
  markBadge();
  markLetter();
  render();
  maybeWelcome();
  takeShared();
}

registerWorker();
takeKeyFromUrl();
start();
