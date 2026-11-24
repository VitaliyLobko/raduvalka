// «Уже в конверте»: його заготовлені записки в її конверті — поправити текст, прибрати чи докласти фото, гифку, пісню
// (лише до ще не прочитаної). Вкладення стає на місце записки (сервер: kind 'tpl'). Вантажиться лише з тапу
import { send } from './api.js';
import { h, toast } from './ui.js';
import { newCid } from './outbox.js';
import { ask } from './ask.js';

const ICON = { photo: '📷 фото', gif: '🎞️ гифка', voice: '🎤 голос', song: '🎵 песня', link: '🎵 песня по ссылке' };

// env — { id, emoji, label } з DATA.partnerEnvelopes; changed() — щось доклали чи прибрали
export async function openTemplates(env, changed) {
  const ea = await import('./envattach.js');
  const list = h('div', { class: 'tpl-list', 'aria-live': 'polite' }, h('p', { class: 'ea-wait' }, 'Достаю письма…'));
  const close = () => { document.removeEventListener('keydown', onKey, true); backdrop.remove(); sheet.remove(); };
  // Esc — лише коли зверху саме цей список (а не редактор фото чи вибір пісні над ним); вікно листа під ним лишається
  const onKey = (e) => {
    if (e.key !== 'Escape' || [...document.querySelectorAll('[role=dialog]')].pop() !== sheet) return;
    e.stopPropagation();
    close();
  };
  const backdrop = h('div', { class: 'backdrop tpl-shade', onclick: close });
  const sheet = h('div', { class: 'sheet tpl-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Уже в конверте: ${env.label}` },
    h('div', { class: 'write-head' },
      h('h2', {}, `${env.emoji} ${env.label}`),
      h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕')),
    h('p', { class: 'tpl-hint' }, 'Письмо, которое ещё не открыли, можно поправить ✏️, убрать 🗑 или приложить к нему фото, гифку, музыку.'),
    list);
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey, true);

  // Один запит — одна відповідь сервера; помилка — чесно, без черги: записку могли вже прочитати
  const upload = async (note, a, row) => {
    row.classList.add('is-busy');
    const st = row.querySelector('.tpl-state');
    st.parentElement.hidden = false;
    st.textContent = 'Отправляю…';
    try {
      const body = { kind: 'env', env: env.id, tpl: note.i, text: '', cid: newCid() };
      if (ea.hasBytes(a)) await ea.sendAttached(body, a, (p) => { st.textContent = `${Math.round(p * 100)}%`; });
      else await send('letters', 'POST', { ...body, media: ea.mediaBody(a) });
      toast('Приложено — откроют вместе с письмом. Можно добавить ещё');
      changed?.();
    } catch (e) {
      toast(e?.status === 409 ? 'Это письмо уже открыли — к нему не приложить' : ea.attachError(e));
    }
    paint();
  };
  const remove = async (note) => {
    try {
      await send(`envelopes/${env.id}/tpl/${note.i}`, 'DELETE');
      changed?.();
    } catch { toast('Не убралось — попробуй ещё раз'); }
    paint();
  };
  const opened = (e, other) => toast(e?.status === 409 ? 'Это письмо уже открыли — его не поменять' : other);
  // Правка тексту на місці рядка: поле замість тексту, «Сохранить» / «Отмена»
  const edit = (note, row) => {
    const field = h('textarea', { class: 'tpl-field', rows: 4, maxlength: 4000, 'aria-label': 'Текст письма' });
    field.value = note.text || '';
    const save = h('button', { type: 'button', class: 'btn btn-primary' }, 'Сохранить');
    save.onclick = async () => {
      const text = field.value.trim();
      if (!text) { field.focus(); return; }
      save.disabled = true;
      try {
        await send(`envelopes/${env.id}/note/${note.i}`, 'PUT', { text });
        toast('Письмо поправлено');
      } catch (e) { opened(e, 'Не сохранилось — попробуй ещё раз'); }
      paint();
    };
    row.replaceChildren(field, h('div', { class: 'tpl-edit-btns' },
      h('button', { type: 'button', class: 'btn', onclick: paint }, 'Отмена'), save));
    field.focus();
  };
  const drop = async (note) => {
    const yes = await ask({ title: 'Убрать письмо из конверта?', text: String(note.text || '').slice(0, 120), yes: 'Убрать' });
    if (!yes) return;
    try {
      await send(`envelopes/${env.id}/note/${note.i}`, 'DELETE');
      toast('Письмо убрано из конверта');
      changed?.();
    } catch (e) { opened(e, 'Не убралось — попробуй ещё раз'); }
    paint();
  };

  async function paint() {
    let notes;
    try {
      notes = (await send('envelopes/theirs', 'GET')).find((e) => e.id === env.id)?.notes || [];
    } catch {
      list.replaceChildren(h('p', { class: 'ea-wait' }, 'Нет связи — список не загрузился'));
      return;
    }
    if (!sheet.isConnected) return;
    if (!notes.length) { list.replaceChildren(h('p', { class: 'ea-wait' }, 'В этом конверте пока нет писем')); return; }
    list.replaceChildren(...notes.map((note) => {
      const text = String(note.text || '').replace(/\s+/g, ' ').trim();
      const row = h('div', { class: `tpl-row${note.read ? ' is-read' : ''}` },
        h('p', { class: 'tpl-text' }, text || '…'));
      const picker = h('input', {
        type: 'file', accept: 'image/*', class: 'visually-hidden',
        onchange: (e) => { const [f] = e.target.files; e.target.value = ''; if (f) ea.pickPhoto(f, (a) => upload(note, a, row)); },
      });
      // Уже прикладене — значками (✕ прибирає все); поки не більше MAX_ATT — можна докласти ще
      const items = ea.attachItems(note.media);
      const more = items.length < ea.MAX_ATT;
      if (note.read) { row.append(h('span', { class: 'tpl-state' }, 'уже открыто')); return row; }
      // Рядок стану: що вже прикладено (і ✕ — прибрати все); під час відправки тут же відсотки
      const status = h('div', { class: 'tpl-status', hidden: !items.length },
        h('span', { class: `tpl-state${items.length ? ' tpl-has' : ''}` },
          !items.length ? '' : items.length === 1 ? ICON[items[0].k] || '📎 вложение' : items.map((x) => (ICON[x.k] || '📎').split(' ')[0]).join(' ')),
        items.length ? h('button', { type: 'button', class: 'mk-chip tpl-x', 'aria-label': 'Убрать все вложения', onclick: () => remove(note) }, '✕') : null);
      // Кнопки — однакові кружечки: зліва «приложить», справа «поправить» і «убрать»
      const btn = (label, ic, onclick, cls = '') => h('button', { type: 'button', class: `mk-chip tpl-add${cls}`, 'aria-label': label, onclick }, ic);
      const attach = more ? h('span', { class: 'tpl-group' },
        h('label', { class: 'mk-chip tpl-add', 'aria-label': 'Приложить фото' }, picker, '📷'),
        btn('Приложить гифку', '🎞️', () => ea.pickGif((a) => upload(note, a, row))),
        btn('Приложить музыку', '🎵', () => ea.pickMusic((a) => upload(note, a, row)))) : null;
      const fix = h('span', { class: 'tpl-group tpl-fix' },
        btn('Поправить текст', '✏️', () => edit(note, row), ' tpl-edit'),
        btn('Убрать письмо', '🗑️', () => drop(note), ' tpl-drop'));
      row.append(status, h('div', { class: 'tpl-tools' }, attach, fix));
      return row;
    }));
  }
  paint();
}
