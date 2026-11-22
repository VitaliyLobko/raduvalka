// «Наш плейлист»: пісні з листів обох — файлом і посиланням. Свої — усі, отримані — лише вже відкриті (так віддає сервер).
// Файл качається й розшифровується лише з тапу; «Слушать подряд» — файли один за одним. Вантажиться лише з тапу
import { send } from './api.js';
import { h } from './ui.js';
import { DATA } from './data.js';

const day = (t) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');

export async function openPlaylist() {
  const ea = await import('./envattach.js');
  const list = h('div', { class: 'pl-list', 'aria-live': 'polite' }, h('p', { class: 'ea-wait' }, 'Собираю песни…'));
  const allBtn = h('button', { type: 'button', class: 'btn btn-primary pl-all', hidden: true }, '▶ Слушать подряд');
  // Грає одна пісня: програвач — під її рядком на всю ширину, ▶ рядка тим часом схована
  let current = null;
  const stopCurrent = () => {
    if (!current) return;
    current.p?.stop();
    current.row.player.replaceChildren();
    current.row.slot.hidden = false;
    current = null;
  };
  const close = () => {
    stopCurrent();
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    sheet.remove();
  };
  const onKey = (e) => {
    if (e.key !== 'Escape' || [...document.querySelectorAll('[role=dialog]')].pop() !== sheet) return;
    e.stopPropagation();
    close();
  };
  const backdrop = h('div', { class: 'backdrop pl-shade', onclick: close });
  const sheet = h('div', { class: 'sheet pl-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Наш плейлист' },
    h('div', { class: 'write-head' },
      h('h2', {}, '🎵 Наш плейлист'),
      h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕')),
    allBtn,
    list);
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey, true);

  let songs;
  try {
    songs = await send('letters/songs', 'GET');
  } catch {
    list.replaceChildren(h('p', { class: 'ea-wait' }, 'Нет связи — плейлист не загрузился'));
    return;
  }
  if (!sheet.isConnected) return;
  if (!songs.length) {
    list.replaceChildren(h('p', { class: 'pl-empty' },
      'Пока песен нет. Приложи песню к письму: «＋ → В конверт» или «🎉 Праздничное», потом 🎵 — и она появится здесь.'));
    return;
  }

  const them = DATA.side === 'vona' ? 'от него' : 'от неё';
  const files = songs.filter((s) => s.media?.k === 'song' && !s.media.gone);
  // Рядок пісні: ▶ — скачати й грати на місці рядка; next — що вмикати після (лише «подряд»)
  const rows = new Map();
  const play = async (s, next) => {
    const row = rows.get(s.id);
    stopCurrent();
    const mine = { row, p: null };
    current = mine;
    row.slot.hidden = true;
    row.player.replaceChildren(h('span', { class: 'pl-wait' }, 'Загружаю…'));
    try {
      const p = await ea.renderAttach({ id: s.id, media: s.media }, { onEnd: next });
      // Поки качалось, вибрали іншу чи закрили — ця вже не потрібна
      if (current !== mine || !sheet.isConnected) { p.stop(); return; }
      mine.p = p;
      row.player.replaceChildren(p.el);
      p.play?.();
      row.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch {
      if (current !== mine) return;
      row.player.replaceChildren(h('span', { class: 'pl-wait' }, 'Не загрузилось — нажми ▶ ещё раз'));
      row.slot.hidden = false;
      current = null;
    }
  };
  const playBtn = (s) => h('button', { type: 'button', class: 'mk-chip pl-play', 'aria-label': 'Слушать', onclick: () => play(s) }, '▶');
  const playFrom = (i) => { if (i < files.length) play(files[i], () => playFrom(i + 1)); };

  list.replaceChildren(...songs.map((s) => {
    const a = s.media || {};
    const link = a.k === 'link' ? ea.songLink(a.url) : null;
    const title = a.k === 'link' ? `Песня в ${link ? ea.service(link) : 'ссылке'}` : a.n || 'Песня';
    const meta = [s.mine ? 'от тебя' : them, day(s.at), s.mine && !s.opened ? 'ещё не открыли' : '', s.liked ? '❤️' : '']
      .filter(Boolean).join(' · ');
    const slot = h('div', { class: 'pl-slot' },
      a.gone ? h('span', { class: 'pl-wait' }, 'файл удалён')
        : a.k === 'link'
          ? (link ? h('a', { class: 'mk-chip pl-play', href: link, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Слушать по ссылке' }, '▶') : null)
          : playBtn(s));
    const player = h('div', { class: 'pl-player' });
    const el = h('div', { class: `pl-row${s.mine ? ' is-mine' : ''}` },
      h('span', { class: 'pl-icon', 'aria-hidden': 'true' }, a.k === 'link' ? '🔗' : '🎵'),
      h('div', { class: 'pl-main' }, h('b', { class: 'pl-title' }, title), h('small', { class: 'pl-meta' }, meta)),
      slot,
      player);
    rows.set(s.id, { el, slot, player });
    return el;
  }));
  if (files.length > 1) {
    allBtn.hidden = false;
    allBtn.onclick = () => playFrom(0);
  }
}
