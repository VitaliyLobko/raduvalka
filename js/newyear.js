// Новий рік в обох: 31.12 у шапці відлік до півночі за Києвом, опівночі — новорічна печенька, а коли її закрили, —
// салют на весь екран і «С Новым годом!». Відкрили застосунок 1.01 до третьої ночі й салюту ще не бачили — так само раз. Лише transform/opacity (WAAPI)
import { h, reduceMotion } from './ui.js';
import { sfx } from './sound.js';
import { maybeCookie, previewCookie } from './cookie.js';

const SEEN = 'radovalka:ny-salute';
const COLORS = ['#FFD24A', '#FF5C7A', '#5CD6A0', '#6FA8FF', '#C98BFF', '#FFFFFF', '#FF9A3C'];
// Дата й час за Києвом: [місяць, день, секунд від півночі, рік]
function kyiv() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date()).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
  return [p.month, p.day, p.hour * 3600 + p.minute * 60 + p.second, p.year];
}
const seen = (y) => { try { return localStorage.getItem(SEEN) === String(y); } catch { return false; } };
const markSeen = (y) => { try { localStorage.setItem(SEEN, String(y)); } catch { /* приватне вікно */ } };

let timer = 0;
let row = null;
export function checkNewYear() {
  const [m, d, sec, y] = kyiv();
  if (m === 1 && d === 1 && sec < 3 * 3600 && !seen(y)) { markSeen(y); cookieThenSalute(() => maybeCookie({ now: true }), null); }
  if (m !== 12 || d !== 31) { row?.remove(); row = null; return; }
  if (!row) {
    row = h('p', { class: 'ny-count', role: 'status' });
    document.querySelector('.top')?.append(row);
  }
  const left = 24 * 3600 - sec;
  const hh = Math.floor(left / 3600);
  const mm = Math.floor((left % 3600) / 60);
  row.textContent = hh ? `🎄 До Нового года ${hh} ч ${mm} мин` : mm ? `🎄 До Нового года ${mm} мин` : `🎄 До Нового года ${left} с…`;
  clearTimeout(timer);
  // Останню хвилину — щосекунди, інакше раз на півхвилини; опівночі цей самий виклик запустить салют
  timer = setTimeout(checkNewYear, left <= 60 ? 1000 : 30000);
}

// Пробний Новий рік для нього в «Отладке»: 10 секунд відліку, новорічна печенька, салют (нікуди не шле).
// look — 'light' / 'dark': на час проби його телефон бере її вигляд (її тло з ялинкою, її кольори), потім повертає свій;
// wish — його побажання їй: у пробній печеньці так, як вона побачить
export function previewNewYear({ look = null, wish = null } = {}) {
  const back = look ? herLook(look) : null;
  document.querySelector('.ny-count')?.remove();
  const tmp = h('p', { class: 'ny-count', role: 'status' });
  document.querySelector('.top')?.append(tmp);
  let left = 10;
  const tick = () => {
    if (left > 0) { tmp.textContent = `🎄 До Нового года ${left} с… (пробно)`; left -= 1; setTimeout(tick, 1000); return; }
    tmp.remove();
    cookieThenSalute(() => previewCookie('ny', look ? wish : null, 'от него'), back);
  };
  tick();
}

// Спершу новорічна печенька (1 січня вона завжди новорічна — cookie.js), салют — коли її закрили чи відправили.
// Печеньки немає (уже була сьогодні, або поверх шторка) — салют одразу
// Печенька може чекати мережу (побажання другого) — тож спершу дочекаємось, поки вона відкриється
async function cookieThenSalute(open, after) {
  await open();
  const layer = document.querySelector('.cookie-layer');
  if (!layer) { salute(after); return; }
  new MutationObserver((_, ob) => { if (!layer.isConnected) { ob.disconnect(); salute(after); } }).observe(document.body, { childList: true });
}

// Її вигляд на його телефоні на час проби: її половина тла, Новий рік, світла чи нічна. Повертає «як було»
function herLook(look) {
  const root = document.documentElement;
  const was = { side: root.dataset.side, dark: root.hasAttribute('data-dark'), cls: root.className };
  root.dataset.side = 'vona';
  root.toggleAttribute('data-dark', look === 'dark');
  root.classList.remove('is-aurora', 'is-milky', 'is-summer', 'is-autumn', 'is-spring', 'is-raining', 'is-rain-end');
  root.classList.add('is-winter', 'is-newyear');
  return () => { root.dataset.side = was.side; root.toggleAttribute('data-dark', was.dark); root.className = was.cls; };
}

// Салют: ракети злітають знизу й розсипаються кулями іскор, що осідають; посередині — напис
export function salute(after) {
  document.querySelector('.ny-salute')?.remove();
  const box = h('div', { class: 'ny-salute', 'aria-hidden': 'true' });
  const text = h('p', { class: 'ny-text', role: 'status' }, 'С Новым годом!');
  // Тло на час салюту темнішає — іскри й напис видно на будь-якому екрані
  const veil = h('span', { class: 'ny-veil' });
  box.append(veil);
  veil.animate([{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }], { duration: 7000, fill: 'both' });
  document.body.append(box, text);
  text.animate([{ opacity: 0, transform: 'translate(-50%, -50%) scale(.6)' }, { opacity: 1, offset: 0.12, transform: 'translate(-50%, -50%) scale(1.06)' },
    { opacity: 1, offset: 0.2, transform: 'translate(-50%, -50%) scale(1)' }, { opacity: 1, offset: 0.85 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(1.04)' }],
  { duration: 7000, fill: 'both', easing: 'ease-out' });
  setTimeout(() => { box.remove(); text.remove(); after?.(); }, 7400);
  sfx('reveal');
  if (reduceMotion) return;
  const W = innerWidth;
  const H = innerHeight;
  const tr = (x, y, s = 1) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s})`;
  for (let k = 0; k < 9; k += 1) {
    const x = W * (0.15 + Math.random() * 0.7);
    const y = H * (0.12 + Math.random() * 0.34);
    const t0 = k * 520 + Math.random() * 220;
    const c = COLORS[k % COLORS.length];
    const rise = 650;
    const rocket = h('span', { class: 'ny-rocket' });
    rocket.style.setProperty('--c', c);
    box.append(rocket);
    rocket.animate([{ opacity: 0, transform: tr(x, H + 10) }, { opacity: 1, offset: 0.1 }, { opacity: 1, transform: tr(x, y), offset: 0.95 }, { opacity: 0, transform: tr(x, y) }],
      { duration: rise, delay: t0, fill: 'both', easing: 'cubic-bezier(.3,.6,.4,1)' });
    const N = 26;
    for (let i = 0; i < N; i += 1) {
      const a = (i / N) * Math.PI * 2 + Math.random() * 0.2;
      const r = 75 + Math.random() * 50;
      const dx = Math.cos(a) * r;
      const dy = Math.sin(a) * r;
      const p = h('span', { class: 'ny-spark' });
      p.style.setProperty('--c', i % 4 ? c : '#FFFFFF');
      box.append(p);
      p.animate([{ opacity: 0, transform: tr(x, y, 0.4) }, { opacity: 1, offset: 0.08, transform: tr(x + dx * 0.3, y + dy * 0.3, 1) },
        { opacity: 1, offset: 0.55, transform: tr(x + dx, y + dy, 0.9) }, { opacity: 0, transform: tr(x + dx * 1.05, y + dy + 46, 0.4) }],
      { duration: 1500, delay: t0 + rise, fill: 'both', easing: 'cubic-bezier(.15,.7,.35,1)' });
    }
  }
}
