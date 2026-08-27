from pathlib import Path

# Make iPhone notification taps visibly open/focus the relevant Scout section.
p=Path('scout-push-sw.js')
s=p.read_text(encoding='utf-8')
old=s
s=s.replace('const CONFIG_URL=new URL("__scout_push_config__",self.registration.scope).href;','const CONFIG_URL=new URL("__scout_push_config__",self.registration.scope).href;\nself.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));\nself.addEventListener("activate",event=>event.waitUntil(clients.claim()));',1)
old_push='self.addEventListener("push",event=>{event.waitUntil((async()=>{let title="HOF Card Scout",body="Scout completed an automated marketplace search. Open the app for details.",id=String(Date.now());try{const cfg=await readConfig();if(cfg?.endpoint&&cfg?.token){const res=await fetch(cfg.endpoint+"/push/latest?token="+encodeURIComponent(cfg.token));const data=await res.json().catch(()=>({}));if(res.ok&&data.ok){title=data.title||title;body=data.body||body;id=data.id||id;}}}catch{}const target=new URL("./?automation=1",self.registration.scope).href;await self.registration.showNotification(title,{body,icon:new URL("icon-180.png",self.registration.scope).href,badge:new URL("icon-180.png",self.registration.scope).href,tag:"scout-automation-"+id,data:{url:target}});})());});'
new_push='self.addEventListener("push",event=>{event.waitUntil((async()=>{let title="HOF Card Scout",body="Scout completed an automated marketplace search. Open the app for details.",id=String(Date.now());try{const cfg=await readConfig();if(cfg?.endpoint&&cfg?.token){const res=await fetch(cfg.endpoint+"/push/latest?token="+encodeURIComponent(cfg.token));const data=await res.json().catch(()=>({}));if(res.ok&&data.ok){title=data.title||title;body=data.body||body;id=data.id||id;}}}catch{}const target=new URL("./?automation=1",self.registration.scope);target.searchParams.set("push",String(id));target.searchParams.set("notice",String(Date.now()));await self.registration.showNotification(title,{body,icon:new URL("icon-180.png",self.registration.scope).href,badge:new URL("icon-180.png",self.registration.scope).href,tag:"scout-automation-"+id,data:{url:target.href,pushId:String(id)}});})());});'
assert old_push in s
s=s.replace(old_push,new_push,1)
old_click='self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil((async()=>{const target=event.notification.data?.url||new URL("./?automation=1",self.registration.scope).href;const rows=await clients.matchAll({type:"window",includeUncontrolled:true});for(const client of rows){if(client.url.startsWith(self.registration.scope)){try{await client.navigate(target);}catch{}client.postMessage({type:"OPEN_AUTOMATION"});return client.focus();}}return clients.openWindow(target);})());});'
new_click='self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil((async()=>{const pushId=String(event.notification.data?.pushId||"");const target=event.notification.data?.url||new URL("./?automation=1",self.registration.scope).href;const rows=await clients.matchAll({type:"window",includeUncontrolled:true});for(const client of rows){if(!client.url.startsWith(self.registration.scope))continue;if(client.visibilityState==="visible"){client.postMessage({type:"OPEN_AUTOMATION",pushId});return client.focus();}try{const navigated=await client.navigate(target);return navigated?await navigated.focus():await client.focus();}catch{client.postMessage({type:"OPEN_AUTOMATION",pushId});return client.focus();}}return clients.openWindow(target);})());});'
assert old_click in s
s=s.replace(old_click,new_click,1)
assert s!=old
p.write_text(s,encoding='utf-8')

p=Path('push-notifications.js')
u=p.read_text(encoding='utf-8')
old=u
u=u.replace('async function refresh(){const enable=document.getElementById("pushEnableBtn"),test=document.getElementById("pushTestBtn"),disable=document.getElementById("pushDisableBtn");if(!enable)return;if(!supported()){','async function refresh(){const enable=document.getElementById("pushEnableBtn"),test=document.getElementById("pushTestBtn"),disable=document.getElementById("pushDisableBtn");if(!enable)return;if(!supported()){',1)
# Force update checks for an already-registered iPhone Home Screen app.
u=u.replace('enable.disabled=true;test.disabled=true;disable.disabled=true;return;}const sub=await currentSubscription();','enable.disabled=true;test.disabled=true;disable.disabled=true;return;}try{await registration();}catch{}const sub=await currentSubscription();',1)
old_styles='function styles(){if(document.getElementById("pushNotificationStyles"))return;const style=document.createElement("style");style.id="pushNotificationStyles";style.textContent=`.push-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.push-actions .wide{grid-column:1/-1}@media(max-width:620px){.push-actions{grid-template-columns:1fr}.push-actions .wide{grid-column:auto}}`;document.head.appendChild(style);}'
new_styles='function styles(){if(document.getElementById("pushNotificationStyles"))return;const style=document.createElement("style");style.id="pushNotificationStyles";style.textContent=`.push-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.push-actions .wide{grid-column:1/-1}.scout-push-opened{outline:3px solid var(--gold);outline-offset:4px;box-shadow:0 0 0 7px rgba(230,189,99,.12)}@media(max-width:620px){.push-actions{grid-template-columns:1fr}.push-actions .wide{grid-column:auto}}`;document.head.appendChild(style);}'
assert old_styles in u
u=u.replace(old_styles,new_styles,1)
old_open='function openAutomationFromUrl(){const url=new URL(location.href);if(url.searchParams.get("automation")!=="1")return;setTimeout(()=>document.getElementById("automationBtn")?.click(),350);url.searchParams.delete("automation");history.replaceState({},"",url.pathname+url.search+url.hash);}'
new_open='function markOpened(pushId){const test=String(pushId||"")==="ready";const target=test?document.getElementById("pushNotificationCard"):document.getElementById("automationActivity");if(test)setStatus("✓ Notification opened successfully. Real automated-search recaps will open at Automation Activity.","ok");if(!target)return;target.scrollIntoView({behavior:"smooth",block:"center"});target.classList.add("scout-push-opened");setTimeout(()=>target.classList.remove("scout-push-opened"),2600);}\n  function openFromPush(pushId=""){document.getElementById("automationBtn")?.click();setTimeout(()=>markOpened(pushId),500);}\n  function openAutomationFromUrl(){const url=new URL(location.href);if(url.searchParams.get("automation")!=="1")return;const pushId=url.searchParams.get("push")||"";setTimeout(()=>openFromPush(pushId),350);url.searchParams.delete("automation");url.searchParams.delete("push");url.searchParams.delete("notice");history.replaceState({},"",url.pathname+url.search+url.hash);}'
assert old_open in u
u=u.replace(old_open,new_open,1)
old_msg='navigator.serviceWorker?.addEventListener("message",event=>{if(event.data?.type==="OPEN_AUTOMATION")document.getElementById("automationBtn")?.click();});'
new_msg='navigator.serviceWorker?.addEventListener("message",event=>{if(event.data?.type==="OPEN_AUTOMATION")openFromPush(event.data?.pushId||"");});'
assert old_msg in u
u=u.replace(old_msg,new_msg,1)
assert u!=old
p.write_text(u,encoding='utf-8')

p=Path('tests/push-notifications.test.cjs')
t=p.read_text(encoding='utf-8')
needle="assert.match(sw,/\\/push\\/latest\\?token=/);"
assert needle in t
t=t.replace(needle,needle+"\nassert.match(sw,/skipWaiting\\(\\)/,'updated push click handler activates immediately');\nassert.match(sw,/searchParams\\.set\\(\"push\"/,'each notification carries a deep-link id');\nassert.match(sw,/visibilityState===\"visible\"/,'foreground PWA taps use visible feedback instead of a silent no-op');\nassert.match(ui,/markOpened\\(pushId\\)/,'notification tap gives visible in-app feedback');\nassert.match(ui,/scrollIntoView/,'notification tap scrolls to the relevant activity area');",1)
p.write_text(t,encoding='utf-8')
