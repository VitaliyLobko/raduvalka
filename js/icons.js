// Улюбленці-листоноші: імена, пози й фото приходять із сервера
import { DATA } from './data.js';
import { imageUrl, cachedImageUrl, dropStaleImages } from './api.js';

// Імʼя файлу пози → blob-URL; фото тягнемо з ключем, бо <img src> його не передасть
const PETS = {};

export const petName = (key) => DATA.mascots[key]?.name || '';

// Хто за що відповідає: roles у записі улюбленця (memes, box, push)
export const petFor = (role) => Object.keys(DATA.mascots).find((k) => DATA.mascots[k].roles?.includes(role))
  || Object.keys(DATA.mascots)[0];

// Хто веде «Точно?» і «Отложено»: зазвичай box, а приблизно кожен третій раз — улюбленець із роллю aside
export function boxPet() {
  const aside = Object.keys(DATA.mascots).find((k) => DATA.mascots[k].roles?.includes('aside'));
  return aside && Math.random() < 1 / 3 ? aside : petFor('box');
}

// Номер варіанта від seed: той самий seed — той самий варіант (при перемальовці не скаче); без seed — випадковий
function seedIdx(seed, n) {
  if (seed == null) return Math.floor(Math.random() * n);
  let x = 0;
  for (const ch of String(seed)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return x % n;
}

// Своя репліка улюбленця з бази (mascots.<key>.lines.<name>): масив або { vona, vin } — за боком; нема — fallback
export function petLine(key, name, fallback = '', seed) {
  let v = name ? DATA.mascots[key]?.lines?.[name] : null;
  if (v && !Array.isArray(v)) v = v[DATA.side];
  return v?.length ? v[seedIdx(seed, v.length)] : fallback;
}

// Службовий текст + жарт улюбленця хвостом, якщо він у нього є
export function petTail(key, name, base, seed) {
  const tail = petLine(key, name, '', seed);
  return tail ? `${base} ${tail}` : base;
}

// Новорічний сезон 15.12–14.01 за місцевою датою
export function newYear(d = new Date()) {
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  return md >= 1215 || md <= 114;
}

// Файл пози: у сезон «ny-<поза>» замість звичайної, «ny-main» — замість головної
function fileOf(m, pose) {
  const ny = newYear();
  return (ny && m.poses[`ny-${pose}`]) || m.poses[pose] || (ny && m.poses['ny-main']) || m.poses.main;
}

// Поза кур'єра конкретного листа: від seed (id листа) — у кожного листа своя, в обох однакова, при перемальовці не скаче.
// Святкові пози — лише для листа до дати; у новорічний сезон — головна (а вона стає новорічною)
const SPECIAL = new Set(['festive', 'party']);
export function letterPose(key, seed) {
  const m = DATA.mascots[key];
  if (!m || seed == null || newYear()) return 'main';
  const list = Object.keys(m.poses).filter((p) => !p.startsWith('ny-') && !SPECIAL.has(p));
  return list[seedIdx(seed, list.length)] || 'main';
}

// Перша поза зі списку, яка є в улюбленця, інакше головна
export const firstPose = (key, ...names) => names.find((p) => DATA.mascots[key]?.poses?.[p]) || 'main';

// blob-URL фото пози — для canvas у конструкторі мемчиків
export function petSrc(key, pose = 'main') {
  const m = DATA.mascots[key];
  return m ? PETS[fileOf(m, pose)] || '' : '';
}

// data-pet — щоб фото, яке докачалось пізніше, вставилось у вже намальовані картки
export function mascotImg(key, pose = 'main') {
  const m = DATA.mascots[key];
  if (!m) return '';
  const file = fileOf(m, pose);
  return `<img src="${PETS[file] || ''}" data-pet="${file}" alt="${m.name}" width="160" height="160" style="--tilt:${m.tilt}deg" decoding="async">`;
}

const allFiles = () => [...new Set(Object.values(DATA.mascots).flatMap((m) => Object.values(m.poses)))];

async function loadOne(f) {
  if (PETS[f]) return;
  try {
    // Версія фото (час заливки) з boot: та сама версія — береться з телефона, без мережі
    PETS[f] = await imageUrl(f, DATA.imgs?.[f]);
    document.querySelectorAll(`img[data-pet="${CSS.escape(f)}"]`).forEach((img) => { img.src = PETS[f]; });
  } catch { /* без фото лишиться рамка — не причина не відкрити застосунок */ }
}

// Перший екран: усе, що вже є в кеші телефона (мить, без мережі), і головні пози з мережі;
// решту докачує rest() у фоні після показу
export async function loadPets() {
  await Promise.all(allFiles().map(async (f) => { PETS[f] ||= await cachedImageUrl(f, DATA.imgs?.[f]) || ''; }));
  const main = [...new Set(Object.values(DATA.mascots).map((m) => fileOf(m, 'main')))];
  await Promise.all(main.map(loadOne));
  return async () => {
    await Promise.all(allFiles().map(loadOne));
    dropStaleImages(allFiles().map((f) => [f, DATA.imgs?.[f]]));
  };
}
