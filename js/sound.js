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
  chip: { name: '8-бит', on: 'в стиле 8-бит' },
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
// Флейта. Тон — сильна основна й слабкі 2-й та 3-й обертони (без металу); навколо ноти весь час шумить струмінь
// повітря, забарвлений самою нотою. Вступ — «чифф»: язик робить «ту», на мить проскакує октава вище.
// Вібрато — диханням: хитається переважно гучність, висота ледь-ледь. Видих скінчився — нота обривається швидко
let fluteWave = null;
function flute(f, t, v = 0.22, len = 0.9) {
  const a = 0.05;
  const hold = Math.min(len * 0.42, 0.36);
  const rel = 0.13;
  const end = t + a + hold + rel;
  const peak = v * 0.46;
  // Одна обвідна видиху — на тон і на повітря
  const breathEnv = (g, k) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak * k, t + a);
    g.gain.linearRampToValueAtTime(peak * k * 0.88, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  };
  const g = ctx.createGain();
  breathEnv(g, 1);
  // Вібрато диханням: гучність ±12 %, розгойдується не одразу
  const trem = ctx.createGain();
  trem.gain.value = 1;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 4.9;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.setValueAtTime(0, t + a + 0.08);
  depth.gain.linearRampToValueAtTime(0.12, t + a + 0.3);
  lfo.connect(depth).connect(trem.gain);
  lfo.start(t);
  lfo.stop(end + 0.03);
  g.connect(trem).connect(out);
  fluteWave ||= ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.28, 0.09, 0.03]));
  const o = ctx.createOscillator();
  o.setPeriodicWave(fluteWave);
  o.frequency.setValueAtTime(f, t);
  o.connect(g);
  vibrato([o.frequency], t, end, 4.9, f * 0.0025, a + 0.08);
  o.start(t);
  o.stop(end + 0.03);
  // Повітря: шум у вузькій смузі навколо ноти, всю ноту, і ширший тихий подих зверху
  [[f, 7, 0.16], [Math.min(f * 3, 7000), 0.9, 0.05]].forEach(([fc, q, k]) => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = fc;
    bp.Q.value = q;
    const ng = ctx.createGain();
    breathEnv(ng, k);
    s.connect(bp).connect(ng).connect(trem);
    s.start(t, Math.random() * 0.5);
    s.stop(end + 0.03);
  });
  // «Чифф»: коротке «ту» — сплеск шуму й октава вище, що тут же гасне
  noise(t, 0.045, Math.min(f * 2.5, 7000), Math.min(f * 2, 6000), { v: v * 0.22, q: 2, attack: 0.003 });
  osc('sine', f * 2, t, v * 0.12, 0.05, { attack: 0.005 });
}
// Смичок. Струна під смичком дає «пилку» (рух Гельмгольца), а голос інструменту робить дерев'яний корпус:
// кілька резонансів підсилюють свої смуги, верх зрізаний — без «електронного» дзижчання.
// Три голоси з ледь різним строєм і вібрато (у живого виконавця воно ніколи не рівне), фільтр «розкривається»
// разом із натиском смичка, нота нарощується плавно; поверх — тихий шерех каніфолі всю ноту і «закус» на вступі
function bowed(f, t, v, len, o) {
  const hold = Math.min(len * 0.45, 0.4);
  const end = t + o.attack + hold + o.rel;
  const peak = v * o.gain;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + o.attack);
  g.gain.linearRampToValueAtTime(peak * 0.82, t + o.attack + hold * 0.5);
  g.gain.setValueAtTime(peak * 0.82, t + o.attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  // Корпус: зріз верху → резонанси → полиця, що прибирає різкість
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.5;
  const cut = Math.min(f * o.cut, o.max);
  lp.frequency.setValueAtTime(Math.min(f * 1.6, cut), t);
  lp.frequency.exponentialRampToValueAtTime(cut, t + o.attack + 0.05);
  let tail = lp;
  for (const [freq, db, q] of o.body) {
    const pk = ctx.createBiquadFilter();
    pk.type = 'peaking';
    pk.frequency.value = freq;
    pk.gain.value = db;
    pk.Q.value = q;
    tail.connect(pk);
    tail = pk;
  }
  const shelf = ctx.createBiquadFilter();
  shelf.type = 'highshelf';
  shelf.frequency.value = o.shelf;
  shelf.gain.value = -9;
  tail.connect(shelf).connect(g).connect(out);
  [[-7, 0.97], [0, 1], [7, 1.04]].forEach(([cents, k], i) => {
    const s = ctx.createOscillator();
    s.type = 'sawtooth';
    s.detune.value = cents;
    // Під'їзд до ноти: ледь знизу, як палець ставиться на струну
    s.frequency.setValueAtTime(f * 0.988, t);
    s.frequency.exponentialRampToValueAtTime(f, t + o.attack * 0.8);
    const sg = ctx.createGain();
    sg.gain.value = i === 1 ? 0.5 : 0.35;
    s.connect(sg).connect(lp);
    vibrato([s.frequency], t, end, o.rate * k, f * o.depth, o.attack + 0.06);
    s.start(t);
    s.stop(end + 0.03);
  });
  // Каніфоль: тихий шерех у смузі над нотою всю ноту, і короткий «закус» волосу на самому вступі
  noise(t, end - t, f * 2.2, f * 1.8, { v: v * 0.035, q: 1.2, attack: o.attack });
  noise(t, 0.05, Math.min(f * 4, 6000), Math.min(f * 3, 4500), { v: v * 0.1, q: 2.5, attack: 0.004 });
}
// Скрипка: співуча, яскравий «спів» корпусу біля 2,8 кГц, швидше вібрато
const VIOLIN = { attack: 0.075, rel: 0.32, cut: 5, max: 6500, shelf: 5200, rate: 5.8, depth: 0.0065, gain: 0.58,
  body: [[290, 4, 1.8], [550, 3, 1.4], [2800, 5, 1.1]] };
// Віолончель: на октаву нижче, повільний смичок, тепла — резонанси нижче, верх темніший, вібрато ширше й повільніше
const CELLO = { attack: 0.11, rel: 0.42, cut: 4, max: 3800, shelf: 2600, rate: 5, depth: 0.008, gain: 0.62,
  body: [[220, 4, 1.4], [420, 4, 1.4], [1300, 3, 1]] };
const violin = (f, t, v = 0.22, len = 0.9) => bowed(f, t, v, len, VIOLIN);
const cello = (f, t, v = 0.22, len = 0.9) => bowed(f / 2, t, v, len, CELLO);
// Колокольчики: уся мелодія — скляними дзвіночками
const chimes = (f, t, v = 0.22, len = 0.9) => bell(f, t, v * 0.6, len * 1.3 + 0.3);
// 8-біт: звук старих приставок. Вузький прямокутний імпульс (25 %, як канал NES), перший кадр — октавою вище
// («піу»), гучність спадає сходинками по 1/30 с, без вібрато
let chipWave = null;
function chip(f, t, v = 0.22, len = 0.9) {
  if (!chipWave) {
    const n = 24;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 1; k < n; k += 1) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    chipWave = ctx.createPeriodicWave(re, im);
  }
  const L = Math.min(len * 0.55, 0.42) + 0.06;
  const steps = Math.max(2, Math.round(L * 30));
  const peak = v * 0.85;
  const o = ctx.createOscillator();
  o.setPeriodicWave(chipWave);
  o.frequency.setValueAtTime(f * 2, t);
  o.frequency.setValueAtTime(f, t + 1 / 60);
  const g = ctx.createGain();
  for (let i = 0; i <= steps; i += 1) g.gain.setValueAtTime(peak * (1 - i / steps) ** 1.5, t + i / 30);
  g.gain.setValueAtTime(0, t + (steps + 1) / 30);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + (steps + 1) / 30 + 0.02);
}
const VOICES = { kalimba: pluck, harp, flute, violin, cello, bells: chimes, chip };

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
