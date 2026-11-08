/* HOF Card Scout v6.3 • Photo Mission
   Cloud photo inventory for owned Hall representatives; no marketplace searches.
   Cached results are explicitly verified cloud responses, never estimates. */
(function(root){
"use strict";
const KEY="scoutPhotoMissionInventoryV1", MILESTONES=[10,25,50,100,150,200,250,300];
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let opts=null, initialized=false, running=false, controller=null, view="missing", expanded=false;
function load(){
  try{
    const o=JSON.parse(localStorage.getItem(KEY)||"{}");
    return {photos:o.photos&&typeof o.photos==="object"&&!Array.isArray(o.photos)?o.photos:{},lastScan:String(o.lastScan||"")};
  }catch{return {photos:{},lastScan:""};}
}
function save(o){try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){console.warn("Photo Mission cache",e);}}
function players(){return (opts.players()||[]).filter(p=>p&&p.owned&&!p.incoming&&p.name).sort((a,b)=>a.name.localeCompare(b.name));}
function count(s,roster){
  let yes=0,no=0;
  for(const p of roster){const v=s.photos[p.name]?.hasPhoto;if(v===true)yes++;else if(v===false)no++;}
  return {yes,no,unknown:roster.length-yes-no};
}
function notify(msg){$("photoMissionScanStatus").textContent=msg;}
function makeStyles(){
  if($("photoMissionStyles"))return;
  const style=document.createElement("style");style.id="photoMissionStyles";
  style.textContent=[
    ".pm-wrap{display:grid;gap:14px}.pm-hero{border:1px solid rgba(230,189,99,.4);border-radius:18px;padding:17px;background:linear-gradient(140deg,rgba(230,189,99,.13),rgba(255,255,255,.035))}",
    ".pm-title{font-size:27px;font-weight:950;margin:7px 0}.pm-description,.pm-note{font-size:12px;line-height:1.55;color:var(--muted)}",
    ".pm-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.pm-stat{text-align:center;border:1px solid var(--line);background:rgba(255,255,255,.04);border-radius:13px;padding:12px 4px}",
    ".pm-number{font-size:24px;font-weight:950;color:var(--gold)}.pm-label{font-size:10px;color:var(--muted);font-weight:800}.pm-bar{height:13px;border:1px solid var(--line);border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden}.pm-bar>span{display:block;height:100%;background:linear-gradient(90deg,var(--green2),var(--gold));width:0}",
    ".pm-actions{display:flex;flex-wrap:wrap;gap:8px}.pm-actions button{flex:1;min-width:140px}.pm-controls{display:grid;grid-template-columns:minmax(0,1fr) 175px;gap:8px}.pm-controls input,.pm-controls select{width:100%;min-height:46px;border:1px solid var(--line);background:var(--cream);color:var(--ink);border-radius:12px;padding:8px}",
    ".pm-list{display:grid;gap:7px}.pm-card{min-height:57px;display:flex;gap:8px;align-items:center;text-align:left;width:100%;background:rgba(255,255,255,.04);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:10px 12px}.pm-card-name{font-size:14px;font-weight:850}.pm-card-sub{font-size:11px;color:var(--muted);margin-top:4px}.pm-card-tag{font-size:10px;font-weight:850;color:var(--gold);white-space:nowrap}.pm-list-head{font-size:13px;font-weight:850}.pm-empty{padding:20px;border:1px dashed var(--line);border-radius:13px;text-align:center;color:var(--muted);font-size:12px}",
    "@media(max-width:620px){.pm-controls{grid-template-columns:1fr}.pm-number{font-size:20px}.pm-card-tag{white-space:normal;text-align:right}}"
  ].join("");
  document.head.appendChild(style);
}
function render(){
  if(!$("photoMissionScreen"))return;
  const s=load(),r=players(),c=count(s,r),verified=c.yes+c.no;
  $("pmWith").textContent=c.yes;
  $("pmMissing").textContent=c.no;
  $("pmChecked").textContent=verified+" / "+r.length;
  $("pmBarFill").style.width=(r.length?100*c.yes/r.length:0).toFixed(1)+"%";
  $("pmBar").setAttribute("aria-valuenow",c.yes);
  $("pmBar").setAttribute("aria-valuemax",r.length||1);
  const next=MILESTONES.find(n=>n>c.yes&&n<=r.length)||r.length;
  $("pmMilestone").textContent=!r.length?"Your Hall cards will appear here once owned.":
    c.yes===r.length?"🏆 Every eligible Hall card is photographed!":
    verified===0?"Run your first cloud check to count the photos you've already uploaded.":
    "Next photo milestone: "+next+" · "+Math.max(0,next-c.yes)+" photos to go!";
  $("pmSummary").textContent=(c.unknown?c.unknown+" card(s) not verified. ":"")+
    (s.lastScan?"Last complete check: "+new Date(s.lastScan).toLocaleDateString()+". ":"")+
    "Cards in transit are excluded. Special Collection stays separate.";
  $("pmScanBtn").disabled=running;
  $("pmStopBtn").hidden=!running;
  const needle=$("pmSearch").value.trim().toLowerCase();
  const found=r.filter(p=>{
    const has=s.photos[p.name]?.hasPhoto;
    return (view==="all"||(view==="missing"&&has!==true)||(view==="with"&&has===true))
      &&(!needle||p.name.toLowerCase().includes(needle));
  });
  const shown=expanded?found:found.slice(0,25);
  $("pmListHead").textContent=found.length+" card"+(found.length===1?"":"s")+" in this view";
  $("pmList").innerHTML=shown.length?shown.map(p=>{
    const state=s.photos[p.name]?.hasPhoto;
    const label=state===true?"✓ Photo":state===false?"📷 Needs photo":"? Unchecked";
    const sub=[p.cardYear,p.set,p.cardNum?"#"+p.cardNum:""].filter(Boolean).join(" · ")||"Owned representative";
    return '<button type="button" class="pm-card" data-pm-name="'+esc(p.name)+'"><span style="flex:1;min-width:0"><span class="pm-card-name">'+esc(p.name)+'</span><span class="pm-card-sub" style="display:block">'+esc(sub)+'</span></span><span class="pm-card-tag">'+label+'</span></button>';
  }).join(""):'<div class="pm-empty">No cards in this view. Try another filter or search.</div>';
  $("pmMoreBtn").hidden=expanded||found.length<=25;
}
async function scan(){
  if(running)return;
  const cfg=opts.connection()||{},endpoint=String(cfg.endpoint||"").trim().replace(/\/+$/,""),key=String(cfg.accessKey||"");
  if(!/^https:\/\//i.test(endpoint)||!key){
    notify("Scout Cloud isn't connected on this device. Add your connection key in the app settings first.");
    return;
  }
  const roster=players();
  if(!roster.length){notify("No arrived Hall cards to scan yet.");return;}
  running=true;controller=new AbortController();const signal=controller.signal;
  let cursor=0,done=0,failed=0;
  const state=load();
  notify("Checking cloud photos: 0 of "+roster.length);render();
  async function worker(){
    while(!signal.aborted&&cursor<roster.length){
      const p=roster[cursor++];
      try{
        const res=await fetch(endpoint+"/card-photo?player="+encodeURIComponent(p.name),{
          headers:{"X-Scout-Key":key},cache:"no-store",signal
        });
        if(res.body)res.body.cancel().catch(()=>{});
        if(res.ok||res.status===404)state.photos[p.name]={hasPhoto:res.ok,checkedAt:new Date().toISOString()};
        else failed++;
      }catch(err){if(signal.aborted)return;failed++;}
      done++;
      if(done%4===0||done===roster.length){
        save(state);render();notify("Checking cloud photos: "+done+" of "+roster.length+(failed?" ("+failed+" unavailable)":""));
      }
    }
  }
  try{
    await Promise.all(Array.from({length:Math.min(3,roster.length)},()=>worker()));
    if(!signal.aborted&&failed===0)state.lastScan=new Date().toISOString();
    save(state);
    notify(signal.aborted?"Check stopped. Results already verified are saved.":"Check finished: "+done+" checked"+(failed?", "+failed+" unavailable":".")+" Tap a card to open its photo controls.");
  }finally{running=false;controller=null;render();}
}
function onPhotoChanged(event){
  const name=String(event?.detail?.player||"");
  if(!name||typeof event?.detail?.hasPhoto!=="boolean")return;
  const s=load(),r=players(),before=count(s,r).yes;
  s.photos[name]={hasPhoto:event.detail.hasPhoto,checkedAt:new Date().toISOString()};
  save(s);render();
  const after=count(s,r).yes;
  if(after>before&&MILESTONES.includes(after)&&opts.toast)opts.toast("⚾ Photo Mission: "+after+" photos!");
}
function open(){
  expanded=false;view="missing";$("pmFilter").value=view;$("pmSearch").value="";
  opts.navigate("photoMissionScreen");render();
  if(!load().lastScan)notify("Tap CHECK CLOUD PHOTOS to discover your existing uploads. The first check may take a little while.");
}
function init(config){
  if(initialized||!config||typeof config.players!=="function")return;
  const main=document.querySelector("main"),grid=document.querySelector("#homeScreen .quick-grid");
  if(!main||!grid)return;
  initialized=true;opts=config;makeStyles();
  const b=document.createElement("button");b.id="photoMissionBtn";b.type="button";b.className="ghost";b.textContent="📸 PHOTO MISSION";
  const anchor=$("specialCollectionBtn");if(anchor)anchor.insertAdjacentElement("afterend",b);else grid.appendChild(b);
  main.insertAdjacentHTML("beforeend",[
    '<section class="screen" id="photoMissionScreen"><button type="button" class="back" id="pmBack">← Back to Home</button>',
    '<div class="pm-wrap"><div class="pm-hero"><div class="section-eyebrow">📸 PHOTO MISSION</div>',
    '<h2 class="pm-title">Every Card Has a Story</h2><p class="pm-description">Build a photo album of your actual Hall of Fame representative cards. No marketplace searches, no guesses, and no change to your Hall completion numbers.</p></div>',
    '<div class="pm-stats"><div class="pm-stat"><div class="pm-number" id="pmWith">0</div><div class="pm-label">WITH PHOTOS</div></div>',
    '<div class="pm-stat"><div class="pm-number" id="pmMissing">0</div><div class="pm-label">VERIFIED MISSING</div></div>',
    '<div class="pm-stat"><div class="pm-number" id="pmChecked">0 / 0</div><div class="pm-label">CHECKED</div></div></div>',
    '<div class="pm-bar" id="pmBar" role="progressbar" aria-label="Hall photo progress" aria-valuemin="0"><span id="pmBarFill"></span></div>',
    '<div class="pm-note" id="pmMilestone"></div><div class="pm-note" id="pmSummary"></div>',
    '<div class="pm-actions"><button type="button" class="primary" id="pmScanBtn">☁️ CHECK CLOUD PHOTOS</button><button type="button" class="ghost" id="pmStopBtn" hidden>STOP CHECK</button></div>',
    '<div class="pm-note" role="status" aria-live="polite" id="photoMissionScanStatus"></div>',
    '<div class="pm-controls"><input id="pmSearch" type="search" placeholder="Find a Hall of Famer…" aria-label="Search photo roster">',
    '<select id="pmFilter" aria-label="Filter photos"><option value="missing">Needs photo / unchecked</option><option value="with">Has photo</option><option value="all">All owned cards</option></select></div>',
    '<div id="pmListHead" class="pm-list-head"></div><div id="pmList" class="pm-list"></div>',
    '<button type="button" class="ghost" id="pmMoreBtn" hidden>SHOW MORE</button></div></section>'
  ].join(""));
  b.addEventListener("click",open);
  $("pmBack").addEventListener("click",()=>{if(controller)controller.abort();opts.navigate("homeScreen");});
  $("pmScanBtn").addEventListener("click",scan);
  $("pmStopBtn").addEventListener("click",()=>{if(controller)controller.abort();});
  $("pmSearch").addEventListener("input",()=>{expanded=false;render();});
  $("pmFilter").addEventListener("change",e=>{view=e.target.value;expanded=false;render();});
  $("pmMoreBtn").addEventListener("click",()=>{expanded=true;render();});
  $("pmList").addEventListener("click",e=>{
    const btn=e.target.closest("[data-pm-name]");if(!btn)return;
    const p=players().find(x=>x.name===btn.dataset.pmName);
    if(p)opts.openPlayer(p);
  });
  document.addEventListener("scout:card-photo-changed",onPhotoChanged);
  render();
}
root.ScoutPhotoMission={init,open};
})(typeof globalThis!=="undefined"?globalThis:this);
