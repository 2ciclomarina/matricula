/* Service worker · Fichas de Matrícula
   - Permite instalar la página como aplicación.
   - Guarda solo index.html e íconos (para abrir más rápido y mostrar un aviso sin internet).
   - NO guarda datos de estudiantes: las llamadas al servidor (Apps Script) nunca se cachean. */
var VERSION = 'matricula-v1';
var BASICOS = ['./', 'icono-192.png', 'icono-512.png', 'insignia.jpg'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(BASICOS); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin) return;           // solo archivos de esta misma página
  if (r.mode === 'navigate') {                                                   // la página: siempre la más nueva; sin internet, la guardada
    e.respondWith(fetch(r).then(function (res) { var c = res.clone(); caches.open(VERSION).then(function (ca) { ca.put('./', c); }); return res; })
      .catch(function () { return caches.match('./'); }));
    return;
  }
  e.respondWith(caches.match(r).then(function (hit) {                            // íconos e imágenes: de la caché y se actualizan en segundo plano
    var red = fetch(r).then(function (res) { if (res && res.ok) { var c = res.clone(); caches.open(VERSION).then(function (ca) { ca.put(r, c); }); } return res; }).catch(function () { return hit; });
    return hit || red;
  }));
});