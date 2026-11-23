// Старт: ключ → дані з сервера → екрани; без ключа — замок
import { DATA, who } from './data.js';
import { get, send, getBlob, save, getKey, setKey, getAltKey, swapKeys, takeKeyFromUrl, rememberSide, forgetSaved, parseKey } from './api.js';
import { lock, watchResume, pinPanel, clearPin } from './pin.js';
import { forgetSecret, hasSecret, seal, sealBlob } from './seal.js';
import { VERSION, NEWS } from './version.js';
import { mascotImg, petName, petFor, petLine, loadPets, firstPose, letterPose } from './icons.js';
import { openWrite, prewarmWrite } from './write.js';
import { US, HER } from './usphoto.js';
import { composeBar, composeReply, composeFocus, composeLeave } from './compose.js';
import { letterFeed, chatTitle, refreshFeed, invalidateFeed, feedFresh, findLetter, feedLoaded, redrawFeed, feedToLatest, autoOpen, setAutoOpen } from './feed.js';
import { renderWishes, loadWishes, wishFromShare, linkIn, markWishes, forgetFreshWishes } from './wishes.js';
import { h, toast, cap, reduceMotion, aboutGroup, aboutRow, aboutRowBody, waxSeal, SAGITTARIUS_GLYPH, signLine, ENV_POCKET as POCKET, hhmm } from './ui.js';
import { renderEnvelopes, markEnvelopes } from './envelopes.js';
import { renderTogether, chipLabel, chipFestive } from './together.js';
import { loadPlans, markPlans, refreshPlans, renderPlans, showOurs, showWheel, showDeck } from './plans.js';
import { composeMeme } from './memes.js';
import { maybeWelcome } from './welcome.js';
import { startTour } from './tour.js';
import { showLock } from './lock.js';
import { pushAsk, pushPanel, syncPush, disablePush } from './push.js';
import { startLive, check as checkLive } from './live.js';
import { startBell } from './bell.js';
import { sfx, soundOn, setSound, INSTRUMENTS, INSTRUMENT_FAMILIES, instrumentKey, DEFAULT_INSTRUMENT, myInstrument, setMyInstrument, partnerInstrument, setPartnerInstrument, preview } from './sound.js';
import { openDuel } from './duel.js';
import { openSame } from './same.js';
import { openHot } from './hot.js';
import { initBack, tabChanged, leave } from './back.js';
import { initVoice } from './voice.js';
import { deliver, startOutbox } from './outbox.js';
import { applyTextSize, textSizePanel } from './textsize.js';
import { checkinRow, checkIn, paint as paintCheckin } from './checkin.js';
import { sosBox, loadSos, sosCheck, sosSlider } from './sos.js';
import { startDepth, isStill, setStill } from './depth.js';
import { maybeCookie } from './cookie.js';
import { burst } from './fx.js';
import { markFestive, writeDecor } from './depth.js';
import { ask } from './ask.js';

// Небо його половини — під усім, фіксоване; на її половині сховане стилем
// Фон обох половин — шарами на різній глибині, що зсуваються від нахилу телефона
startDepth();

const screen = document.getElementById('screen');
// Розмір букв у листах — до першого малювання, без стрибка
applyTextSize();


let tab = 'letter';

// Привітальний лист-заготовка — перше повідомлення чату. Його стан { opened, liked, reply, at } — у mine.letter за датою;
// at — коли його вперше показали на цьому телефоні (власного часу в заготовки нема)
function welcomeState() {
  const s = DATA.mine.letter;
  return s && s.date === DATA.welcome.date ? s : { date: DATA.welcome.date };
}

function setWelcome(patch) {
  DATA.mine.letter = { ...welcomeState(), ...patch };
  save('mine', { letter: DATA.mine.letter });
}

// Для стрічки й шторки: текст заготовки + стан цього телефона; tpl — лист без відправника
function welcomeLetter() {
  if (!DATA.welcome) return null;
  if (!welcomeState().at) setWelcome({ at: Date.now() });
  const st = welcomeState();
  return { ...DATA.welcome, tpl: true, id: null, at: st.at, opened: !!st.opened, liked: !!st.liked, reply: st.reply || null };
}

// t — { id, tpl }: який лист міняємо. Справжній тримає стан на сервері — так відправник бачить «открыла», ❤️ і відповідь
function patchLetter(t, patch) {
  if (t.tpl) setWelcome(patch);
  else {
    const l = findLetter(t.id);
    if (l) Object.assign(l, patch);
    // Найновіший лист живе ще й у DATA.letter — без цього крапка на марці не згасла б
    if (DATA.letter?.id === t.id) Object.assign(DATA.letter, patch);
    save(`letters/${t.id}`, patch);
  }
  markLetter();
}

// Лист із застосунку: дата — з часу показу за годинником телефона, репліка кур'єра — за родом
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function prepLetter(l) {
  if (l?.at) l.date = isoDay(new Date(l.at));
  if (l?.mascot && !l.mascotLine && DATA.mascots[l.mascot]) {
    l.mascotLine = petLine(l.mascot, 'letter',
      DATA.mascots[l.mascot].g === 'f' ? 'Принесла тебе письмо. Бежала со всех лап 💌' : 'Принёс тебе письмо. Нёс бережно 💌', l.id ?? l.at);
  }
  return l;
}

// Сургучна крапка на марці «Письма»: непрочитане в чаті чи привітальний лист
function markLetter() {
  const w = DATA.welcome && !welcomeState().opened;
  // Поки чат не завантажено — дивимось на найновіший лист із boot
  const early = !feedLoaded() && !!DATA.letter?.id && !DATA.letter.opened;
  const fresh = w || early || feedFresh() > 0;
  document.querySelector('.tab[data-tab="letter"]')?.classList.toggle('has-new', fresh);
}

// Push ще нема: свіжий лист і мемчики дотягуємо при поверненні в застосунок
async function refreshLetter() {
  try {
    const { letter, checkins, us, her } = await get('letter');
    // Альбоми фото змінили, поки застосунок був у фоні (старий воркер us/her не віддає — тоді не чіпаємо)
    if (us !== undefined && us !== (DATA.us || null)) US.sync(us);
    if (her !== undefined && her !== (DATA.her || null)) HER.sync(her);
    if (checkins && JSON.stringify(checkins) !== JSON.stringify(DATA.checkins)) {
      DATA.checkins = checkins;
      paintCheckin();
    }
    if (letter?.id !== DATA.letter?.id || letter?.text !== DATA.letter?.text) {
      DATA.letter = prepLetter(letter);
      markLetter();
      if (tab === 'letter') render();
    }
  } catch { /* нема зв'язку — лишаємо, що є */ }
}

const DAY_LABEL = new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' });
function dayLabel(iso) {
  const s = DAY_LABEL.format(new Date(iso + 'T12:00'));
  return s[0].toUpperCase() + s.slice(1);
}

// Над листом — день і час, коли він прийшов
const letterWhen = (l) => (l.at
  ? `${dayLabel(l.date)} · ${hhmm(l.at)}`
  : dayLabel(l.date));

const festive = (l) => l.kind === 'date';

function courier(letter) {
  // Лист до особливої дати несуть усі разом: у святковому ковпаку, інакше у святковій позі (де вони є)
  if (festive(letter)) {
    return h('div', { class: 'courier courier-all' },
      h('span', { class: 'mascots' }, ...Object.keys(DATA.mascots).map((k) => h('span', { class: 'mascot', html: mascotImg(k, firstPose(k, 'party', 'festive')) }))),
      h('p', { class: 'bubble' }, 'Мы принесли всей командой — сегодня особенный день! 🎉'));
  }
  if (!DATA.mascots[letter.mascot]) return null;
  return h('div', { class: 'courier' },
    h('span', { class: 'mascot', html: mascotImg(letter.mascot, letterPose(letter.mascot, letter.id ?? letter.date)) }),
    h('p', { class: 'bubble' }, h('b', {}, `${petName(letter.mascot)}: `), letter.mascotLine));
}

// Відкритий лист: кур'єр лишається поруч, менший; без кур'єра в листі — той, хто зазвичай приносить
const READ_LINES = ['Ответишь? Я отнесу 💌', 'Я рядом, пока читаешь.', 'Перечитывай сколько хочешь.'];
function readCourier(letter) {
  const pet = DATA.mascots[letter.mascot] ? letter.mascot : petFor('push');
  if (!pet) return null;
  const day = new Date().getDate();
  const line = petLine(pet, 'read', READ_LINES[day % READ_LINES.length], `${letter.id ?? letter.date}:${day}`);
  return h('div', { class: 'courier courier-read' },
    h('span', { class: 'mascot', html: mascotImg(pet, letterPose(pet, letter.id ?? letter.date)) }),
    h('p', { class: 'bubble' }, h('b', {}, `${petName(pet)}: `), line));
}

// «Письма» — міні-чат: заголовок, блок «Я в порядке + SOS» (render), переписка, «Написать…».
// Лист відкривається з чату шторкою на весь екран: конверт із печаттю, потім сам лист
const FEED_OPS = {
  open: (l) => openLetter(l),
  welcome: () => welcomeLetter(),
  like: () => { setWelcome({ liked: !welcomeState().liked }); redrawFeed(); markLetter(); },
  reply: () => openReply({ id: null, tpl: true }),
  // Відповідь із чату — цитата над рядком «Написать…»
  compose: (o) => (o?.reply ? composeReply(o.reply) : composeFocus()),
  go: (t) => goTo(t),
};

function renderLetter() {
  const parts = [chatTitle(), pushAsk(), letterFeed(FEED_OPS)].filter(Boolean);
  // Рядок «Написать…» — той самий вузол: перемальовуємо все навколо, а його не виймаємо з екрана,
  // інакше поле втратить фокус і клавіатура сховається посеред набору
  const bar = composeBar();
  if (bar.parentNode === screen) {
    [...screen.children].forEach((c) => { if (c !== bar) c.remove(); });
    bar.before(...parts);
  } else screen.replaceChildren(...parts, bar);
}

// Шторка тримає лише { id, tpl }: фонове оновлення підміняє об'єкти листів у кеші
let sheet = null;
const sheetLetter = () => (sheet.tpl ? welcomeLetter() : findLetter(sheet.id));

function openLetter(l) {
  if (sheet) return;
  const box = h('div', { class: 'day-body' });
  const backdrop = h('div', { class: 'backdrop', onclick: closeLetter });
  const el = h('div', { class: 'sheet sheet-full day-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Письмо' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: closeLetter }, '✕'),
    h('div', { class: 'sheet-inner' }, box));
  sheet = { id: l.id, tpl: !!l.tpl, el, box, backdrop };
  document.body.append(backdrop, el);
  fillLetter();
}

// Вкладення святкового листа: картинки над текстом, голос і пісні — під ним (як у конверті). Вантажиться раз на шторку
// (перемальовування бере ті самі вузли), модуль вкладень — лише коли воно є. Повертає [над, під]
function letterAttach(l) {
  if (!l.media) return [null, null];
  if (sheet.att) return [sheet.att.el, sheet.att.below];
  const el = h('div', { class: 'letter-att' });
  const below = h('div', { class: 'letter-att' });
  sheet.att = { el, below, stop: () => {} };
  const mine = sheet;
  import('./envattach.js').then((ea) => ea.renderAttach(l, { split: true })).then((m) => {
    if (sheet !== mine) { m.stop(); return; }
    mine.att.stop = m.stop;
    el.replaceChildren(...[m.el].filter(Boolean));
    below.replaceChildren(...[m.sound].filter(Boolean));
  }).catch(() => {
    if (sheet === mine) el.replaceChildren(h('p', { class: 'ea-gone' }, '📎 Вложение не загрузилось — нет связи. Открой письмо ещё раз позже'));
  });
  return [el, below];
}

function closeLetter() {
  if (!sheet) return;
  sheet.att?.stop();
  sheet.backdrop.remove();
  sheet.el.remove();
  sheet = null;
  redrawFeed();
  markLetter();
}

// Вміст шторки: запечатаний конверт або сам лист
function fillLetter() {
  if (!sheet) return;
  const l = sheetLetter();
  // Відправник забрав лист, поки його не відкрили
  if (!l) { if (feedLoaded()) closeLetter(); return; }
  prepLetter(l);
  const head = [
    h('p', { class: 'day' }, letterWhen(l)),
    h('h2', { class: 'title' }, festive(l) ? 'Праздничное письмо 🎉' : l.opened ? 'Письмо для тебя' : 'Тебе письмо 💌'),
  ];

  if (!l.opened) {
    const env = h('button', {
      type: 'button',
      class: `envelope${festive(l) ? ' is-festive' : ''}`,
      'aria-label': 'Открыть письмо',
      onclick: () => openEnvelope(env),
    },
    h('span', { class: 'env-back' }),
    h('span', { class: 'paper-peek' }),
    h('span', { class: 'env-front', html: POCKET }),
    h('span', { class: 'env-flap' }),
    h('span', { class: 'seal', 'aria-hidden': 'true', html: waxSeal(SAGITTARIUS_GLYPH) }));
    sheet.box.replaceChildren(...head, h('div', { class: 'stage' },
      env,
      h('p', { class: 'hint' }, 'Коснись печати, чтобы открыть'),
      courier(l)));
    // Святковий — мерехтіння довкола (модуль вантажиться лише для нього)
    if (festive(l)) import('./festive.js').then((m) => m.decorEnvelope(env)).catch(() => {});
    return;
  }

  // replaceChildren не пропускає null, на відміну від h()
  sheet.box.replaceChildren(...[
    ...head,
    h('article', { class: `letter${festive(l) ? ' is-special' : ''}` },
      ...[...(() => { const [top, under] = letterAttach(l); return [top, l.text ? h('p', { class: 'letter-text' }, l.text) : null, under]; })(),
        signLine(DATA.partnerSign, who().from)].filter(Boolean)),
    h('div', { class: 'actions' },
      h('button', {
        type: 'button',
        class: 'btn btn-heart',
        'aria-pressed': String(!!l.liked),
        'aria-label': 'Сердечко',
        onclick: toggleHeart,
      }, h('span', { class: 'heart', 'aria-hidden': 'true' }, l.liked ? '❤️' : '🤍'), l.liked ? 'Нравится' : 'Сердечко'),
      l.reply ? null : h('button', { type: 'button', class: 'btn btn-primary', onclick: () => openReply(sheet) }, 'Ответить')),
    l.reply ? h('div', { class: 'reply-sent' }, h('span', {}, 'Твой ответ'), l.reply) : null,
    festive(l) ? null : readCourier(l),
  ].filter(Boolean));
}

function openEnvelope(env) {
  // Святковий: хлопавки на печатці, кульки — коли лист розкрився
  const fest = env.classList.contains('is-festive') ? import('./festive.js').catch(() => null) : null;
  const done = () => {
    patchLetter(sheet, { opened: true });
    fillLetter();
    redrawFeed();
    fest?.then((m) => m?.balloons());
  };
  if (reduceMotion) return done();
  fest?.then((m) => m?.popConfetti());
  env.classList.add('is-opening');
  env.disabled = true;
  setTimeout(() => { if (sheet) done(); }, 1050);
}

function toggleHeart() {
  const l = sheetLetter();
  if (!l) return;
  const liked = !l.liked;
  patchLetter(sheet, { liked });
  fillLetter();
  if (liked) burst(document.querySelector('.sheet .btn-heart'));
  // Привітальний — без відправника, ❤️ лишається на цьому телефоні; «увидит» — лише справжньому листу
  if (liked && !sheet.tpl) toast(`${cap(who().partner)} увидит твоё ❤️`);
}

// t — { id, tpl }: відповідь на лист — шторка листа (якщо відкрита) закривається, цитата стає над рядком «Написать…»
function openReply(t) {
  const target = { id: t.id, tpl: t.tpl };
  const l = target.tpl ? welcomeLetter() : findLetter(target.id);
  if (!l) return;
  closeLetter();
  composeReply({
    quote: l.text.length > 300 ? `${l.text.slice(0, 300)}…` : l.text,
    on: 'letter',
    // Відповідь — нове повідомлення (його надсилає рядок); тут лише «прочитано»
    sent: () => {
      if (l.opened) return;
      patchLetter(target, { opened: true });
      fillLetter();
    },
  });
}

function render() {
  // Шапку перемальовує блок «Я в порядке», коли згорнутий
  document.querySelector('.top')?.classList.remove('has-checkin');
  // «Вместе N дн.» у шапці поки не показуємо (місце придумаємо); вхід — у меню Радовалки
  chip.classList.add('is-off');
  // Чужий сигнал SOS і блок «Я в порядке» — однакові на всіх вкладках: на «Письмах» — у самому екрані (чат під ним), на інших — над екраном,
  // щоб вкладка, перемальовуючи себе, його не стирала
  checkinSlot.replaceChildren(...(tab === 'letter' ? [] : [sosBox(), checkinRow()]));
  // «Письма» — екран без прокрутки сторінки: гортається лише чат, блок «Я в порядке + SOS» завжди на місці
  const chat = tab === 'letter';
  screen.classList.toggle('is-chat', chat);
  // Окрема назва, не is-chat: зміна класу, що є в правилах «.is-chat .нащадок», перераховує стилі всієї сторінки разом із фоном
  document.body.classList.toggle('is-chat-page', chat);
  // Поки пишуть, вкладки сховані (висота 0) — тоді лишаємо заміряну раніше
  // Читання висоти змушує браузер перерахувати розкладку посеред перемальовування — лише там, де вона потрібна
  const tabsH = chat ? document.querySelector('.tabs').offsetHeight : 0;
  // Змінна на корені перераховує стилі всієї сторінки — пишемо лише нову
  const root = document.documentElement.style;
  if (chat && tabsH && root.getPropertyValue('--tabs-h') !== `${tabsH}px`) root.setProperty('--tabs-h', `${tabsH}px`);
  if (tab !== 'letter') composeLeave();
  if (tab === 'letter') {
    renderLetter();
    // Першим на екрані, над «Письмами»: сигнал «Нужна помощь» (якщо є), потім блок «Я в порядке» з повзунком допомоги
    screen.prepend(...[sosBox(), checkinRow()].filter(Boolean));
  }
  else if (tab === 'envelopes') renderEnvelopes(screen);
  else if (tab === 'plans') {
    // Планы: збережене одразу, свіже — слідом (друга половина могла проголосувати чи додати)
    renderPlans(screen);
    loadPlans().then(() => { markPlans(); if (tab === 'plans') renderPlans(screen); }).catch(() => {});
  } else {
    // Хотелки: показуємо збережене й одразу дотягуємо свіже (друга половина могла дописати)
    const had = !!DATA.wishes;
    renderWishes(screen);
    // Перемальовуємо, лише якщо справді змінилось: інакше «новое» вдруге підстрибує, а фото блимають
    const before = JSON.stringify(DATA.wishes);
    // Те саме — лишаємо старі обʼєкти: на них тримаються кнопки «присмотрел / куплено», інакше перший тап губиться
    const old = DATA.wishes;
    if (had) loadWishes().then(() => { if (JSON.stringify(DATA.wishes) === before) DATA.wishes = old; else if (tab === 'wish') renderWishes(screen); }).catch(() => {});
  }
}

// Половину визначає ключ: її ключ — лаванда, його — космос
function applySide() {
  document.documentElement.dataset.side = DATA.side;
  document.querySelector('meta[name="theme-color"]').content = DATA.side === 'vin' ? '#0B384B' : '#EADFFB';
  // Встановлять застосунок у цій же сесії — заставка вже його кольору, не з першого завантаження
  document.querySelector('link[rel="manifest"]').href = DATA.side === 'vin' ? 'manifest-vin.webmanifest' : 'manifest.webmanifest';
  rememberSide(DATA.side);
}

// Обидва ключі на цьому телефоні (він перевіряє обидві половини) — перемикач «🪐 Я | 🌸 Она» у меню Радовалки
function sideSwitch() {
  const vin = DATA.side === 'vin';
  const seg = h('button', { type: 'button', class: 'side-seg', 'aria-label': vin ? 'Открыть её половину' : 'Открыть его половину',
    onclick: () => { swapKeys(); leave(() => location.replace(location.pathname)); } },
  h('span', { class: 'is-on' }, vin ? '🪐' : '🌸', h('i', {}, ' Я')), h('span', {}, vin ? '🌸' : '🪐', h('i', {}, vin ? ' Она' : ' Он')));
  return seg;
}

// fromBack — вкладку повернула кнопка «Назад»: історію вже зсунув телефон
function selectTab(name, fromBack = false) {
  if (!fromBack) tabChanged(tab, name);
  if (tab === 'wish' && name !== 'wish') forgetFreshWishes();
  tab = name;
  if (name === 'letter') { refreshLetter(); invalidateFeed(); }
  // Тап по «Письма» — до найсвіжішого; «Назад» повертає туди, де читали
  if (name === 'letter' && !fromBack) feedToLatest();
  document.querySelectorAll('.tab').forEach((x) => {
    const on = x.dataset.tab === name;
    x.classList.toggle('is-active', on);
    if (on) x.setAttribute('aria-current', 'page');
    else x.removeAttribute('aria-current');
  });
  render();
}

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => selectTab(t.dataset.tab)));
initBack((name) => selectTab(name, true));
// 🎤 біля полів з data-voice — у шторках, що з'являються пізніше, теж
initVoice();
// Надіслав лист — «Мои» на вкладці «Письма» одразу з ним
// «Я в порядке» / «Как ты?» — рядок у чаті тихо, без перемальовки всього екрана
document.addEventListener('radovalka:marked', () => refreshFeed());
document.addEventListener('radovalka:sent', () => { invalidateFeed(); if (tab === 'letter') render(); else refreshFeed(); });
// Тап по сповіщенню при відкритій Радовалці — на «Письма», свіже дотягне visibilitychange
const GO_TABS = ['letter', 'wish', 'plans'];
// «env:<id>» — сповіщення про порожній конверт: «Написать» одразу в цей конверт; «write» — відкрила конверт-сигнал
function goTo(go) {
  const envId = String(go || '').startsWith('env:') ? go.slice(4) : null;
  if (envId || go === 'write') {
    if (tab !== 'letter') selectTab('letter');
    openWrite(envId ? { where: 'env', envId } : {});
    return true;
  }
  // «Крутим?» і «Колесо выбрало» — у «Планах» одразу колесо
  // «Новый план» — у колоду «Идеи», щоб одразу проголосувати
  // «Встреча 💞» — одразу шторка «Вместе»
  if (go === 'together') { openTogether(); return true; }
  // «✊ Спор» — на «Письма» і одразу сам спор
  if (go === 'duel' || go.startsWith('duel:')) { if (tab !== 'letter') selectTab('letter'); openDuel({ game: go.slice(5) || 'rps' }); return true; }
  // «💞 Совпадёт?» — так само
  if (go === 'same') { if (tab !== 'letter') selectTab('letter'); openSame(); return true; }
  if (go === 'hot') { if (tab !== 'letter') selectTab('letter'); openHot(); return true; }
  if (go === 'wheel') { showWheel(); go = 'plans'; } else if (go === 'deck') { showDeck(); go = 'plans'; } else if (go === 'plans') showOurs();
  if (!GO_TABS.includes(go)) return false;
  if (tab !== go) selectTab(go);
  else if (go === 'plans') render();
  return true;
}
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (document.body.classList.contains('is-booting')) return;
  // Прийшов push при відкритій Радовалці — свіже одразу, не чекаючи перевірки за таймером
  if (e.data?.refresh) { checkLive(); return; }
  if (goTo(e.data?.go)) refreshAll();
});
// Стрічка дізналась про нове або його побачили — оновити крапку на марці
document.addEventListener('radovalka:fresh', () => {
  markLetter();
  // Лист, відкритий у шторці, відправник забрав — закриваємо
  if (sheet && !sheet.tpl && feedLoaded() && !findLetter(sheet.id)) closeLetter();
});

// «Поделиться → Радовалка»: service worker поклав картинку в кеш і відкрив ?go=shared.
// Забираємо лише після входу — якщо замок, картинка чекає в кеші
async function takeShared() {
  const go = new URLSearchParams(location.search).get('go');
  // Застосунок відкрили тапом по сповіщенню (хотілка, порожній конверт)
  if (go && go !== 'shared') { history.replaceState(null, '', location.pathname); goTo(go); return; }
  if (go !== 'shared') return;
  history.replaceState(null, '', location.pathname);
  let file = null;
  let none = false;
  let link = '';
  try {
    const cache = await caches.open('shared-radovalka');
    const res = await cache.match('shared');
    none = !!(await cache.match('shared-none'));
    link = linkIn(await (await cache.match('shared-link'))?.text());
    if (res) {
      const blob = await res.blob();
      file = new File([blob], 'shared', { type: blob.type || 'image/jpeg' });
    }
    await Promise.all(['shared', 'shared-none', 'shared-link'].map((k) => cache.delete(k)));
  } catch { /* кешу нема — нема й картинки */ }
  if (link && !file) {
    selectTab('wish');
    wishFromShare(screen, link);
    return;
  }
  selectTab('letter');
  if (file) composeMeme(file, () => document.dispatchEvent(new CustomEvent('radovalka:sent')));
  else if (none) toast('Сюда можно поделиться картинкой или ссылкой на товар');
}

function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(() => { /* без нього просто не буде «Поделиться» */ });
}

// «Вместе» — значок у шапці; тап відкриває шторку з листівкою, датою зустрічі й списком
const chip = document.getElementById('together-chip');
const checkinSlot = document.createElement('div');
checkinSlot.className = 'checkin-slot';
document.getElementById('screen').before(checkinSlot);

function drawChip() {
  // «до встречи» окремо від «75 дн.»: у шапці зі згорнутим «Я в порядке» лишається лише число
  const [, word = '', num = chipLabel()] = chipLabel().match(/^(.*?)(\d+ дн\.)$/) || [];
  const festive = chipFestive();
  chip.querySelector('.chip-text').replaceChildren(...(word ? [h('span', { class: 'chip-word' }, word)] : []), num, festive ? ' 🎉' : '');
  // Щодня — компактно, лише число; слово «вместе» лише в круглу дату («до встречи» лишається — без нього число незрозуміле)
  chip.classList.toggle('is-compact', word.startsWith('вместе') && !festive);
  chip.classList.toggle('is-festive', festive);
  chip.setAttribute('aria-label', `Вместе: ${chipLabel()}`);
  chip.hidden = false;
  markPlans();
}

function openTogether() {
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    backdrop.remove();
    drawChip();
    chip.focus();
  };
  const body = h('div', { class: 'sheet-inner' });
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  // Тло — те саме, що в застосунку (нерухоме, як під «Написать»), а не однотонне
  const sheet = h('div', { class: 'sheet sheet-together sheet-full sheet-decor', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Вместе' },
    writeDecor(),
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    body);
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  togetherBody = body;
  renderTogether(body);
}
// Відкрита шторка «Вместе» — щоб перемалювати, коли другий змінив дату зустрічі
let togetherBody = null;

chip.addEventListener('click', openTogether);
// Картка «Вместе» у «Планах»
document.addEventListener('radovalka:open-together', openTogether);


// Рядок у шапці під логотипом: «є нова версія» / «оновилась». Нічого не перекриває, ✕ — сховати
function pill(text, onclick) {
  document.querySelector('.update-pill')?.remove();
  const bar = h('div', { class: 'update-pill', role: 'status' },
    h('button', { type: 'button', class: 'update-go', onclick: () => { bar.remove(); onclick(); } }, text),
    h('button', { type: 'button', class: 'update-x', 'aria-label': 'Скрыть', onclick: () => bar.remove() }, '✕'));
  document.querySelector('.top').append(bar);
}

// Після оновлення — один раз: «обновилась, що нового». Перший запуск на телефоні — лише запамʼятати версію
function noteUpdated() {
  let seen;
  try {
    seen = localStorage.getItem('radovalka:version');
    localStorage.setItem('radovalka:version', VERSION);
  } catch { return; }
  if (seen && seen !== VERSION) pill(`✨ Радовалка обновилась до ${VERSION} — что нового?`, () => openAbout(true));
}

// Свої файли, які завантажила ця сторінка: скрипти, стилі, шрифти
// LAZY — модулі, що вантажаться лише за потреби (import()): кладемо в оболонку завжди, щоб версії не розійшлись
const LAZY = ['./photoedit.js', './usphoto-edit.js', './gifedit.js', './files.js', './festive.js', './debug.js', './emoji.js', './envattach.js', './picker.js', './envtpl.js', './playlist.js', './colorpick.js', './capstyle.js',
  // Шрифти підписів (кирилиця): підпис гифки малюється в браузері отримувача — шрифт має бути й без мережі
  ...['lobster', 'marck', 'bubbles', 'comfortaa', 'russo', 'playfair', 'press'].map((f) => `../fonts/${f}-cyrillic.woff2`)]
  .map((p) => new URL(p, import.meta.url).href);
const ownFiles = () => [...new Set([...performance.getEntriesByType('resource').map((e) => e.name.split('#')[0])
  .filter((u) => u.startsWith(location.origin) && /\.(js|css|woff2)(\?|$)/.test(u)), ...LAZY])];

// Оболонку тримає service worker: v — версія, яку він перекачує цілком і кладе разом;
// у radovalka:shell — яка версія вже лежить у кеші телефона.
// Без нього (перший запуск, старий браузер) — як раніше: перекачати в кеш браузера (GitHub Pages тримає модулі 10 хв)
const SHELL_MARK = 'radovalka:shell';
const shellMark = () => { try { return localStorage.getItem(SHELL_MARK); } catch { return null; } };
let shellUpdate = null;
function updateShell(v) {
  const sw = navigator.serviceWorker?.controller;
  if (!sw) {
    return Promise.race([
      Promise.allSettled([location.href.split('#')[0], ...ownFiles()].map((u) => fetch(u, { cache: 'reload' }))),
      new Promise((ok) => { setTimeout(ok, 8000); }),
    ]).then(() => true);
  }
  // Та сама версія вже качається — чекаємо її, а не качаємо вдруге
  if (shellUpdate?.v !== v) {
    const done = new Promise((ok) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => ok(!!e.data);
      sw.postMessage({ type: 'update-shell', urls: ownFiles(), v }, [ch.port2]);
      setTimeout(() => ok(false), 20000);
    }).then((ok) => {
      if (ok) { try { localStorage.setItem(SHELL_MARK, v); } catch { /* наступного разу перекачає ще раз */ } }
      else if (shellUpdate?.done === done) shellUpdate = null;
      return ok;
    });
    shellUpdate = { v, done };
  }
  return shellUpdate.done;
}

// Перший запуск під service worker'ом (чи кеш оболонки порожній) — кладемо в нього поточну версію
async function primeShell() {
  // Уже качається нова версія (checkUpdate) — вона й ляже
  if (!navigator.serviceWorker?.controller || shellUpdate) return;
  if (shellMark() !== VERSION) { updateShell(VERSION); return; }
  // Оболонку нової версії качала стара — за своїм списком файлів: модулів, яких вона не знала, у кеші нема,
  // і без мережі застосунок не стартував би. Бракує хоч одного — перекачати всю
  try {
    const miss = await Promise.all(ownFiles().map((u) => caches.match(u).then((r) => !r)));
    if (miss.some(Boolean)) updateShell(VERSION);
  } catch { /* немає Cache API — нічого */ }
}

async function hardReload(v) {
  if (!(await updateShell(v))) {
    toast(navigator.onLine ? 'Не получилось обновить — попробуй ещё раз через минуту' : 'Не получилось обновить — нет связи');
    return;
  }
  leave(() => location.reload());
}

// Чи не вийшла нова версія: перевіряємо при старті й поверненні. Нову оболонку одразу тягнемо у фоні —
// не натисне «обновить», то наступне відкриття вже буде новим
async function checkUpdate() {
  try {
    const text = await (await fetch('js/version.js', { cache: 'no-store' })).text();
    const v = text.match(/VERSION = '([^']+)'/)?.[1];
    if (!v || v === VERSION) return;
    if (navigator.serviceWorker?.controller) updateShell(v);
    pill(`Есть новая версия ${v} — обновить`, () => hardReload(v));
  } catch { /* немає звʼязку — перевіримо наступного разу */ }
}

// Повернулась у застосунок: дотягуємо свіже. Відволіклась на пів хвилини — нічого не перепитуємо,
// а тап по сповіщенню (повідомлення від service worker) оновлює завжди
let hiddenAt = 0;
function refreshAll() {
  checkUpdate();
  markFestive();
  setTimeout(maybeCookie, 1500);
  refreshLetter();
  loadSos();
  // Конверти: нові записки — до наступного заходу на вкладку; відкритий екран не чіпаємо, щоб не збити читання.
  // Крапка на марці — одразу
  get('envelopes').then((list) => { if (Array.isArray(list)) { DATA.envelopes = list; markEnvelopes(); } }).catch(() => {});
  // «Вместе»: другий призначив чи переніс зустріч — лічильник і відкрита шторка одразу нові
  get('together').then((t) => {
    if (!t || JSON.stringify(t) === JSON.stringify(DATA.together)) return;
    DATA.together = t;
    drawChip();
    if (togetherBody?.isConnected && !togetherBody.contains(document.activeElement)) renderTogether(togetherBody);
  }).catch(() => {});
  if (tab !== 'wish') loadWishes().then(markWishes).catch(() => {});
  if (tab === 'plans') refreshPlans(screen).catch(() => {}); else loadPlans().then(markPlans).catch(() => {});
  // Стрічка перемальовує лише себе — відкритий лист дня не зсувається
  refreshFeed();
}

// Без зв'язку показуємо збережене (api.js) і пробуємо знову кожні 30 с; зв'язок повернувся — дотягуємо свіже
const offlineBar = h('p', { class: 'offline-bar', role: 'status', hidden: true }, 'Нет связи — показываю сохранённое');
document.querySelector('header.top').after(offlineBar);
let offlineTimer = null;
document.addEventListener('radovalka:offline', (e) => {
  offlineBar.hidden = !e.detail;
  clearInterval(offlineTimer);
  if (e.detail) offlineTimer = setInterval(refreshAll, 30000);
  else if (!document.body.classList.contains('is-booting')) refreshAll();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') { hiddenAt = Date.now(); return; }
  if (!getKey() || document.body.classList.contains('is-booting')) return;
  if (Date.now() - hiddenAt < 30000) return;
  refreshAll();
});

const newsList = (list) => h('ul', { class: 'news' }, ...list.map(([v, text]) => h('li', {}, h('b', {}, v), h('span', {}, text))));
// Розгортка, вміст якої будується лише при першому відкритті: сотні версій «Ранее» гальмували відкриття меню
function lazyDetails(cls, label, build) {
  const d = h('details', { class: cls }, h('summary', {}, label));
  d.addEventListener('toggle', () => { if (d.open && d.childElementCount === 1) d.append(build()); });
  return d;
}

// Перемикач «Движение фона»: нахил, пелюстки, падаюча зірка
// Звуки в Радовалці (шкатулка, ігри); push звучить, як налаштовано в телефоні
function soundSwitch() {
  const btn = h('button', { type: 'button', class: 'about-row about-switch', role: 'switch' });
  const paint = () => {
    btn.setAttribute('aria-checked', String(soundOn()));
    btn.replaceChildren(
      h('span', { class: 'about-row-ic', 'aria-hidden': 'true' }, '🎵'),
      h('span', { class: 'about-row-label' }, 'Звуки в Радовалке', h('small', {}, 'Письма, ход в игре, пара, победа')),
      h('span', { class: 'about-toggle', 'aria-hidden': 'true' }));
  };
  btn.addEventListener('click', () => { setSound(!soundOn()); paint(); if (soundOn()) sfx('pair'); });
  paint();
  return btn;
}

// Свій інструмент: ним звучить моє тут і в другого все, що прийшло від мене. Згорнутий рядок із поточним;
// розгорнувся — інструменти по сімействах (будуються лише тоді). Тап — одразу послухати
function instrumentPicker() {
  const cur = h('small', {});
  const chips = [];
  const paint = () => {
    const k = myInstrument();
    cur.textContent = INSTRUMENTS[k].name;
    chips.forEach((c) => c.setAttribute('aria-checked', String(c.dataset.k === k)));
  };
  const pick = (k) => {
    setMyInstrument(k);
    paint();
    if (soundOn()) preview(k);
    if (DATA.mine.instrument !== k) { DATA.mine.instrument = k; save('mine', { instrument: k }); }
  };
  const box = h('details', { class: 'instr-pick' },
    h('summary', { class: 'about-row' },
      h('span', { class: 'about-row-ic', 'aria-hidden': 'true' }, '🎻'),
      h('span', { class: 'about-row-label' }, 'Мой инструмент', cur),
      h('span', { class: 'about-row-go', 'aria-hidden': 'true' }, '›')));
  box.addEventListener('toggle', () => {
    if (!box.open || chips.length) return;
    box.append(h('div', { class: 'instr-fams', role: 'radiogroup', 'aria-label': 'Мой инструмент' },
      ...INSTRUMENT_FAMILIES.map(([title, keys]) => h('div', { class: 'instr-fam' },
        h('p', { class: 'instr-fam-title' }, title),
        h('div', { class: 'instr-fam-row' }, ...keys.map((k) => {
          const c = h('button', { type: 'button', class: 'instr-chip', role: 'radio', 'data-k': k, onclick: () => pick(k) }, INSTRUMENTS[k].name);
          chips.push(c);
          return c;
        }))))));
    paint();
  });
  paint();
  const p = who().partner;
  return h('div', { class: 'instr' }, box,
    h('p', { class: 'instr-note' }, `${cap(p)} играет ${INSTRUMENTS[partnerInstrument()].on}: так звучат ${p === 'она' ? 'её' : 'его'} письма и ходы`));
}

// Як приходять листи: конвертом, що відкриваєш сам (за замовчуванням), чи одразу відкритими. Свій для кожного телефона
function autoOpenSwitch() {
  const btn = h('button', { type: 'button', class: 'about-row about-switch', role: 'switch' });
  const paint = () => {
    btn.setAttribute('aria-checked', String(autoOpen()));
    btn.replaceChildren(
      h('span', { class: 'about-row-ic', 'aria-hidden': 'true' }, '✉️'),
      h('span', { class: 'about-row-label' }, 'Открывать письма сразу',
        h('small', {}, autoOpen() ? 'Письмо приходит уже открытым' : 'Письмо приходит конвертом и открывается по тапу')),
      h('span', { class: 'about-toggle', 'aria-hidden': 'true' }));
  };
  btn.addEventListener('click', () => { setAutoOpen(!autoOpen()); paint(); });
  paint();
  return btn;
}

function stillSwitch() {
  const btn = h('button', { type: 'button', class: 'about-row about-switch', role: 'switch' });
  const paint = () => {
    const on = !isStill();
    btn.setAttribute('aria-checked', String(on));
    btn.replaceChildren(
      h('span', { class: 'about-row-ic', 'aria-hidden': 'true' }, '🌸'),
      h('span', { class: 'about-row-label' }, 'Движение фона', h('small', {}, 'Наклон телефона, лепестки, падающие звёзды')),
      h('span', { class: 'about-toggle', 'aria-hidden': 'true' }));
  };
  btn.addEventListener('click', () => { setStill(!isStill()); paint(); });
  paint();
  return btn;
}

// Тап по «Радовалка»: версія, що нового, вийти на цьому телефоні. showNews — з плашки «обновилась»: одразу розгорнуте «Что нового»
function openAbout(showNews) {
  const btn = document.getElementById('about-btn');
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    backdrop.remove();
    btn.focus();
  };
  const logout = async () => {
    if (!await ask({ title: 'Выйти на этом телефоне?', text: 'Чтобы вернуться, понадобится твоя личная ссылка.', yes: 'Выйти' })) return;
    // Без ключа телефон більше нічий — і сповіщення йому слати нікому
    await disablePush().catch(() => { /* сервер прибере підписку сам, коли push-сервіс відповість 410 */ });
    await forgetSaved();
    clearPin();
    forgetSecret();
    setKey(null);
    leave(() => location.replace(location.pathname));
  };
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  // Три свіжі версії, решта — під «Ранее»
  const news = h('details', { class: 'about-news' },
    h('summary', { class: 'about-row' }, ...aboutRowBody('📰', 'Что нового', null)),
    newsList(NEWS.slice(0, 3)),
    NEWS.length > 3 ? lazyDetails('news-more', 'Ранее', () => newsList(NEWS.slice(3))) : null);
  const sheet = h('div', { class: 'sheet sheet-together sheet-about', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'О Радовалке' },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    h('div', { class: 'sheet-inner' },
      h('div', { class: 'about-head' },
        h('h2', { class: 'title' }, 'Радовалка'),
        h('p', { class: 'about-version' }, `версия ${VERSION}`)),
      // Другий ключ на цьому телефоні (він перевіряє обидві половини) — перемикач першим, окремою карткою з упізнаваним значком
      getAltKey() ? aboutGroup('Половина', sideSwitch()) : null,
      // Вхід у «Вместе» й тут — у шапці лише значок із числом
      aboutGroup('Вместе', aboutRow('💞', cap(chipLabel()), 'Наша открытка и дата встречи', () => { close(); setTimeout(openTogether, 300); })),
      // Спершу налаштування — по них сюди й заходять; довідкове — нижче, вихід — дрібно в самому низу
      aboutGroup('Письма', autoOpenSwitch(), h('div', {}, h('p', { class: 'about-sub' }, 'Размер букв'), textSizePanel())),
      aboutGroup('Звуки', soundSwitch(), instrumentPicker()),
      // Свої для кожного телефона: сповіщення й рух фону (раптом від нього укачує)
      aboutGroup('Этот телефон', pushPanel(), stillSwitch()),
      // Замок на вхід (PIN або відбиток) і дозволи на місце й мікрофон наперед — щоб у біді «Нужна помощь» не питала
      aboutGroup('Защита', pinPanel(aboutRow),
        aboutRow('🆘', 'Проверить «Нужна помощь»', 'Разрешить место и микрофон заранее', sosCheck)),
      // Лише на його половині: печеньки, ідеї, питання — окремою шторкою (модуль вантажиться за потреби)
      DATA.side === 'vin' ? aboutGroup('Только у тебя',
        aboutRow('🛠', 'Отладка', 'Печеньки, идеи для планов, вопросы «Совпадёт?»', async () => {
          close();
          try { (await import('./debug.js')).openDebug(); } catch { toast('Не открылось — обнови Радовалку'); }
        })) : null,
      aboutGroup('Ещё',
        // Тур живе на «Письмах» — туди й повертаємось
        aboutRow('🐾', 'Показать подсказки заново', 'Питомцы покажут, где что', () => { close(); selectTab('letter'); setTimeout(startTour, 400); }),
        news),
      h('div', { class: 'about-foot' },
        h('button', { type: 'button', class: 'about-link about-logout is-out', onclick: logout }, 'Выйти на этом телефоне')),
      // Ліцензія записів інструментів (CC BY 3.0) вимагає назвати автора
      h('p', { class: 'about-credit' }, 'Записи инструментов: FluidR3 GM, Frank Wen, лицензия CC BY 3.0. Шорохи и стуки: Kenney, CC0')));
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  // Клік по «Радовалка» передає подію — розгортаємо лише на явне true
  if (showNews === true) {
    news.open = true;
    requestAnimationFrame(() => news.scrollIntoView({ block: 'start' }));
  }
}

document.getElementById('about-btn').addEventListener('click', (e) => {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    e.currentTarget.querySelector('.wm-ico')?.animate(
      [{ transform: 'rotate(0)' }, { transform: 'rotate(-28deg)' }, { transform: 'rotate(0)' }],
      { duration: 520, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  }
  openAbout();
});

// Перехід на шифрування: те, що цей телефон колись написав відкрито (свої листи, цитати, свої відповіді), — шифруємо й
// віддаємо назад. На кожному запуску, доки не вдасться; вдалось — позначка й більше не питаємо
async function sealOld() {
  if (!hasSecret()) return;
  // sealed2: з 0.2.29 ще фото — телефон, що вже перейшов на 0.2.28, пройде ще раз
  const mark = `radovalka:sealed2:${DATA.side}`;
  try { if (localStorage.getItem(mark) === '1') return; } catch { /* приватне вікно */ }
  try {
    const { rows, imgs = [] } = await get('seal/todo');
    if (rows.length) {
      const sealed = await Promise.all(rows.map(async (r) => Object.fromEntries(
        await Promise.all(Object.entries(r).map(async ([k, v]) => [k, k === 'id' || k === 't' ? v : await seal(v)])))));
      await send('seal', 'POST', { rows: sealed });
    }
    // Фото — по одному (кожне до 1,4 МБ): завантажити своє відкрите, зашифрувати, віддати назад
    for (const name of imgs) await send('seal-img', 'POST', { name, data: await sealBlob(await getBlob(`img/${name}`)) });
    localStorage.setItem(mark, '1');
  } catch { /* нема звʼязку — наступного разу */ }
}

// «Нужна помощь» на екрані замка: у біді PIN не заважає (шторка SOS — поверх замка, замок після неї лишається)
const lockSos = () => sosSlider();

async function start() {
  if (!getKey()) {
    showLock(null, start);
    return;
  }
  let restPets = null;
  try {
    Object.assign(DATA, await get('boot'));
    restPets = await loadPets();
  } catch (e) {
    showLock(e.status === 401 ? 'bad' : 'offline', start);
    return;
  }
  // Замок (PIN / відбиток) — до будь-якого екрана з листами; на ньому — «Нужна помощь»
  await lock(lockSos);
  prepLetter(DATA.letter);
  // Старий воркер (або збережений до 0.1.74 boot без мережі) привітального окремо не віддає
  if (!('welcome' in DATA)) DATA.welcome = DATA.letter && !DATA.letter.id ? DATA.letter : null;
  document.body.classList.remove('is-booting');
  try { sessionStorage.removeItem('radovalka:boot-retry'); } catch { /* приватне вікно */ }
  // Інструменти: свій — як збережено на сервері (новий телефон теж), другого — для того, що від нього приходить.
  // Ще не обирали — з першого дня в нього контрабас, у неї дзвіночки
  const instr = (k, side) => instrumentKey(k, DEFAULT_INSTRUMENT[side]);
  setMyInstrument(instr(DATA.mine?.instrument, DATA.side));
  setPartnerInstrument(instr(DATA.partnerInstrument, DATA.side === 'vin' ? 'vona' : 'vin'));
  prewarmWrite();
  // Фото для 🌌 і 🍓 — заздалегідь у памʼять, коли телефон вільний: анімація не чекає мережі
  (self.requestIdleCallback || ((fn) => setTimeout(fn, 800)))(() => { US.sync(DATA.us); HER.sync(DATA.her); });
  applySide();
  drawChip();
  loadWishes().then(markWishes).catch(() => {});
  loadPlans().then(markPlans).catch(() => {});
  markLetter();
  markEnvelopes();
  render();
  maybeWelcome();
  takeShared();
  syncPush();
  startOutbox();
  startLive(refreshAll, DATA.pulse);
  startBell();
  watchResume(lockSos);
  // Ярлик «Я в порядке» (довге натискання на іконку): відмітка одразу; адресу чистимо, щоб перезавантаження не повторило
  const act = new URLSearchParams(location.search).get('do');
  if (act === 'checkin') {
    history.replaceState(null, '', location.pathname);
    checkIn();
  }
  // Ярлик «Нужна помощь» лише показує повзунок — одним дотиком сигнал не йде
  if (act === 'sos') {
    history.replaceState(null, '', location.pathname);
    const slider = document.querySelector('.sos-slider');
    slider?.scrollIntoView({ block: 'center' });
    slider?.classList.add('is-called');
  }
  loadSos();
  sealOld();
  noteUpdated();
  checkUpdate();
  markFestive();
  // У «печенькин день» — печенька з передбаченням, трохи згодом після входу
  setTimeout(maybeCookie, 1500);
  // Інші пози улюбленців і оболонка в кеш — коли перший екран уже показано і його запити пішли
  setTimeout(restPets, 1500);
  setTimeout(primeShell, 3000);
}

registerWorker();
// Відкрили свою повну ссылку — замок на цьому телефоні знімається (так скидають забутий PIN)
if (parseKey(location.hash)) clearPin();
takeKeyFromUrl();
start();
