from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.40.0";', 'const VERSION = "3.40.1";', 'worker version')
worker = replace_once(worker, 'return `sealed:intel:v2:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'return `sealed:intel:v3:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'sealed intelligence cache version')

old_filter = '''function sealedRipFilterRelevantEvidence(rows, identity) {
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
new_filter = '''function sealedRipEvidenceYearConflict(text, identity) {
  const wanted = String(identity?.year || "").match(/\\b(20\\d{2})\\b/);
  if (!wanted) return false;
  const rowYears = Array.from(String(text || "").matchAll(/\\b(20\\d{2})\\b/g), match => match[1]);
  return rowYears.length > 0 && !rowYears.includes(wanted[1]);
}

function sealedRipEvidenceBrandConflict(text, identity) {
  const wantedText = String(identity?.set || "").toLowerCase();
  const rowText = String(text || "").toLowerCase();
  const groups = [
    { key: "topps", re: /\\b(?:topps|bowman)\\b/i },
    { key: "panini", re: /\\b(?:panini|donruss|prizm|select|mosaic)\\b/i },
    { key: "upperdeck", re: /\\b(?:upper\\s+deck|o-pee-chee|opc)\\b/i },
  ];
  const wantedGroups = groups.filter(group => group.re.test(wantedText)).map(group => group.key);
  if (!wantedGroups.length) return false;
  const rowGroups = groups.filter(group => group.re.test(rowText)).map(group => group.key);
  if (!rowGroups.length) return false;
  return !rowGroups.some(group => wantedGroups.includes(group));
}

function sealedRipFilterRelevantEvidence(rows, identity) {
  const tokens = sealedRipSetKeywords(identity);
  if (!tokens.length) return Array.isArray(rows) ? rows : [];
  const requiredMatches = Math.min(2, tokens.length);
  return (Array.isArray(rows) ? rows : []).filter(row => {
    const hardIdentityText = `${row?.title || ""} ${row?.link || ""}`;
    if (sealedRipEvidenceYearConflict(hardIdentityText, identity)) return false;
    if (sealedRipEvidenceBrandConflict(hardIdentityText, identity)) return false;
    const text = `${row?.title || ""} ${row?.snippet || ""} ${row?.link || ""}`.toLowerCase();
    const matched = tokens.filter(token => text.includes(token)).length;
    return matched >= requiredMatches;
  });
}
'''
worker = replace_once(worker, old_filter, new_filter, 'relevant evidence filter')

old_product = '''  for (const [re, type] of productRules) {
    if (re.test(text)) { productType = type; break; }
  }

  return {
'''
new_product = '''  for (const [re, type] of productRules) {
    if (re.test(text)) { productType = type; break; }
  }
  // Topps and other sports manufacturers sometimes call the ordinary retail blaster
  // a "Value Box" in UPC catalogs. Preserve the scanner's supported taxonomy while
  // still filling Product Type automatically for those sports products.
  if (!productType && ["Baseball", "Basketball", "Football"].includes(category) && /\\bvalue\\s+box\\b/i.test(text)) {
    productType = "Blaster Box";
  }

  return {
'''
worker = replace_once(worker, old_product, new_product, 'sports value box type inference')

old_sentiment = '''    positives: (Array.isArray(raw?.positives) ? raw.positives : []).map(x => String(x || "").trim().slice(0, 220)).filter(Boolean).slice(0, 4),
    negatives: (Array.isArray(raw?.negatives) ? raw.negatives : []).map(x => String(x || "").trim().slice(0, 220)).filter(Boolean).slice(0, 4),
'''
new_sentiment = '''    positives: sentimentEvidenceAvailable ? (Array.isArray(raw?.positives) ? raw.positives : []).map(x => String(x || "").trim().slice(0, 220)).filter(Boolean).slice(0, 4) : [],
    negatives: sentimentEvidenceAvailable ? (Array.isArray(raw?.negatives) ? raw.negatives : []).map(x => String(x || "").trim().slice(0, 220)).filter(Boolean).slice(0, 4) : [],
'''
worker = replace_once(worker, old_sentiment, new_sentiment, 'sentiment bullet gating')
worker_path.write_text(worker, encoding='utf-8')

test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = replace_once(test, 'assert.match(worker,/const VERSION = "3\\.40\\.0"/);', 'assert.match(worker,/const VERSION = "3\\.40\\.1"/);', 'test worker version')
test = replace_once(test, 'assert.match(worker,/sealed:intel:v2:/,\'sealed product intelligence must use a reusable product cache\');', 'assert.match(worker,/sealed:intel:v3:/,\'sealed product intelligence must use a reusable product cache\');', 'test cache version')
marker = "assert.match(worker,/sealedRipCategoryGuidance/,'sealed analysis prompt must inject a category-specific playbook');"
extra = '''assert.match(worker,/sealedRipEvidenceYearConflict/,'sealed research must reject explicitly wrong-season authority results');
assert.match(worker,/sealedRipEvidenceBrandConflict/,'sealed research must reject conflicting manufacturer results');
assert.ok(worker.includes('["Baseball", "Basketball", "Football"].includes(category) && /\\\\bvalue\\\\s+box\\\\b/i.test(text)'),'sports UPC titles using Value Box must auto-fill Product Type');
assert.match(worker,/positives: sentimentEvidenceAvailable \\?/,'collector positives must be hidden when collector evidence is unavailable');
assert.match(worker,/negatives: sentimentEvidenceAvailable \\?/,'collector negatives must be hidden when collector evidence is unavailable');

'''
test = replace_once(test, marker, extra + marker, 'new regression assertions')
test_path.write_text(test, encoding='utf-8')
