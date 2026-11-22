// Звуки Радовалки. Мелодію грає справжній інструмент — записи FluidR3 GM (CC BY 3.0, sounds/CREDITS.md);
// шурхоти, стуки, сплески й іскри-дзвіночки — синтез Web Audio, однакові для всіх.
// Усі ноти з однієї пентатоніки ре-мажор, тож будь-які два звуки поспіль звучать разом. Тихо, з легким відлунням.
// Кожен обирає свій інструмент у «О Радовалке». Моє (відправила, сходила) — моїм інструментом,
// те, що прийшло від другого (лист, його хід), — його.
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
};
// Поки ніхто не обирав: у нього контрабас, у неї дзвіночки
export const DEFAULT_INSTRUMENT = { vin: 'bass', vona: 'bells' };
const INSTR = 'radovalka:instrument';
const known = (k) => (Object.hasOwn(INSTRUMENTS, k) ? k : 'kalimba');
export function myInstrument() { try { return known(localStorage.getItem(INSTR)); } catch { return 'kalimba'; } }
export function setMyInstrument(k) {
  try { localStorage.setItem(INSTR, known(k)); } catch { /* приватне вікно */ }
  loadBank(known(k));
}
let theirs = 'kalimba';
export const partnerInstrument = () => theirs;
export function setPartnerInstrument(k) { theirs = known(k); loadBank(theirs); }

// Ноти: D4 … F7 (пентатоніка D E F# A B)
const N = {
  D4: 293.66, A4: 440, B4: 493.88, D5: 587.33, E5: 659.25, F5: 739.99, A5: 880, B5: 987.77,
  D6: 1174.66, E6: 1318.51, F6: 1479.98, A6: 1760, B6: 1975.53, D7: 2349.32, E7: 2637.02, F7: 2959.96, A7: 3520,
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
  // Майстер → компресор (щоб акорди не хрипіли) → вихід; паралельно — коротке відлуння
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
  // Сухий вихід без відлуння: контрабас (у низу відлуння лише каламутить)
  dry = ctx.createGain();
  dry.gain.value = 0.55;
  dry.connect(comp);
  comp.connect(ctx.destination);
  // Шум на секунду — один на всі шурхоти й сплески
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  loadBank(myInstrument());
  loadBank(theirs);
  loadFx();
  return ctx;
}
// Перший дотик — будимо звук заздалегідь (і тягнемо записи), щоб перший сигнал не запізнився
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
// Шум через смугу, що їде від from до to: шурхіт, сплеск, рисочка олівцем
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

// Запасна калімба (синтез) — лише поки записи ще вантажаться при першому запуску
function pluck(f, t, v = 0.22, len = 0.9) {
  const L = len * 0.7;
  osc('sine', f, t, v * 0.9, L, { attack: 0.002 });
  osc('triangle', f, t, v * 0.3, L * 0.45, { attack: 0.002 });
  osc('sine', f * 5.9, t, v * 0.1, 0.045, { attack: 0.001 });
  osc('sine', 240, t, v * 0.35, 0.07, { to: 120, attack: 0.002 });
}
// Скляний дзвіночок: негармонічні обертони, довгий хвіст
function bell(f, t, v = 0.12, len = 1.6) {
  osc('sine', f, t, v, len);
  osc('sine', f * 2.76, t, v * 0.35, len * 0.5);
  osc('sine', f * 5.4, t, v * 0.12, len * 0.25);
}

// Записи: по 4 опорні ноти (E, A, D, G♭ — між ними не більше 3 півтонів), решта — зсувом швидкості найближчої.
// oct — регістр інструмента відносно мелодії; len — у скільки разів нота довша за задану, min/max — межі в с;
// gain — вирівнювання гучності з рештою
const SAMPLED = {
  kalimba: { oct: 0, len: 1.2, min: 0.35, max: 1.4, gain: 1.1 },
  harp: { oct: 0, len: 1.5, min: 0.7, max: 1.8, gain: 2 },
  flute: { oct: 0, len: 0.8, min: 0.45, max: 0.9, gain: 0.6 },
  violin: { oct: 0, len: 0.8, min: 0.45, max: 0.9, gain: 1.4 },
  cello: { oct: -1, len: 0.9, min: 0.5, max: 1, gain: 1.45 },
  bass: { oct: -3, len: 1, min: 0.4, max: 1.1, gain: 1.4, dry: true },
  bells: { oct: 1, len: 1.6, min: 0.6, max: 2, gain: 0.8 },
};
const ANCHORS = [['E', 5, 659.25], ['A', 5, 880], ['D', 6, 1174.66], ['Gb', 6, 1479.98]];
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
// k → null (вантажиться) | [{ f, buf, norm }]; loading — k → Promise, поки записи в дорозі
const bank = new Map();
const loading = new Map();
function loadBank(k, again = false) {
  if (!SAMPLED[k] || bank.has(k) || !ctx) return;
  bank.set(k, null);
  const o = SAMPLED[k].oct;
  const p = Promise.all(ANCHORS.map(async ([n, octave, f]) => {
    const url = new URL(`../sounds/${k}/${n}${octave + o}.mp3`, import.meta.url).href;
    const decoded = await ctx.decodeAudioData(await sampleBytes(url));
    return { f: f * 2 ** o, ...trimmed(decoded) };
  })).then((list) => { bank.set(k, list); loading.delete(k); }, (e) => {
    // Збій мережі — ще одна спроба за 2 с; далі — при наступному звуці
    bank.delete(k);
    loading.delete(k);
    if (!again) setTimeout(() => loadBank(k, true), 2000);
    throw e;
  });
  p.catch(() => {});
  loading.set(k, p);
}
// Скільки чекати записи інструмента для звуку, що вже попросили: довше — звук уже не до місця, пропускаємо
const WAIT_SAMPLES_MS = 1500;
export const samplesReady = (k) => !!bank.get(k);

// Шуми — записи Kenney (CC0, sounds/fx): папір, картон, дерево, удари. Ім'я → null (вантажиться) | { buf, norm }
const FX = ['envelope-open', 'envelope-send', 'card-flip', 'wood-knock', 'chip-clack', 'pen-line', 'punch', 'metal-crash',
  'bloop', 'paper-rustle', 'cloth', 'reel-tick', 'cookie-crack', 'paper-slip'];
const fx = new Map();
function loadFx() {
  for (const n of FX) {
    if (fx.has(n)) continue;
    fx.set(n, null);
    const url = new URL(`../sounds/fx/${n}.ogg`, import.meta.url).href;
    sampleBytes(url).then((b) => ctx.decodeAudioData(b)).then((d) => fx.set(n, trimmed(d)), () => fx.delete(n));
  }
}
export const fxReady = () => FX.every((n) => fx.get(n));
// Зіграти запис-шум (пік v, висота ледь гуляє — щоб повтори не були однаковими); false — нема, грає синтез
function rec(n, t, v) {
  const r = fx.get(n);
  if (!r) { if (!fx.has(n)) loadFx(); return false; }
  const s = ctx.createBufferSource();
  s.buffer = r.buf;
  s.playbackRate.value = 0.96 + Math.random() * 0.08;
  const g = ctx.createGain();
  g.gain.value = v * r.norm;
  s.connect(g).connect(out);
  s.start(t);
  return true;
}
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
// Живе виконання: ледь нерівний час (±6 мс) і сила (±8 %), щоб запис не звучав як машина
const human = (I) => (f, t, v = 0.22, len = 0.9) => I(f, Math.max(t, ctx.currentTime) + (Math.random() - 0.5) * 0.012, v * (0.92 + Math.random() * 0.16), len);
// Голос інструмента: запис; поки не завантажився — запасна калімба (а запис тим часом вантажиться)
function voiceOf(k) {
  const list = bank.get(k);
  if (list) return human(sampleVoice(k, list));
  loadBank(k);
  return pluck;
}
// Без скляних іскор зверху: низьким вони чужі
const NO_SPARKLE = new Set(['cello', 'bass']);
const quiet = () => {};

// Глухий удар з падінням висоти: дерев'яна фішка, падіння, вибух
const thump = (t, f0, f1, len, v) => osc('sine', f0, t, v, len, { to: f1, attack: 0.002 });

// Барабан: моменти, коли рядок проїхав, — та сама крива, що в анімації plans.js: cubic-bezier(.12, .78, .18, 1).
// Частіше ніж раз на 45 мс вухо клаці не розрізняє — такі злипаються в один
let spinRows = 35;
let spinMs = 3200;
function spinTicks(t, tick) {
  const bz = (a, b, s) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  let last = -1;
  for (let k = 1, s = 0; k <= spinRows; k += 1) {
    while (s < 1 && bz(0.78, 1, s) < k / spinRows) s += 0.002;
    const ms = bz(0.12, 0.18, s) * spinMs;
    if (ms - last >= 45) { tick(t + ms / 1000); last = ms; }
  }
}

// I(f, t, v, len) — нота інструментом; B — іскри-дзвіночки зверху (у низьких — тиша).
// Фрази мають ритм і наголос: легкі підходи, довга нота-приземлення
const SOUNDS = {
  // Лист прийшов: «напевчик» — угору, вище й лагідно сідає на третю, довшу
  letter: (t, I) => { I(N.D6, t, 0.12, 0.3); I(N.A6, t + 0.12, 0.12, 0.3); I(N.F6, t + 0.24, 0.15, 0.9); },
  // Пішов: «пірʼїнка» — легкий шурх угору й одна тиха нотка
  sent: (t, I) => { noise(t, 0.16, 1200, 4800, { v: 0.05, q: 0.7 }); I(N.A6, t + 0.05, 0.07, 0.3); },
  // Твій хід: «тук-тук» у двері й нотка
  turn: (t, I) => {
    rec('wood-knock', t, 0.26) || thump(t, 520, 240, 0.09, 0.3);
    rec('wood-knock', t + 0.16, 0.2) || thump(t + 0.16, 520, 240, 0.09, 0.24);
    I(N.A5, t + 0.32, 0.08, 0.5);
  },
  // Карточка перевертається: тихий клац картону
  flip: (t) => rec('card-flip', t, 0.08) || noise(t, 0.07, 1800, 4200, { v: 0.08, q: 1.5, attack: 0.002 }),
  // Пара: коротке «та-дам»
  pair: (t, I) => { I(N.A5, t, 0.12, 0.25); I(N.D6, t + 0.11, 0.17, 0.9); },
  // Не пара: мʼяко вниз, дві ноти
  miss: (t, I) => { I(N.A5, t, 0.1, 0.25); I(N.F5, t + 0.13, 0.11, 0.5); },
  // Хрестик/нулик: дерев'яний тук і нотка
  place: (t, I) => { rec('wood-knock', t, 0.4) || thump(t, 520, 240, 0.09, 0.32); I(N.A5, t + 0.01, 0.1, 0.4); },
  // Фішка «Четыре в ряд»: стук об дно й тиха нотка (без свисту падіння)
  drop: (t, I) => { rec('chip-clack', t, 0.6) || thump(t, 380, 150, 0.12, 0.4); I(N.D5, t, 0.07, 0.3); },
  // Рисочка: тихе клацання
  line: (t) => noise(t, 0.035, 3000, 5200, { v: 0.08, q: 3, attack: 0.001 }),
  // «Раз, два, три»: тихі удари, третій вищий
  tick: (t, I) => I(N.A5, t, 0.12, 0.3),
  tock: (t, I) => I(N.D6, t, 0.14, 0.4),
  // Руки відкрились: хлоп
  reveal: (t) => noise(t, 0.06, 900, 400, { v: 0.2, q: 0.6, type: 'lowpass', attack: 0.002 }),
  // Перемога: його фанфара (~6 с) — швидкий вступ угору, урочиста мелодія, переможний хід донизу,
  // гучний фінальний акорд і зоряний фінал
  win: (t, I, B) => {
    // 1. Швидкий фанфарний вступ
    I(N.D5, t,        0.17, 0.22);
    I(N.F5, t + 0.09, 0.18, 0.22);
    I(N.A5, t + 0.18, 0.19, 0.30);
    I(N.D6, t + 0.30, 0.21, 0.65);

    // 2. Урочиста мелодія
    I(N.A5, t + 0.79, 0.17, 0.25);
    I(N.B5, t + 1.04, 0.18, 0.25);
    I(N.D6, t + 1.29, 0.20, 0.40);
    I(N.F6, t + 1.69, 0.21, 0.75);

    // 3. Переможний хід
    I(N.E6, t + 2.49, 0.17, 0.25);
    I(N.D6, t + 2.74, 0.18, 0.25);
    I(N.B5, t + 2.99, 0.19, 0.30);
    I(N.A5, t + 3.29, 0.20, 0.65);

    // 4. Фінальний акорд
    I(N.D6, t + 4.04, 0.26, 1.8);
    I(N.F6, t + 4.04, 0.24, 1.8);
    I(N.A6, t + 4.04, 0.23, 1.8);
    I(N.D5, t + 4.04, 0.21, 1.8);

    // 5. Зоряний фінал
    [N.D7, N.F7, N.A7, N.D7, N.A6].forEach((f, i) => B(f, t + 4.24 + i * 0.13, 0.055, 0.7));
  },
  // Програш: «ну, нічого» — донизу, зависає й лагідно сідає на тоніку: втішно, не сумно
  lose: (t, I) => { I(N.A5, t, 0.12, 0.3); I(N.F5, t + 0.18, 0.12, 0.3); I(N.E5, t + 0.36, 0.12, 0.6); I(N.D5, t + 0.66, 0.13, 1.1); },
  // Нічия: туди-сюди
  draw: (t, I) => { I(N.D6, t, 0.14, 0.3); I(N.A5, t + 0.14, 0.13, 0.3); I(N.D6, t + 0.28, 0.15, 0.7); },
  // Морський бій: постріл летить (свист), сплеск, влучання (бум), потопив (бульки донизу), записка (дзвіночки)
  shot: (t) => noise(t, 0.4, 3200, 800, { v: 0.045, q: 9 }),
  // Мимо: три краплі
  splash: (t) => [0, 0.09, 0.2].forEach((d, i) => osc('sine', 900 - i * 120, t + d, 0.07, 0.07, { to: 1500 - i * 150, attack: 0.002 })),
  hit: (t) => { thump(t, 120, 38, 0.45, 0.5); noise(t, 0.5, 900, 120, { v: 0.22, q: 0.5, type: 'lowpass', attack: 0.002 }); },
  // Потопив: буль-буль донизу
  sunk: (t) => [0, 0.12, 0.22, 0.34, 0.44].forEach((d, i) => osc('sine', 500 - i * 40, t + d, 0.07, 0.09, { to: 260 - i * 20, attack: 0.002 })),
  note: (t) => { rec('paper-rustle', t, 0.25); bell(N.A6, t + 0.08, 0.08); bell(N.D7, t + 0.2, 0.07); bell(N.F7, t + 0.32, 0.05); },
  // Реакція: тихе клацання — чути щоразу, але не набридає
  react: (t) => noise(t, 0.035, 3000, 5200, { v: 0.09, q: 3, attack: 0.001 }),
  // Сердечка: «тук-тук» серця й тиха нотка
  love: (t, I) => { thump(t, 95, 60, 0.12, 0.32); thump(t + 0.18, 95, 60, 0.14, 0.26); I(N.D6, t + 0.42, 0.08, 0.6); },
  // Конверт відкрили: лише шурхіт паперу
  open: (t) => rec('envelope-open', t, 0.3) || noise(t, 0.28, 400, 1900, { v: 0.07, q: 0.8 }),
  // Дзвіночок: три удари (вхідний) — і один тихий, коли кличеш сам
  bell: (t) => [0, 0.32, 0.64].forEach((d) => { osc('sine', 1320, t + d, 0.28, 1.4, { attack: 0.01 }); osc('sine', 2640, t + d, 0.1, 0.8); osc('sine', 3960, t + d, 0.05, 0.5); }),
  ring: (t) => { osc('sine', 1320, t, 0.14, 1.1, { attack: 0.01 }); osc('sine', 2640, t, 0.05, 0.6); },
  // Печенька з'явилась: тихе «дзинь-дзинь»; золота — мерехтіння з чотирьох іскор угору
  cookieIn: (t) => { bell(N.A6, t, 0.06, 1); bell(N.D7, t + 0.13, 0.05, 1.2); },
  goldIn: (t) => [N.D7, N.F7, N.A6, N.E7].forEach((f, i) => bell(f, t + i * 0.1, 0.05, 1.3)),
  // Розломили: хрусь, папірець вислизає — і «та-дам» інструментом
  cookie: (t, I) => { rec('cookie-crack', t, 0.5) || noise(t, 0.08, 2600, 1200, { v: 0.2, q: 0.8, attack: 0.002 }); rec('paper-slip', t + 0.16, 0.18); I(N.A5, t + 0.3, 0.12, 0.3); I(N.D6, t + 0.42, 0.16, 1); },
  // Золота: хрусь, папірець і арпеджіо вгору з довгою вершиною, зорепад іскор
  gold: (t, I, B) => { rec('cookie-crack', t, 0.55) || noise(t, 0.08, 2600, 1200, { v: 0.2, q: 0.8, attack: 0.002 }); rec('paper-slip', t + 0.16, 0.18);
    I(N.D6, t + 0.3, 0.13, 0.3); I(N.F6, t + 0.38, 0.14, 0.3); I(N.A6, t + 0.46, 0.15, 0.35); I(N.D7, t + 0.56, 0.19, 1.4);
    [N.F7, N.A6, N.E7, N.D7, N.B6].forEach((f, i) => B(f, t + 0.7 + i * 0.09, 0.04, 0.9));
  },
  // Барабан «Планов»: клац на кожен проїханий рядок, з уповільненням
  spin: (t) => spinTicks(t, (at) => rec('reel-tick', at, 0.16) || osc('square', 1800, at, 0.02, 0.012, { attack: 0.001 })),
  // Барабан став: «та-дам» і іскра
  pick: (t, I, B) => { I(N.A5, t, 0.13, 0.3); I(N.D6, t + 0.11, 0.18, 1.2); B(N.A6, t + 0.24, 0.05); },
  // SOS у того, кого кличуть: двотонова сирена «ві-у» чотири рази, сухо (без відлуння), не музика
  sos: (t) => { for (let i = 0; i < 4; i += 1) { osc('square', 960, t + i * 0.5, 0.09, 0.24, { attack: 0.005, dest: dry }); osc('square', 720, t + i * 0.5 + 0.25, 0.09, 0.24, { attack: 0.005, dest: dry }); } },
  // Голос за ідею: ❤️ — легкий підскок угору; ✕ і ⏳ — картка м'яко ковзнула вбік
  like: (t, I) => { rec('envelope-send', t, 0.14); I(N.D6, t + 0.04, 0.11, 0.3); I(N.A6, t + 0.12, 0.13, 0.6); },
  pass: (t) => rec('envelope-send', t, 0.2) || noise(t, 0.2, 1600, 700, { v: 0.06, q: 0.9 }),
  // Збіг планів: обидва хочуть — розкотистий акорд угору, довга вершина й іскри-сердечка
  match: (t, I, B) => {
    I(N.D6, t, 0.12, 0.3); I(N.F6, t + 0.08, 0.13, 0.3); I(N.A6, t + 0.16, 0.15, 0.4);
    I(N.D7, t + 0.28, 0.19, 1.5); I(N.A6, t + 0.28, 0.1, 1.3); I(N.F6, t + 0.29, 0.08, 1.3);
    [N.A6, N.D7, N.F7].forEach((f, i) => B(f, t + 0.5 + i * 0.12, 0.045, 1));
  },
};
export const SOUND_NAMES = Object.keys(SOUNDS);
// З чого звук (для пульта «Отладки»): inst — є ноти інструмента (функція бере I), rec — є запис-шум
const RECORDED = new Set(['turn', 'flip', 'place', 'drop', 'note', 'open',
  'spin', 'cookie', 'gold', 'like', 'pass']);
export const soundParts = (n) => ({ inst: SOUNDS[n].length > 1, rec: RECORDED.has(n) });

function play(name, delay, instrument) {
  if (SOUNDS[name]) run(SOUNDS[name], delay, instrument);
}
// Будь-яка фраза fn(t, I, B) заданим інструментом — і звичайні звуки, і варіанти з лабораторії
function run(fn, delay, instrument) {
  if (!soundOn() || document.visibilityState !== 'visible') return;
  try {
    if (!audio()) return;
    const k = known(instrument);
    // Записи інструмента ще не доїхали (перший тап по ньому) — чекаємо їх, а не граємо запасним синтезатором:
    // інакше з першого разу звучить «якийсь інший» інструмент
    if (SAMPLED[k] && !bank.get(k) && fn.length > 1) {
      loadBank(k);
      const t0 = performance.now();
      loading.get(k)?.then(() => {
        const late = performance.now() - t0;
        if (late < WAIT_SAMPLES_MS) run(fn, Math.max(0, delay - late), instrument);
      }, () => {});
      return;
    }
    fn(ctx.currentTime + 0.02 + delay / 1000, voiceOf(k), NO_SPARKLE.has(k) ? quiet : bell);
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
// Оберт барабана «Планов»: rows рядків за ms (у «Отладці» — стандартні 35 рядків за 3,2 с)
export function sfxSpin(rows, ms) {
  spinRows = rows;
  spinMs = ms;
  sfx('spin');
  spinRows = 35;
  spinMs = 3200;
}
// Послухати інструмент у налаштуваннях: «твій хід» і пара
// Тривога SOS у того, кого кличуть: грає й при вимкнених звуках Радовалки (вибір «Звуки» — про розваги, не про біду).
// Потрібні лише дотик до сторінки раніше (так вимагає браузер) і відкритий екран
export function sosAlarm() {
  if (document.visibilityState !== 'visible') return;
  try { if (audio()) SOUNDS.sos(ctx.currentTime + 0.02); } catch { /* без звуку — лишається вібрація */ }
}
export function preview(instrument) {
  play('turn', 0, instrument);
  play('pair', 900, instrument);
}

// Лабораторія звуків (dev/soundlab.html): ті самі цеглинки, щоб пробувати нові фрази поруч зі старими
export const LAB = { N, SOUNDS, osc, noise, bell, thump, rec: (...a) => rec(...a), run: (fn, instrument, delay = 0) => run(fn, delay, instrument) };
