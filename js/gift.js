// «Подарок на выбор»: закриті конверти з назвами; обрала — відкривається все, і видно, що було в інших
import { DATA, who } from './data.js';
import { send } from './api.js';
import { mascotImg, petName } from './icons.js';
import { h, toast, cap, reduceMotion } from './ui.js';

// Улюбленець у святковому: смокінг, якщо є така поза, інакше святкова, інакше звичайна
const giftPose = (key) => ['tux', 'festive'].find((p) => DATA.mascots[key]?.poses?.[p]) || 'main';
const isShe = (key) => DATA.mascots[key]?.g === 'f';

export function renderGift(screen, gift, done) {
  const me = who();
  const pet = gift.mascot && DATA.mascots[gift.mascot] ? gift.mascot : null;
  const picked = gift.chosen != null;

  const cards = gift.options.map((o, i) => h('button', {
    type: 'button',
    class: `gift-card${picked && i === gift.chosen ? ' is-chosen' : ''}${picked && i !== gift.chosen ? ' is-other' : ''}`,
    style: `--tint: var(${i % 2 ? '--powder' : '--lavender'})`,
    disabled: picked,
    'aria-label': picked ? `${o.title}: ${o.inside || ''}` : `Выбрать: ${o.title}`,
    onclick: () => choose(screen, gift, i, done),
  },
  h('span', { class: 'gift-seal', 'aria-hidden': 'true' }, o.emoji),
  h('span', { class: 'gift-name' }, o.title),
  picked && o.inside ? h('span', { class: 'gift-inside-text' }, o.inside) : null,
  picked && i === gift.chosen ? h('span', { class: 'gift-tag' }, 'Твой выбор') : null));

  const line = picked
    ? `${cap(me.partner)} узнает, что ты ${me.youOpened === 'открыла' ? 'выбрала' : 'выбрал'} 💌`
    : 'Выбирай сердцем — что внутри, узнаешь после.';

  screen.replaceChildren(...[
    h('p', { class: 'day' }, 'Подарок на выбор'),
    h('h2', { class: 'title' }, picked ? 'Вот что было внутри' : 'Тебе подарок 🎁'),
    pet ? h('div', { class: 'courier gift-courier' },
      h('span', { class: 'mascot', html: mascotImg(pet, giftPose(pet)) }),
      h('p', { class: 'bubble' }, h('b', {}, `${petName(pet)}: `),
        picked ? `Отличный выбор. Я бы ${isShe(pet) ? 'выбрала' : 'выбрал'} так же.` : `${isShe(pet) ? 'Принесла' : 'Принёс'} подарок. Только чур — один!`)) : null,
    gift.text ? h('article', { class: 'letter gift-note' }, h('p', { class: 'letter-text' }, gift.text)) : null,
    h('div', { class: 'gift-grid' }, ...cards),
    h('p', { class: 'hint' }, line),
    picked ? h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: done }, 'Ура! 🎉')) : null,
  ].filter(Boolean));
}

async function choose(screen, gift, i, done) {
  const o = gift.options[i];
  if (!confirm(`Выбрать «${o.title}»? Передумать уже не получится.`)) return;
  try {
    // Той самий об'єкт, що й DATA.gift: перейде на іншу вкладку й назад — побачить уже відкрите
    Object.assign(gift, await send(`letters/${gift.id}`, 'PUT', { choose: i }));
    const show = () => renderGift(screen, gift, done);
    if (reduceMotion) show();
    else {
      screen.querySelectorAll('.gift-card')[i].classList.add('is-opening');
      setTimeout(show, 650);
    }
  } catch (e) {
    toast(e.status === 409 ? 'Подарок уже выбран' : 'Не получилось — нет связи');
  }
}
