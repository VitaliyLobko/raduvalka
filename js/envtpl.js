// «Что внутри»: його листи в її конверті — заготовки й написані в застосунку, по черзі, як вона їх відкриватиме.
// Ще не відкрите — тап, і воно відкривається у великому вікні правки (текст, вкладення, «Убрать»); відкриті — згорнуті.
// І вибір конверта сіткою з лічильниками. Вантажиться лише з тапу
import { send } from './api.js';
import { h, signLine } from './ui.js';
import { DATA, SIDES, who } from './data.js';

// «👁 Как увидит»: лист так, як його відкриє друга половина з конверта — картинки над текстом, звук під ним, підпис.
// Нічого не надсилає. row — id рядка на сервері для вже покладених вкладень; нові (a.blob) — ще в телефоні
export async function previewLetter({ env, text, list = [], row = null }) {
  const partner = SIDES[DATA.side === 'vin' ? 'vona' : 'vin'];
  const slot = list.length ? h('div', { class: 'ea-slot' }, h('p', { class: 'ea-wait' }, 'Достаю вложения…')) : null;
  const below = list.length ? h('div', { class: 'ea-slot ea-below' }) : null;
  let stop = null;
  const onKey = (e) => {
    if (e.key !== 'Escape' || [...document.querySelectorAll('[role=dialog]')].pop() !== reader) return;
    e.stopPropagation();
    close();
  };
  const close = () => { stop?.(); document.removeEventListener('keydown', onKey, true); reader.remove(); };
  const back = h('button', { type: 'button', class: 'btn btn-primary', onclick: close }, 'Вернуться к письму');
  const reader = h('div', {
    class: 'reader is-preview', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Как увидит',
    onclick: (e) => { if (!e.target.closest('.letter, .btn')) close(); },
  }, h('div', { class: 'reader-inner' },
    h('p', { class: 'preview-label' }, `👁 Так письмо откроется у ${who().partner === 'она' ? 'неё' : 'него'}`),
    h('article', { class: 'letter' },
      h('p', { class: 'letter-kind' }, `${env.emoji} Открой, когда ${env.label}`),
      slot,
      text ? h('p', { class: 'letter-text' }, text) : null,
      below,
      signLine(DATA.mySign, partner.from)),
    h('div', { class: 'actions' }, back)));
  document.body.append(reader);
  document.addEventListener('keydown', onKey, true);
  back.focus();
  if (!list.length) return;
  try {
    const ea = await import('./envattach.js');
    const m = await ea.renderList(row, list, { split: true });
    if (!reader.isConnected) { m.stop(); return; }
    stop = m.stop;
    slot.replaceChildren(...[m.el].filter(Boolean));
    below.replaceChildren(...[m.sound].filter(Boolean));
  } catch {
    if (reader.isConnected) slot.replaceChildren(h('p', { class: 'ea-wait' }, 'Вложения не загрузились — нет связи'));
  }
}

const IC = { photo: '📷', gif: '🎞️', voice: '🎤', song: '🎵', link: '🔗' };
const items = (m) => (!m || m.gone ? [] : m.k === 'multi' ? m.items || [] : [m]);
const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

// Шторка поверх «Написать»: заголовок, ✕, тіло. Esc — лише коли вона зверху (а не правка листа над нею)
function sheetOf(cls, label, title) {
  const onKey = (e) => {
    if (e.key !== 'Escape' || [...document.querySelectorAll('[role=dialog]')].pop() !== sheet) return;
    e.stopPropagation();
    close();
  };
  const close = () => { document.removeEventListener('keydown', onKey, true); backdrop.remove(); sheet.remove(); sheet.onclose?.(); };
  const backdrop = h('div', { class: 'backdrop tpl-shade', onclick: close });
  const sheet = h('div', { class: `sheet tpl-sheet ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label },
    h('div', { class: 'write-head' },
      h('h2', {}, title),
      h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕')));
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey, true);
  return { sheet, close };
}

// Усі конверти сіткою: емодзі, назва, скільки лежить і скільки ще не відкрито. Повертає id обраного чи null
export function pickEnvelope(envs, theirs, current) {
  return new Promise((done) => {
    let picked = null;
    const { sheet, close } = sheetOf('env-grid-sheet', 'Выбрать конверт', 'Какой конверт?');
    sheet.onclose = () => done(picked);
    const notesOf = (id) => theirs?.find((x) => x.id === id)?.notes;
    sheet.append(h('div', { class: 'env-grid', role: 'radiogroup', 'aria-label': 'Конверты' }, ...envs.map((e) => {
      const notes = notesOf(e.id);
      const left = notes ? notes.filter((n) => !n.read).length : 0;
      const sub = !notes ? '' : !notes.length ? 'пусто' : `${notes.length} ${plural(notes.length, 'письмо', 'письма', 'писем')} · ${left ? `не открыто ${left}` : 'все открыты'}`;
      return h('button', {
        type: 'button', role: 'radio', class: `env-cell${left ? '' : ' is-low'}`, 'aria-checked': String(e.id === current),
        onclick: () => { picked = e.id; close(); },
      },
      h('span', { class: 'env-cell-emo', 'aria-hidden': 'true' }, e.emoji),
      h('b', { class: 'env-cell-name' }, e.label),
      sub ? h('small', { class: 'env-cell-sub' }, sub) : null);
    })));
  });
}

// env — { id, emoji, label } з DATA.partnerEnvelopes; changed() — щось поправили, доклали чи прибрали
export async function openTemplates(env, changed) {
  const list = h('div', { class: 'tpl-list', 'aria-live': 'polite' }, h('p', { class: 'ea-wait' }, 'Достаю письма…'));
  const { sheet } = sheetOf('', `Что внутри: ${env.label}`, `${env.emoji} ${env.label}`);
  sheet.append(h('p', { class: 'tpl-hint' }, 'Откроет по порядку, сверху вниз. Неоткрытое можно поправить — нажми на письмо.'), list);
  let showRead = false;

  const editNote = async (note) => {
    const { openWrite } = await import('./write.js');
    openWrite({ where: 'env', edit: { env, note, done: () => { changed?.(); paint(); } } });
  };
  // Картка листа: початок тексту почерком, значки вкладень; ще не відкрите — кнопка в правку
  const card = (note) => {
    const text = String(note.text || '').replace(/\s+/g, ' ').trim();
    const att = items(note.media);
    const meta = h('span', { class: 'tpl-meta' },
      att.length ? h('span', { class: 'tpl-att', 'aria-label': `вложений: ${att.length}` }, att.map((x) => IC[x.k] || '📎').join(' ')) : null,
      note.media?.gone ? h('span', { class: 'tpl-att' }, '📎 удалено') : null,
      h('span', { class: 'tpl-when' }, note.read ? 'открыто ✓' : 'ещё не открыто'));
    const body = [h('span', { class: 'tpl-text' }, text || (att.length ? 'Без текста' : '…')), meta];
    if (note.read) return h('div', { class: 'tpl-card is-read' }, ...body);
    return h('button', { type: 'button', class: 'tpl-card', 'aria-label': `Поправить письмо: ${text.slice(0, 60)}`, onclick: () => editNote(note) },
      ...body, h('span', { class: 'tpl-go', 'aria-hidden': 'true' }, '›'));
  };

  async function paint() {
    let notes;
    try {
      notes = (await send('envelopes/theirs?own=1', 'GET')).find((e) => e.id === env.id)?.notes || [];
    } catch {
      list.replaceChildren(h('p', { class: 'ea-wait' }, 'Нет связи — список не загрузился'));
      return;
    }
    if (!sheet.isConnected) return;
    if (!notes.length) { list.replaceChildren(h('p', { class: 'ea-wait' }, 'В этом конверте пока пусто')); return; }
    const fresh = notes.filter((n) => !n.read);
    const read = notes.filter((n) => n.read);
    const fold = read.length ? h('button', {
      type: 'button', class: 'tpl-fold', 'aria-expanded': String(showRead),
      onclick: () => { showRead = !showRead; paint(); },
    }, `${showRead ? '▾' : '▸'} Открытые · ${read.length} ${plural(read.length, 'письмо', 'письма', 'писем')}`) : null;
    list.replaceChildren(...[
      ...(fresh.length ? fresh.map(card) : [h('p', { class: 'ea-wait' }, 'Всё, что лежало, уже открыто')]),
      fold,
      ...(showRead ? read.map(card) : []),
    ].filter(Boolean));
  }
  paint();
}
