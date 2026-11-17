// Черга без зв'язку: лист чи «Я в порядке», що не пішли через мережу, лежать у телефоні й ідуть самі,
// поки Радовалка відкрита. Повтор безпечний: у листа id від телефона (cid), сервер не продублює
import { DATA } from './data.js';
import { send } from './api.js';
import { toast } from './ui.js';

const KEY = 'radovalka:outbox';
const DRAFT = 'radovalka:draft';
const TIMEOUT = 15000;
const BACKOFF = [15000, 30000, 60000, 120000];

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* приватне вікно — черга до закриття */ } };

export const newCid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');

// Нема зв'язку — це помилка без HTTP-статусу (обрив, DNS, таймаут); 4xx/5xx — сервер відповів
const offline = (e) => !e?.status;

// Скільки листів цієї половини чекає (відмітки не рахуємо — вона в кнопці)
export const waiting = () => read().filter((x) => x.side === DATA.side && x.kind === 'letter').length;

const changed = () => document.dispatchEvent(new CustomEvent('radovalka:outbox'));

function enqueue(item) {
  // Відмітка — лише остання: дві «я в порядке» з черги нічого не додають
  const list = read().filter((x) => !(item.kind === 'checkin' && x.kind === 'checkin' && x.side === item.side));
  write([...list, item]);
  changed();
  schedule(0);
}

// Відправити зараз; нема зв'язку — у чергу. Повертає відповідь сервера або { queued: true }
export async function deliver(kind, path, body) {
  const item = { qid: newCid(), kind, path, body: kind === 'letter' ? { ...body, cid: body.cid || newCid() } : body, side: DATA.side, at: Date.now() };
  try {
    return await send(path, 'POST', item.body, { timeout: TIMEOUT });
  } catch (e) {
    if (!offline(e)) throw e;
    enqueue(item);
    return { queued: true };
  }
}

// Сервер відмовив назавжди (4xx) — текст листа повертаємо в чернетку, мовчки не губимо
function giveBack(item) {
  const text = item.body?.text;
  if (item.kind !== 'letter' || !text) return;
  try {
    const cur = localStorage.getItem(DRAFT) || '';
    localStorage.setItem(DRAFT, cur.trim() ? `${cur}\n\n${text}` : text);
  } catch { /* без сховища — лише тост */ }
  toast('Письмо не приняли — текст вернулся в «Написать»');
}

let busy = false;
let timer = null;
let tries = 0;

function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(flush, ms);
}

// Ще раз усе, що чекає, — по черзі; без зв'язку — пауза зростає. На navigator.onLine не дивимось:
// DNS ламається, коли телефон «онлайн»
export async function flush() {
  if (busy || !DATA.side) return;
  busy = true;
  let sent = 0;
  try {
    for (const item of read().filter((x) => x.side === DATA.side)) {
      try {
        await send(item.path, 'POST', item.body, { timeout: TIMEOUT });
      } catch (e) {
        if (offline(e) || e.status >= 500) throw e;
        giveBack(item);
      }
      write(read().filter((x) => x.qid !== item.qid));
      if (item.kind === 'letter') sent++;
    }
    tries = 0;
  } catch {
    if (read().some((x) => x.side === DATA.side)) schedule(BACKOFF[Math.min(tries++, BACKOFF.length - 1)]);
  } finally {
    busy = false;
    changed();
    if (sent) {
      toast(sent === 1 ? 'Письмо без связи ушло ✓' : `Письма без связи ушли ✓ (${sent})`);
      document.dispatchEvent(new CustomEvent('radovalka:sent'));
    }
  }
}

// Старт черги: одразу, при поверненні в застосунок і при «online» (не завадить, якщо спрацює)
export function startOutbox() {
  flush();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tries = 0; flush(); } });
  window.addEventListener('online', () => { tries = 0; flush(); });
}
