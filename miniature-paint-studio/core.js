/* Miniature Paint Studio: shared, side-effect-free data helpers. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.PaintStudioCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const STORAGE_KEY="miniaturePaintStudioV1";
const DEFAULT_STAGES=["Prepare & prime","Basecoats","Shadows & washes","Highlights & details","Base & scenery","Varnish & photograph"];
const STATUSES=["Unpainted","In progress","Finished"];
const MINI_KINDS=["Hero","Enemy","Boss","Creature","Terrain","Other"];
const PAINT_BRANDS=["Vallejo","Citadel","Army Painter","Reaper","Other"];
const TUTORIAL_CATEGORIES=["Foundations","Materials","Characters","Effects","Finishing"];
const COLORS={
  leather:["#332820","#715038","#b38a5d","#e4c695"],
  fire:["#fff0a5","#f9c33e","#e66e2e","#a42527"],
  steel:["#252c33","#56626b","#91a5b2","#e1e8ea"],
  cloth:["#273544","#526b7b","#8caaad","#d5d9cf"],
  moss:["#183e36","#38634c","#78966d","#c5b994"],
  royal:["#283357","#49639b","#c18a48","#efe1af"]
};
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function id(prefix){return prefix+"-"+(typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9));}
function dateToday(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
function validDate(s){return typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)?s:"";}
function normalizeStatus(v){return STATUSES.includes(v)?v:"Unpainted";}
function trim(v,max){return String(v??"").trim().slice(0,max);}
function newMini(data={}){
  const title=trim(data.name,120)||"Untitled miniature";
  const stages=Array.isArray(data.stages)&&data.stages.length?data.stages.map((x,i)=>({
    name:trim(x.name,80)||DEFAULT_STAGES[i]||"Stage "+(i+1),done:!!x.done
  })).slice(0,12):DEFAULT_STAGES.map(name=>({name,done:false}));
  return {
    id:trim(data.id,140)||id("mini"),
    name:title,
    game:trim(data.game,120),
    kind:MINI_KINDS.includes(data.kind)?data.kind:"Hero",
    status:normalizeStatus(data.status),
    dateStarted:validDate(data.dateStarted),
    dateFinished:validDate(data.dateFinished),
    notes:trim(data.notes,3000),
    recipe:trim(data.recipe,4000),
    stages,
    journal:Array.isArray(data.journal)?data.journal.filter(x=>x&&typeof x==="object").slice(-150).map(x=>({
      id:trim(x.id,140)||id("entry"),date:validDate(x.date)||dateToday(),text:trim(x.text,1500)
    })):[],
    createdAt:trim(data.createdAt,40)||new Date().toISOString(),
    updatedAt:trim(data.updatedAt,40)||new Date().toISOString()
  };
}
function newPaint(data={}){
  const hex=/^#[0-9a-f]{6}$/i.test(data.hex||"")?data.hex.toUpperCase():"#8C857A";
  return {
    id:trim(data.id,140)||id("paint"),
    brand:PAINT_BRANDS.includes(data.brand)?data.brand:"Vallejo",
    line:trim(data.line,80)||"Model Color",
    name:trim(data.name,100)||"Unnamed paint",
    number:trim(data.number,30),
    hex,
    notes:trim(data.notes,800)
  };
}
function initialState(){
  return {
    version:1,
    minis:[newMini({
      id:"nova-aetas-dual-axe-warrior",name:"Dual-Axe Warrior",game:"Nova Aetas Renaissance",kind:"Hero",
      notes:"First Studio project. Take a sharper photo of the unpainted miniature; add its character card illustration whenever the game box is accessible.",
      journal:[],
      createdAt:"2026-11-07T00:00:00.000Z",updatedAt:"2026-11-07T00:00:00.000Z"
    })],
    paints:[],
    lessons:{},
    preferences:{}
  };
}
function hydrate(input){
  const fallback=initialState();
  if(!input||typeof input!=="object"||Array.isArray(input))return fallback;
  const minis=Array.isArray(input.minis)?input.minis.slice(0,400).filter(x=>x&&typeof x==="object").map(newMini):fallback.minis;
  const paints=Array.isArray(input.paints)?input.paints.slice(0,700).filter(x=>x&&typeof x==="object").map(newPaint):fallback.paints;
  const lessons=input.lessons&&typeof input.lessons==="object"&&!Array.isArray(input.lessons)?input.lessons:{};
  const seen=new Set();const safeMinis=minis.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;});
  const seenPaint=new Set();const safePaints=paints.filter(x=>{if(seenPaint.has(x.id))return false;seenPaint.add(x.id);return true;});
  return {version:1,minis:safeMinis,paints:safePaints,lessons,preferences:{}};
}
function summary(minis){
  const count=minis.length;
  const finished=minis.filter(x=>x.status==="Finished").length;
  const inProgress=minis.filter(x=>x.status==="In progress").length;
  const unpainted=minis.filter(x=>x.status==="Unpainted").length;
  return {count,finished,inProgress,unpainted,percent:count?Math.round(finished/count*100):0};
}
function gameTotals(minis){
  const groups=new Map();
  for(const mini of minis){
    const game=trim(mini.game,120)||"Unassigned";
    if(!groups.has(game))groups.set(game,{game,total:0,finished:0,inProgress:0});
    const row=groups.get(game);row.total++;if(mini.status==="Finished")row.finished++;if(mini.status==="In progress")row.inProgress++;
  }
  return [...groups.values()].sort((a,b)=>a.game.localeCompare(b.game));
}
function stageProgress(mini){
  const stages=Array.isArray(mini.stages)?mini.stages:[];
  const done=stages.filter(x=>x.done).length;
  return {done,total:stages.length,percent:stages.length?Math.round(done/stages.length*100):0};
}
function matchingPaints(paints,query){
  const q=trim(query,100).toLowerCase();
  return paints.filter(x=>[x.brand,x.line,x.name,x.number,x.notes].some(t=>String(t||"").toLowerCase().includes(q)));
}
function recipePalette(id){
  return COLORS[id]||COLORS.leather;
}
function palettes(){return Object.keys(COLORS);}
function progressLabel(p){return p.percent+"% complete · "+p.done+" of "+p.total+" stages";}
function safePhotoDataUrl(v){
  return typeof v==="string"&&/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(v)?v:null;
}
function exportPayload(state,photos){
  return {
    app:"Miniature Paint Studio",exportVersion:1,exportedAt:new Date().toISOString(),
    state:hydrate(state),photos:photos&&typeof photos==="object"?photos:{}
  };
}
function readImport(payload){
  if(!payload||payload.app!=="Miniature Paint Studio"||payload.exportVersion!==1||!payload.state)throw new Error("This is not a Miniature Paint Studio backup.");
  const photos={};
  if(payload.photos&&typeof payload.photos==="object"){
    for(const [key,value] of Object.entries(payload.photos)){
      if(/^[\w-]+:(before|art|concept|finished)$/.test(key)&&safePhotoDataUrl(value))photos[key]=value;
    }
  }
  return {state:hydrate(payload.state),photos};
}
return {STORAGE_KEY,DEFAULT_STAGES,STATUSES,MINI_KINDS,PAINT_BRANDS,TUTORIAL_CATEGORIES,escapeHtml,
 id,dateToday,validDate,trim,newMini,newPaint,initialState,hydrate,summary,gameTotals,stageProgress,
 matchingPaints,recipePalette,palettes,progressLabel,safePhotoDataUrl,exportPayload,readImport};
});
