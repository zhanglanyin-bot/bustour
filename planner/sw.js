/* 慢巴 BusSlow · Service Worker
   策略：应用文件联网优先、离线兜底（保证更新即时可见）；地图瓦片缓存优先（越用越离线） */
var SHELL_CACHE = 'manba-shell-v4';
var TILE_CACHE = 'manba-tiles-v1';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/leaflet.css',
  './vendor/leaflet.min.js',
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

  // 同源应用文件：联网优先，失败回退缓存（离线可用 + 更新即时）
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request).then(function(res){
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(SHELL_CACHE).then(function(c){ c.put(e.request, copy); });
        }
        return res;
      }).catch(function(){
        return caches.match(e.request).then(function(hit){
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }
});
