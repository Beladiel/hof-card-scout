from pathlib import Path

worker_path = Path('src/index.js')
test_path = Path('tests/sealed-product-vision.test.cjs')
worker = worker_path.read_text(encoding='utf-8')
tests = test_path.read_text(encoding='utf-8')

repls = [
    ('const VERSION = "3.42.1";', 'const VERSION = "3.42.2";'),
    ('sealed:intel:v12:', 'sealed:intel:v13:'),
    ('''async function sealedRipExpandEvidenceRows(rows) {
  const list = Array.isArray(rows) ? rows.slice(0, 20) : [];
  const fetchable = list
    .map((row, index) => ({ row, index }))
    .filter(x => x.row.sourceType !== "community")
    .sort((a, b) => sealedRipEvidencePriority(a.row) - sealedRipEvidencePriority(b.row) || a.index - b.index)
    .slice(0, 8);
  const expanded = await Promise.all(fetchable.map(async ({ row, index }) => ({ index, pageText: await sealedRipFetchPageText(row) })));
  const byIndex = new Map(expanded.map(x => [x.index, x.pageText]));
  return list.map((row, index) => ({ ...row, pageText: byIndex.get(index) || "" }));
}''', '''async function sealedRipExpandEvidenceRows(rows) {
  const list = Array.isArray(rows) ? rows.slice(0, 20) : [];
  const candidates = list
    .map((row, index) => ({ row, index }))
    .filter(x => x.row.sourceType !== "community");
  // Showdown uses the second research search for a singles price guide. Those rich
  // pages must never crowd the authoritative set/checklist page out of the reader
  // budget. Reserve most expansion slots for product evidence and only a small lane
  // for price-guide extraction.
  const authorityCandidates = candidates
    .filter(x => x.row.queryKind !== "singles-price-guide")
    .sort((a, b) => sealedRipEvidencePriority(a.row) - sealedRipEvidencePriority(b.row) || a.index - b.index)
    .slice(0, 6);
  const priceGuideCandidates = candidates
    .filter(x => x.row.queryKind === "singles-price-guide")
    .sort((a, b) => a.index - b.index)
    .slice(0, 2);
  const fetchable = [...authorityCandidates, ...priceGuideCandidates];
  const expanded = await Promise.all(fetchable.map(async ({ row, index }) => ({ index, pageText: await sealedRipFetchPageText(row) })));
  const byIndex = new Map(expanded.map(x => [x.index, x.pageText]));
  return list.map((row, index) => ({ ...row, pageText: byIndex.get(index) || "" }));
}'''),
    ('''.filter(Boolean).join("\\n---\\n").slice(0, 18000);
}''', '''.filter(Boolean).join("\\n---\\n").slice(0, 12000);
}'''),
    ('''      const evidenceSignals = sealedRipPromptSignals(evidenceRows, identity?.category);
      const priceGuideSignals = sealedRipPriceGuideEvidenceText(evidenceRows, identity);
      const evidenceForPrompt = evidenceRows.slice(0, 18).map((row, index) =>
        `[${index + 1}] TYPE=${row.sourceType}; SEARCH=${row.queryKind}; TITLE=${row.title}; SOURCE=${row.source}; URL=${row.link}; SNIPPET=${row.snippet}; PAGE=${row.pageText || ""}`
      ).join("\\n\\n").slice(0, 34000);''', '''      // In Showdown, singles price-guide evidence has exactly one job: Chase Depth.
      // Keep it out of the main set/format synthesis prompt so a large pricing page
      // cannot overload or distract the model. The compact recovery/extraction pass
      // below receives priceGuideSignals separately and spends zero extra searches.
      const mainEvidenceRows = researchMode === "showdown"
        ? evidenceRows.filter(row => row.queryKind !== "singles-price-guide")
        : evidenceRows;
      const evidenceSignals = sealedRipPromptSignals(mainEvidenceRows, identity?.category);
      const priceGuideSignals = sealedRipPriceGuideEvidenceText(evidenceRows, identity);
      const evidenceForPrompt = mainEvidenceRows.slice(0, 14).map((row, index) =>
        `[${index + 1}] TYPE=${row.sourceType}; SEARCH=${row.queryKind}; TITLE=${row.title}; SOURCE=${row.source}; URL=${row.link}; SNIPPET=${row.snippet}; PAGE=${row.pageText || ""}`
      ).join("\\n\\n").slice(0, 26000);'''),
]

for old, new in repls:
    if old not in worker:
        raise SystemExit(f'worker replacement target not found: {old[:120]!r}')
    worker = worker.replace(old, new, 1)

needle = '''      let rawAnalysis;
      try {
        rawAnalysis = await env.AI.run(SEALED_RIP_MODEL, {
          prompt,
          max_tokens: 1400,
          temperature: 0.1,
          response_format: { type: "json_schema", json_schema: schema }
        });
      } catch (err) {
        console.error("sealed rip quality AI failed", err);
        return json({ ok: false, error: "rip_analysis_failed", message: "Scout found the research but could not finish the rip-quality analysis right now.", researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);
      }
'''
replacement = '''      const compactSynthesisPrompt = `Evaluate ${productLabel} (${String(identity?.productType || identity?.boxType || "")}) using ONLY the compact evidence below. Return the requested JSON schema. ${sealedRipCategoryGuidance(identity?.category)} Never invent card names, odds, pull rates, guarantees, or format access. Exact pull odds must be literal and exact-format compatible. In Shelf Showdown, singles-price extraction is handled separately, so return chaseValueCards=[] here. If community evidence is absent, set sentimentEvidenceAvailable=false and leave collector fields conservative.\\n\\nCOMPACT AUTHORITY EVIDENCE:\\n${evidenceSignals || evidenceForPrompt.slice(0, 12000) || "No compact authority evidence available."}`;
      let rawAnalysis;
      let synthesisRetryUsed = false;
      try {
        rawAnalysis = await env.AI.run(SEALED_RIP_MODEL, {
          prompt,
          max_tokens: 1400,
          temperature: 0.1,
          response_format: { type: "json_schema", json_schema: schema }
        });
      } catch (err) {
        console.warn("sealed rip primary synthesis failed; trying compact authority-only retry", err);
        synthesisRetryUsed = true;
        try {
          rawAnalysis = await env.AI.run(SEALED_RIP_MODEL, {
            prompt: compactSynthesisPrompt,
            max_tokens: 1200,
            temperature: 0,
            response_format: { type: "json_schema", json_schema: schema }
          });
        } catch (retryErr) {
          console.error("sealed rip compact synthesis retry failed", retryErr);
          return json({ ok: false, error: "rip_analysis_failed", message: "Scout found the research but could not finish the rip-quality analysis right now.", researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);
        }
      }
'''
if needle not in worker:
    raise SystemExit('AI synthesis block not found')
worker = worker.replace(needle, replacement, 1)

old_return = '''      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix, checkedAt, cacheHit: false, intelligenceCacheHit: false, intelligenceTtlDays, researchMode, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);'''
new_return = '''      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix: { ...researchMix, synthesisRetryUsed }, checkedAt, cacheHit: false, intelligenceCacheHit: false, intelligenceTtlDays, researchMode, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);'''
if old_return not in worker:
    raise SystemExit('success return not found')
worker = worker.replace(old_return, new_return, 1)

# Update regression expectations and add architecture guards.
for old, new in [
    ('const VERSION = "3\\.42\\.1"', 'const VERSION = "3\\.42\\.2"'),
    ('sealed:intel:v12:', 'sealed:intel:v13:'),
]:
    if old not in tests:
        raise SystemExit(f'test replacement target not found: {old}')
    tests = tests.replace(old, new, 1)

anchor = "assert.match(worker,/function sealedRipChaseDepthSetFloor/,'verified Chase Depth must provide a conservative Set-strength contradiction floor');"
extra = '''\nassert.ok(worker.includes('const mainEvidenceRows = researchMode === "showdown"'),'Showdown must isolate price-guide rows from the main synthesis prompt');
assert.ok(worker.includes('row.queryKind !== "singles-price-guide"'),'main Showdown evidence must exclude singles price-guide rows');
assert.ok(worker.includes('const authorityCandidates = candidates'),'page expansion must reserve capacity for authoritative product evidence');
assert.ok(worker.includes('const priceGuideCandidates = candidates'),'price-guide page expansion must have a separate bounded lane');
assert.ok(worker.includes('.slice(0, 2);'),'price-guide page expansion must stay tightly bounded');
assert.ok(worker.includes('sealed rip primary synthesis failed; trying compact authority-only retry'),'rip analysis must retry once with a compact authority-only prompt without another search');
assert.ok(worker.includes('synthesisRetryUsed'),'rip response must expose whether the compact synthesis fallback was needed');'''
if anchor not in tests:
    raise SystemExit('test anchor not found')
tests = tests.replace(anchor, anchor + extra, 1)

worker_path.write_text(worker, encoding='utf-8')
test_path.write_text(tests, encoding='utf-8')
print('Showdown prompt isolation migration applied.')
