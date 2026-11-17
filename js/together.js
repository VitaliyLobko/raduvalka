// «Вместе»: шлях від Юпітера (він) до Землі (вона), відлік до зустрічі, спільний список.
// Не окремий розділ: значок у шапці, повна листівка — у шторці
import { DATA } from './data.js';
import { save } from './api.js';
import { h } from './ui.js';
import { spaceCard, flyHeart, dragHeart } from './space.js';

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
export function journey(now = today()) {
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

// Коротко для значка в шапці: є дата зустрічі попереду — «до встречи 32 дн.»; немає (чи вже минула) —
// скільки разом «вместе 2424 дн.»; без дати знайомства — «в пути 76 дн.»
export function chipLabel(now = today()) {
  const T = DATA.together;
  const left = T.meet ? daysTo(now, T.meet) : -1;
  if (left > 0) return `до встречи ${left} дн.`;
  if (left === 0) return 'встреча! 🎉';
  if (T.since) return `вместе ${-daysTo(now, T.since)} дн.`;
  if (T.apartFrom) return `в пути ${Math.max(0, -daysTo(now, T.apartFrom))} дн.`;
  return 'Вместе';
}

// onPlans — відкрити «Планы» (кнопка на місці колишнього списку «Куда пойдём»); onRender — після кожного малювання
export function renderTogether(screen, opts = {}) {
  const { onPlans, onRender } = opts;
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
      renderTogether(screen, opts);
    },
  });

  // Дні народження — для «🎂 Мой ДР» у хотілках; свій і другого вписує будь-хто
  const bday = (side, label) => {
    const key = side === 'vona' ? 'bdayVona' : 'bdayVin';
    return h('label', { class: 'bday' }, h('span', {}, label), h('input', {
      type: 'date',
      value: T[key] || '',
      'aria-label': `День рождения: ${label}`,
      onchange: (e) => { T[key] = e.target.value || null; save('together', { [key]: T[key] }); },
    }));
  };
  const mine = side === 'vona' ? ['vona', 'vin'] : ['vin', 'vona'];

  // replaceChildren не пропускає null, на відміну від h()
  screen.replaceChildren(...[
    h('h2', { class: 'title' }, 'Вместе'),
    card,
    h('label', { class: 'meet-row' }, h('span', {}, 'Когда встреча?'), meetInput),
    h('div', { class: 'bday-row' }, bday(mine[0], '🎂 Твой ДР'), bday(mine[1], side === 'vona' ? '🎂 Его ДР' : '🎂 Её ДР')),
    togetherDays(now, T.since),
    onPlans ? h('button', {
      type: 'button',
      class: 'btn btn-primary plan-wide',
      'data-plans-entry': '',
      onclick: onPlans,
    }, '💞 Планы: куда пойдём и что сделаем') : null,
  ].filter(Boolean));

  flyHeart(card, heart, trip.progress);
  // ponytail: на планеті поки лише пульс планети; ролики для Юпітера й Землі — передати сюди onPlanet
  dragHeart(card, heart, trip.progress);
  onRender?.();
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
