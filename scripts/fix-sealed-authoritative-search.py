from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.8";', 'const VERSION = "3.38.9";', 'worker version')
worker = replace_once(worker, 'sealed:rip:v5:', 'sealed:rip:v6:', 'rip cache version')

old_query = '''      const trustedSites = sealedRipTrustedResearchSites(identity?.category);\n      const checklistQuery = `"${exactSet}" ${formatTerms} odds checklist rookies autographs parallels "case hit" ${trustedSites}`.trim();\n      const communityQuery = `"${exactSet}" ${formatTerms} pulls review ${sealedRipCommunitySite(identity?.category)}`;'''
new_query = '''      // Keep the authoritative search intentionally broad. Requiring odds + checklist +\n      // rookies + autos + parallels + case-hit language all at once caused Google to\n      // return no non-community results for valid products such as 2025-26 Topps Hoops.\n      // We instead ask for any of the core authoritative research signals, then rank and\n      // validate the returned sources locally. This still spends exactly one research\n      // search for product/checklist evidence and one for collector sentiment.\n      const checklistQuery = `"${exactSet}" ${formatTerms} (odds OR checklist OR "collector guide") -reddit -facebook -ebay -amazon`;\n      const communityQuery = `"${exactSet}" ${formatTerms} pulls review ${sealedRipCommunitySite(identity?.category)}`;'''
worker = replace_once(worker, old_query, new_query, 'authoritative research query')

# Add a small diagnostic summary to the API response so future failures can be
# distinguished between search failure, filtering, and extraction without exposing secrets.
old_sources = '''      const sources = evidenceRows.slice(0, 12).map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));\n      const evidenceSignals = sealedRipPromptSignals(evidenceRows);'''
new_sources = '''      const sources = evidenceRows.slice(0, 12).map(row => ({ title: row.title, link: row.link, sourceType: row.sourceType, queryKind: row.queryKind }));\n      const researchMix = {\n        authoritative: evidenceRows.filter(row => row.queryKind === "checklist-and-odds").length,\n        community: evidenceRows.filter(row => row.queryKind === "collector-reports").length,\n        expandedPages: evidenceRows.filter(row => String(row.pageText || "").trim()).length,\n      };\n      const evidenceSignals = sealedRipPromptSignals(evidenceRows);'''
worker = replace_once(worker, old_sources, new_sources, 'research diagnostics')

old_return = '''      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, checkedAt, cacheHit: false, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);'''
new_return = '''      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix, checkedAt, cacheHit: false, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);'''
worker = replace_once(worker, old_return, new_return, 'fresh rip response diagnostics')

worker_path.write_text(worker, encoding='utf-8')

test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = test.replace('3\\.38\\.8', '3\\.38\\.9', 1)
test = test.replace('sealed:rip:v5:', 'sealed:rip:v6:', 1)
old_assert = "assert.match(worker,/sealedRipTrustedResearchSites/,'rip research must bias its evidence search toward trustworthy product/checklist sources');\n"
new_assert = "assert.match(worker,/\\(odds OR checklist OR \\\"collector guide\\\"\\) -reddit -facebook -ebay -amazon/,'authoritative rip search must be broad enough to return product sources without mixing community/shop results');\n"
if old_assert in test:
    test = test.replace(old_assert, new_assert, 1)
else:
    raise SystemExit('Missing trusted research regression assertion')
anchor = "assert.match(worker,/recoveryPrompt/,'rip research must retry extraction from compact evidence without spending another search');\n"
extra = anchor + "assert.match(worker,/const researchMix = \\{/,'rip response must expose safe source-mix diagnostics for troubleshooting');\n"
if 'rip response must expose safe source-mix diagnostics' not in test:
    test = replace_once(test, anchor, extra, 'research diagnostics regression assertion')
test_path.write_text(test, encoding='utf-8')
