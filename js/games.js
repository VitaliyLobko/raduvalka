// «🎲 Игры»: вибір гри для двох (ставка — вже всередині гри); і спільна шторка для ігор
import { h } from './ui.js';
import { openDuel } from './duel.js';
import { openSame } from './same.js';

// Шторка гри: заголовок, ✕, тіло; Escape і тап по тлу закривають. onClose — прибрати таймери
export function gameSheet({ icon, title, cls, onClose }) {
  const body = h('div', { class: 'duel-body' });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const backdrop = h('div', { class: 'backdrop', onclick: () => close() });
  const el = h('div', { class: `sheet duel-sheet ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-inner' },
      h('div', { class: 'duel-head' },
        h('h2', {}, `${icon} ${title}`),
        h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: () => close() }, '✕')),
      body));
  function close() {
    onClose?.();
    el.remove();
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  }
  document.body.append(backdrop, el);
  document.addEventListener('keydown', onKey);
  return { body, close };
}

export function openGames() {
  const go = (open) => () => { sh.close(); open(); };
  const tile = (icon, name, about, onclick) => h('button', { type: 'button', class: 'game-tile', onclick },
    h('span', { class: 'game-tile-icon', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'game-tile-text' }, h('b', {}, name), h('span', {}, about)));
  const sh = gameSheet({ icon: '🎲', title: 'Игры', cls: 'games-sheet' });
  sh.body.append(
    tile('✊', 'Камень-ножницы', 'До двух побед, руки открываются одновременно', go(() => openDuel({ game: 'rps' }))),
    tile('❌', 'Крестики-нолики', 'Поле 3×3, ходите по очереди', go(() => openDuel({ game: 'ttt' }))),
    tile('🔴', 'Четыре в ряд', 'Бросайте фишки по очереди — кто первым соберёт четыре', go(() => openDuel({ game: 'c4' }))),
    tile('💞', 'Совпадёт?', '5 вопросов: отвечаете каждый за себя, потом смотрите, где совпало', go(openSame)),
  );
}
