from pathlib import Path

worker_path=Path('src/index.js')
app_path=Path('sealed-product-scout.js')
index_path=Path('index.html')
worker=worker_path.read_text(encoding='utf-8')
app=app_path.read_text(encoding='utf-8')
index=index_path.read_text(encoding='utf-8')

if 'const VERSION = "3.49.0";' not in worker:
    raise SystemExit('expected Worker v3.49.0')
worker=worker.replace('const VERSION = "3.49.0";','const VERSION = "3.50.0";',1)

route_anchor='''    if (url.pathname === "/sealed/rip-quality" && request.method === "POST") {'''
health_route='''    if (url.pathname === "/sealed/ai-health" && request.method === "GET") {\n      const supplied = request.headers.get("X-Scout-Key") || "";\n      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {\n        return json({ ok: false, error: "unauthorized", message: "Scout access key is missing or invalid." }, 401, cors);\n      }\n      if (!env.AI) {\n        return json({ ok: false, error: "ai_unavailable", message: "Cloudflare Workers AI is not configured for Scout.", marketplaceSearchesUsed: 0, researchSearchesUsed: 0 }, 503, cors);\n      }\n      try {\n        await env.AI.run(SEALED_SHOWDOWN_MODEL, { prompt: "Reply exactly OK.", max_tokens: 4, temperature: 0 });\n        return json({ ok: true, version: VERSION, model: SEALED_SHOWDOWN_MODEL, checkedAt: new Date().toISOString(), marketplaceSearchesUsed: 0, researchSearchesUsed: 0 }, 200, cors);\n      } catch (err) {\n        const aiFailure = sealedRipAiFailureInfo(err);\n        return json({ ok: false, error: "ai_unavailable", message: aiFailure.message, aiFailure, model: SEALED_SHOWDOWN_MODEL, marketplaceSearchesUsed: 0, researchSearchesUsed: 0 }, 503, cors);\n      }\n    }\n\n'''+route_anchor
if route_anchor not in worker:
    raise SystemExit('rip-quality route anchor not found')
worker=worker.replace(route_anchor,health_route,1)
worker_path.write_text(worker,encoding='utf-8')

old_app='''    btn.disabled=true;btn.textContent="🏆 SCOUT IS RANKING THE SHELF…";status.className="sealed-status";\n    const endpoint=String(cfg.endpoint).replace(/\\/+$/,""),researched=[];let marketSearches=0,researchSearches=0;'''
if old_app not in app:
    old_app='''    btn.disabled=true;btn.textContent="🏆 SCOUT IS RANKING THE SHELF…";status.className="sealed-status";\n    const endpoint=String(cfg.endpoint).replace(/\\/+$/,"\");const researched=[];let marketSearches=0,researchSearches=0;'''
new_app='''    btn.disabled=true;btn.textContent="🏆 SCOUT IS RANKING THE SHELF…";status.className="sealed-status";\n    const endpoint=String(cfg.endpoint).replace(/\\/+$/,"" );\n    status.textContent="Checking Scout's AI research engine before spending any searches…";\n    try{\n      const healthRes=await fetch(`${endpoint}/sealed/ai-health`,{headers:{"X-Scout-Key":cfg.accessKey}});\n      const healthData=await healthRes.json().catch(()=>({}));\n      if(!healthRes.ok||!healthData.ok){\n        status.className="sealed-status warn";\n        status.textContent=`${healthData.message||"Scout's AI synthesis service is unavailable right now."} No marketplace or product-research searches were used.`;\n        btn.disabled=false;btn.textContent="🏆 RANK MY SHELF";return;\n      }\n    }catch(err){\n      status.className="sealed-status warn";\n      status.textContent="Scout could not reach the AI health check. No marketplace or product-research searches were used.";\n      btn.disabled=false;btn.textContent="🏆 RANK MY SHELF";return;\n    }\n    const researched=[];let marketSearches=0,researchSearches=0;'''
if old_app not in app:
    raise SystemExit('Showdown run anchor not found')
app=app.replace(old_app,new_app,1)
app_path.write_text(app,encoding='utf-8')

if 'sealed-product-scout.js?v=6.5.3' not in index:
    raise SystemExit('frontend cache-bust anchor not found')
index=index.replace('sealed-product-scout.js?v=6.5.3','sealed-product-scout.js?v=6.5.4')
index_path.write_text(index,encoding='utf-8')

for test_path in [Path('tests/sealed-product-vision.test.cjs'),Path('tests/showdown-research-reliability.test.cjs'),Path('tests/showdown-json-reliability.test.cjs'),Path('tests/showdown-ai-budget.test.cjs')]:
    if not test_path.exists():
        continue
    text=test_path.read_text(encoding='utf-8')
    text=text.replace('3.49.0','3.50.0').replace('3\\.49\\.0','3\\.50\\.0').replace('6.5.3','6.5.4').replace('6\\.5\\.3','6\\.5\\.4')
    test_path.write_text(text,encoding='utf-8')

Path('tests/showdown-ai-health.test.cjs').write_text(r'''const fs=require('fs');
const assert=require('assert');
const worker=fs.readFileSync('src/index.js','utf8');
const app=fs.readFileSync('sealed-product-scout.js','utf8');
const index=fs.readFileSync('index.html','utf8');
assert.ok(worker.includes('const VERSION = "3.50.0";'));
assert.ok(worker.includes('url.pathname === "/sealed/ai-health"'), 'Worker must expose a Showdown AI health endpoint');
assert.ok(worker.includes('prompt: "Reply exactly OK."') && worker.includes('max_tokens: 4'), 'health probe must be tiny');
const healthStart=worker.indexOf('url.pathname === "/sealed/ai-health"');
const healthEnd=worker.indexOf('url.pathname === "/sealed/rip-quality"',healthStart);
const health=worker.slice(healthStart,healthEnd);
assert.ok(healthStart>=0&&healthEnd>healthStart,'AI health route must precede rip-quality');
assert.ok(health.includes('marketplaceSearchesUsed: 0')&&health.includes('researchSearchesUsed: 0'),'health check must spend zero searches');
assert.ok(health.includes('sealedRipAiFailureInfo(err)'),'health failures must use safe typed diagnostics');
assert.ok(app.includes('/sealed/ai-health'),'Showdown must check AI health before product research');
const appHealth=app.indexOf('/sealed/ai-health');
const appValue=app.indexOf('/sealed/value-check',appHealth);
assert.ok(appHealth>=0&&appValue>appHealth,'AI health check must occur before the first market/product research call');
assert.ok(app.includes('No marketplace or product-research searches were used.'),'health failure must clearly promise zero search spend');
assert.ok(index.includes('sealed-product-scout.js?v=6.5.4'),'frontend cache-bust must advance');
console.log('Showdown AI health tests passed.');
''',encoding='utf-8')

print('Showdown AI health patch applied.')
