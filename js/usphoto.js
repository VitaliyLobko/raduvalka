// «Наше фото» для реакції 🌌: одне на пару. На сервері — лише шифротекст (RAD1), у кеші телефону — він же;
// розшифроване — тільки в памʼяті (blob:), щоб анімація брала його одразу, без мережі. Вікно вибору — usphoto-edit.js
import { API, getKey } from './api.js';
import { hasSecret, sealFile, openBlob } from './seal.js';
import { DATA } from './data.js';

const CACHE = 'us-radovalka';
const KEY = 'us-photo';
const AT = 'radovalka:us-at';
let url = null;

export const usPhoto = () => url;

export function setUsPhoto(blob) {
  if (url) URL.revokeObjectURL(url);
  url = blob ? URL.createObjectURL(blob) : null;
}

const MAGIC = [0x52, 0x41, 0x44, 0x31];
const sealed = async (blob) => {
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  return MAGIC.every((b, i) => head[i] === b);
};
const savedAt = () => { try { return Number(localStorage.getItem(AT)) || 0; } catch { return 0; } };
function saveAt(at) {
  try {
    if (at) localStorage.setItem(AT, String(at));
    else localStorage.removeItem(AT);
  } catch { /* приватне вікно */ }
}
async function fromCache() {
  try { return (await (await caches.open(CACHE)).match(KEY))?.blob() || null; } catch { return null; }
}
async function toCache(blob) {
  try { await (await caches.open(CACHE)).put(KEY, new Response(blob)); } catch { /* немає Cache API */ }
}
const dropCache = () => (self.caches ? caches.delete(CACHE).catch(() => {}) : Promise.resolve());

async function show(blob) {
  const plain = await openBlob(blob);
  // Ключа нема чи не той — openBlob віддає той самий шифротекст: такого не показуємо, лишається галактика
  if (await sealed(plain)) return;
  setUsPhoto(new Blob([plain], { type: 'image/jpeg' }));
}

// Після boot: at — час заливки (null — не вибрали). Та сама версія — з кешу телефону, нова — з мережі
export async function syncUsPhoto(at = DATA.us) {
  try {
    if (!at) {
      setUsPhoto(null);
      saveAt(0);
      await dropCache();
      return;
    }
    let blob = savedAt() === at ? await fromCache() : null;
    if (!blob) {
      const res = await fetch(`${API}/api/us-photo`, { headers: { authorization: `Bearer ${getKey()}` }, cache: 'no-store' });
      if (!res.ok) return;
      blob = await res.blob();
      await toCache(blob);
      saveAt(at);
    }
    await show(blob);
  } catch { /* без мережі — лишається галактика */ }
}

async function call(method, body) {
  const res = await fetch(`${API}/api/us-photo`, {
    method, body, headers: { authorization: `Bearer ${getKey()}`, ...(body ? { 'content-type': 'application/octet-stream' } : {}) },
  });
  if (!res.ok) throw Object.assign(new Error(`api ${res.status}`), { status: res.status });
  return res.json();
}

// jpeg — уже вирізане коло (квадрат 512): шифруємо ключем пари; без ключа не відправляємо зовсім
export async function saveUsPhoto(jpeg) {
  if (!hasSecret()) throw Object.assign(new Error('secret'), { code: 'secret' });
  const body = await sealFile(jpeg);
  if (!(await sealed(body))) throw Object.assign(new Error('secret'), { code: 'secret' });
  const { at } = await call('PUT', body);
  await toCache(body);
  saveAt(at);
  DATA.us = at;
  setUsPhoto(jpeg);
}

export async function removeUsPhoto() {
  await call('DELETE');
  DATA.us = null;
  await syncUsPhoto(null);
}
