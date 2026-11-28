// «🎲 Кубики» 18+: три кубики (что · где · как) рівня 💗 / 🔥 / 🌶️. Кидаю я — це мій подарунок другому:
// не подобається один кубик — тап по ньому, перекинеться лише він (до 3 разів); «Подарить купон» — купон іде в чат.
// Той, кому подарували, дивиться той самий кидок на весь екран і, коли купон виконано, відмічає «Исполнено ✓».
// Кидає сервер; тексти граней — у секреті воркера, тут їх нема
import { who } from './data.js';
import { get, send } from './api.js';
import { h, toast, reduceMotion } from './ui.js';
import { burst } from './fx.js';
import { sfx } from './sound.js';
import { gameSheet } from './games.js';

const LEVELS = [
  ['soft', '💗', 'Нежно', 'Поцелуи и ласки'],
  ['hot', '🔥', 'Горячо', 'Посмелее: масло, лёд, повязка на глаза'],
  ['fire', '🌶️', 'Огонь', 'Самые откровенные купоны'],
  ['xxx', '🔞', 'Без запретов', 'Секс, игрушки, роли — когда согласны оба'],
];
// Другий кубик — куди на тілі; у «Без запретов» — де (місце)
const diceNames = (level) => ['Что', level === 'xxx' ? 'Где' : 'Куда', 'Как'];
// Поки кубики котяться — мелькають нейтральні значки (справжні грані знає лише сервер)
const BLUR = ['❤️', '✨', '💫', '💞', '🌙', '🔥', '💋', '🎲'];
const blur = () => BLUR[Math.floor(Math.random() * BLUR.length)];
// Кубики стають по одному: зліва направо, з клацанням і вібрацією
const SETTLE = [650, 1000, 1350];

let open = null;
const forThem = () => (who().partner === 'она' ? 'ей' : 'ему');
const levelOf = (l) => LEVELS.find(([k]) => k === l) || LEVELS[1];

export async function openDice() {
  if (open) return;
  const sh = gameSheet({ icon: '🎲', title: 'Кубики', cls: 'dice-sheet', onClose: () => { open?.stop?.(); open = null; } });
  open = { body: sh.body, close: sh.close, busy: false, stop: null };
  sh.body.append(h('p', { class: 'hint duel-hint' }, 'Загружаю…'));
  let r;
  try { r = await get('dice'); } catch (e) {
    if (open) msg(e.status === 503 ? 'Эта игра пока недоступна' : 'Нет связи — кубики откроются, когда появится интернет');
    return;
  }
  if (!open) return;
  open.info = r;
  if (r.roll) play(r.roll, null);
  else levels();
}

const msg = (text) => open.body.replaceChildren(h('p', { class: 'hint duel-hint' }, text));

function levels() {
  const info = open.info || {};
  const xxx = info.xxx || { me: false, them: false };
  const both = xxx.me && xxx.them;
  const partner = who().partner;
  const score = info.score ? h('p', { class: 'dice-score' }, `🎲 Купонов: ты подарил${partner === 'она' ? '' : 'а'} ${info.score.mine} · ${partner} — ${info.score.theirs}`) : null;
  const consent = h('label', { class: 'dice-consent' },
    h('input', { type: 'checkbox', checked: xxx.me || null, onchange: async (e) => {
      try { const res = await send('dice/xxx', 'POST', { on: e.target.checked }); open.info = { ...info, xxx: res.xxx }; levels(); } catch { e.target.checked = !e.target.checked; toast('Нет связи — попробуй ещё раз'); }
    } }),
    h('span', {}, `🔞 Я за «Без запретов»`, h('small', {}, both ? ' — вы оба согласны, уровень открыт' : xxx.them ? ` — ${partner} уже за, остался ты` : xxx.me ? ` — ждём, когда ${partner} тоже согласится` : ' — откроется, когда согласятся оба')));
  const list = (info.list || []).slice(0, 12);
  const coll = list.length ? h('details', { class: 'dice-coll' }, h('summary', {}, `💌 Наша коллекция · ${(info.list || []).length}`),
    ...list.map((c) => h('p', { class: `dice-coll-row${c.done ? ' is-done' : ''}` }, h('span', {}, c.mine ? 'от тебя' : `от ${partner === 'она' ? 'неё' : 'него'}`), ' ', c.text,
      c.done ? h('b', {}, c.stars ? ` 🔥${'★'.repeat(c.stars)}` : ' ✓') : null))) : null;
  open.body.replaceChildren(
    ...[score].filter(Boolean),
    h('p', { class: 'hint duel-hint dice-about' }, `Бросаешь ты — это твой подарок ${forThem()}: что, куда и как. Не нравится кубик — тапни его, и он перебросится. Понравилось — подари купон, ${who().partner} предъявит его на встрече 😏`),
    h('div', { class: 'hot-levels' }, ...LEVELS.map(([level, icon, name, about]) => h('button', {
      type: 'button', class: `game-tile hot-level is-${level}${level === 'xxx' && !both ? ' is-locked' : ''}`,
      onclick: () => (level === 'xxx' && !both ? toast('🔞 Откроется, когда согласитесь оба — галочка ниже') : roll({ level })),
    }, h('span', { class: 'game-tile-icon', 'aria-hidden': 'true' }, level === 'xxx' && !both ? '🔒' : icon), h('span', { class: 'game-tile-text' }, h('b', {}, name), h('span', {}, about))))),
    consent,
    h('button', { type: 'button', class: 'btn dice-veto-btn', onclick: () => vetoes('soft') }, '🚫 Не моё — вычеркнуть грани'),
    ...[coll].filter(Boolean));
}

// «Не моё»: грані рівня списком, тап — викреслити (до 2 на кубик). Кидки, які дарують мені, їх не дають; другий цього не бачить
async function vetoes(level, die = 0) {
  if (open.busy) return;
  const xxx = open.info?.xxx || {};
  const names = diceNames(level);
  const tabs = h('div', { class: 'dice-veto-levels', role: 'group', 'aria-label': 'Уровень' },
    ...LEVELS.filter(([l]) => l !== 'xxx' || xxx.me).map(([l, icon, name]) => h('button', {
      type: 'button', class: 'dice-veto-level', 'aria-pressed': String(l === level), 'aria-label': name, onclick: () => l !== level && vetoes(l, die),
    }, icon)));
  const dies = h('div', { class: 'dice-veto-dies', role: 'group', 'aria-label': 'Кубик' },
    ...names.map((n, i) => h('button', { type: 'button', class: 'dice-veto-die', 'aria-pressed': String(i === die), onclick: () => i !== die && vetoes(level, i) }, n)));
  const back = h('button', { type: 'button', class: 'duel-cancel', onclick: levels }, '← Назад');
  open.busy = true;
  let r;
  try { r = await get(`dice/faces?level=${level}`); } catch {
    if (open) { open.busy = false; toast('Нет связи — попробуй ещё раз'); }
    return;
  } finally { if (open) open.busy = false; }
  if (!open) return;
  const side = ['act', 'part', 'how'][die];
  const chips = h('div', { class: 'dice-veto-chips' }, ...r.faces[die].map(([icon, text], j) => {
    const chip = h('button', { type: 'button', class: 'dice-veto-chip', 'aria-pressed': String((r.veto?.[side] || []).includes(j)), onclick: async () => {
      const on = chip.getAttribute('aria-pressed') !== 'true';
      chip.disabled = true;
      try {
        await send('dice/veto', 'POST', { level, die, face: j, on });
        chip.setAttribute('aria-pressed', String(on));
      } catch (e) { toast(e.status === 409 ? 'Не больше двух на кубик — иначе выпадать будет нечему' : 'Нет связи — попробуй ещё раз'); }
      chip.disabled = false;
    } }, h('span', { 'aria-hidden': 'true' }, icon), ` ${text}`);
    return chip;
  }));
  const P = who().partner;
  open.body.replaceChildren(
    h('p', { class: 'hint duel-hint dice-veto-about' }, `Вычеркни, что не по душе: в бросках для тебя этого не будет. ${P[0].toUpperCase()}${P.slice(1)} не узнает. До двух граней на кубик.`),
    tabs, dies, chips, back);
}

// Великий кубик: грань — значок того, що випало; onTap — перекинути саме його
function bigDie(icon, onTap = null) {
  const face = h('span', { class: 'dice-face', 'aria-hidden': 'true' }, icon);
  const el = onTap ? h('button', { type: 'button', class: 'dice-die is-big', 'aria-label': 'Перебросить этот кубик', onclick: onTap }, face)
    : h('span', { class: 'dice-die is-big' }, face);
  return { el, face };
}

// Сцена кидка (у мене — з перекиданням, у неї — повтор): кубики котяться, стають по одному, тоді слова й фраза
function stage(r, { canReroll = false, onReroll = null, lead = '' } = {}) {
  const [, icon, name] = levelOf(r.level);
  const texts = r.texts || [];
  const dies = r.icons.map((ic, i) => bigDie(ic, canReroll && r.left > 0 ? () => onReroll(i) : null));
  const words = texts.map((t) => h('span', { class: 'dice-word' }, t));
  const names = diceNames(r.level);
  const cols = dies.map((d, i) => h('div', { class: 'dice-col' }, h('span', { class: 'dice-label' }, names[i]), d.el, words[i]));
  const phrase = h('p', { class: 'dice-phrase' }, lead, texts.join(' · '));
  const box = h('section', { class: `dice-stage is-${r.level}` },
    h('p', { class: 'dice-level' }, `${icon} ${name}`),
    h('div', { class: 'dice-row' }, ...cols),
    phrase);
  const shown = () => { words.forEach((w) => w.classList.add('is-in')); phrase.classList.add('is-in'); };
  // which — які кубики котяться (за замовчуванням усі); повертає «зупинити»
  const roll = (which = [0, 1, 2]) => {
    if (reduceMotion) { shown(); return () => {}; }
    box.classList.add('is-rolling');
    heat(true);
    which.forEach((i) => { dies[i].el.classList.add('is-tumbling'); words[i]?.classList.remove('is-in'); });
    phrase.classList.remove('is-in');
    sfx('dice');
    const t = setInterval(() => which.forEach((i) => { if (dies[i].el.classList.contains('is-tumbling')) dies[i].face.textContent = blur(); }), 90);
    const timers = which.map((i, k) => setTimeout(() => {
      dies[i].el.classList.remove('is-tumbling');
      dies[i].face.textContent = r.icons[i];
      dies[i].el.classList.add('is-landed');
      setTimeout(() => dies[i].el.classList.remove('is-landed'), 400);
      words[i]?.classList.add('is-in');
      sfx('place');
      navigator.vibrate?.(15);
      if (k === which.length - 1) {
        clearInterval(t);
        box.classList.remove('is-rolling');
        phrase.classList.add('is-in');
        heat(false);
        if (which.length === 3) { box.classList.add('is-flash'); setTimeout(() => box.classList.remove('is-flash'), 700); burst(box, '🌹', 12); }
      }
    }, SETTLE[k]));
    return () => { clearInterval(t); timers.forEach(clearTimeout); heat(false); };
  };
  return { box, roll, shown };
}

// Шар «жару» над усім екраном на час кидка — CSS: .dice-heat
let heatEl = null;
function heat(on) {
  if (on && !heatEl) {
    heatEl = h('div', { class: 'dice-heat', 'aria-hidden': 'true' });
    document.body.append(heatEl);
    sfx('heartbeat');
    navigator.vibrate?.([70, 110, 110, 400, 70, 110, 110]);
  } else if (!on && heatEl) {
    const el = heatEl;
    heatEl = null;
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 500);
  }
}

// Мій кидок: сцена, «Подарить купон», лічильник перекидань, інший рівень. which — що котиться (null — без анімації)
function play(r, which = [0, 1, 2]) {
  const s = stage(r, { canReroll: true, onReroll: (i) => roll({ id: r.id, die: i }, [i]), lead: 'Я подарю тебе: ' });
  open.body.replaceChildren(
    s.box,
    h('p', { class: 'dice-left' }, r.left > 0 ? `Тапни кубик, чтобы перебросить его · осталось ${r.left}` : 'Перебросы закончились — дари или выбери другой уровень'),
    h('label', { class: 'dice-lock' }, h('input', { type: 'checkbox', class: 'dice-lock-box' }), h('span', {}, `🔒 Без торга — ${who().partner} не сможет перебросить`)),
    h('button', { type: 'button', class: 'btn btn-primary duel-go dice-keep', onclick: () => keep(r) }, `🎁 Подарить купон ${forThem()}`),
    h('button', { type: 'button', class: 'duel-cancel', onclick: drop }, '← Другой уровень'));
  open.stop?.();
  open.stop = null;
  if (which) open.stop = s.roll(which);
  else s.shown();
}

async function roll(body, which = [0, 1, 2]) {
  if (open.busy) return;
  open.busy = true;
  try {
    const r = await send('dice', 'POST', body);
    if (open) play(r.roll, which);
  } catch (e) {
    toast(e.status === 409 ? (body.die != null ? 'Перебросы закончились' : 'Этот бросок уже закончился') : 'Нет связи — попробуй ещё раз');
    if (e.status === 409 && open && body.die == null) levels();
  } finally { if (open) open.busy = false; }
}

async function keep(r) {
  if (open.busy) return;
  open.busy = true;
  try {
    await send('dice/keep', 'POST', { id: r.id, lock: !!open.body.querySelector('.dice-lock-box')?.checked });
    document.dispatchEvent(new CustomEvent('radovalka:marked'));
    burst(open.body.querySelector('.dice-stage'), '💋', 12);
    toast(`Купон у ${who().partner === 'она' ? 'неё' : 'него'} в чате — бросок увидит целиком`);
    const close = open.close;
    setTimeout(close, 700);
  } catch (e) {
    toast(e.status === 409 ? 'Этот бросок уже закончился' : 'Нет связи — попробуй ещё раз');
    if (open) open.busy = false;
  }
}

async function drop() {
  if (open.busy) return;
  try { await send('dice/drop', 'POST', {}); } catch { /* без звʼязку — кидок лишиться до наступного */ }
  if (open) levels();
}

// Повтор кидка на весь екран (купон у чаті): ті самі кубики котяться й стають на свої грані, тоді — текст.
// w — купон { icons, texts?, text, level?, mine }; onDone — закрили
// Чий зараз хід у купоні: хто кинув — дарує й виконує; хто отримав — торгується, предʼявляє, ставить зірки
export function couponStep(w, canHaggle = false) {
  const p = who().partner;
  const P = p === 'она' ? 'Она' : 'Он';
  if (w.done) return w.mine ? `✓ Исполнено — ${p} поставил${p === 'она' ? 'а' : ''} звёзды` : '✓ Исполнено — купон в нашей коллекции';
  if (w.mine) return w.claimed ? `📩 ${P} предъявил${p === 'она' ? 'а' : ''} купон. Твой ход: исполни 😏` : `⏳ Ждём, когда ${p} предъявит. Исполняешь ты`;
  if (w.claimed) return `📩 Предъявлено. Ждём, когда ${p} исполнит, потом поставь звёзды`;
  return canHaggle ? 'Твой ход: предъяви купон. Не нравится кубик — тапни его, перебросить можно один раз' : 'Твой ход: предъяви купон здесь или на встрече 😏';
}

export function diceShow(w, onDone = () => {}, { id = null, onChange = null } = {}) {
  const texts = w.texts?.length === 3 ? w.texts : String(w.text || '').split(' · ');
  // Торг: раз перекинути один кубик купона, якщо дарувальник не поставив «без торгу»
  const haggle = !w.mine && !w.done && w.canHaggle && id;
  let s;
  const make = (cur) => stage({ level: cur.level || 'hot', icons: cur.icons || ['🎲', '🎲', '🎲'], texts: cur.texts?.length === 3 ? cur.texts : String(cur.text || '').split(' · '), left: haggle ? 1 : 0 },
    { canReroll: haggle, onReroll: async (i) => {
      try {
        const res = await send('dice/haggle', 'POST', { id, die: i });
        Object.assign(w, res.wish);
        onChange?.(res.wish);
        const fresh = make(w);
        s.box.replaceWith(fresh.box);
        s = fresh;
        tip.textContent = couponStep(w, false);
        stop = s.roll([i]);
      } catch (e) { toast(e?.status === 409 ? 'Торговаться уже нельзя' : 'Нет связи — попробуй ещё раз'); }
    } });
  s = make({ ...w, texts });
  const close = () => { stop(); layer.remove(); document.removeEventListener('keydown', onKey); onDone(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const tip = h('p', { class: 'dice-show-hint dice-step' }, couponStep(w, haggle));
  const from = w.mine ? 'Твой купон' : `${who().partner === 'она' ? 'Она дарит' : 'Он дарит'} тебе купон`;
  const layer = h('div', { class: 'dice-show', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Купон на встречу' },
    h('p', { class: 'dice-show-head' }, `🎲 ${from}`),
    s.box,
    tip,
    !w.mine && !w.done && id ? h('div', { class: 'dice-stars dice-show-stars', role: 'group', 'aria-label': 'Было жарко — оцени' },
      h('span', { class: 'dice-stars-label' }, '🔥 Было жарко?'),
      ...[1, 2, 3, 4, 5].map((k) => h('button', { type: 'button', class: 'dice-star', 'aria-label': `${k} из 5`, onclick: async (e) => {
        const btn = e.currentTarget; btn.disabled = true;
        try {
          const res = await send('duel/wish-done', 'POST', { id, stars: k });
          Object.assign(w, res.wish);
          onChange?.(res.wish);
          document.dispatchEvent(new CustomEvent('radovalka:marked'));
          toast(`🔥 ${'★'.repeat(k)} — ${who().partner} узнает`);
          burst(layer, '🔥', 12);
          setTimeout(() => close(), 600);
        } catch { btn.disabled = false; toast('Не отметилось — нет связи'); }
      } }, '★'))) : null,
    !w.mine && !w.done && id ? h('button', { type: 'button', class: 'btn btn-primary dice-show-claim', onclick: async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const res = await send('dice/claim', 'POST', { id });
        Object.assign(w, res.wish);
        onChange?.(res.wish);
        toast(`📩 Отправлено — ${who().partner} получит уведомление`);
        burst(layer, '💌', 10);
        tip.textContent = couponStep(w, false);
        btn.textContent = `📩 Напомнить ${who().partner === 'она' ? 'ей' : 'ему'}`;
      } catch { toast('Не отправилось — нет связи'); }
      btn.disabled = false;
    } }, `📩 ${w.claimed ? 'Напомнить' : 'Предъявить'} ${who().partner === 'она' ? 'ей' : 'ему'}`) : null,
    w.mine ? null : h('button', { type: 'button', class: 'btn dice-show-back', onclick: () => { close(); setTimeout(openDice, 250); } }, `🎲 Бросить в ответ ${who().partner === 'она' ? 'ей' : 'ему'}`),
    h('button', { type: 'button', class: 'btn btn-primary dice-show-close', onclick: () => close() }, 'Закрыть'));
  document.body.append(layer);
  document.addEventListener('keydown', onKey);
  let stop = s.roll();
}

// Три значки купона рядком над його текстом (у чаті)
const miniDie = (icon) => h('span', { class: 'dice-die' }, h('span', { class: 'dice-face', 'aria-hidden': 'true' }, icon));
export const diceIcons = (icons) => h('span', { class: 'dice-row dice-row-mini', 'aria-hidden': 'true' }, ...icons.map((ic) => miniDie(ic)));
