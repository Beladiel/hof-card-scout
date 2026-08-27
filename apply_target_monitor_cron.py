from pathlib import Path

# Worker: enable scheduled saved-target monitoring only.
p=Path('src/index.js')
s=p.read_text(encoding='utf-8')
assert 'const VERSION = "3.28.0";' in s
s=s.replace('const VERSION = "3.28.0";','const VERSION = "3.29.0";',1)

old_choose='''function automationChooseTarget(catalog, state) {\n  const targets = automationEligibleTargets(catalog);\n  if (!targets.length) return null;\n  const checks = state?.targetChecks && typeof state.targetChecks === "object" ? state.targetChecks : {};\n  targets.sort((a,b) => {\n    const at = Date.parse(checks[automationTargetKey(a)] || "") || 0;\n    const bt = Date.parse(checks[automationTargetKey(b)] || "") || 0;\n    return at - bt || a.name.localeCompare(b.name);\n  });\n  return targets[0];\n}'''
new_choose='''function automationChooseTarget(catalog, state, options={}) {\n  let targets = automationEligibleTargets(catalog);\n  if (!targets.length) return null;\n  const checks = state?.targetChecks && typeof state.targetChecks === "object" ? state.targetChecks : {};\n  if (options?.dueOnly) {\n    const now = options?.now instanceof Date ? options.now : new Date(options?.now || Date.now());\n    const cadenceDays = Math.max(1, Number(state?.settings?.targetCadenceDays) || 7);\n    const cadenceMs = cadenceDays * 24 * 60 * 60 * 1000;\n    targets = targets.filter(target => {\n      const last = Date.parse(checks[automationTargetKey(target)] || "") || 0;\n      return !last || now.getTime() - last >= cadenceMs;\n    });\n    if (!targets.length) return null;\n  }\n  targets.sort((a,b) => {\n    const at = Date.parse(checks[automationTargetKey(a)] || "") || 0;\n    const bt = Date.parse(checks[automationTargetKey(b)] || "") || 0;\n    return at - bt || a.name.localeCompare(b.name);\n  });\n  return targets[0];\n}'''
assert old_choose in s
s=s.replace(old_choose,new_choose,1)

old_run='''async function runOneAutomationTargetCheck(env, inputState, catalog, now=new Date()) {\n  let state = normalizeAutomationState(inputState || {});\n  if (!state.settings.targetMonitoringEnabled) return { state, result: { status: "skipped", searchUsed: 0, message: "Saved-target monitoring is turned off in your guardrails." } };\n  if (!env.SERPAPI_KEY) return { state, result: { status: "skipped", searchUsed: 0, message: "SerpApi is not configured, so Scout used zero searches." } };\n  const target = automationChooseTarget(catalog, state);\n  if (!target) return { state, result: { status: "skipped", searchUsed: 0, message: "No saved target has enough identity plus a maximum price for an automatic affordability check." } };'''
new_run='''async function runOneAutomationTargetCheck(env, inputState, catalog, now=new Date(), options={}) {\n  let state = normalizeAutomationState(inputState || {});\n  if (!state.settings.targetMonitoringEnabled) return { state, result: { status: "skipped", searchUsed: 0, message: "Saved-target monitoring is turned off in your guardrails." } };\n  if (!env.SERPAPI_KEY) return { state, result: { status: "skipped", searchUsed: 0, message: "SerpApi is not configured, so Scout used zero searches." } };\n  const target = automationChooseTarget(catalog, state, { dueOnly: Boolean(options?.dueOnly), now });\n  if (!target) return { state, result: { status: "skipped", searchUsed: 0, message: options?.dueOnly ? "No saved target is due yet. Scout used zero searches." : "No saved target has enough identity plus a maximum price for an automatic affordability check." } };'''
assert old_run in s
s=s.replace(old_run,new_run,1)

# Add a scheduled helper immediately after the one-search runner.
needle='''  state.updatedAt = now.toISOString();\n  return { state, result };\n}\n\nfunction json(body, status, cors) {'''
replacement='''  state.updatedAt = now.toISOString();\n  return { state, result };\n}\n\nasync function runScheduledTargetMonitor(env, now=new Date()) {\n  if (!env?.SCOUT_DATA) return { status: "skipped", searchUsed: 0, message: "SCOUT_DATA is not configured." };\n  let state = await readAutomationState(env.SCOUT_DATA);\n  const catalog = await readAutomationCatalog(env.SCOUT_DATA);\n  const run = await runOneAutomationTargetCheck(env, state, catalog, now, { dueOnly: true });\n  state = run.state;\n  await writeAutomationState(env.SCOUT_DATA, state);\n  return run.result;\n}\n\nfunction json(body, status, cors) {'''
assert needle in s
s=s.replace(needle,replacement,1)

# Public routes should report that only the target scheduler is live.
s=s.replace('runnerEnabled: false, ...automationPublicState(state), catalog: automationCatalogSummary(catalog)', 'runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: false, ...automationPublicState(state), catalog: automationCatalogSummary(catalog)',1)
s=s.replace('runnerEnabled: false, ...automationPublicState(next)', 'runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: false, ...automationPublicState(next)',1)
s=s.replace('runnerEnabled: false, result: run.result, ...automationPublicState(state), catalog: automationCatalogSummary(catalog)', 'runnerEnabled: true, targetRunnerEnabled: true, collectionRunnerEnabled: false, result: run.result, ...automationPublicState(state), catalog: automationCatalogSummary(catalog)',1)

# Update explanatory note if present.
s=s.replace('Background cron is not enabled yet; the one-search runner is available for an explicit safety test.', 'Saved-target monitoring is scheduled with the one-search guardrail. Collection-value rotation is still disabled.',1)

# Insert scheduled() into the export default object by matching its closing brace.
start=s.index('export default {')
open_pos=s.index('{', start)
depth=0
state='code'
i=open_pos
close_pos=None
while i < len(s):
    c=s[i]
    n=s[i+1] if i+1 < len(s) else ''
    if state=='code':
        if c=='"': state='double'
        elif c=="'": state='single'
        elif c=='`': state='template'
        elif c=='/' and n=='/': state='line'; i+=1
        elif c=='/' and n=='*': state='block'; i+=1
        elif c=='{': depth+=1
        elif c=='}':
            depth-=1
            if depth==0:
                close_pos=i
                break
    elif state=='double':
        if c=='\\': i+=1
        elif c=='"': state='code'
    elif state=='single':
        if c=='\\': i+=1
        elif c=="'": state='code'
    elif state=='template':
        if c=='\\': i+=1
        elif c=='`': state='code'
    elif state=='line':
        if c=='\n': state='code'
    elif state=='block':
        if c=='*' and n=='/': state='code'; i+=1
    i+=1
assert close_pos is not None
before=s[:close_pos]
after=s[close_pos:]
assert 'async scheduled(' not in before
trim=before.rstrip()
if trim.endswith('}'):
    before=trim + ',\n'
elif trim.endswith('},'):
    before=trim + '\n'
else:
    raise AssertionError('Unexpected export object ending before scheduled insertion')
scheduled='''  async scheduled(controller, env, ctx) {\n    const now = new Date(Number(controller?.scheduledTime) || Date.now());\n    const task = runScheduledTargetMonitor(env, now).catch(err => console.error("Scheduled target monitor failed", err));\n    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(task);\n    else await task;\n  },\n'''
s=before+scheduled+after
p.write_text(s,encoding='utf-8')

# Worker config: daily wake-up; due logic decides whether a search is spent.
p=Path('wrangler.jsonc')
s=p.read_text(encoding='utf-8')
assert '"triggers"' not in s
needle='''  "observability": {\n    "enabled": true\n  },'''
repl='''  "observability": {\n    "enabled": true\n  },\n  "triggers": {\n    "crons": ["15 16 * * *"]\n  },'''
assert needle in s
s=s.replace(needle,repl,1)
p.write_text(s,encoding='utf-8')

# App UI: reflect target-only scheduler state.
p=Path('automation-budget.js')
s=p.read_text(encoding='utf-8')
s=s.replace('chip.textContent=latestState.runnerEnabled?"BACKGROUND RUNNER ON":"GUARDRAILS ONLY";', 'chip.textContent=latestState.targetRunnerEnabled?"TARGET MONITOR ON":(latestState.runnerEnabled?"BACKGROUND RUNNER ON":"GUARDRAILS ONLY");',1)
s=s.replace('status.className="automation-status ok";status.textContent=data.runnerEnabled?"✓ Background automation is protected by this hard cap.":"✓ Search guardrails are stored on the Worker. No background searches are running yet.";', 'status.className="automation-status ok";status.textContent=data.targetRunnerEnabled?"✓ Saved-target monitoring is scheduled and protected by this hard cap. Collection rotation is still off.":(data.runnerEnabled?"✓ Background automation is protected by this hard cap.":"✓ Search guardrails are stored on the Worker. No background searches are running yet.");',1)
s=s.replace('below your ${settings.monthlySerpCap}-search cap.', 'at or below your ${settings.monthlySerpCap}-search cap.',1)
p.write_text(s,encoding='utf-8')

# Version-only regression pins.
for tp in Path('tests').glob('*.test.cjs'):
    t=tp.read_text(encoding='utf-8')
    t=t.replace('3\\.28\\.0','3\\.29\\.0').replace('3.28.0','3.29.0')
    tp.write_text(t,encoding='utf-8')
