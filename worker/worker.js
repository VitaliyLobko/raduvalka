// Сервер Радовалки (Cloudflare Worker + D1): два ключі — дві половини, без ключа — 401
// Ключі — секрети KEY_VONA і KEY_VIN; усе особисте (листи, дати, фото) живе тільки в базі
const ORIGINS = new Set([
  'https://vitaliylobko.github.io',
  'http://127.0.0.1:8102',
]);

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS docs (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS imgs (name TEXT PRIMARY KEY, type TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS memes (id TEXT PRIMARY KEY, src TEXT NOT NULL, dst TEXT NOT NULL, '
    + 'img TEXT NOT NULL, caption TEXT, created INTEGER NOT NULL, reaction TEXT)',
  // Листи, написані в застосунку: «зараз», «на ранок» (at — коли показати) і записки в конверт
  'CREATE TABLE IF NOT EXISTS letters (id TEXT PRIMARY KEY, src TEXT NOT NULL, dst TEXT NOT NULL, '
    + 'kind TEXT NOT NULL, env TEXT, mascot TEXT, text TEXT NOT NULL, at INTEGER NOT NULL, '
    + 'created INTEGER NOT NULL, opened INTEGER, liked INTEGER NOT NULL DEFAULT 0, reply TEXT)',
  // «Хотелки»: список бажань кожного; mark — позначка другого («присмотрел»/«куплено»), власнику не видно
  'CREATE TABLE IF NOT EXISTS wishes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, '
    + 'price INTEGER, link TEXT, note TEXT, hot INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, mark TEXT)',
];

const SIDES = ['vona', 'vin'];
const TOGETHER_FIELDS = ['since', 'apartFrom', 'meet', 'phrase', 'wishes'];
const MINE_FIELDS = ['letter', 'seen', 'memesSeen'];
const DOC_KEY = /^(?:(?:letter|envelopes):(?:vona|vin)|mascots|together|voice)$/;
const IMG_NAME = /^[a-z0-9-]{1,64}$/;
const MAX_JSON = 64 * 1024;
const MAX_IMG = 1.4 * 1024 * 1024;
// Мемчик приходить уже в base64 (кодує телефон — у Worker на безкоштовному плані ~10 мс CPU);
// рядок D1 — до 2 МБ, тож base64 до 1,9 млн символів (≈1,4 МБ картинки)
const MAX_B64 = 1_900_000;
const MEME_TYPES = /^image\/(webp|jpeg|png|gif)$/;
const REACTIONS = ['😂', '❤️'];
const LETTER_KINDS = ['now', 'morning', 'env', 'gift'];
const MAX_LETTER = 4000;
const MAX_AHEAD = 3 * 24 * 3600 * 1000;

// Колонки, додані пізніше: ALTER на вже існуючій таблиці (помилка «вже є» — норма)
const MIGRATIONS = [
  'ALTER TABLE memes ADD COLUMN url TEXT',
  // «Подарок на выбор»: варіанти JSON [{ emoji, title, inside }] і номер обраного
  'ALTER TABLE letters ADD COLUMN gift TEXT',
  'ALTER TABLE letters ADD COLUMN chosen INTEGER',
  // Фото хотілки — назва в imgs
  'ALTER TABLE wishes ADD COLUMN img TEXT',
];

// ИИ для конструктора мемчиків: підписи й пошукові запити
const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const GIF_URL = /^https:\/\/media\d*\.giphy\.com\/[\w./?=&-]+$/;

let schemaReady = false;

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(req, env);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      const status = e.status || 500;
      return json({ error: status === 500 ? 'server' : e.message }, status, cors);
    }
  },
};

async function route(req, env) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/')) return json({ ok: true, app: 'raduvalka' });

  const side = await whoIs(req, env);
  if (!side) throw fail(401, 'key');
  await ensureSchema(env.DB);

  const path = url.pathname.slice(5);
  const m = req.method;

  if (m === 'GET' && path === 'boot') {
    const [letter, gift, envelopes, partnerEnvelopes, together, mine, mascots, memes] = await Promise.all([
      dayLetter(env.DB, side),
      pendingGift(env.DB, side),
      myEnvelopes(env.DB, side),
      getDoc(env.DB, `envelopes:${other(side)}`),
      getDoc(env.DB, 'together'),
      getDoc(env.DB, `mine:${side}`),
      getDoc(env.DB, 'mascots'),
      listMemes(env.DB, side),
    ]);
    return json({
      side,
      letter,
      gift,
      envelopes,
      // Для «В конверт»: лише назви її/його конвертів, без самих записок
      partnerEnvelopes: (partnerEnvelopes || []).map(({ id, emoji, label }) => ({ id, emoji, label })),
      together: together || {},
      mine: mine || {},
      mascots: mascots || {},
      memes,
    });
  }

  if (m === 'GET' && path === 'letter') {
    const [letter, gift] = await Promise.all([dayLetter(env.DB, side), pendingGift(env.DB, side)]);
    return json({ letter, gift });
  }
  if (m === 'GET' && path === 'envelopes') return json(await myEnvelopes(env.DB, side));
  if (path === 'letters' || path.startsWith('letters/')) return lettersRoute(req, env.DB, side, path.slice(8));

  if (path === 'wishes' || path.startsWith('wishes/')) return wishesRoute(req, env.DB, side, path.slice(7));
  if (path === 'memes' || path.startsWith('memes/')) return memesRoute(req, env.DB, side, path.slice(6));
  if (m === 'POST' && path === 'meme-ideas') return memeIdeas(req, env, side);
  if (m === 'POST' && path === 'letter-ideas') return letterIdeas(req, env, side);
  if (m === 'POST' && path === 'wish-from-url') return wishFromUrl(req, env);
  if (m === 'POST' && path === 'wish-image') return wishImage(req);
  if (m === 'GET' && path === 'gifs') return gifSearch(url, env);

  if (m === 'PUT' && path === 'together') {
    const patch = pick(await readJson(req), TOGETHER_FIELDS);
    const next = { ...((await getDoc(env.DB, 'together')) || {}), ...patch };
    await putDoc(env.DB, 'together', next);
    return json(next);
  }

  if (m === 'PUT' && path === 'mine') {
    const patch = pick(await readJson(req), MINE_FIELDS);
    const next = { ...((await getDoc(env.DB, `mine:${side}`)) || {}), ...patch };
    await putDoc(env.DB, `mine:${side}`, next);
    return json(next);
  }

  // Поки писати листи й конверти в застосунку не можна — їх кладе він своїм ключем
  if (m === 'PUT' && path.startsWith('doc/')) {
    const k = decodeURIComponent(path.slice(4));
    if (side !== 'vin') throw fail(403, 'forbidden');
    if (!DOC_KEY.test(k)) throw fail(404, 'not found');
    await putDoc(env.DB, k, await readJson(req));
    return json({ ok: true });
  }

  if (path.startsWith('img/')) {
    const name = path.slice(4);
    if (!IMG_NAME.test(name)) throw fail(404, 'not found');
    if (m === 'GET') return getImg(env.DB, name);
    if (m === 'PUT') {
      if (side !== 'vin') throw fail(403, 'forbidden');
      return putImg(env.DB, name, req);
    }
  }

  throw fail(404, 'not found');
}

function corsHeaders(req) {
  const origin = req.headers.get('origin');
  if (!ORIGINS.has(origin)) return { vary: 'Origin' };
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

// Порівнюємо відбитки ключів, а не самі ключі, — щоб час відповіді не підказував символи
async function whoIs(req, env) {
  const auth = req.headers.get('authorization') || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (key.length < 20) return null;
  const given = await digest(key);
  for (const side of SIDES) {
    const secret = env[`KEY_${side.toUpperCase()}`];
    if (secret && sameBytes(given, await digest(secret))) return side;
  }
  return null;
}

async function digest(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

function sameBytes(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((q) => db.prepare(q)));
  for (const q of MIGRATIONS) {
    try {
      await db.prepare(q).run();
    } catch { /* колонка вже є */ }
  }
  schemaReady = true;
}

async function getDoc(db, k) {
  const v = await db.prepare('SELECT v FROM docs WHERE k = ?').bind(k).first('v');
  return v ? JSON.parse(v) : null;
}

async function putDoc(db, k, value) {
  await db.prepare('INSERT INTO docs (k, v, updated) VALUES (?, ?, ?) '
    + 'ON CONFLICT (k) DO UPDATE SET v = excluded.v, updated = excluded.updated')
    .bind(k, JSON.stringify(value), Date.now()).run();
}

async function getImg(db, name) {
  const row = await db.prepare('SELECT type, data FROM imgs WHERE name = ?').bind(name).first();
  if (!row) throw fail(404, 'not found');
  const bin = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
  return new Response(bin, {
    headers: { 'content-type': row.type, 'cache-control': 'private, max-age=86400' },
  });
}

async function putImg(db, name, req) {
  const type = req.headers.get('content-type') || '';
  if (!/^image\/(webp|jpeg|png|gif)$/.test(type)) throw fail(415, 'type');
  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.length || buf.length > MAX_IMG) throw fail(413, 'size');
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  await db.prepare('INSERT INTO imgs (name, type, data, updated) VALUES (?, ?, ?, ?) '
    + 'ON CONFLICT (name) DO UPDATE SET type = excluded.type, data = excluded.data, updated = excluded.updated')
    .bind(name, type, btoa(bin), Date.now()).run();
  return json({ ok: true, size: buf.length });
}

// Мемчики: картинку завантажують обоє, але тільки сюди — PUT img/* лишається за його ключем
async function memesRoute(req, db, side, rest) {
  const m = req.method;
  if (m === 'GET' && !rest) return json(await listMemes(db, side));

  if (m === 'POST' && !rest) {
    const body = await readJson(req, MAX_B64 + 4096);
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const meme = {
      id,
      src: side,
      dst: side === 'vin' ? 'vona' : 'vin',
      img: '',
      url: null,
      caption: String(body.caption || '').trim().slice(0, 300) || null,
      created: Date.now(),
      reaction: null,
    };
    const insertMeme = () => db.prepare(
      'INSERT INTO memes (id, src, dst, img, url, caption, created, reaction) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(meme.id, meme.src, meme.dst, meme.img, meme.url, meme.caption, meme.created, null);

    // GIF із GIPHY — лише посилання, файл не зберігаємо
    if (body.gif) {
      const gifUrl = String(body.gif.url || '');
      if (!GIF_URL.test(gifUrl)) throw fail(400, 'gif');
      meme.url = gifUrl;
      await insertMeme().run();
      return json(view(meme, side), 201);
    }

    const type = String(body.type || '');
    const data = String(body.data || '');
    if (!MEME_TYPES.test(type)) throw fail(415, 'type');
    if (!data || data.length > MAX_B64 || !/^[A-Za-z0-9+/]+=*$/.test(data)) throw fail(413, 'size');
    meme.img = `m-${id}`;
    await db.batch([
      db.prepare('INSERT INTO imgs (name, type, data, updated) VALUES (?, ?, ?, ?)')
        .bind(meme.img, type, data, meme.created),
      insertMeme(),
    ]);
    return json(view(meme, side), 201);
  }

  const [id, sub] = rest.split('/');
  const meme = await db.prepare('SELECT * FROM memes WHERE id = ?').bind(id).first();
  if (!meme || (meme.src !== side && meme.dst !== side)) throw fail(404, 'not found');

  // Картинка base64-рядком: розкодовує телефон, не Worker
  if (m === 'GET' && sub === 'img') {
    const row = await db.prepare('SELECT type, data FROM imgs WHERE name = ?').bind(meme.img).first();
    if (!row) throw fail(404, 'not found');
    return new Response(JSON.stringify(row), {
      headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=31536000, immutable' },
    });
  }

  // Реакцію ставить лише отримувач; null — зняти
  if (m === 'PUT' && !sub) {
    if (meme.dst !== side) throw fail(403, 'forbidden');
    const { reaction = null } = await readJson(req);
    if (reaction !== null && !REACTIONS.includes(reaction)) throw fail(400, 'reaction');
    await db.prepare('UPDATE memes SET reaction = ? WHERE id = ?').bind(reaction, id).run();
    return json(view({ ...meme, reaction }, side));
  }

  // Видаляє лише той, хто надіслав
  if (m === 'DELETE' && !sub) {
    if (meme.src !== side) throw fail(403, 'forbidden');
    await db.batch([
      db.prepare('DELETE FROM memes WHERE id = ?').bind(id),
      ...(meme.img ? [db.prepare('DELETE FROM imgs WHERE name = ?').bind(meme.img)] : []),
    ]);
    return json({ ok: true });
  }

  throw fail(404, 'not found');
}

const other = (side) => (side === 'vin' ? 'vona' : 'vin');

const WISH_MARKS = ['eye', 'bought'];

function wishFields(b) {
  const link = String(b.link || '').trim().slice(0, 500);
  const price = Math.round(Number(b.price));
  return {
    title: String(b.title || '').trim().slice(0, 120),
    price: Number.isFinite(price) && price > 0 ? Math.min(price, 10_000_000) : null,
    // Лише звичайні веб-посилання — щоб у списку не опинилось javascript: чи щось дивне
    link: /^https?:\/\/\S+$/i.test(link) ? link : null,
    note: String(b.note || '').trim().slice(0, 500) || null,
    hot: b.hot ? 1 : 0,
  };
}

// Фото хотілки { type, data base64 } → новий запис у imgs; телефон уже зменшив його
function wishImg(db, b) {
  if (!b || typeof b !== 'object') return null;
  const type = String(b.type || '');
  const data = String(b.data || '');
  if (!/^image\/(webp|jpeg|png)$/.test(type)) throw fail(415, 'type');
  if (!data || data.length > MAX_B64 || !/^[A-Za-z0-9+/]+=*$/.test(data)) throw fail(413, 'size');
  const name = `w-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  return { name, stmt: db.prepare('INSERT INTO imgs (name, type, data, updated) VALUES (?, ?, ?, ?)').bind(name, type, data, Date.now()) };
}

const dropImg = (db, name) => db.prepare('DELETE FROM imgs WHERE name = ?').bind(name);

// Свої — без позначок другого (сюрприз), чужі — з позначками
async function wishesRoute(req, db, side, rest) {
  const m = req.method;
  if (m === 'GET' && !rest) {
    const { results } = await db.prepare('SELECT * FROM wishes ORDER BY hot DESC, created DESC').all();
    const view = (r, withMark) => ({
      id: r.id, title: r.title, price: r.price, link: r.link, note: r.note, hot: !!r.hot, img: r.img || null, created: r.created,
      ...(withMark ? { mark: r.mark } : {}),
    });
    return json({
      mine: results.filter((r) => r.owner === side).map((r) => view(r, false)),
      theirs: results.filter((r) => r.owner === other(side)).map((r) => view(r, true)),
    });
  }
  if (m === 'POST' && !rest) {
    const b = await readJson(req, MAX_B64 + 8192);
    const f = wishFields(b);
    if (!f.title) throw fail(400, 'title');
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const created = Date.now();
    const img = wishImg(db, b.img);
    await db.batch([
      ...(img ? [img.stmt] : []),
      db.prepare('INSERT INTO wishes (id, owner, title, price, link, note, hot, created, img) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, side, f.title, f.price, f.link, f.note, f.hot, created, img?.name ?? null),
    ]);
    return json({ id, ...f, hot: !!f.hot, img: img?.name ?? null, created }, 201);
  }
  const r = await db.prepare('SELECT * FROM wishes WHERE id = ?').bind(rest).first();
  if (!r) throw fail(404, 'not found');
  if (m === 'PUT') {
    const b = await readJson(req, MAX_B64 + 8192);
    // Власник править свою хотілку; другий — лише ставить чи знімає позначку
    if (r.owner === side) {
      const f = wishFields({ ...r, hot: !!r.hot, ...b });
      if (!f.title) throw fail(400, 'title');
      // img: { type, data } — нове фото, null — прибрати, нема ключа — лишити як було
      const img = 'img' in b ? wishImg(db, b.img) : null;
      const imgName = 'img' in b ? (img?.name ?? null) : r.img;
      await db.batch([
        ...(img ? [img.stmt] : []),
        db.prepare('UPDATE wishes SET title = ?, price = ?, link = ?, note = ?, hot = ?, img = ? WHERE id = ?')
          .bind(f.title, f.price, f.link, f.note, f.hot, imgName, r.id),
        ...(r.img && r.img !== imgName ? [dropImg(db, r.img)] : []),
      ]);
      return json({ ok: true, img: imgName });
    }
    const mark = WISH_MARKS.includes(b.mark) ? b.mark : null;
    await db.prepare('UPDATE wishes SET mark = ? WHERE id = ?').bind(mark, r.id).run();
    return json({ ok: true });
  }
  if (m === 'DELETE') {
    if (r.owner !== side) throw fail(403, 'forbidden');
    await db.batch([
      db.prepare('DELETE FROM wishes WHERE id = ?').bind(r.id),
      ...(r.img ? [dropImg(db, r.img)] : []),
    ]);
    return json({ ok: true });
  }
  throw fail(405, 'method');
}

// ---------- Хотілка зі сторінки магазину ----------
// Телефон шле посилання (або вставлений текст, якщо сайт не віддає сторінку серверу); Worker бере сторінку,
// витягує розмітку товару (JSON-LD, og:) і текст, а ИИ складає коротку назву, ціну й подробиці.
// Людина все бачить у формі й править перед збереженням. Розбір сторінки — як у боті Fishing Log.
const SHOP_PAGE_MAX = 3_000_000;
const SHOP_IMAGE_MAX = 4_000_000;
const SHOP_TEXT_MAX = 20_000;
const SHOP_AI_TEXT = 6_000;
const SHOP_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', ndash: '–', mdash: '—', deg: '°', times: '×', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
function unent(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

const stripTags = (s) => unent(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// <meta property|name|itemprop=… content=…> → { ключ: значення }; перше значення перемагає
function metaTags(html) {
  const out = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const k = /(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1]?.toLowerCase();
    const v = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(m[0]);
    if (k && v && !(k in out)) out[k] = unent(v[1] ?? v[2] ?? '').trim();
  }
  return out;
}

// Перший Product із JSON-LD: назва, бренд, ціна з валютою, фото, опис
function ldProduct(html) {
  const found = [];
  const walk = (x, depth = 0) => {
    if (!x || typeof x !== 'object' || depth > 6) return;
    if (Array.isArray(x)) { x.forEach((y) => walk(y, depth + 1)); return; }
    if ([].concat(x['@type'] ?? []).some((t) => /product/i.test(String(t)))) found.push(x);
    if (x['@graph']) walk(x['@graph'], depth + 1);
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim())); } catch { /* битий JSON-LD — пропускаємо */ }
  }
  const p = found[0];
  if (!p) return null;
  const offer = [].concat(p.offers ?? [])[0] ?? {};
  const inner = [].concat(offer.offers ?? [])[0] ?? {};
  const img = [].concat(p.image ?? [])[0];
  const brand = typeof p.brand === 'string' ? p.brand : p.brand?.name;
  return {
    name: p.name ? stripTags(p.name) : '',
    brand: brand ? stripTags(brand) : '',
    price: Number(offer.price ?? offer.lowPrice ?? inner.price) || 0,
    currency: String(offer.priceCurrency ?? inner.priceCurrency ?? '').toUpperCase(),
    image: typeof img === 'string' ? img : String(img?.url ?? img?.contentUrl ?? ''),
    description: p.description ? stripTags(p.description).slice(0, 1000) : '',
  };
}

// Видимий текст сторінки рядками: без скриптів, стилів і розмітки
function pageText(html) {
  const s = html.replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(td|th|dt)>/gi, ': ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d|\/dd|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return unent(s).replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
}

// Рядки, які варто лишити з довгої сторінки: розмір, колір, об'єм — те, що важить для подарунка
const SHOP_KEYS = /характеристик|розмір|размер|колір|цвет|об'єм|объем|объём|матеріал|материал|склад|состав|бренд|виробник|производитель|модель|ціна|цена|грн|₴/i;

// Картка товару від назви плюс рядки з ключовими словами — без меню й підвалу
function focusText(text, name, max) {
  if (text.length <= max) return text;
  const lines = text.split('\n').filter((l) => l.length > 1 && l.length < 400);
  const words = name.toLowerCase().split(/\s+/).filter((x) => x.length > 3).slice(0, 3);
  const start = Math.max(0, lines.findIndex((l) => words.length && words.every((x) => l.toLowerCase().includes(x))));
  const pick = new Set();
  for (let i = start; i < Math.min(lines.length, start + 40); i++) pick.add(i);
  lines.forEach((l, i) => { if (SHOP_KEYS.test(l)) for (let j = i - 1; j <= i + 1; j++) if (j >= 0 && j < lines.length) pick.add(j); });
  let out = '';
  for (const i of [...pick].sort((a, b) => a - b)) {
    if (out.length + lines[i].length + 1 > max) break;
    out += `${lines[i]}\n`;
  }
  return out.trim();
}

// Лише http(s) з нормальним хостом: адресу дає людина, але Worker не має ходити куди завгодно
function publicUrl(raw) {
  let u;
  try { u = new URL(String(raw ?? '').trim()); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.local') || /^[\d.]+$/.test(host) || host.includes(':')) return null;
  return u;
}

// Тіло відповіді не більше max байт — велику сторінку чи фото обриваємо, а не тримаємо в пам'яті
async function readCapped(res, max) {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}

async function fetchPage(u) {
  let res;
  try {
    res = await fetch(u.href, {
      headers: { 'user-agent': SHOP_UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'uk,ru;q=0.8,en;q=0.5' },
      redirect: 'follow', signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw fail(502, 'fetch');
  }
  if (!res.ok || !/html|xml|text/i.test(res.headers.get('content-type') || '')) throw fail(502, 'fetch');
  const bytes = await readCapped(res, SHOP_PAGE_MAX);
  if (!bytes) throw fail(502, 'fetch');
  // Кодування: з заголовка чи <meta charset>, інакше utf-8 (старі магазини бувають у windows-1251)
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const cs = (/charset=([\w-]+)/i.exec(res.headers.get('content-type') || '')?.[1]
    || /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1] || 'utf-8').toLowerCase();
  try { return new TextDecoder(cs).decode(bytes); } catch { return new TextDecoder('utf-8').decode(bytes); }
}

const WISH_PROMPT = [
  'Ты заполняешь карточку в списке желаний (вишлисте) по странице интернет-магазина.',
  'Отвечай только JSON: {"title": "...", "price": число, "note": "..."}.',
  'title — коротко по-русски, как человек запишет себе в список: что это + бренд или модель, 2–6 слов.',
  'Без «купить», цены, артикула и названия магазина. Бренды и модели латиницей оставляй как есть.',
  'price — цена в гривнах целым числом; цены в гривнах на странице нет — 0.',
  'note — одной строкой то, что важно, чтобы подарить именно это: цвет, размер, объём, вариант.',
  'Бери только то, что написано на странице, ничего не выдумывай. Нечего сказать — пустая строка.',
  'Страница не про товар — title пустой.',
].join('\n');

/**
 * POST wish-from-url { url } або { text, url? } → { title, price, note, link, image }.
 * Помилки: fetch — сайт не віддав сторінку (застосунок просить вставити текст), empty — товару не видно, ai.
 */
async function wishFromUrl(req, env) {
  const b = await readJson(req);
  const pasted = String(b.text ?? '').trim();
  const u = b.url ? publicUrl(b.url) : null;
  if ((!u && !pasted) || pasted.length > SHOP_TEXT_MAX || (b.url && !u)) throw fail(400, 'url');
  if (!env.AI) throw fail(503, 'no-ai');
  let ld = null;
  let meta = {};
  let text;
  if (pasted) {
    text = `${u ? `Адрес: ${u.href}\n` : ''}Текст страницы (вставил человек):\n${pasted}`;
  } else {
    const html = await fetchPage(u);
    ld = ldProduct(html);
    meta = metaTags(html);
    const name = ld?.name || meta['og:title'] || '';
    const head = [
      `Адрес: ${u.href}`,
      name ? `Название товара: ${name}` : '',
      ld?.brand ? `Бренд: ${ld.brand}` : '',
      ld?.price ? `Цена: ${ld.price} ${ld.currency}` : '',
      ld?.description || meta['og:description'] ? `Описание: ${ld?.description || meta['og:description']}` : '',
    ].filter(Boolean).join('\n');
    const body = focusText(pageText(html), name, Math.max(1000, SHOP_AI_TEXT - head.length));
    if (!name && body.length < 200) throw fail(422, 'empty');
    text = `${head}\n\nТекст страницы:\n${body}`;
  }
  let r;
  try {
    r = await askAI(env, WISH_PROMPT, text.slice(0, SHOP_AI_TEXT), 300, 0.2);
  } catch {
    r = {};
  }
  const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  let title = clean(r.title, 120);
  let price = Math.round(Number(String(r.price ?? '').replace(/[^\d.,]/g, '').replace(',', '.'))) || 0;
  // Назва й ціна з розмітки товару надійніші; ціну беремо лише в гривнях
  if (ld?.price > 0 && (!ld.currency || ld.currency === 'UAH')) price = Math.round(ld.price);
  // og:title — лише коли ИИ не відповів; сказав «не товар» і розмітки товару нема — це не сторінка товару
  if (!title) title = clean(ld?.name || (r.title === undefined ? meta['og:title'] : ''), 120);
  if (!title) throw fail(r.title === undefined ? 502 : 422, r.title === undefined ? 'ai' : 'empty');
  const rawImage = ld?.image || meta['og:image'] || '';
  let image = '';
  try { if (rawImage && u) image = publicUrl(new URL(rawImage, u.href).href)?.href ?? ''; } catch { /* бита адреса фото */ }
  return json({
    title,
    price: price > 0 && price < 10_000_000 ? price : 0,
    note: clean(r.note, 300),
    link: u?.href ?? '',
    image,
  });
}

// POST wish-image { url } → саме фото товару: з магазину телефону його напряму не дадуть (CORS)
async function wishImage(req) {
  const u = publicUrl((await readJson(req)).url);
  if (!u) throw fail(400, 'url');
  let res;
  try {
    res = await fetch(u.href, { headers: { 'user-agent': SHOP_UA, accept: 'image/avif,image/webp,image/*' }, signal: AbortSignal.timeout(15000) });
  } catch {
    throw fail(502, 'fetch');
  }
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!res.ok || !/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) throw fail(502, 'fetch');
  const bytes = await readCapped(res, SHOP_IMAGE_MAX);
  if (!bytes) throw fail(413, 'size');
  return new Response(bytes, { headers: { 'content-type': type, 'cache-control': 'no-store' } });
}

// Лист дня: найновіший написаний у застосунку, чий час настав; «на ранок» до ранку не віддаємо.
// Нема жодного — лист із бази (заготовка)
async function dayLetter(db, side) {
  const r = await db.prepare(
    "SELECT * FROM letters WHERE dst = ? AND kind IN ('now', 'morning') AND at <= ? ORDER BY at DESC, created DESC LIMIT 1",
  ).bind(side, Date.now()).first();
  if (!r) return getDoc(db, `letter:${side}`);
  return { id: r.id, at: r.at, text: r.text, mascot: r.mascot, opened: !!r.opened, liked: !!r.liked, reply: r.reply };
}

// Подарунок, який ще чекає вибору. Що всередині — не віддаємо, поки не обрано: підглянути не можна
async function pendingGift(db, side) {
  const r = await db.prepare(
    "SELECT * FROM letters WHERE dst = ? AND kind = 'gift' AND chosen IS NULL ORDER BY created LIMIT 1",
  ).bind(side).first();
  return r ? giftView(r) : null;
}

function giftView(r) {
  const opts = JSON.parse(r.gift || '[]');
  const shown = r.chosen != null;
  return {
    id: r.id,
    text: r.text,
    mascot: r.mascot,
    chosen: r.chosen,
    options: opts.map((o) => ({ emoji: o.emoji, title: o.title, ...(shown ? { inside: o.inside } : {}) })),
  };
}

function cleanGift(list) {
  const opts = (Array.isArray(list) ? list : []).map((o) => ({
    emoji: String(o?.emoji || '🎁').trim().slice(0, 8) || '🎁',
    title: String(o?.title || '').trim().slice(0, 40),
    inside: String(o?.inside || '').trim().slice(0, 500),
  })).filter((o) => o.title).slice(0, 3);
  if (opts.length < 2) throw fail(400, 'gift');
  return opts;
}

// Конверти: записки із заготовки, а за ними — дописані в застосунку (лише додаються в кінець,
// бо «прочитано» рахується позицією)
async function myEnvelopes(db, side) {
  const list = (await getDoc(db, `envelopes:${side}`)) || [];
  const { results } = await db.prepare(
    "SELECT id, env, text, liked FROM letters WHERE dst = ? AND kind = 'env' ORDER BY created",
  ).bind(side).all();
  return list.map((e) => ({
    ...e,
    notes: [...(e.notes || []), ...results.filter((r) => r.env === e.id).map((r) => ({ id: r.id, text: r.text, liked: !!r.liked }))],
  }));
}

async function lettersRoute(req, db, side, rest) {
  const m = req.method;

  // Надіслані мною — з тим, що вже сталося на тому боці
  if (m === 'GET' && rest === 'sent') {
    const { results } = await db.prepare(
      'SELECT id, kind, env, text, at, created, opened, liked, reply, gift, chosen FROM letters WHERE src = ? ORDER BY created DESC LIMIT 20',
    ).bind(side).all();
    return json(results.map((r) => ({ ...r, gift: r.gift ? JSON.parse(r.gift) : null, opened: !!r.opened, liked: !!r.liked })));
  }

  if (m === 'POST' && !rest) {
    const b = await readJson(req);
    const kind = String(b.kind || '');
    const text = String(b.text || '').trim().slice(0, MAX_LETTER);
    if (!LETTER_KINDS.includes(kind) || (!text && kind !== 'gift')) throw fail(400, 'letter');
    const gift = kind === 'gift' ? JSON.stringify(cleanGift(b.gift)) : null;
    const now = Date.now();
    let at = now;
    // Час «на ранок» рахує телефон (його часовий пояс); сервер лише не пускає в минуле й далеко вперед
    if (kind === 'morning') at = Math.max(now, Math.min(now + MAX_AHEAD, Number(b.at) || now));
    let envId = null;
    if (kind === 'env') {
      envId = String(b.env || '');
      const theirs = (await getDoc(db, `envelopes:${other(side)}`)) || [];
      if (!theirs.some((e) => e.id === envId)) throw fail(400, 'env');
    }
    const mascots = (await getDoc(db, 'mascots')) || {};
    const mascot = mascots[b.mascot] ? String(b.mascot) : null;
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    await db.prepare(
      'INSERT INTO letters (id, src, dst, kind, env, mascot, text, at, created, gift) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, side, other(side), kind, envId, mascot, text, at, now, gift).run();
    return json({ id, kind, env: envId, text, at, created: now, opened: false, liked: false, reply: null, gift: gift && JSON.parse(gift), chosen: null }, 201);
  }

  const r = await db.prepare('SELECT * FROM letters WHERE id = ?').bind(rest).first();
  if (!r || (r.src !== side && r.dst !== side)) throw fail(404, 'not found');

  // Отримувач: відкрив, ❤️, відповідь
  if (m === 'PUT') {
    if (r.dst !== side) throw fail(403, 'forbidden');
    const b = await readJson(req);
    // Вибір подарунка — один раз і назавжди; у відповідь — усі варіанти вже з начинкою.
    // Уже обрано (повтор після втраченої відповіді) — віддаємо той вибір, що стоїть
    if ('choose' in b) {
      if (r.kind !== 'gift') throw fail(409, 'chosen');
      if (r.chosen != null) return json(giftView(r));
      const i = Number(b.choose);
      if (!Number.isInteger(i) || i < 0 || i >= JSON.parse(r.gift || '[]').length) throw fail(400, 'choose');
      const res = await db.prepare('UPDATE letters SET chosen = ?, opened = ? WHERE id = ? AND chosen IS NULL')
        .bind(i, Date.now(), r.id).run();
      if (res.meta?.changes === 0) {
        return json(giftView(await db.prepare('SELECT * FROM letters WHERE id = ?').bind(r.id).first()));
      }
      return json(giftView({ ...r, chosen: i }));
    }
    // Лише поля із запиту: «відкрив» і ❤️ можуть летіти одночасно, і старе прочитане не має затерти нове
    const sets = [];
    const args = [];
    if (b.opened) { sets.push('opened = COALESCE(opened, ?)'); args.push(Date.now()); }
    if ('liked' in b) { sets.push('liked = ?'); args.push(b.liked ? 1 : 0); }
    if ('reply' in b) { sets.push('reply = ?'); args.push(String(b.reply || '').trim().slice(0, MAX_LETTER) || null); }
    if (sets.length) await db.prepare(`UPDATE letters SET ${sets.join(', ')} WHERE id = ?`).bind(...args, r.id).run();
    return json({ ok: true });
  }

  // Відправник забирає лист, поки його не відкрили
  if (m === 'DELETE') {
    if (r.src !== side) throw fail(403, 'forbidden');
    if (r.opened) throw fail(409, 'opened');
    await db.prepare('DELETE FROM letters WHERE id = ?').bind(r.id).run();
    return json({ ok: true });
  }

  throw fail(405, 'method');
}

async function listMemes(db, side) {
  const { results } = await db.prepare(
    'SELECT * FROM memes WHERE src = ? OR dst = ? ORDER BY created DESC LIMIT 300',
  ).bind(side, side).all();
  return results.map((r) => view(r, side));
}

// Для телефона: mine — «я надіслав», без внутрішніх src/dst/img
function view(r, side) {
  return { id: r.id, mine: r.src === side, url: r.url || null, caption: r.caption, created: r.created, reaction: r.reaction };
}

// Повзунок 0–100 → одна з трьох словесних смуг для промпту
const pickBand = (v, bands) => bands[Math.min(2, Math.floor((Math.max(0, Math.min(100, Number(v) || 0))) / 34))];

// Конструктор: ситуація й повзунки → 5 підписів від улюбленця або 3 англійські запити для GIF
async function memeIdeas(req, env, side) {
  if (!env.AI) throw fail(503, 'ai');
  const b = await readJson(req);
  const level = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const situation = String(b.situation || '').trim().slice(0, 200) || 'просто так, порадовать';
  const funny = level(b.funny);
  const bold = level(b.bold);
  const to = side === 'vin' ? 'жене' : 'мужу';

  let system;
  let user;
  if (b.kind === 'gif') {
    system = 'You pick GIPHY search queries for a loving couple who send each other GIFs. '
      + 'Reply ONLY with JSON {"queries": [three short English search queries, 2-4 words each]}. '
      + 'No politics, no violence, nothing explicit.';
    user = `Situation (Russian): ${situation}. Mood: ${funny}% funny (0 = cute), ${bold}% cheeky (0 = tender). `
      + `Subjects: ${level(b.people) > 50 ? 'people, movie and cartoon characters' : 'animals, cats, dogs'}.`;
  } else {
    const pet = b.pet || {};
    system = 'Ты остроумный автор подписей к мемам. Пара: муж надолго уехал далеко, жена ждёт дома, '
      + 'у них общие питомцы. Мем — фото питомца с подписью, один отправляет другому. '
      + 'Подпись — реплика питомца от первого лица (в его роде) или смешной комментарий к фото, '
      + 'с конкретной бытовой деталью (диван, миска, тапки, одеяло, холодильник, прогулка), '
      + 'с неожиданным поворотом, как в хороших мемах. Не банально: не «я скучаю», не «люблю тебя» в лоб. '
      + 'Без пошлости, политики, войны, хэштегов. '
      + 'Никогда не используй слова «мама», «папа», «хозяин», «хозяйка» — пара себя так не называет. '
      + 'Примеры стиля: «Охраняю твою половину кровати. Никого не пускаю, даже себя… почти»; '
      + '«Она сказала, что ты скоро. Я уже третий час смотрю на дверь». '
      + 'Ответь ТОЛЬКО JSON {"captions": [5 разных подписей]}.';
    user = `На фото: ${String(pet.name || 'питомец').slice(0, 30)} — ${String(pet.sp || 'питомец').slice(0, 60)}, `
      + `${pet.g === 'f' ? 'девочка (говорит в женском роде)' : 'мальчик (говорит в мужском роде)'}. `
      + (side === 'vin'
        ? 'Мем от мужа жене. Питомец дома с ней и говорит ей «ты». Муж далеко, о нём — «он»; '
          + 'он не может кормить, гулять, сидеть на диване — его дома НЕТ, по нему скучают. '
        : 'Мем от жены мужу. Муж далеко, питомец пишет ему «ты» и зовёт домой. '
          + 'Жена дома с питомцем, о ней — «она» (кормит, гуляет, обнимает, ворчит). ')
      + `Повод: ${situation}. `
      + `Тон: смешно на ${funny}% (0 — нежно-мило), дерзко на ${bold}% (0 — очень нежно), `
      + `абсурдно на ${level(b.absurd)}% (0 — жизненно и узнаваемо, 100 — сюрреализм и неожиданные сравнения). `
      + `Длина каждой подписи: ${pickBand(b.len, ['3–6 слов', '6–12 слов', '12–20 слов'])}. `
      + `О чём: ${pickBand(b.about, ['про самого питомца, его характер и проделки', 'и про питомца, и про вас двоих', 'про вас двоих и разлуку, питомец лишь комментирует'])}. `
      + `Эмодзи: ${pickBand(b.emoji, ['ни одного', 'не больше одного на подпись', 'одно-три к месту'])}.`;
  }

  const out = await env.AI.run(AI_MODEL, {
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: 400,
    temperature,
  });
  const text = typeof out?.response === 'string' ? out.response
    : (out?.response ? JSON.stringify(out.response) : out?.choices?.[0]?.message?.content || '');
  let parsed = {};
  try {
    parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch { /* модель відповіла не JSON — нижче віддамо порожньо */ }
  const list = (a) => (Array.isArray(a) ? a : []).map((x) => String(x).trim()).filter(Boolean);
  return json(b.kind === 'gif'
    ? { queries: list(parsed.queries).slice(0, 3) }
    // llama іноді вставляє англійські слова посеред російської — такі підписи відкидаємо
    : { captions: list(parsed.captions).map((c) => c.replace(/^["«]|["»]$/g, '')).filter((c) => !/[a-z]{3,}/i.test(c)).slice(0, 5) });
}

// Відповідь моделі: текст із response або choices, з нього — JSON-обʼєкт
async function askAI(env, system, user, maxTokens, temperature = 0.9) {
  const out = await env.AI.run(AI_MODEL, {
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: maxTokens,
    temperature,
  });
  const text = typeof out?.response === 'string' ? out.response
    : (out?.response ? JSON.stringify(out.response) : out?.choices?.[0]?.message?.content || '');
  try {
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch {
    return {};
  }
}

const LATIN_WORD = /[a-z]{3,}/i;

// Помічник листа: чернетки від імені того, хто пише (draft), або правка його тексту (fix).
// Особисте (клички, їхня фраза) — лише з бази, не з коду
async function letterIdeas(req, env, side) {
  if (!env.AI) throw fail(503, 'ai');
  const b = await readJson(req);
  const level = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const [together, mascots, voice] = await Promise.all([
    getDoc(env.DB, 'together'), getDoc(env.DB, 'mascots'), getDoc(env.DB, 'voice'),
  ]);
  const pets = Object.values(mascots || {}).map((x) => `${x.name} (${x.sp || 'питомец'})`).join(', ');
  const he = side === 'vin';
  // Як вони кличуть одне одного — з бази (voice.names[сторона] — як ця сторона звертається до другої)
  const names = (voice?.names?.[side] || []).map((x) => `«${String(x).slice(0, 30)}»`).join(', ');
  const call = names
    ? ` Обращайся к получателю так, как они правда зовут друг друга: ${names} — 1–2 раза на всё письмо, не больше; `
      + 'не используй вместо них «любимая», «любимый», «дорогая», «дорогой», «милая», «милый».'
    : '';
  const who = (he
    ? 'Пишет муж жене (от первого лица, мужской род: «я скучал», «я рад»). Он далеко и надолго, она ждёт дома.'
    : 'Пишет жена мужу (от первого лица, женский род: «я скучала», «я рада»). Она дома, он далеко и надолго.') + call;
  const rules = 'Никаких слов «мама», «папа», «хозяин», «хозяйка». Без политики, войны, пошлости, хэштегов. '
    + 'Без штампов и пафоса («солнце моей жизни», «ты мой мир») — живым разговорным языком, как пишут близкому. '
    + 'Только русский язык. Абзацы разделяй переводом строки \n.';

  if (b.mode === 'fix') {
    const text = String(b.text || '').trim().slice(0, MAX_LETTER);
    if (!text) throw fail(400, 'text');
    const how = {
      warm: 'сделай теплее и нежнее',
      short: 'сократи примерно вдвое, оставив главное',
      fix: 'исправь только орфографию, пунктуацию и явные ошибки, слова и стиль не меняй',
      fun: 'добавь лёгкого юмора',
    }[b.fix] || 'сделай теплее';
    const out = await askAI(env, `Ты бережный редактор личных писем. ${who} ${rules} `
      + 'Сохрани смысл, факты и голос автора, ничего не выдумывай. Ответь ТОЛЬКО JSON {"text": "..."}.',
    `Задача: ${how}.\nПисьмо:\n${text}`, 1200);
    const fixed = String(out.text || '').trim();
    return json({ text: LATIN_WORD.test(fixed) && !LATIN_WORD.test(text) ? '' : fixed });
  }

  const reason = String(b.reason || '').trim().slice(0, 200) || 'просто так, сказать, что люблю';
  const words = String(b.words || '').trim().slice(0, 400);
  const long = level(b.long);
  const sentences = long < 34 ? '2–3 предложения' : long < 67 ? '4–6 предложений' : '7–10 предложений';
  const focus = { today: 'про сегодняшний день и мелочи', memory: 'про общее воспоминание', future: 'про мечты о встрече и планы' }[b.focus] || '';
  const system = `Ты помогаешь написать короткое личное письмо. ${who} ${rules} `
    + `Питомцы живут дома с ней: ${pets || 'нет'}${he ? ' — он их не видит, может только спросить о них' : ''}. `
    + 'Упоминать питомцев — не больше чем в одном варианте'
    + `${together?.phrase ? `; их общую фразу «${String(together.phrase).slice(0, 120)}» — тоже не больше чем в одном` : ''}. `
    + 'Варианты заметно разные по началу и идее. Без подписи в конце. '
    + 'Ответь ТОЛЬКО JSON {"drafts": ["вариант 1", "вариант 2", "вариант 3"]}.';
  const user = `Повод: ${reason}. ${focus ? `Акцент: ${focus}. ` : ''}`
    + `${words ? `Что обязательно сказать или вспомнить (слова автора): ${words}. ` : ''}`
    + `Длина: ${sentences}. Тон: игриво на ${level(b.funny)}% (0 — нежно), `
    + `поэтично на ${level(b.poetic)}% (0 — просто, как в переписке).`;
  const out = await askAI(env, system, user, 1500);
  const drafts = (Array.isArray(out.drafts) ? out.drafts : [])
    .map((x) => String(x).trim().replace(/\n/g, '\n'))
    .filter((x) => x && !LATIN_WORD.test(x))
    .slice(0, 3);
  return json({ drafts });
}

// Пошук GIF через GIPHY: ключ лише тут, у Worker; «pg» — без 18+
async function gifSearch(url, env) {
  if (!env.GIPHY_KEY) throw fail(503, 'nokey');
  const q = (url.searchParams.get('q') || '').slice(0, 80);
  const offset = Math.max(0, Math.min(200, Number(url.searchParams.get('offset')) || 0));
  if (!q) return json([]);
  const api = new URL('https://api.giphy.com/v1/gifs/search');
  api.search = new URLSearchParams({
    api_key: env.GIPHY_KEY, q, limit: '12', offset: String(offset), rating: 'pg', lang: 'en',
  });
  const res = await fetch(api);
  if (!res.ok) throw fail(502, 'giphy');
  const { data = [] } = await res.json();
  return json(data.map((g) => {
    // MP4 оригіналу в 13–20 разів легший за GIF тієї ж якості; у сітці — проріджене webp-превʼю ~50 КБ
    const full = g.images?.original || {};
    const small = g.images?.preview_webp?.url ? { webp: g.images.preview_webp.url } : (g.images?.fixed_width_downsampled || g.images?.fixed_width || {});
    return {
      id: g.id,
      preview: small.webp || small.url,
      url: full.mp4 || g.images?.downsized_medium?.url || full.url,
      w: Number(full.width) || 0,
      h: Number(full.height) || 0,
    };
  }).filter((g) => g.url && GIF_URL.test(g.url)));
}

async function readJson(req, max = MAX_JSON) {
  const text = await req.text();
  if (text.length > max) throw fail(413, 'size');
  try {
    return JSON.parse(text);
  } catch {
    throw fail(400, 'json');
  }
}

function pick(obj, fields) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw fail(400, 'json');
  return Object.fromEntries(fields.filter((f) => f in obj).map((f) => [f, obj[f]]));
}

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
