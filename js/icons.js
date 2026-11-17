// Улюбленці-листоноші: імена, пози й фото приходять із сервера
import { DATA } from './data.js';
import { imageUrl, cachedImageUrl, dropStaleImages } from './api.js';

// Імʼя файлу пози → blob-URL; фото тягнемо з ключем, бо <img src> його не передасть
const PETS = {};

export const petName = (key) => DATA.mascots[key]?.name || '';

// Хто за що відповідає: roles у записі улюбленця (memes, box, push)
export const petFor = (role) => Object.keys(DATA.mascots).find((k) => DATA.mascots[k].roles?.includes(role))
  || Object.keys(DATA.mascots)[0];

// blob-URL фото пози — для canvas у конструкторі мемчиків
export function petSrc(key, pose = 'main') {
  const m = DATA.mascots[key];
  return m ? PETS[m.poses[pose] || m.poses.main] || '' : '';
}

// data-pet — щоб фото, яке докачалось пізніше, вставилось у вже намальовані картки
export function mascotImg(key, pose = 'main') {
  const m = DATA.mascots[key];
  if (!m) return '';
  const file = m.poses[pose] || m.poses.main;
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
  const main = [...new Set(Object.values(DATA.mascots).map((m) => m.poses.main))];
  await Promise.all(main.map(loadOne));
  return async () => {
    await Promise.all(allFiles().map(loadOne));
    dropStaleImages(allFiles().map((f) => [f, DATA.imgs?.[f]]));
  };
}
