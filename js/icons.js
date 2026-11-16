// Улюбленці-листоноші: імена, пози й фото приходять із сервера
import { DATA } from './data.js';
import { imageUrl } from './api.js';

// Імʼя файлу пози → blob-URL; фото тягнемо з ключем, бо <img src> його не передасть
const PETS = {};

export const petName = (key) => DATA.mascots[key]?.name || '';

// Хто за що відповідає: roles у записі улюбленця (memes, box, push)
export const petFor = (role) => Object.keys(DATA.mascots).find((k) => DATA.mascots[k].roles?.includes(role))
  || Object.keys(DATA.mascots)[0];

export function mascotImg(key, pose = 'main') {
  const m = DATA.mascots[key];
  if (!m) return '';
  const file = m.poses[pose] || m.poses.main;
  return `<img src="${PETS[file] || ''}" alt="${m.name}" width="160" height="160" style="--tilt:${m.tilt}deg" decoding="async">`;
}

export async function loadPets() {
  const files = [...new Set(Object.values(DATA.mascots).flatMap((m) => Object.values(m.poses)))];
  await Promise.all(files.map(async (f) => {
    try {
      PETS[f] = await imageUrl(f);
    } catch { /* без фото лишиться рамка — не причина не відкрити застосунок */ }
  }));
}
