// «Відкрий, коли…»: полиця конвертів на різні випадки
import { DATA, who } from './data.js';
import { save, send } from './api.js';
import { mascotImg, petName } from './icons.js';
import { h, toast, cap, waxSeal, reduceMotion, signLine } from './ui.js';

// Скільки листів уже прочитано в кожному конверті: { hard: 1 } — зберігається на сервері
const seen = () => (DATA.mine.seen ||= {});

const left = (env) => Math.max(0, env.notes.length - (seen()[env.id] || 0));

// Хто приносить конверт: основний кур'єр або варіант із env.looks [{ mascot, pose, line }].
// Міняється раз на добу (за місцевою датою), конверти — не всі разом
function look(env) {
  const own = { mascot: env.mascot, pose: env.pose, line: env.mascotLine };
  const all = [own, ...(env.looks || [])].filter((l) => DATA.mascots[l.mascot]);
  if (!all.length) return own;
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
  const salt = [...String(env.id)].reduce((s, c) => s + c.charCodeAt(0), 0);
  const pick = all[(day + salt) % all.length];
  return { ...pick, line: pick.line || env.mascotLine };
}

function courier(env, line) {
  const l = look(env);
  return h('div', { class: 'courier' },
    h('span', { class: 'mascot', html: mascotImg(l.mascot, l.pose) }),
    h('p', { class: 'bubble' }, h('b', {}, `${petName(l.mascot)}: `), line || l.line));
}

// Кишеня конверта: бічні й нижній клини зі згинами — як у великого конверта листа
const POCKET = '<svg viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><path class="me-pocket" d="M0 0 150 112 300 0V200H0z"/>'
  + '<path class="me-fold" d="M0 200 132 122M300 200 168 122"/></svg>';
// Три кольори паперу по черзі й легкий нахил — наче конверти розклали на столі
// Клапан — SVG: свій край зі згином і тінь, щоб не зливався з кишенею
const FLAP = '<svg viewBox="0 0 300 112" preserveAspectRatio="none" aria-hidden="true"><path class="me-flap-fill" d="M0 0H300L150 112Z"/>'
  + '<path class="me-flap-edge" d="M0 1 150 111 300 1"/></svg>';
const TINTS = ['--lavender', '--powder', '--cream'];
const TILTS = [-2.5, 1.8, 1.2, -2];

export function renderEnvelopes(screen) {
  let opening = false;
  const cards = DATA.envelopes.map((env, i) => {
    const n = left(env);
    const card = h('button', {
      type: 'button',
      class: `env-card${n ? '' : ' is-empty'}`,
      style: `--tint: var(${TINTS[i % TINTS.length]}); --tilt: ${TILTS[i % TILTS.length]}deg`,
      'aria-label': `Открой, когда ${env.label}. ${n ? `Писем: ${n}` : 'Пусто'}`,
      onclick: () => {
        if (opening) return;
        // Спершу конверт відкривається на полиці, тоді — читання
        if (!n || reduceMotion) { openCard(screen, env); return; }
        opening = true;
        card.classList.add('is-opening');
        setTimeout(() => openCard(screen, env), 520);
      },
    },
    h('span', { class: 'mini-env', 'aria-hidden': 'true' },
      h('span', { class: 'me-back' }),
      ...Array.from({ length: Math.min(n, 3) }, (_, k) => h('span', { class: 'me-paper', style: `--k: ${k}` })),
      h('span', { class: 'me-front', html: POCKET }),
      h('span', { class: 'me-flap', html: FLAP }),
      h('span', { class: 'me-seal', html: waxSeal('') }, h('span', { class: 'me-emoji' }, env.emoji))),
    h('span', { class: 'env-label' }, env.label),
    h('span', { class: 'env-meta' }, n ? `${n} ${plural(n)}` : 'пусто'),
    env.signal && DATA.partnerPush ? h('span', { class: 'env-signal' }, `${cap(who().partner)} узнает, когда откроешь`) : null);
    return card;
  });

  screen.replaceChildren(
    h('h2', { class: 'title' }, 'Открой, когда…'),
    h('div', { class: 'env-grid' }, ...cards));
}

function plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'письмо';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'письма';
  return 'писем';
}

function openCard(screen, env) {
  const me = who();
  const n = left(env);
  let reader;
  const close = () => { reader.cleanup(); reader.remove(); renderEnvelopes(screen); };

  if (!n) {
    // Другому летить push «конверт порожній»; «узнает» — лише якщо йому справді є куди його надіслати
    const text = h('p', { class: 'letter-text' }, 'Записок пока нет ✍️');
    reader = overlay(close,
      courier(env, 'Тут пока пусто.'),
      h('div', { class: 'letter letter-empty' }, text),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: close }, 'Хорошо')));
    send(`envelopes/${env.id}/empty`, 'POST').then((r) => { if (r?.reaches) text.textContent = me.partnerKnows; }).catch(() => {});
    return;
  }

  const read = seen()[env.id] || 0;
  // Записка із заготовки — рядок; дописана в застосунку — { id, text }, і відправник побачить, що її відкрили
  const note = env.notes[read];
  const text = typeof note === 'string' ? note : note.text;
  seen()[env.id] = read + 1;
  save('mine', { seen: seen() });
  if (note.id) save(`letters/${note.id}`, { opened: true });

  let liked = false;
  const heart = h('button', {
    type: 'button',
    class: 'btn btn-heart',
    'aria-pressed': 'false',
    onclick: () => {
      liked = !liked;
      if (note.id) save(`letters/${note.id}`, { liked });
      heart.setAttribute('aria-pressed', String(liked));
      heart.replaceChildren(h('span', { class: 'heart', 'aria-hidden': 'true' }, liked ? '❤️' : '🤍'), liked ? 'Нравится' : 'Сердечко');
      // Сердечко бачить лише записка, дописана в застосунку; заготовка його нікуди не передає
      if (liked && note.id) toast(`${cap(me.partner)} увидит твоё ❤️`);
    },
  }, h('span', { class: 'heart', 'aria-hidden': 'true' }, '🤍'), 'Сердечко');

  reader = overlay(close,
    courier(env),
    h('article', { class: 'letter' },
      h('p', { class: 'letter-kind' }, `${env.emoji} Открой, когда ${env.label}`),
      h('p', { class: 'letter-text' }, text),
      signLine(DATA.partnerSign, me.from)),
    h('div', { class: 'actions' },
      heart,
      h('button', { type: 'button', class: 'btn btn-primary', onclick: close }, 'Закрыть')));

  // Конверт-сигнал: другому push «відкрила»; тост — лише коли йому справді є куди його надіслати
  if (env.signal) {
    send(`envelopes/${env.id}/opened`, 'POST')
      .then((r) => { if (r?.reaches) toast(`${cap(me.partner)} узнает, что ты ${me.youOpened} этот конверт 💜`); })
      .catch(() => {});
  }
}

// Закривається тапом будь-де поза самим листом, реплікою, улюбленцем і кнопками, а також Esc
function overlay(close, ...children) {
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const reader = h('div', {
    class: 'reader',
    role: 'dialog',
    'aria-modal': 'true',
    onclick: (e) => { if (!e.target.closest('.letter, .bubble, .mascot, .btn')) close(); },
  }, h('div', { class: 'reader-inner' }, ...children));
  reader.cleanup = () => document.removeEventListener('keydown', onKey);
  document.addEventListener('keydown', onKey);
  document.body.append(reader);
  reader.querySelector('.btn-primary').focus();
  return reader;
}
