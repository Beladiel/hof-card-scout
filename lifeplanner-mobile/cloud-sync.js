/* LifePlanner Mobile v2.0 private cloud bridge. No token is bundled in this public file. */
(function () {
"use strict";
const PAIR = "LifePlannerMobileCloudPairV1";
const BASE = "LifePlannerMobileCloudBaseV1";
const DELETED = "LifePlannerMobileCloudDeletedV1";
const SAFE = "LifePlannerMobileBeforeCloud";
const FIELDS = ["title","category","day","time","notes","remind_days","completed"];
const $ = id => document.getElementById(id);
const uid = () => "cloud-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
let config = null, busy = false, nextSync = 0, revision = 0, lastStatus = "Not paired yet.";
let tomb = {};
let base = {};
const read = (key, fallback) => { try {return JSON.parse(localStorage.getItem(key) || "null") || fallback;}catch{return fallback;} };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const validPair = x => !!(x && x.format === "LifePlannerCloud1" && typeof x.token === "string" &&
 /^[A-Za-z0-9_-]{40,180}$/.test(x.token) && typeof x.endpoint === "string" &&
 /^https:\/\/[a-z0-9.-]+\.supabase\.co\/functions\/v1\/lifeplanner-sync$/.test(x.endpoint));
function status(s) {
 lastStatus=s;
 const n=$("cloudStatus"); if(n)n.textContent=s;
}
function cloudRecords(rows) {
 const out={};
 for(const raw of rows){
   if(!raw || typeof raw.id!=="string" || out[raw.id])throw Error("Duplicate or invalid cloud event.");
   const id=raw.id;
   if(raw.deleted===true) {out[id]={id,deleted:true};continue;}
   const e={id,deleted:false};
   for(const f of FIELDS)e[f]=f==="completed"?!!raw[f]:f==="remind_days"?Number(raw[f]??3):String(raw[f]??"");
   if(!e.title || !e.day || !e.category)throw Error("Invalid cloud event.");
   out[id]=e;
 }
 return out;
}
function stable(value) {
 if(value===undefined || value===null)return "null";
 if(Array.isArray(value))return "["+value.map(stable).join(",")+"]";
 if(typeof value==="object")return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stable(value[k])).join(",")+"}";
 return JSON.stringify(value);
}
function same(a,b) {return stable(a)===stable(b);}
function localRecords(){
 const b=window.LifePlannerBridge;
 if(!b)return {};
 const result=cloudRecords(b.getEvents());
 for(const id of Object.keys(tomb))if(!result[id])result[id]={id,deleted:true};
 for(const id of Object.keys(base))if(!result[id] && !base[id].deleted)result[id]={id,deleted:true};
 return result;
}
function merge3(old,local,remote){
 const merged={};
 let count=0;
 for(const key of new Set([...Object.keys(old),...Object.keys(local),...Object.keys(remote)])){
   const b=old[key]||null,l=local[key]||null,r=remote[key]||null;
   const lc=!same(l,b),rc=!same(r,b);
   if(lc&&rc&&!same(l,r)){
     count++;
     if(l&&!l.deleted&&r&&!r.deleted){
       merged[key]=r;
       const copy={...l,id:uid(),title:(l.title.slice(0,148)+" (Phone conflict copy)").slice(0,180)};
       merged[copy.id]=copy;
     }else if(l&&!l.deleted)merged[key]=l;
     else if(r&&!r.deleted)merged[key]=r;
     else merged[key]={id:key,deleted:true};
   }else{
     const chosen=lc?l:rc?r:(r||l||b);
     if(chosen)merged[key]=chosen;
   }
 }
 return {merged,conflicts:count};
}
function apply(records){
 const bridge=window.LifePlannerBridge;
 if(!bridge)throw Error("LifePlanner is not ready.");
 const events=[],removed={};
 for(const row of Object.values(records)){
   if(row.deleted)removed[row.id]=true;
   else events.push({...row,completed:!!row.completed,updatedAt:new Date().toISOString(),alerted_on:""});
 }
 if(!bridge.setEvents(events))throw Error("Phone storage is full. Cloud data was not written to the phone.");
 tomb=removed;
 write(DELETED,tomb);
}
async function request(action,extra={}){
 if(!validPair(config))throw Error("Choose your private LifePlanner connection file.");
 const control=new AbortController(), timeout=setTimeout(()=>control.abort(),12000);
 try{
   const resp=await fetch(config.endpoint,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({token:config.token,action,...extra}),signal:control.signal});
   const data=await resp.json().catch(()=>({}));
   if(!resp.ok)throw Error(resp.status===409?"CHANGED_ELSEWHERE":data.error||"Server error "+resp.status);
   return data;
 }finally{clearTimeout(timeout)}
}
async function syncNow(){
 if(!config || busy || !window.LifePlannerBridge)return;
 busy=true;
 status("☁️ Checking both planners…");
 try{
   for(let tryN=0;tryN<3;tryN++){
     const before=localRecords();
     const beforeMark=JSON.stringify(before);
     const server=await request("read");
     const remote=cloudRecords(server.events);
     const combined=merge3(base,before,remote);
     const merged=combined.merged;
     let rev=Number(server.revision);
     if(!same(merged,remote)){
       try{
         const saved=await request("write",{revision:rev,events:Object.values(merged).sort((a,b)=>a.id.localeCompare(b.id))});
         rev=Number(saved.revision);
       }catch(e){if(String(e.message)==="CHANGED_ELSEWHERE")continue;throw e}
     }
     // Do not discard a phone edit made while the network request was pending.
     const recent=localRecords();
     if(!same(recent,before)){
       base=merged;write(BASE,base);
       const changes={};
       for(const id of new Set([...Object.keys(recent),...Object.keys(before)])){
         if(!same(recent[id],before[id]))changes[id]=recent[id]||{id,deleted:true};
       }
       const next={...merged,...changes};
       apply(next);
       status("☁️ Newer phone edits preserved; syncing again.");
       setTimeout(syncNow,1000);
       return;
     }
     apply(merged);
     base=merged;
     write(BASE,base);
     revision=rev;
     const active=Object.values(merged).filter(x=>!x.deleted).length;
     status("☁️ Synced " + active + " events · " + new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}) +
       (combined.conflicts?" · "+combined.conflicts+" edit conflict copy saved":""));
     return;
   }
   throw Error("Other device updated repeatedly. Try Sync now again.");
 }catch(e){status("⚠️ Sync paused: "+String(e.message||e).slice(0,160))}
 finally{busy=false}
}
function changed(){
 if(!config)return;
 clearTimeout(nextSync);
 nextSync=setTimeout(syncNow,1100);
}
function recordDeleted(id){
 tomb[id]=true;write(DELETED,tomb);changed();
}
async function pairedFile(file){
 if(!file)return;
 try{
   if(file.size>10000)throw Error("Pairing file is too large.");
   const parsed=JSON.parse(await file.text());
   if(!validPair(parsed))throw Error("This is not a valid LifePlanner Cloud connection file.");
   const backup={format:"LifePlannerBeforeCloud",exported:new Date().toISOString(),events:window.LifePlannerBridge.getEvents()};
   write(SAFE,backup);
   write(PAIR,parsed);
   config=parsed;
   base={};tomb={};write(BASE,base);write(DELETED,tomb);
   status("🔐 Paired securely. Starting the first sync…");
   window.LifePlannerBridge.refresh();
   syncNow();
 }catch(e){status("⚠️ "+String(e.message||e))}
 finally{if($("cloudPairFile"))$("cloudPairFile").value=""}
}
function renderPanel(){
 const connected=!!config;
 return '<section class="panel"><span class="eyebrow">PRIVATE CLOUD CONNECTION</span>'+
  '<h3>'+(connected?'Connected to your Windows LifePlanner':'Connect Windows + iPhone')+'</h3>'+
  '<p>Syncs your appointments, countdowns, notes and completed history while both apps are running. Edits are saved on each device first. Simultaneous edits become separate conflict copies rather than being overwritten.</p>'+
  '<div class="alert" id="cloudStatus" role="status">'+escapeStatus(lastStatus)+'</div>'+
  '<div class="actions">'+
  (connected?'<button class="btn primary" type="button" data-cloud="sync">⇅ Sync now</button>'+
             '<button class="btn" type="button" data-cloud="disconnect">Disconnect phone</button>':
             '<button class="btn primary" type="button" data-cloud="pair">🔐 Choose private pairing file</button>')+
  '</div><p class="small">Automatic checks every 30 seconds while this app is open. No account password or gift-exchange details are shared. Your Windows planner keeps its own local database.</p></section>';
}
function escapeStatus(s){return String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function init(){
 config=read(PAIR,null);
 // A private QR code can securely deliver the pairing token in a URL fragment.
 // Fragments never reach GitHub's web server; remove it from the address immediately.
 const found=location.hash.match(/^#connect=([A-Za-z0-9_-]{40,180})$/);
 if(found){
   const incoming={format:"LifePlannerCloud1",endpoint:"https://ghhxtnyvchmkerxulrxk.supabase.co/functions/v1/lifeplanner-sync",token:found[1]};
   if(validPair(incoming)){
     if(!config || config.token!==incoming.token){
       write(SAFE,{format:"LifePlannerBeforeCloud",exported:new Date().toISOString(),events:window.LifePlannerBridge?.getEvents()||[]});
       write(PAIR,incoming);write(BASE,{});write(DELETED,{});
     }
     config=incoming;
     history.replaceState(null,"",location.pathname+location.search+"#sync");
   }
 }
 if(config&&!validPair(config)){config=null;status("Pairing file invalid. Choose the correct private file.");}
 base=read(BASE,{});tomb=read(DELETED,{});
 if(config){status("☁️ Paired. Connecting to your Windows planner…");setTimeout(syncNow,1200);}
 document.addEventListener("click",e=>{
   const button=e.target.closest("[data-cloud]");if(!button)return;
   const action=button.dataset.cloud;
   if(action==="pair")$("cloudPairFile").click();
   if(action==="sync")syncNow();
   if(action==="disconnect"&&confirm("Disconnect cloud syncing on this phone? The events already saved on the phone and PC will remain.")){
     localStorage.removeItem(PAIR);
     config=null;status("Phone disconnected. Your events remain on this device.");
     window.LifePlannerBridge.refresh();
   }
 });
 $("cloudPairFile").addEventListener("change",e=>pairedFile(e.target.files?.[0]));
 setInterval(()=>{if(document.visibilityState==="visible"&&config)syncNow()},30000);
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")syncNow()});
 window.addEventListener("focus",()=>{if(config)syncNow()});
}
window.LifePlannerCloud={renderPanel,changed,recordDeleted,init,syncNow};
})();