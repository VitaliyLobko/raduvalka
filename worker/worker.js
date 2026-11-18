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
  // «Планы»: ідеї «куди підемо»; vote_vona / vote_vin: 1 — ❤️, 0 — ✕, NULL — ще не дивився(лась).
  // Чужий голос назовні не віддаємо; matched — коли обоє ❤️
  'CREATE TABLE IF NOT EXISTS ideas (id TEXT PRIMARY KEY, author TEXT NOT NULL, cat TEXT NOT NULL, '
    + 'title TEXT NOT NULL, note TEXT, vote_vona INTEGER, vote_vin INTEGER, done INTEGER NOT NULL DEFAULT 0, '
    + 'matched INTEGER, ai INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)',
  // Push: одна підписка — один телефон; side перезаписується, коли телефон перемикає половину.
  // tz — пояс телефону, щоб уночі сповіщення приходили без звуку
  'CREATE TABLE IF NOT EXISTS push (endpoint TEXT PRIMARY KEY, side TEXT NOT NULL, p256dh TEXT NOT NULL, '
    + 'auth TEXT NOT NULL, tz TEXT, created INTEGER NOT NULL)',
];

const SIDES = ['vona', 'vin'];
// wishes більше не приймаємо: старий список «Куда пойдём» перенесено в «Планы» разово
const TOGETHER_FIELDS = ['since', 'apartFrom', 'meet', 'phrase', 'bdayVona', 'bdayVin'];
const DATE_FIELD = /^\d{4}-\d{2}-\d{2}$/;
// stockFrom — 'YYYY-MM-DD', з якого дня запас підстраховує; нема — запас на паузі
const MINE_FIELDS = ['letter', 'seen', 'memesSeen', 'wishesSeen', 'repliesSeen', 'stockFrom'];
const DOC_KEY = /^(?:(?:letter|envelopes):(?:vona|vin)|mascots|together|voice)$/;
const IMG_NAME = /^[a-z0-9-]{1,64}$/;
const MAX_JSON = 64 * 1024;
const MAX_IMG = 1.4 * 1024 * 1024;
// Мемчик приходить уже в base64 (кодує телефон — у Worker на безкоштовному плані ~10 мс CPU);
// рядок D1 — до 2 МБ, тож base64 до 1,9 млн символів (≈1,4 МБ картинки)
const MAX_B64 = 1_900_000;
const MEME_TYPES = /^image\/(webp|jpeg|png|gif)$/;
const REACTIONS = ['😂', '❤️'];
// stock — «в запас»: без дати; утром, коли листа на сьогодні нема, cron робить із найстарішого «На утро»
const LETTER_KINDS = ['now', 'morning', 'env', 'gift', 'date', 'stock'];
// Ранок як у «На утро» на телефоні (js/write.js MORNING_HOUR); пояс — якщо отримувач ще не дав сповіщень
const MORNING_HOUR = 8;
const STOCK_TZ = 'Europe/Kyiv';
const MAX_LETTER = 4000;
// id листа, придуманий телефоном (черга без зв'язку): лише малі латинські й цифри
const CID = /^[a-z0-9]{16,32}$/;
// «Я в порядке»: старіше доби не приймаємо; push — на кожну відмітку, не старшу 12 год (давню з черги — тихо)
const CHECKIN_MAX_AGE = 24 * 3600 * 1000;
const CHECKIN_PUSH_AGE = 12 * 3600 * 1000;
// «Нужна помощь»: живе добу, координати й голос стираються на «Отбой» і після доби (cron)
const SOS_MAX_AGE = 24 * 3600 * 1000;
const SOS_AUDIO = /^audio\/(webm|ogg|mp4|mpeg|aac)(;[a-z0-9=.,\s-]*)?$/i;
const MAX_AUDIO_B64 = 900_000;
const MAX_AHEAD = 3 * 24 * 3600 * 1000;
const MAX_DATE_AHEAD = 400 * 24 * 3600 * 1000; // «К дате» — до року вперед

// Колонки, додані пізніше: ALTER на вже існуючій таблиці (помилка «вже є» — норма)
const MIGRATIONS = [
  'ALTER TABLE memes ADD COLUMN url TEXT',
  // «Подарок на выбор»: варіанти JSON [{ emoji, title, inside }] і номер обраного
  'ALTER TABLE letters ADD COLUMN gift TEXT',
  'ALTER TABLE letters ADD COLUMN chosen INTEGER',
  // Фото хотілки — назва в imgs
  'ALTER TABLE wishes ADD COLUMN img TEXT',
  // Підпис мемчика поверх картинки: 'top' | 'bottom'; null — під картинкою, як раніше
  'ALTER TABLE memes ADD COLUMN style TEXT',
  // Коли надіслано push про лист: NULL — ще ні (cron підбере «На утро» і «К дате»), 0 — не слати
  'ALTER TABLE letters ADD COLUMN pushed INTEGER',
  // Хотілка «к дате»: 'YYYY-MM-DD' або NULL
  'ALTER TABLE wishes ADD COLUMN due TEXT',
  // Стрічка «Письма»: відповідь на мемчик і час відповіді (щоб відправник побачив «новое»)
  'ALTER TABLE memes ADD COLUMN reply TEXT',
  'ALTER TABLE memes ADD COLUMN replied INTEGER',
  'ALTER TABLE letters ADD COLUMN replied INTEGER',
  // Коли лист поклали в запас (лишається й після видачі — відправник бачить «из запаса»)
  'ALTER TABLE letters ADD COLUMN stocked INTEGER',
  // Відповідь — нове повідомлення з цитатою того, на що відповідають (до 300 знаків)
  'ALTER TABLE letters ADD COLUMN quote TEXT',
  'ALTER TABLE memes ADD COLUMN quote TEXT',
  // Коли фото мемчика стерто, щоб звільнити місце в базі (сам мемчик із підписом лишається)
  'ALTER TABLE memes ADD COLUMN gone INTEGER',
];

// ИИ для конструктора мемчиків: підписи й пошукові запити
const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const GIF_URL = /^https:\/\/media\d*\.giphy\.com\/[\w./?=&-]+$/;

let schemaReady = false;
// Підпис схеми: змінились CREATE чи міграції — інший підпис, і схема прокрутиться ще раз
const SCHEMA_SIG = [...SCHEMA, ...MIGRATIONS].join(';').split('')
  .reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0).toString(36);

export default {
  async fetch(req, env, ctx) {
    const cors = corsHeaders(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const info = {};
      const res = await route(req, env, ctx, info);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      if (info.side && res.status < 400 && req.method !== 'GET' && !QUIET.test(info.path)) {
        ctx?.waitUntil?.(bumpPulse(env.DB, SIDES));
      }
      return res;
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(e);
      return json({ error: status === 500 ? 'server' : e.message }, status, cors);
    }
  },
  // Cron: спершу видати лист із запасу (без нього push не потрібен), потім сповістити про «На утро» і «К дате».
  // scheduledTime — час запуску; локальний /__cron підставляє свій, щоб тест не залежав від годинника
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await ensureSchema(env.DB);
      await releaseStock(env.DB, event.scheduledTime || Date.now());
      await cronPush(env);
      await sosCleanup(env.DB);
      await photoCleanup(env);
    })());
  },
};

async function route(req, env, ctx, info = {}) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/')) return json({ ok: true, app: 'raduvalka' });

  const side = await whoIs(req, env);
  if (!side) throw fail(401, 'key');
  await ensureSchema(env.DB);

  const path = url.pathname.slice(5);
  const m = req.method;
  const notify = pusher(req, env, ctx);
  info.side = side;
  info.path = path;

  if (m === 'GET' && path === 'pulse') {
    const [v, partnerPush, sos] = await Promise.all([
      getDoc(env.DB, `pulse:${side}`),
      hasPush(env.DB, other(side)),
      // «Нужна помощь» — окрема мітка: телефон малює її одразу, навіть коли решта оновлення чекає
      env.DB.prepare("SELECT MAX(updated) u FROM docs WHERE k IN ('sos:vona', 'sos:vin')").first('u'),
    ]);
    return json({ v: v || 0, partnerPush, sos: sos || 0 });
  }

  if (path === 'push-key' || path === 'push' || path === 'push-test') return pushRoute(req, env, side, path);

  if (m === 'GET' && path === 'boot') {
    const [letter, gift, envelopes, partnerEnvelopes, together, mine, mascots, memes, checkins, welcome] = await Promise.all([
      dayLetter(env.DB, side),
      pendingGift(env.DB, side),
      myEnvelopes(env.DB, side),
      getDoc(env.DB, `envelopes:${other(side)}`),
      getDoc(env.DB, 'together'),
      getDoc(env.DB, `mine:${side}`),
      getDoc(env.DB, 'mascots'),
      // Стрічку тягне feed сторінками; тут — лише свіжі, для крапки на марці до першого feed
      listMemes(env.DB, side, 60),
      checkinsOf(env.DB, side),
      getDoc(env.DB, `letter:${side}`),
    ]);
    return json({
      side,
      pulse: (await getDoc(env.DB, `pulse:${side}`)) || 0,
      checkins,
      letter,
      // Привітальний лист-заготовка — першим повідомленням чату назавжди, а не лише поки нема справжніх
      welcome: welcome || null,
      gift,
      envelopes,
      // Для «В конверт»: лише назви її/його конвертів, без самих записок
      partnerEnvelopes: (partnerEnvelopes || []).map(({ id, emoji, label }) => ({ id, emoji, label })),
      together: together || {},
      mine: mine || {},
      mascots: mascots || {},
      // Чи дійде до другого push — від цього залежить, чи обіцяти «узнает»
      partnerPush: await hasPush(env.DB, other(side)),
      // Підпис під листами другого (doc signs: { vona, vin }), без нього — звичайне «Твой/Твоя»
      partnerSign: (await getDoc(env.DB, 'signs'))?.[other(side)] || null,
      // Версії фото поз (час заливки): телефон бере їх зі свого кешу, поки версія та сама
      imgs: await imgVersions(env.DB, mascots),
      memes,
    });
  }

  if (m === 'GET' && path === 'letter') {
    const [letter, gift, checkins] = await Promise.all([dayLetter(env.DB, side), pendingGift(env.DB, side), checkinsOf(env.DB, side)]);
    return json({ letter, gift, checkins });
  }
  if (m === 'POST' && path === 'checkin') return checkin(req, env.DB, side, notify);
  if (path === 'sos' || path.startsWith('sos/')) return sosRoute(req, env.DB, side, path, notify);
  if (m === 'GET' && path === 'envelopes') return json(await myEnvelopes(env.DB, side));
  const envEvent = path.match(/^envelopes\/([\w-]{1,40})\/(empty|opened)$/);
  if (m === 'POST' && envEvent) return envelopeEvent(env.DB, side, envEvent[1], envEvent[2], notify);
  if (path === 'letters' || path.startsWith('letters/')) return lettersRoute(req, env.DB, side, path.slice(8), notify);

  if (path === 'wishes' || path.startsWith('wishes/')) return wishesRoute(req, env.DB, side, path.slice(7), notify);
  if (path === 'plans' || path.startsWith('plans/')) return plansRoute(req, env.DB, side, path.slice(6), notify);
  if (m === 'POST' && path === 'plan-ideas') return planIdeas(req, env, side);
  if (path === 'memes' || path.startsWith('memes/')) return memesRoute(req, env.DB, side, path.slice(6), notify);
  if (m === 'POST' && path === 'meme-ideas') return memeIdeas(req, env, side);
  if (m === 'POST' && path === 'letter-ideas') return letterIdeas(req, env, side);
  if (m === 'POST' && path === 'wish-from-url') return wishFromUrl(req, env);
  if (m === 'POST' && path === 'wish-image') return wishImage(req);
  if (m === 'GET' && path === 'gifs') return gifSearch(url, env);
  if (m === 'GET' && path === 'feed') return json(await feedPage(env.DB, side, url));

  if (m === 'PUT' && path === 'together') {
    const patch = pick(await readJson(req), TOGETHER_FIELDS);
    // Дні народження — лише дата або null (стерли)
    for (const k of ['bdayVona', 'bdayVin']) if (k in patch && patch[k] !== null && !DATE_FIELD.test(String(patch[k]))) delete patch[k];
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
    if (m === 'GET') return getImg(env.DB, name, url.searchParams.has('v'));
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
    'access-control-allow-headers': 'authorization, content-type, x-no-push',
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

// Свіжий ізолят: один запит, якщо схема вже ця; інакше — усі CREATE і міграції, і запамʼятати підпис
async function ensureSchema(db) {
  if (schemaReady) return;
  const done = await getDoc(db, 'schema').catch(() => null);
  if (done !== SCHEMA_SIG) {
    await db.batch(SCHEMA.map((q) => db.prepare(q)));
    let failed = false;
    for (const q of MIGRATIONS) {
      try {
        await db.prepare(q).run();
      } catch (e) {
        // Колонка вже є — це норма; інша помилка — підпис не пишемо, наступний ізолят спробує ще
        if (!/duplicate column|already exists/i.test(String(e?.message || e))) failed = true;
      }
    }
    if (!failed) await putDoc(db, 'schema', SCHEMA_SIG);
  }
  schemaReady = true;
}

async function imgVersions(db, mascots) {
  const names = [...new Set(Object.values(mascots || {}).flatMap((x) => Object.values(x.poses || {})))].slice(0, 90);
  if (!names.length) return {};
  const { results } = await db.prepare(`SELECT name, updated FROM imgs WHERE name IN (${names.map(() => '?').join(', ')})`)
    .bind(...names).all();
  return Object.fromEntries(results.map((r) => [r.name, r.updated]));
}

// Мітка змін для живого оновлення: відкрита Радовалка раз на 15 с питає її й дотягує свіже, коли змінилась.
// Ставиться після кожного запису й перед кожним push (так і cron). Підписка на push, ШІ-підказки й розбір
// посилань нічого спільного не міняють — інакше два відкриті телефони будили б один одного без кінця
const QUIET = /^(push|push-key|push-test|letter-ideas|meme-ideas|plan-ideas|wish-from-url|wish-image)$/;
async function bumpPulse(db, sides) {
  const now = Date.now();
  await Promise.all(sides.map((s) => putDoc(db, `pulse:${s}`, now)));
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

// versioned — у запиті ?v= (час заливки): такий файл уже ніколи не зміниться
async function getImg(db, name, versioned) {
  const row = await db.prepare('SELECT type, data FROM imgs WHERE name = ?').bind(name).first();
  if (!row) throw fail(404, 'not found');
  const bin = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
  return new Response(bin, {
    headers: { 'content-type': row.type, 'cache-control': versioned ? 'private, max-age=31536000, immutable' : 'private, max-age=86400' },
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
async function memesRoute(req, db, side, rest, notify) {
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
      style: ['top', 'bottom'].includes(body.style) ? body.style : null,
      quote: quoteOf(body),
      created: Date.now(),
      reaction: null,
    };
    const insertMeme = () => db.prepare(
      'INSERT INTO memes (id, src, dst, img, url, caption, style, quote, created, reaction) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(meme.id, meme.src, meme.dst, meme.img, meme.url, meme.caption, meme.caption ? meme.style : null, meme.quote, meme.created, null);

    // GIF із GIPHY — лише посилання, файл не зберігаємо
    if (body.gif) {
      const gifUrl = String(body.gif.url || '');
      if (!GIF_URL.test(gifUrl)) throw fail(400, 'gif');
      meme.url = gifUrl;
      await insertMeme().run();
      notify.send(meme.dst, meme.quote ? replyNote(side, quoteOn(body), 'gif') : memeNote(side, true));
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
    notify.send(meme.dst, meme.quote ? replyNote(side, quoteOn(body), 'photo') : memeNote(side));
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

  // Реакцію й відповідь ставить лише отримувач; null — зняти. Лише поля із запиту:
  // відповідь без reaction не має стерти реакцію
  if (m === 'PUT' && !sub) {
    if (meme.dst !== side) throw fail(403, 'forbidden');
    const b = await readJson(req);
    const next = { ...meme };
    if ('reaction' in b) {
      if (b.reaction !== null && !REACTIONS.includes(b.reaction)) throw fail(400, 'reaction');
      next.reaction = b.reaction;
    }
    if ('reply' in b) {
      next.reply = String(b.reply || '').trim().slice(0, MAX_LETTER) || null;
      next.replied = next.reply ? Date.now() : null;
    }
    await db.prepare('UPDATE memes SET reaction = ?, reply = ?, replied = ? WHERE id = ?')
      .bind(next.reaction ?? null, next.reply ?? null, next.replied ?? null, id).run();
    if (next.reply && next.reply !== meme.reply) notify.send(meme.src, replyNote(side, meme.url ? 'gif' : 'photo'));
    return json(view(next, side));
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
    // Справжня календарна дата, інакше — без дати
    due: /^\d{4}-\d{2}-\d{2}$/.test(String(b.due || '')) && !Number.isNaN(Date.parse(b.due)) ? String(b.due) : null,
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
async function wishesRoute(req, db, side, rest, notify) {
  const m = req.method;
  if (m === 'GET' && !rest) {
    const { results } = await db.prepare('SELECT * FROM wishes ORDER BY hot DESC, created DESC').all();
    const view = (r, withMark) => ({
      id: r.id, title: r.title, price: r.price, link: r.link, note: r.note, hot: !!r.hot, due: r.due || null, img: r.img || null, created: r.created,
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
      db.prepare('INSERT INTO wishes (id, owner, title, price, link, note, hot, created, img, due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, side, f.title, f.price, f.link, f.note, f.hot, created, img?.name ?? null, f.due),
    ]);
    notify.send(other(side), wishNote(side));
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
        db.prepare('UPDATE wishes SET title = ?, price = ?, link = ?, note = ?, hot = ?, img = ?, due = ? WHERE id = ?')
          .bind(f.title, f.price, f.link, f.note, f.hot, imgName, f.due, r.id),
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
// Лист до особливої дати цілу добу головніший за будь-який інший
async function dayLetter(db, side) {
  const now = Date.now();
  const special = await db.prepare(
    "SELECT * FROM letters WHERE dst = ? AND kind = 'date' AND at <= ? AND at > ? ORDER BY at DESC LIMIT 1",
  ).bind(side, now, now - 24 * 3600 * 1000).first();
  const r = special || await db.prepare(
    "SELECT * FROM letters WHERE dst = ? AND kind IN ('now', 'morning', 'date') AND at <= ? ORDER BY at DESC, created DESC LIMIT 1",
  ).bind(side, now).first();
  if (!r) return getDoc(db, `letter:${side}`);
  return { id: r.id, at: r.at, text: r.text, mascot: r.mascot, opened: !!r.opened, liked: !!r.liked, reply: r.reply, special: !!special };
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
// Події конверта — другому push. empty: відкрила, а читати нічого (що прочитано — знає лише її телефон), — дописати;
// opened: відкрила конверт-сигнал («тяжёлый день», «скучаешь») — написати їй. Не частіше: порожній — раз на добу,
// сигнал — раз на 6 год на конверт
const ENV_EVENT_GAP = { empty: 24 * 3600 * 1000, opened: 6 * 3600 * 1000 };

const hasPush = async (db, side) => !!(await db.prepare('SELECT 1 FROM push WHERE side = ? LIMIT 1').bind(side).first());

async function envelopeEvent(db, side, id, what, notify) {
  const e = ((await getDoc(db, `envelopes:${side}`)) || []).find((x) => x.id === id);
  if (!e || (what === 'opened' && !e.signal)) throw fail(404, 'not found');
  // reaches — у другого є куди слати push; ні — застосунок не обіцяє «узнает»
  const reaches = await hasPush(db, other(side));
  // Нема підписки — і лік не заводимо: щойно підпишеться, наступне відкриття дійде
  if (!reaches) return json({ ok: true, sent: false, reaches });
  const key = `env${what}:${side}:${id}`;
  const last = await getDoc(db, key);
  if (last && Date.now() - last < ENV_EVENT_GAP[what]) return json({ ok: true, sent: false, reaches });
  await putDoc(db, key, Date.now());
  notify.send(other(side), what === 'empty' ? envEmptyNote(side, e) : envOpenedNote(side, e));
  return json({ ok: true, sent: true, reaches });
}

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

async function lettersRoute(req, db, side, rest, notify) {
  const m = req.method;

  // Надіслані мною — з тим, що вже сталося на тому боці
  if (m === 'GET' && rest === 'sent') {
    const { results } = await db.prepare(
      "SELECT id, kind, env, text, quote, at, created, opened, liked, reply, replied, gift, chosen, stocked FROM letters WHERE src = ? AND kind != 'stock' "
        + 'ORDER BY created DESC LIMIT 60',
    ).bind(side).all();
    return json(results.map((r) => ({ ...r, gift: r.gift ? JSON.parse(r.gift) : null, opened: !!r.opened, liked: !!r.liked })));
  }

  // Мій запас — лише відправнику, від найстарішого (його видадуть першим)
  if (m === 'GET' && rest === 'stock') {
    const { results } = await db.prepare(
      "SELECT id, text, mascot, created FROM letters WHERE src = ? AND kind = 'stock' ORDER BY created",
    ).bind(side).all();
    return json(results);
  }

  // «Мне»: усі отримані листи з застосунку, чий час настав; подарунок — лише вже обраний
  if (m === 'GET' && rest === 'inbox') {
    const { results } = await db.prepare(
      "SELECT id, kind, text, quote, at, mascot, opened, liked, reply, gift, chosen FROM letters WHERE dst = ? AND at <= ? "
        + "AND (kind IN ('now', 'morning', 'date') OR (kind = 'gift' AND chosen IS NOT NULL)) ORDER BY at DESC LIMIT 60",
    ).bind(side, Date.now()).all();
    return json(results.map((r) => ({
      id: r.id, kind: r.kind, text: r.text, quote: r.quote || null, at: r.at, mascot: r.mascot,
      opened: !!r.opened, liked: !!r.liked, reply: r.reply,
      ...(r.kind === 'gift' ? { gift: giftView(r) } : {}),
    })));
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
    if (kind === 'date') at = Math.max(now, Math.min(now + MAX_DATE_AHEAD, Number(b.at) || now));
    let envId = null;
    if (kind === 'env') {
      envId = String(b.env || '');
      const theirs = (await getDoc(db, `envelopes:${other(side)}`)) || [];
      if (!theirs.some((e) => e.id === envId)) throw fail(400, 'env');
    }
    const mascots = (await getDoc(db, 'mascots')) || {};
    const mascot = mascots[b.mascot] ? String(b.mascot) : null;
    // id від телефона (cid): повтор після втраченої відповіді віддає той самий лист — без другого листа й другого push
    const cid = typeof b.cid === 'string' && CID.test(b.cid) ? b.cid : null;
    if (cid) {
      const dup = await db.prepare('SELECT * FROM letters WHERE id = ?').bind(cid).first();
      if (dup) {
        if (dup.src !== side) throw fail(409, 'cid');
        return json({
          id: dup.id, kind: dup.kind, env: dup.env, text: dup.text, quote: dup.quote || null, at: dup.at, created: dup.created,
          opened: !!dup.opened, liked: !!dup.liked, reply: dup.reply, gift: dup.gift && JSON.parse(dup.gift), chosen: dup.chosen, again: true,
        });
      }
    }
    const id = cid || crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const stocked = kind === 'stock' ? now : null;
    // «Сейчас» і подарунок — сповіщаємо одразу; «На утро» і «К дате» — cron, коли настане час; записки в конверт — ні
    const later = (kind === 'morning' || kind === 'date') && notify.on;
    const quote = quoteOf(b);
    await db.prepare(
      'INSERT INTO letters (id, src, dst, kind, env, mascot, text, quote, at, created, gift, pushed, stocked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, side, other(side), kind, envId, mascot, text, quote, at, now, gift, later ? null : 0, stocked).run();
    if (kind === 'now' && quote) notify.send(other(side), replyNote(side, quoteOn(b)));
    else if (kind === 'now' || kind === 'gift') notify.send(other(side), letterNote(kind, mascots[mascot]));
    return json({ id, kind, env: envId, text, quote, at, created: now, opened: false, liked: false, reply: null, gift: gift && JSON.parse(gift), chosen: null }, 201);
  }

  const r = await db.prepare('SELECT * FROM letters WHERE id = ?').bind(rest).first();
  // Лист у запасі для отримувача ще не існує
  if (!r || (r.src !== side && r.dst !== side) || (r.kind === 'stock' && r.dst === side)) throw fail(404, 'not found');

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
    // ❤️ — відправнику push, але раз на лист: зняла й поставила знову — без повтору
    if (b.liked && !r.liked && !(await getDoc(db, `likepush:${r.id}`))) {
      await putDoc(db, `likepush:${r.id}`, Date.now());
      notify.send(r.src, likeNote(side, r.kind));
    }
    if ('reply' in b) {
      const reply = String(b.reply || '').trim().slice(0, MAX_LETTER) || null;
      sets.push('reply = ?', 'replied = ?');
      args.push(reply, reply ? Date.now() : null);
      // Відповідь — значить, лист прочитано
      if (reply && !b.opened) { sets.push('opened = COALESCE(opened, ?)'); args.push(Date.now()); }
      if (reply && reply !== r.reply) notify.send(r.src, replyNote(side, 'letter'));
    }
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

async function listMemes(db, side, limit = 300) {
  const { results } = await db.prepare(
    'SELECT * FROM memes WHERE src = ? OR dst = ? ORDER BY created DESC LIMIT ?',
  ).bind(side, side, limit).all();
  return results.map((r) => view(r, side));
}

// Стрічка «Письма» сторінками: отримані листи, мої листи й мемчики одним зрізом за часом показу (як їх ставить чат).
// before — віддати старіше за цей час (нема — найсвіжіше). Межа сторінки — horizon: усе, що не старіше за неї,
// уже тут (і рівне їй теж), тож наступна сторінка — before=horizon без дублів і пропусків; more — чи є старіше
const FEED_PAGE = 40;
async function feedPage(db, side, url) {
  const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
  const n = Math.min(100, Math.max(10, Number(url.searchParams.get('limit')) || FEED_PAGE));
  const take = n + 1;
  const sentAt = "CASE WHEN kind = 'env' THEN created ELSE at END";
  const [inbox, sent, memes, news] = await Promise.all([
    db.prepare('SELECT id, kind, text, quote, at, mascot, opened, liked, reply, gift, chosen, at AS t FROM letters '
      + "WHERE dst = ? AND at <= ? AND at < ? AND (kind IN ('now', 'morning', 'date') OR (kind = 'gift' AND chosen IS NOT NULL)) "
      + 'ORDER BY at DESC LIMIT ?').bind(side, Date.now(), before, take).all(),
    db.prepare(`SELECT id, kind, env, text, quote, at, created, opened, liked, reply, replied, gift, chosen, stocked, ${sentAt} AS t `
      + `FROM letters WHERE src = ? AND kind != 'stock' AND ${sentAt} < ? ORDER BY t DESC LIMIT ?`).bind(side, before, take).all(),
    db.prepare('SELECT *, created AS t FROM memes WHERE (src = ? OR dst = ?) AND created < ? ORDER BY created DESC LIMIT ?')
      .bind(side, side, before, take).all(),
    // Новини в чаті: другий додав хотілку чи план (ідеї від ШІ — не новина)
    db.prepare("SELECT 'wish' AS kind, id, title, created AS t FROM wishes WHERE owner = ? AND created < ? "
      + "UNION ALL SELECT 'plan' AS kind, id, title, created AS t FROM ideas WHERE author = ? AND ai = 0 AND created < ? "
      + 'ORDER BY t DESC LIMIT ?').bind(other(side), before, other(side), before, take).all(),
  ]);
  const parts = [['in', inbox.results], ['out', sent.results], ['meme', memes.results], ['news', news.results]];
  const all = parts.flatMap(([s, rows]) => rows.map((r) => ({ s, r }))).sort((a, b) => b.r.t - a.r.t);
  let page = all;
  let horizon = 0;
  let more = false;
  if (all.length > n) {
    horizon = all[n - 1].r.t;
    page = all.filter((x) => x.r.t >= horizon);
    more = true;
  }
  const of = (s) => page.filter((x) => x.s === s).map((x) => x.r);
  return {
    inbox: of('in').map((r) => ({
      id: r.id, kind: r.kind, text: r.text, quote: r.quote || null, at: r.at, mascot: r.mascot,
      opened: !!r.opened, liked: !!r.liked, reply: r.reply,
      ...(r.kind === 'gift' ? { gift: giftView(r) } : {}),
    })),
    sent: of('out').map(({ t, ...r }) => ({ ...r, gift: r.gift ? JSON.parse(r.gift) : null, opened: !!r.opened, liked: !!r.liked })),
    memes: of('meme').map((r) => view(r, side)),
    news: of('news').map((r) => ({ kind: r.kind, id: r.id, title: r.title, at: r.t })),
    more,
    horizon,
  };
}

// Для телефона: mine — «я надіслав», без внутрішніх src/dst/img
function view(r, side) {
  return {
    id: r.id, mine: r.src === side, url: r.url || null, caption: r.caption, style: r.style || null, quote: r.quote || null,
    created: r.created, reaction: r.reaction,
    reply: r.reply || null, replied: r.replied || null, gone: r.gone || null,
  };
}

// Мемчики: повод і повзунки → 8 підписів (bestCaptions лишає 5) або 6 англійських запитів для GIF
// Що на фото — коротко словами, щоб підпис був саме про нього; підписи далі пише AI_MODEL.
// Llama 4 Scout: із чотирьох (замір 18.11) точно бачить деталі, ~4,5 с; mistral швидша, але вигадує; gemma акаунту недоступна
const VISION_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';
const MAX_VISION_B64 = 400_000;
async function describePhoto(env, b64, type) {
  const ask = 'Опиши фото для автора подписи: кто или что на нём, что делает, выражение, одна смешная или трогательная деталь. '
    + '1–2 коротких предложения по-русски, без вступлений.';
  try {
    const out = await env.AI.run(VISION_MODEL, {
      messages: [{ role: 'user', content: [{ type: 'text', text: ask }, { type: 'image_url', image_url: { url: `data:${type};base64,${b64}` } }] }],
      max_tokens: 160,
    });
    return replyText(out).replace(/\s+/g, ' ').trim().slice(0, 300);
  } catch {
    // Не роздивилась — підписи однаково будуть, просто загальніші
    return '';
  }
}

// Пристрасть (флірт, «секси»): натяки й бажання, але без грубих і відвертих слів — інакше модель або відмовляє, або пошлить
const passionTone = (p) => (p < 10 ? ''
  : p < 70 ? 'Флирт — обязательно в каждом варианте: заигрывай, сделай комплимент, намекни на поцелуи и объятия, '
      + 'лёгкая провокация. Без грубых и откровенных слов. '
    : 'Страсть — обязательно в каждом варианте: желание, нетерпение, «хочу к тебе», поцелуи, чувственные намёки. '
      + 'Красиво, без грубых и откровенных слов и без анатомии. ');

async function memeIdeas(req, env, side) {
  if (!env.AI) throw fail(503, 'ai');
  // Зменшене фото для моделі із зором — 60–80 КБ base64, більше за звичайний ліміт JSON
  const b = await readJson(req, MAX_VISION_B64 + 8192);
  const level = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const situation = String(b.situation || '').trim().slice(0, 200) || 'просто так, порадовать';
  const funny = level(b.funny);
  const bold = level(b.bold);

  let system;
  let user;
  if (b.kind === 'gif') {
    system = 'You pick GIPHY search queries for a loving couple who live apart for a while and send each other GIFs. '
      + 'GIPHY works best with short, concrete, visual English queries: an emotion or action plus a subject '
      + '(e.g. "sleepy cat hug", "dog waiting door", "happy dance minions", "forehead kiss"). '
      + 'Reply ONLY with JSON {"queries": [{"label": "...", "q": "..."}, …6 items]}: '
      + '"q" — the English query, 2-4 words; "label" — the same idea in natural Russian, 1-3 words, for a button. '
      + 'Make the six different from each other: different emotions, subjects and angles of the situation. '
      + 'No politics, no war, no violence, nothing explicit.';
    user = `Situation (Russian): ${situation}. Mood: ${funny}% funny (0 = cute), ${bold}% cheeky (0 = tender). `
      + (level(b.passion) >= 70
        ? 'Passion: every query is romantic desire — kisses, "come here", longing to be together; people and cartoons are fine. '
        : level(b.passion) >= 10 ? 'Flirt: every query is playful flirting — winks, blown kisses, seductive looks. ' : '')
      + 'Subjects: mostly animals — cats, dogs, cute creatures; one or two may be people or cartoon reactions if they fit better.';
  } else {
    // Фото — бачить модель із зором; її опис іде разом зі словами людини
    const img = String(b.image || '');
    const seen = img && img.length <= MAX_VISION_B64 && /^[A-Za-z0-9+/]+=*$/.test(img)
      ? await describePhoto(env, img, MEME_TYPES.test(String(b.type || '')) ? String(b.type) : 'image/jpeg')
      : '';
    const desc = [seen, String(b.desc || '').trim()].filter(Boolean).join('. ').slice(0, 400);
    // Підпис не переказує фото (його й так видно), а чіпляється за деталь; заборонені шаблони — ними модель
    // закривала все: «Пес тебя ждёт», «Шапка на собаке, мысль о тебе» (замір 18.11)
    system = 'Ты остроумный автор подписей к мемам и открыткам. Пара: муж надолго уехал далеко, жена ждёт дома. '
      + 'Один отправляет другому картинку, фото или гифку с подписью — её приносит их питомец. Подпись — от лица отправителя, '
      + 'обращение к любимому человеку на «ты». '
      + 'НЕ описывай картинку — получатель её видит. Зацепись за одну деталь и сделай из неё шутку, признание или намёк. '
      + 'Используй разные ходы: реплика того, кто на картинке; сравнение с собой или с вами двумя; неожиданный вывод из детали; '
      + 'что сделаешь при встрече; вопрос с подвохом. '
      + 'Запрещены шаблоны: «ждёт тебя», «скучает», «думаю о тебе», «шлёт привет», «приветствует», «люблю тебя» в лоб. '
      + 'Без политики, войны, хэштегов, грубых и откровенных слов. Никогда не используй слова «мама», «папа». '
      + 'Ответь ТОЛЬКО JSON {"captions": [8 разных подписей]}.';
    user = (side === 'vin' ? 'От мужа жене. ' : 'От жены мужу. ')
      + (desc ? `На картинке: ${desc}. ` : 'Что на картинке — неизвестно, подпись должна подходить к любой. ')
      + `Повод: ${situation}. `
      + `Тон: смешно на ${funny}% (0 — нежно-мило), дерзко на ${bold}% (0 — очень нежно). `
      + passionTone(level(b.passion))
      + 'Длина каждой подписи: 3–10 слов, чтобы влезла на картинку. Эмодзи: не больше одного на подпись, можно без.';
  }

  const out = await env.AI.run(AI_MODEL, {
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: b.kind === 'gif' ? 400 : 700,
    temperature: 0.9,
  });
  const parsed = parseJsonReply(out);
  const list = (a) => (Array.isArray(a) ? a : []).map((x) => String(x).trim()).filter(Boolean);
  // Запити GIF — { label російською, q англійською }; рядок замість об'єкта теж приймаємо
  const queries = (Array.isArray(parsed.queries) ? parsed.queries : [])
    .map((x) => (typeof x === 'string' ? { label: x, q: x } : { label: String(x?.label || x?.q || ''), q: String(x?.q || '') }))
    .map((x) => ({ label: x.label.trim().slice(0, 40), q: x.q.trim().slice(0, 60) }))
    .filter((x) => x.q && x.label);
  if (b.kind === 'gif') return json({ queries: queries.slice(0, 6) });
  // llama іноді вставляє англійські слова посеред російської — такі підписи відкидаємо
  const captions = [...new Set(list(parsed.captions).map((c) => c.replace(/^["«]|["»]$/g, '')).filter((c) => !/[a-z]{3,}/i.test(c)))];
  const want = [`Повод: ${situation}`, passionTone(level(b.passion)).trim()].filter(Boolean).join('. ');
  return json({ captions: await bestCaptions(env, captions, want) });
}

// Текст відповіді моделі → JSON-обʼєкт (або {})
const replyText = (out) => (typeof out?.response === 'string' ? out.response
  : out?.response ? JSON.stringify(out.response)
    : out?.choices?.[0]?.message?.content
      || out?.output_text
      || out?.output?.find?.((x) => x?.type === 'message')?.content?.find?.((c) => c?.text)?.text
      || '');

// Відповідь простим текстом (один лист): без JSON — абзаци-переноси всередині JSON-рядка ламали розбір
async function askText(env, system, user, maxTokens, temperature = 0.9) {
  const out = await env.AI.run(AI_MODEL, {
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: maxTokens,
    temperature,
  });
  return replyText(out).replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    // Обгортки, які модель іноді додає: «Вот вариант:», лапки навколо всього тексту
    .replace(/^(вот|вариант)[^\n]{0,40}:\s*/i, '')
    .replace(/^["«]([\s\S]*)["»]$/, '$1')
    .trim();
}

function parseJsonReply(out) {
  const text = replyText(out);
  try {
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch {
    return {};
  }
}

// Другий прохід: модель-редактор обирає 5 найсмішніших і найтепліших із 8; не вийшло — перші 5
async function bestCaptions(env, captions, situation) {
  if (captions.length <= 5) return captions;
  try {
    const out = await env.AI.run(AI_MODEL, {
      messages: [
        {
          role: 'system',
          content: 'Ты строгий редактор мемов. Из пронумерованных подписей выбери 5 лучших: точно в заданном тоне, '
            + 'неожиданных, грамматически чистых, без банальностей, без пересказа картинки и без повторов друг друга. Лучшую — первой. '
            + 'Ответь ТОЛЬКО JSON {"best": [номера]}.',
        },
        { role: 'user', content: `${situation}.\n${captions.map((c, i) => `${i + 1}. ${c}`).join('\n')}` },
      ],
      max_tokens: 60,
      temperature: 0.2,
    });
    const picked = [...new Set((parseJsonReply(out).best || []).map(Number))]
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= captions.length)
      .map((n) => captions[n - 1]);
    const rest = captions.filter((c) => !picked.includes(c));
    return [...picked, ...rest].slice(0, 5);
  } catch {
    return captions.slice(0, 5);
  }
}

// Відповідь моделі: текст із response або choices, з нього — JSON-обʼєкт
async function askAI(env, system, user, maxTokens, temperature = 0.9) {
  const out = await env.AI.run(AI_MODEL, {
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: maxTokens,
    temperature,
  });
  return parseJsonReply(out);
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
  const he = side === 'vin';
  // Як вони кличуть одне одного — з бази (voice.names[сторона] — як ця сторона звертається до другої)
  const names = (voice?.names?.[side] || []).map((x) => `«${String(x).slice(0, 30)}»`).join(', ');
  const call = names
    ? ` Обращайся к получателю так, как они правда зовут друг друга: ${names} — 1–2 раза на всё письмо, не больше; `
      + 'не используй вместо них «любимая», «любимый», «дорогая», «дорогой», «милая», «милый».'
    : '';
  // Рід — без прикладів дієслів: приклад «я написал» модель вставляла дослівно майже в кожну чернетку
  const who = (he
    ? 'Пишет муж жене, от первого лица: о себе — в мужском роде, к ней — в женском. Он далеко и надолго, она ждёт дома.'
    : 'Пишет жена мужу, от первого лица: о себе — в женском роде, к нему — в мужском. Она дома, он далеко и надолго.') + call;
  // Замір 17.11: модель вигадувала спогади й поїздки, обіцяла «скоро вернусь» і писала шаблонами —
  // забороняємо конкретно те, що бачили, а обіцянки ще й відсіює код (FAKE_SOON)
  const rules = 'Никаких слов «мама», «папа», «хозяин», «хозяйка». Без политики, войны, пошлости, хэштегов. '
    + 'Ты ничего не знаешь об их жизни, кроме того, что написано здесь: не придумывай события, воспоминания, места, '
    + 'поездки, планы, что было сегодня или вчера. Когда он вернётся, неизвестно: не обещай сроков, никаких «скоро». '
    + 'Не пиши: «делает мою жизнь ярче», «приносит свет», «как в сказке», «как наши сны», «заставляет меня чувствовать», '
    + '«не просто X, а Y», «Я скучал(а) по тебе» в начале, сравнений «ты как звезда / море / ветер», «меняешь мир». '
    + 'Живым разговорным языком, короткими фразами, как пишут близкому. '
    + 'Только русский язык. Абзацы разделяй переводом строки \n.';
  // Буквальне «\n» → перенос; пробіли в кінці рядків і порожні рядки підряд — геть
  const clean = (x) => String(x || '').replace(/\\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  if (b.mode === 'fix') {
    const text = String(b.text || '').trim().slice(0, MAX_LETTER);
    if (!text) throw fail(400, 'text');
    const how = {
      warm: 'сделай теплее и нежнее',
      short: 'сократи примерно вдвое, оставив главное',
      fix: 'исправь только орфографию, пунктуацию и явные ошибки, слова и стиль не меняй',
      fun: 'добавь лёгкого юмора',
    }[b.fix] || 'сделай теплее';
    // Обіцянку чи заборонене слово, яких не було в тексті автора, не повертаємо: одна повторна спроба, далі — «не вийшло»
    for (let attempt = 0; attempt < 2; attempt++) {
      const out = await askAI(env, `Ты бережный редактор личных писем. ${who} ${rules} `
        + 'Сохрани смысл, факты и голос автора, ничего не выдумывай. Ответь ТОЛЬКО JSON {"text": "..."}.',
      `Задача: ${how}.\nПисьмо:\n${text}`, 1200);
      const fixed = clean(out.text);
      if (fixed && draftOk(fixed, text)) return json({ text: fixed });
    }
    return json({ text: '' });
  }

  // Привід — з погляду того, хто пише: «тяжёлый день» — у отримувача, а не в автора
  const REASON_TASK = {
    'скучаю': 'сказать, что скучаешь по получателю',
    'доброе утро': 'пожелать доброго утра',
    'спокойной ночи': 'пожелать спокойной ночи',
    'тяжёлый день': 'у получателя тяжёлый день — поддержать его',
    'горжусь тобой': 'сказать получателю, что гордишься им',
    'спасибо': 'поблагодарить получателя',
    'просто так': 'просто сказать, что любишь',
  };
  const raw = String(b.reason || '').trim().slice(0, 200);
  const reason = REASON_TASK[raw] || raw || REASON_TASK['просто так'];
  const words = String(b.words || '').trim().slice(0, 400);
  const long = level(b.long);
  // Коротше, ніж було: довгі чернетки розпливались у загальні слова (прохання 17.11)
  const sentences = long < 34 ? '1–2 коротких предложения' : long < 67 ? '2–3 предложения' : '4–5 предложений';
  const focus = {
    today: 'спросить, как прошёл день у получателя, и пожелать хорошего вечера; ничего не утверждать о том, каким был день',
    future: 'помечтать о встрече в общих словах: без дат, без «скоро», без поездок и планов, которых нет в словах автора',
  }[b.focus] || '';
  // Улюбленці й їхня фраза — лише в одному варіанті, і обирає його код, а не модель (правило в промпті вона ігнорувала).
  // Рід — з mascots (g), інакше модель робить дівчинку хлопчиком
  const petList = Object.values(mascots || {}).filter((x) => x?.name);
  const pet = petList.length ? petList[Math.floor(Math.random() * petList.length)] : null;
  const slot = (i) => {
    if (pet && i === 0) {
      const p = `${String(pet.name).slice(0, 30)} (${String(pet.sp || 'питомец').slice(0, 60)}, ${pet.g === 'f' ? 'она' : 'он'})`;
      return `можно упомянуть питомца ${p}${he ? ' — он дома с ней, автор может только спросить о нём' : ''}; `
        + 'ничего не придумывай о нём: ни окраса, ни повадок, ни того, что он сейчас делает; других питомцев не называй';
    }
    if (together?.phrase && i === 1 && Math.random() < 0.5) return `можно закончить их общей фразой «${String(together.phrase).slice(0, 120)}»`;
    return 'без питомцев и без общих фраз';
  };
  // Кожен варіант — окремий запит зі своїм початком: в одному запиті модель переносила улюбленця й фразу в усі три
  const OPENING = [
    'начни с вопроса получателю',
    'начни сразу с главной мысли, без вступления',
    level(b.funny) >= 40 ? 'начни с лёгкой шутки' : 'начни просто, как пишут в мессенджере',
  ];
  const user = `Задача: ${reason}. ${focus ? `Акцент: ${focus}. ` : ''}`
    + `${words ? `Что обязательно сказать (слова автора): ${words}. ` : ''}`
    + `Длина: ${sentences}. Тон: игриво на ${level(b.funny)}% (0 — нежно), `
    + `поэтично на ${level(b.poetic)}% (0 — просто, как в переписке). ${passionTone(level(b.passion))}`.trim();
  const one = async (i) => {
    const system = `Ты помогаешь написать короткое личное письмо. ${who} ${rules} `
      + `Напиши один вариант: ${OPENING[i]}; ${slot(i)}. Без подписи в конце. `
      + 'Ответь только текстом письма — без кавычек, заголовков и пояснений.';
    // Відсіяне фільтром — ще одна спроба, далі варіант просто випадає
    for (let attempt = 0; attempt < 2; attempt++) {
      const t = clean(await askText(env, system, user, 400).catch(() => ''));
      if (t && draftOk(t, words) && !(he && HE_AT_HOME.test(t))) return t;
    }
    return '';
  };
  const drafts = (await Promise.all([0, 1, 2].map(one)))
    .filter(Boolean)
    // Улюбленець — завжди в першому запиті; перемішуємо, щоб він не стояв завжди першим
    .sort(() => Math.random() - 0.5);
  return json({ drafts });
}

// Обіцянка строку, якої автор не давав: «скоро вернусь», «скоро обниму», «вернусь совсем скоро»
const FAKE_SOON = /скоро[^.!?\n]{0,40}(верн|обним|увид|встрет|приед|буд[уе]м вместе)|(верн|обним|увиж|встрет|приед)[^.!?\n]{0,30}скоро/i;
// Улюбленці не кажуть «мама/папа», і в листах їх нема; модель правило в промпті пропускала
const BANNED_WORD = /(^|[^а-яё])(мам(а|е|у|ы|ой|очк[а-яё]*)|пап(а|е|у|ы|ой|очк[а-яё]*)|хозя(ин|йк)[а-яё]*)(?![а-яё])/i;

// Чужі письмена посеред слова («иหวドмечтаю», «照ять», «не hoànанным») — модель зрідка зривається в них;
// латинська літера, приклеєна до кириличної, — теж зрив
const FOREIGN_SCRIPT = /[\u00C0-\u024F\u1E00-\u1EFF\u0590-\u08FF\u0900-\u0DFF\u0E00-\u0FFF\u1100-\u11FF\u3040-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]|[а-яё][a-z]|[a-z][а-яё]/i;
// Він далеко, дома — вона: «я дома с котом» від його імені — вигадка
const HE_AT_HOME = /(^|[^а-яё])я( сейчас| тут| здесь| уже)? дома(?![а-яё])/i;

// Чернетка без латиниці, без вигаданого «скоро» і без заборонених слів — якщо їх не було в словах автора
function draftOk(t, src) {
  const has = (re, s) => re.test(s || '');
  return !FOREIGN_SCRIPT.test(t)
    && !(has(LATIN_WORD, t) && !has(LATIN_WORD, src))
    && !(has(FAKE_SOON, t) && !has(FAKE_SOON, src))
    && !(has(BANNED_WORD, t) && !has(BANNED_WORD, src));
}

// Пошук GIF через GIPHY: ключ лише тут, у Worker; «pg» — без 18+
async function gifSearch(url, env) {
  if (!env.GIPHY_KEY) throw fail(503, 'nokey');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const offset = Math.max(0, Math.min(200, Number(url.searchParams.get('offset')) || 0));
  const trending = url.searchParams.get('trending') === '1';
  // Суміш настрою просить по 4 з кількох пошуків; звичайна сторінка — 12
  const limit = Math.max(4, Math.min(12, Number(url.searchParams.get('limit')) || 12));
  if (!q && !trending) return json([]);
  // Запит кирилицею GIPHY шукає російською, якщо сказати мову
  const api = new URL(`https://api.giphy.com/v1/gifs/${trending ? 'trending' : 'search'}`);
  api.search = new URLSearchParams({
    api_key: env.GIPHY_KEY, limit: String(limit), offset: String(offset), rating: 'pg',
    ...(trending ? {} : { q, lang: /[а-яёіїєґ]/i.test(q) ? 'ru' : 'en' }),
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
      // Назва з GIPHY («Cat Hug GIF by …») — підказка ШІ, про що гифка
      title: String(g.title || '').replace(/\s+GIF(\s.*)?$/i, '').trim().slice(0, 80),
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

// ---- «Планы»: колода ідей, збіги, колесо (клієнт — js/plans.js)
const PLAN_CATS = ['date', 'trip', 'home', 'pets', 'other'];
// Стовпець голосу — лише з цієї мапи за вже перевіреною стороною, ніколи з запиту
const VOTE_COL = { vona: 'vote_vona', vin: 'vote_vin' };
const PLAN_ID = /^[a-z0-9]{1,32}$/;
const PLAN_WORDS = /(?:^|[^а-яё])(?:мам|пап)(?:а|е|у|ы|ой)?(?=[^а-яё]|$)|хозя(?:ин|йк)/i;

let plansMigrated = false;

const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);
const bothLike = (r) => r.vote_vona === 1 && r.vote_vin === 1;

function ideaFields(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw fail(400, 'json');
  return {
    title: String(b.title || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    note: String(b.note || '').trim().slice(0, 300) || null,
    cat: PLAN_CATS.includes(b.cat) ? b.cat : 'other',
  };
}

// Для телефона: без author і без голосів — лише own (моя ідея) і done
function ideaView(r, side) {
  return {
    id: r.id, cat: r.cat, title: r.title, note: r.note, own: r.author === side, ai: !!r.ai,
    done: !!r.done, created: r.created,
  };
}

const matchView = (r, side) => ({ ...ideaView(r, side), matched: r.matched });

function ideaInsert(db, side, f, ai, created) {
  const id = newId();
  const col = VOTE_COL[side];
  return {
    row: { id, author: side, ...f, ai, done: 0, created },
    stmt: db.prepare(`INSERT INTO ideas (id, author, cat, title, note, ${col}, ai, created) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`)
      .bind(id, side, f.cat, f.title, f.note, ai, created),
  };
}

// Разовий перенос старого списку «Куда пойдём» (together.wishes): автор ❤️; зроблене — спільне, обидва ❤️.
// Позначка в docs — у тій самій пачці; id сталі, INSERT OR IGNORE — два одночасні запити не задвоять
async function migrateWishes(db) {
  if (plansMigrated) return;
  if (await getDoc(db, 'plans-migrated')) {
    plansMigrated = true;
    return;
  }
  const list = ((await getDoc(db, 'together')) || {}).wishes;
  const items = (Array.isArray(list) ? list : []).filter((w) => w && String(w.text || '').trim());
  const now = Date.now();
  await db.batch([
    ...items.map((w, i) => {
      const by = SIDES.includes(w.by) ? w.by : 'vona';
      const title = String(w.text).replace(/\s+/g, ' ').trim().slice(0, 120);
      // Список дописували згори (unshift), тож перший — найновіший
      const created = now - i;
      // Зроблене вже було спільним: обидва ❤️ і збіг — інакше воно знову прийде другому в колоду
      if (w.done) {
        return db.prepare('INSERT OR IGNORE INTO ideas (id, author, cat, title, note, vote_vona, vote_vin, done, matched, created) '
          + 'VALUES (?, ?, ?, ?, NULL, 1, 1, 1, ?, ?)')
          .bind(`wish${i}`, by, 'other', title, created, created);
      }
      return db.prepare(`INSERT OR IGNORE INTO ideas (id, author, cat, title, note, ${VOTE_COL[by]}, done, created) `
        + 'VALUES (?, ?, ?, ?, NULL, 1, 0, ?)')
        .bind(`wish${i}`, by, 'other', title, created);
    }),
    db.prepare('INSERT INTO docs (k, v, updated) VALUES (?, ?, ?) '
      + 'ON CONFLICT (k) DO UPDATE SET v = excluded.v, updated = excluded.updated')
      .bind('plans-migrated', 'true', now),
  ]);
  plansMigrated = true;
}

// deck — чого я ще не оцінив(ла); ours — збіги; mine — мої ❤️ без збігу.
// mine однаковий і коли другий натиснув ✕, і коли ще не дивився — так і задумано
async function plansRoute(req, db, side, rest, notify) {
  const m = req.method;
  await migrateWishes(db);
  const me = VOTE_COL[side];

  if (m === 'GET' && !rest) {
    const { results } = await db.prepare('SELECT * FROM ideas ORDER BY created DESC, id').all();
    return json({
      deck: results.filter((r) => r[me] == null).reverse().map((r) => ideaView(r, side)),
      ours: results.filter(bothLike).sort((a, b) => b.matched - a.matched).map((r) => matchView(r, side)),
      mine: results.filter((r) => r[me] === 1 && !bothLike(r)).map((r) => ideaView(r, side)),
      // Обраний колесом — лише поки план спільний і не зроблений
      next: await planNext(db, results),
      // Сьогоднішнє обертання (одне на двох) — колесо показує його замість нового
      spin: await todaySpin(db),
    });
  }

  // Колесо чесне: одне обертання на день на двох, план обирає сервер серед показаних секторів —
  // і він одразу «идём» у обох, другому push
  if (m === 'POST' && rest === 'spin') {
    const was = await todaySpin(db);
    if (was) return json({ spin: was, again: true });
    const b = await readJson(req);
    const want = new Set(Array.isArray(b?.slots) ? b.slots.map(String) : []);
    const { results } = await db.prepare('SELECT * FROM ideas').all();
    const pool = results.filter((x) => want.has(x.id) && bothLike(x) && !x.done);
    if (pool.length < 2) throw fail(409, 'pool');
    const r = pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length];
    const spin = { id: r.id, by: side, at: Date.now(), day: kyivDay() };
    await putDoc(db, 'plan-spin', spin);
    await putDoc(db, 'plan-next', { id: r.id, by: side, at: spin.at });
    notify.send(other(side), planGoNote(side, r.title));
    return json({ spin, reaches: await hasPush(db, other(side)) });
  }

  if (m === 'POST' && !rest) {
    const f = ideaFields(await readJson(req));
    if (!f.title) throw fail(400, 'title');
    const { row, stmt } = ideaInsert(db, side, f, 0, Date.now());
    await stmt.run();
    return json(ideaView(row, side), 201);
  }

  if (!PLAN_ID.test(rest)) throw fail(404, 'not found');
  const r = await db.prepare('SELECT * FROM ideas WHERE id = ?').bind(rest).first();
  if (!r) throw fail(404, 'not found');
  const them = VOTE_COL[other(side)];

  if (m === 'PUT') {
    const b = await readJson(req);
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw fail(400, 'json');
    if ('vote' in b) {
      if (b.vote !== 0 && b.vote !== 1) throw fail(400, 'vote');
      // Голос — один раз; збіг фіксуємо тим самим запитом, щоб два одночасні ❤️ не розминулись
      await db.prepare(`UPDATE ideas SET ${me} = ?, `
        + `matched = CASE WHEN ? = 1 AND ${them} = 1 THEN ? ELSE matched END WHERE id = ? AND ${me} IS NULL`)
        .bind(b.vote, b.vote, Date.now(), r.id).run();
      const after = await db.prepare('SELECT * FROM ideas WHERE id = ?').bind(r.id).first();
      // Без збігу — лише false: ні «ще не дивився», ні «✕» назовні не виходить
      return json(after && bothLike(after) ? { match: true, idea: matchView(after, side) } : { match: false });
    }
    if ('done' in b) {
      if (!bothLike(r)) throw fail(409, 'match');
      const done = b.done ? 1 : 0;
      await db.prepare('UPDATE ideas SET done = ? WHERE id = ?').bind(done, r.id).run();
      return json({ ok: true, done: !!done });
    }
    throw fail(400, 'json');
  }

  if (m === 'DELETE') {
    if (r.author !== side) throw fail(403, 'forbidden');
    // Умова в самому DELETE: другий міг щойно поставити ❤️ — спільний план уже не прибрати.
    // COALESCE: без нього NULL (ще не дивився) дав би NULL замість «так» і видав би різницю з ✕
    const res = await db.prepare('DELETE FROM ideas WHERE id = ? '
      + 'AND NOT (COALESCE(vote_vona, 0) = 1 AND COALESCE(vote_vin, 0) = 1)').bind(r.id).run();
    if (!res.meta?.changes) throw fail(409, 'match');
    return json({ ok: true });
  }

  throw fail(405, 'method');
}

const PLAN_TOPICS = {
  date: 'свидание вдвоём вне дома: прогулка, кафе, кино, концерт, необычное место в городе',
  trip: 'поездка вдвоём: на выходные недалеко или в отпуск, с конкретным местом и занятием',
  home: 'вечер или выходной дома вдвоём: готовить, играть, смотреть, мастерить, устроить уют',
  pets: 'время вдвоём вместе с питомцами',
  other: 'что-то новое вдвоём: научиться, попробовать, сделать своими руками, завести маленькую традицию',
};

// «✨ Подкинуть идеи»: ~6 свіжих ідей на тему; кладемо їх як звичайні ідеї того, хто попросив (його ❤️).
// Особисте (питомці) — лише з бази, не з коду
async function planIdeas(req, env, side) {
  if (!env.AI) throw fail(503, 'ai');
  const b = await readJson(req);
  const cat = PLAN_CATS.includes(b?.cat) ? b.cat : 'other';
  const hint = String(b?.hint || '').trim().slice(0, 120);
  await migrateWishes(env.DB);
  const [mascots, recent] = await Promise.all([
    getDoc(env.DB, 'mascots'),
    env.DB.prepare('SELECT title FROM ideas WHERE cat = ? ORDER BY created DESC LIMIT 40').bind(cat).all(),
  ]);
  const pets = Object.values(mascots || {}).map((x) => `${String(x.name || '').slice(0, 30)} (${String(x.sp || 'питомец').slice(0, 60)})`).join(', ');
  const known = (recent.results || []).map((r) => r.title);

  const system = 'Ты придумываешь для пары, куда пойти, куда поехать и как провести время вдвоём. '
    + 'Он сейчас далеко и надолго, она ждёт дома с питомцами; идеи — на то время, когда он вернётся домой. '
    + 'Каждая идея конкретная и выполнимая, с живой деталью: что именно делать, что взять, когда лучше. '
    + 'Без банальностей вроде «сходить в кино» или «погулять в парке» без изюминки. '
    + 'Учитывай, какие у них питомцы: кого можно взять с собой на прогулку или в поездку, а кто останется дома. '
    + 'Никаких слов «мама», «папа», «хозяин», «хозяйка». Без политики, войны, пошлости. '
    + 'Только русский язык, без латиницы и английских слов. '
    + 'Название — 3–8 слов, с большой буквы, без точки в конце; пояснение — одно короткое предложение. '
    + 'Ответь ТОЛЬКО JSON {"ideas": [{"title": "...", "note": "..."}]} — шесть заметно разных идей.';
  const user = `Тема: ${PLAN_TOPICS[cat]}. Питомцы дома: ${pets || 'нет'}. `
    + `${hint ? `Пожелание: ${hint}. ` : ''}`
    + `${known.length ? `Уже придумано, не повторяй: ${known.map((t) => `«${t}»`).join(', ')}.` : ''}`;
  const out = await askAI(env, system, user, 900, 0.95);

  const seen = new Set(known.map((t) => t.toLowerCase()));
  const fresh = [];
  for (const x of Array.isArray(out.ideas) ? out.ideas : []) {
    const f = ideaFields({ title: x?.title, note: x?.note, cat });
    f.title = f.title.replace(/^["«]|["».]$/g, '');
    // Модель любить «Кожне Слово З Великої» — лишаємо велику лише першу
    const words = f.title.split(' ');
    if (words.length > 2 && words.every((w) => /^[А-ЯЁ]/.test(w))) f.title = [words[0], ...words.slice(1).map((w) => w.toLowerCase())].join(' ');
    const all = `${f.title} ${f.note || ''}`;
    if (!f.title || LATIN_WORD.test(all) || PLAN_WORDS.test(all) || seen.has(f.title.toLowerCase())) continue;
    seen.add(f.title.toLowerCase());
    fresh.push(f);
  }
  if (!fresh.length) throw fail(502, 'ai');
  const now = Date.now();
  const rows = fresh.slice(0, 6).map((f, i) => ideaInsert(env.DB, side, f, 1, now + i));
  await env.DB.batch(rows.map((x) => x.stmt));
  return json({ added: rows.map((x) => ideaView(x.row, side)) }, 201);
}

// ── Push-сповіщення ───────────────────────────────────────────────────────
// Web Push: VAPID (RFC 8292) + шифрування вмісту aes128gcm (RFC 8291) на Web Crypto, без бібліотек.
// Без ключа VAPID (локально) усе мовчки нічого не робить. Текст листа в сповіщення не кладемо — його видно на заблокованому екрані

const PUSH_HOSTS = /(^|\.)(googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;
const APP_URL = 'https://vitaliylobko.github.io/raduvalka/';
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (str) => Uint8Array.from(atob(String(str).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of parts) {
    out.set(x, o);
    o += x.length;
  }
  return out;
};

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

// RFC 8291: один запис aes128gcm. asKeys і salt — параметри, щоб тест звірився з прикладом із RFC
export async function encryptPush(sub, payload, { asKeys, salt } = {}) {
  const uaPublic = unb64u(sub.p256dh);
  const auth = unb64u(sub.auth);
  const pair = asKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, pair.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const s16 = salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(s16, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(s16, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // 0x02 — роздільник останнього (єдиного) запису
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);
  return concat(s16, rs, new Uint8Array([asPublic.length]), asPublic, sealed);
}

// VAPID JWT, підпис ES256 (Web Crypto одразу дає r‖s, як треба для JWT)
export async function vapidAuth(env, endpoint) {
  const jwk = JSON.parse(env.VAPID_PRIVATE);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: APP_URL,
  })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}

// Ніч у поясі телефону отримувача — без звуку й вібрації, але сповіщення лишається
function quietAt(tz) {
  try {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz || 'UTC' }).format(new Date()));
    return hour >= 23 || hour < 7;
  } catch {
    return false;
  }
}

// Одна підписка: 404/410 — телефон відписався, прибираємо
async function pushOne(env, sub, note) {
  // «Нужна помощь» — і вночі зі звуком, і з високим пріоритетом (Android не відкладає до пробудження)
  const body = await encryptPush(sub, JSON.stringify({ ...note, silent: !note.urgent && quietAt(sub.tz) }));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      authorization: await vapidAuth(env, sub.endpoint),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: '86400',
      urgency: note.urgent ? 'high' : 'normal',
    },
    body,
  });
  if (res.status === 404 || res.status === 410) {
    await env.DB.prepare('DELETE FROM push WHERE endpoint = ?').bind(sub.endpoint).run();
  }
  return res.status;
}

async function pushSide(env, side, note) {
  await bumpPulse(env.DB, [side]).catch(() => {});
  if (!env.VAPID_PRIVATE) return [];
  const { results } = await env.DB.prepare('SELECT * FROM push WHERE side = ?').bind(side).all();
  return Promise.all(results.map((sub) => pushOne(env, sub, note).catch((e) => { console.error('push', e); return 0; })));
}

// Для маршрутів: send не чекає відповіді push-сервісу. Заголовок x-no-push (демо, живі тести) — нікого не будимо
function pusher(req, env, ctx) {
  const on = !!env.VAPID_PRIVATE && req.headers.get('x-no-push') !== '1';
  return {
    on,
    send(side, note) {
      if (!on) return;
      const job = pushSide(env, side, note);
      if (ctx?.waitUntil) ctx.waitUntil(job);
    },
  };
}

// Що написати: хто приніс, без самого тексту листа
function letterNote(kind, pet) {
  const brought = pet ? `${pet.name} ${pet.g === 'f' ? 'принесла' : 'принёс'}` : '';
  if (kind === 'gift') return { title: 'Тебе подарок 🎁', body: brought ? `${brought} подарок — выбери один` : 'Выбери один из вариантов', tag: 'gift' };
  if (kind === 'date') return { title: 'Письмо к особому дню 💌', body: brought ? `${brought} письмо` : 'Открой, пока тёплое', tag: 'letter' };
  if (kind === 'morning') return { title: 'Письмо на сегодня 💌', body: brought ? `${brought} письмо дня` : 'Открой, пока тёплое', tag: 'letter' };
  return { title: 'Тебе письмо 💌', body: brought ? `${brought} письмо` : 'Открой, пока тёплое', tag: 'letter' };
}

// Мемчик і відповідь: хто й на що, без самого тексту — сповіщення видно на заблокованому екрані
const sender = (side, he, she) => (side === 'vin' ? he : she);
function memeNote(from, gif) {
  return { title: gif ? 'Тебе гифка 🎞' : 'Тебе фото 📷', body: sender(from, 'Он прислал — открой', 'Она прислала — открой'), tag: 'meme' };
}
// go — куди відкрити застосунок за тапом
// Тап — «Написать» одразу в цей конверт
function envEmptyNote(from, e) {
  return {
    title: `Конверт «${e.label}» пустой ${e.emoji || '✉'}`,
    body: sender(from, 'Он открыл, а читать нечего — допиши записку', 'Она открыла, а читать нечего — допиши записку'),
    tag: `env-${e.id}`,
    go: `env:${e.id}`,
  };
}

// Тап — «Написать» лист
function envOpenedNote(from, e) {
  return {
    title: `${sender(from, 'Он открыл', 'Она открыла')} «${e.label}» ${e.emoji || '✉'}`,
    body: sender(from, 'Напиши ему пару тёплых слов', 'Напиши ей пару тёплых слов'),
    tag: `env-${e.id}`,
    go: 'write',
  };
}

function wishNote(from) {
  return { title: 'Новая хотелка 🎁', body: sender(from, 'Он добавил, чего хочется', 'Она добавила, чего хочется'), tag: 'wish', go: 'wish' };
}

// День за Києвом: «одне обертання на день» міняється опівночі в них, а не за UTC
const kyivDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: STOCK_TZ }).format(new Date());

async function todaySpin(db) {
  const s = await getDoc(db, 'plan-spin');
  return s && s.day === kyivDay() ? s : null;
}

async function planNext(db, rows) {
  const n = await getDoc(db, 'plan-next');
  const r = n && rows.find((x) => x.id === n.id);
  return r && bothLike(r) && !r.done ? n : null;
}

// Тап — «Наши планы», де цей план угорі
function planGoNote(from, title) {
  return {
    title: 'Колесо выбрало 🎡',
    body: `${sender(from, 'Он покрутил', 'Она покрутила')} колесо: «${title}». Идём!`,
    tag: 'plan-go',
    go: 'plans',
  };
}

// «Я в порядке»: час — коли натиснули (з черги без зв'язку відмітка може дійти пізніше), не коли дійшла
async function checkinsOf(db, side) {
  const [mine, theirs] = await Promise.all([getDoc(db, `checkin:${side}`), getDoc(db, `checkin:${other(side)}`)]);
  return { mine: mine?.at || null, theirs: theirs?.at || null };
}

async function checkin(req, db, side, notify) {
  const b = await readJson(req);
  const now = Date.now();
  const at = Math.min(now, Number(b.at) || now);
  if (at < now - CHECKIN_MAX_AGE) throw fail(400, 'old');
  const prev = await getDoc(db, `checkin:${side}`);
  const reaches = await hasPush(db, other(side));
  // Старіша за вже записану (повтор із черги) — нічого не міняє
  if (prev?.at >= at) return json({ at: prev.at, reaches, sent: false });
  const push = reaches && now - at < CHECKIN_PUSH_AGE;
  await putDoc(db, `checkin:${side}`, { at, pushed: push ? now : prev?.pushed || null });
  if (push) notify.send(other(side), checkinNote(side, at, now));
  return json({ at, reaches, sent: push });
}

// «Нужна помощь»: doc sos:<side> — останній сигнал цієї половини; голос — рядок imgs sos-<side>.
// Сигнал іде одразу, місце й голос доганяють окремими запитами. Координати — лише тут, не в push і не в boot
const sosAudioName = (side) => `sos-${side}`;

async function sosWipe(db, side) {
  await db.prepare('DELETE FROM imgs WHERE name = ?').bind(sosAudioName(side)).run();
}

// Що віддаємо телефону: свіже (до доби), без даних голосу — лише чи він є
function sosView(s, now = Date.now()) {
  if (!s || now - s.at > SOS_MAX_AGE) return null;
  const { id, at, created, lat, lon, acc, audio, audioType, seen, ok } = s;
  return { id, at, created, lat: lat ?? null, lon: lon ?? null, acc: acc ?? null, audio: !!audio, audioType: audioType || null, seen: seen || null, ok: ok || null };
}

async function sosRoute(req, db, side, path, notify) {
  const m = req.method;
  const key = `sos:${side}`;
  const theirKey = `sos:${other(side)}`;
  if (m === 'GET' && path === 'sos') {
    const [mine, theirs] = await Promise.all([getDoc(db, key), getDoc(db, theirKey)]);
    return json({ mine: sosView(mine), theirs: sosView(theirs), reaches: await hasPush(db, other(side)) });
  }
  const now = Date.now();
  if (m === 'POST' && path === 'sos') {
    const b = await readJson(req);
    const id = String(b.id || '');
    if (!CID.test(id)) throw fail(400, 'id');
    const prev = await getDoc(db, key);
    const reaches = await hasPush(db, other(side));
    // Повтор із черги без зв'язку — той самий сигнал, другого push не треба
    if (prev?.id === id) return json({ sos: sosView(prev, now), reaches, again: true });
    const at = Math.min(now, Number(b.at) || now);
    if (at < now - SOS_MAX_AGE) throw fail(400, 'old');
    await sosWipe(db, side);
    const s = { id, at, created: now };
    await putDoc(db, key, s);
    notify.send(other(side), sosNote(side, at, now));
    return json({ sos: sosView(s, now), reaches }, 201);
  }
  const mm = path.match(/^sos\/([a-z0-9]{16,32})(?:\/(seen|ok|audio))?$/);
  if (!mm) throw fail(404, 'not found');
  const [, id, act] = mm;
  // Голос другого — звичайним запитом із ключем, без кешу (у телефоні не лишається)
  if (m === 'GET' && act === 'audio') {
    const s = await getDoc(db, theirKey);
    if (!s || s.id !== id || !s.audio) throw fail(404, 'not found');
    const row = await db.prepare('SELECT type, data FROM imgs WHERE name = ?').bind(sosAudioName(other(side))).first();
    if (!row) throw fail(404, 'not found');
    const bin = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { 'content-type': row.type, 'cache-control': 'no-store' } });
  }
  // «Вижу» — тисне той, кому прийшов сигнал
  if (m === 'POST' && act === 'seen') {
    const s = await getDoc(db, theirKey);
    if (!s || s.id !== id) throw fail(404, 'not found');
    if (!s.seen) await putDoc(db, theirKey, { ...s, seen: now });
    return json({ ok: true });
  }
  const s = await getDoc(db, key);
  if (!s || s.id !== id) throw fail(404, 'not found');
  if (s.ok) throw fail(409, 'over');
  // «Отбой: всё хорошо» — місце й голос стираємо одразу
  if (m === 'POST' && act === 'ok') {
    await sosWipe(db, side);
    await putDoc(db, key, { id: s.id, at: s.at, created: s.created, seen: s.seen || null, ok: now });
    notify.send(other(side), sosOkNote(side));
    return json({ ok: true });
  }
  if (m === 'PUT' && !act) {
    const b = await readJson(req, MAX_AUDIO_B64 + 4096);
    if (b.audio) {
      const type = String(b.audio.type || '');
      const data = String(b.audio.data || '');
      if (!SOS_AUDIO.test(type)) throw fail(415, 'type');
      if (!data || data.length > MAX_AUDIO_B64 || !/^[A-Za-z0-9+/]+=*$/.test(data)) throw fail(413, 'size');
      await db.prepare('INSERT INTO imgs (name, type, data, updated) VALUES (?, ?, ?, ?) '
        + 'ON CONFLICT (name) DO UPDATE SET type = excluded.type, data = excluded.data, updated = excluded.updated')
        .bind(sosAudioName(side), type, data, now).run();
      await putDoc(db, key, { ...s, audio: true, audioType: type });
      notify.send(other(side), sosVoiceNote(side));
      return json({ ok: true });
    }
    const lat = Number(b.lat);
    const lon = Number(b.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw fail(400, 'coords');
    const acc = Number.isFinite(Number(b.acc)) ? Math.round(Number(b.acc)) : null;
    await putDoc(db, key, { ...s, lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6, acc });
    return json({ ok: true });
  }
  throw fail(404, 'not found');
}

// Сигнал старший за добу — прибрати разом із місцем і голосом
// Місце в базі: D1 безкоштовно — 500 МБ на базу. Дані зайняли понад PHOTO_KEEP ліміту — стираємо найстаріші фото
// з переписки (лише картинки мемчиків m-*: улюбленці, хотілки, решта imgs і гифки-посилання не чіпаються), рівно
// стільки, щоб повернутися під поріг. Рахуємо самі дані, не розмір файлу: звільнене SQLite не віддає, а бере знову,
// тож за розміром файлу cron стирав би щоночі ще. DB_LIMIT_BYTES — інший ліміт (тест)
const DB_LIMIT = 500 * 1024 * 1024;
const PHOTO_KEEP = 0.7;
const liveBytes = (db) => db.prepare('SELECT (SELECT IFNULL(SUM(LENGTH(data)), 0) FROM imgs)'
  + ' + (SELECT IFNULL(SUM(LENGTH(v)), 0) FROM docs)'
  + ' + (SELECT IFNULL(SUM(LENGTH(text) + IFNULL(LENGTH(quote), 0) + IFNULL(LENGTH(reply), 0) + IFNULL(LENGTH(gift), 0)), 0) FROM letters) AS n').first('n');
async function photoCleanup(env, now = Date.now()) {
  const db = env.DB;
  const limit = Number(env.DB_LIMIT_BYTES) || DB_LIMIT;
  let over = (await liveBytes(db)) - limit * PHOTO_KEEP;
  let gone = 0;
  while (over > 0) {
    const { results } = await db.prepare('SELECT m.id, m.img, LENGTH(i.data) AS n FROM memes m JOIN imgs i ON i.name = m.img '
      + "WHERE m.img LIKE 'm-%' ORDER BY m.created ASC LIMIT 50").all();
    if (!results.length) break;
    const pick = [];
    for (const r of results) {
      if (over <= 0) break;
      pick.push(r);
      over -= r.n;
    }
    await db.batch(pick.flatMap((r) => [
      db.prepare('DELETE FROM imgs WHERE name = ?').bind(r.img),
      db.prepare("UPDATE memes SET img = '', gone = ? WHERE id = ?").bind(now, r.id),
    ]));
    gone += pick.length;
  }
  if (gone) console.log('photoCleanup', { gone });
  return gone;
}

async function sosCleanup(db) {
  const now = Date.now();
  for (const side of SIDES) {
    const s = await getDoc(db, `sos:${side}`);
    if (s && now - s.at > SOS_MAX_AGE) {
      await sosWipe(db, side);
      await db.prepare('DELETE FROM docs WHERE k = ?').bind(`sos:${side}`).run();
    }
  }
}

// Без координат: push видно на заблокованому екрані. Час — коли натиснули (міг дійти із запізненням)
function sosNote(from, at, now) {
  const time = new Intl.DateTimeFormat('ru', { timeZone: STOCK_TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(at));
  const late = now - at > 5 * 60 * 1000;
  return {
    title: '🚨 Нужна помощь',
    body: `${sender(from, 'Он нажал', 'Она нажала')} «Нужна помощь»${late ? ` в ${time}` : ''}. Открой Радовалку`,
    tag: 'sos',
    go: 'letter',
    urgent: true,
  };
}

function sosVoiceNote(from) {
  return { title: '🎙 Голосовое к «Нужна помощь»', body: sender(from, 'Он записал голосовое', 'Она записала голосовое'), tag: 'sos', go: 'letter', urgent: true };
}

function sosOkNote(from) {
  return { title: 'Отбой ❤️', body: sender(from, 'Он нажал «Всё хорошо»', 'Она нажала «Всё хорошо»'), tag: 'sos', go: 'letter' };
}

// Час відмітки — у тексті, якщо вона дійшла із запізненням: давню «всё хорошо» не видаємо за свіжу
function checkinNote(from, at, now) {
  const late = now - at > 15 * 60 * 1000;
  const time = new Intl.DateTimeFormat('ru', { timeZone: STOCK_TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(at));
  return {
    title: `${sender(from, 'Он отметился', 'Она отметилась')} ❤️`,
    body: late ? `В ${time}: всё хорошо` : 'Всё хорошо',
    tag: 'checkin',
    go: 'letter',
  };
}

// Тап — «Письма», де в надісланих видно ❤️
function likeNote(from, kind) {
  return {
    title: `${sender(from, 'Ему понравилось', 'Ей понравилось')} ❤️`,
    body: kind === 'env' ? 'твоя записка в конверте' : 'твоё письмо',
    tag: 'like',
    go: 'letter',
  };
}

// as — чим відповіли, якщо не словами: 'gif' | 'photo'
function replyNote(from, on, as) {
  const what = on === 'gif' ? 'на твою гифку' : on === 'photo' ? 'на твоё фото' : 'на твоё письмо';
  return {
    title: `${sender(from, 'Он ответил', 'Она ответила')} 💌`,
    body: as === 'gif' ? `Гифкой ${what}` : as === 'photo' ? `Фото ${what}` : what[0].toUpperCase() + what.slice(1),
    tag: 'reply',
  };
}
// Відповідь новим повідомленням: цитата (до 300 знаків) і на що — для push
const quoteOf = (b) => String(b.quote || '').trim().slice(0, 300) || null;
const quoteOn = (b) => (['gif', 'photo'].includes(b.on) ? b.on : 'letter');

async function pushRoute(req, env, side, path) {
  const m = req.method;
  if (m === 'GET' && path === 'push-key') return json({ key: env.VAPID_PUBLIC || null });
  const b = await readJson(req);
  const endpoint = String(b.endpoint || '');
  if (m === 'DELETE' && path === 'push') {
    await env.DB.prepare('DELETE FROM push WHERE endpoint = ?').bind(endpoint).run();
    return json({ ok: true });
  }
  let host = '';
  try {
    const u = new URL(endpoint);
    if (u.protocol === 'https:') host = u.hostname;
  } catch { /* не адреса */ }
  if (!PUSH_HOSTS.test(host)) throw fail(400, 'endpoint');
  if (m === 'PUT' && path === 'push') {
    const p256dh = String(b.keys?.p256dh || '');
    const auth = String(b.keys?.auth || '');
    if (unb64u(p256dh).length !== 65 || unb64u(auth).length !== 16) throw fail(400, 'keys');
    const tz = String(b.tz || '').slice(0, 64) || null;
    await env.DB.prepare('INSERT INTO push (endpoint, side, p256dh, auth, tz, created) VALUES (?, ?, ?, ?, ?, ?) '
      + 'ON CONFLICT (endpoint) DO UPDATE SET side = excluded.side, p256dh = excluded.p256dh, auth = excluded.auth, tz = excluded.tz')
      .bind(endpoint, side, p256dh, auth, tz, Date.now()).run();
    return json({ ok: true });
  }
  // Перевірка: лише на цей телефон, і лише якщо він підписаний за цією половиною
  if (m === 'POST' && path === 'push-test') {
    if (!env.VAPID_PRIVATE) throw fail(503, 'nokey');
    const sub = await env.DB.prepare('SELECT * FROM push WHERE endpoint = ? AND side = ?').bind(endpoint, side).first();
    if (!sub) throw fail(404, 'not subscribed');
    const status = await pushOne(env, sub, { title: 'Радовалка', body: 'Уведомления работают ✓', tag: 'test' });
    return json({ status });
  }
  throw fail(404, 'not found');
}

// Дата, година й північ «сьогодні» в поясі отримувача
function localDay(tz, now) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(now));
  } catch {
    return localDay(STOCK_TZ, now);
  }
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const offset = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(now / 1000) * 1000;
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, start: Date.UTC(+p.year, +p.month - 1, +p.day) - offset };
}

// Запас: уже ранок у отримувача, а листа на сьогодні (прийшов чи заплановано на сьогодні) нема — найстаріший
// із запасу стає «На утро» зараз, і cronPush нижче сповістить. Лише покладені до сьогоднішньої півночі:
// щойно покладений не піде того ж дня. Відправник не вибрав «с какого дня» — запас на паузі
async function releaseStock(db, now) {
  const { results } = await db.prepare("SELECT DISTINCT src, dst FROM letters WHERE kind = 'stock'").all();
  if (!results.length) return;
  const pets = Object.keys((await getDoc(db, 'mascots')) || {});
  for (const { src, dst } of results) {
    const from = (await getDoc(db, `mine:${src}`))?.stockFrom;
    if (!DATE_FIELD.test(String(from || ''))) continue;
    const tz = await db.prepare('SELECT tz FROM push WHERE side = ? AND tz IS NOT NULL ORDER BY created DESC LIMIT 1').bind(dst).first('tz');
    const day = localDay(tz || STOCK_TZ, now);
    if (day.date < from || day.hour < MORNING_HOUR) continue;
    const today = await db.prepare(
      "SELECT 1 FROM letters WHERE dst = ? AND kind IN ('now', 'morning', 'date') AND at >= ? AND at < ? LIMIT 1",
    ).bind(dst, day.start, day.start + 24 * 3600 * 1000).first();
    if (today) continue;
    const r = await db.prepare(
      "SELECT id, mascot FROM letters WHERE src = ? AND dst = ? AND kind = 'stock' AND created < ? ORDER BY created LIMIT 1",
    ).bind(src, dst, day.start).first();
    if (!r) continue;
    // Без кур'єра конверт стоїть порожній — даємо випадкового
    const pet = pets.includes(r.mascot) ? r.mascot : pets[Math.floor(Math.random() * pets.length)] || null;
    // Умова kind = 'stock' — два накладені запуски не видадуть той самий лист двічі
    await db.prepare("UPDATE letters SET kind = 'morning', at = ?, created = ?, pushed = NULL, mascot = ? WHERE id = ? AND kind = 'stock'")
      .bind(now, now, pet, r.id).run();
  }
}

// Cron раз на 10 хвилин. Вікно в 6 годин: перший запуск не розбудить старими листами
async function cronPush(env) {
  if (!env.VAPID_PRIVATE) return;
  await ensureSchema(env.DB);
  const now = Date.now();
  const { results } = await env.DB.prepare(
    "SELECT id, dst, kind, mascot FROM letters WHERE kind IN ('morning', 'date') AND pushed IS NULL AND at <= ? AND at > ?",
  ).bind(now, now - 6 * 3600 * 1000).all();
  if (!results.length) return;
  const mascots = (await getDoc(env.DB, 'mascots')) || {};
  for (const r of results) {
    // Спершу позначка — щоб два накладені запуски cron не надіслали двічі
    const res = await env.DB.prepare('UPDATE letters SET pushed = ? WHERE id = ? AND pushed IS NULL').bind(now, r.id).run();
    if (res.meta?.changes) await pushSide(env, r.dst, letterNote(r.kind, mascots[r.mascot]));
  }
}
