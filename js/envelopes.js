// «Відкрий, коли…»: полиця конвертів на різні випадки
import { DATA, who } from './data.js';
import { save } from './api.js';
import { mascotImg, petName } from './icons.js';
import { h, toast, cap, SAGITTARIUS } from './ui.js';

// Скільки листів уже прочитано в кожному конверті: { hard: 1 } — зберігається на сервері
const seen = () => (DATA.mine.seen ||= {});

const left = (env) => Math.max(0, env.notes.length - (seen()[env.id] || 0));

export function renderEnvelopes(screen) {
  const cards = DATA.envelopes.map((env, i) => {
    const n = left(env);
    return h('button', {
      type: 'button',
      class: `env-card${n ? '' : ' is-empty'}`,
      style: `--tint: var(${i % 2 ? '--powder' : '--lavender'})`,
      'aria-label': `Открой, когда ${env.label}. ${n ? `Писем: ${n}` : 'Пусто'}`,
      onclick: () => openCard(screen, env),
    },
    h('span', { class: 'mini-env', 'aria-hidden': 'true' },
      h('span', { class: 'mini-seal' }, env.emoji)),
    h('span', { class: 'env-label' }, env.label),
    h('span', { class: 'env-meta' }, n ? `${n} ${plural(n)}` : 'пусто'),
    env.signal ? h('span', { class: 'env-signal' }, `${cap(who().partner)} узнает, когда откроешь`) : null);
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
    reader = overlay(close,
      h('div', { class: 'courier' },
        h('span', { class: 'mascot', html: mascotImg(env.mascot, env.pose) }),
        h('p', { class: 'bubble' }, h('b', {}, `${petName(env.mascot)}: `), 'Тут пока пусто.')),
      h('div', { class: 'letter letter-empty' }, h('p', { class: 'letter-text' }, me.partnerWrites)),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: close }, 'Хорошо')));
    toast(`${cap(me.partner)} получит напоминание дописать`);
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
      if (liked) toast(`${cap(me.partner)} увидит твоё ❤️`);
    },
  }, h('span', { class: 'heart', 'aria-hidden': 'true' }, '🤍'), 'Сердечко');

  reader = overlay(close,
    h('div', { class: 'courier' },
      h('span', { class: 'mascot', html: mascotImg(env.mascot, env.pose) }),
      h('p', { class: 'bubble' }, h('b', {}, `${petName(env.mascot)}: `), env.mascotLine)),
    h('article', { class: 'letter' },
      h('p', { class: 'letter-kind' }, `${env.emoji} Открой, когда ${env.label}`),
      h('p', { class: 'letter-text' }, text),
      h('p', { class: 'letter-sign', html: `${me.from} <span class="sign-arrow">${SAGITTARIUS}</span>` })),
    h('div', { class: 'actions' },
      heart,
      h('button', { type: 'button', class: 'btn btn-primary', onclick: close }, 'Закрыть')));

  if (env.signal) toast(`${cap(me.partner)} узнает, что ты ${me.youOpened} этот конверт 💜`);
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
