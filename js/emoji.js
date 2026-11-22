// Панель смайлів у «Написать…», як у месенджері: на місці клавіатури, розділи внизу, ⌫ стирає один смайл.
// Вантажиться лише з першим тапом на 😊. «Недавние» — у браузері цього телефона (зручність, не дані)
import { h } from './ui.js';
import { DATA } from './data.js';
import { petName, petFiles, petFileSrc } from './icons.js';

const SETS = [
  ['😀', 'Смайлы', '😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙🥲😋😛😜🤪😝🤗🤭🫢🤫🤔🫡🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢🤮🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕🫤😟🙁😮😯😲😳🥺🥹😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈💀🤡👻👽🤖💩😺😸😹😻😼😽🙀😿😾🙈🙉🙊'],
  ['❤️', 'Сердечки', '❤️🧡💛💚💙💜🤎🖤🤍🩷🩵💔❣️💕💞💓💗💖💘💝💟💌💋💯💢💥💫💦💨💬💭💤'],
  ['👋', 'Жесты', '👋🤚🖐️✋🖖👌🤌🤏✌️🤞🫰🤟🤘🤙👈👉👆👇☝️👍👎✊👊🤛🤜👏🙌🫶👐🤲🤝🙏💪👀👅👄💃🕺👫👭👬💏💑👪'],
  ['🐶', 'Природа', '🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🐤🦆🦉🐴🦄🐝🐛🦋🐌🐞🐢🐍🦖🐙🦀🐠🐬🐳🦈🐊🦒🐘🦔🐾🌸🌹🌷🌻🌼💐🍀🌿🌵🌴🍁🍂🌈☀️🌤️⛅🌧️⛈️❄️☃️🌙⭐🌟✨⚡🔥🌊'],
  ['🍕', 'Еда', '🍏🍎🍐🍊🍋🍌🍉🍇🍓🫐🍒🍑🥭🍍🥥🥝🍅🥑🥦🥒🌶️🌽🥕🥔🥐🍞🧀🥚🍳🥞🧇🥓🍗🍖🌭🍔🍟🍕🥪🌮🌯🥗🍝🍜🍲🍣🍤🥟🍦🍩🍪🎂🍰🧁🍫🍬🍭🍯☕🍵🧃🥤🍺🍻🥂🍷🥃🍸🍹🍾'],
  ['⚽', 'Занятия', '⚽🏀🏈⚾🎾🏐🎱🏓🏸🥊🎣🎿⛸️🏆🥇🎖️🎫🎪🎭🎨🎬🎤🎧🎼🎹🥁🎷🎸🎮🎲🧩♟️🎯🎳🎁🎈🎉🎊🎀🕯️'],
  ['✈️', 'Поездки', '🚗🚕🚙🚌🚓🚑🚒🚜🏍️🚲🛴✈️🚀🛸🚁⛵🚤🚢⚓🚂🚇🏠🏡🏢🏥🏨🏪🏫⛪🏰🗼🗽⛲⛺🏕️🏖️🏝️🏔️🌋🗺️🧭🌍🌅🌄🌃🌉🎡🎢'],
  ['💡', 'Вещи', '⌚📱💻⌨️📷📸📺⏰⏳🔋💡🔦💸💵💰💎🔧🔨🔑🗝️🔒🚪🛏️🛋️🚿🛁🧸🪄📦✉️📩📝📌📎✂️📚📖🔔🎵💊🩹🌡️🧹🧺🧼🧦👗👕👖👠👟👑🎩🧢👓🕶️💍👜🎒☂️'],
];
// Поки «Недавних» нема — найчастіші в листуванні
const START = ['❤️', '😂', '🥰', '😘', '😍', '🙈', '👍', '😢', '🔥', '🤗', '😊', '💋', '😴', '🥺', '🎉', '😎'];
const RECENT_KEY = 'rad-emoji-recent';
const RECENT_MAX = 24;
const ERASE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-6 7 6 7h12z"/><path d="M17 9l-5 6M12 9l5 6"/></svg>';

// Рядок розділу → окремі смайли (з варіантом ️ і складеними — як одне ціле)
const seg = new Intl.Segmenter('ru', { granularity: 'grapheme' });
const split = (s) => [...seg.segment(s)].map((x) => x.segment);

function recent() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) && v.length ? v.slice(0, RECENT_MAX) : START;
  } catch { return START; }
}
function remember(e) {
  try {
    const v = [e, ...recent().filter((x) => x !== e)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(v));
  } catch { /* приватне вікно — без «Недавних» */ }
}

// Останній смайл (чи літера) перед кареткою: [початок, кінець]
export function lastGrapheme(text, end) {
  const before = split(text.slice(0, end));
  const last = before.at(-1) || '';
  return [end - last.length, end];
}

// onPick(смайл) — вставити; onErase() — стерти один перед кареткою
// Зліва внизу — «що»: 😊 смайли чи мордочка улюбленця (тап — вибір, як у редакторі фото); улюбленець — сітка його поз
const KIND = 'radovalka:emoji-kind';
const EMOJI = 'emoji';
export function emojiPanel({ onPick, onErase, onSticker = null }) {
  const sections = [['🕘', 'Недавние', recent()], ...SETS.map(([icon, title, s]) => [icon, title, split(s)])];
  const grid = h('div', { class: 'emo-grid' },
    ...sections.map(([, title, list], i) => h('section', { class: 'emo-sec', 'data-i': String(i), 'aria-label': title },
      h('p', { class: 'emo-sec-title' }, title),
      h('div', { class: 'emo-cells' }, ...list.map((e) => h('button', { type: 'button', class: 'emo-cell', 'aria-label': e }, e))))));
  // Один обробник на всю сітку, а не сотні — і палець, що гортав, не вставляє смайл
  grid.addEventListener('click', (ev) => {
    const b = ev.target.closest('.emo-cell');
    if (!b) return;
    remember(b.textContent);
    onPick(b.textContent);
  });
  const tabs = sections.map(([icon, title], i) => h('button', {
    type: 'button', class: 'emo-tab', 'aria-label': title, 'aria-pressed': String(i === 0),
    onclick: () => { grid.scrollTo({ top: grid.querySelector(`[data-i="${i}"]`).offsetTop - grid.offsetTop, behavior: 'instant' }); },
  }, icon));
  // Під час гортання підсвічуємо розділ, що зараз угорі
  let raf = 0;
  grid.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const top = grid.scrollTop + 8;
      let cur = 0;
      grid.querySelectorAll('.emo-sec').forEach((s, i) => { if (s.offsetTop - grid.offsetTop <= top) cur = i; });
      tabs.forEach((t, i) => t.setAttribute('aria-pressed', String(i === cur)));
    });
  }, { passive: true });
  const erase = h('button', { type: 'button', class: 'emo-erase', 'aria-label': 'Стереть', html: ERASE, onclick: onErase });
  const tabRow = h('div', { class: 'emo-tabs', role: 'group', 'aria-label': 'Разделы' }, ...tabs);
  const pets = onSticker ? Object.keys(DATA.mascots || {}).filter((key) => petFiles(key).some((f) => petFileSrc(f))) : [];
  if (!pets.length) return [grid, h('div', { class: 'emo-bar' }, tabRow, erase)];
  const kinds = [EMOJI, ...pets];
  let now = (() => { try { return localStorage.getItem(KIND); } catch { return null; } })();
  if (!kinds.includes(now)) now = EMOJI;
  const face = (key) => (key === EMOJI ? h('span', { class: 'ph-pet-emoji' }, '😊')
    : h('img', { src: petFileSrc(petFiles(key).find((f) => petFileSrc(f))), alt: '', draggable: 'false' }));
  const name = (key) => (key === EMOJI ? 'смайлы' : petName(key));
  const poses = h('div', { class: 'emo-grid emo-stickers' });
  const menu = h('div', { class: 'ph-pet-menu emo-kind-menu', role: 'listbox', 'aria-label': 'Смайлы или наклейки', hidden: true });
  const pick = h('button', {
    type: 'button', class: 'ph-pet-pick emo-kind', 'aria-haspopup': 'listbox', 'aria-expanded': 'false',
    onclick: () => { menu.hidden = !menu.hidden; pick.setAttribute('aria-expanded', String(!menu.hidden)); },
  });
  const paint = () => {
    pick.replaceChildren(face(now), h('span', { class: 'ph-pet-caret', 'aria-hidden': 'true' }, '▴'));
    pick.setAttribute('aria-label', `Сейчас: ${name(now)}. Выбрать смайлы или наклейки`);
    menu.replaceChildren(...kinds.map((key) => h('button', {
      type: 'button', class: 'ph-pet-opt', role: 'option', 'aria-selected': String(key === now), 'aria-label': name(key),
      onclick: () => {
        now = key;
        try { localStorage.setItem(KIND, now); } catch { /* приватне вікно */ }
        menu.hidden = true;
        pick.setAttribute('aria-expanded', 'false');
        paint();
      },
    }, face(key))));
    const pet = now !== EMOJI;
    grid.hidden = pet;
    tabRow.hidden = pet;
    erase.hidden = pet;
    poses.hidden = !pet;
    if (pet) {
      poses.replaceChildren(...petFiles(now).map((f, i) => {
        const src = petFileSrc(f);
        return src ? h('button', { type: 'button', class: 'emo-sticker', 'aria-label': `Наклейка: ${petName(now)}`, onclick: () => onSticker(now, i) },
          h('img', { src, alt: '', draggable: 'false', loading: 'lazy' })) : null;
      }).filter(Boolean));
      poses.scrollTop = 0;
    }
  };
  paint();
  return [grid, poses, h('div', { class: 'emo-bar' }, h('div', { class: 'ph-pet-wrap' }, pick, menu), tabRow, erase)];
}
