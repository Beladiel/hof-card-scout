from pathlib import Path

worker_path = Path('src/index.js')
test_path = Path('tests/showdown-json-reliability.test.cjs')
worker = worker_path.read_text(encoding='utf-8')

if 'const VERSION = "3.47.0";' not in worker:
    raise SystemExit('expected Worker v3.47.0')
if 'sealed:intel:v18:' not in worker:
    raise SystemExit('expected intelligence cache v18')
worker = worker.replace('const VERSION = "3.47.0";', 'const VERSION = "3.48.0";', 1)
worker = worker.replace('sealed:intel:v18:', 'sealed:intel:v19:', 1)

old_prompt = '''      const activeSynthesisSchema = researchMode === "showdown" ? showdownSchema : schema;\n      const activePrimaryPrompt = researchMode === "showdown" ? showdownSynthesisPrompt : prompt;\n      const activeRetryPrompt = researchMode === "showdown" ? showdownSynthesisPrompt : compactSynthesisPrompt;\n      let aiObject;\n      let synthesisRetryUsed = false;\n      try {\n        const primaryRaw = await env.AI.run(SEALED_RIP_MODEL, {\n          prompt: activePrimaryPrompt,\n          max_tokens: researchMode === "showdown" ? 850 : 1400,\n          temperature: 0.1,\n          response_format: { type: "json_schema", json_schema: activeSynthesisSchema }\n        });\n        aiObject = sealedRipAiJson(primaryRaw);\n      } catch (err) {\n        console.warn("sealed rip primary synthesis/parse failed; trying compact authority-only retry", err);\n        synthesisRetryUsed = true;\n        try {\n          const retryRaw = await env.AI.run(SEALED_RIP_MODEL, {\n            prompt: activeRetryPrompt,\n            max_tokens: researchMode === "showdown" ? 750 : 1200,\n            temperature: 0,\n            response_format: { type: "json_schema", json_schema: activeSynthesisSchema }\n          });\n          aiObject = sealedRipAiJson(retryRaw);\n        } catch (retryErr) {\n'''
new_prompt = '''      const activeSynthesisSchema = researchMode === "showdown" ? showdownSchema : schema;\n      const activePrimaryPrompt = researchMode === "showdown" ? showdownSynthesisPrompt : prompt;\n      const showdownJsonInstruction = `Return ONE valid JSON object only. Required keys: qualitySummary, chaseScore, chaseEvidenceAvailable, chaseCards, pullScore, pullEvidenceAvailable, pullOdds, confidence. chaseCards and pullOdds must be arrays. confidence must be high, medium, or low. No markdown or commentary outside the JSON object.`;\n      const activeRetryPrompt = researchMode === "showdown" ? `${showdownSynthesisPrompt}\\n\\n${showdownJsonInstruction}` : compactSynthesisPrompt;\n      let aiObject;\n      let synthesisRetryUsed = false;\n      try {\n        const primaryOptions = {\n          prompt: researchMode === "showdown" ? `${activePrimaryPrompt}\\n\\n${showdownJsonInstruction}` : activePrimaryPrompt,\n          max_tokens: researchMode === "showdown" ? 850 : 1400,\n          temperature: 0.1,\n          response_format: researchMode === "showdown"\n            ? { type: "json_object" }\n            : { type: "json_schema", json_schema: activeSynthesisSchema }\n        };\n        const primaryRaw = await env.AI.run(SEALED_RIP_MODEL, primaryOptions);\n        aiObject = sealedRipAiJson(primaryRaw);\n      } catch (err) {\n        console.warn("sealed rip primary synthesis/parse failed; trying compact authority-only retry", err);\n        synthesisRetryUsed = true;\n        try {\n          const retryOptions = {\n            prompt: activeRetryPrompt,\n            max_tokens: researchMode === "showdown" ? 750 : 1200,\n            temperature: 0,\n          };\n          // If Showdown JSON mode itself fails, the single retry deliberately avoids\n          // response_format entirely and relies on the explicit JSON-only instruction\n          // plus sealedRipAiJson(). This prevents repeating the same provider failure.\n          if (researchMode !== "showdown") {\n            retryOptions.response_format = { type: "json_schema", json_schema: activeSynthesisSchema };\n          }\n          const retryRaw = await env.AI.run(SEALED_RIP_MODEL, retryOptions);\n          aiObject = sealedRipAiJson(retryRaw);\n        } catch (retryErr) {\n'''
if old_prompt not in worker:
    raise SystemExit('synthesis block anchor not found')
worker = worker.replace(old_prompt, new_prompt, 1)

old_auth = '''            response_format: { type: "json_schema", json_schema: authorityRecoverySchema }\n'''
new_auth = '''            response_format: researchMode === "showdown"\n              ? { type: "json_object" }\n              : { type: "json_schema", json_schema: authorityRecoverySchema }\n'''
if old_auth not in worker:
    raise SystemExit('authority recovery response format anchor not found')
worker = worker.replace(old_auth, new_auth, 1)

old_price = '''            response_format: { type: "json_schema", json_schema: priceGuideRecoverySchema }\n'''
new_price = '''            response_format: { type: "json_object" }\n'''
if old_price not in worker:
    raise SystemExit('price guide recovery response format anchor not found')
worker = worker.replace(old_price, new_price, 1)

old_mix = '''      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix: { ...researchMix, synthesisRetryUsed }, checkedAt, cacheHit: false, intelligenceCacheHit: false, cacheableIntelligence, intelligenceTtlDays, researchMode, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);\n'''
new_mix = '''      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix: { ...researchMix, synthesisRetryUsed, synthesisMode: researchMode === "showdown" ? "json_object_with_plain_retry" : "json_schema" }, checkedAt, cacheHit: false, intelligenceCacheHit: false, cacheableIntelligence, intelligenceTtlDays, researchMode, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);\n'''
if old_mix not in worker:
    raise SystemExit('success response anchor not found')
worker = worker.replace(old_mix, new_mix, 1)

worker_path.write_text(worker, encoding='utf-8')

test_path.write_text(r'''const fs = require('fs');
const assert = require('assert');
const worker = fs.readFileSync('src/index.js','utf8');
assert.ok(worker.includes('const VERSION = "3.48.0";'), 'Worker must be v3.48.0');
assert.ok(worker.includes('sealed:intel:v19:'), 'Showdown intelligence cache must advance to v19');
assert.ok(worker.includes('? { type: "json_object" }'), 'Showdown primary synthesis must use JSON object mode instead of strict schema mode');
assert.ok(worker.includes('If Showdown JSON mode itself fails'), 'Showdown retry must intentionally avoid repeating the same structured-mode failure');
assert.ok(worker.includes('retryOptions.response_format = { type: "json_schema", json_schema: activeSynthesisSchema };'), 'single-product retry must retain its existing strict schema behavior');
assert.ok(worker.includes('response_format: { type: "json_object" }'), 'Showdown price-guide recovery must use JSON object mode');
assert.ok(worker.includes('synthesisMode: researchMode === "showdown" ? "json_object_with_plain_retry" : "json_schema"'), 'response diagnostics must expose the Showdown synthesis mode');
assert.ok(worker.includes('sealedRipAiJson(primaryRaw)'), 'primary JSON output must still be parsed locally');
assert.ok(worker.includes('sealedRipAiJson(retryRaw)'), 'retry JSON output must still be parsed locally');
console.log('Showdown JSON reliability tests passed.');
''', encoding='utf-8')

print('Showdown JSON reliability patch applied.')
