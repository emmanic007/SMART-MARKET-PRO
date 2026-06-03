/* ═══════════════════════════════════════════════════════
   Smart Market Pro v7.7 — Service Worker
   Rôle : cache hors ligne + mises à jour automatiques
   ═══════════════════════════════════════════════════════ */

const CACHE_NAME    = 'smp-v77';
const OFFLINE_PAGE  = './';

// Fichiers à mettre en cache au premier lancement
const PRECACHE = [
  './',
  './index.html',
];

// ── Installation : mise en cache initiale ──
self.addEventListener('install', function(event) {
  self.skipWaiting(); // Activer immédiatement sans attendre
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(PRECACHE).catch(function() {
          // Si le précache échoue (ex: hors ligne), on continue quand même
          return Promise.resolve();
        });
      })
  );
});

// ── Activation : nettoyer les anciens caches ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function(name) { return name !== CACHE_NAME; })
            .map(function(name) { return caches.delete(name); })
        );
      })
      .then(function() {
        // Prendre le contrôle de tous les onglets immédiatement
        return self.clients.claim();
      })
  );
});

// ── Fetch : stratégie Network First avec fallback cache ──
self.addEventListener('fetch', function(event) {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Ignorer les requêtes vers d'autres domaines (Supabase, CDN...)
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    // Essayer le réseau en premier
    fetch(event.request)
      .then(function(networkResponse) {
        // Si la réponse est valide, la mettre en cache
        if (networkResponse && networkResponse.status === 200) {
          var responseClone = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseClone);
            });
        }
        return networkResponse;
      })
      .catch(function() {
        // Réseau indisponible → utiliser le cache
        return caches.match(event.request)
          .then(function(cachedResponse) {
            if (cachedResponse) return cachedResponse;
            // Dernier recours : page principale depuis le cache
            return caches.match(OFFLINE_PAGE);
          });
      })
  );
});

// ── Message : forcer la mise à jour ──
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
