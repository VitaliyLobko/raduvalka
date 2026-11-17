// Замок: без ключа видно лише листівку з планетами й поле для посилання
import { h, sky } from './ui.js';
import { parseKey, setKey } from './api.js';
import { spaceCard, flyHeart } from './space.js';

// reason: null — ключа ще нема, 'bad' — сервер його не прийняв, 'offline' — немає звʼязку
export function showLock(reason, retry) {
  document.querySelector('.welcome')?.remove();

  const input = h('input', {
    type: 'text',
    inputmode: 'url',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'Ссылка или ключ',
    'aria-label': 'Ссылка или ключ',
  });
  const error = h('p', { class: 'lock-error', role: 'alert' }, reason === 'bad' ? 'Этот ключ не подошёл. Проверь ссылку.' : '');

  const submit = (e) => {
    e.preventDefault();
    const key = parseKey(input.value);
    if (!key) {
      error.textContent = 'Тут нет ключа. Вставь ссылку целиком.';
      input.focus();
      return;
    }
    setKey(key);
    root.remove();
    retry();
  };

  const offline = reason === 'offline';
  const { card, heart } = spaceCard({ label: 'Радовалка' });
  const root = h('div', { class: 'welcome lock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Радовалка' },
    h('div', { class: 'welcome-card' }, card),
    h('div', { class: 'welcome-foot' },
      h('p', { class: 'welcome-hello' }, 'Радовалка'),
      offline
        ? h('p', { class: 'welcome-from' }, 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.')
        : h('p', { class: 'welcome-from' }, 'Радовалка открывается по личной ссылке. Нажми на ту, что тебе прислали, или вставь её сюда.'),
      offline
        ? h('button', { type: 'button', class: 'btn btn-star', onclick: () => { root.remove(); retry(); } }, 'Ещё раз')
        : h('form', { class: 'lock-form', onsubmit: submit },
          input,
          error,
          h('button', { type: 'submit', class: 'btn btn-star' }, 'Открыть'))));

  root.prepend(sky(40, 13));
  document.body.append(root);
  flyHeart(card, heart, 0.5, { delay: 300, duration: 1800 });
}
