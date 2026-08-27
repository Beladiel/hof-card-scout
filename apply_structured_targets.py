from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Could not find {label}")
    return text.replace(old, new, 1)

path="index.html"
s=Path(path).read_text(encoding="utf-8")

# Styles
s=replace_once(s,
'''.status-pill.incoming{background:rgba(230,189,99,.14);color:#f4d58a;border:1px solid rgba(230,189,99,.38)}\n.incoming-tag''',
'''.status-pill.incoming{background:rgba(230,189,99,.14);color:#f4d58a;border:1px solid rgba(230,189,99,.38)}\n.status-pill.target{background:rgba(230,189,99,.14);color:#f4d58a;border:1px solid rgba(230,189,99,.38)}\n.target-inline-tag{display:inline-flex;align-items:center;gap:4px;margin-left:6px;padding:2px 7px;border-radius:999px;background:rgba(230,189,99,.11);color:#f2cf7a;border:1px solid rgba(230,189,99,.28);font-size:9px;font-weight:900;vertical-align:1px}\n.target-summary{margin:12px 0;padding:13px 14px;border:1px solid rgba(230,189,99,.38);border-radius:15px;background:rgba(230,189,99,.055)}\n.target-summary[hidden]{display:none}.target-summary-main{font-size:16px;font-weight:950;line-height:1.35}.target-summary-meta{font-size:11px;color:var(--muted);line-height:1.55;margin-top:6px}.target-summary-meta strong{color:var(--text)}\n.incoming-tag''',
"target styles")

# Detail target summary + edit button
s=replace_once(s,
'''      <div class="purchase-box" id="purchaseBox" hidden>''',
'''      <div class="target-summary" id="targetSummary" hidden>\n        <div class="purchase-title">🎯 SAVED TARGET</div>\n        <div class="target-summary-main" id="targetSummaryMain"></div>\n        <div class="target-summary-meta" id="targetSummaryMeta"></div>\n      </div>\n\n      <div class="purchase-box" id="purchaseBox" hidden>''',
"detail target summary")
s=replace_once(s,
'''      <div class="action-row" id="targetScoutRow" hidden>\n        <button class="primary" id="scoutTargetBtn">🎯 SCOUT THIS TARGET →</button>\n        <button class="danger" id="removeTargetBtn">REMOVE TARGET</button>\n      </div>''',
'''      <div class="action-row" id="targetScoutRow" hidden>\n        <button class="primary" id="scoutTargetBtn" style="grid-column:1/-1">🎯 SCOUT THIS TARGET →</button>\n        <button class="ghost" id="editTargetBtn">✎ EDIT TARGET</button>\n        <button class="danger" id="removeTargetBtn">REMOVE TARGET</button>\n      </div>''',
"target action buttons")

# Structured target form
s=replace_once(s,
'''        <h2 class="form-title">Add Target Card</h2>\n        <p class="form-sub">Add a specific card you want to hunt. Scout will keep it on your Target Cards list whether you already own the player or still need them.</p>''',
'''        <h2 class="form-title" id="targetManageTitle">Add Target Card</h2>\n        <p class="form-sub" id="targetManageSub">Add a specific card you want to hunt. Scout will keep it on your Target Cards list whether you already own the player or still need them.</p>''',
"target form heading")
s=replace_once(s,
'''            <div class="field"><label for="targetNum">Card #</label><input id="targetNum" placeholder="482"></div>\n            <div class="field full"><label for="targetNotes">Target notes</label><textarea id="targetNotes" placeholder="Rookie, preferred grade, price ceiling, condition, etc."></textarea></div>''',
'''            <div class="field"><label for="targetNum">Card #</label><input id="targetNum" placeholder="482"></div>\n            <div class="field"><label for="targetGrader">Grade preference</label><select id="targetGrader"><option>Any / Raw OK</option><option>PSA</option><option>SGC</option><option>CGC</option><option>BGS / Beckett</option><option>Other graded</option></select></div>\n            <div class="field"><label for="targetGrade">Grade / condition preference</label><input id="targetGrade" placeholder="PSA 5+, VG-EX, clean raw…"></div>\n            <div class="field"><label for="targetAutoPreference">Autograph preference</label><select id="targetAutoPreference"><option>No preference</option><option>Prefer autograph</option><option>Autograph required</option></select></div>\n            <div class="field"><label for="targetMaxPrice">Max delivered price</label><div class="money-input"><span class="currency-prefix">$</span><input id="targetMaxPrice" inputmode="decimal" placeholder="75.00"></div></div>\n            <div class="field full"><label for="targetNotes">Target notes</label><textarea id="targetNotes" placeholder="Why you want it, condition details, variation, seller notes, etc."></textarea></div>''',
"structured target fields")
s=replace_once(s,
'''          <button class="primary" type="submit" style="width:100%;margin-top:14px">SAVE TARGET CARD</button>''',
'''          <button class="primary" id="targetSaveBtn" type="submit" style="width:100%;margin-top:14px">SAVE TARGET CARD</button>''',
"target save button")

# Persistence schema
s=replace_once(s,
'''    userNotes:p.userNotes||"",target:p.target||"",targetNotes:p.targetNotes||"",median:p.median??null,low:p.low??null,high:p.high??null,comps:p.comps??null,confidence:p.confidence||"",lastChecked:p.lastChecked||""''',
'''    userNotes:p.userNotes||"",target:p.target||"",targetNotes:p.targetNotes||"",\n    targetYear:p.targetYear??null,targetSet:p.targetSet||"",targetCardNum:p.targetCardNum||"",targetGrader:p.targetGrader||"Any / Raw OK",targetGrade:p.targetGrade||"",\n    targetAutoPreference:p.targetAutoPreference||"No preference",targetMaxPrice:p.targetMaxPrice??null,targetListingUrl:p.targetListingUrl||"",targetSource:p.targetSource||"",targetUpdatedAt:p.targetUpdatedAt||"",\n    median:p.median??null,low:p.low??null,high:p.high??null,comps:p.comps??null,confidence:p.confidence||"",lastChecked:p.lastChecked||""''',
"target persistence fields")
s=replace_once(s,
'''function savePlayerEdit(p){\n  const edits=currentEdits();''',
'''function savePlayerEdit(p){\n  if(p.incoming)p.owned=true;\n  const edits=currentEdits();''',
"incoming owned invariant")
s=replace_once(s,
'''loadLocalEdits();\n\nconst $=id=>document.getElementById(id);''',
'''loadLocalEdits();\nPLAYERS.forEach(p=>{if(p.incoming)p.owned=true;});\n\nconst $=id=>document.getElementById(id);''',
"startup incoming normalization")

# Target helper functions
anchor='''function formatPurchaseDate(v){\n  if(!v)return "";\n  const parts=String(v).split("-");\n  if(parts.length!==3)return v;\n  const d=new Date(Date.UTC(Number(parts[0]),Number(parts[1])-1,Number(parts[2])));\n  return d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric",timeZone:"UTC"});\n}\n'''
helpers='''function formatPurchaseDate(v){\n  if(!v)return "";\n  const parts=String(v).split("-");\n  if(parts.length!==3)return v;\n  const d=new Date(Date.UTC(Number(parts[0]),Number(parts[1])-1,Number(parts[2])));\n  return d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric",timeZone:"UTC"});\n}\nfunction targetIdentity(p){\n  const parsed=phase3bParseTarget(p?.target||"")||{};\n  const directYear=Number(p?.targetYear);\n  return {\n    year:Number.isInteger(directYear)?directYear:(parsed.year||null),\n    set:String(p?.targetSet||parsed.set||"").trim(),\n    cardNum:String(p?.targetCardNum||parsed.cardNum||"").trim()\n  };\n}\nfunction targetIdentityLabel(p){\n  if(!p?.target)return "";\n  const t=targetIdentity(p);\n  const bits=[t.year,t.set,t.cardNum?"#"+t.cardNum:""] .filter(Boolean);\n  return bits.join(" ")||String(p.target||"");\n}\nfunction targetPreferenceBits(p){\n  if(!p?.target)return [];\n  const bits=[];\n  const grader=String(p.targetGrader||"").trim();\n  const grade=String(p.targetGrade||"").trim();\n  const autoPref=String(p.targetAutoPreference||"").trim();\n  const max=Number(p.targetMaxPrice);\n  if(grader&&grader!=="Any / Raw OK")bits.push("Grade: "+grader+(grade?" "+grade:""));\n  else if(grade)bits.push("Condition: "+grade);\n  if(autoPref&&autoPref!=="No preference")bits.push(autoPref);\n  if(Number.isFinite(max)&&max>0)bits.push("Max delivered "+formatMoney(max));\n  if(p.targetNotes)bits.push(String(p.targetNotes));\n  return bits;\n}\nfunction targetPrimaryStatus(p){\n  if(p?.incoming)return {key:"incoming",label:"📦 INCOMING"};\n  if(p?.owned)return {key:"owned",label:"✓ OWNED"};\n  if(p?.target)return {key:"target",label:"🎯 TARGET"};\n  return {key:"need",label:"✕ NEED"};\n}\nfunction applyStructuredTarget(p,data={}){\n  if(!p)return;\n  const year=Number(data.year);\n  const set=String(data.set||"").trim();\n  const cardNum=String(data.cardNum||"").trim();\n  p.targetYear=Number.isInteger(year)?year:null;\n  p.targetSet=set;\n  p.targetCardNum=cardNum;\n  p.targetGrader=String(data.grader||"Any / Raw OK").trim()||"Any / Raw OK";\n  p.targetGrade=String(data.grade||"").trim();\n  p.targetAutoPreference=String(data.autoPreference||"No preference").trim()||"No preference";\n  const max=Number(data.maxPrice);\n  p.targetMaxPrice=Number.isFinite(max)&&max>0?max:null;\n  p.targetNotes=String(data.notes||"").trim();\n  p.targetListingUrl=String(data.listingUrl||"").trim();\n  p.targetSource=String(data.source||"").trim();\n  p.targetUpdatedAt=new Date().toISOString();\n  p.target=[p.targetYear,p.targetSet,p.targetCardNum?"#"+p.targetCardNum:""] .filter(Boolean).join(" ")||String(data.label||p.target||"").trim();\n}\nfunction clearStructuredTarget(p){\n  p.target="";p.targetNotes="";p.targetYear=null;p.targetSet="";p.targetCardNum="";p.targetGrader="Any / Raw OK";p.targetGrade="";\n  p.targetAutoPreference="No preference";p.targetMaxPrice=null;p.targetListingUrl="";p.targetSource="";p.targetUpdatedAt="";\n}\n'''
s=replace_once(s,anchor,helpers,"target helpers")

# List target chip
s=replace_once(s,
'''      row.innerHTML='<span class="mark '+(p.owned?'owned':'need')+'">'+(p.owned?'✓':'✕')+'</span>'+\n        '<span><span class="pname">'+escapeHtml(p.name)+(p.incoming?' <span class="incoming-tag">📦 Incoming</span>':'')+'</span><span class="psub">'+escapeHtml(cardLabel(p))+(p.target?' · 🎯 '+escapeHtml(p.target):'')+'</span></span><span class="chev">›</span>';''',
'''      row.innerHTML='<span class="mark '+(p.owned?'owned':'need')+'">'+(p.owned?'✓':'✕')+'</span>'+\n        '<span><span class="pname">'+escapeHtml(p.name)+(p.incoming?' <span class="incoming-tag">📦 Incoming</span>':'')+(p.target?' <span class="target-inline-tag">🎯 Target</span>':'')+'</span><span class="psub">'+escapeHtml(cardLabel(p))+(p.target?' · '+escapeHtml(targetIdentityLabel(p)):'')+'</span></span><span class="chev">›</span>';''',
"list target chip")

# Hunt status distinctions and detail
s=replace_once(s,'function huntNeedPlayers(){return PLAYERS.filter(p=>!p.owned&&!p.incoming)}','function huntNeedPlayers(){return PLAYERS.filter(p=>!p.owned&&!p.incoming&&!p.target)}',"hunt need filter")
s=replace_once(s,'if(huntFilter==="need")return !p.owned&&!p.incoming;','if(huntFilter==="need")return !p.owned&&!p.incoming&&!p.target;',"hunt need matching")
s=replace_once(s,'if(!p.owned&&!p.incoming)b.push(\'<span class="hunt-badge need">✕ NEED</span>\');','if(!p.owned&&!p.incoming&&!p.target)b.push(\'<span class="hunt-badge need">✕ NEED</span>\');',"hunt need badge")
s=replace_once(s,
'''  if(p.target)return p.target+(p.targetNotes?" · "+p.targetNotes:"");''',
'''  if(p.target)return [targetIdentityLabel(p),...targetPreferenceBits(p)].filter(Boolean).join(" · ");''',
"hunt target detail")
s=replace_once(s,
'''  if(action==="settarget"){\n    openTargetManage();\n    $("targetPlayer").value=p.name;\n    return;\n  }''',
'''  if(action==="settarget"){\n    openTargetManage(p);\n    return;\n  }''',
"hunt set target")

# Player detail status and target summary
s=replace_once(s,
'''  const statusText=p.owned?(p.incoming?"✓ OWNED · 📦 INCOMING":"✓ OWNED"):"✕ NEED";\n  $("detailStatus").textContent=statusText;\n  $("detailStatus").className="status-pill "+(p.owned?(p.incoming?"incoming":"owned"):"need");''',
'''  const primaryStatus=targetPrimaryStatus(p);\n  $("detailStatus").textContent=primaryStatus.label;\n  $("detailStatus").className="status-pill "+primaryStatus.key;''',
"detail primary status")
s=replace_once(s,
'''    $("cardNote").textContent=p.target?("Target on file: "+p.target+(p.targetNotes?" — "+p.targetNotes:"")):"No target card entered yet.";''',
'''    $("cardNote").textContent=p.target?("Target on file: "+[targetIdentityLabel(p),...targetPreferenceBits(p)].filter(Boolean).join(" · ")):"No target card entered yet.";''',
"detail target note")
s=replace_once(s,
'''  $("upgradeTarget").textContent=p.target||(!p.owned?"First card":"Scout research");\n  $("targetScoutRow").hidden=!p.target;''',
'''  $("upgradeTarget").textContent=p.target?targetIdentityLabel(p):(!p.owned?"First card":"Scout research");\n  $("targetScoutRow").hidden=!p.target;\n  $("targetSummary").hidden=!p.target;\n  $("targetSummaryMain").textContent=p.target?targetIdentityLabel(p):"";\n  const targetMeta=targetPreferenceBits(p);\n  if(p.targetSource)targetMeta.push("Saved via "+p.targetSource);\n  $("targetSummaryMeta").textContent=targetMeta.join(" · ")||"Identity saved. No extra preferences yet.";''',
"detail target summary render")
s=replace_once(s,
'''  else if(p.target) lines.push("Target locked: "+p.target+". If one shows up at a sane price, we pay attention.");''',
'''  else if(p.target) lines.push("Target locked: "+targetIdentityLabel(p)+". If one shows up at a sane price, we pay attention.");''',
"detail scout line")
s=replace_once(s,
'''  $("manageCardBtn").textContent=p.owned?"✎ EDIT MY CARD":"＋ ADD CARD TO COLLECTION";''',
'''  $("manageCardBtn").textContent=p.owned?"✎ EDIT MY CARD":"＋ ADD CARD TO COLLECTION";\n  $("findTargetBtn").textContent=p.owned?"🔎 FIND AN UPGRADE TARGET":(p.target?"🔎 FIND / REPLACE TARGET":"🔎 FIND A TARGET");''',
"find target button label")

# Remove target clears all structured fields
s=replace_once(s,
'''  p.target="";p.targetNotes="";''',
'''  clearStructuredTarget(p);''',
"clear structured target")

# Find Target save handoff
s=replace_once(s,
'''  p.target=label;\n  p.targetNotes=notes;\n  savePlayerEdit(p);''',
'''  const budget=Number($("findTargetBudget").value);\n  applyStructuredTarget(p,{\n    year:s.year,set:s.set,cardNum:s.cardNum,\n    grader:s.gradeInfo?.grader&&s.gradeInfo.grader!=="Raw"?s.gradeInfo.grader:"Any / Raw OK",\n    grade:s.gradeInfo?.grade??"",\n    autoPreference:s.traits?.autograph?"Autograph required":"No preference",\n    maxPrice:budget,notes,listingUrl:s.link||"",source:"Scout Target Finder",label\n  });\n  savePlayerEdit(p);''',
"Find Target structured handoff")
s=replace_once(s,
'''  $("upgradeTarget").textContent=p.target;\n  if(!p.owned)$("cardNote").textContent="Target on file: "+p.target+(p.targetNotes?" — "+p.targetNotes:"");''',
'''  $("upgradeTarget").textContent=targetIdentityLabel(p);\n  if(!p.owned)$("cardNote").textContent="Target on file: "+[targetIdentityLabel(p),...targetPreferenceBits(p)].filter(Boolean).join(" · ");\n  $("targetSummary").hidden=false;$("targetSummaryMain").textContent=targetIdentityLabel(p);$("targetSummaryMeta").textContent=targetPreferenceBits(p).join(" · ")||"Identity saved.";''',
"Find Target detail refresh")

# Scout saved target uses structured fields first
s=replace_once(s,
'''  const t=phase3bParseTarget(p.target);\n  if(!t){toast("Scout couldn't read that target. Edit the target and include year + set.");return}''',
'''  const t=targetIdentity(p);\n  if(!t.year||!t.set){toast("Scout couldn't read that target. Edit the target and include year + set.");return}''',
"structured target loading")
s=replace_once(s,
'''  $("shopGrade").value="Raw";\n  $("shopGradeNum").value="";\n  const desiredGrade=String(p.targetNotes||"").match(/Desired grade:\\s*(PSA|SGC|CGC|BGS|BVG|CSG|GMA|HGA|ISA)\\s*([0-9.]+)?/i);\n  if(desiredGrade){\n    const g=desiredGrade[1].toUpperCase();\n    const option=[...$("shopGrade").options].find(o=>String(o.textContent).toUpperCase().startsWith(g));\n    if(option)$("shopGrade").value=option.value;\n    if(desiredGrade[2])$("shopGradeNum").value=desiredGrade[2];\n  }\n  $("shopNotes").value=p.targetNotes||"";''',
'''  $("shopGrade").value="Raw";\n  $("shopGradeNum").value="";\n  const structuredGrader=String(p.targetGrader||"");\n  if(structuredGrader&&structuredGrader!=="Any / Raw OK"){\n    const option=[...$("shopGrade").options].find(o=>String(o.textContent).toUpperCase().startsWith(structuredGrader.toUpperCase().split(" /")[0]));\n    if(option)$("shopGrade").value=option.value;\n    if(p.targetGrade)$("shopGradeNum").value=p.targetGrade;\n  }else{\n    const desiredGrade=String(p.targetNotes||"").match(/Desired grade:\\s*(PSA|SGC|CGC|BGS|BVG|CSG|GMA|HGA|ISA)\\s*([0-9.]+)?/i);\n    if(desiredGrade){\n      const g=desiredGrade[1].toUpperCase();\n      const option=[...$("shopGrade").options].find(o=>String(o.textContent).toUpperCase().startsWith(g));\n      if(option)$("shopGrade").value=option.value;\n      if(desiredGrade[2])$("shopGradeNum").value=desiredGrade[2];\n    }\n  }\n  $("shopAuto").checked=String(p.targetAutoPreference||"")!==""&&String(p.targetAutoPreference||"")!=="No preference";\n  $("shopNotes").value=p.targetNotes||"";''',
"structured target shop preferences")

# Shop target comparison uses targetYear
s=replace_once(s,
'''      const targetYear=(String(p.target).match(/\\b(18|19|20)\\d{2}\\b/)||[])[0];\n      if(card.year&&Number(targetYear)===card.year) call="🎯 TARGET MATCH. Okay, now you have Scout’s full attention.";''',
'''      const targetYear=targetIdentity(p).year;\n      if(card.year&&Number(targetYear)===card.year) call="🎯 TARGET MATCH. Okay, now you have Scout’s full attention.";''',
"structured target match")

# Remember target card number into structured data
s=replace_once(s,
'''  p.target=label;\n  savePlayerEdit(p);''',
'''  applyStructuredTarget(p,{...targetIdentity(p),cardNum:card.cardNum,grader:p.targetGrader,grade:p.targetGrade,autoPreference:p.targetAutoPreference,maxPrice:p.targetMaxPrice,notes:p.targetNotes,listingUrl:p.targetListingUrl,source:p.targetSource||"Scout Target"});\n  savePlayerEdit(p);''',
"remember structured card number")

# Target manage open/edit and save
old='''function openTargetManage(){\n  $("targetForm").reset();\n  showScreen("targetManageScreen");\n}\nfunction saveTargetCard(e){\n  e.preventDefault();\n  const name=$("targetPlayer").value.trim();\n  const p=PLAYERS.find(x=>x.name.toLowerCase()===name.toLowerCase());\n  if(!p){toast("Scout needs an exact Hall of Famer from the player list.");return}\n  const year=parseInt($("targetYear").value.trim(),10);\n  const set=$("targetSet").value.trim();\n  const num=$("targetNum").value.trim();\n  const notes=$("targetNotes").value.trim();\n  if(!Number.isInteger(year)||year<1800||year>2100){toast("Target year needs to be a 4-digit year.");return}\n  if(!set){toast("Scout needs the target set name.");return}\n  const label=[year,set,num?"#"+num:""] .filter(Boolean).join(" ");\n  if(p.target&&p.target!==label){\n    const ok=window.confirm(p.name+" already has a target: "+p.target+". Replace it with "+label+"?");\n    if(!ok)return;\n  }\n  p.target=label;p.targetNotes=notes;savePlayerEdit(p);stats();rotateMission();\n  showScreen("homeScreen");showTargets();\n  const msgs=[\n    "Target acquired. Now we wait for the cardboard gods to cooperate.",\n    p.name+" is officially on the shopping radar.",\n    "Target saved. Scout will keep an eye out for "+label+".",\n    "Wish list upgraded. Your wallet has been warned."\n  ];\n  toast(msgs[Math.floor(Math.random()*msgs.length)]);\n}\n'''
new='''function openTargetManage(prefill=null){\n  $("targetForm").reset();\n  const p=prefill||null;\n  if(p){\n    const t=targetIdentity(p);\n    $("targetPlayer").value=p.name||"";\n    $("targetYear").value=t.year||"";\n    $("targetSet").value=t.set||"";\n    $("targetNum").value=t.cardNum||"";\n    $("targetGrader").value=p.targetGrader||"Any / Raw OK";\n    $("targetGrade").value=p.targetGrade||"";\n    $("targetAutoPreference").value=p.targetAutoPreference||"No preference";\n    $("targetMaxPrice").value=Number.isFinite(Number(p.targetMaxPrice))&&Number(p.targetMaxPrice)>0?Number(p.targetMaxPrice).toFixed(2):"";\n    $("targetNotes").value=p.targetNotes||"";\n    $("targetManageTitle").textContent=p.target?"Edit Target Card":"Add Target Card";\n    $("targetManageSub").textContent=p.target?"Update the exact card and preferences Scout should hunt for "+p.name+".":"Add a specific card you want Scout to hunt.";\n    $("targetSaveBtn").textContent=p.target?"SAVE TARGET CHANGES":"SAVE TARGET CARD";\n  }else{\n    $("targetManageTitle").textContent="Add Target Card";\n    $("targetManageSub").textContent="Add a specific card you want to hunt. Scout will keep it on your Target Cards list whether you already own the player or still need them.";\n    $("targetSaveBtn").textContent="SAVE TARGET CARD";\n  }\n  showScreen("targetManageScreen");\n}\nfunction saveTargetCard(e){\n  e.preventDefault();\n  const name=$("targetPlayer").value.trim();\n  const p=PLAYERS.find(x=>x.name.toLowerCase()===name.toLowerCase());\n  if(!p){toast("Scout needs an exact Hall of Famer from the player list.");return}\n  const year=parseInt($("targetYear").value.trim(),10);\n  const set=$("targetSet").value.trim();\n  const num=$("targetNum").value.trim();\n  const notes=$("targetNotes").value.trim();\n  const maxRaw=$("targetMaxPrice").value.trim();\n  const maxPrice=maxRaw===""?null:Number(maxRaw);\n  if(!Number.isInteger(year)||year<1800||year>2100){toast("Target year needs to be a 4-digit year.");return}\n  if(!set){toast("Scout needs the target set name.");return}\n  if(maxRaw!==""&&(!Number.isFinite(maxPrice)||maxPrice<=0)){toast("Max delivered price needs to be a valid amount.");return}\n  const label=[year,set,num?"#"+num:""] .filter(Boolean).join(" ");\n  if(p.target&&p.target!==label){\n    const ok=window.confirm(p.name+" already has a target: "+p.target+". Replace it with "+label+"?");\n    if(!ok)return;\n  }\n  applyStructuredTarget(p,{year,set,cardNum:num,grader:$("targetGrader").value,grade:$("targetGrade").value.trim(),autoPreference:$("targetAutoPreference").value,maxPrice,notes,source:"Manual Target",label});\n  savePlayerEdit(p);stats();rotateMission();renderList();renderHuntList();\n  if(currentPlayer&&currentPlayer.name===p.name){openPlayer(p,returnScreen);}\n  else{showScreen("homeScreen");showTargets();}\n  const msgs=[\n    "Target acquired. Now we wait for the cardboard gods to cooperate.",\n    p.name+" is officially on the shopping radar.",\n    "Target saved. Scout will keep an eye out for "+label+".",\n    "Wish list upgraded. Your wallet has been warned."\n  ];\n  toast(msgs[Math.floor(Math.random()*msgs.length)]);\n}\n'''
s=replace_once(s,old,new,"structured target manage functions")

# Card Shop save-as-target handoff
s=replace_once(s,
'''    p.target=label;\n    p.targetNotes=$("phase3aTargetNotes").value.trim();\n    savePlayerEdit(p);stats();rotateMission();renderList();''',
'''    applyStructuredTarget(p,{year:card.year,set:card.set,cardNum:card.cardNum,grader:card.grader&&card.grader!=="Raw"?card.grader:"Any / Raw OK",grade:card.grade||"",autoPreference:card.autograph?"Autograph required":"No preference",maxPrice:targets?.ceiling??null,notes:$("phase3aTargetNotes").value.trim(),source:"Card Shop Mode",label});\n    savePlayerEdit(p);stats();rotateMission();renderList();''',
"Card Shop structured target handoff")

# Event binding for edit target
s=replace_once(s,
'''$("scoutTargetBtn").addEventListener("click",()=>phase3bScoutTarget(currentPlayer));\n$("removeTargetBtn").addEventListener("click",removeCurrentTarget);''',
'''$("scoutTargetBtn").addEventListener("click",()=>phase3bScoutTarget(currentPlayer));\n$("editTargetBtn").addEventListener("click",()=>openTargetManage(currentPlayer));\n$("removeTargetBtn").addEventListener("click",removeCurrentTarget);''',
"edit target event")

Path(path).write_text(s,encoding="utf-8")
print("patched index.html")

# Standalone Find a Target: save the structured fields to Scout Cloud too.
path="phase6-find-target.html"
s=Path(path).read_text(encoding="utf-8")
s=s.replace("LAB v0.1.7","LAB v0.1.8").replace("phase6-find-target-lab-v0.1.7","phase6-find-target-lab-v0.1.8")
s=replace_once(s,
'''    const updated={...existing,target:label,targetNotes:noteBits.join(" · ")};''',
'''    const budget=Number($("budget").value);\n    const updated={...existing,target:label,targetNotes:noteBits.join(" · "),targetYear:Number(suggestion.year)||null,targetSet:suggestion.set||"",targetCardNum:suggestion.cardNum||"",targetGrader:suggestion.gradeInfo?.grader&&suggestion.gradeInfo.grader!=="Raw"?suggestion.gradeInfo.grader:"Any / Raw OK",targetGrade:suggestion.gradeInfo?.grade??"",targetAutoPreference:suggestion.traits?.autograph?"Autograph required":"No preference",targetMaxPrice:Number.isFinite(budget)&&budget>0?budget:null,targetListingUrl:suggestion.link||"",targetSource:"Scout Find a Target",targetUpdatedAt:new Date().toISOString()};''',
"standalone structured target handoff")
Path(path).write_text(s,encoding="utf-8")
print("patched phase6-find-target.html")

# Contract + syntax test
Path("tests/structured-targets.test.cjs").write_text(r'''const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");
assert.match(html,/targetYear:p\.targetYear/);
assert.match(html,/targetAutoPreference/);
assert.match(html,/targetMaxPrice/);
assert.match(html,/function targetPrimaryStatus\(p\)/);
assert.match(html,/if\(p\?\.incoming\)return \{key:"incoming"/);
assert.match(html,/function applyStructuredTarget\(p,data=\{\}\)/);
assert.match(html,/function clearStructuredTarget\(p\)/);
assert.match(html,/id="targetSummary"/);
assert.match(html,/id="editTargetBtn"/);
assert.match(html,/openTargetManage\(currentPlayer\)/);
assert.match(html,/source:"Scout Target Finder"/);
assert.match(html,/source:"Card Shop Mode"/);
assert.match(html,/huntNeedPlayers\(\)\{return PLAYERS\.filter\(p=>!p\.owned&&!p\.incoming&&!p\.target\)\}/);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length,"main script should exist");
for(const m of scripts)new Function(m[1]);
const lab=fs.readFileSync("phase6-find-target.html","utf8");
assert.match(lab,/targetYear:Number\(suggestion\.year\)/);
assert.match(lab,/targetMaxPrice/);
console.log("Structured target management contract passed.");
''',encoding="utf-8")
print("wrote tests/structured-targets.test.cjs")
