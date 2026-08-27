from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# 1) Count active Future HOF targets in the main target total and mission copy.
old='''function stats(){\n  const owned=ownedCount(),need=needCount(),complete=completion();\n  $("haveStat").textContent=owned;$("needStat").textContent=need;$("completeStat").textContent=complete.toFixed(1)+"%";\n  $("progressFill").style.width=complete.toFixed(1)+"%";\n  $("targetCount").textContent=PLAYERS.filter(p=>p.target).length;\n}\nfunction rotateMission(){\n  const owned=ownedCount(),need=needCount(),complete=completion(),targets=PLAYERS.filter(p=>p.target).length;\n'''
new='''function stats(){\n  const owned=ownedCount(),need=needCount(),complete=completion();\n  const targetTotal=PLAYERS.filter(p=>p.target).length+futureHofActiveTargetEntries().length;\n  $("haveStat").textContent=owned;$("needStat").textContent=need;$("completeStat").textContent=complete.toFixed(1)+"%";\n  $("progressFill").style.width=complete.toFixed(1)+"%";\n  $("targetCount").textContent=targetTotal;\n}\nfunction rotateMission(){\n  const owned=ownedCount(),need=needCount(),complete=completion(),targets=PLAYERS.filter(p=>p.target).length+futureHofActiveTargetEntries().length;\n'''
if old in s:
    s=s.replace(old,new,1)
elif 'const targetTotal=PLAYERS.filter(p=>p.target).length+futureHofActiveTargetEntries().length;' not in s:
    raise SystemExit('stats anchor not found')

# 2) Carry structured fields on Future HOF target rows shown in the shared Targets/Hunt UI.
old='''      futureHofTarget:true,\n      target:String(target.label||target.title||"Saved Future Target"),\n      targetNotes:"Future HOF Watchlist · Not yet in the Hall",\n      listingUrl:String(target.listingUrl||""),\n      priceVerdict:String(target.priceVerdict||""),\n      savedFutureTarget:target\n'''
new='''      futureHofTarget:true,\n      target:String(target.label||target.title||"Saved Future Target"),\n      targetNotes:String(target.notes||"Future HOF Watchlist · Not yet in the Hall"),\n      targetYear:Number.isInteger(Number(target.year))?Number(target.year):null,\n      targetSet:String(target.set||""),\n      targetCardNum:String(target.cardNum||""),\n      targetGrader:String(target.grader||"Any / Raw OK"),\n      targetGrade:String(target.grade||""),\n      targetAutoPreference:String(target.autoPreference||"No preference"),\n      targetMaxPrice:Number.isFinite(Number(target.maxPrice))?Number(target.maxPrice):null,\n      listingUrl:String(target.listingUrl||""),\n      priceVerdict:String(target.priceVerdict||""),\n      savedFutureTarget:target\n'''
if old in s:
    s=s.replace(old,new,1)
elif 'targetAutoPreference:String(target.autoPreference||"No preference")' not in s:
    raise SystemExit('future target entry anchor not found')

# 3) Give saved Future HOF targets edit/remove controls and reuse their saved budget.
old='''    const target=state.targets[name];\n    const purchase=state.purchases[name];\n    const purchaseLabel=purchase\n      ? `<div class="future-hof-owned">✓ EARLY CARD OWNED${purchase.incoming?" · INCOMING":""}</div>`\n      : "";\n    const targetLabel=target\n      ? `<div class="future-hof-target">🎯 FUTURE TARGET: ${escapeHtml(target.label||target.title||"Saved target")}${target.priceVerdict?` · ${escapeHtml(target.priceVerdict)}`:""}</div>`\n      : "";\n'''
new='''    const target=state.targets[name];\n    const purchase=state.purchases[name];\n    const targetMax=Number(target?.maxPrice);\n    const futureBudgetValue=Number.isFinite(targetMax)&&targetMax>0?targetMax.toFixed(2):defaultBudget;\n    const purchaseLabel=purchase\n      ? `<div class="future-hof-owned">✓ EARLY CARD OWNED${purchase.incoming?" · INCOMING":""}</div>`\n      : "";\n    const targetLabel=target\n      ? `<div class="future-hof-target">🎯 FUTURE TARGET: ${escapeHtml(target.label||target.title||"Saved target")}${target.priceVerdict?` · ${escapeHtml(target.priceVerdict)}`:""}\n          <div class="forecast-actions" style="margin-top:8px">\n            <button class="ghost" type="button" onclick='futureHofEditTarget(${JSON.stringify(name)})'>✎ EDIT TARGET</button>\n            <button class="danger" type="button" onclick='futureHofRemoveTarget(${JSON.stringify(name)})'>REMOVE TARGET</button>\n          </div>\n        </div>`\n      : "";\n'''
if old in s:
    s=s.replace(old,new,1)
elif 'futureHofEditTarget(${JSON.stringify(name)})' not in s:
    raise SystemExit('future target label anchor not found')

s=s.replace('''value="${escapeHtml(defaultBudget)}"></div>\n        </div>\n        <button class="secondary" onclick='futureHofFindTarget(${JSON.stringify(name)},false)'>🔎 FIND A TARGET</button>''',
'''value="${escapeHtml(futureBudgetValue)}"></div>\n        </div>\n        <button class="secondary" onclick='futureHofFindTarget(${JSON.stringify(name)},false)'>${target?"🔎 FIND / REPLACE TARGET":"🔎 FIND A TARGET"}</button>''',1)

# Also label the top forecast action consistently once a target exists.
old='''  $("forecastTopFive").innerHTML=HOF_FORECAST_2027.map(p=>{\n    const watching=state.watch.includes(p.name);\n'''
new='''  $("forecastTopFive").innerHTML=HOF_FORECAST_2027.map(p=>{\n    const watching=state.watch.includes(p.name);\n    const hasTarget=!!state.targets[p.name];\n'''
if old in s:
    s=s.replace(old,new,1)
elif 'const hasTarget=!!state.targets[p.name];' not in s:
    raise SystemExit('forecast target-state anchor not found')
s=s.replace('''<button class="ghost" onclick='futureHofOpenTarget(${JSON.stringify(p.name)})'>🔎 FIND A TARGET</button>''',
'''<button class="ghost" onclick='futureHofOpenTarget(${JSON.stringify(p.name)})'>${hasTarget?"🔎 FIND / REPLACE TARGET":"🔎 FIND A TARGET"}</button>''',1)

# 4) Save Future HOF target preferences from a Finder result and confirm replacement.
pattern=r'''function futureHofSaveTarget\(name\)\{.*?\n\}\nfunction futureHofOpenPurchase\(name\)\{'''
m=re.search(pattern,s,re.S)
if not m:
    if 'function futureHofEditTarget(name)' not in s:
        raise SystemExit('futureHofSaveTarget block not found')
else:
    replacement='''function futureHofSaveTarget(name){\n  const s=futureHofSuggestions[name];\n  if(!s)return;\n  const state=futureHofGetState();\n  const label=futureHofTargetLabel(s);\n  const existing=state.targets[name];\n  if(existing&&String(existing.label||existing.title||"")!==label){\n    const ok=window.confirm(name+" already has a Future Target: "+(existing.label||existing.title||"Saved target")+". Replace it with "+label+"?");\n    if(!ok)return;\n  }\n  if(!state.watch.includes(name))state.watch.push(name);\n  const slug=futureHofSlug(name);\n  const budget=Number($("futureBudget-"+slug)?.value);\n  state.targets[name]={\n    ...existing,\n    label,\n    year:s.year||null,\n    set:scoutRecommendationCanonicalSet(s)||s.set||"",\n    cardNum:s.cardNum||scoutRecommendationCardNumFromTitle(s.title||"")||"",\n    grader:s.gradeInfo?.grader&&s.gradeInfo.grader!=="Raw"?s.gradeInfo.grader:"Any / Raw OK",\n    grade:s.gradeInfo?.grade??"",\n    autoPreference:s.traits?.autograph?"Autograph required":"No preference",\n    maxPrice:Number.isFinite(budget)&&budget>0?budget:null,\n    notes:String(existing?.notes||""),\n    title:s.title||"",\n    listingUrl:s.link||"",\n    delivered:Number.isFinite(Number(s.delivered))?Number(s.delivered):null,\n    priceVerdict:s.marketCheck?.rated?s.marketCheck.label:"",\n    savedAt:new Date().toISOString()\n  };\n  futureHofWrite(state,true);\n  stats();rotateMission();\n  toast("🎯 Future target saved for "+name+". It is now visible in your main Targets list.");\n  renderHallForecast();\n  renderList();\n  renderHuntList();\n}\nfunction futureHofOpenPurchase(name){'''
    s=s[:m.start()]+replacement+s[m.end():]

# 5) Reuse the normal Target Card editor for Future HOF targets.
old='''let targetManageOrigin="targets";\nfunction openTargetManage(prefill=null){\n  $("targetForm").reset();\n'''
new='''let targetManageOrigin="targets";\nlet targetManageFutureName="";\nfunction futureHofEditTarget(name){\n  const state=futureHofGetState();\n  const t=state.targets[name];\n  if(!t){toast("No Future HOF target is saved for "+name+".");return}\n  targetManageFutureName=name;\n  targetManageOrigin="future";\n  $("targetForm").reset();\n  $("targetPlayer").readOnly=true;\n  $("targetPlayer").value=name;\n  $("targetYear").value=t.year||"";\n  $("targetSet").value=t.set||"";\n  $("targetNum").value=t.cardNum||"";\n  $("targetGrader").value=t.grader||"Any / Raw OK";\n  $("targetGrade").value=t.grade||"";\n  $("targetAutoPreference").value=t.autoPreference||"No preference";\n  $("targetMaxPrice").value=Number.isFinite(Number(t.maxPrice))&&Number(t.maxPrice)>0?Number(t.maxPrice).toFixed(2):"";\n  $("targetNotes").value=t.notes||"";\n  $("targetManageTitle").textContent="Edit Future HOF Target";\n  $("targetManageSub").textContent="Update the exact card and preferences Scout should hunt for "+name+". This does not add him to your official Hall roster.";\n  $("targetSaveBtn").textContent="SAVE FUTURE TARGET CHANGES";\n  showScreen("targetManageScreen");\n}\nfunction futureHofRemoveTarget(name){\n  const state=futureHofGetState();\n  const t=state.targets[name];\n  if(!t)return;\n  const ok=window.confirm("Remove "+name+"’s Future HOF target “"+(t.label||t.title||"Saved target")+"”? He will stay on your Future HOF Watchlist.");\n  if(!ok)return;\n  delete state.targets[name];\n  futureHofWrite(state,true);\n  stats();rotateMission();renderHallForecast();renderList();renderHuntList();\n  toast("Future HOF target removed for "+name+".");\n}\nfunction openTargetManage(prefill=null){\n  targetManageFutureName="";\n  $("targetForm").reset();\n'''
if old in s:
    s=s.replace(old,new,1)
elif 'function futureHofEditTarget(name)' not in s:
    raise SystemExit('target editor anchor not found')

# 6) Branch the shared save form for Future HOF targets before official-player validation.
old='''function saveTargetCard(e){\n  e.preventDefault();\n  const name=$("targetPlayer").value.trim();\n  const p=PLAYERS.find(x=>x.name.toLowerCase()===name.toLowerCase());\n  if(!p){toast("Scout needs an exact Hall of Famer from the player list.");return}\n  const year=parseInt($("targetYear").value.trim(),10);\n  const set=$("targetSet").value.trim();\n  const num=$("targetNum").value.trim();\n  const notes=$("targetNotes").value.trim();\n  const maxRaw=$("targetMaxPrice").value.trim();\n  const maxPrice=maxRaw===""?null:Number(maxRaw);\n  if(!Number.isInteger(year)||year<1800||year>2100){toast("Target year needs to be a 4-digit year.");return}\n  if(!set){toast("Scout needs the target set name.");return}\n  if(maxRaw!==""&&(!Number.isFinite(maxPrice)||maxPrice<=0)){toast("Max delivered price needs to be a valid amount.");return}\n  const label=[year,set,num?"#"+num:""] .filter(Boolean).join(" ");\n'''
new='''function saveTargetCard(e){\n  e.preventDefault();\n  const name=$("targetPlayer").value.trim();\n  const year=parseInt($("targetYear").value.trim(),10);\n  const set=$("targetSet").value.trim();\n  const num=$("targetNum").value.trim();\n  const notes=$("targetNotes").value.trim();\n  const maxRaw=$("targetMaxPrice").value.trim();\n  const maxPrice=maxRaw===""?null:Number(maxRaw);\n  if(!Number.isInteger(year)||year<1800||year>2100){toast("Target year needs to be a 4-digit year.");return}\n  if(!set){toast("Scout needs the target set name.");return}\n  if(maxRaw!==""&&(!Number.isFinite(maxPrice)||maxPrice<=0)){toast("Max delivered price needs to be a valid amount.");return}\n  const label=[year,set,num?"#"+num:""] .filter(Boolean).join(" ");\n  if(targetManageFutureName){\n    const futureName=targetManageFutureName;\n    const state=futureHofGetState();\n    const existing=state.targets[futureName]||{};\n    if(!state.watch.includes(futureName))state.watch.push(futureName);\n    state.targets[futureName]={\n      ...existing,label,year,set,cardNum:num,\n      grader:$("targetGrader").value,grade:$("targetGrade").value.trim(),\n      autoPreference:$("targetAutoPreference").value,maxPrice,notes,\n      savedAt:new Date().toISOString()\n    };\n    futureHofWrite(state,true);\n    targetManageFutureName="";\n    stats();rotateMission();renderList();renderHuntList();\n    showScreen("forecastScreen");renderHallForecast();\n    setTimeout(()=>$("futureRow-"+futureHofSlug(futureName))?.scrollIntoView({behavior:"smooth",block:"center"}),80);\n    toast("Future HOF target updated for "+futureName+".");\n    return;\n  }\n  const p=PLAYERS.find(x=>x.name.toLowerCase()===name.toLowerCase());\n  if(!p){toast("Scout needs an exact Hall of Famer from the player list.");return}\n'''
if old in s:
    s=s.replace(old,new,1)
elif 'if(targetManageFutureName){' not in s:
    raise SystemExit('saveTargetCard anchor not found')

# 7) Back button returns to the Future HOF row when editing one.
old='''$("targetManageBack").addEventListener("click",()=>{\n  if(targetManageOrigin==="detail"&&currentPlayer)openPlayer(currentPlayer,returnScreen);\n  else{showScreen("homeScreen");showTargets();}\n});\n'''
new='''$("targetManageBack").addEventListener("click",()=>{\n  if(targetManageOrigin==="future"&&targetManageFutureName){\n    const name=targetManageFutureName;targetManageFutureName="";\n    showScreen("forecastScreen");renderHallForecast();\n    setTimeout(()=>$("futureRow-"+futureHofSlug(name))?.scrollIntoView({behavior:"smooth",block:"center"}),80);\n  }else if(targetManageOrigin==="detail"&&currentPlayer)openPlayer(currentPlayer,returnScreen);\n  else{showScreen("homeScreen");showTargets();}\n});\n'''
if old in s:
    s=s.replace(old,new,1)
elif 'targetManageOrigin==="future"&&targetManageFutureName' not in s:
    raise SystemExit('target back anchor not found')

# Version bump for the visible app UI.
s=s.replace('Scout’s rule: asking price is not market value. ⚾ · v5.1.0','Scout’s rule: asking price is not market value. ⚾ · v5.1.1',1)

p.write_text(s,encoding='utf-8')

# Regression coverage: syntax + parity hooks + existing test suites are run by workflow.
t=Path('tests/future-target-parity.test.cjs')
t.write_text(r'''const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("index.html","utf8");
const scriptMatch=html.match(/<script>([\s\S]*)<\/script>/);
assert.ok(scriptMatch,"inline app script missing");
new vm.Script(scriptMatch[1]);
assert.match(html,/const targetTotal=PLAYERS\.filter\(p=>p\.target\)\.length\+futureHofActiveTargetEntries\(\)\.length/);
assert.match(html,/function futureHofEditTarget\(name\)/);
assert.match(html,/function futureHofRemoveTarget\(name\)/);
assert.match(html,/targetManageOrigin="future"/);
assert.match(html,/if\(targetManageFutureName\)\{/);
assert.match(html,/FIND \/ REPLACE TARGET/);
assert.match(html,/futureBudgetValue/);
assert.match(html,/targetAutoPreference:String\(target\.autoPreference\|\|"No preference"\)/);
console.log("Future HOF target parity tests passed.");
''',encoding='utf-8')
print('Future HOF target parity patched')
