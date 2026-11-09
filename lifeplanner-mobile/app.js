/* LifePlanner Mobile v1.0 — faithful to the user's existing Windows v1.2 backup format. */
(function(){
"use strict";
const KEY="LifePlannerMobileV1",SAFETY="LifePlannerMobileV1Safety",PREIMPORT="LifePlannerMobilePreImport";
const CATEGORIES=["Vacation","Milestone","Doctor","School","Personal","Other"];
const COLOR={Vacation:"#0b807e",Milestone:"#7756ad",Doctor:"#c17825",School:"#3574af",Personal:"#b05c82",Other:"#687485"};
const ALERTS=[["None",-1],["Same day",0],["1 day before",1],["3 days before",3],["7 days before",7],["14 days before",14],["30 days before",30]];
const TILES=["Vacation","Milestone","Doctor","School"];
let cloudApplying=false;
let state={version:1,events:[],settings:{showAllTiles:true}},storageProblem=false,storageRecovered=false,tab="dashboard",categoryFilter="All",search="",editing=null,pendingImport=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const uid=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():"lp-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
const stamp=()=>new Date().toISOString();
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
function validDay(value){
 const v=String(value||"");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const [y,m,d]=v.split("-").map(Number);
 const check=new Date(y,m-1,d);
 return check.getFullYear()===y&&check.getMonth()===m-1&&check.getDate()===d;
}
function dayAsDate(v){const [y,m,d]=v.split("-").map(Number);return new Date(y,m-1,d,12);}
function dayDelta(v){const now=dayAsDate(today()),then=dayAsDate(v);return Math.round((then.getTime()-now.getTime())/86400000);}
function prettyDay(v){return dayAsDate(v).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
function countdown(n){return n>0?n+" day"+(n===1?"":"s")+" left":n===0?"TODAY":Math.abs(n)+" day"+(n===-1?"":"s")+" ago";}
function shortText(text,max=180){return String(text??"").trim().slice(0,max);}
function options(values,selected){return values.map(v=>'<option value="'+esc(v)+'" '+(v===selected?"selected":"")+'>'+esc(v)+'</option>').join("");}
function toTimeField(value){
 const s=String(value||"").trim();
 if(!s)return "";
 const match=/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s);
 if(!match)return "";
 let h=Number(match[1])%12;if(match[3].toUpperCase()==="PM")h+=12;
 return String(h).padStart(2,"0")+":"+match[2];
}
function fromTimeField(value){
 if(!value)return "";
 if(!/^\d{2}:\d{2}$/.test(value))throw Error("Invalid time");
 const [h,m]=value.split(":").map(Number);
 if(h>23||m>59)throw Error("Invalid time");
 return String(h%12||12).padStart(2,"0")+":"+String(m).padStart(2,"0")+" "+(h<12?"AM":"PM");
}
function normalizeEvent(item,desktop=false){
 if(!item||typeof item!=="object"||Array.isArray(item))throw Error("Invalid event record");
 const title=shortText(item.title,180),category=String(item.category||"");
 if(!title||!CATEGORIES.includes(category)||!validDay(item.day))throw Error("An event has an invalid name, category or date.");
 const time=shortText(item.time,24),notes=shortText(item.notes,4000);
 const reminder=Number(item.remind_days??3),remind_days=ALERTS.some(x=>x[1]===reminder)?reminder:3;
 const id=desktop?(Number.isInteger(item.id)&&item.id>0?"pc:"+item.id:uid()):shortText(item.id,150)||uid();
 return {id,title,category,day:String(item.day),time,notes,remind_days,completed:!!item.completed,
  alerted_on:validDay(item.alerted_on)?String(item.alerted_on):"",updatedAt:shortText(item.updatedAt,50)||stamp()};
}
function validateData(value){
 if(!value||!Array.isArray(value.events)||value.events.length>25000)throw Error("Invalid planner data");
 return {version:1,events:value.events.map(x=>normalizeEvent(x,false)),settings:{showAllTiles:value.settings?.showAllTiles!==false}};
}
function load(){
 let raw=null,copy=null;
 try{raw=localStorage.getItem(KEY);copy=localStorage.getItem(SAFETY);}catch(e){storageProblem=true;return;}
 if(raw===null&&copy===null){save();return;}
 try{if(raw!==null){state=validateData(JSON.parse(raw));return;}}catch(e){console.warn("Primary LifePlanner storage unreadable",e);}
 try{if(copy!==null){state=validateData(JSON.parse(copy));storageRecovered=true;localStorage.setItem(KEY,JSON.stringify(state));return;}}catch(e){console.warn("Safety LifePlanner storage unreadable",e);}
 storageProblem=true;
}
function save(){
 if(storageProblem){toast("Storage needs recovery: no changes were written");return false;}
 try{const data=JSON.stringify(state);localStorage.setItem(KEY,data);localStorage.setItem(SAFETY,data);if(!cloudApplying)window.LifePlannerCloud?.changed();return true;}catch(e){console.warn("Unable to store planner",e);toast("Could not save. Download a backup before making more changes.");return false;}
}
function toast(text){const node=$("toast");if(!node)return;node.textContent=text;node.classList.add("show");clearTimeout(toast._timer);toast._timer=setTimeout(()=>node.classList.remove("show"),3200);}
function sortEvents(a,b){return a.day.localeCompare(b.day)||a.time.localeCompare(b.time)||a.title.localeCompare(b.title);}
function eventStatus(event){
 if(event.completed)return "Completed";
 const delta=dayDelta(event.day);return delta<0?"Overdue":delta===0?"Today":"Upcoming";
}
function eventKey(e){return [e.title,e.category,e.day,e.time].map(x=>String(x).trim().toLocaleLowerCase()).join("|");}
function categoryChip(cat){return '<span class="pill" style="color:'+COLOR[cat]+';background:'+COLOR[cat]+'15">'+esc(cat)+'</span>';}
function hero(){
 const rows=state.events;
 const upcoming=rows.filter(e=>!e.completed&&dayDelta(e.day)>=0).sort(sortEvents);
 return '<section class="hero"><span class="eyebrow">YOUR DAYS, ORGANIZED</span><h2>Make room for what matters.</h2><p>Count down to adventures, keep appointments and school deadlines visible, and celebrate completed milestones.</p><div class="actions"><button class="btn primary" data-action="add">+ Add an Event</button><button class="btn soft" data-tab="sync">⇅ Bring Events from PC</button></div></section>'+
 '<div class="stat-grid"><div class="stat"><strong>'+upcoming.length+'</strong><span>Upcoming</span></div><div class="stat"><strong>'+rows.filter(e=>!e.completed&&dayDelta(e.day)<0).length+'</strong><span>Overdue</span></div><div class="stat"><strong>'+rows.filter(e=>e.completed).length+'</strong><span>Completed</span></div></div>';
}
function tile(cat){
 const entries=state.events.filter(e=>e.category===cat&&!e.completed&&dayDelta(e.day)>=0).sort(sortEvents);
 return '<section class="tile" style="--accent:'+COLOR[cat]+'"><div class="tile-title">'+esc(cat==="Doctor"?"Appointments":cat==="School"?"School deadlines":cat==="Vacation"?"Vacations":"Milestones")+'</div>'+
 '<div class="tile-info">'+entries.length+' upcoming</div>'+
 (entries.length?(state.settings.showAllTiles?entries.map(e=>
  '<button type="button" class="tile-entry" data-edit="'+esc(e.id)+'"><strong>'+esc(e.title)+'</strong><span>'+esc(prettyDay(e.day))+' · '+countdown(dayDelta(e.day))+(e.time?' · '+esc(e.time):"")+'</span></button>').join(""):
  '<button type="button" class="tile-entry" data-edit="'+esc(entries[0].id)+'"><strong class="tile-first">'+countdown(dayDelta(entries[0].day))+'</strong><span class="tile-subtitle">'+esc(entries[0].title)+' · '+esc(prettyDay(entries[0].day))+'</span></button>'):'<div class="tile-no-events">Nothing scheduled yet.</div>')+'</section>';
}
function listEvents(rows,includeNotes=true){
 return rows.length?'<div class="event-list">'+rows.map(e=>{
 const status=eventStatus(e),d=dayAsDate(e.day);
 return '<article class="event'+(e.completed?" completed":"")+'">'+
 '<div class="event-date"><strong>'+d.getDate()+'</strong><small>'+d.toLocaleDateString(undefined,{month:"short"})+'</small></div>'+
 '<div class="event-main"><div class="actions" style="gap:5px;margin-bottom:5px">'+categoryChip(e.category)+
 '<span class="pill '+(status==="Overdue"?"overdue":status==="Completed"?"complete":status==="Today"?"today":"")+'">'+status+'</span></div>'+
 '<h3>'+esc(e.title)+'</h3><div class="meta">'+esc(prettyDay(e.day))+(e.time?' · '+esc(e.time):"")+' · '+countdown(dayDelta(e.day))+'</div>'+
 (includeNotes&&e.notes?'<div class="notes">'+esc(e.notes)+'</div>':"")+
 '<div class="event-actions"><button class="btn" data-edit="'+esc(e.id)+'">Edit</button><button class="btn soft" data-toggle="'+esc(e.id)+'">'+(e.completed?"Reopen":"Complete ✓")+'</button></div></div></article>';
 }).join("")+'</div>':'<div class="empty">Nothing to show here yet.</div>';
}
function dashboard(){
 const soon=state.events.filter(e=>!e.completed&&dayDelta(e.day)>=0).sort(sortEvents).slice(0,5);
 const overdue=state.events.filter(e=>!e.completed&&dayDelta(e.day)<0).sort(sortEvents);
 return hero()+
 '<div class="page-head"><div><span class="eyebrow">AT A GLANCE</span><h2>Your next dates</h2></div><label class="switch-line"><input type="checkbox" id="tileAll" '+(state.settings.showAllTiles?"checked":"")+'>Show all on tiles</label></div>'+
 '<div class="tile-grid">'+TILES.map(tile).join("")+'</div>'+
 (overdue.length?'<div class="alert warn"><strong>'+overdue.length+' event'+(overdue.length===1?"":"s")+' past due.</strong> Mark completed, update the date, or reopen the event to review.</div>':"")+
 '<div class="page-head"><div><h2>Coming up next</h2><p>Your nearest upcoming appointments and milestones.</p></div><button class="btn" data-tab="events">All Events</button></div>'+
 listEvents(soon,false);
}
function filters(){
 return '<div class="filters"><input id="eventSearch" type="search" placeholder="Search events or notes…" value="'+esc(search)+'" aria-label="Search events">'+
 '<select id="eventCategory" aria-label="Filter category">'+options(["All",...CATEGORIES],categoryFilter)+'</select></div>';
}
function eventPage(completed=false){
 let rows=state.events.filter(e=>completed?e.completed:!e.completed);
 if(categoryFilter!=="All")rows=rows.filter(e=>e.category===categoryFilter);
 if(search.trim()){const q=search.toLowerCase().trim();rows=rows.filter(e=>(e.title+" "+e.notes+" "+e.category).toLowerCase().includes(q));}
 rows=rows.sort(sortEvents);
 if(completed)rows.reverse();
 return '<div class="page-head"><div><h2>'+(completed?"Completed history":"All upcoming & overdue")+'</h2><p>'+
 (completed?"Finished events stay in your history until you delete them.":"Your saved events, including anything that is past due.")+
 '</p></div><button class="btn primary" data-action="add">+ Add</button></div>'+
 filters()+listEvents(rows);
}
function syncPage(){
 return (window.LifePlannerCloud?.renderPanel() || '') + '<div class="page-head"><div><h2>Backup & PC Transfer</h2><p>Built to understand the original Windows LifePlanner v1.2 backup.</p></div></div>'+
 '<div class="alert"><strong>Cloud sync:</strong> Once both devices are paired, changes can travel between your existing Windows LifePlanner and the phone automatically while both apps are open. You can still save and restore separate JSON backups below.</div>'+
 '<section class="panel"><span class="eyebrow">START HERE</span><h3>Bring your Windows events to iPhone</h3>'+
 '<ol class="sync-steps"><li>On your PC, open LifePlanner and select <strong>Save Backup</strong>.</li>'+
 '<li>Send that JSON file to your iPhone using Files, iCloud Drive or an attachment you trust.</li>'+
 '<li>Here, choose <strong>Import PC Backup</strong>. Select Merge to add missing events, or Replace for a full copy.</li></ol>'+
 '<div class="actions"><button class="btn primary" data-action="import">⇧ Import PC Backup</button></div></section>'+
 '<div class="sync-boxes"><section class="panel"><h3>Full phone backup</h3>'+
 '<p>Save all your mobile events and display preference to a private JSON file so your data can be restored later.</p>'+
 '<button class="btn primary" data-action="backup-mobile">↓ Save Phone Backup</button></section>'+
 '<section class="panel"><h3>Export for Windows LifePlanner</h3>'+
 '<p>Creates an original-format <strong>LifePlanner1</strong> JSON backup that your desktop app can open using Restore Backup.</p>'+
 '<button class="btn" data-action="backup-pc">↓ Export for PC</button></section></div>'+
 '<div class="alert warn"><strong>Important:</strong> Windows <strong>Restore Backup</strong> replaces its entire event list. Save a backup of the PC first. Imported Merge adds missing events but does not overwrite matching events or provide automatic conflict resolution.</div>'+
 '<section class="panel"><h3>How private syncing works</h3>'+
 '<p>Your Windows LifePlanner stays installed and retains its own SQLite database. Use the supplied cloud sync companion and the private pairing file. A backup is made automatically before the first PC sync. Never post the pairing file online.</p></section>';
}
function banner(){
 if(storageProblem)return '<div class="alert error"><strong>Storage needs recovery.</strong> Both the primary and on-device safety copy are unreadable. LifePlanner will not overwrite them. Open your original Home Screen icon or import a previous backup once the storage issue is resolved.</div>';
 if(storageRecovered)return '<div class="alert warn"><strong>Recovered from the on-device safety copy.</strong> Please download a backup from Backup & PC Transfer.</div>';
 return "";
}
function render(){
 tab=location.hash.replace(/^#/,"")||"dashboard";
 if(!["dashboard","events","completed","sync"].includes(tab))tab="dashboard";
 $("content").innerHTML=banner()+(tab==="dashboard"?dashboard():tab==="events"?eventPage(false):tab==="completed"?eventPage(true):syncPage());
 document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
}
function editor(id){
 const e=state.events.find(x=>x.id===id),x=e||{title:"",category:"Personal",day:today(),time:"",remind_days:3,notes:"",completed:false};
 editing=e?.id||null;
 const label=(name,caption,inner)=>'<label class="field'+(name==="notes"?" wide":"")+'">'+caption+inner+'</label>';
 $("dialog").innerHTML='<div class="modal-overlay" id="modalOverlay"><div class="modal" role="dialog" aria-modal="true" aria-label="Event editor">'+
 '<div class="modal-header"><div><span class="eyebrow">LIFEPLANNER</span><h2>'+(e?"Edit event":"New event")+'</h2></div><button class="btn" data-action="close">✕</button></div>'+
 '<form id="eventForm"><div class="form-grid">'+
 label("title","EVENT NAME",'<input name="title" required maxlength="180" value="'+esc(x.title)+'" placeholder="What are you planning?">')+
 label("category","CATEGORY",'<select name="category">'+options(CATEGORIES,x.category)+'</select>')+
 label("day","DATE",'<input name="day" type="date" required value="'+esc(x.day)+'">')+
 label("time","TIME (OPTIONAL)",'<input name="time" type="time" value="'+esc(toTimeField(x.time))+'">')+
 label("remind_days","REMINDER WINDOW",'<select name="remind_days">'+ALERTS.map(([n,v])=>'<option value="'+v+'" '+(x.remind_days===v?"selected":"")+'>'+esc(n)+'</option>').join("")+'</select>')+
 label("completed","STATUS",'<select name="completed">'+options(["Upcoming","Completed"],x.completed?"Completed":"Upcoming")+'</select>')+
 label("notes","NOTES",'<textarea name="notes" maxlength="4000" placeholder="Details, location, assignment instructions…">'+esc(x.notes)+'</textarea>')+
 '</div><div class="modal-footer">'+(e?'<button class="btn negative" type="button" data-delete="'+esc(e.id)+'">Delete Event</button>':'')+
 '<button class="btn" type="button" data-action="close">Cancel</button><button class="btn primary" type="submit">Save Event</button></div></form></div></div>';
 $("dialog").querySelector('input[name="title"]')?.focus();
}
function closeEditor(){$("dialog").innerHTML="";editing=null;}
function submitEvent(form){
 if(storageProblem)return toast("Data protection mode is on.");
 const data=Object.fromEntries(new FormData(form).entries());
 if(!String(data.title||"").trim()||!validDay(data.day))return toast("Please enter a name and valid date.");
 const original=state.events.find(e=>e.id===editing);
 const item=normalizeEvent({...(original||{}),title:data.title,category:data.category,day:data.day,
  time:fromTimeField(data.time),notes:data.notes,remind_days:Number(data.remind_days),
  completed:data.completed==="Completed",alerted_on:"",updatedAt:stamp()});
 if(original){Object.assign(original,item);}
 else {item.id=uid();state.events.push(item);}
 if(save()){closeEditor();render();toast(original?"Event updated":"Event added");}
}
function doToggle(id){
 if(storageProblem)return toast("Storage needs recovery");
 const item=state.events.find(e=>e.id===id);if(!item)return;
 item.completed=!item.completed;item.alerted_on="";item.updatedAt=stamp();
 if(save()){render();toast(item.completed?"Marked complete":"Reopened event");}
}
function doDelete(id){
 if(storageProblem)return toast("Storage needs recovery");
 const item=state.events.find(e=>e.id===id);if(!item)return;
 if(!confirm('Delete "'+item.title+'"? This removes it from this device and its completed history.'))return;
 window.LifePlannerCloud?.recordDeleted(id);
 state.events=state.events.filter(e=>e.id!==id);
 if(save()){closeEditor();render();toast("Event deleted");}
}
function downloadFile(name,payload){
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function mobileBackup(){
 downloadFile("LifePlanner_Mobile_"+today()+".json",{format:"LifePlannerMobile1",exported:stamp(),data:state});
 toast("Phone backup downloaded");
}
function pcBackup(){
 const events=state.events.slice().sort(sortEvents).map(e=>({
  title:e.title,category:e.category,day:e.day,time:e.time,notes:e.notes,
  remind_days:e.remind_days,completed:e.completed?1:0,alerted_on:""
 }));
 downloadFile("LifePlanner_Backup_"+today()+".json",{format:"LifePlanner1",exported:stamp(),events});
 toast("Windows-compatible LifePlanner backup downloaded");
}
async function loadImport(file){
 if(!file||storageProblem)return;
 try{
  if(file.size>5*1024*1024)throw Error("Backup is too large (over 5 MB).");
  const content=JSON.parse(await file.text());
  let events,kind,settings=null;
  if(content.format==="LifePlanner1"&&Array.isArray(content.events)){
   events=content.events.map(x=>normalizeEvent(x,true));kind="Windows LifePlanner";
  }else if(content.format==="LifePlannerMobile1"&&content.data&&Array.isArray(content.data.events)){
   events=content.data.events.map(x=>normalizeEvent(x,false));
   settings={showAllTiles:content.data.settings?.showAllTiles!==false};kind="LifePlanner Mobile";
  }else throw Error("Not a supported LifePlanner backup.");
  if(events.length>25000)throw Error("Too many events.");
  pendingImport={events,kind,settings};
  importDialog();
 }catch(e){toast("Import error: "+(e.message||e));}
}
function importDialog(){
 if(!pendingImport)return;
 const count=pendingImport.events.length,existing=state.events.length;
 const oldKeys=new Set(state.events.map(eventKey));
 const added=pendingImport.events.filter(e=>!oldKeys.has(eventKey(e))).length;
 $("dialog").innerHTML='<div class="modal-overlay" id="modalOverlay"><div class="modal" role="dialog" aria-modal="true" aria-label="Import review">'+
 '<div class="modal-header"><div><span class="eyebrow">REVIEW BEFORE IMPORTING</span><h2>Transfer from '+esc(pendingImport.kind)+'</h2></div><button class="btn" data-action="close">✕</button></div>'+
 '<p><strong>'+count+' events</strong> in file; <strong>'+existing+'</strong> already on your phone.</p>'+
 '<div class="alert"><strong>Merge missing events:</strong> Add about '+added+' entries that do not match an existing event title, category, date and time. Existing events are never overwritten.</div>'+
 '<div class="alert warn"><strong>Replace phone events:</strong> Replace all '+existing+' phone entries with the '+count+' events in this file. Before replacing, a copy of the previous catalog is saved on this device. Download a phone backup first if your events are important.</div>'+
 '<div class="modal-footer"><button class="btn" data-action="close">Cancel</button>'+
 '<button class="btn soft" data-action="import-merge">Merge Missing</button>'+
 '<button class="btn primary" data-action="import-replace">Replace Phone List</button></div></div></div>';
}
function applyImport(mode){
 if(storageProblem||!pendingImport)return;
 const incoming=pendingImport.events;
 if(mode==="replace"){
  if(!confirm("Replace ALL phone events with "+incoming.length+" events from this file? This does not change the Windows app."))return;
  try{localStorage.setItem(PREIMPORT,JSON.stringify({format:"LifePlannerMobile1",data:state}));}catch(e){toast("Could not save rollback snapshot; download a full phone backup first.");return;}
  state.events=incoming;
  if(pendingImport.settings)state.settings=pendingImport.settings;
 }else{
  const keys=new Set(state.events.map(eventKey));
  const existingIds=new Set(state.events.map(e=>e.id));
  for(const item of incoming){
   const key=eventKey(item);
   if(keys.has(key))continue;
   keys.add(key);
   if(existingIds.has(item.id))item.id=uid();
   existingIds.add(item.id);
   state.events.push(item);
  }
 }
 const imported=pendingImport.events.length;
 if(save()){pendingImport=null;closeEditor();render();toast(mode==="replace"?"Phone list replaced with "+imported+" events":"Missing events merged successfully");}
}
function clickHandler(e){
 const button=e.target.closest("button");if(!button)return;
 if(button.dataset.tab){location.hash="#"+button.dataset.tab;return;}
 if(button.dataset.edit){editor(button.dataset.edit);return;}
 if(button.dataset.toggle){doToggle(button.dataset.toggle);return;}
 if(button.dataset.delete){doDelete(button.dataset.delete);return;}
 const action=button.dataset.action;
 if(action==="add")editor(null);
 if(action==="close"){closeEditor();pendingImport=null;}
 if(action==="import"){$("importPicker").value="";$("importPicker").click();}
 if(action==="backup-mobile")mobileBackup();
 if(action==="backup-pc")pcBackup();
 if(action==="import-merge")applyImport("merge");
 if(action==="import-replace")applyImport("replace");
}
function changeHandler(e){
 if(e.target.id==="tileAll"){state.settings.showAllTiles=e.target.checked;save();render();}
 if(e.target.id==="eventCategory"){categoryFilter=e.target.value;render();}
 if(e.target.id==="importPicker")loadImport(e.target.files?.[0]);
}
function inputHandler(e){
 if(e.target.id==="eventSearch"){
  search=e.target.value;const pos=e.target.selectionStart;render();
  const node=$("eventSearch");if(node){node.focus();node.setSelectionRange(pos,pos);}
 }
}
function submitHandler(e){if(e.target.id==="eventForm"){e.preventDefault();submitEvent(e.target);}}
function registerEvents(){
 document.addEventListener("click",clickHandler);
 document.addEventListener("change",changeHandler);
 document.addEventListener("input",inputHandler);
 document.addEventListener("submit",submitHandler);
 document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeEditor();pendingImport=null;}});
 $("dialog").addEventListener("click",e=>{if(e.target.id==="modalOverlay"){closeEditor();pendingImport=null;}});
 window.addEventListener("hashchange",render);
}
function showReminders(){
 if(!state.events.length)return;
 const due=state.events.filter(e=>!e.completed&&e.remind_days>=0&&dayDelta(e.day)>=0&&dayDelta(e.day)<=e.remind_days).sort(sortEvents);
 if(!due.length)return;
 // In-app reminders only. Mobile browsers don't guarantee background notifications.
 const box=document.querySelector(".hero");
 if(box&&tab==="dashboard"){
  const note=document.createElement("div");note.className="alert";
  note.textContent=due.length+" reminder"+(due.length===1?"":"s")+" coming up, including "+due[0].title+".";
  box.after(note);
 }
}
window.LifePlannerBridge={
 getEvents:()=>state.events.map(e=>({...e})),
 setEvents:rows=>{
   if(storageProblem)return false;
   const old=state.events;
   try{
     const next=rows.map(e=>normalizeEvent(e,false));
     cloudApplying=true;state.events=next;
     if(!save()){state.events=old;return false;}
     render();
     return true;
   }catch(e){console.warn("Cloud snapshot was rejected",e);state.events=old;return false;}
   finally{cloudApplying=false;}
 },
 refresh:()=>render()
};
async function start(){
 load();registerEvents();window.LifePlannerCloud?.init();render();showReminders();
 if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(e=>console.warn("LifePlanner offline shell",e));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();