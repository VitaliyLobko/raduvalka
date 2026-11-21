// Міні-тур при першому відкритті: улюбленці по черзі підсвічують головне на «Письмах».
// Вкладок не перемикає — інакше з'їв би позначки «нове» в хотілках і планах
import { mascotImg, petName, petFor } from './icons.js';
import { h, reduceMotion } from './ui.js';
import { who } from './data.js';

const KEY = 'radovalka:toured';

// sel — що підсвітити (перше видиме), who — роль улюбленця; кого немає на екрані — крок пропускаємо
const STEPS = [
  // Чат: у перший день там лише запечатаний привітальний конверт — про нього; далі — про свайпи
  {
    sel: '.feed-row.is-sealed, .feed-row.is-theirs, .feed-box .mk-wait, .feed-box',
    who: 'push',
    text: () => (document.querySelector('.feed-row.is-sealed')
      ? 'Это ваш чат: письма, ответы, фото и гифки, новое внизу. Письмо я приношу конвертом и стучу уведомлением. Тап по конверту, и оно откроется 🐾'
      : document.querySelector('.feed-row')
        ? 'Это ваш чат: новое внизу. Смахни сообщение вправо — ответить.'
        : 'Это ваш чат. Письма, ответы, фото и гифки будут появляться здесь, новое внизу.'),
  },
  { sel: '.checkin-row', who: 'push', text: () => `Тап по «Я в порядке», и ${who().partner} узнает, что всё хорошо. А если нужна помощь, проведи красный кружок вправо.` },
  { sel: '.cbar-row', who: 'memes', text: 'А тут — написать: письмо, записку в конверт, фото или гифку. Фото и гифки ношу я 😹' },
  { sel: '.tab[data-tab=envelopes]', who: 'push', text: 'Конверты «Открой, когда…»: тяжёлый день, скучаешь, не спится. Открывай подходящий.' },
  { sel: '.tab[data-tab=plans]', who: 'memes', text: 'Планы: листай идеи, куда пойти. Совпало у вас обоих — значит, идём!' },
  { sel: '.tab[data-tab=wish]', who: 'push', text: () => `Хотелки: пиши, чего хочется, и подглядывай, что хочется ${who().toWhom}.` },
  { sel: '#about-btn', who: 'memes', text: 'Тап по «Радовалка» — меню: сколько вы вместе и сколько до встречи, размер букв, уведомления. Загляни, когда соскучишься 💞' },
];

const toured = () => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
};

export function maybeTour() {
  if (!toured()) startTour();
}

const visible = (el) => {
  if (!el || el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};
// Варіанти через кому — за пріоритетом, а не за порядком у документі (обгортка інакше завжди перша)
const find = (sel) => {
  for (const one of sel.split(',')) {
    // У чаті свіже — внизу: беремо останній видимий, інакше тур прокрутив би стрічку до найстаршого
    const el = [...document.querySelectorAll(one)].findLast(visible);
    if (el) return el;
  }
  return null;
};

export function startTour() {
  if (document.querySelector('.tour')) return;
  const steps = STEPS.filter((s) => find(s.sel));
  if (!steps.length) return;
  let i = -1;

  const hole = h('div', { class: 'tour-hole', 'aria-hidden': 'true' });
  const pet = h('span', { class: 'mascot tour-pet', 'aria-hidden': 'true' });
  const say = h('p', { class: 'bubble tour-say', 'aria-live': 'polite' });
  const dots = h('span', { class: 'tour-dots', 'aria-hidden': 'true' }, ...steps.map(() => h('i')));
  const next = h('button', { type: 'button', class: 'btn btn-primary tour-next', onclick: () => go(i + 1) }, 'Дальше');
  const card = h('div', { class: 'tour-card' },
    h('div', { class: 'tour-talk' }, pet, say),
    h('div', { class: 'tour-foot' },
      h('button', { type: 'button', class: 'btn tour-skip', onclick: () => finish() }, 'Пропустить'),
      dots, next));
  // Шар ловить усі дотики: під час туру нічого під ним не натискається
  const root = h('div', { class: 'tour', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Знакомство с Радовалкой' }, hole, card);

  const onKey = (e) => { if (e.key === 'Escape') finish(); };
  const onResize = () => place(find(steps[i].sel));

  function finish() {
    try { localStorage.setItem(KEY, '1'); } catch { /* приватне вікно — покажемо ще раз, не страшно */ }
    document.removeEventListener('keydown', onKey);
    removeEventListener('resize', onResize);
    root.remove();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    // Чат — знову на свіжому
    const box = document.querySelector('.feed-box');
    box?.scrollTo({ top: box.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function place(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    // Висока ціль (довга стрічка) — підсвічуємо лише верх, щоб картці лишилось місце
    const hgt = Math.min(r.height, innerHeight * 0.4);
    // Віконце не виходить за край екрана — крайня марка внизу праворуч інакше обрізалась би
    const top = Math.max(4, r.top - pad);
    const left = Math.max(4, r.left - pad);
    const right = Math.min(innerWidth - 4, r.right + pad);
    const bottom = Math.min(innerHeight - 4, r.top + hgt + pad);
    Object.assign(hole.style, { top: `${top}px`, left: `${left}px`, width: `${right - left}px`, height: `${bottom - top}px` });
    const below = r.top + hgt / 2 < innerHeight / 2;
    card.style.top = below ? `${r.top + hgt + pad + 14}px` : '';
    card.style.bottom = below ? '' : `${innerHeight - r.top + pad + 14}px`;
  }

  function go(n) {
    if (n >= steps.length) { finish(); return; }
    i = n;
    const s = steps[i];
    const el = find(s.sel);
    if (!el) { go(i + 1); return; }
    // Нижнє меню нерухоме; решту (і шапку — вона їде разом зі сторінкою) — у середину екрана
    if (!el.closest('.tabs')) el.scrollIntoView({ block: 'center' });
    place(el);
    const who = petFor(s.who);
    const name = petName(who);
    pet.innerHTML = who ? mascotImg(who, i === steps.length - 1 ? 'festive' : 'main') : '';
    pet.hidden = !who;
    say.replaceChildren(...[name ? h('b', {}, `${name}: `) : null, typeof s.text === 'function' ? s.text() : s.text].filter(Boolean));
    // Улюбленці говорять по черзі з різних боків — і щоразу заново «застрибують»
    card.classList.toggle('is-right', i % 2 === 1);
    pet.classList.remove('is-hop');
    void pet.offsetWidth;
    pet.classList.add('is-hop');
    [...dots.children].forEach((d, k) => d.classList.toggle('is-on', k === i));
    next.textContent = i === steps.length - 1 ? 'Начнём 💜' : 'Дальше';
    next.focus({ preventScroll: true });
  }

  document.body.append(root);
  document.addEventListener('keydown', onKey);
  addEventListener('resize', onResize);
  go(0);
}
