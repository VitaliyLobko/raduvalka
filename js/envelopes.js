// «Відкрий, коли…»: полиця конвертів на різні випадки
import { DATA, who } from './data.js';
import { save, send } from './api.js';
import { mascotImg, petName, petFor, petLine } from './icons.js';
import { h, toast, cap, waxSeal, reduceMotion, signLine, ENV_POCKET, SAGITTARIUS_GLYPH } from './ui.js';

// Скільки листів уже прочитано в кожному конверті: { hard: 1 } — зберігається на сервері
const seen = () => (DATA.mine.seen ||= {});

const left = (env) => Math.max(0, env.notes.length - (seen()[env.id] || 0));
const readCount = (env) => Math.min(env.notes.length, seen()[env.id] || 0);
const noteText = (note) => (typeof note === 'string' ? note : note.text || '');
// Нове — непрочитана записка, яку дописали в застосунку ({ id, text }); заготовки (рядки) новими не рахуємо
const fresh = (env) => env.notes.slice(seen()[env.id] || 0).some((n) => typeof n !== 'string');

// Сургучна крапка на марці «Конверты», поки в якомусь конверті лежить нова записка
export function markEnvelopes() {
  document.querySelector('.tab[data-tab="envelopes"]')?.classList.toggle('has-new', DATA.envelopes.some(fresh));
}

// Хто приносить конверт: основний кур'єр або варіант із env.looks [{ mascot, pose, line }].
// Міняється раз на добу (за місцевою датою), конверти — не всі разом
function look(env) {
  const own = { mascot: env.mascot, pose: env.pose, line: env.mascotLine };
  const all = [own, ...(env.looks || [])].filter((l) => DATA.mascots[l.mascot]);
  if (!all.length) return own;
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
  const salt = [...String(env.id)].reduce((s, c) => s + c.charCodeAt(0), 0);
  const pick = all[(day + salt) % all.length];
  return { ...pick, line: pick.line || env.mascotLine };
}

// say — ключ своєї репліки курʼєра в базі замість line
function courier(env, line, say) {
  const l = look(env);
  line = petLine(l.mascot, say, line);
  return h('div', { class: 'courier' },
    h('span', { class: 'mascot', html: mascotImg(l.mascot, l.pose) }),
    h('p', { class: 'bubble' }, h('b', {}, `${petName(l.mascot)}: `), line || l.line));
}

// Кишеня конверта: бічні й нижній клини зі згинами — як у великого конверта листа
const POCKET = '<svg viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><path class="me-pocket" d="M0 0 150 112 300 0V200H0z"/>'
  + '<path class="me-fold" d="M0 200 132 122M300 200 168 122"/></svg>';
// Три кольори паперу по черзі й легкий нахил — наче конверти розклали на столі
// Клапан — SVG: свій край зі згином і тінь, щоб не зливався з кишенею
const FLAP = '<svg viewBox="0 0 300 112" preserveAspectRatio="none" aria-hidden="true"><path class="me-flap-fill" d="M0 0H300L150 112Z"/>'
  + '<path class="me-flap-edge" d="M0 1 150 111 300 1"/></svg>';
const TINTS = ['--lavender', '--powder', '--cream'];
const TILTS = [-2.5, 1.8, 1.2, -2];

export function renderEnvelopes(screen) {
  let opening = false;
  const cards = DATA.envelopes.map((env, i) => {
    const n = left(env);
    const isNew = fresh(env);
    const card = h('button', {
      type: 'button',
      class: `env-card${n ? '' : ' is-empty'}${isNew ? ' is-new' : ''}`,
      style: `--tint: var(${TINTS[i % TINTS.length]}); --tilt: ${TILTS[i % TILTS.length]}deg`,
      'aria-label': `Открой, когда ${env.label}. ${n ? `Писем: ${n}` : 'Пусто'}${isNew ? '. Есть новое' : ''}`,
      onclick: () => {
        if (opening) return;
        // Тап — одразу великий конверт у читанні (міні на полиці вдруге не відкриваємо)
        opening = true;
        openCard(screen, env);
      },
    },
    h('span', { class: 'mini-env', 'aria-hidden': 'true' },
      h('span', { class: 'me-back' }),
      ...Array.from({ length: Math.min(n, 3) }, (_, k) => h('span', { class: 'me-paper', style: `--k: ${k}` })),
      h('span', { class: 'me-front', html: POCKET }),
      h('span', { class: 'me-flap', html: FLAP }),
      h('span', { class: 'me-seal', html: waxSeal('') }, h('span', { class: 'me-emoji' }, env.emoji))),
    isNew ? h('span', { class: 'env-new', 'aria-hidden': 'true' }, 'новое') : null,
    h('span', { class: 'env-label' }, env.label),
    h('span', { class: 'env-meta' }, n ? `${n} ${plural(n)}` : 'пусто'),
    env.signal && DATA.partnerPush ? h('span', { class: 'env-signal' }, `${cap(who().partner)} узнает, когда откроешь`) : null);
    // Прочитані — окремим чипом під конвертом: перечитати, не розпечатуючи нового
    const done = readCount(env);
    return h('div', { class: 'env-slot' }, card, done ? h('button', {
      type: 'button', class: 'mk-chip env-reread', 'aria-label': `Перечитать прочитанные: ${done}`,
      onclick: () => { if (!opening) { opening = true; openReread(screen, env); } },
    }, `📖 ${done}`) : null);
  });

  // На полиці — улюбленець-утішник (роль push), як у «Хотелках»
  const pet = petFor('push');
  screen.replaceChildren(...[
    // Заголовок говорить улюбленець; сам h2 — лише для екранного диктора (без улюбленця — видимий, як раніше)
    h('h2', { class: pet ? 'title visually-hidden' : 'title' }, 'Открой, когда…'),
    pet ? h('div', { class: 'courier want-courier env-courier' },
      h('span', { class: 'mascot', html: mascotImg(pet) }),
      h('p', { class: 'bubble' }, h('b', {}, `${petName(pet)}: `), h('span', { class: 'env-say' }, 'Открой, когда…'))) : null,
    h('div', { class: 'env-grid' }, ...cards),
  ].filter(Boolean));
  markEnvelopes();
}

function plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'письмо';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'письма';
  return 'писем';
}

function openCard(screen, env) {
  const me = who();
  const n = left(env);
  let reader;
  let onClose = null;
  const close = () => { onClose?.(); reader.cleanup(); reader.remove(); renderEnvelopes(screen); };
  // «📖 Перечитать» — з порожнього конверта й з-під щойно відкритого листа: до списку прочитаних
  const rereadBtn = (count = true) => (readCount(env) ? h('button', {
    type: 'button', class: 'btn env-reread-btn',
    onclick: () => { onClose?.(); reader.cleanup(); reader.remove(); openReread(screen, env); },
  }, count ? `📖 Перечитать (${readCount(env)})` : '📖 Перечитать') : null);

  if (!n) {
    // Другому летить push «конверт порожній»; «узнает» — лише якщо йому справді є куди його надіслати
    const text = h('p', { class: 'letter-text' }, readCount(env) ? 'Новых записок пока нет ✍️' : 'Записок пока нет ✍️');
    reader = overlay(close,
      courier(env, 'Тут пока пусто.', 'envEmpty'),
      h('div', { class: 'letter letter-empty' }, text),
      h('div', { class: 'actions' }, ...[rereadBtn(), h('button', { type: 'button', class: 'btn btn-primary', onclick: close }, 'Хорошо')].filter(Boolean)));
    send(`envelopes/${env.id}/empty`, 'POST').then((r) => { if (r?.reaches) text.textContent = me.partnerKnows; }).catch(() => {});
    return;
  }

  const read = seen()[env.id] || 0;
  // Записка із заготовки — рядок; дописана в застосунку — { id, text }, і відправник побачить, що її відкрили
  const note = env.notes[read];
  const text = typeof note === 'string' ? note : note.text;
  // Прочитано — лише коли лист справді показали: з вкладенням — після того, як воно завантажилось
  const commit = () => {
    seen()[env.id] = read + 1;
    save('mine', { seen: seen() });
    if (note.id) save(`letters/${note.id}`, { opened: true });
    // Конверт-сигнал: другому push «відкрила»; тост — лише коли йому справді є куди його надіслати
    if (env.signal) {
      send(`envelopes/${env.id}/opened`, 'POST')
        .then((r) => { if (r?.reaches) toast(`${cap(me.partner)} узнает, что ты ${me.youOpened} этот конверт 💜`); })
        .catch(() => {});
    }
  };
  // Вкладення (фото, гифка, голос, пісня) — над текстом; модуль вантажиться лише для такого листа
  const slot = note.media ? h('div', { class: 'ea-slot' }, h('p', { class: 'ea-wait' }, 'Достаю из конверта…')) : null;
  let stopMedia = null;

  let liked = false;
  const heart = h('button', {
    type: 'button',
    class: 'btn btn-heart',
    'aria-pressed': 'false',
    onclick: () => {
      liked = !liked;
      if (note.id) { save(`letters/${note.id}`, { liked }); note.liked = liked; }
      heart.setAttribute('aria-pressed', String(liked));
      heart.replaceChildren(h('span', { class: 'heart', 'aria-hidden': 'true' }, liked ? '❤️' : '🤍'), liked ? 'Нравится' : 'Сердечко');
      // Сердечко бачить лише записка, дописана в застосунку; заготовка його нікуди не передає
      if (liked && note.id) toast(`${cap(me.partner)} увидит твоё ❤️`);
    },
  }, h('span', { class: 'heart', 'aria-hidden': 'true' }, '🤍'), 'Сердечко');

  // Великий конверт: сургуч злітає, клапан відкидається, лист виїжджає — тоді сама записка
  const big = reduceMotion ? null : h('div', { class: 'stage env-stage' },
    h('span', { class: 'envelope' },
      h('span', { class: 'env-back' }),
      h('span', { class: 'paper-peek' }),
      h('span', { class: 'env-front', html: ENV_POCKET }),
      h('span', { class: 'env-flap' }),
      h('span', { class: 'seal', 'aria-hidden': 'true', html: waxSeal(SAGITTARIUS_GLYPH) })));
  reader = overlay(close,
    big,
    courier(env),
    h('article', { class: 'letter' },
      h('p', { class: 'letter-kind' }, `${env.emoji} Открой, когда ${env.label}`),
      slot,
      text ? h('p', { class: 'letter-text' }, text) : null,
      signLine(DATA.partnerSign, me.from)),
    h('div', { class: 'actions' },
      ...[heart, read ? rereadBtn(false) : null,
        h('button', { type: 'button', class: 'btn btn-primary', onclick: close }, 'Закрыть')].filter(Boolean)));

  if (big) {
    const inner = reader.querySelector('.reader-inner');
    inner.classList.add('is-sealed');
    requestAnimationFrame(() => requestAnimationFrame(() => big.firstChild.classList.add('is-opening')));
    setTimeout(() => { big.remove(); inner.classList.remove('is-sealed'); reader.querySelector('.btn-primary')?.focus(); }, 1150);
  }

  onClose = () => stopMedia?.();
  if (!slot) { commit(); return; }
  // Не завантажилось (нема звʼязку) — лист лишається в конверті непрочитаним
  import('./envattach.js').then((ea) => ea.renderAttach(note)).then((m) => {
    if (!reader.isConnected) { m.stop(); return; }
    stopMedia = m.stop;
    slot.replaceChildren(m.el);
    commit();
  }).catch(() => {
    if (!reader.isConnected) return;
    toast('Вложение не загрузилось — нет связи. Письмо осталось в конверте');
    close();
  });
}

// «📖 Перечитать»: уже відкриті листи цього конверта, свіжіші зверху; тап — лист цілком (без позначок «прочитано»)
function openReread(screen, env) {
  const done = env.notes.slice(0, readCount(env)).map((note, i) => ({ note, i })).reverse();
  let reader;
  const close = () => { reader.cleanup(); reader.remove(); renderEnvelopes(screen); };
  const preview = (note) => {
    const t = noteText(note).replace(/\s+/g, ' ').trim();
    const pic = note.media ? `${MEDIA_ICON[note.media.k] || '📎'} ` : '';
    return pic + (t.length > 90 ? `${t.slice(0, 90)}…` : t || 'вложение');
  };
  reader = overlay(close,
    h('article', { class: 'letter env-reread-list' },
      h('p', { class: 'letter-kind' }, `${env.emoji} Открой, когда ${env.label}`),
      h('h3', { class: 'env-reread-title' }, `Прочитанные · ${done.length}`),
      h('div', { class: 'env-reread-items' }, ...done.map(({ note }) => h('button', {
        type: 'button', class: 'env-reread-item',
        onclick: () => { reader.cleanup(); reader.remove(); readAgain(screen, env, note); },
      }, h('span', { class: 'env-reread-text' }, preview(note)), note.liked ? h('span', { 'aria-label': 'с сердечком' }, '❤️') : null)))),
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: close }, 'Закрыть')));
}

const MEDIA_ICON = { photo: '📷', gif: '🎞', voice: '🎤', song: '🎵', link: '🎵' };

function readAgain(screen, env, note) {
  const me = who();
  let reader;
  let stop = null;
  const shut = () => { stop?.(); reader.cleanup(); reader.remove(); };
  const close = () => { shut(); renderEnvelopes(screen); };
  const text = noteText(note);
  const slot = note.media ? h('div', { class: 'ea-slot' }, h('p', { class: 'ea-wait' }, 'Достаю из конверта…')) : null;
  reader = overlay(close,
    h('article', { class: 'letter' },
      h('p', { class: 'letter-kind' }, `${env.emoji} Открой, когда ${env.label}`),
      slot,
      text ? h('p', { class: 'letter-text' }, text) : null,
      signLine(DATA.partnerSign, me.from)),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => { shut(); openReread(screen, env); } }, '← К списку'),
      h('button', { type: 'button', class: 'btn btn-primary', onclick: close }, 'Закрыть')));
  if (!slot) return;
  import('./envattach.js').then((ea) => ea.renderAttach(note)).then((m) => {
    if (!reader.isConnected) { m.stop(); return; }
    stop = m.stop;
    slot.replaceChildren(m.el);
  }).catch(() => { if (reader.isConnected) slot.replaceChildren(h('p', { class: 'ea-wait' }, 'Вложение не загрузилось — нет связи')); });
}

// Закривається тапом будь-де поза самим листом, реплікою, улюбленцем і кнопками, а також Esc
function overlay(close, ...children) {
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const reader = h('div', {
    class: 'reader',
    role: 'dialog',
    'aria-modal': 'true',
    onclick: (e) => { if (!e.target.closest('.letter, .bubble, .mascot, .btn')) close(); },
  }, h('div', { class: 'reader-inner' }, ...children));
  reader.cleanup = () => document.removeEventListener('keydown', onKey);
  document.addEventListener('keydown', onKey);
  document.body.append(reader);
  reader.querySelector('.btn-primary').focus();
  return reader;
}
