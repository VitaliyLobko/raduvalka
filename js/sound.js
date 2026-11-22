// Звуки Радовалки: синтез Web Audio, а для живих інструментів — ще й записи (вмикаються в «Отладке»; поки не
// завантажились чи нема мережі — грає синтез). Усі ноти з однієї пентатоніки ре-мажор, тож будь-які два звуки
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
  bass: { name: 'Контрабас', on: 'на контрабасе' },
  bells: { name: 'Колокольчики', on: 'на колокольчиках' },
  chip: { name: '8-бит', on: 'в стиле 8-бит' },
};
const INSTR = 'radovalka:instrument';
const known = (k) => (Object.hasOwn(INSTRUMENTS, k) ? k : 'kalimba');
export function myInstrument() { try { return known(localStorage.getItem(INSTR)); } catch { return 'kalimba'; } }
export function setMyInstrument(k) {
  try { localStorage.setItem(INSTR, known(k)); } catch { /* приватне вікно */ }
  if (samplesOn()) loadBank(known(k));
}
let theirs = 'kalimba';
export const partnerInstrument = () => theirs;
export function setPartnerInstrument(k) { theirs = known(k); if (samplesOn()) loadBank(theirs); }

// Ноти: D4 … F7 (пентатоніка D E F# A B)
const N = {
  D4: 293.66, A4: 440, B4: 493.88, D5: 587.33, E5: 659.25, F5: 739.99, A5: 880, B5: 987.77,
  D6: 1174.66, E6: 1318.51, F6: 1479.98, A6: 1760, B6: 1975.53, D7: 2349.32, E7: 2637.02, F7: 2959.96,
};

let ctx = null;
let out = null;
let dry = null;
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
  // Сухий вихід без відлуння: 8-біт і контрабас
  dry = ctx.createGain();
  dry.gain.value = 0.55;
  dry.connect(comp);
  comp.connect(ctx.destination);
  // Шум на секунду — один на всі шурхоти, сплески й подих флейти
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  if (samplesOn()) { loadBank(myInstrument()); loadBank(theirs); }
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
function noise(t, len, from, to, { v = 0.1, q = 1.2, type = 'bandpass', attack = 0.01, dest = out } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + len);
  const g = ctx.createGain();
  env(g, t, v, len, attack);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random() * 0.5);
  s.stop(t + len + 0.03);
}

// Калімба: дерев'яна й коротка — м'який удар великого пальця, відгук коробки, металевий язичок лише на
// самому вступі (обертон ×5.9 язичка-консолі), далі теплий основний тон швидко тане
function pluck(f, t, v = 0.22, len = 0.9) {
  const L = len * 0.7;
  osc('sine', f, t, v * 0.9, L, { attack: 0.002 });
  osc('triangle', f, t, v * 0.3, L * 0.45, { attack: 0.002 });
  osc('sine', f * 5.9, t, v * 0.1, 0.045, { attack: 0.001 });
  // Коробка відгукується: глухий «тук» донизу і короткий шерех пальця
  osc('sine', 240, t, v * 0.35, 0.07, { to: 120, attack: 0.002 });
  noise(t, 0.025, 1400, 700, { v: v * 0.18, q: 0.9, attack: 0.001 });
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
// Колокольчики: справжні дзвони — обертони дзвона (гул ×0.5, мала терція ×1.2, квінта ×1.5, «номінал» ×2),
// за терцією вухо й упізнає дзвін. Кожен обертон — двома ледь розстроєними тонами: дзвін «тремтить», довго гуде
const BELL_PARTIALS = [[0.5, 0.35, 1.6], [1, 1, 1.2], [1.2, 0.4, 0.8], [1.5, 0.25, 0.6], [2, 0.3, 0.5], [3, 0.1, 0.25]];
function chimes(f, t, v = 0.22, len = 0.9) {
  const L = len * 1.4 + 0.6;
  for (const [k, amp, life] of BELL_PARTIALS) {
    osc('sine', f * k, t, v * 0.32 * amp, L * life, { attack: 0.001 });
    osc('sine', f * k + 2.5, t, v * 0.22 * amp, L * life * 0.9, { attack: 0.001 });
  }
  // Удар язичка: короткий яскравий дзень
  noise(t, 0.02, Math.min(f * 4, 8000), Math.min(f * 3, 7000), { v: v * 0.12, q: 3, attack: 0.001 });
}
// Контрабас: джазовий щипок на дві октави нижче. Телефон низу майже не грає, тож сильні 2-й і 3-й обертони —
// за ними вухо саме «добудовує» низ. Удар пальця, фільтр, що швидко закривається (гуде й тане), ледь униз висотою
function bass(f, t, v = 0.22, len = 0.9) {
  const F = f / 4;
  const L = Math.min(len * 0.9, 0.8) + 0.25;
  const g = ctx.createGain();
  env(g, t, v * 0.9, L, 0.004);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(Math.min(F * 9, 3000), t);
  lp.frequency.exponentialRampToValueAtTime(F * 3, t + 0.25);
  lp.connect(g).connect(out);
  const s = ctx.createOscillator();
  s.type = 'sawtooth';
  s.frequency.setValueAtTime(F * 1.01, t);
  s.frequency.exponentialRampToValueAtTime(F, t + 0.08);
  s.connect(lp);
  s.start(t);
  s.stop(t + L + 0.03);
  osc('sine', F, t, v * 0.5, L, { attack: 0.004 });
  osc('sine', F * 2, t, v * 0.3, L * 0.6, { attack: 0.004 });
  // Палець по струні: глухий удар і шерех
  osc('sine', 150, t, v * 0.4, 0.06, { to: 70, attack: 0.002 });
  noise(t, 0.035, 900, 400, { v: v * 0.2, q: 0.8, attack: 0.001 });
}
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
  o.connect(g).connect(dry);
  o.start(t);
  o.stop(t + (steps + 1) / 30 + 0.02);
}
const VOICES = { kalimba: pluck, harp, flute, violin, cello, bass, bells: chimes, chip };

// Записи живих інструментів (FluidR3 GM, CC BY 3.0 — sounds/CREDITS.md) поруч із синтезом: перемикач у «Отладке».
// По 4 опорні ноти (E, A, D, G♭ — між ними не більше 3 півтонів), решта — зсувом швидкості найближчої.
// oct — регістр інструмента відносно мелодії; len — у скільки разів нота довша за синтезну, min/max — межі в с;
// gain — вирівнювання гучності з рештою
const SAMPLED = {
  kalimba: { oct: 0, len: 1.2, min: 0.35, max: 1.4, gain: 1.1 },
  harp: { oct: 0, len: 1.5, min: 0.7, max: 1.8, gain: 1.1 },
  flute: { oct: 0, len: 0.8, min: 0.45, max: 0.9, gain: 1.1 },
  violin: { oct: 0, len: 0.8, min: 0.45, max: 0.9, gain: 1.4 },
  cello: { oct: -1, len: 0.9, min: 0.5, max: 1, gain: 1.7 },
  bass: { oct: -3, len: 1, min: 0.4, max: 1.1, gain: 1.4, dry: true },
  bells: { oct: 1, len: 1.6, min: 0.6, max: 2, gain: 0.8 },
};
const ANCHORS = [['E', 5, 659.25], ['A', 5, 880], ['D', 6, 1174.66], ['Gb', 6, 1479.98]];
const SAMPLED_KEY = 'radovalka:sampled';
export function samplesOn() { try { return localStorage.getItem(SAMPLED_KEY) === '1'; } catch { return false; } }
export function setSamples(on) {
  try { if (on) localStorage.setItem(SAMPLED_KEY, '1'); else localStorage.removeItem(SAMPLED_KEY); } catch { /* приватне вікно */ }
  if (on && ctx) { loadBank(myInstrument()); loadBank(theirs); }
}
export const hasSamples = (k) => Object.hasOwn(SAMPLED, k);
// Файли не змінюються (нова запис — нова назва), тож лежать у власному кеші: другий раз — без мережі
const SND_CACHE = 'snd-radovalka';
async function sampleBytes(url) {
  const cache = self.caches ? await caches.open(SND_CACHE).catch(() => null) : null;
  const hit = await cache?.match(url).catch(() => null);
  if (hit) return hit.arrayBuffer();
  const r = await fetch(url);
  if (!r.ok) throw new Error(`sample ${r.status}`);
  cache?.put(url, r.clone()).catch(() => {});
  return r.arrayBuffer();
}
// MP3 починається з тиші кодувальника — зрізаємо до першого звуку, щоб нота не запізнювалась за анімацією
function trimmed(buf) {
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i += 1) peak = Math.max(peak, Math.abs(d[i]));
  let s = 0;
  while (s < d.length && Math.abs(d[s]) < peak * 0.02) s += 1;
  const cut = ctx.createBuffer(buf.numberOfChannels, Math.max(1, d.length - s), buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c += 1) cut.copyToChannel(buf.getChannelData(c).subarray(s), c);
  return { buf: cut, norm: peak ? 1 / peak : 1 };
}
// k → null (вантажиться) | [{ f, buf, norm }]
const bank = new Map();
function loadBank(k) {
  if (!SAMPLED[k] || bank.has(k) || !ctx) return;
  bank.set(k, null);
  const o = SAMPLED[k].oct;
  Promise.all(ANCHORS.map(async ([n, octave, f]) => {
    const url = new URL(`../sounds/${k}/${n}${octave + o}.mp3`, import.meta.url).href;
    const decoded = await ctx.decodeAudioData(await sampleBytes(url));
    return { f: f * 2 ** o, ...trimmed(decoded) };
  })).then((list) => bank.set(k, list), () => bank.delete(k));
}
export const samplesReady = (k) => !!bank.get(k);
function sampleVoice(k, list) {
  const p = SAMPLED[k];
  return (f, t, v = 0.22, len = 0.9) => {
    const F = f * 2 ** p.oct;
    const a = list.reduce((best, x) => (Math.abs(Math.log(F / x.f)) < Math.abs(Math.log(F / best.f)) ? x : best));
    const L = Math.min(p.max, Math.max(p.min, len * p.len));
    const rel = Math.min(0.25, L * 0.4);
    const s = ctx.createBufferSource();
    s.buffer = a.buf;
    s.playbackRate.value = F / a.f;
    const g = ctx.createGain();
    const peak = v * p.gain * a.norm;
    g.gain.setValueAtTime(peak, t);
    g.gain.setValueAtTime(peak, t + L - rel);
    g.gain.exponentialRampToValueAtTime(0.0001, t + L);
    s.connect(g).connect(p.dry ? dry : out);
    s.start(t);
    s.stop(t + L + 0.02);
  };
}
// Голос інструмента: запис, якщо ввімкнено й уже завантажено, інакше — синтез (і запис тим часом вантажиться)
function voiceOf(k) {
  if (samplesOn() && SAMPLED[k]) {
    const list = bank.get(k);
    if (list) return sampleVoice(k, list);
    loadBank(k);
  }
  return VOICES[k];
}
// Без скляних іскор зверху: низьким і 8-біту вони чужі
const NO_SPARKLE = new Set(['cello', 'bass', 'chip']);
const quiet = () => {};

// 8-біт живе своєю мовою: замість паперу й дерева — шумовий канал, замість акордів — швидкі арпеджіо,
// «монетка» з двох нот, ковзання висоти; усе сухе, без відлуння
const blip = (f, t, len, v = 0.15) => chip(f, t, v, len / 0.55);
const hiss = (t, len, v = 0.09) => noise(t, len, 7000, 3000, { v, q: 0.5, type: 'highpass', attack: 0.002, dest: dry });
function slide(f0, f1, t, len, v = 0.12) {
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + len);
  const g = ctx.createGain();
  const steps = Math.max(2, Math.round(len * 30));
  for (let i = 0; i <= steps; i += 1) g.gain.setValueAtTime(v * (1 - (i / steps) * 0.7), t + (i * len) / steps);
  g.gain.setValueAtTime(0, t + len);
  o.connect(g).connect(dry);
  o.start(t);
  o.stop(t + len + 0.02);
}
const arp = (fs, t, step, len, v) => fs.forEach((f, i) => blip(f, t + i * step, len, v));
const CHIP_SOUNDS = {
  letter: (t) => { blip(N.B5, t, 0.07); blip(N.E6, t + 0.07, 0.4); },
  sent: (t) => { slide(N.D5, N.D6, t, 0.12, 0.1); blip(N.A6, t + 0.12, 0.12, 0.1); },
  turn: (t) => { blip(N.F6, t, 0.1); blip(N.D6, t + 0.13, 0.3); },
  flip: (t) => { hiss(t, 0.04); blip(N.E6, t + 0.01, 0.05, 0.08); },
  pair: (t) => { arp([N.D6, N.F6, N.A6, N.D7], t, 1 / 30, 0.06, 0.13); blip(N.D7, t + 0.14, 0.3, 0.12); },
  miss: (t) => slide(N.B5, N.F5 * 0.8, t, 0.28, 0.11),
  place: (t) => { hiss(t, 0.03, 0.07); blip(N.A5, t, 0.08, 0.12); },
  drop: (t) => { slide(1400, 500, t, 0.17, 0.06); hiss(t + 0.17, 0.05, 0.1); blip(N.D5, t + 0.17, 0.08, 0.12); },
  line: (t) => { hiss(t, 0.08, 0.06); blip(N.B5, t + 0.07, 0.06, 0.1); },
  tick: (t) => blip(N.A5, t, 0.06, 0.12),
  tock: (t) => blip(N.D6, t, 0.12, 0.14),
  reveal: (t) => { hiss(t, 0.05); arp([N.D6, N.F6], t, 1 / 30, 0.05, 0.12); },
  win: (t) => {
    arp([N.D5, N.F5, N.A5, N.D6, N.F6, N.A6], t, 0.06, 0.07, 0.14);
    // Довга нота-«фанфара» з тремтінням: перемикання D7/A6 щокадру
    for (let i = 0; i < 12; i += 1) blip(i % 2 ? N.A6 : N.D7, t + 0.38 + i / 30, 1 / 30, 0.12 * (1 - i / 16));
  },
  lose: (t) => { arp([N.A5, N.F5, N.E5], t, 0.14, 0.1, 0.12); slide(N.D5, N.D4, t + 0.42, 0.45, 0.11); },
  draw: (t) => arp([N.D6, N.A5, N.D6], t, 0.12, 0.08, 0.12),
  splash: (t) => { noise(t, 0.25, 3000, 800, { v: 0.12, q: 0.6, type: 'lowpass', attack: 0.002, dest: dry }); blip(N.D6, t + 0.05, 0.05, 0.06); },
  open: (t) => { hiss(t, 0.12, 0.05); blip(N.F6, t + 0.12, 0.2, 0.1); },
};

// Глухий удар з падінням висоти: дерев'яна фішка, падіння, вибух
const thump = (t, f0, f1, len, v) => osc('sine', f0, t, v, len, { to: f1, attack: 0.002 });

// I(f, t, v, len) — нота інструментом; B — іскри-дзвіночки зверху (у низьких і 8-біту — тиша)
const SOUNDS = {
  // Лист прийшов: три ноти вгору і дзвіночок
  letter: (t, I, B) => { I(N.A5, t); I(N.D6, t + 0.1); I(N.F6, t + 0.2); B(N.A6, t + 0.34, 0.07); },
  // Пішов: шурх угору й крапка
  sent: (t, I) => { noise(t, 0.24, 700, 3600, { v: 0.07, q: 0.9 }); I(N.D6, t + 0.16, 0.1, 0.5); },
  // Твій хід: дінь-дон
  turn: (t, I) => { I(N.F6, t, 0.16, 1.1); I(N.D6, t + 0.2, 0.16, 1.3); },
  // Карточка перевертається: клац картону
  flip: (t, I) => { noise(t, 0.07, 1800, 4200, { v: 0.12, q: 1.5, attack: 0.002 }); I(N.E6, t + 0.02, 0.05, 0.25); },
  // Пара: три ноти вгору й іскра
  pair: (t, I, B) => { I(N.D6, t, 0.18); I(N.F6, t + 0.07, 0.18); I(N.A6, t + 0.14, 0.18); B(N.D7, t + 0.24, 0.07); },
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
  win: (t, I, B) => {
    [N.D5, N.F5, N.A5, N.D6, N.F6, N.A6].forEach((f, i) => I(f, t + i * 0.075, 0.17, 1.1));
    B(N.D7, t + 0.5, 0.1, 2);
    [N.E7, N.A6, N.F7, N.B6].forEach((f, i) => B(f, t + 0.62 + i * 0.11, 0.035, 0.8));
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
    const k = known(instrument);
    const t = ctx.currentTime + 0.02 + delay / 1000;
    const fn = (k === 'chip' && CHIP_SOUNDS[name]) || SOUNDS[name];
    fn(t, voiceOf(k), NO_SPARKLE.has(k) ? quiet : bell);
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
