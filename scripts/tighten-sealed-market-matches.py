from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

worker_path = Path('src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const VERSION = "3.38.1";', 'const VERSION = "3.38.2";', 'worker version')

marker = '''function sealedMarketResultRows(data, identity) {\n'''
helpers = r'''function sealedMarketIdentityTokens(value) {
  const stop = new Set([
    "nba", "nfl", "mlb", "basketball", "football", "baseball", "trading", "card", "cards",
    "value", "blaster", "box", "boxes", "hobby", "retail", "mega", "hanger", "booster",
    "elite", "trainer", "collection", "tin", "pack", "packs", "factory", "sealed", "brand",
    "new", "qty", "available"
  ]);
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !/^20\d{2}$/.test(token) && !/^\d{1,3}$/.test(token) && !stop.has(token));
}

function sealedMarketIdentityMatches(title, identity, lookupTitle) {
  const text = String(title || "");
  const known = [lookupTitle, identity?.set, identity?.variant].filter(Boolean).join(" ");
  const wanted = Array.from(new Set(sealedMarketIdentityTokens(known)));
  if (wanted.length) {
    const actual = new Set(sealedMarketIdentityTokens(text));
    const required = Math.min(2, wanted.length);
    const overlap = wanted.filter(token => actual.has(token)).length;
    if (overlap < required) return false;
  }

  const knownLower = known.toLowerCase();
  if (/\bfanatics\b/i.test(text) && !/\bfanatics\b/.test(knownLower)) return false;
  if (/\bchrome\b/i.test(text) && !/\bchrome\b/.test(knownLower)) return false;
  if (/\bsignature\s+class\b/i.test(text) && !/\bsignature\s+class\b/.test(knownLower)) return false;
  return true;
}

function sealedMarketIsMultiUnit(title) {
  const text = String(title || "");
  return /(?:^|\s)(?:[2-9]\d*)x\b|\blot\s+of\s+(?:[2-9]\d*|two|three|four|five|six|seven|eight|nine|ten)\b|\bcase\s+of\b|\b(?:[2-9]\d*)\s*(?:boxes|blasters|tins|etbs|bundles)\b/i.test(text);
}

function sealedMarketResultRows(data, identity, lookupTitle = "") {
'''
worker = replace_once(worker, marker, helpers, 'sealed market result helper signature')

worker = replace_once(
    worker,
    '''    if (!title || /\\b(?:case\\s+break|break\\s+spot|rip\\s*(?:&|and)\\s*ship|live\\s+rip|rip\\s+ship|personal\\s+break|team\\s+break|random\\s+team|empty\\s+box|box\\s+only|opened|wrapper|digital|you\\s+pick|single\\s+card)\\b/i.test(title)) continue;\n    if (!sealedMarketTypeMatches(title, type)) continue;\n''',
    '''    if (!title || /\\b(?:case\\s+break|break\\s+spot|rip\\s*(?:&|and)\\s*ship|live\\s+rip|rip\\s+ship|personal\\s+break|team\\s+break|random\\s+team|empty\\s+box|box\\s+only|opened|wrapper|digital|you\\s+pick|single\\s+card)\\b/i.test(title)) continue;\n    if (sealedMarketIsMultiUnit(title)) continue;\n    if (!sealedMarketTypeMatches(title, type)) continue;\n    if (!sealedMarketIdentityMatches(title, identity, lookupTitle)) continue;\n''',
    'sealed market stricter filters',
)

worker = replace_once(
    worker,
    'const cacheKey = `sealed:value:v1:${encodeURIComponent(query.toLowerCase()).slice(0, 300)}`;',
    'const cacheKey = `sealed:value:v2:${encodeURIComponent(query.toLowerCase()).slice(0, 300)}`;',
    'sealed market cache version',
)
worker = replace_once(
    worker,
    'const listings = sealedMarketResultRows(data, identity);',
    'const listings = sealedMarketResultRows(data, identity, lookupTitle);',
    'sealed market exact identity call',
)
worker_path.write_text(worker, encoding='utf-8')

test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = replace_once(test, 'assert.match(worker,/const VERSION = "3\\.38\\.1"/);', 'assert.match(worker,/const VERSION = "3\\.38\\.2"/);', 'test version')
needle = "assert.ok(worker.includes('rip\\\\s*(?:&|and)\\\\s*ship'),'sealed market check must reject rip-and-ship listings');\n"
extra = needle + "assert.match(worker,/sealed:value:v2:/,'sealed market filter changes must invalidate stale cached results');\nassert.match(worker,/sealedMarketIdentityMatches/,'sealed market check must require product-family identity matches');\nassert.match(worker,/sealedMarketIsMultiUnit/,'sealed market check must reject multi-box lots');\n"
if 'filter changes must invalidate stale cached results' not in test:
    test = replace_once(test, needle, extra, 'sealed market quality regression assertions')
test_path.write_text(test, encoding='utf-8')
