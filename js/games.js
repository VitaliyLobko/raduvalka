// «🎲 Игры»: вибір гри для двох (ставка — вже всередині гри); і спільна шторка для ігор
import { h } from './ui.js';
import { openDuel } from './duel.js';
import { get } from './api.js';
import { who } from './data.js';
import { openSame } from './same.js';
import { GAME_ICONS } from './gameicons.js';

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
  // live — плашка «идёт» на плитці гри, що вже триває: чия черга
  const live = {};
  const tile = (icon, name, about, onclick, kind) => h('button', { type: 'button', class: 'game-tile', onclick },
    // Свій SVG-значок гри (gameicons.js); нема — як раніше емодзі
    GAME_ICONS[kind || 'same'] ? h('span', { class: 'game-tile-icon game-icon', 'aria-hidden': 'true', html: GAME_ICONS[kind || 'same'] }) : h('span', { class: 'game-tile-icon', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'game-tile-text' }, h('b', {}, name, kind ? (live[kind] = h('span', { class: 'game-tile-live', hidden: true })) : null), h('span', {}, about)));
  const sh = gameSheet({ icon: '🎲', title: 'Игры', cls: 'games-sheet' });
  sh.body.append(
    tile('✊', 'Камень-ножницы', 'До двух побед, руки открываются одновременно', go(() => openDuel({ game: 'rps' })), 'rps'),
    tile('♂️♀️', 'Крестики-нолики', 'Поле 3×3, ходите по очереди', go(() => openDuel({ game: 'ttt' })), 'ttt'),
    tile('🔵🔴', 'Четыре в ряд', 'Бросайте фишки по очереди — кто первым соберёт четыре', go(() => openDuel({ game: 'c4' })), 'c4'),
    tile('🚢', 'Морской бой', 'Поле 6×6: расставьте флот с записками внутри и топите по очереди', go(() => openDuel({ game: 'bs' })), 'bs'),
    tile('✏️', 'Точки и квадраты', 'Черты по очереди: кто замкнёт клетку, забирает её и ходит ещё', go(() => openDuel({ game: 'db' })), 'db'),
  );
  get('duel').then((r) => {
    for (const [k, turn] of Object.entries(r.live || {})) {
      const el = live[k];
      if (!el) continue;
      el.textContent = turn === 'me' ? 'Твой ход' : `Ждём ${who().partner === 'она' ? 'её' : 'его'} ход`;
      el.classList.toggle('is-me', turn === 'me');
      el.hidden = false;
    }
  }).catch(() => {});
  sh.body.append(
    tile('💞', 'Совпадёт?', '10 вопросов: отвечаете каждый за себя, потом смотрите, где совпало', go(openSame)),
  );
}
