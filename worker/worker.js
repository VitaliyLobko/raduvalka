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
  // «Планы»: ідеї «куди підемо»; vote_vona / vote_vin: 1 — ❤️, 0 — ⏳ «потом», -1 — ✕ «нет» насовсем, NULL — ще не дивився(лась).
  // Чужий голос назовні не віддаємо; matched — коли обоє ❤️
  'CREATE TABLE IF NOT EXISTS ideas (id TEXT PRIMARY KEY, author TEXT NOT NULL, cat TEXT NOT NULL, '
    + 'title TEXT NOT NULL, note TEXT, vote_vona INTEGER, vote_vin INTEGER, done INTEGER NOT NULL DEFAULT 0, '
    + 'matched INTEGER, ai INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)',
  // Push: одна підписка — один телефон; side перезаписується, коли телефон перемикає половину.
  // tz — пояс телефону, щоб уночі сповіщення приходили без звуку
  'CREATE TABLE IF NOT EXISTS push (endpoint TEXT PRIMARY KEY, side TEXT NOT NULL, p256dh TEXT NOT NULL, '
    + 'auth TEXT NOT NULL, tz TEXT, created INTEGER NOT NULL)',
  // Історія для чату: «Я в порядке» (kind ok, з настроєм) і «Как ты?» (ask) — маленькими рядками; doc checkin:* тримає лише останнє
  'CREATE TABLE IF NOT EXISTS marks (id TEXT PRIMARY KEY, side TEXT NOT NULL, kind TEXT NOT NULL, mood TEXT, at INTEGER NOT NULL)',
  // «✊ Спор»: кожен хід — свій рядок (гра, раунд, сторона); вставка без перезапису — одночасні ходи не губляться й не міняються
  'CREATE TABLE IF NOT EXISTS duel_moves (duel TEXT NOT NULL, round INTEGER NOT NULL, side TEXT NOT NULL, move TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (duel, round, side))',
];

const SIDES = ['vona', 'vin'];
// wishes більше не приймаємо: старий список «Куда пойдём» перенесено в «Планы» разово
const TOGETHER_FIELDS = ['since', 'apartFrom', 'meet', 'phrase', 'bdayVona', 'bdayVin'];
const DATE_FIELD = /^\d{4}-\d{2}-\d{2}$/;
// stockFrom — 'YYYY-MM-DD', з якого дня запас підстраховує; нема — запас на паузі
const MINE_FIELDS = ['letter', 'seen', 'memesSeen', 'wishesSeen', 'repliesSeen', 'stockFrom', 'chatCleared', 'instrument', 'ai'];
const AI_MODES = ['auto', 'qwen', 'llama', 'claude'];
// Інструмент звуків (js/sound.js INSTRUMENTS): свій — у mine, другий телефон грає ним те, що прийшло від тебе
const INSTRUMENT_KEYS = ['kalimba', 'harp', 'flute', 'violin', 'cello', 'bass', 'bells', 'musicbox', 'celesta', 'vibes',
  'marimba', 'piano', 'guitar', 'accordion', 'harmonica', 'ocarina', 'panflute', 'steeldrum', 'koto'];
const DOC_KEY = /^(?:(?:letter|envelopes):(?:vona|vin)|mascots|together|voice)$/;
const IMG_NAME = /^[a-z0-9-]{1,64}$/;
const MAX_JSON = 64 * 1024;
const MAX_IMG = 1.4 * 1024 * 1024;
// Мемчик приходить уже в base64 (кодує телефон — у Worker на безкоштовному плані ~10 мс CPU);
// рядок D1 — до 2 МБ, тож base64 до 1,9 млн символів (≈1,4 МБ картинки)
const MAX_B64 = 1_900_000;
const MEME_TYPES = /^image\/(webp|jpeg|png|gif)$/;
// Файл «як файл» — у R2 (FILES), не в D1: до 25 МБ (+ RAD1, iv і тег шифрування)
const MAX_FILE = 25 * 1024 * 1024 + 64;
// Сховище файлів: понад межу — найстаріші стираються (безкоштовно в R2 — 10 ГБ)
const FILES_LIMIT = 8 * 1024 ** 3;
// Жорстка межа: понад неї новий файл не приймаємо зовсім. R2, на відміну від Workers і D1, понад безкоштовне виставляє
// рахунок на картку, а вкладення невідкритих листів чистка не стирає — тож місце може й не звільнитись
const FILES_HARD = 9 * 1024 ** 3;
const MIME = /^[\w.+-]{1,60}\/[\w.+-]{1,80}$/;
// Захист від чужого, якщо ключ раптом витече: за добу з одного боку — не більше 60 файлів і 1 ГБ
// (рахунок R2 тоді не виросте: межа зберігання й операцій безкоштовного плану недосяжна)
const FILES_PER_DAY = 60;
// Голосові — свій лік за добу: ними перемовляються, як у месенджері, і файлам вони не заважають
const VOICE_PER_DAY = 200;
const FILES_BYTES_PER_DAY = 1024 ** 3;
const DAY_MS = 24 * 3600 * 1000;
// Реакції на лист і фото (ставить отримувач; старі 😂 і ❤️ мемчиків — серед них)
const REACTIONS = ['❤️', '😍', '😂', '🥺', '🍓', '🫦', '🙏', '😎', '🫡', '🤯', '🤷', '🔥', '😴', '🤗', '😢', '🙃', '🍀', '💯', '😘', '🫶', '👏', '🎉', '💪', '🙈', '👀', '😱', '🤔', '🌹', '☕', '😇', '👍', '☀️', '🌙', '🍷', '🍕', '🥶', '🥵', '🤒', '🌈', '😏', '🪐', '🏹', '🐾', '🧸', '🤣', '🫣', '🌸', '⭐', '🎖️', '🛡️', '🚀', '🍿', '💊', '🤮', '🌌', '😉', '🍒', '🪖', '🎁'];
// stock — «в запас»: без дати; утром, коли листа на сьогодні нема, cron робить із найстарішого «На утро»
const LETTER_KINDS = ['now', 'morning', 'env', 'date', 'stock'];
// Ранок як у «На утро» на телефоні (js/write.js MORNING_HOUR); пояс — якщо отримувач ще не дав сповіщень
const MORNING_HOUR = 8;
const STOCK_TZ = 'Europe/Kyiv';
const MAX_LETTER = 4000;
// Наскрізне шифрування: телефон шле «e1.…» — такий рядок не ріжемо (обрізав відкритий текст ще телефон), лише межа зверху
const SEALED = /^e1\.[A-Za-z0-9_-]+$/;
const MAX_SEALED = 24000;
function clip(v, max) {
  const s = String(v || '').trim();
  if (!SEALED.test(s)) return s.slice(0, max);
  if (s.length > MAX_SEALED) throw fail(413, 'size');
  return s;
}
// id листа, придуманий телефоном (черга без зв'язку): лише малі латинські й цифри
const CID = /^[a-z0-9]{16,32}$/;
// «Я в порядке»: старіше доби не приймаємо; push — на кожну відмітку, не старшу 12 год (давню з черги — тихо)
const CHECKIN_MAX_AGE = 24 * 3600 * 1000;
const CHECKIN_PUSH_AGE = 12 * 3600 * 1000;
// «Нужна помощь»: живе добу, координати й голос стираються на «Отбой» і після доби (cron)
const SOS_MAX_AGE = 24 * 3600 * 1000;
const SOS_AUDIO = /^audio\/(webm|ogg|mp4|mpeg|aac)(;[a-z0-9=.,\s-]*)?$/i;
const MAX_AUDIO_B64 = 900_000;
const EVERY_MINUTE = '* * * * *';
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
  // Нагадування другому про хотілку «к дате»: '<due>:7' чи '<due>:2' — що вже надіслано; нова дата — заново
  'ALTER TABLE wishes ADD COLUMN reminded TEXT',
  // «Сбылось»: коли другий натиснув «Подарено»; автор бачить хотілку в «Сбылось ✨»
  'ALTER TABLE wishes ADD COLUMN gifted INTEGER',
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
  // Реакція отримувача на лист (з REACTIONS) — відправник бачить її значком на своєму повідомленні
  'ALTER TABLE letters ADD COLUMN reaction TEXT',
  // Файл «як файл» (R2): JSON { n — назва (e1.), t — тип, s — розмір }
  'ALTER TABLE memes ADD COLUMN file TEXT',
  // Вкладення листа в конверт (JSON): k — photo | voice | song (байти в R2 l-<id>: t — тип, s — розмір, d — секунди голосу,
  // n — назва пісні e1., cap — підпис фото e1.), gif (gif — посилання GIPHY, cap, style), link (url — посилання на пісню, e1.);
  // gone — коли байти стерто, щоб звільнити місце
  'ALTER TABLE letters ADD COLUMN media TEXT',
  // Наклейки-улюбленці поверх гифки (код STICK)
  'ALTER TABLE memes ADD COLUMN stick TEXT',
  // Хто з улюбленців несе фото, гифку, файл чи наклейку (ключ із mascots), як у листа
  'ALTER TABLE memes ADD COLUMN mascot TEXT',
  // Індекси. Безкоштовний D1 рахує прочитані рядки (5 млн на добу), а без індексу кожен запит читає всю таблицю:
  // cron щохвилини, стрічка, конверти — з роками переписки це впирається в ліміт. Під кожен частий запит — свій
  // push «На утро» / «Ко времени» (cron щохвилини)
  'CREATE INDEX IF NOT EXISTS letters_push ON letters (pushed, at)',
  // Отримані: стрічка, «Мне», конверти
  'CREATE INDEX IF NOT EXISTS letters_dst ON letters (dst, at)',
  // Надіслані: letters/sent і запас
  'CREATE INDEX IF NOT EXISTS letters_src ON letters (src, created)',
  // Надіслані у стрічці — за тим самим виразом часу, що й у запиті feedPage
  "CREATE INDEX IF NOT EXISTS letters_sent ON letters (src, (CASE WHEN kind = 'env' THEN created ELSE at END))",
  // Вкладення листів (чистка R2) і файли переписки — лише рядки, де вони є
  'CREATE INDEX IF NOT EXISTS letters_media ON letters (created) WHERE media IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS memes_created ON memes (created)',
  'CREATE INDEX IF NOT EXISTS memes_file ON memes (created) WHERE file IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS marks_at ON marks (at)',
  // Запас (cron щодесять хвилин) і листи в конверти — свої
  'CREATE INDEX IF NOT EXISTS letters_kind ON letters (kind, src, dst)',
  'CREATE INDEX IF NOT EXISTS letters_env ON letters (dst, kind, created)',
];

// Текстовий ИИ (листи, мемчики, плани, бажання). Qwen 3.8 обрано порівнянням 24.11: природніша російська й 1–4 с;
// не відповіла — Llama 3.3, як було раніше. З ключем Claude — спершу він (див. aiRun)
const AI_MODEL = '@cf/qwen/qwen3.8-27b';
const AI_FALLBACK_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const GIF_URL = /^https:\/\/(?:media\d*\.giphy\.com|static\.klipy\.com)\/[\w./?=&-]+$/;
// Підпис поверх гифки, як у фото: 'вигляд.колір.x.y.розмір.поворот' (сам текст — у caption, зашифрований);
// колір — номер готового (0–4) або свій hex без «#»; шрифт і колір тексту на плашці (i_rrggbb) — необовʼязкові хвости
const MEME_FREE = /^(meme|hand|plate|bubble|tape|neon|note|cut)\.(?:[0-4]|[0-9a-f]{6})\.\d{1,4}\.\d{1,4}\.\d{1,3}\.-?\d{1,3}(?:\.(?:lobster|marck|bubbles|comfortaa|russo|playfair|press))?(?:\.i_[0-9a-f]{6})?$/;

// Наклейки-улюбленці поверх гифки: 'ключ.поза.x.y.розмір.поворот.дзеркало' через «~», до 8 (x, y, розмір — тисячні кадру).
// Фото улюбленців однакові на обох телефонах, тож досить ключа й номера пози
const STICK = /^[a-z0-9_-]{1,24}\.\d{1,2}\.\d{1,4}\.\d{1,4}\.\d{1,4}\.-?\d{1,3}\.[01](?:~[a-z0-9_-]{1,24}\.\d{1,2}\.\d{1,4}\.\d{1,4}\.\d{1,4}\.-?\d{1,3}\.[01]){0,7}$/;
const stickOf = (v) => (STICK.test(String(v ?? '')) ? String(v) : null);

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
    // Cron щохвилини — заради push листів «Ко времени» точно в їхню хвилину; решта, як і раніше, раз на 10 хвилин
    // (прибирання сканують базу). Локальний сервер і ручний запуск — усе одразу
    const at = event.scheduledTime || Date.now();
    const all = event.cron !== EVERY_MINUTE || new Date(at).getUTCMinutes() % 10 === 0;
    ctx.waitUntil((async () => {
      await ensureSchema(env.DB);
      if (all) await releaseStock(env.DB, at);
      await cronPush(env);
      await sosRepeat(env, at);
      if (!all) return;
      await wishReminders(env);
      await sosCleanup(env.DB);
      // Місце рахується підсумовуванням усієї бази (усі рядки — у ліміт прочитаних), тож щогодини, не щодесять хвилин:
      // за годину переповнитись не встигне (запас — 30 % бази й 2 ГБ R2, файлів за добу — до 1 ГБ на половину)
      const d = new Date(at);
      const local = event.cron !== EVERY_MINUTE;
      if (!local && d.getUTCMinutes() >= 10) return;
      await openedAttachCleanup(env, at);
      await photoCleanup(env);
      await fileCleanup(env);
      if (local || d.getUTCHours() === 3) await orphanFiles(env, at);
    })());
  },
};

async function route(req, env, ctx, info = {}) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/')) return json({ ok: true, app: 'raduvalka' });

  // «❤️ Я в порядке» просто з push «Как ты?»: service worker ключа не знає — замість ключа разовий токен із того push
  if (req.method === 'POST' && url.pathname === '/api/checkin-ok') {
    await ensureSchema(env.DB);
    return checkinOk(req, env, ctx, info);
  }

  const side = await whoIs(req, env);
  if (!side) throw fail(401, 'key');
  await ensureSchema(env.DB);

  const path = url.pathname.slice(5);
  const m = req.method;
  const notify = pusher(req, env, ctx);
  info.side = side;
  info.path = path;

  if (m === 'GET' && path === 'pulse') {
    const [v, partnerPush, sos, bell, swap, bellAns] = await Promise.all([
      getDoc(env.DB, `pulse:${side}`),
      hasPush(env.DB, other(side)),
      // «Нужна помощь» — окрема мітка: телефон малює її одразу, навіть коли решта оновлення чекає
      env.DB.prepare("SELECT MAX(updated) u FROM docs WHERE k IN ('sos:vona', 'sos:vin')").first('u'),
      getDoc(env.DB, `bell:${side}`),
      getDoc(env.DB, 'swap'),
      // Відповідь на мій дзвінок: { at, a: 'go' | 'later' }
      getDoc(env.DB, `bellans:${side}`),
    ]);
    return json({ v: v || 0, partnerPush, sos: sos || 0, bell: bell?.at || 0, swap: liveSwap(swap), bellAns: bellAns || null });
  }

  if (path === 'push-key' || path === 'push' || path === 'push-test') return pushRoute(req, env, side, path);

  if (m === 'GET' && path === 'boot') {
    const [letter, envelopes, partnerEnvelopes, together, mine, mascots, memes, checkins, welcome, theirs] = await Promise.all([
      dayLetter(env.DB, side),
      myEnvelopes(env.DB, side),
      getDoc(env.DB, `envelopes:${other(side)}`),
      getDoc(env.DB, 'together'),
      getDoc(env.DB, `mine:${side}`),
      getDoc(env.DB, 'mascots'),
      // Стрічку тягне feed сторінками; тут — лише свіжі, для крапки на марці до першого feed
      listMemes(env.DB, side, 60),
      checkinsOf(env.DB, side),
      getDoc(env.DB, `letter:${side}`),
      getDoc(env.DB, `mine:${other(side)}`),
    ]);
    return json({
      side,
      pulse: (await getDoc(env.DB, `pulse:${side}`)) || 0,
      // Репетиція першого дня: мітка часу — пристрій, що бачив давнішу, сам забуває слід першого дня (ставиться в базі вручну)
      firstday: (await getDoc(env.DB, 'firstday'))?.at || 0,
      checkins,
      letter,
      // Привітальний лист-заготовка — першим повідомленням чату назавжди, а не лише поки нема справжніх
      welcome: welcome || null,
      envelopes,
      // Для «В конверт»: лише назви її/його конвертів, без самих записок
      partnerEnvelopes: (partnerEnvelopes || []).map(({ id, emoji, label }) => ({ id, emoji, label })),
      together: together || {},
      mine: mine || {},
      mascots: mascots || {},
      // Чи дійде до другого push — від цього залежить, чи обіцяти «узнает»
      partnerPush: await hasPush(env.DB, other(side)),
      // Розіграш «Поменяться темами»: { at, by } або null
      swap: liveSwap(await getDoc(env.DB, 'swap')),
      // Сховище файлів підключене — телефон показує «📎 Файл»
      files: !!env.FILES,
      // Набір питань «🔥 Совпадёт?» є в секретах — телефон показує плитку
      hot: !!hotBank(env),
      // Набір «🍓 Клубнички» є в секретах — плитка гри
      berry: !!berryBank(env),
      // Грані «🎲 Кубиков» є в секреті — плитка гри
      dice: !!diceBank(env),
      // Ключ Claude задано — у його виборі ИИ пункт «Claude» активний
      ...(side === 'vin' ? { claude: !!env.ANTHROPIC_KEY } : {}),
      // Підпис під листами другого (doc signs: { vona, vin }), без нього — звичайне «Твой/Твоя»
      partnerSign: (await getDoc(env.DB, 'signs'))?.[other(side)] || null,
      // Інструмент другого — ним звучить те, що прийшло від нього; з його mine — лише це поле
      partnerInstrument: theirs?.instrument || null,
      // Версії фото поз (час заливки): телефон бере їх зі свого кешу, поки версія та сама
      imgs: await imgVersions(env.DB, mascots),
      // «Наши фото» для 🌌 — час останньої зміни (null — не вибрали): та сама версія — з кешу телефону
      us: (await getDoc(env.DB, 'us-photo'))?.at || null,
      // Її фото для 🍓 — так само час останньої зміни
      her: (await getDoc(env.DB, 'her-photo'))?.at || null,
      his: (await getDoc(env.DB, 'his-photo'))?.at || null,
      memes,
    });
  }

  if (m === 'GET' && path === 'letter') {
    const [letter, checkins, us, her, his] = await Promise.all([dayLetter(env.DB, side), checkinsOf(env.DB, side), getDoc(env.DB, 'us-photo'), getDoc(env.DB, 'her-photo'), getDoc(env.DB, 'his-photo')]);
    // us / her / his — час останньої зміни альбомів: телефон, що повернувся з фону, дотягне нове без повного boot
    return json({ letter, checkins, us: us?.at || null, her: her?.at || null, his: his?.at || null });
  }
  if (path === 'seal/todo' || path === 'seal' || path === 'seal-img') return sealRoute(req, env.DB, side, path);
  if (m === 'POST' && path === 'checkin') return checkin(req, env.DB, side, notify);
  if (m === 'POST' && path === 'swap') return swapThemes(req, env.DB, side);
  if (m === 'POST' && path === 'checkin/seen') return checkinSeen(req, env.DB, side);
  if (m === 'POST' && path === 'checkin/ask') return checkinAsk(req, env.DB, side, notify);
  if (path === 'sos' || path.startsWith('sos/')) return sosRoute(req, env.DB, side, path, notify);
  if (m === 'GET' && path === 'envelopes') return json(await myEnvelopes(env.DB, side));
  if (m === 'GET' && path === 'envelopes/theirs') return json(await theirTemplates(env.DB, side));
  const tplDel = path.match(/^envelopes\/([\w-]{1,40})\/tpl\/(\d{1,3})$/);
  if (m === 'DELETE' && tplDel) return tplRemove(env.DB, side, env.FILES, tplDel[1], Number(tplDel[2]));
  const noteAt = path.match(/^envelopes\/([\w-]{1,40})\/note\/(\d{1,3})$/);
  if (m === 'PUT' && noteAt) return noteEdit(req, env.DB, side, noteAt[1], Number(noteAt[2]));
  if (m === 'DELETE' && noteAt) return noteDrop(env.DB, side, env.FILES, noteAt[1], Number(noteAt[2]));
  const envEvent = path.match(/^envelopes\/([\w-]{1,40})\/(empty|opened)$/);
  if (m === 'POST' && envEvent) return envelopeEvent(env.DB, side, envEvent[1], envEvent[2], notify);
  if (path === 'letters' || path.startsWith('letters/')) return lettersRoute(req, env.DB, side, path.slice(8), notify, env.FILES, env.FILES_HARD_BYTES);

  if (path === 'wishes' || path.startsWith('wishes/')) return wishesRoute(req, env.DB, side, path.slice(7), notify);
  if (path === 'plans' || path.startsWith('plans/')) return plansRoute(req, env.DB, side, path.slice(6), notify);
  if (m === 'POST' && path === 'plan-ideas') return planIdeas(req, env, side);
  if (m === 'POST' && path === 'files') return postFile(req, env, side, notify);
  if (path === 'us-photo') return usPhotoRoute(req, env, side, 'us', null);
  const album = /^(us|her|his)-photos(?:\/(.*))?$/.exec(path);
  if (album) return usPhotoRoute(req, env, side, album[1], album[2] || '');
  if (path === 'memes' || path.startsWith('memes/')) return memesRoute(req, env.DB, side, path.slice(6), notify, env.FILES);
  if (m === 'POST' && path === 'meme-ideas') return memeIdeas(req, env, side);
  if (m === 'POST' && path === 'letter-ideas') return letterIdeas(req, env, side);
  if (m === 'POST' && path === 'wish-from-url') return wishFromUrl(req, env);
  if (m === 'POST' && path === 'wish-image') return wishImage(req);
  if (m === 'GET' && path === 'gifs') return gifSearch(url, env);
  if (m === 'GET' && path === 'feed') return json(await feedPage(env.DB, side, url));

  // «Вместе» окремо — щоб відкритий застосунок дотягував дату зустрічі без повного boot
  if (m === 'GET' && path === 'together') return json((await getDoc(env.DB, 'together')) || {});
  // Сердечко з листівки: донесли до планети другого — йому push, а в його листівці воно прилетить.
  // heart:<side> — останнє сердечко ДЛЯ цієї сторони; не частіше ніж раз на 30 с, щоб не засипати push
  if (path === 'together/heart') {
    if (m === 'GET') return json((await getDoc(env.DB, `heart:${side}`)) || {});
    if (m === 'POST') {
      const now = Date.now();
      const prev = await getDoc(env.DB, `heart:${other(side)}`);
      const reaches = await hasPush(env.DB, other(side));
      if (prev?.at && now - prev.at < 30000) return json({ reaches, sent: false, again: true });
      await putDoc(env.DB, `heart:${other(side)}`, { at: now, from: side });
      // І рядок у чаті в обох: «💞 Люблю тебя!»
      await addMark(env.DB, side, 'heart', now);
      if (reaches) notify.send(other(side), heartNote(side));
      return json({ reaches, sent: reaches && notify.on });
    }
  }
  // «🔔 Звоночек»: потрусив телефон — у другого відкрита Радовалка дзвенить (bell у pulse), закрита — push; рядок у чаті в обох.
  // bell:<side> — останній дзвінок ДЛЯ цієї сторони; не частіше ніж раз на хвилину
  if (m === 'POST' && path === 'bell') {
    const now = Date.now();
    const prev = await getDoc(env.DB, `bell:${other(side)}`);
    const reaches = await hasPush(env.DB, other(side));
    if (prev?.at && now - prev.at < BELL_EVERY) return json({ reaches, sent: false, again: true });
    await putDoc(env.DB, `bell:${other(side)}`, { at: now, from: side });
    await addMark(env.DB, side, 'bell', now);
    if (reaches) notify.send(other(side), bellNote(side));
    return json({ reaches, sent: reaches && notify.on });
  }
  // Відповідь на дзвоночок: «🏃 Иду!» чи «⏳ Чуть позже» — тому, хто кликав: у pulse і push
  if (m === 'POST' && path === 'bell/answer') {
    const b = await readJson(req);
    const a = b.a === 'go' || b.a === 'later' ? b.a : null;
    if (!a) throw fail(400, 'answer');
    const call = await getDoc(env.DB, `bell:${side}`);
    const now = Date.now();
    if (!call?.at || now - call.at > BELL_ANSWER_MS) throw fail(409, 'old');
    if (call.answered) return json({ ok: true, again: true });
    await putDoc(env.DB, `bell:${side}`, { ...call, answered: now });
    await putDoc(env.DB, `bellans:${other(side)}`, { at: now, a, call: call.at });
    if (await hasPush(env.DB, other(side))) notify.send(other(side), bellAnswerNote(side, a));
    return json({ ok: true });
  }
  // «🫡 Да, капитан!» у відповідь на повідомлення другого: рядок у чаті в обох (цитата — у mood) і push другому
  if (m === 'POST' && path === 'captain') {
    const b = await readJson(req);
    const q = String(b.quote || '').replace(/\s+/g, ' ').trim();
    const quote = q.length > 80 ? `${q.slice(0, 80)}…` : q;
    const now = Date.now();
    await addMark(env.DB, side, 'captain', now, quote || null);
    const reaches = await hasPush(env.DB, other(side));
    if (reaches) notify.send(other(side), captainNote(side, quote));
    return json({ reaches, sent: reaches && notify.on });
  }
  if (path === 'duel' || path.startsWith('duel/')) return duelRoute(req, env.DB, side, path.slice(4), notify);
  if (path === 'same' || path.startsWith('same/')) return sameRoute(req, env.DB, side, path.slice(4), notify);
  if (path === 'hot' || path.startsWith('hot/')) return hotRoute(req, env, side, path.slice(3), notify);
  if (path === 'berry' || path.startsWith('berry/')) return berryRoute(req, env, side, path.slice(5), notify);
  if (path === 'dice' || path.startsWith('dice/')) return diceRoute(req, env, side, path.slice(4), notify);
  if (m === 'PUT' && path === 'together') {
    const patch = pick(await readJson(req), TOGETHER_FIELDS);
    // Дні народження — лише дата або null (стерли)
    for (const k of ['bdayVona', 'bdayVin']) if (k in patch && patch[k] !== null && !DATE_FIELD.test(String(patch[k]))) delete patch[k];
    const prev = (await getDoc(env.DB, 'together')) || {};
    const next = { ...prev, ...patch };
    await putDoc(env.DB, 'together', next);
    // Зустріч призначили, перенесли чи зняли — другому push. Стерли вже минулу («Снова врозь») — не «встреча снята»
    const wasPast = prev.meet && prev.meet < kyivDay();
    if ('meet' in patch && (prev.meet || null) !== (next.meet || null) && !(wasPast && !next.meet)) {
      notify.send(other(side), meetNote(side, wasPast ? null : prev.meet || null, next.meet || null));
    }
    return json(next);
  }

  if (m === 'PUT' && path === 'mine') {
    const patch = pick(await readJson(req), MINE_FIELDS);
    if ('instrument' in patch && !INSTRUMENT_KEYS.includes(patch.instrument)) throw fail(400, 'instrument');
    // Вибір ИИ — лише на його половині
    if ('ai' in patch && (side !== 'vin' || !AI_MODES.includes(patch.ai))) throw fail(400, 'ai');
    const next = { ...((await getDoc(env.DB, `mine:${side}`)) || {}), ...patch };
    await putDoc(env.DB, `mine:${side}`, next);
    return json(next);
  }

  // Новорічне побажання другому: пишуть заздалегідь, другий отримує його лише 1 січня (за Києвом) — у новорічній печеньці.
  // Текст шифрує телефон (seal.js), тож сервер його не чистить, лише обмежує довжину шифротексту
  if (path === 'ny-wish') {
    if (m === 'PUT') {
      const text = String((await readJson(req)).text || '').trim().slice(0, 2000);
      await putDoc(env.DB, `ny-wish:${side}`, text ? { text, at: Date.now() } : null);
      return json({ ok: true });
    }
    if (m === 'GET') {
      const [mine, theirs] = await Promise.all([getDoc(env.DB, `ny-wish:${side}`), getDoc(env.DB, `ny-wish:${other(side)}`)]);
      return json({ mine: mine?.text || null, theirs: kyivDay().slice(5) === '01-01' ? theirs?.text || null : null });
    }
  }

  // Поки писати листи й конверти в застосунку не можна — їх кладе він своїм ключем
  // Увесь запас ідей «Планов» — лише для нього (перегляд у меню «Отладка»)
  if (m === 'GET' && path === 'plan-pool') {
    if (side !== 'vin') throw fail(403, 'forbidden');
    return json(IDEA_POOL);
  }

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
    'access-control-allow-headers': 'authorization, content-type, x-no-push, x-file-meta',
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
const QUIET = /^(seal|seal-img|seal\/todo|push|push-key|push-test|letter-ideas|meme-ideas|plan-ideas|wish-from-url|wish-image|ny-wish)$/;
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
async function memesRoute(req, db, side, rest, notify, files) {
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
      caption: clip(body.caption, 300) || null,
      style: ['top', 'bottom'].includes(body.style) || MEME_FREE.test(String(body.style ?? '')) ? body.style : null,
      quote: quoteOf(body),
      created: Date.now(),
      reaction: null,
      stick: null,
      mascot: await mascotOf(db, body.mascot),
    };
    const insertMeme = () => db.prepare(
      'INSERT INTO memes (id, src, dst, img, url, caption, style, quote, created, reaction, stick, mascot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(meme.id, meme.src, meme.dst, meme.img, meme.url, meme.caption, meme.caption ? meme.style : null, meme.quote, meme.created, null, meme.stick, meme.mascot);

    // Наклейка-улюбленець окремим повідомленням: лише код однієї наклейки, без файла (фото улюбленців є на обох телефонах)
    if (body.sticker != null) {
      const st = stickOf(body.sticker);
      if (!st || st.includes('~')) throw fail(400, 'sticker');
      meme.stick = st;
      meme.caption = null;
      await insertMeme().run();
      notify.send(meme.dst, meme.quote ? replyNote(side, quoteOn(body), 'sticker') : stickerNote(side));
      return json(view(meme, side), 201);
    }

    // GIF із GIPHY — лише посилання, файл не зберігаємо
    if (body.gif) {
      const gifUrl = String(body.gif.url || '');
      if (!GIF_URL.test(gifUrl)) throw fail(400, 'gif');
      meme.url = gifUrl;
      meme.stick = stickOf(body.stick);
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

  // Файл — байтами з R2 (зашифрований RAD1 — розшифровує телефон)
  if (m === 'GET' && sub === 'file') {
    if (!meme.file || meme.gone || !files) throw fail(404, 'not found');
    const obj = await files.get(`f-${id}`);
    if (!obj) throw fail(404, 'not found');
    return new Response(obj.body, {
      headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=31536000, immutable' },
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
      next.reply = clip(b.reply, MAX_LETTER) || null;
      next.replied = next.reply ? Date.now() : null;
    }
    await db.prepare('UPDATE memes SET reaction = ?, reply = ?, replied = ? WHERE id = ?')
      .bind(next.reaction ?? null, next.reply ?? null, next.replied ?? null, id).run();
    if (next.reply && next.reply !== meme.reply) notify.send(meme.src, replyNote(side, meme.url ? 'gif' : meme.file ? 'file' : 'photo'));
    return json(view(next, side));
  }

  // Видаляє лише той, хто надіслав
  if (m === 'DELETE' && !sub) {
    if (meme.src !== side) throw fail(403, 'forbidden');
    await db.batch([
      db.prepare('DELETE FROM memes WHERE id = ?').bind(id),
      ...(meme.img ? [db.prepare('DELETE FROM imgs WHERE name = ?').bind(meme.img)] : []),
    ]);
    if (meme.file && files) await files.delete(`f-${id}`);
    return json({ ok: true });
  }

  throw fail(404, 'not found');
}

// Файл «як файл»: тіло — самі байти (телефон шифрує їх у RAD1), опис — у заголовку x-file-meta
// (base64url JSON: n — назва, вже «e1.», t — тип, s — розмір до шифрування, quote/on — відповідь)
// Лічильник доби окремим записом — видалення файлу його не зменшує, тож межу не обійти «завантажив — стер».
// len — заявлений розмір (content-length) для перевірки ще до читання тіла; take(b) — записати справжній
// Скільки зараз лежить у R2 (файли переписки й вкладення листів, крім стертих) — за частковими індексами, дешево
const storedFiles = async (db) => (await db.prepare(`SELECT IFNULL(SUM(json_extract(file, '$.s')), 0) AS n FROM memes WHERE file IS NOT NULL AND gone IS NULL`).first('n'))
  + (await db.prepare(`SELECT IFNULL(SUM(json_extract(media, '$.s')), 0) AS n ${LETTER_FILES}`).first('n'));
// hard — інша жорстка межа (тест)
async function fileQuota(db, side, len, hard, voice = false) {
  const key = `${voice ? 'voice' : 'files'}-day:${side}`;
  const cap = voice ? VOICE_PER_DAY : FILES_PER_DAY;
  const now = Date.now();
  const q0 = await getDoc(db, key);
  const q = q0 && now - q0.from < DAY_MS ? q0 : { from: now, n: 0, b: 0 };
  const fits = (b) => q.n < cap && q.b + (b || 0) <= FILES_BYTES_PER_DAY;
  if (!fits(len)) throw fail(429, 'files-day');
  const stored = await storedFiles(db);
  const room = (b) => stored + (b || 0) <= (Number(hard) || FILES_HARD);
  if (!room(len)) throw fail(507, 'storage-full');
  return {
    take: async (b) => {
      if (!fits(b)) throw fail(429, 'files-day');
      if (!room(b)) throw fail(507, 'storage-full');
      await putDoc(db, key, { from: q.from, n: q.n + 1, b: q.b + b });
    },
  };
}

// Альбоми для реакцій: us — «Наши фото» (🌌, правлять обоє), her — її фото (🍓, править лише він), his — його фото
// (🛡️, править лише вона); бачать обоє.
// До US_LIMIT фото, лише зашифровані (RAD1) — сервер їх не бачить і відкритих не прийме.
// R2 <album>-photo-<id> поза чисткою файлів: та стирає тільки f-/l- за рядками бази. Перше фото з 0.4.116 лежить як us-photo
// (у списку — id '0'). doc <album>-photo: { at — час останньої зміни (boot і letter віддають його телефонам), list: [{ id, at, by }] }
const US_MAX = 600 * 1024;
const US_LIMIT = 10;
const US_ID = /^(0|[0-9a-f]{12})$/;
const ALBUMS = { us: null, her: 'vin', his: 'vona' };
const usKey = (album, id) => (id === '0' ? `${album}-photo` : `${album}-photo-${id}`);
async function usList(db, album) {
  const d = await getDoc(db, `${album}-photo`);
  return { at: d?.at || null, list: d?.list || (d?.at ? [{ id: '0', at: d.at, by: d.by }] : []) };
}
async function usBody(req) {
  if (Number(req.headers.get('content-length')) > US_MAX) throw fail(413, 'size');
  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.byteLength || buf.byteLength > US_MAX) throw fail(413, 'size');
  if (buf[0] !== 0x52 || buf[1] !== 0x41 || buf[2] !== 0x44 || buf[3] !== 0x31) throw fail(400, 'sealed');
  return buf;
}
async function usSave(db, album, list) {
  const v = { at: list.length ? Date.now() : null, list };
  if (list.length) await putDoc(db, `${album}-photo`, v);
  else await db.prepare('DELETE FROM docs WHERE k = ?').bind(`${album}-photo`).run();
  return json(v);
}
// sub: null — старий шлях us-photo (телефон 0.4.116: одне фото — перше зі списку); '' — список; інакше id фото
async function usPhotoRoute(req, env, side, album, sub) {
  if (!env.FILES) throw fail(503, 'files');
  const m = req.method;
  if (m !== 'GET' && ALBUMS[album] && ALBUMS[album] !== side) throw fail(403, 'album');
  const { list } = await usList(env.DB, album);
  const key = (id) => usKey(album, id);
  const bytes = async (id) => {
    const obj = id !== undefined && await env.FILES.get(key(id));
    if (!obj) throw fail(404, 'not found');
    return new Response(obj.body, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, no-store' } });
  };
  if (sub === null) {
    if (m === 'GET') return bytes(list[0]?.id);
    if (m === 'PUT') {
      const buf = await usBody(req);
      if (list.length) await env.FILES.delete(list.map((x) => key(x.id)));
      await env.FILES.put(key('0'), buf);
      return usSave(env.DB, album, [{ id: '0', at: Date.now(), by: side }]);
    }
    if (m === 'DELETE') {
      if (list.length) await env.FILES.delete(list.map((x) => key(x.id)));
      return usSave(env.DB, album, []);
    }
    throw fail(405, 'method');
  }
  if (!sub) {
    if (m === 'GET') return json(await usList(env.DB, album));
    if (m !== 'POST') throw fail(405, 'method');
    if (list.length >= US_LIMIT) throw fail(409, 'limit');
    const buf = await usBody(req);
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await env.FILES.put(key(id), buf);
    return usSave(env.DB, album, [...list, { id, at: Date.now(), by: side }]);
  }
  if (!US_ID.test(sub) || !list.some((x) => x.id === sub)) throw fail(404, 'not found');
  if (m === 'GET') return bytes(sub);
  if (m === 'DELETE') {
    await env.FILES.delete(key(sub));
    return usSave(env.DB, album, list.filter((x) => x.id !== sub));
  }
  throw fail(405, 'method');
}

async function postFile(req, env, side, notify) {
  if (!env.FILES) throw fail(503, 'files');
  const len = Number(req.headers.get('content-length'));
  if (len > MAX_FILE) throw fail(413, 'size');
  let meta;
  try {
    // Телефон кодує опис як UTF-8 — без TextDecoder відкрита кирилиця (назва, цитата без ключа) ставала «Ð¾Ð…»
    const bin = atob(String(req.headers.get('x-file-meta') || '').replace(/-/g, '+').replace(/_/g, '/'));
    meta = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    throw fail(400, 'meta');
  }
  const quota = await fileQuota(env.DB, side, len, env.FILES_HARD_BYTES, meta?.v === 1 && /^audio\//.test(String(meta?.t || '')));
  const buf = await req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > MAX_FILE) throw fail(413, 'size');
  const size = Math.round(Number(meta?.s));
  const file = {
    n: clip(meta?.n, 1200) || 'файл',
    t: MIME.test(String(meta?.t || '')) ? meta.t : 'application/octet-stream',
    s: size > 0 && size <= MAX_FILE ? size : buf.byteLength,
  };
  // Голосове: тривалість у секундах і хвиля (телефон шифрує її, як і назву)
  const secs = Math.round(Number(meta?.d));
  const voice = meta?.v === 1 && /^audio\//.test(file.t) && secs >= 1 && secs <= 600;
  if (voice) Object.assign(file, { v: 1, d: secs, w: clip(meta?.w, 400) || '' });
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const meme = {
    id, src: side, dst: other(side), img: '', url: null, caption: null, style: null,
    quote: quoteOf(meta || {}), created: Date.now(), reaction: null, file: JSON.stringify(file),
    mascot: await mascotOf(env.DB, meta?.mascot),
  };
  await quota.take(buf.byteLength);
  await env.FILES.put(`f-${id}`, buf);
  await env.DB.prepare(
    'INSERT INTO memes (id, src, dst, img, url, caption, style, quote, created, reaction, file, mascot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(meme.id, meme.src, meme.dst, '', null, null, null, meme.quote, meme.created, null, meme.file, meme.mascot).run();
  notify.send(meme.dst, meme.quote ? replyNote(side, quoteOn(meta), voice ? 'voice' : 'file') : voice ? voiceNote(side) : fileNote(side));
  return json(view(meme, side), 201);
}

const other = (side) => (side === 'vin' ? 'vona' : 'vin');
// Кур'єр — лише справжній улюбленець із mascots, інакше null (телефон візьме того, хто зазвичай приносить)
async function mascotOf(db, key) {
  if (typeof key !== 'string' || !key || key.length > 40) return null;
  const mascots = (await getDoc(db, 'mascots')) || {};
  return Object.hasOwn(mascots, key) ? key : null;
}

const WISH_MARKS = ['eye', 'bought'];

function wishFields(b) {
  const rawLink = String(b.link || '').trim();
  const link = rawLink.slice(0, 500);
  const price = Math.round(Number(b.price));
  return {
    title: clip(b.title, 120),
    price: Number.isFinite(price) && price > 0 ? Math.min(price, 10_000_000) : null,
    // Лише звичайні веб-посилання — щоб у списку не опинилось javascript: чи щось дивне.
    // Зашифроване (e1.…) перевірити не можна — телефон перевірив до шифрування і перевірить, коли відкриває
    link: SEALED.test(rawLink) ? clip(rawLink, 500) : /^https?:\/\/\S+$/i.test(link) ? link : null,
    note: clip(b.note, 500) || null,
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
      gifted: r.gifted || null,
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
    notify.send(other(side), wishNote(side, f.title));
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
    // «Подарено» — бачить і автор: хотілка в нього переїжджає в «Сбылось», йому push; подароване — заодно й «куплено»
    if ('gifted' in b) {
      const gifted = b.gifted ? (r.gifted || Date.now()) : null;
      await db.prepare("UPDATE wishes SET gifted = ?, mark = CASE WHEN ? IS NULL THEN mark ELSE 'bought' END WHERE id = ?")
        .bind(gifted, gifted, r.id).run();
      if (gifted && !r.gifted) notify.send(r.owner, giftedNote(side));
      return json({ ok: true, gifted });
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
  return { id: r.id, at: r.at, text: r.text, mascot: r.mascot, opened: !!r.opened, liked: !!r.liked, reply: r.reply, special: !!special, media: mediaOf(r) };
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
    "SELECT id, env, text, liked, media FROM letters WHERE dst = ? AND kind = 'env' ORDER BY created",
  ).bind(side).all();
  const tpl = await tplRows(db, side);
  return list.map((e) => ({
    ...e,
    notes: [...(e.notes || []).map((n) => tplNote(n, tpl)), ...results.filter((r) => r.env === e.id)
      .map((r) => ({ id: r.id, text: r.text, liked: !!r.liked, media: mediaOf(r) }))],
  }));
}

// Вкладення до заготовленої записки: у заготовці на її місці { text, letter }, а фото/пісня — рядком kind 'tpl'.
// Позиція не зсувається («прочитано» рахується позицією). Рядка нема — лишається просто текст
async function tplRows(db, side) {
  const { results } = await db.prepare("SELECT id, liked, media FROM letters WHERE dst = ? AND kind = 'tpl'").bind(side).all();
  return new Map(results.map((r) => [r.id, r]));
}
function tplNote(n, rows) {
  if (typeof n === 'string' || !n) return n;
  const r = rows.get(n.letter);
  return r ? { id: r.id, text: n.text, liked: !!r.liked, media: mediaOf(r), tpl: true } : n.text;
}

// Його заготовлені записки в її конвертах — щоб докласти фото чи пісню: текст, вкладення, чи вже прочитано
async function theirTemplates(db, side) {
  const list = (await getDoc(db, `envelopes:${other(side)}`)) || [];
  const seen = ((await getDoc(db, `mine:${other(side)}`)) || {}).seen || {};
  const rows = await tplRows(db, other(side));
  return list.map((e) => ({
    id: e.id,
    notes: (e.notes || []).map((n, i) => {
      const v = tplNote(n, rows);
      return typeof v === 'string' ? { i, text: v, read: i < (seen[e.id] || 0) }
        : { i, text: v.text, media: v.media, read: i < (seen[e.id] || 0) };
    }),
  }));
}

// Куди докласти: записка ще не прочитана й без вкладення. Повертає, що записати в заготовку
async function tplTarget(db, side, envId, i) {
  const key = `envelopes:${other(side)}`;
  const list = (await getDoc(db, key)) || [];
  const e = list.find((x) => x.id === envId);
  const n = Number.isInteger(i) && i >= 0 ? e?.notes?.[i] : undefined;
  if (n == null) throw fail(400, 'tpl');
  const seen = ((await getDoc(db, `mine:${other(side)}`)) || {}).seen || {};
  if (i < (seen[envId] || 0)) throw fail(409, 'opened');
  if (typeof n === 'string') return { key, list, e, text: n, row: null };
  // Уже з вкладенням — докладаємо до того ж рядка
  const row = await db.prepare("SELECT id, media FROM letters WHERE id = ? AND kind = 'tpl' AND src = ?").bind(n.letter, side).first();
  if (!row) throw fail(409, 'tpl');
  return { key, list, e, text: n.text, row };
}
// Перший вільний номер файла в рядку (для нового — 0)
const nextF = (t) => mediaItems(t?.row ? mediaOf(t.row) : null).reduce((a, x) => (x.f != null ? Math.max(a, x.f + 1) : a), 0);
// Нові вкладення до заготовки: є рядок — доповнюємо його, нема — новий
async function tplAttach(db, side, t, i, id, add, mascot, now) {
  if (!t.row) {
    const media = packMedia(add);
    await tplInsert(db, side, t, i, id, media, mascot, now);
    return { id, media };
  }
  const old = mediaOf(t.row);
  if (old?.gone) throw fail(409, 'tpl');
  const list = [...mediaItems(old), ...add];
  if (list.length > MAX_ITEMS) throw fail(400, 'media');
  const media = packMedia(list);
  await db.prepare("UPDATE letters SET media = ? WHERE id = ? AND kind = 'tpl'").bind(JSON.stringify(media), t.row.id).run();
  return { id: t.row.id, media };
}
// Рядок вкладення й заготовка — одним batch: не лишиться ні рядка без записки, ні записки без рядка
async function tplInsert(db, side, t, i, id, media, mascot, now) {
  t.e.notes[i] = { text: t.text, letter: id };
  await db.batch([
    db.prepare('INSERT INTO letters (id, src, dst, kind, env, mascot, text, quote, at, created, pushed, stocked, media) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, side, other(side), 'tpl', t.e.id, mascot, '', null, now, now, 0, null, JSON.stringify(media)),
    db.prepare('UPDATE docs SET v = ?, updated = ? WHERE k = ?').bind(JSON.stringify(t.list), now, t.key),
  ]);
}
// Прибрати вкладення: записка знову просто текст; байти — з R2
async function tplRemove(db, side, files, envId, i) {
  const key = `envelopes:${other(side)}`;
  const list = (await getDoc(db, key)) || [];
  const e = list.find((x) => x.id === envId);
  const n = Number.isInteger(i) ? e?.notes?.[i] : undefined;
  if (!n || typeof n === 'string') throw fail(404, 'not found');
  const seen = ((await getDoc(db, `mine:${other(side)}`)) || {}).seen || {};
  if (i < (seen[envId] || 0)) throw fail(409, 'opened');
  const r = await db.prepare("SELECT id, media FROM letters WHERE id = ? AND kind = 'tpl' AND src = ?").bind(n.letter, side).first();
  e.notes[i] = n.text;
  await db.batch([
    db.prepare('UPDATE docs SET v = ?, updated = ? WHERE k = ?').bind(JSON.stringify(list), Date.now(), key),
    db.prepare("DELETE FROM letters WHERE id = ? AND kind = 'tpl'").bind(n.letter),
  ]);
  if (r && files && mediaOf(r)?.s != null) await files.delete(lkeys(r.id));
  return json({ ok: true });
}

// Заготовлена записка в її конверті, яку ще не прочитали (з вкладенням чи без)
async function noteTarget(db, side, envId, i) {
  const key = `envelopes:${other(side)}`;
  const list = (await getDoc(db, key)) || [];
  const e = list.find((x) => x.id === envId);
  if (!Number.isInteger(i) || i < 0 || e?.notes?.[i] == null) throw fail(404, 'not found');
  const seen = ((await getDoc(db, `mine:${other(side)}`)) || {}).seen || {};
  if (i < (seen[envId] || 0)) throw fail(409, 'opened');
  return { key, list, e };
}
// Новий текст записки; вкладення й місце в конверті лишаються
async function noteEdit(req, db, side, envId, i) {
  const text = clip((await readJson(req)).text, MAX_LETTER);
  if (!text) throw fail(400, 'text');
  const t = await noteTarget(db, side, envId, i);
  const n = t.e.notes[i];
  t.e.notes[i] = typeof n === 'string' ? text : { ...n, text };
  await db.prepare('UPDATE docs SET v = ?, updated = ? WHERE k = ?').bind(JSON.stringify(t.list), Date.now(), t.key).run();
  return json({ ok: true });
}
// Прибрати записку зовсім. Лише непрочитану: усе після неї теж не прочитане, тож «прочитано» (позиція) не збивається
async function noteDrop(db, side, files, envId, i) {
  const t = await noteTarget(db, side, envId, i);
  const [n] = t.e.notes.splice(i, 1);
  const r = typeof n === 'string' ? null
    : await db.prepare("SELECT id, media FROM letters WHERE id = ? AND kind = 'tpl' AND src = ?").bind(n.letter, side).first();
  await db.batch([
    db.prepare('UPDATE docs SET v = ?, updated = ? WHERE k = ?').bind(JSON.stringify(t.list), Date.now(), t.key),
    ...(r ? [db.prepare("DELETE FROM letters WHERE id = ? AND kind = 'tpl'").bind(r.id)] : []),
  ]);
  if (r && files && mediaOf(r)?.s != null) await files.delete(lkeys(r.id));
  return json({ ok: true });
}

// Вкладення листа: обʼєктом (не рядком JSON) — openDeep на телефоні дістане зашифроване всередині
function mediaOf(r) {
  if (!r.media) return null;
  try { return JSON.parse(r.media); } catch { return null; }
}
const MEDIA_BYTES = ['photo', 'voice', 'song'];
// Кілька вкладень: { k: 'multi', s (сума байтів, якщо є файли), items: [...] }; у файлового f — номер у R2 (0 → l-id, n → l-id-n).
// Одне вкладення лишається простим обʼєктом, як раніше
const MAX_ITEMS = 6;
const MAX_TOTAL = 60 * 1024 * 1024;
const mediaItems = (md) => (!md ? [] : md.k === 'multi' ? md.items || [] : [md.s != null ? { ...md, f: 0 } : md]);
const lkey = (id, f) => (f ? `l-${id}-${f}` : `l-${id}`);
// Усі можливі ключі листа — R2 мовчки пропускає відсутні
const lkeys = (id) => Array.from({ length: MAX_ITEMS }, (_, f) => lkey(id, f));
function packMedia(list) {
  if (!list.length) return null;
  if (list.length === 1 && !list[0].f) { const { f, ...one } = list[0]; return one; }
  const bytes = list.filter((x) => x.s != null);
  return { k: 'multi', ...(bytes.length ? { s: bytes.reduce((a, x) => a + x.s, 0) } : {}), items: list };
}
// Без байтів: одне чи список (гифки, посилання)
function linkList(m) {
  if (m == null) return null;
  const list = Array.isArray(m) ? m : [m];
  if (!list.length) return null;
  if (list.length > MAX_ITEMS) throw fail(400, 'media');
  return list.map(linkMedia);
}
const MEDIA_TYPES = { photo: /^image\/(webp|jpeg|png|gif)$/, voice: /^audio\/[\w.+-]{1,40}$/, song: /^audio\/[\w.+-]{1,40}$/ };
const VOICE_MAX_S = 75;
// Без байтів — гифка GIPHY чи посилання на пісню (зашифроване — перевіряє телефон, до шифрування й коли відкриває)
function linkMedia(m) {
  if (!m || typeof m !== 'object') return null;
  if (m.k === 'gif') {
    const gif = String(m.gif || '');
    if (!GIF_URL.test(gif)) throw fail(400, 'gif');
    const cap = clip(m.cap, 300) || null;
    return { k: 'gif', gif, cap, style: cap && MEME_FREE.test(String(m.style ?? '')) ? m.style : null, stick: stickOf(m.stick) };
  }
  if (m.k === 'link') {
    const raw = String(m.url || '').trim();
    const url = SEALED.test(raw) ? clip(raw, 500) : /^https?:\/\/\S+$/i.test(raw) ? raw.slice(0, 500) : '';
    if (!url) throw fail(400, 'link');
    return { k: 'link', url };
  }
  throw fail(400, 'media');
}
// Із байтами: опис від телефона → лише відомі поля; тип — без параметрів (audio/webm;codecs=opus → audio/webm)
function fileMedia(m, size) {
  const k = String(m?.k || '');
  const t = String(m?.t || '').split(';')[0].trim().toLowerCase();
  if (!MEDIA_BYTES.includes(k) || !MEDIA_TYPES[k].test(t)) throw fail(415, 'type');
  const out = { k, t, s: size };
  if (k === 'voice') out.d = Math.max(1, Math.min(VOICE_MAX_S, Math.round(Number(m.d)) || 1));
  if (k === 'song') out.n = clip(m.n, 1200) || null;
  if (k === 'photo') out.cap = clip(m.cap, 300) || null;
  return out;
}

async function lettersRoute(req, db, side, rest, notify, files, hard) {
  const m = req.method;

  // Лист у конверт із фото, голосом чи піснею — одним запитом, щоб байти в R2 не лишились без листа:
  // тіло — 4 байти довжини JSON (big-endian) ‖ JSON листа { env, text, mascot, cid, media { k, t, d, n, cap } } ‖ байти (RAD1)
  if (m === 'POST' && rest === 'attach') return attachLetter(req, db, side, files, hard, notify);

  // Надіслані мною — з тим, що вже сталося на тому боці
  if (m === 'GET' && rest === 'sent') {
    const { results } = await db.prepare(
      "SELECT id, kind, env, text, quote, at, created, opened, liked, reply, replied, stocked, media FROM letters WHERE src = ? AND kind NOT IN ('stock', 'tpl') "
        + 'ORDER BY created DESC LIMIT 60',
    ).bind(side).all();
    return json(results.map((r) => ({ ...r, opened: !!r.opened, liked: !!r.liked, media: mediaOf(r) })));
  }

  // «Наш плейлист»: пісні в листах обох. Свої — усі, отримані — лише вже відкриті (сюрприз у конверті не розкриваємо)
  if (m === 'GET' && rest === 'songs') {
    const { results } = await db.prepare(
      "SELECT id, src, kind, at, created, opened, liked, media FROM letters WHERE media IS NOT NULL "
        + "AND json_extract(media, '$.k') IN ('song', 'link', 'multi') AND kind IN ('now', 'morning', 'date', 'env', 'tpl') "
        + 'AND (src = ? OR (dst = ? AND opened IS NOT NULL)) ORDER BY created DESC LIMIT 200',
    ).bind(side, side).all();
    // Лист із кількома вкладеннями — окремий рядок на кожну пісню (у пісні-файла f каже, який файл брати)
    return json(results.flatMap((r) => {
      const md = mediaOf(r);
      return mediaItems(md).filter((x) => x.k === 'song' || x.k === 'link').map((x) => ({
        id: r.id, mine: r.src === side, kind: r.kind, at: r.kind === 'date' ? r.at : r.created,
        opened: !!r.opened, liked: !!r.liked, media: md?.gone ? { ...x, gone: md.gone } : x,
      }));
    }));
  }

  // Мій запас — лише відправнику, від найстарішого (його видадуть першим)
  if (m === 'GET' && rest === 'stock') {
    const { results } = await db.prepare(
      "SELECT id, text, mascot, created FROM letters WHERE src = ? AND kind = 'stock' ORDER BY created",
    ).bind(side).all();
    return json(results);
  }

  // «Мне»: усі отримані листи з застосунку, чий час настав
  if (m === 'GET' && rest === 'inbox') {
    const { results } = await db.prepare(
      "SELECT id, kind, text, quote, at, mascot, opened, liked, reply, media FROM letters WHERE dst = ? AND at <= ? "
        + "AND kind IN ('now', 'morning', 'date') ORDER BY at DESC LIMIT 60",
    ).bind(side, Date.now()).all();
    return json(results.map((r) => ({
      id: r.id, kind: r.kind, text: r.text, quote: r.quote || null, at: r.at, mascot: r.mascot,
      opened: !!r.opened, liked: !!r.liked, reply: r.reply, reaction: r.reaction || null, media: mediaOf(r),
    })));
  }

  if (m === 'POST' && !rest) {
    const b = await readJson(req);
    const kind = String(b.kind || '');
    const text = clip(b.text, MAX_LETTER);
    // Вкладення (гифка, посилання) — лише в лист у конверт і святковий; з ним текст може бути порожнім
    const links = kind === 'env' || kind === 'date' ? linkList(b.media) : null;
    const media = links ? packMedia(links) : null;
    if (!LETTER_KINDS.includes(kind) || (!text && !media)) throw fail(400, 'letter');
    const now = Date.now();
    let at = now;
    // Час «на ранок» рахує телефон (його часовий пояс); сервер лише не пускає в минуле й далеко вперед
    // «Ко времени» — будь-який день наперед, як «К дате»
    if (kind === 'morning') at = Math.max(now, Math.min(now + MAX_DATE_AHEAD, Number(b.at) || now));
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
          opened: !!dup.opened, liked: !!dup.liked, reply: dup.reply, media: mediaOf(dup), again: true,
        });
      }
    }
    const id = cid || crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    // Гифка чи посилання до заготовленої записки в її конверті — на місце записки, без push
    if (kind === 'env' && b.tpl != null) {
      if (!media) throw fail(400, 'letter');
      const t = await tplTarget(db, side, envId, Number(b.tpl));
      const out = await tplAttach(db, side, t, Number(b.tpl), id, links, mascot, now);
      return json({ id: out.id, kind: 'tpl', env: envId, media: out.media }, 201);
    }
    const stocked = kind === 'stock' ? now : null;
    // «Сейчас» — сповіщаємо одразу; «На утро» і святковий на свій час — cron, коли настане час; записки в конверт — ні.
    // Святковий «зараз» (час уже настав) — одразу, як звичайний
    const soon = kind === 'date' && at <= now + 60000;
    const later = (kind === 'morning' || (kind === 'date' && !soon)) && notify.on;
    const quote = quoteOf(b);
    await db.prepare(
      'INSERT INTO letters (id, src, dst, kind, env, mascot, text, quote, at, created, pushed, stocked, media) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, side, other(side), kind, envId, mascot, text, quote, at, now, later ? null : 0, stocked, media ? JSON.stringify(media) : null).run();
    if (kind === 'now' && quote) notify.send(other(side), replyNote(side, quoteOn(b)));
    else if (kind === 'now') notify.send(other(side), letterNote(kind, mascots[mascot]));
    else if (soon) notify.send(other(side), letterNote(kind, mascots[mascot]));
    return json({ id, kind, env: envId, text, quote, at, created: now, opened: false, liked: false, reply: null, media }, 201);
  }

  const [lid, sub] = rest.split('/');
  const r = await db.prepare('SELECT * FROM letters WHERE id = ?').bind(lid).first();
  // Лист у запасі для отримувача ще не існує
  if (!r || (r.src !== side && r.dst !== side) || (r.kind === 'stock' && r.dst === side)) throw fail(404, 'not found');

  // Байти вкладення з R2 (зашифровані RAD1 — розшифровує телефон)
  if (m === 'GET' && sub === 'file') {
    const md = mediaOf(r);
    const f = Number(new URL(req.url).searchParams.get('f')) || 0;
    const it = mediaItems(md).find((x) => x.f === f);
    if (!md || md.gone || !it || !MEDIA_BYTES.includes(it.k) || !files) throw fail(404, 'not found');
    const obj = await files.get(lkey(r.id, f));
    if (!obj) throw fail(404, 'not found');
    return new Response(obj.body, {
      headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=31536000, immutable' },
    });
  }
  if (sub) throw fail(404, 'not found');

  // Отримувач: відкрив, ❤️, відповідь
  if (m === 'PUT') {
    if (r.dst !== side) throw fail(403, 'forbidden');
    const b = await readJson(req);
    // Лише поля із запиту: «відкрив» і ❤️ можуть летіти одночасно, і старе прочитане не має затерти нове
    const sets = [];
    const args = [];
    if (b.opened) { sets.push('opened = COALESCE(opened, ?)'); args.push(Date.now()); }
    if ('liked' in b) { sets.push('liked = ?'); args.push(b.liked ? 1 : 0); }
    if ('reaction' in b) {
      if (b.reaction !== null && !REACTIONS.includes(b.reaction)) throw fail(400, 'reaction');
      sets.push('reaction = ?');
      args.push(b.reaction);
    }
    // ❤️ — відправнику push, але раз на лист: зняла й поставила знову — без повтору
    if (b.liked && !r.liked && !(await getDoc(db, `likepush:${r.id}`))) {
      await putDoc(db, `likepush:${r.id}`, Date.now());
      notify.send(r.src, likeNote(side, r.kind));
    }
    if ('reply' in b) {
      const reply = clip(b.reply, MAX_LETTER) || null;
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
    if (files && mediaOf(r)?.s != null) await files.delete(lkeys(r.id));
    return json({ ok: true });
  }

  throw fail(405, 'method');
}

async function attachLetter(req, db, side, files, hard, notify) {
  if (!files) throw fail(503, 'files');
  const len = Number(req.headers.get('content-length'));
  if (len > MAX_TOTAL + MAX_JSON) throw fail(413, 'size');
  const buf = new Uint8Array(await req.arrayBuffer());
  const head = buf.byteLength >= 4 ? new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0) : 0;
  if (!head || head > MAX_JSON || 4 + head >= buf.byteLength) throw fail(400, 'body');
  let b;
  try { b = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + head))); } catch { throw fail(400, 'body'); }
  const bytes = buf.subarray(4 + head);
  if (bytes.byteLength > MAX_TOTAL) throw fail(413, 'size');
  // Опис — список (новий телефон: у файлового len — скільки його байтів підряд у тілі) чи один обʼєкт (старий)
  const raw = Array.isArray(b.media) ? b.media : [b.media];
  if (!raw.length || raw.length > MAX_ITEMS) throw fail(400, 'media');
  const single = !Array.isArray(b.media);
  let pos = 0;
  const parts = [];
  const add = raw.map((m) => {
    if (!MEDIA_BYTES.includes(String(m?.k || ''))) return linkMedia(m);
    const n = single ? bytes.byteLength : Number(m.len);
    if (!Number.isInteger(n) || n <= 0 || n > MAX_FILE || pos + n > bytes.byteLength) throw fail(413, 'size');
    parts.push(bytes.subarray(pos, pos + n));
    pos += n;
    return fileMedia(m, n);
  });
  if (pos !== bytes.byteLength || !parts.length) throw fail(400, 'body');
  // Святковий (kind 'date') — без конверта, на свій час, як звичайний святковий; інакше — у конверт
  const festive = b.kind === 'date';
  const envId = festive ? null : String(b.env || '');
  if (!festive) {
    const theirs = (await getDoc(db, `envelopes:${other(side)}`)) || [];
    if (!theirs.some((e) => e.id === envId)) throw fail(400, 'env');
  }
  const cid = typeof b.cid === 'string' && CID.test(b.cid) ? b.cid : null;
  if (cid) {
    const dup = await db.prepare('SELECT * FROM letters WHERE id = ?').bind(cid).first();
    if (dup) {
      if (dup.src !== side) throw fail(409, 'cid');
      return json({ id: dup.id, kind: dup.kind, env: dup.env, text: dup.text, created: dup.created, opened: !!dup.opened, liked: !!dup.liked, media: mediaOf(dup), again: true });
    }
  }
  // До заготовленої записки в її конверті: ще не прочитана й без вкладення — перевіряємо до квоти й R2
  const tpl = !festive && b.tpl != null ? await tplTarget(db, side, envId, Number(b.tpl)) : null;
  // Квота доби й межа сховища — уже знаючи, що це не повтор
  const quota = await fileQuota(db, side, bytes.byteLength, hard);
  // Номери файлів у R2: до заготовки з вкладенням — після вже покладених
  let f = nextF(tpl);
  for (const m of add) if (m.s != null) m.f = f++;
  const mascots = (await getDoc(db, 'mascots')) || {};
  const mascot = mascots[b.mascot] ? String(b.mascot) : null;
  const text = clip(b.text, MAX_LETTER);
  const id = cid || crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const now = Date.now();
  const kind = festive ? 'date' : 'env';
  const at = festive ? Math.max(now, Math.min(now + MAX_DATE_AHEAD, Number(b.at) || now)) : now;
  // Як у POST: святковий «зараз» — push одразу, на свій час — cron; у конверт — без push
  const soon = festive && at <= now + 60000;
  const later = festive && !soon && notify.on;
  await quota.take(bytes.byteLength);
  // Спершу байти, потім рядок: обірвалось між ними — лишиться файл без листа, але лише в цьому рідкісному разі
  // й під тим самим id (повтор із тим самим cid його перезапише)
  const rowId = tpl?.row ? tpl.row.id : id;
  const fs = add.filter((m) => m.s != null);
  await Promise.all(fs.map((m, k) => files.put(lkey(rowId, m.f), parts[k])));
  if (tpl) {
    const out = await tplAttach(db, side, tpl, Number(b.tpl), id, add, mascot, now);
    return json({ id: out.id, kind: 'tpl', env: envId, media: out.media }, 201);
  }
  const media = packMedia(add);
  await db.prepare(
    'INSERT INTO letters (id, src, dst, kind, env, mascot, text, quote, at, created, pushed, stocked, media) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, side, other(side), kind, envId, mascot, text, null, at, now, later ? null : 0, null, JSON.stringify(media)).run();
  if (soon) notify.send(other(side), letterNote(kind, mascots[mascot]));
  return json({ id, kind, env: envId, text, quote: null, at, created: now, opened: false, liked: false, reply: null, media }, 201);
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
// Ідеї від ШІ, відмічені ❤️ одним заходом, — один рядок у чаті й один push: пачка, поки між сусідніми менше AI_BATCH
const AI_BATCH = 30 * 60000;
// «🔔 Звоночек» поспіль від того самого — один рядок із лічильником
const BELL_EVERY = 60000;
// Відповісти на дзвоночок можна пів години
const BELL_ANSWER_MS = 30 * 60000;
const BELL_BATCH = 10 * 60000;
function bellBatches(rows) {
  const out = [];
  const last = {};
  for (const r of rows) {
    if (r.kind !== 'bell') { out.push(r); continue; }
    const g = last[r.side];
    if (g && g.first - r.t < BELL_BATCH) {
      g.count += 1;
      g.first = r.t;
      continue;
    }
    last[r.side] = { ...r, count: 1, first: r.t };
    out.push(last[r.side]);
  }
  return out;
}
function aiBatches(rows) {
  const out = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.first - r.t < AI_BATCH) {
      last.titles.push(r.title);
      last.first = r.t;
    } else out.push({ kind: 'plans', id: r.id, titles: [r.title], first: r.t, t: r.t });
  }
  return out;
}
async function feedPage(db, side, url) {
  const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
  const n = Math.min(100, Math.max(10, Number(url.searchParams.get('limit')) || FEED_PAGE));
  const take = n + 1;
  const sentAt = "CASE WHEN kind = 'env' THEN created ELSE at END";
  const [inbox, sent, memes, news, marks, gifted, aiIdeas] = await Promise.all([
    db.prepare('SELECT id, kind, text, quote, at, mascot, opened, liked, reply, reaction, media, at AS t FROM letters '
      + "WHERE dst = ? AND at <= ? AND at < ? AND kind IN ('now', 'morning', 'date') "
      + 'ORDER BY at DESC LIMIT ?').bind(side, Date.now(), before, take).all(),
    db.prepare(`SELECT id, kind, env, text, quote, at, created, opened, liked, reply, replied, reaction, stocked, media, ${sentAt} AS t `
      + `FROM letters WHERE src = ? AND kind NOT IN ('stock', 'tpl') AND ${sentAt} < ? ORDER BY t DESC LIMIT ?`).bind(side, before, take).all(),
    db.prepare('SELECT *, created AS t FROM memes WHERE (src = ? OR dst = ?) AND created < ? ORDER BY created DESC LIMIT ?')
      .bind(side, side, before, take).all(),
    // Новини в чаті: другий додав хотілку чи план (ідеї від ШІ — не новина)
    db.prepare("SELECT 'wish' AS kind, id, title, NULL AS cat, created AS t FROM wishes WHERE owner = ? AND created < ? "
      + "UNION ALL SELECT 'plan' AS kind, id, title, cat, created AS t FROM ideas WHERE author = ? AND ai = 0 AND created < ? "
      + 'ORDER BY t DESC LIMIT ?').bind(other(side), before, other(side), before, take).all(),
    // «Я в порядке» і «Как ты?» обох — рядками в чаті
    db.prepare('SELECT kind, id, side, mood, at AS t FROM marks WHERE at < ? ORDER BY at DESC LIMIT ?').bind(before, take).all(),
    // «Подарено»: обом — хто подарив і що
    db.prepare("SELECT 'gifted' AS kind, id, title, owner AS whose, gifted AS t FROM wishes WHERE gifted IS NOT NULL AND gifted < ? ORDER BY gifted DESC LIMIT ?")
      .bind(before, take).all(),
    db.prepare('SELECT id, title, created AS t FROM ideas WHERE author = ? AND ai = 1 AND created < ? ORDER BY created DESC LIMIT ?')
      .bind(other(side), before, take * 4).all(),
  ]);
  const berryOk = url.searchParams.get('berry') === '1';
  if (!berryOk) marks.results = marks.results.filter((r) => r.kind !== 'berry');
  // Колесо в чаті: запрошення від другого (поки чекає) і останнє обертання — в обох
  const wheel = [];
  const inv = await todayInvite(db);
  if (inv && inv.by === other(side) && inv.at < before) wheel.push({ kind: 'invite', id: `i${inv.at}`, title: '', t: inv.at });
  // Ігри, що тривають (по одній кожного виду), — рядок там, де був останній хід; дограна — рядок marks kind duel
  for (const duel of Object.values(await activeDuels(db))) {
    const st = gameState(duel, await duelMoves(db, duel.id));
    const t = Math.max(duel.at, st.last);
    if (t < before) wheel.push({ id: `d${duel.id}`, duel: gameView(duel, st, side), t });
  }
  // «💞 Совпадёт?», що триває, — рядок там, де була остання відповідь; дограний — рядок marks kind same
  const same = await getDoc(db, 'same');
  if (same?.id) {
    const ans = await sameAnswers(db, same.id);
    const t = Math.max(same.at, ...Object.values(ans).map((a) => a.at));
    if (t < before) wheel.push({ id: `m${same.id}`, same: sameView(same, ans, side), t });
  }
  // «🔥 Совпадёт?» для двох: у стрічці лише стан, без текстів питань
  const hot = await getDoc(db, 'hot');
  if (hot?.id) {
    const ans = await hotAnswers(db, hot.id);
    const t = Math.max(hot.at, ...Object.values(ans).map((a) => a.at));
    if (t < before) wheel.push({ id: `x${hot.id}`, hot: hotView(hot, ans, side), t });
  }
  // «🍓 Клубничка», що триває: лише чий поступ, без питань
  const berry = berryOk ? await getDoc(db, 'berry') : null;
  if (berry?.id) {
    const ans = await berryAnswers(db, berry.id);
    const t = Math.max(berry.at, ...Object.values(ans).map((a) => a.at || 0));
    if (t < before) wheel.push({ id: `b${berry.id}`, berry: berryLive(berry, ans, side), t });
  }
  const spin = await getDoc(db, 'plan-spin');
  if (spin?.at && spin.at < before) {
    const idea = await db.prepare('SELECT title FROM ideas WHERE id = ?').bind(spin.id).first();
    if (idea) wheel.push({ kind: 'spin', id: `s${spin.at}`, title: idea.title, t: spin.at });
  }
  const wishes = marks.results.some((r) => r.kind === 'duel' || r.kind === 'gwish') ? await gwishes(db) : new Map();
  const parts = [['in', inbox.results], ['out', sent.results], ['meme', memes.results], ['news', [...news.results, ...aiBatches(aiIdeas.results), ...bellBatches(marks.results), ...gifted.results, ...wheel]]];
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
      opened: !!r.opened, liked: !!r.liked, reply: r.reply, reaction: r.reaction || null, media: mediaOf(r),
    })),
    sent: of('out').map(({ t, ...r }) => ({ ...r, opened: !!r.opened, liked: !!r.liked, media: mediaOf(r) })),
    memes: of('meme').map((r) => view(r, side)),
    news: of('news').map((r) => (r.duel ? { kind: 'duel', id: r.id, duel: r.duel, at: r.t }
      : r.same ? { kind: 'same', id: r.id, same: r.same, at: r.t }
      : r.hot ? { kind: 'hot', id: r.id, hot: r.hot, at: r.t }
      : r.berry ? { kind: 'berry', id: r.id, berry: r.berry, at: r.t }
      // Дограна «Клубничка» — лише рахунок (сирий mood з відповідями далі не йде)
      : r.kind === 'berry' ? { kind: 'berry', id: r.id, berry: berryEnd({ ...JSON.parse(r.mood), at: r.t }, side), at: r.t }
      // Дограна — лише збіги (mood рядка далі не йде: гілка нижче віддала б його сирим)
      : r.kind === 'hot' ? { kind: 'hot', id: r.id, hot: hotView({ ...JSON.parse(r.mood), at: r.t }, null, side), at: r.t }
      : r.kind === 'same' ? { kind: 'same', id: r.id, same: sameMarkView(r, side), at: r.t }
      : r.kind === 'duel' ? { kind: 'duel', id: r.id, duel: withGwish(duelMarkView({ ...r, at: r.t }, side), wishes, side), at: r.t }
      : r.kind === 'gwish' ? { kind: 'gwish', id: r.id, game: JSON.parse(r.mood).game, wish: gwishView(wishes.get(JSON.parse(r.mood).game), side), at: r.t }
      : r.titles
      ? { kind: r.kind, id: r.id, titles: [...r.titles].reverse(), at: r.t }
      : r.side
      ? { kind: r.kind, id: r.id, mine: r.side === side, mood: r.mood || null, at: r.t, ...(r.count > 1 ? { count: r.count } : {}) }
      : r.whose ? { kind: r.kind, id: r.id, title: r.title, mine: r.whose !== side, at: r.t }
      : { kind: r.kind, id: r.id, title: r.title, at: r.t, ...(r.cat === 'love' ? { love: true } : {}) })),
    more,
    horizon,
  };
}

// Для телефона: mine — «я надіслав», без внутрішніх src/dst/img
function view(r, side) {
  return {
    id: r.id, mine: r.src === side, url: r.url || null, caption: r.caption, style: r.style || null, quote: r.quote || null,
    created: r.created, reaction: r.reaction,
    reply: r.reply || null, replied: r.replied || null, gone: r.gone || null, stick: r.stick || null, mascot: r.mascot || null,
    ...(r.file ? { file: JSON.parse(r.file) } : {}),
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
    const out = await aiRun(env, VISION_MODEL, {
      messages: [{ role: 'user', content: [{ type: 'text', text: ask }, { type: 'image_url', image_url: { url: `data:${type};base64,${b64}` } }] }],
      max_tokens: 160,
    });
    return replyText(out).replace(/\s+/g, ' ').trim().slice(0, 300);
  } catch {
    // Не роздивилась — підписи однаково будуть, просто загальніші
    return '';
  }
}

// Рід автора й отримувача — останнім рядком запиту: на початку довгої інструкції Qwen його часом губила
// («Готова…» в його підписі). Без прикладів слів: приклад «я написал» модель вставляла дослівно
const genderRule = (he) => (he
  ? 'Род: пишет мужчина. О себе — только мужской род, к ней — только женский. Перед ответом проверь род каждого слова о себе.'
  : 'Род: пишет женщина. О себе — только женский род, к нему — только мужской. Перед ответом проверь род каждого слова о себе.');

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
  // Лише опис фото — телефон питає один раз, коли відкрився редактор, і далі шле його замість фото
  if (b.kind === 'photo-desc') {
    const img = String(b.image || '');
    const ok = img && img.length <= MAX_VISION_B64 && /^[A-Za-z0-9+/]+=*$/.test(img);
    return json({ desc: ok ? await describePhoto(env, img, MEME_TYPES.test(String(b.type || '')) ? String(b.type) : 'image/jpeg') : '' });
  }
  const level = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const situation = String(b.situation || '').trim().slice(0, 200) || 'просто так, порадовать';
  const funny = level(b.funny);
  const bold = level(b.bold);

  let system;
  let user;
  // Пошук гифки своїми словами: російською GIPHY шукає слабко — ті самі слова як 3 англійські запити
  if (b.kind === 'gif-words') {
    system = 'You turn a short Russian description of a GIF into GIPHY search queries. '
      + 'GIPHY works best with short, concrete, visual English queries: an emotion or action plus a subject. '
      + 'Keep the meaning of the words exactly; vary only the wording and the angle. '
      + 'Reply ONLY with JSON {"queries": [{"label": "...", "q": "..."}, …3 items]}: "q" — English, 2-4 words; '
      + '"label" — the same in Russian, 1-3 words. Nothing explicit.';
    user = `Words: ${situation}`;
  } else if (b.kind === 'gif') {
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
      + 'Длина каждой подписи: 3–10 слов, чтобы влезла на картинку. Эмодзи: не больше одного на подпись, можно без. '
      + genderRule(side === 'vin');
  }

  const out = await aiRun(env, AI_MODEL, {
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: b.kind === 'gif' || b.kind === 'gif-words' ? 400 : 700,
    temperature: b.kind === 'gif-words' ? 0.4 : 0.9,
  });
  const parsed = parseJsonReply(out);
  const list = (a) => (Array.isArray(a) ? a : []).map((x) => String(x).trim()).filter(Boolean);
  // Запити GIF — { label російською, q англійською }; рядок замість об'єкта теж приймаємо
  const queries = (Array.isArray(parsed.queries) ? parsed.queries : [])
    .map((x) => (typeof x === 'string' ? { label: x, q: x } : { label: String(x?.label || x?.q || ''), q: String(x?.q || '') }))
    .map((x) => ({ label: x.label.trim().slice(0, 40), q: x.q.trim().slice(0, 60) }))
    .filter((x) => x.q && x.label);
  if (b.kind === 'gif') return json({ queries: queries.slice(0, 6) });
  if (b.kind === 'gif-words') return json({ queries: queries.slice(0, 3) });
  // Модель іноді вставляє англійські слова посеред російської — такі підписи відкидаємо
  const captions = [...new Set(list(parsed.captions).map((c) => c.replace(/^["«]|["»]$/g, '')).filter((c) => !/[a-z]{3,}/i.test(c)))];
  const want = [`Повод: ${situation}`, passionTone(level(b.passion)).trim(), genderRule(side === 'vin')].filter(Boolean).join(' ');
  return json({ captions: await bestCaptions(env, captions, want) });
}

// Текст відповіді моделі → JSON-обʼєкт (або {})
const replyText = (out) => (typeof out?.response === 'string' ? out.response
  : out?.response ? JSON.stringify(out.response)
    : out?.choices?.[0]?.message?.content
      || out?.output_text
      || out?.output?.find?.((x) => x?.type === 'message')?.content?.find?.((c) => c?.text)?.text
      || '');

// Який ИИ першим — обирає він у налаштуваннях (mine:vin.ai), діє на обох. Не відповів (помилка, денний ліміт
// Workers AI, відмова, таймаут) — наступний у черзі; Claude лише з секретом ANTHROPIC_KEY.
// «Авто» — спершу безкоштовні, Claude — коли вони не відповіли (скінчився денний ліміт)
const CLAUDE_MODEL = 'claude-opus-5-5';
const CLAUDE_TIMEOUT_MS = 45_000;
const AI_ORDER = {
  auto: ['qwen', 'llama', 'claude'],
  qwen: ['qwen', 'llama', 'claude'],
  llama: ['llama', 'qwen', 'claude'],
  claude: ['claude', 'qwen', 'llama'],
};

async function aiRun(env, model, input) {
  const mode = (await getDoc(env.DB, 'mine:vin'))?.ai;
  // Фото розглядає лише модель із зором: замість Qwen/Llama — сама VISION_MODEL
  const steps = [...new Set((AI_ORDER[mode] || AI_ORDER.auto).map((s) => (model === AI_MODEL || s === 'claude' ? s : 'own')))];
  let err = new Error('no ai');
  for (const step of steps) {
    if (step === 'claude' && !env.ANTHROPIC_KEY) continue;
    try {
      if (step === 'claude') return { response: await claudeRun(env, input) };
      if (step === 'own') return await env.AI.run(model, input);
      // Qwen без міркування: з ним 15–30 с і порожня відповідь, бо міркування з'їдає max_tokens
      if (step === 'qwen') return await env.AI.run(AI_MODEL, { ...input, chat_template_kwargs: { enable_thinking: false } });
      return await env.AI.run(AI_FALLBACK_MODEL, input);
    } catch (e) {
      err = e;
      console.log(`ai ${step} failed:`, String(e?.message || e).slice(0, 200));
    }
  }
  throw err;
}

// Запит у форматі Workers AI (system серед messages, фото як data:-URL) → Messages API.
// temperature не передаємо: Opus 5.5 її не приймає
async function claudeRun(env, { messages, max_tokens: maxTokens }) {
  const part = (c) => {
    if (c.type !== 'image_url') return { type: 'text', text: c.text };
    const [, type, data] = /^data:([^;]+);base64,(.+)$/s.exec(c.image_url?.url || '') || [];
    return { type: 'image', source: { type: 'base64', media_type: type, data } };
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_KEY,
      'anthropic-version': '2026-10-21',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      // Мислення в Opus 5.5 вимкнути не можна, і воно йде в max_tokens — тож запас; платиться лише написане
      max_tokens: maxTokens + 8000,
      output_config: { effort: 'low' },
      // Відмова класифікатора — сервер сам повторює запит на запасній моделі
      fallbacks: 'default',
      system: messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n'),
      messages: messages.filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : m.content.map(part) })),
    }),
    signal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`claude ${res.status} ${(await res.text()).slice(0, 150)}`);
  const out = await res.json();
  if (out.stop_reason === 'refusal') throw new Error('claude refusal');
  const text = (out.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!text) throw new Error(`claude empty (${out.stop_reason})`);
  return text;
}

// Відповідь простим текстом (один лист): без JSON — абзаци-переноси всередині JSON-рядка ламали розбір
async function askText(env, system, user, maxTokens, temperature = 0.9) {
  const out = await aiRun(env, AI_MODEL, {
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
    const out = await aiRun(env, AI_MODEL, {
      messages: [
        {
          role: 'system',
          content: 'Ты строгий редактор мемов. Из пронумерованных подписей выбери 5 лучших: точно в заданном тоне, '
            + 'неожиданных, грамматически чистых, без банальностей, без пересказа картинки и без повторов друг друга. '
            + 'Подпись с ошибкой рода автора (правило — в запросе) не бери. Лучшую — первой. '
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
  const out = await aiRun(env, AI_MODEL, {
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
      `Задача: ${how}.\nПисьмо:\n${text}\n${genderRule(he)}`, 1200);
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
    + `поэтично на ${level(b.poetic)}% (0 — просто, как в переписке). ${passionTone(level(b.passion))}${genderRule(he)}`;
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

// Пошук GIF: GIPHY і (є ключ) KLIPY навпіл, через одну; ключі лише тут, у Worker. Звичайно — без 18+;
// adult=1 («Флирт», «Страсть») — GIPHY «r» (порно там нема взагалі), KLIPY — мʼякий фільтр
// Один не відповів — уся сторінка з другого
async function gifSearch(url, env) {
  if (!env.GIPHY_KEY && !env.KLIPY_KEY) throw fail(503, 'nokey');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const offset = Math.max(0, Math.min(200, Number(url.searchParams.get('offset')) || 0));
  const trending = url.searchParams.get('trending') === '1';
  // Суміш настрою просить по 4 з кількох пошуків; звичайна сторінка — 12
  const limit = Math.max(4, Math.min(12, Number(url.searchParams.get('limit')) || 12));
  if (!q && !trending) return json([]);
  const ask = { q, trending, adult: url.searchParams.get('adult') === '1' };
  const one = env.GIPHY_KEY ? giphyPage : klipyPage;
  if (!env.GIPHY_KEY || !env.KLIPY_KEY) return json(await one(env, { ...ask, limit, offset }));
  const half = Math.ceil(limit / 2);
  const part = { ...ask, offset: Math.floor(offset / 2) };
  const [g, k] = await Promise.allSettled([giphyPage(env, { ...part, limit: half }), klipyPage(env, { ...part, limit: limit - half })]);
  if (g.status === 'rejected' && k.status === 'rejected') throw g.reason;
  if (g.status === 'rejected') return json(await klipyPage(env, { ...ask, limit, offset }));
  if (k.status === 'rejected') return json(await giphyPage(env, { ...ask, limit, offset }));
  const out = [];
  for (let i = 0; i < Math.max(g.value.length, k.value.length); i += 1) out.push(...[g.value[i], k.value[i]].filter(Boolean));
  return json(out);
}
const cyr = (q) => /[а-яёіїєґ]/i.test(q);
async function giphyPage(env, { q, trending, adult, limit, offset }) {
  // Запит кирилицею GIPHY шукає російською, якщо сказати мову; «pg» — без 18+
  const api = new URL(`https://api.giphy.com/v1/gifs/${trending ? 'trending' : 'search'}`);
  api.search = new URLSearchParams({
    api_key: env.GIPHY_KEY, limit: String(limit), offset: String(offset), rating: adult ? 'r' : 'pg',
    ...(trending ? {} : { q, lang: cyr(q) ? 'ru' : 'en' }),
  });
  const res = await fetch(api);
  if (!res.ok) throw fail(502, 'giphy');
  const { data = [] } = await res.json();
  return data.map((g) => {
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
  }).filter((g) => g.url && GIF_URL.test(g.url));
}
// KLIPY: сторінки замість зсуву; content_filter high — найсуворіший; рекламні картки (type ≠ gif) не беремо
async function klipyPage(env, { q, trending, adult, limit, offset }) {
  const api = new URL(`https://api.klipy.com/api/v1/${env.KLIPY_KEY}/gifs/${trending ? 'trending' : 'search'}`);
  api.search = new URLSearchParams({
    per_page: String(limit), page: String(Math.floor(offset / limit) + 1), customer_id: 'radovalka', content_filter: adult ? 'low' : 'high',
    ...(trending ? {} : { q, locale: cyr(q) ? 'ru' : 'en' }),
  });
  const res = await fetch(api);
  if (!res.ok) throw fail(502, 'klipy');
  const items = (await res.json())?.data?.data || [];
  return items.filter((g) => g?.type === 'gif').map((g) => {
    const f = g.file || {};
    const big = f.hd?.mp4 || f.md?.mp4 || {};
    const small = f.xs?.webp || f.sm?.webp || f.xs?.gif || {};
    return {
      id: `k${g.id}`,
      preview: small.url,
      title: String(g.title || '').trim().slice(0, 80),
      url: big.url,
      w: Number(big.width) || 0,
      h: Number(big.height) || 0,
    };
  }).filter((g) => g.url && g.preview && GIF_URL.test(g.url) && GIF_URL.test(g.preview));
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
const PLAN_CATS = ['date', 'culture', 'active', 'trip', 'home', 'family', 'holidays', 'dreams', 'pets', 'love', 'other', 'distance', 'nature', 'food', 'craft'];
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
  const them = VOTE_COL[other(side)];

  if (m === 'GET' && !rest) {
    const { results } = await db.prepare('SELECT * FROM ideas ORDER BY created DESC, id').all();
    return json({
      deck: results.filter((r) => r[me] == null).reverse().map((r) => ideaView(r, side)),
      ours: results.filter(bothLike).sort((a, b) => b.matched - a.matched).map((r) => matchView(r, side)),
      // Мої ❤️ без збігу: автор бачить, що другий відклав (later); «нет» — окремо, у nope
      mine: results.filter((r) => r[me] === 1 && !bothLike(r) && r[them] !== -1)
        .map((r) => ({ ...ideaView(r, side), later: r[them] === 0 })),
      nope: results.filter((r) => r[me] === 1 && r[them] === -1).map((r) => ideaView(r, side)),
      // «Отложенные» — мої ⏳ (автор бачить їх як «отложил(а)»); мій ✕ (-1) у мене ніде не показується
      later: results.filter((r) => r[me] === 0).map((r) => ideaView(r, side)),
      // Обраний колесом — лише поки план спільний і не зроблений
      next: await planNext(db, results),
      // Сьогоднішнє обертання (одне на двох) — колесо показує його замість нового
      spin: await todaySpin(db),
      // Запрошення покрутити разом (до кінця дня): хто покликав і які теми обрав
      invite: await todayInvite(db),
    });
  }

  // Колесо вдвох. Один кличе («Крутим?») зі своїми темами — другому push; запрошення живе до кінця дня.
  // Крутити можна скільки завгодно разів — кожне обертання знову вдвох
  if (m === 'POST' && rest === 'invite') {
    const inv = await todayInvite(db);
    if (inv && inv.by !== side) throw fail(409, 'invited');
    const invite = { by: side, cats: cleanCats((await readJson(req))?.cats), at: Date.now(), day: kyivDay() };
    await putDoc(db, 'plan-invite', invite);
    // Повторне «позвать» того ж дня — без нового push, щоб не смикати
    if (!inv) notify.send(other(side), planInviteNote(side));
    return json({ invite, reaches: await hasPush(db, other(side)) });
  }
  if (m === 'DELETE' && rest === 'invite') {
    const inv = await todayInvite(db);
    if (inv && inv.by === side) await putDoc(db, 'plan-invite', null);
    return json({ ok: true });
  }

  // «Готов»: крутить може лише той, кого покликали. У колесо — теми обох разом (її + його; нічого не обрали — усі);
  // план обирає сервер, і він одразу «идём» у обох. Сектори (slots) зберігаємо — обоє бачать те саме колесо
  if (m === 'POST' && rest === 'spin') {
    const inv = await todayInvite(db);
    if (!inv || inv.by === side) throw fail(409, 'invite');
    const mine = cleanCats((await readJson(req))?.cats);
    // Порожній список у запрошенні — «усі теми»: тоді й колесо з усього
    const both = inv.cats.length ? [...new Set([...inv.cats, ...mine])] : [];
    const { results } = await db.prepare('SELECT * FROM ideas').all();
    const open = results.filter((x) => bothLike(x) && !x.done);
    const inBoth = both.length ? open.filter((x) => both.includes(x.cat)) : [];
    const pool = inBoth.length ? inBoth : open;
    if (!pool.length) throw fail(409, 'pool');
    const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0];
    const r = pool[rnd() % pool.length];
    // На колесі до 12 секторів: обраний і випадкові інші з тієї ж добірки
    const rest12 = pool.filter((x) => x.id !== r.id).sort(() => rnd() - 2 ** 31).slice(0, WHEEL_SLOTS - 1);
    const slots = [r, ...rest12].sort(() => rnd() - 2 ** 31).map((x) => x.id);
    const spin = { id: r.id, by: side, with: inv.by, at: Date.now(), day: kyivDay(), cats: inBoth.length ? both : [], slots };
    await putDoc(db, 'plan-spin', spin);
    await putDoc(db, 'plan-next', { id: r.id, by: side, at: spin.at });
    await putDoc(db, 'plan-invite', null);
    notify.send(inv.by, planGoNote(side));
    return json({ spin, reaches: await hasPush(db, inv.by) });
  }

  if (m === 'POST' && !rest) {
    const b = await readJson(req);
    const f = ideaFields(b);
    if (!f.title) throw fail(400, 'title');
    const fromAi = b.ai === true;
    const { row, stmt } = ideaInsert(db, side, f, fromAi ? 1 : 0, Date.now());
    await stmt.run();
    // Від ШІ — push лише на першу ідею пачки, решта тихо доповнює той самий рядок у чаті
    const inBatch = fromAi && await db.prepare('SELECT 1 FROM ideas WHERE author = ? AND ai = 1 AND created > ? AND id != ? LIMIT 1')
      .bind(side, row.created - AI_BATCH, row.id).first();
    if (!inBatch) notify.send(other(side), planNewNote(side, f.title, f.cat));
    return json(ideaView(row, side), 201);
  }

  if (!PLAN_ID.test(rest)) throw fail(404, 'not found');
  const r = await db.prepare('SELECT * FROM ideas WHERE id = ?').bind(rest).first();
  if (!r) throw fail(404, 'not found');

  if (m === 'PUT') {
    const b = await readJson(req);
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw fail(400, 'json');
    if ('vote' in b) {
      if (b.vote !== -1 && b.vote !== 0 && b.vote !== 1) throw fail(400, 'vote');
      // Голос — один раз, але ⏳ «потом» можна змінити на ❤️ чи ✕ («Отложенные»); збіг фіксуємо тим самим запитом,
      // щоб два одночасні ❤️ не розминулись
      const votedAt = Date.now();
      await db.prepare(`UPDATE ideas SET ${me} = ?, `
        + `matched = CASE WHEN ? = 1 AND ${them} = 1 THEN ? ELSE matched END WHERE id = ? `
        + `AND (${me} IS NULL OR (${me} = 0 AND ? <> 0))`)
        .bind(b.vote, b.vote, votedAt, r.id, b.vote).run();
      const after = await db.prepare('SELECT * FROM ideas WHERE id = ?').bind(r.id).first();
      // Збіг поставив саме цей запит (matched = наш час) — другому push; два одночасні ❤️ не дадуть двох
      if (after && bothLike(after) && after.matched === votedAt) notify.send(other(side), planMatchNote(after.title));
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
  culture: 'культурный выход вдвоём: театр, балет, опера, концерт, экскурсия, выставка, музей',
  active: 'активное вдвоём: спорт, походы, велосипед, каток, танцы, движение на воздухе',
  family: 'время вместе с друзьями или семьёй: гости, родители, компания, двойное свидание',
  holidays: 'праздники и свои традиции пары: Новый год, годовщина, дни рождения, маленькие ритуалы',
  dreams: 'общие мечты и цели пары: большое путешествие, дом, накопить, выучить, научиться, сделать за год',
  trip: 'поездка вдвоём: на выходные недалеко или в отпуск, с конкретным местом и занятием',
  home: 'вечер или выходной дома вдвоём: готовить, играть, смотреть, мастерить, устроить уют',
  pets: 'время вдвоём вместе с питомцами',
  love: 'романтичная близость вдвоём дома: нежный вечер, ночь только для двоих, игривое свидание; намёком и красиво, без откровенных подробностей',
  other: 'что-то новое вдвоём: научиться, попробовать, сделать своими руками, завести маленькую традицию',
  distance: 'свидание на расстоянии, когда живём в разных городах: по видеосвязи, переписка, посылки, одно занятие в одно время',
  nature: 'природа вдвоём: лес, вода, рассвет, звёзды, пикник, костёр',
  food: 'вкусное вдвоём: кафе и рестораны, готовить вместе, дегустации, кухни разных стран',
  craft: 'творчество вдвоём: мастер-классы, рисовать, лепить, мастерить своими руками, фото',
};

// Запас ідей для «✨ Подкинуть идеи» — написаний заздалегідь (краще за відповіді маленької моделі).
// Беремо випадкові, яких ще нема в колоді; закінчився запас теми — тоді вже ШІ. [назва, пояснення], нічого особистого
const IDEA_POOL = {
  distance: [
    ['Кино в одно время', 'Включить фильм по счёту «три» и переписываться по ходу'],
    ['Ужин по видеосвязи', 'Приготовить одно и то же блюдо и поесть «вместе»'],
    ['Письмо от руки', 'Настоящее, бумажное, с открыткой или засушенным цветком внутри'],
    ['Плейлист на двоих', 'По песне в день о том, по чему скучаешь'],
    ['Одна книга на двоих', 'Читать по главе и обсуждать вечером'],
    ['Посылка-сюрприз', 'Мелочи, которые напомнят о доме'],
  ],
  nature: [
    ['Встретить рассвет', 'Термос с чаем, плед и место повыше'],
    ['Пикник у воды', 'Корзинка, покрывало и никаких планов'],
    ['В лес за грибами', 'Кто больше найдёт, тот выбирает ужин'],
    ['Звёзды за городом', 'Уехать туда, где темно, и найти свои созвездия'],
    ['Новая тропа', 'Маршрут, по которому ещё не ходили'],
    ['Вечер у костра', 'Сосиски на палочках и разговоры до темноты'],
  ],
  food: [
    ['Кухня другой страны', 'Выбрать страну наугад и найти рецепт'],
    ['Завтрак в новом кафе', 'Не торопиться и взять то, что никогда не пробовали'],
    ['Дегустация дома', 'Сыры, вино или шоколад, и оценки по десятибалльной'],
    ['Испечь пирог вместе', 'Один месит, второй украшает'],
    ['Обойти уличную еду', 'Взять всего по кусочку и выбрать лучшее'],
    ['Мастер-класс по пасте', 'Научиться и потом повторить дома'],
  ],
  craft: [
    ['Гончарный мастер-класс', 'Слепить друг другу по кружке'],
    ['Портреты друг друга', 'Чем смешнее, тем лучше, потом повесить на стену'],
    ['Фотоальбом из наших снимков', 'Распечатать, подписать и разложить по годам'],
    ['Пазл на тысячу деталей', 'По кусочку каждый вечер'],
    ['Свечи своими руками', 'Выбрать запахи и сделать на подарок'],
    ['Записать песню', 'Хоть на телефон, главное вдвоём'],
  ],
  dreams: [
    ["Путешествие мечты", "Выбрать страну, посчитать бюджет и повесить карту на холодильник"],
    ["Свой дом с садом", "Нарисовать вместе, каким он будет — до последней скамейки"],
    ["Копилка на большую мечту", "Откладывать понемногу и отмечать каждую тысячу"],
    ["Выучить язык вместе", "Страны, куда поедем, — и говорить там без переводчика"],
    ["Карта желаний на год", "Коллаж из того, что хотим успеть вдвоём"],
    ["Собака или ещё один питомец", "Обсудить, кого, когда и как будем растить"],
    ["Встретить рассвет в каждом сезоне", "Четыре рассвета за год — зимой, весной, летом и осенью"],
    ["Свадебное путешествие заново", "Повторить или устроить то, о котором мечтали"],
    ["Научиться готовить фирменное блюдо", "Одно на двоих — и угощать им гостей"],
    ["Пробежать полумарафон вместе", "Готовиться по плану и финишировать за руку"],
    ["Свой маленький огород", "Вырастить помидоры и съесть первый вместе"],
    ["Ремонт мечты в одной комнате", "Выбрать стиль, цвета и сделать своими руками"],
    ["Год без пустых выходных", "Каждые выходные — что-то новое"],
    ["Посетить десять новых городов", "И собрать по магниту из каждого"],
    ["Книга о нас", "Писать понемногу нашу историю для будущих детей"],
    ["Научиться танцевать по-настоящему", "Чтобы на свадьбе друзей все ахнули"],
    ["Финансовая подушка", "Спокойствие на полгода вперёд — и меньше тревог"],
    ["Наш семейный герб", "Придумать символ, девиз и цвета"],
  ],
  active: [
    ['Скалодром для начинающих', 'Страховать друг друга и хвалить за каждый метр'],
    ['Велопрогулка за город', 'С термосом, бутербродами и остановкой у реки'],
    ['Каток вечером под музыку', 'Держаться за руки — и падать тоже вместе'],
    ['Поход с ночёвкой', 'Рюкзаки, костёр и звёзды без городской засветки'],
    ['Сплав на байдарке', 'Учиться грести в одном ритме'],
    ['Утренняя пробежка в парке', 'А потом заслуженный завтрак'],
    ['Йога вдвоём', 'Парные асаны и много смеха, когда не получается'],
    ['Картинг', 'Кто приедет вторым — тот платит за кофе'],
    ['Лыжи или сноуборд', 'А вечером — горячий шоколад и плед'],
    ['Трамплин-парк', 'Прыгать, как в детстве, и снимать друг друга в полёте'],
    ['Скандинавская ходьба', 'Неспешно, с палками и разговорами обо всём'],
    ['Урок сапбординга', 'Кто первый упадёт в воду'],
    ['Пешеходный маршрут на 15 километров', 'Посчитать шаги и отметить финиш мороженым'],
    ['Боулинг', 'С дурацкими победными танцами после страйка'],
    ['Бадминтон или теннис в парке', 'Без счёта — просто ради удовольствия'],
    ['Конная прогулка в поле', 'Медленно, рядом и под шум ветра'],
    ['Плавание в бассейне', 'А потом сауна и никуда не спешить'],
    ['Танцевальный марафон дома', 'Час любимой музыки — и танцевать без остановки'],
    ['Забег в костюмах', 'Благотворительный, весёлый и с медалью'],
    ['Восхождение на ближайшую вершину', 'Ради вида сверху и фото на память'],
  ],
  family: [
    ['Ужин у родителей', 'С тортом, который испечём вместе'],
    ['Пригласить друзей на настолки', 'Кто проигрывает — моет посуду'],
    ['Двойное свидание', 'С парой, с которой нам всегда весело'],
    ['Пикник большой компанией', 'Каждый приносит своё фирменное блюдо'],
    ['Шашлыки на природе', 'Мангал, гитара и разговоры до темноты'],
    ['Вечер воспоминаний с семьёй', 'Старые альбомы и истории, которые мы ещё не слышали'],
    ['Позвать друзей на домашний кинопоказ', 'Голосованием выбрать фильм'],
    ['Поездка с друзьями на выходные', 'Домик, баня и общий завтрак'],
    ['Помочь родителям на даче', 'Работа вместе — и чай на веранде'],
    ['Караоке-вечер с друзьями', 'Песни, которые все знают наизусть'],
    ['Семейный ужин с новым рецептом', 'Каждый готовит по одному блюду'],
    ['Квиз-вечер командой', 'Собрать друзей и выиграть приз'],
    ['Навестить бабушку и дедушку', 'Послушать их истории про молодость'],
    ['Праздничный бранч для друзей', 'Блины, кофе и долгие разговоры'],
    ['Мастер-класс компанией', 'Гончарный, кулинарный или винный'],
    ['Вечеринка в пижамах', 'С друзьями, какао и мультиками'],
    ['Познакомить друг друга со старыми друзьями', 'Посидеть там, где мы росли'],
    ['Семейная фотосессия', 'Все вместе — и с питомцами'],
  ],
  holidays: [
    ['Наша новогодняя традиция', 'Придумать ритуал, который будем повторять каждый год'],
    ['Украсить ёлку вместе', 'С горячим какао и новогодними фильмами'],
    ['Годовщина как в первый раз', 'Повторить наше первое свидание'],
    ['День рождения-сюрприз', 'Каждая мелочь — о том, что любит именинник'],
    ['Письма друг другу на годовщину', 'И открывать их каждый год'],
    ['Масленица с блинами', 'Кто испечёт самый ровный блин'],
    ['Пасхальный завтрак', 'Покрасить яйца и устроить битву'],
    ['Хэллоуин в костюмах-парах', 'Придумать парный образ'],
    ['Встретить первый снег', 'Выйти на улицу и загадать желание'],
    ['Свой маленький праздник', 'День, который отмечаем только мы двое'],
    ['Ночь на Ивана Купалу', 'Венки, костёр и поиски папоротника'],
    ['День святого Валентина без шаблонов', 'Никаких ресторанов — только своё, придуманное'],
    ['Встречать рассвет первого января', 'Тихо, с шампанским и пледом'],
    ['Адвент-календарь друг для друга', 'Маленький сюрприз каждый день до праздника'],
    ['Новогодний список желаний', 'Записать, что хотим успеть за год вместе'],
    ['Осенний праздник урожая', 'Ярмарка, тыквы и пирог'],
    ['Отметить круглое число дней вместе', 'Тысяча, две тысячи — любой красивый повод'],
    ['Праздничный ужин в стиле другой страны', 'Новый год по-итальянски или Рождество по-французски'],
  ],
  culture: [
    ['Премьера в театре', 'Нарядиться, взять программку и обсудить всё в антракте'],
    ['Балет или опера', 'Вечер, ради которого стоит достать самое красивое платье'],
    ['Концерт любимой группы', 'Петь все песни вслух и не стесняться'],
    ['Органный концерт в соборе', 'Музыка, от которой мурашки, и полумрак под сводами'],
    ['Пешая экскурсия по старому городу', 'С гидом, который знает все легенды и тайные дворики'],
    ['Ночная экскурсия', 'Город после заката совсем другой — с огнями и страшилками'],
    ['Экскурсия по крышам', 'Город сверху, ветер и фото, которых нет ни у кого'],
    ['Мюзикл', 'Выйти с песней в голове и напевать её всю неделю'],
    ['Стендап-вечер', 'Смеяться до слёз и потом пересказывать шутки друг другу'],
    ['Камерный спектакль в маленьком театре', 'Где актёры в двух шагах и видно каждую эмоцию'],
    ['Выставка, о которой все говорят', 'И выбрать по одной картине, которую повесили бы дома'],
    ['Ночь музеев', 'Пройти как можно больше залов, пока город не спит'],
    ['Симфонический оркестр', 'Классика, саундтреки к фильмам или вечер музыки из игр'],
    ['Джазовый вечер в клубе', 'Полумрак, коктейль и саксофон'],
    ['Экскурсия по замку или дворцу', 'Представить, как жили здесь сто лет назад'],
    ['Концерт при свечах', 'Сотни свечей, струнный квартет и любимые мелодии'],
    ['Театр под открытым небом', 'Летний вечер, плед и сцена среди деревьев'],
    ['Закулисье театра', 'Экскурсия туда, куда зрителей обычно не пускают'],
    ['Кинопоказ под звёздами', 'Кино на открытой площадке с пледом и попкорном'],
    ['Фестиваль уличных музыкантов', 'Гулять от сцены к сцене и находить новые любимые песни'],
    ['Экскурсия по местам из любимой книги', 'Пройти маршрутом героев'],
    ['Билеты на дальний ряд в последний момент', 'Спонтанно — на то, что идёт сегодня вечером'],
  ],
  date: [
    ['Ужин в ресторане другой кухни', 'Выбрать страну наугад по карте и найти её кухню в городе'],
    ['Вечер в планетарии', 'Найти на звёздном небе Стрельца — наше созвездие'],
    ['Прогулка без маршрута', 'Сворачивать туда, куда покажет подброшенная монетка'],
    ['Кино на последнем ряду', 'С большим ведром попкорна на двоих'],
    ['Мастер-класс по керамике', 'Слепить друг другу по чашке и потом пить из них чай'],
    ['Завтрак в кафе на рассвете', 'Встать пораньше и поймать первые лучи с горячим кофе'],
    ['Живой концерт в маленьком зале', 'Джаз, акустика или хор — главное, чтобы рядом и вживую'],
    ['Фотопрогулка по старому городу', 'Снять друг друга так, как никто ещё не снимал'],
    ['Свидание как в первый раз', 'Прийти по отдельности и познакомиться заново'],
    ['Вечер настольных игр в антикафе', 'Проигравший заказывает десерт'],
    ['Каток с горячим глинтвейном', 'Держаться за руки — по-честному, для равновесия'],
    ['Музей, где оба ни разу не были', 'И выбрать по одному любимому экспонату'],
    ['Пикник в парке с пледом', 'Корзинка, бутерброды и никаких телефонов'],
    ['Колесо обозрения на закате', 'Загадать желание на самом верху'],
    ['Дегустация сыра или вина', 'Записывать свои оценки и сравнить в конце'],
    ['Танцевальный урок для двоих', 'Сальса, бачата или вальс — кто кому отдавит ноги'],
    ['Ночная прогулка по набережной', 'Огни, тишина и разговоры обо всём'],
    ['Свидание в книжном магазине', 'Выбрать друг другу по книге, не показывая обложку'],
    ['Уличная еда на ярмарке', 'Попробовать то, что никогда раньше не решались'],
    ['Квест-комната вдвоём', 'Проверить, какая из нас команда'],
    ['Ботанический сад или оранжерея', 'Найти самый странный цветок'],
    ['Караоке в отдельной комнате', 'Спеть дуэтом нашу песню'],
    ['Свидание-сюрприз', 'Один придумывает всё, второй узнаёт только место встречи'],
    ['Кофе и пирожное в новой кондитерской', 'Каждый раз — новое место в городе'],
    ['Прогулка по крышам или смотровой площадке', 'Город с высоты — и мы над ним'],
    ['Свидание-квест в стиле «Амели»', 'Записки с подсказками по нашим памятным местам, а в конце — встреча'],
    ['Турист на своей улице', 'Пройти привычный маршрут и найти там незнакомые дворики и кофейни'],
    ['Рисование с бокалом вина', 'Мастер-класс, где оба не умеют рисовать — и это прекрасно'],
    ['Свидания по алфавиту', 'Каждое следующее — на новую букву: «А» — аквапарк, «Б» — боулинг…'],
    ['Лазертаг или пейнтбол', 'Выяснить, кто из нас метче, и потом лечить синяки поцелуями'],
    ['Конная прогулка', 'Медленно по лесу, а потом чай в деревенском кафе'],
  ],
  trip: [
    ['Выходные в домике в горах', 'Камин, тёплые носки и вид на вершины'],
    ['Поездка к морю не в сезон', 'Пустой пляж, ветер и чай из термоса'],
    ['Маленький город, где никогда не были', 'Сесть на первый поезд и выйти там, где понравится'],
    ['Ночь в палатке у озера', 'Костёр, звёзды и утренний туман над водой'],
    ['Гастротур по соседней стране', 'Три города — три любимых блюда'],
    ['Глэмпинг в лесу', 'Природа, но с удобной кроватью'],
    ['Поездка на поезде в купе', 'Чай в подстаканниках и разговоры до ночи'],
    ['Уикенд в европейской столице', 'Без плана — только карта и любопытство'],
    ['Винодельня с ночёвкой', 'Дегустация, виноградники и закат'],
    ['Поход по горному маршруту', 'Подняться вместе туда, где облака ниже нас'],
    ['Термальные источники', 'Тёплая вода, холодный воздух и полное расслабление'],
    ['Замки и крепости за один день', 'Почувствовать себя рыцарем и принцессой'],
    ['Поездка за осенними листьями', 'Найти самый яркий лес и наделать фото'],
    ['Остров на выходные', 'Паром, рыбный ресторан и прогулка по берегу'],
    ['Рыбалка с ночёвкой', 'Удочки, уха и тишина'],
    ['Велосипедный маршрут на целый день', 'С остановками на кофе и перекусы'],
    ['Зимний курорт', 'Лыжи, сноуборд или просто санки и горячий шоколад'],
    ['Поездка по местам нашего детства', 'Показать друг другу, где выросли'],
    ['Спа-отель на выходные', 'Халаты, массаж и ничего не делать'],
    ['Роуд-трип без бронирования', 'Ехать, куда глаза глядят, и ночевать, где понравится'],
    ['Фестиваль под открытым небом', 'Музыка, фонарики и толпа счастливых людей'],
    ['Встретить рассвет в горах', 'Подняться ночью и увидеть, как просыпается мир'],
    ['Поездка на лавандовые поля', 'Фиолетовое море до горизонта'],
    ['Город с каналами', 'Покататься на лодке и заблудиться в улочках'],
    ['Поездка к водопадам', 'Брызги, радуга и шум воды'],
  ],
  home: [
    ['Ужин при свечах дома', 'Красивая скатерть, любимое блюдо и наша музыка'],
    ['Марафон фильмов под пледом', 'Каждый выбирает по одному и не спорит'],
    ['Готовим блюдо, которое ни разу не пробовали', 'Рецепт наугад — и вместе на кухне'],
    ['Вечер настольных игр', 'Монополия, карты или пазл на тысячу деталей'],
    ['Домашний кинотеатр с проектором', 'Простыня на стене и попкорн в миске'],
    ['Испечь пиццу с нуля', 'Каждый собирает свою половину начинки'],
    ['Вечер воспоминаний', 'Пересмотреть старые фото и рассказать, что за ними'],
    ['Пижамный день', 'Никуда не выходить, только еда, сериалы и обнимашки'],
    ['Мастерим что-то своими руками', 'Свечи, картина или скворечник'],
    ['Домашний спа-вечер', 'Маски, ванна, массаж и спокойная музыка'],
    ['Завтрак в постель', 'Блинчики, кофе и никакой спешки'],
    ['Собрать большой пазл', 'И повесить его потом в рамке'],
    ['Вечер танцев в гостиной', 'Выключить свет, включить нашу музыку'],
    ['Шалаш из одеял', 'Как в детстве — с фонариком и сказками'],
    ['Кулинарная битва', 'Один набор продуктов — два разных блюда'],
    ['Рисуем портреты друг друга', 'Чем смешнее — тем лучше'],
    ['Читаем вслух одну книгу', 'По главе за вечер, по очереди'],
    ['Посадить что-то на подоконнике', 'Базилик, мяту или маленькое лимонное дерево'],
    ['Вечер викторины про нас', 'Кто лучше знает другого'],
    ['Домашний фотосет', 'Свет из окна, смешные позы и лучшие кадры в рамку'],
    ['Сделать капсулу времени', 'Письма себе через пять лет — и спрятать'],
    ['Испечь печенье с предсказаниями', 'И спрятать в них свои записки'],
    ['Переставить мебель вместе', 'Устроить дома новое уютное место'],
    ['Вечер без света', 'Только свечи, гирлянда и разговоры'],
    ['Составить карту наших мечтаний', 'Коллаж из того, что хотим сделать вместе'],
    ['Выпечка с завязанными глазами', 'Один печёт вслепую, второй подсказывает словами'],
    ['Домашняя фотобудка', 'Шторка, гирлянда, смешные шляпы — и пачка снимков на холодильник'],
  ],
  pets: [
    ['Долгая прогулка в лесу с собакой', 'Новая тропинка и много палочек'],
    ['Фотосессия питомцев', 'Смешные костюмы и вкусняшки за терпение'],
    ['Пикник вместе с питомцами', 'Плед для нас, миска и игрушка для них'],
    ['Испечь лакомство для питомцев', 'Домашнее печенье по безопасному рецепту'],
    ['Поездка на природу с собакой', 'Речка, поле и свобода бегать'],
    ['Новая игрушка — вместе выбрать', 'И посмотреть, кому больше понравится'],
    ['Вечер обнимашек на диване', 'Все вместе под одним пледом'],
    ['Построить коту крепость из коробок', 'С окошками и тайными ходами'],
    ['Пляж для собак', 'Плавать, бегать и валяться в песке'],
    ['Снять смешное видео про питомцев', 'Сделать маленький фильм про их день'],
    ['Помочь приюту для животных', 'Отвезти корм или погулять с собаками из приюта'],
    ['День рождения питомца', 'Торт, колпаки и фото на память'],
    ['Совместная тренировка с собакой', 'Выучить новую команду или трюк'],
    ['Кафе, куда пускают с животными', 'Кофе для нас, вода и угощение для них'],
    ['Утренняя пробежка всей семьёй', 'Кто первый добежит до лавочки'],
    ['Нарисовать портреты питомцев', 'И повесить на стену как семейную галерею'],
    ['Новый маршрут для прогулки', 'Найти парк, где ещё не были'],
    ['Сделать питомцам уютный уголок', 'Лежанка, плед и любимые игрушки'],
  ],
  love: [
    ['Ночь только для нас', 'Телефоны выключены, свечи зажжены'],
    ['Свидание без телефонов', 'Целый вечер только друг для друга'],
    ['Утро, когда никуда не надо', 'Проснуться и никуда не вставать'],
    ['Ванна с пеной на двоих', 'Свечи, музыка и что-нибудь вкусное'],
    ['Танец на кухне под нашу песню', 'Медленно и очень близко'],
    ['Массаж при свечах', 'По очереди и без спешки'],
    ['Вечер в отеле в своём же городе', 'Как будто убежали от всего мира'],
    ['Письмо, которое прочитаем вслух', 'Написать друг другу о самом нежном'],
    ['Завтрак, который затянется до обеда', 'В постели и в обнимку'],
    ['Свидание при луне', 'Плед, звёзды и тёплое вино'],
    ['Вечер «как в первый раз»', 'Вспомнить, с чего всё началось'],
    ['Медленный танец в темноте', 'Только мы и музыка'],
    ['Подарить друг другу целый вечер', 'Один загадывает — второй исполняет'],
    ['Поцелуи под дождём', 'Выйти, когда все прячутся под зонты'],
    ['Ночь с видом на огни города', 'Номер повыше и шторы открыты'],
    ['Вечер обнимашек без причины', 'Просто потому, что соскучились'],
  ],
  other: [
    ['Научиться чему-то новому вместе', 'Онлайн-курс, язык или инструмент'],
    ['Посадить дерево', 'И приходить к нему каждый год'],
    ['Завести маленькую традицию', 'Например, пятничную пиццу или воскресный кофе'],
    ['Волонтёрский день вдвоём', 'Помочь кому-то — и почувствовать себя командой'],
    ['Список ста желаний', 'Записать всё, что хотим успеть вместе'],
    ['Попробовать экстрим', 'Скалодром, картинг или полёт на шаре'],
    ['Мастер-класс шоколатье', 'Сделать конфеты и съесть половину сразу'],
    ['Записать нашу песню', 'Хоть на телефон, хоть в студии'],
    ['Пробежать забег вместе', 'Пять километров — и медаль на двоих'],
    ['Сделать фотокнигу о нас', 'Лучшие кадры за всё время'],
    ['День без «нет»', 'Говорить друг другу только «да»'],
    ['Сыграть в туристов в своём городе', 'Экскурсия, сувениры и фото у памятников'],
    ['Йога на рассвете', 'Коврики, тишина и первые лучи'],
    ['Собрать гербарий', 'Листья и цветы из всех наших прогулок'],
    ['Испечь торт на три яруса', 'Без повода — просто потому что можем'],
    ['Обменяться ролями на день', 'Каждый делает то, что обычно делает другой'],
    ['Встретить первый снег вместе', 'Выйти и поймать снежинки на ладонь'],
    ['Написать письма в будущее', 'Открыть через год и вспомнить этот день'],
    ['Сходить на мастер-класс по коктейлям', 'И придумать свой фирменный'],
    ['Мини-поход по городу пешком', 'Пройти его из конца в конец за день'],
    ['Мастер-класс по букетам', 'Собрать друг другу по букету и унести домой'],
  ],
};

// «✨ Подкинуть идеи»: 3 пропозиції на тему — спершу із запасу, потім ШІ; у колоду не пишемо — людина обирає ❤️.
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
    + 'Ответь ТОЛЬКО JSON {"ideas": [{"title": "...", "note": "..."}]} — пять заметно разных идей.';
  const user = `Тема: ${PLAN_TOPICS[cat]}. Питомцы дома: ${pets || 'нет'}. `
    + `${hint ? `Пожелание: ${hint}. ` : ''}`
    + `${known.length ? `Уже придумано, не повторяй: ${known.map((t) => `«${t}»`).join(', ')}.` : ''}`;
  // Запас: те, чого ще нема серед ідей (за назвою), у випадковому порядку
  const knownAll = new Set((await env.DB.prepare('SELECT title FROM ideas').all()).results.map((r) => r.title.toLowerCase()));
  const shown = new Set((Array.isArray(b?.skip) ? b.skip : []).map((t) => String(t).toLowerCase()));
  const left = (IDEA_POOL[cat] || []).filter(([t]) => !knownAll.has(t.toLowerCase()) && !shown.has(t.toLowerCase()));
  if (left.length >= 3 || (left.length && !hint)) {
    const pick = left.sort(() => Math.random() - 0.5).slice(0, 3).map(([title, note]) => ({ title, note, cat }));
    return json({ ideas: pick, from: 'pool' });
  }
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
  return json({ ideas: fresh.slice(0, 3), from: 'ai' });
}

// ── Push-сповіщення ───────────────────────────────────────────────────────
// Web Push: VAPID (RFC 8292) + шифрування вмісту aes128gcm (RFC 8291) на Web Crypto, без бібліотек.
// Без ключа VAPID (локально) усе мовчки нічого не робить. Текст листа в сповіщення не кладемо — його видно на заблокованому екрані

const PUSH_HOSTS = /(^|\.)(googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;
const APP_URL = 'https://vitaliylobko.github.io/raduvalka/';
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (str) => Uint8Array.from(atob(String(str).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

// Відкритий ключ VAPID — з самого закритого (у JWK є x і y): деплой стирає звичайні змінні, а секрет лишається.
// Ключ виходить той самий, тож підписки телефонів не ламаються
function vapidPublic(env) {
  if (env.VAPID_PUBLIC) return env.VAPID_PUBLIC;
  if (!env.VAPID_PRIVATE) return null;
  const { x, y } = JSON.parse(env.VAPID_PRIVATE);
  return b64u(Uint8Array.from([4, ...unb64u(x), ...unb64u(y)]));
}
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
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${vapidPublic(env)}`;
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
      urgency: note.urgent || HIGH_TAGS.test(note.tag || '') ? 'high' : 'normal',
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
// Що треба отримати одразу — висока терміновість: Android у сплячому режимі не притримує такі push пачкою.
// Листи, фото й гифки, відповіді, дзвоночок і відповідь на нього, «Как ты?», «Я в порядке», сердечко, «Да, капитан», ходи в іграх
// (і 18+: кубики, «Клубничка», «Совпадёт? 🔥»). Хотілки, плани, ❤️ на лист і конверти — звичайні, не горять
const HIGH_TAGS = /^(letter|meme|reply|bell|bell-answer|ask|checkin|heart|captain|duel|same|hot|berry|gwish)/;
function pusher(req, env, ctx) {
  const on = !!env.VAPID_PRIVATE && req.headers.get('x-no-push') !== '1';
  return {
    on,
    send(side, note) {
      if (!on) return;
      // Локальна перевірка уведомлень (dev/local-api.mjs): записати, що пішло б, замість справжнього push
      if (env.PUSH_SPY) { env.PUSH_SPY(side, note); return; }
      const job = pushSide(env, side, note);
      if (ctx?.waitUntil) ctx.waitUntil(job);
    },
  };
}

// Що написати: хто приніс, без самого тексту листа
function letterNote(kind, pet) {
  const brought = pet ? `${pet.name} ${pet.g === 'f' ? 'принесла' : 'принёс'}` : '';
  if (kind === 'date') return { title: 'Письмо к особому дню 💌', body: brought ? `${brought} письмо` : 'Открой, пока тёплое', tag: 'letter' };
  if (kind === 'morning') return { title: 'Письмо на сегодня 💌', body: brought ? `${brought} письмо дня` : 'Открой, пока тёплое', tag: 'letter' };
  return { title: 'Тебе письмо 💌', body: brought ? `${brought} письмо` : 'Открой, пока тёплое', tag: 'letter' };
}

// Мемчик і відповідь: хто й на що, без самого тексту — сповіщення видно на заблокованому екрані
const sender = (side, he, she) => (side === 'vin' ? he : she);
function memeNote(from, gif) {
  return { title: gif ? 'Тебе гифка 🎞' : 'Тебе фото 📷', body: sender(from, 'Он прислал — открой', 'Она прислала — открой'), tag: 'meme' };
}
function stickerNote(from) {
  return { title: 'Тебе наклейка 🐾', body: sender(from, 'Он прислал — открой', 'Она прислала — открой'), tag: 'meme' };
}
function fileNote(from) {
  return { title: 'Тебе файл 📎', body: sender(from, 'Он прислал — открой', 'Она прислала — открой'), tag: 'meme' };
}
function voiceNote(from) {
  return { title: '🎤 Голосовое', body: sender(from, 'Он прислал голосовое — послушай', 'Она прислала голосовое — послушай'), tag: 'meme' };
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

function wishNote(from, title) {
  // Зашифровану назву сервер не знає — тоді без неї (і на заблокованому екрані її не видно)
  if (SEALED.test(title)) return { title: 'Новая хотелка 🎁', body: sender(from, 'Он добавил хотелку', 'Она добавила хотелку'), tag: 'wish', go: 'wish' };
  return { title: 'Новая хотелка 🎁', body: `${sender(from, 'Он хочет', 'Она хочет')}: «${title}»`, tag: 'wish', go: 'wish' };
}
// «Нежность» — з натяком: «клубничка» замість протокольного «предложил план»
const LOVE_TITLE = 'Заняться любовью';
function planNewNote(from, title, cat) {
  if (cat === 'love') {
    return {
      title: 'Клубничка 🍓',
      body: title === LOVE_TITLE ? `${sender(from, 'Он предлагает', 'Она предлагает')} 🍓😉` : `${sender(from, 'Он предлагает', 'Она предлагает')}: «${title}» 😉`,
      tag: 'plan-new', go: 'deck',
    };
  }
  return { title: 'Новый план 🧭', body: `${sender(from, 'Он предложил', 'Она предложила')}: «${title}». Листай — может, совпадёт 💞`, tag: 'plan-new', go: 'deck' };
}
function planMatchNote(title) {
  return { title: 'Совпало! 💞', body: `Вы оба хотите: «${title}»`, tag: 'plan-match', go: 'plans' };
}

// День за Києвом: «одне обертання на день» міняється опівночі в них, а не за UTC
const kyivDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: STOCK_TZ }).format(new Date());

async function todaySpin(db) {
  const s = await getDoc(db, 'plan-spin');
  return s && s.day === kyivDay() ? s : null;
}

async function todayInvite(db) {
  const i = await getDoc(db, 'plan-invite');
  return i && i.day === kyivDay() ? i : null;
}

const WHEEL_SLOTS = 12;
// Теми з телефона: лише короткі ключі (food, walk…), не більше дюжини
const cleanCats = (list) => [...new Set((Array.isArray(list) ? list : []).map(String).filter((c) => /^[a-z]{2,16}$/.test(c)))].slice(0, 12);

function planInviteNote(from) {
  return {
    title: 'Крутим барабан? 🎰',
    body: `${sender(from, 'Он зовёт', 'Она зовёт')} крутить вместе: выбери темы и жми «Готов».`,
    tag: 'plan-invite',
    go: 'wheel',
  };
}

async function planNext(db, rows) {
  const n = await getDoc(db, 'plan-next');
  const r = n && rows.find((x) => x.id === n.id);
  return r && bothLike(r) && !r.done ? n : null;
}

// Тап — барабан докручується в того, хто кликав. Назви плану нема — інакше крутити вже нема чого
function planGoNote(from) {
  return {
    title: 'Барабан крутится 🎰',
    body: `${sender(from, 'Он готов', 'Она готова')} — открой и посмотри, что выпало.`,
    tag: 'plan-go',
    go: 'wheel',
  };
}

// Перехід на шифрування: кожен телефон сам шифрує те, що написав. Таблиця → поле → чиє воно (колонка-власник):
// автор листа чи мемчика — текст, підпис, цитата; отримувач — свою відповідь; власник хотілки — назву, нотатку, посилання.
// todo віддає лише своє незашифроване; seal приймає лише «e1.…» і лише в свої поля. Чужого відкритого тут не видно
const SEAL_COLS = {
  letters: { text: 'src', quote: 'src', reply: 'dst' },
  memes: { caption: 'src', quote: 'src', reply: 'dst' },
  wishes: { title: 'owner', note: 'owner', link: 'owner' },
};
async function sealRoute(req, db, side, path) {
  if (req.method === 'GET' && path === 'seal/todo') {
    const rows = [];
    for (const [t, cols] of Object.entries(SEAL_COLS)) {
      const owners = [...new Set(Object.values(cols))];
      const { results } = await db.prepare(`SELECT id, ${owners.join(', ')}, ${Object.keys(cols).join(', ')} FROM ${t} WHERE ${owners.map((o) => `${o} = ?`).join(' OR ')}`)
        .bind(...owners.map(() => side)).all();
      for (const r of results) {
        const row = { t, id: r.id };
        for (const [f, own] of Object.entries(cols)) if (r[own] === side && r[f] && !SEALED.test(r[f])) row[f] = r[f];
        if (Object.keys(row).length > 2) rows.push(row);
      }
    }
    // Свої фото (мемчики й хотілки), ще не зашифровані: «RAD1» у base64 починається з UkFEM
    const { results: imgs } = await db.prepare(
      "SELECT i.name FROM imgs i WHERE i.data NOT LIKE 'UkFEM%' AND (i.name IN (SELECT img FROM memes WHERE src = ? AND img IS NOT NULL) OR i.name IN (SELECT img FROM wishes WHERE owner = ? AND img IS NOT NULL))",
    ).bind(side, side).all();
    return json({ rows, imgs: imgs.map((x) => x.name) });
  }
  // Одне фото — зашифроване телефоном; лише своє
  if (req.method === 'POST' && path === 'seal-img') {
    const b = await readJson(req, MAX_B64 + 4096);
    const name = String(b.name || '');
    const data = String(b.data || '');
    if (!data.startsWith('UkFEM') || data.length > MAX_B64 + 200 || !/^[A-Za-z0-9+/]+=*$/.test(data)) throw fail(400, 'data');
    const mine = await db.prepare('SELECT 1 FROM memes WHERE img = ? AND src = ? UNION SELECT 1 FROM wishes WHERE img = ? AND owner = ?').bind(name, side, name, side).first();
    if (!mine) throw fail(404, 'not found');
    await db.prepare('UPDATE imgs SET data = ?, updated = ? WHERE name = ?').bind(data, Date.now(), name).run();
    return json({ ok: true });
  }
  if (req.method === 'POST' && path === 'seal') {
    const b = await readJson(req, 4 * 1024 * 1024);
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 3000) : [];
    let done = 0;
    for (const x of rows) {
      const cols = SEAL_COLS[x.t || 'letters'];
      if (!cols) continue;
      const owners = [...new Set(Object.values(cols))];
      const r = await db.prepare(`SELECT id, ${owners.join(', ')} FROM ${x.t || 'letters'} WHERE id = ?`).bind(String(x.id || '')).first();
      if (!r) continue;
      const sets = [];
      const args = [];
      for (const [f, own] of Object.entries(cols)) {
        if (r[own] !== side || typeof x[f] !== 'string' || !SEALED.test(x[f]) || x[f].length > MAX_SEALED) continue;
        sets.push(`${f} = ?`);
        args.push(x[f]);
      }
      if (!sets.length) continue;
      await db.prepare(`UPDATE ${x.t || 'letters'} SET ${sets.join(', ')} WHERE id = ?`).bind(...args, r.id).run();
      done += 1;
    }
    return json({ done });
  }
  throw fail(404, 'not found');
}

// «Я в порядке»: час — коли натиснули (з черги без зв'язку відмітка може дійти пізніше), не коли дійшла
// Настрій до відмітки (довге натискання на ❤) — лише з цього списку
const MOODS = ['😊', '😴', '🤒', '😔', '🥰', '🤯', '🤗', '😤', '🥶', '🥵', '🙃', '🍓', '🥱'];
// «Как ты?» не частіше, ніж раз на 10 хвилин: щоб не засипати push
const ASK_GAP = 10 * 60 * 1000;

// mineSeen — другий побачив мою останню відмітку; asked — другий спитав «как ты?» після моєї останньої відмітки
async function checkinsOf(db, side) {
  const [mine, theirs, ask] = await Promise.all([
    getDoc(db, `checkin:${side}`), getDoc(db, `checkin:${other(side)}`), getDoc(db, `checkin-ask:${other(side)}`)]);
  const asked = ask?.at && ask.at > (mine?.at || 0) && Date.now() - ask.at < CHECKIN_MAX_AGE ? ask.at : null;
  return {
    mine: mine?.at || null,
    mineMood: mine?.mood || null,
    mineSeen: !!mine?.at && mine.seen === mine.at,
    theirs: theirs?.at || null,
    theirsMood: theirs?.mood || null,
    asked,
  };
}

async function checkin(req, db, side, notify) {
  const b = await readJson(req);
  const now = Date.now();
  const at = Math.min(now, Number(b.at) || now);
  if (at < now - CHECKIN_MAX_AGE) throw fail(400, 'old');
  return saveCheckin(db, side, at, MOODS.includes(b.mood) ? b.mood : null, notify);
}

async function saveCheckin(db, side, at, mood, notify) {
  const now = Date.now();
  const prev = await getDoc(db, `checkin:${side}`);
  const reaches = await hasPush(db, other(side));
  // Старіша за вже записану (повтор із черги) — нічого не міняє
  if (prev?.at >= at) return json({ at: prev.at, reaches, sent: false });
  const push = reaches && now - at < CHECKIN_PUSH_AGE;
  await putDoc(db, `checkin:${side}`, { at, mood, pushed: push ? now : prev?.pushed || null });
  await addMark(db, side, 'ok', at, mood);
  if (push) notify.send(other(side), checkinNote(side, at, now, mood));
  return json({ at, reaches, sent: push });
}

// Другий побачив мою відмітку на екрані — у мене поруч зʼявиться «увидела ✓»
// Повтор того самого (черга без зв'язку) — той самий id, другого рядка не буде
async function addMark(db, side, kind, at, mood = null) {
  await db.prepare('INSERT OR IGNORE INTO marks (id, side, kind, mood, at) VALUES (?, ?, ?, ?, ?)')
    .bind(`${kind}-${side}-${at}`, side, kind, mood, at).run();
}

// ── «✊ Спор»: камінь-ножиці-папір до двох перемог. Ходять коли зручно; хід другого не видно, поки не сходили обидва.
// doc duel — гра, що триває (одна на двох); ходи — у duel_moves; кінець — рядок marks kind duel з усіма раундами
const DUEL_MOVES = ['r', 's', 'p'];
const DUEL_BEATS = { r: 's', s: 'p', p: 'r' };
// Готові теми: назву знає сервер (і пише її в push); свою тему телефон шифрує — тоді push без неї
// «Просто так» — без ставки; «На желание» — переможець загадує, той, хто програв, виконує
const DUEL_PRESETS = { free: 'Просто так', wish: 'На желание', dog: 'Кто гуляет с собакой', dishes: 'Кто моет посуду', film: 'Кто выбирает фильм', place: 'Кто выбирает, куда пойдём' };
const DUEL_WINS = 2;
// Забута гра не тримає вічно: новий спор через добу її замінює
const DUEL_STALE = 24 * 3600000;

// Розіграні раунди (обидва ходи є) з переможцем; хто ще не сходив у поточному
function duelState(moves) {
  const by = {};
  for (const mv of moves) (by[mv.round] ||= {})[mv.side] = mv;
  const rounds = [];
  const wins = { vona: 0, vin: 0 };
  let last = 0;
  for (let r = 0; by[r]?.vona && by[r]?.vin; r += 1) {
    const a = by[r].vona.move;
    const b = by[r].vin.move;
    const win = a === b ? null : DUEL_BEATS[a] === b ? 'vona' : 'vin';
    if (win) wins[win] += 1;
    last = Math.max(by[r].vona.at, by[r].vin.at);
    rounds.push({ vona: a, vin: b, win });
    if (wins[win] >= DUEL_WINS) return { rounds, wins, winner: win, open: null, last };
  }
  const open = by[rounds.length] || {};
  for (const s of SIDES) if (open[s]) last = Math.max(last, open[s].at);
  return { rounds, wins, winner: null, open, last };
}

// Що бачить сторона: розіграні раунди повністю, у поточному — лише свій хід і «другий уже сходив»
function duelView(game, st, side) {
  const o = other(side);
  return {
    id: game.id,
    mine: game.by === side,
    topic: game.topic,
    preset: game.preset,
    at: game.at,
    rounds: st.rounds.map((r) => ({ me: r[side], them: r[o], win: r.win ? (r.win === side ? 'me' : 'them') : null })),
    score: { me: st.wins[side], them: st.wins[o] },
    myMove: st.open?.[side]?.move || null,
    theirMoved: !!st.open?.[o],
    done: st.winner ? { won: st.winner === side } : null,
  };
}

// ── Ігри на полі: «❌⭕ Крестики-нолики» 3×3 (хід — клітинка) і «🔴🟡 Четыре в ряд» 7×6 (хід — стовпчик, фішка падає вниз).
// Хто покликав — x і ходить першим, далі по черзі. Нічия — нова партія, першим ходить інший; виграв партію — виграв гру.
// Ходи — ті самі рядки duel_moves: round — порядковий номер ходу, move — клітинка чи стовпчик. k — скільки поспіль треба
// «Точки и квадраты» (dots): w×h клітинок, хід — рисочка між точками (номер ребра), board — ребра
// «🐾 Найди пару» (memo): 4×4 карточки з фото поз улюбленців, 8 пар; хід — відкрити карточку (дві за хід)
const GRIDS = { ttt: { w: 3, h: 3, k: 3 }, c4: { w: 7, h: 6, k: 4, drop: true }, db: { w: 3, h: 3, dots: true }, mm: { w: 4, h: 4, memo: true } };
const gridOf = (game) => (Object.hasOwn(GRIDS, game?.game ?? '') ? GRIDS[game.game] : null);
// Ребра: спершу горизонтальні (h+1 рядів по w), далі вертикальні (h рядів по w+1)
const dotsEdges = (grid) => (grid.h + 1) * grid.w + grid.h * (grid.w + 1);
const emptyBoard = (grid) => '.'.repeat(grid.dots ? dotsEdges(grid) : grid.w * grid.h);

// Куди лягає хід: сама клітинка або найнижча вільна в стовпчику; -1 — так піти не можна
function cellFor(grid, bd, move) {
  const v = String(move ?? '');
  if (!/^\d{1,2}$/.test(v)) return -1;
  const m = Number(v);
  if (grid.dots) return m < dotsEdges(grid) && bd[m] === '.' ? m : -1;
  if (!grid.drop) return m < grid.w * grid.h && bd[m] === '.' ? m : -1;
  if (m >= grid.w) return -1;
  for (let r = grid.h - 1; r >= 0; r -= 1) if (bd[r * grid.w + m] === '.') return r * grid.w + m;
  return -1;
}

// Ряд через щойно зайняту клітинку: k і більше однакових поспіль — по горизонталі, вертикалі чи навскіс
function lineThrough(grid, bd, c) {
  const r0 = Math.floor(c / grid.w);
  const c0 = c % grid.w;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const run = [c];
    for (const dir of [1, -1]) {
      for (let r = r0 + dr * dir, q = c0 + dc * dir; r >= 0 && r < grid.h && q >= 0 && q < grid.w && bd[r * grid.w + q] === bd[c]; r += dr * dir, q += dc * dir) run.push(r * grid.w + q);
    }
    if (run.length >= grid.k) return run.sort((x, y) => x - y);
  }
  return null;
}

function boardState(grid, by, moves, game = null) {
  if (grid.dots) return dotsState(grid, by, moves);
  if (grid.memo) return memoState(grid, game, moves);
  const seq = [...moves].sort((x, y) => x.round - y.round);
  const mark = (x) => (x === by ? 'x' : 'o');
  const rounds = [];
  let first = by;
  let turn = by;
  let bd = emptyBoard(grid).split('');
  let last = 0;
  let lastCell = null;
  let lastBy = null;
  let n = 0;
  for (const mv of seq) {
    const c = cellFor(grid, bd, mv.move);
    // Захист від сміття: не в свою чергу чи туди, куди не можна, — пропускаємо
    if (mv.side !== turn || c < 0) continue;
    bd[c] = mark(mv.side);
    last = Math.max(last, mv.at);
    lastCell = c;
    lastBy = mv.side;
    n += 1;
    const line = lineThrough(grid, bd, c);
    if (line) return { rounds, board: bd.join(''), turn: null, winner: mv.side, line, lastCell, lastBy, n, last, next: 0, wins: { vona: 0, vin: 0, [mv.side]: 1 } };
    if (!bd.includes('.')) {
      rounds.push({ board: bd.join(''), first });
      first = other(first);
      turn = first;
      bd = emptyBoard(grid).split('');
      lastCell = null;
      continue;
    }
    turn = other(turn);
  }
  const next = seq.length ? Math.max(...seq.map((m) => m.round)) + 1 : 0;
  return { rounds, board: bd.join(''), turn, winner: null, line: null, lastCell, lastBy, n, last, next, wins: { vona: 0, vin: 0 } };
}

// Чотири ребра клітинки r, c: верх, низ, ліво, право
function boxEdges(grid, r, c) {
  const H = (grid.h + 1) * grid.w;
  const v = H + r * (grid.w + 1) + c;
  return [r * grid.w + c, (r + 1) * grid.w + c, v, v + 1];
}
// Хід — рисочка; замкнув клітинку (одну чи дві) — вона твоя і ходиш ще, інакше черга іншого.
// Усі рисочки стоять — у кого більше клітинок, той і виграв; порівну — нова партія, починає інший
function dotsState(grid, by, moves) {
  const seq = [...moves].sort((x, y) => x.round - y.round);
  const mark = (x) => (x === by ? 'x' : 'o');
  const empty = () => '.'.repeat(grid.w * grid.h).split('');
  const rounds = [];
  let first = by;
  let turn = by;
  let bd = emptyBoard(grid).split('');
  let boxes = empty();
  let last = 0;
  let lastCell = null;
  let lastBy = null;
  let n = 0;
  const wins = () => ({ vona: boxes.filter((b) => b === mark('vona')).length, vin: boxes.filter((b) => b === mark('vin')).length });
  for (const mv of seq) {
    const e = cellFor(grid, bd, mv.move);
    if (mv.side !== turn || e < 0) continue;
    bd[e] = mark(mv.side);
    last = Math.max(last, mv.at);
    lastCell = e;
    lastBy = mv.side;
    n += 1;
    let closed = 0;
    for (let i = 0; i < boxes.length; i += 1) {
      if (boxes[i] === '.' && boxEdges(grid, Math.floor(i / grid.w), i % grid.w).every((k) => bd[k] !== '.')) { boxes[i] = mark(mv.side); closed += 1; }
    }
    if (!bd.includes('.')) {
      const w = wins();
      if (w.vona !== w.vin) {
        const winner = w.vona > w.vin ? 'vona' : 'vin';
        return { rounds, board: bd.join(''), boxes: boxes.join(''), turn: null, winner, line: null, lastCell, lastBy, n, last, next: 0, wins: w };
      }
      rounds.push({ board: bd.join(''), boxes: boxes.join(''), first });
      first = other(first);
      turn = first;
      bd = emptyBoard(grid).split('');
      boxes = empty();
      lastCell = null;
      continue;
    }
    if (!closed) turn = other(turn);
  }
  const next = seq.length ? Math.max(...seq.map((m) => m.round)) + 1 : 0;
  return { rounds, board: bd.join(''), boxes: boxes.join(''), turn, winner: null, line: null, lastCell, lastBy, n, last, next, wins: wins() };
}

// ── «🐾 Найди пару»: розкладка — 8 файлів поз ×2, перемішані від seed гри й номера партії (у кожної партії своя).
// Сервер знає розкладку; телефону — лише відкриті карточки: знайдені пари, щойно відкрита й пара минулого ходу
const MEMO_PAIRS = 8;
function memoLayout(game, round) {
  const cards = [...game.files, ...game.files];
  let x = (game.seed + round * 7919) >>> 0;
  const rnd = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
// Відкрив дві: однакові — пара твоя і ходиш ще, різні — обидві видно до наступного ходу, черга іншого.
// Усі пари знайдено — у кого більше, той і виграв; порівну — нова партія з новою розкладкою, починає інший
function memoState(grid, game, moves) {
  const seq = [...moves].sort((x, y) => x.round - y.round);
  const by = game.by;
  const mark = (x) => (x === by ? 'x' : 'o');
  const N = grid.w * grid.h;
  const rounds = [];
  let first = by;
  let turn = by;
  let layout = memoLayout(game, 0);
  let bd = '.'.repeat(N).split('');
  let open = [];
  let flash = null;
  let last = 0;
  let lastCell = null;
  let lastBy = null;
  let n = 0;
  const wins = () => ({ vona: bd.filter((c) => c === mark('vona')).length / 2, vin: bd.filter((c) => c === mark('vin')).length / 2 });
  const faces = (all = false) => bd.map((c, i) => (all || c !== '.' || open.includes(i) || (!open.length && flash?.cells.includes(i)) ? layout[i] : null));
  for (const mv of seq) {
    const c = /^\d{1,2}$/.test(String(mv.move)) ? Number(mv.move) : -1;
    if (mv.side !== turn || c < 0 || c >= N || bd[c] !== '.' || open.includes(c)) continue;
    open.push(c);
    last = Math.max(last, mv.at);
    lastCell = c;
    lastBy = mv.side;
    n += 1;
    if (open.length < 2) continue;
    const [a, b] = open;
    const hit = layout[a] === layout[b];
    flash = { cells: [a, b], by: mv.side, hit };
    if (hit) { bd[a] = mark(mv.side); bd[b] = mark(mv.side); } else turn = other(turn);
    open = [];
    if (bd.includes('.')) continue;
    const w = wins();
    if (w.vona !== w.vin) {
      const winner = w.vona > w.vin ? 'vona' : 'vin';
      return { rounds, board: bd.join(''), faces: faces(true), open, flash, turn: null, winner, line: null, lastCell, lastBy, n, last, next: 0, wins: w };
    }
    rounds.push({ board: bd.join(''), first });
    first = other(first);
    turn = first;
    layout = memoLayout(game, rounds.length);
    bd = '.'.repeat(N).split('');
    flash = null;
    lastCell = null;
  }
  const next = seq.length ? Math.max(...seq.map((m) => m.round)) + 1 : 0;
  return { rounds, board: bd.join(''), faces: faces(), open, flash, turn, winner: null, line: null, lastCell, lastBy, n, last, next, wins: wins() };
}
// Файли поз для пар: усі пози всіх улюбленців без новорічних двійників
async function memoFiles(db) {
  const mascots = (await getDoc(db, 'mascots')) || {};
  const files = [...new Set(Object.values(mascots).flatMap((m) => Object.entries(m.poses || {}).filter(([p]) => !p.startsWith('ny-')).map(([, file]) => file)))];
  for (let i = files.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [files[i], files[j]] = [files[j], files[i]];
  }
  return files.length >= MEMO_PAIRS ? files.slice(0, MEMO_PAIRS) : null;
}

function boardView(game, st, side) {
  const o = other(side);
  const rel = (x) => (x ? (x === side ? 'me' : 'them') : null);
  return {
    id: game.id,
    mine: game.by === side,
    topic: game.topic,
    preset: game.preset,
    at: game.at,
    game: game.game,
    rounds: st.rounds.map((r) => ({ me: null, them: null, win: null, board: r.board, ...(r.boxes ? { boxes: r.boxes } : {}), first: rel(r.first) })),
    score: { me: st.wins[side], them: st.wins[o] },
    ...(st.boxes ? { boxes: st.boxes } : {}),
    // Для картки й старого клієнта: «я вже сходив» = зараз не моя черга
    myMove: st.winner || st.turn === side ? null : 'wait',
    theirMoved: st.lastBy === o,
    done: st.winner ? { won: st.winner === side } : null,
    board: st.board,
    mark: game.by === side ? 'x' : 'o',
    turn: rel(st.turn),
    lastCell: st.lastCell,
    lastBy: rel(st.lastBy),
    line: st.line,
    n: st.n,
    // Найди пару: що видно (файл пози чи null), щойно відкрита, пара минулого ходу
    ...(st.faces ? { faces: st.faces, open: st.open, flash: st.flash ? { cells: st.flash.cells, by: rel(st.flash.by), hit: st.flash.hit } : null } : {}),
  };
}

// ── «🚢 Морской бой» 6×6: флот 3, 2, 2, 1, кораблі не торкаються навіть кутами. Хто покликав — стріляє першим;
// влучив чи потопив — стріляє ще. Розстановку другого бачить лише сервер: телефону — свої кораблі, свої й чужі постріли
// та потоплені ним кораблі (з запискою); решту чужого флоту — лише коли гра скінчилась.
// Флоти — у doc гри (fleets: { vona, vin }), постріли — рядки duel_moves (move — номер клітинки)
const BS_W = 6;
const BS_FLEET = '3,2,2,1';
const isBs = (game) => game?.game === 'bs';

// Розстановка з телефона: [{ cells, note }] → перевірена (інакше 400). Записка — шифр «e1.…» чи відкритий текст до 120
function bsFleet(raw) {
  const bad = () => fail(400, 'fleet');
  if (!Array.isArray(raw) || raw.length !== 4) throw bad();
  const ships = raw.map((s) => {
    const cells = (Array.isArray(s?.cells) ? s.cells : []).map(Number).sort((a, b) => a - b);
    if (!cells.length || cells.some((c) => !Number.isInteger(c) || c < 0 || c >= BS_W * BS_W)) throw bad();
    const row = cells.every((c, i) => c === cells[0] + i && Math.floor(c / BS_W) === Math.floor(cells[0] / BS_W));
    const col = cells.every((c, i) => c === cells[0] + i * BS_W);
    if (!row && !col) throw bad();
    return { cells, note: clip(typeof s.note === 'string' ? s.note : '', 120) || null };
  });
  if (ships.map((s) => s.cells.length).sort((a, b) => b - a).join() !== BS_FLEET) throw bad();
  const near = (a, b) => Math.abs(Math.floor(a / BS_W) - Math.floor(b / BS_W)) <= 1 && Math.abs((a % BS_W) - (b % BS_W)) <= 1;
  for (let i = 0; i < ships.length; i += 1) {
    for (let j = i + 1; j < ships.length; j += 1) if (ships[i].cells.some((a) => ships[j].cells.some((b) => near(a, b)))) throw bad();
  }
  return ships;
}

function bsState(game, moves) {
  const seq = [...moves].sort((a, b) => a.round - b.round);
  const fleets = game.fleets || {};
  const ready = !!(fleets.vona && fleets.vin);
  const fired = { vona: new Set(), vin: new Set() };
  const shots = [];
  let turn = ready ? game.by : null;
  let winner = null;
  let last = game.at;
  const down = (s, ship) => ship.cells.every((x) => fired[s].has(x));
  for (const mv of seq) {
    const c = Number(mv.move);
    // Захист від сміття: не в свою чергу чи вдруге в ту саму клітинку — пропускаємо
    if (!ready || winner || mv.side !== turn || fired[mv.side].has(c)) continue;
    fired[mv.side].add(c);
    const fleet = fleets[other(mv.side)];
    const ship = fleet.find((s) => s.cells.includes(c));
    shots.push({ side: mv.side, c, hit: !!ship, sunk: !!ship && down(mv.side, ship) });
    last = Math.max(last, mv.at);
    if (!ship) turn = other(turn);
    else if (fleet.every((s) => down(mv.side, s))) { winner = mv.side; turn = null; }
  }
  // sunk[s] — кораблі другого, які потопила s
  const sunk = Object.fromEntries(SIDES.map((s) => [s, (fleets[other(s)] || []).filter((sh) => down(s, sh))]));
  const next = seq.length ? Math.max(...seq.map((m) => m.round)) + 1 : 0;
  return { shots, turn, winner, ready, last, next, n: shots.length, sunk, wins: { vona: sunk.vona.length, vin: sunk.vin.length } };
}

function bsView(game, st, side) {
  const o = other(side);
  const mine = game.fleets?.[side] || null;
  const rel = (x) => (x ? (x === side ? 'me' : 'them') : null);
  return {
    id: game.id,
    mine: game.by === side,
    topic: game.topic,
    preset: game.preset,
    at: game.at,
    game: 'bs',
    rounds: [],
    score: { me: st.wins[side], them: st.wins[o] },
    // Для картки й плиток: «не мій хід» — коли чекаю розстановку чи постріл другого
    myMove: st.winner || !mine || st.turn === side ? null : 'wait',
    theirMoved: st.shots.at(-1)?.side === o,
    done: st.winner ? { won: st.winner === side } : null,
    turn: rel(st.turn),
    ready: st.ready,
    needFleet: !mine,
    fleet: mine,
    shots: st.shots.map((s) => ({ by: rel(s.side), c: s.c, hit: s.hit, sunk: s.sunk })),
    // Чужі кораблі — лише потоплені мною (із запискою); решта — без записок і лише після кінця
    sunk: st.sunk[side].map((s) => ({ cells: s.cells, note: s.note })),
    // Скільки записок сховано в чужих кораблях — лише число, для блідих конвертиків
    notes: (game.fleets[o] || []).filter((s) => s.note).length,
    rest: st.winner ? (game.fleets[o] || []).filter((s) => !st.sunk[side].includes(s)).map((s) => ({ cells: s.cells })) : null,
    n: st.n,
  };
}

// Постріл: лише своя черга, коли обидва флоти стоять (інакше 409), і лише туди, куди ще не стріляв (400)
async function bsMove(db, game, side, move, now, reaches, notify) {
  if (!/^\d{1,2}$/.test(String(move ?? '')) || Number(move) >= BS_W * BS_W) throw fail(400, 'duel');
  const c = Number(move);
  const before = bsState(game, await duelMoves(db, game.id));
  if (before.turn !== side) throw fail(409, 'turn');
  if (before.shots.some((s) => s.side === side && s.c === c)) throw fail(400, 'taken');
  await db.prepare('INSERT OR IGNORE INTO duel_moves (duel, round, side, move, at) VALUES (?, ?, ?, ?, ?)')
    .bind(game.id, before.next, side, String(c), now).run();
  const moves = await duelMoves(db, game.id);
  const st = bsState(game, moves);
  if (st.winner) await finishDuel(db, game, st, moves);
  // Push на кожен постріл (тег той самий — новий замінює попередній): мимо, влучив, потопив
  if (reaches && st.n > before.n) {
    const shot = st.shots.at(-1);
    const note = shot.sunk && game.fleets[other(side)].find((s) => s.cells.includes(shot.c))?.note;
    notify.send(other(side), duelNote(side, st.winner ? 'done' : 'bs-shot', game, { ...shot, note: !!note }));
  }
  return json({ duel: bsView(game, st, side), reaches });
}

const gameState = (game, moves) => (isBs(game) ? bsState(game, moves) : gridOf(game) ? boardState(gridOf(game), game.by, moves, game) : duelState(moves));
const gameView = (game, st, side) => (isBs(game) ? bsView(game, st, side) : gridOf(game) ? boardView(game, st, side) : duelView(game, st, side));

async function duelMoves(db, id) {
  return (await db.prepare('SELECT round, side, move, at FROM duel_moves WHERE duel = ?').bind(id).all()).results;
}

// Чинні ігри — по одній кожного виду: doc duel — КНБ, duel-ttt і duel-c4 — на полі, duel-bs — морський бій.
// Гра на полі, що до 0.4.2 лежала в duel (тоді гра була одна на всі види), переїжджає до свого ключа
const DUEL_KEYS = { rps: 'duel', ttt: 'duel-ttt', c4: 'duel-c4', bs: 'duel-bs', db: 'duel-db', mm: 'duel-mm' };
const duelKind = (game) => (gridOf(game) || isBs(game) ? game.game : 'rps');
async function activeDuels(db) {
  const rows = (await db.prepare("SELECT k, v FROM docs WHERE k IN ('duel', 'duel-ttt', 'duel-c4', 'duel-bs', 'duel-db', 'duel-mm')").all()).results;
  const byKey = Object.fromEntries(rows.map((r) => [r.k, JSON.parse(r.v)]));
  const old = byKey.duel;
  if (old?.id && gridOf(old)) {
    const k = DUEL_KEYS[old.game];
    if (!byKey[k]?.id) { await putDoc(db, k, old); byKey[k] = old; }
    await db.prepare("DELETE FROM docs WHERE k = 'duel' AND v LIKE ?").bind(`%"id":"${old.id}"%`).run();
    delete byKey.duel;
  }
  const games = {};
  for (const [kind, k] of Object.entries(DUEL_KEYS)) if (byKey[k]?.id) games[kind] = byKey[k];
  return games;
}
const dropDuelDoc = (db, game) => db.prepare('DELETE FROM docs WHERE k = ? AND v LIKE ?').bind(DUEL_KEYS[duelKind(game)], `%"id":"${game.id}"%`).run();

// Скінчена гра — рядок у чаті; id від гри: обидва запити, що одночасно дограли, пишуть той самий рядок
async function finishDuel(db, game, st, moves) {
  const base = { id: game.id, topic: game.topic, preset: game.preset, by: game.by };
  const mood = JSON.stringify(gridOf(game) || isBs(game)
    ? { ...base, game: game.game, ...(isBs(game) ? { fleets: game.fleets } : {}), ...(game.files ? { files: game.files, seed: game.seed } : {}), rounds: [], seq: [...moves].sort((a, b) => a.round - b.round).map((m) => [m.side, m.move, m.round, m.at]) }
    : { ...base, rounds: st.rounds });
  await db.prepare('INSERT OR IGNORE INTO marks (id, side, kind, mood, at) VALUES (?, ?, ?, ?, ?)')
    .bind(`duel-${game.id}`, st.winner, 'duel', mood, st.last).run();
  // Ходи лишаємо: запит, що дограв одночасно, ще їх перечитає; приберуться з наступною грою
  await dropDuelDoc(db, game);
}

// Дограна гра з рядка marks (для чату й для розкриття тому, хто сходив першим)
function duelMarkView(row, side) {
  const g = JSON.parse(row.mood);
  if (isBs(g)) return bsView({ ...g, at: row.at }, bsState(g, g.seq.map(([s2, move, round, at]) => ({ side: s2, move, round, at }))), side);
  if (gridOf(g)) return boardView({ ...g, at: row.at }, boardState(gridOf(g), g.by, g.seq.map(([s2, move, round, at]) => ({ side: s2, move, round, at })), g), side);
  const wins = { vona: 0, vin: 0 };
  for (const r of g.rounds) if (r.win) wins[r.win] += 1;
  return duelView({ ...g, at: row.at }, { rounds: g.rounds, wins, winner: row.side, open: null }, side);
}

// Остання дограна гра цього виду (kind null — будь-якого: старий клієнт)
async function lastDuel(db, side, kind) {
  const rows = (await db.prepare("SELECT side, mood, at FROM marks WHERE kind = 'duel' ORDER BY at DESC LIMIT 20").all()).results;
  const row = rows.find((r) => !kind || duelKind(JSON.parse(r.mood)) === kind);
  return row ? withGwish(duelMarkView(row, side), await gwishes(db), side) : null;
}

// Загадані желання: рядки marks kind gwish (id gwish-<гра>, side — хто загадав, mood { game, text, done })
async function gwishes(db) {
  const rows = (await db.prepare("SELECT side, mood FROM marks WHERE kind = 'gwish'").all()).results;
  return new Map(rows.map((r) => { const v = JSON.parse(r.mood); return [v.game, { ...v, by: r.side }]; }));
}
function gwishView(w, side) {
  return w ? { text: w.text, done: w.done || null, mine: w.by === side, ...(w.src ? { src: w.src } : {}), ...(w.icons ? { icons: w.icons } : {}), ...(w.texts ? { texts: w.texts } : {}), ...(w.level ? { level: w.level } : {}), ...(w.src === 'dice' ? { lock: !!w.lock, haggled: w.haggled ?? null, stars: w.stars || null, claimed: w.claimed || null, canHaggle: !w.lock && w.haggled == null && Array.isArray(w.faces) } : {}) } : null;
}
// Гра «на желание»: що загадано (чи ще ні) — у вигляді гри
function withGwish(view, wishes, side) {
  return view.preset === 'wish' && view.done ? { ...view, wish: gwishView(wishes.get(view.id), side) } : view;
}

async function duelRoute(req, db, side, rest, notify) {
  const m = req.method;
  const now = Date.now();
  if (m === 'GET' && !rest) {
    const asked = new URL(req.url).searchParams.get('game');
    const kind = Object.hasOwn(DUEL_KEYS, asked ?? '') ? asked : null;
    const views = {};
    for (const [k, g] of Object.entries(await activeDuels(db))) views[k] = gameView(g, gameState(g, await duelMoves(db, g.id)), side);
    // Без ?game= (старий клієнт) — найсвіжіша з тих, що йдуть
    const duel = kind ? views[kind] : Object.values(views).sort((a, b) => b.at - a.at)[0];
    // Для плиток «Игр»: що йде і чия черга
    const live = Object.fromEntries(Object.entries(views).map(([k, v]) => [k, v.myMove ? 'wait' : 'me']));
    return json({ duel: duel || null, last: await lastDuel(db, side, kind), live });
  }
  const b = m === 'POST' ? await readJson(req) : {};
  const reaches = await hasPush(db, other(side));
  // Виклик: тема (готова чи своя) і одразу мій перший хід
  if (m === 'POST' && !rest) {
    const preset = Object.hasOwn(DUEL_PRESETS, b.preset) ? b.preset : null;
    const own = clip(String(b.topic || '').replace(/\s+/g, ' '), 60);
    const topic = preset ? DUEL_PRESETS[preset] : own;
    const grid = gridOf(b);
    // Морський бій: замість першого ходу — своя розстановка (крива — 400)
    const fleet = isBs(b) ? bsFleet(b.fleet) : null;
    if (!topic || !(fleet || grid?.memo || (grid ? cellFor(grid, emptyBoard(grid), b.move) >= 0 : DUEL_MOVES.includes(b.move)))) throw fail(400, 'duel');
    const files = grid?.memo ? await memoFiles(db) : null;
    if (grid?.memo && !files) throw fail(503, 'memo');
    const kind = fleet ? 'bs' : grid ? b.game : 'rps';
    const games = await activeDuels(db);
    // Одна гра кожного виду: поки ця не догра́на (і не забута на добу) — нову того ж виду не починаємо
    if (games[kind] && now - games[kind].at < DUEL_STALE) throw fail(409, 'busy');
    const game = { id: newId(), by: side, topic, preset, at: now, ...(grid ? { game: b.game } : {}), ...(fleet ? { game: 'bs', fleets: { [side]: fleet } } : {}),
      ...(files ? { files, seed: Math.floor(Math.random() * 2 ** 31) } : {}) };
    await putDoc(db, DUEL_KEYS[kind], game);
    // Ходи дограних чи забутих ігор більше не потрібні; ходи інших ігор, що йдуть, лишаються
    const keep = [game.id, ...Object.entries(games).filter(([k]) => k !== kind).map(([, g]) => g.id)];
    await db.prepare(`DELETE FROM duel_moves WHERE duel NOT IN (${keep.map(() => '?').join(', ')})`).bind(...keep).run();
    if (!fleet && !files) await db.prepare('INSERT OR IGNORE INTO duel_moves (duel, round, side, move, at) VALUES (?, 0, ?, ?, ?)').bind(game.id, side, String(b.move), now).run();
    // Найди пару: другому напишемо, коли до нього дійде черга
    if (reaches && !files) notify.send(other(side), duelNote(side, fleet ? 'bs-start' : grid ? 'board-start' : 'start', game));
    return json({ duel: gameView(game, gameState(game, await duelMoves(db, game.id)), side), reaches }, 201);
  }
  const game = Object.values(await activeDuels(db)).find((g) => g.id === String(b.id || '')) || null;
  if (m === 'POST' && rest === '/move') {
    if (!game) throw fail(409, 'gone');
    if (isBs(game)) return bsMove(db, game, side, b.move, now, reaches, notify);
    if (gridOf(game)) return boardMove(db, game, side, b.move, now, reaches, notify);
    if (!DUEL_MOVES.includes(b.move)) throw fail(400, 'duel');
    const before = duelState(await duelMoves(db, game.id));
    const moved = !before.winner && !before.open[side];
    // Уже сходив у цьому раунді — повтор (черга, подвійний тап) нічого не міняє
    if (moved) {
      await db.prepare('INSERT OR IGNORE INTO duel_moves (duel, round, side, move, at) VALUES (?, ?, ?, ?, ?)')
        .bind(game.id, before.rounds.length, side, b.move, now).run();
    }
    // Перечитуємо: другий міг сходити в ту саму мить
    const st = duelState(await duelMoves(db, game.id));
    const view = duelView(game, st, side);
    const closed = st.rounds.length > before.rounds.length;
    // Push на кожен хід: перший у раунді — «уже вибрав», другий закрив раунд — рахунок
    if (st.winner) {
      await finishDuel(db, game, st, []);
      if (reaches && closed) notify.send(other(side), duelNote(side, 'done', game));
    } else if (reaches && (closed || moved)) notify.send(other(side), duelNote(side, closed ? 'turn' : 'moved', game, view.score));
    return json({ duel: view, reaches });
  }
  // «🎁 На желание»: переможець загадує (раз), той, хто програв, відмічає «Исполнено»
  if (m === 'POST' && (rest === '/wish' || rest === '/wish-done')) {
    const id = String(b.id || '');
    const row = await db.prepare("SELECT side, mood FROM marks WHERE id = ? AND kind = 'duel'").bind(`duel-${id}`).first();
    if (rest === '/wish' && (!row || JSON.parse(row.mood).preset !== 'wish')) throw fail(409, 'gone');
    const key = `gwish-${id}`;
    if (rest === '/wish') {
      if (row.side !== side) throw fail(403, 'forbidden');
      const text = clip(b.text, 300);
      if (!text) throw fail(400, 'wish');
      const res = await db.prepare('INSERT OR IGNORE INTO marks (id, side, kind, mood, at) VALUES (?, ?, ?, ?, ?)')
        .bind(key, side, 'gwish', JSON.stringify({ game: id, text, done: null }), now).run();
      if (res.meta?.changes && reaches) notify.send(other(side), gwishNote(side, 'made'));
    } else {
      const w = await db.prepare('SELECT side, mood FROM marks WHERE id = ?').bind(key).first();
      if (!w || w.side === side) throw fail(409, 'gone');
      const v = JSON.parse(w.mood);
      if (!v.done) {
        v.done = now;
        if (v.src === 'dice' && Number.isInteger(b.stars) && b.stars >= 1 && b.stars <= 5) v.stars = b.stars;
        await db.prepare('UPDATE marks SET mood = ? WHERE id = ?').bind(JSON.stringify(v), key).run();
        if (reaches) notify.send(other(side), gwishNote(side, 'done', v.src));
      }
    }
    return json({ wish: gwishView((await gwishes(db)).get(id), side) });
  }
  // Морський бій: той, кого покликали, ставить свій флот (раз); першим стріляє той, хто покликав
  if (m === 'POST' && rest === '/fleet') {
    if (!isBs(game)) throw fail(409, 'gone');
    if (game.by === side || game.fleets?.[side]) throw fail(409, 'turn');
    game.fleets = { ...game.fleets, [side]: bsFleet(b.fleet) };
    await putDoc(db, DUEL_KEYS.bs, game);
    if (reaches) notify.send(other(side), duelNote(side, 'bs-ready', game));
    return json({ duel: bsView(game, bsState(game, await duelMoves(db, game.id)), side), reaches });
  }
  // Передумали — гра зникає без сліду в чаті
  if (m === 'POST' && rest === '/cancel') {
    if (game) {
      await dropDuelDoc(db, game);
      await db.prepare('DELETE FROM duel_moves WHERE duel = ?').bind(game.id).run();
    }
    return json({ ok: true });
  }
  throw fail(404, 'not found');
}

// Хід на полі: лише своя черга (інакше 409 — у телефона застарілий стан) і лише туди, куди можна (вільна клітинка, неповний стовпчик)
async function boardMove(db, game, side, move, now, reaches, notify) {
  if (!/^\d{1,2}$/.test(String(move ?? ''))) throw fail(400, 'duel');
  const grid = gridOf(game);
  const before = boardState(grid, game.by, await duelMoves(db, game.id), game);
  if (before.turn !== side) throw fail(409, 'turn');
  if (cellFor(grid, before.board, move) < 0 || before.open?.includes(Number(move))) throw fail(400, 'taken');
  await db.prepare('INSERT OR IGNORE INTO duel_moves (duel, round, side, move, at) VALUES (?, ?, ?, ?, ?)')
    .bind(game.id, before.next, side, String(move), now).run();
  const moves = await duelMoves(db, game.id);
  const st = boardState(grid, game.by, moves, game);
  if (st.winner) await finishDuel(db, game, st, moves);
  // Точки: замкнув клітинку й ходить ще — другому поки нічого не пишемо
  if (reaches && st.n > before.n && (st.winner || st.turn !== side)) {
    const what = st.winner ? 'done' : st.rounds.length > before.rounds.length ? 'board-draw' : 'board-turn';
    notify.send(other(side), duelNote(side, what, game));
  }
  return json({ duel: boardView(game, st, side), reaches });
}

// ── «💞 Совпадёт?»: 5 питань із двома варіантами, кожен відповідає за себе, коли зручно; відповіді другого
// не видно, поки не відповіли обидва. doc same — гра (питання — ключі з набору в телефоні або своє зашифроване
// { q, a, b }); відповіді — docs same:<side>; кінець — рядок marks kind same з усім
// Питань у грі: 10 (з 0.4.1); 5 — ігри, почати старим телефоном
const SAME_LENS = [5, 10];
// Забута гра не тримає вічно: через три дні новий виклик її замінює
const SAME_STALE = 3 * 24 * 3600000;
const SAME_KEY = /^[a-z0-9]{1,12}$/;

function sameQs(qs) {
  if (!Array.isArray(qs) || !SAME_LENS.includes(qs.length)) throw fail(400, 'same');
  let own = 0;
  const out = qs.map((q) => {
    if (typeof q === 'string' && SAME_KEY.test(q)) return q;
    if (q && typeof q === 'object') {
      const v = { q: clip(q.q, 80), a: clip(q.a, 24), b: clip(q.b, 24) };
      if (v.q && v.a && v.b) { own += 1; return v; }
    }
    throw fail(400, 'same');
  });
  if (own > 1 || new Set(out.filter((q) => typeof q === 'string')).size !== qs.length - own) throw fail(400, 'same');
  return out;
}
// n — скільки питань у цій грі
function sameAns(a, n) {
  if (!Array.isArray(a) || a.length !== n || !a.every((x) => x === 0 || x === 1)) throw fail(400, 'same');
  return a;
}

async function sameAnswers(db, id) {
  const out = {};
  for (const sd of SIDES) {
    // eslint-disable-next-line no-await-in-loop
    const a = await getDoc(db, `same:${sd}`);
    if (a?.id === id) out[sd] = a;
  }
  return out;
}

// Що бачить сторона: свої відповіді завжди, чужі — лише коли відповіли обидва
function sameView(g, ans, side) {
  const o = other(side);
  const me = ans[side]?.ans || null;
  const them = ans[o]?.ans || null;
  const done = !!(me && them);
  return {
    id: g.id,
    mine: g.by === side,
    at: g.at,
    qs: g.qs,
    me,
    theirDone: !!them,
    them: done ? them : null,
    done,
    hits: done ? me.filter((x, i) => x === them[i]).length : null,
  };
}
function sameMarkView(row, side) {
  const g = JSON.parse(row.mood);
  return sameView({ ...g, at: row.at }, { vona: { ans: g.ans.vona }, vin: { ans: g.ans.vin } }, side);
}
async function lastSame(db, side) {
  const row = await db.prepare("SELECT mood, at FROM marks WHERE kind = 'same' ORDER BY at DESC LIMIT 1").first();
  return row ? sameMarkView(row, side) : null;
}
async function dropSame(db, id) {
  await db.prepare("DELETE FROM docs WHERE k = 'same' AND v LIKE ?").bind(`%"id":"${id}"%`).run();
  await db.prepare("DELETE FROM docs WHERE k IN ('same:vona', 'same:vin') AND v LIKE ?").bind(`%"id":"${id}"%`).run();
}

async function sameRoute(req, db, side, rest, notify) {
  const m = req.method;
  const now = Date.now();
  if (m === 'GET' && !rest) {
    const g = await getDoc(db, 'same');
    return json({ same: g?.id ? sameView(g, await sameAnswers(db, g.id), side) : null, last: await lastSame(db, side) });
  }
  const b = m === 'POST' ? await readJson(req) : {};
  const reaches = await hasPush(db, other(side));
  // Виклик: питання й одразу мої відповіді
  if (m === 'POST' && !rest) {
    const qs = sameQs(b.qs);
    const ans = sameAns(b.ans, qs.length);
    const prev = await getDoc(db, 'same');
    if (prev?.id && now - prev.at < SAME_STALE) throw fail(409, 'busy');
    if (prev?.id) await dropSame(db, prev.id);
    const g = { id: newId(), by: side, qs, at: now };
    await putDoc(db, 'same', g);
    await putDoc(db, `same:${side}`, { id: g.id, ans, at: now });
    if (reaches) notify.send(other(side), sameNote(side, 'start'));
    return json({ same: sameView(g, await sameAnswers(db, g.id), side), reaches }, 201);
  }
  const g = await getDoc(db, 'same');
  if (m === 'POST' && rest === '/answer') {
    if (!g?.id || g.id !== String(b.id || '')) throw fail(409, 'gone');
    const ans = sameAns(b.ans, g.qs.length);
    // Уже відповів — повтор (черга, подвійний тап) нічого не міняє
    if (!(await sameAnswers(db, g.id))[side]) await putDoc(db, `same:${side}`, { id: g.id, ans, at: now });
    const all = await sameAnswers(db, g.id);
    const view = sameView(g, all, side);
    if (view.done) {
      const mood = JSON.stringify({ id: g.id, by: g.by, qs: g.qs, ans: { vona: all.vona.ans, vin: all.vin.ans } });
      await db.prepare('INSERT OR IGNORE INTO marks (id, side, kind, mood, at) VALUES (?, ?, ?, ?, ?)')
        .bind(`same-${g.id}`, g.by, 'same', mood, now).run();
      await dropSame(db, g.id);
      if (reaches) notify.send(other(side), sameNote(side, 'done'));
    }
    return json({ same: view, reaches });
  }
  // Передумали — гра зникає без сліду в чаті
  if (m === 'POST' && rest === '/cancel') {
    if (g?.id && g.id === b.id) await dropSame(db, g.id);
    return json({ ok: true });
  }
  throw fail(404, 'not found');
}

// ── «🔥 Совпадёт?» для двох: 10 питань одного рівня, відповіді «нет / может / да». Другому не видно нічого,
// крім збігів: обидва «да» — 2, «да» + «может» — 1, решта — 0. Тексти питань — у секретах воркера (HOT_SOFT,
// HOT_HOT, HOT_FIRE — JSON { ключ: текст }), у публічному репозиторії лише ключі. doc hot — гра,
// docs hot:<side> — відповіді; кінець — рядок marks kind hot лише зі збігами, відповіді стираються
const HOT_LEVELS = { soft: 'HOT_SOFT', hot: 'HOT_HOT', fire: 'HOT_FIRE' };
const HOT_N = 10;
let hotCache = null;
function hotBank(env) {
  if (!hotCache) {
    try {
      const out = {};
      for (const [lvl, name] of Object.entries(HOT_LEVELS)) out[lvl] = env[name] ? JSON.parse(env[name]) : null;
      hotCache = Object.values(out).every((x) => x && Object.keys(x).length >= HOT_N) ? out : false;
    } catch { hotCache = false; }
  }
  return hotCache || null;
}
const hotMatch = (a, b) => (a === 2 && b === 2 ? 2 : Math.min(a, b) === 1 && Math.max(a, b) === 2 ? 1 : 0);
function hotAns(a) {
  if (!Array.isArray(a) || a.length !== HOT_N || !a.every((x) => x === 0 || x === 1 || x === 2)) throw fail(400, 'hot');
  return a;
}
async function hotAnswers(db, id) {
  const out = {};
  for (const sd of SIDES) {
    // eslint-disable-next-line no-await-in-loop
    const a = await getDoc(db, `hot:${sd}`);
    if (a?.id === id) out[sd] = a;
  }
  return out;
}
// Що бачить сторона: свої відповіді, поки гра йде; чужих — ніколи, лише збіги після обох.
// bank — додати тексти питань (шторка гри); у стрічці їх нема
function hotView(g, ans, side, bank = null) {
  const me = ans?.[side]?.ans || null;
  const match = g.match || null;
  const done = !!match;
  return {
    id: g.id,
    mine: g.by === side,
    at: g.at,
    level: g.level,
    n: g.qs.length,
    ...(bank ? { qs: g.qs.map((k) => bank[g.level]?.[k] || '') } : {}),
    me: done ? null : me,
    theirDone: done || !!ans?.[other(side)],
    done,
    match,
    hits: done ? match.filter((x) => x > 0).length : null,
  };
}
async function lastHot(db, side, bank = null) {
  const row = await db.prepare("SELECT mood, at FROM marks WHERE kind = 'hot' ORDER BY at DESC LIMIT 1").first();
  return row ? hotView({ ...JSON.parse(row.mood), at: row.at }, null, side, bank) : null;
}
async function dropHot(db, id) {
  await db.prepare("DELETE FROM docs WHERE k IN ('hot', 'hot:vona', 'hot:vin') AND v LIKE ?").bind(`%"id":"${id}"%`).run();
}
// 10 випадкових ключів рівня
function hotDeal(bank, level) {
  const keys = Object.keys(bank[level]);
  for (let i = keys.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys.slice(0, HOT_N);
}

async function hotRoute(req, env, side, rest, notify) {
  const db = env.DB;
  const bank = hotBank(env);
  if (!bank) throw fail(503, 'hot');
  const m = req.method;
  const now = Date.now();
  if (m === 'GET' && !rest) {
    const g = await getDoc(db, 'hot');
    return json({ hot: g?.id ? hotView(g, await hotAnswers(db, g.id), side, bank) : null, last: await lastHot(db, side, bank) });
  }
  // Роздача питань для виклику: ключі й тексти, гра ще не почалась
  if (m === 'GET' && rest === '/deal') {
    const level = new URL(req.url).searchParams.get('level');
    if (!HOT_LEVELS[level]) throw fail(400, 'hot');
    const keys = hotDeal(bank, level);
    return json({ level, keys, qs: keys.map((k) => bank[level][k]) });
  }
  const b = m === 'POST' ? await readJson(req) : {};
  const reaches = await hasPush(db, other(side));
  if (m === 'POST' && !rest) {
    const level = String(b.level || '');
    if (!HOT_LEVELS[level] || !Array.isArray(b.qs) || b.qs.length !== HOT_N
      || new Set(b.qs).size !== HOT_N || !b.qs.every((k) => typeof k === 'string' && Object.hasOwn(bank[level], k))) throw fail(400, 'hot');
    const ans = hotAns(b.ans);
    const prev = await getDoc(db, 'hot');
    if (prev?.id && now - prev.at < SAME_STALE) throw fail(409, 'busy');
    if (prev?.id) await dropHot(db, prev.id);
    const g = { id: newId(), by: side, level, qs: b.qs, at: now };
    await putDoc(db, 'hot', g);
    await putDoc(db, `hot:${side}`, { id: g.id, ans, at: now });
    if (reaches) notify.send(other(side), hotNote(side, 'start'));
    return json({ hot: hotView(g, await hotAnswers(db, g.id), side, bank), reaches }, 201);
  }
  const g = await getDoc(db, 'hot');
  if (m === 'POST' && rest === '/answer') {
    if (!g?.id || g.id !== String(b.id || '')) throw fail(409, 'gone');
    const ans = hotAns(b.ans);
    if (!(await hotAnswers(db, g.id))[side]) await putDoc(db, `hot:${side}`, { id: g.id, ans, at: now });
    const all = await hotAnswers(db, g.id);
    if (!all.vona || !all.vin) return json({ hot: hotView(g, all, side, bank), reaches });
    // Обидва відповіли: лишаємо тільки збіги, самі відповіді стираємо
    const match = all.vona.ans.map((x, i) => hotMatch(x, all.vin.ans[i]));
    const end = { id: g.id, by: g.by, level: g.level, qs: g.qs, match };
    await db.prepare('INSERT OR IGNORE INTO marks (id, side, kind, mood, at) VALUES (?, ?, ?, ?, ?)')
      .bind(`hot-${g.id}`, g.by, 'hot', JSON.stringify(end), now).run();
    await dropHot(db, g.id);
    if (reaches) notify.send(other(side), hotNote(side, 'done'));
    return json({ hot: hotView({ ...end, at: now }, null, side, bank), reaches });
  }
  if (m === 'POST' && rest === '/cancel') {
    if (g?.id && g.id === b.id) await dropHot(db, g.id);
    return json({ ok: true });
  }
  throw fail(404, 'not found');
}

// ── «🍓 Клубничка»: вікторина 18+ на двох. 10 питань рівня (💗 / 🔥 / 🌶️), 4 варіанти, на кожне 30 секунд.
// Питання сервер видає по одному і ставить час початку: відкрив заново — таймер не скидається, не встиг — без очка.
// Чужих відповідей, правильних варіантів і пояснень не видно нікому, поки обидва не відповіли на всі 10.
// Тексти — у секретах воркера (BERRY_SOFT_0…, BERRY_HOT_0…, BERRY_FIRE_0… — шматки JSON { ключ: [питання,
// [4 варіанти], правильний, пояснення] }; BERRY_WISH_0… — шматки JSON [желание…]), у публічному репозиторії їх нема.
// doc berry — гра { id, by, level, qs, perm, at }; docs berry:<side> — { id, picks, cur, t }; кінець — рядок marks
// kind berry з усім; переможець загадує желание (рядок marks kind gwish, src berry), той, хто програв, відмічає «Исполнено»
const BERRY_LEVELS = { soft: 'BERRY_SOFT', hot: 'BERRY_HOT', fire: 'BERRY_FIRE' };
const BERRY_N = 10;
const BERRY_T = 30000;
// Запас на слабкий зв'язок: відповідь, що прийшла пізніше за 30 с, але в межах запасу, ще рахується
const BERRY_GRACE = 12000;
let berryCache = null;
function berryChunks(env, name) {
  const out = [];
  for (let i = 0; env[`${name}_${i}`]; i += 1) out.push(JSON.parse(env[`${name}_${i}`]));
  return out;
}
function berryBank(env) {
  if (berryCache === null) {
    try {
      const out = {};
      for (const [lvl, name] of Object.entries(BERRY_LEVELS)) out[lvl] = Object.assign({}, ...berryChunks(env, name));
      out.wishes = berryChunks(env, 'BERRY_WISH').flat();
      berryCache = Object.keys(BERRY_LEVELS).every((l) => Object.keys(out[l]).length >= BERRY_N) ? out : false;
    } catch { berryCache = false; }
  }
  return berryCache || null;
}
// Тест на локальному: коротший таймер (env BERRY_T_MS)
const berryT = (env) => Number(env.BERRY_T_MS) || BERRY_T;
async function berryAnswers(db, id) {
  const out = {};
  for (const sd of SIDES) {
    // eslint-disable-next-line no-await-in-loop
    const a = await getDoc(db, `berry:${sd}`);
    if (a?.id === id) out[sd] = a;
  }
  return out;
}
// Правильний варіант у тому порядку, як їх показали (perm[i] — які з 4 вихідних і в якому порядку)
const berryRight = (bank, g, i) => g.perm[i].indexOf(bank[g.level][g.qs[i]][2]);
const berryScore = (bank, g, picks) => picks.reduce((s, p, i) => s + (p >= 0 && p === berryRight(bank, g, i) ? 1 : 0), 0);
// Поки йде гра: лише мій поступ і скільки відповів другий (без його відповідей)
function berryLive(g, ans, side) {
  const mine = ans?.[side];
  const their = ans?.[other(side)];
  return {
    id: g.id, mine: g.by === side, at: g.at, level: g.level, n: g.qs.length, done: false,
    me: mine?.picks?.length || 0, them: their?.picks?.length || 0,
  };
}
// Дограна: рахунок; bank — ще й питання з поясненнями (у шторці; у стрічці лише рахунок)
function berryEnd(row, side, bank = null) {
  const g = row;
  const me = g.picks[side];
  const them = g.picks[other(side)];
  const sc = g.score || {};
  const view = {
    id: g.id, mine: g.by === side, at: g.at, level: g.level, n: g.qs.length, done: true,
    score: { me: sc[side] ?? 0, them: sc[other(side)] ?? 0 },
  };
  view.won = view.score.me > view.score.them;
  view.tie = view.score.me === view.score.them;
  if (bank) {
    view.rows = g.qs.map((k, i) => {
      const it = bank[g.level]?.[k];
      if (!it) return null;
      return { q: it[0], opts: g.perm[i].map((j) => it[1][j]), right: g.perm[i].indexOf(it[2]), fact: it[3] || '', me: me[i], them: them[i] };
    });
  }
  return view;
}
async function lastBerry(db, side, bank = null) {
  const row = await db.prepare("SELECT mood, at FROM marks WHERE kind = 'berry' ORDER BY at DESC LIMIT 1").first();
  return row ? berryEnd({ ...JSON.parse(row.mood), at: row.at }, side, bank) : null;
}
async function dropBerry(db, id) {
  await db.prepare("DELETE FROM docs WHERE k IN ('berry', 'berry:vona', 'berry:vin') AND v LIKE ?").bind(`%"id":"${id}"%`).run();
}
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
// 10 питань, яких ще не було на цьому рівні (doc berry-seen:<рівень>); скінчились — коло заново
async function berryDeal(db, bank, level) {
  const all = Object.keys(bank[level]);
  const seenKey = `berry-seen:${level}`;
  const seen = new Set(((await getDoc(db, seenKey))?.keys || []).filter((k) => Object.hasOwn(bank[level], k)));
  const unseen = shuffle(all.filter((k) => !seen.has(k)));
  let qs;
  let next;
  if (unseen.length >= BERRY_N) {
    qs = unseen.slice(0, BERRY_N);
    next = [...seen, ...qs];
  } else {
    // Невиданих замало — вони всі, решта з уже бачених; нове коло починається з цих
    qs = shuffle([...unseen, ...shuffle([...seen]).slice(0, BERRY_N - unseen.length)]);
    next = qs;
  }
  // Записуємо одразу при роздачі: скасував і роздав знову — ті самі питання не повернуться
  await putDoc(db, seenKey, { keys: next });
  return qs;
}
// Питання i для сторони: текст і варіанти в порядку гри, скільки секунд лишилось
const berryQ = (bank, g, i, left) => {
  const it = bank[g.level][g.qs[i]];
  return { i, q: it[0], opts: g.perm[i].map((j) => it[1][j]), left: Math.max(0, Math.round(left / 1000)) };
};

// Мої відповіді змінились: обидва на всіх 10 — рахунок у marks, гра стерта; я щойно дійшов до 10 — черга другого
async function berrySettle(db, bank, g, side, now, reaches, notify) {
  const all = await berryAnswers(db, g.id);
  if (!SIDES.every((sd) => all[sd]?.picks?.length >= BERRY_N)) {
    if (all[side]?.picks?.length >= BERRY_N && reaches) notify.send(other(side), berryNote(side, 'start'));
    return berryLive(g, all, side);
  }
  const picks = { vona: all.vona.picks, vin: all.vin.picks };
  const score = { vona: berryScore(bank, g, picks.vona), vin: berryScore(bank, g, picks.vin) };
  const end = { id: g.id, by: g.by, level: g.level, qs: g.qs, perm: g.perm, picks, score };
  await db.prepare('INSERT OR IGNORE INTO marks (id, side, kind, mood, at) VALUES (?, ?, ?, ?, ?)')
    .bind(`berry-${g.id}`, g.by, 'berry', JSON.stringify(end), now).run();
  await dropBerry(db, g.id);
  if (reaches) notify.send(other(side), berryNote(side, 'done'));
  return berryEnd({ ...end, at: now }, side, bank);
}

async function berryRoute(req, env, side, rest, notify) {
  const db = env.DB;
  const bank = berryBank(env);
  if (!bank) throw fail(503, 'berry');
  const m = req.method;
  const now = Date.now();
  const T = berryT(env);
  if (m === 'GET' && !rest) {
    const g = await getDoc(db, 'berry');
    const last = await lastBerry(db, side, bank);
    // Загадане переможцем желание — під рахунком
    if (last) last.wish = gwishView((await gwishes(db)).get(last.id), side);
    return json({ berry: g?.id ? berryLive(g, await berryAnswers(db, g.id), side) : null, last });
  }
  if (m === 'GET' && rest === '/wishes') return json({ wishes: bank.wishes });
  const b = m === 'POST' ? await readJson(req) : {};
  const reaches = await hasPush(db, other(side));
  if (m === 'POST' && !rest) {
    const level = String(b.level || '');
    if (!BERRY_LEVELS[level]) throw fail(400, 'berry');
    const prev = await getDoc(db, 'berry');
    if (prev?.id && now - prev.at < SAME_STALE) throw fail(409, 'busy');
    if (prev?.id) await dropBerry(db, prev.id);
    const qs = await berryDeal(db, bank, level);
    const g = { id: newId(), by: side, level, qs, perm: qs.map(() => shuffle([0, 1, 2, 3])), at: now };
    await putDoc(db, 'berry', g);
    return json({ berry: berryLive(g, {}, side) }, 201);
  }
  const g = await getDoc(db, 'berry');
  if (m === 'POST' && rest === '/cancel') {
    if (g?.id && g.id === b.id) await dropBerry(db, g.id);
    return json({ ok: true });
  }
  // Желание переможця: раз, лише після гри; нічия — без желания
  if (m === 'POST' && rest === '/wish') {
    const id = String(b.id || '');
    const row = await db.prepare("SELECT mood FROM marks WHERE id = ? AND kind = 'berry'").bind(`berry-${id}`).first();
    if (!row) throw fail(409, 'gone');
    const end = berryEnd(JSON.parse(row.mood), side);
    if (!end.won) throw fail(403, 'forbidden');
    const text = clip(b.text, 300);
    if (!text) throw fail(400, 'wish');
    const res = await db.prepare('INSERT OR IGNORE INTO marks (id, side, kind, mood, at) VALUES (?, ?, ?, ?, ?)')
      .bind(`gwish-${id}`, side, 'gwish', JSON.stringify({ game: id, text, done: null, src: 'berry' }), now).run();
    if (res.meta?.changes && reaches) notify.send(other(side), gwishNote(side, 'made'));
    return json({ wish: gwishView((await gwishes(db)).get(id), side) });
  }
  if (!g?.id || g.id !== String(b.id || '')) throw fail(409, 'gone');
  const st = await getDoc(db, `berry:${side}`);
  const mine = st?.id === g.id ? st : { id: g.id, picks: [], cur: null, t: 0 };
  const late = (st) => st.cur != null && now > st.t + T + BERRY_GRACE;
  // Наступне питання: те саме, якщо вже відкрите (час іде від першого показу); прострочене — без очка, далі
  if (m === 'POST' && rest === '/next') {
    if (late(mine)) {
      mine.picks.push(-1);
      mine.cur = null;
      await putDoc(db, `berry:${side}`, { ...mine, at: now });
      // Останнє питання прострочене — гра могла скінчитись і тут, не лише в /pick
      if (mine.picks.length >= BERRY_N) return json({ berry: await berrySettle(db, bank, g, side, now, reaches, notify), q: null });
    }
    if (mine.picks.length >= BERRY_N) return json({ berry: berryLive(g, await berryAnswers(db, g.id), side), q: null });
    if (mine.cur == null) { mine.cur = mine.picks.length; mine.t = now; }
    await putDoc(db, `berry:${side}`, { ...mine, at: now });
    return json({ berry: berryLive(g, await berryAnswers(db, g.id), side), q: berryQ(bank, g, mine.cur, mine.t + T - now) });
  }
  // Відповідь на питання i: повтор того самого i (відповідь загубилась у дорозі) — як є, без помилки
  if (m === 'POST' && rest === '/pick') {
    const i = Number(b.i);
    const pick = Number(b.pick);
    if (!Number.isInteger(i) || i < 0 || i >= BERRY_N || ![-1, 0, 1, 2, 3].includes(pick)) throw fail(400, 'berry');
    if (i < mine.picks.length) return json({ berry: berryLive(g, await berryAnswers(db, g.id), side) });
    if (mine.cur !== i) throw fail(409, 'order');
    mine.picks.push(late(mine) ? -1 : pick);
    mine.cur = null;
    await putDoc(db, `berry:${side}`, { ...mine, at: now });
    return json({ berry: await berrySettle(db, bank, g, side, now, reaches, notify) });
  }
  throw fail(404, 'not found');
}

// ── «🎲 Кубики» на зустріч: три кубики (що · де · як) рівня 💗 / 🔥 / 🌶️. Кидаю для другого: до 3 перекидань,
// «Сохранить купоном» — рядок marks kind gwish (src dice), той, кому подарували, відмічає «Исполнено ✓».
// Кидає сервер; грані — у секреті DICE (JSON { soft|hot|fire|xxx: { act, part, how: [6 × [значок, текст]], ban? } }), у репозиторії їх нема.
// doc dice:<side> — мій кидок, що ще не збережений: { id, level, faces, left, at }
// xxx — «Без запретов»: кидати можна, лише коли обоє ввімкнули згоду (doc dice-xxx)
const DICE_LEVELS = ['soft', 'hot', 'fire', 'xxx'];
const DICE_SIDES = ['act', 'part', 'how'];
const DICE_REROLLS = 3;
let diceCache = null;
function diceBank(env) {
  if (diceCache === null) {
    try {
      const b = JSON.parse(env.DICE || 'null');
      const ok = (f) => Array.isArray(f) && f.length === 2 && f.every((t) => typeof t === 'string' && t);
      diceCache = b && DICE_LEVELS.every((l) => DICE_SIDES.every((d) => Array.isArray(b[l]?.[d]) && b[l][d].length === 6 && b[l][d].every(ok))) ? b : false;
    } catch { diceCache = false; }
  }
  return diceCache || null;
}
const diceFaces = () => DICE_SIDES.map(() => Math.floor(Math.random() * 6));
// Заборонені пари «Что × Куда» (bank[level].ban = [[act, part], …]) — кубик «Куда» тихо стає на іншу грань
function diceFix(bank, level, faces) {
  const ban = Array.isArray(bank[level]?.ban) ? bank[level].ban : [];
  const bad = (p) => ban.some((x) => Array.isArray(x) && x[0] === faces[0] && x[1] === p);
  if (!bad(faces[1])) return faces;
  const ok = [0, 1, 2, 3, 4, 5].filter((p) => p !== faces[1] && !bad(p));
  return ok.length ? [faces[0], ok[Math.floor(Math.random() * ok.length)], ...faces.slice(2)] : faces;
}
const diceFace = (bank, r, i) => bank[r.level][DICE_SIDES[i]][r.faces[i]];
const diceView = (bank, r) => ({ id: r.id, level: r.level, faces: r.faces, icons: r.faces.map((_, i) => diceFace(bank, r, i)[0]), texts: r.faces.map((_, i) => diceFace(bank, r, i)[1]), left: r.left });

async function diceRoute(req, env, side, rest, notify) {
  const db = env.DB;
  const bank = diceBank(env);
  if (!bank) throw fail(503, 'dice');
  const m = req.method;
  const now = Date.now();
  const key = `dice:${side}`;
  const consent = (await getDoc(db, 'dice-xxx')) || {};
  if (m === 'GET' && !rest) {
    const r = await getDoc(db, key);
    const rows = (await db.prepare("SELECT side, mood, at FROM marks WHERE kind = 'gwish' AND json_extract(mood, '$.src') = 'dice' ORDER BY at DESC LIMIT 40").all()).results;
    // Купон цілком — щоб відкрити його й з «Планов» (повтор кидка, торг, «Было жарко»)
    const list = rows.map((x) => { const v = JSON.parse(x.mood); return { id: v.game, mine: x.side === side, text: v.text, icons: v.icons, texts: v.texts || null, level: v.level || null, done: v.done || null, stars: v.stars || null, lock: !!v.lock, haggled: v.haggled ?? null, canHaggle: !v.lock && v.haggled == null && Array.isArray(v.faces), claimed: v.claimed || null, at: x.at }; });
    return json({
      roll: r?.id ? diceView(bank, r) : null,
      xxx: { me: !!consent[side], them: !!consent[other(side)] },
      score: { mine: list.filter((x) => x.mine).length, theirs: list.filter((x) => !x.mine).length },
      list,
    });
  }
  // Згода на «Без запретов» — у кожного своя
  if (m === 'POST' && rest === '/xxx') {
    const b = await readJson(req);
    const next = { ...consent, [side]: !!b.on };
    await putDoc(db, 'dice-xxx', next);
    return json({ xxx: { me: !!next[side], them: !!next[other(side)] } });
  }
  if (m !== 'POST') throw fail(404, 'not found');
  const b = await readJson(req);
  const cur = await getDoc(db, key);
  // Новий кидок (level) або перекидання того самого (id)
  if (!rest) {
    if (b.id) {
      if (!cur?.id || cur.id !== String(b.id)) throw fail(409, 'gone');
      if (cur.left <= 0) throw fail(409, 'rerolls');
      // Перекинути один кубик (die 0–2) — інша грань саме цього; без die — усі три, як раніше
      const die = Number.isInteger(b.die) && b.die >= 0 && b.die < DICE_SIDES.length ? b.die : null;
      const faces = diceFix(bank, cur.level, die === null ? diceFaces() : cur.faces.map((f, i) => (i === die ? (f + 1 + Math.floor(Math.random() * 5)) % 6 : f)));
      const r = { ...cur, faces, left: cur.left - 1, at: now };
      await putDoc(db, key, r);
      return json({ roll: diceView(bank, r) });
    }
    const level = String(b.level || '');
    if (!DICE_LEVELS.includes(level)) throw fail(400, 'dice');
    if (level === 'xxx' && !(consent.vin && consent.vona)) throw fail(403, 'consent');
    const r = { id: newId(), level, faces: diceFix(bank, level, diceFaces()), left: DICE_REROLLS, at: now };
    await putDoc(db, key, r);
    return json({ roll: diceView(bank, r) }, 201);
  }
  // Зберегти купоном: текст граней — у рядок «желания», другому — сповіщення без тексту
  if (rest === '/keep') {
    if (!cur?.id || cur.id !== String(b.id || '')) throw fail(409, 'gone');
    const v = diceView(bank, cur);
    const text = v.texts.join(' · ');
    const res = await db.prepare('INSERT OR IGNORE INTO marks (id, side, kind, mood, at) VALUES (?, ?, ?, ?, ?)')
      .bind(`gwish-${cur.id}`, side, 'gwish', JSON.stringify({ game: cur.id, text, icons: v.icons, texts: v.texts, faces: cur.faces, level: cur.level, lock: !!b.lock, done: null, src: 'dice' }), now).run();
    await db.prepare('DELETE FROM docs WHERE k = ?').bind(key).run();
    if (res.meta?.changes && await hasPush(db, other(side))) notify.send(other(side), diceNote(side));
    return json({ wish: gwishView((await gwishes(db)).get(cur.id), side) });
  }
  if (rest === '/claim') {
    const id = String(b.id || '');
    const mk = await db.prepare("SELECT side, mood FROM marks WHERE id = ? AND kind = 'gwish'").bind(`gwish-${id}`).first();
    if (!mk || mk.side === side) throw fail(409, 'gone');
    const v = JSON.parse(mk.mood);
    if (v.src !== 'dice' || v.done) throw fail(409, 'claim');
    v.claimed = new Date().toISOString();
    await db.prepare('UPDATE marks SET mood = ? WHERE id = ?').bind(JSON.stringify(v), `gwish-${id}`).run();
    if (await hasPush(db, other(side))) notify.send(other(side), diceClaimNote(side));
    return json({ wish: gwishView((await gwishes(db)).get(id), side) });
  }
  if (rest === '/haggle') {
    const id = String(b.id || '');
    const die = Number(b.die);
    const mk = await db.prepare("SELECT side, mood FROM marks WHERE id = ? AND kind = 'gwish'").bind(`gwish-${id}`).first();
    if (!mk || mk.side === side) throw fail(409, 'gone');
    const v = JSON.parse(mk.mood);
    if (v.src !== 'dice' || v.done || v.lock || v.haggled != null || !Array.isArray(v.faces) || !(die >= 0 && die < DICE_SIDES.length)) throw fail(409, 'haggle');
    v.faces = diceFix(bank, v.level || 'hot', v.faces.map((f, i) => (i === die ? (f + 1 + Math.floor(Math.random() * 5)) % 6 : f)));
    const view = diceView(bank, { id, level: v.level || 'hot', faces: v.faces, left: 0 });
    Object.assign(v, { icons: view.icons, texts: view.texts, text: view.texts.join(' · '), haggled: die });
    await db.prepare('UPDATE marks SET mood = ? WHERE id = ?').bind(JSON.stringify(v), `gwish-${id}`).run();
    if (await hasPush(db, other(side))) notify.send(other(side), diceHaggleNote(side));
    return json({ wish: gwishView((await gwishes(db)).get(id), side) });
  }
  if (rest === '/drop') {
    await db.prepare('DELETE FROM docs WHERE k = ?').bind(key).run();
    return json({ ok: true });
  }
  throw fail(404, 'not found');
}

// «Поменяться темами»: обмін діє добу від натискання або до «Вернуть» (будь-хто з двох)
const SWAP_DAY = 864e5;
const liveSwap = (d) => (d?.at && Date.now() - d.at < SWAP_DAY ? { at: d.at, by: d.by } : null);
async function swapThemes(req, db, side) {
  const b = await readJson(req);
  const doc = b.on ? { at: Date.now(), by: side } : { at: 0, by: side, off: Date.now() };
  await putDoc(db, 'swap', doc);
  return json({ swap: liveSwap(doc) });
}

async function checkinSeen(req, db, side) {
  const b = await readJson(req);
  const k = `checkin:${other(side)}`;
  const doc = await getDoc(db, k);
  if (!doc?.at || doc.at !== Number(b.at) || doc.seen === doc.at) return json({ ok: true });
  await putDoc(db, k, { ...doc, seen: doc.at });
  return json({ ok: true });
}

async function checkinAsk(req, db, side, notify) {
  const now = Date.now();
  const reaches = await hasPush(db, other(side));
  const prev = await getDoc(db, `checkin-ask:${side}`);
  if (prev?.at && now - prev.at < ASK_GAP) return json({ reaches, sent: false, again: true });
  const token = [...crypto.getRandomValues(new Uint8Array(18))].map((x) => x.toString(16).padStart(2, '0')).join('');
  await putDoc(db, `checkin-ask:${side}`, { at: now, token });
  await addMark(db, side, 'ask', now);
  if (reaches) notify.send(other(side), askNote(side, token, new URL(req.url).origin));
  return json({ reaches, sent: reaches && notify.on });
}

// Токен разовий і живе добу; відмітка — від того, кого питали
async function checkinOk(req, env, ctx, info) {
  const b = await readJson(req);
  const token = String(b.token || '');
  if (!/^[0-9a-f]{36}$/.test(token)) throw fail(400, 'token');
  for (const asker of SIDES) {
    const ask = await getDoc(env.DB, `checkin-ask:${asker}`);
    if (ask?.token !== token || Date.now() - ask.at > CHECKIN_MAX_AGE) continue;
    await putDoc(env.DB, `checkin-ask:${asker}`, { at: ask.at });
    const side = other(asker);
    info.side = side;
    info.path = 'checkin';
    return saveCheckin(env.DB, side, Date.now(), null, pusher(req, env, ctx));
  }
  throw fail(404, 'token');
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
  const { id, at, created, lat, lon, acc, loc, locAt, audio, audioType, seen, ok } = s;
  return { id, at, created, lat: lat ?? null, lon: lon ?? null, acc: acc ?? null, loc: loc || null, locAt: locAt || null, audio: !!audio, audioType: audioType || null, seen: seen || null, ok: ok || null };
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
    // Патчем, не переписуючи документ: місце в цей момент могло оновитись
    if (!s.seen) {
      await db.prepare("UPDATE docs SET v = json_patch(v, ?), updated = ? WHERE k = ? AND json_extract(v, '$.id') = ?")
        .bind(JSON.stringify({ seen: now }), now, theirKey, id).run();
    }
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
    // Місце оновлюється, поки відкрита шторка (до раза на 30 с): дописуємо патчем у той самий сигнал,
    // не переписуючи документ, — інакше одночасне «Вижу» другого могло б загубитись. locAt — коли оновили
    const patchLoc = (fields) => db.prepare("UPDATE docs SET v = json_patch(v, ?), updated = ? WHERE k = ? AND json_extract(v, '$.id') = ? AND json_extract(v, '$.ok') IS NULL")
      .bind(JSON.stringify({ ...fields, locAt: now }), now, key, s.id).run();
    // Зашифроване місце (loc: «e1.…») — сервер не знає координат, лише зберігає
    if (typeof b.loc === 'string' && SEALED.test(b.loc)) {
      await patchLoc({ loc: clip(b.loc, 2000) });
      return json({ ok: true });
    }
    const lat = Number(b.lat);
    const lon = Number(b.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw fail(400, 'coords');
    const acc = Number.isFinite(Number(b.acc)) ? Math.round(Number(b.acc)) : null;
    await patchLoc({ lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6, acc });
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

// Файли в R2 понад FILES_LIMIT: стираємо найстаріші, сам рядок лишається з позначкою gone.
// Рахуємо все в R2 — і файли переписки (f-), і вкладення листів у конверт (l-). Стираємо спершу файли переписки,
// коли їх уже нема — вкладення відкритих листів; вкладення ще не відкритого листа не стираємо ніколи
const LETTER_FILES = "FROM letters WHERE media IS NOT NULL AND json_extract(media, '$.s') IS NOT NULL "
  + "AND json_extract(media, '$.gone') IS NULL";
async function fileCleanup(env, now = Date.now()) {
  const db = env.DB;
  if (!env.FILES) return 0;
  const live = "FROM memes WHERE file IS NOT NULL AND gone IS NULL";
  let over = (await db.prepare(`SELECT IFNULL(SUM(json_extract(file, '$.s')), 0) AS n ${live}`).first('n'))
    + (await db.prepare(`SELECT IFNULL(SUM(json_extract(media, '$.s')), 0) AS n ${LETTER_FILES}`).first('n'))
    - (Number(env.FILES_LIMIT_BYTES) || FILES_LIMIT);
  let gone = 0;
  const sweep = async (list, drop) => {
    while (over > 0) {
      const { results } = await list();
      if (!results.length) return;
      const pick = [];
      for (const r of results) {
        if (over <= 0) break;
        pick.push(r);
        over -= r.n;
      }
      await drop(pick);
      gone += pick.length;
    }
  };
  await sweep(() => db.prepare(`SELECT id, json_extract(file, '$.s') AS n ${live} ORDER BY created ASC LIMIT 50`).all(), async (pick) => {
    await env.FILES.delete(pick.map((r) => `f-${r.id}`));
    await db.batch(pick.map((r) => db.prepare('UPDATE memes SET gone = ? WHERE id = ?').bind(now, r.id)));
  });
  await sweep(() => db.prepare(`SELECT id, json_extract(media, '$.s') AS n ${LETTER_FILES} AND opened IS NOT NULL ORDER BY created ASC LIMIT 50`).all(), async (pick) => {
    await env.FILES.delete(pick.flatMap((r) => lkeys(r.id)));
    await db.batch(pick.map((r) => db.prepare("UPDATE letters SET media = json_set(media, '$.gone', ?) WHERE id = ?").bind(now, r.id)));
  });
  if (gone) console.log('fileCleanup', { gone });
  return gone;
}

// Лист у конверті читається один раз — вкладення відкритого листа більше ніде не показується.
// Через ATTACH_KEEP_MS після відкриття байти стираємо (рядок лишається з позначкою gone)
const ATTACH_KEEP_MS = 30 * DAY_MS;
async function openedAttachCleanup(env, now = Date.now()) {
  if (!env.FILES) return 0;
  const db = env.DB;
  const { results } = await db.prepare(`SELECT id ${LETTER_FILES} AND opened IS NOT NULL AND opened < ? LIMIT 150`).bind(now - ATTACH_KEEP_MS).all();
  if (!results.length) return 0;
  await env.FILES.delete(results.flatMap((r) => lkeys(r.id)));
  await db.batch(results.map((r) => db.prepare("UPDATE letters SET media = json_set(media, '$.gone', ?) WHERE id = ?").bind(now, r.id)));
  console.log('openedAttachCleanup', { gone: results.length });
  return results.length;
}

// Файли в R2 без свого рядка (скинули базу, обірвалось між «поклали файл» і «записали лист») — не рахуються
// в межу й інакше лежали б вічно. Раз на добу: старші за добу (щойно покладений ще може чекати свій рядок)
const R2_KEY = /^([fl])-([a-z0-9]{16,32})(-\d)?$/;
async function orphanFiles(env, now = Date.now()) {
  if (!env.FILES?.list) return 0;
  const db = env.DB;
  const live = async (table, ids) => {
    const cond = table === 'memes' ? 'file IS NOT NULL AND gone IS NULL' : "media IS NOT NULL AND json_extract(media, '$.gone') IS NULL";
    const out = new Set();
    for (let i = 0; i < ids.length; i += 90) {
      const part = ids.slice(i, i + 90);
      const { results } = await db.prepare(`SELECT id FROM ${table} WHERE ${cond} AND id IN (${part.map(() => '?').join(', ')})`).bind(...part).all();
      results.forEach((r) => out.add(r.id));
    }
    return out;
  };
  let cursor;
  let gone = 0;
  do {
    const page = await env.FILES.list({ cursor, limit: 500 });
    const old = page.objects.filter((o) => R2_KEY.test(o.key) && now - new Date(o.uploaded).getTime() > DAY_MS);
    const idOf = (k) => k.slice(2).replace(/-\d$/, '');
    const ids = (p) => old.filter((o) => o.key[0] === p).map((o) => idOf(o.key));
    const [chat, mail] = await Promise.all([live('memes', ids('f')), live('letters', ids('l'))]);
    const dead = old.filter((o) => !(o.key[0] === 'f' ? chat : mail).has(idOf(o.key))).map((o) => o.key);
    if (dead.length) await env.FILES.delete(dead);
    gone += dead.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  if (gone) console.log('orphanFiles', { gone });
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

// SOS без «Вижу» й «Отбой»: push другому щохвилини (cron), не довше SOS_REPEAT від сигналу — телефон дзвонить
// і з вимкненим екраном. Коли нагадали востаннє — окремим документом sosping:<сторона>, щоб не переписувати
// сам сигнал (паралельне «Вижу» не загубиться)
const SOS_REPEAT = 30 * 60 * 1000;
async function sosRepeat(env, now = Date.now()) {
  if (!env.VAPID_PRIVATE) return;
  for (const side of SIDES) {
    const s = await getDoc(env.DB, `sos:${side}`);
    const since = s?.created || s?.at;
    if (!s || s.seen || s.ok || now - since > SOS_REPEAT || now - since < 50_000) continue;
    const ping = await getDoc(env.DB, `sosping:${side}`);
    if (ping?.id === s.id && now - ping.at < 50_000) continue;
    await putDoc(env.DB, `sosping:${side}`, { id: s.id, at: now });
    await pushSide(env, other(side), sosNote(side, s.at, now));
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
function checkinNote(from, at, now, mood) {
  const late = now - at > 15 * 60 * 1000;
  const time = new Intl.DateTimeFormat('ru', { timeZone: STOCK_TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(at));
  return {
    title: `${sender(from, 'Он отметился', 'Она отметилась')} ❤️`,
    body: (late ? `В ${time}: всё хорошо` : 'Всё хорошо') + (mood ? ` ${mood}` : ''),
    tag: 'checkin',
    go: 'letter',
  };
}

// «Как ты?»: кнопка в самому сповіщенні відмічає «Я в порядке», не відкриваючи застосунок (Android; на iPhone — тап відкриває)
function askNote(from, token, origin) {
  return {
    title: sender(from, 'Он спрашивает: как ты? 🫶', 'Она спрашивает: как ты? 🫶'),
    body: `Нажми «Я в порядке» — ${sender(from, 'он', 'она')} узнает`,
    tag: 'ask',
    go: 'letter',
    actions: [{ action: 'ok', title: '❤️ Я в порядке' }],
    ok: { url: `${origin}/api/checkin-ok`, token },
  };
}

// «🫡 Да, капитан!»: на що саме погодились — у тексті; тап — у чат
// «✊ Спор»: виклик, «твой ход» після розіграного раунду, кінець. Хто переміг — не пишемо: хай побачить розкриття
const cap1 = (x) => x[0].toUpperCase() + x.slice(1);
const BOARD_TITLE = { ttt: ['♂️♀️', 'Крестики-нолики'], c4: ['🔵🔴', 'Четыре в ряд'], bs: ['🚢', 'Морской бой'], db: ['✏️', 'Точки и квадраты'], mm: ['🐾', 'Найди пару'] };
function duelNote(from, what, game, score) {
  const kind = duelKind(game);
  const base = kind === 'rps' ? { tag: 'duel', go: 'duel' } : { tag: `duel-${kind}`, go: `duel:${kind}` };
  const { topic, preset } = game;
  const t = preset === 'free' || SEALED.test(topic) ? '' : `«${topic}»`;
  const stake = preset === 'wish' ? ' на желание' : t ? `: ${t}` : '';
  if (what === 'start') return { ...base, title: '✊ Камень-ножницы', body: `${sender(from, 'Он зовёт сыграть', 'Она зовёт сыграть')}${stake}. Твой ход!` };
  if (what === 'done') return { ...base, title: '🏆 Игра окончена', body: `${t || 'Игра'} — посмотри, кто победил` };
  // Ігри на полі: push на кожен хід
  const [icon, name] = BOARD_TITLE[game.game] || BOARD_TITLE.ttt;
  // Морський бій: ціль — у світі того, кому пишемо: в обох кораблики
  if (what === 'bs-start') return { ...base, title: '🚢 Морской бой', body: `${sender(from, 'Он зовёт сыграть', 'Она зовёт сыграть')}${stake}. Расставь кораблики!` };
  if (what === 'bs-ready') return { ...base, title: '🚢 Морской бой', body: sender(from, 'Он расставил кораблики — стреляй первой!', 'Она расставила кораблики — стреляй первым!') };
  if (what === 'bs-shot') {
    const target = 'твой кораблик';
    const body = !score.hit ? `${sender(from, 'Он промахнулся', 'Она промахнулась')} — твой ход!`
      : score.sunk ? `${sender(from, 'Он потопил', 'Она потопила')} ${target}${score.note ? ` и ${sender(from, 'нашёл', 'нашла')} записку 💌` : ' 💔'} — стреляет ещё`
        : `${sender(from, 'Он попал', 'Она попала')} в ${target} 💥 — стреляет ещё`;
    return { ...base, title: '🚢 Морской бой', body };
  }
  if (what === 'board-start') return { ...base, title: `${icon} ${name}`, body: `${sender(from, 'Он зовёт сыграть', 'Она зовёт сыграть')}${stake}. Твой ход!` };
  if (what === 'board-draw') return { ...base, title: `${icon} Ничья`, body: `${t ? `${t}: ` : ''}${t ? 'н' : 'Н'}овая партия — ты начинаешь!` };
  if (what === 'moved') return { ...base, title: '✊ Камень-ножницы', body: `${sender(from, 'Он уже выбрал', 'Она уже выбрала')} — твой ход!` };
  if (what === 'board-turn') return { ...base, title: `${icon} ${name}`, body: `${t ? `${t}: ` : ''}${t ? 'т' : 'Т'}вой ход!` };
  const s = score.me === score.them ? `пока ${score.me}:${score.them}` : `счёт ${score.them}:${score.me} ${score.them > score.me ? 'в твою пользу' : sender(from, 'в его пользу', 'в её пользу')}`;
  return { ...base, title: '✊ Камень-ножницы', body: `${t ? `${t}: ` : ''}${t ? s : cap1(s)}. Твой ход!` };
}

// «🎁 Желание»: загадали — тому, хто програв; виконано — переможцю
function gwishNote(from, what, src) {
  if (what === 'done' && src === 'dice') return { title: '🎲 Купон использован', body: sender(from, 'Он отметил купон: исполнено ✓', 'Она отметила купон: исполнено ✓'), tag: 'gwish', go: 'letter' };
  if (what === 'made') return { title: '🎁 Желание', body: sender(from, 'Он загадал желание — посмотри', 'Она загадала желание — посмотри'), tag: 'gwish', go: 'letter' };
  return { title: '🎁 Желание исполнено', body: sender(from, 'Он отметил: исполнено ✓', 'Она отметила: исполнено ✓'), tag: 'gwish', go: 'letter' };
}

// «💞 Совпадёт?»: виклик і «відповіді відкрились» (скільки збіглося — не пишемо: хай подивиться сама/сам)
function sameNote(from, what) {
  const base = { tag: 'same', go: 'same', title: '💞 Совпадёт?' };
  if (what === 'start') return { ...base, body: sender(from, 'Он ответил на вопросы — теперь ты. Совпадёт?', 'Она ответила на вопросы — теперь ты. Совпадёт?') };
  return { ...base, body: 'Ответы открылись — посмотри, сколько совпало' };
}
// «🎲 Кубики»: подарований купон — без тексту граней
function diceClaimNote(from) {
  return { tag: 'gwish', go: 'letter', title: '📩 Купон предъявлен', body: sender(from, 'Он предъявляет тебе купон 😏 Пора исполнять', 'Она предъявляет тебе купон 😏 Пора исполнять') };
}
function diceHaggleNote(from) {
  return { tag: 'gwish', go: 'letter', title: '🎲 Торг по купону', body: sender(from, 'Он перебросил один кубик в твоём купоне — посмотри', 'Она перебросила один кубик в твоём купоне — посмотри') };
}
function diceNote(from) {
  return { tag: 'gwish', go: 'letter', title: '🎲 Купон на встречу', body: sender(from, 'Он выкинул тебе купон — посмотри', 'Она выкинула тебе купон — посмотри') };
}
// «🍓 Клубничка»: скромно — ні рівня, ні питань у сповіщенні
function berryNote(from, what) {
  const base = { tag: 'berry', go: 'berry', title: '🍓 Клубничка' };
  if (what === 'start') return { ...base, body: sender(from, 'Он ответил на вопросы — теперь ты', 'Она ответила на вопросы — теперь ты') };
  return { ...base, body: 'Счёт открылся — посмотри, кто знает больше' };
}
// «🔥 Совпадёт?» для двох: скромно — ні рівня, ні питань у сповіщенні
function hotNote(from, what) {
  const base = { tag: 'hot', go: 'hot', title: '🔥 Только для вас двоих' };
  if (what === 'start') return { ...base, body: sender(from, 'Он ответил на вопросы — теперь ты', 'Она ответила на вопросы — теперь ты') };
  return { ...base, body: 'Ответы открылись — посмотри, где совпало' };
}

function captainNote(from, quote) {
  return { title: '🫡 Да, капитан!', body: quote ? `На «${quote}»` : sender(from, 'Он согласен', 'Она согласна'), tag: 'captain', go: 'letter' };
}

// Сердечко з листівки «Вместе»: тап — одразу шторка, там воно прилетить
function bellNote(from) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: STOCK_TZ }).format(new Date()));
  const night = h >= 23 || h < 8;
  return { title: '🔔 Звоночек', body: sender(from, 'Он потряс телефон — зовёт тебя, загляни 💛', 'Она потрясла телефон — зовёт тебя, загляни 💕'), tag: 'bell', go: 'letter', buzz: !night };
}
function bellAnswerNote(from, a) {
  return {
    title: a === 'go' ? '🏃 Ответ на звоночек' : '⏳ Ответ на звоночек',
    body: a === 'go' ? sender(from, 'Он уже идёт!', 'Она уже идёт!') : sender(from, 'Он подойдёт чуть позже', 'Она подойдёт чуть позже'),
    tag: 'bell-answer', go: 'letter',
  };
}
function heartNote(from) {
  return { title: '💞 Сердечко', body: sender(from, 'Он отправил тебе сердечко с Юпитера', 'Она отправила тебе сердечко с Земли'), tag: 'heart', go: 'together' };
}

// Дата зустрічі: «12 декабря» (дата без часу — рахуємо в UTC, щоб не зсунулась на день)
const meetDay = (d) => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T00:00Z`));
function meetNote(from, was, now) {
  if (!now) return { title: 'Встреча снята', body: sender(from, 'Он убрал дату встречи', 'Она убрала дату встречи'), tag: 'meet', go: 'together' };
  if (was) return { title: 'Встреча перенесена 💞', body: `${sender(from, 'Он перенёс', 'Она перенесла')} встречу на ${meetDay(now)}`, tag: 'meet', go: 'together' };
  return { title: 'Встреча 💞', body: `${sender(from, 'Он назначил', 'Она назначила')} встречу: ${meetDay(now)}`, tag: 'meet', go: 'together' };
}

// Тап — «Письма», де в надісланих видно ❤️
function likeNote(from, kind) {
  return {
    title: `${sender(from, 'Ему понравилось', 'Ей понравилось')} ❤️`,
    body: kind === 'env' || kind === 'tpl' ? 'твоя записка в конверте' : 'твоё письмо',
    tag: 'like',
    go: 'letter',
  };
}

// as — чим відповіли, якщо не словами: 'gif' | 'photo'
function replyNote(from, on, as) {
  const what = on === 'gif' ? 'на твою гифку' : on === 'photo' ? 'на твоё фото' : on === 'file' ? 'на твой файл' : on === 'voice' ? 'на твоё голосовое' : on === 'sticker' ? 'на твою наклейку' : 'на твоё письмо';
  const how = { gif: 'Гифкой', photo: 'Фото', file: 'Файлом', sticker: 'Наклейкой', voice: 'Голосовым' }[as];
  return {
    title: `${sender(from, 'Он ответил', 'Она ответила')} 💌`,
    body: how ? `${how} ${what}` : what[0].toUpperCase() + what.slice(1),
    tag: 'reply',
  };
}
// Відповідь новим повідомленням: цитата (до 300 знаків) і на що — для push
const quoteOf = (b) => clip(b.quote, 300) || null;
const quoteOn = (b) => (['gif', 'photo', 'file', 'sticker', 'voice'].includes(b.on) ? b.on : 'letter');

async function pushRoute(req, env, side, path) {
  const m = req.method;
  if (m === 'GET' && path === 'push-key') return json({ key: vapidPublic(env) });
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
// «К дате» в хотілках: другому (хто дарує) — за 7 і за 2 дні, зранку від 9:00 за Києвом; «куплено» — не нагадуємо.
// Назва зашифрована — у push лише дата й «хотелка к этому дню»
const WISH_REMIND_HOUR = 9;
async function wishReminders(env) {
  if (!env.VAPID_PRIVATE) return;
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: STOCK_TZ }).format(now));
  if (hour < WISH_REMIND_HOUR) return;
  const today = kyivDay();
  const { results } = await env.DB.prepare(
    "SELECT id, owner, due, reminded FROM wishes WHERE due IS NOT NULL AND due >= ? AND gifted IS NULL AND (mark IS NULL OR mark != 'bought')",
  ).bind(today).all();
  for (const w of results) {
    const days = Math.round((Date.parse(`${w.due}T00:00Z`) - Date.parse(`${today}T00:00Z`)) / 864e5);
    const stage = days <= 2 ? 2 : days <= 7 ? 7 : 0;
    if (!stage) continue;
    const done = w.reminded === `${w.due}:2` || w.reminded === `${w.due}:${stage}`;
    if (done) continue;
    // Спершу позначка — два накладені запуски cron не надішлють двічі
    const res = await env.DB.prepare('UPDATE wishes SET reminded = ? WHERE id = ? AND reminded IS ?')
      .bind(`${w.due}:${stage}`, w.id, w.reminded ?? null).run();
    if (res.meta?.changes) await pushSide(env, other(w.owner), wishDueNote(w.owner, w.due, days));
  }
  await feastReminders(env, today);
}

// За 10 днів до дня народження (з «Вместе») і Нового року — тому, хто дарує: скільки хотілок і скільки «очень хочу».
// Раз на свято: doc remind:<кому>:<що>:<дата>
const FEAST_AHEAD = 10;
const nextOn = (today, mmdd) => {
  const y = Number(today.slice(0, 4));
  const fix = (yy) => (mmdd === '02-29' && new Date(Date.UTC(yy, 1, 29)).getUTCMonth() !== 1 ? `${yy}-02-28` : `${yy}-${mmdd}`);
  return fix(y) >= today ? fix(y) : fix(y + 1);
};
async function feastReminders(env, today) {
  const together = (await getDoc(env.DB, 'together')) || {};
  for (const to of SIDES) {
    const owner = other(to);
    const bday = together[owner === 'vona' ? 'bdayVona' : 'bdayVin'];
    const feasts = [['ny', nextOn(today, '01-01')], ...(DATE_FIELD.test(String(bday || '')) ? [['bday', nextOn(today, bday.slice(5))]] : [])];
    for (const [kind, date] of feasts) {
      const days = Math.round((Date.parse(`${date}T00:00Z`) - Date.parse(`${today}T00:00Z`)) / 864e5);
      if (days < 1 || days > FEAST_AHEAD) continue;
      const key = `remind:${to}:${kind}:${date}`;
      if (await getDoc(env.DB, key)) continue;
      await putDoc(env.DB, key, { at: Date.now() });
      const c = await env.DB.prepare("SELECT count(*) n, sum(hot) hot, sum(CASE WHEN mark = 'bought' THEN 1 ELSE 0 END) bought FROM wishes WHERE owner = ? AND gifted IS NULL")
        .bind(owner).first();
      await pushSide(env, to, feastNote(owner, kind, days, c || {}));
    }
  }
}

const daysWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'день' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'дня' : 'дней');
function feastNote(owner, kind, days, c) {
  const when = days === 1 ? 'Завтра' : `Через ${days} ${daysWord(days)}`;
  const title = kind === 'ny' ? `🎄 ${when} Новый год` : `🎂 ${when} ${sender(owner, 'его', 'её')} день рождения`;
  const n = Number(c.n) || 0;
  const hot = Number(c.hot) || 0;
  const bought = Number(c.bought) || 0;
  const body = !n ? `${sender(owner, 'У него', 'У неё')} пока нет хотелок — можно спросить, о чём ${sender(owner, 'мечтает', 'мечтает')}`
    : `В ${sender(owner, 'его', 'её')} хотелках: ${n}${hot ? `, из них «очень хочу» — ${hot}` : ''}${bought ? `. Уже куплено: ${bought}` : ''}`;
  return { title, body, tag: `feast-${kind}`, go: 'wish' };
}

function giftedNote(from) {
  return { title: 'Сбылось ✨', body: sender(from, 'Он подарил то, что ты хотела', 'Она подарила то, что ты хотел'), tag: 'wish-gifted', go: 'wish' };
}

function wishDueNote(owner, due, days) {
  const when = days === 0 ? 'Сегодня' : days === 1 ? 'Завтра' : `Через ${days} ${days < 5 ? 'дня' : 'дней'}`;
  return {
    title: `🎁 ${when} — ${meetDay(due)}`,
    body: `${sender(owner, 'У него', 'У неё')} хотелка к этому дню. Подарок уже есть? Если купили — отметь «куплено»`,
    tag: `wish-due-${due}`, go: 'wish',
  };
}

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
