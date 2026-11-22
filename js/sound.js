// Звуки Радовалки без файлів: синтез Web Audio. Усі ноти з однієї пентатоніки ре-мажор, тож будь-які два звуки
// поспіль звучать разом. Тихо, коротко, з легким відлунням шкатулки.
// Мелодію грає інструмент: кожен обирає свій у «О Радовалке». Моє (відправила, сходила) — моїм інструментом,
// те, що прийшло від другого (лист, його хід), — його. Шурхоти, стуки й сплески — однакові для всіх.
// Браузер дає звук лише після першого дотику до сторінки — до того мовчимо. Вимикач — у «О Радовалке»
const OFF = 'radovalka:sound-off';
export function soundOn() { try { return localStorage.getItem(OFF) !== '1'; } catch { return true; } }
export function setSound(on) {
  try { if (on) localStorage.removeItem(OFF); else localStorage.setItem(OFF, '1'); } catch { /* приватне вікно */ }
}

// Інструменти: назва і «на чому грає» (для підпису про другого)
export const INSTRUMENTS = {
  kalimba: { name: 'Калимба', on: 'на калимбе' },
  harp: { name: 'Арфа', on: 'на арфе' },
  flute: { name: 'Флейта', on: 'на флейте' },
  violin: { name: 'Скрипка', on: 'на скрипке' },
  cello: { name: 'Виолончель', on: 'на виолончели' },
  bells: { name: 'Колокольчики', on: 'на колокольчиках' },
};
const INSTR = 'radovalka:instrument';
const known = (k) => (Object.hasOwn(INSTRUMENTS, k) ? k : 'kalimba');
export function myInstrument() { try { return known(localStorage.getItem(INSTR)); } catch { return 'kalimba'; } }
export function setMyInstrument(k) { try { localStorage.setItem(INSTR, known(k)); } catch { /* приватне вікно */ } }
let theirs = 'kalimba';
export const partnerInstrument = () => theirs;
export function setPartnerInstrument(k) { theirs = known(k); }

// Ноти: D4 … F7 (пентатоніка D E F# A B)
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
  // Шум на секунду — один на всі шурхоти, сплески й подих флейти
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
// Обвідна протяжного звуку: плавний вступ, нота тримається й трохи слабне, потім відпускаємо
function swell(g, t, peak, attack, hold, release) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(peak * 0.7, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
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
// Вібрато: повільне коливання висоти, що розгойдується не одразу (як у живого виконавця)
function vibrato(params, t, end, rate, depth, delay) {
  const l = ctx.createOscillator();
  const g = ctx.createGain();
  l.frequency.value = rate;
  g.gain.setValueAtTime(0, t);
  g.gain.setValueAtTime(0, t + delay);
  g.gain.linearRampToValueAtTime(depth, t + delay + 0.2);
  l.connect(g);
  params.forEach((p) => g.connect(p));
  l.start(t);
  l.stop(end + 0.03);
}
// Шум через смугу, що їде від from до to: шурхіт, сплеск, рисочка олівцем, подих
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

// Калімба: основний тон, «язичок» (обертон ×4.2, коротко) і клац на початку — металева, дзвінка
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
// Арфа: м'яка струна — чисті обертони ×2 і ×3 без металу, довго тане
function harp(f, t, v = 0.22, len = 0.9) {
  const L = len * 1.6 + 0.4;
  osc('sine', f, t, v * 0.65, L, { attack: 0.003 });
  osc('triangle', f, t, v * 0.22, L * 0.6, { attack: 0.003 });
  osc('sine', f * 2, t, v * 0.16, L * 0.45, { attack: 0.003 });
  osc('sine', f * 3, t, v * 0.05, L * 0.2, { attack: 0.003 });
}
// Флейта: подих на вступі, чистий тон, що розгойдується вібрато, і тихий другий обертон
function flute(f, t, v = 0.22, len = 0.9) {
  const a = 0.05;
  const hold = Math.min(len * 0.35, 0.3);
  const end = t + a + hold + 0.24;
  const g = ctx.createGain();
  swell(g, t, v * 0.6, a, hold, 0.24);
  g.connect(out);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f * 0.995, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(f * 2, t);
  const g2 = ctx.createGain();
  g2.gain.value = 0.1;
  o.connect(g);
  o2.connect(g2).connect(g);
  vibrato([o.frequency, o2.frequency], t, end, 5.2, f * 0.007, 0.1);
  [o, o2].forEach((x) => { x.start(t); x.stop(end + 0.03); });
  noise(t, a + 0.12, f * 1.1, f * 1.6, { v: v * 0.35, q: 1.4, attack: 0.02 });
}
// Смичок: дві злегка розстроєні пилки через фільтр, що розкривається, під'їзд до ноти знизу, вібрато
// і шерех волосу на вступі. Скрипка — яскрава й співуча, віолончель — на октаву нижче, тепла й повільна
function bowed(f, t, v, len, { attack, cut, rate, depth, gain }) {
  const hold = Math.min(len * 0.4, 0.36);
  const rel = 0.3;
  const end = t + attack + hold + rel;
  const g = ctx.createGain();
  swell(g, t, v * gain, attack, hold, rel);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.7;
  lp.frequency.setValueAtTime(f * cut * 0.5, t);
  lp.frequency.linearRampToValueAtTime(f * cut, t + attack + 0.06);
  lp.connect(g).connect(out);
  const saws = [-6, 6].map((cents) => {
    const s = ctx.createOscillator();
    s.type = 'sawtooth';
    s.detune.value = cents;
    s.frequency.setValueAtTime(f * 0.98, t);
    s.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    s.connect(lp);
    s.start(t);
    s.stop(end + 0.03);
    return s;
  });
  vibrato(saws.map((s) => s.frequency), t, end, rate, f * depth, 0.12);
  noise(t, attack + 0.1, f * 2, f * 3, { v: v * 0.18, q: 2, attack: 0.02 });
}
const violin = (f, t, v = 0.22, len = 0.9) => bowed(f, t, v, len, { attack: 0.06, cut: 4, rate: 5.8, depth: 0.008, gain: 0.42 });
const cello = (f, t, v = 0.22, len = 0.9) => bowed(f / 2, t, v, len, { attack: 0.09, cut: 3.2, rate: 5, depth: 0.007, gain: 0.5 });
// Колокольчики: уся мелодія — скляними дзвіночками
const chimes = (f, t, v = 0.22, len = 0.9) => bell(f, t, v * 0.6, len * 1.3 + 0.3);
const VOICES = { kalimba: pluck, harp, flute, violin, cello, bells: chimes };

// Глухий удар з падінням висоти: дерев'яна фішка, падіння, вибух
const thump = (t, f0, f1, len, v) => osc('sine', f0, t, v, len, { to: f1, attack: 0.002 });

// I(f, t, v, len) — нота інструментом; bell — іскри-дзвіночки зверху, однакові для всіх
const SOUNDS = {
  // Лист прийшов: три ноти вгору і дзвіночок
  letter: (t, I) => { I(N.A5, t); I(N.D6, t + 0.1); I(N.F6, t + 0.2); bell(N.A6, t + 0.34, 0.07); },
  // Пішов: шурх угору й крапка
  sent: (t, I) => { noise(t, 0.24, 700, 3600, { v: 0.07, q: 0.9 }); I(N.D6, t + 0.16, 0.1, 0.5); },
  // Твій хід: дінь-дон
  turn: (t, I) => { I(N.F6, t, 0.16, 1.1); I(N.D6, t + 0.2, 0.16, 1.3); },
  // Карточка перевертається: клац картону
  flip: (t, I) => { noise(t, 0.07, 1800, 4200, { v: 0.12, q: 1.5, attack: 0.002 }); I(N.E6, t + 0.02, 0.05, 0.25); },
  // Пара: три ноти вгору й іскра
  pair: (t, I) => { I(N.D6, t, 0.18); I(N.F6, t + 0.07, 0.18); I(N.A6, t + 0.14, 0.18); bell(N.D7, t + 0.24, 0.07); },
  // Мимо: м'яке «ой» донизу
  miss: (t, I) => { I(N.B5, t, 0.13, 0.25); I(N.F5, t + 0.13, 0.13, 0.4); },
  // Хрестик/нулик: дерев'яний тук і нотка
  place: (t, I) => { thump(t, 520, 240, 0.09, 0.32); I(N.A5, t + 0.01, 0.1, 0.4); },
  // Фішка «Четыре в ряд»: падає (свист донизу) і стукає об дно
  drop: (t, I) => { osc('sine', 1400, t, 0.035, 0.18, { to: 500 }); thump(t + 0.17, 380, 150, 0.12, 0.4); I(N.D5, t + 0.17, 0.08, 0.3); },
  // Рисочка олівцем
  line: (t, I) => { noise(t, 0.14, 2200, 3400, { v: 0.07, q: 2.2 }); I(N.B5, t + 0.1, 0.06, 0.3); },
  // «Раз, два, три»: тихі удари, третій вищий
  tick: (t, I) => I(N.A5, t, 0.12, 0.3),
  tock: (t, I) => I(N.D6, t, 0.14, 0.4),
  // Руки відкрились
  reveal: (t, I) => { noise(t, 0.09, 900, 2600, { v: 0.09 }); I(N.F6, t + 0.02, 0.14, 0.5); },
  // Перемога: арпеджіо, дзвіночок і зорепад іскор
  win: (t, I) => {
    [N.D5, N.F5, N.A5, N.D6, N.F6, N.A6].forEach((f, i) => I(f, t + i * 0.075, 0.17, 1.1));
    bell(N.D7, t + 0.5, 0.1, 2);
    [N.E7, N.A6, N.F7, N.B6].forEach((f, i) => bell(f, t + 0.62 + i * 0.11, 0.035, 0.8));
  },
  // Програш: лагідне «ну от» — чотири ноти донизу, тихо
  lose: (t, I) => [N.A5, N.F5, N.E5, N.D5].forEach((f, i) => I(f, t + i * 0.16, 0.12, 0.6)),
  // Нічия: туди-сюди
  draw: (t, I) => { I(N.D6, t, 0.14); I(N.A5, t + 0.14, 0.14); I(N.D6, t + 0.28, 0.14); },
  // Морський бій: постріл летить (свист), сплеск, влучання (бум), потопив (бульки донизу), записка (дзвіночки)
  shot: (t) => noise(t, 0.4, 3200, 800, { v: 0.045, q: 9 }),
  splash: (t, I) => { noise(t, 0.45, 1400, 500, { v: 0.2, q: 0.7, type: 'lowpass', attack: 0.005 }); I(N.D6, t + 0.05, 0.05, 0.3); },
  hit: (t) => { thump(t, 160, 45, 0.35, 0.55); noise(t, 0.22, 2000, 400, { v: 0.16, q: 0.6, type: 'lowpass', attack: 0.002 }); },
  sunk: (t) => { thump(t, 120, 40, 0.5, 0.45); [N.B5, N.A5, N.F5, N.E5, N.D5].forEach((f, i) => osc('sine', f * 0.5, t + 0.2 + i * 0.12, 0.09, 0.18, { to: f * 0.45 })); },
  note: (t) => { bell(N.A6, t, 0.08); bell(N.D7, t + 0.12, 0.07); bell(N.F7, t + 0.24, 0.05); },
  // Реакція: бульбашка лопнула
  react: (t) => osc('sine', 620, t, 0.16, 0.08, { to: 1500, attack: 0.003 }),
  // Сердечка: три іскри вгорі
  love: (t) => [N.F6, N.A6, N.D7].forEach((f, i) => bell(f, t + i * 0.09, 0.06, 0.9)),
  // Конверт відкрили: папір і нотка
  open: (t, I) => { noise(t, 0.28, 400, 1900, { v: 0.07, q: 0.8 }); I(N.F6, t + 0.2, 0.1, 0.7); },
  // Дзвіночок: три удари (вхідний) — і один тихий, коли кличеш сам
  bell: (t) => [0, 0.32, 0.64].forEach((d) => { osc('sine', 1320, t + d, 0.28, 1.4, { attack: 0.01 }); osc('sine', 2640, t + d, 0.1, 0.8); osc('sine', 3960, t + d, 0.05, 0.5); }),
  ring: (t) => { osc('sine', 1320, t, 0.14, 1.1, { attack: 0.01 }); osc('sine', 2640, t, 0.05, 0.6); },
};
export const SOUND_NAMES = Object.keys(SOUNDS);

function play(name, delay, instrument) {
  if (!soundOn() || document.visibilityState !== 'visible' || !SOUNDS[name]) return;
  try {
    if (!audio()) return;
    SOUNDS[name](ctx.currentTime + 0.02 + delay / 1000, VOICES[known(instrument)]);
  } catch { /* без звуку — не біда */ }
}

// sfx('pair') — зіграти; delay — у мс (щоб звук ліг на анімацію); from — 'them', коли це прийшло від другого
// (звучить його інструментом). Без дотику, у фоні чи вимкнено — тиша
export function sfx(name, delay = 0, from = 'me') {
  play(name, delay, (from === 'them') !== swapped ? theirs : myInstrument());
}
// «Играть за двоих» (Отладка): поки граю за неї, «моє» — її ходи, тож інструменти міняються місцями
let swapped = false;
export function swapInstruments(on) { swapped = !!on; }
// Будь-який звук заданим інструментом — для «Отладки», свій вибір не міняє
export const playAs = (name, instrument) => play(name, 0, instrument);
// Послухати інструмент у налаштуваннях: «твій хід» і пара
export function preview(instrument) {
  play('turn', 0, instrument);
  play('pair', 900, instrument);
}
