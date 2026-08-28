from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.5";', 'const VERSION = "3.38.6";', 'worker version')
worker = replace_once(worker, 'sealed:rip:v2:', 'sealed:rip:v3:', 'rip cache version')

old_helpers = '''function sealedRipSetKeywords(identity) {
  const stop = new Set(["topps", "panini", "upper", "deck", "pokemon", "pokémon", "magic", "gathering", "nba", "nfl", "mlb", "basketball", "baseball", "football", "cards", "card", "trading", "the", "and"]);
  return String(identity?.set || "").toLowerCase().match(/[a-z0-9]+/g)?.filter(token => token.length >= 3 && !stop.has(token)) || [];
}

function sealedRipFilterRelevantEvidence(rows, identity) {
  const tokens = sealedRipSetKeywords(identity);
  if (!tokens.length) return Array.isArray(rows) ? rows : [];
  return (Array.isArray(rows) ? rows : []).filter(row => {
    const text = `${row?.title || ""} ${row?.snippet || ""} ${row?.link || ""}`.toLowerCase();
    return tokens.every(token => text.includes(token));
  });
}
'''
new_helpers = '''function sealedRipResearchSet(identity) {
  let text = String(identity?.set || "").trim();
  const year = String(identity?.year || "").trim();
  if (year) text = text.replace(new RegExp(year.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&"), "ig"), " ");
  text = text
    .replace(/\\b20\\d{2}(?:\\s*[-–/]\\s*\\d{2,4})?\\b/g, " ")
    .replace(/\\b(?:basketball|baseball|football|trading\\s+cards?|cards?)\\b/gi, " ")
    .replace(/\\b(?:value|retail|hobby|mega|blaster|hanger|booster|collection)\\s*(?:box|pack|bundle)?\\b/gi, " ")
    .replace(/\\b(?:factory|brand\\s+new|new|sealed|qty|available)\\b/gi, " ")
    .replace(/\\b\\d+\\s*(?:cards?|packs?)\\b/gi, " ")
    .replace(/[()\\[\\]{}|]+/g, " ")
    .replace(/\\s+/g, " ")
    .trim();
  return text.split(/\\s+/).slice(0, 7).join(" ");
}

function sealedRipSetKeywords(identity) {
  const stop = new Set(["topps", "panini", "upper", "deck", "pokemon", "pokémon", "magic", "gathering", "nba", "nfl", "mlb", "basketball", "baseball", "football", "cards", "card", "trading", "the", "and", "value", "retail", "hobby", "mega", "blaster", "hanger", "booster", "box", "pack", "bundle", "factory", "sealed", "new"]);
  return sealedRipResearchSet(identity).toLowerCase().match(/[a-z0-9]+/g)?.filter(token => token.length >= 3 && !/^\\d+$/.test(token) && !stop.has(token)) || [];
}

function sealedRipFilterRelevantEvidence(rows, identity) {
  const tokens = sealedRipSetKeywords(identity);
  if (!tokens.length) return Array.isArray(rows) ? rows : [];
  const requiredMatches = Math.min(2, tokens.length);
  return (Array.isArray(rows) ? rows : []).filter(row => {
    const text = `${row?.title || ""} ${row?.snippet || ""} ${row?.link || ""}`.toLowerCase();
    const matched = tokens.filter(token => text.includes(token)).length;
    return matched >= requiredMatches;
  });
}
'''
worker = replace_once(worker, old_helpers, new_helpers, 'research set normalization and evidence filter')

old_query = '''      const formatTerms = sealedRipFormatTerms(identity);
      const exactSet = [String(identity?.year || "").trim(), String(identity?.set || "").trim()].filter(Boolean).join(" ");
      const checklistQuery = `"${exactSet}" ${formatTerms} odds checklist rookies case hits autographs parallels`;
      const communityQuery = `"${exactSet}" ${formatTerms} pulls review ${sealedRipCommunitySite(identity?.category)}`;'''
new_query = '''      const formatTerms = sealedRipFormatTerms(identity);
      const researchSet = sealedRipResearchSet(identity);
      const exactSet = [String(identity?.year || "").trim(), researchSet].filter(Boolean).join(" ");
      const checklistQuery = `"${exactSet}" ${formatTerms} odds checklist rookies case hits autographs parallels`;
      const communityQuery = `"${exactSet}" ${formatTerms} pulls review ${sealedRipCommunitySite(identity?.category)}`;'''
worker = replace_once(worker, old_query, new_query, 'research query normalization')

old_gate = '''      if (evidenceRows.length < 2) {
        return json({ ok: false, error: "rip_research_too_thin", message: "Scout could not find enough trustworthy product-specific rip information yet. Try again later or judge this one manually.", researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);
      }'''
new_gate = '''      if (!evidenceRows.length) {
        return json({ ok: false, error: "rip_research_too_thin", message: "Scout could not find even one trustworthy product-specific rip source yet. Try again later or judge this one manually.", researchSearchesUsed, marketplaceSearchesUsed: 0 }, 502, cors);
      }'''
worker = replace_once(worker, old_gate, new_gate, 'thin evidence gate')
worker_path.write_text(worker, encoding='utf-8')

# Update regression checks.
test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = test.replace('3\\.38\\.5', '3\\.38\\.6', 1)
test = test.replace('sealed:rip:v2:', 'sealed:rip:v3:', 1)
anchor = "assert.match(worker,/sealedRipExpandEvidenceRows/,'rip research must expand high-quality source pages beyond search snippets');\n"
extra = anchor + "assert.match(worker,/sealedRipResearchSet/,'rip research must normalize barcode-style product titles into a searchable set name');\nassert.match(worker,/requiredMatches = Math\\.min\\(2, tokens\\.length\\)/,'rip source filter must not require every incidental barcode-title token');\nassert.match(worker,/if \\(!evidenceRows\\.length\\)/,'one trustworthy source should be allowed to produce a guarded partial result');\n"
if 'normalize barcode-style product titles into a searchable set name' not in test:
    test = replace_once(test, anchor, extra, 'thin-search regression assertions')
test_path.write_text(test, encoding='utf-8')
