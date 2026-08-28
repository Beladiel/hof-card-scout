from pathlib import Path

p = Path('src/index.js')
text = p.read_text(encoding='utf-8')


def repl(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    text = text.replace(old, new, 1)

repl('const VERSION = "3.40.5";', 'const VERSION = "3.40.6";', 'version')
repl('return `sealed:intel:v7:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'return `sealed:intel:v8:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'sealed cache')

anchor = '''function sealedRipTemperCollectorSummary(value, communitySourceCount = 0) {
'''
helpers = '''function sealedRipFilterCollectorText(value, identity = {}) {
  return String(value || "")
    .split(/(?<=[.!?])\\s+|\\n+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence && sealedRipCommunitySentenceCompatible(sentence, identity))
    .join(" ")
    .trim();
}

function sealedRipFilterCollectorItems(values, identity = {}) {
  return (Array.isArray(values) ? values : [])
    .map(value => String(value || "").trim())
    .filter(value => value && sealedRipCommunitySentenceCompatible(value, identity))
    .slice(0, 4);
}

function sealedRipCollectorFormatConflict(raw, identity = {}) {
  const pieces = [
    String(raw?.collectorTake || ""),
    ...(Array.isArray(raw?.positives) ? raw.positives : []),
    ...(Array.isArray(raw?.negatives) ? raw.negatives : []),
  ].map(value => String(value || "").trim()).filter(Boolean);
  return pieces.some(piece => {
    const explicit = sealedRipExplicitFormatKeys(piece);
    if (!explicit.size && !/\\b(?:fanatics|walmart|target)\\b/i.test(piece)) return false;
    return !sealedRipCommunitySentenceCompatible(piece, identity);
  });
}

'''
repl(anchor, helpers + anchor, 'final collector format helpers')

old = '''  const communitySourceCount = evidenceRows.filter(row => sealedRipCommunityRowCompatible(row, identity)).length;
  const communityEvidenceText = sealedRipCommunityEvidenceText(evidenceRows, identity);
  const sentimentEvidenceAvailable = Boolean(raw?.sentimentEvidenceAvailable) && communitySourceCount >= 2 && communityEvidenceText.length >= 80;
  const priceScore = sealedRipPriceScore(market?.shelfPrice, market?.median);
'''
new = '''  const communitySourceCount = evidenceRows.filter(row => sealedRipCommunityRowCompatible(row, identity)).length;
  const communityEvidenceText = sealedRipCommunityEvidenceText(evidenceRows, identity);
  const collectorFormatConflict = sealedRipCollectorFormatConflict(raw, identity);
  const collectorTakeFiltered = sealedRipFilterCollectorText(raw?.collectorTake, identity);
  const collectorTakeClean = collectorTakeFiltered ? sealedRipTemperCollectorSummary(collectorTakeFiltered, communitySourceCount).slice(0, 700) : "";
  const positivesClean = sealedRipFilterCollectorItems(raw?.positives, identity).map(x => x.slice(0, 220));
  const negativesClean = sealedRipFilterCollectorItems(raw?.negatives, identity).map(x => x.slice(0, 220));
  const collectorContentAvailable = Boolean(collectorTakeClean || positivesClean.length || negativesClean.length);
  const sentimentEvidenceAvailable = Boolean(raw?.sentimentEvidenceAvailable)
    && communitySourceCount >= 2
    && communityEvidenceText.length >= 80
    && collectorContentAvailable
    && !collectorFormatConflict;
  const priceScore = sealedRipPriceScore(market?.shelfPrice, market?.median);
'''
repl(old, new, 'normalize final collector gate')

old_return = '''    collectorTake: sentimentEvidenceAvailable ? sealedRipTemperCollectorSummary(raw?.collectorTake, communitySourceCount).slice(0, 700) : "Scout did not find enough recurring exact-product collector discussion to score sentiment.",
    positives: sentimentEvidenceAvailable ? (Array.isArray(raw?.positives) ? raw.positives : []).map(x => String(x || "").trim().slice(0, 220)).filter(Boolean).slice(0, 4) : [],
    negatives: sentimentEvidenceAvailable ? (Array.isArray(raw?.negatives) ? raw.negatives : []).map(x => String(x || "").trim().slice(0, 220)).filter(Boolean).slice(0, 4) : [],
'''
new_return = '''    collectorTake: sentimentEvidenceAvailable ? collectorTakeClean : (collectorFormatConflict ? "Scout discarded collector sentiment because the synthesized comments mixed a different sealed format into this product." : "Scout did not find enough recurring exact-product collector discussion to score sentiment."),
    positives: sentimentEvidenceAvailable ? positivesClean : [],
    negatives: sentimentEvidenceAvailable ? negativesClean : [],
'''
repl(old_return, new_return, 'return cleaned collector fields')

p.write_text(text, encoding='utf-8')

# Regression assertions.
t = Path('tests/sealed-product-vision.test.cjs')
txt = t.read_text(encoding='utf-8')
if 'assert.match(worker,/const VERSION = "3\\.40\\.5"/);' not in txt:
    raise SystemExit('missing old version assertion')
txt = txt.replace('assert.match(worker,/const VERSION = "3\\.40\\.5"/);', 'assert.match(worker,/const VERSION = "3\\.40\\.6"/);', 1)
if "assert.match(worker,/sealed:intel:v7:/,'sealed product intelligence must use a reusable product cache');" not in txt:
    raise SystemExit('missing old cache assertion')
txt = txt.replace("assert.match(worker,/sealed:intel:v7:/,'sealed product intelligence must use a reusable product cache');", "assert.match(worker,/sealed:intel:v8:/,'sealed product intelligence must use a reusable product cache');", 1)
needle = "assert.ok(worker.includes(\"Never import Hobby, Mega, Hanger, Fanatics\"),'collector synthesis must forbid cross-format opening economics');\n"
if needle not in txt:
    raise SystemExit('missing community format assertion anchor')
extra = """assert.match(worker,/function sealedRipFilterCollectorText/,'final collector summary must be post-filtered by exact format');
assert.match(worker,/function sealedRipFilterCollectorItems/,'collector bullets must be post-filtered by exact format');
assert.match(worker,/function sealedRipCollectorFormatConflict/,'cross-format synthesized sentiment must invalidate the sentiment score');
assert.ok(worker.includes('Scout discarded collector sentiment because the synthesized comments mixed a different sealed format'),'cross-format sentiment must fail closed instead of scoring questionable copy');
"""
txt = txt.replace(needle, needle + extra, 1)
t.write_text(txt, encoding='utf-8')
