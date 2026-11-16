// Старт: ключ → дані з сервера → екрани; без ключа — замок
import { DATA, who } from './data.js';
import { get, save, getKey, takeKeyFromUrl } from './api.js';
import { mascotImg, petName, petFor, loadPets } from './icons.js';
import { h, toast, cap, reduceMotion, SAGITTARIUS, ARROW } from './ui.js';
import { renderEnvelopes } from './envelopes.js';
import { renderTogether } from './together.js';
import { maybeWelcome } from './welcome.js';
import { showLock } from './lock.js';

const screen = document.getElementById('screen');

const POCKET = `<svg viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><path class="pocket" d="M0 2 150 106 300 2V200H0z"/><path class="pocket-fold" d="M0 200 130 116M300 200 170 116"/></svg>`;

let tab = 'letter';

// Стан листа дня { date, opened, liked, reply } — свій у кожного, новий лист починає з нуля
function letterState() {
  const s = DATA.mine.letter;
  return s && s.date === DATA.letter.date ? s : { date: DATA.letter.date };
}

function setLetterState(patch) {
  DATA.mine.letter = { ...letterState(), ...patch };
  save('mine', { letter: DATA.mine.letter });
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
    h('span', { class: 'seal', 'aria-hidden': 'true', html: SAGITTARIUS }));
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
  else if (tab === 'together') renderTogether(screen);
  else if (tab === 'memes') {
    const pet = petFor('memes');
    renderEmpty('Мемчики', `Скоро ${petName(pet)} будет носить сюда мемчики. Пока тренируется.`, pet);
  } else renderEmpty('Шкатулка', 'Здесь будут собираться все письма — чтобы перечитывать любимые.', petFor('box'));
}

// Половину визначає ключ: її ключ — лаванда, його — космос
function applySide() {
  document.documentElement.dataset.side = DATA.side;
  document.querySelector('meta[name="theme-color"]').content = DATA.side === 'vin' ? '#0B384B' : '#EADFFB';
}

document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    tab = t.dataset.tab;
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('is-active', x === t));
    render();
  });
});

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
  document.body.classList.remove('is-booting');
  applySide();
  render();
  maybeWelcome();
}

takeKeyFromUrl();
start();
