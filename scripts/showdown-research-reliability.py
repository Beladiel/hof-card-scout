from pathlib import Path

worker_path = Path('src/index.js')
app_path = Path('sealed-product-scout.js')
index_path = Path('index.html')
test_path = Path('tests/sealed-product-vision.test.cjs')
reliability_test_path = Path('tests/showdown-research-reliability.test.cjs')

worker = worker_path.read_text(encoding='utf-8')
app = app_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')
tests = test_path.read_text(encoding='utf-8')

if 'const VERSION = "3.46.0";' not in worker:
    raise SystemExit('expected Worker v3.46.0')
if 'sealed:intel:v17:' not in worker:
    raise SystemExit('expected intelligence cache v17')
worker = worker.replace('const VERSION = "3.46.0";', 'const VERSION = "3.47.0";', 1)
worker = worker.replace('sealed:intel:v17:', 'sealed:intel:v18:', 1)

old_authority = '''  const authorityCategory = String(identity?.category || "").trim().toLowerCase();\n  return `${authorityYear} ${researchSet} ${authorityCategory} ${authoritySite} ${formatTerms} ${researchTerms.authority}`.replace(/\\s+/g, " ").trim();\n'''
new_authority = '''  const authorityCategory = String(identity?.category || "").trim().toLowerCase();\n  // Sports discovery is set-first too. Requiring Blaster/Mega/Hanger wording in\n  // the one Beckett search can hide the canonical set checklist entirely. Exact\n  // configuration is enforced later by section-local Format Access validation.\n  return `${authorityYear} ${researchSet} ${authorityCategory} ${authoritySite} checklist`.replace(/\\s+/g, " ").trim();\n'''
if old_authority not in worker:
    raise SystemExit('sports authority query anchor not found')
worker = worker.replace(old_authority, new_authority, 1)

lane_anchor = '''function sealedRipPriceGuideRows(evidenceRows = [], identity = {}) {\n  return (Array.isArray(evidenceRows) ? evidenceRows : []).filter(row =>\n    row?.queryKind === "singles-price-guide" &&\n    row?.sourceType !== "community" &&\n    sealedRipEvidenceRowMatchesIdentity(row, identity)\n  );\n}\n'''
lane_addition = lane_anchor + r'''
function sealedRipFailureLanes(evidenceRows = [], identity = {}, market = {}, researchMode = "single") {
  const authorityRows = sealedRipAuthorityRows(evidenceRows, identity);
  const priceGuideRows = sealedRipPriceGuideRows(evidenceRows, identity);
  const marketOk = Number.isFinite(Number(market?.median)) && Number(market?.median) > 0;
  return {
    authority: { status: authorityRows.length ? "partial" : "failed", sourceCount: authorityRows.length },
    priceGuide: researchMode === "showdown"
      ? { status: priceGuideRows.length ? "partial" : "failed", sourceCount: priceGuideRows.length }
      : { status: "not_requested", sourceCount: 0 },
    market: { status: marketOk ? "complete" : "failed", sourceCount: marketOk ? 1 : 0 },
    community: { status: researchMode === "showdown" ? "not_requested" : "partial", sourceCount: 0 },
  };
}

function sealedRipShowdownAnalysisComplete(analysis = {}) {
  const lanes = analysis?.lanes || {};
  return Boolean(
    analysis?.chaseEvidenceAvailable &&
    analysis?.chaseDepthEvidenceAvailable &&
    analysis?.formatAccessEvidenceAvailable &&
    lanes?.authority?.status === "complete" &&
    lanes?.priceGuide?.status === "complete" &&
    lanes?.market?.status === "complete"
  );
}
'''
if lane_anchor not in worker:
    raise SystemExit('price guide lane anchor not found')
worker = worker.replace(lane_anchor, lane_addition, 1)

old_cache_read = '''          if (cached?.analysis) {\n            const analysis = sealedRipNormalize(cached.analysis, Array.isArray(cached.evidenceRows) ? cached.evidenceRows : [], market, identity, researchMode);\n            return json({ ok: true, version: VERSION, productLabel, market, analysis, sources: cached.sources || [], checkedAt: cached.checkedAt || new Date().toISOString(), cacheHit: true, intelligenceCacheHit: true, intelligenceTtlDays, researchMode, researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);\n          }\n'''
new_cache_read = '''          if (cached?.analysis) {\n            const analysis = sealedRipNormalize(cached.analysis, Array.isArray(cached.evidenceRows) ? cached.evidenceRows : [], market, identity, researchMode);\n            const cacheUsable = researchMode !== "showdown" || sealedRipShowdownAnalysisComplete(analysis);\n            if (cacheUsable) {\n              return json({ ok: true, version: VERSION, productLabel, market, analysis, sources: cached.sources || [], checkedAt: cached.checkedAt || new Date().toISOString(), cacheHit: true, intelligenceCacheHit: true, intelligenceTtlDays, researchMode, researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);\n            }\n          }\n'''
if old_cache_read not in worker:
    raise SystemExit('rip cache read anchor not found')
worker = worker.replace(old_cache_read, new_cache_read, 1)

old_evidence_gate = '''      if (!evidenceRows.length) {\n        return json({ ok: false, error: "rip_research_too_thin", message: "Scout could not find even one trustworthy product-specific rip source yet. Try again later or judge this one manually.", researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);\n      }\n\n      const sources = evidenceRows\n        .filter(row => /^https?:\\/\\//i.test(String(row?.link || "")) && (row?.sourceType !== "community" || sealedRipCommunityRowCompatible(row, identity)))\n        .slice(0, 12)\n        .map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));\n      const researchMix = {\n        authoritative: evidenceRows.filter(row => row.queryKind === "checklist-and-odds").length,\n        community: evidenceRows.filter(row => row.queryKind === "collector-reports" && sealedRipCommunityRowCompatible(row, identity)).length,\n        priceGuides: evidenceRows.filter(row => row.queryKind === "singles-price-guide").length,\n        expandedPages: evidenceRows.filter(row => String(row.pageText || "").trim()).length,\n      };\n'''
new_evidence_gate = '''      const researchMix = {\n        authoritative: evidenceRows.filter(row => row.queryKind === "checklist-and-odds").length,\n        community: evidenceRows.filter(row => row.queryKind === "collector-reports" && sealedRipCommunityRowCompatible(row, identity)).length,\n        priceGuides: evidenceRows.filter(row => row.queryKind === "singles-price-guide").length,\n        expandedPages: evidenceRows.filter(row => String(row.pageText || "").trim()).length,\n      };\n      const failureLanes = sealedRipFailureLanes(evidenceRows, identity, market, researchMode);\n      if (!evidenceRows.length) {\n        return json({ ok: false, error: "rip_research_too_thin", message: "Scout could not find even one trustworthy product-specific rip source yet. Try again later or judge this one manually.", failureStage: "evidence", lanes: failureLanes, researchMix, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);\n      }\n\n      const sources = evidenceRows\n        .filter(row => /^https?:\\/\\//i.test(String(row?.link || "")) && (row?.sourceType !== "community" || sealedRipCommunityRowCompatible(row, identity)))\n        .slice(0, 12)\n        .map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));\n'''
if old_evidence_gate not in worker:
    raise SystemExit('evidence gate anchor not found')
worker = worker.replace(old_evidence_gate, new_evidence_gate, 1)

start = worker.find('      let rawAnalysis;\n      let synthesisRetryUsed = false;')
end = worker.find('\n      // Recovery is lane-typed.', start)
if start < 0 or end < 0:
    raise SystemExit('synthesis block bounds not found')
new_synthesis = r'''      const showdownSchema = {
        type: "object",
        properties: {
          qualitySummary: { type: "string" },
          chaseScore: { type: "number" },
          chaseEvidenceAvailable: { type: "boolean" },
          chaseCards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } }, required: ["name", "why"] }, maxItems: 5 },
          pullScore: { type: "number" },
          pullEvidenceAvailable: { type: "boolean" },
          pullOdds: { type: "array", items: { type: "object", properties: { item: { type: "string" }, odds: { type: "string" }, sourceType: { type: "string" }, note: { type: "string" } }, required: ["item", "odds", "sourceType", "note"] }, maxItems: 8 },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["qualitySummary", "chaseScore", "chaseEvidenceAvailable", "chaseCards", "pullScore", "pullEvidenceAvailable", "pullOdds", "confidence"]
      };
      const showdownSynthesisPrompt = `SHOWDOWN AUTHORITY-ONLY ANALYSIS for ${productLabel} (${String(identity?.productType || identity?.boxType || "")}). Use ONLY the authority/checklist evidence below. Judge category-appropriate set/chase strength. Named chase cards or families must be explicitly supported. Exact pull odds must be literal and exact-format compatible; otherwise return pullEvidenceAvailable=false and pullOdds=[]. Do not score format access here; local section-aware code does that separately. Do not output singles prices; Chase Depth is extracted from its separate price-guide lane. Never invent names, guarantees, odds, or format claims.\n\nAUTHORITY EVIDENCE:\n${evidenceSignals || evidenceForPrompt.slice(0, 12000) || "No compact authority evidence available."}`;
      const activeSynthesisSchema = researchMode === "showdown" ? showdownSchema : schema;
      const activePrimaryPrompt = researchMode === "showdown" ? showdownSynthesisPrompt : prompt;
      const activeRetryPrompt = researchMode === "showdown" ? showdownSynthesisPrompt : compactSynthesisPrompt;
      let aiObject;
      let synthesisRetryUsed = false;
      try {
        const primaryRaw = await env.AI.run(SEALED_RIP_MODEL, {
          prompt: activePrimaryPrompt,
          max_tokens: researchMode === "showdown" ? 850 : 1400,
          temperature: 0.1,
          response_format: { type: "json_schema", json_schema: activeSynthesisSchema }
        });
        aiObject = sealedRipAiJson(primaryRaw);
      } catch (err) {
        console.warn("sealed rip primary synthesis/parse failed; trying compact authority-only retry", err);
        synthesisRetryUsed = true;
        try {
          const retryRaw = await env.AI.run(SEALED_RIP_MODEL, {
            prompt: activeRetryPrompt,
            max_tokens: researchMode === "showdown" ? 750 : 1200,
            temperature: 0,
            response_format: { type: "json_schema", json_schema: activeSynthesisSchema }
          });
          aiObject = sealedRipAiJson(retryRaw);
        } catch (retryErr) {
          console.error("sealed rip compact synthesis/parse retry failed", retryErr);
          return json({ ok: false, error: "rip_analysis_failed", message: "Scout found the research but could not finish the rip-quality analysis right now.", failureStage: "synthesis", lanes: failureLanes, researchMix: { ...researchMix, synthesisRetryUsed }, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);
        }
      }

      if (researchMode === "showdown") {
        aiObject = {
          formatAccessScore: 0,
          formatAccessEvidenceAvailable: false,
          formatAccessSummary: "",
          sentimentScore: 0,
          sentimentEvidenceAvailable: false,
          sentimentLabel: "unknown",
          collectorTake: "",
          positives: [],
          negatives: [],
          chaseValueCards: [],
          ...aiObject,
        };
      }
'''
worker = worker[:start] + new_synthesis + worker[end:]

old_cache_write = '''      const analysis = sealedRipNormalize(aiObject, evidenceRows, market, identity, researchMode);\n      const checkedAt = new Date().toISOString();\n      if (env.SCOUT_DATA) {\n        try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ productLabel, analysis: aiObject, evidenceRows, sources, checkedAt, researchMode }), { expirationTtl: intelligenceTtlDays * 24 * 60 * 60 }); } catch {}\n      }\n      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix: { ...researchMix, synthesisRetryUsed }, checkedAt, cacheHit: false, intelligenceCacheHit: false, intelligenceTtlDays, researchMode, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);\n'''
new_cache_write = '''      const analysis = sealedRipNormalize(aiObject, evidenceRows, market, identity, researchMode);\n      const checkedAt = new Date().toISOString();\n      const cacheableIntelligence = researchMode !== "showdown" || sealedRipShowdownAnalysisComplete(analysis);\n      if (env.SCOUT_DATA && cacheableIntelligence) {\n        try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ productLabel, analysis: aiObject, evidenceRows, sources, checkedAt, researchMode }), { expirationTtl: intelligenceTtlDays * 24 * 60 * 60 }); } catch {}\n      }\n      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix: { ...researchMix, synthesisRetryUsed }, checkedAt, cacheHit: false, intelligenceCacheHit: false, cacheableIntelligence, intelligenceTtlDays, researchMode, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);\n'''
if old_cache_write not in worker:
    raise SystemExit('cache write anchor not found')
worker = worker.replace(old_cache_write, new_cache_write, 1)

old_market = '''        const marketData=await marketRes.json().catch(()=>({}));if(!marketRes.ok||!marketData.ok)throw new Error(marketData.message||"Market-price research failed.");\n        market={shelfPrice:Number(marketData.shelfPrice||item.shelfPrice),median:Number(marketData.median),verdict:marketData.verdict||"",reason:marketData.reason||"",marketplaceSearchesUsed:Number(marketData.marketplaceSearchesUsed||0),cacheHit:!!marketData.cacheHit};marketSearches+=market.marketplaceSearchesUsed;\n'''
new_market = '''        const marketData=await marketRes.json().catch(()=>({}));marketSearches+=Number(marketData.marketplaceSearchesUsed||0);if(!marketRes.ok||!marketData.ok)throw new Error(marketData.message||"Market-price research failed.");\n        market={shelfPrice:Number(marketData.shelfPrice||item.shelfPrice),median:Number(marketData.median),verdict:marketData.verdict||"",reason:marketData.reason||"",marketplaceSearchesUsed:Number(marketData.marketplaceSearchesUsed||0),cacheHit:!!marketData.cacheHit};\n'''
if old_market not in app:
    raise SystemExit('showdown market accounting anchor not found')
app = app.replace(old_market, new_market, 1)

old_rip = '''            const ripData=await ripRes.json().catch(()=>({}));if(!ripRes.ok||!ripData.ok)throw new Error(ripData.message||"Product research failed.");\n            analysis=ripData.analysis||{};researchSearches+=Number(ripData.researchSearchesUsed||0);\n          }catch(err){error=err?.message||"Product research failed.";}\n'''
new_rip = '''            const ripData=await ripRes.json().catch(()=>({}));researchSearches+=Number(ripData.researchSearchesUsed||0);\n            if(!ripRes.ok||!ripData.ok){analysis={lanes:ripData.lanes||{},researchMode:"showdown",researchProfile:String(item.identity?.category||"").toLowerCase(),failureStage:ripData.failureStage||"research",researchMix:ripData.researchMix||{}};throw new Error(ripData.message||"Product research failed.");}\n            analysis=ripData.analysis||{};\n          }catch(err){error=err?.message||"Product research failed.";}\n'''
if old_rip not in app:
    raise SystemExit('showdown rip accounting anchor not found')
app = app.replace(old_rip, new_rip, 1)

old_compact = 'researchMode:row.analysis?.researchMode||"",lanes:row.analysis?.lanes||{}},metrics:row.metrics,error:row.error}'
new_compact = 'researchMode:row.analysis?.researchMode||"",lanes:row.analysis?.lanes||{},failureStage:row.analysis?.failureStage||"",researchMix:row.analysis?.researchMix||{}},metrics:row.metrics,error:row.error}'
if old_compact not in app:
    raise SystemExit('showdown compact persistence anchor not found')
app = app.replace(old_compact, new_compact, 1)

if 'sealed-product-scout.js?v=6.5.2' not in index:
    raise SystemExit('frontend cache-bust v6.5.2 not found')
index = index.replace('sealed-product-scout.js?v=6.5.2', 'sealed-product-scout.js?v=6.5.3', 1)

replacements = {
    'assert.match(worker,/const VERSION = "3\\.46\\.0"/);': 'assert.match(worker,/const VERSION = "3\\.47\\.0"/);',
    "assert.match(worker,/sealed:intel:v17:/,'sealed product intelligence must use a reusable mode-scoped product cache');": "assert.match(worker,/sealed:intel:v18:/,'sealed product intelligence must use a reusable mode-scoped product cache');",
    "assert.match(index,/sealed-product-scout\\.js\\?v=6\\.5\\.2/,'sealed scanner cache-bust must advance for typed evidence lanes');": "assert.match(index,/sealed-product-scout\\.js\\?v=6\\.5\\.3/,'sealed scanner cache-bust must advance for Showdown reliability fixes');",
}
for old, new in replacements.items():
    if old not in tests:
        raise SystemExit(f'stale regression anchor not found: {old}')
    tests = tests.replace(old, new, 1)

extra_anchor = "assert.match(worker,/function sealedRipFormatAccessContextSupported/,'Shelf Showdown must locally verify exact-format chase access');\n"
extra = extra_anchor + "assert.match(worker,/function sealedRipShowdownAnalysisComplete/,'Showdown cache must reject incomplete intelligence');\nassert.match(worker,/function sealedRipFailureLanes/,'failed Showdown research must expose typed lane diagnostics');\nassert.ok(worker.includes('const activeSynthesisSchema = researchMode === \"showdown\" ? showdownSchema : schema'),'Showdown must use a smaller authority-only synthesis schema');\nassert.ok(worker.includes('sealed rip primary synthesis/parse failed'),'malformed AI JSON must trigger the compact retry too');\n"
if extra_anchor not in tests:
    raise SystemExit('main regression insertion anchor not found')
tests = tests.replace(extra_anchor, extra, 1)

reliability_test = r'''const fs=require('fs');
const assert=require('assert');
const worker=fs.readFileSync('src/index.js','utf8');
const app=fs.readFileSync('sealed-product-scout.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(worker.includes('const VERSION = "3.47.0"'));
assert.ok(worker.includes('sealed:intel:v18:'));
assert.ok(index.includes('sealed-product-scout.js?v=6.5.3'));
assert.ok(worker.includes('return `${authorityYear} ${researchSet} ${authorityCategory} ${authoritySite} checklist`'), 'sports authority discovery must be set-first and omit exact format terms');
assert.ok(worker.includes('const showdownSchema = {'), 'Showdown should have a dedicated compact synthesis schema');
assert.ok(worker.includes('max_tokens: researchMode === "showdown" ? 850 : 1400'), 'Showdown primary synthesis should stay compact');
assert.ok(worker.includes('aiObject = sealedRipAiJson(primaryRaw)'), 'primary synthesis must parse inside the retryable try block');
assert.ok(worker.includes('aiObject = sealedRipAiJson(retryRaw)'), 'retry must also parse before being accepted');
assert.ok(worker.includes('failureStage: "synthesis", lanes: failureLanes'), 'synthesis failures must return lane diagnostics');
assert.ok(worker.includes('failureStage: "evidence", lanes: failureLanes'), 'evidence failures must return lane diagnostics');
assert.ok(worker.includes('const cacheableIntelligence = researchMode !== "showdown" || sealedRipShowdownAnalysisComplete(analysis)'), 'partial Showdown intelligence must not be cached');
assert.ok(worker.includes('const cacheUsable = researchMode !== "showdown" || sealedRipShowdownAnalysisComplete(analysis)'), 'incomplete cached Showdown intelligence must be ignored');
assert.ok(app.includes('marketSearches+=Number(marketData.marketplaceSearchesUsed||0);if(!marketRes.ok||!marketData.ok)'), 'failed market calls must still count consumed searches');
assert.ok(app.includes('researchSearches+=Number(ripData.researchSearchesUsed||0);'), 'failed rip calls must still count consumed research searches');
assert.ok(app.includes('analysis={lanes:ripData.lanes||{}'), 'failed rip calls must preserve backend lane diagnostics');
console.log('Showdown research reliability tests passed.');
'''

worker_path.write_text(worker, encoding='utf-8')
app_path.write_text(app, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
test_path.write_text(tests, encoding='utf-8')
reliability_test_path.write_text(reliability_test, encoding='utf-8')
print('Showdown research reliability patch applied.')
