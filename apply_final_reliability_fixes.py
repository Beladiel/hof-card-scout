from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Final QA release version.
if '· v5.5.0</div>' not in s:
    raise SystemExit('v5.5.0 footer anchor not found')
s=s.replace('· v5.5.0</div>','· v5.6.0</div>',1)

# 1) Manual Data / Backup must protect all user-created app state, not only official-player edits.
old_export='''function exportUpdates(){
  const edits=currentEdits(),names=Object.keys(edits);
  if(!names.length){toast("No phone updates to export yet.");return}
  const payload={app:"HOF Card Scout",version:"5.0.3",exportedAt:new Date().toISOString(),playerUpdates:edits};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="HOF-Card-Scout-updates.json";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);toast(names.length+" player update"+(names.length===1?"":"s")+" exported.");
}'''
new_export='''function backupReadJson(key){
  try{
    const raw=localStorage.getItem(key);
    return raw?JSON.parse(raw):null;
  }catch(err){return null}
}
function backupHasFutureState(state){
  return !!state&&(
    (Array.isArray(state.watch)&&state.watch.length)||
    Object.keys(state.targets||{}).length||
    Object.keys(state.purchases||{}).length
  );
}
function exportUpdates(){
  const edits=currentEdits(),names=Object.keys(edits);
  const monthlyPick=backupReadJson(MONTHLY_STATE_KEY);
  const futureHof=backupReadJson(FUTURE_HOF_STATE_KEY);
  const hasMonthly=!!monthlyPick&&Object.keys(monthlyPick).length>0;
  const hasFuture=backupHasFutureState(futureHof);
  if(!names.length&&!hasMonthly&&!hasFuture){toast("No Scout updates to export yet.");return}
  const payload={
    app:"HOF Card Scout",
    version:"5.6.0",
    backupSchema:2,
    exportedAt:new Date().toISOString(),
    playerUpdates:edits,
    monthlyPick:monthlyPick||null,
    futureHof:futureHof||null
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="HOF-Card-Scout-updates.json";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  const extra=(hasMonthly?1:0)+(hasFuture?1:0);
  toast(names.length+" player update"+(names.length===1?"":"s")+(extra?" + Scout activity":"")+" exported.");
}'''
if old_export not in s:
    raise SystemExit('exportUpdates anchor not found')
s=s.replace(old_export,new_export,1)

old_import='''function importUpdatesFile(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const payload=JSON.parse(String(reader.result||""));
      if(!payload||typeof payload!=="object"||!payload.playerUpdates||typeof payload.playerUpdates!=="object"){
        throw new Error("That file is not a HOF Card Scout updates export.");
      }
      const validNames=new Set(PLAYERS.map(p=>p.name));
      const incoming={};
      Object.entries(payload.playerUpdates).forEach(([name,data])=>{
        if(validNames.has(name)&&data&&typeof data==="object") incoming[name]=data;
      });
      const names=Object.keys(incoming);
      if(!names.length) throw new Error("Scout could not find any matching player updates in that file.");
      const merged={...currentEdits(),...incoming};
      localStorage.setItem(STORAGE_KEY,JSON.stringify(merged));
      markLocalCollectionChanged();
      scheduleCloudSave();
      PLAYERS.forEach(p=>{if(incoming[p.name]) Object.assign(p,incoming[p.name]);});
      stats();rotateMission();buildAlphabet();renderList();
      toast(names.length+" player update"+(names.length===1?"":"s")+" restored. Welcome back, cardboard.");
    }catch(err){
      toast(err.message||"Scout could not import that updates file.");
    }finally{
      $("importFile").value="";
    }
  };
  reader.onerror=()=>toast("Scout could not read that file.");
  reader.readAsText(file);
}'''
new_import='''function importUpdatesFile(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const payload=JSON.parse(String(reader.result||""));
      if(!payload||typeof payload!=="object"||!payload.playerUpdates||typeof payload.playerUpdates!=="object"){
        throw new Error("That file is not a HOF Card Scout updates export.");
      }
      const validNames=new Set(PLAYERS.map(p=>p.name));
      const incoming={};
      Object.entries(payload.playerUpdates).forEach(([name,data])=>{
        if(validNames.has(name)&&data&&typeof data==="object"&&!Array.isArray(data)) incoming[name]=data;
      });
      const names=Object.keys(incoming);
      const hasMonthly=payload.monthlyPick&&typeof payload.monthlyPick==="object"&&!Array.isArray(payload.monthlyPick);
      const hasFuture=payload.futureHof&&typeof payload.futureHof==="object"&&!Array.isArray(payload.futureHof);
      if(!names.length&&!hasMonthly&&!hasFuture) throw new Error("Scout could not find any matching updates in that file.");

      if(names.length){
        const merged={...currentEdits(),...incoming};
        localStorage.setItem(STORAGE_KEY,JSON.stringify(merged));
      }
      if(hasMonthly)localStorage.setItem(MONTHLY_STATE_KEY,JSON.stringify(payload.monthlyPick));
      if(hasFuture)localStorage.setItem(FUTURE_HOF_STATE_KEY,JSON.stringify(payload.futureHof));

      markLocalCollectionChanged();
      scheduleCloudSave();
      const restored=[];
      if(names.length)restored.push(names.length+" player update"+(names.length===1?"":"s"));
      if(hasMonthly)restored.push("Monthly Pick");
      if(hasFuture)restored.push("Future HOF data");
      toast(restored.join(" + ")+" restored. Reloading Scout…");
      setTimeout(()=>location.reload(),450);
    }catch(err){
      toast(err.message||"Scout could not import that updates file.");
    }finally{
      $("importFile").value="";
    }
  };
  reader.onerror=()=>toast("Scout could not read that file.");
  reader.readAsText(file);
}'''
if old_import not in s:
    raise SystemExit('importUpdatesFile anchor not found')
s=s.replace(old_import,new_import,1)

# 2) When an exact target is purchased, clear every structured target field, not just the visible label.
old_clear='if(phase3aTargetMatches(p,card)){p.target="";p.targetNotes="";}'
new_clear='if(phase3aTargetMatches(p,card))clearStructuredTarget(p);'
if old_clear not in s:
    raise SystemExit('exact-target purchase clear anchor not found')
s=s.replace(old_clear,new_clear,1)

# 3) Detail-screen Mark Received should refresh the same dependent UI/state as Hunt List.
old_received='''  currentPlayer.incoming=false;
  savePlayerEdit(currentPlayer);renderList();openPlayer(currentPlayer);'''
new_received='''  currentPlayer.incoming=false;
  savePlayerEdit(currentPlayer);stats();rotateMission();renderList();renderHuntList();openPlayer(currentPlayer,returnScreen);'''
if old_received not in s:
    raise SystemExit('markReceived refresh anchor not found')
s=s.replace(old_received,new_received,1)

p.write_text(s,encoding='utf-8')

# Update the visible version assertion owned by dashboard regression coverage.
t=Path('tests/collection-dashboard.test.cjs')
txt=t.read_text(encoding='utf-8')
if 'assert.match(html,/v5\\.5\\.0/);' not in txt:
    raise SystemExit('dashboard version assertion anchor not found')
txt=txt.replace('assert.match(html,/v5\\.5\\.0/);','assert.match(html,/v5\\.6\\.0/);',1)
t.write_text(txt,encoding='utf-8')

# Add final cross-feature reliability contract.
Path('tests/end-to-end-reliability.test.cjs').write_text(r'''const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>([\s\S]*)<\/script>/);
assert.ok(script,"inline app script missing");
new vm.Script(script[1]);

assert.match(html,/v5\.6\.0/);

// Manual backup now covers every locally persistent collection/activity store.
assert.match(html,/function backupReadJson\(key\)/);
assert.match(html,/backupSchema:2/);
assert.match(html,/version:"5\.6\.0"/);
assert.match(html,/monthlyPick:monthlyPick\|\|null/);
assert.match(html,/futureHof:futureHof\|\|null/);
assert.match(html,/backupReadJson\(MONTHLY_STATE_KEY\)/);
assert.match(html,/backupReadJson\(FUTURE_HOF_STATE_KEY\)/);

// Import remains compatible with legacy playerUpdates-only exports while optionally restoring new stores.
assert.match(html,/!payload\.playerUpdates\|\|typeof payload\.playerUpdates!=="object"/);
assert.match(html,/if\(hasMonthly\)localStorage\.setItem\(MONTHLY_STATE_KEY/);
assert.match(html,/if\(hasFuture\)localStorage\.setItem\(FUTURE_HOF_STATE_KEY/);
assert.match(html,/setTimeout\(\(\)=>location\.reload\(\),450\)/);
assert.match(html,/if\(!names\.length&&!hasMonthly&&!hasFuture\)/);

// Exact-target purchases must clear the complete structured target, not leave ghost metadata.
assert.match(html,/if\(phase3aTargetMatches\(p,card\)\)clearStructuredTarget\(p\);/);
assert.doesNotMatch(html,/if\(phase3aTargetMatches\(p,card\)\)\{p\.target="";p\.targetNotes="";\}/);

// Mark Received from player detail refreshes all dependent views/counters.
assert.match(html,/savePlayerEdit\(currentPlayer\);stats\(\);rotateMission\(\);renderList\(\);renderHuntList\(\);openPlayer\(currentPlayer,returnScreen\);/);

console.log("End-to-end reliability tests passed.");
''',encoding='utf-8')
