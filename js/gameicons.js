// Значки ігор у плитках «🎲 Игры» — свої SVG замість емодзі (емодзі на різних телефонах різні й дрібні).
// Кольори — з CSS (.game-icon …): у неї світла плашка, у нього темна бірюзова із золотом
const svg = (body) => `<svg viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
const heart = (x, y, k, cls) => `<path class="${cls}" transform="translate(${x} ${y}) scale(${k})" d="M0 3.2C-2.4.6-6.4-1.2-6.4-4.6-6.4-7.2-3.2-8.4 0-5.6 3.2-8.4 6.4-7.2 6.4-4.6 6.4-1.2 2.4.6 0 3.2Z"/>`;
// ♂ і ♀ — кільце з вістрям чи хрестиком
const he = (x, y, r) => `<g class="gi-he"><circle cx="${x}" cy="${y}" r="${r}"/><path d="M${x + r * 0.7} ${y - r * 0.7}l${r * 0.9} ${-r * 0.9}m${-r * 0.75} 0h${r * 0.75}v${r * 0.75}"/></g>`;
const she = (x, y, r) => `<g class="gi-she"><circle cx="${x}" cy="${y}" r="${r}"/><path d="M${x} ${y + r}v${r * 1.1}m${-r * 0.55} ${-r * 0.5}h${r * 1.1}"/></g>`;

export const GAME_ICONS = {
  // Камінець, ножиці й аркушик
  rps: svg(`
    <path class="gi-paper" d="M30 10h16l6 6v22H30z"/><path class="gi-fold" d="M46 10v6h6"/><path class="gi-lines" d="M34 22h12M34 28h12M34 34h8"/>
    <ellipse class="gi-rock" cx="20" cy="44" rx="13" ry="10"/><path class="gi-shine" d="M13 40c2-3 5-4 8-4"/>
    <g class="gi-scissors"><circle cx="40" cy="52" r="4.5"/><circle cx="52" cy="48" r="4.5"/><path d="M43 49 56 34M48 46 38 31"/></g>`),
  // Сітка 3×3: три ♂ по діагоналі під золотою лінією перемоги, ♀ — у кутах
  ttt: svg(`
    <path class="gi-grid" d="M24 8v48M40 8v48M8 24h48M8 40h48"/>
    ${he(15.5, 16.5, 4.5)}${he(31.5, 32.5, 4.5)}${he(47.5, 48.5, 4.5)}${she(48, 13.5, 4.2)}${she(16, 45.5, 4.2)}
    <path class="gi-strike" d="M10 10 54 54"/>`),
  // Дошка з фішками, одна падає згори
  c4: svg(`
    <rect class="gi-board" x="6" y="22" width="52" height="36" rx="7"/>
    ${[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) => {
    const cls = (c === 1 && r === 2) || (c === 2 && r >= 1) ? 'gi-red' : (c === 0 && r === 2) || (c === 3 && r === 2) || (c === 1 && r === 1) ? 'gi-blue' : 'gi-hole';
    return `<circle class="${cls}" cx="${14 + c * 12}" cy="${30 + r * 11}" r="4.6"/>`;
  }).join('')).join('')}
    <circle class="gi-blue" cx="50" cy="11" r="4.6"/><path class="gi-motion" d="M44 6v6M56 6v6"/>`),
  // Кораблик з вітрилом-серцем на хвилях і зірочка
  bs: svg(`
    <path class="gi-wave" d="M4 50c5-3 9-3 14 0s9 3 14 0 9-3 14 0 9 3 14 0"/><path class="gi-wave is-far" d="M10 58c5-3 9-3 14 0s9 3 14 0 9-3 14 0"/>
    <path class="gi-hull" d="M12 40h40l-6 9H18z"/><path class="gi-deck" d="M16 43h32"/>
    <path class="gi-mast" d="M32 40V12"/>${heart(32, 27, 2.6, 'gi-sail')}<path class="gi-flag" d="M32 12l7 2.5-7 2.5z"/>
    <path class="gi-star" d="M52 8l1.6 3.4 3.4 1.6-3.4 1.6L52 18l-1.6-3.4L47 13l3.4-1.6z"/>`),
  // Точки 4×4: дві замкнуті клітинки — синя (його) і червона (її), між ними ще кілька рисочок
  db: svg(`
    <path class="gi-db-he" d="M10 10H24V24H10Z"/><path class="gi-db-she" d="M38 38H52V52H38Z"/>
    <path class="gi-db-line" d="M24 24H38M38 10V24M10 38V52M52 10H38"/>
    ${[10, 24, 38, 52].map((y) => [10, 24, 38, 52].map((x) => `<circle class="gi-dot" cx="${x}" cy="${y}" r="2.6"/>`).join('')).join('')}
  `),
  // Два сердечка одне на одному й іскорка — «совпало»
  same: svg(`
    ${heart(25, 34, 3.4, 'gi-heart-a')}${heart(39, 36, 3.4, 'gi-heart-b')}
    <path class="gi-star" d="M50 8l1.6 3.4 3.4 1.6-3.4 1.6L50 18l-1.6-3.4L45 13l3.4-1.6z"/><path class="gi-spark" d="M12 12l2 2M14 12l-2 2"/>`),
};
