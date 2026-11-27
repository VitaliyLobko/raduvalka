// Печеньки з передбаченнями: у «печенькин день» (≈ раз на 2–3 дні, спільний для обох — рахується з дати) печенька
// прилітає поверх усього, тап — розламується, виїжджає папірець. Зрідка (≈ раз на місяць) — золота з особливими.
// Без сервера: день, золота чи ні й текст — з хешу дати й половини; показана — позначка на цьому телефоні
import { DATA, who } from './data.js';
import { send } from './api.js';
import { h, toast, reduceMotion } from './ui.js';
import { petFor } from './icons.js';
import { burst } from './fx.js';
import { sfx } from './sound.js';

// Класика печеньок — короткі добрі передбачення (свої тексти, у стилі справжніх)
const FORTUNES = [
  'Скоро вас ждёт приятная встреча.',
  'Терпение — ключ к радости.',
  'Тот, кто думает о вас, ближе, чем кажется.',
  'Улыбка, подаренная сегодня, вернётся вдвойне.',
  'Маленький шаг сегодня — большая радость завтра.',
  'Доброе слово откроет закрытую дверь.',
  'Вас ждёт неожиданно хорошая новость.',
  'Лучшее ещё впереди.',
  'Сегодня удача на вашей стороне.',
  'Ваше сердце знает дорогу.',
  'Счастье любит тех, кто умеет ждать.',
  'Скоро исполнится то, о чём вы давно мечтаете.',
  'Простые радости — самые настоящие.',
  'Кто-то очень гордится вами.',
  'День, начатый с улыбки, не может быть плохим.',
  'Вы сильнее, чем думаете.',
  'Хорошие вещи приходят к тем, кто в них верит.',
  'Не торопитесь — всё случится вовремя.',
  'Ваша доброта не останется незамеченной.',
  'Впереди тёплый и светлый период.',
  'Сегодня стоит сказать «спасибо» тому, кто рядом.',
  'Чашка чая решит больше, чем кажется.',
  'Новое знакомство принесёт радость.',
  'Ваши мечты ближе, чем на расстоянии вытянутой руки.',
  'Смех — лучшее лекарство. Примите двойную дозу.',
  'Ждите сюрприза там, где не ждёте.',
  'Всё, что вы отдаёте с любовью, возвращается.',
  'Сегодня хороший день, чтобы начать что-то новое.',
  'Звёзды благоволят вашим планам.',
  'Тот, кто ждёт, получает самое ценное.',
  'Немного смелости — и всё получится.',
  'Ваш оптимизм заразителен. Делитесь им.',
  'Скоро вы будете смеяться до слёз.',
  'Удача приходит в мягких тапочках — тихо.',
  'Сегодня ваш день. Носите его гордо.',
  'Обнимите кого-нибудь — это работает.',
  'Даже маленькое чудо — всё равно чудо.',
  'Ваша мечта уже собирает чемодан.',
  'То, что потеряно, найдётся в нужный момент.',
  'Хороший сон — к хорошим новостям.',
  'Скоро в вашей жизни станет больше света.',
  'Верьте в себя так, как в вас верят другие.',
  'Вы — чья-то любимая причина улыбаться.',
  'Не бойтесь мечтать по-крупному.',
  'Сегодня всё получится с первого раза. Почти.',
  'Тёплые слова согреют лучше пледа.',
  'Впереди дорога, которая приведёт домой.',
  'Ваше спокойствие — ваша суперсила.',
  'Скоро случится то, чего вы очень ждёте.',
  'Каждый день приближает к встрече.',
  'Секрет счастья — в мелочах. Посмотрите вокруг.',
  'Ваша искренность — редкий дар.',
  'Сегодня можно позволить себе что-то вкусное.',
  'Кто-то вспоминает о вас прямо сейчас.',
  'Всё складывается лучше, чем кажется.',
  'Большое счастье начинается с маленького «да».',
  'Сегодня ваш хвост пушистее обычного. Метафорически.',
  'Вселенная подмигивает вам. Подмигните в ответ.',
  'Немного печенья — и мир становится добрее.',
  'Вас ждёт день, который захочется запомнить.',
];
// Золота печенька — рідко, тепліше і про двох
const GOLDEN = [
  'Встреча, которую ждут оба, уже в пути.',
  'Расстояние — только цифра. Сердца давно рядом.',
  'Вас любят сильнее, чем вы можете представить.',
  'Однажды вы будете вспоминать эти дни с улыбкой — вместе.',
  'Самое тёплое объятие ещё впереди.',
  'От Земли до Юпитера — и обратно. Каждый день.',
  'Ваша история — из тех, что рассказывают внукам.',
  'Двое, которые ждут друг друга, всегда дожидаются.',
  'Скоро будет вечер, когда никуда не нужно спешить. Вдвоём.',
  'Вы — лучшее, что случилось с кем-то очень важным.',
  'Где бы вы ни были, вы дома друг у друга.',
  'Ваше «вместе» сильнее любого «далеко».',
  'Сегодня кто-то загадал желание о вас.',
  'Впереди год, который вы назовёте самым счастливым.',
  'Звёзды уже договорились о вашей встрече.',
  'Любовь, которая ждёт, становится только крепче.',
  'Скоро вы снова будете молчать рядом — и это будет лучшим разговором.',
  'Каждый закат приближает к тому самому утру.',
  'Золотая печенька — значит, вам очень повезло друг с другом.',
  'Эта печенька — напоминание: вас любят. Очень.',
];

// Новорічна — лише 1 січня: побажання на рік, трохи чарівне
const NEW_YEAR = [
  'Пусть этот год соберёт вас вместе — и больше не разлучит.',
  'Загадайте одно желание на двоих. Его уже услышали.',
  'Пусть каждый день этого года будет поводом обняться.',
  'Этот год закончит ожидание встречей.',
  'Пусть дом будет тёплым, а дорога к нему — короткой.',
  'В этом году «вместе» случится чаще, чем «скоро».',
  'Звёзды этого года уже сложились в одну дорогу — домой.',
  'Самое волшебное в новом году — что вы есть друг у друга.',
  'Пусть сбудется то, о чём вы подумали прямо сейчас.',
  'Новый год начинается с вас двоих. Остальное приложится.',
  'Пусть в этом году будет много смеха, тишины вдвоём и рук, которые не отпускают.',
  'Где-то в этом году уже ждёт день, который вы будете вспоминать всю жизнь.',
  'Пусть этот год принесёт мир. И пусть все, кого вы любите, будут рядом — живы и здоровы.',
  'Мирного неба над головой и всех родных рядом, живых и здоровых.',
  'Пусть в этом году все близкие вернутся домой и сядут за один стол.',
];

// FNV-1a: однаковий результат на обох телефонах
function hash(str) {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}
const KYIV_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' });
const kyivDay = () => KYIV_DAY.format(new Date());
// Жереб — приблизно 2 дні з 5, але не більше двох днів поспіль без печеньки: третій — точно з нею.
// Рахуємо від однієї опорної дати вперед, тож розклад однаковий на обох телефонах
const COOKIE_FROM = '2026-11-01';
const lucky = (day) => hash(`cookie:${day}`) % 5 < 2;
export function isCookieDay(day) {
  if (day < COOKIE_FROM) return lucky(day);
  let gap = 0;
  for (const d = new Date(`${COOKIE_FROM}T12:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    const yes = lucky(k) || gap >= 2;
    if (k === day) return yes;
    gap = yes ? 0 : gap + 1;
  }
}
export const isGolden = (day) => hash(`gold:${day}`) % 12 === 0;
const listOf = (gold) => (gold === 'ny' ? NEW_YEAR : gold ? GOLDEN : FORTUNES);
const fortuneFor = (day, side, gold) => { const list = listOf(gold); return list[hash(`${day}:${side}`) % list.length]; };
const isNewYearDay = (day) => day.slice(5) === '01-01';

const seenKey = () => `radovalka:cookie:${DATA.side}`;
const seenToday = (day) => { try { return localStorage.getItem(seenKey()) === day; } catch { return true; } };
const markSeen = (day) => { try { localStorage.setItem(seenKey(), day); } catch { /* приватне вікно */ } };

// Печенька — впізнаваний 🥠, розрізаний навпіл (дві копії, кожна обрізана до своєї половини)
const cookieHtml = () => '<span class="ck-half ck-l">🥠</span><span class="ck-half ck-r">🥠</span>';

// day — для перевірки вручну (?cookie у dev); force — показати навіть не в печенькин день
// now — не чекати, поки закриють шторку: новорічна опівночі має бути одразу, поверх усього
export function maybeCookie({ force = false, gold: forceGold = null, now = false } = {}) {
  if (!DATA.side || document.querySelector('.cookie-layer')) return;
  const day = kyivDay();
  // 1 січня печенька є завжди — новорічна
  const ny = isNewYearDay(day);
  if (!force && ((!ny && !isCookieDay(day)) || seenToday(day))) return;
  // Не поверх знайомства, привітання, відкритої шторки чи салюту — спробуємо трохи пізніше
  if (!now && document.querySelector('.tour, .welcome, .sheet, .reader, .ny-salute')) { setTimeout(() => maybeCookie({ force, gold: forceGold }), 4000); return; }
  markSeen(day);
  show(day, forceGold ?? (ny ? 'ny' : isGolden(day)));
}

// Перегляд для нього в меню: печенька з випадковим текстом — справжню печеньку дня не чіпає і нікуди не шле
export function previewCookie(gold) {
  const list = listOf(gold);
  document.querySelector('.cookie-layer')?.remove();
  show(kyivDay(), gold, list[Math.floor(Math.random() * list.length)], true);
}
export const allFortunes = () => ({ regular: FORTUNES, golden: GOLDEN, newYear: NEW_YEAR });

export const STAR = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z"/></svg>';
const GOLDS = ['#FFE7A0', '#FFD45C', '#F5C543', '#FFF3C4', '#E0A93A'];

// Золота до тапу: промені за печенькою повільно обертаються, довкола мерехтять зірочки
function goldIdle() {
  const tw = h('div', { class: 'ck-twinkles', 'aria-hidden': 'true' });
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
    const z = Math.round(12 + Math.random() * 12);
    tw.append(h('span', {
      class: 'ck-tw',
      html: STAR,
      style: `left:${Math.round(165 + Math.cos(a) * (125 + Math.random() * 35))}px;top:${Math.round(140 + Math.sin(a) * (100 + Math.random() * 28))}px;`
        + `width:${z}px;height:${z}px;animation-delay:${(Math.random() * 1.9).toFixed(2)}s`,
    }));
  }
  return [h('div', { class: 'ck-rays', 'aria-hidden': 'true' }), tw];
}

// Розлом золотої: спалах, три хвилі й зірочки-іскри навсібіч (лише transform/opacity)
function goldBurst(layer, cookie) {
  if (reduceMotion) return;
  const r = cookie.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const C = `translate(${x}px, ${y}px)`;
  const fx = h('div', { class: 'ck-fx', 'aria-hidden': 'true' });
  layer.append(fx);
  const at = (cls, html) => fx.appendChild(h('span', { class: cls, ...(html ? { html } : {}) }));
  at('ck-flash').animate([{ transform: `${C} scale(.2)`, opacity: 1 }, { transform: `${C} scale(1.7)`, opacity: 0 }],
    { duration: 750, easing: 'ease-out', fill: 'forwards' });
  [0, 180, 360].forEach((delay, i) => at('ck-wave').animate(
    [{ transform: `${C} scale(.4)`, opacity: 0.95 }, { transform: `${C} scale(${6 + i * 1.5})`, opacity: 0 }],
    { duration: 1000 + i * 200, delay, easing: 'ease-out', fill: 'both' },
  ));
  for (let i = 0; i < 28; i += 1) {
    const s = at('ck-spark', STAR);
    s.style.color = GOLDS[i % GOLDS.length];
    const a = (Math.PI * 2 * i) / 28 + Math.random() * 0.3;
    const far = i % 2;
    const d = far ? 150 + Math.random() * 90 : 70 + Math.random() * 50;
    const z = far ? 0.8 + Math.random() * 0.5 : 0.6 + Math.random() * 0.6;
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    const spin = (Math.random() - 0.5) * 360;
    s.animate([
      { transform: `${C} scale(.2)`, opacity: 1 },
      { transform: `translate(${x + dx * 0.8}px, ${y + dy * 0.8}px) scale(${z * 1.3}) rotate(${spin * 0.6}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${x + dx}px, ${y + dy + 40}px) scale(0) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: far ? 1500 : 1000, delay: Math.random() * 120, easing: 'cubic-bezier(.15, .8, .3, 1)', fill: 'backwards' });
  }
  setTimeout(() => fx.remove(), 1900);
}

// Новорічна: у шарі тихо падає сніг (лише transform), огники довкола — різнокольорові (CSS)
function nySnow() {
  const box = h('div', { class: 'ck-snow', 'aria-hidden': 'true' });
  for (let i = 0; i < 22; i += 1) {
    const s = h('i');
    const d = 6 + Math.random() * 6;
    s.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;--z:${(3 + Math.random() * 4).toFixed(1)}px;--d:${d.toFixed(1)}s;`
      + `--delay:${(-Math.random() * d).toFixed(1)}s;--dx:${(Math.random() * 60 - 30).toFixed(0)}px`;
    box.append(s);
  }
  return box;
}

// gold: false — звичайна, true — золота, 'ny' — новорічна (золота й ще чарівніша)
function show(day, gold, preset = null, preview = false) {
  const ny = gold === 'ny';
  const me = who();
  const text = preset || fortuneFor(day, DATA.side, gold);
  const close = () => { layer.classList.add('is-leaving'); setTimeout(() => layer.remove(), reduceMotion ? 0 : 300); };
  // Пробна — без «Отправить»: випадковий текст не має піти до неї листом
  const shareBtn = preview ? null : h('button', {
    type: 'button', class: 'btn btn-primary',
    onclick: async () => {
      shareBtn.disabled = true;
      try {
        await send('letters', 'POST', { kind: 'now', text: `🥠 ${ny ? 'Мне выпала новогодняя печенька' : gold ? 'Мне выпала золотая печенька' : 'Мне выпало'}: «${text}»`, mascot: petFor('push') });
        document.dispatchEvent(new CustomEvent('radovalka:sent'));
        toast(`Отправлено ${me.partner === 'она' ? 'ей' : 'ему'} 🥠`);
        close();
      } catch {
        shareBtn.disabled = false;
        toast('Не отправилось — нет связи');
      }
    },
  }, me.partner === 'она' ? 'Отправить ей' : 'Отправить ему');
  const paper = h('div', { class: 'ck-paper' }, h('p', {}, text));
  const cookie = h('button', { type: 'button', class: 'ck-cookie', 'aria-label': 'Разломить печеньку', html: cookieHtml() });
  const closeBtn = h('button', { type: 'button', class: 'btn', onclick: close }, 'Закрыть');
  const acts = h('div', { class: 'actions ck-acts' }, closeBtn, shareBtn);
  const title = h('p', { class: 'ck-title' }, ny ? 'Новогодняя печенька 🎄' : gold ? 'Золотая печенька ✨' : 'Тебе печенька 🥠');
  const hint = h('p', { class: 'ck-hint' }, preview ? 'Пробная — коснись, чтобы разломить' : 'Коснись, чтобы разломить');
  const layer = h('div', {
    class: `cookie-layer${gold ? ' is-gold' : ''}${ny ? ' is-ny' : ''}`, role: 'dialog', 'aria-modal': 'true',
    'aria-label': ny ? 'Новогодняя печенька' : gold ? 'Золотая печенька' : 'Печенька с предсказанием',
    onclick: (e) => { if (e.target === layer && layer.classList.contains('is-open')) close(); },
  }, h('div', { class: 'ck-box' }, title, gold ? h('div', { class: 'ck-stage' }, ...goldIdle(), cookie) : cookie, paper, hint, acts));
  cookie.addEventListener('click', () => {
    if (layer.classList.contains('is-open')) return;
    layer.classList.add('is-open');
    navigator.vibrate?.(gold ? [30, 60, 30] : 30);
    sfx(gold ? 'gold' : 'cookie');
    // Золота — спалах, хвилі й іскри
    if (gold) {
      goldBurst(layer, cookie);
      setTimeout(() => burst(cookie, '✨', 14), 150);
      if (ny) setTimeout(() => burst(cookie, '❄️', 12), 380);
    }
    setTimeout(() => (shareBtn || closeBtn).focus(), 700);
  });
  if (ny) layer.prepend(nySnow());
  document.body.append(layer);
  cookie.focus();
  sfx(gold ? 'goldIn' : 'cookieIn', 150);
}
