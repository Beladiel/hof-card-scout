// Idea Atlas service worker v1.2. Always prefer fresh HTML and idea catalog.
const CACHE='idea-atlas-offline-v4';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg','./apple-touch-icon.png','./catalog.js','./code-lab.js','./cloud-sync.js'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('idea-atlas-offline-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{
  try {
   const fresh=await fetch(req,{cache:'no-store'});
   if(!fresh.ok)throw new Error('HTTP '+fresh.status);
   const copy=fresh.clone();
   caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
   return fresh;
  }catch(err){
   const c=await caches.match(req);
   if(c)return c;
   if(req.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
   return Response.error();
  }
 })());
});
