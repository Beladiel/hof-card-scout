from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Version.
s=s.replace('· v5.3.1</div>','· v5.4.0</div>',1)

# Visual stale marker in Hunt List.
old_css='.hunt-fact.money{color:#f4d58a;border-color:rgba(230,189,99,.30)}\n.hunt-fact.future{color:#b7d8f5;border-color:rgba(117,174,233,.30)}'
new_css='.hunt-fact.money{color:#f4d58a;border-color:rgba(230,189,99,.30)}\n.hunt-fact.stale{color:#ffaaa2;border-color:rgba(239,108,108,.35);background:rgba(239,108,108,.07)}\n.hunt-fact.future{color:#b7d8f5;border-color:rgba(117,174,233,.30)}'
if old_css not in s: raise SystemExit('hunt fact CSS anchor not found')
s=s.replace(old_css,new_css,1)

# Shared freshness helpers. Missing timestamps are intentionally treated as stale so legacy
# listing URLs are never presented as current without a fresh check.
helper_marker='/* v5.0.3 — recommendation listing price check */'
helpers=r'''/* v5.4.0 — stale marketplace result cleanup */
const SCOUT_ACTIVE_RESULT_TTL_MS=24*60*60*1000;
function scoutResultAgeMs(iso,now=Date.now()){
  const t=Date.parse(String(iso||""));
  return Number.isFinite(t)?Math.max(0,now-t):null;
}
function scoutResultIsStale(iso,now=Date.now()){
  const age=scoutResultAgeMs(iso,now);
  return age===null||age>SCOUT_ACTIVE_RESULT_TTL_MS;
}
function scoutRememberExpiredIds(rows,excluded=[]){
  const next=Array.isArray(excluded)?excluded:[];
  for(const item of (Array.isArray(rows)?rows:[])){
    const id=item?.id||item?.productId;
    if(id&&!next.includes(String(id)))next.push(String(id));
  }
  return next;
}
function scoutTargetListingStale(p){
  return !!p?.targetListingUrl&&scoutResultIsStale(p.targetUpdatedAt);
}
function scoutFutureListingStale(p){
  const savedAt=p?.savedFutureTarget?.savedAt||p?.savedAt||"";
  return !!p?.listingUrl&&scoutResultIsStale(savedAt);
}

'''
if 'const SCOUT_ACTIVE_RESULT_TTL_MS=' not in s:
    if helper_marker not in s: raise SystemExit('freshness helper marker not found')
    s=s.replace(helper_marker,helpers+helper_marker,1)

# Find a Target gets an age stamp and refuses stale save/view actions.
s=s.replace('let findTargetPreviousSummary=null;\n','let findTargetPreviousSummary=null;\nlet findTargetCheckedAt=null;\n',1)
s=s.replace('  findTargetPreviousSummary=null;\n  $("findTargetResult").hidden=true;','  findTargetPreviousSummary=null;\n  findTargetCheckedAt=null;\n  $("findTargetResult").hidden=true;',1)

expire_find=r'''function findTargetExpireStaleResult(){
  if(!findTargetSuggestion||!scoutResultIsStale(findTargetCheckedAt))return false;
  const rows=findTargetSuggestions.length?findTargetSuggestions:[findTargetSuggestion];
  scoutRememberExpiredIds(rows,findTargetExcludedIds);
  findTargetSuggestion=null;
  findTargetSuggestions=[];
  findTargetPreviousSummary=null;
  findTargetCheckedAt=null;
  $("findTargetResult").hidden=true;
  $("findTargetStatus").className="find-target-status bad";
  $("findTargetStatus").textContent="Previous marketplace results are over 24 hours old. Run a fresh search before saving or opening a listing.";
  return true;
}
'''
if 'function findTargetExpireStaleResult()' not in s:
    marker='function openFindTarget(){'
    if marker not in s: raise SystemExit('openFindTarget marker not found')
    s=s.replace(marker,expire_find+marker,1)

old='function openFindTarget(){\n  if(!currentPlayer)return;'
new='function openFindTarget(){\n  if(!currentPlayer)return;\n  if(findTargetPlayerName===currentPlayer.name)findTargetExpireStaleResult();'
if old not in s: raise SystemExit('openFindTarget start anchor not found')
s=s.replace(old,new,1)

old='    findTargetSuggestions=(Array.isArray(data.suggestions)&&data.suggestions.length?data.suggestions:[data.suggestion]).slice(0,5);\n    data.suggestion=findTargetSuggestions[0];'
new='    findTargetSuggestions=(Array.isArray(data.suggestions)&&data.suggestions.length?data.suggestions:[data.suggestion]).slice(0,5);\n    findTargetCheckedAt=data.checkedAt||new Date().toISOString();\n    data.suggestion=findTargetSuggestions[0];'
if old not in s: raise SystemExit('find target response anchor not found')
s=s.replace(old,new,1)

old='function saveFindTarget(){\n  const s=findTargetSuggestion,p=currentPlayer;\n  if(!s||!p)return;'
new='function saveFindTarget(){\n  const s=findTargetSuggestion,p=currentPlayer;\n  if(!s||!p)return;\n  if(scoutResultIsStale(findTargetCheckedAt)){\n    findTargetExpireStaleResult();\n    toast("That marketplace result is over 24 hours old. Run a fresh search first.");\n    return;\n  }'
if old not in s: raise SystemExit('saveFindTarget anchor not found')
s=s.replace(old,new,1)

old='$("findTargetViewBtn").addEventListener("click",()=>{const u=$("findTargetViewBtn").dataset.link;if(u)window.open(u,"_blank","noopener")});'
new='''$("findTargetViewBtn").addEventListener("click",()=>{\n  if(scoutResultIsStale(findTargetCheckedAt)){findTargetExpireStaleResult();toast("That marketplace result is over 24 hours old. Run a fresh search first.");return;}\n  const u=$("findTargetViewBtn").dataset.link;if(u)window.open(u,"_blank","noopener");\n});'''
if old not in s: raise SystemExit('find target view handler anchor not found')
s=s.replace(old,new,1)

# Monthly Pick keeps the monthly player locked, but expires the old listing/recommendation.
monthly_helper=r'''function monthlyExpireStaleResult(){
  if(!monthlyState?.suggestion||monthlyState.purchase||!scoutResultIsStale(monthlyState.checkedAt))return false;
  const rows=Array.isArray(monthlyState.suggestions)&&monthlyState.suggestions.length?monthlyState.suggestions:[monthlyState.suggestion];
  monthlyState.excludedIds=scoutRememberExpiredIds(rows,monthlyState.excludedIds||[]);
  monthlyState.suggestion=null;
  monthlyState.suggestions=[];
  monthlyState.checkedAt=null;
  monthlyWriteState(false);
  return true;
}
'''
if 'function monthlyExpireStaleResult()' not in s:
    marker='function monthlyInit(){'
    if marker not in s: raise SystemExit('monthlyInit marker not found')
    s=s.replace(marker,monthly_helper+marker,1)

old='  monthlyRenderHeader();\n  if(monthlyState.purchase){'
new='  const staleMonthlyResult=monthlyExpireStaleResult();\n  monthlyRenderHeader();\n  if(monthlyState.purchase){'
if old not in s: raise SystemExit('monthly init render anchor not found')
s=s.replace(old,new,1)

start=s.index('function monthlyInit(){')
branch='  }else if(monthlyState.suggestion){'
pos=s.find(branch,start)
if pos<0: raise SystemExit('monthly suggestion branch not found')
stale_branch='''  }else if(staleMonthlyResult){\n    $("monthlyResult").hidden=true;\n    $("monthlyPurchase").hidden=true;\n    $("monthlyStatus").className="monthly-status bad";\n    $("monthlyStatus").textContent="The previous marketplace recommendation is over 24 hours old. Tap Refresh Listing for a current option.";\n    $("monthlyScoutBtn").disabled=false;\n    $("monthlyScoutBtn").textContent="🔄 REFRESH LISTING";\n'''
s=s[:pos]+stale_branch+s[pos+len('  }else'):]

# Hunt List: preserve target history but stop stale listing URLs/price verdicts from looking current.
old='  if(p.targetListingUrl)facts.push(\'<span class="hunt-fact">SAVED LISTING</span>\');'
new='  if(p.targetListingUrl)facts.push(scoutTargetListingStale(p)?\'<span class="hunt-fact stale">OLD LISTING · RECHECK</span>\':\'<span class="hunt-fact">SAVED LISTING · RECENT</span>\');'
if old not in s: raise SystemExit('official target fact anchor not found')
s=s.replace(old,new,1)

old='  if(String(t.autoPreference||"")&&String(t.autoPreference)!=="No preference")facts.push(\'<span class="hunt-fact">\'+escapeHtml(t.autoPreference)+\'</span>\');\n  facts.push(\'<span class="hunt-fact future">FUTURE HOF</span>\');'
new='  if(String(t.autoPreference||"")&&String(t.autoPreference)!=="No preference")facts.push(\'<span class="hunt-fact">\'+escapeHtml(t.autoPreference)+\'</span>\');\n  if(t.listingUrl)facts.push(scoutFutureListingStale(p)?\'<span class="hunt-fact stale">OLD LISTING · RECHECK</span>\':\'<span class="hunt-fact">SAVED LISTING · RECENT</span>\');\n  facts.push(\'<span class="hunt-fact future">FUTURE HOF</span>\');'
if old not in s: raise SystemExit('future target fact anchor not found')
s=s.replace(old,new,1)

old='    const saved=p.targetListingUrl?\'<button type="button" class="primary" data-hunt-action="listing" data-player="\'+name+\'">VIEW SAVED LISTING →</button>\':\'\';'
new='    const saved=p.targetListingUrl&&!scoutTargetListingStale(p)?\'<button type="button" class="primary" data-hunt-action="listing" data-player="\'+name+\'">VIEW SAVED LISTING →</button>\':\'\';'
if old not in s: raise SystemExit('official saved listing action anchor not found')
s=s.replace(old,new,1)

old='''  if(action==="listing"){\n    if(p.targetListingUrl)window.open(p.targetListingUrl,"_blank","noopener");\n    return;\n  }'''
new='''  if(action==="listing"){\n    if(scoutTargetListingStale(p)){toast("That saved marketplace listing is over 24 hours old. Use Find / Replace for a fresh option.");renderHuntList();return;}\n    if(p.targetListingUrl)window.open(p.targetListingUrl,"_blank","noopener");\n    return;\n  }'''
if old not in s: raise SystemExit('official listing action guard anchor not found')
s=s.replace(old,new,1)

old='  const listing=p.listingUrl?\'<button type="button" class="primary" data-future-hunt-action="listing" data-future-url="\'+encodeURIComponent(p.listingUrl)+\'">VIEW SAVED LISTING →</button>\':\'\';'
new='  const listing=p.listingUrl&&!scoutFutureListingStale(p)?\'<button type="button" class="primary" data-future-hunt-action="listing" data-future-name="\'+name+\'" data-future-url="\'+encodeURIComponent(p.listingUrl)+\'">VIEW SAVED LISTING →</button>\':\'\';'
if old not in s: raise SystemExit('future saved listing action anchor not found')
s=s.replace(old,new,1)

old='''    if(action==="listing"){\n      const url=decodeURIComponent(b.dataset.futureUrl||"");\n      if(url)window.open(url,"_blank","noopener");\n      return;'''
new='''    if(action==="listing"){\n      const target=futureHofGetState().targets?.[name];\n      if(!target||scoutResultIsStale(target.savedAt)){toast("That saved marketplace listing is over 24 hours old. Use Find / Replace for a fresh option.");renderHuntList();return;}\n      const url=decodeURIComponent(b.dataset.futureUrl||"");\n      if(url)window.open(url,"_blank","noopener");\n      return;'''
if old not in s: raise SystemExit('future listing handler anchor not found')
s=s.replace(old,new,1)

old='      const price=p.priceVerdict?" · "+escapeHtml(p.priceVerdict):"";'
new='      const price=!scoutFutureListingStale(p)&&p.priceVerdict?" · "+escapeHtml(p.priceVerdict):"";'
if old not in s: raise SystemExit('future list price verdict anchor not found')
s=s.replace(old,new,1)

old='    const targetLine=p.target+(p.priceVerdict?" · "+p.priceVerdict:"");'
new='    const targetLine=p.target+(!scoutFutureListingStale(p)&&p.priceVerdict?" · "+p.priceVerdict:"");'
if old not in s: raise SystemExit('future hunt price verdict anchor not found')
s=s.replace(old,new,1)

old='${target.priceVerdict?` · ${escapeHtml(target.priceVerdict)}`:""}'
new='${!scoutResultIsStale(target.savedAt)&&target.priceVerdict?` · ${escapeHtml(target.priceVerdict)}`:""}${target.listingUrl&&scoutResultIsStale(target.savedAt)?" · OLD LISTING — RECHECK":""}'
if old not in s: raise SystemExit('future forecast price verdict anchor not found')
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')

# Dashboard test owns the visible app version assertion.
t=Path('tests/collection-dashboard.test.cjs')
txt=t.read_text(encoding='utf-8').replace('assert.match(html,/v5\\.3\\.1/);','assert.match(html,/v5\\.4\\.0/);')
t.write_text(txt,encoding='utf-8')

# Regression contract for freshness behavior.
Path('tests/stale-results.test.cjs').write_text(r'''const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("index.html","utf8");

assert.match(html,/v5\.4\.0/);
assert.match(html,/const SCOUT_ACTIVE_RESULT_TTL_MS=24\*60\*60\*1000/);
assert.match(html,/function scoutResultIsStale\(/);
assert.match(html,/function findTargetExpireStaleResult\(/);
assert.match(html,/findTargetCheckedAt=data\.checkedAt\|\|new Date\(\)\.toISOString\(\)/);
assert.match(html,/function monthlyExpireStaleResult\(/);
assert.match(html,/🔄 REFRESH LISTING/);
assert.match(html,/OLD LISTING · RECHECK/);
assert.match(html,/scoutTargetListingStale\(p\)/);
assert.match(html,/scoutFutureListingStale\(p\)/);
assert.match(html,/Use Find \/ Replace for a fresh option/);

const start=html.indexOf('const SCOUT_ACTIVE_RESULT_TTL_MS=');
const end=html.indexOf('/* v5.0.3 — recommendation listing price check */',start);
assert.ok(start>=0&&end>start,'freshness helpers should be extractable');
const ctx={Date};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(html.slice(start,end)+`\nglobalThis.staleApi={scoutResultIsStale,scoutRememberExpiredIds};`,ctx);
const now=Date.now();
assert.equal(ctx.staleApi.scoutResultIsStale(new Date(now-60*60*1000).toISOString(),now),false);
assert.equal(ctx.staleApi.scoutResultIsStale(new Date(now-25*60*60*1000).toISOString(),now),true);
assert.equal(ctx.staleApi.scoutResultIsStale('',now),true);
const ids=['1'];
ctx.staleApi.scoutRememberExpiredIds([{id:'1'},{productId:'2'}],ids);
assert.deepEqual(Array.from(ids),['1','2']);
console.log('Stale marketplace result tests passed.');
''',encoding='utf-8')
