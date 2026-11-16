// «✍️ Написать»: лист зараз, на ранок або записка в її/його конверт; нижче — що вже надіслано
import { DATA, who } from './data.js';
import { get, send } from './api.js';
import { petName, petSrc, petFor } from './icons.js';
import { h, toast, cap, ARROW } from './ui.js';

const DRAFT = 'radovalka:draft';
const MORNING_HOUR = 8;

// Чернетку тримаємо в телефоні: випадковий тап повз шторку не з'їсть довгий лист
const draft = {
  get: () => { try { return localStorage.getItem(DRAFT) || ''; } catch { return ''; } },
  set: (v) => { try { localStorage.setItem(DRAFT, v); } catch { /* приватне вікно — без чернетки */ } },
};

// Найближчі 8:00 за часом телефона: увечері — завтра, вночі — вже сьогодні
function nextMorning(now = new Date()) {
  const d = new Date(now);
  d.setHours(MORNING_HOUR, 0, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

const isShe = (key) => DATA.mascots[key]?.g === 'f';
const hhmm = (ms) => new Date(ms).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
const dayWord = (ms) => (new Date(ms).toDateString() === new Date().toDateString() ? 'сегодня' : 'завтра');

export function openWrite() {
  const me = who();
  const envs = DATA.partnerEnvelopes || [];
  let where = 'now';
  let envId = envs[0]?.id || null;
  let pet = petFor('push');

  const area = h('textarea', { class: 'write-text', 'aria-label': 'Текст письма', placeholder: 'Пиши как есть — так, как сказал бы вслух…' });
  area.value = draft.get();
  area.addEventListener('input', () => draft.set(area.value));

  const note = h('p', { class: 'write-note' });
  const envRow = h('div', { class: 'mk-chips write-envs', hidden: true });
  const paintNote = () => {
    const m = nextMorning();
    note.textContent = where === 'now'
      ? `Появится у ${me.partner === 'он' ? 'него' : 'неё'}, как только ${me.partner} откроет Радовалку.`
      : where === 'morning'
        ? `Придёт ${dayWord(m.getTime())} в ${hhmm(m.getTime())} — как письмо дня.`
        : `Ляжет в конверт — ${me.partner} откроет, когда понадобится.`;
    envRow.hidden = where !== 'env';
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

  const whereRow = chips([
    { v: 'now', label: 'Сейчас' },
    { v: 'morning', label: 'На утро' },
    ...(envs.length ? [{ v: 'env', label: 'В конверт' }] : []),
  ], where, (v) => { where = v; paintNote(); });
  envRow.append(chips(envs.map((e) => ({ v: e.id, label: `${e.emoji} ${e.label}` })), envId, (v) => { envId = v; }));
  paintNote();

  const pets = Object.keys(DATA.mascots);
  const petRow = chips(pets.map((k) => ({
    v: k, html: `<img src="${petSrc(k)}" alt="" width="40" height="40"><span>${petName(k)}</span>`,
  })), pet, (v) => { pet = v; });
  petRow.classList.add('write-pets');

  const sent = h('div', { class: 'write-sent' });
  const go = h('button', { type: 'button', class: 'btn btn-primary write-go', html: `${ARROW}Отправить` });

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    backdrop.remove();
  };

  go.addEventListener('click', async () => {
    const text = area.value.trim();
    if (!text) { area.focus(); return; }
    go.disabled = true;
    try {
      await send('letters', 'POST', {
        kind: where,
        text,
        mascot: pet,
        env: where === 'env' ? envId : undefined,
        at: where === 'morning' ? nextMorning().getTime() : undefined,
      });
      draft.set('');
      close();
      toast(`${petName(pet) || 'Почтальон'} ${isShe(pet) ? 'понесла' : 'понёс'} письмо ➶`);
    } catch {
      go.disabled = false;
      toast('Не отправилось — проверь интернет. Текст сохранён.');
    }
  });

  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet sheet-maker sheet-write', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Письмо ${me.toWhom}` },
    h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    h('div', { class: 'sheet-inner' },
      h('h2', {}, `Письмо ${me.toWhom}`),
      h('div', { class: 'write-helper' }),
      area,
      h('div', { class: 'mk-group' }, h('p', { class: 'mk-label' }, 'Когда'), whereRow, envRow, note),
      pets.length ? h('div', { class: 'mk-group' }, h('p', { class: 'mk-label' }, 'Кто понесёт'), petRow) : null,
      go,
      sent));
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  if (!area.value) area.focus();
  loadSent(sent);
  return { sheet, area };
}

// «Мои письма»: що вже надіслано й що з ним сталося на тому боці
async function loadSent(box) {
  let list;
  try {
    list = await get('letters/sent');
  } catch {
    return;
  }
  if (!list.length) return;
  const me = who();
  const envLabel = (id) => (DATA.partnerEnvelopes || []).find((e) => e.id === id);

  const item = (l) => {
    const e = envLabel(l.env);
    const where = l.kind === 'env'
      ? `${e ? e.emoji : '✉'} в конверт «${e ? e.label : '…'}»`
      : new Date(l.at).toLocaleDateString('ru', { day: 'numeric', month: 'short' }).replace('.', '');
    let state;
    if (l.kind === 'morning' && l.at > Date.now()) state = `ждёт утра · ${dayWord(l.at)} в ${hhmm(l.at)}`;
    else if (l.opened) state = `${me.partnerOpened} ✓${l.liked ? ' · ❤️' : ''}`;
    else state = l.kind === 'env' ? 'лежит в конверте' : `ещё не ${me.partnerOpened}`;

    const row = h('li', { class: 'sent-item' },
      h('p', { class: 'sent-text' }, l.text),
      h('p', { class: 'sent-meta' }, h('span', {}, `${where} · ${state}`),
        l.opened ? null : h('button', {
          type: 'button',
          class: 'sent-take',
          onclick: async () => {
            if (!confirm('Забрать письмо? Оно исчезнет, будто его не было.')) return;
            try {
              await send(`letters/${l.id}`, 'DELETE');
              row.remove();
            } catch (err) {
              toast(err.status === 409 ? `Поздно — ${me.partner} уже ${me.partnerOpened}` : 'Не получилось — нет связи');
            }
          },
        }, 'Забрать')),
      l.reply ? h('p', { class: 'sent-reply' }, h('b', {}, `${cap(me.partner)} ответил${me.partner === 'она' ? 'а' : ''}: `), l.reply) : null);
    return row;
  };

  box.replaceChildren(h('h3', {}, 'Мои письма'), h('ul', { class: 'sent-list' }, ...list.map(item)));
}
