// Service worker: guarda la web, los datos y las imágenes para que funcione sin internet.
// VERSION la pone el build (vite.config.ts) con un hash de los datos y la web: si algo cambia, los móviles descargan lo nuevo.
const VERSION = '__BUILD_VERSION__';
// Los nombres de caché siguen siendo los del nombre antiguo (TriDex): son internos y no se ven.
const CORE = `tridex-core-${VERSION}`;
const IMAGES = 'tridex-images';
const MAX_IMAGES = 2500;

const DATA = ['meta', 'species', 'pokemon', 'evolutions', 'abilities', 'moves', 'items', 'learnsets', 'search']
  .map(name => `./data/${name}.json`);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE);
    await cache.addAll(['./', './manifest.webmanifest', './icon.svg', ...DATA]);
    // Los archivos de Vite tienen un hash en el nombre: los sacamos del index.html
    const html = await (await fetch('./', { cache: 'no-store' })).text();
    const assets = [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)].map(m => './' + m[1]);
    await cache.addAll(assets);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('tridex-core-') && key !== CORE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function trimImages() {
  const cache = await caches.open(IMAGES);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_IMAGES; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Sprites, ilustraciones y gritos de GitHub: primero caché
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGES);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.status === 200 && res.type !== 'opaque') {
        cache.put(req, res.clone());
        if (Math.random() < 0.05) trimImages();
      }
      return res;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Páginas: primero red (para tener la última versión), si no hay internet la de la caché
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => (await caches.match('./')) ?? Response.error()));
    return;
  }

  // Datos y archivos de la web: caché y se actualiza por detrás
  event.respondWith((async () => {
    const cache = await caches.open(CORE);
    const hit = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit ?? network;
  })());
});
