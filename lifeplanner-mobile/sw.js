const CACHE="lifeplanner-mobile-shell-v3";
const ASSETS=["./","./index.html","./app.js?v=2","./cloud-sync.js?v=4","./styles.css?v=2","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("lifeplanner-mobile-shell-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 const url=new URL(e.request.url);
 if(url.origin!==self.location.origin||!url.pathname.includes("/lifeplanner-mobile/"))return;
 if(e.request.mode==="navigate"){e.respondWith(fetch(e.request).then(response=>{if(response.ok){const c=response.clone();caches.open(CACHE).then(cache=>cache.put("./index.html",c)).catch(()=>{});}return response;}).catch(()=>caches.match("./index.html")));return;}
 e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(response=>{if(response.ok){const c=response.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c)).catch(()=>{});}return response;})));
});