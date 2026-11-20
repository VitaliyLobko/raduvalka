// Своє вікно «Точно?» замість системного confirm(): улюбленець, питання і дві кнопки. Відповідь — Promise<boolean>
import { h } from './ui.js';
import { mascotImg, petFor, petName, firstPose } from './icons.js';

// title — саме питання; text — що буде далі; yes — назва дії (вона ж кнопка); no — «передумав»
export function ask({ title, text = '', yes = 'Да', no = 'Оставить', danger = true }) {
  return new Promise((done) => {
    const pet = petFor('box');
    const prev = document.activeElement;
    const close = (answer) => {
      box.remove();
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
      done(answer);
    };
    // Esc — «ні»; Enter лишаємо кнопці у фокусі
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } };
    const keep = h('button', { type: 'button', class: 'btn ask-no', onclick: () => close(false) }, no);
    const go = h('button', { type: 'button', class: `btn ${danger ? 'ask-danger' : 'btn-primary'}`, onclick: () => close(true) }, yes);
    const box = h('div', {
      class: 'ask', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'ask-title',
      onclick: (e) => { if (e.target === box) close(false); },
    }, h('div', { class: 'ask-card' },
      pet ? h('span', { class: 'mascot', 'aria-hidden': 'true', html: mascotImg(pet, firstPose(pet, 'look', 'main')) }) : null,
      h('h2', { id: 'ask-title', class: 'ask-title' }, title),
      text ? h('p', { class: 'ask-text' }, pet ? `${petName(pet)}: ${text}` : text) : null,
      h('div', { class: 'ask-btns' }, keep, go)));
    document.body.append(box);
    document.addEventListener('keydown', onKey, true);
    // Фокус на безпечній кнопці: випадковий Enter нічого не зламає
    keep.focus();
  });
}

// Улюбленець на мить визирає над меню з короткою реплікою (замість сухого тосту); тап — сховати
let noteEl = null;
let noteTimer = 0;
export function petNote(text, pose = 'look') {
  const pet = petFor('box');
  if (!pet) return;
  noteEl?.remove();
  clearTimeout(noteTimer);
  const el = h('div', { class: 'pet-note', role: 'status', onclick: () => hide() },
    h('span', { class: 'mascot', 'aria-hidden': 'true', html: mascotImg(pet, firstPose(pet, pose, 'main')) }),
    h('p', { class: 'pet-note-text' }, h('b', {}, `${petName(pet)}: `), text));
  const hide = () => { el.classList.remove('is-shown'); setTimeout(() => el.remove(), 300); if (noteEl === el) noteEl = null; };
  noteEl = el;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('is-shown'));
  noteTimer = setTimeout(hide, 2600);
}

