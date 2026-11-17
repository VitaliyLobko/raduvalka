// Кнопка «Назад» на телефоні: спершу закриває відкрите вікно, потім повертає на «Письма», а з «Писем» — вихід.
// Вікна (role=dialog) помічаємо самі, тож окремі шторки про історію нічого не знають
const HOME = 'letter';
const layers = [];
// Скільки popstate прийде від нашого ж history.back(); записи, що чекають, поки той назад відпрацює
let skip = 0;
const queue = [];
// Скільки своїх записів лежить над першим; перед перезавантаженням їх знімаємо, щоб «Назад» не вів у старий документ
let depth = 0;
let leaving = false;

const isLayer = (n) => n.nodeType === 1 && n.getAttribute('role') === 'dialog' && !n.classList.contains('welcome');

function pushNow(state) {
  history.pushState(state, '');
  depth += 1;
}

function push(state) {
  if (skip) queue.push(state);
  else pushNow(state);
}

function back() {
  skip += 1;
  history.back();
}

// Закрити вікно так само, як це зробила б людина: ✕, тап по затемненню, тап по самому вікну, Esc
function closeLayer(n) {
  const x = n.querySelector('.sheet-close');
  const shade = n.previousElementSibling?.classList.contains('backdrop') ? n.previousElementSibling : null;
  if (x) x.click();
  else if (shade) shade.click();
  else n.click();
  if (n.isConnected) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

export function initBack(showTab) {
  history.replaceState({ tab: HOME }, '');
  // Сторінку повернули з кешу браузера (bfcache) — вона могла бути іншою половиною чи до виходу: лише наново
  addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
  new MutationObserver((records) => {
    if (leaving) return;
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (!isLayer(n)) return;
        layers.push(n);
        push({ layer: true });
      });
      r.removedNodes.forEach((n) => {
        const i = layers.indexOf(n);
        if (i < 0) return;
        // Закрили кнопкою — прибираємо і свій запис, щоб «Назад» не клацав уже порожнім
        layers.splice(i, 1);
        back();
      });
    }
  }).observe(document.body, { childList: true });

  addEventListener('popstate', (e) => {
    depth = Math.max(0, depth - 1);
    if (leaving) return;
    if (skip) {
      skip -= 1;
      if (!skip) queue.splice(0).forEach(pushNow);
      return;
    }
    const top = layers.pop();
    if (top) {
      closeLayer(top);
      // Вікно не закрилось (наприклад, перепитало й почуло «ні») — повертаємо йому запис
      if (top.isConnected) {
        layers.push(top);
        pushNow({ layer: true });
      }
      return;
    }
    showTab(e.state?.tab || HOME);
  });
}

// Перед reload / location.replace: зняти свої записи, щоб після перезапуску під першим не лишилось старих
export function leave(go) {
  leaving = true;
  if (!depth) { go(); return; }
  addEventListener('popstate', () => go(), { once: true });
  history.go(-depth);
}

// Перехід на вкладку з меню: з «Писем» — новий запис, між іншими — заміна, назад на «Письма» — крок назад
export function tabChanged(from, to) {
  if (from === to) return;
  if (to === HOME) back();
  else if (from === HOME) push({ tab: to });
  else if (!skip) history.replaceState({ tab: to }, '');
  else if (queue.at(-1)?.tab) queue[queue.length - 1] = { tab: to };
  else queue.push({ tab: to });
}
