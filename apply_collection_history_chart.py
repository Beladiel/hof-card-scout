from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
assert 'id="dashboardCollectionHistoryChart"' not in s, 'collection history chart already applied'

# Reserve one cloud-synced metadata record inside playerUpdates. Unknown keys are ignored
# by loadLocalEdits, while the current Worker stores playerUpdates as-is.
old='''const STORAGE_KEY="hofCardScoutEditsV1";\nconst CLOUD_META_KEY="hofCardScoutCloudMetaV1";'''
new='''const STORAGE_KEY="hofCardScoutEditsV1";\nconst COLLECTION_VALUE_HISTORY_META_KEY="__scoutCollectionValueHistoryV1";\nconst CLOUD_META_KEY="hofCardScoutCloudMetaV1";'''
assert old in s, 'storage constants marker not found'
s=s.replace(old,new,1)

old='''function currentEdits(){\n  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");}\n  catch(err){return {}}\n}\n\nfunction cloudMeta(){'''
new='''function currentEdits(){\n  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");}\n  catch(err){return {}}\n}\nfunction collectionValueHistoryMeta(edits=currentEdits()){\n  const raw=edits&&edits[COLLECTION_VALUE_HISTORY_META_KEY];\n  return raw&&typeof raw==="object"&&!Array.isArray(raw)\n    ?{schema:1,history:Array.isArray(raw.history)?raw.history:[],updatedAt:raw.updatedAt||""}\n    :{schema:1,history:[],updatedAt:""};\n}\nfunction collectionPlayerUpdateCount(edits=currentEdits()){\n  const valid=new Set(PLAYERS.map(p=>p.name));\n  return Object.keys(edits||{}).filter(name=>valid.has(name)).length;\n}\nfunction collectionValueSaveCollectionSnapshot(now=new Date()){\n  const dashboardApi=window.ScoutCollectionValueDashboard,valueApi=window.ScoutCollectionValue;\n  if(!dashboardApi||!valueApi)return false;\n  const summary=dashboardApi.summarize(PLAYERS,valueApi);\n  const snapshot=dashboardApi.snapshotForSummary(summary,now);\n  if(!snapshot)return false;\n  const edits=currentEdits(),meta=collectionValueHistoryMeta(edits);\n  const history=dashboardApi.mergeHistory(meta.history,snapshot);\n  edits[COLLECTION_VALUE_HISTORY_META_KEY]={schema:1,history,updatedAt:snapshot.at};\n  localStorage.setItem(STORAGE_KEY,JSON.stringify(edits));\n  markLocalCollectionChanged();\n  scheduleCloudSave();\n  return true;\n}\n\nfunction cloudMeta(){'''
assert old in s, 'currentEdits marker not found'
s=s.replace(old,new,1)

old='''    writeCloudMeta({\n      lastCloudSavedAt:data.savedAt||new Date().toISOString(),\n      lastCloudPlayerCount:Number(data.playerCount)||Object.keys(edits).length\n    });\n    const count=Object.keys(edits).length;'''
new='''    const count=collectionPlayerUpdateCount(edits);\n    writeCloudMeta({\n      lastCloudSavedAt:data.savedAt||new Date().toISOString(),\n      lastCloudPlayerCount:count\n    });'''
assert old in s, 'cloud save count marker not found'
s=s.replace(old,new,1)

# Dashboard UI: reuse the same chart primitives as the per-card history graph.
old='''          <div class="dashboard-value-note" id="dashboardValueNote"></div>\n        </div>'''
new='''          <div class="dashboard-value-note" id="dashboardValueNote"></div>\n          <div class="collection-history" id="dashboardCollectionHistory">\n            <div class="collection-history-head">\n              <div class="collection-history-title">📊 COLLECTION VALUE HISTORY</div>\n              <div class="collection-history-trend flat" id="dashboardCollectionHistoryTrend">WAITING FOR FIRST CHECKPOINT</div>\n            </div>\n            <div class="collection-history-chart" id="dashboardCollectionHistoryChart"></div>\n            <div class="collection-history-note" id="dashboardCollectionHistoryNote"></div>\n          </div>\n        </div>'''
assert old in s, 'dashboard value note marker not found'
s=s.replace(old,new,1)

# Track a daily whole-collection checkpoint whenever an exact-card reliable refresh saves.
old='''function collectionValueTrackRefresh(card,data,ctx){\n  const api=window.ScoutCollectionValue,p=ctx?.p;\n  if(!api||!p?.owned||!api.exactRepresentativeMatch(p,card))return false;\n  const patch=api.buildTrackingPatch(p,data,new Date());\n  if(!patch)return false;\n  Object.assign(p,patch);\n  savePlayerEdit(p);\n  return true;\n}'''
new='''function collectionValueTrackRefresh(card,data,ctx){\n  const api=window.ScoutCollectionValue,p=ctx?.p;\n  if(!api||!p?.owned||!api.exactRepresentativeMatch(p,card))return false;\n  const now=new Date();\n  const patch=api.buildTrackingPatch(p,data,now);\n  if(!patch)return false;\n  Object.assign(p,patch);\n  savePlayerEdit(p);\n  collectionValueSaveCollectionSnapshot(now);\n  return true;\n}'''
assert old in s, 'collectionValueTrackRefresh marker not found'
s=s.replace(old,new,1)

# A card purchased from a trustworthy Card Shop result can also save a valuation immediately.
old='''  if(window.ScoutCollectionValue){\n    const valuePatch=ScoutCollectionValue.buildTrackingPatch(p,data,new Date());\n    if(valuePatch)Object.assign(p,valuePatch);\n  }\n\n  if(phase3aTargetMatches(p,card))clearStructuredTarget(p);\n\n  savePlayerEdit(p);stats();rotateMission();buildAlphabet();renderList();'''
new='''  const purchaseValueNow=new Date();\n  let purchaseValueSaved=false;\n  if(window.ScoutCollectionValue){\n    const valuePatch=ScoutCollectionValue.buildTrackingPatch(p,data,purchaseValueNow);\n    if(valuePatch){Object.assign(p,valuePatch);purchaseValueSaved=true;}\n  }\n\n  if(phase3aTargetMatches(p,card))clearStructuredTarget(p);\n\n  savePlayerEdit(p);\n  if(purchaseValueSaved)collectionValueSaveCollectionSnapshot(purchaseValueNow);\n  stats();rotateMission();buildAlphabet();renderList();'''
assert old in s, 'purchase valuation marker not found'
s=s.replace(old,new,1)

# Render the dashboard history from durable metadata; no marketplace calls are made here.
marker='''function renderDashboard(){'''
add=r'''function renderDashboardCollectionHistory(){
  const chart=$("dashboardCollectionHistoryChart"),trend=$("dashboardCollectionHistoryTrend"),note=$("dashboardCollectionHistoryNote");
  if(!chart||!trend||!note)return;
  const rows=collectionValueHistoryMeta().history;
  const chartApi=window.ScoutCollectionValueChart;
  const model=chartApi?chartApi.buildModel(rows):null;
  trend.className="collection-history-trend flat";
  if(!model){
    trend.textContent="WAITING FOR FIRST CHECKPOINT";
    chart.innerHTML='<div class="collection-history-empty"><strong>No collection value history yet.</strong><br>The next reliable representative-card valuation Scout saves will create your first whole-collection checkpoint.</div>';
    note.textContent="No extra searches are used. Each checkpoint records the total of Scout's saved reliable card values and how many owned cards were included at that moment.";
    return;
  }
  const n=model.points.length,d=model.delta;
  if(n===1){
    trend.textContent="FIRST CHECKPOINT · "+formatMoney(model.first.value);
  }else{
    trend.className="collection-history-trend "+(d.amount>0?"up":d.amount<0?"down":"flat");
    const amount=(d.amount>0?"+":d.amount<0?"−":"")+formatMoney(Math.abs(d.amount));
    const pct=d.pct===null?"":` · ${d.pct>0?"+":d.pct<0?"−":""}${Math.abs(d.pct).toFixed(1)}%`;
    trend.textContent=amount+pct+" SINCE FIRST CHECKPOINT";
  }
  const grid=model.grid.map(g=>`<line class="collection-history-grid" x1="${model.pad.left}" x2="${model.width-model.pad.right}" y1="${g.y}" y2="${g.y}"></line><text class="collection-history-axis" x="7" y="${g.y+3}">${escapeHtml(formatMoney(g.value))}</text>`).join("");
  const points=model.points.map((pt,i)=>{
    const date=collectionHistoryDate(pt.at,true);
    const coverage=Number.isFinite(Number(pt.coveragePct))?Number(pt.coveragePct).toFixed(1).replace(/\.0$/,"")+"% coverage":"";
    const included=Number(pt.valuedCount)||0;
    const owned=Number(pt.ownedCount)||0;
    const details=[date,formatMoney(pt.value),included+" of "+owned+" owned cards valued",coverage].filter(Boolean).join(" · ");
    const latest=i===model.points.length-1?" latest":"";
    return `<circle class="collection-history-point${latest}" cx="${pt.x}" cy="${pt.y}" r="${latest?5.5:4.5}"><title>${escapeHtml(details)}</title></circle>`;
  }).join("");
  const firstDate=collectionHistoryDate(model.first.at,n===1),lastDate=collectionHistoryDate(model.last.at,true);
  const dateLabels=n===1
    ? `<text class="collection-history-axis" text-anchor="middle" x="${model.first.x}" y="${model.height-12}">${escapeHtml(firstDate)}</text>`
    : `<text class="collection-history-axis" x="${model.pad.left}" y="${model.height-12}">${escapeHtml(firstDate)}</text><text class="collection-history-axis" text-anchor="end" x="${model.width-model.pad.right}" y="${model.height-12}">${escapeHtml(lastDate)}</text>`;
  const latestLabel=`<text class="collection-history-value" x="${model.last.x}" y="${Math.max(14,model.last.y-10)}">${escapeHtml(formatMoney(model.last.value))}</text>`;
  chart.innerHTML=`<svg viewBox="0 0 ${model.width} ${model.height}" role="img" aria-label="Estimated collection value history with ${n} checkpoint${n===1?"":"s"}">${grid}${n>1?`<path class="collection-history-line" d="${model.path}"></path>`:""}${points}${latestLabel}${dateLabels}</svg>`;
  const latest=model.last;
  note.textContent=n===1
    ?"History has started with "+latest.valuedCount+" of "+latest.ownedCount+" owned cards valued. A later reliable valuation will create the first trend line."
    :"Each point is a real valuation checkpoint, not reconstructed history. The latest checkpoint includes "+latest.valuedCount+" of "+latest.ownedCount+" owned cards. Same-day valuation refreshes update today's checkpoint instead of padding the chart.";
}

'''
assert marker in s, 'renderDashboard marker not found'
s=s.replace(marker,add+marker,1)

old='''    $("dashboardValueNote").textContent="Collection valuation is not available in this app version.";\n  }\n\n  const milestones=[50,60,75,90,100];'''
new='''    $("dashboardValueNote").textContent="Collection valuation is not available in this app version.";\n  }\n  renderDashboardCollectionHistory();\n\n  const milestones=[50,60,75,90,100];'''
assert old in s, 'dashboard history render hook marker not found'
s=s.replace(old,new,1)

# Export and import the reserved metadata record without counting it as a player.
old='''function exportUpdates(){\n  const edits=currentEdits(),names=Object.keys(edits);\n  const monthlyPick=backupReadJson(MONTHLY_STATE_KEY);\n  const futureHof=backupReadJson(FUTURE_HOF_STATE_KEY);\n  const hasMonthly=!!monthlyPick&&Object.keys(monthlyPick).length>0;\n  const hasFuture=backupHasFutureState(futureHof);\n  if(!names.length&&!hasMonthly&&!hasFuture){toast("No Scout updates to export yet.");return}'''
new='''function exportUpdates(){\n  const edits=currentEdits(),validNames=new Set(PLAYERS.map(p=>p.name)),names=Object.keys(edits).filter(name=>validNames.has(name));\n  const monthlyPick=backupReadJson(MONTHLY_STATE_KEY);\n  const futureHof=backupReadJson(FUTURE_HOF_STATE_KEY);\n  const hasMonthly=!!monthlyPick&&Object.keys(monthlyPick).length>0;\n  const hasFuture=backupHasFutureState(futureHof);\n  const hasCollectionHistory=collectionValueHistoryMeta(edits).history.length>0;\n  if(!names.length&&!hasMonthly&&!hasFuture&&!hasCollectionHistory){toast("No Scout updates to export yet.");return}'''
assert old in s, 'export marker not found'
s=s.replace(old,new,1)

old='''      const incoming={};\n      Object.entries(payload.playerUpdates).forEach(([name,data])=>{\n        if(validNames.has(name)&&data&&typeof data==="object"&&!Array.isArray(data)) incoming[name]=data;\n      });\n      const names=Object.keys(incoming);\n      const hasMonthly=payload.monthlyPick&&typeof payload.monthlyPick==="object"&&!Array.isArray(payload.monthlyPick);\n      const hasFuture=payload.futureHof&&typeof payload.futureHof==="object"&&!Array.isArray(payload.futureHof);\n      if(!names.length&&!hasMonthly&&!hasFuture) throw new Error("Scout could not find any matching updates in that file.");\n\n      if(names.length){\n        const merged={...currentEdits(),...incoming};\n        localStorage.setItem(STORAGE_KEY,JSON.stringify(merged));\n      }'''
new='''      const incoming={};\n      Object.entries(payload.playerUpdates).forEach(([name,data])=>{\n        if(validNames.has(name)&&data&&typeof data==="object"&&!Array.isArray(data)) incoming[name]=data;\n      });\n      const collectionHistoryRaw=payload.playerUpdates[COLLECTION_VALUE_HISTORY_META_KEY];\n      const hasCollectionHistory=!!(collectionHistoryRaw&&typeof collectionHistoryRaw==="object"&&!Array.isArray(collectionHistoryRaw)&&Array.isArray(collectionHistoryRaw.history));\n      const names=Object.keys(incoming);\n      const hasMonthly=payload.monthlyPick&&typeof payload.monthlyPick==="object"&&!Array.isArray(payload.monthlyPick);\n      const hasFuture=payload.futureHof&&typeof payload.futureHof==="object"&&!Array.isArray(payload.futureHof);\n      if(!names.length&&!hasMonthly&&!hasFuture&&!hasCollectionHistory) throw new Error("Scout could not find any matching updates in that file.");\n\n      if(names.length||hasCollectionHistory){\n        const merged={...currentEdits(),...incoming};\n        if(hasCollectionHistory)merged[COLLECTION_VALUE_HISTORY_META_KEY]=collectionHistoryRaw;\n        localStorage.setItem(STORAGE_KEY,JSON.stringify(merged));\n      }'''
assert old in s, 'import data marker not found'
s=s.replace(old,new,1)

old='''      if(names.length)restored.push(names.length+" player update"+(names.length===1?"":"s"));\n      if(hasMonthly)restored.push("Monthly Pick");\n      if(hasFuture)restored.push("Future HOF data");'''
new='''      if(names.length)restored.push(names.length+" player update"+(names.length===1?"":"s"));\n      if(hasCollectionHistory)restored.push("collection value history");\n      if(hasMonthly)restored.push("Monthly Pick");\n      if(hasFuture)restored.push("Future HOF data");'''
assert old in s, 'import restored marker not found'
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
