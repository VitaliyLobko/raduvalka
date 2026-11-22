// Звуки Радовалки без файлів: синтез Web Audio — калімба, скляні дзвіночки, шурхіт паперу. Усі ноти з однієї
// пентатоніки ре-мажор, тож будь-які два звуки поспіль звучать разом. Тихо, коротко, з легким відлунням шкатулки.
// Браузер дає звук лише після першого дотику до сторінки — до того мовчимо. Вимикач — у «О Радовалке»
const OFF = 'radovalka:sound-off';
export function soundOn() { try { return localStorage.getItem(OFF) !== '1'; } catch { return true; } }
export function setSound(on) {
  try { if (on) localStorage.removeItem(OFF); else localStorage.setItem(OFF, '1'); } catch { /* приватне вікно */ }
}

// Ноти: D5 … A7 (пентатоніка D E F# A B)
const N = {
  D4: 293.66, A4: 440, B4: 493.88, D5: 587.33, E5: 659.25, F5: 739.99, A5: 880, B5: 987.77,
  D6: 1174.66, E6: 1318.51, F6: 1479.98, A6: 1760, B6: 1975.53, D7: 2349.32, E7: 2637.02, F7: 2959.96,
};

let ctx = null;
let out = null;
let noiseBuf = null;
const touched = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
function audio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx || !touched()) return null;
  ctx = new Ctx({ latencyHint: 'interactive' });
  // Майстер → компресор (щоб акорди не хрипіли) → вихід; паралельно — коротке відлуння шкатулки
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  out = ctx.createGain();
  out.gain.value = 0.55;
  const echo = ctx.createDelay(0.5);
  echo.delayTime.value = 0.16;
  const fb = ctx.createGain();
  fb.gain.value = 0.28;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2600;
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  out.connect(comp);
  out.connect(echo);
  echo.connect(tone).connect(fb).connect(echo);
  tone.connect(wet).connect(comp);
  comp.connect(ctx.destination);
  // Шум на секунду — один на всі шурхоти й сплески
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  return ctx;
}
// Перший дотик — будимо звук заздалегідь, щоб перший сигнал не запізнився
addEventListener('pointerdown', () => { if (soundOn()) audio(); }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ctx) ctx.resume().catch(() => {}); });

// Обвідна: швидкий вступ і експоненційне згасання
function env(g, t, peak, len, attack = 0.004) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
}
function osc(type, f, t, peak, len, { attack, to = 0, dest = out } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
  env(g, t, peak, len, attack);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + len + 0.03);
}
// Калімба: основний тон, «язичок» (обертон ×4.2, коротко) і клац на початку
function pluck(f, t, v = 0.22, len = 0.9) {
  osc('sine', f, t, v, len);
  osc('sine', f * 4.2, t, v * 0.22, 0.09);
  osc('triangle', f * 2, t, v * 0.12, len * 0.35);
}
// Скляний дзвіночок: негармонічні обертони, довгий хвіст
function bell(f, t, v = 0.12, len = 1.6) {
  osc('sine', f, t, v, len);
  osc('sine', f * 2.76, t, v * 0.35, len * 0.5);
  osc('sine', f * 5.4, t, v * 0.12, len * 0.25);
}
// Шум через смугу, що їде від from до to: шурхіт, сплеск, рисочка олівцем
function noise(t, len, from, to, { v = 0.1, q = 1.2, type = 'bandpass', attack = 0.01 } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + len);
  const g = ctx.createGain();
  env(g, t, v, len, attack);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + len + 0.03);
}
// Глухий удар з падінням висоти: дерев'яна фішка, падіння, вибух
const thump = (t, f0, f1, len, v) => osc('sine', f0, t, v, len, { to: f1, attack: 0.002 });

const SOUNDS = {
  // Лист прийшов: шкатулка грає три ноти вгору і дзвіночок
  letter: (t) => { pluck(N.A5, t); pluck(N.D6, t + 0.1); pluck(N.F6, t + 0.2); bell(N.A6, t + 0.34, 0.07); },
  // Пішов: шурх угору й крапка
  sent: (t) => { noise(t, 0.24, 700, 3600, { v: 0.07, q: 0.9 }); pluck(N.D6, t + 0.16, 0.1, 0.5); },
  // Твій хід: дінь-дон
  turn: (t) => { bell(N.F6, t, 0.11, 1.1); bell(N.D6, t + 0.2, 0.11, 1.3); },
  // Карточка перевертається: клац картону
  flip: (t) => { noise(t, 0.07, 1800, 4200, { v: 0.12, q: 1.5, attack: 0.002 }); pluck(N.E6, t + 0.02, 0.05, 0.25); },
  // Пара: три ноти вгору й іскра
  pair: (t) => { pluck(N.D6, t, 0.18); pluck(N.F6, t + 0.07, 0.18); pluck(N.A6, t + 0.14, 0.18); bell(N.D7, t + 0.24, 0.07); },
  // Мимо: м'яке «ой» донизу
  miss: (t) => { osc('triangle', N.B5, t, 0.11, 0.25); osc('triangle', N.F5, t + 0.13, 0.11, 0.4); },
  // Хрестик/нулик: дерев'яний тук і нотка
  place: (t) => { thump(t, 520, 240, 0.09, 0.32); pluck(N.A5, t + 0.01, 0.1, 0.4); },
  // Фішка «Четыре в ряд»: падає (свист донизу) і стукає об дно
  drop: (t) => { osc('sine', 1400, t, 0.035, 0.18, { to: 500 }); thump(t + 0.17, 380, 150, 0.12, 0.4); pluck(N.D5, t + 0.17, 0.08, 0.3); },
  // Рисочка олівцем
  line: (t) => { noise(t, 0.14, 2200, 3400, { v: 0.07, q: 2.2 }); pluck(N.B5, t + 0.1, 0.06, 0.3); },
  // «Раз, два, три»: тихі удари, третій вищий
  tick: (t) => pluck(N.A5, t, 0.12, 0.3),
  tock: (t) => pluck(N.D6, t, 0.14, 0.4),
  // Руки відкрились
  reveal: (t) => { noise(t, 0.09, 900, 2600, { v: 0.09 }); pluck(N.F6, t + 0.02, 0.14, 0.5); },
  // Перемога: арпеджіо калімбою, дзвіночок і зорепад іскор
  win: (t) => {
    [N.D5, N.F5, N.A5, N.D6, N.F6, N.A6].forEach((f, i) => pluck(f, t + i * 0.075, 0.17, 1.1));
    bell(N.D7, t + 0.5, 0.1, 2);
    [N.E7, N.A6, N.F7, N.B6].forEach((f, i) => bell(f, t + 0.62 + i * 0.11, 0.035, 0.8));
  },
  // Програш: лагідне «ну от» — чотири ноти донизу, тихо
  lose: (t) => [N.A5, N.F5, N.E5, N.D5].forEach((f, i) => osc('triangle', f, t + i * 0.16, 0.1, 0.6)),
  // Нічия: туди-сюди
  draw: (t) => { pluck(N.D6, t, 0.14); pluck(N.A5, t + 0.14, 0.14); pluck(N.D6, t + 0.28, 0.14); },
  // Морський бій: постріл летить (свист), сплеск, влучання (бум), потопив (бульки донизу), записка (дзвіночки)
  shot: (t) => noise(t, 0.4, 3200, 800, { v: 0.045, q: 9 }),
  splash: (t) => { noise(t, 0.45, 1400, 500, { v: 0.2, q: 0.7, type: 'lowpass', attack: 0.005 }); pluck(N.D6, t + 0.05, 0.05, 0.3); },
  hit: (t) => { thump(t, 160, 45, 0.35, 0.55); noise(t, 0.22, 2000, 400, { v: 0.16, q: 0.6, type: 'lowpass', attack: 0.002 }); },
  sunk: (t) => { thump(t, 120, 40, 0.5, 0.45); [N.B5, N.A5, N.F5, N.E5, N.D5].forEach((f, i) => osc('sine', f * 0.5, t + 0.2 + i * 0.12, 0.09, 0.18, { to: f * 0.45 })); },
  note: (t) => { bell(N.A6, t, 0.08); bell(N.D7, t + 0.12, 0.07); bell(N.F7, t + 0.24, 0.05); },
  // Реакція: бульбашка лопнула
  react: (t) => osc('sine', 620, t, 0.16, 0.08, { to: 1500, attack: 0.003 }),
  // Сердечка: три іскри вгорі
  love: (t) => [N.F6, N.A6, N.D7].forEach((f, i) => bell(f, t + i * 0.09, 0.06, 0.9)),
  // Конверт відкрили: папір і нотка
  open: (t) => { noise(t, 0.28, 400, 1900, { v: 0.07, q: 0.8 }); pluck(N.F6, t + 0.2, 0.1, 0.7); },
  // Дзвіночок: три удари (вхідний) — і один тихий, коли кличеш сам
  bell: (t) => [0, 0.32, 0.64].forEach((d) => { osc('sine', 1320, t + d, 0.28, 1.4, { attack: 0.01 }); osc('sine', 2640, t + d, 0.1, 0.8); osc('sine', 3960, t + d, 0.05, 0.5); }),
  ring: (t) => { osc('sine', 1320, t, 0.14, 1.1, { attack: 0.01 }); osc('sine', 2640, t, 0.05, 0.6); },
};
export const SOUND_NAMES = Object.keys(SOUNDS);

// sfx('pair') — зіграти; delay — у мс (щоб звук ліг на анімацію). Без дотику, у фоні чи вимкнено — тиша
export function sfx(name, delay = 0) {
  if (!soundOn() || document.visibilityState !== 'visible' || !SOUNDS[name]) return;
  try {
    if (!audio()) return;
    SOUNDS[name](ctx.currentTime + 0.02 + delay / 1000);
  } catch { /* без звуку — не біда */ }
}
