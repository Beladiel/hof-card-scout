from pathlib import Path

# Worker: record only real automatic searches in a durable activity log.
p=Path('src/index.js')
s=p.read_text(encoding='utf-8')
assert 'const VERSION = "3.32.0";' in s
s=s.replace('const VERSION = "3.32.0";','const VERSION = "3.33.0";',1)

old='''    alerts: Array.isArray(raw?.alerts) ? raw.alerts.slice(-50) : [],\n    targetChecks: raw?.targetChecks && typeof raw.targetChecks === "object" && !Array.isArray(raw.targetChecks) ? raw.targetChecks : {},'''
new='''    alerts: Array.isArray(raw?.alerts) ? raw.alerts.slice(-50) : [],\n    activity: Array.isArray(raw?.activity) ? raw.activity.slice(-50) : [],\n    targetChecks: raw?.targetChecks && typeof raw.targetChecks === "object" && !Array.isArray(raw.targetChecks) ? raw.targetChecks : {},'''
assert old in s
s=s.replace(old,new,1)

old='''    alerts: normalized.alerts.slice(-20),\n    note: "Saved-target monitoring and paced collection-value rotation are scheduled under the same hard monthly search cap.",'''
new='''    alerts: normalized.alerts.slice(-20),\n    activity: normalized.activity.slice(-30),\n    note: "Saved-target monitoring and paced collection-value rotation are scheduled under the same hard monthly search cap.",'''
assert old in s
s=s.replace(old,new,1)

marker='''async function readAutomationState(kv) {'''
assert marker in s
helper=r'''function automationActivityMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "";
}

function automationRecordActivity(inputState, kind, result, now=new Date(), source="scheduled") {
  const state = normalizeAutomationState(inputState || {});
  const searchUsed = Math.max(0, Math.floor(Number(result?.searchUsed) || 0));
  if (searchUsed < 1) return state;

  const at = (now instanceof Date ? now : new Date(now || Date.now())).toISOString();
  const safeKind = kind === "collection" ? "collection" : "target";
  const player = automationText(safeKind === "target" ? result?.target?.name : result?.card?.name, 120) || (safeKind === "target" ? "Saved target" : "Collection card");
  let outcome = "checked";
  let summary = automationText(result?.message || "Search completed.", 320);
  let updated = false;
  let listingUrl = "";
  let value = null;
  let delivered = null;
  let maxPrice = null;

  if (safeKind === "target") {
    maxPrice = Number.isFinite(Number(result?.target?.maxPrice)) ? Number(result.target.maxPrice) : null;
    if (result?.status === "error") {
      outcome = "error";
      summary = automationText(result?.message || `${player} target search failed after one protected search.`, 320);
    } else if (result?.alert) {
      outcome = "deal-found";
      delivered = Number.isFinite(Number(result.alert.delivered)) ? Number(result.alert.delivered) : null;
      maxPrice = Number.isFinite(Number(result.alert.maxPrice)) ? Number(result.alert.maxPrice) : maxPrice;
      listingUrl = automationText(result.alert.listingUrl, 500);
      summary = `Found ${automationActivityMoney(delivered) || "an affordable listing"}${maxPrice !== null ? ` delivered vs. your ${automationActivityMoney(maxPrice)} max` : ""}.`;
    } else {
      outcome = "checked-no-deal";
      summary = `${player} was checked${maxPrice !== null ? ` against your ${automationActivityMoney(maxPrice)} max` : ""}; no qualifying listing was found.`;
    }
  } else {
    value = Number.isFinite(Number(result?.valuation?.median)) ? Number(result.valuation.median) : null;
    if (result?.status === "error") {
      outcome = "error";
      summary = automationText(result?.message || `${player} value search failed after one protected search.`, 320);
    } else if (result?.saved) {
      updated = result?.persisted !== false;
      outcome = updated ? "value-updated" : "value-found-not-saved";
      const comps = Math.max(0, Math.floor(Number(result?.valuation?.used) || 0));
      summary = updated
        ? `${player} value updated${value !== null ? ` to ${automationActivityMoney(value)}` : ""}${comps ? ` using ${comps} comps` : ""}.`
        : `${player} produced a reliable value${value !== null ? ` of ${automationActivityMoney(value)}` : ""}, but Scout could not save it to cloud history.`;
    } else {
      outcome = "checked-no-update";
      summary = automationText(result?.message || `${player} was checked, but the evidence was not strong enough to update its value.`, 320);
    }
  }

  const entry = {
    id: `${at}|${safeKind}|${player}|${state.activity.length}`,
    at,
    source: source === "manual-test" ? "manual-test" : "scheduled",
    kind: safeKind,
    player,
    searchUsed,
    outcome,
    summary,
    updated,
    value,
    delivered,
    maxPrice,
    listingUrl,
  };
  state.activity = [...state.activity, entry].slice(-50);
  return state;
}

'''
s=s.replace(marker,helper+marker,1)

old='''        state = run.state;\n        await writeAutomationState(env.SCOUT_DATA, state);'''
new='''        state = run.state;\n        state = automationRecordActivity(state, kind, run.result, new Date(), "manual-test");\n        await writeAutomationState(env.SCOUT_DATA, state);'''
assert old in s
s=s.replace(old,new,1)

old='''  if (Number(targetRun.result?.searchUsed) > 0 || targetRun.result?.status === "error") {\n    await writeAutomationState(env.SCOUT_DATA, state);'''
new='''  if (Number(targetRun.result?.searchUsed) > 0 || targetRun.result?.status === "error") {\n    state = automationRecordActivity(state, "target", targetRun.result, now, "scheduled");\n    await writeAutomationState(env.SCOUT_DATA, state);'''
assert old in s
s=s.replace(old,new,1)

old='''  await writeAutomationState(env.SCOUT_DATA, state);\n  return { kind: "collection", ...collectionRun.result };'''
new='''  state = automationRecordActivity(state, "collection", collectionRun.result, now, "scheduled");\n  await writeAutomationState(env.SCOUT_DATA, state);\n  return { kind: "collection", ...collectionRun.result };'''
assert old in s
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# UI: add a human-readable activity stream beneath the safe runner controls.
p=Path('automation-runner-ui.js')
u=p.read_text(encoding='utf-8')
old='''.automation-alert strong{font-size:13px}.automation-alert-meta{font-size:10px;color:var(--muted);margin-top:4px;line-height:1.45}.automation-alert a{display:inline-block;margin-top:7px;color:var(--gold);font-size:11px;font-weight:900;text-decoration:none}.automation-alert-empty{font-size:11px;color:var(--muted);padding:8px 0}'''
new=old+'''.automation-activity{display:grid;gap:8px;margin-top:10px}.automation-activity-item{border:1px solid var(--line);border-radius:13px;padding:11px 12px;background:rgba(0,0,0,.08)}.automation-activity-top{display:flex;gap:8px;align-items:center;justify-content:space-between}.automation-activity-item strong{font-size:12px}.automation-activity-kind{font-size:9px;font-weight:950;letter-spacing:.06em;color:var(--gold)}.automation-activity-meta{font-size:10px;color:var(--muted);margin-top:4px;line-height:1.45}.automation-activity-summary{font-size:11px;margin-top:5px;line-height:1.5;color:var(--text)}'''
assert old in u
u=u.replace(old,new,1)

old='''<div class="section-eyebrow" style="margin-top:16px">RECENT TARGET ALERTS</div><div class="automation-alerts" id="automationAlerts"><div class="automation-alert-empty">No target alerts yet.</div></div>'''
new='''<div class="section-eyebrow" style="margin-top:16px">AUTOMATION ACTIVITY</div><div class="automation-sub">Only real marketplace searches appear here. Zero-search wake-ups, cache hits, pacing skips, and catalog syncs stay silent.</div><div class="automation-activity" id="automationActivity"><div class="automation-alert-empty">No automatic marketplace searches recorded yet.</div></div><div class="section-eyebrow" style="margin-top:16px">RECENT TARGET ALERTS</div><div class="automation-alerts" id="automationAlerts"><div class="automation-alert-empty">No target alerts yet.</div></div>'''
assert old in u
u=u.replace(old,new,1)

marker='''  function renderAlerts(rows){'''
assert marker in u
render=r'''  function renderActivity(rows){const el=document.getElementById("automationActivity");if(!el)return;const activity=(Array.isArray(rows)?rows:[]).slice().reverse().slice(0,12);if(!activity.length){el.innerHTML='<div class="automation-alert-empty">No automatic marketplace searches recorded yet.</div>';return;}el.innerHTML=activity.map(a=>{const kind=a.kind==="collection"?"COLLECTION VALUE":"TARGET";const icon=a.outcome==="error"?"⚠️":(a.outcome==="deal-found"?"🎯":(a.outcome==="value-updated"?"📈":"🔎"));const source=a.source==="manual-test"?"Safety test":"Scheduled";return `<div class="automation-activity-item"><div class="automation-activity-top"><strong>${icon} ${esc(a.player||"Scout search")}</strong><span class="automation-activity-kind">${kind}</span></div><div class="automation-activity-meta">${source} · ${esc(a.searchUsed||1)} search${Number(a.searchUsed||1)===1?"":"es"}${a.at?" · "+esc(new Date(a.at).toLocaleString()):""}</div><div class="automation-activity-summary">${esc(a.summary||"Search completed.")}</div></div>`;}).join("");}
'''
u=u.replace(marker,render+marker,1)

old='''if(res.ok&&data.ok)renderAlerts(data.alerts||[]);'''
new='''if(res.ok&&data.ok){renderAlerts(data.alerts||[]);renderActivity(data.activity||[]);}'''
assert old in u
u=u.replace(old,new,1)

old='''}renderAlerts(data.alerts||[]);document.getElementById("automationReload")?.click();'''
new='''}renderAlerts(data.alerts||[]);renderActivity(data.activity||[]);document.getElementById("automationReload")?.click();'''
assert old in u
u=u.replace(old,new,1)

old=''';}document.getElementById("automationReload")?.click();}catch(err){if(out){out.className="automation-runner-result bad";out.textContent="Safe collection runner could not complete: "+(err.message||"unknown error");}}finally{if(btn)btn.disabled=false;}}'''
new=''';}renderActivity(data.activity||[]);document.getElementById("automationReload")?.click();}catch(err){if(out){out.className="automation-runner-result bad";out.textContent="Safe collection runner could not complete: "+(err.message||"unknown error");}}finally{if(btn)btn.disabled=false;}}'''
assert old in u
u=u.replace(old,new,1)
p.write_text(u,encoding='utf-8')

# Bump version assertions across regression tests.
for test in Path('tests').glob('*.test.cjs'):
    t=test.read_text(encoding='utf-8')
    t=t.replace('3\\.32\\.0','3\\.33\\.0')
    t=t.replace('"3.32.0"','"3.33.0"')
    t=t.replace("'3.32.0'","'3.33.0'")
    test.write_text(t,encoding='utf-8')

# Focused activity-log regression test.
Path('tests/automation-activity.test.cjs').write_text(r'''const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const worker=fs.readFileSync('src/index.js','utf8');
const ui=fs.readFileSync('automation-runner-ui.js','utf8');
assert.match(worker,/const VERSION = "3\.33\.0"/);
assert.match(worker,/activity: Array\.isArray\(raw\?\.activity\)/);
assert.match(worker,/activity: normalized\.activity\.slice\(-30\)/);
assert.match(worker,/automationRecordActivity\(state, "target", targetRun\.result, now, "scheduled"\)/);
assert.match(worker,/automationRecordActivity\(state, "collection", collectionRun\.result, now, "scheduled"\)/);
assert.match(ui,/AUTOMATION ACTIVITY/);
assert.match(ui,/Zero-search wake-ups, cache hits, pacing skips, and catalog syncs stay silent/);

const context={console,URL,URLSearchParams,Request,Response,Headers,AbortController,fetch:async()=>{throw new Error('network not expected')},setTimeout,clearTimeout,TextEncoder,TextDecoder,caches:{default:{match:async()=>null,put:async()=>{}}}};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(worker.replace('export default','const workerDefault =')+`\nglobalThis.activityApi={automationRecordActivity};`,context,{filename:'src/index.js'});
const base={settings:{monthlySerpCap:30,targetMonitoringEnabled:true,targetCadenceDays:7,collectionRefreshEnabled:true,collectionCardsPerMonth:10},usage:{period:new Date().toISOString().slice(0,7),serpSuccessful:2,cardApiRequests:0,apifyRuns:0,collectionCardsChecked:0},alerts:[],activity:[],targetChecks:{},collectionChecks:{},collectionCooldownUntil:''};
const now=new Date('2026-08-28T16:15:00.000Z');
let state=context.activityApi.automationRecordActivity(base,'collection',{status:'skipped',searchUsed:0,message:'paced'},now,'scheduled');
assert.equal(state.activity.length,0,'zero-search scheduler work must stay silent');
state=context.activityApi.automationRecordActivity(state,'target',{status:'checked',searchUsed:1,target:{name:'Orlando Cepeda',maxPrice:30},alert:{delivered:11.38,maxPrice:30,listingUrl:'https://example.test'}},now,'scheduled');
assert.equal(state.activity.length,1);
assert.equal(state.activity[0].outcome,'deal-found');
assert.match(state.activity[0].summary,/\$11\.38/);
state=context.activityApi.automationRecordActivity(state,'collection',{status:'checked',searchUsed:1,saved:true,persisted:true,card:{name:'Carl Yastrzemski'},valuation:{median:139.99,used:3}},now,'scheduled');
assert.equal(state.activity.length,2);
assert.equal(state.activity[1].outcome,'value-updated');
assert.equal(state.activity[1].updated,true);
assert.match(state.activity[1].summary,/\$139\.99/);
state=context.activityApi.automationRecordActivity(state,'collection',{status:'error',searchUsed:1,card:{name:'Mickey Mantle'},message:'SerpApi timed out.'},now,'scheduled');
assert.equal(state.activity.length,3);
assert.equal(state.activity[2].outcome,'error');
assert.match(state.activity[2].summary,/timed out/i);
console.log('Automation activity tests passed.');
''',encoding='utf-8')
