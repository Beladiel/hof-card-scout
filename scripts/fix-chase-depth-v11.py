from pathlib import Path

worker_path = Path('src/index.js')
test_path = Path('tests/sealed-product-vision.test.cjs')
worker = worker_path.read_text(encoding='utf-8')
tests = test_path.read_text(encoding='utf-8')

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    return text.replace(old, new, 1)

worker = replace_once(worker, 'const VERSION = "3.42.0";', 'const VERSION = "3.42.1";', 'worker version')
worker = replace_once(worker, 'return `sealed:intel:v11:${encodeURIComponent(parts.join("|" )).slice(0, 420)}`;' if False else 'return `sealed:intel:v11:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'return `sealed:intel:v12:${encodeURIComponent(parts.join("|")).slice(0, 420)}`;', 'intelligence cache version')

worker = replace_once(
    worker,
    '''function sealedRipPriceGuideSite(category) {
  const key = sealedRipCategoryKey(category);
  if (key === "magic") return "site:mtggoldfish.com/sets";
  if (key === "pokemon") return "site:tcgplayer.com";
  if (key === "sports") return "site:pricecharting.com";
  return "";
}''',
    '''function sealedRipPriceGuideSite(category) {
  const key = sealedRipCategoryKey(category);
  if (key === "magic") return "site:tcgplayer.com";
  if (key === "pokemon") return "site:tcgplayer.com";
  if (key === "sports") return "site:sportscardspro.com";
  return "";
}''',
    'price guide routes'
)

worker = replace_once(
    worker,
    '''  if (key === "magic") return `"${cleanSet}" ${site} prices tabletop "All Cards"`.replace(/\\s+/g, " ").trim();''',
    '''  if (key === "magic") return `"${cleanSet}" ${site} "Market Price" Magic`.replace(/\\s+/g, " ").trim();''',
    'Magic price guide query'
)

worker = replace_once(
    worker,
    '''  if (/checklist|beckett|cardboardconnection|tcgplayer|pricecharting|sportscollectorsdaily|pokebeach|justinbasil|mtggoldfish|scryfall/.test(text)) return "checklist/editorial";''',
    '''  if (/checklist|beckett|cardboardconnection|tcgplayer|pricecharting|sportscardspro|sportscollectorsdaily|pokebeach|justinbasil|mtggoldfish|scryfall/.test(text)) return "checklist/editorial";''',
    'SportsCardsPro source classification'
)

worker = replace_once(
    worker,
    '''  return /https?:\\/\\/(?:www\\.)?(?:beckett\\.com|topps\\.com|checklistinsider\\.com|cardboardconnection\\.com|pokemon\\.com|pokebeach\\.com|justinbasil\\.com|magic\\.wizards\\.com|wizards\\.com|mtggoldfish\\.com|tcgplayer\\.com|pricecharting\\.com|scryfall\\.com)\\//.test(link);''',
    '''  return /https?:\\/\\/(?:www\\.)?(?:beckett\\.com|topps\\.com|checklistinsider\\.com|cardboardconnection\\.com|pokemon\\.com|pokebeach\\.com|justinbasil\\.com|magic\\.wizards\\.com|wizards\\.com|mtggoldfish\\.com|tcgplayer\\.com|pricecharting\\.com|sportscardspro\\.com|scryfall\\.com)\\//.test(link);''',
    'SportsCardsPro reader allowlist'
)

format_helper_anchor = '''function sealedRipOddsRowSupported(row, evidenceRows, identity = {}) {'''
format_helper = r'''function sealedRipFormatAccessFallbackScore(evidenceRows, identity = {}) {
  const compatible = sealedRipCompatibleFormatKeys(identity);
  if (!compatible.size) return 0;
  const key = sealedRipCategoryKey(identity?.category);
  const texts = (Array.isArray(evidenceRows) ? evidenceRows : []).filter(row => {
    if (row?.sourceType === "community") return false;
    if (!sealedRipEvidenceRowMatchesIdentity(row, identity)) return false;
    const text = `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`;
    if (!sealedRipVariantTextCompatible(text, identity)) return false;
    const explicit = sealedRipExplicitFormatKeys(text);
    return explicit.size && Array.from(explicit).some(format => compatible.has(format));
  }).map(row => `${row?.title || ""} ${row?.snippet || ""} ${row?.pageText || ""}`).join(" ");
  if (!texts) return 0;
  const families = key === "magic" ? [
    /\b(?:mythic(?: rare)?|rare)\b/i,
    /\b(?:borderless|showcase|extended art|source material)\b/i,
    /\bfoils?\b/i,
    /\b(?:special guests?|bonus sheet)\b/i,
    /\b(?:serialized|headliner|cosmic foil)\b/i,
  ] : key === "pokemon" ? [
    /\b(?:special illustration rare|sir|illustration rare|ir)\b/i,
    /\b(?:hyper rare|secret rare|ultra rare)\b/i,
    /\b(?:special treatment|promo|full art)\b/i,
    /\b(?:pull rate|hit rate)\b/i,
  ] : [
    /\brookies?\b/i,
    /\b(?:autographs?|signatures?)\b/i,
    /\b(?:parallel|exclusive|numbered|green hoops|light burst|rainbow)\b/i,
    /\b(?:case hit|ssp|short print)\b/i,
    /\b1\s*:\s*\d{1,7}\b/i,
  ];
  const count = families.filter(pattern => pattern.test(texts)).length;
  if (!count) return 45;
  return Math.min(80, 42 + count * 8);
}

'''
worker = replace_once(worker, format_helper_anchor, format_helper + format_helper_anchor, 'format fallback helper')

set_floor_anchor = '''function sealedRipPriceGuideEvidenceText(evidenceRows = [], identity = {}) {'''
set_floor_helper = r'''function sealedRipChaseDepthSetFloor(chaseDepth = {}) {
  if (!chaseDepth?.available) return 0;
  const score = Number(chaseDepth?.score);
  if (!Number.isFinite(score)) return 0;
  if (score >= 85) return 60;
  if (score >= 70) return 52;
  if (score >= 55) return 44;
  if (score >= 40) return 35;
  return 25;
}

'''
worker = replace_once(worker, set_floor_anchor, set_floor_helper + set_floor_anchor, 'depth-derived Set floor helper')

worker = replace_once(
    worker,
    '''  const chaseContextAvailable = sealedRipChaseContextSupported(evidenceRows, identity?.category);
  const chaseEvidenceAvailable = chaseCards.length > 0 || chaseContextAvailable;
  const pullEvidenceAvailable = pullOdds.length > 0;
  const formatAccessContextAvailable = sealedRipFormatAccessContextSupported(evidenceRows, identity);
  const formatAccessEvidenceAvailable = Boolean(raw?.formatAccessEvidenceAvailable) && formatAccessContextAvailable;
  const formatAccessScore = formatAccessEvidenceAvailable ? sealedRipClampScore(raw?.formatAccessScore) : null;''',
    '''  const chaseContextAvailable = sealedRipChaseContextSupported(evidenceRows, identity?.category);
  const chaseEvidenceAvailable = chaseCards.length > 0 || chaseContextAvailable || chaseDepth.available;
  const pullEvidenceAvailable = pullOdds.length > 0;
  const formatAccessContextAvailable = sealedRipFormatAccessContextSupported(evidenceRows, identity);
  const formatAccessEvidenceAvailable = formatAccessContextAvailable;
  const aiFormatAccessScore = sealedRipClampScore(raw?.formatAccessScore);
  const formatAccessScore = formatAccessEvidenceAvailable
    ? (Boolean(raw?.formatAccessEvidenceAvailable) && aiFormatAccessScore > 0
      ? aiFormatAccessScore
      : sealedRipFormatAccessFallbackScore(evidenceRows, identity))
    : null;''',
    'deterministic exact-format evidence'
)

worker = replace_once(
    worker,
    '''  const priceScore = sealedRipPriceScore(market?.shelfPrice, market?.median);
  const parts = {
    priceScore,
    chaseScore: chaseEvidenceAvailable ? sealedRipVerifiedChaseScore(raw?.chaseScore, evidenceRows, identity?.category) : null,
    chaseEvidenceAvailable,''',
    '''  const priceScore = sealedRipPriceScore(market?.shelfPrice, market?.median);
  const verifiedChaseScore = chaseEvidenceAvailable ? sealedRipVerifiedChaseScore(raw?.chaseScore, evidenceRows, identity?.category) : null;
  const depthSetFloor = sealedRipChaseDepthSetFloor(chaseDepth);
  const parts = {
    priceScore,
    chaseScore: chaseEvidenceAvailable ? Math.max(Number(verifiedChaseScore) || 0, depthSetFloor) : null,
    chaseEvidenceAvailable,''',
    'Set score contradiction guard'
)

# Tests: version/cache/routes + new guards.
tests = replace_once(tests, 'assert.match(worker,/const VERSION = "3\\.42\\.0"/);', 'assert.match(worker,/const VERSION = "3\\.42\\.1"/);', 'test version')
tests = replace_once(tests, 'assert.match(worker,/sealed:intel:v11:/,\'sealed product intelligence must use a reusable mode-scoped product cache\');', 'assert.match(worker,/sealed:intel:v12:/,\'sealed product intelligence must use a reusable mode-scoped product cache\');', 'test cache')
tests = replace_once(tests, "assert.ok(worker.includes('site:mtggoldfish.com/sets'),'Magic Chase Depth should use MTGGoldfish set pricing');", "assert.ok(worker.includes('site:tcgplayer.com'),'Magic Chase Depth should use TCGplayer set pricing');", 'test Magic source')
tests = replace_once(tests, "assert.ok(worker.includes('site:pricecharting.com'),'sports Chase Depth should use PriceCharting set pricing');", "assert.ok(worker.includes('site:sportscardspro.com'),'sports Chase Depth should use SportsCardsPro set pricing');", 'test sports source')

insert_after = "assert.match(worker,/function sealedRipChaseDepthMetrics/,'verified singles values must produce a deterministic Chase Depth score');"
new_assertions = insert_after + "\n" + "\n".join([
    "assert.ok(worker.includes('sportscardspro\\\\.com'),'SportsCardsPro must be allowed as a readable price-guide source');",
    "assert.match(worker,/function sealedRipChaseDepthSetFloor/,'verified Chase Depth must provide a conservative Set-strength contradiction floor');",
    "assert.ok(worker.includes('chaseCards.length > 0 || chaseContextAvailable || chaseDepth.available'),'verified singles depth must count as real chase evidence');",
    "assert.match(worker,/function sealedRipFormatAccessFallbackScore/,'exact-format context must have a deterministic fallback score');",
    "assert.ok(worker.includes('const formatAccessEvidenceAvailable = formatAccessContextAvailable'),'locally verified exact-format evidence must not depend on an AI boolean flag');",
])
tests = replace_once(tests, insert_after, new_assertions, 'new v1.1 regression assertions')

worker_path.write_text(worker, encoding='utf-8')
test_path.write_text(tests, encoding='utf-8')
print('Chase Depth v1.1 migration applied.')
