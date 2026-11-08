/* Encore local-first app shell. Network first for releases; cache provides offline fallback. */
const CACHE="encore-shell-v7";
const ASSETS=["./","./index.html","./styles.css?v=7","./app.js?v=7","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("encore-shell-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting();});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.includes("/concert-vault/"))return;
 // Cache bust refreshes HTML, JS and CSS without touching the local concert library.
 const isPage=request.mode==="navigate", isCode=/\.(?:js|css)$/.test(url.pathname);
 if(isPage||isCode){
  event.respondWith(fetch(request,{cache:"no-store"}).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(isPage?"./index.html":request,copy)).catch(()=>{});}
   return response;
  }).catch(async()=>{
   const cached=await caches.match(isPage?"./index.html":request);
   return cached||Response.error();
  }));
  return;
 }
 event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{
  if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});}
  return response;
 })));
});
