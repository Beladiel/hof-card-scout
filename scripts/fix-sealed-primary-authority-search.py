from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

worker_path=Path('src/index.js')
worker=worker_path.read_text(encoding='utf-8')
worker=replace_once(worker,'const VERSION = "3.38.9";','const VERSION = "3.38.10";','worker version')
worker=replace_once(worker,'sealed:rip:v6:','sealed:rip:v7:','rip cache version')

old_helper='''function sealedRipTrustedResearchSites(category) {
  const value = String(category || "").toLowerCase();
  if (["basketball", "baseball", "football"].includes(value)) {
    return "(site:topps.com OR site:beckett.com OR site:checklistinsider.com OR site:cardboardconnection.com)";
  }
  if (value.includes("pok")) {
    return "(site:pokemon.com OR site:pokebeach.com OR site:tcgplayer.com OR site:pokellector.com)";
  }
  if (value.includes("magic")) {
    return "(site:magic.wizards.com OR site:wizards.com OR site:scryfall.com OR site:mtg.fandom.com)";
  }
  return "";
}
'''
new_helper='''function sealedRipPrimaryAuthoritySite(category) {
  const value = String(category || "").toLowerCase();
  // One explicit site: filter is much more reliable in Google than a long OR-chain
  // of domains. Beckett is the primary sports checklist/odds source; the second
  // planned search remains reserved for collector sentiment.
  if (["basketball", "baseball", "football"].includes(value)) return "site:beckett.com";
  if (value.includes("pok")) return "site:pokemon.com";
  if (value.includes("magic")) return "site:magic.wizards.com";
  return "";
}
'''
worker=replace_once(worker,old_helper,new_helper,'primary authority helper')

worker=replace_once(
    worker,
    'return /ebay\\.|amazon\\.|walmart\\.|target\\.|bestbuy\\.|mercari\\.|whatnot\\.|fanatics\\.com\\/.*(?:product|shop)|etsy\\.|blowoutcards\\.com|dacardworld\\.com|steelcitycollectibles\\.com/.test(text);',
    'return /ebay\\.|amazon\\.|walmart\\.|target\\.|bestbuy\\.|mercari\\.|whatnot\\.|fanatics\\.com\\/.*(?:product|shop)|etsy\\.|blowoutcards\\.com|dacardworld\\.com|steelcitycollectibles\\.com|dickssportinggoods\\.com|shop\\.app|vortextcg\\.com/.test(text);',
    'shopping source filter',
)

worker=replace_once(
    worker,
    '      const trustedSites = sealedRipTrustedResearchSites(identity?.category);\n      const checklistQuery = `"${exactSet}" ${formatTerms} (odds OR checklist OR "collector guide") -reddit -facebook -ebay -amazon ${trustedSites}`.trim();',
    '      const authoritySite = sealedRipPrimaryAuthoritySite(identity?.category);\n      const checklistQuery = `"${exactSet}" ${formatTerms} ${authoritySite}`.trim();',
    'authoritative search query',
)

old_rows='''      let evidenceRows = [
        ...sealedRipEvidenceRows(checklistData, "checklist-and-odds"),
        ...sealedRipEvidenceRows(communityData, "collector-reports"),
      ];
'''
new_rows='''      const authorityRows = sealedRipEvidenceRows(checklistData, "checklist-and-odds");
      const communityRows = sealedRipEvidenceRows(communityData, "collector-reports");
      const researchMix = {
        authorityCandidates: authorityRows.length,
        communityCandidates: communityRows.length,
      };
      let evidenceRows = [
        ...authorityRows,
        ...communityRows,
      ];
'''
worker=replace_once(worker,old_rows,new_rows,'research mix rows')

worker=replace_once(
    worker,
    '            return json({ ok: true, version: VERSION, productLabel, market, analysis, sources: cached.sources || [], checkedAt: cached.checkedAt || new Date().toISOString(), cacheHit: true, researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);',
    '            return json({ ok: true, version: VERSION, productLabel, market, analysis, sources: cached.sources || [], researchMix: cached.researchMix || null, checkedAt: cached.checkedAt || new Date().toISOString(), cacheHit: true, researchSearchesUsed: 0, marketplaceSearchesUsed: 0 }, 200, cors);',
    'cached research mix response',
)
worker=replace_once(
    worker,
    '        try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ productLabel, analysis: aiObject, evidenceRows, sources, checkedAt }), { expirationTtl: 24 * 60 * 60 }); } catch {}\n      }\n      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, checkedAt, cacheHit: false, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);',
    '        try { await env.SCOUT_DATA.put(cacheKey, JSON.stringify({ productLabel, analysis: aiObject, evidenceRows, sources, researchMix, checkedAt }), { expirationTtl: 24 * 60 * 60 }); } catch {}\n      }\n      return json({ ok: true, version: VERSION, productLabel, market, analysis, sources, researchMix, checkedAt, cacheHit: false, researchSearchesUsed, marketplaceSearchesUsed: 0 }, 200, cors);',
    'fresh research mix response',
)
worker_path.write_text(worker,encoding='utf-8')

test_path=Path('tests/sealed-product-vision.test.cjs')
test=test_path.read_text(encoding='utf-8')
test=test.replace('3\\.38\\.9','3\\.38\\.10',1)
test=test.replace('sealed:rip:v6:','sealed:rip:v7:',1)
old="assert.match(worker,/sealedRipTrustedResearchSites/,'rip research must bias its evidence search toward trustworthy product/checklist sources');\n"
new="assert.match(worker,/sealedRipPrimaryAuthoritySite/,'rip research must use one reliable primary authority domain per category');\nassert.match(worker,/site:beckett\\.com/,'sports rip research must force the authoritative search onto Beckett');\nassert.match(worker,/const researchMix = \\{/,'rip response must record authority versus community candidate counts for diagnostics');\n"
if old in test:
    test=test.replace(old,new,1)
else:
    anchor="assert.match(worker,/sealedRipEvidencePriority/,'rip research must prioritize official and checklist sources for page expansion');\n"
    test=replace_once(test,anchor,anchor+new,'authority regression assertions')
test_path.write_text(test,encoding='utf-8')
