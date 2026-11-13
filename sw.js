/* 盘库 APP — 离线缓存（网络优先，断网用缓存） */
const CACHE = 'panku-v16';
const ASSETS = [
  './', './index.html', './app.css?v=26', './manifest.webmanifest',
  './js/core.js?v=26', './js/import.js?v=26', './js/scan.js?v=26', './js/views.js?v=26', './js/export.js?v=26', './js/merge.js?v=26', './js/main.js?v=26',
  './lib/xlsx.full.min.js', './lib/JsBarcode.all.min.js', './lib/zxing.min.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (u) {
      return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
