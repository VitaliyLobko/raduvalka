// Вкладка «Письма» під листом дня: «Мне» — усі отримані, «Мои» — надіслані з їхньою долею
import { DATA, who } from './data.js';
import { get, send } from './api.js';
import { h } from './ui.js';
import { loadSent } from './write.js';

let view = 'inbox';

const day = (at) => new Date(at).toLocaleDateString('ru', { day: 'numeric', month: 'long' });

export function letterArchive(rerender) {
  const me = who();
  const box = h('div', { class: 'archive-list' }, h('p', { class: 'mk-wait' }, 'Загружаю…'));
  const seg = h('div', { class: 'mk-chips mk-kind archive-seg', role: 'radiogroup', 'aria-label': 'Какие письма показать' },
    ...[['inbox', 'Мне'], ['sent', 'Мои']].map(([v, label]) => h('button', {
      type: 'button', role: 'radio', class: 'mk-chip', 'aria-checked': String(view === v),
      onclick: () => { view = v; rerender(); },
    }, label)));
  if (view === 'sent') loadSent(box);
  else loadInbox(box, me);
  return h('section', { class: 'archive', 'aria-label': 'Все письма' }, h('h3', { class: 'archive-title' }, 'Все письма'), seg, box);
}

async function loadInbox(box, me) {
  let list;
  try {
    list = await get('letters/inbox');
  } catch {
    box.replaceChildren(h('p', { class: 'mk-wait' }, 'Не загрузилось — нет связи'));
    return;
  }
  // Лист дня вже нагорі — у списку його не дублюємо
  list = list.filter((l) => l.id !== DATA.letter?.id);
  if (!list.length) {
    box.replaceChildren(h('p', { class: 'mk-wait' }, `Здесь соберутся все письма, которые ${me.partner} тебе ${me.partner === 'она' ? 'написала' : 'написал'}.`));
    return;
  }
  box.replaceChildren(h('ul', { class: 'inbox-list' }, ...list.map((l) => inboxItem(l, me))));
}

function inboxItem(l, me) {
  const chose = me.youOpened === 'открыла' ? 'выбрала' : 'выбрал';
  const gift = l.gift && l.gift.chosen != null ? l.gift.options[l.gift.chosen] : null;
  const tags = [
    l.kind === 'date' ? '🎉' : '',
    gift ? `🎁 ты ${chose}: ${gift.emoji} ${gift.title}` : '',
    l.liked ? '❤️' : '',
  ].filter(Boolean).join(' · ');
  const text = h('p', { class: 'inbox-text' }, l.text || '');
  const item = h('li', { class: `inbox-item${l.opened ? '' : ' is-new'}` },
    h('button', {
      type: 'button',
      class: 'inbox-body',
      'aria-expanded': 'false',
      onclick: (e) => {
        const open = item.classList.toggle('is-open');
        e.currentTarget.setAttribute('aria-expanded', String(open));
        // Лист, який перекрив новіший і лишився непрочитаним, — прочитано тут
        if (open && !l.opened) {
          l.opened = true;
          item.classList.remove('is-new');
          send(`letters/${l.id}`, 'PUT', { opened: true }).catch(() => {});
        }
      },
    },
    h('span', { class: 'inbox-meta' },
      h('span', {}, day(l.at)),
      l.opened ? null : h('span', { class: 'inbox-new' }, 'новое'),
      tags ? h('span', {}, tags) : null),
    l.text ? text : null),
    l.reply ? h('p', { class: 'sent-reply' }, h('b', {}, 'Твой ответ: '), l.reply) : null);
  return item;
}
