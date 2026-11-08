/* Miniature Paint Studio • v1.0 • local-first, privacy-conscious painting companion */
(function(){
"use strict";
const APP_KEY="miniPaintStudioV1";
const DB_NAME="miniPaintStudioPhotosV1";
const PHOTO_SLOTS=["before","reference","concept","finished"];
const STATUS=["Unpainted","Primed","Painting","Finished"];
const STAGES=["Prep & prime","Basecoat","Shadows & washes","Highlights","Faces & details","Base & terrain","Varnish & photograph"];
const SCHEMES=[
 {id:"renaissance",name:"Renaissance Adventurer",colors:["#693e36","#835c39","#a7abb0","#e2cbb0","#374f43"],note:"Burgundy cloth, worn brown leather, steel blades and weathered linen."},
 {id:"mercenary",name:"Grim Mercenary",colors:["#303b3e","#512e38","#98643e","#a7a19a","#c4ae82"],note:"Charcoal cloth, oxblood accents, bronze buckles and aged leather."},
 {id:"heroic",name:"Bright Hero",colors:["#2b527b","#cdac55","#f0d7ad","#6f4935","#a9bbc2"],note:"Blue tunic, warm gold, parchment ivory and polished metal."},
 {id:"forest",name:"Forest Ranger",colors:["#3c5c3b","#77613f","#d3be8f","#654333","#b3ac74"],note:"Olive and moss cloth, earthy leather, tan canvas and natural wood."},
 {id:"inferno",name:"Infernal Champion",colors:["#252326","#bd482b","#f4a631","#f9dc69","#6f737a"],note:"Blackened armor with red-orange flames and hot yellow centers."}
];
const LESSONS=Array.isArray(window.PaintAcademy)?window.PaintAcademy:[];
const $=id=>document.getElementById(id);
const esc=value=>String(value==null?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const now=()=>new Date().toISOString();
const shortDate=value=>{const d=new Date(value);return isNaN(d.getTime())?"Unknown":d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});};
const ID=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():"m"+Date.now().toString(36)+Math.random().toString(36).slice(2);
let state={version:1,miniatures:[],paints:[],lessonProgress:{}},db=null,route="home",activeMiniId="",activeLessonId="",photoTarget=null,photoUrls=[],renderSerial=0,toastTimer=0,projectFilter="all",projectSearch="",paintSearch="";
const sample={
 id:"nova-warrior",name:"Dual-Axe Warrior",game:"Nova Aetas Renaissance",type:"Character / Hero",status:"Unpainted",
 notes:"A rugged dual-weapon fighter. First Studio project. Add the original miniature photograph and character card artwork whenever convenient.",
 schemeId:"renaissance",customColors:[],steps:[],journal:[],createdAt:now(),updatedAt:now()
};
function normalizeMini(item){
 const base={id:ID(),name:"Untitled miniature",game:"",type:"Character / Hero",status:"Unpainted",notes:"",schemeId:"",customColors:[],steps:[],journal:[],createdAt:now(),updatedAt:now()};
 const x=Object.assign(base,item||{});
 x.name=String(x.name||"Untitled miniature").slice(0,120);
 x.game=String(x.game||"").slice(0,120);
 x.notes=String(x.notes||"").slice(0,2000);
 x.type=String(x.type||"Character / Hero").slice(0,70);
 x.status=STATUS.includes(x.status)?x.status:"Unpainted";
 x.steps=Array.isArray(x.steps)?x.steps.filter(v=>Number.isInteger(v)&&v>=0&&v<STAGES.length):[];
 x.journal=Array.isArray(x.journal)?x.journal.filter(j=>j&&typeof j.text==="string").slice(-100).map(j=>({id:String(j.id||ID()),at:String(j.at||now()),text:j.text.slice(0,3000)})):[];
 x.customColors=Array.isArray(x.customColors)?x.customColors.filter(c=>/^#[0-9a-f]{6}$/i.test(c)).slice(0,8):[];
 return x;
}
function normalizePaint(p){
 const x=Object.assign({id:ID(),brand:"Vallejo",range:"Game Color",name:"",number:"",color:"#8a7357",notes:"",quantity:1},p||{});
 x.name=String(x.name||"").slice(0,90);x.brand=String(x.brand||"Vallejo").slice(0,60);x.range=String(x.range||"").slice(0,60);
 x.number=String(x.number||"").slice(0,30);x.notes=String(x.notes||"").slice(0,500);x.quantity=Math.max(0,Math.min(99,Number(x.quantity)||0));
 x.color=/^#[0-9a-f]{6}$/i.test(x.color)?x.color:"#8a7357";return x;
}
function load(){
 try{
  const parsed=JSON.parse(localStorage.getItem(APP_KEY)||"null");
  if(parsed&&Array.isArray(parsed.miniatures)){
   state={version:1,miniatures:parsed.miniatures.map(normalizeMini),paints:Array.isArray(parsed.paints)?parsed.paints.map(normalizePaint):[],lessonProgress:parsed.lessonProgress&&typeof parsed.lessonProgress==="object"?parsed.lessonProgress:{}};
   return;
  }
 }catch(e){console.warn("Studio data load",e);}
 state.miniatures=[normalizeMini(sample)];save();
}
function save(){
 try{localStorage.setItem(APP_KEY,JSON.stringify(state));return true;}
 catch(err){notice("Device storage is full. Export a backup and free space.");console.warn("Studio save",err);return false;}
}
function notice(msg){
 const box=$("toast");if(!box)return;
 box.textContent=msg;box.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove("show"),3800);
}
function mini(id){return state.miniatures.find(p=>p.id===id);}
function withScheme(p){return SCHEMES.find(x=>x.id===p.schemeId)||SCHEMES[0];}
function sourcePalette(p){
 if(p.customColors&&p.customColors.length)return {name:"Artwork-inspired palette",colors:p.customColors,note:"Sampled from your artwork photo; choose individual colors thoughtfully before painting."};
 return withScheme(p);
}
function openDb(){
 return new Promise(resolve=>{
  if(!window.indexedDB){resolve(null);return;}
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{const target=req.result;if(!target.objectStoreNames.contains("photos"))target.createObjectStore("photos");};
  req.onsuccess=()=>{db=req.result;db.onversionchange=()=>db.close();resolve(db);};
  req.onerror=()=>{console.warn("Photo storage unavailable",req.error);resolve(null);};
  req.onblocked=()=>resolve(null);
 });
}
function photoKey(id,slot){return id+":"+slot;}
function photoGet(id,slot){
 return new Promise(resolve=>{
  if(!db){resolve(null);return;}
  try{
   const request=db.transaction("photos","readonly").objectStore("photos").get(photoKey(id,slot));
   request.onsuccess=()=>resolve(request.result instanceof Blob?request.result:null);
   request.onerror=()=>resolve(null);
  }catch{resolve(null);}
 });
}
function photoSet(id,slot,blob){
 return new Promise((resolve,reject)=>{
  if(!db){reject(new Error("Photo storage is unavailable on this device."));return;}
  try{
   const tx=db.transaction("photos","readwrite");tx.objectStore("photos").put(blob,photoKey(id,slot));
   tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||Error("Unable to save photo"));
  }catch(e){reject(e);}
 });
}
function photoDelete(id,slot){
 return new Promise((resolve,reject)=>{
  if(!db){resolve();return;}
  try{
   const tx=db.transaction("photos","readwrite");tx.objectStore("photos").delete(photoKey(id,slot));
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error("Unable to remove photo"));
  }catch(e){reject(e);}
 });
}
function photoClear(){
 return new Promise((resolve,reject)=>{
  if(!db){resolve();return;}
  const tx=db.transaction("photos","readwrite");tx.objectStore("photos").clear();
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
 });
}
function revokePhotoUrls(){photoUrls.forEach(u=>URL.revokeObjectURL(u));photoUrls=[];}
async function hydratePhotos(serial){
 const nodes=[...document.querySelectorAll("[data-photo-key]")];
 for(const node of nodes){
  const [id,slot]=String(node.dataset.photoKey||"").split("|");
  const blob=await photoGet(id,slot);
  if(serial!==renderSerial)return;
  if(blob){
   const url=URL.createObjectURL(blob);photoUrls.push(url);
   node.innerHTML='<img src="'+esc(url)+'" alt="'+esc(slot)+" photo of "+esc(mini(id)?.name||"miniature")+'">';
  }
 }
}
async function decodePhoto(blob){
 if(!blob||!blob.type.startsWith("image/"))throw Error("Choose an image file.");
 if(blob.size>25*1024*1024)throw Error("Image is over 25 MB. Choose a smaller file.");
 const src=URL.createObjectURL(blob);
 try{
  const img=new Image();img.decoding="async";img.src=src;
  await new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth){resolve();return;}img.onload=resolve;img.onerror=()=>reject(Error("Could not open this image. Try JPG or PNG."));});
  const width=img.naturalWidth,height=img.naturalHeight;
  const ratio=Math.min(1,1600/Math.max(width,height));
  const c=document.createElement("canvas");c.width=Math.max(1,Math.round(width*ratio));c.height=Math.max(1,Math.round(height*ratio));
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  const output=await new Promise(resolve=>c.toBlob(resolve,"image/jpeg",.85));
  if(!output)throw Error("This browser could not compress the photo.");
  return output;
 }finally{URL.revokeObjectURL(src);}
}
function fileToDataUrl(blob){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error("Cannot read photo"));reader.readAsDataURL(blob);
 });
}
function dataUrlToBlob(value){
 const parts=String(value||"").split(",",2);
 if(parts.length<2||!/^data:image\/(?:jpeg|png|webp);base64$/i.test(parts[0]))throw Error("Invalid image in backup.");
 const mime=parts[0].slice(5).split(";")[0],binary=atob(parts[1]),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new Blob([bytes],{type:mime});
}
function download(name,content,type){
 const url=URL.createObjectURL(new Blob([content],{type:type||"application/octet-stream"}));
 const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function routeTo(page,id){
 const target=(["home","projects","inspiration","academy","paints","backup","mini","lesson"].includes(page)?page:"home");
 location.hash="#"+target+(id?"/"+encodeURIComponent(id):"");
}
function parseRoute(){
 const args=location.hash.slice(1).split("/");
 route=args[0]||"home";const id=args[1]?decodeURIComponent(args[1]):"";
 if(route==="mini"||route==="inspiration")activeMiniId=id||activeMiniId||state.miniatures[0]?.id||"";
 if(route==="lesson")activeLessonId=id||activeLessonId||LESSONS[0]?.id||"";
 if(route==="mini"&&!mini(activeMiniId))route="projects";
 if(route==="lesson"&&!LESSONS.find(l=>l.id===activeLessonId))route="academy";
 if(!["home","projects","inspiration","academy","paints","backup","mini","lesson"].includes(route))route="home";
}
function render(){
 parseRoute();renderSerial++;const serial=renderSerial;revokePhotoUrls();
 document.querySelectorAll("[data-nav]").forEach(el=>el.classList.toggle("active",el.dataset.nav===(route==="mini"?"projects":route==="lesson"?"academy":route)));
 const views={home:renderHome,projects:renderProjects,mini:renderMini,inspiration:renderInspiration,academy:renderAcademy,lesson:renderLesson,paints:renderPaints,backup:renderBackup};
 $("view").innerHTML=views[route]();
 hydratePhotos(serial).catch(e=>console.warn("Photo display",e));
}
function pct(n,d){return d?Math.round(100*n/d):0;}
function miniThumb(p){
 const symbol=p.type.includes("Monster")?"🐉":p.type.includes("Creature")?"🦌":"⚔️";
 return '<div class="mini-photo" data-photo-key="'+esc(p.id)+'|before"><span class="photo-placeholder">'+symbol+'</span><span class="state-tag">'+esc(p.status)+'</span></div>';
}
function miniCard(p){
 return '<article class="mini-card">'+miniThumb(p)+'<div class="mini-body"><div class="meta">'+esc(p.game||"Unassigned game")+'</div><h3>'+esc(p.name)+'</h3>'+
  '<div class="info">'+esc(p.type)+' · '+p.steps.length+' of '+STAGES.length+' painting stages completed</div>'+
  '<div class="step-progress"><span style="width:'+pct(p.steps.length,STAGES.length)+'%"></span></div>'+
  '<div class="mini-actions"><button class="btn btn-primary btn-sm" data-open-mini="'+esc(p.id)+'">OPEN PROJECT</button><button class="btn btn-outline btn-sm" data-inspire="'+esc(p.id)+'">COLOR LAB</button></div></div></article>';
}
function renderHome(){
 const total=state.miniatures.length,finished=state.miniatures.filter(m=>m.status==="Finished").length,active=state.miniatures.filter(m=>m.status==="Painting"||m.status==="Primed").length;
 const next=state.miniatures.filter(m=>m.status!=="Finished").sort((a,b)=>String(b.updatedAt).localeCompare(a.updatedAt))[0];
 const games=[...new Set(state.miniatures.map(m=>m.game).filter(Boolean))];
 return '<section class="hero"><div class="eyebrow">YOUR CREATIVE WORKBENCH</div><h1>From gray plastic<br>to tiny masterpieces.</h1><p>Organize your board-game miniatures, test color schemes, learn techniques, and save every brushstroke of progress. Built for your Vallejo painting station.</p><div class="actions"><button class="btn btn-light" data-navto="projects">⚔ MY MINIATURES</button><button class="btn btn-outline" data-navto="inspiration">✦ ART-TO-MINI LAB</button></div><div class="hero-stamp">⚔</div></section>'+
 '<div class="stats-grid"><div class="stat"><div class="stat-number">'+total+'</div><div class="stat-label">Miniatures</div></div><div class="stat"><div class="stat-number">'+finished+'</div><div class="stat-label">Finished</div></div><div class="stat"><div class="stat-number">'+active+'</div><div class="stat-label">In Progress</div></div><div class="stat"><div class="stat-number">'+state.paints.length+'</div><div class="stat-label">Paints Cataloged</div></div></div>'+
 '<div class="section-head"><div><h2 class="section-title">At the Workbench</h2><p class="section-sub">Pick up where you left off.</p></div><button class="btn btn-outline btn-sm" data-add-mini>+ ADD MINI</button></div>'+
 (next?'<div class="two-col"><article class="panel accent"><div class="eyebrow">YOUR NEXT MODEL</div><h2>'+esc(next.name)+'</h2><p>'+esc(next.game||"Unassigned game")+' · '+esc(next.status)+' · '+next.steps.length+'/'+STAGES.length+' painting stages</p><div class="step-progress"><span style="width:'+pct(next.steps.length,STAGES.length)+'%"></span></div><div class="actions" style="margin-top:17px"><button class="btn btn-primary" data-open-mini="'+esc(next.id)+'">OPEN PROJECT</button><button class="btn btn-outline" data-inspire="'+esc(next.id)+'">PREVIEW COLORS</button></div></article>'+
 '<article class="panel warm"><div class="eyebrow">PAINTING ACADEMY</div><h2>Start with worn leather</h2><p>Perfect practice for belts, boots, and weapon grips on your Nova Aetas adventurer.</p><button class="btn btn-primary btn-sm" data-open-lesson="leather">LEARN LEATHER →</button></article></div>':
 '<div class="empty"><span class="icon">⚔️</span>Add your first miniature to start your painting journey.</div>')+
 '<div class="section-head"><div><h2 class="section-title">Studio Tools</h2><p class="section-sub">Everything for your next painting session.</p></div></div>'+
 '<div class="two-col"><div style="display:grid;gap:9px">'+
 tile("✦","Color Scheme Lab","Test five ready-made palettes and extract colors from character artwork.","inspiration")+
 tile("◈","Painting Academy",LESSONS.length+" bite-size tutorials, including leather, fire, metal and eyes.","academy")+'</div><div style="display:grid;gap:9px">'+
 tile("◉","My Vallejo Paint Rack","Catalog only the actual bottles you own, one group at a time.","paints")+
 tile("⇩","Safe Backup","Export projects, painting notes and photos to a portable file.","backup")+'</div></div>'+
 (games.length?'<div class="section-head"><h2 class="section-title">Board-Game Progress</h2></div><section class="panel">'+games.map(g=>{
  const entries=state.miniatures.filter(m=>m.game===g),done=entries.filter(m=>m.status==="Finished").length;
  return '<div class="game-row"><div class="actions" style="justify-content:space-between"><strong>'+esc(g)+'</strong><span class="small muted">'+done+' / '+entries.length+' painted · '+pct(done,entries.length)+'%</span></div><div class="step-progress"><span style="width:'+pct(done,entries.length)+'%"></span></div></div>';
 }).join("")+'</section>':"");
}
function tile(icon,title,sub,tab){
 return '<button class="tile-link" data-navto="'+tab+'"><span class="tile-symbol">'+icon+'</span><span class="tile-copy"><strong>'+esc(title)+'</strong><span>'+esc(sub)+'</span></span><span class="tile-arrow">›</span></button>';
}
function renderProjects(){
 const q=projectSearch.toLowerCase(),entries=state.miniatures.filter(p=>(projectFilter==="all"||p.status===projectFilter)&&(!q||[p.name,p.game,p.type,p.notes].join(" ").toLowerCase().includes(q)));
 return '<div class="page-head"><div><div class="eyebrow">COLLECTION & PROGRESS</div><h1>My Miniatures</h1><p>Track individual models, groups of board-game figures, techniques and before-and-after photos.</p></div><button class="btn btn-primary" data-add-mini>+ ADD MINIATURE</button></div>'+
 '<div class="tools-row"><input class="search-input" type="search" id="miniSearch" value="'+esc(projectSearch)+'" placeholder="Search miniature or game…" aria-label="Search miniatures"><select class="filter-select" id="miniFilter" aria-label="Filter miniatures">'+["all",...STATUS].map(x=>'<option value="'+esc(x)+'" '+(x===projectFilter?"selected":"")+'>'+esc(x==="all"?"All statuses":x)+'</option>').join("")+'</select></div>'+
 '<div class="section-head"><h2 class="section-title">'+entries.length+' Miniature'+(entries.length===1?"":"s")+'</h2><span class="small muted">Projects stored on this device</span></div>'+
 (entries.length?'<section class="collection">'+entries.map(miniCard).join("")+'</section>':'<div class="empty"><span class="icon">🖌️</span>No matching models. Try a different search or add another miniature.</div>');
}
function renderMini(){
 const p=mini(activeMiniId);if(!p)return '<div class="empty">Project unavailable.</div>';
 const image='<div class="detail-photo" data-photo-key="'+esc(p.id)+'|before"><div style="font-size:62px">⚔️</div><span class="small muted">Your unpainted miniature photo goes here</span></div>';
 const steps=STAGES.map((s,i)=>'<label class="step '+(p.steps.includes(i)?"done":"")+'"><input type="checkbox" data-stage="'+i+'" '+(p.steps.includes(i)?"checked":"")+'><span>'+esc(s)+'</span></label>').join("");
 const journal=p.journal.slice().reverse().map(j=>'<div class="journal-entry"><strong>'+esc(shortDate(j.at))+'</strong><div>'+esc(j.text)+'</div></div>').join("");
 return '<div class="page-head"><div><button class="btn btn-soft btn-sm" data-navto="projects">← MY MINIATURES</button><h1>'+esc(p.name)+'</h1><p>'+esc(p.game||"Unassigned game")+' · '+esc(p.type)+'</p></div><button class="btn btn-outline" data-edit-mini="'+esc(p.id)+'">✎ EDIT</button></div>'+
 '<section class="detail-top"><div>'+image+'<div class="actions" style="margin-top:9px"><button class="btn btn-outline btn-block" data-photo="'+esc(p.id)+'|before">📷 '+(p.status==="Unpainted"?"ADD MINI PHOTO":"CHANGE MINI PHOTO")+'</button></div></div>'+
 '<div class="panel detail-info"><span class="tag warm">'+esc(p.status)+'</span><div><div class="kicker">CURRENT PAINT SCHEME</div><h2>'+esc(sourcePalette(p).name)+'</h2><p>'+esc(sourcePalette(p).note)+'</p></div><div class="swatches">'+paletteChips(sourcePalette(p).colors)+'</div><div class="detail-stat-row"><span>'+p.steps.length+'/'+STAGES.length+' painting steps</span><span>'+p.journal.length+' journal entries</span><span>Updated '+esc(shortDate(p.updatedAt))+'</span></div><div class="actions"><button class="btn btn-primary" data-inspire="'+esc(p.id)+'">✦ OPEN COLOR LAB</button><button class="btn btn-soft" data-photo="'+esc(p.id)+'|finished">📸 FINISHED PHOTO</button></div></div></section>'+
 '<div class="two-col" style="margin-top:20px"><section class="panel"><h2>Painting Checklist</h2><p>Mark each stage as you finish it, in whatever order works for you.</p><div class="steps-list">'+steps+'</div><div class="actions" style="margin-top:12px"><label class="field" style="flex:1">OVERALL STATUS<select id="miniStatus">'+STATUS.map(v=>'<option '+(v===p.status?"selected":"")+'>'+esc(v)+'</option>').join("")+'</select></label></div></section>'+
 '<section class="panel"><h2>Painting Journal</h2><p>Record techniques, mixtures, discoveries and happy accidents.</p><form id="journalForm"><label class="field">NEW NOTE<textarea id="journalText" required maxlength="3000" placeholder="Today I painted the axe heads with dark steel, then added edge highlights…"></textarea></label><button class="btn btn-primary" type="submit" style="margin-top:9px">+ SAVE JOURNAL ENTRY</button></form><div style="margin-top:12px">'+(journal||'<p>No journal entries yet. Your first brushstroke deserves a note.</p>')+'</div></section></div>'+
 '<section class="panel" style="margin-top:16px"><h2>Miniature Notes</h2><p>'+esc(p.notes||"No notes yet.")+'</p><div class="actions"><button class="btn btn-outline btn-sm" data-edit-mini="'+esc(p.id)+'">EDIT DETAILS</button><button class="btn btn-soft btn-sm" data-open-lesson="leather">LEARN A TECHNIQUE</button></div></section>';
}
function paletteChips(colors){
 return (colors||[]).map((c,i)=>'<div class="swatch"><span class="color" style="background:'+esc(c)+'"></span><small>'+esc(c.toUpperCase())+'</small></div>').join("");
}
function renderInspiration(){
 const p=mini(activeMiniId)||state.miniatures[0];
 if(!p)return '<div class="page-head"><div><h1>Art-to-Mini Lab</h1><p>Add a miniature first to begin exploring schemes.</p></div><button class="btn btn-primary" data-add-mini>+ ADD MINI</button></div>';
 const palette=sourcePalette(p);
 const slots=[
 {slot:"before",name:"1 · YOUR MODEL",emoji:"⚔️",desc:"Photograph the unpainted model against a plain background."},
 {slot:"reference",name:"2 · ARTWORK / CHARACTER CARD",emoji:"🃏",desc:"Later, add the artwork from the board-game box or rulebook."},
 {slot:"concept",name:"3 · PAINTED CONCEPT",emoji:"🎨",desc:"Save an AI-painted preview created in ChatGPT or another tool."}
 ];
 return '<div class="page-head"><div><div class="eyebrow">IDEAS BEFORE THE FIRST BRUSHSTROKE</div><h1>Art-to-Mini Lab</h1><p>Use your actual unpainted miniature and original character artwork together to plan a painted look.</p></div></div>'+
 '<label class="field" style="max-width:450px;margin-bottom:18px">CHOOSE MINIATURE<select id="inspireMini">'+state.miniatures.map(m=>'<option value="'+esc(m.id)+'" '+(m.id===p.id?"selected":"")+'>'+esc(m.name)+' · '+esc(m.game||"Unassigned")+'</option>').join("")+'</select></label>'+
 '<div class="art-grid">'+slots.map(s=>'<div class="art-slot"><div class="art-image" data-photo-key="'+esc(p.id)+'|'+s.slot+'"><span class="art-emoji">'+s.emoji+'</span></div><div class="art-bottom"><strong>'+esc(s.name)+'</strong><p>'+esc(s.desc)+'</p><div class="art-actions"><button class="btn btn-primary btn-sm" data-photo="'+esc(p.id)+'|'+s.slot+'">📷 ADD / REPLACE</button><button class="btn btn-soft btn-sm" data-remove-photo="'+esc(p.id)+'|'+s.slot+'">REMOVE</button></div></div></div>').join("")+'</div>'+
 '<div class="mini-alert"><strong>AI preview status:</strong> The app can save your model photo, reference artwork, color palettes and a generated concept. Direct AI image generation is not yet connected. To make a faithful mockup now, upload both pictures to your ChatGPT conversation and use the copyable prompt below.</div>'+
 '<div class="two-col"><section class="panel"><div class="kicker">ARTWORK COLORS / PAINT PALETTE</div><h2>'+esc(palette.name)+'</h2><p>'+esc(palette.note)+'</p><div class="swatches">'+paletteChips(palette.colors)+'</div>'+
 '<div class="actions"><button class="btn btn-primary btn-sm" id="extractColors">◉ EXTRACT ARTWORK COLORS</button><button class="btn btn-outline btn-sm" id="resetPalette">RESET TO PRESET</button></div><hr class="divider"><label class="field">OR TRY A HAND-PICKED PALETTE<select id="schemeChoice">'+SCHEMES.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===p.schemeId?"selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label></section>'+
 '<section class="panel warm"><div class="kicker">THE FIRST PAINTING PLAN</div><h2>Plan a brush session</h2><p>Build the colors on the table before starting your mini.</p><div class="info-list"><div class="info-line"><strong>Start with your dominant fabric color</strong><p>Use the broadest surfaces as your base color anchor. Darken creases, then catch the upward-facing ridges.</p></div><div class="info-line"><strong>Leather and blades next</strong><p>Practice worn leather on boots and handles, then dark-to-bright metallics on the weapons.</p></div></div><div class="actions" style="margin-top:10px"><button class="btn btn-primary btn-sm" data-open-lesson="leather">LEATHER LESSON</button><button class="btn btn-outline btn-sm" data-open-lesson="steel">STEEL LESSON</button></div></section></div>'+
 '<section class="panel" style="margin-top:16px"><div class="eyebrow">COPY INTO CHATGPT</div><h2>My Art-to-Mini Preview Request</h2><p>Copy this prompt, then upload your unpainted-miniature photo and character art to our conversation. Your model is the primary shape reference; the card is the color reference.</p><textarea id="previewPrompt" readonly>'+esc(previewPrompt(p))+'</textarea><div class="actions" style="margin-top:10px"><button class="btn btn-primary" id="copyPreviewPrompt">📋 COPY PREVIEW PROMPT</button><button class="btn btn-outline" data-open-mini="'+esc(p.id)+'">BACK TO PROJECT</button></div></section>';
}
function previewPrompt(p){
 return "Using my attached photos, create a realistic studio photograph of my ACTUAL "+p.name+" miniature from "+(p.game||"a tabletop game")+" painted by hand. Preserve the physical sculpt's pose, proportions, weapons, costume, base, and all visible details. Use the second image (character artwork) for the character's colors and materials, translating impossible art details into paintable miniature effects. Use achievable Vallejo-style acrylic techniques such as layered basecoats, washes, highlights and edge accents. Keep the same model, not a redesigned character. Plain background, macro miniature photography. Current palette direction: "+sourcePalette(p).name+" — "+sourcePalette(p).note+".";
}
function renderAcademy(){
 const topics=[...new Set(LESSONS.map(l=>l.category))];
 return '<div class="page-head"><div><div class="eyebrow">SMALL LESSONS · REAL TECHNIQUES</div><h1>Painting Academy</h1><p>Practical, step-by-step tutorials using Vallejo-compatible color families. No specific bottle numbers are assumed until you enter your paint inventory.</p></div></div>'+
 '<div class="panel accent"><div class="kicker">LEARN ON YOUR OWN SCHEDULE</div><h2>'+LESSONS.length+' lessons, no homework</h2><p>From thin basecoats through tiny eyes and convincing flames. Check off steps and revisit them whenever you need a refresher.</p></div>'+
 topics.map(topic=>'<div class="section-head"><h2 class="section-title">'+esc(topic)+'</h2></div><div class="academy-grid">'+LESSONS.filter(l=>l.category===topic).map(l=>{
 const count=Array.isArray(state.lessonProgress[l.id])?state.lessonProgress[l.id].length:0;
 return '<button class="academy-card" data-open-lesson="'+esc(l.id)+'"><span class="academy-icon">'+esc(l.icon)+'</span><h3>'+esc(l.title)+'</h3><p>'+esc(l.summary)+'</p><div class="academy-meta"><span>'+esc(l.level)+' · '+l.minutes+' min</span><span>'+count+'/'+l.steps.length+' steps ✓</span></div></button>';
 }).join("")+'</div>').join("");
}
function renderLesson(){
 const l=LESSONS.find(x=>x.id===activeLessonId);if(!l)return '<div class="empty">Lesson not found.</div>';
 const completed=Array.isArray(state.lessonProgress[l.id])?state.lessonProgress[l.id]:[];
 const matched=matchingPaints(l.paints);
 return '<div class="page-head"><div><button class="btn btn-soft btn-sm" data-navto="academy">← PAINTING ACADEMY</button><div class="eyebrow">'+esc(l.category)+' · '+esc(l.level)+' · '+l.minutes+' MINUTES</div><h1>'+esc(l.icon)+' '+esc(l.title)+'</h1><p>'+esc(l.summary)+'</p></div></div>'+
 '<div class="two-col"><section class="panel"><h2>What you need</h2><p>Color families and supplies to find in your rack; these are not specific Vallejo product codes.</p>'+l.paints.map(x=>'<div class="step"><span>'+esc(x)+'</span></div>').join("")+
 '<hr class="divider"><h2>From your paint rack</h2>'+matched+
 '<div class="actions" style="margin-top:12px"><button class="btn btn-outline btn-sm" data-navto="paints">MANAGE PAINTS</button></div></section>'+
 '<section class="panel warm"><h2>Before you start</h2><p>'+esc(l.tip)+'</p><div class="mini-alert"><strong>Common mistake:</strong> '+esc(l.mistake)+'</div><div class="kicker">YOUR PROGRESS</div><div class="step-progress" style="margin:9px 0"><span style="width:'+pct(completed.length,l.steps.length)+'%"></span></div><div class="small muted">'+completed.length+' of '+l.steps.length+' steps marked complete</div></section></div>'+
 '<div class="section-head"><h2 class="section-title">Step-by-Step Technique</h2></div>'+
 '<div class="steps-list">'+l.steps.map((s,i)=>'<label class="lesson-step" style="display:flex;gap:12px;align-items:start"><input type="checkbox" data-lesson-step="'+i+'" style="width:19px;height:19px;margin-top:2px;accent-color:#49795e" '+(completed.includes(i)?"checked":"")+'><div style="flex:1"><h3>'+(i+1)+'. '+esc(s.title)+'</h3><p>'+esc(s.body)+'</p></div></label>').join("")+'</div>'+
 '<div class="lesson-tip" style="margin-top:16px"><strong>💡 Scout tip</strong>'+esc(l.tip)+'</div>'+
 '<section class="panel" style="margin-top:16px"><h2>Save this technique to a mini</h2><p>Create a journal reminder for your next practice session.</p><div class="actions"><select id="lessonMini" class="search-input">'+state.miniatures.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("")+'</select><button class="btn btn-primary" id="lessonAssign" '+(!state.miniatures.length?"disabled":"")+'>SAVE TO JOURNAL</button></div></section>';
}
function matchingPaints(need){
 if(!state.paints.length)return '<p>Nothing cataloged yet. Add your Vallejo bottles in Paint Rack to show possible matches here.</p>';
 const words=need.join(" ").toLowerCase().match(/\b(?:brown|black|red|blue|green|ivory|white|yellow|orange|gray|grey|steel|silver|gold|tan|khaki|flesh|metal|beige|copper|wash|primer)\b/g)||[];
 const unique=[...new Set(words)];
 const found=state.paints.filter(p=>unique.some(w=>(p.name+" "+p.notes).toLowerCase().includes(w))).slice(0,8);
 return found.length?'<div style="display:flex;gap:6px;flex-wrap:wrap">'+found.map(p=>'<span class="recipe-chip"><span style="background:'+esc(p.color)+';width:14px;height:14px;border-radius:50%;border:1px solid #0002"></span>'+esc(p.name)+' · '+esc(p.number)+'</span>').join("")+'</div><p>Suggested by color words only; confirm the color on your model before using it.</p>':'<p>No obvious name-based match from your rack yet. Check similar colors by eye.</p>';
}
function renderPaints(){
 const paints=state.paints.filter(p=>[p.brand,p.range,p.name,p.number].join(" ").toLowerCase().includes(paintSearch.toLowerCase()));
 return '<div class="page-head"><div><div class="eyebrow">PAINT THE COLORS YOU OWN</div><h1>My Paint Rack</h1><p>Catalog your actual Vallejo and other paints so tutorials can suggest colors already on your desk.</p></div><button class="btn btn-primary" data-add-paint>+ ADD PAINT</button></div>'+
 '<div class="panel accent"><h2>'+state.paints.length+' bottles cataloged</h2><p>We know from your station photo that you primarily paint with Vallejo, but I have not guessed your exact paint names or numbers. Add bottles as you go. Your inventory stays private on this device.</p><div class="actions"><button class="btn btn-primary btn-sm" data-add-paint>+ ADD A VALLEJO BOTTLE</button></div></div>'+
 '<div class="tools-row"><input id="paintSearch" class="search-input" type="search" placeholder="Search paint, range or number…" value="'+esc(paintSearch)+'"></div>'+
 (paints.length?'<div class="paint-list">'+paints.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>'<article class="paint-card"><div class="paint-dot" style="--paint-color:'+esc(p.color)+'"></div><div class="paint-info"><strong>'+esc(p.name)+'</strong><span>'+esc(p.brand)+' '+esc(p.range)+' · '+esc(p.number||"No product number")+'</span><span>Qty '+p.quantity+(p.notes?" · "+esc(p.notes):"")+'</span></div><div class="paint-controls"><button class="btn btn-outline btn-sm" data-edit-paint="'+esc(p.id)+'">EDIT</button></div></article>').join("")+'</div>':'<div class="empty"><span class="icon">🎨</span>No paints here yet. Start by adding just five favorite Vallejo bottles—or change your search.</div>');
}
function renderBackup(){
 return '<div class="page-head"><div><div class="eyebrow">KEEP YOUR WORK SAFE</div><h1>Backup & Restore</h1><p>Your project data is stored only in this browser/device. There is no account or Scout Cloud synchronization in this first version.</p></div></div>'+
 '<div class="two-col"><article class="panel accent"><h2>⬇ Export a complete backup</h2><p>Includes all miniatures, progress, recipes, paint inventory, journal entries and photo files. It may be a large JSON file once you have many photos.</p><button class="btn btn-primary" id="exportBackup">DOWNLOAD BACKUP (.JSON)</button></article>'+
 '<article class="panel"><h2>⇧ Restore from a backup</h2><p>Import a previously exported Studio backup. You will be asked before it replaces the information and photos on this device.</p><button class="btn btn-outline" id="importBackup">CHOOSE BACKUP FILE</button></article></div>'+
 '<div class="mini-alert"><strong>Important for iPhone:</strong> Safari and home-screen apps can store data separately. Do not assume photos or notes will be on another device. Save exported backup files to Files/iCloud Drive or another secure location, especially before clearing browser data or switching devices.</div>'+
 '<div class="section-head"><h2 class="section-title">What Studio stores</h2></div><div class="info-list"><div class="info-line"><strong>Projects and journals</strong><p>Stored locally in browser storage for this website. Your starting Nova Aetas miniature is an editable project, not a stock photo or a painted example.</p></div><div class="info-line"><strong>Photographs</strong><p>Stored on this device using browser photo storage. Photos can be attached as Unpainted, Artwork, AI Concept and Finished. They are not sent to GitHub or any image generation provider.</p></div><div class="info-line"><strong>AI painted previews</strong><p>Not connected inside this version. Use Art-to-Mini to save photos and a prompt, then share the two images in a ChatGPT conversation if you want to generate a preview now.</p></div></div>';
}
function modal(html){
 $("modalRoot").innerHTML='<div class="modal-backdrop" id="modalBackdrop"><div class="modal-card" role="dialog" aria-modal="true" aria-label="Editor"><div class="modal-head"><div><div class="eyebrow">MINIATURE PAINT STUDIO</div></div><button class="close-btn" type="button" data-close aria-label="Close">×</button></div>'+html+'</div></div>';
 const x=$("modalBackdrop");x.addEventListener("click",e=>{if(e.target===x||e.target.closest("[data-close]"))closeModal();});
 x.querySelector("input,select,textarea,button")?.focus();
}
function closeModal(){$("modalRoot").innerHTML="";}
function editMini(id){
 const p=id?mini(id):null;
 const data=p||{name:"",game:"",type:"Character / Hero",status:"Unpainted",notes:"",schemeId:"renaissance"};
 modal('<h2>'+(p?"Edit miniature":"Add a miniature")+'</h2><p>Give this figure a place in your painting journal.</p><form id="miniForm"><div class="form-grid">'+
 '<label class="field wide">MINIATURE / CHARACTER NAME<input name="name" type="text" required maxlength="120" value="'+esc(data.name)+'" placeholder="Dual-Axe Warrior"></label>'+
 '<label class="field wide">BOARD GAME / SET<input name="game" type="text" maxlength="120" value="'+esc(data.game)+'" placeholder="Nova Aetas Renaissance"></label>'+
 '<label class="field">MODEL TYPE<select name="type">'+["Character / Hero","Monster / Enemy","Creature","Terrain / Scenery","Boss","Other"].map(x=>'<option '+(x===data.type?"selected":"")+'>'+esc(x)+'</option>').join("")+'</select></label>'+
 '<label class="field">PAINTING STATUS<select name="status">'+STATUS.map(x=>'<option '+(x===data.status?"selected":"")+'>'+esc(x)+'</option>').join("")+'</select></label>'+
 '<label class="field wide">SUGGESTED PALETTE<select name="schemeId">'+SCHEMES.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===data.schemeId?"selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label>'+
 '<label class="field wide">NOTES<textarea name="notes" maxlength="2000">'+esc(data.notes)+'</textarea></label></div>'+
 '<div class="modal-foot">'+(p?'<button type="button" class="btn btn-danger" id="deleteMini">DELETE MINI</button>':"")+'<button class="btn btn-outline" type="button" data-close>CANCEL</button><button class="btn btn-primary" type="submit">SAVE MINIATURE</button></div></form>');
 $("miniForm").addEventListener("submit",e=>{
  e.preventDefault();const fd=new FormData(e.currentTarget);const name=String(fd.get("name")||"").trim();
  if(!name){notice("Enter a miniature name.");return;}
  const changes={name,game:String(fd.get("game")||"").trim(),type:String(fd.get("type")||""),status:String(fd.get("status")||""),schemeId:String(fd.get("schemeId")||""),notes:String(fd.get("notes")||"").trim(),updatedAt:now()};
  if(p)Object.assign(p,changes);else{
   const entry=normalizeMini(Object.assign({id:ID()},changes));state.miniatures.push(entry);activeMiniId=entry.id;
  }
  save();closeModal();routeTo("mini",p?p.id:activeMiniId);render();notice("Miniature saved.");
 });
 if(p)$("deleteMini").addEventListener("click",async()=>{
  if(!confirm('Delete "'+p.name+'" and all its photos and journal entries? This cannot be undone.'))return;
  for(const slot of PHOTO_SLOTS)await photoDelete(p.id,slot).catch(()=>{});
  state.miniatures=state.miniatures.filter(x=>x.id!==p.id);
  save();closeModal();routeTo("projects");render();notice("Miniature deleted.");
 });
}
function editPaint(id){
 const p=state.paints.find(x=>x.id===id);
 const data=p||{name:"",brand:"Vallejo",range:"Game Color",number:"",color:"#8a7357",quantity:1,notes:""};
 modal('<h2>'+(p?"Edit paint":"Add paint to rack")+'</h2><p>Only enter bottles you own. Use the color swatch as an approximate reference.</p><form id="paintForm"><div class="form-grid">'+
 '<label class="field wide">PAINT NAME<input name="name" type="text" required maxlength="90" placeholder="e.g., Leather Brown" value="'+esc(data.name)+'"></label>'+
 '<label class="field">BRAND<select name="brand">'+["Vallejo","Citadel","Army Painter","Reaper","Other"].map(x=>'<option '+(x===data.brand?"selected":"")+'>'+x+'</option>').join("")+'</select></label>'+
 '<label class="field">PAINT RANGE<select name="range">'+["Game Color","Model Color","Game Wash","Model Wash","Mecha Color","Metal Color","Primer","Other"].map(x=>'<option '+(x===data.range?"selected":"")+'>'+x+'</option>').join("")+'</select></label>'+
 '<label class="field">PRODUCT NUMBER<input name="number" maxlength="30" value="'+esc(data.number)+'" placeholder="70.xxx or 72.xxx"></label>'+
 '<label class="field">APPROXIMATE SWATCH<input name="color" type="color" value="'+esc(data.color)+'" style="height:46px;padding:4px"></label>'+
 '<label class="field">BOTTLES OWNED<input name="quantity" type="number" min="0" max="99" step="1" value="'+esc(data.quantity)+'"></label>'+
 '<label class="field wide">NOTES<input name="notes" value="'+esc(data.notes)+'" maxlength="500" placeholder="Favorite for boots, needs thinning…"></label></div>'+
 '<div class="modal-foot">'+(p?'<button class="btn btn-danger" type="button" id="deletePaint">REMOVE</button>':"")+'<button type="button" class="btn btn-outline" data-close>CANCEL</button><button class="btn btn-primary" type="submit">SAVE PAINT</button></div></form>');
 $("paintForm").addEventListener("submit",e=>{
  e.preventDefault();const fd=new FormData(e.target),name=String(fd.get("name")||"").trim();
  if(!name){notice("Paint name required.");return;}
  const entry=normalizePaint({id:p?p.id:ID(),name,brand:fd.get("brand"),range:fd.get("range"),number:fd.get("number"),color:fd.get("color"),quantity:fd.get("quantity"),notes:fd.get("notes")});
  if(p)Object.assign(p,entry);else state.paints.push(entry);
  save();closeModal();render();notice("Paint rack updated.");
 });
 if(p)$("deletePaint").addEventListener("click",()=>{if(!confirm("Remove "+p.name+" from your paint rack?"))return;state.paints=state.paints.filter(x=>x.id!==p.id);save();closeModal();render();notice("Paint removed.");});
}
async function handlePhotoChange(file){
 const target=photoTarget;photoTarget=null;
 if(!file||!target)return;
 const [id,slot]=target.split("|");
 if(!mini(id)||!PHOTO_SLOTS.includes(slot)){notice("Select a miniature and photo slot.");return;}
 try{
  notice("Preparing your photo…");
  const blob=await decodePhoto(file);
  await photoSet(id,slot,blob);
  mini(id).updatedAt=now();save();render();notice("Photo saved on this device.");
 }catch(e){notice("Photo not saved: "+(e.message||e));}
}
async function removePhoto(id,slot){
 if(!mini(id)||!PHOTO_SLOTS.includes(slot))return;
 if(!confirm("Remove this "+slot+" photo from the device?"))return;
 await photoDelete(id,slot).catch(e=>notice(e.message));
 render();
}
async function extractArtColors(id){
 const p=mini(id);if(!p)return;
 const blob=await photoGet(id,"reference");
 if(!blob){notice("Add a character-card or artwork photo first.");return;}
 try{
  const src=URL.createObjectURL(blob),img=new Image();img.src=src;
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("Artwork could not open"));});
  const canvas=document.createElement("canvas");canvas.width=96;canvas.height=96;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(img,0,0,96,96);URL.revokeObjectURL(src);
  const pixels=ctx.getImageData(0,0,96,96).data;const buckets=new Map();
  for(let k=0;k<pixels.length;k+=16){
   if(pixels[k+3]<200)continue;
   const r=pixels[k],g=pixels[k+1],b=pixels[k+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b);
   if(mx>234&&mn>228)continue;
   if(mx<35)continue;
   const key=[r>>4,g>>4,b>>4].join("-");
   const o=buckets.get(key)||{r:0,g:0,b:0,n:0};
   o.r+=r;o.g+=g;o.b+=b;o.n++;buckets.set(key,o);
  }
  const colors=[];const ranked=[...buckets.values()].sort((a,b)=>b.n-a.n);
  for(const o of ranked){
   const rgb=[o.r,o.g,o.b].map(v=>Math.round(v/o.n));
   if(colors.every(c=>Math.sqrt(rgb.reduce((sum,v,j)=>sum+(v-c[j])**2,0))>55))colors.push(rgb);
   if(colors.length===5)break;
  }
  if(colors.length<2){notice("Not enough distinguishable colors in this artwork. Try a clearer photo.");return;}
  p.customColors=colors.map(a=>"#"+a.map(v=>v.toString(16).padStart(2,"0")).join(""));
  p.updatedAt=now();save();render();notice("Artwork-inspired palette saved. Review colors by eye.");
 }catch(e){notice("Could not sample artwork colors: "+(e.message||e));}
}
async function exportBackup(){
 try{
  notice("Preparing complete backup, including photos…");
  const photos={};
  for(const p of state.miniatures)for(const slot of PHOTO_SLOTS){
   const blob=await photoGet(p.id,slot);
   if(blob)photos[photoKey(p.id,slot)]=await fileToDataUrl(blob);
  }
  const payload={format:"miniature-paint-studio",exportVersion:1,exportedAt:now(),data:state,photos};
  const bytes=JSON.stringify(payload);
  const day=new Date().toISOString().slice(0,10);
  download("Miniature-Paint-Studio-Backup-"+day+".json",bytes,"application/json");
  notice("Backup downloaded. Save it somewhere safe.");
 }catch(e){notice("Backup failed: "+(e.message||e));}
}
async function importBackup(file){
 if(!file)return;
 try{
  if(file.size>100*1024*1024)throw Error("Backup exceeds 100 MB; it may be too large for this browser.");
  const parsed=JSON.parse(await file.text());
  if(parsed.format!=="miniature-paint-studio"||!parsed.data||!Array.isArray(parsed.data.miniatures)||!Array.isArray(parsed.data.paints))throw Error("Not a supported Studio backup.");
  if(!confirm("RESTORE WARNING: This will replace ALL existing Studio projects, journal notes, paints and photos on this device. Continue?"))return;
  if(!db&&Object.keys(parsed.photos||{}).length)throw Error("Photo storage is unavailable. Existing data was not changed.");
  const prepared={version:1,miniatures:parsed.data.miniatures.slice(0,4000).map(normalizeMini),paints:parsed.data.paints.slice(0,10000).map(normalizePaint),lessonProgress:parsed.data.lessonProgress&&typeof parsed.data.lessonProgress==="object"?parsed.data.lessonProgress:{}};
  const photoEntries=[];
  for(const [key,value] of Object.entries(parsed.photos||{})){
   const split=key.lastIndexOf(":"),id=key.slice(0,split),slot=key.slice(split+1);
   if(!prepared.miniatures.find(x=>x.id===id)||!PHOTO_SLOTS.includes(slot))continue;
   photoEntries.push([key,dataUrlToBlob(value)]);
  }
  await photoClear();
  for(const [key,blob] of photoEntries){
   const cut=key.lastIndexOf(":");await photoSet(key.slice(0,cut),key.slice(cut+1),blob);
  }
  state=prepared;save();activeMiniId=state.miniatures[0]?.id||"";routeTo("home");render();notice("Backup restored successfully.");
 }catch(e){notice("Restore failed: "+(e.message||e));}
}
function wire(){
 document.querySelectorAll("[data-nav]").forEach(btn=>btn.addEventListener("click",()=>routeTo(btn.dataset.nav)));
 document.body.addEventListener("click",async event=>{
  const btn=event.target.closest("button");if(!btn||btn.disabled)return;
  const data=btn.dataset;
  if(data.navto){routeTo(data.navto);return;}
  if(data.openMini){routeTo("mini",data.openMini);return;}
  if(data.inspire){routeTo("inspiration",data.inspire);return;}
  if(data.openLesson){routeTo("lesson",data.openLesson);return;}
  if("addMini" in data){editMini();return;}
  if(data.editMini){editMini(data.editMini);return;}
  if("addPaint" in data){editPaint();return;}
  if(data.editPaint){editPaint(data.editPaint);return;}
  if(data.photo){
   photoTarget=data.photo;
   $("photoPicker").value="";
   $("photoPicker").click();return;
  }
  if(data.removePhoto){const [id,slot]=data.removePhoto.split("|");await removePhoto(id,slot);return;}
  if(btn.id==="exportBackup"){await exportBackup();return;}
  if(btn.id==="importBackup"){$("restorePicker").value="";$("restorePicker").click();return;}
  if(btn.id==="extractColors"){await extractArtColors(activeMiniId);return;}
  if(btn.id==="resetPalette"){const p=mini(activeMiniId);if(p){p.customColors=[];save();render();notice("Using the selected preset again.");}return;}
  if(btn.id==="copyPreviewPrompt"){
   const text=$("previewPrompt")?.value||"";
   try{await navigator.clipboard.writeText(text);notice("Prompt copied. Add your two photos to ChatGPT.");}
   catch{$("previewPrompt").select();notice("Select and copy the prompt from the text box.");}
   return;
  }
  if(btn.id==="lessonAssign"){
   const id=$("lessonMini")?.value,p=mini(id),lesson=LESSONS.find(x=>x.id===activeLessonId);
   if(p&&lesson){p.journal.push({id:ID(),at:now(),text:"Technique to practice: "+lesson.title+" — "+lesson.summary});p.updatedAt=now();save();notice("Saved to "+p.name+"'s journal.");}
  }
 });
 document.body.addEventListener("change",event=>{
  const el=event.target;
  if(el.id==="miniFilter"){projectFilter=el.value;render();return;}
  if(el.id==="inspireMini"){activeMiniId=el.value;routeTo("inspiration",activeMiniId);render();return;}
  if(el.id==="miniStatus"){
   const p=mini(activeMiniId);if(!p)return;p.status=el.value;p.updatedAt=now();save();render();notice("Painting status updated.");return;
  }
  if(el.id==="schemeChoice"){
   const p=mini(activeMiniId);if(!p)return;p.schemeId=el.value;p.customColors=[];p.updatedAt=now();save();render();notice("Color scheme saved.");return;
  }
  if("stage" in el.dataset){
   const p=mini(activeMiniId);if(!p)return;const i=Number(el.dataset.stage);
   p.steps=el.checked?[...new Set([...p.steps,i])].sort((a,b)=>a-b):p.steps.filter(x=>x!==i);
   p.updatedAt=now();save();render();return;
  }
  if("lessonStep" in el.dataset){
   const i=Number(el.dataset.lessonStep),steps=Array.isArray(state.lessonProgress[activeLessonId])?state.lessonProgress[activeLessonId]:[];
   state.lessonProgress[activeLessonId]=el.checked?[...new Set([...steps,i])].sort((a,b)=>a-b):steps.filter(x=>x!==i);
   save();render();return;
  }
 });
 document.body.addEventListener("input",e=>{
  if(e.target.id==="miniSearch"){projectSearch=e.target.value;render();const x=$("miniSearch");x?.focus();x?.setSelectionRange(projectSearch.length,projectSearch.length);}
  if(e.target.id==="paintSearch"){paintSearch=e.target.value;render();const x=$("paintSearch");x?.focus();x?.setSelectionRange(paintSearch.length,paintSearch.length);}
 });
 document.body.addEventListener("submit",event=>{
  if(event.target.id==="journalForm"){
   event.preventDefault();
   const p=mini(activeMiniId),text=String($("journalText").value||"").trim();
   if(!p||!text)return;
   p.journal.push({id:ID(),at:now(),text:text.slice(0,3000)});p.updatedAt=now();save();render();notice("Journal entry saved.");
  }
 });
 $("photoPicker").addEventListener("change",e=>handlePhotoChange(e.target.files?.[0]));
 $("restorePicker").addEventListener("change",e=>importBackup(e.target.files?.[0]));
 window.addEventListener("hashchange",()=>{render();window.scrollTo({top:0,behavior:"instant"});});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("modalBackdrop"))closeModal();});
}
async function start(){
 load();wire();await openDb();if(!location.hash)location.hash="#home";render();
 if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(err=>console.warn("Offline support",err));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
