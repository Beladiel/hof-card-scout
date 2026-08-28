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
  // A single site: filter is substantially more reliable in Google than a long
  // parenthesized OR-chain of domains. Beckett is the primary sports checklist
  // and odds source; the second planned search stays reserved for community sentiment.
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
    '      const checklistQuery = `"${exactSet}" ${formatTerms} (odds OR checklist OR "collector guide") -reddit -facebook -ebay -amazon`;',
    '      const authoritySite = sealedRipPrimaryAuthoritySite(identity?.category);\n      const checklistQuery = `"${exactSet}" ${formatTerms} ${authoritySite}`.trim();',
    'authoritative search query',
)
worker_path.write_text(worker,encoding='utf-8')

test_path=Path('tests/sealed-product-vision.test.cjs')
test=test_path.read_text(encoding='utf-8')
test=test.replace('3\\.38\\.9','3\\.38\\.10',1)
test=test.replace('sealed:rip:v6:','sealed:rip:v7:',1)
old="assert.match(worker,/sealedRipTrustedResearchSites/,'rip research must bias its evidence search toward trustworthy product/checklist sources');\n"
new="assert.match(worker,/sealedRipPrimaryAuthoritySite/,'rip research must use one reliable primary authority domain per category');\nassert.match(worker,/site:beckett\\.com/,'sports rip research must force the authoritative search onto Beckett');\n"
if old in test:
    test=test.replace(old,new,1)
else:
    anchor="assert.match(worker,/sealedRipEvidencePriority/,'rip research must prioritize official and checklist sources for page expansion');\n"
    test=replace_once(test,anchor,anchor+new,'authority regression assertions')
old_query_test="assert.match(worker,/\\(odds OR checklist OR \\\"collector guide\\\"\\) -reddit -facebook -ebay -amazon/,'authoritative rip search must be broad enough to return product sources without mixing community/shop results');\n"
if old_query_test in test:
    test=test.replace(old_query_test,"assert.match(worker,/const checklistQuery = `\\\"\\$\\{exactSet\\}\\\" \\$\\{formatTerms\\} \\$\\{authoritySite\\}`\\.trim\\(\\)/,'authoritative search must use the single primary authority site');\n",1)
test_path.write_text(test,encoding='utf-8')
