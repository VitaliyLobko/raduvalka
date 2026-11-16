// «Вместе»: шлях від Юпітера (він) до Землі (вона), відлік до зустрічі, спільний список
import { DATA } from './data.js';
import { save } from './api.js';
import { h } from './ui.js';
import { spaceCard, flyHeart } from './space.js';

const DAY = 86400000;
const today = () => new Date(new Date().toDateString());
const daysTo = (from, iso) => Math.round((new Date(iso + 'T00:00') - from) / DAY);

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

const dayWord = (n) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;

// Що показати в листівці: точний відлік, якщо дата зустрічі відома, інакше — «сердечко в путі»
function journey(now) {
  const T = DATA.together;
  if (!T.apartFrom) return null;
  const apart = Math.max(0, -daysTo(now, T.apartFrom));
  if (!T.meet) {
    // Без дати сердечко щодня трохи ближче до Землі, але не доходить, поки не зустрінуться
    return { progress: 1 - Math.exp(-apart / 60), label: 'Сердечко в пути', value: dayWord(apart) };
  }
  const left = Math.max(0, daysTo(now, T.meet));
  if (!left) return { progress: 1, label: 'Сегодня', value: 'встреча! 🎉' };
  const total = Math.max(1, daysTo(new Date(T.apartFrom + 'T00:00'), T.meet));
  return { progress: Math.min(1, Math.max(0, 1 - left / total)), label: 'До встречи ещё', value: dayWord(left) };
}

export function renderTogether(screen) {
  const T = DATA.together;
  const { side } = DATA;
  const now = today();
  // Без дати розлуки сердечко вже вдома, на Землі
  const trip = journey(now) || { progress: 1, label: 'Вместе', value: '' };

  // Хто є хто: на її половині Земля — «ты», на його — Юпітер
  const tags = side === 'vona' ? { jupiter: 'он', earth: 'ты' } : { jupiter: 'ты', earth: 'она' };

  const { card, heart } = spaceCard({
    tags,
    label: `${trip.label} ${trip.value}`,
    phrase: T.phrase,
    extra: [trip.value ? h('div', { class: 'countdown' },
      h('span', { class: 'countdown-label' }, trip.label),
      h('span', { class: 'countdown-days' }, trip.value)) : null],
  });

  // Дату зустрічі вписує будь-хто з двох, щойно вона з'явиться
  const meetInput = h('input', {
    type: 'date',
    value: T.meet || '',
    min: now.toLocaleDateString('sv'),
    'aria-label': 'Дата встречи',
    onchange: (e) => {
      T.meet = e.target.value || null;
      save('together', { meet: T.meet });
      renderTogether(screen);
    },
  });

  T.wishes ||= [];
  const saveWishes = () => save('together', { wishes: T.wishes });
  const wishList = h('ul', { class: 'wishes' });
  const drawWishes = () => wishList.replaceChildren(...T.wishes.map((w) => h('li', {},
    h('label', { class: `wish${w.done ? ' is-done' : ''}` },
      h('input', {
        type: 'checkbox',
        checked: w.done,
        onchange: (e) => { w.done = e.target.checked; drawWishes(); saveWishes(); },
      }),
      h('span', {}, w.text),
      h('small', {}, w.by === side ? 'ты' : (side === 'vona' ? 'он' : 'она'))))));
  drawWishes();

  const input = h('input', { type: 'text', placeholder: 'Ещё куда-нибудь…', 'aria-label': 'Новое место' });
  const add = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    T.wishes.unshift({ text, done: false, by: side });
    input.value = '';
    drawWishes();
    saveWishes();
  };

  // replaceChildren не пропускає null, на відміну від h()
  screen.replaceChildren(...[
    h('h2', { class: 'title' }, 'Вместе'),
    card,
    h('label', { class: 'meet-row' }, h('span', {}, 'Когда встреча?'), meetInput),
    togetherDays(now, T.since),
    h('section', { class: 'wish-box' },
      h('h3', {}, side === 'vona' ? 'Куда пойдём, когда вернёшься' : 'Куда пойдём, когда вернусь'),
      h('form', { class: 'wish-add', onsubmit: add }, input, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Добавить')),
      wishList),
  ].filter(Boolean));

  flyHeart(card, heart, trip.progress);
}

// «N дней вместе» з датою початку; без дати рядка немає
function togetherDays(now, since) {
  if (!since) return null;
  const n = -daysTo(now, since);
  const from = new Date(since + 'T00:00')
    .toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');
  return h('p', { class: 'together-days' },
    h('b', {}, n.toLocaleString('ru')), ` ${plural(n, 'день', 'дня', 'дней')} вместе`,
    h('small', {}, `с ${from}`));
}
