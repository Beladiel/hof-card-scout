/* Encore Concert Vault • free local-first physical concert collection */
(function(){
"use strict";
const KEY="encoreConcertVaultV1",SAFETY="encoreConcertVaultSafetyV1",DB_NAME="encoreConcertCoversV1";
const FMT=["Blu-ray","DVD","4K UHD","Other"],STATS=["Owned","Wishlist"],AUDIO=["Unknown","Stereo","Dolby Digital 5.1","DTS 5.1","DTS-HD Master Audio","Dolby TrueHD","Dolby Atmos","PCM 2.0","PCM 5.1","Other"];
let state={version:1,discs:[]},db=null,view="collection",search="",formatFilter="All",editing=null,coverFor=null,pickId=null,storageProblem=false,recovered=false,urls=[];
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const uuid=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():"disc-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
const now=()=>new Date().toISOString();
const cleanText=(value,max=300)=>String(value??"").trim().slice(0,max);
const opts=(items,selected)=>items.map(item=>'<option value="'+esc(item)+'" '+(item===selected?"selected":"")+'>'+esc(item)+'</option>').join("");
const stamp=v=>{if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleDateString();};
function normalize(d){
 const x=Object.assign({id:uuid(),artist:"",title:"",format:"Blu-ray",status:"Owned",year:"",releaseYear:"",venue:"",audio:"Unknown",discs:1,watched:false,favorite:false,rating:0,notes:"",addedAt:now(),updatedAt:now()},d||{});
 x.id=cleanText(x.id,90)||uuid();x.artist=cleanText(x.artist,160);x.title=cleanText(x.title,180);x.venue=cleanText(x.venue,180);
 x.format=FMT.includes(x.format)?x.format:"Other";x.status=STATS.includes(x.status)?x.status:"Owned";
 x.year=/^(19|20)\d{2}$/.test(String(x.year||""))?String(x.year):"";
 x.releaseYear=/^(19|20)\d{2}$/.test(String(x.releaseYear||""))?String(x.releaseYear):"";
 x.audio=AUDIO.includes(x.audio)?x.audio:"Other";x.discs=Math.max(1,Math.min(30,parseInt(x.discs,10)||1));
 x.watched=Boolean(x.watched);x.favorite=Boolean(x.favorite);x.rating=Math.max(0,Math.min(5,Number(x.rating)||0));
 x.notes=cleanText(x.notes,3000);x.addedAt=cleanText(x.addedAt,40)||now();x.updatedAt=cleanText(x.updatedAt,40)||now();return x;
}
function parse(raw){if(!raw)return null;const data=JSON.parse(raw);if(!data||!Array.isArray(data.discs))return null;return {version:1,discs:data.discs.map(normalize)};}
function load(){
 let raw=null,safe=null;
 try{raw=localStorage.getItem(KEY);safe=localStorage.getItem(SAFETY);}catch(e){storageProblem=true;return;}
 try{const loaded=parse(raw);if(loaded){state=loaded;if(safe===null)try{localStorage.setItem(SAFETY,raw);}catch{}return;}}catch(e){console.warn("Unusable main catalog",e);}
 try{const loaded=parse(safe);if(loaded){state=loaded;recovered=true;try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}return;}}catch(e){console.warn("Unusable safety catalog",e);}
 if(raw!==null||safe!==null){storageProblem=true;return;}
 save();
}
function save(){
 if(storageProblem){toast("Saved data needs recovery: new changes blocked");return false;}
 try{const raw=JSON.stringify(state);localStorage.setItem(KEY,raw);localStorage.setItem(SAFETY,raw);return true;}catch(e){toast("Storage unavailable. Export a backup before adding more.");console.warn(e);return false;}
}
function toast(msg){const node=$("toast");if(!node)return;node.textContent=msg;node.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove("show"),3500);}
function openDB(){
 return new Promise(resolve=>{
  if(!window.indexedDB){resolve(null);return;}
  try{const request=indexedDB.open(DB_NAME,1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("covers"))request.result.createObjectStore("covers");};
   request.onsuccess=()=>resolve(db=request.result);
   request.onerror=()=>resolve(null);request.onblocked=()=>resolve(null);
  }catch(e){resolve(null);}
 });
}
function coverGet(id){return new Promise(resolve=>{if(!db){resolve(null);return;}try{const rq=db.transaction("covers","readonly").objectStore("covers").get(id);rq.onsuccess=()=>resolve(rq.result instanceof Blob?rq.result:null);rq.onerror=()=>resolve(null);}catch{resolve(null);}});}
function coverPut(id,blob){return new Promise((resolve,reject)=>{if(!db){reject(Error("Photo storage unavailable"));return;}try{const tx=db.transaction("covers","readwrite");tx.objectStore("covers").put(blob,id);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);}catch(e){reject(e);}});}
function coverDelete(id){return new Promise(resolve=>{if(!db){resolve();return;}try{const tx=db.transaction("covers","readwrite");tx.objectStore("covers").delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();}catch{resolve();}});}
function fileToData(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error("Could not read cover"));reader.readAsDataURL(blob);});}
function dataToBlob(raw){
 if(!/^data:image\/(?:jpeg|png|webp);base64,/i.test(raw))throw Error("Unsupported cover image in backup");
 const arr=raw.split(",",2),binary=atob(arr[1]),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Blob([bytes],{type:arr[0].slice(5).split(";")[0]});
}
function download(name,data,mime="application/json"){const url=URL.createObjectURL(new Blob([data],{type:mime}));const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function photoCompressed(file){
 if(!file||!file.type.startsWith("image/"))throw Error("Choose a photo");
 if(file.size>25*1024*1024)throw Error("Choose a cover photo under 25 MB");
 const source=URL.createObjectURL(file);
 try{const img=new Image();img.src=source;await new Promise((yes,no)=>{if(img.complete&&img.naturalWidth)yes();else{img.onload=yes;img.onerror=()=>no(Error("Could not open photo"));}});
  const scale=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(yes=>canvas.toBlob(yes,"image/jpeg",.84));if(!blob)throw Error("Unable to compress photo");return blob;
 }finally{URL.revokeObjectURL(source);}
}
function counts(){return {owned:state.discs.filter(x=>x.status==="Owned").length,wishlist:state.discs.filter(x=>x.status==="Wishlist").length,favorites:state.discs.filter(x=>x.favorite&&x.status==="Owned").length,unwatched:state.discs.filter(x=>x.status==="Owned"&&!x.watched).length};}
function discKey(d){return [d.artist,d.title,d.format].map(x=>x.toLowerCase().trim().replace(/\s+/g," ")).join("|");}
function header(){const c=counts();return '<section class="hero"><span class="eyebrow">YOUR LIVE MUSIC LIBRARY</span><h2>The concert never ends.</h2><p>Catalog the concert DVDs, Blu-rays, and 4K discs on your shelves. Keep track of great performances, surround sound mixes, favorites, and the next show to play.</p><div class="actions"><button class="btn primary" data-action="add">+ ADD A CONCERT</button><button class="btn ghost" data-view="pick">♫ WHAT SHOULD I WATCH?</button></div></section><div class="stats"><div class="stat"><strong>'+c.owned+'</strong><span>Owned discs</span></div><div class="stat"><strong>'+c.wishlist+'</strong><span>Wishlist</span></div><div class="stat"><strong>'+c.favorites+'</strong><span>Favorites</span></div><div class="stat"><strong>'+c.unwatched+'</strong><span>Not watched yet</span></div></div>';}
function discCard(d){return '<article class="disc"><div class="cover" data-cover="'+esc(d.id)+'"><span class="no-cover">♫</span><span class="format">'+esc(d.format)+'</span></div><div class="disc-info"><span class="artist">'+esc(d.artist)+'</span><h3>'+esc(d.title)+'</h3><div class="meta">'+esc(d.year||d.releaseYear||"Year unknown")+(d.venue?' · '+esc(d.venue):'')+'</div><div class="meta">'+esc(d.audio)+(d.watched?' · Watched':'')+'</div><div class="meta stars">'+(d.favorite?"★ Favorite · ":"")+(d.rating>0?"★".repeat(d.rating):"")+'</div><div class="actions"><button class="btn small" data-action="edit" data-id="'+esc(d.id)+'">DETAILS</button><button class="btn small" data-action="favorite" data-id="'+esc(d.id)+'">'+(d.favorite?"★":"☆")+'</button><button class="btn small" data-action="watched" data-id="'+esc(d.id)+'">'+(d.watched?"WATCHED ✓":"WATCHED?")+'</button></div></div></article>';}
function collectionPage(wishlist=false){
 const discs=state.discs.filter(d=>(wishlist?d.status==="Wishlist":d.status==="Owned")&&[d.artist,d.title,d.venue,d.notes,d.audio].join(" ").toLowerCase().includes(search.toLowerCase())&&(formatFilter==="All"||d.format===formatFilter)).sort((a,b)=>a.artist.localeCompare(b.artist)||a.title.localeCompare(b.title));
 return '<div class="section-head"><div><h2>'+(wishlist?"Wish List":"Your Concert Collection")+'</h2><p>'+(wishlist?"Concerts you hope to own someday.":"Your discs, performances and memories — all in one place.")+'</p></div><button class="btn primary" data-action="add">+ ADD</button></div>'+
 '<div class="tools"><input id="searchInput" type="search" aria-label="Search concerts" placeholder="Search artist, title, venue or audio…" value="'+esc(search)+'"><select id="formatFilter" aria-label="Filter format">'+opts(["All",...FMT],formatFilter)+'</select></div>'+
 (discs.length?'<div class="cards">'+discs.map(discCard).join("")+'</div>':'<div class="empty"><div style="font-size:35px">♫</div><p>'+(search||formatFilter!=="All"?"No matching concerts. Try another filter.":wishlist?"Your wish list is empty. Add a performance you would love to own.":"Your concert shelf is ready. Add your first Blu-ray or DVD.")+'</p><button class="btn primary" data-action="add">+ ADD CONCERT</button></div>');
}
function pickPage(){
 const choices=state.discs.filter(d=>d.status==="Owned");
 const picked=choices.find(d=>d.id===pickId);
 return '<div class="section-head"><div><h2>Concert Night</h2><p>Let the shelf pick tonight’s show. A suggestion, not an algorithm.</p></div></div>'+
 '<div class="panel"><h2>Pick a performance</h2><p>Choose randomly from the concert discs you already own. Great for rediscovering something you haven’t watched in a while.</p><div class="actions"><button class="btn primary" data-action="pick" '+(choices.length?"":"disabled")+'>♫ PICK MY CONCERT</button><button class="btn" data-action="pick-unwatched" '+(choices.some(d=>!d.watched)?"":"disabled")+'>SURPRISE ME WITH AN UNWATCHED SHOW</button></div></div>'+
 (picked?'<div class="pick-result"><span class="eyebrow">TONIGHT\'S ENCORE</span><h3>'+esc(picked.artist)+' — '+esc(picked.title)+'</h3><p>'+esc(picked.format)+' · '+esc(picked.audio)+(picked.venue?" · "+esc(picked.venue):"")+'</p><div class="actions"><button class="btn primary" data-action="watched" data-id="'+esc(picked.id)+'">MARK AS '+(picked.watched?"UNWATCHED":"WATCHED")+'</button><button class="btn" data-action="edit" data-id="'+esc(picked.id)+'">VIEW DETAILS</button></div></div>':"");
}
function backupPage(){
 return '<div class="section-head"><div><h2>Backup & Import</h2><p>Keep your collection safe on your iPhone.</p></div></div>'+
 '<div class="notice">Your catalog and cover photos are saved privately in this Home Screen app or browser. Different browser contexts may have different collections. <strong>Keep one permanent app icon and save occasional backups.</strong></div>'+
 '<div class="backup-grid"><div class="panel"><h2>Save full backup</h2><p>Downloads a JSON file containing your concert entries and any locally uploaded cover photos. Store it in Files or iCloud Drive.</p><button class="btn primary" data-action="export">↓ DOWNLOAD COMPLETE BACKUP</button></div>'+
 '<div class="panel"><h2>Restore / merge backup</h2><p>Safely adds concerts missing from this installation. Existing entries are not overwritten, and duplicate titles are skipped.</p><button class="btn" data-action="restore">↑ CHOOSE BACKUP FILE</button></div></div>'+
 '<div class="panel"><h2>Import from Scout</h2><p>Send a photo of concert disc covers to Scout in your existing conversation. Paste the JSON batch Scout creates below. Only entries you confirm are added, and duplicates are skipped.</p><form id="scoutBatchForm"><label class="field wide">SCOUT CONCERT BATCH<textarea name="batch" rows="6" required placeholder=\'{"format":"scout-concert-batch","concerts":[{"artist":"...","title":"...","format":"Blu-ray","status":"Owned"}]}\'></textarea></label><div class="actions" style="margin-top:12px"><button class="btn primary" type="submit">IMPORT BATCH</button></div></form></div>';
}
function details(){if(storageProblem)return '<div class="notice alert">Saved catalog data cannot be read. The app has not reset or overwritten it. Use a previous backup or the original Home Screen app where you saved your concerts.</div>';if(recovered)return '<div class="notice">Recovered a previous collection from a local safety copy. Download a full backup now.</div>';return "";}
function render(){
 view=location.hash.replace(/^#/,"")||"collection";if(!["collection","wishlist","pick","backup"].includes(view))view="collection";
 $("view").innerHTML=details()+(view==="collection"?header()+collectionPage():view==="wishlist"?collectionPage(true):view==="pick"?pickPage():backupPage());
 document.querySelectorAll("[data-nav]").forEach(x=>x.classList.toggle("active",x.dataset.nav===view));
 urls.forEach(x=>URL.revokeObjectURL(x));urls=[];hydrateCovers().catch(e=>console.warn("Cover hydration",e));
}
async function hydrateCovers(){const nodes=[...document.querySelectorAll("[data-cover]")];for(const node of nodes){const id=node.getAttribute("data-cover"),blob=await coverGet(id);if(!node.isConnected||!blob)continue;const url=URL.createObjectURL(blob);urls.push(url);const image=document.createElement("img");image.alt="Your cover photo";image.src=url;const placeholder=node.querySelector(".no-cover");if(placeholder)placeholder.replaceWith(image);}}
function openModal(id){
 const d=state.discs.find(x=>x.id===id);
 const x=d||normalize({});
 editing=d?.id||null;
 const select=(name,values,value)=>'<label class="field">'+name.toUpperCase()+'<select name="'+name+'">'+opts(values,value)+'</select></label>';
 const inp=(name,label,value,type="text")=>'<label class="field">'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(name==="artist"||name==="title"?"required":"")+' maxlength="180"></label>';
 const h='<div class="modal-backdrop" id="modalBackdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Concert details">'+
 '<div class="modal-head"><div><span class="eyebrow">CONCERT VAULT</span><h2>'+(d?"Edit your disc":"Add a concert")+'</h2></div><button class="btn" data-action="close">✕</button></div>'+
 '<form id="discForm"><div class="form-grid">'+inp("artist","Artist / band",x.artist)+inp("title","Concert title",x.title)+
 select("format",FMT,x.format)+select("status",STATS,x.status)+inp("year","Concert year",x.year)+inp("releaseYear","Release year",x.releaseYear)+inp("venue","Venue / location",x.venue)+select("audio",AUDIO,x.audio)+inp("discs","Number of discs",x.discs,"number")+
 '<label class="field">YOUR RATING<select name="rating">'+opts(["0","1","2","3","4","5"],String(x.rating))+'</select></label>'+
 '<label class="field">WATCHED<select name="watched">'+opts(["No","Yes"],x.watched?"Yes":"No")+'</select></label>'+
 '<label class="field">FAVORITE<select name="favorite">'+opts(["No","Yes"],x.favorite?"Yes":"No")+'</select></label>'+
 '<label class="field wide">NOTES, SONG HIGHLIGHTS, EDITION INFO<textarea name="notes" maxlength="3000" rows="4" placeholder="Favorite performance, sound mix, bonus songs, how the disc looks on your TV…">'+esc(x.notes)+'</textarea></label></div>'+
 '<div class="modal-foot"><div class="actions">'+(d?'<button type="button" class="btn" data-action="cover" data-id="'+esc(d.id)+'">📷 ADD / CHANGE COVER</button><button type="button" class="btn danger" data-action="delete" data-id="'+esc(d.id)+'">DELETE</button>':"")+'</div><button type="submit" class="btn primary">SAVE CONCERT</button></div></form></div></div>';
 $("modalRoot").innerHTML=h;$("modalRoot").querySelector("input")?.focus();
}
function closeModal(){$("modalRoot").innerHTML="";}
function saveForm(form){
 if(storageProblem){toast("Storage is in recovery mode");return;}
 const data=Object.fromEntries(new FormData(form).entries());
 const original=state.discs.find(x=>x.id===editing);
 const result=normalize(Object.assign({},original||{},data,{watched:data.watched==="Yes",favorite:data.favorite==="Yes",updatedAt:now()}));
 if(!result.artist||!result.title){toast("Enter artist and concert title");return;}
 if(original)Object.assign(original,result);else{result.id=uuid();state.discs.push(result);}
 if(save()){closeModal();render();toast(original?"Concert updated":"Concert added");}
}
function addBatch(json){
 let payload;try{payload=JSON.parse(json);}catch{throw Error("Paste valid JSON from Scout");}
 const list=Array.isArray(payload)?payload:payload&&payload.format==="scout-concert-batch"&&Array.isArray(payload.concerts)?payload.concerts:null;
 if(!list||!list.length||list.length>100)throw Error("Expected a nonempty Scout concert batch with up to 100 entries");
 const keys=new Set(state.discs.map(discKey)),added=[];let dup=0;
 for(const obj of list){
  if(!obj||typeof obj!=="object"||!cleanText(obj.artist,160)||!cleanText(obj.title,180))throw Error("Each entry needs a readable artist and concert title");
  const clean=normalize(Object.assign({format:"Other"},obj));const key=discKey(clean);
  if(keys.has(key)){dup++;continue;}keys.add(key);clean.id=uuid();added.push(clean);
 }
 if(!added.length)return {added:0,duplicates:dup};
 if(!confirm("Add "+added.length+" concerts to your local library? "+dup+" duplicates will be skipped."))return {added:0,duplicates:dup,cancelled:true};
 state.discs.push(...added);if(!save())throw Error("Could not save imported discs");return {added:added.length,duplicates:dup};
}
async function backupExport(){
 toast("Preparing backup with cover photos…");
 try{const covers={};for(const d of state.discs){const blob=await coverGet(d.id);if(blob)covers[d.id]=await fileToData(blob);}
 const payload={format:"encore-concert-vault",exportVersion:1,exportedAt:now(),data:state,covers};
 const date=new Date().toISOString().slice(0,10);download("Encore-Concert-Vault-"+date+".json",JSON.stringify(payload));
 toast("Backup downloaded. Save it to Files.");}catch(e){toast("Backup failed: "+e.message);}
}
async function backupImport(file){
 if(!file)return;
 try{
  if(file.size>100*1024*1024)throw Error("Backup exceeds 100MB");
  const data=JSON.parse(await file.text());
  if(data.format!=="encore-concert-vault"||!data.data||!Array.isArray(data.data.discs))throw Error("Not a Concert Vault backup");
  const owned=new Set(state.discs.map(discKey));
  const incoming=data.data.discs.map(normalize).filter(x=>x.artist&&x.title);
  const newDiscs=[],sourceIds=[];for(const d of incoming){const key=discKey(d);if(owned.has(key))continue;owned.add(key);const sourceId=d.id;if(state.discs.some(x=>x.id===d.id))d.id=uuid();newDiscs.push(d);sourceIds.push(sourceId);}
  if(!newDiscs.length){toast("No new concerts; existing records preserved");return;}
  if(!confirm("Merge "+newDiscs.length+" new concerts from backup? Your existing collection will stay unchanged."))return;
  const covers=Array.isArray(data.covers)?{}:data.covers||{};
  for(let i=0;i<newDiscs.length;i++){const d=newDiscs[i];const raw=covers[sourceIds[i]];if(typeof raw==="string"&&raw.length<12*1024*1024){await coverPut(d.id,dataToBlob(raw));}}
  state.discs.push(...newDiscs);if(!save())throw Error("Could not save merged data");
  render();toast("Merged "+newDiscs.length+" new concerts");
 }catch(e){toast("Import failed: "+e.message);}
}
function bind(){
 document.addEventListener("click",async e=>{
  const button=e.target.closest("button");if(!button)return;
  if(button.dataset.nav){location.hash="#"+button.dataset.nav;return;}
  if(button.dataset.view){location.hash="#"+button.dataset.view;return;}
  const action=button.dataset.action,id=button.dataset.id;
  if(action==="add")openModal();
  if(action==="edit")openModal(id);
  if(action==="close")closeModal();
  if(action==="cover"){coverFor=id;$("coverPicker").value="";$("coverPicker").click();}
  if(action==="favorite"||action==="watched"){const d=state.discs.find(x=>x.id===id);if(!d)return;d[action==="favorite"?"favorite":"watched"]=!d[action==="favorite"?"favorite":"watched"];d.updatedAt=now();save();render();}
  if(action==="delete"){const d=state.discs.find(x=>x.id===id);if(!d||!confirm('Delete "'+d.title+'" from this device?'))return;state.discs=state.discs.filter(x=>x.id!==id);if(save()){await coverDelete(id);closeModal();render();toast("Concert removed");}}
  if(action==="pick"||action==="pick-unwatched"){const discs=state.discs.filter(x=>x.status==="Owned"&&(action==="pick"||!x.watched));pickId=discs[Math.floor(Math.random()*discs.length)]?.id||null;render();}
  if(action==="export")await backupExport();
  if(action==="restore"){$("backupPicker").value="";$("backupPicker").click();}
 });
 document.addEventListener("submit",e=>{
  if(e.target.id==="discForm"){e.preventDefault();saveForm(e.target);}
  if(e.target.id==="scoutBatchForm"){e.preventDefault();try{const batch=new FormData(e.target).get("batch");const res=addBatch(String(batch||""));if(!res.cancelled){render();toast(res.added+" concert(s) added; "+res.duplicates+" duplicates skipped");}}catch(err){toast("Import error: "+err.message);}}
 });
 document.addEventListener("change",async e=>{
  if(e.target.id==="formatFilter"){formatFilter=e.target.value;render();}
  if(e.target.id==="coverPicker"){const file=e.target.files?.[0];if(!file||!coverFor)return;try{const blob=await photoCompressed(file);await coverPut(coverFor,blob);closeModal();render();toast("Cover saved");}catch(err){toast(err.message);}}
  if(e.target.id==="backupPicker")await backupImport(e.target.files?.[0]);
 });
 document.addEventListener("input",e=>{
  if(e.target.id==="searchInput"){search=e.target.value;const pos=e.target.selectionStart;render();const node=$("searchInput");if(node){node.focus();node.setSelectionRange(pos,pos);}}
 });
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
 window.addEventListener("hashchange",render);
 $("modalRoot").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal();});
}
async function start(){load();bind();await openDB();render();if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(e=>console.warn(e));}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();