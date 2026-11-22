// Своє вікно вибору дати й часу замість системного календаря Android: місяць сіткою, роки списком, час барабанами.
// Вантажиться лише при першому відкритті (import('./picker.js')); відповідь — Promise, null — передумали
import { h, cap, reduceMotion } from './ui.js';

const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const MONTH = new Intl.DateTimeFormat('ru', { month: 'long' });
const DAY = new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' });
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};

// Шторка поверх усього (і поверх іншої шторки); «Назад» закриває її, як решту вікон (role=dialog, back.js)
function shell(title, done) {
  const prev = document.activeElement;
  let closed = false;
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
  const shade = h('div', { class: 'backdrop pk-shade', onclick: () => close(null) });
  const body = h('div', { class: 'pk-body' });
  const el = h('div', { class: 'sheet pk-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: () => close(null) }, '✕'),
    h('div', { class: 'sheet-inner' }, h('h2', { class: 'pk-title' }, title), body));
  function close(v) {
    if (closed) return;
    closed = true;
    shade.remove();
    el.remove();
    document.removeEventListener('keydown', onKey, true);
    prev?.focus?.({ preventScroll: true });
    done(v);
  }
  document.body.append(shade, el);
  document.addEventListener('keydown', onKey, true);
  return { body, close };
}

// Місяць сіткою (завжди 6 рядків — вікно не стрибає); тап по назві — роки списком, тап по року — назад до місяця
function calendar({ value, min, max, onPick }) {
  const today = iso(new Date());
  const ok = (s) => (!min || s >= min) && (!max || s <= max);
  let sel = value;
  const start = fromIso(value) || fromIso(!ok(today) ? (min && today < min ? min : max) : today) || new Date();
  let y = start.getFullYear();
  let m = start.getMonth();
  let years = false;
  const root = h('div', { class: 'pk-cal' });
  // Рік без жодного дозволеного дня в цьому місяці — найближчий дозволений місяць
  const fit = () => {
    if (min && iso(new Date(y, m + 1, 0)) < min) { const d = fromIso(min); y = d.getFullYear(); m = d.getMonth(); }
    if (max && iso(new Date(y, m, 1)) > max) { const d = fromIso(max); y = d.getFullYear(); m = d.getMonth(); }
  };
  const step = (k) => { m += k; if (m < 0) { m = 11; y -= 1; } if (m > 11) { m = 0; y += 1; } draw(); };
  function draw() {
    const prevOk = !min || iso(new Date(y, m, 0)) >= min;
    const nextOk = !max || iso(new Date(y, m + 1, 1)) <= max;
    const head = h('div', { class: 'pk-head' },
      h('button', { type: 'button', class: 'pk-nav', 'aria-label': 'Прошлый месяц', disabled: years || !prevOk, onclick: () => step(-1) }, '‹'),
      h('button', { type: 'button', class: 'pk-month', 'aria-expanded': String(years), onclick: () => { years = !years; draw(); } },
        `${cap(MONTH.format(new Date(y, m, 1)))} ${y}`, h('span', { class: 'pk-caret', 'aria-hidden': 'true' }, '▾')),
      h('button', { type: 'button', class: 'pk-nav', 'aria-label': 'Следующий месяц', disabled: years || !nextOk, onclick: () => step(1) }, '›'));
    if (years) {
      const now = new Date().getFullYear();
      const y0 = min ? +min.slice(0, 4) : now - 90;
      const y1 = max ? +max.slice(0, 4) : now + 10;
      const list = h('div', { class: 'pk-years', role: 'group', 'aria-label': 'Год' });
      for (let k = y1; k >= y0; k -= 1) {
        list.append(h('button', {
          type: 'button', class: `pk-year${k === y ? ' is-on' : ''}${k === now ? ' is-today' : ''}`, 'aria-pressed': String(k === y),
          onclick: () => { y = k; years = false; fit(); draw(); },
        }, String(k)));
      }
      root.replaceChildren(head, list);
      requestAnimationFrame(() => list.querySelector('.is-on')?.scrollIntoView({ block: 'center' }));
      return;
    }
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const n = new Date(y, m + 1, 0).getDate();
    const grid = h('div', { class: 'pk-grid' }, ...WD.map((w) => h('span', { class: 'pk-wd', 'aria-hidden': 'true' }, w)));
    for (let i = 0; i < 42; i += 1) {
      const d = i - lead + 1;
      if (d < 1 || d > n) { grid.append(h('span', { class: 'pk-day is-pad', 'aria-hidden': 'true' })); continue; }
      const date = new Date(y, m, d);
      const s = iso(date);
      grid.append(h('button', {
        type: 'button', class: `pk-day${s === today ? ' is-today' : ''}${s === sel ? ' is-on' : ''}`,
        disabled: !ok(s), 'aria-pressed': String(s === sel), 'aria-label': DAY.format(date),
        onclick: () => { sel = s; draw(); onPick(s); },
      }, String(d)));
    }
    root.replaceChildren(head, grid);
  }
  fit();
  draw();
  return root;
}

// Барабан: прокрутка з прилипанням до значення; стрілки ↑↓ із клавіатури; тап по значенню — до нього
const ITEM = 40;
function wheel(vals, value, onChange, label) {
  let idx = Math.max(0, vals.indexOf(value));
  const items = vals.map((x, i) => h('div', { class: 'pk-wheel-item', onclick: () => to(i) }, pad(x)));
  const el = h('div', { class: 'pk-wheel', role: 'spinbutton', tabindex: '0', 'aria-label': label }, ...items);
  const mark = () => {
    items.forEach((it, i) => it.classList.toggle('is-on', i === idx));
    el.setAttribute('aria-valuenow', String(vals[idx]));
    el.setAttribute('aria-valuetext', pad(vals[idx]));
  };
  function to(i) {
    idx = Math.min(vals.length - 1, Math.max(0, i));
    el.scrollTo({ top: idx * ITEM, behavior: reduceMotion ? 'auto' : 'smooth' });
    mark();
    onChange();
  }
  // Позначка значення — раз на кадр, не на кожну подію прокрутки
  let frame = 0;
  el.addEventListener('scroll', () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const i = Math.min(vals.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)));
      if (i !== idx) { idx = i; mark(); onChange(); }
    });
  }, { passive: true });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); to(idx - 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); to(idx + 1); }
  });
  mark();
  return { el, get: () => vals[idx], ready: () => { el.scrollTop = idx * ITEM; } };
}

// Дата: value/min/max — 'YYYY-MM-DD' (як у input type=date); тап по дню — одразу готово
export function pickDate({ value = '', min = '', max = '', title = 'Дата', today: withToday = true } = {}) {
  return new Promise((done) => {
    const { body, close } = shell(title, done);
    const today = iso(new Date());
    const canToday = withToday && (!min || today >= min) && (!max || today <= max);
    body.append(
      calendar({ value, min, max, onPick: (s) => setTimeout(() => close(s), reduceMotion ? 0 : 160) }),
      h('div', { class: 'pk-foot' },
        canToday ? h('button', { type: 'button', class: 'mk-chip', onclick: () => close(today) }, 'Сегодня') : null,
        h('button', { type: 'button', class: 'btn pk-cancel', onclick: () => close(null) }, 'Отмена')));
  });
}

// Дата й час: value/min/max — мс; quick — [{ label, at }] швидкі варіанти над календарем (тап — одразу готово).
// Хвилини — кроком 5; час, що вже минув, показуємо чесно — що з ним робити, вирішує той, хто питав
export function pickDateTime({ value = Date.now(), min = Date.now(), max = 0, title = 'Ко времени', quick = [], past = '' } = {}) {
  return new Promise((done) => {
    const { body, close } = shell(title, done);
    const v = new Date(value);
    let day = iso(v);
    const sum = h('p', { class: 'pk-sum', 'aria-live': 'polite' });
    const at = () => {
      const d = fromIso(day);
      d.setHours(hours.get(), mins.get(), 0, 0);
      return d.getTime();
    };
    const paint = () => {
      const t = at();
      const gone = t <= Date.now() + 60000;
      sum.textContent = `${cap(DAY.format(t))}, ${pad(hours.get())}:${pad(mins.get())}${gone && past ? ` — ${past}` : ''}`;
      sum.classList.toggle('is-past', gone);
    };
    const hours = wheel(Array.from({ length: 24 }, (_, i) => i), v.getHours(), () => paint(), 'Часы');
    const mins = wheel(Array.from({ length: 12 }, (_, i) => i * 5), (Math.round(v.getMinutes() / 5) * 5) % 60, () => paint(), 'Минуты');
    const cal = calendar({ value: day, min: iso(new Date(min)), max: max ? iso(new Date(max)) : '', onPick: (s) => { day = s; paint(); } });
    body.append(...[
      quick.length ? h('div', { class: 'mk-chips pk-quick' },
        ...quick.map((q) => h('button', { type: 'button', class: 'mk-chip', onclick: () => close(q.at) }, q.label))) : null,
      cal,
      h('div', { class: 'pk-time' }, hours.el, h('span', { class: 'pk-colon', 'aria-hidden': 'true' }, ':'), mins.el),
      sum,
      h('div', { class: 'pk-foot' },
        h('button', { type: 'button', class: 'btn pk-cancel', onclick: () => close(null) }, 'Отмена'),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => close(at()) }, 'Готово')),
    ].filter(Boolean));
    hours.ready();
    mins.ready();
    paint();
  });
}
