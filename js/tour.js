// Знайомство від улюбленців. Перший день — тур: вітання, доступи одним тапом і головне на «Письмах».
// Далі щодня один «секретик» (раз на добу за Києвом, не в день туру): улюбленець вибовкує фішку й підсвічує, де вона.
// Розказані збираються в меню «Секретики питомцев». Ролі: push — собака-листоноша, memes — кіт, aside — лінива кішка.
// Тексти без роду читача; рід другого — з who(). Про сюрпризи лише натякаємо; сезони, свята, Луну й «Её фото» не чіпаємо
import { mascotImg, petName, petFor } from './icons.js';
import { h, reduceMotion, toast } from './ui.js';
import { DATA, who } from './data.js';
import { turnOn, pushState, testPush, disablePush } from './push.js';
import { applyTheme } from './theme.js';

const KEY = 'radovalka:toured';
const DAY_KEY = 'radovalka:toured-day';
const SECRETS_KEY = 'radovalka:secrets';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());
const her = () => DATA.side !== 'vin';
// «у него» / «у неё», «его» / «её» — про другого
const gen = () => (her() ? 'него' : 'неё');
const pet = (role) => petName(petFor(role)) || '';

// sel — що підсвітити (перше видиме зі списку); без sel або коли цілі нема — картка посередині.
// side — лише для цієї половини; perms — крок дозволів
const STEPS = [
  {
    who: 'push',
    text: () => `Привет! Я ${pet('push')}, ношу письма. ${pet('memes')} носит фото и гифки, ${pet('aside')} в основном лежит.\n\nПокажем, что тут где. Это быстрее, чем я бегу к миске.`,
  },
  {
    who: 'memes',
    perms: true,
    text: 'Сначала три разрешения. Нажми «Разрешить», и телефон спросит по очереди:',
  },
  {
    sel: '.feed-row.is-sealed, .feed-row.is-theirs, .feed-box .mk-wait, .feed-box',
    who: 'push',
    text: () => (document.querySelector('.feed-row.is-sealed')
      ? 'Это ваш чат. Новое письмо приходит конвертом, а я стучу уведомлением.\n\nТап по конверту, и оно откроется.'
      : 'Это ваш чат, новое внизу.\n\nСмахни сообщение вправо, чтобы ответить. Тап по цитате вернёт к тому сообщению.'),
  },
  {
    sel: '.checkin-row, .top-heart',
    who: 'push',
    text: () => `«Я в порядке»: один тап, и ${who().partner} узнает, что всё хорошо. Подержи ❤, чтобы добавить настроение.\n\n«💬 Как ты?» спрашивает в ответ, тоже одним тапом.`,
  },
  {
    sel: '.sos-slider, .top-sos',
    who: 'aside',
    text: () => `Красная кнопка — на крайний случай. Проведи кружок вправо, и у ${gen()} громко зазвонит даже без звука, с местом на карте и голосовым.\n\nРади такого я даже встану.`,
  },
  {
    sel: '.cbar-row, .cbar',
    who: 'memes',
    text: 'Здесь пишут. В «＋» фото, гифки, голос, файлы, письмо ко времени и игры.\n\nНад строкой видно, кто понесёт. Смахни мордочку, чтобы выбрать другого.',
  },
  {
    sel: '.cbar-act, .cbar-row',
    who: 'push',
    text: 'Голосовое: держи 🎤 и говори, отпустишь — уйдёт. Вверх — замок, чтобы не держать, влево — отмена.',
  },
  {
    sel: '.feed-row:not(.is-sealed), .feed-box',
    who: 'memes',
    text: 'Подержи палец на сообщении, и появятся реакции. У каждой своя анимация.\n\nТолько 🤮 мне не ставь, я ранимый.',
  },
  {
    who: 'push',
    text: () => `🔔 Звоночек: потряси телефон, и у ${gen()} он забьётся сердцем и зазвенит. В ответ можно нажать «Иду!» или «Чуть позже».`,
  },
  {
    sel: '.tab[data-tab=envelopes]',
    who: 'aside',
    text: 'Конверты «Открой, когда…»: тяжёлый день, скучаешь, не спится. Открывай подходящий, внутри записка.\n\n«Не спится» мой любимый. Я его не открываю, я сразу сплю.',
  },
  {
    sel: '.tab[data-tab=plans]',
    who: 'memes',
    text: () => `Планы: листай идеи, ❤️ или ✕. Совпало у обоих — значит, идёте.\n\nНаверху «Вместе»: сколько дней до встречи. Сердечко можно донести пальцем до ${her() ? 'его' : 'её'} планеты.`,
  },
  {
    sel: '.tab[data-tab=wish]',
    who: 'push',
    text: () => `Хотелки: пиши, чего хочется, и подглядывай, что хочется ${who().toWhom}.\n\nОтметки «присмотрено» и «куплено» видишь только ты.`,
  },
  {
    sel: '#about-btn',
    who: 'push',
    side: 'vona',
    text: 'В меню, в «Фото и песни», есть альбом «Его фото». Положи туда его снимки, и когда поставишь 🛡️ на его письмо, он появится прямо в щите.',
  },
  {
    sel: '#about-btn',
    who: 'memes',
    text: () => `Тап по «Радовалка» открывает настройки.\n\n${her() ? '«Оформление»: светлая или ночная тема, «По времени» и узор по сезону. ' : '«Оформление»: узор неба по сезону. '}«Звуки»: включить, выключить и выбрать свой инструмент. В «Письмах» — размер и шрифт букв.`,
  },
  {
    sel: '#about-btn',
    who: 'aside',
    text: 'Каждый день кто-то из нас выболтает по секретику. Все рассказанные собираются в меню.\n\nРассказала бы всё сразу, но лень.',
  },
];

// Секретики: по одному в день, у порядку. Перший вільний — той, що ще не розказано (лічильник на телефоні)
const SECRETS = [
  { who: 'memes', sel: '.cbar-row', text: 'Не знаешь, что написать? В «Написать…» есть «✨ Помочь»: выбери повод и настроение, и будут варианты. Я бы и сам помог, но у меня лапки.' },
  { who: 'push', text: 'Раз в пару дней на экран прилетит печенька 🥠. Коснись, и она разломится. Что внутри, не скажу: я её не ела. Честно. Почти.' },
  { who: 'aside', text: 'На фоне есть созвездие Стрельца. Тапни по нему. Что будет — не скажу: объяснять лень, а смотреть интересно.' },
  { who: 'memes', sel: '.cbar-row', text: '«＋» → 🎲 Игры: крестики, «Четыре в ряд», морской бой, «Найди пару» с нами на карточках. Играть можно на желание или на посуду. Я за посуду, мне всё равно не мыть.' },
  { who: 'push', text: 'В морском бое в кораблик можно спрятать записку. Её прочитают, только когда потопят. Топить корабли ради записки — это романтично, я считаю.' },
  { who: 'aside', text: 'В «Играх» есть дверь «Для двоих» 🔒. Мы туда не заходим, мы воспитанные. Но иногда подслушиваем.' },
  { who: 'memes', sel: '.cbar-row', text: 'В «＋» есть 🐾 Наклейка: можно отправить в чат кого-то из нас. Выбирай меня, у меня лучший профиль.' },
  { who: 'push', sel: '.cbar-row', text: 'Фото перед отправкой можно украсить: подпись, наклейки, рамка-сердце или щит, полароид, карандаш. А 💧 замажет то, что видеть не надо. Например, мою миску.' },
  { who: 'memes', sel: '.cbar-row', text: 'Гифки ищутся своими словами, по-русски: «обнимаю», «скучаю по тебе», «я злой кот». Последнее, кстати, про меня есть.' },
  { who: 'push', sel: '.cbar-row', text: '«＋» → 🎉 Праздничное: золотой конверт, хлопушки, конфетти, и приносим его мы все вместе. Я в колпаке. Не смейся.' },
  { who: 'aside', sel: '.cbar-row', text: '«＋» → 🕐 Ко времени: письмо придёт в нужный день и час. Можно написать сейчас, а отправить утром. Утром я сплю, но письмо донесут.' },
  { who: 'memes', text: () => `В реакциях есть группа «Про нас»: 🪐 Юпитер, 🏹 стрела Стрельца, 🌌 «Вселенная нас любит». Для 🌌 положи ваши фото в меню → «Фото и песни» → «Наши фото».` },
  { who: 'push', text: 'Среди реакций есть 🫡 «Да, капитан!». На сообщение падает пиратская треуголка. Я её ношу по выходным.' },
  { who: 'aside', sel: '.tab[data-tab=envelopes]', text: () => `Конверт оказался пустым? ${who().partner === 'он' ? 'Он' : 'Она'} узнает и допишет. А под конвертом есть «перечитать», там все старые записки. Я их перечитываю. Перед сном. Вместо сна.` },
  { who: 'memes', sel: '.tab[data-tab=plans]', text: 'В «Планах» у идеи три ответа: ❤️, ✕ и ⏳ «потом». Отложенные лежат внизу и ждут. Я тоже всё откладываю, это называется мудрость.' },
  { who: 'push', sel: '.tab[data-tab=plans]', text: '🎰 «Наугад» в «Планах»: один зовёт крутить, второй жмёт «Готов», и барабан выбирает из ваших общих тем. Что выпало, то и решено. Спорить с барабаном бесполезно, я пробовала.' },
  { who: 'aside', sel: '.tab[data-tab=plans]', text: 'В «Планах» есть кнопка 🍓. Что она делает, узнаешь, если нажать. Я отвернусь. Я и так всё время отвёрнута, я сплю.' },
  { who: 'memes', sel: '.tab[data-tab=wish]', text: 'Вставь в «Хотелки» ссылку из магазина и нажми «✨ Заполнить»: название, цена и фото встанут сами. А «К дате» подскажет, к какому празднику.' },
  { who: 'push', sel: '#about-btn', text: 'Меню → «Письма» → шрифт: Почерк, Открытка, Мягкий, Книжный. Там же «Открывать письма сразу», если конверты долго открывать. Мне не долго, я зубами.' },
  { who: 'aside', sel: '#about-btn', text: 'Меню → «Звуки» → «Мой инструмент»: у каждого свой, письмо звучит инструментом того, кто прислал. Мой инструмент — храп.' },
  { who: 'memes', sel: '#about-btn', text: () => `В «Оформлении» есть кнопка для розыгрыша. Нажмёшь, и ${who().partner} очень удивится. Подробностей не будет, я в этом не участвую. Наверное.` },
  { who: 'push', sel: '#about-btn', text: 'В «Оформлении» тему можно сделать «По времени»: ночная включится на закате и выключится на рассвете. Как я: на закате лаю, на рассвете тоже.' },
  { who: 'aside', text: 'Наклони телефон: фон уходит в глубину. Если укачивает, в меню → «Оформление» есть «Движение фона». Меня укачивает от любого движения.' },
  { who: 'memes', sel: '#about-btn', text: 'Меню → «Замок»: PIN или отпечаток при входе. «Нужна помощь» работает и с замка. Я за безопасность, особенно моей миски.' },
  { who: 'push', text: 'Фото из любой галереи можно отправить сюда через «Поделиться» → «Радовалка». Сразу откроется редактор. Я бы поделилась и сосиской, но не делюсь.' },
  { who: 'memes', sel: '.feed-box', text: 'Тап по дате в чате («Вчера», «12 ноября») сворачивает весь день. А ⋯ рядом с «Письма» очистит чат, только у тебя, и вернёт обратно. Порядок я люблю.' },
  { who: 'aside', sel: '#about-btn', text: 'Меню → «Фото и песни» → 🎵 Плейлист: все песни из ваших писем, можно слушать подряд. Под них отлично лежится.' },
  { who: 'push', sel: '.feed-box', text: 'Голосовое можно слушать на скорости 1×–2×. На 2× я звучу как щенок. Не проверяй.' },
  { who: 'memes', text: 'Нет связи? Радовалка покажет последнее и сама отправит, когда связь появится. А всё, что вы пишете, зашифровано: видите только вы двое. Даже я не читаю. Ну, почти не читаю.' },
  { who: 'aside', text: 'Секретики кончились. Дальше сами. Мы рядом: носим письма. И спим.' },
];

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* приватне вікно */ } },
};
const toured = () => store.get(KEY) === '1';
const mine = (s) => !s.side || s.side === DATA.side;
const readSecrets = () => { try { return JSON.parse(store.get(SECRETS_KEY)) || { n: 0, day: '' }; } catch { return { n: 0, day: '' }; } };

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
  if (!sel) return null;
  for (const one of sel.split(',')) {
    // У чаті свіже — внизу: беремо останній видимий, інакше тур прокрутив би стрічку до найстаршого
    const el = [...document.querySelectorAll(one)].findLast(visible);
    if (el) return el;
  }
  return null;
};

// Крок дозволів: сповіщення, місце (для «Нужна помощь»), мікрофон — одним тапом, кожен зі своєю галочкою
const PERMS = [
  ['push', '🔔', 'уведомления — чтобы письмо, ход в игре и звоночек не прошли мимо'],
  ['geo', '📍', 'место — только для «Нужна помощь», в обычные дни никто не смотрит'],
  ['mic', '🎙', 'микрофон — для голосовых'],
];
async function granted(kind) {
  // Дозволу мало: потрібна підписка на цьому телефоні (після перевстановлення дозвіл лишається, а підписки нема)
  if (kind === 'push') return (await pushState()) === 'on';
  try { return (await navigator.permissions.query({ name: kind === 'geo' ? 'geolocation' : 'microphone' })).state === 'granted'; } catch { return false; }
}
async function ask(kind) {
  if (kind === 'push') {
    // iPhone дає сповіщення лише застосунку з екрана «Домой» — у Safari їх нема зовсім: кажемо, що зробити
    if (!('Notification' in window)) {
      toast(/iPhone|iPad/.test(navigator.userAgent) ? 'На iPhone уведомления работают, когда Радовалка на экране «Домой»: «Поделиться» → «На экран «Домой»», и открыть оттуда' : 'Этот браузер не умеет уведомления — открой Радовалку в Chrome');
      return false;
    }
    return turnOn();
  }
  if (kind === 'geo') {
    return new Promise((done) => {
      if (!navigator.geolocation) { done(false); return; }
      navigator.geolocation.getCurrentPosition(() => done(true), () => done(false), { timeout: 20000, maximumAge: 600000 });
    });
  }
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return true;
  } catch { return false; }
}
function permsBlock(onDone) {
  const rows = PERMS.map(([kind, icon, label]) => {
    const mark = h('span', { class: 'tour-perm-mark', 'aria-hidden': 'true' }, '○');
    const li = h('li', { class: 'tour-perm' }, mark, h('span', {}, `${icon} ${label}`));
    granted(kind).then((ok) => { if (ok) { mark.textContent = '✓'; li.classList.add('is-ok'); } });
    return { kind, mark, li };
  });
  const run = async () => {
    // Дозвіл на сповіщення — прямо з тапу, до будь-якого запиту в мережу: iPhone інакше вікна не покаже, Android — покаже тихо.
    // Підписка (ключ із сервера) — уже після, дозвіл тоді вже є
    const pr = rows.find((r) => r.kind === 'push');
    const pre = pr && !pr.li.classList.contains('is-ok') && 'Notification' in window && Notification.permission === 'default' ? Notification.requestPermission() : null;
    if (pre) { pr.mark.textContent = '…'; await pre.catch(() => {}); }
    // Далі по черзі: сповіщення (підписка), місце, мікрофон
    for (const r of rows) {
      if (r.li.classList.contains('is-ok')) continue;
      r.mark.textContent = '…';
      const ok = await ask(r.kind);
      r.mark.textContent = ok ? '✓' : '✕';
      r.li.classList.toggle('is-ok', ok);
      r.li.classList.toggle('is-no', !ok);
    }
    // Сповіщення ввімкнулись — одразу справжнє пробне: прийшло на телефон, значить, працює
    if (pr?.li.classList.contains('is-ok')) testPush().then(() => toast('🔔 Сейчас придёт проверочное уведомление — значит, всё работает')).catch(() => {});
    if (rows.some((r) => !r.li.classList.contains('is-ok'))) toast('Не всё разрешено — включить можно потом в настройках телефона');
    onDone();
  };
  return { list: h('ul', { class: 'tour-perms' }, ...rows.map((r) => r.li)), run };
}

// Спільний шар: підсвітка цілі й картка з улюбленцем. steps — список кроків; secret — режим секретика
function overlay(steps, { secret = false, onFinish = () => {} } = {}) {
  let i = -1;
  const hole = h('div', { class: 'tour-hole', 'aria-hidden': 'true' });
  const petEl = h('span', { class: 'mascot tour-pet', 'aria-hidden': 'true' });
  const say = h('div', { class: 'bubble tour-say', 'aria-live': 'polite' });
  const dots = h('span', { class: 'tour-dots', 'aria-hidden': 'true' }, ...(secret ? [] : steps.map(() => h('i'))));
  // Обробник — властивістю onclick (go ставить свій на кожен крок, а крок дозволів — «Разрешить»)
  const next = h('button', { type: 'button', class: 'btn btn-primary tour-next' }, 'Дальше');
  const skip = h('button', { type: 'button', class: 'btn tour-skip', onclick: () => (secret ? finish(openSecrets) : finish()) }, secret ? 'Все секретики' : 'Пропустить');
  const card = h('div', { class: 'tour-card' }, h('div', { class: 'tour-talk' }, petEl, say), h('div', { class: 'tour-foot' }, skip, dots, next));
  // Шар ловить усі дотики: під час туру нічого під ним не натискається
  const root = h('div', { class: 'tour', role: 'dialog', 'aria-modal': 'true', 'aria-label': secret ? 'Секретик от питомца' : 'Знакомство с Радовалкой' }, hole, card);
  const onKey = (e) => { if (e.key === 'Escape') finish(); };
  const onResize = () => place(find(steps[i]?.sel));

  function finish(then) {
    document.removeEventListener('keydown', onKey);
    removeEventListener('resize', onResize);
    root.remove();
    onFinish();
    then?.();
  }

  function place(el) {
    if (!el) {
      // Без цілі — уся сторінка під завісою, картка посередині
      Object.assign(hole.style, { top: '50%', left: '50%', width: '0px', height: '0px' });
      card.classList.add('is-center');
      card.style.top = '';
      card.style.bottom = '';
      return;
    }
    card.classList.remove('is-center');
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
    // Нижнє меню нерухоме; решту (і шапку — вона їде разом зі сторінкою) — у середину екрана
    if (el && !el.closest('.tabs')) el.scrollIntoView({ block: 'center' });
    place(el);
    const key = petFor(s.who);
    const name = petName(key);
    const last = i === steps.length - 1;
    petEl.innerHTML = key ? mascotImg(key, last || i === 0 ? 'festive' : 'main') : '';
    petEl.hidden = !key;
    const text = typeof s.text === 'function' ? s.text() : s.text;
    say.replaceChildren(...String(text).split('\n\n').map((para, k) => h('p', {}, ...[k === 0 && name ? h('b', {}, `${name}: `) : null, para].filter(Boolean))));
    next.textContent = secret ? 'Понятно 🐾' : last ? 'Начнём 💜' : 'Дальше';
    next.onclick = () => go(i + 1);
    if (s.perms) {
      const { list, run } = permsBlock(() => { next.textContent = 'Дальше'; next.disabled = false; next.onclick = () => go(i + 1); });
      say.append(list);
      next.textContent = 'Разрешить 🐾';
      next.onclick = () => { next.disabled = true; run(); };
    }
    // Улюбленці говорять по черзі з різних боків — і щоразу заново «застрибують»
    card.classList.toggle('is-right', i % 2 === 1);
    petEl.classList.remove('is-hop');
    void petEl.offsetWidth;
    petEl.classList.add('is-hop');
    [...dots.children].forEach((d, k) => d.classList.toggle('is-on', k === i));
    next.focus({ preventScroll: true });
  }

  document.body.append(root);
  document.addEventListener('keydown', onKey);
  addEventListener('resize', onResize);
  go(0);
}

// Перший день наново (репетиція): листівка, тур, секретики, оформлення й підказки, підписка на push.
// Ключ, секрет, ПІН, чернетки й черга лишаються; дозволи браузера застосунок скинути не може — лише налаштування сайту
const FIRST_DAY = ['welcomed', 'toured', 'toured-day', 'secrets', 'season', 'theme', 'letter-font', 'text-size', 'emoji-kind', 'sticker-pet',
  'recent-stickers', 'recent-colors', 'push-ask', 'push-off', 'mood-tip', 'voice-hint', 'checkin-folded', 'auto-open', 'sound-off', 'still'];
export async function forgetFirstDay() {
  // Не довше 3 с: без сервіс-воркера (чи звʼязку) відписка може не відповісти зовсім — тур однаково спитає
  try { await Promise.race([disablePush(), new Promise((ok) => { setTimeout(ok, 3000); })]); } catch { /* так само */ }
  for (const k of FIRST_DAY) { try { localStorage.removeItem(`radovalka:${k}`); } catch { /* приватне вікно */ } }
}

// Перший день у неї — «Весна» й світла тема, якщо сама ще нічого не обирала (далі міняє в «Оформлении»)
export function firstDayLook() {
  if (!her() || toured()) return;
  try {
    if (!localStorage.getItem('radovalka:season')) localStorage.setItem('radovalka:season', 'spring');
    if (!localStorage.getItem('radovalka:theme')) localStorage.setItem('radovalka:theme', 'light');
  } catch { /* приватне вікно */ }
  applyTheme();
}

export function startTour() {
  if (document.querySelector('.tour')) return;
  firstDayLook();
  overlay(STEPS.filter(mine), {
    onFinish: () => {
      store.set(KEY, '1');
      // У день туру секретиків не буде — перший завтра
      if (!store.get(DAY_KEY)) store.set(DAY_KEY, today());
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      // Чат — знову на свіжому
      const box = document.querySelector('.feed-box');
      box?.scrollTo({ top: box.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
    },
  });
}

// Секретик дня: лише після туру, не в його день, раз на добу, коли на екрані нічого не відкрито і видно «Письма»
const BUSY = '.tour, .welcome, .backdrop, .reader, .cookie-layer, .sheet, .photo-view, .plan-match, .lock, .pin-keys';
const mySecrets = () => SECRETS.filter(mine);
export function maybeSecret() {
  if (!toured() || document.visibilityState !== 'visible' || document.body.classList.contains('is-booting')) return;
  const d = today();
  const st = readSecrets();
  if (store.get(DAY_KEY) === d || st.day === d || st.n >= mySecrets().length) return;
  if (document.querySelector(BUSY) || !document.querySelector('.tab.is-active[data-tab="letter"]')) return;
  const s = mySecrets()[st.n];
  store.set(SECRETS_KEY, JSON.stringify({ n: st.n + 1, day: d }));
  overlay([s], { secret: true });
}
// Старт, повернення в застосунок і хвилинна перевірка: зайняте зараз — спробуємо пізніше
let secretTimer = 0;
export function watchSecrets() {
  const later = (ms) => { clearTimeout(secretTimer); secretTimer = setTimeout(maybeSecret, ms); };
  later(6000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') later(4000); });
  setInterval(maybeSecret, 60000);
}

// Меню → «Секретики питомцев»: уже розказані, решта — замочками
export const secretsNote = () => {
  const n = Math.min(readSecrets().n, mySecrets().length);
  return n ? `Рассказано ${n} из ${mySecrets().length}` : 'Питомцы начнут выбалтывать со следующего дня';
};
export function openSecrets() {
  const all = mySecrets();
  const n = Math.min(readSecrets().n, all.length);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', onKey); box.remove(); backdrop.remove(); };
  const items = all.slice(0, n).map((s) => {
    const name = petName(petFor(s.who));
    return h('li', { class: 'secret-item' }, name ? h('b', {}, `${name}: `) : null, typeof s.text === 'function' ? s.text() : s.text);
  });
  const rest = all.length - n;
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const box = h('div', { class: 'sheet sheet-together sheet-about sheet-secrets', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Секретики питомцев' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    h('div', { class: 'sheet-inner' },
      h('h2', { class: 'title' }, 'Секретики питомцев'),
      h('p', { class: 'about-sub' }, secretsNote()),
      items.length ? h('ol', { class: 'secret-list' }, ...items) : null,
      rest ? h('p', { class: 'secret-rest' }, `🔒 Ещё ${rest} — по одному в день`) : null));
  document.body.append(backdrop, box);
  document.addEventListener('keydown', onKey);
}
