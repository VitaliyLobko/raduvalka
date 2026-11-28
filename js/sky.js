// Його небо за сезонами, намальоване раз на canvas (dpr ≤ 2): Чумацький Шлях — смуга з теплим ядром у Стрільці
// (справжній центр Галактики саме там), темними пиловими прожилками й густим зоряним пилом; північне сяйво — дві «фіранки»
// з вертикальних променів: яскраво-зелений нижній край, вище — бірюза, фіолет і рожеве, з мʼяким світінням.
// Рух — лише transform і opacity цілих полотен (CSS), тож кадр нічого не перемальовує

// Детермінований випадок: однакове небо щоразу
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => (r() + r() + r() + r() - 2) / 1.15;

function canvasFor(w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return { c, ctx, dpr };
}

// Мʼяке світіння: зменшена копія, розтягнута назад (розмиття без ctx.filter — працює й на iPhone)
function bloom(c, ctx, dpr, w, h, k, alpha) {
  const s = document.createElement('canvas');
  s.width = Math.max(1, Math.round(c.width / k));
  s.height = Math.max(1, Math.round(c.height / k));
  const sx = s.getContext('2d');
  sx.drawImage(c, 0, 0, s.width, s.height);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(s, 0, 0, c.width, c.height);
  ctx.restore();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Де Стрілець на цьому шарі — туди ядро Галактики
function corePoint(box, W, H) {
  const sgr = document.querySelector('.depth-vin .sgr');
  const r = sgr?.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  if (!r || !r.width) return { x: W * 0.27, y: H * 0.66 };
  return { x: r.left - b.left + r.width * 0.28, y: r.top - b.top + r.height * 0.5 };
}

// Чумацький Шлях на два полотна: c — світло, ядро й пил (з мʼяким світінням), s — зоряна крупа (її можна мерехтіти окремо).
// core — де ядро, ang — нахил; tint: cool — холодні краї (його небо), rose — бузкові й рожеві (реакція 🌌);
// dust — колір пилу під тло; seed — однакове небо щоразу (без нього — випадкове).
// at(t, off) — точка на смузі (t 0…1 уздовж видимої частини, off — пікселі вбік), wid(t) — ширина
export function milkyLayers(W, H, { core, ang, tint = 'cool', dust = '5,18,28', seed = null, density = 22 }) {
  const G = canvasFor(W, H);
  const S = canvasFor(W, H);
  const { ctx, dpr } = G;
  const z = S.ctx;
  const r = seed == null ? Math.random : rng(seed);
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const L = Math.hypot(W, H);
  const pos = (t, off) => [core.x + dx * t - dy * off, core.y + dy * t + dx * off];
  // Ширина смуги: біля ядра — товща
  const width = (t) => W * 0.11 * (1 + 1.5 * Math.exp(-((t / (W * 0.42)) ** 2)));
  const edge = () => (tint === 'rose' ? (r() < 0.45 ? [247, 184, 214] : [176, 150, 255]) : [165, 190, 255]);

  ctx.globalCompositeOperation = 'lighter';
  // 1. Розсіяне світло — з багатьох дрібних «зоряних хмар», тож смуга плямиста, а не рівний градієнт
  for (let i = 0; i < 320; i++) {
    const t = (r() * 2 - 1) * L * 0.85;
    const w = width(t) * (0.25 + r() * 0.55);
    const [x, y] = pos(t, gauss(r) * width(t) * 0.3);
    const warm = Math.exp(-((t / (W * 0.5)) ** 2));
    const e = edge();
    const g = ctx.createRadialGradient(x, y, 0, x, y, w);
    const rgb = [Math.round(e[0] + (255 - e[0]) * warm), Math.round(e[1] + (222 - e[1]) * warm), Math.round(e[2] + (180 - e[2]) * warm)].join(',');
    g.addColorStop(0, `rgba(${rgb},${(0.035 + 0.035 * warm).toFixed(3)})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - w, y - w, w * 2, w * 2);
  }
  // 2. Ядро-балдж: тепла еліпсоїдна пляма вздовж смуги
  ctx.save();
  ctx.translate(core.x, core.y);
  ctx.rotate(ang);
  ctx.scale(1, 0.42);
  const rx = W * 0.34;
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  cg.addColorStop(0, 'rgba(255,232,195,.17)');
  cg.addColorStop(0.4, 'rgba(255,205,155,.07)');
  cg.addColorStop(1, 'rgba(255,190,140,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 3. Пилові хмари (Великий Розлом): ланцюжки темних мʼяких плям, що блукають уздовж смуги й місцями рвуться
  ctx.globalCompositeOperation = 'source-over';
  const lanes = [[-0.12, 0.8, 0.04, 0.2], [0.02, 0.5, -0.16, 0.13], [-0.32, 0.02, 0.22, 0.12], [0.2, 0.75, 0.28, 0.09]];
  for (const [a, b, shift, base] of lanes) {
    let drift = 0;
    for (let t = a * L; t <= b * L; t += 3 + r() * 6) {
      drift = drift * 0.92 + (r() - 0.5) * 0.06;
      const dens = Math.max(0, Math.sin(t / 41 + shift * 13) * 0.6 + 0.5);
      if (dens < 0.08) continue;
      const w = width(t);
      const [x, y] = pos(t, (shift + drift) * w);
      const rad = base * w * (0.4 + r() * 0.8);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${dust},${(0.22 * dens).toFixed(3)})`);
      g.addColorStop(1, `rgba(${dust},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  bloom(G.c, ctx, dpr, W, H, 6, 0.35);
  // 4. Зоряна крупа: тисячі зірок, густо вздовж осі й біля ядра; кілька яскравих з ореолом
  z.globalCompositeOperation = 'lighter';
  // Зорі групуємо за кольором і яскравістю: fillStyle — раз на групу, а не 13 тисяч разів (розбір рядка кольору дорогий)
  const N = Math.round((W * H) / density);
  const groups = new Map();
  for (let i = 0; i < N; i++) {
    const t = (r() * 2 - 1) * L * 0.9;
    const w = width(t);
    const [x, y] = pos(t, gauss(r) * w * 0.45);
    if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
    const s = 0.5 + r() ** 4 * 1.2;
    const k = r();
    const warm = Math.exp(-((t / (W * 0.45)) ** 2));
    const col = k < 0.14 * (1 + warm) ? '255,222,180' : k > 0.9 ? (tint === 'rose' ? '255,210,232' : '200,220,255') : '255,255,255';
    const key = `rgba(${col},${(Math.round((0.15 + r() ** 2 * 0.6) * 10) / 10).toFixed(1)})`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(x, y, s);
  }
  for (const [style, g] of groups) {
    z.fillStyle = style;
    for (let i = 0; i < g.length; i += 3) z.fillRect(g[i], g[i + 1], g[i + 2], g[i + 2]);
  }
  for (let i = 0; i < 26; i++) {
    const t = (r() * 2 - 1) * L * 0.8;
    const [x, y] = pos(t, gauss(r) * width(t) * 0.35);
    const rad = 2.5 + r() * 3;
    const g = z.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(0.25, 'rgba(220,232,255,.35)');
    g.addColorStop(1, 'rgba(220,232,255,0)');
    z.fillStyle = g;
    z.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  bloom(S.c, z, S.dpr, W, H, 4, 0.3);
  // Видима частина смуги: від краю до краю екрана через його центр
  const mid = (W / 2 - core.x) * dx + (H / 2 - core.y) * dy;
  const half = (Math.abs(W * dx) + Math.abs(H * dy)) / 2;
  const at = (t, off = 0) => pos(mid + (t * 2 - 1) * half, off);
  const wid = (t) => width(mid + (t * 2 - 1) * half);
  return { c: G.c, s: S.c, at, wid };
}

export function paintMilky(box) {
  const W = box.clientWidth;
  const H = box.clientHeight;
  if (!W || !H) return false;
  const { c, s } = milkyLayers(W, H, { core: corePoint(box, W, H), ang: -0.66, seed: 1987 });
  c.className = 'sky-art';
  s.className = 'sky-art';
  box.replaceChildren(c, s);
  return true;
}

// Одна «фіранка» сяйва: промені вздовж хвилястої лінії; violet — наскільки верх рожево-фіолетовий
function curtain(W, Hc, seed, violet) {
  const { c, ctx, dpr } = canvasFor(W, Hc);
  const r = rng(seed);
  const ph = [r() * 6, r() * 6, r() * 6];
  // Нижній край — стрічка з дрібними складками, а не пагорби: мала амплітуда, кілька частот
  // і нахилена дугою (як справжня дуга сяйва на півночі), тож не лягає рівним обрієм поперек екрана
  const tilt = (x) => (x / W - 0.5) * (violet ? -0.22 : 0.26) - 0.12 * Math.sin((x / W) * Math.PI);
  const base = (x) => Hc * (0.74 + tilt(x) + 0.045 * Math.sin(x / W * 3.4 + ph[0]) + 0.03 * Math.sin(x / W * 9 + ph[1]) + 0.015 * Math.sin(x / W * 23 + ph[2]));
  // Складки: де «фіранка» розвертається до нас — яскравіше
  const fold = (x) => 0.5 + 0.5 * Math.cos(x / W * 14 + ph[2] + 1.8 * Math.sin(x / W * 3.3));
  const slow = (x) => 0.5 + 0.3 * Math.sin(x / W * 7 + ph[0]) + 0.2 * Math.sin(x / W * 19 + ph[1]);
  ctx.globalCompositeOperation = 'lighter';
  for (let x = 0; x <= W;) {
    const wRay = 1.2 + r() * 3.2;
    const y = base(x);
    const h = Hc * (0.3 + 0.4 * slow(x)) * (0.85 + 0.3 * r());
    const k = (0.2 + 0.8 * fold(x) ** 1.5) * (0.7 + 0.3 * r());
    const g = ctx.createLinearGradient(0, y, 0, y - h);
    g.addColorStop(0, `rgba(140,255,195,${Math.min(1, 1.05 * k).toFixed(3)})`);
    g.addColorStop(0.035, `rgba(70,240,155,${(0.7 * k).toFixed(3)})`);
    g.addColorStop(0.35, `rgba(50,205,175,${(0.28 * k).toFixed(3)})`);
    g.addColorStop(0.72, violet
      ? `rgba(215,100,225,${(0.2 * k).toFixed(3)})`
      : `rgba(130,105,255,${(0.17 * k).toFixed(3)})`);
    g.addColorStop(1, 'rgba(130,105,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y - h, wRay, h + 1.5);
    // Під краєм — коротке світіння вниз, щоб край світився, а не різав небо силуетом
    const d = Hc * 0.07;
    const gd = ctx.createLinearGradient(0, y, 0, y + d);
    gd.addColorStop(0, `rgba(90,250,170,${(0.42 * k).toFixed(3)})`);
    gd.addColorStop(1, 'rgba(90,250,170,0)');
    ctx.fillStyle = gd;
    ctx.fillRect(x, y, wRay, d);
    x += wRay * (0.55 + r() * 0.7);
  }
  // Мʼяке світіння: промені зливаються в завісу, край світиться
  bloom(c, ctx, dpr, W, Hc, 4, 0.35);
  bloom(c, ctx, dpr, W, Hc, 12, 0.6);
  // Знизу й згори не обрізано, а гасне
  ctx.globalCompositeOperation = 'destination-out';
  const fade = ctx.createLinearGradient(0, 0, 0, Hc);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.16, 'rgba(0,0,0,0)');
  fade.addColorStop(0.84, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, Hc);
  return c;
}

export function paintAurora(box) {
  const W = box.clientWidth;
  const H = box.clientHeight;
  if (!W || !H) return false;
  const cw = Math.round(W * 1.2);
  const a = curtain(cw, Math.round(H * 0.5), 41, false);
  const b = curtain(cw, Math.round(H * 0.46), 97, true);
  a.className = 'sky-art sky-curtain is-a';
  b.className = 'sky-art sky-curtain is-b';
  box.replaceChildren(b, a);
  return true;
}
