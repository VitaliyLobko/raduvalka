// Велике вікно «Написать»: лист зараз, на ранок, до свого часу чи у її/його конверт. Звичайний лист пишуть у рядку під
// чатом (compose.js), сюди — з його «＋» («В конверт», «🎉 Праздничное»), ⤢ у довгому рядку і «✨ Помочь»
import { sfx } from './sound.js';
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
  if (snapped || sheet.classList.contains('is-edit')) return;
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
// З рядка під чатом: where ('time' + at | 'morning' | 'env'), pet — хто понесе, text — уже набране (для відповіді),
// help — одразу розгорнути «✨ Помочь», onClose(sent, text) — вікно закрилось: надіслано чи ні і що лишилось у полі.
// edit — { env, note, done } — правка листа, що вже лежить у її конверті (note — з envelopes/theirs): той самий екран,
// але без чернетки й без «хто понесе», «Сохранить» замість «Отправить»; done() — після збереження чи прибирання
export function openWrite(preset = {}) {
  const reply = preset.reply || null;
  const edit = preset.edit || null;
  const me = who();
  const envs = DATA.partnerEnvelopes || [];
  const presetEnv = edit ? edit.env.id : envs.some((e) => e.id === preset.envId) ? preset.envId : null;
  // 'time' — свій час (atTime), як «Ко времени» в рядку; «на утро» — той самий свій час о 8:00
  let atTime = preset.where === 'morning' ? nextMorning().getTime() : preset.at > Date.now() ? preset.at : 0;
  let where = presetEnv || (preset.where === 'env' && envs.length) ? 'env' : atTime ? 'time' : 'now';
  let envId = presetEnv || envs[0]?.id || null;
  let pet = DATA.mascots[preset.pet] ? preset.pet : petFor('push');
  let sentOk = false;
  // Святковий — лише з плитки «🎉 Праздничное»: kind 'date', золотий конверт, приносять усі; у конверт — не буває
  const festive = !!preset.festive && where !== 'env';
  // Коли прийде: undefined — зараз
  const sendAt = () => (where === 'time' ? atTime : undefined);

  const said = `Пиши как есть — так, как ${me.partner === 'она' ? 'сказал' : 'сказала'} бы вслух…`;
  const area = h('textarea', { class: 'write-text', 'data-voice': true, 'aria-label': reply ? 'Текст ответа' : 'Текст письма', placeholder: reply ? 'Пару слов в ответ…' : said });
  // Чернетка — лише в листа: відповідь коротка й прив'язана до свого повідомлення
  if (edit) area.value = edit.note.text || '';
  else if (!reply) {
    area.value = draft.get();
    area.addEventListener('input', () => draft.set(area.value));
  } else if (preset.text) area.value = preset.text;

  const note = h('p', { class: 'write-note' });
  // Вкладення (кілька, до MAX_ATT): фото, гифки, голос, пісні — лише в конверт або святковий
  let atts = [];
  // Правка: уже покладені вкладення (at — номер у списку на сервері); прибрані — у dropped, підуть на сервер при «Сохранить»
  const oldMedia = edit?.note.media;
  let olds = !oldMedia || oldMedia.gone ? [] : (oldMedia.k === 'multi' ? oldMedia.items || [] : [oldMedia]).map((x, at) => ({ ...x, at }));
  const dropped = [];
  const editRow = edit ? (edit.note.own ? edit.note.id : edit.note.row) : null;
  const attCount = () => olds.length + atts.length;
  // id — один на набір вкладень: повтор після обірваної відповіді сервер упізнає й не покладе листа вдруге; змінили набір — новий
  let attCid = null;
  const attOk = () => where === 'env' || festive;
  const attBox = h('div', { class: 'write-att', hidden: true });
  const lazyAttach = () => import('./envattach.js');
  // Плитки під полем: уже покладені (правка) і нові; тап по новому фото — знову редактор
  const paintAtt = async () => {
    attBox.hidden = !attCount() || !attOk();
    if (!attCount()) { attBox.replaceChildren(); return; }
    const ea = await lazyAttach();
    attBox.replaceChildren(
      ...olds.map((a) => ea.attachTile(a, { row: editRow, onRemove: () => { if (!olds.includes(a)) return; olds = olds.filter((x) => x !== a); dropped.push(a.at); paintAtt(); } })),
      ...atts.map((a) => ea.attachTile(a, {
        onRemove: () => { if (!atts.includes(a)) return; atts = atts.filter((x) => x !== a); attCid = null; paintAtt(); paintNote(); },
        onOpen: a.k === 'photo' ? () => ea.editPhoto(a, (b) => { atts = atts.map((x) => (x === a ? b : x)); attCid = null; paintAtt(); }) : null,
      })));
  };
  // Ще одне до вже прикладених (не замість); quiet — пачка фото з галереї, тост один на всю пачку
  const setAtt = async (a, quiet = false) => {
    const { MAX_ATT } = await lazyAttach();
    if (attCount() >= MAX_ATT) { toast(`В одно письмо — не больше ${MAX_ATT} вложений`); return; }
    atts = [...atts, a];
    attCid = null;
    paintAtt();
    paintNote();
    if (!quiet) toast(atts.length > 1 ? `Приложено: ${atts.length}. Можно добавить ещё или отправить` : 'Приложено. Можно добавить ещё или отправить');
  };
  const paintNote = () => {
    const at = sendAt();
    if (edit) { note.textContent = `Ещё не открыто — ${me.partner} увидит уже исправленное.`; return; }
    note.textContent = where === 'now'
      ? `Появится у ${me.partner === 'он' ? 'него' : 'неё'}, как только ${me.partner} откроет Радовалку.`
      : where === 'env'
        ? `Ляжет в конверт — ${me.partner} откроет, когда понадобится.`
        : `Придёт ${dayWord(at)} в ${hhmm(at)} запечатанным конвертом.`;
    if (festive) note.textContent += ' Золотой конверт, принесут все вместе 🎉';
  };

  const chips = (items, picked, onPick) => {
    const row = h('div', { class: 'mk-chips', role: 'radiogroup' });
    const paint = () => row.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === picked)));
    items.forEach(({ v, label, html }) => row.append(h('button', {
      type: 'button', role: 'radio', class: 'mk-chip', 'data-v': v, ...(html ? { html } : {}),
      onclick: () => { picked = v; paint(); onPick(v); },
    }, html ? null : label)));
    paint();
    row.pick = (v) => { picked = v; paint(); };
    return row;
  };

  // «Когда» — за входом: із «В конверт» лише конверти (стрічки нема); із ⤢, «Помочь» і «🎉» — «Сейчас /
  // Ко времени», конверт обирають лише через «＋»
  const timeLabel = () => (where === 'time' ? `🕐 ${dayWord(atTime)} ${hhmm(atTime)}` : 'Ко времени');
  const pickTime = async () => {
    const t = await (await import('./picker.js')).pickSendTime(atTime);
    if (t != null) { atTime = t; where = 'time'; }
    whereRow.pick(where);
    whereRow.querySelector('[data-v="time"]').textContent = timeLabel();
    paintNote();
  };
  const whereRow = chips([
    { v: 'now', label: 'Сейчас' },
    { v: 'time', label: timeLabel() },
  ], where, (v) => {
    if (v === 'time') { pickTime(); return; }
    where = v;
    whereRow.querySelector('[data-v="time"]').textContent = timeLabel();
    paintNote();
  });
  // Конверт — карточкою над полем: який, скільки в ньому лежить і скільки ще не відкрито. Тап — усі конверти сіткою,
  // «Что внутри» — його листи в цьому конверті (поправити, докласти). Що лежить — питаємо, коли вікно «В конверт»
  let theirs = null;
  const envOf = () => envs.find((x) => x.id === envId);
  const cardPick = h('button', {
    type: 'button', class: 'write-envpick',
    onclick: async () => {
      if (edit) return;
      const v = await (await import('./envtpl.js')).pickEnvelope(envs, theirs, envId);
      if (v) { envId = v; paintCard(); }
    },
  });
  // Другий рядок карточки: скільки лежить; є що — тап відкриває «Что внутри»
  const cardLook = h('button', {
    type: 'button', class: 'write-envlook', hidden: true,
    onclick: async () => { const e = envOf(); if (e && !cardLook.disabled) (await import('./envtpl.js')).openTemplates(e, loadTheirs); },
  });
  const envCard = where === 'env' ? h('div', { class: `write-envcard${edit ? ' is-fixed' : ''}` }, cardPick, cardLook) : null;
  const paintCard = () => {
    const e = envOf();
    if (!envCard || !e) return;
    const notes = theirs?.find((x) => x.id === envId)?.notes;
    cardPick.setAttribute('aria-label', edit ? `Конверт «${e.label}»` : `Конверт «${e.label}» — выбрать другой`);
    cardPick.replaceChildren(...[
      h('span', { class: 'write-envemo', 'aria-hidden': 'true' }, e.emoji),
      h('span', { class: 'write-envname' }, h('b', {}, e.label)),
      edit ? null : h('span', { class: 'write-envmore' }, 'сменить ▾')].filter(Boolean));
    cardLook.hidden = !!edit || !notes;
    cardLook.disabled = !notes?.length;
    cardLook.replaceChildren(...[h('span', {}, notes?.length ? envSub(notes) : 'Пока пусто — это письмо будет первым'),
      notes?.length ? h('span', { class: 'write-envgo' }, 'Что внутри ›') : null].filter(Boolean));
  };
  const loadTheirs = () => import('./api.js').then(({ send }) => send('envelopes/theirs?own=1', 'GET'))
    .then((l) => { theirs = l; paintCard(); })
    .catch(() => { /* без звʼязку — без лічильників */ });
  if (envCard) { paintCard(); if (!edit) loadTheirs(); }
  whereRow.classList.add('write-when');
  ribbon(whereRow);
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
  const go = h('button', { type: 'button', class: 'btn btn-primary write-go', html: edit ? 'Сохранить' : `${ARROW}Отправить` });
  const dropBtn = edit ? h('button', { type: 'button', class: 'btn write-drop', onclick: () => dropEdit() }, '🗑 Убрать') : null;

  // Esc — лише верхнє вікно: правка листа відкривається поверх списку конверта й поверх іншого «Написать»
  const onKey = (e) => { if (e.key === 'Escape' && [...document.querySelectorAll('[role=dialog]')].pop() === sheet) close(); };
  // fast — одразу, без згортання: далі відкривається інша шторка (фото, гифка)
  const close = (fast = false) => {
    document.removeEventListener('keydown', onKey);
    // Правка закрилась, а «Написать» під нею ще відкрите — фон лишається на паузі
    if (document.querySelectorAll('.sheet-write').length < 2) document.documentElement.classList.remove('is-covered');
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
    type: 'file', accept: 'image/*', class: 'visually-hidden', multiple: attOk(),
    onchange: async (e) => {
      const files = [...e.target.files];
      const [file] = files;
      e.target.value = '';
      if (!file) return;
      // У конверт і святковий — одразу кілька фото мініатюрами (тап по мініатюрі — редактор)
      if (attOk()) {
        const ea = await lazyAttach();
        const before = atts.length;
        await ea.quickPhotos(files, ea.MAX_ATT - attCount(), (a) => setAtt(a, true));
        const n = atts.length - before;
        if (n) toast(n > 1 ? `Фото приложены: ${n}. Нажми на фото, чтобы обрезать или подписать` : 'Фото приложено. Нажми на него, чтобы обрезать или подписать');
        return;
      }
      close(true);
      composeMeme(file, memeSent, re);
    },
  });
  const musicBtn = attOk() ? h('button', {
    type: 'button', class: 'mk-chip write-music',
    onclick: async () => (await lazyAttach()).pickMusic(setAtt),
  }, '🎵 Музыка') : null;
  const tools = h('div', { class: 'write-tools' },
    h('label', { class: 'mk-chip' }, picker, '📷 Фото'),
    h('button', {
      type: 'button', class: 'mk-chip',
      onclick: async () => {
        if (attOk()) { (await lazyAttach()).pickGif(setAtt); return; }
        close(true);
        openGifs((gif) => composeGif(gif, memeSent, re));
      },
    }, '🎞️ Гифка'),
    musicBtn,
    reply || festive || where === 'env' ? null : h('button', { type: 'button', class: 'mk-chip', onclick: () => { close(true); openGames(); } }, '🎲 Игры'),
    // У конверт — глянути, як лист відкриється в неї (нічого не надсилає)
    where === 'env' ? h('button', {
      type: 'button', class: 'mk-chip write-preview',
      onclick: async () => {
        const e = envOf();
        if (!e) return;
        (await import('./envtpl.js')).previewLetter({ env: e, text: area.value.trim(), list: [...olds, ...atts], row: editRow });
      },
    }, `👁 Как увидит ${me.partner}`) : null,
    helper);

  // Відповідь — над полем цитата (тап — цілим); новий лист — кусок переписки, як у месенджері: новіше внизу, біля поля
  const ctx = reply && !preset.help ? h('button', {
    type: 'button', class: 'write-ctx', 'aria-expanded': 'false',
    onclick: () => ctx.setAttribute('aria-expanded', String(ctx.classList.toggle('is-open'))),
  },
    h('span', { class: 'write-ctx-label' }, 'Отвечаешь на'),
    h('span', { class: 'write-ctx-text' }, reply.quote)) : null;
  // У конверт — без шматка переписки: такий лист читатимуть пізніше, не у відповідь
  const recent = reply || preset.help || where === 'env' ? [] : recentThread();
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
      attCid ||= newCid();
      const to = where === 'env' ? { kind: 'env', env: envId } : { kind: 'date', at: sendAt() };
      await ea.sendAttached({ ...to, text, mascot: pet, cid: attCid }, atts,
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
    sfx('sent');
    toast(sentToast(pet));
  };

  // Правка: текст, прибрані й нові вкладення — по черзі; 409 — вона вже відкрила, правити пізно
  const editFail = (e, ea) => toast(e?.status === 409 ? `Поздно — ${me.partner} уже ${me.partnerOpened}` : ea ? ea.attachError(e) : 'Не сохранилось — нет связи. Попробуй ещё раз');
  const saveEdit = async () => {
    const { send } = await import('./api.js');
    const n = edit.note;
    const text = area.value.trim();
    if (!text && !attCount()) { toast('Пустое письмо не сохранить — лучше убери его'); area.focus(); return; }
    if (!text && !n.own) { toast('У этого письма должен остаться текст'); area.focus(); return; }
    go.disabled = true;
    const label = go.innerHTML;
    const ea = await lazyAttach();
    try {
      if (text !== (n.text || '').trim()) {
        await send(n.own ? `letters/${n.id}` : `envelopes/${edit.env.id}/note/${n.i}`, 'PUT', { text });
      }
      // Із кінця: номери тих, що лишаються, не зсуваються. Прибране — одразу з черги: повтор після обриву
      // не зачепить сусіднє вкладення, що зсунулось на його місце
      const order = [...dropped].sort((a, b) => b - a);
      const dropOne = async (k) => { await send(`letters/${editRow}/media/${k}`, 'DELETE'); dropped.splice(dropped.indexOf(k), 1); };
      // Лист без тексту: останнє вкладення сервер не прибере (лишився б порожній лист) — тож спершу нове, потім останнє старе
      const hold = n.own && !text && !olds.length && atts.length ? order.pop() : undefined;
      for (const k of order) await dropOne(k);
      if (atts.length) {
        const body = { kind: 'env', env: edit.env.id, text: '', cid: newCid(), ...(n.own ? { to: n.id } : { tpl: n.i }) };
        if (ea.hasBytes(atts)) await ea.sendAttached(body, atts, (p) => { go.textContent = `${Math.round(p * 100)}%`; });
        else await send('letters', 'POST', { ...body, media: atts.map(ea.mediaBody) });
        atts = [];
      }
      if (hold !== undefined) await dropOne(hold);
    } catch (e) {
      go.innerHTML = label;
      go.disabled = false;
      editFail(e, ea);
      edit.done?.();
      return;
    }
    sentOk = true;
    close();
    toast('Письмо поправлено');
    edit.done?.();
  };
  const dropEdit = async () => {
    const n = edit.note;
    const { ask } = await import('./ask.js');
    if (!await ask({ title: 'Убрать письмо из конверта?', text: String(n.text || '').slice(0, 120), yes: 'Убрать' })) return;
    const { send } = await import('./api.js');
    try {
      await send(n.own ? `letters/${n.id}` : `envelopes/${edit.env.id}/note/${n.i}`, 'DELETE');
    } catch (e) { editFail(e); return; }
    sentOk = true;
    close();
    toast('Письмо убрано из конверта');
    edit.done?.();
  };

  go.addEventListener('click', async () => {
    if (edit) { saveEdit(); return; }
    const text = area.value.trim();
    const withAtt = attOk() && atts.length > 0;
    if (!text && !withAtt) { area.focus(); return; }
    go.disabled = true;
    if (withAtt && (await lazyAttach()).hasBytes(atts)) { sendAttached(text); return; }
    try {
      const r = await deliver('letter', 'letters', {
        ...(withAtt ? { media: atts.map((await lazyAttach()).mediaBody) } : {}),
        // Свій час на сервері — kind 'morning' з at
        kind: where === 'env' ? 'env' : festive ? 'date' : where === 'now' ? 'now' : 'morning',
        text,
        mascot: pet,
        env: where === 'env' ? envId : undefined,
        at: sendAt(),
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
      sfx('sent');
      toast(sentToast(pet));
    } catch {
      go.disabled = false;
      toast('Не отправилось. Текст сохранён — попробуй ещё раз.');
    }
  });

  // На весь екран, як у месенджері: заголовок, переписка (або цитата), інструменти, поле, знизу — «Когда», хто понесе, «Отправить»
  const title = preset.help ? '✨ Помочь написать' : reply ? 'Ответ' : edit ? 'Правка письма' : festive ? '🎉 Праздничное письмо' : where === 'env' ? 'Письмо в конверт' : `Письмо ${me.toWhom}`;
  const backdrop = h('div', { class: 'backdrop', onclick: () => close() });
  const sheet = h('div', { class: `sheet sheet-full sheet-maker sheet-write${reply ? ' is-reply' : ''}${thread ? ' has-thread' : ''}${preset.help ? ' is-help-solo' : ''}${where === 'env' ? ' is-env' : ''}${edit ? ' is-edit' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    writeDecor(),
    h('div', { class: 'sheet-inner' }, ...[
      h('div', { class: 'write-head' },
        h('h2', {}, title),
        h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: () => close() }, '✕')),
      ctx,
      thread,
      split?.bar,
      envCard,
      tools,
      area,
      attBox,
      h('div', { class: 'write-dock' }, ...[
        where === 'env' ? null : whereRow, note,
        h('div', { class: 'write-send' }, ...(edit ? [dropBtn, go] : [pets.length ? petRow : null, go]).filter(Boolean)),
      ].filter(Boolean)),
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
  // Правка: уже покладені вкладення — плитками одразу
  if (olds.length) paintAtt();
  return { sheet, area };
}

const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
function envSub(notes) {
  if (!notes) return 'конверт';
  if (!notes.length) return 'пока пусто';
  const left = notes.filter((n) => !n.read).length;
  return `${notes.length} ${plural(notes.length, 'письмо', 'письма', 'писем')} · ${left ? `не открыто ${left}` : 'все открыты'}`;
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
