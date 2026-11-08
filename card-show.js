/* HOF Card Scout — Card Show Mode and Collection Records
   Phone-first offline hunt list linked to existing live sold-comps pricing.
   Documentation is a snapshot; photos are stored separately. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.ScoutCardShow=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const VISIT_KEY="scoutCardShowVisitV1";
const PHOTO_KEY="scoutPhotoMissionInventoryV1";
const $=id=>document.getElementById(id);
let opts=null,ready=false,filter="hunt",showLimit=30,docsLimit=30,onlyMissing=false,recordsOrigin="homeScreen";

function clean(v){return String(v==null?"":v).trim();}
function esc(v){return clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function cash(v){
  if(v===null||v===undefined||v==="")return null;
  const n=Number(v);
  return Number.isFinite(n)&&n>=0?n:null;
}
function money(v){const n=cash(v);return n===null?"—":n.toLocaleString(undefined,{style:"currency",currency:"USD"});}
function localDay(){
  const d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}
function visit(){
  let data={};
  try{data=JSON.parse(localStorage.getItem(VISIT_KEY)||"{}")||{};}catch{}
  return {name:clean(data.name).slice(0,90),date:/^\d{4}-\d{2}-\d{2}$/.test(data.date||"")?data.date:localDay()};
}
function writeVisit(next){
  const state={name:clean(next.name).slice(0,90),date:/^\d{4}-\d{2}-\d{2}$/.test(next.date||"")?next.date:localDay()};
  try{localStorage.setItem(VISIT_KEY,JSON.stringify(state));}catch(err){console.warn("Card Show visit storage",err);}
  return state;
}
function getShowName(){return visit().name;}
function roster(){return (opts&&opts.players()||[]).filter(p=>p&&p.name);}
function photoCache(){
  try{
    const data=JSON.parse(localStorage.getItem(PHOTO_KEY)||"{}");
    return data&&data.photos&&typeof data.photos==="object"?data.photos:{};
  }catch{return {};}
}
function currentValue(p,fingerprint){
  if(!p||!p.owned||!fingerprint||!p.valuationCardKey||p.valuationCardKey!==fingerprint(p))return null;
  const n=cash(p.median);
  const comps=Number(p.comps||0);
  if(n===null||n<=0||comps<2||String(p.confidence||"").toLowerCase()==="insufficient")return null;
  return n;
}
function cardIdentity(p){
  return [p.cardYear||"",clean(p.set),p.cardNum?"#"+p.cardNum:""].filter(Boolean).join(" ")||"Details not entered";
}
function targetIdentity(p){
  const explicit=[p.targetYear,p.targetSet,p.targetCardNum?"#"+p.targetCardNum:""].filter(Boolean).join(" ");
  return explicit||clean(p.target)||"Any representative";
}
function status(p){
  if(p.incoming)return "INCOMING · DO NOT REBUY";
  if(p.owned)return p.target?"OWNED · UPGRADE TARGET":"OWNED";
  return p.target?"NEED · TARGET SAVED":"NEED";
}
function showRows(players,which,query){
  const needle=clean(query).toLowerCase();
  return (players||[]).filter(p=>{
    if(which==="hunt"&&p.incoming)return false;
    if(which==="hunt"&&p.owned&&!p.target)return false;
    if(which==="needs"&&(p.owned||p.incoming))return false;
    if(which==="targets"&&(!p.target||p.incoming))return false;
    if(which==="incoming"&&!p.incoming)return false;
    return !needle||p.name.toLowerCase().includes(needle)||clean(p.target).toLowerCase().includes(needle);
  }).sort((a,b)=>{
    if(which==="hunt"){
      const aTarget=!!a.target,bTarget=!!b.target;
      if(aTarget!==bTarget)return aTarget?-1:1;
    }
    return a.name.localeCompare(b.name);
  });
}
function purchaseHaul(players,settings){
  const name=clean(settings.name).toLowerCase();
  const rows=(players||[]).filter(p=>{
    if(!p.owned||p.purchaseDate!==settings.date)return false;
    const source=clean(p.purchaseSource);
    if(!/^card show(?:\s*:|$)/i.test(source))return false;
    if(!name)return true;
    return clean(source.replace(/^card show\s*:\s*/i,"")).toLowerCase()===name;
  });
  return {rows,count:rows.length,spent:rows.reduce((n,p)=>n+(cash(p.pricePaid)||0),0),unknown:rows.filter(p=>cash(p.pricePaid)===null).length};
}
function documentedRows(players,fingerprint,photos){
  return (players||[]).filter(p=>p&&p.owned&&p.name).slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>{
    const paid=cash(p.pricePaid),value=currentValue(p,fingerprint);
    const photo=photos&&photos[p.name]||{};
    const problems=[];
    if(!p.cardYear||!clean(p.set)||!clean(p.cardNum))problems.push("Card identity incomplete");
    if(paid===null)problems.push("Cost unknown");
    if(value===null)problems.push("No matching reliable estimate");
    if(photo.hasPhoto!==true)problems.push(photo.hasPhoto===false?"Cloud photo not found":"Photo not verified");
    const stamp=clean(p.valuationUpdatedAt||p.lastChecked);
    return {
      player:p.name,year:p.cardYear||"",set:p.set||"",number:p.cardNum||"",grader:p.grader||"Raw",
      grade:p.gradeCondition||"",serial:p.serial||"",autograph:!!p.autograph,relic:!!p.relic,
      owned:true,incoming:!!p.incoming,pricePaid:paid,purchaseDate:p.purchaseDate||"",
      source:p.purchaseSource||"",estimatedValue:value,estimateAsOf:stamp,
      comps:value!==null?Number(p.comps):0,confidence:value!==null?clean(p.confidence):"",
      photo:photo.hasPhoto===true?"Verified in cloud":photo.hasPhoto===false?"Not in cloud":"Not verified",
      photoCheckedAt:photo.checkedAt||"",notes:p.userNotes||p.description||"",
      issues:problems
    };
  });
}
function docsSummary(rows){
  const withCost=rows.filter(r=>r.pricePaid!==null),priced=rows.filter(r=>r.estimatedValue!==null);
  return {
    owned:rows.length,withCost:withCost.length,withValue:priced.length,
    spent:withCost.reduce((n,r)=>n+r.pricePaid,0),
    tracked:priced.reduce((n,r)=>n+r.estimatedValue,0),
    withPhoto:rows.filter(r=>r.photo==="Verified in cloud").length
  };
}
function workbookSheets(rows){
  const s=docsSummary(rows),generated=new Date().toLocaleString();
  const inventory=rows.map(r=>[
    r.player,r.year,r.set,r.number,r.grader,r.grade,r.serial,
    r.autograph?"Yes":"No",r.relic?"Yes":"No",r.incoming?"In transit":"In collection",
    r.pricePaid===null?"":{value:r.pricePaid,style:"money"},r.purchaseDate,r.source,
    r.estimatedValue===null?"":{value:r.estimatedValue,style:"money"},
    r.estimateAsOf,r.comps||"",r.confidence,r.photo,r.photoCheckedAt,r.notes
  ]);
  const needsReview=rows.filter(r=>r.issues.length).map(r=>[r.player,r.issues.join("; "),r.year,r.set,r.number,r.source]);
  return [
    {
      name:"Owned Inventory",title:"HOF Card Scout — Collection Documentation",
      subtitle:"Generated "+generated+" · "+s.owned+" owned representatives (including incoming). Purchase totals cover only entered costs. Recorded market estimates are NOT insurance appraisals.",
      headers:["PLAYER","YEAR","SET","CARD #","GRADER","GRADE","SERIAL","AUTOGRAPH","RELIC","STATUS","PRICE PAID","DATE BOUGHT","SOURCE","LAST TRACKED ESTIMATE","ESTIMATE DATE","SOLD COMPS","CONFIDENCE","CLOUD PHOTO","PHOTO CHECK DATE","NOTES"],
      widths:[24,12,22,12,16,14,17,12,12,17,16,16,30,20,21,12,15,19,19,47],
      rows:inventory,orientation:"landscape"
    },
    {
      name:"Review Needed",title:"HOF Card Scout — Records to Improve",
      subtitle:needsReview.length+" owned cards have missing information or lack a matching reliable recorded value/photo check.",
      headers:["PLAYER","WHAT TO CHECK","YEAR","SET","CARD #","SOURCE"],
      widths:[24,58,12,25,13,32],rows:needsReview,orientation:"landscape"
    },
    {
      name:"Notes",title:"About This Collection Record",
      subtitle:"Generated "+generated,
      headers:["TOPIC","EXPLANATION"],widths:[30,105],rows:[
        ["Scope","One current representative per Hall of Famer. Owned cards in transit are included. Special Collection is separate."],
        ["Purchase information","Price-paid total is incomplete whenever purchase costs are missing."],
        ["Valuation","Only previously recorded market estimates matching the CURRENT representative, with 2+ sold comps, are shown. Historic values may be stale; no new pricing research is run when exporting."],
        ["Insurance","This is an owner-prepared inventory, NOT a certified appraisal, policy schedule, or guarantee of replacement value. Ask your insurer what supporting evidence it requires."],
        ["Photos","Photo statuses come from the most recent on-device Photo Mission checks. The actual image files are NOT embedded in this workbook or the JSON backup."],
        ["Data protection","Keep this inventory and separately backed-up card images securely stored. Financial and purchase details may be sensitive."]
      ],orientation:"landscape"
    }
  ];
}
function csvField(value){
  const raw=clean(value);
  const safe=/^[=+\-@\t\r]/.test(raw)?"'"+raw:raw;
  return '"'+safe.replace(/"/g,'""')+'"';
}
function csvText(rows){
  const headers=["Player","Year","Set","Card Number","Grader","Grade","Serial","Autograph","Relic","Status","Price Paid","Purchase Date","Source","Recorded Estimate","Estimate Date","Sold Comps","Confidence","Cloud Photo","Photo Check Date","Notes"];
  const all=[headers,...rows.map(r=>[r.player,r.year,r.set,r.number,r.grader,r.grade,r.serial,r.autograph?"Yes":"No",r.relic?"Yes":"No",r.incoming?"Incoming":"Arrived",r.pricePaid??"",r.purchaseDate,r.source,r.estimatedValue??"",r.estimateAsOf,r.comps||"",r.confidence,r.photo,r.photoCheckedAt,r.notes])];
  return "\uFEFF"+all.map(row=>row.map(csvField).join(",")).join("\r\n");
}
function download(blob,name){
  const url=URL.createObjectURL(blob),anchor=document.createElement("a");
  anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function makeStyles(){
  if($("cardShowStyles"))return;
  const style=document.createElement("style");style.id="cardShowStyles";
  style.textContent=[
    ".cs-wrap{display:grid;gap:14px}.cs-hero{padding:17px;border:1px solid rgba(230,189,99,.38);border-radius:18px;background:linear-gradient(135deg,rgba(230,189,99,.14),rgba(255,255,255,.035))}.cs-title{font-size:27px;font-weight:950;margin:6px 0}.cs-sub,.cs-note{font-size:12px;color:var(--muted);line-height:1.6}.cs-controls{display:grid;grid-template-columns:1fr 1fr;gap:9px}.cs-field{display:grid;gap:5px}.cs-field label{font-weight:850;font-size:11px;color:var(--muted)}.cs-field input,.cs-field select,.cs-search{min-height:46px;width:100%;border-radius:12px;border:1px solid var(--line);background:var(--cream);color:var(--ink);padding:9px;font-size:16px}",
    ".cs-actions{display:flex;gap:9px;flex-wrap:wrap}.cs-actions button{flex:1;min-width:145px;min-height:45px}.cs-list{display:grid;gap:9px}.cs-row{border:1px solid var(--line);border-radius:14px;padding:12px;background:rgba(255,255,255,.035)}.cs-head{display:flex;gap:8px;align-items:start;justify-content:space-between}.cs-name{font-size:15px;font-weight:950}.cs-chip{font-weight:800;font-size:10px;color:var(--gold);text-align:right}.cs-detail{font-size:12px;color:var(--muted);line-height:1.5;margin:6px 0}.cs-row-actions{display:grid;grid-template-columns:minmax(0,120px) 1fr;gap:9px;align-items:end}.cs-row-actions input{width:100%;min-height:45px;background:var(--cream);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px;font-size:16px}.cs-row-actions button{min-height:45px;font-size:12px}.cs-label{font-size:10px;color:var(--muted);display:block;margin-bottom:4px}.cs-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.cs-stat{padding:13px 5px;border:1px solid var(--line);border-radius:12px;text-align:center}.cs-val{font-size:21px;font-weight:950;color:var(--gold)}.cs-stat small{font-size:10px;color:var(--muted);font-weight:800}",
    ".cs-docs-list{display:grid;gap:7px}.cs-doc-row{border:1px solid var(--line);padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.03);font-size:12px}.cs-doc-row strong{font-size:14px}.cs-doc-issue{color:var(--gold);margin-top:4px}.cs-empty{padding:18px;text-align:center;color:var(--muted);font-size:12px;border:1px dashed var(--line);border-radius:12px}.cs-section{font-size:16px;font-weight:900}.cs-divider{border:0;border-top:1px solid var(--line)}",
    "@media(max-width:420px){.cs-controls{grid-template-columns:1fr}.cs-summary{gap:5px}.cs-val{font-size:17px}.cs-actions button{min-width:130px}}"
  ].join("");
  document.head.appendChild(style);
}
function showNotice(text){const node=$("csMessage");if(node)node.textContent=text;}
function renderShow(){
  if(!$("cardShowScreen"))return;
  const state=visit(),players=roster(),list=showRows(players,filter,$("csSearch").value),haul=purchaseHaul(players,state);
  $("csShowName").value=state.name;$("csShowDate").value=state.date;
  $("csFilter").value=filter;
  $("csCount").textContent=String(list.length);
  $("csHaulCount").textContent=String(haul.count);
  $("csHaulSpent").textContent=money(haul.spent);
  $("csHaulDescription").textContent=haul.count
    ?haul.rows.map(p=>p.name+" ("+money(p.pricePaid)+")").join(" · ")+(haul.unknown?" · "+haul.unknown+" missing prices":"")
    :"No current representative purchases recorded for this show/date. Purchases saved from the live deal check will appear here.";
  $("csList").innerHTML=list.length?list.slice(0,showLimit).map(p=>{
    const badge=status(p),parts=[];
    if(p.target)parts.push("🎯 "+targetIdentity(p));
    if(p.owned)parts.push("Owned: "+cardIdentity(p));
    if(!p.owned&&!p.target)parts.push("Any representative · enter card details during live check");
    const max=cash(p.targetMaxPrice);
    if(max!==null&&max>0)parts.push("Your saved maximum: "+money(max)+" (budget, not sold value)");
    if(p.incoming)parts.push("Already purchased. Confirm before buying another.");
    return '<article class="cs-row"><div class="cs-head"><div class="cs-name">'+esc(p.name)+'</div><span class="cs-chip">'+esc(badge)+'</span></div>'+
      '<div class="cs-detail">'+parts.map(esc).join('<div></div>')+'</div>'+
      '<div class="cs-row-actions"><label><span class="cs-label">DEALER ASKING $</span><input type="number" min="0" step="0.01" inputmode="decimal" data-cs-price="'+esc(p.name)+'" placeholder="Optional"></label>'+
      '<button type="button" class="secondary" data-cs-check="'+esc(p.name)+'">🔎 LIVE DEAL CHECK</button></div></article>';
  }).join(""):'<div class="cs-empty">No matching cards. Change the filter or search.</div>';
  $("csMore").hidden=list.length<=showLimit;
  $("csCountLabel").textContent=filter==="hunt"?"Targets first, then remaining needs":filter==="incoming"?"Already bought · avoid duplicates":"Matching Hall roster";
}
function renderDocs(){
  if(!$("collectionRecordsScreen"))return;
  const rows=documentedRows(roster(),opts.fingerprint,photoCache()),summary=docsSummary(rows);
  const filtered=rows.filter(r=>!onlyMissing||r.issues.length),query=clean($("crSearch").value).toLowerCase();
  const visible=filtered.filter(r=>!query||r.player.toLowerCase().includes(query)||r.set.toLowerCase().includes(query));
  $("crOwned").textContent=summary.owned;
  $("crCost").textContent=money(summary.spent);
  $("crTracked").textContent=money(summary.tracked);
  $("crStatsNote").textContent=summary.withCost+" of "+summary.owned+" cards have an entered purchase cost · "+summary.withValue+" have matching recorded market estimates · "+summary.withPhoto+" verified cloud photos. Tracked estimates are not an appraisal or total collection value.";
  $("crMissingFilter").checked=onlyMissing;
  $("crListCount").textContent=visible.length+" record"+(visible.length===1?"":"s");
  $("crList").innerHTML=visible.length?visible.slice(0,docsLimit).map(r=>{
    const recordedCard=[r.year,r.set,r.number?"#"+r.number:""].filter(Boolean).join(" ")||"Details not entered";
    const parts=[recordedCard,r.grader+(r.grade?" "+r.grade:""),"Paid: "+money(r.pricePaid),"Last tracked estimate: "+money(r.estimatedValue),r.incoming?"In transit":""].filter(Boolean);
    return '<article class="cs-doc-row"><strong>'+esc(r.player)+'</strong><div class="cs-detail">'+parts.map(esc).join(" · ")+'</div>'+
      (r.issues.length?'<div class="cs-doc-issue">'+esc(r.issues.join(" · "))+'</div>':'<div class="cs-note">Documentation checks complete</div>')+'</article>';
  }).join(""):'<div class="cs-empty">No records in this view.</div>';
  $("crMore").hidden=visible.length<=docsLimit;
}
function prefill(p){
  if(!p)return null;
  if(p.target){
    const m=clean(p.target).match(/\b((?:18|19|20)\d{2})\b/);
    const yr=Number(p.targetYear||m&&m[1]||0);
    return {
      name:p.name,cardYear:yr||"",set:p.targetSet||"",cardNum:p.targetCardNum||"",
      grader:/^(PSA|SGC|CGC|CSG|HGA|TAG|ISA|BGS \/ Beckett)$/i.test(clean(p.targetGrader))?p.targetGrader:"Raw",
      gradeCondition:p.targetGrade||"",userNotes:p.targetNotes||"",
      autograph:p.targetAutoPreference==="Autograph required"
    };
  }
  if(!p.owned)return {name:p.name};
  return p;
}
function check(p,raw){
  const price=clean(raw);
  if(price!==""){
    const n=Number(price);
    if(!Number.isFinite(n)||n<0){if(opts.toast)opts.toast("Dealer asking price must be zero or more.");return;}
  }
  opts.openCheck(prefill(p),price);
}
function exportWorkbook(){
  const rows=documentedRows(roster(),opts.fingerprint,photoCache());
  if(!rows.length){if(opts.toast)opts.toast("No owned Hall cards to document yet.");return;}
  if(!opts.downloadWorkbook){if(opts.toast)opts.toast("Excel export is unavailable. Refresh Card Scout.");return;}
  try{
    opts.downloadWorkbook(workbookSheets(rows),"Card-Scout-Collection-Records-"+localDay()+".xlsx",{
      creator:"HOF Card Scout",subject:"Owner-prepared collection documentation, not a certified appraisal"
    });
    if(opts.toast)opts.toast("Collection inventory exported. Remember: photos are separate.");
  }catch(err){if(opts.toast)opts.toast("Excel export failed: "+(err.message||"unknown error"));}
}
function exportCSV(){
  const rows=documentedRows(roster(),opts.fingerprint,photoCache());
  if(!rows.length){if(opts.toast)opts.toast("No owned cards to export.");return;}
  try{
    download(new Blob([csvText(rows)],{type:"text/csv;charset=utf-8"}),"Card-Scout-Collection-Records-"+localDay()+".csv");
    if(opts.toast)opts.toast("CSV inventory saved. Photos are not included.");
  }catch(err){if(opts.toast)opts.toast("CSV export failed: "+(err.message||"unknown error"));}
}
function open(){
  filter="hunt";showLimit=30;
  $("csSearch").value="";
  opts.navigate("cardShowScreen");
  renderShow();
}
function openRecords(){
  recordsOrigin=document.querySelector(".screen.active")?.id==="cardShowScreen"?"cardShowScreen":"homeScreen";
  docsLimit=30;onlyMissing=false;$("crSearch").value="";
  opts.navigate("collectionRecordsScreen");renderDocs();
}
function init(config){
  if(ready||!config||typeof config.players!=="function"||typeof config.openCheck!=="function")return;
  const main=document.querySelector("main"),home=document.querySelector("#homeScreen .quick-grid");
  if(!main||!home)return;
  ready=true;opts=config;makeStyles();
  const showButton=document.createElement("button");
  showButton.id="cardShowModeBtn";showButton.type="button";showButton.className="secondary";showButton.textContent="🎪 CARD SHOW MODE";
  const recordsButton=document.createElement("button");
  recordsButton.id="collectionRecordsBtn";recordsButton.type="button";recordsButton.className="ghost";recordsButton.textContent="🛡 COLLECTION RECORDS";
  const before=$("dataMenuBtn");
  if(before){home.insertBefore(showButton,before);home.insertBefore(recordsButton,before);}
  else{home.appendChild(showButton);home.appendChild(recordsButton);}
  main.insertAdjacentHTML("beforeend",[
    '<section class="screen" id="cardShowScreen"><button type="button" class="back" id="csBack">← Back to Home</button><div class="cs-wrap">',
    '<div class="cs-hero"><div class="section-eyebrow">🎪 CARD SHOW MODE</div><h2 class="cs-title">Hunt Smarter at the Show</h2><p class="cs-sub">Your Hall targets, needs and already-owned cards—available offline. Live Deal Check opens the existing real sold-comps engine and needs internet. Saved maximums are personal budgets, not market valuations.</p></div>',
    '<div class="cs-controls"><div class="cs-field"><label for="csShowName">SHOW / LOCATION</label><input id="csShowName" maxlength="90" placeholder="e.g., New Mexico Card Show"></div><div class="cs-field"><label for="csShowDate">VISIT DATE</label><input id="csShowDate" type="date"></div></div>',
    '<p class="cs-note" id="csMessage">Visit details stay on this device. Purchases saved through Card Scout are included in the normal Scout Cloud collection backup.</p>',
    '<div class="cs-actions"><button type="button" class="primary" id="csAny">🔎 CHECK ANY CARD</button><button type="button" class="ghost" id="csDocs">🛡 COLLECTION RECORDS</button></div>',
    '<div class="cs-summary"><div class="cs-stat"><div class="cs-val" id="csCount">0</div><small>HUNT RESULTS</small></div><div class="cs-stat"><div class="cs-val" id="csHaulCount">0</div><small>SHOW HAUL</small></div><div class="cs-stat"><div class="cs-val" id="csHaulSpent">$0</div><small>PAID</small></div></div>',
    '<div class="cs-note" id="csHaulDescription"></div><hr class="cs-divider">',
    '<div class="cs-controls"><div class="cs-field"><label for="csSearch">FIND A PLAYER</label><input id="csSearch" type="search" placeholder="Search Hall of Famers"></div><div class="cs-field"><label for="csFilter">SHOW CARDS</label><select id="csFilter"><option value="hunt">Targets + needs</option><option value="needs">Needs only</option><option value="targets">Saved targets</option><option value="incoming">Incoming (do not rebuy)</option><option value="all">All Hall cards</option></select></div></div>',
    '<div class="cs-note" id="csCountLabel">Targets first, then remaining needs</div><div class="cs-list" id="csList"></div><button type="button" class="ghost" id="csMore" hidden>SHOW MORE CARDS</button>',
    '<p class="cs-note">After a live price check, tap I BOUGHT IT and select Card show. Enter your show location to include the purchase in your haul. Extra cards that do not replace your Hall representative are not added to this one-card-per-player inventory.</p></div></section>',
    '<section class="screen" id="collectionRecordsScreen"><button type="button" class="back" id="crBack">← Back to Home</button><div class="cs-wrap">',
    '<div class="cs-hero"><div class="section-eyebrow">🛡 COLLECTION RECORDS</div><h2 class="cs-title">Your Collection, Documented</h2><p class="cs-sub">Download a detailed owner-prepared inventory for records or insurance discussions. Recorded values are historical estimates—not certified appraisals, guaranteed replacement values or proof of ownership. Photos are not embedded.</p></div>',
    '<div class="cs-summary"><div class="cs-stat"><div class="cs-val" id="crOwned">0</div><small>OWNED</small></div><div class="cs-stat"><div class="cs-val" id="crCost">$0</div><small>KNOWN SPEND</small></div><div class="cs-stat"><div class="cs-val" id="crTracked">$0</div><small>TRACKED ESTIMATES</small></div></div>',
    '<p class="cs-note" id="crStatsNote"></p><div class="cs-actions"><button type="button" class="primary" id="crExcel">⬇ EXPORT EXCEL</button><button type="button" class="ghost" id="crCSV">⬇ EXPORT CSV</button></div>',
    '<p class="cs-note">Excel includes owned inventory, records needing review, and evidence notes. CSV is a simpler portable list. Neither export contains images; use Photo Mission and separate secure photo backups for visual proof. Keep financial details private.</p>',
    '<div class="cs-controls"><div class="cs-field"><label for="crSearch">SEARCH RECORDS</label><input id="crSearch" type="search" placeholder="Player or set"></div><label style="display:flex;align-items:center;gap:8px;font-size:12px"><input id="crMissingFilter" type="checkbox" style="width:18px;height:18px"> Only records needing attention</label></div>',
    '<div class="cs-section" id="crListCount"></div><div class="cs-docs-list" id="crList"></div><button type="button" class="ghost" id="crMore" hidden>SHOW MORE RECORDS</button>',
    '</div></section>'
  ].join(""));
  showButton.addEventListener("click",open);
  recordsButton.addEventListener("click",openRecords);
  $("csBack").addEventListener("click",()=>opts.navigate("homeScreen"));
  $("crBack").addEventListener("click",()=>opts.navigate(recordsOrigin));
  $("csDocs").addEventListener("click",openRecords);
  $("csAny").addEventListener("click",()=>check(null,""));
  $("csShowName").addEventListener("change",()=>{writeVisit({name:$("csShowName").value,date:$("csShowDate").value});renderShow();showNotice("Visit details saved on this device. The live pricing check still requires internet.");});
  $("csShowDate").addEventListener("change",()=>{writeVisit({name:$("csShowName").value,date:$("csShowDate").value});renderShow();});
  $("csSearch").addEventListener("input",()=>{showLimit=30;renderShow();});
  $("csFilter").addEventListener("change",()=>{filter=$("csFilter").value;showLimit=30;renderShow();});
  $("csMore").addEventListener("click",()=>{showLimit+=30;renderShow();});
  $("csList").addEventListener("click",event=>{
    const button=event.target.closest("[data-cs-check]");
    if(!button)return;
    const name=button.dataset.csCheck,p=roster().find(row=>row.name===name);
    if(!p)return;
    const input=Array.from($("csList").querySelectorAll("[data-cs-price]")).find(node=>node.dataset.csPrice===name);
    check(p,input?input.value:"");
  });
  $("crSearch").addEventListener("input",()=>{docsLimit=30;renderDocs();});
  $("crMissingFilter").addEventListener("change",()=>{onlyMissing=$("crMissingFilter").checked;docsLimit=30;renderDocs();});
  $("crMore").addEventListener("click",()=>{docsLimit+=30;renderDocs();});
  $("crExcel").addEventListener("click",exportWorkbook);
  $("crCSV").addEventListener("click",exportCSV);
  renderShow();renderDocs();
}
return {init,open,openRecords,refresh:function(screen){
  if(screen==="cardShowScreen")renderShow();
  if(screen==="collectionRecordsScreen")renderDocs();
},getShowName,helpers:{cash,currentValue,showRows,purchaseHaul,documentedRows,docsSummary,workbookSheets,csvText,prefill}};
});
