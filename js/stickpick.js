// Вибір наклейок одним рядком: зліва «що» — мордочка улюбленця чи 😊 (тап — мордочки всіх улюбленців і смайлики),
// праворуч — пози обраного чи смайлики. Спільний для редакторів фото й гифки; обране памʼятаємо
import { DATA } from './data.js';
import { petName, petFiles, petFileSrc } from './icons.js';
import { h, ribbon } from './ui.js';

// Смайлики-наклейки для фото й гифок — групами: ніжність, настрій, «вогонь», сезон і звірі
export const EMOJI_STICKERS = [
  '❤️', '😍', '🥰', '😘', '🤗', '🫶', '💋', '💞', '🫂', '💌', '🌹', '💍', '🥂', '🏠', '🕊️',
  '😂', '😜', '🤭', '🥳', '🤪', '😇', '😈', '😎', '🥺', '🙈', '😴',
  '🔥', '💯', '✨', '⭐', '🎉', '👑', '💪', '🫡', '🇺🇦',
  '🌸', '🍓', '🦋', '🐾', '🐶', '🐱', '☀️', '🌙', '❄️', '☕', '🎄', '🍊', '🧣',
];
const PET_KEY = 'radovalka:sticker-pet';
const EMOJI = 'emoji';

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
  const emojiBtn = (s) => h('button', { type: 'button', class: 'ph-sticker', 'aria-label': `Наклейка ${s}`, onclick: () => onEmoji(s) }, s);
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
    poses.replaceChildren(...(now === EMOJI ? emojis.map(emojiBtn) : petFiles(now).map((f, i) => poseBtn(now, f, i)).filter(Boolean)));
    poses.scrollLeft = 0;
  };
  if (!kinds.length) return { el: null };
  paint();
  ribbon(poses);
  return { el: h('div', { class: 'ph-pet-row' }, h('div', { class: 'ph-pet-wrap' }, pick, menu), poses) };
}
