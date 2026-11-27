// «🎲 Игры»: вибір гри для двох (ставка — вже всередині гри); і спільна шторка для ігор
import { h } from './ui.js';
import { openDuel } from './duel.js';
import { get } from './api.js';
import { DATA, who } from './data.js';
import { openSame } from './same.js';
import { openHot } from './hot.js';
import { openBerry } from './berry.js';
import { openDice } from './dice.js';
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

// Плитка гри: свій SVG-значок (gameicons.js), нема — емодзі; live — плашка «чий хід» для ігор, що вже йдуть
const gameTile = (live, icon, name, about, onclick, kind, adult = false) => h('button', { type: 'button', class: 'game-tile', onclick },
  GAME_ICONS[kind || 'same'] ? h('span', { class: 'game-tile-icon game-icon', 'aria-hidden': 'true', html: GAME_ICONS[kind || 'same'] }) : h('span', { class: 'game-tile-icon', 'aria-hidden': 'true' }, icon),
  h('span', { class: 'game-tile-text' }, h('b', {}, name, adult ? h('span', { class: 'game-tile-adult', title: 'Только для взрослых' }, '18+') : null, kind ? (live[kind] = h('span', { class: 'game-tile-live', hidden: true })) : null), h('span', {}, about)));
// Ігри 18+ — ті, чиї тексти є в секретах воркера
const adultGames = (go) => [
  DATA.hot ? ['🔥', 'Совпадёт? 🔥', 'Вопросы только для вас двоих: видно лишь то, что хочется обоим', go(() => openHot()), 'hot'] : null,
  DATA.berry ? ['🍓', 'Клубничка', 'Викторина: кто знает больше, тот загадывает желание на встречу', go(() => openBerry()), 'berry'] : null,
  DATA.dice ? ['🎲', 'Кубики', 'Три кубика: что, где и как. Выпавшее — купон на встречу', go(() => openDice()), 'dice'] : null,
].filter(Boolean);

export function openGames() {
  const go = (open) => () => { sh.close(); open(); };
  const live = {};
  const tile = (...a) => gameTile(live, ...a);
  const sh = gameSheet({ icon: '🎲', title: 'Игры', cls: 'games-sheet' });
  sh.body.append(
    tile('✊', 'Камень-ножницы', 'До двух побед, руки открываются одновременно', go(() => openDuel({ game: 'rps' })), 'rps'),
    tile('♂️♀️', 'Крестики-нолики', 'Поле 3×3, ходите по очереди', go(() => openDuel({ game: 'ttt' })), 'ttt'),
    tile('🔵🔴', 'Четыре в ряд', 'Бросайте фишки по очереди — кто первым соберёт четыре', go(() => openDuel({ game: 'c4' })), 'c4'),
    tile('🚢', 'Морской бой', 'Поле 6×6: расставьте флот с записками внутри и топите по очереди', go(() => openDuel({ game: 'bs' })), 'bs'),
    tile('✏️', 'Точки и квадраты', 'Черты по очереди: кто замкнёт клетку, забирает её и ходит ещё', go(() => openDuel({ game: 'db' })), 'db'),
    tile('🐾', 'Найди пару', 'Карточки с нашими питомцами: открывайте по две и ищите пары', go(() => openDuel({ game: 'mm' })), 'mm'),
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
  const adult = adultGames(go).length;
  sh.body.append(...[
    tile('💞', 'Совпадёт?', '10 вопросов: отвечаете каждый за себя, потом смотрите, где совпало', go(openSame)),
    // Двері в окреме меню 18+: оксамит і золото, усередині — ігри лише для двох
    adult ? h('button', { type: 'button', class: 'game-tile adult-door', onclick: go(openAdult) },
      h('span', { class: 'game-tile-icon game-icon', 'aria-hidden': 'true', html: GAME_ICONS.adult }),
      h('span', { class: 'game-tile-text' }, h('b', {}, 'Для двоих', h('span', { class: 'game-tile-adult' }, '18+')),
        h('span', {}, `${adult === 1 ? 'Игра' : `${adult} игры`} только для вас: откровенно и на встречу`)),
      h('span', { class: 'adult-door-arrow', 'aria-hidden': 'true' }, '›')) : null,
  ].filter(Boolean));
}

// Окреме меню 18+: тільки ігри для дорослих, назад — до всіх ігор
export function openAdult() {
  const go = (open) => () => { sh.close(); open(); };
  const sh = gameSheet({ icon: '🔒', title: 'Для двоих', cls: 'games-sheet adult-sheet' });
  sh.body.append(
    h('p', { class: 'adult-note' }, 'Только для вас двоих. Что выпадет и что загадаете — видите лишь вы.'),
    ...adultGames(go).map(([icon, name, about, onclick, kind]) => gameTile({}, icon, name, about, onclick, kind)),
    h('button', { type: 'button', class: 'duel-cancel adult-back', onclick: go(openGames) }, '← Все игры'));
}
