// Велике вікно «Написать»: лист зараз, на ранок, у її/його конверт чи до дати. Звичайний лист пишуть у рядку під
// чатом (compose.js), сюди — з його «＋» («В конверт», «К дате», «Большое») і «✨ Помочь»
import { DATA, who } from './data.js';
import { deliver } from './outbox.js';
import { petName, petSrc, petFor } from './icons.js';
import { h, toast, ARROW, reduceMotion, ribbon, hhmm, dayMonth, dayWord } from './ui.js';
import { mountHelper } from './helper.js';
import { composeMeme, composeGif } from './memes.js';
import { openGifs } from './maker.js';
import { recentThread } from './feed.js';
import { writeDecor } from './depth.js';
import { openGames } from './games.js';
import { newCid } from './outbox.js';

const DRAFT = 'radovalka:draft';
const MORNING_HOUR = 8;

// Чернетку тримаємо в телефоні: випадковий тап повз шторку не з'їсть довгий лист
export const draft = {
  get: () => { try { return localStorage.getItem(DRAFT) || ''; } catch { return ''; } },
  set: (v) => { try { localStorage.setItem(DRAFT, v); } catch { /* приватне вікно — без чернетки */ } },
};

// Найближчі 8:00 за часом телефона: увечері — завтра, вночі — вже сьогодні
export function nextMorning(now = new Date()) {
  const d = new Date(now);
  d.setHours(MORNING_HOUR, 0, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

export const isShe = (key) => DATA.mascots[key]?.g === 'f';
// Однаково для вікна й рядка під чатом
export const QUEUED = 'Нет связи. Письмо ждёт в телефоне и уйдёт само, когда Радовалка будет открыта с интернетом 📮';
export const sentToast = (pet) => `${petName(pet) || 'Почтальон'} ${isShe(pet) ? 'понесла' : 'понёс'} письмо ➶`;
export { dayWord };
// Над полем: сьогоднішнє — годиною, інше — днем
// Поява й зникнення — лише зсув і прозорість: їх рахує відеокарта без перемальовування вікна.
// clip-path перемальовував усе вікно кожен кадр і на телефоні гальмував (18.11)
const MOVE = { opacity: 0, transform: 'translateY(28px) scale(.98)' };
const STILL = { opacity: 1, transform: 'none' };

const whenShort = (ms) => (new Date(ms).toDateString() === new Date().toDateString() ? hhmm(ms) : dayMonth(ms));

// Прогрів. Перше відкриття вікна в кожному запуску було в рази повільнішим за наступні (замір 18.11, CPU ×6:
// розкладка ~1–1,5 с проти ~50 мс): браузер уперше готує шрифти під кожен розмір і накреслення, шукає емодзі,
// збирає поле дати. Тому знімок розмітки вікна з першого відкриття лежить у телефоні, і щойно Радовалка простоює,
// він один кадр невидимо стоїть на екрані. Знімку ще нема (найперший запуск) — хоча б емодзі й поля
const WARM_KEY = 'radovalka:warm-write';
const WARM = '📷 🎞 ✨ 🎂 🎁 💗 😏 🔥 😄 🌸 🙂 ✎ 🎲 ↩ ⬇ 🌷 🍝 💆 😂 🥰 🥺 😜 💪 ☀️ 🌙 🎤 ✂️ ✓';
let snapped = false;
function snapWrite(sheet) {
  if (snapped) return;
  snapped = true;
  try { localStorage.setItem(WARM_KEY, JSON.stringify({ cls: sheet.className, html: sheet.innerHTML.slice(0, 80000) })); } catch { /* немає місця — прогріється простіше */ }
}
export function prewarmWrite() {
  const run = () => {
    let snap = null;
    try { snap = JSON.parse(localStorage.getItem(WARM_KEY) || 'null'); } catch { /* зіпсований знімок — як без нього */ }
    const box = h('div', { class: 'write-warm', 'aria-hidden': 'true', inert: true });
    if (snap?.html) {
      const copy = h('div', { class: snap.cls });
      // Знімок лише для розкладки: без id і без автофокуса, щоб не зачепити справжні елементи; blob-картинки після перезапуску мертві
      copy.innerHTML = snap.html.replace(/\s(id|autofocus)="[^"]*"/g, '').replace(/\ssrc="blob:[^"]*"/g, '');
      box.append(copy);
    } else {
      const pics = (DATA.partnerEnvelopes || []).map((e) => e.emoji).join(' ');
      box.append(h('span', {}, `${WARM} ${pics}`), h('b', {}, WARM), h('input', { type: 'date', tabindex: '-1' }), h('input', { type: 'file', tabindex: '-1' }));
    }
    document.body.append(box);
    requestAnimationFrame(() => requestAnimationFrame(() => box.remove()));
  };
  if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}

// preset — { where: 'env', envId } з тапу по сповіщенню про порожній конверт;
// { reply: { quote, on, sent } } — відповідь: той самий екран із цитатою зверху; лист, фото чи гифка йдуть новим
// повідомленням із цією цитатою; on — на що відповідають ('letter' | 'gif' | 'photo'), sent() — після відправки.
// З рядка під чатом: where ('morning' | 'env'), pet — хто понесе, text — уже набране (для відповіді),
// help — одразу розгорнути «✨ Помочь», onClose(sent, text) — вікно закрилось: надіслано чи ні і що лишилось у полі
export function openWrite(preset = {}) {
  const reply = preset.reply || null;
  const me = who();
  const envs = DATA.partnerEnvelopes || [];
  const presetEnv = envs.some((e) => e.id === preset.envId) ? preset.envId : null;
  let where = presetEnv || (preset.where === 'env' && envs.length) ? 'env'
    : preset.where === 'morning' ? 'morning' : 'now';
  let envId = presetEnv || envs[0]?.id || null;
  let pet = DATA.mascots[preset.pet] ? preset.pet : petFor('push');
  let sentOk = false;
  // Святковий: kind 'date' — золотий конверт, приносять усі; у конверт — не буває
  let festive = !!preset.festive;

  const said = `Пиши как есть — так, как ${me.partner === 'она' ? 'сказал' : 'сказала'} бы вслух…`;
  const area = h('textarea', { class: 'write-text', 'data-voice': true, 'aria-label': reply ? 'Текст ответа' : 'Текст письма', placeholder: reply ? 'Пару слов в ответ…' : said });
  // Чернетка — лише в листа: відповідь коротка й прив'язана до свого повідомлення
  if (!reply) {
    area.value = draft.get();
    area.addEventListener('input', () => draft.set(area.value));
  } else if (preset.text) area.value = preset.text;

  const note = h('p', { class: 'write-note' });
  const envRow = h('div', { class: 'mk-chips write-envs', hidden: true });
  // Вкладення листа в конверт (одне): фото, гифка, голос, пісня; лишається, навіть якщо перемкнули «Когда», — піде лише в конверт
  let att = null;
  let musicBtn = null;
  const attBox = h('div', { class: 'write-att', hidden: true });
  const lazyAttach = () => import('./envattach.js');
  const paintAtt = async () => {
    attBox.hidden = !att || where !== 'env';
    if (!att) { attBox.replaceChildren(); return; }
    const { attachChip } = await lazyAttach();
    attBox.replaceChildren(attachChip(att, () => { att = null; paintAtt(); paintNote(); }));
  };
  const setAtt = (a) => { att = a; paintAtt(); paintNote(); };
  const festBtn = h('button', {
    type: 'button', class: 'mk-chip write-fest',
    onclick: () => { festive = !festive; paintNote(); },
  }, '🎉 Праздничное');
  const paintNote = () => {
    const m = nextMorning();
    note.textContent = where === 'now'
      ? `Появится у ${me.partner === 'он' ? 'него' : 'неё'}, как только ${me.partner} откроет Радовалку.`
      : where === 'morning'
        ? `Придёт ${dayWord(m.getTime())} в ${hhmm(m.getTime())} запечатанным конвертом.`
        : `Ляжет в конверт — ${me.partner} откроет, когда понадобится.`;
    if (where !== 'env' && festive) note.textContent += ' Праздничным: золотой конверт, принесут все вместе 🎉';
    if (where !== 'env' && att) note.textContent += ' 📎 Вложение уйдёт только в конверт — сейчас письмо без него.';
    envRow.hidden = where !== 'env';
    festBtn.hidden = where === 'env';
    if (musicBtn) musicBtn.hidden = where !== 'env';
    attBox.hidden = !att || where !== 'env';
    festBtn.setAttribute('aria-pressed', String(festive));
  };

  const chips = (items, picked, onPick) => {
    const row = h('div', { class: 'mk-chips', role: 'radiogroup' });
    const paint = () => row.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === picked)));
    items.forEach(({ v, label, html }) => row.append(h('button', {
      type: 'button', role: 'radio', class: 'mk-chip', 'data-v': v, ...(html ? { html } : {}),
      onclick: () => { picked = v; paint(); onPick(v); },
    }, html ? null : label)));
    paint();
    return row;
  };

  // «Когда» — одна стрічка: усі варіанти, гортається вбік
  const whereRow = chips([
    { v: 'now', label: 'Сейчас' },
    { v: 'morning', label: 'На утро' },
    ...(envs.length ? [{ v: 'env', label: 'В конверт' }] : []),
  ], where, (v) => { where = v; paintNote(); });
  envRow.append(chips(envs.map((e) => ({ v: e.id, label: `${e.emoji} ${e.label}` })), envId, (v) => { envId = v; }));
  [whereRow, envRow.firstChild].forEach((row) => { row.classList.add('write-when'); ribbon(row); });
  paintNote();

  const pets = Object.keys(DATA.mascots);
  // Хто понесе — лише мордочки; ім'я — у підказці й для читалки екрана
  const petRow = chips(pets.map((k) => ({
    v: k, html: `<img src="${petSrc(k)}" alt="${petName(k)}" width="40" height="40">`,
  })), pet, (v) => { pet = v; });
  petRow.classList.add('write-pets');
  petRow.setAttribute('aria-label', 'Кто понесёт');
  petRow.querySelectorAll('button').forEach((b) => { b.title = petName(b.dataset.v); });

  const helper = h('div', { class: 'write-helper' });
  // «✨ Помочь» з рядка — лише помічник: узяли чернетку чи поправку — вікно закривається, текст іде в рядок
  mountHelper(helper, area, preset.help ? { solo: true, onTake: () => close() } : {});
  const go = h('button', { type: 'button', class: 'btn btn-primary write-go', html: `${ARROW}Отправить` });

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  // fast — одразу, без згортання: далі відкривається інша шторка (фото, гифка)
  const close = (fast = false) => {
    document.removeEventListener('keydown', onKey);
    document.documentElement.classList.remove('is-covered');
    // Закрили ще під час руху — знімок для прогріву все одно потрібен
    snapWrite(sheet);
    preset.onClose?.(sentOk, area.value);
    const done = () => { sheet.remove(); backdrop.remove(); };
    if (fast || reduceMotion) { done(); return; }
    sheet.animate([STILL, MOVE], { duration: 160, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' }).onfinish = done;
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
  };

  // Мемчик замість листа: шторка листа закривається, далі — шторка мемчика; стрічка оновиться сама
  const memeSent = () => { reply?.sent?.(); document.dispatchEvent(new CustomEvent('radovalka:sent')); };
  const re = reply ? { quote: reply.quote, on: reply.on } : null;
  // input лишається в шторці, доки не обрано файл, — від'єднаний input change не надійний
  const picker = h('input', {
    type: 'file', accept: 'image/*', class: 'visually-hidden',
    onchange: async (e) => {
      const [file] = e.target.files;
      e.target.value = '';
      if (!file) return;
      if (where === 'env') { (await lazyAttach()).pickPhoto(file, setAtt); return; }
      close(true);
      composeMeme(file, memeSent, re);
    },
  });
  musicBtn = h('button', {
    type: 'button', class: 'mk-chip write-music', hidden: where !== 'env',
    onclick: async () => (await lazyAttach()).pickMusic(setAtt),
  }, '🎵 Музыка');
  const tools = h('div', { class: 'write-tools' },
    h('label', { class: 'mk-chip' }, picker, '📷 Фото'),
    h('button', {
      type: 'button', class: 'mk-chip',
      onclick: async () => {
        if (where === 'env') { (await lazyAttach()).pickGif(setAtt); return; }
        close(true);
        openGifs((gif) => composeGif(gif, memeSent, re));
      },
    }, '🎞 Гифка'),
    musicBtn,
    reply ? null : h('button', { type: 'button', class: 'mk-chip', onclick: () => { close(true); openGames(); } }, '🎲 Игры'),
    helper);

  // Відповідь — над полем цитата (тап — цілим); новий лист — кусок переписки, як у месенджері: новіше внизу, біля поля
  const ctx = reply && !preset.help ? h('button', {
    type: 'button', class: 'write-ctx', 'aria-expanded': 'false',
    onclick: () => ctx.setAttribute('aria-expanded', String(ctx.classList.toggle('is-open'))),
  },
    h('span', { class: 'write-ctx-label' }, 'Отвечаешь на'),
    h('span', { class: 'write-ctx-text' }, reply.quote)) : null;
  const recent = reply || preset.help ? [] : recentThread();
  const thread = recent.length ? h('div', { class: 'write-thread', role: 'log', 'aria-label': 'Последние сообщения' },
    ...recent.map((m) => h('div', { class: `write-msg ${m.mine ? 'is-mine' : 'is-theirs'}` },
      h('span', { class: 'write-msg-text' }, m.text),
      h('span', { class: 'write-msg-at' }, whenShort(m.at))))) : null;
  // Межа між верхом (переписка чи цитата) і полем — тягнеться пальцем
  const split = thread || ctx ? splitter(thread || ctx, area, ctx ? `${SPLIT_KEY}-reply` : SPLIT_KEY) : null;
  // Поле росте, поки пишеш, — переписка над ним стискається; межу перетягнули — поле просто займає решту
  const grow = () => {
    if (split?.on()) return;
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight + 2}px`;
  };
  area.addEventListener('input', grow);

  // Лист у конверт із байтами (фото, голос, пісня) — одним запитом, без черги; поступ — на кнопці
  const sendAttached = async (text) => {
    const ea = await lazyAttach();
    const label = go.innerHTML;
    try {
      // id — один на вкладення: повтор після обірваної відповіді сервер упізнає й не покладе листа вдруге
      att.cid ||= newCid();
      await ea.sendAttached({ kind: 'env', env: envId, text, mascot: pet, cid: att.cid }, att,
        (p) => { go.textContent = `${Math.round(p * 100)}%`; });
    } catch (e) {
      go.innerHTML = label;
      go.disabled = false;
      toast(ea.attachError(e));
      return;
    }
    if (!reply) draft.set('');
    sentOk = true;
    close();
    document.dispatchEvent(new CustomEvent('radovalka:sent'));
    toast(sentToast(pet));
  };

  go.addEventListener('click', async () => {
    const text = area.value.trim();
    const withAtt = where === 'env' && att;
    if (!text && !withAtt) { area.focus(); return; }
    go.disabled = true;
    if (withAtt && (await lazyAttach()).hasBytes(att)) { sendAttached(text); return; }
    try {
      const r = await deliver('letter', 'letters', {
        ...(withAtt ? { media: (await lazyAttach()).mediaBody(att) } : {}),
        kind: festive && where !== 'env' ? 'date' : where,
        text,
        mascot: pet,
        env: where === 'env' ? envId : undefined,
        at: where === 'morning' ? nextMorning().getTime() : undefined,
        quote: reply?.quote,
        on: reply?.on,
      });
      // Чернетка — лише листа; відповідь її не чіпає
      if (!reply) draft.set('');
      reply?.sent?.();
      sentOk = true;
      close();
      // Без зв'язку лист лежить у черзі телефона — чесно кажемо, коли він піде
      if (r.queued) {
        toast(QUEUED);
        return;
      }
      document.dispatchEvent(new CustomEvent('radovalka:sent'));
      toast(sentToast(pet));
    } catch {
      go.disabled = false;
      toast('Не отправилось. Текст сохранён — попробуй ещё раз.');
    }
  });

  // На весь екран, як у месенджері: заголовок, переписка (або цитата), інструменти, поле, знизу — «Когда», хто понесе, «Отправить»
  const title = preset.help ? '✨ Помочь написать' : reply ? 'Ответ' : `Письмо ${me.toWhom}`;
  const backdrop = h('div', { class: 'backdrop', onclick: () => close() });
  const sheet = h('div', { class: `sheet sheet-full sheet-maker sheet-write${reply ? ' is-reply' : ''}${thread ? ' has-thread' : ''}${preset.help ? ' is-help-solo' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    writeDecor(),
    h('div', { class: 'sheet-inner' }, ...[
      h('div', { class: 'write-head' },
        h('h2', {}, title),
        h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: () => close() }, '✕')),
      ctx,
      thread,
      split?.bar,
      tools,
      attBox,
      area,
      h('div', { class: 'write-dock' }, ...[
        whereRow, envRow, festBtn, note,
        h('div', { class: 'write-send' }, ...[pets.length ? petRow : null, go].filter(Boolean)),
      ]),
    ].filter(Boolean)));
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  split?.mount(sheet);
  // Спливає знизу, від кнопки «Написать…»; клавіатура — вже після, щоб вікно не перебудовувалось посеред руху
  sheet.style.animation = 'none';
  const shown = reduceMotion ? null
    : sheet.animate([MOVE, STILL], { duration: 200, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  if (shown) backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  // Клавіатура стискає вікно — переписка лишається притиснутою донизу, найсвіжіше біля поля
  if (thread) new ResizeObserver(() => { thread.scrollTop = thread.scrollHeight; }).observe(thread);
  // Вікно відкрилось — фон під ним на паузу; клавіатура — вже після руху
  const settled = () => {
    if (!sheet.isConnected) return;
    document.documentElement.classList.add('is-covered');
    const later = self.requestIdleCallback || ((fn) => setTimeout(fn, 800));
    later(() => { if (sheet.isConnected) snapWrite(sheet); }, { timeout: 3000 });
  };
  const focusArea = () => { if (!area.value && !preset.help) area.focus(); };
  if (shown) shown.finished.then(() => { settled(); focusArea(); }, () => {});
  else { settled(); focusArea(); }
  if (area.value) grow();
  return { sheet, area };
}

// Межа між верхом вікна (переписка чи цитата) і полем: тягнеш угору чи вниз — міняються висоти, поле бере решту.
// Телефон пам'ятає висоту верху; поле не нижче 80px (CSS), вікно не прокручується (з клавіатурою теж)
const SPLIT_KEY = 'radovalka:write-split';
const MIN_TOP = 44;
// key — окремо для листа й відповіді: цитата здебільшого коротка, їй не потрібна висота всієї переписки
function splitter(top, area, key) {
  let sheet = null;
  const grip = h('div', {
    class: 'write-split', role: 'separator', 'aria-orientation': 'horizontal', tabindex: '0',
    'aria-label': 'Граница между перепиской и полем: потяни вверх или вниз',
  }, h('span', { class: 'write-split-grip', 'aria-hidden': 'true' }));
  const on = () => !!sheet?.classList.contains('is-split');
  const set = (px) => {
    sheet.classList.add('is-split');
    area.style.height = '';
    const want = Math.max(MIN_TOP, Math.round(px));
    sheet.style.setProperty('--top-h', `${want}px`);
    // Вікно не прокручується: що не влізло (поле вже мінімальне) — забираємо з верху
    const over = sheet.scrollHeight - sheet.clientHeight;
    if (over > 0) sheet.style.setProperty('--top-h', `${Math.max(MIN_TOP, want - over)}px`);
  };
  const topH = () => top.getBoundingClientRect().height;
  const save = () => { try { localStorage.setItem(key, String(Math.round(topH()))); } catch { /* не запам'ятає */ } };
  let y0 = 0;
  let h0 = 0;
  grip.addEventListener('pointerdown', (e) => {
    y0 = e.clientY;
    h0 = topH();
    grip.setPointerCapture(e.pointerId);
    grip.classList.add('is-drag');
    e.preventDefault();
  });
  grip.addEventListener('pointermove', (e) => { if (grip.hasPointerCapture(e.pointerId)) set(h0 + e.clientY - y0); });
  const end = () => { if (!grip.classList.contains('is-drag')) return; grip.classList.remove('is-drag'); save(); };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowUp' ? -24 : e.key === 'ArrowDown' ? 24 : 0;
    if (!d) return;
    e.preventDefault();
    set(topH() + d);
    save();
  });
  const mount = (s) => {
    sheet = s;
    let saved = 0;
    try { saved = Number(localStorage.getItem(key)) || 0; } catch { /* як уперше */ }
    if (saved) set(saved);
    // Клавіатура стискає вікно — поле не зникає: верх поступається
    new ResizeObserver(() => { if (on() && sheet.scrollHeight > sheet.clientHeight) set(topH()); }).observe(sheet);
  };
  return { bar: grip, mount, on };
}
