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
];

const SIDES = ['vona', 'vin'];
const TOGETHER_FIELDS = ['since', 'apartFrom', 'meet', 'phrase', 'wishes'];
const MINE_FIELDS = ['letter', 'seen', 'memesSeen'];
const DOC_KEY = /^(?:(?:letter|envelopes):(?:vona|vin)|mascots|together)$/;
const IMG_NAME = /^[a-z0-9-]{1,64}$/;
const MAX_JSON = 64 * 1024;
const MAX_IMG = 1.4 * 1024 * 1024;
// Мемчик приходить уже в base64 (кодує телефон — у Worker на безкоштовному плані ~10 мс CPU);
// рядок D1 — до 2 МБ, тож base64 до 1,9 млн символів (≈1,4 МБ картинки)
const MAX_B64 = 1_900_000;
const MEME_TYPES = /^image\/(webp|jpeg|png|gif)$/;
const REACTIONS = ['😂', '❤️'];

// Колонки, додані пізніше: ALTER на вже існуючій таблиці (помилка «вже є» — норма)
const MIGRATIONS = ['ALTER TABLE memes ADD COLUMN url TEXT'];

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
    const [letter, envelopes, together, mine, mascots, memes] = await Promise.all([
      getDoc(env.DB, `letter:${side}`),
      getDoc(env.DB, `envelopes:${side}`),
      getDoc(env.DB, 'together'),
      getDoc(env.DB, `mine:${side}`),
      getDoc(env.DB, 'mascots'),
      listMemes(env.DB, side),
    ]);
    return json({
      side,
      letter,
      envelopes: envelopes || [],
      together: together || {},
      mine: mine || {},
      mascots: mascots || {},
      memes,
    });
  }

  if (path === 'memes' || path.startsWith('memes/')) return memesRoute(req, env.DB, side, path.slice(6));
  if (m === 'POST' && path === 'meme-ideas') return memeIdeas(req, env, side);
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
    const from = side === 'vin' ? 'муж' : 'жена';
    system = 'Ты остроумный автор подписей к мемам. Пара: муж надолго уехал далеко, жена ждёт дома, '
      + 'у них общие питомцы. Мем — фото питомца с подписью, один отправляет другому. '
      + 'Подпись — реплика питомца от первого лица (в его роде) или смешной комментарий к фото, '
      + '6–12 слов, с конкретной бытовой деталью (диван, миска, тапки, одеяло, холодильник, прогулка), '
      + 'с неожиданным поворотом, как в хороших мемах. Не банально: не «я скучаю», не «люблю тебя» в лоб. '
      + 'Без пошлости, политики, войны, хэштегов, эмодзи. '
      + 'Примеры стиля: «Охраняю твою половину кровати. Никого не пускаю, даже себя… почти»; '
      + '«Мама сказала, что ты скоро. Я уже третий час смотрю на дверь». '
      + 'Ответь ТОЛЬКО JSON {"captions": [5 разных подписей]}.';
    user = `На фото: ${String(pet.name || 'питомец').slice(0, 30)} — ${String(pet.sp || 'питомец').slice(0, 60)}, `
      + `${pet.g === 'f' ? 'девочка (говорит в женском роде)' : 'мальчик (говорит в мужском роде)'}. `
      + 'Питомец живёт дома с мамой, папа далеко и его дома НЕТ. '
      + `Отправляет ${from} — ${to}. Если питомец к кому-то обращается — только к получателю, `
      + `${side === 'vin' ? '«мама»' : '«папа»'}; ${side === 'vin' ? 'папа' : 'мама'} — тот, кто отправил. `
      + `Повод: ${situation}. `
      + `Тон: смешно на ${funny}% (0 — нежно-мило), дерзко на ${bold}% (0 — очень нежно).`;
  }

  const out = await env.AI.run(AI_MODEL, {
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: 400,
    temperature: 0.9,
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
    const full = g.images?.downsized_medium || g.images?.original || {};
    const small = g.images?.fixed_width || full;
    return {
      id: g.id,
      preview: small.webp || small.url,
      url: full.url,
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
