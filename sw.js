/* Service worker · Fichas de Matrícula
   - Permite instalar la página como aplicación.
   - Guarda solo index.html e íconos: la página abre al instante desde el teléfono o computador y se actualiza en segundo plano.
   - Si hay una versión nueva, avisa a la página para ofrecer «Actualizar».
   - NO guarda datos de estudiantes: las llamadas al servidor (Apps Script) nunca se cachean. */
var VERSION = 'matricula-v2';
var BASICOS = ['./', 'icono-192.png', 'icono-512.png', 'insignia.jpg'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(BASICOS); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
function avisar(msg) { self.clients.matchAll().then(function (cs) { cs.forEach(function (c) { c.postMessage(msg); }); }); }
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin) return;           // solo archivos de esta misma página
  if (r.mode === 'navigate') {                                                   // la página: se muestra al instante la guardada y se actualiza por detrás
    e.respondWith(caches.open(VERSION).then(function (ca) {
      return ca.match('./').then(function (hit) {
        var red = fetch(r, { cache: 'no-cache' }).then(function (res) {
          if (res && res.ok) {
            var firma = (res.headers.get('etag') || '') + '|' + (res.headers.get('last-modified') || '') + '|' + (res.headers.get('content-length') || '');
            var antes = hit ? (hit.headers.get('etag') || '') + '|' + (hit.headers.get('last-modified') || '') + '|' + (hit.headers.get('content-length') || '') : '';
            ca.put('./', res.clone());
            if (hit && firma !== antes) avisar({ tipo: 'nueva-version' });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || red;
      });
    }));
    return;
  }
  e.respondWith(caches.match(r).then(function (hit) {                            // íconos e imágenes: de la caché y se actualizan en segundo plano
    var red = fetch(r).then(function (res) { if (res && res.ok) { var c = res.clone(); caches.open(VERSION).then(function (ca) { ca.put(r, c); }); } return res; }).catch(function () { return hit; });
    return hit || red;
  }));
});