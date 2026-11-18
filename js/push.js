// Push-сповіщення «Тебе письмо 💌». Підписка належить телефону: сервер тримає її за поточною половиною
// і перепривʼязує при кожному старті. Чи ввімкнено — за самою підпискою: дозвіл на сповіщення
// спільний з іншими застосунками на цьому сайті й про Радовалку нічого не каже
import { get, send } from './api.js';
import { h, toast } from './ui.js';
import { DATA, who } from './data.js';

// Другому сповіщення не приходять — сказати прямо, щоб не чекали push, якого не буде
export function partnerOff() {
  if (DATA.partnerPush !== false) return null;
  const me = who();
  return h('p', { class: 'hint push-partner-off' },
    `У ${me.partner === 'она' ? 'неё' : 'него'} не включены уведомления, поэтому ${me.toWhom} ничего не приходит. `
    + `Включить можно на ${me.partner === 'она' ? 'её' : 'его'} телефоне: «О Радовалке» → «🔔 Присылать уведомления».`);
}

const ASK = 'radovalka:push-ask';
const ASK_AGAIN = 7 * 86400000;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// ready не настане, якщо service worker не зареєструвався, — тоді вважаємо, що push немає
const ready = () => Promise.race([
  navigator.serviceWorker.ready,
  new Promise((resolve) => { setTimeout(() => resolve(null), 4000); }),
]);

async function current() {
  const reg = await ready();
  return reg ? reg.pushManager.getSubscription() : null;
}

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};
const register = (sub) => send('push', 'PUT', { ...sub.toJSON(), tz: tz() });
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

// 'unsupported' | 'denied' | 'on' | 'off'
export async function pushState() {
  if (!supported()) return 'unsupported';
  if (await current()) return 'on';
  return Notification.permission === 'denied' ? 'denied' : 'off';
}

export async function enablePush() {
  const { key } = await get('push-key');
  if (!key) throw Object.assign(new Error('nokey'), { status: 503 });
  const reg = await ready();
  if (!reg) throw new Error('no worker');
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
  await register(sub);
}

export async function disablePush() {
  const sub = await current();
  if (!sub) return;
  await send('push', 'DELETE', { endpoint: sub.endpoint }).catch(() => { /* сервер прибере сам, коли push-сервіс відповість 410 */ });
  await sub.unsubscribe();
}

export async function testPush() {
  const sub = await current();
  if (!sub) throw new Error('off');
  return send('push-test', 'POST', { endpoint: sub.endpoint });
}

// Старт: телефон уже підписаний — нагадати серверу, за якою він половиною і в якому поясі
export async function syncPush() {
  if (!supported()) return;
  const sub = await current().catch(() => null);
  if (sub) register(sub).catch(() => { /* спробуємо наступного разу */ });
}

const errText = (e) => (e?.name === 'NotAllowedError'
  ? 'Уведомления запрещены — разреши их в настройках браузера для этого сайта'
  : e?.status === 503 ? 'Уведомления ещё не подключены на сервере' : 'Не получилось — проверь интернет');

export async function turnOn() {
  try {
    await enablePush();
    toast('Готово — пришлю, когда будет письмо 🔔');
    return true;
  } catch (e) {
    toast(errText(e));
    return false;
  }
}

function asked() {
  try {
    // Закрила хрестиком — не набридаємо тиждень, потім питаємо знову (без сповіщень другий не дізнається нічого)
    return Date.now() - Number(localStorage.getItem(ASK) || 0) < ASK_AGAIN;
  } catch {
    return true;
  }
}
function markAsked() {
  try {
    localStorage.setItem(ASK, String(Date.now()));
  } catch { /* приватний режим — спитаємо ще раз, не страшно */ }
}

// Одноразова пропозиція на вкладці «Письма»: місце під неї є одразу, вміст — коли стане ясно, чи треба
export function pushAsk() {
  const slot = h('div', { class: 'push-ask-slot' });
  if (asked()) return slot;
  pushState().then((st) => {
    if (st !== 'off' || !slot.isConnected) return;
    const close = () => { markAsked(); slot.replaceChildren(); };
    slot.replaceChildren(h('div', { class: 'push-ask', role: 'group', 'aria-label': 'Уведомления' },
      h('span', { class: 'push-ask-text' }, '🔔 Сообщать, когда придёт письмо?'),
      h('button', {
        type: 'button',
        class: 'btn btn-primary push-ask-go',
        onclick: async (e) => {
          const go = e.currentTarget;
          go.disabled = true;
          if (await turnOn()) close();
          else go.disabled = false;
        },
      }, 'Включить'),
      h('button', { type: 'button', class: 'push-ask-x', 'aria-label': 'Не сейчас', onclick: close }, '✕')));
  }).catch(() => { /* без push просто нічого не показуємо */ });
  return slot;
}

// Блок у «О Радовалке»: увімкнути / перевірити / вимкнути
export function pushPanel() {
  const box = h('div', { class: 'push-panel' });
  const draw = async () => {
    await drawMine();
    const off = partnerOff();
    if (off) box.append(off);
  };
  const drawMine = async () => {
    const st = await pushState().catch(() => 'unsupported');
    const btn = (label, onclick, cls = 'btn') => h('button', { type: 'button', class: cls, onclick }, label);
    if (st === 'unsupported') {
      box.replaceChildren(h('p', { class: 'hint' }, 'Уведомления работают, если открыть Радовалку с иконки на главном экране.'));
    } else if (st === 'denied') {
      box.replaceChildren(h('p', { class: 'hint' }, 'Уведомления запрещены в настройках браузера для этого сайта.'));
    } else if (st === 'off') {
      box.replaceChildren(btn('🔔 Присылать уведомления', async () => { if (await turnOn()) draw(); }, 'btn btn-primary'));
    } else {
      box.replaceChildren(
        btn('🔔 Проверить уведомление', async () => {
          try {
            const { status } = await testPush();
            toast(status >= 200 && status < 300 ? 'Отправлено, сейчас придёт' : 'Сервис уведомлений не принял — выключи и включи снова');
          } catch (e) {
            toast(errText(e));
          }
          draw();
        }),
        btn('🔕 Выключить уведомления', async () => { await disablePush(); toast('Уведомления выключены'); draw(); }));
    }
  };
  draw();
  return box;
}
