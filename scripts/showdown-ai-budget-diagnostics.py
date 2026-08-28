from pathlib import Path

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')

if 'const VERSION = "3.48.0";' not in worker:
    raise SystemExit('expected Worker v3.48.0')
if 'sealed:intel:v19:' not in worker:
    raise SystemExit('expected intelligence cache v19')

worker = worker.replace('const VERSION = "3.48.0";', 'const VERSION = "3.49.0";', 1)
worker = worker.replace('sealed:intel:v19:', 'sealed:intel:v20:', 1)

old_model = 'const SEALED_RIP_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";'
new_model = '''const SEALED_RIP_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";\nconst SEALED_SHOWDOWN_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";\n\nfunction sealedRipAiFailureInfo(...errors) {\n  const parts = [];\n  for (const err of errors.filter(Boolean)) {\n    for (const value of [err?.code, err?.name, err?.message, err?.cause?.code, err?.cause?.name, err?.cause?.message]) {\n      if (value !== undefined && value !== null && String(value).trim()) parts.push(String(value));\n    }\n    if (typeof err === "string") parts.push(err);\n  }\n  const raw = parts.join(" ").replace(/\\s+/g, " ").slice(0, 1200);\n  const code = (raw.match(/\\b(3006|3007|3008|3036|3040|5007|5035)\\b/) || [])[1] || "";\n  if (/3036|daily free allocation|free allocation|10,?000\\s+neurons|used up.*neurons/i.test(raw)) {\n    return { type: "daily_quota", code: code || "3036", message: "Scout found the research, but Cloudflare Workers AI has reached its daily inference allowance. The allowance resets at 00:00 UTC; the research itself was not lost." };\n  }\n  if (/3040|out of capacity/i.test(raw)) {\n    return { type: "capacity", code: code || "3040", message: "Scout found the research, but Cloudflare Workers AI is temporarily out of inference capacity. Try the same shelf again later; the search results themselves were not the problem." };\n  }\n  if (/3006|request too large|too large/i.test(raw)) {\n    return { type: "request_too_large", code: code || "3006", message: "Scout found the research, but the AI synthesis request was too large. Scout kept the product unranked rather than trimming evidence silently." };\n  }\n  if (/3007|3008|timeout|timed out|aborted/i.test(raw)) {\n    return { type: "timeout", code: code || "3007", message: "Scout found the research, but Cloudflare Workers AI timed out while synthesizing it. Try the same shelf again later." };\n  }\n  if (/syntaxerror|unexpected token|unexpected end|json/i.test(raw)) {\n    return { type: "malformed_json", code, message: "Scout found the research, but the AI returned malformed analysis twice. Scout left the product unranked rather than guessing." };\n  }\n  return { type: "unknown", code, message: `Scout found the research, but Cloudflare Workers AI failed during synthesis${code ? ` (error ${code})` : ""}. Scout left the product unranked rather than guessing.` };\n}\n'''
if old_model not in worker:
    raise SystemExit('sealed rip model anchor not found')
worker = worker.replace(old_model, new_model, 1)

run_anchor = 'env.AI.run(SEALED_RIP_MODEL,'
run_count = worker.count(run_anchor)
if run_count != 4:
    raise SystemExit(f'expected 4 rip AI calls, found {run_count}')
worker = worker.replace(run_anchor, 'env.AI.run(researchMode === "showdown" ? SEALED_SHOWDOWN_MODEL : SEALED_RIP_MODEL,')

prompt_old = '${evidenceSignals || evidenceForPrompt.slice(0, 12000) || "No compact authority evidence available."}'
prompt_new = '${String(evidenceSignals || evidenceForPrompt || "").slice(0, 10000) || "No compact authority evidence available."}'
prompt_count = worker.count(prompt_old)
if prompt_count < 2:
    raise SystemExit(f'expected authority prompt anchors, found {prompt_count}')
worker = worker.replace(prompt_old, prompt_new)

recovery_old = 'AUTHORITY EVIDENCE:\\\n${evidenceSignals}`;'
recovery_new = 'AUTHORITY EVIDENCE:\\\n${String(evidenceSignals || "").slice(0, 9000)}`;'
if recovery_old not in worker:
    raise SystemExit('authority recovery evidence anchor not found')
worker = worker.replace(recovery_old, recovery_new, 1)

price_old = 'PRICE-GUIDE EVIDENCE:\\\n${priceGuideSignals}`;'
price_new = 'PRICE-GUIDE EVIDENCE:\\\n${String(priceGuideSignals || "").slice(0, 9000)}`;'
if price_old not in worker:
    raise SystemExit('price-guide recovery evidence anchor not found')
worker = worker.replace(price_old, price_new, 1)

failure_old = 'return json({ ok: false, error: "rip_analysis_failed", message: "Scout found the research but could not finish the rip-quality analysis right now.", failureStage: "synthesis", lanes: failureLanes, researchMix: { ...researchMix, synthesisRetryUsed }, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);'
failure_new = '''const aiFailure = sealedRipAiFailureInfo(retryErr, err);\n          return json({ ok: false, error: "rip_analysis_failed", message: aiFailure.message, aiFailure, failureStage: "synthesis", lanes: failureLanes, researchMix: { ...researchMix, synthesisRetryUsed, synthesisModel: researchMode === "showdown" ? SEALED_SHOWDOWN_MODEL : SEALED_RIP_MODEL, synthesisFailure: aiFailure.type }, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);'''
if failure_old not in worker:
    raise SystemExit('synthesis failure response anchor not found')
worker = worker.replace(failure_old, failure_new, 1)

success_old = 'synthesisMode: researchMode === "showdown" ? "json_object_with_plain_retry" : "json_schema"'
success_new = 'synthesisMode: researchMode === "showdown" ? "json_object_with_plain_retry" : "json_schema", synthesisModel: researchMode === "showdown" ? SEALED_SHOWDOWN_MODEL : SEALED_RIP_MODEL'
if success_old not in worker:
    raise SystemExit('success synthesis diagnostics anchor not found')
worker = worker.replace(success_old, success_new, 1)

worker_path.write_text(worker, encoding='utf-8')

# Keep the version/cache assertions in the focused Sealed Product Scout tests current.
for test_path in [
    Path('tests/sealed-product-vision.test.cjs'),
    Path('tests/showdown-research-reliability.test.cjs'),
    Path('tests/showdown-json-reliability.test.cjs'),
]:
    text = test_path.read_text(encoding='utf-8')
    text = text.replace('3.48.0', '3.49.0')
    text = text.replace('3\\.48\\.0', '3\\.49\\.0')
    text = text.replace('v19:', 'v20:')
    test_path.write_text(text, encoding='utf-8')

Path('tests/showdown-ai-budget.test.cjs').write_text(r'''const fs=require('fs');
const assert=require('assert');
const worker=fs.readFileSync('src/index.js','utf8');

assert.ok(worker.includes('const VERSION = "3.49.0";'));
assert.ok(worker.includes('sealed:intel:v20:'));
assert.ok(worker.includes('const SEALED_SHOWDOWN_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";'), 'Showdown must use the cheaper fast 8B model');
assert.ok(worker.includes('researchMode === "showdown" ? SEALED_SHOWDOWN_MODEL : SEALED_RIP_MODEL'), 'AI model selection must be mode-specific');
assert.ok(worker.includes('function sealedRipAiFailureInfo'), 'AI synthesis failures must be classified safely');
assert.ok(worker.includes('daily_quota') && worker.includes('00:00 UTC'), 'daily Workers AI quota failures must be explained to the user');
assert.ok(worker.includes('out of inference capacity'), 'capacity failures must be distinguished from evidence failures');
assert.ok(worker.includes('slice(0, 10000)'), 'Showdown authority prompt evidence must be capped tightly');
assert.ok(worker.includes('slice(0, 9000)'), 'recovery evidence must be capped tightly');
assert.ok(worker.includes('synthesisModel: researchMode === "showdown" ? SEALED_SHOWDOWN_MODEL : SEALED_RIP_MODEL'), 'responses must expose which synthesis model was used');
assert.ok(worker.includes('synthesisFailure: aiFailure.type'), 'failed responses must expose a safe failure class');
assert.ok(worker.includes('message: aiFailure.message'), 'the phone must receive a useful safe synthesis failure message');
console.log('Showdown AI budget/diagnostic tests passed.');
''', encoding='utf-8')

print('Showdown AI budget/diagnostic patch applied.')
