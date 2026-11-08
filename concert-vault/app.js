/* Encore Concert Vault • free local-first physical concert collection */
(function(){
"use strict";
const KEY="encoreConcertVaultV1",SAFETY="encoreConcertVaultSafetyV1",DB_NAME="encoreConcertCoversV1";
const FMT=["Blu-ray","DVD","4K UHD","Other"],STATS=["Owned","Wishlist"],AUDIO=["Unknown","Stereo","Dolby Digital 5.1","DTS 5.1","DTS-HD Master Audio","Dolby TrueHD","Dolby Atmos","PCM 2.0","PCM 5.1","Other"];
let state={version:1,discs:[]},db=null,view="collection",search="",formatFilter="All",editing=null,coverFor=null,pickId=null,storageProblem=false,recovered=false,urls=[],coverQueue=[],coverIds=new Set(),coverBytes=0,coverFilter="",coverBusy=false;
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
async function photoCompressed(file,maxEdge=900,jpegQuality=.84){
 if(!file||!file.type.startsWith("image/"))throw Error("Choose a photo");
 if(file.size>25*1024*1024)throw Error("Choose a cover photo under 25 MB");
 const source=URL.createObjectURL(file);
 try{const img=new Image();img.src=source;await new Promise((yes,no)=>{if(img.complete&&img.naturalWidth)yes();else{img.onload=yes;img.onerror=()=>no(Error("Could not open photo"));}});
  const scale=Math.min(1,maxEdge/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(yes=>canvas.toBlob(yes,"image/jpeg",jpegQuality));if(!blob)throw Error("Unable to compress photo");return blob;
 }finally{URL.revokeObjectURL(source);}
}
function counts(){return {owned:state.discs.filter(x=>x.status==="Owned").length,wishlist:state.discs.filter(x=>x.status==="Wishlist").length,favorites:state.discs.filter(x=>x.favorite&&x.status==="Owned").length,unwatched:state.discs.filter(x=>x.status==="Owned"&&!x.watched).length};}

// IndexedDB is local to this app/device. Never upload a cover photo to GitHub or another service.
function bytesLabel(value){
 const n=Number(value)||0;
 if(n<1024)return Math.round(n)+" B";
 if(n<1024*1024)return (n/1024).toFixed(1)+" KB";
 if(n<1024*1024*1024)return (n/(1024*1024)).toFixed(1)+" MB";
 return (n/(1024*1024*1024)).toFixed(2)+" GB";
}
function listStoredCovers(){
 return new Promise(resolve=>{
  if(!db){resolve({ids:new Set(),bytes:0,available:false});return;}
  let bytes=0;const ids=new Set();
  try{
   const tx=db.transaction("covers","readonly");
   const cursor=tx.objectStore("covers").openCursor();
   cursor.onsuccess=()=>{
    const row=cursor.result;
    if(!row)return;
    if(row.value instanceof Blob){ids.add(String(row.key));bytes+=row.value.size;}
    row.continue();
   };
   tx.oncomplete=()=>resolve({ids,bytes,available:true});
   tx.onerror=()=>resolve({ids,bytes,available:false});
   tx.onabort=()=>resolve({ids,bytes,available:false});
  }catch(e){resolve({ids,bytes,available:false});}
 });
}
async function refreshCoverStats(){
 const found=await listStoredCovers();
 if(found.available){coverIds=found.ids;coverBytes=found.bytes;}
 if(view!=="covers")return;
 const covered=state.discs.filter(d=>coverIds.has(d.id)).length;
 const summary=$("coverStorage");
 if(summary){
  let note=found.available?
   '<strong>'+covered+' of '+state.discs.length+' covers saved</strong> · '+bytesLabel(coverBytes)+' used by Encore cover images on this device.':
   'Cover image storage is unavailable in this browser. Try opening the existing Home Screen app.';
  summary.innerHTML=note;
 }
 const remaining=$("coverMissing");
 if(remaining){
  const missing=state.discs.filter(d=>!coverIds.has(d.id));
  remaining.innerHTML=missing.length?
   '<p>'+missing.length+' concert'+(missing.length===1?' is':'s are')+' still missing a cover.</p><div class="missing-tags">'+missing.slice(0,25).map(d=>'<span class="pill">'+esc(d.artist)+' · '+esc(d.title)+'</span>').join("")+'</div>'+(
    missing.length>25?'<p>…and '+(missing.length-25)+' more.</p>':""):
   '<p>Every cataloged concert now has a cover photo. Nice!</p>';
 }
 const budget=$("coverBudget");
 if(budget){
  budget.textContent="Checking browser-reported storage budget…";
  try{
   if(navigator.storage&&typeof navigator.storage.estimate==="function"){
    const estimate=await navigator.storage.estimate();
    if(estimate&&Number.isFinite(estimate.usage)&&Number.isFinite(estimate.quota)){
     budget.textContent="Browser storage estimate: "+bytesLabel(estimate.usage)+" used of a "+bytesLabel(estimate.quota)+" quota. This includes other data for this site and is NOT a guarantee of free iPhone space.";
    }else budget.textContent="This browser cannot report an available storage estimate.";
   }else budget.textContent="Your browser does not provide a storage quota estimate. Cover usage above is measured directly.";
  }catch{budget.textContent="Browser storage quota estimate unavailable. Your saved cover size is shown above.";}
 }
}
function discLabel(d){return d.artist+" — "+d.title+" ("+d.format+")";}
function coverOptions(selected){
 const filtered=state.discs.slice().sort((a,b)=>a.artist.localeCompare(b.artist)||a.title.localeCompare(b.title))
  .filter(d=>!coverFilter||discLabel(d).toLowerCase().includes(coverFilter.toLowerCase())||d.id===selected);
 return '<option value="">Choose concert…</option>'+filtered.map(d=>
  '<option value="'+esc(d.id)+'" '+(d.id===selected?'selected':'')+'>'+
  esc(discLabel(d))+(coverIds.has(d.id)?' · HAS COVER':' · NO COVER')+'</option>').join("");
}
function coverHelperPage(){
 return '<div class="section-head"><div><h2>Cover Helper</h2><p>Photograph cases and match them to your concert entries.</p></div></div>'+
 '<div class="panel"><span class="eyebrow">PRIVATE · STORED LOCALLY</span><h2>Your cases, your collection</h2>'+
 '<p>These photos are resized, compressed and stored in this app on your device — <strong>not on GitHub</strong>. Select multiple cover photos from Photos, or use your camera for one at a time. No paid services required.</p>'+
 '<div class="actions"><button class="btn primary" data-action="cover-batch">📷 CHOOSE MULTIPLE PHOTOS</button><button class="btn" data-action="cover-camera">TAKE ONE PHOTO</button></div>'+
 '<p class="meta">One image per concert entry. We will ask before replacing a saved cover. Matching is manual so your covers never get assigned to the wrong concert by AI.</p></div>'+
 '<div class="panel"><h2>Local photo storage</h2><p id="coverStorage">Checking saved cover space…</p>'+
 '<p class="meta" id="coverBudget">Checking browser storage estimate…</p>'+
 '<p class="meta"><strong>Important:</strong> deleting the Home Screen app, clearing website data or changing devices can remove local photos. Backup & Import can save a full copy to Files or iCloud Drive.</p>'+
 '<div class="actions"><button class="btn small" data-action="cover-refresh">↻ REFRESH STORAGE</button><button class="btn small" data-view="backup">BACKUP MY COLLECTION</button></div></div>'+
 '<div class="panel"><div class="section-head" style="margin-top:0"><div><h2>Match your photos</h2><p>Pick the matching concert for each photo, then save.</p></div></div>'+
 '<label class="field" style="max-width:450px;margin-bottom:14px">FILTER CONCERT TITLES<input type="search" id="coverFilter" placeholder="Search artist or concert title…" value="'+esc(coverFilter)+'"></label>'+
 '<div id="coverQueue"></div></div>'+
 '<div class="panel"><h2>Still needs cover art</h2><div id="coverMissing"><p>Checking your collection…</p></div></div>';
}
function drawCoverQueue(){
 const host=$("coverQueue");if(!host)return;
 if(!coverQueue.length){host.innerHTML='<div class="empty">No photos waiting to be matched. Select a few cover pictures above to begin.</div>';return;}
 host.innerHTML='<div class="cover-queue">'+coverQueue.map(q=>
  '<article class="cover-queue-item"><img src="'+esc(q.url)+'" alt="Photo waiting to be matched" loading="lazy">'+
  '<div class="cover-queue-details"><div class="meta">'+esc(q.fileName)+' · '+bytesLabel(q.blob.size)+' after compression</div>'+
  '<label class="field">MATCH TO CONCERT<select data-cover-target="'+esc(q.id)+'" '+(coverBusy?"disabled":"")+'>'+coverOptions(q.target)+'</select></label>'+
  '<div class="actions"><button class="btn small primary" data-action="cover-save-one" data-id="'+esc(q.id)+'" '+(!q.target||coverBusy?"disabled":"")+'>SAVE TO CONCERT</button>'+
  '<button class="btn small" data-action="cover-remove-one" data-id="'+esc(q.id)+'" '+(coverBusy?"disabled":"")+'>REMOVE</button></div></div></article>').join("")+'</div>'+
 '<div class="cover-queue-footer"><span class="meta">'+coverQueue.filter(q=>q.target).length+' of '+coverQueue.length+' matched</span>'+
 '<div class="actions"><button class="btn primary" data-action="cover-save-all" '+(coverBusy||!coverQueue.some(q=>q.target)?"disabled":"")+'>SAVE ALL MATCHED</button>'+
 '<button class="btn" data-action="cover-clear" '+(coverBusy?"disabled":"")+'>CLEAR UNSAVED PHOTOS</button></div></div>';
}
async function addCoverFiles(files){
 if(!files.length||coverBusy)return;
 if(!state.discs.length){toast("Add your concert entries before assigning cover photos.");return;}
 if(!db){toast("Local photo storage is not available on this device");return;}
 const remaining=Math.max(0,24-coverQueue.length);
 if(!remaining){toast("Save or clear this batch before selecting more photos (24 maximum).");return;}
 const chosen=files.slice(0,remaining);
 coverBusy=true;
 let errors=0;let added=0;
 try{
  for(const file of chosen){
   try{
    const blob=await photoCompressed(file,720,.78);
    const url=URL.createObjectURL(blob);
    coverQueue.push({id:uuid(),fileName:cleanText(file.name||"Camera photo",120),blob,url,target:""});
    added++;
   }catch(e){errors++;console.warn("Skipping unusable cover photo",e);}
  }
 }finally{coverBusy=false;}
 drawCoverQueue();
 toast(added+" cover photo"+(added===1?"":"s")+" ready to match"+(errors?", "+errors+" skipped":"")+".");
}
function removeQueued(id){
 const i=coverQueue.findIndex(q=>q.id===id);
 if(i<0)return;
 URL.revokeObjectURL(coverQueue[i].url);
 coverQueue.splice(i,1);
 drawCoverQueue();
}
function clearQueued(){
 for(const q of coverQueue)URL.revokeObjectURL(q.url);
 coverQueue=[];
 drawCoverQueue();
}
async function saveQueued(ids){
 if(coverBusy||storageProblem)return;
 const chosen=coverQueue.filter(q=>ids.includes(q.id)&&q.target);
 if(!chosen.length){toast("Choose a concert for each cover first.");return;}
 if(!db){toast("Local image storage unavailable");return;}
 const targets=chosen.map(q=>q.target);
 if(new Set(targets).size!==targets.length){toast("Two photos are matched to the same concert. Select different entries.");return;}
 if(targets.some(id=>!state.discs.some(d=>d.id===id))){toast("A selected concert is no longer in the catalog.");return;}
 const overwritten=[];
 for(const id of targets){if(await coverGet(id))overwritten.push(id);}
 if(overwritten.length&&!confirm("Replace "+overwritten.length+" existing cover"+(overwritten.length===1?"":"s")+" with the selected photos?"))return;
 coverBusy=true;drawCoverQueue();
 let done=0;
 try{
  for(const q of chosen){
   await coverPut(q.target,q.blob);
   const idx=coverQueue.findIndex(x=>x.id===q.id);
   if(idx>=0){URL.revokeObjectURL(coverQueue[idx].url);coverQueue.splice(idx,1);}
   done++;
  }
 }catch(e){toast("Some photos were not saved: "+(e.message||e));}
 finally{coverBusy=false;drawCoverQueue();await refreshCoverStats();}
 if(done)toast(done+" cover photo"+(done===1?"":"s")+" saved locally to concert entries.");
}

function discKey(d){return [d.artist,d.title,d.format].map(x=>x.toLowerCase().trim().replace(/\s+/g," ")).join("|");}
function header(){const c=counts();return '<section class="hero"><span class="eyebrow">YOUR LIVE MUSIC LIBRARY</span><h2>The concert never ends.</h2><p>Catalog the concert DVDs, Blu-rays, and 4K discs on your shelves. Keep track of great performances, surround sound mixes, favorites, and the next show to play.</p><div class="actions"><button class="btn primary" data-action="add">+ ADD A CONCERT</button><button class="btn ghost" data-view="pick">♫ WHAT SHOULD I WATCH?</button></div></section><div class="stats"><div class="stat"><strong>'+c.owned+'</strong><span>Owned discs</span></div><div class="stat"><strong>'+c.wishlist+'</strong><span>Wishlist</span></div><div class="stat"><strong>'+c.favorites+'</strong><span>Favorites</span></div><div class="stat"><strong>'+c.unwatched+'</strong><span>Not watched yet</span></div></div>';}
function discCard(d){return '<article class="disc"><div class="cover" data-cover="'+esc(d.id)+'"><span class="no-cover">♫</span><span class="format">'+esc(d.format)+'</span></div><div class="disc-info"><span class="artist">'+esc(d.artist)+'</span><h3>'+esc(d.title)+'</h3><div class="meta">'+esc(d.year||d.releaseYear||"Year unknown")+(d.venue?' · '+esc(d.venue):'')+'</div><div class="meta">'+esc(d.audio)+(d.watched?' · Watched':'')+'</div><div class="meta stars">'+(d.favorite?"★ Favorite · ":"")+(d.rating>0?"★".repeat(d.rating):"")+'</div><div class="actions"><button class="btn small" data-action="edit" data-id="'+esc(d.id)+'">DETAILS</button><button class="btn small" data-action="favorite" data-id="'+esc(d.id)+'">'+(d.favorite?"★":"☆")+'</button><button class="btn small" data-action="watched" data-id="'+esc(d.id)+'">'+(d.watched?"WATCHED ✓":"WATCHED?")+'</button></div></div></article>';}
function collectionPage(wishlist=false){
 const discs=state.discs.filter(d=>(wishlist?d.status==="Wishlist":d.status==="Owned")&&[d.artist,d.title,d.venue,d.notes,d.audio].join(" ").toLowerCase().includes(search.toLowerCase())&&(formatFilter==="All"||d.format===formatFilter)).sort((a,b)=>a.artist.localeCompare(b.artist)||a.title.localeCompare(b.title));
 return '<div class="section-head"><div><h2>'+(wishlist?"Wish List":"Your Concert Collection")+'</h2><p>'+(wishlist?"Concerts you hope to own someday.":"Your discs, performances and memories — all in one place.")+'</p></div><div class="actions"><button class="btn" data-view="covers">📷 COVER HELPER</button><button class="btn primary" data-action="add">+ ADD</button></div></div>'+
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
 view=location.hash.replace(/^#/,"")||"collection";if(!["collection","wishlist","pick","backup","covers"].includes(view))view="collection";
 $("view").innerHTML=details()+(view==="collection"?header()+collectionPage():view==="wishlist"?collectionPage(true):view==="pick"?pickPage():view==="covers"?coverHelperPage():backupPage());
 document.querySelectorAll("[data-nav]").forEach(x=>x.classList.toggle("active",x.dataset.nav===view));
 urls.forEach(x=>URL.revokeObjectURL(x));urls=[];hydrateCovers().catch(e=>console.warn("Cover hydration",e));
 if(view==="covers"){drawCoverQueue();refreshCoverStats().then(()=>{if(view==="covers")drawCoverQueue();}).catch(e=>console.warn("Cover metrics",e));}
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
  if(action==="cover-batch"){$("coverBatchPicker").value="";$("coverBatchPicker").click();}
  if(action==="cover-camera"){$("coverCameraPicker").value="";$("coverCameraPicker").click();}
  if(action==="cover-refresh")await refreshCoverStats();
  if(action==="cover-clear"&&!coverBusy&&confirm("Discard "+coverQueue.length+" unsaved photos from this batch?"))clearQueued();
  if(action==="cover-remove-one"&&!coverBusy)removeQueued(id);
  if(action==="cover-save-one")await saveQueued([id]);
  if(action==="cover-save-all")await saveQueued(coverQueue.filter(q=>q.target).map(q=>q.id));
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
  if("coverTarget" in e.target.dataset){const item=coverQueue.find(q=>q.id===e.target.dataset.coverTarget);if(item)item.target=e.target.value;drawCoverQueue();}
  if(e.target.id==="coverBatchPicker")await addCoverFiles(Array.from(e.target.files||[]));
  if(e.target.id==="coverCameraPicker")await addCoverFiles(Array.from(e.target.files||[]));
  if(e.target.id==="coverPicker"){const file=e.target.files?.[0];if(!file||!coverFor)return;try{const blob=await photoCompressed(file);await coverPut(coverFor,blob);closeModal();render();toast("Cover saved locally");}catch(err){toast(err.message);}}
  if(e.target.id==="backupPicker")await backupImport(e.target.files?.[0]);
 });
 document.addEventListener("input",e=>{
  if(e.target.id==="coverFilter"){coverFilter=e.target.value;drawCoverQueue();return;}
  if(e.target.id==="searchInput"){search=e.target.value;const pos=e.target.selectionStart;render();const node=$("searchInput");if(node){node.focus();node.setSelectionRange(pos,pos);}}
 });
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
 window.addEventListener("hashchange",render);
 $("modalRoot").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal();});
}
async function start(){load();bind();await openDB();render();if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(e=>console.warn(e));}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();