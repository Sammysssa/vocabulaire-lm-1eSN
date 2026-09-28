/* Service worker : rend l'app disponible hors connexion.
   - Pages, scripts, styles et vocabulaire : réseau d'abord (les mises à jour arrivent tout de suite),
     copie en cache en secours si le réseau ne répond pas.
   - Audio, polices et icônes : cache d'abord (ces fichiers ne changent pas).
   Pense à augmenter VERSION si tu supprimes ou renommes des fichiers. */
const VERSION = 'v1';
const SHELL = 'vocab-shell-' + VERSION;
const STATIC = 'vocab-static-' + VERSION;
const SHELL_FILES = [
  './', './index.html', './style.css', './app.js', './words.json', './manifest.webmanifest',
  './fonts/fonts.css', './icons/icon-192.png', './icons/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('vocab-') && k !== SHELL && k !== STATIC).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStatic(url){ return /\/(audio|fonts|icons)\//.test(url.pathname); }

async function cacheFirst(request){
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok){ const c = await caches.open(STATIC); c.put(request, response.clone()); }
  return response;
}

async function networkFirst(request){
  const cache = await caches.open(SHELL);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
    ]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate'){ const index = await cache.match('./index.html'); if (index) return index; }
    throw e;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return; // lecture audio en streaming : laisser passer au réseau
  event.respondWith(isStatic(url) ? cacheFirst(request) : networkFirst(request));
});
