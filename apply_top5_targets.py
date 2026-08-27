from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Could not find {label}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, repl, label, flags=0):
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Could not patch {label}; matches={count}")
    return out


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")
    print("patched", path)


# ---------------- Worker ----------------
path = "src/index.js"
src = Path(path).read_text(encoding="utf-8")
if 'const VERSION = "3.25.0";' not in src:
    src = replace_once(src, 'const VERSION = "3.24.0";', 'const VERSION = "3.25.0";', "Worker version")
    src = replace_once(
        src,
        'return [preliminary, ...remainder].filter(Boolean).slice(0, 3);',
        'return [preliminary, ...remainder].filter(Boolean).slice(0, 5);',
        "target shortlist cap",
    )
    src = replace_once(
        src,
        '''      suggestion: null,\n      alternatesAvailable: 0,''',
        '''      suggestion: null,\n      suggestions: [],\n      alternatesAvailable: 0,''',
        "empty Top 5 response",
    )
    src = replace_once(
        src,
        '''  const suggestion = buildSuggestion(best);\n  const targetShortlist = purpose === "target" ? targetCandidates.map(buildSuggestion) : [];\n\n  return {''',
        '''  const targetShortlist = purpose === "target" ? targetCandidates.map(buildSuggestion) : [];\n  const rankedPool = purpose === "target"\n    ? targetShortlist\n    : uniqueAccepted.slice(0, 5).map(buildSuggestion);\n  const suggestions = rankedPool.slice(0, 5).map((candidate, index) => ({\n    ...candidate,\n    rank: index + 1,\n  }));\n  const suggestion = suggestions[0] || buildSuggestion(best);\n\n  return {''',
        "ranked suggestions builder",
    )
    src = replace_once(
        src,
        '''    suggestion,\n    ...(purpose === "target" ? { _targetShortlist: targetShortlist } : {}),''',
        '''    suggestion,\n    suggestions,\n    ...(purpose === "target" ? { _targetShortlist: targetShortlist } : {}),''',
        "ranked suggestions response",
    )
    src = replace_once(
        src,
        '''            ? result._targetShortlist.slice(0, 3)\n            : [result.suggestion];''',
        '''            ? result._targetShortlist.slice(0, 5)\n            : [result.suggestion];''',
        "route shortlist cap",
    )
    src = replace_once(
        src,
        '''          targetFinalizeSelection(selected, preliminary, checksPerformed);\n          result.suggestion = selected;''',
        '''          targetFinalizeSelection(selected, preliminary, checksPerformed);\n          const ranked = [selected, ...shortlist.filter(candidate => candidate !== selected)].slice(0, 5);\n          result.suggestions = ranked.map((candidate, index) => ({ ...candidate, rank: index + 1 }));\n          result.suggestion = result.suggestions[0] || selected;''',
        "route Top 5 ordering",
    )
    src = src.replace(
        'purpose === "target" ? "Try Another keeps the same player and excludes the prior listing." : "Try Another keeps the same monthly Hall of Famer and excludes the prior listing."',
        'purpose === "target" ? "A new batch keeps the same player and excludes the prior ranked choices." : "A new batch keeps the same monthly Hall of Famer and excludes the prior ranked choices."',
        1,
    )
write(path, src)


# ---------------- Main app ----------------
path = "index.html"
html = Path(path).read_text(encoding="utf-8")
if "function findTargetRenderRankStrip()" not in html:
    html = sub_once(
        html,
        r'(let\s+findTargetSuggestion\s*=\s*null;)',
        r'\1\nlet findTargetSuggestions=[];',
        "main Find Target suggestions state",
    )
    html = replace_once(
        html,
        '''function findTargetResetResult(){\n  findTargetSuggestion=null;\n  findTargetExcludedIds=[];''',
        '''function findTargetResetResult(){\n  findTargetSuggestion=null;\n  findTargetSuggestions=[];\n  findTargetExcludedIds=[];''',
        "main Find Target reset",
    )
    helper = r'''function findTargetRenderRankStrip(){
  const title=$("findTargetRecTitle");
  if(!title)return;
  let host=$("findTargetRankStrip");
  if(!host){
    host=document.createElement("div");
    host.id="findTargetRankStrip";
    host.style.cssText="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin:9px 0 12px";
    title.parentNode.insertBefore(host,title);
  }
  const rows=(findTargetSuggestions.length?findTargetSuggestions:(findTargetSuggestion?[findTargetSuggestion]:[])).slice(0,5);
  host.innerHTML=rows.map((x,i)=>{
    const active=x===findTargetSuggestion||String(x.id||x.productId||"")===String(findTargetSuggestion?.id||findTargetSuggestion?.productId||"");
    const card=[x.year,x.set].filter(Boolean).join(" ");
    return `<button type="button" data-find-target-rank="${i}" style="min-height:58px;border-radius:11px;border:1px solid ${active?'var(--gold)':'var(--line)'};background:${active?'rgba(230,189,99,.13)':'rgba(255,255,255,.04)'};color:var(--text);padding:7px;font-weight:900;cursor:pointer"><span style="display:block;color:var(--gold);font-size:13px">#${i+1}${i===0?' · SCOUT PICK':''}</span><span style="display:block;font-size:9px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(card||x.title||'Card')}</span><span style="display:block;font-size:9px;color:var(--muted);margin-top:2px">${escapeHtml(findTargetMoney(x.delivered))}</span></button>`;
  }).join("");
  host.querySelectorAll("[data-find-target-rank]").forEach(btn=>btn.onclick=()=>{
    const next=rows[Number(btn.dataset.findTargetRank)];
    if(next)renderFindTargetSuggestion(next);
  });
}
'''
    html = replace_once(html, "function renderFindTargetSuggestion(s){", helper + "function renderFindTargetSuggestion(s){", "main Find Target rank strip helper")
    html = replace_once(
        html,
        '''function renderFindTargetSuggestion(s){\n  const p=currentPlayer;\n  findTargetSuggestion=s;\n  $("findTargetResult").hidden=false;\n  $("findTargetEyebrow").textContent=p.owned?"SCOUT'S UPGRADE RECOMMENDATION":"SCOUT'S TARGET RECOMMENDATION";''',
        '''function renderFindTargetSuggestion(s){\n  const p=currentPlayer;\n  findTargetSuggestion=s;\n  $("findTargetResult").hidden=false;\n  findTargetRenderRankStrip();\n  const count=Math.max(1,findTargetSuggestions.length);\n  $("findTargetEyebrow").textContent=p.owned?`SCOUT'S TOP ${count} UPGRADE TARGETS`:`SCOUT'S TOP ${count} TARGETS`;''',
        "main Find Target render header",
    )
    html = replace_once(
        html,
        '  const badges=[s.selectionBadge||"OLDEST BEST FIT"];',
        '  const badges=[s.rank===1?"SCOUT PICK":"RANK #"+(s.rank||Math.max(1,findTargetSuggestions.indexOf(s)+1)),s.selectionBadge||"OLDEST BEST FIT"];',
        "main Find Target rank badge",
    )
    html = replace_once(
        html,
        '''    if(!data.suggestion){\n      findTargetSuggestion=null;''',
        '''    if(!data.suggestion){\n      findTargetSuggestion=null;\n      findTargetSuggestions=[];''',
        "main Find Target empty state",
    )
    html = replace_once(
        html,
        '''    $("findTargetStatus").className="find-target-status";\n    $("findTargetStatus").textContent="✓ Target found. Scout is checking the exact-card sold market…";\n    if(!data.suggestion.marketCheck){''',
        '''    findTargetSuggestions=(Array.isArray(data.suggestions)&&data.suggestions.length?data.suggestions:[data.suggestion]).slice(0,5);\n    data.suggestion=findTargetSuggestions[0];\n    $("findTargetStatus").className="find-target-status";\n    $("findTargetStatus").textContent=`✓ ${findTargetSuggestions.length} ranked choice${findTargetSuggestions.length===1?"":"s"} found. Scout is checking the #1 exact-card sold market…`;\n    if(!data.suggestion.marketCheck){''',
        "main Find Target response Top 5",
    )
    html = replace_once(
        html,
        '''async function retryFindTarget(){\n  if(findTargetSuggestion){\n    findTargetPreviousSummary=findTargetSanitizedSummary(findTargetSuggestion);\n    const id=findTargetSuggestion.id||findTargetSuggestion.productId;\n    if(id&&!findTargetExcludedIds.includes(String(id)))findTargetExcludedIds.push(String(id));\n  }\n  await searchFindTarget();\n}''',
        '''async function retryFindTarget(){\n  if(findTargetSuggestion)findTargetPreviousSummary=findTargetSanitizedSummary(findTargetSuggestion);\n  const rows=findTargetSuggestions.length?findTargetSuggestions:(findTargetSuggestion?[findTargetSuggestion]:[]);\n  for(const item of rows){\n    const id=item?.id||item?.productId;\n    if(id&&!findTargetExcludedIds.includes(String(id)))findTargetExcludedIds.push(String(id));\n  }\n  findTargetSuggestions=[];\n  await searchFindTarget();\n}''',
        "main Find Target next batch",
    )

    # Monthly Pick in main app: persist and browse the same Top 5 batch.
    html = replace_once(
        html,
        '''      retryCount:0,\n      suggestion:null,\n      checkedAt:null,''',
        '''      retryCount:0,\n      suggestion:null,\n      suggestions:[],\n      checkedAt:null,''',
        "main Monthly state suggestions",
    )
    monthly_helper = r'''function monthlyRenderRankStrip(){
  const title=$("monthlyResultTitle");
  if(!title||!monthlyState)return;
  let host=$("monthlyRankStrip");
  if(!host){
    host=document.createElement("div");
    host.id="monthlyRankStrip";
    host.style.cssText="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin:9px 0 12px";
    title.parentNode.insertBefore(host,title);
  }
  const rows=(Array.isArray(monthlyState.suggestions)&&monthlyState.suggestions.length?monthlyState.suggestions:(monthlyState.suggestion?[monthlyState.suggestion]:[])).slice(0,5);
  host.innerHTML=rows.map((x,i)=>{
    const active=x===monthlyState.suggestion||String(x.id||x.productId||"")===String(monthlyState.suggestion?.id||monthlyState.suggestion?.productId||"");
    const card=[x.year,x.set].filter(Boolean).join(" ");
    return `<button type="button" data-monthly-rank="${i}" style="min-height:58px;border-radius:11px;border:1px solid ${active?'var(--gold)':'var(--line)'};background:${active?'rgba(230,189,99,.13)':'rgba(255,255,255,.04)'};color:var(--text);padding:7px;font-weight:900;cursor:pointer"><span style="display:block;color:var(--gold);font-size:13px">#${i+1}${i===0?' · SCOUT PICK':''}</span><span style="display:block;font-size:9px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(card||x.title||'Card')}</span><span style="display:block;font-size:9px;color:var(--muted);margin-top:2px">${escapeHtml(findTargetMoney(x.delivered))}</span></button>`;
  }).join("");
  host.querySelectorAll("[data-monthly-rank]").forEach(btn=>btn.onclick=()=>{
    const next=rows[Number(btn.dataset.monthlyRank)];
    if(!next)return;
    monthlyState.suggestion=next;
    monthlyWriteState(true);
    monthlyRenderSuggestion(next);
  });
}
'''
    html = replace_once(html, "function monthlyRenderSuggestion(s){", monthly_helper + "function monthlyRenderSuggestion(s){", "main Monthly rank strip helper")
    html = replace_once(
        html,
        '''function monthlyRenderSuggestion(s){\n  if(!s)return;\n  $("monthlyResult").hidden=false;''',
        '''function monthlyRenderSuggestion(s){\n  if(!s)return;\n  $("monthlyResult").hidden=false;\n  monthlyRenderRankStrip();''',
        "main Monthly rank strip render",
    )
    html = replace_once(
        html,
        '  const badges=["OLDEST FIRST"];',
        '  const monthlyRank=Math.max(1,(monthlyState?.suggestions||[]).indexOf(s)+1);\n  const badges=[monthlyRank===1?"SCOUT PICK":"RANK #"+monthlyRank,"OLDEST FIRST"];',
        "main Monthly rank badge",
    )
    html = replace_once(
        html,
        '''  }else if(monthlyState.suggestion){\n    monthlyRenderSuggestion(monthlyState.suggestion);''',
        '''  }else if(monthlyState.suggestion){\n    if(!Array.isArray(monthlyState.suggestions)||!monthlyState.suggestions.length)monthlyState.suggestions=[monthlyState.suggestion];\n    monthlyRenderSuggestion(monthlyState.suggestion);''',
        "main Monthly legacy state",
    )
    html = replace_once(
        html,
        '''    if(!data.suggestion){\n      monthlyState.suggestion=null;''',
        '''    if(!data.suggestion){\n      monthlyState.suggestion=null;\n      monthlyState.suggestions=[];''',
        "main Monthly empty state",
    )
    html = replace_once(
        html,
        '''    data.suggestion.marketCheck=await scoutRecommendationMarketCheck(monthlyPlayer.name,data.suggestion);\n    monthlyState.suggestion=data.suggestion;\n    monthlyWriteState(true);\n    monthlyRenderSuggestion(data.suggestion);''',
        '''    monthlyState.suggestions=(Array.isArray(data.suggestions)&&data.suggestions.length?data.suggestions:[data.suggestion]).slice(0,5);\n    data.suggestion=monthlyState.suggestions[0];\n    data.suggestion.marketCheck=await scoutRecommendationMarketCheck(monthlyPlayer.name,data.suggestion);\n    monthlyState.suggestion=data.suggestion;\n    monthlyWriteState(true);\n    monthlyRenderSuggestion(data.suggestion);''',
        "main Monthly response Top 5",
    )
    html = replace_once(
        html,
        '''async function monthlyRetry(){\n  if(!monthlyState?.suggestion)return;\n  const old=String(monthlyState.suggestion.id||monthlyState.suggestion.productId||"");\n  if(old&&!monthlyState.excludedIds.includes(old))monthlyState.excludedIds.push(old);\n  monthlyState.retryCount=(monthlyState.retryCount||0)+1;\n  monthlyState.suggestion=null;''',
        '''async function monthlyRetry(){\n  if(!monthlyState?.suggestion)return;\n  const rows=Array.isArray(monthlyState.suggestions)&&monthlyState.suggestions.length?monthlyState.suggestions:[monthlyState.suggestion];\n  for(const item of rows){\n    const old=String(item?.id||item?.productId||"");\n    if(old&&!monthlyState.excludedIds.includes(old))monthlyState.excludedIds.push(old);\n  }\n  monthlyState.retryCount=(monthlyState.retryCount||0)+1;\n  monthlyState.suggestion=null;\n  monthlyState.suggestions=[];''',
        "main Monthly next batch",
    )
write(path, html)


# ---------------- Standalone Find a Target ----------------
path = "phase6-find-target.html"
lab = Path(path).read_text(encoding="utf-8")
if "function renderRankStrip()" not in lab:
    lab = lab.replace("LAB v0.1.6", "LAB v0.1.7").replace("phase6-find-target-lab-v0.1.6", "phase6-find-target-lab-v0.1.7")
    lab = replace_once(lab, 'let players=[],cloudEdits={},accessKey="",selected=null,suggestion=null,excludedIds=[];', 'let players=[],cloudEdits={},accessKey="",selected=null,suggestion=null,suggestions=[],excludedIds=[];', "lab Find Target suggestions state")
    lab = replace_once(lab, '  suggestion=null;excludedIds=[];', '  suggestion=null;suggestions=[];excludedIds=[];', "lab Find Target reset")
    lab = replace_once(lab, '      suggestion=null;$("result").hidden=true;$("empty").hidden=false;', '      suggestion=null;suggestions=[];$("result").hidden=true;$("empty").hidden=false;', "lab Find Target empty")
    lab = replace_once(lab, '''    suggestion=data.suggestion;\n    renderSuggestion();''', '''    suggestions=(Array.isArray(data.suggestions)&&data.suggestions.length?data.suggestions:[data.suggestion]).slice(0,5);\n    suggestion=suggestions[0];\n    renderSuggestion();''', "lab Find Target Top 5 response")
    lab_helper = r'''function renderRankStrip(){
  const title=$("recTitle");
  if(!title)return;
  let host=$("rankStrip");
  if(!host){host=document.createElement("div");host.id="rankStrip";host.style.cssText="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin:9px 0 12px";title.parentNode.insertBefore(host,title)}
  const rows=(suggestions.length?suggestions:(suggestion?[suggestion]:[])).slice(0,5);
  host.innerHTML=rows.map((x,i)=>`<button type="button" data-rank="${i}" style="min-height:58px;border-radius:11px;border:1px solid ${x===suggestion?'var(--gold)':'var(--line)'};background:${x===suggestion?'rgba(239,196,93,.13)':'rgba(255,255,255,.04)'};color:var(--text);padding:7px;font-weight:900"><span style="display:block;color:var(--gold)">#${i+1}${i===0?' · SCOUT PICK':''}</span><span style="display:block;font-size:9px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc([x.year,x.set].filter(Boolean).join(' ')||x.title||'Card')}</span><span style="display:block;font-size:9px;color:var(--muted);margin-top:2px">${money(x.delivered)}</span></button>`).join("");
  host.querySelectorAll("[data-rank]").forEach(btn=>btn.onclick=()=>{const next=rows[Number(btn.dataset.rank)];if(next){suggestion=next;renderSuggestion()}});
}
'''
    lab = replace_once(lab, "function renderSuggestion(){", lab_helper + "function renderSuggestion(){", "lab Find Target rank strip")
    lab = replace_once(lab, '''function renderSuggestion(){\n  const s=suggestion,st=s.sellerTrust||{},seller=s.seller||{},g=s.gradeInfo||{};''', '''function renderSuggestion(){\n  const s=suggestion,st=s.sellerTrust||{},seller=s.seller||{},g=s.gradeInfo||{};\n  renderRankStrip();''', "lab Find Target rank strip render")
    lab = replace_once(lab, '  $("resultEyebrow").textContent=selected.owned?"SCOUT\'S UPGRADE RECOMMENDATION":"SCOUT\'S TARGET RECOMMENDATION";', '  $("resultEyebrow").textContent=selected.owned?`SCOUT\'S TOP ${Math.max(1,suggestions.length)} UPGRADE TARGETS`:`SCOUT\'S TOP ${Math.max(1,suggestions.length)} TARGETS`;', "lab Find Target eyebrow")
    lab = replace_once(lab, '  badges.push("OLDEST FIRST");', '  badges.push(s.rank===1?"SCOUT PICK":"RANK #"+(s.rank||Math.max(1,suggestions.indexOf(s)+1)));\n  badges.push("OLDEST FIRST");', "lab Find Target badge")
    lab = replace_once(lab, '''async function retry(){\n  if(suggestion){\n    const id=suggestion.id||suggestion.productId;\n    if(id&&!excludedIds.includes(String(id)))excludedIds.push(String(id));\n  }\n  suggestion=null;$("result").hidden=true;await findTarget();\n}''', '''async function retry(){\n  const rows=suggestions.length?suggestions:(suggestion?[suggestion]:[]);\n  for(const item of rows){const id=item?.id||item?.productId;if(id&&!excludedIds.includes(String(id)))excludedIds.push(String(id))}\n  suggestion=null;suggestions=[];$("result").hidden=true;await findTarget();\n}''', "lab Find Target next batch")
write(path, lab)


# ---------------- Standalone Monthly Pick ----------------
path = "phase6-monthly-pick.html"
lab = Path(path).read_text(encoding="utf-8")
if "function renderMonthlyRankStrip()" not in lab:
    lab = lab.replace("Lab v0.2.2", "Lab v0.2.3").replace("LAB v0.2.2", "LAB v0.2.3").replace("phase6-monthly-pick-lab-v0.2.2", "phase6-monthly-pick-lab-v0.2.3")
    lab = lab.replace("One player. One recommendation. Once a month.", "One player. Five ranked choices. Once a month.", 1)
    lab = replace_once(lab, '''          suggestion:null,\n          checkedAt:null,''', '''          suggestion:null,\n          suggestions:[],\n          checkedAt:null,''', "lab Monthly migrated state")
    lab = replace_once(lab, '''      suggestion:null,\n      checkedAt:null''', '''      suggestion:null,\n      suggestions:[],\n      checkedAt:null''', "lab Monthly new state")
    lab = replace_once(lab, '  if(state.suggestion)renderSuggestion(state.suggestion);', '  if(state.suggestion){if(!Array.isArray(state.suggestions)||!state.suggestions.length)state.suggestions=[state.suggestion];renderSuggestion(state.suggestion)}', "lab Monthly legacy state")
    lab = replace_once(lab, '''      state.suggestion=null;\n      writeState();''', '''      state.suggestion=null;\n      state.suggestions=[];\n      writeState();''', "lab Monthly empty")
    lab = replace_once(lab, '''    state.suggestion=data.suggestion;\n    writeState();\n    renderSuggestion(data.suggestion);''', '''    state.suggestions=(Array.isArray(data.suggestions)&&data.suggestions.length?data.suggestions:[data.suggestion]).slice(0,5);\n    state.suggestion=state.suggestions[0];\n    writeState();\n    renderSuggestion(state.suggestion);''', "lab Monthly Top 5 response")
    monthly_lab_helper = r'''function renderMonthlyRankStrip(){
  const title=$("resultTitle");if(!title)return;
  let host=$("monthlyRankStrip");if(!host){host=document.createElement("div");host.id="monthlyRankStrip";host.style.cssText="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin:9px 0 12px";title.parentNode.insertBefore(host,title)}
  const rows=(Array.isArray(state?.suggestions)&&state.suggestions.length?state.suggestions:(state?.suggestion?[state.suggestion]:[])).slice(0,5);
  host.innerHTML=rows.map((x,i)=>`<button type="button" data-rank="${i}" style="min-height:58px;border-radius:11px;border:1px solid ${x===state.suggestion?'var(--gold)':'var(--line)'};background:${x===state.suggestion?'rgba(230,189,99,.13)':'rgba(255,255,255,.04)'};color:var(--text);padding:7px;font-weight:900"><span style="display:block;color:var(--gold)">#${i+1}${i===0?' · SCOUT PICK':''}</span><span style="display:block;font-size:9px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${[x.year,x.set].filter(Boolean).join(' ')||'Card'}</span><span style="display:block;font-size:9px;color:var(--muted);margin-top:2px">${money(x.delivered)}</span></button>`).join("");
  host.querySelectorAll("[data-rank]").forEach(btn=>btn.onclick=()=>{const next=rows[Number(btn.dataset.rank)];if(next){state.suggestion=next;writeState();renderSuggestion(next)}});
}
'''
    lab = replace_once(lab, "function renderSuggestion(s){", monthly_lab_helper + "function renderSuggestion(s){", "lab Monthly rank strip")
    lab = replace_once(lab, '''function renderSuggestion(s){\n  $("result").hidden=false;''', '''function renderSuggestion(s){\n  $("result").hidden=false;\n  renderMonthlyRankStrip();''', "lab Monthly rank strip render")
    lab = replace_once(lab, '''  const badges=['<span class="badge age">OLDEST FIRST</span>'];''', '''  const rank=Math.max(1,(state?.suggestions||[]).indexOf(s)+1);\n  const badges=[`<span class="badge age">${rank===1?"SCOUT PICK":"RANK #"+rank}</span>`,'<span class="badge age">OLDEST FIRST</span>'];''', "lab Monthly rank badge")
    lab = replace_once(lab, '''async function retryListing(){\n  if(!state?.suggestion)return;\n  const oldId=String(state.suggestion.id||state.suggestion.productId||"");\n  if(oldId&&!state.excludedIds.includes(oldId))state.excludedIds.push(oldId);\n  state.retryCount=(state.retryCount||0)+1;\n  state.suggestion=null;''', '''async function retryListing(){\n  if(!state?.suggestion)return;\n  const rows=Array.isArray(state.suggestions)&&state.suggestions.length?state.suggestions:[state.suggestion];\n  for(const item of rows){const oldId=String(item?.id||item?.productId||"");if(oldId&&!state.excludedIds.includes(oldId))state.excludedIds.push(oldId)}\n  state.retryCount=(state.retryCount||0)+1;\n  state.suggestion=null;\n  state.suggestions=[];''', "lab Monthly next batch")
write(path, lab)


# ---------------- Regression tests ----------------
path = "tests/target-ranking.test.cjs"
test = Path(path).read_text(encoding="utf-8")
if 'api.VERSION, "3.25.0"' not in test:
    test = replace_once(test, 'assert.equal(api.VERSION, "3.24.0");', 'assert.equal(api.VERSION, "3.25.0");', "test Worker version")
    test = replace_once(test, 'await test("shortlist is capped at three and route performs at most two checks", async () => {', 'await test("shortlist returns up to five while route performs at most two market checks", async () => {', "Top 5 test title")
    test = replace_once(test, '    assert.equal(ranked.length,3);', '    assert.equal(ranked.length,5);', "Top 5 shortlist assertion")
    test = replace_once(test, '''    assert.equal(res.status,200); assert.equal(calls,2);\n    api.resetRouteMocks();''', '''    assert.equal(res.status,200); assert.equal(calls,2);\n    const body=await res.json();\n    assert.equal(body.suggestions.length,5);\n    assert.deepEqual(body.suggestions.map(x=>x.rank),[1,2,3,4,5]);\n    api.resetRouteMocks();''', "Top 5 route assertions")
write(path, test)


# Lightweight source-level contract for both user-facing surfaces.
contract = '''const assert=require("node:assert/strict");\nconst fs=require("node:fs");\nconst worker=fs.readFileSync("src/index.js","utf8");\nconst app=fs.readFileSync("index.html","utf8");\nconst targetLab=fs.readFileSync("phase6-find-target.html","utf8");\nconst monthlyLab=fs.readFileSync("phase6-monthly-pick.html","utf8");\nassert.match(worker,/slice\\(0, 5\\)/);\nassert.match(worker,/result\\.suggestions = ranked\\.map/);\nassert.match(worker,/const suggestions = rankedPool\\.slice\\(0, 5\\)/);\nassert.match(app,/function findTargetRenderRankStrip\\(\\)/);\nassert.match(app,/function monthlyRenderRankStrip\\(\\)/);\nassert.match(targetLab,/function renderRankStrip\\(\\)/);\nassert.match(monthlyLab,/function renderMonthlyRankStrip\\(\\)/);\nconsole.log("Top 5 target contract passed.");\n'''
Path("tests/top5-targets.test.cjs").write_text(contract, encoding="utf-8")
print("wrote tests/top5-targets.test.cjs")
