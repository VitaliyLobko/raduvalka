// Перший запуск: листівка з їхньою фразою, потім — знайомство (у ньому й дозволи)
import { DATA } from './data.js';
import { h, sky } from './ui.js';
import { spaceCard, flyHeart } from './space.js';
import { maybeTour, startTour } from './tour.js';

const KEY = 'radovalka:welcomed';

// Їй — від чоловіка; йому — що тут вони пишуть одне одному
const HELLO = {
  vona: 'Её сделал для тебя твой муж, чтобы тебе было чему улыбнуться 💜',
  vin: 'Здесь вы пишете друг другу: письма, записки в конверты, фото и гифки 💛',
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
    // Після листівки — знайомство; ?hello показує його наново
    if (location.search.includes('hello')) startTour();
    else maybeTour();
  };

  // Без підписів планет — тут ще не важливо, хто де; сердечко пролітає весь шлях
  const { card, heart } = spaceCard({ label: 'Открытка', phrase: DATA.together.phrase });
  const root = h('div', { class: 'welcome', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Радовалка' },
    h('div', { class: 'welcome-card' }, card),
    h('div', { class: 'welcome-foot' },
      h('p', { class: 'welcome-hello' }, 'Привет! Это Радовалка.'),
      h('p', { class: 'welcome-from' }, HELLO[DATA.side]),
      h('button', { type: 'button', class: 'btn btn-star', onclick: done }, 'Открыть')));

  root.prepend(sky(40, 11));
  document.body.append(root);
  flyHeart(card, heart, 1, { delay: 500, duration: 2400 });
}
