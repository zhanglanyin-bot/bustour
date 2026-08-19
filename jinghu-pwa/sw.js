/* 京沪公交慢行手册 · Service Worker
   应用外壳（页面/样式/脚本/图标）：首次访问即预缓存，之后离线可用。
   地图底图瓦片：浏览即缓存（看过一遍的区域，断网也能再看）。
   更新缓存时请把 SHELL_CACHE 的版本号 v1 递增，旧缓存会在激活时自动清理。 */
var SHELL_CACHE = 'jinghu-shell-v1';
var TILE_CACHE = 'jinghu-tiles-v1';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/leaflet.css',
  './vendor/leaflet.min.js',
  './vendor/images/layers.png',
  './vendor/images/layers-2x.png',
  './vendor/images/marker-icon.png',
  './vendor/images/marker-shadow.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function(c){ return c.addAll(SHELL); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){
        return k !== SHELL_CACHE && k !== TILE_CACHE;
      }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  var isTile = url.hostname.indexOf('autonavi.com') !== -1 ||
               url.hostname.indexOf('openstreetmap.org') !== -1;

  // 地图瓦片：缓存优先，未缓存的走网络并存入缓存
  if (isTile) {
    e.respondWith(
      caches.open(TILE_CACHE).then(function(cache){
        return cache.match(e.request).then(function(hit){
          if (hit) return hit;
          return fetch(e.request).then(function(res){
            if (res && res.ok) {
              cache.put(e.request, res.clone());
              cache.keys().then(function(keys){
                if (keys.length > 1500) { cache.delete(keys[0]); }
              });
            }
            return res;
          });
        });
      }).catch(function(){ return new Response('', {status:404}); })
    );
    return;
  }

  // 应用外壳：缓存优先，同源新资源自动入缓存
  e.respondWith(
    caches.match(e.request).then(function(hit){
      if (hit) return hit;
      return fetch(e.request).then(function(res){
        if (res && res.ok && url.origin === self.location.origin) {
          var copy = res.clone();
          caches.open(SHELL_CACHE).then(function(c){ c.put(e.request, copy); });
        }
        return res;
      });
    }).catch(function(){ return caches.match('./index.html'); })
  );
});
