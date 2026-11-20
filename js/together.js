// «Вместе»: шлях від Юпітера (він) до Землі (вона), відлік до зустрічі, спільний список.
// Не окремий розділ: значок у шапці, повна листівка — у шторці
import { DATA } from './data.js';
import { save, send, get } from './api.js';
import { h, toast } from './ui.js';
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
    // У день розставання — «с сегодня», а не «0 дней»
    return { progress: 1 - Math.exp(-apart / 60), label: apart ? 'Скучаем уже' : 'Скучаем', value: apart ? dayWord(apart) : 'с сегодня' };
  }
  // Зустріч уже була — сердечко вдома, доки не поставлять нове «врозь с»
  if (daysTo(now, T.meet) < 0) return { progress: 1, label: 'Вы вместе', value: '💞', together: true };
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

// Кругла дата «вместе» (кожні 100 днів і річниця): у шапці тоді повна святкова плашка, в інші дні — лише число
export function chipFestive(now = today()) {
  const T = DATA.together;
  if (!T.since || !chipLabel(now).startsWith('вместе')) return false;
  const days = -daysTo(now, T.since);
  const s = new Date(T.since + 'T00:00');
  return days > 0 && (days % 100 === 0 || (s.getMonth() === now.getMonth() && s.getDate() === now.getDate()));
}

// «Планы» — своя вкладка внизу, звідси вхід не потрібен
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

  // Дату стерти одним тапом: ✕ поруч, поки щось вписано (у календарі телефона «очистити» не скрізь є)
  const clearable = (input, label, onClear) => {
    const btn = h('button', {
      type: 'button', class: 'date-clear', 'aria-label': `Стереть: ${label}`, hidden: !input.value,
      onclick: (e) => { e.preventDefault(); input.value = ''; btn.hidden = true; onClear(); },
    }, '✕');
    input.addEventListener('input', () => { btn.hidden = !input.value; });
    return h('span', { class: 'date-field' }, input, btn);
  };

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

  // Дні народження — для «🎂 Мой ДР» у хотілках; свій і другого вписує будь-хто
  const bday = (side, label) => {
    const key = side === 'vona' ? 'bdayVona' : 'bdayVin';
    const input = h('input', {
      type: 'date',
      value: T[key] || '',
      'aria-label': `День рождения: ${label}`,
      onchange: (e) => { T[key] = e.target.value || null; save('together', { [key]: T[key] }); },
    });
    return h('label', { class: 'bday' }, h('span', {}, label),
      clearable(input, label, () => { T[key] = null; save('together', { [key]: null }); }));
  };
  const mine = side === 'vona' ? ['vona', 'vin'] : ['vin', 'vona'];

  // З якого дня врозь — від нього сердечко рахує шлях; змінити може будь-хто
  const apartInput = h('input', {
    type: 'date', value: T.apartFrom || '', max: now.toLocaleDateString('sv'), 'aria-label': 'Врозь с',
    onchange: (e) => { T.apartFrom = e.target.value || null; save('together', { apartFrom: T.apartFrom }); renderTogether(screen); },
  });
  // Зустрілись і знову роз'їхались — одним тапом: врозь із сьогодні, стара дата зустрічі геть
  const apartAgain = trip?.together ? h('button', {
    type: 'button', class: 'btn apart-again',
    onclick: () => {
      T.apartFrom = now.toLocaleDateString('sv');
      T.meet = null;
      save('together', { apartFrom: T.apartFrom, meet: null });
      renderTogether(screen);
    },
  }, '✈️ Снова врозь — с сегодня') : null;

  // Одна листівка на весь екран: угорі — «Врозь с», посередині — планети й сердечко, внизу — зустріч, ДР і «дней вместе»
  const postcard = h('div', { class: 'postcard' },
    h('div', { class: 'postcard-top' },
      h('h2', { class: 'postcard-title' }, 'Вместе'),
      apartAgain || h('label', { class: 'meet-row postcard-apart' }, h('span', {}, 'Врозь с'),
        clearable(apartInput, 'дату', () => { T.apartFrom = null; save('together', { apartFrom: null }); renderTogether(screen); }))),
    card,
    h('div', { class: 'postcard-foot' },
      h('label', { class: 'meet-row' }, h('span', {}, 'Когда встреча?'),
        clearable(meetInput, 'дату встречи', () => { T.meet = null; save('together', { meet: null }); renderTogether(screen); })),
      h('div', { class: 'bday-row' }, bday(mine[0], '🎂 Твой ДР'), bday(mine[1], side === 'vona' ? '🎂 Его ДР' : '🎂 Её ДР')),
      togetherDays(now, T.since)));
  screen.replaceChildren(postcard);

  // Планета другого: у нього — Земля (кінець шляху, 1), у неї — Юпітер (початок, 0)
  const theirPlanet = side === 'vin' ? 'earth' : 'jupiter';
  const theirEnd = side === 'vin' ? 1 : 0;
  flyHeart(card, heart, trip.progress);
  heartFrom(card, heart, trip.progress, theirEnd);
  // Донесли сердечко до планети другого — воно летить до нього (push «💞»); до своєї — лише ролик планети
  dragHeart(card, heart, trip.progress, (planet) => { if (planet === theirPlanet) sendHeart(); });
}

async function sendHeart() {
  const she = DATA.side === 'vin';
  try {
    const r = await send('together/heart', 'POST', {});
    if (r.again) toast('Сердечко уже летит — следующее можно через полминуты 💞');
    else if (!r.reaches) toast(`Отправлено 💞 ${she ? 'Она' : 'Он'} увидит, когда откроет «Вместе»`);
    else toast(`Сердечко улетело ${she ? 'к ней' : 'к нему'} 💞`);
    // У чаті з'явився рядок «💞 Люблю тебя!» — стрічка підтягне
    if (!r.again) document.dispatchEvent(new Event('radovalka:marked'));
  } catch {
    toast('Не улетело — нет связи');
  }
}

// Другий надіслав сердечко, а ми його ще не бачили — воно прилітає від його планети
const HEART_SEEN = 'radovalka:heart-seen';
async function heartFrom(card, heart, home, from) {
  try {
    const { at } = await get('together/heart');
    let seen = 0;
    try { seen = Number(localStorage.getItem(`${HEART_SEEN}:${DATA.side}`)) || 0; } catch { /* приватне вікно */ }
    if (!at || at <= seen || !card.isConnected) return;
    try { localStorage.setItem(`${HEART_SEEN}:${DATA.side}`, String(at)); } catch { /* нічого */ }
    flyHeart(card, heart, home, { from, duration: 1800, delay: 400 });
    toast(`💞 Сердечко от ${DATA.side === 'vin' ? 'неё' : 'него'}`);
  } catch { /* нема звʼязку — побачить наступного разу */ }
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
