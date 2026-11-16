// Перший запуск: листівка з їхньою фразою, потім — прохання про сповіщення з поясненням
import { DATA } from './data.js';
import { mascotImg, petName, petFor } from './icons.js';
import { h, toast } from './ui.js';
import { spaceCard, flyHeart } from './space.js';

const KEY = 'radovalka:welcomed';

// Їй — від чоловіка; йому — що тут вони пишуть одне одному
const HELLO = {
  vona: 'Её сделал для тебя твой муж — чтобы каждый день было чему улыбнуться. 💜',
  vin: 'Здесь вы пишете друг другу — письма, конверты на любой случай и мемчики. 💛',
};

export function maybeWelcome() {
  let seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch { /* приватний режим */ }
  if (seen && !location.search.includes('hello')) return;
  showWelcome();
}

function showWelcome() {
  const done = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* приватний режим */ }
    root.remove();
  };

  const askPush = () => {
    const pet = petFor('push');
    root.replaceChildren(h('div', { class: 'welcome-step' },
      pet ? h('span', { class: 'mascot', html: mascotImg(pet, 'tilt') }) : null,
      h('h2', {}, 'Чтобы письма приходили вовремя'),
      h('p', {}, `Каждое утро ${petName(pet) || 'почтальон'} будет приносить письмо. Разреши уведомления, чтобы его не пропустить.`),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn', onclick: done }, 'Позже'),
        h('button', {
          type: 'button',
          class: 'btn btn-star',
          onclick: () => { done(); toast('Готово — первое письмо уже ждёт 💌'); },
        }, 'Разрешить'))));
  };

  // Без підписів планет — тут ще не важливо, хто де; сердечко пролітає весь шлях
  const { card, heart } = spaceCard({ label: 'Открытка', phrase: DATA.together.phrase });
  const root = h('div', { class: 'welcome', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Радовалка' },
    h('div', { class: 'welcome-card' }, card),
    h('div', { class: 'welcome-foot' },
      h('p', { class: 'welcome-hello' }, 'Привет! Это Радовалка.'),
      h('p', { class: 'welcome-from' }, HELLO[DATA.side]),
      h('button', { type: 'button', class: 'btn btn-star', onclick: askPush }, 'Открыть')));

  document.body.append(root);
  flyHeart(card, heart, 1, { delay: 500, duration: 2400 });
}
