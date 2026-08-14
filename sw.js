const PREFIX='mom-english-standalone-';
const CACHE=PREFIX+'v13.0';
const ASSETS=['./','./index.html','./daily180.js?v=10.0','./audio-map.js?v=13.0','./app.js?v=13.0','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

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
  const url=new URL(event.request.url);
  if(url.pathname.indexOf('/audio/')>=0 || url.pathname.endsWith('/speech_us.mp3')){
    return; // Let browser/network handle the full audio file directly; no SW caching/range interference.
  }
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
