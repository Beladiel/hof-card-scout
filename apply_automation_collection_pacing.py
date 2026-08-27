from pathlib import Path
import re

# Worker hardening
p=Path('src/index.js')
s=p.read_text(encoding='utf-8')
assert 'const VERSION = "3.30.0";' in s
s=s.replace('const VERSION = "3.30.0";','const VERSION = "3.31.0";',1)

anchor='function automationCollectionKey(entry) {'
assert anchor in s
pacing='''const AUTOMATION_COLLECTION_MIN_GAP_MS = 3 * 24 * 60 * 60 * 1000;\nconst AUTOMATION_COLLECTION_TIMEOUT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;\n\nfunction automationLatestCollectionCheckMs(state) {\n  const checks = state?.collectionChecks && typeof state.collectionChecks === "object" ? state.collectionChecks : {};\n  const stamps = Object.values(checks).map(v => Date.parse(v || "") || 0);\n  return stamps.length ? Math.max(0, ...stamps) : 0;\n}\n\nfunction automationCollectionNextAllowedAt(state, now=new Date()) {\n  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();\n  const latest = automationLatestCollectionCheckMs(state);\n  const pacedUntil = latest ? latest + AUTOMATION_COLLECTION_MIN_GAP_MS : 0;\n  const cooldownUntil = Date.parse(state?.collectionCooldownUntil || "") || 0;\n  const next = Math.max(pacedUntil, cooldownUntil);\n  return Number.isFinite(nowMs) && next > nowMs ? new Date(next) : null;\n}\n\n'''
s=s.replace(anchor,pacing+anchor,1)

collection_checks='''    collectionChecks: raw?.collectionChecks && typeof raw.collectionChecks === "object" && !Array.isArray(raw.collectionChecks) ? raw.collectionChecks : {},\n    lastRunAt: raw?.lastRunAt || "",'''
collection_checks_new='''    collectionChecks: raw?.collectionChecks && typeof raw.collectionChecks === "object" && !Array.isArray(raw.collectionChecks) ? raw.collectionChecks : {},\n    collectionCooldownUntil: raw?.collectionCooldownUntil || "",\n    lastRunAt: raw?.lastRunAt || "",'''
assert collection_checks in s
s=s.replace(collection_checks,collection_checks_new,1)

run_anchor='''  if (!state.settings.collectionRefreshEnabled) {\n    return { state, result: { status: "skipped", searchUsed: 0, message: "Collection-value rotation is turned off in your guardrails." } };\n  }\n  const monthlyLimit = Math.max(0, Number(state.settings.collectionCardsPerMonth) || 0);'''
run_new='''  if (!state.settings.collectionRefreshEnabled) {\n    return { state, result: { status: "skipped", searchUsed: 0, message: "Collection-value rotation is turned off in your guardrails." } };\n  }\n  const nextAllowedAt = automationCollectionNextAllowedAt(state, now);\n  if (nextAllowedAt) {\n    return { state, result: { status: "skipped", searchUsed: 0, nextEligibleAt: nextAllowedAt.toISOString(), message: `Collection-value automation is pacing itself to protect your search budget. Next eligible check: ${nextAllowedAt.toISOString()}.` } };\n  }\n  const monthlyLimit = Math.max(0, Number(state.settings.collectionCardsPerMonth) || 0);'''
assert run_anchor in s
s=s.replace(run_anchor,run_new,1)

success_anchor='''    const message = saved\n      ? `COLLECTION VALUE READY — ${entry.name} has ${used} reliable sold comp${used === 1 ? "" : "s"}.`\n      : `VALUE NOT SAVED — only ${used} reliable sold comp${used === 1 ? "" : "s"}; Scout needs at least 2 before adding collection history.`;\n    state.updatedAt = now.toISOString();'''
success_new='''    const message = saved\n      ? `COLLECTION VALUE READY — ${entry.name} has ${used} reliable sold comp${used === 1 ? "" : "s"}.`\n      : `VALUE NOT SAVED — only ${used} reliable sold comp${used === 1 ? "" : "s"}; Scout needs at least 2 before adding collection history.`;\n    state.collectionCooldownUntil = "";\n    state.updatedAt = now.toISOString();'''
assert success_anchor in s
s=s.replace(success_anchor,success_new,1)

catch_anchor='''  } catch (err) {\n    state.updatedAt = now.toISOString();\n    return {\n      state,\n      result: {\n        status: "error",\n        searchUsed,\n        cacheHit,\n        saved: false,\n        checkedAt: now.toISOString(),\n        card: { name: entry.name, cardKey: entry.cardKey },\n        message: err?.message || "Protected collection-value search failed."\n      }\n    };\n  }'''
catch_new='''  } catch (err) {\n    const rawMessage = err?.message || "Protected collection-value search failed.";\n    const timeoutLike = /timed out|timeout|aborted/i.test(rawMessage);\n    if (timeoutLike) {\n      state.collectionCooldownUntil = new Date(now.getTime() + AUTOMATION_COLLECTION_TIMEOUT_COOLDOWN_MS).toISOString();\n    }\n    state.updatedAt = now.toISOString();\n    return {\n      state,\n      result: {\n        status: "error",\n        searchUsed,\n        cacheHit,\n        saved: false,\n        checkedAt: now.toISOString(),\n        cooldownUntil: timeoutLike ? state.collectionCooldownUntil : null,\n        card: { name: entry.name, cardKey: entry.cardKey },\n        message: timeoutLike\n          ? `SerpApi timed out. Scout stopped after this one search and paused collection-value automation for 7 days to protect your allowance.`\n          : rawMessage\n      }\n    };\n  }'''
assert catch_anchor in s
s=s.replace(catch_anchor,catch_new,1)
p.write_text(s,encoding='utf-8')

# UI: do not show a success checkmark for a timeout/error.
p=Path('automation-runner-ui.js')
u=p.read_text(encoding='utf-8')
old='''else if(r.status==="checked")out.textContent=`✓ ${r.searchUsed||0} search${Number(r.searchUsed||0)===1?"":"es"} used. ${r.card?.name||"Collection card"} checked. ${r.message||"Value was not saved."}`;else out.textContent=`✓ ${r.searchUsed||0} searches used. ${r.message||"No eligible collection card needed a check."}`;'''
new='''else if(r.status==="checked")out.textContent=`✓ ${r.searchUsed||0} search${Number(r.searchUsed||0)===1?"":"es"} used. ${r.card?.name||"Collection card"} checked. ${r.message||"Value was not saved."}`;else if(r.status==="error")out.textContent=`⚠ ${r.searchUsed||0} search${Number(r.searchUsed||0)===1?"":"es"} used. ${r.message||"Protected collection-value check failed."}`;else out.textContent=`✓ ${r.searchUsed||0} searches used. ${r.message||"No eligible collection card needed a check."}`;'''
assert old in u
u=u.replace(old,new,1)
p.write_text(u,encoding='utf-8')

# Regression test upgrades
for test in Path('tests').glob('*.test.cjs'):
    t=test.read_text(encoding='utf-8')
    t=t.replace('3\\.30\\.0','3\\.31\\.0')
    test.write_text(t,encoding='utf-8')

p=Path('tests/automation-collection-runner.test.cjs')
t=p.read_text(encoding='utf-8')
t=t.replace("assert.match(worker,/collectionCardsChecked/,'collection rotation must have its own monthly card counter');", "assert.match(worker,/collectionCardsChecked/,'collection rotation must have its own monthly card counter');\nassert.match(worker,/AUTOMATION_COLLECTION_MIN_GAP_MS = 3 \\* 24 \\* 60 \\* 60 \\* 1000/,'collection checks must be spaced by at least three days');\nassert.match(worker,/AUTOMATION_COLLECTION_TIMEOUT_COOLDOWN_MS = 7 \\* 24 \\* 60 \\* 60 \\* 1000/,'timeouts must trigger a seven-day collection cooldown');\nassert.match(worker,/collectionCooldownUntil/,'timeout cooldown must persist in automation state');")
t=t.replace("const baseState={settings:{monthlySerpCap:30,targetMonitoringEnabled:true,targetCadenceDays:7,collectionRefreshEnabled:true,collectionCardsPerMonth:10},usage:{period,serpSuccessful:0,cardApiRequests:0,apifyRuns:0,collectionCardsChecked:0},alerts:[],targetChecks:{},collectionChecks:{}};", "const baseState={settings:{monthlySerpCap:30,targetMonitoringEnabled:true,targetCadenceDays:7,collectionRefreshEnabled:true,collectionCardsPerMonth:10},usage:{period,serpSuccessful:0,cardApiRequests:0,apifyRuns:0,collectionCardsChecked:0},alerts:[],targetChecks:{},collectionChecks:{},collectionCooldownUntil:''};")
t=t.replace("const fakeFetch=async()=>{\n    fetchCalls.push(1);", "const fakeFetch=async()=>{\n    fetchCalls.push(1);\n    if(cacheMode==='timeout')throw new Error('SerpApi search timed out after 10s.');")
insert='''  {\n    const {context,fetchCalls}=makeContext('miss');\n    const recentState={...baseState,usage:{...baseState.usage},collectionChecks:{'official|jeff bagwell|bagwell-test':new Date().toISOString()}};\n    const run=await context.collectionRunnerApi.runOneAutomationCollectionCheck({SERPAPI_KEY:'private-key'},recentState,catalog,new Date());\n    assert.equal(fetchCalls.length,0,'recent collection attempt must trigger pacing with zero additional searches');\n    assert.equal(run.result.searchUsed,0);\n    assert.equal(run.result.status,'skipped');\n    assert.match(run.result.message,/pacing itself/i);\n  }\n  {\n    const {context,fetchCalls}=makeContext('timeout');\n    const run=await context.collectionRunnerApi.runOneAutomationCollectionCheck({SERPAPI_KEY:'private-key'},baseState,catalog,new Date());\n    assert.equal(fetchCalls.length,1,'timeout path must still stop after the one allowed SerpApi request');\n    assert.equal(run.result.searchUsed,1);\n    assert.equal(run.result.status,'error');\n    assert.ok(run.state.collectionCooldownUntil,'timeout must persist a cooldown');\n    assert.match(run.result.message,/paused collection-value automation for 7 days/i);\n  }\n'''
needle="  console.log('Safe collection automation runner tests passed.');"
assert needle in t
t=t.replace(needle,insert+needle,1)
p.write_text(t,encoding='utf-8')
