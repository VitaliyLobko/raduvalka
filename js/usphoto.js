// Альбоми фото для реакцій: us — «Наши фото» (🌌, додають обоє), her — її фото (🍓, додає лише він). До LIMIT у кожному.
// На сервері й у кеші телефону — лише шифротекст (RAD1); розшифроване — тільки в памʼяті (blob:), щоб анімація брала
// фото одразу, без мережі. Вікно альбому — usphoto-edit.js
import { API, getKey } from './api.js';
import { hasSecret, sealFile, openBlob } from './seal.js';
import { DATA } from './data.js';

export const LIMIT = 10;
const CACHE = 'us-radovalka';
const MAGIC = [0x52, 0x41, 0x44, 0x31];
const sealed = async (blob) => {
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  return MAGIC.every((b, i) => head[i] === b);
};
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* приватне вікно */ } },
};
const openCache = () => (self.caches ? caches.open(CACHE).catch(() => null) : Promise.resolve(null));
const err = (code, status) => Object.assign(new Error(code), { code, status });

async function api(path, method = 'GET', body) {
  const res = await fetch(`${API}/api/${path}`, {
    method, body, cache: 'no-store',
    headers: { authorization: `Bearer ${getKey()}`, ...(body ? { 'content-type': 'application/octet-stream' } : {}) },
  });
  if (!res.ok) throw err(res.status === 409 ? 'limit' : 'api', res.status);
  return res;
}

function makeAlbum(name) {
  const AT = `radovalka:${name}-at`;
  const IDS = `radovalka:${name}-ids`;
  const ck = (id) => `${name}-${id}`;
  const urls = new Map();
  let last = null;
  let next = null;
  let busy = Promise.resolve();

  const put = (id, blob) => { if (urls.has(id)) URL.revokeObjectURL(urls.get(id)); urls.set(id, URL.createObjectURL(blob)); };
  const drop = (id) => { if (urls.has(id)) URL.revokeObjectURL(urls.get(id)); urls.delete(id); };
  const mark = (at, ids) => { ls.set(AT, at ? String(at) : null); ls.set(IDS, at ? JSON.stringify(ids) : null); DATA[name] = at || null; };

  async function show(id, blob) {
    const plain = await openBlob(blob);
    // Ключа нема чи не той — openBlob віддає той самий шифротекст: такого не показуємо
    if (await sealed(plain)) return;
    put(id, new Blob([plain], { type: 'image/jpeg' }));
  }

  // at — час останньої зміни альбому (null — порожній). Та сама версія — список і фото з телефону, нова — з мережі
  async function run(at) {
    try {
      const c = await openCache();
      let ids = null;
      if (at && Number(ls.get(AT)) === at) { try { ids = JSON.parse(ls.get(IDS) || 'null'); } catch { ids = null; } }
      if (!at) ids = [];
      if (!Array.isArray(ids)) ids = (await (await api(`${name}-photos`)).json()).list.map((x) => x.id);
      for (const id of ids) {
        if (urls.has(id)) continue;
        let blob = c ? await c.match(ck(id)).then((r) => r?.blob() || null) : null;
        if (!blob) {
          try { blob = await (await api(`${name}-photos/${id}`)).blob(); } catch { continue; }
          await c?.put(ck(id), new Response(blob)).catch(() => {});
        }
        await show(id, blob);
      }
      for (const id of [...urls.keys()]) if (!ids.includes(id)) drop(id);
      // Прибрані на іншому телефоні (і старий ключ us-photo з 0.4.116) — геть із кешу
      if (c) {
        for (const req of await c.keys()) {
          const k = new URL(req.url).pathname.split('/').pop();
          if (k.startsWith(`${name}-`) && !ids.includes(k.slice(name.length + 1))) await c.delete(req);
        }
      }
      mark(at, ids);
    } catch { /* без мережі — лишається те, що вже є */ }
  }

  return {
    size: () => urls.size,
    list: () => [...urls].map(([id, url]) => ({ id, url })),
    // Випадкове, але не те саме, що минулого разу; щойно додане — першим
    pick() {
      if (!urls.size) return null;
      let id = next && urls.has(next) ? next : null;
      next = null;
      if (!id) {
        const ids = [...urls.keys()];
        const pool = ids.length > 1 ? ids.filter((x) => x !== last) : ids;
        id = pool[Math.floor(Math.random() * pool.length)];
      }
      last = id;
      return urls.get(id);
    },
    sync(at = DATA[name]) { busy = busy.then(() => run(at)); return busy; },
    // jpeg — уже вирізаний квадрат 512: шифруємо ключем пари; без ключа не відправляємо зовсім
    async add(jpeg) {
      if (!hasSecret()) throw err('secret');
      if (urls.size >= LIMIT) throw err('limit');
      const body = await sealFile(jpeg);
      if (!(await sealed(body))) throw err('secret');
      const { at, list } = await (await api(`${name}-photos`, 'POST', body)).json();
      const id = list[list.length - 1].id;
      await (await openCache())?.put(ck(id), new Response(body)).catch(() => {});
      put(id, jpeg);
      next = id;
      mark(at, list.map((x) => x.id));
    },
    async remove(id) {
      const { at, list } = await (await api(`${name}-photos/${id}`, 'DELETE')).json();
      drop(id);
      await (await openCache())?.delete(ck(id)).catch(() => {});
      mark(at, list.map((x) => x.id));
    },
    // Для тестів: підставити фото без сервера
    set(...blobs) { for (const id of [...urls.keys()]) drop(id); blobs.filter(Boolean).forEach((x, i) => put(`t${i}`, x)); },
  };
}

export const US = makeAlbum('us');
export const HER = makeAlbum('her');
export const ALBUMS = { us: US, her: HER };

// Для fx.js і старих тестів
export const usPhoto = () => US.pick();
export const setUsPhoto = (blob) => US.set(blob);
export const syncUsPhoto = (at) => US.sync(at);
