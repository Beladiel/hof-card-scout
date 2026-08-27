from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

css=r'''
/* v5.2.0 — Hunt List 2.0 */
.hunt-stats{grid-template-columns:repeat(4,1fr)}
.hunt-stat[data-hunt-filter="all"]{background:linear-gradient(145deg,rgba(230,189,99,.11),rgba(255,255,255,.025))}
.hunt-command-note{font-size:11px;color:var(--muted);line-height:1.45;margin:8px 1px 2px}
.hunt-group{margin-top:16px}
.hunt-group:first-child{margin-top:8px}
.hunt-group-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 2px 5px;border-bottom:1px solid rgba(255,255,255,.07)}
.hunt-group-title{font-size:11px;font-weight:950;letter-spacing:.09em;color:var(--gold)}
.hunt-group-sub{font-size:10px;color:var(--muted);margin-top:2px}
.hunt-group-count{min-width:28px;height:28px;border-radius:999px;display:grid;place-items:center;border:1px solid var(--line);font-size:11px;font-weight:950;background:rgba(255,255,255,.04)}
.hunt-card{position:relative;overflow:hidden}
.hunt-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:transparent}
.hunt-card.target:before{background:var(--gold)}
.hunt-card.need:before{background:var(--red)}
.hunt-card.incoming:before{background:#75aee9}
.hunt-card.future-target:before{background:#9cc7f0}
.hunt-cardline strong{color:var(--text)}
.hunt-facts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.hunt-fact{font-size:9px;font-weight:850;border:1px solid var(--line);border-radius:999px;padding:4px 7px;color:var(--muted);background:rgba(255,255,255,.025)}
.hunt-fact.money{color:#f4d58a;border-color:rgba(230,189,99,.30)}
.hunt-fact.future{color:#b7d8f5;border-color:rgba(117,174,233,.30)}
.hunt-actions .danger{min-height:40px;padding:8px 11px;font-size:11px}
@media(max-width:560px){
  .hunt-stats{grid-template-columns:repeat(2,1fr)}
  .hunt-card-top{display:block}
  .hunt-badges{margin:8px 0 0;justify-content:flex-start}
}
'''.strip()
marker='/* v5.0.3 — Find a Target */'
if '/* v5.2.0 — Hunt List 2.0 */' not in s:
    if marker not in s: raise SystemExit('Hunt CSS marker not found')
    s=s.replace(marker,css+'\n\n'+marker,1)

s=s.replace(
    '<div class="hunt-title">🛒 My Hunt List</div>\n            <div class="hunt-sub">Your fast card-shop view: missing Hall of Famers, saved targets, and cards still on the way.</div>',
    '<div class="hunt-title">🛒 Hunt List 2.0</div>\n            <div class="hunt-sub">Your card-shop command center: targets ready to hunt, open roster spots, and cards already on the way.</div>',
    1
)

old_stats='''        <div class="hunt-stats">\n          <button type="button" class="hunt-stat active" data-hunt-filter="need">\n            <div class="n" id="huntNeedCount">0</div><div class="k">NEED</div>\n          </button>'''
new_stats='''        <div class="hunt-stats">\n          <button type="button" class="hunt-stat active" data-hunt-filter="all">\n            <div class="n" id="huntActiveCount">0</div><div class="k">ALL ACTIVE</div>\n          </button>\n          <button type="button" class="hunt-stat" data-hunt-filter="need">\n            <div class="n" id="huntNeedCount">0</div><div class="k">NEED</div>\n          </button>'''
if 'id="huntActiveCount"' not in s:
    if old_stats not in s: raise SystemExit('Hunt stats anchor not found')
    s=s.replace(old_stats,new_stats,1)

old_search='''        <input class="hunt-search" id="huntSearch" type="search" placeholder="Search Hunt List…" autocomplete="off">'''
new_search='''        <input class="hunt-search" id="huntSearch" type="search" placeholder="Search player, target, grade, or purchase…" autocomplete="off">\n        <div class="hunt-command-note">All Active is grouped by what needs your attention: saved targets first, open roster spots next, and incoming cards last.</div>'''
if 'class="hunt-command-note"' not in s:
    if old_search not in s: raise SystemExit('Hunt search anchor not found')
    s=s.replace(old_search,new_search,1)

new_chunk=r'''let huntFilter="all";

function huntNeedPlayers(){return PLAYERS.filter(p=>!p.owned&&!p.incoming&&!p.target)}
function huntTargetPlayers(){return PLAYERS.filter(p=>!!p.target&&!p.incoming).concat(futureHofActiveTargetEntries())}
function huntIncomingPlayers(){return PLAYERS.filter(p=>!!p.incoming)}
function huntOfficialActivePlayers(){return PLAYERS.filter(p=>p.incoming||(!p.owned&&!p.incoming)||!!(p.target&&!p.incoming))}
function huntActiveCount(){return huntOfficialActivePlayers().length+futureHofActiveTargetEntries().length}
function huntMatchesFilter(p){
  if(huntFilter==="need")return !p.owned&&!p.incoming&&!p.target;
  if(huntFilter==="target")return !!p.target&&!p.incoming;
  if(huntFilter==="incoming")return !!p.incoming;
  return p.incoming||(!p.owned&&!p.incoming)||!!(p.target&&!p.incoming);
}
function huntSectionName(){
  if(huntFilter==="target")return "READY TO HUNT · SAVED TARGETS";
  if(huntFilter==="incoming")return "ON THE WAY · PURCHASES IN TRANSIT";
  if(huntFilter==="all")return "SHOPPING COMMAND CENTER";
  return "OPEN ROSTER SPOTS · NO TARGET YET";
}
function huntPrimaryGroup(p){
  if(p?.futureHofTarget)return "target";
  if(p?.incoming)return "incoming";
  if(p?.target)return "target";
  return "need";
}
function huntGroupMeta(group,count){
  if(group==="target")return {title:"🎯 READY TO HUNT",sub:"Exact cards you have already chosen.",count};
  if(group==="incoming")return {title:"📦 ON THE WAY",sub:"Bought already — no more shopping needed.",count};
  return {title:"✕ OPEN ROSTER SPOTS",sub:"Hall of Famers who still need a card and do not have a saved target.",count};
}
function huntBadges(p){
  const b=[];
  if(p.incoming)b.push('<span class="hunt-badge incoming">📦 INCOMING</span>');
  else if(p.target)b.push('<span class="hunt-badge target">🎯 TARGET</span>');
  else if(!p.owned)b.push('<span class="hunt-badge need">✕ NEED</span>');
  return b.join("");
}
function huntDetail(p){
  if(p.incoming){
    const bits=[cardLabel(p)];
    const purchase=purchaseSummary(p);
    if(purchase)bits.push(purchase);
    return bits.filter(Boolean).join(" · ");
  }
  if(p.target)return [targetIdentityLabel(p),...targetPreferenceBits(p)].filter(Boolean).join(" · ");
  return "No target selected yet · any representative card can fill this spot.";
}
function huntTargetFacts(p){
  if(!p?.target)return "";
  const facts=[];
  const max=Number(p.targetMaxPrice);
  const grader=String(p.targetGrader||"").trim();
  const grade=String(p.targetGrade||"").trim();
  const auto=String(p.targetAutoPreference||"").trim();
  if(Number.isFinite(max)&&max>0)facts.push('<span class="hunt-fact money">MAX '+escapeHtml(formatMoney(max))+' DELIVERED</span>');
  if(grader&&grader!=="Any / Raw OK")facts.push('<span class="hunt-fact">'+escapeHtml(grader+(grade?" "+grade:""))+'</span>');
  else if(grade)facts.push('<span class="hunt-fact">'+escapeHtml(grade)+'</span>');
  if(auto&&auto!=="No preference")facts.push('<span class="hunt-fact">'+escapeHtml(auto)+'</span>');
  if(p.targetListingUrl)facts.push('<span class="hunt-fact">SAVED LISTING</span>');
  return facts.length?'<div class="hunt-facts">'+facts.join("")+'</div>':"";
}
function huntFutureFacts(p){
  const t=p?.savedFutureTarget||{},facts=[];
  const max=Number(t.maxPrice);
  if(Number.isFinite(max)&&max>0)facts.push('<span class="hunt-fact money">MAX '+escapeHtml(formatMoney(max))+' DELIVERED</span>');
  const grader=String(t.grader||"").trim(),grade=String(t.grade||"").trim();
  if(grader&&grader!=="Any / Raw OK")facts.push('<span class="hunt-fact">'+escapeHtml(grader+(grade?" "+grade:""))+'</span>');
  if(String(t.autoPreference||"")&&String(t.autoPreference)!=="No preference")facts.push('<span class="hunt-fact">'+escapeHtml(t.autoPreference)+'</span>');
  facts.push('<span class="hunt-fact future">FUTURE HOF</span>');
  return '<div class="hunt-facts">'+facts.join("")+'</div>';
}
function huntActions(p){
  const name=escapeHtml(p.name);
  if(p.incoming){
    return '<button type="button" class="secondary" data-hunt-action="received" data-player="'+name+'">✓ MARK RECEIVED</button>'+ 
      '<button type="button" class="ghost" data-hunt-action="view" data-player="'+name+'">VIEW CARD</button>';
  }
  if(p.target){
    const saved=p.targetListingUrl?'<button type="button" class="primary" data-hunt-action="listing" data-player="'+name+'">VIEW SAVED LISTING →</button>':'';
    return '<button type="button" class="secondary" data-hunt-action="findtarget" data-player="'+name+'">🔎 FIND / REPLACE</button>'+ 
      '<button type="button" class="ghost" data-hunt-action="target" data-player="'+name+'">⚾ CHECK SAVED TARGET</button>'+ 
      '<button type="button" class="ghost" data-hunt-action="edit" data-player="'+name+'">✎ EDIT TARGET</button>'+saved+
      '<button type="button" class="ghost" data-hunt-action="view" data-player="'+name+'">VIEW PLAYER</button>';
  }
  return '<button type="button" class="secondary" data-hunt-action="findtarget" data-player="'+name+'">🔎 FIND A TARGET</button>'+ 
    '<button type="button" class="ghost" data-hunt-action="settarget" data-player="'+name+'">🎯 SET MANUALLY</button>'+ 
    '<button type="button" class="ghost" data-hunt-action="view" data-player="'+name+'">VIEW PLAYER</button>';
}
function huntFutureActions(p){
  const name=escapeHtml(p.name);
  const listing=p.listingUrl?'<button type="button" class="primary" data-future-hunt-action="listing" data-future-url="'+encodeURIComponent(p.listingUrl)+'">VIEW SAVED LISTING →</button>':'';
  return '<button type="button" class="secondary" data-future-hunt-action="find" data-future-name="'+name+'">🔎 FIND / REPLACE</button>'+ 
    '<button type="button" class="ghost" data-future-hunt-action="edit" data-future-name="'+name+'">✎ EDIT TARGET</button>'+listing+
    '<button type="button" class="danger" data-future-hunt-action="remove" data-future-name="'+name+'">REMOVE TARGET</button>'+ 
    '<button type="button" class="ghost" data-future-hunt-action="watch" data-future-name="'+name+'">FUTURE HOF PAGE</button>';
}
function huntRenderCard(p){
  if(p.futureHofTarget){
    const targetLine=p.target+(p.priceVerdict?" · "+p.priceVerdict:"");
    return '<div class="hunt-card target future-target">'+
      '<div class="hunt-card-top"><div><div class="hunt-player">'+escapeHtml(p.name)+'</div>'+ 
      '<div class="hunt-cardline">'+escapeHtml(targetLine)+'</div>'+huntFutureFacts(p)+'</div>'+ 
      '<div class="hunt-badges"><span class="hunt-badge target">🎯 TARGET</span><span class="hunt-badge future">🔮 NOT YET IN HALL</span></div></div>'+ 
      '<div class="hunt-actions">'+huntFutureActions(p)+'</div></div>';
  }
  const group=huntPrimaryGroup(p);
  return '<div class="hunt-card '+group+'">'+
    '<div class="hunt-card-top"><div><div class="hunt-player">'+escapeHtml(p.name)+'</div>'+ 
    '<div class="hunt-cardline">'+escapeHtml(huntDetail(p))+'</div>'+huntTargetFacts(p)+'</div>'+ 
    '<div class="hunt-badges">'+huntBadges(p)+'</div></div>'+ 
    '<div class="hunt-actions">'+huntActions(p)+'</div></div>';
}
function huntSortRows(rows){
  return rows.slice().sort((a,b)=>String(a.last||a.name).localeCompare(String(b.last||b.name))||String(a.name).localeCompare(String(b.name)));
}
function huntGroupHtml(group,rows){
  if(!rows.length)return "";
  const meta=huntGroupMeta(group,rows.length);
  return '<section class="hunt-group"><div class="hunt-group-head"><div><div class="hunt-group-title">'+meta.title+'</div><div class="hunt-group-sub">'+meta.sub+'</div></div><div class="hunt-group-count">'+meta.count+'</div></div>'+huntSortRows(rows).map(huntRenderCard).join("")+'</section>';
}
function renderHuntList(){
  if(!$("huntList"))return;

  const futureTargets=futureHofActiveTargetEntries();
  $("huntActiveCount").textContent=huntActiveCount();
  $("huntNeedCount").textContent=huntNeedPlayers().length;
  $("huntTargetCount").textContent=huntTargetPlayers().length;
  $("huntIncomingCount").textContent=huntIncomingPlayers().length;
  $("huntSectionLabel").textContent=huntSectionName();

  const q=$("huntSearch").value.trim().toLowerCase();
  const officialRows=PLAYERS.filter(huntMatchesFilter).filter(p=>{
    if(!q)return true;
    return [p.name,p.target,p.targetNotes,p.targetSet,p.targetCardNum,p.targetGrader,p.targetGrade,p.targetAutoPreference,p.purchaseSource,cardLabel(p),purchaseSummary(p)]
      .some(v=>String(v||"").toLowerCase().includes(q));
  });

  let futureRows=(huntFilter==="target"||huntFilter==="all")?futureTargets:[];
  if(q)futureRows=futureRows.filter(p=>futureHofTargetSearchText(p).includes(q)||String(p.savedFutureTarget?.grader||"").toLowerCase().includes(q)||String(p.savedFutureTarget?.grade||"").toLowerCase().includes(q));
  const rows=officialRows.concat(futureRows);

  if(huntFilter==="all"){
    const grouped={target:[],need:[],incoming:[]};
    rows.forEach(p=>grouped[huntPrimaryGroup(p)].push(p));
    $("huntList").innerHTML=huntGroupHtml("target",grouped.target)+huntGroupHtml("need",grouped.need)+huntGroupHtml("incoming",grouped.incoming)||'<div class="hunt-empty">Nothing in this view.</div>';
  }else{
    $("huntList").innerHTML=rows.length?huntSortRows(rows).map(huntRenderCard).join(""):'<div class="hunt-empty">Nothing in this view.</div>';
  }

  document.querySelectorAll("[data-hunt-action]").forEach(b=>b.addEventListener("click",()=>huntAction(b.dataset.huntAction,b.dataset.player)));
  document.querySelectorAll("[data-future-hunt-action]").forEach(b=>b.addEventListener("click",()=>{
    const action=b.dataset.futureHuntAction,name=b.dataset.futureName||"";
    if(action==="listing"){
      const url=decodeURIComponent(b.dataset.futureUrl||"");
      if(url)window.open(url,"_blank","noopener");
      return;
    }
    if(action==="edit"){futureHofEditTarget(name);return;}
    if(action==="remove"){futureHofRemoveTarget(name);return;}
    if(action==="find"){
      openFutureHofTargetFromList(name);
      setTimeout(()=>$("futureBudget-"+futureHofSlug(name))?.focus(),160);
      return;
    }
    if(action==="watch")openFutureHofTargetFromList(name);
  }));
}
'''
pattern=re.compile(r'let huntFilter="need";\n.*?(?=function setHuntFilter\(f\)\{)',re.S)
if 'function huntActiveCount()' not in s:
    m=pattern.search(s)
    if not m: raise SystemExit('Hunt JS block not found')
    s=s[:m.start()]+new_chunk+s[m.end():]

s=s.replace('function openHuntList(filter="need"){','function openHuntList(filter="all"){',1)
s=s.replace('$("huntModeBtn").addEventListener("click",()=>openHuntList("need"));','$("huntModeBtn").addEventListener("click",()=>openHuntList("all"));',1)

new_action=r'''function huntAction(action,name){
  const p=findPlayer(name);
  if(!p){toast("Scout couldn't find that Hall of Famer.");return}
  if(action==="view"){
    openPlayer(p,"huntScreen");
    return;
  }
  if(action==="received"){
    if(!p.incoming)return;
    p.incoming=false;
    savePlayerEdit(p);stats();rotateMission();renderList();renderHuntList();
    toast("📦 "+p.name+" is home. Removed from Incoming.");
    return;
  }
  if(action==="findtarget"){
    openPlayer(p,"huntScreen");
    setTimeout(()=>openFindTarget(),70);
    return;
  }
  if(action==="scout"){
    openShop({name:p.name,cardYear:"",set:"",cardNum:"",description:""});
    return;
  }
  if(action==="settarget"||action==="edit"){
    openTargetManage(p);
    return;
  }
  if(action==="target"){
    phase3bScoutTarget(p);
    return;
  }
  if(action==="listing"){
    if(p.targetListingUrl)window.open(p.targetListingUrl,"_blank","noopener");
    return;
  }
  if(action==="deals"){
    phase3bScoutTarget(p);
    setTimeout(()=>toast("🎯 Run Scout first — FIND DEALS appears in the pricing result."),120);
  }
}

'''
pat_action=re.compile(r'function huntAction\(action,name\)\{.*?\n\}\n\n(?=function openPlayer\()',re.S)
m=pat_action.search(s)
if not m: raise SystemExit('huntAction block not found')
s=s[:m.start()]+new_action+s[m.end():]

s=s.replace('Scout’s rule: asking price is not market value. ⚾ · v5.1.1','Scout’s rule: asking price is not market value. ⚾ · v5.2.0',1)

p.write_text(s,encoding='utf-8')

Path('tests/hunt-list-2.test.cjs').write_text(r'''const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");
assert.match(html,/Hunt List 2\.0/);
assert.match(html,/id="huntActiveCount"/);
assert.match(html,/data-hunt-filter="all"/);
assert.match(html,/let huntFilter="all"/);
assert.match(html,/function huntTargetPlayers\(\)\{return PLAYERS\.filter\(p=>!!p\.target&&!p\.incoming\)/);
assert.match(html,/🎯 READY TO HUNT/);
assert.match(html,/✕ OPEN ROSTER SPOTS/);
assert.match(html,/📦 ON THE WAY/);
assert.match(html,/data-hunt-action="findtarget"/);
assert.match(html,/data-hunt-action="edit"/);
assert.match(html,/data-hunt-action="received"/);
assert.match(html,/data-future-hunt-action="edit"/);
assert.match(html,/data-future-hunt-action="remove"/);
assert.match(html,/targetListingUrl/);
assert.match(html,/v5\.2\.0/);
console.log("Hunt List 2.0 tests passed.");
''',encoding='utf-8')
print('Hunt List 2.0 patched')
