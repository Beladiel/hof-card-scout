from pathlib import Path

# Worker push plumbing.
p=Path('src/index.js')
s=p.read_text(encoding='utf-8')
assert 'const VERSION = "3.33.0";' in s
s=s.replace('const VERSION = "3.33.0";','const VERSION = "3.34.0";',1)

old='''const AUTOMATION_CATALOG_KEY = "automation:catalog:v1";\nconst AUTOMATION_CATALOG_MAX_BYTES = 256 * 1024;'''
new='''const AUTOMATION_CATALOG_KEY = "automation:catalog:v1";\nconst AUTOMATION_CATALOG_MAX_BYTES = 256 * 1024;\nconst PUSH_VAPID_KEY = "push:vapid:v1";\nconst PUSH_SUBSCRIPTIONS_KEY = "push:subscriptions:v1";\nconst PUSH_MAX_SUBSCRIPTIONS = 5;'''
assert old in s
s=s.replace(old,new,1)

route_marker='''    if (url.pathname === "/psa/verify" && request.method === "POST") {'''
assert route_marker in s
routes=r'''    if (url.pathname === "/push/config" && request.method === "GET") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) return json({ ok: false, error: "cloud_storage_not_configured" }, 503, cors);
      try {
        const vapid = await pushGetOrCreateVapid(env.SCOUT_DATA);
        const subscriptions = await pushReadSubscriptions(env.SCOUT_DATA);
        return json({ ok: true, version: VERSION, publicKey: vapid.publicKey, subscriptionCount: subscriptions.length }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({ ok: false, error: "push_config_failed", message: "Scout could not prepare phone notifications." }, 502, cors);
      }
    }

    if (url.pathname === "/push/subscribe" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) return json({ ok: false, error: "cloud_storage_not_configured" }, 503, cors);
      let body = {};
      try { body = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400, cors); }
      try {
        const saved = await pushSaveSubscription(env.SCOUT_DATA, body?.deviceToken, body?.subscription);
        return json({ ok: true, version: VERSION, deviceToken: saved.deviceToken, subscriptionCount: saved.subscriptionCount }, 200, cors);
      } catch (err) {
        return json({ ok: false, error: "push_subscribe_failed", message: err?.message || "Scout could not save this phone for notifications." }, 400, cors);
      }
    }

    if (url.pathname === "/push/unsubscribe" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) return json({ ok: false, error: "cloud_storage_not_configured" }, 503, cors);
      let body = {};
      try { body = await request.json(); } catch {}
      const count = await pushRemoveSubscription(env.SCOUT_DATA, body?.deviceToken);
      return json({ ok: true, version: VERSION, subscriptionCount: count }, 200, cors);
    }

    if (url.pathname === "/push/test" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) return json({ ok: false, error: "cloud_storage_not_configured" }, 503, cors);
      let body = {};
      try { body = await request.json(); } catch {}
      try {
        const result = await pushSendTest(env, body?.deviceToken);
        return json({ ok: true, version: VERSION, ...result, searchUsed: 0 }, 200, cors);
      } catch (err) {
        return json({ ok: false, error: "push_test_failed", message: err?.message || "Scout could not send the test notification." }, 502, cors);
      }
    }

    if (url.pathname === "/push/latest" && request.method === "GET") {
      if (!env.SCOUT_DATA) return json({ ok: false, error: "cloud_storage_not_configured" }, 503, cors);
      const deviceToken = url.searchParams.get("token") || "";
      const subscriptions = await pushReadSubscriptions(env.SCOUT_DATA);
      if (!subscriptions.some(row => row.deviceToken === deviceToken)) {
        return json({ ok: false, error: "unknown_push_device" }, 401, cors);
      }
      const state = await readAutomationState(env.SCOUT_DATA);
      const latest = Array.isArray(state.activity) && state.activity.length ? state.activity[state.activity.length - 1] : null;
      const payload = pushActivityPayload(latest);
      return json({ ok: true, version: VERSION, ...payload }, 200, cors);
    }

'''
s=s.replace(route_marker,routes+route_marker,1)

helper_marker='''function automationActivityMoney(value) {'''
assert helper_marker in s
helpers=r'''function pushBase64UrlBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pushBase64UrlText(text) {
  return pushBase64UrlBytes(new TextEncoder().encode(String(text || "")));
}

async function pushGetOrCreateVapid(kv) {
  let existing = null;
  try { existing = await kv.get(PUSH_VAPID_KEY, { type: "json" }); } catch {}
  if (existing?.publicKey && existing?.privateJwk) return existing;
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const rawPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const record = { schema: 1, publicKey: pushBase64UrlBytes(rawPublic), privateJwk, publicJwk, createdAt: new Date().toISOString() };
  await kv.put(PUSH_VAPID_KEY, JSON.stringify(record));
  return record;
}

function pushNormalizeToken(value) {
  const token = String(value || "").trim();
  return /^[A-Za-z0-9_-]{20,160}$/.test(token) ? token : "";
}

function pushNormalizeSubscription(value) {
  const endpoint = String(value?.endpoint || "").trim();
  if (!endpoint || endpoint.length > 1400) throw new Error("This phone returned an invalid push endpoint.");
  let parsed;
  try { parsed = new URL(endpoint); } catch { throw new Error("This phone returned an invalid push endpoint."); }
  if (parsed.protocol !== "https:") throw new Error("Scout only accepts secure push endpoints.");
  return {
    endpoint,
    expirationTime: Number.isFinite(Number(value?.expirationTime)) ? Number(value.expirationTime) : null,
    keys: {
      p256dh: automationText(value?.keys?.p256dh, 300),
      auth: automationText(value?.keys?.auth, 200),
    },
  };
}

async function pushReadSubscriptions(kv) {
  let raw = null;
  try { raw = await kv.get(PUSH_SUBSCRIPTIONS_KEY, { type: "json" }); } catch {}
  if (!Array.isArray(raw)) return [];
  return raw.filter(row => pushNormalizeToken(row?.deviceToken) && row?.subscription?.endpoint).slice(-PUSH_MAX_SUBSCRIPTIONS);
}

async function pushWriteSubscriptions(kv, rows) {
  const safe = Array.isArray(rows) ? rows.slice(-PUSH_MAX_SUBSCRIPTIONS) : [];
  await kv.put(PUSH_SUBSCRIPTIONS_KEY, JSON.stringify(safe));
  return safe;
}

async function pushSaveSubscription(kv, tokenValue, subscriptionValue) {
  const deviceToken = pushNormalizeToken(tokenValue);
  if (!deviceToken) throw new Error("Scout could not create a secure device token.");
  const subscription = pushNormalizeSubscription(subscriptionValue);
  const now = new Date().toISOString();
  const rows = await pushReadSubscriptions(kv);
  const previous = rows.find(row => row.deviceToken === deviceToken || row.subscription?.endpoint === subscription.endpoint);
  const next = [...rows.filter(row => row.deviceToken !== deviceToken && row.subscription?.endpoint !== subscription.endpoint), {
    deviceToken,
    subscription,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  }].slice(-PUSH_MAX_SUBSCRIPTIONS);
  await pushWriteSubscriptions(kv, next);
  return { deviceToken, subscriptionCount: next.length };
}

async function pushRemoveSubscription(kv, tokenValue) {
  const deviceToken = pushNormalizeToken(tokenValue);
  const rows = await pushReadSubscriptions(kv);
  const next = deviceToken ? rows.filter(row => row.deviceToken !== deviceToken) : rows;
  if (next.length !== rows.length) await pushWriteSubscriptions(kv, next);
  return next.length;
}

async function pushVapidJwt(endpoint, vapid) {
  const aud = new URL(endpoint).origin;
  const header = pushBase64UrlText(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = pushBase64UrlText(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: "https://beladiel.github.io/hof-card-scout/" }));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey("jwk", vapid.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput)));
  return `${signingInput}.${pushBase64UrlBytes(signature)}`;
}

async function pushSendEndpoint(endpoint, vapid) {
  const jwt = await pushVapidJwt(endpoint, vapid);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "TTL": "300",
      "Urgency": "normal",
      "Authorization": `vapid t=${jwt}, k=${vapid.publicKey}`,
    },
  });
  return { ok: response.ok, status: response.status, stale: response.status === 404 || response.status === 410 };
}

function pushActivityPayload(activity) {
  if (!activity) return { id: "ready", title: "HOF Card Scout notifications are ready", body: "Future real automated searches will send a recap here.", url: "./?automation=1" };
  const player = automationText(activity.player, 120) || "Scout search";
  let title = `🔎 Scout checked ${player}`;
  if (activity.outcome === "deal-found") title = `🎯 Target deal — ${player}`;
  else if (activity.outcome === "value-updated") title = `📈 Value updated — ${player}`;
  else if (activity.outcome === "error") title = `⚠️ Scout search issue — ${player}`;
  return {
    id: automationText(activity.id, 220) || activity.at || "activity",
    title,
    body: automationText(activity.summary || "Automated search completed.", 320),
    url: "./?automation=1",
  };
}

async function pushNotifySubscribers(env, state) {
  if (!env?.SCOUT_DATA) return { sent: 0, failed: 0 };
  const rows = await pushReadSubscriptions(env.SCOUT_DATA);
  if (!rows.length) return { sent: 0, failed: 0 };
  const vapid = await pushGetOrCreateVapid(env.SCOUT_DATA);
  let sent = 0, failed = 0, changed = false;
  const keep = [];
  for (const row of rows) {
    try {
      const result = await pushSendEndpoint(row.subscription.endpoint, vapid);
      if (result.stale) { changed = true; continue; }
      if (result.ok) sent++; else failed++;
      keep.push(row);
    } catch (err) {
      console.error("Scout push send failed", err);
      failed++;
      keep.push(row);
    }
  }
  if (changed) await pushWriteSubscriptions(env.SCOUT_DATA, keep);
  return { sent, failed };
}

async function pushSendTest(env, tokenValue) {
  const deviceToken = pushNormalizeToken(tokenValue);
  if (!deviceToken) throw new Error("This phone is not registered for Scout notifications.");
  const rows = await pushReadSubscriptions(env.SCOUT_DATA);
  const row = rows.find(item => item.deviceToken === deviceToken);
  if (!row) throw new Error("This phone is not registered for Scout notifications.");
  const vapid = await pushGetOrCreateVapid(env.SCOUT_DATA);
  const result = await pushSendEndpoint(row.subscription.endpoint, vapid);
  if (result.stale) {
    await pushWriteSubscriptions(env.SCOUT_DATA, rows.filter(item => item.deviceToken !== deviceToken));
    throw new Error("This phone's old notification subscription expired. Enable notifications again.");
  }
  if (!result.ok) throw new Error(`Push service returned ${result.status}.`);
  return { sent: 1 };
}

'''
s=s.replace(helper_marker,helpers+helper_marker,1)

old='''  if (Number(targetRun.result?.searchUsed) > 0 || targetRun.result?.status === "error") {\n    state = automationRecordActivity(state, "target", targetRun.result, now, "scheduled");\n    await writeAutomationState(env.SCOUT_DATA, state);\n    return { kind: "target", ...targetRun.result };\n  }'''
new='''  if (Number(targetRun.result?.searchUsed) > 0 || targetRun.result?.status === "error") {\n    state = automationRecordActivity(state, "target", targetRun.result, now, "scheduled");\n    await writeAutomationState(env.SCOUT_DATA, state);\n    if (Number(targetRun.result?.searchUsed) > 0) {\n      try { await pushNotifySubscribers(env, state); } catch (err) { console.error("Scheduled target push failed", err); }\n    }\n    return { kind: "target", ...targetRun.result };\n  }'''
assert old in s
s=s.replace(old,new,1)

old='''  state = automationRecordActivity(state, "collection", collectionRun.result, now, "scheduled");\n  await writeAutomationState(env.SCOUT_DATA, state);\n  return { kind: "collection", ...collectionRun.result };'''
new='''  state = automationRecordActivity(state, "collection", collectionRun.result, now, "scheduled");\n  await writeAutomationState(env.SCOUT_DATA, state);\n  if (Number(collectionRun.result?.searchUsed) > 0) {\n    try { await pushNotifySubscribers(env, state); } catch (err) { console.error("Scheduled collection push failed", err); }\n  }\n  return { kind: "collection", ...collectionRun.result };'''
assert old in s
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# Browser push setup UI.
Path('push-notifications.js').write_text(r'''(function(){
  const TOKEN_KEY="scoutPushDeviceTokenV1";
  function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
  function connection(){try{return typeof pricingConfig==="function"?pricingConfig():{endpoint:"",accessKey:""}}catch{return {endpoint:"",accessKey:""}}}
  function bytesFromBase64Url(value){const s=String(value||"").replace(/-/g,"+").replace(/_/g,"/");const padded=s+"=".repeat((4-s.length%4)%4);const raw=atob(padded);return Uint8Array.from(raw,c=>c.charCodeAt(0));}
  function randomToken(){const b=new Uint8Array(24);crypto.getRandomValues(b);let raw="";b.forEach(x=>raw+=String.fromCharCode(x));return btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
  function getToken(){let token=localStorage.getItem(TOKEN_KEY)||"";if(!token){token=randomToken();localStorage.setItem(TOKEN_KEY,token);}return token;}
  function supported(){return "serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;}
  function isIos(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);}
  function standalone(){return window.navigator.standalone===true||window.matchMedia?.("(display-mode: standalone)")?.matches===true;}
  function setStatus(text,kind=""){const el=document.getElementById("pushStatus");if(!el)return;el.className="automation-runner-result "+(kind||"");el.textContent=text;}
  async function registration(){return navigator.serviceWorker.register("./scout-push-sw.js",{scope:"./"});}
  async function saveWorkerConfig(reg,endpoint,token){const worker=reg.active||reg.waiting||reg.installing;if(worker)worker.postMessage({type:"SCOUT_PUSH_CONFIG",endpoint,token});await navigator.serviceWorker.ready;const ready=await navigator.serviceWorker.getRegistration("./");const live=ready?.active||navigator.serviceWorker.controller;if(live)live.postMessage({type:"SCOUT_PUSH_CONFIG",endpoint,token});}
  async function api(path,options={}){const c=connection();if(!c.endpoint||!c.accessKey)throw new Error("Scout's live connection is not configured on this device.");const headers={...(options.headers||{}),"X-Scout-Key":c.accessKey};const res=await fetch(c.endpoint+path,{...options,headers});const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.message||data.error||("HTTP "+res.status));return data;}
  async function currentSubscription(){if(!supported())return null;try{const reg=await navigator.serviceWorker.getRegistration("./");return reg?await reg.pushManager.getSubscription():null}catch{return null;}}
  async function refresh(){const enable=document.getElementById("pushEnableBtn"),test=document.getElementById("pushTestBtn"),disable=document.getElementById("pushDisableBtn");if(!enable)return;if(!supported()){setStatus("Push notifications are not supported by this browser.","bad");enable.disabled=true;test.disabled=true;disable.disabled=true;return;}const sub=await currentSubscription();const granted=Notification.permission==="granted"&&!!sub;enable.hidden=granted;test.hidden=!granted;disable.hidden=!granted;if(granted)setStatus("✓ Phone notifications are enabled. Scout will notify you only after a real scheduled marketplace search.","ok");else if(Notification.permission==="denied")setStatus("Notifications are blocked for HOF Card Scout. Re-enable them in your device/browser notification settings.","bad");else if(isIos()&&!standalone())setStatus("On iPhone, open HOF Card Scout from its Home Screen icon before enabling notifications.");else setStatus("Notifications are off. Enabling them uses 0 SerpApi searches.");}
  async function enable(){const btn=document.getElementById("pushEnableBtn");if(btn)btn.disabled=true;try{if(!supported())throw new Error("This browser does not support web push.");if(isIos()&&!standalone())throw new Error("On iPhone, open HOF Card Scout from the Home Screen icon first.");const c=connection();if(!c.endpoint||!c.accessKey)throw new Error("Scout's live connection is not configured on this device.");const config=await api("/push/config");const permission=await Notification.requestPermission();if(permission!=="granted")throw new Error("Notification permission was not granted.");const reg=await registration();await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytesFromBase64Url(config.publicKey)});const token=getToken();await api("/push/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deviceToken:token,subscription:sub.toJSON()})});await saveWorkerConfig(reg,c.endpoint,token);setStatus("✓ Phone notifications enabled. Use the zero-search test button once to prove delivery.","ok");await refresh();}catch(err){setStatus(err.message||"Scout could not enable notifications.","bad");}finally{if(btn)btn.disabled=false;}}
  async function testPush(){const btn=document.getElementById("pushTestBtn");if(btn)btn.disabled=true;try{const reg=await navigator.serviceWorker.getRegistration("./");if(!reg)throw new Error("Notification service worker is not ready.");const c=connection(),token=getToken();await saveWorkerConfig(reg,c.endpoint,token);await api("/push/test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deviceToken:token})});setStatus("✓ Test sent — 0 SerpApi searches used. Watch for the phone notification.","ok");}catch(err){setStatus(err.message||"Scout could not send the test notification.","bad");}finally{if(btn)btn.disabled=false;}}
  async function disable(){const btn=document.getElementById("pushDisableBtn");if(btn)btn.disabled=true;try{const token=getToken(),sub=await currentSubscription();if(sub)await sub.unsubscribe();await api("/push/unsubscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deviceToken:token})});setStatus("Phone notifications are off.","ok");await refresh();}catch(err){setStatus(err.message||"Scout could not disable notifications.","bad");}finally{if(btn)btn.disabled=false;}}
  function styles(){if(document.getElementById("pushNotificationStyles"))return;const style=document.createElement("style");style.id="pushNotificationStyles";style.textContent=`.push-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.push-actions .wide{grid-column:1/-1}@media(max-width:620px){.push-actions{grid-template-columns:1fr}.push-actions .wide{grid-column:auto}}`;document.head.appendChild(style);}
  function card(){return `<div class="automation-card" id="pushNotificationCard"><div class="section-eyebrow">🔔 PHONE NOTIFICATIONS</div><div style="font-size:18px;font-weight:950;margin-top:3px">Tell me when Scout actually searched.</div><div class="automation-sub">After a real scheduled target or collection search, your phone gets a short recap: who Scout checked, whether a deal/value was found, and whether anything was updated. Zero-search wake-ups stay silent. Push delivery itself uses 0 SerpApi searches.</div><div class="push-actions"><button type="button" class="primary wide" id="pushEnableBtn">ENABLE PHONE NOTIFICATIONS</button><button type="button" class="secondary" id="pushTestBtn" hidden>SEND TEST NOTIFICATION · 0 SEARCHES</button><button type="button" class="ghost" id="pushDisableBtn" hidden>TURN OFF NOTIFICATIONS</button></div><div class="automation-runner-result" id="pushStatus">Checking notification support…</div></div>`;}
  function openAutomationFromUrl(){const url=new URL(location.href);if(url.searchParams.get("automation")!=="1")return;setTimeout(()=>document.getElementById("automationBtn")?.click(),350);url.searchParams.delete("automation");history.replaceState({},"",url.pathname+url.search+url.hash);}
  function mount(){if(document.getElementById("pushNotificationCard")){refresh();return;}const wrap=document.getElementById("automationScreen")?.querySelector(".automation-wrap");if(!wrap){setTimeout(mount,75);return;}styles();wrap.insertAdjacentHTML("beforeend",card());document.getElementById("pushEnableBtn")?.addEventListener("click",enable);document.getElementById("pushTestBtn")?.addEventListener("click",testPush);document.getElementById("pushDisableBtn")?.addEventListener("click",disable);document.getElementById("automationBtn")?.addEventListener("click",()=>setTimeout(refresh,80));refresh();openAutomationFromUrl();}
  navigator.serviceWorker?.addEventListener("message",event=>{if(event.data?.type==="OPEN_AUTOMATION")document.getElementById("automationBtn")?.click();});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})();
''',encoding='utf-8')

# Service worker: payloadless push wakes it, then it fetches the latest recap using the device token.
Path('scout-push-sw.js').write_text(r'''const CONFIG_CACHE="scout-push-config-v1";
const CONFIG_URL=new URL("__scout_push_config__",self.registration.scope).href;
async function saveConfig(value){const cache=await caches.open(CONFIG_CACHE);await cache.put(CONFIG_URL,new Response(JSON.stringify(value),{headers:{"Content-Type":"application/json"}}));}
async function readConfig(){const cache=await caches.open(CONFIG_CACHE);const res=await cache.match(CONFIG_URL);if(!res)return null;return res.json().catch(()=>null);}
self.addEventListener("message",event=>{if(event.data?.type==="SCOUT_PUSH_CONFIG"&&event.data?.endpoint&&event.data?.token)event.waitUntil(saveConfig({endpoint:String(event.data.endpoint),token:String(event.data.token)}));});
self.addEventListener("push",event=>{event.waitUntil((async()=>{let title="HOF Card Scout",body="Scout completed an automated marketplace search. Open the app for details.",id=String(Date.now());try{const cfg=await readConfig();if(cfg?.endpoint&&cfg?.token){const res=await fetch(cfg.endpoint+"/push/latest?token="+encodeURIComponent(cfg.token));const data=await res.json().catch(()=>({}));if(res.ok&&data.ok){title=data.title||title;body=data.body||body;id=data.id||id;}}}catch{}const target=new URL("./?automation=1",self.registration.scope).href;await self.registration.showNotification(title,{body,icon:new URL("icon-180.png",self.registration.scope).href,badge:new URL("icon-180.png",self.registration.scope).href,tag:"scout-automation-"+id,data:{url:target}});})());});
self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil((async()=>{const target=event.notification.data?.url||new URL("./?automation=1",self.registration.scope).href;const rows=await clients.matchAll({type:"window",includeUncontrolled:true});for(const client of rows){if(client.url.startsWith(self.registration.scope)){try{await client.navigate(target);}catch{}client.postMessage({type:"OPEN_AUTOMATION"});return client.focus();}}return clients.openWindow(target);})());});
''',encoding='utf-8')

# Wire UI after the app's main inline script so pricingConfig and navigation already exist.
p=Path('index.html')
h=p.read_text(encoding='utf-8')
assert '</body>' in h
if 'push-notifications.js' not in h:
    h=h.replace('</body>','<script src="push-notifications.js"></script>\n</body>',1)
h=h.replace('v5.9.0','v5.9.1')
p.write_text(h,encoding='utf-8')

# Version assertions.
for test in Path('tests').glob('*.test.cjs'):
    t=test.read_text(encoding='utf-8')
    t=t.replace('3\\.33\\.0','3\\.34\\.0').replace('"3.33.0"','"3.34.0"').replace("'3.33.0'","'3.34.0'")
    t=t.replace('v5\\.9\\.0','v5\\.9\\.1').replace('v5.9.0','v5.9.1')
    test.write_text(t,encoding='utf-8')

Path('tests/push-notifications.test.cjs').write_text(r'''const assert=require('node:assert/strict');
const fs=require('node:fs');
const worker=fs.readFileSync('src/index.js','utf8');
const ui=fs.readFileSync('push-notifications.js','utf8');
const sw=fs.readFileSync('scout-push-sw.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.match(worker,/const VERSION = "3\.34\.0"/);
assert.match(worker,/PUSH_VAPID_KEY = "push:vapid:v1"/);
assert.match(worker,/url\.pathname === "\/push\/config"/);
assert.match(worker,/url\.pathname === "\/push\/subscribe"/);
assert.match(worker,/url\.pathname === "\/push\/test"/);
assert.match(worker,/url\.pathname === "\/push\/latest"/);
assert.match(worker,/crypto\.subtle\.generateKey\(\{ name: "ECDSA", namedCurve: "P-256" \}/,'VAPID key must be generated privately on the Worker');
assert.match(worker,/Authorization.*vapid t=/s,'push sends must use VAPID authorization');
assert.match(worker,/if \(Number\(targetRun\.result\?\.searchUsed\) > 0\)[\s\S]*pushNotifySubscribers/,'scheduled target pushes require a real search');
assert.match(worker,/if \(Number\(collectionRun\.result\?\.searchUsed\) > 0\)[\s\S]*pushNotifySubscribers/,'scheduled collection pushes require a real search');
assert.match(ui,/Notification\.requestPermission\(\)/);
assert.match(ui,/pushManager\.subscribe/);
assert.match(ui,/SEND TEST NOTIFICATION · 0 SEARCHES/);
assert.doesNotMatch(ui,/runEbaySearch|SerpApi.*fetch|\/value/,'notification setup must not invoke pricing searches');
assert.match(sw,/addEventListener\("push"/);
assert.match(sw,/showNotification/);
assert.match(sw,/\/push\/latest\?token=/);
assert.match(html,/push-notifications\.js/);
console.log('Push notification tests passed.');
''',encoding='utf-8')
