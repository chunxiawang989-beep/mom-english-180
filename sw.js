const PREFIX='mom-english-standalone-';
const CACHE=PREFIX+'v6.0';
const ASSETS=['./','./index.html','./content.js?v=5.0','./audio-map.js?v=6.0','./app.js?v=6.0','./speech_us.mp3?v=6.0','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request).then(resp=>{
        const copy=resp.clone();
        caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
        return resp;
      }).catch(()=>caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request).then(resp=>{
      if(resp && resp.status===200){
        const copy=resp.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return resp;
    }))
  );
});
