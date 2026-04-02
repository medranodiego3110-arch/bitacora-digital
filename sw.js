/**
 * sw.js - Service Worker para Bitácora Digital Construrike
 * Estrategia: Cache First para assets, Network First para datos
 */

const CACHE_NAME = 'bitacora-v2';

// Assets estáticos a cachear en instalación
// Rutas relativas al scope del SW (compatibles con sub-path de GitHub Pages)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './styles.css',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// ─── INSTALL: Cachear assets estáticos ───
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando assets estáticos');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[SW] Assets cacheados correctamente');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Error cacheando assets:', err);
      })
  );
});

// ─── ACTIVATE: Limpiar caches anteriores ───
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Eliminando cache antiguo:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activado');
        return self.clients.claim();
      })
  );
});

// ─── FETCH: Interceptar requests ───
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // No cachear requests POST (sync de datos)
  if (event.request.method !== 'GET') {
    return;
  }

  // Para requests de datos/API: Network First
  if (url.pathname.startsWith('/api') || url.hostname !== location.hostname) {
    // Si es CDN (Tailwind, jsPDF): Cache First porque son estáticos
    if (url.hostname.includes('cdn') || url.hostname.includes('cdnjs')) {
      event.respondWith(cacheFirst(event.request));
      return;
    }
    // Otros externos: Network First
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Assets locales: Cache First
  event.respondWith(cacheFirst(event.request));
});

// ─── Estrategia Cache First ───
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.warn('[SW] Cache First falló para:', request.url);
    // Fallback al index para navegación SPA
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ─── Estrategia Network First ───
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.warn('[SW] Network First fallback a cache para:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ─── Background Sync (si el navegador lo soporta) ───
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-records') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_REQUESTED' });
        });
      })
    );
  }
});

// ─── Mensaje desde la app ───
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
