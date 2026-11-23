// Вибір наклейок одним рядком: зліва «що» — мордочка улюбленця чи 😊 (тап — мордочки всіх улюбленців і смайлики),
// праворуч — пози обраного чи смайлики. Спільний для редакторів фото й гифки; обране памʼятаємо
import { DATA } from './data.js';
import { petName, petFiles, petFileSrc } from './icons.js';
import { h, ribbon } from './ui.js';

// Смайлики-наклейки для фото й гифок — групами: ніжність, «чекаю», настрій, «вогонь», природа й звірі, зима, смакота
export const EMOJI_STICKERS = [
  '❤️', '😍', '🥰', '😘', '🤗', '🫶', '💋', '💌', '🧸', '🌹', '💐', '🌷', '💍',
  '🏠', '🕊️', '🚀', '✈️',
  '😂', '😜', '🤭', '🥳', '🤪', '😇', '😈', '😎', '🥺', '🙈', '😴',
  '🔥', '💯', '✨', '⭐', '🎉', '👑', '💪', '🫡', '🇺🇦',
  '🌸', '🍓', '🦋', '🐾', '🐶', '🐱', '🐻', '☀️', '🌙',
  '❄️', '⛄', '🎄', '🎅', '🧣',
  '☕', '🍊', '🥂', '🍷', '🍕', '🍰', '🍿',
];
// Ручка в куті обраної наклейки чи підпису (тягнеш одним пальцем — розмір і поворот): контур у квадраті 24
export const HANDLE_PATH = 'M8 16L16 8M16 8h-5M16 8v5M8 16v-5M8 16h5M4.6 10.2A7.6 7.6 0 0 1 10.2 4.6M19.4 13.8a7.6 7.6 0 0 1-5.6 5.6';
const PET_KEY = 'radovalka:sticker-pet';
const EMOJI = 'emoji';
// Останні 3 смайлики-наклейки — на цьому телефоні, спільні для фото й гифки
const RECENT_KEY = 'radovalka:recent-stickers';
const recentEmoji = () => {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter((s) => typeof s === 'string').slice(0, 3) : []; } catch { return []; }
};
const rememberEmoji = (s) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([s, ...recentEmoji().filter((x) => x !== s)].slice(0, 3))); } catch { /* приватне вікно */ }
};

// onPet(key, i, src) — тап по позі; emojis + onEmoji(s) — смайлики (без них — лише улюбленці)
export function stickerRow({ onPet, emojis = [], onEmoji = null }) {
  const pets = Object.keys(DATA.mascots || {}).filter((key) => petFiles(key).some((f) => petFileSrc(f)));
  const kinds = [...pets, ...(onEmoji && emojis.length ? [EMOJI] : [])];
  let now = (() => { try { return localStorage.getItem(PET_KEY); } catch { return null; } })();
  if (!kinds.includes(now)) now = kinds[0];
  const name = (key) => (key === EMOJI ? 'смайлики' : petName(key));
  const face = (key) => (key === EMOJI ? h('span', { class: 'ph-pet-emoji' }, '😊')
    : h('img', { src: petFileSrc(petFiles(key).find((f) => petFileSrc(f))), alt: '', width: 40, height: 40, draggable: 'false' }));
  const poseBtn = (key, file, i) => {
    const src = petFileSrc(file);
    if (!src) return null;
    return h('button', { type: 'button', class: 'ph-sticker ph-sticker-pet', 'aria-label': `Наклейка: ${petName(key)}`, onclick: () => onPet(key, i, src) },
      h('img', { src, alt: '', width: 56, height: 56, draggable: 'false', loading: 'lazy' }));
  };
  // Недавні смайлики — окремо на початку стрічки; новий вибір запамʼятовуємо одразу, а стрічку перебудовуємо лише
  // на наступному відкритті, щоб нічого не з'їжджало з-під пальця
  const emojiBtn = (s, recentOne = false) => h('button', {
    type: 'button', class: 'ph-sticker', 'aria-label': `Наклейка ${s}${recentOne ? ' (недавняя)' : ''}`,
    onclick: () => { rememberEmoji(s); onEmoji(s); },
  }, s);
  const emojiRow = () => {
    const rec = recentEmoji().filter((s) => emojis.includes(s));
    return rec.length
      ? [...rec.map((s) => emojiBtn(s, true)), h('span', { class: 'ph-stick-sep', 'aria-hidden': 'true' }), ...emojis.map((s) => emojiBtn(s))]
      : emojis.map((s) => emojiBtn(s));
  };
  const menu = h('div', { class: 'ph-pet-menu', role: 'listbox', 'aria-label': 'Какие наклейки', hidden: true });
  const pick = h('button', {
    type: 'button', class: 'ph-pet-pick', 'aria-haspopup': 'listbox', 'aria-expanded': 'false',
    onclick: () => { menu.hidden = !menu.hidden; pick.setAttribute('aria-expanded', String(!menu.hidden)); },
  });
  const poses = h('div', { class: 'mk-chips mk-row ph-stickers ph-pets' });
  const paint = () => {
    pick.replaceChildren(face(now), h('span', { class: 'ph-pet-caret', 'aria-hidden': 'true' }, '▾'));
    pick.setAttribute('aria-label', `Наклейки: ${name(now)}. Выбрать другие`);
    menu.replaceChildren(...kinds.map((key) => h('button', {
      type: 'button', class: 'ph-pet-opt', role: 'option', 'aria-selected': String(key === now), 'aria-label': name(key),
      onclick: () => {
        now = key;
        try { localStorage.setItem(PET_KEY, now); } catch { /* приватне вікно */ }
        menu.hidden = true;
        pick.setAttribute('aria-expanded', 'false');
        paint();
      },
    }, face(key))));
    poses.replaceChildren(...(now === EMOJI ? emojiRow() : petFiles(now).map((f, i) => poseBtn(now, f, i)).filter(Boolean)));
    poses.scrollLeft = 0;
  };
  if (!kinds.length) return { el: null };
  paint();
  ribbon(poses);
  return { el: h('div', { class: 'ph-pet-row' }, h('div', { class: 'ph-pet-wrap' }, pick, menu), poses) };
}
