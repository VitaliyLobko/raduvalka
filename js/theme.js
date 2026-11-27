// Тема: у нього завжди ніч; у неї — «Как в телефоне» (за темною темою телефона), «Светлая», «Ночная»
// чи «По времени» (ніч від заходу до сходу сонця над Києвом).
// Узор фону — у кожного свій: у неї 25.12–14.01 Новий рік, решта грудня–лютого зима, червень–серпень літо, вересень–листопад осінь, інакше весна (сакура);
// у нього взимку північне сяйво, влітку Чумацький Шлях, інакше зоряна карта. Або обраний вручну.
// Пам'ятає цей телефон; ранній скрипт в index.html ставить те саме ще до першого кадру
import { h } from './ui.js';

const KEY = 'radovalka:theme';
const MODES = [['auto', '📱', 'Как в телефоне'], ['time', '🌗', 'По времени'], ['light', '☀️', 'Светлая'], ['dark', '🌙', 'Ночная']];
// Схід і захід сонця над Києвом, хвилини UTC (наближення NOAA, похибка — хвилина-дві); те саме в index.html
export function sunTimes(d = new Date()) {
  const g = (2 * Math.PI / 365) * (Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5) - 1);
  const k = Math.PI / 180;
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const de = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * k) / (Math.cos(50.45 * k) * Math.cos(de)) - Math.tan(50.45 * k) * Math.tan(de)) / k;
  return [720 - 4 * (30.52 + ha) - eq, 720 - 4 * (30.52 - ha) - eq];
}
const nightNow = (d = new Date()) => { const [rise, set] = sunTimes(d); const m = d.getUTCHours() * 60 + d.getUTCMinutes(); return m < rise || m >= set; };
// Хвилини UTC → «16:05» за Києвом
const hm = (min) => { const d = new Date(); d.setUTCHours(0, Math.round(min), 0, 0); return d.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Kyiv', hour: 'numeric', minute: '2-digit' }); };
const mq = matchMedia('(prefers-color-scheme: dark)');
const read = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
const PATTERNS = {
  vona: { key: 'radovalka:season', list: [['auto', '🗓️', 'По сезону'], ['spring', '🌸', 'Весна'], ['summer', '🌻', 'Лето'], ['autumn', '🍁', 'Осень'], ['winter', '❄️', 'Зима'], ['newyear', '🎄', 'Новый год']],
    names: { spring: 'весна', summer: 'лето', autumn: 'осень', winter: 'зима', newyear: 'Новый год' },
    about: 'Каждый сезон — три месяца, начиная с марта. Новый год — с 25 декабря по 14 января' },
  vin: { key: 'radovalka:season:vin', list: [['auto', '🗓️', 'По сезону'], ['stars', '✨', 'Звёзды'], ['aurora', '🌌', 'Сияние'], ['milky', '🌠', 'Млечный Путь']],
    names: { stars: 'звёздная карта', aurora: 'северное сияние', milky: 'Млечный Путь' }, about: 'Сияние с декабря по февраль, Млечный Путь — с июня по август' },
};
const sideOf = (side) => (side === 'vin' ? 'vin' : 'vona');
const readPattern = (side) => { try { return localStorage.getItem(PATTERNS[sideOf(side)].key) || 'auto'; } catch { return 'auto'; } };
// Що дає «По сезону» сьогодні (за Києвом)
function bySeason(side) {
  const [m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', month: 'numeric', day: 'numeric' }).formatToParts(new Date())
    .filter((p) => p.type !== 'literal').map((p) => Number(p.value));
  const winter = [12, 1, 2].includes(m);
  if (sideOf(side) === 'vin') return winter ? 'aurora' : [6, 7, 8].includes(m) ? 'milky' : 'stars';
  if ((m === 12 && d >= 25) || (m === 1 && d <= 14)) return 'newyear';
  return winter ? 'winter' : [6, 7, 8].includes(m) ? 'summer' : [9, 10, 11].includes(m) ? 'autumn' : 'spring';
}
const pattern = (side) => { const s = readPattern(side); return s === 'auto' ? bySeason(side) : s; };
// Колір смужки браузера — під тло: його ніч, її слива чи лаванда, улітку — бурштин чи мед, восени — каштан чи персик
const BAR = { summer: ['#2A1C10', '#FFF3D2'], autumn: ['#331D14', '#FFF6E8'] };
const color = (side, dark, p) => (side === 'vin' ? '#0B384B' : BAR[p] ? BAR[p][dark ? 0 : 1] : dark ? '#2A1730' : '#EADFFB');

export function applyTheme(side = document.documentElement.dataset.side) {
  const m = read();
  const dark = side === 'vin' || m === 'dark' || (m === 'auto' && mq.matches) || (m === 'time' && nightNow());
  const p = pattern(side);
  const root = document.documentElement;
  root.toggleAttribute('data-dark', dark);
  root.classList.toggle('is-winter', p === 'winter' || p === 'newyear');
  root.classList.toggle('is-newyear', p === 'newyear');
  root.classList.toggle('is-summer', p === 'summer');
  root.classList.toggle('is-autumn', p === 'autumn');
  root.classList.toggle('is-spring', p === 'spring');
  // 31 жовтня — Хелловін: гарбузик у купці листя стає Джеком-ліхтарем
  root.classList.toggle('is-halloween', p === 'autumn' && new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date()).slice(5) === '10-31');
  root.classList.toggle('is-aurora', p === 'aurora');
  root.classList.toggle('is-milky', p === 'milky');
  document.querySelector('meta[name="theme-color"]').content = color(side, dark, p);
}
mq.addEventListener?.('change', () => applyTheme());
// «По времени»: раз на хвилину звіряємось із сонцем (і щойно застосунок знову на екрані) — тема міняється сама
const byTime = () => { if (read() === 'time' && !document.hidden) applyTheme(); };
setInterval(byTime, 60000);
document.addEventListener('visibilitychange', byTime);

// Рядок плиток вибору: значок над підписом, натиснута — підсвічена
function tiles(title, key, list, now, onPick) {
  const btns = list.map(([v, icon, label]) => h('button', {
    type: 'button', class: 'theme-tile', 'aria-pressed': String(v === now),
    onclick: () => {
      try { localStorage.setItem(key, v); } catch { /* приватне вікно — до закриття */ }
      applyTheme();
      btns.forEach((b, i) => b.setAttribute('aria-pressed', String(list[i][0] === v)));
      onPick?.();
    },
  }, h('span', { class: 'theme-tile-ic', 'aria-hidden': 'true' }, icon), h('span', {}, label)));
  return h('div', { class: 'theme-block' }, h('p', { class: 'about-sub' }, title),
    h('div', { class: `theme-tiles is-${list.length}`, role: 'group', 'aria-label': title }, ...btns));
}

// Блок у групі «Оформление»: у неї «Тема» й «Узор фона», у нього — лише свій узор
export function themePanel(side) {
  const P = PATTERNS[sideOf(side)];
  const note = h('p', { class: 'theme-note' });
  const timeNote = h('p', { class: 'theme-note' });
  const paintTime = () => {
    const [rise, set] = sunTimes();
    timeNote.hidden = read() !== 'time';
    timeNote.textContent = `Ночная — с заката до рассвета: сегодня с ${hm(set)} до ${hm(rise)}`;
  };
  paintTime();
  const paint = () => {
    note.textContent = readPattern(side) === 'auto' ? `Сейчас — ${P.names[bySeason(side)]}. ${P.about}` : 'Узор выбран вручную — «По сезону» вернёт смену по календарю';
  };
  paint();
  return h('div', { class: 'theme-panel' },
    sideOf(side) === 'vin' ? null : tiles('Тема', KEY, MODES, read(), paintTime),
    sideOf(side) === 'vin' ? null : timeNote,
    tiles('Узор фона', P.key, P.list, readPattern(side), paint),
    note);
}
