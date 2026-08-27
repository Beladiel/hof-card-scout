from pathlib import Path
import re

# ---- Worker: enable target-priority + collection-value cron and persist scheduled values ----
p=Path('src/index.js')
s=p.read_text(encoding='utf-8')
assert 'const VERSION = "3.31.0";' in s
s=s.replace('const VERSION = "3.31.0";','const VERSION = "3.32.0";',1)

# Special history record already used by the browser inside playerUpdates.
const_anchor='const COLLECTION_KV_KEY = "collection:primary:v1";\n'
assert const_anchor in s
s=s.replace(const_anchor,const_anchor+'const COLLECTION_VALUE_HISTORY_META_KEY = "__scoutCollectionValueHistoryV1";\n',1)

# Turn collection runner on in public status responses.
s=s.replace('runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: false','runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: true')

# scheduled() now runs the combined target-priority scheduler.
old_sched='''  async scheduled(controller, env, ctx) {\n    const now = new Date(Number(controller?.scheduledTime) || Date.now());\n    const task = runScheduledTargetMonitor(env, now).catch(err => console.error("Scheduled target monitor failed", err));\n    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(task);\n    else await task;\n  },'''
new_sched='''  async scheduled(controller, env, ctx) {\n    const now = new Date(Number(controller?.scheduledTime) || Date.now());\n    const task = runScheduledAutomation(env, now).catch(err => console.error("Scheduled Scout automation failed", err));\n    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(task);\n    else await task;\n  },'''
assert old_sched in s
s=s.replace(old_sched,new_sched,1)

old_note='note: "Saved-target monitoring is scheduled with the one-search guardrail. Collection-value rotation is still disabled.",'
new_note='note: "Saved-target monitoring and paced collection-value rotation are scheduled under the same hard monthly search cap.",'
assert old_note in s
s=s.replace(old_note,new_note,1)

# Add catalog writer after reader.
reader='''async function readAutomationCatalog(kv) {\n  const raw = await kv.get(AUTOMATION_CATALOG_KEY, { type: "json" });\n  return normalizeAutomationCatalog(raw || {});\n}\n'''
writer='''async function readAutomationCatalog(kv) {\n  const raw = await kv.get(AUTOMATION_CATALOG_KEY, { type: "json" });\n  return normalizeAutomationCatalog(raw || {});\n}\n\nasync function writeAutomationCatalog(kv, catalog) {\n  const normalized = normalizeAutomationCatalog(catalog || {});\n  const serialized = JSON.stringify(normalized);\n  if (new TextEncoder().encode(serialized).byteLength > AUTOMATION_CATALOG_MAX_BYTES) {\n    throw new Error("Automation catalog is larger than Scout allows.");\n  }\n  await kv.put(AUTOMATION_CATALOG_KEY, serialized);\n  return normalized;\n}\n'''
assert reader in s
s=s.replace(reader,writer,1)

# Replace target-only scheduled helper with persistence helpers + combined scheduler.
old_helper='''async function runScheduledTargetMonitor(env, now=new Date()) {\n  if (!env?.SCOUT_DATA) return { status: "skipped", searchUsed: 0, message: "SCOUT_DATA is not configured." };\n  let state = await readAutomationState(env.SCOUT_DATA);\n  const catalog = await readAutomationCatalog(env.SCOUT_DATA);\n  const run = await runOneAutomationTargetCheck(env, state, catalog, now, { dueOnly: true });\n  state = run.state;\n  await writeAutomationState(env.SCOUT_DATA, state);\n  return run.result;\n}\n'''
assert old_helper in s
new_helper=r'''function automationCents(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function automationMergeCardHistory(history, snapshot, max=24) {
  const rows = (Array.isArray(history) ? history : [])
    .filter(x => x && x.at && x.cardKey && Number.isFinite(Number(x.value)))
    .map(x => ({ ...x, value: automationCents(x.value) }));
  const day = String(snapshot.at).slice(0, 10);
  const idx = rows.findIndex(x => x.cardKey === snapshot.cardKey && String(x.at).slice(0, 10) === day);
  if (idx >= 0) rows[idx] = snapshot;
  else rows.push(snapshot);
  rows.sort((a,b) => String(a.at).localeCompare(String(b.at)));
  return rows.slice(-Math.max(3, Number(max) || 24));
}

function automationMergeCollectionHistory(history, snapshot, max=48) {
  const rows = (Array.isArray(history) ? history : [])
    .filter(x => x && x.at && Number.isFinite(Number(x.value)) && Number(x.value) > 0)
    .map(x => ({ ...x, value: automationCents(x.value) }));
  const day = String(snapshot.at).slice(0, 10);
  const idx = rows.findIndex(x => String(x.at).slice(0, 10) === day);
  if (idx >= 0) rows[idx] = snapshot;
  else rows.push(snapshot);
  rows.sort((a,b) => String(a.at).localeCompare(String(b.at)));
  return rows.slice(-Math.max(3, Number(max) || 48));
}

function automationApplyValuationToCatalog(catalog, card, valuation, now) {
  const normalized = normalizeAutomationCatalog(catalog || {});
  const entry = normalized.official.find(x => x.name === card?.name && x.cardKey === card?.cardKey);
  if (!entry) return normalized;
  const at = now.toISOString();
  const snapshot = {
    at,
    value: automationCents(valuation?.median),
    low: automationCents(valuation?.low),
    high: automationCents(valuation?.high),
    comps: Math.max(0, Math.floor(Number(valuation?.used) || 0)),
    confidence: automationText(valuation?.confidence || "low", 40).toLowerCase(),
    cardKey: entry.cardKey,
  };
  entry.median = snapshot.value;
  entry.low = snapshot.low;
  entry.high = snapshot.high;
  entry.comps = snapshot.comps;
  entry.confidence = snapshot.confidence;
  entry.lastChecked = now.toLocaleDateString("en-US");
  entry.valuationUpdatedAt = at;
  entry.valuationCardKey = entry.cardKey;
  entry.valuationHistory = automationMergeCardHistory(entry.valuationHistory, snapshot, 24);
  normalized.generatedAt = at;
  return normalized;
}

function automationCollectionSummaryFromCatalog(catalog, playerUpdates={}) {
  const normalized = normalizeAutomationCatalog(catalog || {});
  const owned = normalized.official.filter(x => x.owned);
  const valued = owned.filter(x => x.cardKey && x.valuationCardKey === x.cardKey && Number.isFinite(Number(x.median)) && Number(x.median) > 0);
  let value = 0, matchedCostBasis = 0, matchedCount = 0;
  for (const entry of valued) {
    value += Number(entry.median);
    const paid = playerUpdates?.[entry.name]?.pricePaid;
    if (paid !== null && paid !== undefined && paid !== "" && Number.isFinite(Number(paid)) && Number(paid) >= 0) {
      matchedCostBasis += Number(paid);
      matchedCount++;
    }
  }
  return {
    ownedCount: owned.length,
    valuedCount: valued.length,
    coveragePct: owned.length ? Math.round((valued.length / owned.length) * 1000) / 10 : 0,
    estimatedValue: valued.length ? automationCents(value) : null,
    matchedCostBasis: matchedCount ? automationCents(matchedCostBasis) : null,
    matchedCount,
  };
}

async function automationPersistScheduledValuation(kv, catalog, result, now=new Date()) {
  if (!kv || !result?.saved || !result?.card?.name || !result?.card?.cardKey || !result?.valuation) {
    return { ok: false, catalog: normalizeAutomationCatalog(catalog || {}), reason: "nothing_to_persist" };
  }
  const at = now.toISOString();
  const updatedCatalog = automationApplyValuationToCatalog(catalog, result.card, result.valuation, now);
  const catalogEntry = updatedCatalog.official.find(x => x.name === result.card.name && x.cardKey === result.card.cardKey);
  if (!catalogEntry) return { ok: false, catalog: updatedCatalog, reason: "catalog_card_not_found" };

  const existing = await kv.get(COLLECTION_KV_KEY, { type: "json" });
  const record = existing && typeof existing === "object" ? existing : {};
  const playerUpdates = record.playerUpdates && typeof record.playerUpdates === "object" && !Array.isArray(record.playerUpdates)
    ? { ...record.playerUpdates }
    : {};
  const prior = playerUpdates[catalogEntry.name] && typeof playerUpdates[catalogEntry.name] === "object" && !Array.isArray(playerUpdates[catalogEntry.name])
    ? playerUpdates[catalogEntry.name]
    : {};
  const snapshot = catalogEntry.valuationHistory[catalogEntry.valuationHistory.length - 1];
  playerUpdates[catalogEntry.name] = {
    ...prior,
    median: catalogEntry.median,
    low: catalogEntry.low,
    high: catalogEntry.high,
    comps: catalogEntry.comps,
    confidence: catalogEntry.confidence,
    lastChecked: catalogEntry.lastChecked,
    valuationUpdatedAt: catalogEntry.valuationUpdatedAt,
    valuationCardKey: catalogEntry.valuationCardKey,
    valuationHistory: automationMergeCardHistory(prior.valuationHistory || catalogEntry.valuationHistory, snapshot, 24),
  };

  const summary = automationCollectionSummaryFromCatalog(updatedCatalog, playerUpdates);
  if (Number.isFinite(Number(summary.estimatedValue)) && Number(summary.estimatedValue) > 0 && summary.valuedCount > 0) {
    const meta = playerUpdates[COLLECTION_VALUE_HISTORY_META_KEY] && typeof playerUpdates[COLLECTION_VALUE_HISTORY_META_KEY] === "object" && !Array.isArray(playerUpdates[COLLECTION_VALUE_HISTORY_META_KEY])
      ? playerUpdates[COLLECTION_VALUE_HISTORY_META_KEY]
      : { schema: 1, history: [], updatedAt: "" };
    const collectionSnapshot = {
      at,
      value: summary.estimatedValue,
      valuedCount: summary.valuedCount,
      ownedCount: summary.ownedCount,
      coveragePct: summary.coveragePct,
      matchedCostBasis: summary.matchedCostBasis,
      matchedCount: summary.matchedCount,
    };
    playerUpdates[COLLECTION_VALUE_HISTORY_META_KEY] = {
      schema: 1,
      history: automationMergeCollectionHistory(meta.history, collectionSnapshot, 48),
      updatedAt: at,
    };
  }

  const nextRecord = {
    ...record,
    schema: Math.max(3, Number(record.schema) || 3),
    savedAt: at,
    clientUpdatedAt: at,
    appVersion: record.appVersion || "5.9.0",
    playerUpdates,
    monthlyPick: record.monthlyPick && typeof record.monthlyPick === "object" && !Array.isArray(record.monthlyPick) ? record.monthlyPick : null,
    futureHof: record.futureHof && typeof record.futureHof === "object" && !Array.isArray(record.futureHof) ? record.futureHof : null,
  };
  const serialized = JSON.stringify(nextRecord);
  if (new TextEncoder().encode(serialized).byteLength > COLLECTION_MAX_BYTES) {
    throw new Error("Scout cloud backup is larger than the allowed safety limit after an automatic valuation.");
  }

  await kv.put(COLLECTION_KV_KEY, serialized);
  await writeAutomationCatalog(kv, updatedCatalog);
  return { ok: true, catalog: updatedCatalog, savedAt: at, summary };
}

async function runScheduledAutomation(env, now=new Date()) {
  if (!env?.SCOUT_DATA) return { status: "skipped", searchUsed: 0, message: "SCOUT_DATA is not configured." };
  let state = await readAutomationState(env.SCOUT_DATA);
  let catalog = await readAutomationCatalog(env.SCOUT_DATA);

  // Targets always get first claim on a scheduler wake-up. If a target actually
  // spends the one allowed search, the collection side does not run that day.
  const targetRun = await runOneAutomationTargetCheck(env, state, catalog, now, { dueOnly: true });
  state = targetRun.state;
  if (Number(targetRun.result?.searchUsed) > 0 || targetRun.result?.status === "error") {
    await writeAutomationState(env.SCOUT_DATA, state);
    return { kind: "target", ...targetRun.result };
  }

  // No due target spent a search. The paced collection runner may now use
  // fresh cache for zero searches or one strict sold search maximum.
  const collectionRun = await runOneAutomationCollectionCheck(env, state, catalog, now);
  state = collectionRun.state;
  if (collectionRun.result?.saved) {
    try {
      const persisted = await automationPersistScheduledValuation(env.SCOUT_DATA, catalog, collectionRun.result, now);
      catalog = persisted.catalog || catalog;
      collectionRun.result.persisted = persisted.ok === true;
      collectionRun.result.collectionSummary = persisted.summary || null;
    } catch (err) {
      console.error("Scheduled collection valuation persistence failed", err);
      collectionRun.result.persisted = false;
      collectionRun.result.persistenceMessage = "Scout found a reliable value but could not save it to cloud history on this run.";
    }
  }
  await writeAutomationState(env.SCOUT_DATA, state);
  return { kind: "collection", ...collectionRun.result };
}
'''
s=s.replace(old_helper,new_helper,1)
p.write_text(s,encoding='utf-8')

# ---- Automation UI: reflect both runners being live ----
p=Path('automation-budget.js')
u=p.read_text(encoding='utf-8')
u=u.replace('Scout will get a hard monthly allowance before any background runner is turned on. Manual searches stay your choice and are not charged against this automation meter.','Scout uses a hard monthly allowance for background checks. Manual searches stay your choice and are not charged against this automation meter.',1)
old_chip='chip.textContent=latestState.targetRunnerEnabled?"TARGET MONITOR ON":(latestState.runnerEnabled?"BACKGROUND RUNNER ON":"GUARDRAILS ONLY");'
new_chip='chip.textContent=latestState.targetRunnerEnabled&&latestState.collectionRunnerEnabled?"TARGET + VALUE ON":(latestState.targetRunnerEnabled?"TARGET MONITOR ON":(latestState.runnerEnabled?"BACKGROUND RUNNER ON":"GUARDRAILS ONLY"));'
assert old_chip in u
u=u.replace(old_chip,new_chip,1)
old_status='status.className="automation-status ok";status.textContent=data.targetRunnerEnabled?"✓ Saved-target monitoring is scheduled and protected by this hard cap. Collection rotation is still off.":(data.runnerEnabled?"✓ Background automation is protected by this hard cap.":"✓ Search guardrails are stored on the Worker. No background searches are running yet.");'
new_status='status.className="automation-status ok";status.textContent=data.targetRunnerEnabled&&data.collectionRunnerEnabled?"✓ Target monitoring + paced collection-value rotation are scheduled and protected by this hard cap.":(data.targetRunnerEnabled?"✓ Saved-target monitoring is scheduled and protected by this hard cap. Collection rotation is still off.":(data.runnerEnabled?"✓ Background automation is protected by this hard cap.":"✓ Search guardrails are stored on the Worker. No background searches are running yet."));'
assert old_status in u
u=u.replace(old_status,new_status,1)
u=u.replace('<strong>Planned collection rotation</strong><br><span>Fast valuation only; one SerpApi search maximum per card, then stop at the monthly cap.</span>','<strong>Collection value rotation</strong><br><span>One strict sold search maximum per card, spaced at least 3 days apart; timeouts pause collection checks for 7 days.</span>',1)
p.write_text(u,encoding='utf-8')

# ---- Tests: bump versions and staged-runner expectations ----
for test in Path('tests').glob('*.test.cjs'):
    t=test.read_text(encoding='utf-8')
    t=t.replace('3\\.31\\.0','3\\.32\\.0')
    t=t.replace("'3.31.0'","'3.32.0'")
    t=t.replace('"3.31.0"','"3.32.0"')
    t=t.replace('collectionRunnerEnabled: false','collectionRunnerEnabled: true')
    t=t.replace('collection runner remains off','collection runner is enabled')
    t=t.replace('unattended collection rotation must remain off during this gate','unattended collection rotation is enabled only after the safe-runner gates')
    test.write_text(t,encoding='utf-8')

# Target cron regression now checks combined scheduler and target priority.
p=Path('tests/automation-target-cron.test.cjs')
p.write_text(r'''const assert=require('node:assert/strict');
const fs=require('node:fs');

const worker=fs.readFileSync('src/index.js','utf8');
const wrangler=fs.readFileSync('wrangler.jsonc','utf8');
const ui=fs.readFileSync('automation-budget.js','utf8');

assert.match(worker,/const VERSION = "3\.32\.0";/);
assert.match(worker,/async scheduled\(controller, env, ctx\)/,'Worker must expose a scheduled handler');
assert.match(worker,/runScheduledAutomation\(env, now\)/,'scheduled handler must use the combined protected scheduler');
assert.match(worker,/runOneAutomationTargetCheck\(env, state, catalog, now, \{ dueOnly: true \}\)/,'cron must give due targets first priority');
assert.match(worker,/Number\(targetRun\.result\?\.searchUsed\) > 0/,'a target search must stop the same cron wake-up before collection search');
assert.match(worker,/runOneAutomationCollectionCheck\(env, state, catalog, now\)/,'collection rotation may run only after target priority clears');
assert.match(worker,/cadenceDays \* 24 \* 60 \* 60 \* 1000/,'target cadence must be enforced before spending a search');
assert.match(worker,/No saved target is due yet\. Scout used zero searches\./,'not-due target wakeups must spend zero target searches');
assert.match(worker,/maxQueries: 1/,'target search remains limited to one query');
assert.match(worker,/runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: true/,'both protected runners must report enabled');
assert.match(worker,/AUTOMATION_COLLECTION_MIN_GAP_MS = 3 \* 24 \* 60 \* 60 \* 1000/,'collection runner retains three-day pacing');
assert.match(worker,/AUTOMATION_COLLECTION_TIMEOUT_COOLDOWN_MS = 7 \* 24 \* 60 \* 60 \* 1000/,'collection runner retains timeout cooldown');
assert.match(wrangler,/"crons"\s*:\s*\["15 16 \* \* \*"\]/,'daily cron wake-up must remain configured');
assert.match(ui,/TARGET \+ VALUE ON/,'UI should identify both protected runners');
assert.match(ui,/Target monitoring \+ paced collection-value rotation/,'UI should explain final automation state');

console.log('Combined automation scheduler tests passed.');
''',encoding='utf-8')

# New persistence-focused regression.
p=Path('tests/automation-collection-cron.test.cjs')
p.write_text(r'''const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const worker=fs.readFileSync('src/index.js','utf8');
assert.match(worker,/COLLECTION_VALUE_HISTORY_META_KEY = "__scoutCollectionValueHistoryV1"/);
assert.match(worker,/async function automationPersistScheduledValuation/);
assert.match(worker,/await kv\.put\(COLLECTION_KV_KEY, serialized\)/,'scheduled reliable values must persist to cloud collection data');
assert.match(worker,/await writeAutomationCatalog\(kv, updatedCatalog\)/,'automation catalog must also retain the new valuation');
assert.match(worker,/clientUpdatedAt: at/,'scheduled cloud change must be visible as newer to the browser sync');
assert.match(worker,/valuationCardKey: catalogEntry\.valuationCardKey/,'scheduled patch must remain tied to the exact representative card');
assert.match(worker,/automationMergeCollectionHistory\(meta\.history, collectionSnapshot, 48\)/,'scheduled valuation must build overall collection checkpoints');

const context={console,URL,URLSearchParams,Request,Response,Headers,AbortController,fetch:async()=>{throw new Error('network should not be needed')},setTimeout,clearTimeout,TextEncoder,TextDecoder,caches:{default:{match:async()=>null,put:async()=>{}}}};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(worker.replace('export default','const workerDefault =')+`\nglobalThis.cronPersistApi={automationPersistScheduledValuation};`,context,{filename:'src/index.js'});

const store=new Map();
const kv={
  async get(key,opts){const v=store.get(key);if(v==null)return null;return opts&&opts.type==='json'?JSON.parse(v):v;},
  async put(key,value){store.set(key,typeof value==='string'?value:JSON.stringify(value));}
};
const catalog={schema:1,generatedAt:new Date(0).toISOString(),official:[{kind:'official',name:'Jeff Bagwell',owned:true,incoming:false,cardYear:1991,set:'Topps Traded',cardNum:'4T',grader:'PSA',gradeCondition:'9',autograph:false,relic:false,serial:'',cardKey:'bagwell-test',median:null,low:null,high:null,comps:null,confidence:'',lastChecked:'',valuationUpdatedAt:'',valuationCardKey:'',valuationHistory:[],target:'',targetNotes:'',targetYear:null,targetSet:'',targetCardNum:'',targetGrader:'Any / Raw OK',targetGrade:'',targetAutoPreference:'No preference',targetMaxPrice:null,targetListingUrl:'',targetSource:'',targetUpdatedAt:''}],future:[]};
store.set('collection:primary:v1',JSON.stringify({schema:3,savedAt:'2026-08-01T00:00:00.000Z',clientUpdatedAt:'2026-08-01T00:00:00.000Z',appVersion:'5.9.0',playerUpdates:{'Jeff Bagwell':{pricePaid:8.5}},monthlyPick:null,futureHof:null}));
const result={saved:true,card:{name:'Jeff Bagwell',cardKey:'bagwell-test'},valuation:{median:15,low:14,high:16,used:2,confidence:'low'}};
const now=new Date('2026-08-31T16:15:00.000Z');

(async()=>{
  const persisted=await context.cronPersistApi.automationPersistScheduledValuation(kv,catalog,result,now);
  assert.equal(persisted.ok,true);
  const cloud=JSON.parse(store.get('collection:primary:v1'));
  const patch=cloud.playerUpdates['Jeff Bagwell'];
  assert.equal(patch.median,15);
  assert.equal(patch.valuationCardKey,'bagwell-test');
  assert.equal(patch.valuationHistory.length,1);
  assert.equal(patch.valuationHistory[0].value,15);
  assert.equal(patch.pricePaid,8.5,'scheduled valuation must preserve purchase history');
  const overall=cloud.playerUpdates['__scoutCollectionValueHistoryV1'];
  assert.ok(overall&&Array.isArray(overall.history));
  assert.equal(overall.history.length,1);
  assert.equal(overall.history[0].value,15);
  assert.equal(overall.history[0].matchedCostBasis,8.5);
  assert.equal(cloud.clientUpdatedAt,now.toISOString());
  const savedCatalog=JSON.parse(store.get('automation:catalog:v1'));
  assert.equal(savedCatalog.official[0].median,15);
  assert.equal(savedCatalog.official[0].valuationCardKey,'bagwell-test');
  console.log('Scheduled collection valuation persistence tests passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
''',encoding='utf-8')
